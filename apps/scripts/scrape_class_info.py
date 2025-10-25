#!/usr/bin/env python3
# scrape_bu_classes_mt.py
"""
Multithreaded BU course scraper (JSON only, with proper description extraction).

Usage:
  pip install requests beautifulsoup4 tqdm
  # optional cache:
  pip install diskcache

  python scrape_bu_classes_mt.py --workers 6 --rps 0.5 --burst 2 --delay 0.05 --cache
"""

import argparse
import json
import logging
import random
import re
import sys
import threading
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from tqdm import tqdm

# ------------------------ Config / Defaults ------------------------

INPUT_FILE_DEFAULT = "class_urls.txt"
JSON_OUT_DEFAULT = "class_offerings.json"
LOG_FILE = "scrape.log"

# Semester & schedule patterns
SEMESTER_PAT = re.compile(
    r"\b(?:(?:FALL|SPRING|SPRG|SUMMER|SUM(?:\s*(?:I|II|1|2))?))\s+\d{4}\b",
    flags=re.IGNORECASE,
)
TIME_PAT = re.compile(
    r"\b(?:M|T|W|R|F|S|U){1,4}\s+\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)\b"
)

# Table header candidates
INSTR_HEADER_CANDIDATES = {"instructor", "instructors", "professor", "faculty"}
SCHED_HEADER_CANDIDATES = {"schedule", "days/times", "days & times", "meeting time", "time", "days", "location & time"}

# URL: /academics/{school}/courses/{school}-{dept}-{num}/
URL_CODE_PAT = re.compile(
    r"/academics/([a-z]{3})/courses/([a-z]{3})-([a-z]{2,4})-([0-9a-z]+)(?:/|$)",
    re.IGNORECASE,
)

# Title/description helpers
COURSE_CODE_H2_PAT = re.compile(r"^[A-Z]{3}\s+[A-Z]{2,4}\s+[0-9A-Z]+$")
BOILERPLATE_PAT = re.compile(r"^Note that this information may change", re.I)

# Optional disk cache (enabled via --cache flag)
from diskcache import Cache

# ------------------------ Networking (Session & Rate limiting) ------------------------

_tls = threading.local()

def make_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(
        total=5,
        backoff_factor=0.8,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "HEAD"]),
        raise_on_status=False,
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retries, pool_connections=32, pool_maxsize=32)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    s.headers.update({
        "User-Agent": "BU-Course-Scraper (research; contact: your-email@example.com)"
    })
    return s

def session() -> requests.Session:
    s = getattr(_tls, "session", None)
    if s is None:
        s = make_session()
        _tls.session = s
    return s

class TokenBucket:
    """Global requests-per-second limiter with small burst capacity."""
    def __init__(self, rate_per_sec: float, burst: int):
        self.rate = max(rate_per_sec, 1e-6)
        self.capacity = max(1, burst)
        self.tokens = self.capacity
        self.updated = time.monotonic()
        self.lock = threading.Lock()

    def wait(self):
        with self.lock:
            now = time.monotonic()
            self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
            self.updated = now
            if self.tokens < 1:
                sleep_for = (1 - self.tokens) / self.rate
                # release lock while sleeping
                self.lock.release()
                try:
                    time.sleep(sleep_for)
                finally:
                    self.lock.acquire()
                self.tokens = 0
            else:
                self.tokens -= 1

def parse_retry_after(hdr: Optional[str]) -> float:
    if not hdr:
        return 0.0
    try:
        return float(hdr)  # seconds
    except ValueError:
        try:
            dt = datetime.strptime(hdr, "%a, %d %b %Y %H:%M:%S %Z")
            return max(0.0, (dt - datetime.utcnow()).total_seconds())
        except Exception:
            return 0.0

def backoff_sleep(attempt: int, base: float = 0.8, cap: float = 30.0):
    # Full-jitter exponential backoff
    sleep_for = min(cap, base * (2 ** attempt))
    time.sleep(random.uniform(0, sleep_for))

# ------------------------ Parsing helpers ------------------------

def header_text(el: Optional[Tag]) -> str:
    return "" if el is None else " ".join(el.get_text(separator=" ", strip=True).split())

def parse_codes_from_url(url: str) -> Tuple[str, str, str]:
    m = URL_CODE_PAT.search(url)
    if m:
        return m.group(2).upper(), m.group(3).upper(), m.group(4).upper()
    last = url.rstrip("/").split("/")[-1]
    parts = last.split("-")
    if len(parts) >= 3:
        return parts[0].upper(), parts[1].upper(), parts[2].upper()
    logging.warning(f"Could not parse course codes from URL: {url}")
    return "UNK", "UNK", "UNK"

def normalize_semester_text(s: str) -> str:
    s = s.strip()
    m = re.search(r"(Spring|Fall|Summer|SPRG|FALL|SUM(?:\s*I|II|1|2)?)\s+(\d{4})", s, re.IGNORECASE)
    if not m:
        return s.upper()
    term = m.group(1).upper()
    year = m.group(2)
    mapping = {
        "SPRING": "SPRG",
        "FALL": "FALL",
        "SUMMER": "SUM",
        "SPRG": "SPRG",
        "SUM": "SUM",
        "SUM I": "SUM I",
        "SUM II": "SUM II",
        "SUM 1": "SUM I",
        "SUM 2": "SUM II",
    }
    term_norm = mapping.get(term, term)
    return f"{term_norm} {year}"

def find_semester_headers(soup: BeautifulSoup) -> List[Tag]:
    headers = []
    for tag in soup.find_all(["h2", "h3", "h4", "h5"]):
        if SEMESTER_PAT.search(header_text(tag)):
            headers.append(tag)
    return headers

def table_header_map(table: Tag) -> Dict[str, int]:
    header_cells = []
    thead = table.find("thead")
    if thead:
        row = thead.find("tr")
        if row:
            header_cells = row.find_all(["th", "td"])
    if not header_cells:
        first_tr = table.find("tr")
        if first_tr:
            header_cells = first_tr.find_all(["th", "td"])
    mapping = {}
    for idx, cell in enumerate(header_cells):
        txt = cell.get_text(strip=True).lower()
        if txt:
            mapping[txt] = idx
    return mapping

def best_col_idx(header_map: Dict[str, int], candidates: set) -> Optional[int]:
    for key, idx in header_map.items():
        if key in candidates:
            return idx
    for key, idx in header_map.items():
        for c in candidates:
            if c in key:
                return idx
    return None

def extract_rows_from_table(table: Optional[Tag]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    if not table:
        return out
    hmap = table_header_map(table)
    i_col = best_col_idx(hmap, INSTR_HEADER_CANDIDATES)
    s_col = best_col_idx(hmap, SCHED_HEADER_CANDIDATES)
    trs = table.find_all("tr")
    if not trs:
        return out
    start_idx = 1 if hmap else 0
    for tr in trs[start_idx:]:
        cells = tr.find_all(["td", "th"])
        if not cells:
            continue
        instructor = (cells[i_col].get_text(" ", strip=True) if i_col is not None and i_col < len(cells) else "")
        schedule = (cells[s_col].get_text(" ", strip=True) if s_col is not None and s_col < len(cells) else "")
        if not schedule:
            txt = " ".join(c.get_text(" ", strip=True) for c in cells)
            m = TIME_PAT.search(txt)
            if m:
                schedule = m.group(0)
        if instructor or schedule:
            out.append({"instructor": instructor, "schedule": schedule})
    return out

def nearest_following_table(start: Tag) -> Optional[Tag]:
    sib = start
    while sib is not None:
        sib = sib.find_next_sibling()
        if sib is None:
            break
        if isinstance(sib, Tag):
            if sib.name == "table":
                return sib
            maybe = sib.find("table")
            if maybe:
                return maybe
    return None

COURSE_CODE_H2_PAT = re.compile(r"^[A-Z]{3}\s+[A-Z]{2,4}\s+[0-9A-Z]+$")
BOILERPLATE_PAT = re.compile(r"^Note that this information may change", re.I)
SKIP_PREFIX_PAT = re.compile(
    r"^(Units?:|Undergraduate Prerequisites?:|Graduate Prerequisites?:|Also offered as:|Topic for|Hub areas?:)",
    re.I,
)

def _is_site_h1(t: str) -> bool:
    t = (t or "").strip().lower()
    return t == "boston university academics" or t.endswith("| boston university")

def _is_semester_header(tag: Tag) -> bool:
    if tag.name in ("h2","h3","h4","h5"):
        txt = " ".join(tag.get_text(" ", strip=True).split())
        return bool(SEMESTER_PAT.search(txt))
    return False

def _is_schedule_table(tag: Tag) -> bool:
    if tag.name != "table":
        return False
    text = " ".join(tag.get_text(" ", strip=True).split()).lower()
    return any(key in text for key in ("schedule", "days", "time", "instructor", "location"))

def _looks_like_hub_badge_line(s: str) -> bool:
    s_clean = s.strip()
    if not s_clean:
        return True
    # Common markers on these lines
    if s_clean.startswith("BU Hub") or "Learn More" in s_clean:
        return True
    # Short, title-case, no period → likely badges/labels
    if len(s_clean) < 120 and s_clean[0].isupper() and s_clean.endswith(tuple(["Hub", "Literacy", "Exploration", "Thinking"])) and "." not in s_clean:
        return True
    return False

def _sanitize_para(txt: str) -> str:
    # Strip leading/trailing whitespace and collapse spaces
    txt = " ".join(txt.split())
    if not txt:
        return ""
    if BOILERPLATE_PAT.search(txt) or SKIP_PREFIX_PAT.search(txt):
        return ""
    if _looks_like_hub_badge_line(txt):
        return ""
    return txt

def extract_title_and_description(soup: BeautifulSoup, fallback_code: str = "") -> tuple[str, str]:
    """Robust title/description extraction that ignores BU Hub badges and Units lines."""
    # --- Locate course code header ---
    code_hdr = None
    for tag_name in ("h2", "h3"):
        for h in soup.find_all(tag_name):
            txt = " ".join(h.get_text(" ", strip=True).split())
            if COURSE_CODE_H2_PAT.match(txt) and (not fallback_code or fallback_code in txt):
                code_hdr = h
                break
        if code_hdr:
            break

    # --- Title selection ---
    title = ""
    if code_hdr:
        prev_h1 = code_hdr.find_previous("h1")
        if prev_h1:
            t = " ".join(prev_h1.get_text(" ", strip=True).split())
            if not _is_site_h1(t):
                title = t
        if not title:
            nxt_h1 = code_hdr.find_next("h1")
            if nxt_h1:
                t2 = " ".join(nxt_h1.get_text(" ", strip=True).split())
                if not _is_site_h1(t2):
                    title = t2
    if not title:
        for h1 in soup.find_all("h1"):
            t = " ".join(h1.get_text(" ", strip=True).split())
            if not _is_site_h1(t):
                title = t
                break
    if not title:
        title = "Unknown Title"

    # --- Description collection ---
    # Walk forward from code_hdr in document order; collect only <p> paragraphs,
    # except if we hit a "description" container, from which we take its <p> children.
    candidates: list[str] = []
    it = code_hdr.find_all_next(True) if code_hdr is not None else soup.find_all(True)

    for el in it:
        # Stop conditions
        if _is_semester_header(el) or _is_schedule_table(el):
            break
        if el.name in ("h1","h2","h3","h4","h5"):
            heading_txt = " ".join(el.get_text(" ", strip=True).split())
            if heading_txt and heading_txt != title:
                break

        classes = " ".join((el.get("class") or []))

        # Prefer explicit description containers, but only take <p> inside them
        if classes and "description" in classes.lower():
            for p in el.find_all("p"):
                txt = _sanitize_para(p.get_text(" ", strip=True))
                if txt:
                    candidates.append(txt)
            # Don't break; sometimes the main paragraph follows outside
            continue

        # Otherwise, only collect direct <p> elements
        if el.name == "p":
            txt = _sanitize_para(el.get_text(" ", strip=True))
            if txt:
                candidates.append(txt)

        # If we enter a known schedule/sections wrapper, stop
        if el.has_attr("id") and "schedule" in str(el.get("id")).lower():
            break
        if classes and any(k in classes.lower() for k in ("schedule", "sections", "meeting")):
            break

    # Pick the first one or two substantial paragraphs
    longish = [c for c in candidates if len(c) >= 80]
    if longish:
        description = " ".join(longish[:2]).strip()
    else:
        description = (candidates[0] if candidates else "").strip()

    return title, description

def parse_semesters_and_sections(soup: BeautifulSoup) -> Dict[str, List[Dict[str, str]]]:
    results: Dict[str, List[Dict[str, str]]] = {}
    headers = find_semester_headers(soup)
    seen_any = False

    for h in headers:
        sm = SEMESTER_PAT.search(header_text(h))
        if not sm:
            continue
        semester = normalize_semester_text(sm.group(0))
        table = nearest_following_table(h)
        rows = extract_rows_from_table(table)
        if rows:
            results.setdefault(semester, []).extend(rows)
            seen_any = True

    if seen_any:
        return results

    # fallback: any table with plausible columns
    for table in soup.find_all("table"):
        rows = extract_rows_from_table(table)
        if rows:
            semester = "UNKNOWN"
            parent = table
            for _ in range(5):
                parent = parent.find_previous_sibling()
                if not parent:
                    break
                if isinstance(parent, Tag):
                    sm = SEMESTER_PAT.search(header_text(parent))
                    if sm:
                        semester = normalize_semester_text(sm.group(0))
                        break
            results.setdefault(semester, []).extend(rows)
            seen_any = True

    if seen_any:
        return results

    # last-resort: scan page text for semesters + times
    page_text = soup.get_text(" ", strip=True)
    semesters = {normalize_semester_text(m.group(0)) for m in SEMESTER_PAT.finditer(page_text)}
    times = [m.group(0) for m in TIME_PAT.finditer(page_text)]
    if semesters and times:
        for sem in semesters:
            for sch in times:
                results.setdefault(sem, []).append({"instructor": "", "schedule": sch})
    return results

# ------------------------ IO helpers ------------------------

def read_urls(path: str) -> List[str]:
    urls = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            url = line.strip()
            if url and not url.startswith("#"):
                urls.append(url)
    return urls

# ------------------------ Worker ------------------------

def make_fetcher(rate_limiter: TokenBucket, cache):
    def fetch_and_parse(url: str, polite_delay: float = 0.0):
        school, dept, num = parse_codes_from_url(url)
        code_for_match = f"{school} {dept} {num}".strip()

        # Check cache
        html = None
        if cache is not None:
            cached = cache.get(url)
            if cached is not None:
                html = cached

        try:
            # Rate-limit + small per-request delay to smooth bursts
            rate_limiter.wait()
            if polite_delay > 0:
                time.sleep(polite_delay)

            if html is None:
                max_attempts = 5
                attempt = 0
                while True:
                    attempt += 1
                    resp = session().get(url, timeout=20)
                    status = resp.status_code

                    if status == 200:
                        html = resp.text
                        if cache is not None:
                            cache.set(url, html, expire=60 * 60 * 24)  # 24h
                        break

                    if status == 429:
                        ra = parse_retry_after(resp.headers.get("Retry-After"))
                        if ra > 0:
                            logging.info(f"429 Retry-After={ra:.1f}s for {url}; sleeping.")
                            time.sleep(ra)
                        else:
                            logging.info(f"429 for {url}; backoff attempt {attempt}.")
                            backoff_sleep(attempt)
                    elif status in (500, 502, 503, 504):
                        logging.info(f"{status} for {url}; backoff attempt {attempt}.")
                        backoff_sleep(attempt)
                    else:
                        logging.error(f"HTTP {status} for URL: {url}")
                        return None

                    if attempt >= max_attempts:
                        logging.error(f"Gave up after {max_attempts} attempts: {url}")
                        return None

            soup = BeautifulSoup(html, "html.parser")
            title, description = extract_title_and_description(soup, fallback_code=code_for_match)
            sem_map = parse_semesters_and_sections(soup)

            return {
                "url": url,
                "school": school,
                "department": dept,
                "number": num,
                "title": title,
                "description": description,
                "semesters": {
                    sem: [{"instructor": e.get("instructor", ""), "schedule": e.get("schedule", "")}
                          for e in entries]
                    for sem, entries in sem_map.items()
                },
            }

        except Exception as e:
            logging.exception(f"Failed to process URL: {url} | {e}")
            return None
    return fetch_and_parse

# ------------------------ Main ------------------------

def main():
    ap = argparse.ArgumentParser(description="Multithreaded BU course scraper (JSON-only)")
    ap.add_argument("--input", default=INPUT_FILE_DEFAULT, help="Input file with URLs (one per line)")
    ap.add_argument("--json", default=JSON_OUT_DEFAULT, help="JSON output path")
    ap.add_argument("--workers", type=int, default=8, help="Number of concurrent workers (default 8)")
    ap.add_argument("--delay", type=float, default=0.05, help="Per-request smoothing delay (default 0.05s)")
    ap.add_argument("--rps", type=float, default=0.5, help="Global requests/second (default 0.5)")
    ap.add_argument("--burst", type=int, default=2, help="Token bucket burst capacity (default 2)")
    ap.add_argument("--cache", action="store_true", help="Enable on-disk HTML cache (.scrape_cache)")
    args = ap.parse_args()

    logging.basicConfig(
        filename=LOG_FILE,
        filemode="w",
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    path = Path(args.input)
    if not path.exists():
        print(f"Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    urls = read_urls(args.input)
    # Deduplicate while preserving order
    seen = set()
    urls = [u for u in urls if not (u in seen or seen.add(u))]

    # Cap workers for politeness
    workers = max(1, min(args.workers, 24))
    rate_limiter = TokenBucket(args.rps, args.burst)
    cache = Cache(".scrape_cache") if args.cache and Cache is not None else None

    results: Dict[str, dict] = {}
    fetch_and_parse = make_fetcher(rate_limiter, cache)

    with tqdm(total=len(urls), desc="Scraping BU courses", unit="url") as pbar:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            fut_to_url = {ex.submit(fetch_and_parse, url, args.delay): url for url in urls}
            for fut in as_completed(fut_to_url):
                url = fut_to_url[fut]
                try:
                    item = fut.result()
                    if item:
                        key = f"{item['school']}-{item['department']}-{item['number']}"
                        results[key] = item
                except Exception as e:
                    logging.exception(f"Unhandled exception for URL: {url} | {e}")
                finally:
                    pbar.update(1)

    # Write JSON only
    with open(args.json, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"Done.\n- {args.json}\n- logs: {LOG_FILE}\nWorkers: {workers}, RPS: {args.rps}, Burst: {args.burst}, Cache: {'on' if cache else 'off'}")

if __name__ == "__main__":
    main()

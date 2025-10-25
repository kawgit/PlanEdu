#!/usr/bin/env python3
# bu_class_scraper.py
"""
BU class page scraper (multithreaded, one JSON output, console logging only).

Reads:  class_urls.txt  (one URL per line)
Writes: class_offerings.json  (grouped by unique course key: SCHOOL-DEPT-NUMBER)

Usage (polite defaults):
  python bu_class_scraper.py --workers 6 --rps 0.5 --burst 2 --delay 0.05
"""

import argparse
import json
import logging
import random
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from tqdm import tqdm

# ------------------------ Defaults ------------------------

INPUT_FILE_DEFAULT = "class_urls.txt"
JSON_OUT_DEFAULT = "class_offerings.json"

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

# URL code pattern (accepts suffixes like A1)
URL_CODE_PAT = re.compile(
    r"/academics/([a-z]{3})/courses/([a-z]{3})-([a-z]{1,5})-([0-9a-z]+)(?:/|$)",
    re.IGNORECASE,
)

# Title/description helpers
COURSE_CODE_H2_PAT = re.compile(r"^[A-Z]{3}\s+[A-Z]{1,5}\s+[0-9A-Z]+$")
BOILERPLATE_PAT = re.compile(r"^Note that this information may change", re.I)
SKIP_PREFIX_PAT = re.compile(
    r"^(Units?:|Undergraduate Prerequisites?:|Graduate Prerequisites?:|Also offered as:|Topic for|Hub areas?:)",
    re.I,
)

# ------------------------ Logging (console only) ------------------------

def setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

# ------------------------ Networking ------------------------

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
        "User-Agent": "BU-Course-Scraper (research; contact: you@example.com)"
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
                logging.debug(f"[RateLimit] Sleeping {sleep_for:.2f}s")
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
    sleep_for = min(cap, base * (2 ** attempt))
    jitter = random.uniform(0, sleep_for)
    logging.debug(f"[Backoff] attempt={attempt} sleeping {jitter:.2f}s")
    time.sleep(jitter)

# ------------------------ Parsing helpers ------------------------

def header_text(el: Optional[Tag]) -> str:
    return "" if el is None else " ".join(el.get_text(separator=" ", strip=True).split())

def parse_codes_from_url(url: str) -> Tuple[str, str, str]:
    m = URL_CODE_PAT.search(url)
    if m:
        return m.group(2).upper(), m.group(3).upper(), m.group(4).upper()
    slug = url.split("courses/")[-1].split("?")[0].split("#")[0].strip("/").lower()
    parts = slug.split("-")
    if len(parts) >= 3:
        return parts[0].upper(), parts[1].upper(), "-".join(parts[2:]).upper()
    logging.warning(f"[ParseURL] Could not parse codes from URL: {url}")
    return "UNK", "UNK", "UNK"

def _is_site_h1(t: str) -> bool:
    t = (t or "").strip().lower()
    return t == "boston university academics" or t.endswith("| boston university")

def _is_semester_header(tag: Tag) -> bool:
    if tag.name in ("h2","h3","h4","h5"):
        return bool(SEMESTER_PAT.search(header_text(tag)))
    return False

def _is_schedule_table(tag: Tag) -> bool:
    if tag.name != "table":
        return False
    text = header_text(tag).lower()
    return any(key in text for key in ("schedule", "days", "time", "instructor", "location"))

def extract_title(soup: BeautifulSoup, code_for_match: str) -> str:
    # Prefer the nearest <h1> around the course code header; avoid the site header.
    code_hdr = None
    for tag_name in ("h2", "h3"):
        for h in soup.find_all(tag_name):
            txt = header_text(h)
            if COURSE_CODE_H2_PAT.match(txt) and (not code_for_match or code_for_match in txt):
                code_hdr = h
                break
        if code_hdr:
            break
    if code_hdr:
        prev_h1 = code_hdr.find_previous("h1")
        if prev_h1:
            t = header_text(prev_h1)
            if not _is_site_h1(t):
                return t
        nxt_h1 = code_hdr.find_next("h1")
        if nxt_h1:
            t = header_text(nxt_h1)
            if not _is_site_h1(t):
                return t
    # Fallback: first non-site h1 on page
    for h1 in soup.find_all("h1"):
        t = header_text(h1)
        if not _is_site_h1(t):
            return t
    return "Unknown Title"

def extract_description(soup: BeautifulSoup) -> str:
    """
    Primary: div#course-content -> first <p>
    Fallback: walk forward after course code/title area; collect first substantial paragraph
             before schedule/semester sections; skip boilerplate and 'Units:' etc.
    """
    # --- Primary path: #course-content first <p> ---
    cc = soup.find("div", id="course-content")
    if cc:
        p = cc.find("p")
        if p:
            txt = header_text(p)
            return txt

    # --- Fallback path (robust) ---
    # Find course code header to start walking forward
    code_hdr = None
    for tag_name in ("h2", "h3"):
        for h in soup.find_all(tag_name):
            txt = header_text(h)
            if COURSE_CODE_H2_PAT.match(txt):
                code_hdr = h
                break
        if code_hdr:
            break

    it = code_hdr.find_all_next(True) if code_hdr is not None else soup.find_all(True)
    for el in it:
        if _is_semester_header(el) or _is_schedule_table(el):
            break
        if el.name in ("h1","h2","h3","h4","h5"):
            # new section → stop
            break
        if el.name == "p":
            txt = header_text(el)
            if not txt:
                continue
            if BOILERPLATE_PAT.search(txt) or SKIP_PREFIX_PAT.search(txt):
                continue
            # Prefer paragraphs with sentences
            if len(txt) >= 40 and "." in txt:
                return txt
    return ""

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

def find_semester_headers(soup: BeautifulSoup) -> List[Tag]:
    return [t for t in soup.find_all(["h2","h3","h4","h5"]) if SEMESTER_PAT.search(header_text(t))]

def normalize_semester_text(s: str) -> str:
    s = s.strip()
    m = re.search(r"(Spring|Fall|Summer|SPRG|FALL|SUM(?:\s*I|II|1|2)?)\s+(\d{4})", s, re.IGNORECASE)
    if not m:
        return s.upper()
    term = m.group(1).upper()
    year = m.group(2)
    mapping = {"SPRING": "SPRG", "FALL": "FALL", "SUMMER": "SUM", "SPRG": "SPRG", "SUM": "SUM",
               "SUM I": "SUM I", "SUM II": "SUM II", "SUM 1": "SUM I", "SUM 2": "SUM II"}
    term_norm = mapping.get(term, term)
    return f"{term_norm} {year}"

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

    # fallback: any plausible table anywhere (infer semester from nearby text)
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

    # last resort: scan page text
    page_text = soup.get_text(" ", strip=True)
    semesters = {normalize_semester_text(m.group(0)) for m in SEMESTER_PAT.finditer(page_text)}
    times = [m.group(0) for m in TIME_PAT.finditer(page_text)]
    if semesters and times:
        for sem in semesters:
            for sch in times:
                results.setdefault(sem, []).append({"instructor": "", "schedule": sch})
    return results

# ------------------------ Worker ------------------------

def make_fetcher(rate_limiter: TokenBucket, delay: float):
    def fetch_and_parse(url: str) -> Optional[dict]:
        school, dept, num = parse_codes_from_url(url)
        code_for_match = f"{school} {dept} {num}".strip()

        try:
            # Rate-limit + smoothing delay
            rate_limiter.wait()
            if delay > 0:
                time.sleep(delay)

            # Manual loop to expose 429 handling in logs
            max_attempts = 5
            attempt = 0
            html = None
            while True:
                attempt += 1
                resp = session().get(url, timeout=20)
                status = resp.status_code
                if status == 200:
                    html = resp.text
                    break

                if status == 429:
                    ra = parse_retry_after(resp.headers.get("Retry-After"))
                    if ra > 0:
                        logging.info(f"[429] Retry-After={ra:.1f}s  url={url}")
                        time.sleep(ra)
                    else:
                        logging.info(f"[429] no Retry-After; backoff attempt={attempt}  url={url}")
                        backoff_sleep(attempt)
                elif status in (500, 502, 503, 504):
                    logging.info(f"[{status}] backoff attempt={attempt}  url={url}")
                    backoff_sleep(attempt)
                else:
                    logging.error(f"[HTTP {status}] giving up  url={url}")
                    return None

                if attempt >= max_attempts:
                    logging.error(f"[GiveUp] attempts={max_attempts}  url={url}")
                    return None

            soup = BeautifulSoup(html, "html.parser")
            # Title and description (with your #course-content preference)
            title = extract_title(soup, code_for_match)
            description = extract_description(soup)
            sem_map = parse_semesters_and_sections(soup)

            return {
                "url": url,
                "school": school,
                "department": dept,
                "number": num,
                "title": title,
                "description": description,
                "semesters": {
                    sem: [{"instructor": e.get("instructor",""), "schedule": e.get("schedule","")}
                          for e in entries]
                    for sem, entries in sem_map.items()
                },
            }

        except Exception as e:
            logging.exception(f"[Exception] url={url}  err={e}")
            return None
    return fetch_and_parse

# ------------------------ Main ------------------------

def main():
    ap = argparse.ArgumentParser(description="BU course scraper (multithreaded, single JSON output)")
    ap.add_argument("--input", default=INPUT_FILE_DEFAULT, help="Input file with URLs (one per line)")
    ap.add_argument("--json", default=JSON_OUT_DEFAULT, help="JSON output path")
    ap.add_argument("--workers", type=int, default=8, help="Concurrent workers (default 8)")
    ap.add_argument("--delay", type=float, default=0.05, help="Per-request smoothing delay (default 0.05s)")
    ap.add_argument("--rps", type=float, default=0.5, help="Global requests/sec (default 0.5)")
    ap.add_argument("--burst", type=int, default=2, help="Token bucket burst capacity (default 2)")
    ap.add_argument("--verbose", action="store_true", help="Verbose logging (DEBUG)")
    args = ap.parse_args()

    setup_logging(args.verbose)

    path = Path(args.input)
    if not path.exists():
        logging.error(f"Input file not found: {args.input}")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        urls = [u.strip() for u in f if u.strip() and not u.strip().startswith("#")]

    # Deduplicate exact duplicates while preserving order
    seen = set()
    urls = [u for u in urls if not (u in seen or seen.add(u))]

    workers = max(1, min(args.workers, 24))
    rate_limiter = TokenBucket(args.rps, args.burst)
    fetch_and_parse = make_fetcher(rate_limiter, args.delay)

    results: Dict[str, dict] = {}

    with tqdm(total=len(urls), desc="Scraping BU courses", unit="url") as pbar:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            fut_to_url = {ex.submit(fetch_and_parse, url): url for url in urls}
            for fut in as_completed(fut_to_url):
                url = fut_to_url[fut]
                try:
                    item = fut.result()
                    if item:
                        key = f"{item['school']}-{item['department']}-{item['number']}"
                        # You guaranteed uniqueness → no merge needed; last write wins if duplicate slips in
                        results[key] = item
                    else:
                        logging.warning(f"[Drop] No item parsed  url={url}")
                except Exception as e:
                    logging.exception(f"[UnhandledFuture] url={url} err={e}")
                finally:
                    pbar.update(1)

    with open(args.json, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # Console summary only (no files)
    print("\n=== SUMMARY ===")
    print(f"Input URLs: {len(urls)}")
    print(f"Courses scraped: {len(results)}")
    print(f"Output: {args.json}")

if __name__ == "__main__":
    main()

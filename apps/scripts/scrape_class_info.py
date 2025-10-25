#!/usr/bin/env python3
# scrape_bu_classes_mt.py
"""
Multithreaded scraper for BU course pages listed in class_urls.txt.

- Extracts: school code, department, number
- For each semester (e.g., SPRG 2026, FALL 2026): instructor(s), schedule
- Error-resilient: retries, timeouts, logs; one failure doesn't stop the run
- Progress bar across all URLs
- Outputs CSV + JSON + log
- Concurrency: configurable via --workers (default 8)
"""

import argparse
import csv
import json
import logging
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from tqdm import tqdm

INPUT_FILE = "class_urls.txt"
CSV_OUT = "class_offerings.csv"
JSON_OUT = "class_offerings.json"
LOG_FILE = "scrape.log"

SEMESTER_PAT = re.compile(
    r"\b(?:(?:FALL|SPRING|SPRG|SUMMER|SUM(?:\s*(?:I|II|1|2))?))\s+\d{4}\b",
    flags=re.IGNORECASE,
)

TIME_PAT = re.compile(
    r"\b(?:M|T|W|R|F|S|U){1,4}\s+\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)\b"
)

INSTR_HEADER_CANDIDATES = {"instructor", "instructors", "professor", "faculty"}
SCHED_HEADER_CANDIDATES = {"schedule", "days/times", "days & times", "meeting time", "time", "days", "location & time"}

URL_CODE_PAT = re.compile(
    r"/academics/([a-z]{3})/courses/([a-z]{3})-([a-z]{2,4})-([0-9a-z]+)(?:/|$)",
    re.IGNORECASE,
)

# Thread-local session for connection pooling per worker
_tls = threading.local()


def make_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(
        total=5,
        backoff_factor=0.6,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "HEAD"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retries, pool_connections=32, pool_maxsize=32)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
            )
        }
    )
    session.timeout = 15
    return session


def session() -> requests.Session:
    s = getattr(_tls, "session", None)
    if s is None:
        s = make_session()
        _tls.session = s
    return s


def parse_codes_from_url(url: str) -> Tuple[str, str, str]:
    m = URL_CODE_PAT.search(url)
    if m:
        school = m.group(2).upper()
        dept = m.group(3).upper()
        num = m.group(4).upper()
        return school, dept, num

    last = url.rstrip("/").split("/")[-1]
    parts = last.split("-")
    if len(parts) >= 3:
        school, dept, num = parts[0].upper(), parts[1].upper(), parts[2].upper()
        return school, dept, num

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


def header_text(el: Tag) -> str:
    return " ".join(el.get_text(separator=" ", strip=True).split())


def find_semester_headers(soup: BeautifulSoup) -> List[Tag]:
    headers = []
    for tag in soup.find_all(["h2", "h3", "h4", "h5"]):
        txt = header_text(tag)
        if SEMESTER_PAT.search(txt):
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

    body_rows = table.find_all("tr")
    if not body_rows:
        return out

    start_idx = 1 if hmap else 0

    for tr in body_rows[start_idx:]:
        cells = tr.find_all(["td", "th"])
        if not cells:
            continue
        instructor = (
            cells[i_col].get_text(" ", strip=True) if i_col is not None and i_col < len(cells) else ""
        )
        schedule = (
            cells[s_col].get_text(" ", strip=True) if s_col is not None and s_col < len(cells) else ""
        )
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


def parse_semesters_and_sections(soup: BeautifulSoup) -> Dict[str, List[Dict[str, str]]]:
    results: Dict[str, List[Dict[str, str]]] = {}
    headers = find_semester_headers(soup)
    seen_any = False

    for h in headers:
        txt = header_text(h)
        sm = SEMESTER_PAT.search(txt)
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
                    txt = header_text(parent)
                    sm = SEMESTER_PAT.search(txt)
                    if sm:
                        semester = normalize_semester_text(sm.group(0))
                        break
            results.setdefault(semester, []).extend(rows)
            seen_any = True

    if seen_any:
        return results

    page_text = soup.get_text(" ", strip=True)
    semesters = {normalize_semester_text(m.group(0)) for m in SEMESTER_PAT.finditer(page_text)}
    times = [m.group(0) for m in TIME_PAT.finditer(page_text)]
    if semesters and times:
        for sem in semesters:
            for sch in times:
                results.setdefault(sem, []).append({"instructor": "", "schedule": sch})
    return results


def read_urls(path: str) -> List[str]:
    urls = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            url = line.strip()
            if url and not url.startswith("#"):
                urls.append(url)
    return urls


def fetch_and_parse(url: str, polite_delay: float = 0.0):
    """Worker: fetch a single URL and return (rows_for_csv, course_block_for_json)."""
    school, dept, num = parse_codes_from_url(url)
    try:
        if polite_delay > 0:
            # small stagger to avoid bursty hammering
            time.sleep(polite_delay)
        resp = session().get(url, timeout=15)
        if resp.status_code != 200:
            logging.error(f"HTTP {resp.status_code} for URL: {url}")
            return [], None

        soup = BeautifulSoup(resp.text, "html.parser")
        sem_map = parse_semesters_and_sections(soup)

        rows_for_csv = []
        any_row = False
        for sem, entries in sem_map.items():
            for e in entries:
                rows_for_csv.append(
                    {
                        "url": url,
                        "school": school,
                        "department": dept,
                        "number": num,
                        "semester": sem,
                        "instructor": e.get("instructor", ""),
                        "schedule": e.get("schedule", ""),
                    }
                )
                any_row = True

        if not any_row:
            rows_for_csv.append(
                {
                    "url": url,
                    "school": school,
                    "department": dept,
                    "number": num,
                    "semester": "",
                    "instructor": "",
                    "schedule": "",
                }
            )
            logging.warning(f"No semester/sections extracted for URL: {url}")

        key = f"{school}-{dept}-{num}"
        course_block = {
            "url": url,
            "school": school,
            "department": dept,
            "number": num,
            "semesters": {sem: [{"instructor": e.get("instructor", ""), "schedule": e.get("schedule", "")}
                                for e in entries]
                          for sem, entries in sem_map.items()}
        }
        return rows_for_csv, (key, course_block)

    except Exception as e:
        logging.exception(f"Failed to process URL: {url} | {e}")
        return [], None


def main():
    parser = argparse.ArgumentParser(description="Multithreaded BU course scraper")
    parser.add_argument("--input", default=INPUT_FILE, help="Input file with URLs (one per line)")
    parser.add_argument("--csv", default=CSV_OUT, help="CSV output path")
    parser.add_argument("--json", default=JSON_OUT, help="JSON output path")
    parser.add_argument("--workers", type=int, default=8, help="Number of concurrent workers (default: 8)")
    parser.add_argument("--delay", type=float, default=0.05,
                        help="Polite per-request delay in seconds (applied inside workers, default: 0.05)")
    args = parser.parse_args()

    logging.basicConfig(
        filename=LOG_FILE,
        filemode="w",
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    if not Path(args.input).exists():
        print(f"Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    urls = read_urls(args.input)
    rows_for_csv_all: List[dict] = []
    grouped_for_json: Dict[str, dict] = {}

    # Sensible cap to avoid hitting the site too hard
    workers = max(1, min(args.workers, 24))

    with tqdm(total=len(urls), desc="Scraping BU courses", unit="url") as pbar:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            futures = {ex.submit(fetch_and_parse, url, args.delay): url for url in urls}
            for fut in as_completed(futures):
                url = futures[fut]
                try:
                    csv_rows, json_pair = fut.result()
                    if csv_rows:
                        rows_for_csv_all.extend(csv_rows)
                    if json_pair:
                        key, block = json_pair
                        grouped_for_json[key] = block
                except Exception as e:
                    logging.exception(f"Unhandled exception for URL: {url} | {e}")
                finally:
                    pbar.update(1)

    # Write CSV
    with open(args.csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "url",
                "school",
                "department",
                "number",
                "semester",
                "instructor",
                "schedule",
            ],
        )
        writer.writeheader()
        for r in rows_for_csv_all:
            writer.writerow(r)

    # Write JSON
    with open(args.json, "w", encoding="utf-8") as f:
        json.dump(grouped_for_json, f, ensure_ascii=False, indent=2)

    print(
        f"Done. Wrote:\n- {args.csv}\n- {args.json}\n- logs: {LOG_FILE}\n"
        f"Workers: {workers}, Delay: {args.delay}s"
    )


if __name__ == "__main__":
    main()

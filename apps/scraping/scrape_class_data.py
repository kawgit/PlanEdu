#!/usr/bin/env python3
import argparse
import json
import logging
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup, Tag
from tqdm import tqdm

# ------------------------
# Logging
# ------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("scrape_bu_courses")

# ------------------------
# Constants
# ------------------------
SEASON_FIX = {
    "SPRG": "SPRING",
    "SPR": "SPRING",
    "SP": "SPRING",
    "FA": "FALL",
    "FL": "FALL",
    "SUM": "SUMMER",
    "SMR": "SUMMER",
    "WIN": "WINTER",
}
SEASON_WORDS = ["SPRING", "SUMMER", "FALL", "WINTER"]

TIME_RANGE_RE = re.compile(
    r"(?P<start>\d{1,2}:\d{2}\s*[ap]m|\d{1,2}\s*[ap]m)\s*[-–]\s*(?P<end>\d{1,2}:\d{2}\s*[ap]m|\d{1,2}\s*[ap]m)",
    re.IGNORECASE,
)
TIME_RE = re.compile(r"^\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)\s*$", re.IGNORECASE)

# ------------------------
# Utils
# ------------------------
def normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()

def normalize_season(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    t = normalize_ws(s).upper()
    for abbr, full in SEASON_FIX.items():
        t = re.sub(rf"\b{abbr}\b", full, t)
    for w in SEASON_WORDS:
        if re.search(rf"\b{w}\b", t):
            return w
    return None

def season_year_from_text(txt: str) -> Tuple[Optional[str], Optional[str]]:
    text = normalize_ws(txt).upper()
    for abbr, full in SEASON_FIX.items():
        text = re.sub(rf"\b{abbr}\b", full, text)
    season = None
    pos = len(text) + 1
    for w in SEASON_WORDS:
        m = re.search(rf"\b{w}\b", text)
        if m and m.start() < pos:
            season, pos = w, m.start()
    year_m = re.search(r"\b(20\d{2}|19\d{2})\b", text)
    year = year_m.group(1) if year_m else None
    return season, year

def to_24h(time_str: str) -> Optional[str]:
    if not time_str:
        return None
    m = TIME_RE.match(time_str.strip())
    if not m:
        return None
    h = int(m.group(1))
    mnt = int(m.group(2)) if m.group(2) else 0
    ampm = m.group(3).lower()
    if ampm == "am" and h == 12:
        h = 0
    if ampm == "pm" and h != 12:
        h += 12
    return f"{h:02d}:{mnt:02d}"

def parse_url_parts(url: str) -> Tuple[str, str, str]:
    tail = url.rstrip("/").split("/")[-1]
    parts = tail.split("-")
    if len(parts) < 3:
        raise ValueError(f"Cannot parse school/department/number from URL: {url}")
    return parts[0].upper(), parts[1].upper(), parts[2].upper()

def first_h1_within(main: Tag) -> Optional[str]:
    h1 = main.find("h1")
    return normalize_ws(h1.get_text(" ")) if h1 else None

def first_p_in_course_content(main: Tag) -> Optional[str]:
    div = main.find(id="course-content")
    if not div:
        return None
    p = div.find("p")
    return normalize_ws(p.get_text(" ")) if p else None

# ------------------------
# Section helpers
# ------------------------
def parse_schedule_to_days_and_times(txt: str):
    if not txt:
        return None, None, None
    text = normalize_ws(txt)
    match = TIME_RANGE_RE.search(text)
    if match:
        start = to_24h(match.group("start"))
        end = to_24h(match.group("end"))
        days = normalize_ws(text[: match.start()].strip(" ,;-"))
        days = re.sub(r"\(.*?\)$", "", days).strip()
        return days or None, start, end
    return text or None, None, None

def headers_map(table: Tag) -> Dict[str, int]:
    # Use first row as header (th or td)
    rows = table.find_all("tr")
    if not rows:
        return {}
    header_row = rows[0]
    cells = header_row.find_all(["th", "td"])
    mapping: Dict[str, int] = {}
    for idx, th in enumerate(cells):
        name = normalize_ws(th.get_text(" ")).lower()
        for key, alts in {
            "section": ["section", "sec", "name"],
            "instructor": ["instructor", "instructors", "faculty", "teacher"],
            "location": ["location", "room", "building"],
            "days": ["days", "day"],
            "time": ["time", "times", "hours"],
            "schedule": ["schedule", "meeting time", "meeting", "day/time", "days/times"],
            "notes": ["notes", "note", "comments", "remarks"],
        }.items():
            if name in alts:
                mapping[key] = idx
                break
    return mapping

def extract_cell_text(td: Optional[Tag]) -> str:
    if not td:
        return ""
    for tag in td.find_all(["sup", "small"]):
        tag.extract()
    return normalize_ws(td.get_text(" "))

def _warn_duplicate_sections(scopes: List[Dict], context: str):
    seen: Dict[Tuple[str, Optional[str], Optional[str]], int] = {}
    for s in scopes:
        key = ((s.get("name") or "").strip(), s.get("season"), s.get("year"))
        seen[key] = seen.get(key, 0) + 1
    dups = [k for k, c in seen.items() if k[0] and c > 1]
    if dups:
        formatted = ", ".join(f"{n} ({s or '?'} {y or '?'})" for n, s, y in dups)
        log.warning(f"{context}: duplicate sections in same semester → {formatted} (keeping all).")

def parse_sections_table_with_context(table: Tag, season_ctx: Optional[str], year_ctx: Optional[str]) -> List[Dict]:
    hmap = headers_map(table)
    rows = table.find_all("tr")
    if rows:
        rows = rows[1:]  # skip header

    sections: List[Dict] = []
    for tr in rows:
        tds = tr.find_all("td")
        if not tds:
            continue

        def td_by(key: str) -> Optional[Tag]:
            i = hmap.get(key)
            return tds[i] if i is not None and i < len(tds) else None

        name_txt = extract_cell_text(td_by("section"))
        instructor_txt = extract_cell_text(td_by("instructor"))
        location_txt = extract_cell_text(td_by("location"))
        days_txt = extract_cell_text(td_by("days"))
        time_txt = extract_cell_text(td_by("time"))
        schedule_txt = extract_cell_text(td_by("schedule"))
        notes_txt = extract_cell_text(td_by("notes"))

        start_time = end_time = None
        if schedule_txt:
            d2, s2, e2 = parse_schedule_to_days_and_times(schedule_txt)
            if d2:
                days_txt = d2
            start_time = s2 or start_time
            end_time = e2 or end_time
        if (start_time is None or end_time is None) and time_txt:
            d3, s3, e3 = parse_schedule_to_days_and_times(time_txt)
            if not days_txt and d3:
                days_txt = d3
            start_time = start_time or s3
            end_time = end_time or e3

        sections.append(
            {
                "name": name_txt or None,
                "year": year_ctx,
                "season": normalize_season(season_ctx),
                "instructor": instructor_txt or None,
                "location": location_txt or None,
                "days": days_txt or None,
                "startTime": start_time,
                "endTime": end_time,
                "notes": notes_txt or None,
            }
        )
    return sections

# ------------------------
# Core scraping
# ------------------------
def parse_sections(main: Tag) -> List[Dict]:
    """
    Iterate each direct child of .cf-course, track the latest <h4> (season/year),
    and apply this context to subsequent <table> siblings.
    """
    all_sections: List[Dict] = []
    for cf in main.select("div.cf-course"):
        season_ctx: Optional[str] = None
        year_ctx: Optional[str] = None

        for child in cf.children:
            if not isinstance(child, Tag):
                continue
            if child.name == "h4":
                s, y = season_year_from_text(child.get_text(" "))
                season_ctx = s or season_ctx
                year_ctx = y or year_ctx
                continue
            if child.name == "table":
                all_sections.extend(
                    parse_sections_table_with_context(child, season_ctx, year_ctx)
                )
    return all_sections

def scrape_course(url: str) -> Dict:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    main = soup.select_one("div.main")
    if not main:
        raise RuntimeError("Could not find <div class='main'> on page")

    school, department, number = parse_url_parts(url)
    title = first_h1_within(main)
    description = first_p_in_course_content(main)
    sections = parse_sections(main)

    _warn_duplicate_sections(sections, context=f"[{url}]")

    return {
        "url": url,
        "school": school,
        "department": department,
        "number": number,
        "title": title,
        "description": description,
        "sections": sections,
    }

# ------------------------
# CLI
# ------------------------
def main():
    parser = argparse.ArgumentParser(description="Scrape BU course pages.")
    parser.add_argument(
        "--input",
        default="data/class_urls.json",
        help="Path to input JSON (default: data/class_urls.json)",
    )
    parser.add_argument(
        "--output",
        default="data/class_data.json",
        help="Path to output JSON (default: data/class_data.json)",
    )
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)

    if not in_path.exists():
        log.error(f"Missing input file: {in_path}")
        sys.exit(1)

    try:
        urls = json.loads(in_path.read_text())
        if not isinstance(urls, list) or not all(isinstance(u, str) for u in urls):
            raise ValueError("Input JSON must be a list of strings (URLs).")
    except Exception as e:
        log.error(f"Failed to read/parse input JSON: {e}")
        sys.exit(1)

    results: List[Dict] = []
    for url in tqdm(urls, desc="Scraping courses"):
        try:
            results.append(scrape_course(url))
        except requests.HTTPError as e:
            code = e.response.status_code if e.response is not None else "?"
            log.error(f"[HTTP {code}] {url}")
        except requests.RequestException as e:
            log.error(f"[NETWORK ERROR] {url}: {e}")
        except Exception as e:
            log.error(f"[PARSE ERROR] {url}: {e}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        out_path.write_text(json.dumps(results, indent=2, ensure_ascii=False))
        log.info(f"Wrote {len(results)} courses → {out_path}")
    except Exception as e:
        log.error(f"Failed to write output JSON: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

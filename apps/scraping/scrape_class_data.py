import argparse
import json
import logging
import re
import sys
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup, Tag
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

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
# Thread-local session
# ------------------------
_thread_local = threading.local()

def _get_session() -> requests.Session:
    s = getattr(_thread_local, "session", None)
    if s is None:
        s = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist={429, 500, 502, 503, 504},
            allowed_methods={"GET"},
            raise_on_status=False,
        )
        adapter = HTTPAdapter(pool_connections=100, pool_maxsize=100, max_retries=retries)
        s.mount("http://", adapter)
        s.mount("https://", adapter)
        _thread_local.session = s
    return s

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
    session = _get_session()
    resp = session.get(url, timeout=30)
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
# Ordered, periodic saver with MERGE
# ------------------------
class OrderedSaver:
    """
    Maintains input order across a *subset* of pending URLs, while merging with an
    existing output file on every save.

    - Tracks completion over the pending list (subset of all URLs).
    - Only flushes the longest contiguous prefix of completed pending jobs.
    - Merge rule on flush:
        merged_map := existing_map ∪ newly_completed_prefix
        file := [ merged_map[u] for u in all_urls if u in merged_map ]
      This preserves original input order globally and avoids duplicates.
    """
    def __init__(
        self,
        all_urls: List[str],
        existing_map: Dict[str, Dict],
        pending_urls: List[str],
        out_path: Path,
        interval_sec: float = 5.0,
    ):
        self.all_urls = all_urls
        self.existing_map = existing_map  # url -> record
        self.pending_urls = pending_urls  # order we enforce prefix on
        self.out_path = out_path
        self.interval_sec = interval_sec

        self.total = len(self.pending_urls)
        self.completed = [False] * self.total
        self.successes_by_index: List[Optional[Dict]] = [None] * self.total
        self.cursor = 0  # within pending

        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="OrderedSaver", daemon=True)

    def start(self):
        self._thread.start()

    def stop(self):
        self._stop.set()
        self._thread.join()
        self.flush()

    def mark_success(self, pending_idx: int, item: Dict):
        with self._lock:
            self.completed[pending_idx] = True
            self.successes_by_index[pending_idx] = item

    def mark_failure(self, pending_idx: int):
        with self._lock:
            self.completed[pending_idx] = True

    def _advance_cursor_locked(self) -> Dict[str, Dict]:
        """
        Consume the contiguous prefix of completed pending jobs, returning a dict
        of url->record for those newly confirmed successes. Failures are skipped.
        """
        newly_confirmed: Dict[str, Dict] = {}
        while self.cursor < self.total and self.completed[self.cursor]:
            item = self.successes_by_index[self.cursor]
            if item is not None:
                newly_confirmed[item["url"]] = item
            self.cursor += 1
        return newly_confirmed

    def _build_merged_output_locked(self) -> List[Dict]:
        # apply any new prefix successes
        newly = self._advance_cursor_locked()
        if newly:
            self.existing_map.update(newly)

        # emit in full input order
        merged_list = [self.existing_map[u] for u in self.all_urls if u in self.existing_map]
        return merged_list

    def flush(self):
        with self._lock:
            merged_list = self._build_merged_output_locked()
            data = json.dumps(merged_list, indent=2, ensure_ascii=False)

        tmp = self.out_path.with_suffix(self.out_path.suffix + ".tmp")
        try:
            tmp.parent.mkdir(parents=True, exist_ok=True)
            tmp.write_text(data)
            tmp.replace(self.out_path)
        except Exception as e:
            log.error(f"Periodic save failed: {e}")

    def _run(self):
        while not self._stop.wait(self.interval_sec):
            self.flush()

# ------------------------
# CLI
# ------------------------
def main():
    parser = argparse.ArgumentParser(description="Scrape BU course pages (multithreaded, resumable, ordered periodic saves).")
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
    parser.add_argument(
        "--workers",
        type=int,
        default=16,
        help="Number of threads (default: 16)",
    )
    parser.add_argument(
        "--save-interval",
        type=float,
        default=5.0,
        help="Seconds between periodic saves (default: 5.0)",
    )
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)

    if not in_path.exists():
        log.error(f"Missing input file: {in_path}")
        sys.exit(1)

    # Read input URLs
    try:
        all_urls: List[str] = json.loads(in_path.read_text())
        if not isinstance(all_urls, list) or not all(isinstance(u, str) for u in all_urls):
            raise ValueError("Input JSON must be a list of strings (URLs).")
    except Exception as e:
        log.error(f"Failed to read/parse input JSON: {e}")
        sys.exit(1)

    # Read existing output (resume)
    existing_map: Dict[str, Dict] = {}
    if out_path.exists():
        try:
            existing_data = json.loads(out_path.read_text())
            if isinstance(existing_data, list):
                for rec in existing_data:
                    if isinstance(rec, dict) and "url" in rec and isinstance(rec["url"], str):
                        existing_map[rec["url"]] = rec
            else:
                log.warning(f"Existing output is not a list, ignoring resume: {out_path}")
        except Exception as e:
            log.warning(f"Could not read/parse existing output ({out_path}), starting fresh: {e}")

    # Determine pending work: only URLs not yet present in existing_map
    pending_urls = [u for u in all_urls if u not in existing_map]
    skipped = len(all_urls) - len(pending_urls)
    if skipped:
        log.info(f"Resume: {skipped} already processed; {len(pending_urls)} pending.")

    if len(pending_urls) == 0:
        # Nothing to do; still ensure output is in correct order and consistent
        merged_list = [existing_map[u] for u in all_urls if u in existing_map]
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(merged_list, indent=2, ensure_ascii=False))
        log.info(f"No pending URLs. Wrote merged file with {len(merged_list)} records → {out_path}")
        return

    saver = OrderedSaver(
        all_urls=all_urls,
        existing_map=existing_map,
        pending_urls=pending_urls,
        out_path=out_path,
        interval_sec=args.save_interval,
    )
    saver.start()

    progress = tqdm(total=len(pending_urls), desc="Scraping courses", unit="page")

    # Map pending index for OrderedSaver and run workers
    pending_index_by_url = {u: i for i, u in enumerate(pending_urls)}

    def worker(url: str):
        i = pending_index_by_url[url]
        try:
            item = scrape_course(url)
            saver.mark_success(i, item)
        except requests.HTTPError as e:
            code = e.response.status_code if e.response is not None else "?"
            log.error(f"[HTTP {code}] {url}")
            saver.mark_failure(i)
        except requests.RequestException as e:
            log.error(f"[NETWORK ERROR] {url}: {e}")
            saver.mark_failure(i)
        except Exception as e:
            log.error(f"[PARSE ERROR] {url}: {e}")
            saver.mark_failure(i)
        finally:
            progress.update(1)

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        for url in pending_urls:
            executor.submit(worker, url)

    progress.close()
    saver.stop()

    # Final stats
    total_now = len([u for u in all_urls if u in saver.existing_map])
    total_failed = sum(1 for c, s in zip(saver.completed, saver.successes_by_index) if c and s is None)
    total_pending_left = sum(1 for c in saver.completed if not c)
    log.info(
        f"Merged and wrote {total_now} records → {out_path} "
        f"(new failures this run: {total_failed}, pending left: {total_pending_left})"
    )

if __name__ == "__main__":
    main()

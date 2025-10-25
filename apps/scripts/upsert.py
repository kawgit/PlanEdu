#!/usr/bin/env python3
import json
import os
import re
import sys
import logging
from datetime import datetime

import psycopg
from tqdm.auto import tqdm

# ---------------------------
# Config & Logging
# ---------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("ingest")

def get_conninfo():
    dsn = os.getenv("DATABASE_URL")
    if dsn:
        return dsn
    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")
    user = os.getenv("PGUSER", "postgres")
    password = os.getenv("PGPASSWORD", "")
    dbname = os.getenv("PGDATABASE", "postgres")
    return f"host={host} port={port} user={user} password={password} dbname={dbname}"

# ---------------------------
# Parsing helpers
# ---------------------------

SEASON_MAP = {
    "FALL": "FALL",
    "SPRG": "SPRING",
    "SPRING": "SPRING",
    "SUM": "SUMMER",
    "SUMMER": "SUMMER",
    "SUM1": "SUMMER",
    "SUM2": "SUMMER",
    "WIN": "WINTER",
    "WINTER": "WINTER",
}

SCHEDULE_RE = re.compile(
    r"""^\s*([MTWRFSU]+)\s+(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)\s*$""",
    re.IGNORECASE,
)

def parse_semester_key(key: str):
    parts = key.strip().split()
    if len(parts) != 2:
        raise ValueError(f"Unrecognized semester key format: {key!r}")
    season_raw, year_raw = parts
    season = SEASON_MAP.get(season_raw.upper(), season_raw.upper())
    return season, int(year_raw)

def to_24h_time_obj(tstr: str):
    tnorm = re.sub(r"\s+", " ", tstr.strip().lower())
    return datetime.strptime(tnorm, "%I:%M %p").time()

def parse_schedule(schedule: str):
    m = SCHEDULE_RE.match(schedule)
    if not m:
        raise ValueError(f"Unrecognized schedule format: {schedule!r}")
    days = m.group(1).upper()
    start = to_24h_time_obj(m.group(2))
    end = to_24h_time_obj(m.group(3))
    return days, start, end

# ---------------------------
# DB helpers (quoted columns)
# ---------------------------

def get_or_create_class(cur, school, department, number, title, description):
    cur.execute(
        """SELECT "id" FROM "Class"
           WHERE "school"=%s AND "department"=%s AND "number"=%s""",
        (school, department, int(number)),
    )
    row = cur.fetchone()
    if row:
        class_id = row[0]
        cur.execute(
            """UPDATE "Class"
               SET "title"=%s, "description"=%s
               WHERE "id"=%s AND ("title"<>%s OR "description"<>%s)""",
            (title, description, class_id, title, description),
        )
        return class_id

    cur.execute(
        """INSERT INTO "Class" ("school","department","number","title","description")
           VALUES (%s,%s,%s,%s,%s)
           RETURNING "id" """,
        (school, department, int(number), title, description),
    )
    return cur.fetchone()[0]

def get_or_create_slot(cur, season, year, days, start_time, end_time):
    cur.execute(
        """SELECT "id" FROM "Slot"
           WHERE "season"=%s AND "year"=%s AND "days"=%s
             AND "startTime"=%s AND "endTime"=%s""",
        (season, int(year), days, start_time, end_time),
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        """INSERT INTO "Slot" ("season","year","days","startTime","endTime")
           VALUES (%s,%s,%s,%s,%s)
           RETURNING "id" """,
        (season, int(year), days, start_time, end_time),
    )
    return cur.fetchone()[0]

def ensure_class_to_slot(cur, class_id, slot_id, teacher):
    cur.execute(
        """SELECT "id" FROM "ClassToSlot"
           WHERE "classId"=%s AND "slotId"=%s
             AND COALESCE("teacher",'')=COALESCE(%s,'')""",
        (class_id, slot_id, teacher),
    )
    if cur.fetchone():
        return
    cur.execute(
        """INSERT INTO "ClassToSlot" ("classId","slotId","teacher")
           VALUES (%s,%s,%s)""",
        (class_id, slot_id, teacher),
    )

# ---------------------------
# Main ingest
# ---------------------------

def count_total_meetings(data):
    return sum(
        len(meetings)
        for course in data.values()
        for meetings in (course.get("semesters") or {}).values()
        if isinstance(meetings, list)
    )

def ingest(json_path: str):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_classes_seen = len(data)
    total_meetings_seen = count_total_meetings(data)
    total_classes = total_slots = total_links = failures = 0

    conninfo = get_conninfo()
    logger.info("Connecting to PostgreSQL...")

    with psycopg.connect(conninfo) as conn:
        with conn.cursor() as cur, \
             tqdm(total=total_classes_seen, desc="Classes", unit="class") as pbar_classes, \
             tqdm(total=total_meetings_seen, desc="Meetings", unit="mtg") as pbar_meetings:

            for key, course in data.items():
                try:
                    school = course["school"]
                    department = course["department"]
                    number = course["number"]
                    title = course["title"]
                    description = course["description"]
                except KeyError as e:
                    failures += 1
                    logger.error("Missing required field in %s: %s", key, e)
                    pbar_classes.update(1)
                    pbar_classes.set_postfix(failures=failures)
                    continue

                try:
                    class_id = get_or_create_class(
                        cur, school, department, number, title, description
                    )
                    total_classes += 1
                except Exception as e:
                    failures += 1
                    logger.exception("Failed creating Class for %s: %s", key, e)
                    conn.rollback()
                    pbar_classes.update(1)
                    pbar_classes.set_postfix(failures=failures)
                    continue

                semesters = course.get("semesters") or {}
                for sem_key, meetings in semesters.items():
                    try:
                        season, year = parse_semester_key(sem_key)
                    except Exception as e:
                        failures += 1
                        logger.error("Bad semester key %r for %s: %s", sem_key, key, e)
                        if isinstance(meetings, list):
                            pbar_meetings.update(len(meetings))
                        continue

                    if not isinstance(meetings, list):
                        failures += 1
                        logger.error("Meetings for %s %s not a list", key, sem_key)
                        continue

                    for idx, mtg in enumerate(meetings):
                        instructor = (mtg.get("instructor") or "").strip() or None
                        sched = mtg.get("schedule")
                        if not sched:
                            failures += 1
                            logger.error("Missing schedule for %s %s (index %d)", key, sem_key, idx)
                            pbar_meetings.update(1)
                            continue

                        try:
                            days, start_time, end_time = parse_schedule(sched)
                        except Exception as e:
                            failures += 1
                            logger.error(
                                "Bad schedule %r for %s %s (index %d): %s",
                                sched, key, sem_key, idx, e
                            )
                            pbar_meetings.update(1)
                            continue

                        try:
                            slot_id = get_or_create_slot(
                                cur, season, year, days, start_time, end_time
                            )
                            total_slots += 1
                            ensure_class_to_slot(cur, class_id, slot_id, instructor)
                            total_links += 1
                        except Exception as e:
                            failures += 1
                            logger.exception(
                                "Failed linking Class/Slot for %s %s (index %d): %s",
                                key, sem_key, idx, e
                            )
                            conn.rollback()
                        finally:
                            pbar_meetings.update(1)
                            pbar_meetings.set_postfix(
                                classes=total_classes,
                                slots=total_slots,
                                links=total_links,
                                failures=failures
                            )

                pbar_classes.update(1)
                pbar_classes.set_postfix(
                    classes=total_classes,
                    slots=total_slots,
                    links=total_links,
                    failures=failures
                )

            conn.commit()

    logger.info("Done.")
    logger.info("Classes processed: %d", total_classes)
    logger.info("Slots upserted:   %d", total_slots)
    logger.info("Links created:    %d", total_links)
    logger.info("Failures:         %d", failures)

# ---------------------------
# CLI
# ---------------------------

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path-to-json>", file=sys.stderr)
        sys.exit(1)
    try:
        ingest(sys.argv[1])
    except Exception as e:
        logger.exception("Fatal error: %s", e)
        sys.exit(2)

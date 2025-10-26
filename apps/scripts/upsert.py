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
# ---------------------------
# CS Major Score Calculation
# ---------------------------

def calculate_cs_major_score(title, description, department, number):
    """
    Calculate a score (0-100) for how much a CS major would like this course.
    Simple keyword-based scoring from title and description.
    """
    # Start with a base score for all courses
    score = 30
    
    # Combine title and description for analysis
    text = f"{title} {description}".lower()
    
    # CS-related keywords with their point values
    cs_keywords = {
        # Core CS topics (high value)
        'algorithm': 18,
        'data structure': 18,
        'computer science': 18,
        'computing': 15,
        'programming': 18,
        'coding': 15,
        'software': 15,
        'computer systems': 18,
        'systems programming': 18,
        'software engineering': 15,
        'software development': 15,
        'full-stack': 12,
        'application design': 10,
        
        # CS subfields
        'machine learning': 20,
        'artificial intelligence': 20,
        'ai': 20,
        'deep learning': 18,
        'neural network': 16,
        'data science': 15,
        'data mining': 12,
        'big data': 12,
        'cybersecurity': 12,
        'security': 10,
        'information security': 12,
        'networking': 15,
        'computer network': 15,
        'network programming': 12,
        'distributed system': 18,
        'cloud computing': 15,
        'database': 15,
        'database system': 15,
        'operating system': 15,
        'operating systems': 15,
        'web development': 12,
        'computer graphics': 12,
        'graphics': 10,
        'image processing': 12,
        'computer vision': 12,
        'natural language processing': 12,
        'nlp': 12,
        'blockchain': 12,
        'cryptography': 15,
        'advanced cryptography': 12,
        'compiler': 10,
        'compiler design': 12,
        'embedde': 10,
        'i/o': 8,
        'device driver': 10,
        
        # Programming languages and tools
        'python': 12,
        'java': 12,
        'javascript': 12,
        'c++': 10,
        'c': 10,
        'c programming': 12,
        'perl': 8,
        'unix': 10,
        'linux': 10,
        'react': 10,
        'node.js': 10,
        'sql': 12,
        'git': 8,
        'api': 8,
        'http': 8,
        'tcp/ip': 12,
        'bash': 6,
        
        # Math and logic relevant to CS
        'discrete': 12,
        'combinatoric': 12,
        'combinatorial': 12,
        'linear algebra': 8,
        'algebra': 10,
        'algebraic': 12,
        'probability': 12,
        'probabilistic': 12,
        'statistics': 10,
        'statistical': 10,
        'calculus': 8,
        'logic': 12,
        'formal logic': 12,
        'graph theory': 12,
        'optimization': 12,
        'complexity': 12,
        'np-complete': 8,
        'computational': 15,
        'computation': 15,
        'reduction': 8,
        'polynomial': 8,
        'approximation': 8,
        'randomness': 8,
        'random': 8,
        'set theory': 10,
        'matrix': 8,
        'vectors': 8,
        
        # Technical skills and concepts
        'problem solving': 10,
        'debugging': 10,
        'testing': 8,
        'automation': 8,
        'data analysis': 12,
        'design pattern': 10,
        'software architecture': 12,
        'concurrency': 12,
        'parallel computing': 12,
        'parallel algorithm': 10,
        'synchronization': 10,
        'replication': 8,
        'fault tolerance': 10,
        'robust': 8,
        'real-time': 8,
        'performance': 10,
        'scalability': 10,
        'efficiency': 10,
        'data center': 8,
        
        # Tech industry and business related
        'startup': 8,
        'entrepreneurship': 6,
        'innovation': 6,
        'mobile app': 8,
        'ios': 6,
        'android': 6,
        
        # Economics and finance (CS majors often minor/double major)
        'econometrics': 10,
        'financial modeling': 10,
        'quantitative finance': 12,
        'trading': 8,
        'risk analysis': 8,
        'portfolio': 6,
        
        # Engineering (related technical field)
        'circuit': 10,
        'signal processing': 10,
        'digital logic': 12,
        'hardware': 10,
        'microprocessor': 10,
        'fpga': 8,
        'arduino': 6,
        'raspberry pi': 6,
        
        # Statistics and data (CS majors take these)
        'regression': 12,
        'classification': 12,
        'clustering': 12,
        'anomaly detection': 10,
        'outlier': 8,
        'feature selection': 10,
        'dimensionality reduction': 10,
        'sampling': 8,
        'hypothesis testing': 8,
        
        # Project-based learning
        'capstone': 10,
        'practicum': 10,
        'internship': 6,
        'independent study': 8,
        'project': 6,
    }
    
    # Check for keywords and add points
    for keyword, points in cs_keywords.items():
        if keyword in text:
            score += points
    
    # Ensure score is between 0 and 100
    return min(max(score, 0), 100)

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
    # Calculate CS major score
    cs_major_score = calculate_cs_major_score(title, description, department, int(number))
    
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
               SET "title"=%s, "description"=%s, "csMajorScore"=%s
               WHERE "id"=%s""",
            (title, description, cs_major_score, class_id),
        )
        return class_id

    cur.execute(
        """INSERT INTO "Class" ("school","department","number","title","description","csMajorScore")
           VALUES (%s,%s,%s,%s,%s,%s)
           RETURNING "id" """,
        (school, department, int(number), title, description, cs_major_score),
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

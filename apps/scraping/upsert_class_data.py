#!/usr/bin/env python3
import argparse
import json
import os
import sys
import psycopg2
from psycopg2.extras import execute_values
from tqdm import tqdm

UPSERT_CLASS_SQL = """
INSERT INTO "Course" ("id", "school", "department", "number", "title", "description", "embedding")
VALUES (%s, %s, %s, %s, %s, %s, NULL)
ON CONFLICT ("id")
DO UPDATE SET
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description"
RETURNING "id";
"""

INSERT_SECTIONS_SQL_TEMPLATE = """
INSERT INTO "Section"
("courseId","name","year","season","instructor","location","days","startTime","endTime","notes")
VALUES %s
RETURNING "id";
"""

def normalize_section(sec):
    return {
        "name": sec.get("name"),
        "year": int(sec["year"]),
        "season": sec.get("season", "").upper(),
        "instructor": sec.get("instructor"),
        "location": sec.get("location"),
        "days": sec.get("days"),
        "startTime": sec.get("startTime"),
        "endTime": sec.get("endTime"),
        "notes": sec.get("notes"),
    }

def main():
    parser = argparse.ArgumentParser(description="Upsert class and section data into Postgres")
    parser.add_argument(
        "--input", "-i",
        default="data/class_data.json",
        help="Path to input JSON (default: data/class_data.json)"
    )
    args = parser.parse_args()

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL environment variable not set.", file=sys.stderr)
        sys.exit(1)

    # Load JSON data
    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        print("Error: input JSON must be a list of course objects.", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    total_classes = 0
    total_sections = 0

    for course in tqdm(data, desc="Upserting classes", unit="class"):
        course_id = f"{course['school']} {course['department']} {course['number']}"
        cur.execute(
            UPSERT_CLASS_SQL,
            (
                course_id,
                course["school"],
                course["department"],
                course["number"],
                course["title"],
                course["description"],
            ),
        )
        class_id = cur.fetchone()[0]
        total_classes += 1

        sections = course.get("sections", [])
        if not sections:
            continue

        vals = []
        for s in tqdm(sections, desc=f"Inserting sections for {course['school']} {course['department']} {course['number']}", unit="section", leave=False):
            s = normalize_section(s)
            vals.append((
                class_id,
                s["name"], s["year"], s["season"], s["instructor"],
                s["location"], s["days"], s["startTime"], s["endTime"], s["notes"]
            ))

        execute_values(cur, INSERT_SECTIONS_SQL_TEMPLATE, vals)
        total_sections += len(vals)

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n✅ Done. Upserted {total_classes} classes and inserted {total_sections} sections.")

if __name__ == "__main__":
    main()

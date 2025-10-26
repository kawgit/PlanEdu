import json
import os
from psycopg import connect, sql
from dotenv import load_dotenv

# -------------------------------------------------------------------
# Load environment variables
# -------------------------------------------------------------------
load_dotenv()  # Reads from a .env file in the same directory if it exists

# -------------------------------------------------------------------
# Database connection helper
# -------------------------------------------------------------------
def get_connection():
    """
    Creates a PostgreSQL connection using environment variables.
    Falls back to sane defaults if variables are missing.
    """
    dsn = os.getenv("DATABASE_URL")
    if dsn:
        return connect(dsn)

    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")
    user = os.getenv("PGUSER") or os.getenv("USER")  # Use current OS user if PGUSER missing
    password = os.getenv("PGPASSWORD", "")
    dbname = os.getenv("PGDATABASE", "postgres")

    conn_str = f"host={host} port={port} user={user} password={password} dbname={dbname}"
    return connect(conn_str)


# -------------------------------------------------------------------
# SQL statements
# -------------------------------------------------------------------
UPSERT_LOCATION_SQL = """
INSERT INTO studyabroadlocations (name)
VALUES (%s)
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
RETURNING locationid;
"""

SELECT_CLASS_SQL = """
SELECT id FROM "Class"
WHERE school = %s AND department = %s AND number = %s;
"""

INSERT_LINK_SQL = """
INSERT INTO locationclasses (locationid, classid)
VALUES (%s, %s)
ON CONFLICT (locationid, classid) DO NOTHING;
"""

# -------------------------------------------------------------------
# Load JSON data
# -------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(SCRIPT_DIR, "citycourse.json")

with open(JSON_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# -------------------------------------------------------------------
# Main script
# -------------------------------------------------------------------
def main():
    print("🔗 Connecting to PostgreSQL...")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # ---------------------------------------------------
                # 1️⃣  Collect all unique study abroad locations
                # ---------------------------------------------------
                all_locations = set()
                for locations_list in data.values():
                    all_locations.update(locations_list)

                print(f"📍 Found {len(all_locations)} unique locations.")

                # ---------------------------------------------------
                # 2️⃣  Upsert each location and map its ID
                # ---------------------------------------------------
                location_id_map = {}
                for name in all_locations:
                    cur.execute(UPSERT_LOCATION_SQL, (name,))
                    location_id = cur.fetchone()[0]
                    location_id_map[name] = location_id

                print("✅ Upserted locations successfully.")
                print("🗺️  Location → ID map:")
                print(location_id_map)

                # ---------------------------------------------------
                # 3️⃣  Link classes to their study abroad locations
                # ---------------------------------------------------
                print("\n🔗 Linking classes to locations...")

                courses_linked = 0
                courses_not_found = 0

                for course_key, location_names in data.items():
                    try:
                        school, department, number_str = course_key.split("-")
                        number = int(number_str)
                    except ValueError:
                        print(f"⚠️  Skipping malformed course key: {course_key}")
                        continue

                    # Find the class
                    cur.execute(SELECT_CLASS_SQL, (school, department, number))
                    result = cur.fetchone()
                    if not result:
                        print(f"⚠️  Class not found in database: {course_key}")
                        courses_not_found += 1
                        continue

                    class_id = result[0]

                    # Link each location
                    for loc_name in location_names:
                        location_id = location_id_map[loc_name]
                        cur.execute(INSERT_LINK_SQL, (location_id, class_id))

                    courses_linked += 1

                # ---------------------------------------------------
                # 4️⃣  Summary
                # ---------------------------------------------------
                print("\n--- ✅ Summary ---")
                print(f"Linked {courses_linked} courses successfully.")
                print(f"Skipped {courses_not_found} (not found in Class table).")
                print("🎓 Study abroad class upsert complete!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("Transaction was rolled back.")


if __name__ == "__main__":
    main()

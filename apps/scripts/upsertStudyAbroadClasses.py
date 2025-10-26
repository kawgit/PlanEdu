import json
import os
import psycopg

# --- Load JSON Data ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(SCRIPT_DIR, 'citycourse.json')
with open(JSON_PATH, 'r') as f:
    data = json.load(f)

# --- Database Connection ---
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

DB_CONNECT_STRING = get_conninfo()

# --- SQL Commands ---

# 1. Upsert a location. This inserts if 'name' doesn't exist.
#    In either case, it returns the 'locationId'.
UPSERT_LOCATION_SQL = """
INSERT INTO studyabroadlocations (name) 
VALUES (%s)
ON CONFLICT (name) 
DO UPDATE SET name = EXCLUDED.name
RETURNING locationid;
"""

# 2. Get the 'classId' by matching school, department, and number.
#    We use "Class" in quotes because CLASS is a SQL keyword.
SELECT_CLASS_SQL = """
SELECT id FROM "Class"
WHERE school = %s AND department = %s AND number = %s;
"""

# 3. Insert the link into the join table.
#    If the link already exists, it does nothing.
INSERT_LINK_SQL = """
INSERT INTO locationclasses (locationid, classid)
VALUES (%s, %s)
ON CONFLICT (locationid, classid) DO NOTHING;
"""

def main():
    print("Connecting to database...")
    try:
        # Use a single connection and transaction
        with psycopg.connect(DB_CONNECT_STRING) as conn:
            # 'with' block handles commits or rollbacks
            with conn.cursor() as cur:
                
                # --- Step 1: Get all unique location names ---
                all_locations = set()
                for locations_list in data.values():
                    all_locations.update(locations_list)
                
                print(f"Found {len(all_locations)} unique locations.")

                # --- Step 2: Upsert locations and get their IDs ---
                location_id_map = {} # Maps 'Sydney' -> 1, 'London' -> 2, etc.
                
                for name in all_locations:
                    cur.execute(UPSERT_LOCATION_SQL, (name,))
                    location_id = cur.fetchone()[0]
                    location_id_map[name] = location_id
                
                print("Upserted locations and mapped IDs:")
                print(location_id_map)

                # --- Step 3: Loop through courses and link them ---
                print("\nProcessing and linking courses...")
                courses_linked = 0
                courses_not_found = 0
                
                for course_key, location_names in data.items():
                    # Parse the course key "CAS-CS-330"
                    try:
                        school, department, number_str = course_key.split('-')
                        number = int(number_str)
                    except ValueError:
                        print(f"  [WARN] Skipping malformed key: {course_key}")
                        continue
                    
                    # Find the classId from your "Class" table
                    cur.execute(SELECT_CLASS_SQL, (school, department, number))
                    result = cur.fetchone()
                    
                    if not result:
                        print(f"  [WARN] Class not found, skipping: {course_key}")
                        courses_not_found += 1
                        continue
                    
                    classId = result[0]
                    
                    # Link this class to each of its locations
                    for loc_name in location_names:
                        locationId = location_id_map[loc_name]
                        
                        # Insert the link
                        cur.execute(INSERT_LINK_SQL, (locationId, classId))
                    
                    courses_linked += 1

                print("\n--- Summary ---")
                print(f"Successfully processed and linked {courses_linked} courses.")
                print(f"Skipped {courses_not_found} courses (not found in 'Class' table).")
                print("\nDatabase upsert complete!")

    except Exception as e:
        print(f"\nAn error occurred: {e}")
        print("Transaction was rolled back.")

if __name__ == "__main__":
    main()
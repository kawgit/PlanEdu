import os
import json
import psycopg
from tqdm import tqdm
from dotenv import load_dotenv

# === Setup ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HUBS_PATH = os.path.join(BASE_DIR, "hubs_strict.json")

load_dotenv()

# === Load JSON ===
with open(HUBS_PATH, "r") as f:
    hubs_data = json.load(f)

PGDATA = os.getenv("PGDATA") or os.getenv("DATABASE_URL")
if not PGDATA:
    raise RuntimeError("⚠️ No connection string found in PGDATA or DATABASE_URL")

conn = psycopg.connect(PGDATA)
cur = conn.cursor()

print("🔗 Linking classes to hub requirements...")

insert_count = 0
skip_count = 0

for code, hub_list in tqdm(hubs_data.items(), desc="Processing courses"):
    try:
        school, dept, num = code.split('-')

        # Find class ID
        cur.execute("""
            SELECT id FROM "Class"
            WHERE school = %s AND department = %s AND number = %s
        """, (school, dept, int(num)))
        result = cur.fetchone()
        if not result:
            skip_count += 1
            continue
        class_id = result[0]

        for hub_name in hub_list:
            cur.execute("""SELECT id FROM "HubRequirement" WHERE name = %s""", (hub_name,))
            hub_result = cur.fetchone()
            if not hub_result:
                print(f"⚠️ Unknown hub name: {hub_name}")
                continue
            hub_id = hub_result[0]

            # Adjust casing if your table uses lowercase columns

            cur.execute("""
                INSERT INTO "ClassToHubRequirement" ("classId", "hubRequirementId")
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (class_id, hub_id))
            insert_count += 1

    except Exception as e:
        print(f"⚠️ Error with {code}: {e}")
        conn.rollback()  # reset transaction state after any error
        continue

conn.commit()
cur.close()
conn.close()

print(f"✅ Done! Added {insert_count} mappings; skipped {skip_count} missing classes.")

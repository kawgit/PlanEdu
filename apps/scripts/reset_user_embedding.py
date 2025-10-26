#!/usr/bin/env python3
"""
Reset User Embedding to Default

This script resets a user's embedding vector in the database, effectively
resetting their position in the vector space. This gives them a fresh start
with recommendations.

Usage:
  python reset_user_embedding.py --google-id YOUR_GOOGLE_ID
  
Options:
  --recompute    After resetting, recompute a fresh embedding from scratch
  --dry-run      Show what would be reset without actually resetting
"""

import os
import sys
import json
import argparse
import subprocess
from dotenv import load_dotenv

try:
    import psycopg
except ImportError:
    print("Error: psycopg not installed. Run: pip install psycopg[binary]")
    sys.exit(1)

# ------------------------------------------------------------------------------
# Load environment
# ------------------------------------------------------------------------------
load_dotenv()

def get_db_connection():
    """Get database connection."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not set in environment")
    return psycopg.connect(db_url)


# ------------------------------------------------------------------------------
# Main logic
# ------------------------------------------------------------------------------
def reset_user_embedding(google_id: str, dry_run: bool = False, recompute: bool = False):
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            # 1. Locate user
            cur.execute(
                'SELECT id, major, embedding, embedding_updated_at FROM "Users" WHERE google_id = %s',
                (google_id,)
            )
            user = cur.fetchone()

            if not user:
                print(f"❌ User not found with Google ID: {google_id}")
                return False

            user_id, major, embedding, updated_at = user

            print("\n👤 User Information:")
            print(f"   ID: {user_id}")
            print(f"   Major: {major or 'N/A'}")
            print(f"   Embedding: {'✅ Set' if embedding else '❌ Not set'}")
            print(f"   Last updated: {updated_at or 'Never'}")

            # 2. Show embedding details if exists
            if embedding:
                try:
                    emb_data = json.loads(embedding)
                    if isinstance(emb_data, list):
                        print(f"   Embedding dimensions: {len(emb_data)}")
                        print(f"   First 5 values: {emb_data[:5]}")
                except Exception:
                    print("   Embedding format could not be parsed")

            # 3. Dry run
            if dry_run:
                print("\n🔍 DRY RUN — No changes will be made")
                print("Would reset:")
                print("   - embedding → NULL")
                print("   - embedding_updated_at → NULL")
                if recompute:
                    print("\nWould then recompute embedding from:")
                    print(f"   - Major: {major}")
                    print("   - Completed courses & interests (from DB)")
                return True

            # 4. Perform reset
            print("\n🔄 Resetting user embedding...")
            cur.execute("""
                UPDATE "Users"
                SET embedding = NULL,
                    embedding_updated_at = NULL
                WHERE id = %s
            """, (user_id,))
            conn.commit()

            print("✅ User embedding reset to NULL")
            print("   - Recommendations will default to general suggestions")
            print("   - Swipe history and bookmarks remain intact")

            # 5. Optionally recompute
            if recompute:
                print("\n🔁 Recomputing fresh embedding from scratch...")

                script_path = os.path.join(
                    os.path.dirname(__file__),
                    "user_embedding.py"
                )

                input_data = {"googleId": google_id}

                try:
                    result = subprocess.run(
                        ["python3", script_path],
                        input=json.dumps(input_data),
                        capture_output=True,
                        text=True,
                        check=False
                    )

                    if result.returncode == 0:
                        print("✅ Fresh embedding recomputed successfully.")
                        try:
                            output = json.loads(result.stdout)
                            if "embedding" in output:
                                print(f"   New embedding dimensions: {len(output['embedding'])}")
                        except Exception:
                            print("⚠️  Unable to parse recompute output.")
                    else:
                        print(f"⚠️  Recompute failed:\n{result.stderr}")
                        print("   You can recompute manually with:")
                        print(f"   curl -X POST http://localhost:3001/api/user-embedding "
                              f"-H 'Content-Type: application/json' "
                              f"-d '{json.dumps(input_data)}'")
                except Exception as e:
                    print(f"⚠️  Error during recompute: {e}")
            else:
                print("\n💡 To recompute your embedding later, run:")
                print(f"   python reset_user_embedding.py --google-id {google_id} --recompute")

            return True

    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False
    finally:
        conn.close()


# ------------------------------------------------------------------------------
# CLI Entrypoint
# ------------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Reset a user's embedding vector to its default state",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python reset_user_embedding.py --google-id YOUR_ID --dry-run
  python reset_user_embedding.py --google-id YOUR_ID
  python reset_user_embedding.py --google-id YOUR_ID --recompute
        """
    )

    parser.add_argument("--google-id", required=True, help="Google ID of the user")
    parser.add_argument("--dry-run", action="store_true", help="Preview without changing")
    parser.add_argument("--recompute", action="store_true", help="Recompute after reset")

    args = parser.parse_args()

    success = reset_user_embedding(
        google_id=args.google_id,
        dry_run=args.dry_run,
        recompute=args.recompute
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Apply database migration to add embedding columns
Run this script to add the embedding column to your Users table
"""

import os
import sys
from dotenv import load_dotenv

try:
    import psycopg
except ImportError:
    print("❌ Error: psycopg not installed")
    print("Install with: pip install psycopg[binary]")
    sys.exit(1)

# Try to load .env from multiple locations
import pathlib
script_dir = pathlib.Path(__file__).parent
env_locations = [
    script_dir / '.env',
    script_dir / 'apps' / 'backend' / '.env',
    script_dir / 'apps' / 'scripts' / '.env',
]

for env_path in env_locations:
    if env_path.exists():
        print(f"Loading environment from: {env_path}")
        load_dotenv(env_path)
        break

# Migration SQL
MIGRATION_SQL = """
-- Enable pgvector extension (if available)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (vector type if pgvector available, otherwise JSONB)
DO $$ 
BEGIN
    -- Try vector type first
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS embedding vector(1536);
    RAISE NOTICE 'Added embedding column as vector type';
EXCEPTION
    WHEN undefined_object THEN
        -- Fallback to JSONB if pgvector not available
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS embedding JSONB;
        RAISE NOTICE 'Added embedding column as JSONB (pgvector not available)';
END $$;

-- Add timestamp column
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP;

-- Try to create index (only works with vector type)
DO $$ 
BEGIN
    CREATE INDEX IF NOT EXISTS users_embedding_idx 
    ON "Users" 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
    RAISE NOTICE 'Created vector similarity index';
EXCEPTION
    WHEN undefined_object OR undefined_function THEN
        RAISE NOTICE 'Skipped vector index (pgvector not available)';
END $$;
"""

def apply_migration():
    """Apply the migration to add embedding columns."""
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("❌ Error: DATABASE_URL not found in environment")
        print("Make sure you have a .env file with DATABASE_URL set")
        return False
    
    print("🔄 Applying migration to add embedding columns...")
    print(f"   Database: {db_url.split('@')[1] if '@' in db_url else 'localhost'}")
    
    try:
        # Connect to database
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                # Execute migration
                cur.execute(MIGRATION_SQL)
                conn.commit()
                
                # Verify columns exist
                cur.execute("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'Users' 
                    AND column_name IN ('embedding', 'embedding_updated_at')
                    ORDER BY column_name;
                """)
                
                columns = cur.fetchall()
                
                if columns:
                    print("\n✅ Migration applied successfully!")
                    print("\nNew columns in Users table:")
                    for col_name, col_type in columns:
                        print(f"   - {col_name}: {col_type}")
                    return True
                else:
                    print("⚠️  Migration executed but columns not found")
                    return False
                    
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Database Migration: Add User Embeddings")
    print("=" * 60)
    print()
    
    success = apply_migration()
    
    print()
    print("=" * 60)
    
    if success:
        print("✅ All done! Your database is ready.")
        print("\nNext steps:")
        print("1. Restart your backend: cd apps/backend && npm run dev")
        print("2. Compute embeddings: POST /api/user/compute-embedding")
        print("3. Try the swiper - recommendations should work now!")
    else:
        print("❌ Migration failed. Please check the error above.")
        print("\nManual fix:")
        print("1. Check your DATABASE_URL in .env")
        print("2. Or run the SQL manually in your database console")
        print("   (see apps/backend/migrations/add_user_embedding.sql)")
    
    sys.exit(0 if success else 1)


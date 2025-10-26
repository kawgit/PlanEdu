# Fix: Apply Database Migration

## The Problem
```
Error: column "embedding" does not exist
```

Your database doesn't have the `embedding` column yet. You need to run the migration.

## Quick Fix

### Option 1: Apply Migration with psql

```bash
# Apply the migration
psql $DATABASE_URL < apps/backend/migrations/add_user_embedding.sql
```

### Option 2: Manual SQL

If you don't have direct psql access, run this SQL in your database console:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add metadata column
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP;

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS users_embedding_idx 
ON "Users" 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Option 3: Use Database GUI

If using a database GUI (like pgAdmin, DBeaver, etc.):

1. Connect to your database
2. Run the SQL above in a query window
3. Execute

## Verify It Worked

```bash
# Check if columns exist
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'Users' AND column_name IN ('embedding', 'embedding_updated_at');"
```

You should see:
```
 column_name        
--------------------
 embedding
 embedding_updated_at
```

## After Migration

Restart your backend:
```bash
cd apps/backend
npm run dev
```

The swiper should now work! 🎉

## Troubleshooting

### "pgvector extension not available"

Your PostgreSQL instance might not support pgvector. Options:

1. **Use Neon/Supabase**: They have pgvector built-in
2. **Install pgvector**: On your local PostgreSQL
3. **Temporary fix**: Store embeddings as JSON (see below)

### Temporary Fix (JSON instead of vector)

If pgvector isn't available, modify the migration:

```sql
-- Use JSONB instead of vector
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS embedding JSONB;

ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP;
```

**Note**: You'll lose fast similarity search, but recommendations will still work!


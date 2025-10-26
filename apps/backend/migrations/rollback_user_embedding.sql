-- Rollback migration: Remove user embedding support
-- This script reverses the changes made by add_user_embedding.sql

-- Drop the vector similarity index
DROP INDEX IF EXISTS users_embedding_idx;

-- Remove the embedding columns from Users table
ALTER TABLE "Users" 
DROP COLUMN IF EXISTS embedding;

ALTER TABLE "Users" 
DROP COLUMN IF EXISTS embedding_updated_at;

-- Note: We don't drop the vector extension as other tables might be using it
-- If you want to completely remove vector support, run:
-- DROP EXTENSION IF EXISTS vector CASCADE;


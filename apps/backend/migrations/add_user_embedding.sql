-- Migration: Add embedding column to Users table
-- This migration adds support for storing user embeddings as vectors
-- Requires: pgvector extension

-- Enable the pgvector extension if not already enabled
-- This allows us to store and query vector embeddings efficiently
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to Users table
-- vector(1536) matches the dimensionality of OpenAI's text-embedding-3-small model
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add metadata column to track when the embedding was last computed
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP;

-- Create an index for efficient vector similarity search
-- Using ivfflat index with cosine distance for fast nearest neighbor queries
CREATE INDEX IF NOT EXISTS users_embedding_idx 
ON "Users" 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add a comment explaining the embedding column
COMMENT ON COLUMN "Users".embedding IS 'Vector embedding (1536-dim) representing user academic profile: major, interests, and courses taken. Generated using OpenAI text-embedding-3-small model.';

COMMENT ON COLUMN "Users".embedding_updated_at IS 'Timestamp when the user embedding was last computed/updated.';


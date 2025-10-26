-- Clear Swipe Data for a User
-- This script clears all swipe interactions (bookmarks) for a specific user

-- Option 1: Clear swipes for a specific user by Google ID
-- Replace 'YOUR_GOOGLE_ID' with your actual Google ID
DELETE FROM "Bookmark"
WHERE "userId" IN (
  SELECT id FROM "Users" WHERE google_id = 'YOUR_GOOGLE_ID'
);

-- Option 2: Clear swipes for a specific user by user ID
-- Replace 123 with your actual user ID
-- DELETE FROM "Bookmark" WHERE "userId" = 123;

-- Option 3: Clear ALL bookmarks for ALL users (use with caution!)
-- DELETE FROM "Bookmark";

-- Optional: Reset your user embedding (since it was influenced by swipes)
-- This will require you to compute a fresh embedding
-- Replace 'YOUR_GOOGLE_ID' with your actual Google ID
UPDATE "Users"
SET 
  embedding = NULL,
  embedding_updated_at = NULL
WHERE google_id = 'YOUR_GOOGLE_ID';

-- To verify the deletion:
SELECT COUNT(*) as remaining_bookmarks 
FROM "Bookmark" b
JOIN "Users" u ON u.id = b."userId"
WHERE u.google_id = 'YOUR_GOOGLE_ID';


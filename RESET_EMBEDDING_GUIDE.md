# 🔄 Reset User Embedding Guide

## Overview

This guide explains how to reset your user embedding vector in the database, giving you a fresh start with course recommendations.

## What Does This Do?

Resetting your embedding:
- ✅ Clears your vector position in the embedding space
- ✅ Makes the system treat you as a "new" user
- ✅ Removes the influence of past swipes on your recommendations
- ❌ **Does NOT** delete your bookmarks or completed courses
- ❌ **Does NOT** delete your swipe history

## When Should You Reset?

Reset your embedding if:
- 🎯 Your recommendations seem stuck or repetitive
- 🔄 You want to change your interests/focus area
- 🐛 Your embedding was corrupted or affected by bad swipes
- 🆕 You want a completely fresh start with recommendations

## Option 1: Using Python Script (Recommended)

### Preview First (Safe)
```bash
cd /Users/christophermiyai/Desktop/DSXBU

python reset_user_embedding.py \
  --google-id YOUR_GOOGLE_ID \
  --dry-run
```

**Output:**
```
👤 User Information:
   ID: 123
   Name: John Doe
   Email: john@example.com
   Major: Computer Science
   Embedding: ✅ Set
   Last updated: 2025-10-26 14:30:22
   Embedding dimensions: 1536
   First 5 values: [0.123, -0.456, 0.789, ...]

🔍 DRY RUN - No changes will be made

Would reset:
   - embedding → NULL
   - embedding_updated_at → NULL
```

### Reset Only
```bash
python reset_user_embedding.py \
  --google-id YOUR_GOOGLE_ID
```

### Reset + Recompute Fresh Embedding
```bash
python reset_user_embedding.py \
  --google-id YOUR_GOOGLE_ID \
  --recompute
```

This will:
1. Reset your embedding to NULL
2. Immediately compute a fresh embedding from:
   - Your major
   - Your interests
   - Your completed courses

## Option 2: Using SQL Directly

### Connect to Database
```bash
# Using psql
psql "$DATABASE_URL"

# Or use your database GUI (TablePlus, pgAdmin, etc.)
```

### Reset Embedding
```sql
-- Reset for specific user
UPDATE "Users"
SET 
  embedding = NULL,
  embedding_updated_at = NULL
WHERE google_id = 'YOUR_GOOGLE_ID';

-- Verify reset
SELECT 
  id,
  name,
  major,
  embedding IS NULL as embedding_reset,
  embedding_updated_at
FROM "Users"
WHERE google_id = 'YOUR_GOOGLE_ID';
```

## Option 3: Using API Endpoint

### Method 1: Reset via API
```bash
curl -X DELETE "http://localhost:3001/api/user/embedding?googleId=YOUR_GOOGLE_ID"
```

### Method 2: Recompute (overwrites existing)
```bash
curl -X POST http://localhost:3001/api/user/compute-embedding \
  -H "Content-Type: application/json" \
  -d '{"googleId": "YOUR_GOOGLE_ID"}'
```

This effectively resets by computing a completely fresh embedding.

## After Resetting

### What Happens Next?

**Immediately:**
- ❌ Personalized recommendations won't work
- ✅ You'll get basic recommendations (still useful!)
- ✅ Bookmarks are preserved
- ✅ Completed courses are preserved

**After Recomputing:**
- ✅ Fresh embedding based on your profile
- ✅ Personalized recommendations return
- ✅ Clean slate for swipe-based learning
- ✅ No influence from old swipes

### Recompute Your Embedding

If you didn't use `--recompute`, do this:

**Via API:**
```bash
curl -X POST http://localhost:3001/api/user/compute-embedding \
  -H "Content-Type: application/json" \
  -d '{"googleId": "YOUR_GOOGLE_ID"}'
```

**Or in your app:**
1. Go to your profile settings
2. Click "Recompute Recommendations" (if available)
3. Or just start swiping - your embedding will update automatically

## Understanding the Embedding

### What Is It?
Your embedding is a **1536-dimensional vector** that represents:
- Your academic interests
- Your major requirements
- Courses you've completed
- Courses you've liked/disliked

### Example Vector
```json
[0.123, -0.456, 0.789, ..., 0.234]
  ^       ^       ^           ^
 dim 1   dim 2   dim 3    dim 1536
```

### How It Works
```
Your Vector:     [0.8, 0.2, 0.5, ...]
CS 210 Vector:   [0.7, 0.3, 0.4, ...]
                      ↓
            Cosine Similarity = 0.92
                      ↓
              High match! → Recommended
```

## Troubleshooting

### "User not found"
```bash
# Check your Google ID is correct
psql "$DATABASE_URL" -c "SELECT google_id, name FROM \"Users\";"
```

### "DATABASE_URL not set"
```bash
# Check .env file exists
cat apps/backend/.env | grep DATABASE_URL

# Or set it manually
export DATABASE_URL="postgresql://..."
```

### Embedding still showing as set
```bash
# Verify the reset
psql "$DATABASE_URL" -c "
  SELECT embedding IS NULL, embedding_updated_at 
  FROM \"Users\" 
  WHERE google_id = 'YOUR_GOOGLE_ID';
"
```

### Recompute fails
```bash
# Check OpenAI API key is set
cat apps/backend/.env | grep OPENAI_API_KEY

# Check user has completed courses
psql "$DATABASE_URL" -c "
  SELECT COUNT(*) 
  FROM \"UserCompletedClass\" 
  WHERE \"userId\" = YOUR_USER_ID;
"
```

## Advanced: Partial Reset

### Reset Only Swipe Influence (Keep Base Embedding)

This is tricky because swipes incrementally modify your embedding. To do this:

1. **Save your current embedding**:
```sql
SELECT embedding INTO TEMP TABLE backup_embedding
FROM "Users" WHERE google_id = 'YOUR_GOOGLE_ID';
```

2. **Reset and recompute fresh**:
```bash
python reset_user_embedding.py \
  --google-id YOUR_GOOGLE_ID \
  --recompute
```

### Clear Bookmarks Too

If you want to clear everything:

```bash
# 1. Clear bookmarks
psql "$DATABASE_URL" -c "
  DELETE FROM \"Bookmark\"
  WHERE \"userId\" IN (
    SELECT id FROM \"Users\" WHERE google_id = 'YOUR_GOOGLE_ID'
  );
"

# 2. Reset embedding
python reset_user_embedding.py \
  --google-id YOUR_GOOGLE_ID \
  --recompute
```

## Best Practices

### When to Reset
- ✅ Every semester (fresh start)
- ✅ After completing major courses (interests shift)
- ✅ If recommendations feel stale
- ✅ Before showing the app to someone else

### When NOT to Reset
- ❌ After just a few swipes (give it time)
- ❌ If recommendations are good (don't break it!)
- ❌ Multiple times per day (be patient)

### Recommended Workflow

**Full Clean Start:**
```bash
# 1. Preview what will change
python reset_user_embedding.py --google-id YOUR_ID --dry-run

# 2. Reset and recompute
python reset_user_embedding.py --google-id YOUR_ID --recompute

# 3. Verify
curl "http://localhost:3001/api/recommendations?googleId=YOUR_ID"

# 4. Start swiping!
```

**Partial Reset (Keep Bookmarks):**
```bash
# Just reset embedding, don't touch bookmarks
python reset_user_embedding.py --google-id YOUR_ID --recompute
```

## FAQ

**Q: Will I lose my bookmarked courses?**  
A: No, bookmarks are separate from embeddings.

**Q: Will I lose my completed courses?**  
A: No, completed courses are permanent in your transcript.

**Q: How often should I reset?**  
A: Only when recommendations feel stale or you want a fresh start. Maybe once per semester.

**Q: What if I regret resetting?**  
A: Unfortunately, embeddings can't be restored. But you can recompute a fresh one, and it will adapt quickly as you swipe.

**Q: Does resetting affect other users?**  
A: No, each user has their own independent embedding.

**Q: Can I automate this?**  
A: Yes! Add a cron job or API endpoint in your app to reset embeddings periodically.

---

## Summary

**Quick Commands:**

```bash
# Preview reset
python reset_user_embedding.py --google-id YOUR_ID --dry-run

# Reset + recompute (recommended)
python reset_user_embedding.py --google-id YOUR_ID --recompute

# Reset via SQL
psql "$DATABASE_URL" -c "UPDATE \"Users\" SET embedding=NULL WHERE google_id='YOUR_ID';"

# Recompute via API
curl -X POST http://localhost:3001/api/user/compute-embedding \
  -H "Content-Type: application/json" \
  -d '{"googleId": "YOUR_ID"}'
```

**What Gets Reset:** Your vector position in embedding space  
**What Stays:** Bookmarks, completed courses, profile  
**Result:** Fresh start with personalized recommendations

---

**Need Help?** Check the script output or database logs for details.


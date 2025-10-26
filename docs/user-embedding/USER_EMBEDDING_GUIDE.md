# User Embedding System - Complete Guide

## Overview

This system computes and stores vector embeddings for users based on their academic profile (major, interests, courses taken). These embeddings enable:

- **Personalized course recommendations** based on user similarity
- **Student profile matching** for study groups or mentorship
- **Academic pathway discovery** by finding similar successful students
- **Interest-based clustering** for events and resources

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     User Profile Data                        │
│         (Major, Interests, Completed Courses)                │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│           TypeScript Backend (Express API)                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  POST /api/user/compute-embedding                      │ │
│  │  - Fetches user data from database                     │ │
│  │  - Calls Python script via runPythonScript()           │ │
│  │  - Stores embedding in PostgreSQL with pgvector        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GET /api/user/embedding                               │ │
│  │  - Retrieves stored embedding for a user               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GET /api/user/similar-users                           │ │
│  │  - Finds users with similar embeddings                 │ │
│  │  - Uses cosine similarity search                       │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│           Python Script (user_embedding.py)                  │
│                                                              │
│  1. Reads JSON: {major, interests, courses_taken}           │
│  2. Builds rich text profile                                │
│  3. Calls OpenAI text-embedding-3-small API                 │
│  4. Returns 1536-dimensional vector                         │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                 PostgreSQL + pgvector                        │
│                                                              │
│  Users table:                                                │
│  - embedding: vector(1536)                                   │
│  - embedding_updated_at: timestamp                           │
│  - Indexed with ivfflat for fast similarity search          │
└──────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Database Setup

**Enable pgvector extension** (required for storing vectors):

```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL

# Enable the extension
CREATE EXTENSION IF NOT EXISTS vector;
```

**Apply the migration**:

```bash
# From project root
psql $DATABASE_URL < apps/backend/migrations/add_user_embedding.sql
```

This adds:
- `embedding` column (vector type, 1536 dimensions)
- `embedding_updated_at` timestamp column
- Vector similarity index for fast searches

### 2. Environment Variables

Ensure your `.env` file contains:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Python Dependencies

Already installed in your venv:
- `openai>=2.6.1`
- `python-dotenv>=1.1.1`

### 4. Backend Dependencies

Already installed:
- Express
- @neondatabase/serverless
- TypeScript

## API Endpoints

### 1. Compute and Store User Embedding

**Endpoint**: `POST /api/user/compute-embedding`

**Purpose**: Generate and store an embedding for a user based on their database profile

**Request**:
```json
{
  "googleId": "user_google_id_here"
}
```

**Response** (Success):
```json
{
  "success": true,
  "dimension": 1536,
  "model": "text-embedding-3-small",
  "profile_text": "Academic Major: Computer Science\nAcademic Interests and Focus Areas: AI, systems\nCompleted Courses: CASCS111, CASCS112...",
  "updated_at": "2025-10-26T12:00:00.000Z"
}
```

**Response** (Error):
```json
{
  "error": "User not found",
  "details": "No user with googleId: xyz"
}
```

**Use Cases**:
- After user updates their profile (major, interests)
- After user completes a new course
- Periodic batch updates to refresh all embeddings

---

### 2. Retrieve User Embedding

**Endpoint**: `GET /api/user/embedding?googleId={googleId}`

**Purpose**: Get the stored embedding vector for a user

**Response**:
```json
{
  "embedding": [0.123, -0.456, 0.789, ...], // 1536 floats
  "dimension": 1536,
  "updated_at": "2025-10-26T12:00:00.000Z",
  "user": {
    "googleId": "user_google_id",
    "major": "Computer Science",
    "interests": "AI, systems, theory"
  }
}
```

**Use Cases**:
- Debugging embedding values
- Exporting user data
- Verifying embedding was computed

---

### 3. Find Similar Users

**Endpoint**: `GET /api/user/similar-users?googleId={googleId}&limit={limit}`

**Purpose**: Find users with similar academic profiles using cosine similarity

**Query Parameters**:
- `googleId` (required): User to find similarities for
- `limit` (optional, default: 10): Number of similar users to return

**Response**:
```json
{
  "user_major": "Computer Science",
  "similar_users": [
    {
      "googleId": "user_123",
      "major": "Computer Science",
      "interests": "AI, machine learning",
      "similarity_score": 0.9234
    },
    {
      "googleId": "user_456",
      "major": "Data Science",
      "interests": "statistics, ML",
      "similarity_score": 0.8901
    }
  ]
}
```

**Similarity Score**: 
- Range: 0.0 to 1.0
- 1.0 = identical profiles
- 0.9+ = very similar
- 0.7-0.9 = moderately similar
- <0.7 = different profiles

**Use Cases**:
- Study group recommendations
- Peer mentor matching
- Alumni connections
- Course recommendation based on similar students

---

### 4. Stateless Embedding (Legacy)

**Endpoint**: `POST /api/user-embedding`

**Purpose**: Generate an embedding without storing it (for testing or one-off use)

**Request**:
```json
{
  "major": "Computer Science",
  "interests": ["AI", "systems"],
  "courses_taken": ["CASCS111", "CASCS210"]
}
```

**Response**:
```json
{
  "embedding": [0.123, -0.456, ...],
  "profile_text": "Academic Major: Computer Science\n...",
  "dimension": 1536,
  "model": "text-embedding-3-small"
}
```

## Testing

### Quick Test

```bash
# Start backend
cd apps/backend
npm run dev

# In another terminal, run test suite
cd apps/backend
node test-user-embedding.js
```

### Manual Testing with cURL

**1. Compute embedding for a user:**
```bash
curl -X POST http://localhost:3001/api/user/compute-embedding \
  -H "Content-Type: application/json" \
  -d '{"googleId": "YOUR_GOOGLE_ID"}'
```

**2. Retrieve embedding:**
```bash
curl http://localhost:3001/api/user/embedding?googleId=YOUR_GOOGLE_ID
```

**3. Find similar users:**
```bash
curl http://localhost:3001/api/user/similar-users?googleId=YOUR_GOOGLE_ID&limit=5
```

## Frontend Integration

### React Example: Compute User Embedding

```typescript
const computeUserEmbedding = async (googleId: string) => {
  try {
    const response = await fetch('/api/user/compute-embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleId })
    });
    
    if (!response.ok) throw new Error('Failed to compute embedding');
    
    const result = await response.json();
    console.log('Embedding computed:', result.dimension, 'dimensions');
    return result;
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### React Example: Find Similar Users

```typescript
const SimilarUsersComponent = ({ googleId }) => {
  const [similarUsers, setSimilarUsers] = useState([]);
  
  useEffect(() => {
    fetch(`/api/user/similar-users?googleId=${googleId}&limit=5`)
      .then(res => res.json())
      .then(data => setSimilarUsers(data.similar_users))
      .catch(console.error);
  }, [googleId]);
  
  return (
    <div>
      <h2>Users with Similar Interests</h2>
      {similarUsers.map(user => (
        <div key={user.googleId}>
          <strong>{user.major}</strong>
          <p>Similarity: {(user.similarity_score * 100).toFixed(1)}%</p>
          <p>Interests: {user.interests}</p>
        </div>
      ))}
    </div>
  );
};
```

## Best Practices

### When to Update Embeddings

**Automatically trigger updates when:**
- User changes their major
- User adds/removes interests
- User completes a new course
- User uploads a new transcript

**Batch updates:**
- Run nightly job to update stale embeddings (>7 days old)
- Update embeddings for active users weekly

### Performance Optimization

**1. Caching:**
```typescript
// Cache embeddings in Redis for 1 hour
const cachedEmbedding = await redis.get(`embedding:${googleId}`);
if (cachedEmbedding) return JSON.parse(cachedEmbedding);
```

**2. Lazy Loading:**
- Only compute embeddings when actually needed
- Don't compute for inactive users

**3. Index Optimization:**
The ivfflat index uses approximate nearest neighbor search for speed:
```sql
-- Tune the lists parameter based on your data size
-- lists = sqrt(number_of_rows) is a good starting point
CREATE INDEX users_embedding_idx 
ON "Users" 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- Adjust based on user count
```

### Error Handling

**Common Errors:**

1. **"User has no profile data"**
   - User must have at least one of: major, interests, or completed courses
   - Solution: Ensure user completes onboarding

2. **"OPENAI_API_KEY not set"**
   - Missing API key in .env
   - Solution: Add to .env file

3. **"pgvector extension not found"**
   - Database doesn't have vector support
   - Solution: Run `CREATE EXTENSION vector;`

4. **"Embedding column does not exist"**
   - Migration not applied
   - Solution: Run add_user_embedding.sql

## Use Cases & Examples

### 1. Course Recommendations

```typescript
// Find users similar to current user who took a course
const recommendCourses = async (googleId: string) => {
  // Get similar users
  const { similar_users } = await fetch(
    `/api/user/similar-users?googleId=${googleId}&limit=20`
  ).then(r => r.json());
  
  // Find courses they took that current user hasn't
  const courseRecommendations = /* query courses from similar users */;
  
  return courseRecommendations;
};
```

### 2. Study Group Matching

```typescript
// Find 3-5 users with similar interests for study groups
const formStudyGroup = async (googleId: string, courseId: number) => {
  const similarUsers = await fetch(
    `/api/user/similar-users?googleId=${googleId}&limit=10`
  ).then(r => r.json());
  
  // Filter for users taking the same course
  const groupMembers = similarUsers.similar_users.filter(
    user => user.enrolledCourses.includes(courseId)
  ).slice(0, 4);
  
  return groupMembers;
};
```

### 3. Mentor Matching

```typescript
// Match underclassmen with upperclassmen who have similar interests
const findMentor = async (studentGoogleId: string) => {
  const similarUsers = await fetch(
    `/api/user/similar-users?googleId=${studentGoogleId}&limit=20`
  ).then(r => r.json());
  
  // Filter for users with more credits (upperclassmen)
  const mentors = similarUsers.similar_users.filter(
    user => user.incoming_credits > 60 && user.similarity_score > 0.7
  );
  
  return mentors;
};
```

## Troubleshooting

### Embedding Dimension Mismatch

**Error**: `dimension of vector does not match index`

**Cause**: Model changed or wrong dimension specified

**Solution**:
```sql
-- Check current dimension
SELECT pg_typeof(embedding) FROM "Users" LIMIT 1;

-- Recreate column if needed
ALTER TABLE "Users" DROP COLUMN embedding;
ALTER TABLE "Users" ADD COLUMN embedding vector(1536);
```

### Slow Similarity Searches

**Symptom**: Queries taking >1 second

**Solutions**:
1. Ensure index exists: `\d "Users"` in psql
2. Increase lists parameter: `WITH (lists = 200)`
3. Use LIMIT to restrict results
4. Add WHERE clauses to filter before similarity search

### API Rate Limits

**Symptom**: "Rate limit exceeded" from OpenAI

**Solutions**:
1. Implement request queuing
2. Batch embed users in groups
3. Cache embeddings longer
4. Use smaller model (if available)

## Migration & Rollback

### Apply Migration
```bash
psql $DATABASE_URL < apps/backend/migrations/add_user_embedding.sql
```

### Rollback Migration
```bash
psql $DATABASE_URL < apps/backend/migrations/rollback_user_embedding.sql
```

### Check Migration Status
```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Users' 
AND column_name IN ('embedding', 'embedding_updated_at');

-- Check index
SELECT indexname FROM pg_indexes 
WHERE tablename = 'Users' 
AND indexname = 'users_embedding_idx';
```

## Cost Estimation

**OpenAI API Costs** (text-embedding-3-small):
- $0.00002 per 1,000 tokens
- Average user profile: ~100 tokens
- Cost per embedding: ~$0.000002
- 10,000 users: ~$0.02

**Storage Costs**:
- Each embedding: 1536 floats × 4 bytes = 6,144 bytes (~6 KB)
- 10,000 users: ~60 MB
- Negligible for most databases

**Recommended Budget**:
- Small app (<1,000 users): <$1/month
- Medium app (1,000-10,000 users): $1-10/month
- Large app (>10,000 users): $10-100/month

## Advanced Features

### Weighted Embeddings

Modify `user_embedding.py` to weight components differently:

```python
def build_weighted_profile(user_data):
    parts = []
    
    # Weight major 3x
    if user_data.get('major'):
        parts.extend([user_data['major']] * 3)
    
    # Weight interests 2x
    if user_data.get('interests'):
        parts.extend(user_data['interests'] * 2)
    
    # Weight courses 1x
    if user_data.get('courses_taken'):
        parts.extend(user_data['courses_taken'])
    
    return " ".join(parts)
```

### Embeddings for Courses

Use the same system to embed course descriptions and match users to courses:

```typescript
// Compute embedding for a course
const courseEmbedding = await runPythonScript('../../scripts/user_embedding.py', {
  major: '',
  interests: [course.title, course.description],
  courses_taken: []
});

// Find users who would like this course
SELECT u.*, u.embedding <=> ${courseEmbedding}::vector as similarity
FROM "Users" u
WHERE u.embedding IS NOT NULL
ORDER BY similarity ASC
LIMIT 50;
```

## Files Created

1. **`apps/scripts/user_embedding.py`** - Python embedding script
2. **`apps/backend/src/routes/userEmbedding.ts`** - Express routes
3. **`apps/backend/migrations/add_user_embedding.sql`** - Database migration
4. **`apps/backend/migrations/rollback_user_embedding.sql`** - Rollback script
5. **`apps/backend/test-user-embedding.js`** - Test suite
6. **`USER_EMBEDDING_GUIDE.md`** - This guide

## Summary

You now have a complete system for:
- ✅ Computing user embeddings from academic profiles
- ✅ Storing embeddings efficiently in PostgreSQL with pgvector
- ✅ Finding similar users with cosine similarity
- ✅ RESTful API endpoints for all operations
- ✅ Type-safe TypeScript + Python integration
- ✅ Comprehensive testing and documentation

**Next steps**: Integrate this into your course recommendation system and user profile features! 🚀


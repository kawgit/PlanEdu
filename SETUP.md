# DSXBU - Setup Guide

## Prerequisites

- Node.js 18+
- Python 3.8+
- PostgreSQL database (Neon recommended)
- Google OAuth credentials
- Gemini API key (optional, for Schedule Builder natural language parsing)

## Quick Setup

### 1. Clone and Install Dependencies

```bash
# Install backend dependencies
cd apps/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Install Python dependencies
cd ../..
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your credentials
nano .env
```

**Required Variables:**
- `DATABASE_URL` - Your Neon PostgreSQL connection string
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console

**Optional Variables:**
- `GEMINI_API_KEY` - For Schedule Builder natural language parsing (get from https://makersuite.google.com/app/apikey)
- `SOLVER_URL` - Schedule solver service URL (default: http://localhost:8000)

### 3. Start Services

**Option A: Start All Services (Recommended)**
```bash
./start-schedule-builder.sh
```

**Option B: Start Individually**
```bash
# Terminal 1: Solver
cd apps/solver
source ../../venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Backend
cd apps/backend
npm run dev

# Terminal 3: Frontend
cd apps/frontend
npm run dev
```

### 4. Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Solver API:** http://localhost:8000/docs

## Feature-Specific Setup

### Schedule Builder

The Schedule Builder works without GEMINI_API_KEY, but won't parse natural language constraints.

**To enable natural language parsing:**

1. Get API key from https://makersuite.google.com/app/apikey
2. Add to `.env`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Restart backend: `cd apps/backend && npm run dev`

**Without GEMINI_API_KEY:**
- Schedule generation still works
- Manual constraints work
- Natural language parsing is skipped (system will log warning)

### Recommendation System

Uses course embeddings for personalized recommendations.

**Setup:**
```bash
# Compute course embeddings
cd apps/scripts
python compute_course_embeddings.py

# Initialize user embeddings
python reset_user_embedding.py
```

## Verification

### Test Schedule Builder
```bash
# Run solver tests
cd apps/solver/tests
python3 test-schedule-e2e.py

# Run full validation
./validate-schedule-builder.sh
```

### Test Backend
```bash
# Check health
curl http://localhost:3001/api/health

# Test schedule generation
curl -X POST http://localhost:3001/api/schedule/generate \
  -H "Content-Type: application/json" \
  -d '{"googleId":"your_google_id","feedback":"","maxCoursesPerSemester":4}'
```

### Test Solver
```bash
# Check health
curl http://localhost:8000/health

# View API docs
open http://localhost:8000/docs
```

## Troubleshooting

### "GEMINI_API_KEY not set" Warning

**Cause:** Environment variable not configured
**Solution:** 
1. Add `GEMINI_API_KEY` to `.env` file
2. Restart backend

**Alternative:** Schedule Builder works without it, just without natural language parsing

### "Cannot connect to solver"

**Cause:** Solver service not running
**Solution:**
```bash
cd apps/solver
source ../../venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### "Database connection error"

**Cause:** Invalid `DATABASE_URL`
**Solution:**
1. Check Neon connection string
2. Verify database is active
3. Update `.env` with correct URL

### Port already in use

**Cause:** Service already running on port
**Solution:**
```bash
# Find process using port
lsof -i :3001  # or :8000, :5173

# Kill process
kill -9 <PID>
```

## Development Workflow

### Making Changes

1. **Backend changes:** Auto-reloads with `npm run dev`
2. **Frontend changes:** Auto-reloads with Vite
3. **Solver changes:** Restart uvicorn or use `--reload` flag

### Running Tests

```bash
# Solver tests
cd apps/solver/tests && python3 test-schedule-e2e.py

# Backend tests (requires GEMINI_API_KEY)
export GEMINI_API_KEY="your-key"
node apps/backend/tests/test-llm-parsing.js

# Full validation
./validate-schedule-builder.sh
```

### Database Migrations

```bash
cd apps/backend
# Run migrations
npm run migrate

# Or manually with SQL
psql $DATABASE_URL -f migrations/your_migration.sql
```

## Documentation

- **[SCHEDULE_BUILDER_README.md](./SCHEDULE_BUILDER_README.md)** - Schedule Builder overview
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick commands
- **[docs/schedule-builder/](./docs/schedule-builder/)** - Detailed documentation
- **[docs/recommendation-system/](./docs/recommendation-system/)** - Recommendation system docs
- **[docs/user-embedding/](./docs/user-embedding/)** - User embedding docs

## Getting Help

1. Check troubleshooting section above
2. Review documentation in `docs/`
3. Check service logs for error messages
4. Run `./validate-schedule-builder.sh` for diagnostics

## Next Steps

After setup:
1. ✅ Verify all services running
2. ✅ Test Schedule Builder
3. ✅ Configure Gemini API (optional)
4. ✅ Import course data
5. ✅ Set up OAuth authentication
6. ✅ Deploy to production

---

*For Schedule Builder validation details, see [docs/schedule-builder/VALIDATION_COMPLETE.md](./docs/schedule-builder/VALIDATION_COMPLETE.md)*


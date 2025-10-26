# AI Schedule Builder - Quick Start

Get the AI Schedule Builder running in 5 minutes.

## Prerequisites

- Python 3.12+ with venv activated
- Node.js 18+ installed
- PostgreSQL database running
- Google Gemini API key configured

## Step 1: Install Dependencies (One-Time Setup)

```bash
# Install Python dependencies
source venv/bin/activate
pip install -r requirements.txt

# Backend dependencies (if needed)
cd apps/backend && npm install && cd ../..

# Frontend dependencies (if needed)
cd apps/frontend && npm install && cd ../..
```

## Step 2: Start Services

### Option A: Automated Startup (Recommended)

```bash
./start-schedule-builder.sh
```

This will:
- ✅ Start Solver Service (port 8000)
- ✅ Start Backend (port 3001)
- ✅ Start Frontend (port 5173)
- ✅ Create logs in `logs/` directory

### Option B: Manual Startup

**Terminal 1 - Solver:**
```bash
cd apps/solver
source ../../venv/bin/activate
uvicorn main:app --port 8000 --reload
```

**Terminal 2 - Backend:**
```bash
cd apps/backend
npm run dev
```

**Terminal 3 - Frontend:**
```bash
cd apps/frontend
npm run dev
```

## Step 3: Test System

```bash
./test-schedule-builder.sh
```

Expected output:
```
✅ All core tests passed!
```

## Step 4: Use the Application

1. **Open Browser:** http://localhost:5173

2. **Sign In:** Click "Sign In" and authenticate with Google

3. **Bookmark Courses:**
   - Go to "Class Swiper"
   - Swipe right on 5-10 courses you're interested in
   - These will be your bookmarks

4. **Generate Schedule:**
   - Navigate to "Schedule Builder"
   - (Optional) Enter preferences:
     ```
     I want no Friday classes and prefer classes after 10 AM.
     I need Tuesday afternoons free for work.
     ```
   - Select max courses per semester (default: 4)
   - Click "Generate My Schedule"

5. **View Results:**
   - Schedule organized by semester
   - Course times and days
   - Applied constraints
   - Optimization scores

6. **Iterate:**
   - Not happy? Adjust preferences and regenerate
   - Try different constraint combinations

## Common Preferences Examples

### Time Preferences
```
I want no Friday classes
All classes should end before 5 PM
I need classes after 10 AM
I want Monday and Wednesday mornings free
```

### Workload
```
Maximum 3 courses per semester
I want a light course load
```

### Combined
```
I want 4 courses per semester with no Friday classes. 
I prefer morning classes and need lunch break from 12-1 PM.
```

## Stopping Services

```bash
./stop-schedule-builder.sh
```

Or manually:
```bash
# Find and kill processes
lsof -ti:8000 -ti:3001 -ti:5173 | xargs kill
```

## Troubleshooting

### "Solver service failed to start"

**Fix:**
```bash
cd apps/solver
source ../../venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

### "No feasible schedule found"

**Reasons:**
- Too many hard constraints
- Conflicting requirements
- Not enough bookmarked courses

**Solutions:**
- Use softer language ("prefer" instead of "must")
- Reduce number of constraints
- Bookmark more courses
- Increase max courses per semester

### "Please bookmark some courses first"

**Fix:**
1. Go to Class Swiper page
2. Swipe right on courses
3. Return to Schedule Builder

### Port Already in Use

**Fix:**
```bash
./stop-schedule-builder.sh
# Wait 2 seconds
./start-schedule-builder.sh
```

## Viewing Logs

```bash
# All logs
tail -f logs/*.log

# Specific service
tail -f logs/solver.log
tail -f logs/backend.log
tail -f logs/frontend.log
```

## Architecture (Simple View)

```
You Type: "I want no Friday classes"
         ↓
    Frontend sends to Backend
         ↓
    LLM parses into constraints
         ↓
    Backend sends to Solver
         ↓
    CP-SAT finds optimal schedule
         ↓
    Frontend displays schedule
```

## What's Next?

### For Users
- Experiment with different constraint combinations
- Try soft vs. hard constraints
- Generate schedules for different semesters
- Compare multiple generated schedules

### For Developers
- See `SCHEDULE_BUILDER_GUIDE.md` for detailed documentation
- See `SCHEDULE_BUILDER_SUMMARY.md` for implementation details
- See `apps/solver/README.md` for solver API reference

## Quick Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend | 3001 | http://localhost:3001 |
| Solver | 8000 | http://localhost:8000 |

| Command | Purpose |
|---------|---------|
| `./start-schedule-builder.sh` | Start all services |
| `./stop-schedule-builder.sh` | Stop all services |
| `./test-schedule-builder.sh` | Run integration tests |
| `tail -f logs/*.log` | View logs |

## Support

**Common Issues:**
1. Services won't start → Check ports aren't in use
2. No bookmarks → Use Class Swiper first
3. Infeasible schedule → Simplify constraints
4. Solver timeout → Reduce number of courses

**Logs Location:** `logs/` directory

**Documentation:**
- Quick Start (this file)
- Complete Guide: `SCHEDULE_BUILDER_GUIDE.md`
- Summary: `SCHEDULE_BUILDER_SUMMARY.md`
- Solver API: `apps/solver/README.md`

---

**Need Help?** Check the full guide: `SCHEDULE_BUILDER_GUIDE.md`

**Status:** ✅ Fully Functional (October 26, 2025)


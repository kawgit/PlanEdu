# AI Schedule Builder - Complete Guide

This guide covers the complete setup and operation of the AI Schedule Builder system.

## System Overview

The AI Schedule Builder consists of three integrated components:

1. **Frontend (React + TypeScript)** - User interface for schedule generation
2. **Backend (Express + TypeScript)** - API orchestration and LLM constraint parsing
3. **Solver Service (FastAPI + Python)** - CP-SAT optimization engine

```
┌──────────────┐
│   Frontend   │  User enters preferences
│   (React)    │  "I want no Friday classes"
└──────┬───────┘
       │ POST /api/schedule/generate
       ▼
┌──────────────┐
│   Backend    │  1. Query database for courses
│  (Express)   │  2. Parse feedback with LLM
│              │  3. Build solver request
└──────┬───────┘
       │ POST /solve
       ▼
┌──────────────┐
│    Solver    │  CP-SAT optimization
│  (FastAPI)   │  Returns optimal schedule
└──────────────┘
```

## Prerequisites

- Node.js 18+ and npm
- Python 3.12+
- PostgreSQL database (already configured)
- Google Gemini API key (already configured)

## Installation

### 1. Install Python Dependencies

The solver requires OR-Tools and FastAPI:

```bash
# Activate virtual environment
source venv/bin/activate

# Install solver dependencies
cd apps/solver
pip install -r requirements.txt
cd ../..
```

### 2. Install Node Dependencies

Backend and frontend dependencies should already be installed. If not:

```bash
# Backend
cd apps/backend
npm install
cd ../..

# Frontend
cd apps/frontend
npm install
cd ../..
```

### 3. Environment Variables

Ensure these are set in `apps/backend/.env`:

```bash
DATABASE_URL=postgresql://...
GEMINI_API_KEY=your_gemini_api_key
SOLVER_URL=http://localhost:8000  # Optional, defaults to this
```

## Running the System

You need to run **three services** simultaneously:

### Terminal 1: Solver Service

```bash
cd apps/solver
source ../../venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Expected output:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Terminal 2: Backend Server

```bash
cd apps/backend
npm run dev
```

Expected output:
```
Backend server listening on http://localhost:3001
```

### Terminal 3: Frontend Dev Server

```bash
cd apps/frontend
npm run dev
```

Expected output:
```
VITE ready in XXXms
Local: http://localhost:5173/
```

## Testing the System

### 1. Test Solver Connectivity

```bash
# Health check
curl http://localhost:8000/health

# Should return:
{
  "status": "healthy",
  "solver": "CP-SAT (OR-Tools)",
  "constraints_supported": [...]
}
```

### 2. Test Backend Integration

```bash
# Test solver connection from backend
curl http://localhost:3001/api/schedule/test

# Should return:
{
  "solverConnected": true,
  "solverUrl": "http://localhost:8000",
  "solverHealth": {...}
}
```

### 3. Test End-to-End Schedule Generation

#### Via Frontend (Recommended)

1. Navigate to http://localhost:5173
2. Sign in with Google
3. Go to "Class Swiper" and bookmark 5-10 courses
4. Navigate to "Schedule Builder"
5. (Optional) Enter preferences like:
   - "I want no Friday classes"
   - "All classes should start after 10 AM"
   - "I need Tuesday and Thursday afternoons free"
6. Click "Generate My Schedule"
7. Wait 5-10 seconds for the solver
8. View your optimized schedule!

#### Via API (For Testing)

```bash
# Get your Google ID from localStorage after signing in
GOOGLE_ID="your_google_id_here"

# Generate schedule
curl -X POST http://localhost:3001/api/schedule/generate \
  -H "Content-Type: application/json" \
  -d '{
    "googleId": "'$GOOGLE_ID'",
    "feedback": "I want no Friday classes and prefer mornings",
    "maxCoursesPerSemester": 4
  }'
```

Expected response:

```json
{
  "success": true,
  "status": "OPTIMAL",
  "schedule": {
    "Fall2024": [
      {
        "courseId": "CASCS111",
        "title": "Introduction to Computer Science",
        "days": ["Mon", "Wed", "Fri"],
        "startTime": 540,
        "endTime": 620
      }
    ]
  },
  "totalCourses": 8,
  "parsedConstraints": [
    {
      "kind": "disallowed_days",
      "mode": "hard",
      "payload": {"days": ["Fri"]}
    },
    {
      "kind": "earliest_start",
      "mode": "soft",
      "payload": {"time": "10:00"}
    }
  ],
  "message": "Schedule generated successfully!"
}
```

## How It Works

### 1. User Input

User enters natural language preferences:
- "I want no Friday classes"
- "I prefer classes after 10 AM"
- "Maximum 4 courses per semester"

### 2. LLM Constraint Parsing

Backend uses Gemini to parse feedback into structured constraints:

```javascript
// Input: "I want no Friday classes"
// Output:
[
  {
    "id": "c1",
    "kind": "disallowed_days",
    "mode": "hard",
    "payload": {"days": ["Fri"]}
  }
]
```

### 3. Data Collection

Backend queries PostgreSQL for:
- User's bookmarked courses
- Available course sections (mock data currently)
- User's major and Hub requirements
- Completed courses (to filter out)

### 4. Solver Request

Backend sends JSON to solver:

```json
{
  "relations": [
    {
      "rid": "CASCS111_Fall2024_A",
      "class_id": "CASCS111",
      "semester": "Fall2024",
      "days": ["Mon", "Wed", "Fri"],
      "start": 540,
      "end": 620,
      "instructor_id": "prof_smith",
      "professor_rating": 4.5
    }
  ],
  "conflicts": [["CASCS111_Fall2024_A", "CASMA121_Fall2024_B"]],
  "bookmarks": ["CASCS111", "CASMA121"],
  "k": 4,
  "constraints": [...]
}
```

### 5. CP-SAT Optimization

Solver uses Google OR-Tools to:
- Create boolean variables for each section
- Add constraints (time conflicts, requirements, user preferences)
- Build lexicographic objective function (bookmarks > degree > comfort)
- Maximize objective while satisfying all hard constraints

### 6. Result Processing

Backend enriches solver results with:
- Course titles and descriptions
- Instructor names
- Time formatting
- Grouping by semester

### 7. Frontend Display

React component renders:
- Schedule by semester in table format
- Applied constraints
- Objective scores
- Option to regenerate

## Features

### Supported Constraints

The system supports 16+ constraint types:

**Time Preferences:**
- ✅ Free days (no Friday classes)
- ✅ Earliest start time (no classes before 10 AM)
- ✅ Latest end time (no classes after 5 PM)
- ✅ Block time windows (lunch break 12-1 PM)
- ✅ Disallowed days

**Course Selection:**
- ✅ Include/exclude specific courses
- ✅ Include/exclude specific sections
- ✅ Bookmarked course bonus

**Instructor Preferences:**
- ✅ Include/exclude specific instructors
- ✅ Professor rating weights

**Requirements:**
- ✅ Max/min courses per semester
- ✅ Major group requirements
- ✅ Hub requirements
- ✅ Prerequisite ordering

### Constraint Modes

- **Hard constraints**: Must be satisfied (e.g., "I NEED Friday off")
- **Soft constraints**: Preferred but flexible (e.g., "I'd LIKE morning classes")

The LLM automatically infers mode based on language:
- "must", "need", "require" → hard
- "prefer", "would like", "ideally" → soft

## Troubleshooting

### Solver Returns INFEASIBLE

**Problem:** No schedule satisfies all constraints.

**Solutions:**
1. Reduce number of required courses
2. Make hard constraints soft ("prefer" instead of "must")
3. Check for conflicting requirements
4. Increase `maxCoursesPerSemester`

**Example:**
```
❌ "I MUST have no classes on Monday, Wednesday, or Friday"
✅ "I prefer to avoid Friday classes"
```

### Solver Service Not Running

**Error:** `Failed to call solver service`

**Solution:**
```bash
cd apps/solver
source ../../venv/bin/activate
uvicorn main:app --port 8000 --reload
```

### No Bookmarks Available

**Error:** `Please bookmark some courses before generating a schedule`

**Solution:**
1. Go to Class Swiper page
2. Swipe right on 5-10 courses
3. Return to Schedule Builder

### LLM Parsing Fails

**Error:** `Failed to parse constraints`

**Cause:** Invalid Gemini API key or API error

**Solution:**
- Check `GEMINI_API_KEY` in `.env`
- Verify API quota
- Try simpler feedback text

### Slow Schedule Generation

**Normal:** 5-10 seconds for 10+ courses

**If taking longer:**
- Reduce number of bookmarked courses
- Simplify constraints
- Check solver logs for warnings

## Advanced Usage

### Custom Objective Priorities

You can specify custom optimization priorities:

```json
{
  "kind": "lexicographic_priority",
  "payload": {
    "tiers": ["bookmarks", "comfort", "degree"]
  }
}
```

### Pin Specific Sections

Force the solver to include specific sections:

```json
{
  "kind": "pin_sections",
  "payload": {
    "section_ids": ["CASCS111_Fall2024_A"]
  }
}
```

### Professor Rating Weights

Bonus for highly-rated professors:

```json
{
  "kind": "professor_rating_weight",
  "weight": 2.0,
  "payload": {
    "threshold": 4.0
  }
}
```

## Architecture Details

### Backend Route (`/api/schedule/generate`)

1. ✅ Authenticate user via `googleId`
2. ✅ Fetch user's bookmarked courses
3. ✅ Fetch user's completed courses (filter out)
4. ✅ Parse natural language feedback → constraints (LLM)
5. ✅ Build course sections data (currently mock, needs real section data)
6. ✅ Query Hub requirements
7. ✅ Call solver API
8. ✅ Enrich results with course details
9. ✅ Return schedule grouped by semester

### Solver Service (`POST /solve`)

1. ✅ Validate request data
2. ✅ Initialize `ScheduleSolver` with data
3. ✅ Apply user constraints
4. ✅ Run CP-SAT optimization (max 10s)
5. ✅ Return chosen sections and objective scores

### Frontend (`ScheduleBuilderPage.tsx`)

1. ✅ Fetch user's bookmarks on mount
2. ✅ Display settings (semester, max courses)
3. ✅ Accept user preferences (textarea)
4. ✅ Call backend `/api/schedule/generate`
5. ✅ Show loading spinner during optimization
6. ✅ Render schedule in table format
7. ✅ Display applied constraints
8. ✅ Allow regeneration

## Next Steps

### For Production

1. **Real Section Data**: Replace mock sections with actual course sections from database
2. **Caching**: Cache solver results for common requests
3. **Async Processing**: Use job queue for long-running optimizations
4. **User Accounts**: Save generated schedules to database
5. **Export**: PDF/ICS calendar export
6. **Visual Calendar**: React-big-calendar integration
7. **Conflict Detection**: Real-time conflict warnings
8. **Course Prerequisites**: Validate prerequisites before scheduling

### For Better UX

1. **Guided Constraints**: Dropdown menus for common preferences
2. **Constraint Preview**: Show constraint JSON before generating
3. **Schedule Comparison**: Save and compare multiple schedules
4. **Iterative Refinement**: "Regenerate with X changed"
5. **Feedback Loop**: "Add CS 111 to Fall 2024"

## API Reference

### Backend Endpoints

#### `POST /api/schedule/generate`

Generate an optimized schedule.

**Request:**
```json
{
  "googleId": "string (required)",
  "feedback": "string (optional)",
  "semester": "string (optional, 'Fall2024' or 'all')",
  "maxCoursesPerSemester": "number (optional, default 4)"
}
```

**Response:**
```json
{
  "success": true,
  "status": "OPTIMAL",
  "schedule": {
    "Fall2024": [...],
    "Spring2025": [...]
  },
  "totalCourses": 8,
  "parsedConstraints": [...],
  "objectiveScores": {...}
}
```

#### `GET /api/schedule/test`

Test solver connectivity.

**Response:**
```json
{
  "solverConnected": true,
  "solverUrl": "http://localhost:8000",
  "solverHealth": {...}
}
```

### Solver Endpoints

#### `POST /solve`

Solve a schedule optimization problem.

See `apps/solver/README.md` for detailed API documentation.

#### `GET /health`

Health check and supported constraints.

## Contributing

When adding new constraint types:

1. Add handler to `scheduleSolver.py`
2. Register in `registry` dict
3. Update solver API health endpoint
4. Update LLM prompt in `constraintParser.ts`
5. Test with sample data

## License

Part of the DSXBU project.

## Support

For issues or questions:
1. Check logs in all three terminals
2. Verify all services are running
3. Test each component individually
4. Check API responses with curl

---

**Status:** ✅ Complete and functional
**Last Updated:** October 26, 2025


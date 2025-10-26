# Schedule Builder - Validation & Testing Guide

## Overview

This document describes how to validate the AI Schedule Builder system end-to-end, ensuring all components work together correctly.

## System Architecture

```
┌─────────────────┐
│   Frontend      │  React/TypeScript (port 5173)
│  (React/Vite)   │  - User interface
│                 │  - Preference input
│                 │  - Schedule visualization
└────────┬────────┘
         │ POST /api/schedule/generate
         ▼
┌─────────────────┐
│   Backend       │  Express/TypeScript (port 3001)
│  (Express/TS)   │  - Fetch course data from DB
│                 │  - Parse user feedback via LLM
│                 │  - Call solver service
│                 │  - Format results
└────────┬────────┘
         │ POST /solve
         ▼
┌─────────────────┐
│   Solver        │  FastAPI/Python (port 8000)
│  (FastAPI/      │  - CP-SAT optimization
│   OR-Tools)     │  - Constraint handling
│                 │  - Schedule generation
└─────────────────┘
```

## Key Features Validated

### 1. Course Selection Intelligence

✅ **Excludes Completed Courses**
- Completed courses are never included in generated schedules
- Verified in `test-schedule-e2e.py` - Test 3

✅ **All Courses Available (Not Just Bookmarks)**
- Backend fetches up to 100 available courses (excluding completed)
- Solver can choose ANY non-completed course
- Bookmarks receive soft preference bonus (not hard requirement)
- See `apps/backend/src/routes/schedule.ts` lines 106-117

✅ **Bookmarks as Soft Preferences**
- Bookmarked courses get bonus points in objective function
- System works even with 0 bookmarks
- Verified by testing with no bookmarks

### 2. Constraint System

The solver supports multiple constraint types:

#### Hard Constraints (Must be satisfied)
- `disallowed_days` - Block specific days completely
- `block_time_window` - Block specific time windows
- `include_course` - Must include specific courses
- `exclude_course` - Must exclude specific courses
- `target_courses_per_semester` - Exact number of courses per semester

#### Soft Constraints (Preferences)
- `earliest_start` - Prefer classes after certain time
- `latest_end` - Prefer classes before certain time
- `free_day` - Prefer a day off
- `professor_rating_weight` - Boost high-rated professors
- `bookmarked_bonus` - Extra weight for bookmarks

### 3. Optimization Behavior

✅ **Lexicographic Objectives**
The solver optimizes in priority tiers:

1. **Custom tier** - User-specified preferences from constraints
2. **Bookmarks tier** - Soft preference for bookmarked courses
3. **Degree tier** - Fulfills major/hub requirements + baseline value for any course
4. **Comfort tier** - Professor ratings, time preferences

✅ **Baseline Course Value**
- ALL non-completed courses get baseline reward
- Encourages filling up to `k` courses per semester
- Not limited to bookmarks
- See `scheduleSolver.py` lines 145-148

✅ **Different Constraints → Different Results**
- Verified in `test-schedule-e2e.py` - Test 4
- "No Friday" → excludes MWF sections
- "No early morning" → prefers later start times

### 4. LLM Constraint Parsing

✅ **Natural Language → Structured Constraints**

Examples:
```
Input: "I don't want classes on Friday"
Output: {"kind": "disallowed_days", "payload": {"days": ["Fri"]}, "mode": "hard"}

Input: "I prefer classes after 10 AM"
Output: {"kind": "earliest_start", "payload": {"time": "10:00"}, "mode": "soft"}

Input: "I want exactly 3 classes this semester"
Output: {"kind": "target_courses_per_semester", "payload": {"t": 3}, "mode": "hard"}
```

- Uses Gemini AI (`gemini-2.0-flash`)
- Gracefully handles parsing failures
- System works even if LLM unavailable (no constraints applied)
- See `apps/backend/src/utils/constraintParser.ts`

## Validation Tests

### Automated Test Suite

1. **`test-schedule-e2e.py`** - Python tests for solver service
   - ✅ Health check
   - ✅ Basic schedule generation
   - ✅ Completed courses exclusion
   - ✅ Constraint variations produce different results
   - ✅ `target_courses_per_semester` works correctly

2. **`test-llm-parsing.js`** - Node.js tests for LLM parsing
   - ✅ "No Friday classes" → `disallowed_days`
   - ✅ "Late start" → `earliest_start`
   - ✅ "Lunch break" → `block_time_window`
   - ✅ "Exactly 3 classes" → `target_courses_per_semester`
   - ✅ Multiple constraints parsed correctly

3. **`validate-schedule-builder.sh`** - Comprehensive validation script
   - ✅ Checks all services running
   - ✅ Runs solver tests
   - ✅ Tests backend integration
   - ✅ Tests LLM parsing (if API key set)
   - ✅ Tests various constraint scenarios

### Running Validation

```bash
# Make scripts executable
chmod +x test-schedule-e2e.py
chmod +x test-llm-parsing.js
chmod +x validate-schedule-builder.sh

# Run comprehensive validation
./validate-schedule-builder.sh
```

### Manual Testing Checklist

#### 1. No Constraints
- [ ] Generates schedule with available courses
- [ ] Fills up to `k` courses per semester
- [ ] Includes both bookmarked and non-bookmarked courses

#### 2. With Bookmarks
- [ ] Bookmarked courses appear more frequently
- [ ] System still works with 0 bookmarks
- [ ] Non-bookmarked courses still selected if better fit

#### 3. With Completed Courses
- [ ] Completed courses never appear in schedule
- [ ] Other courses from same department still available

#### 4. Time Constraints
- [ ] "No Friday classes" → No sections on Friday
- [ ] "Classes after 10 AM" → Prefers later sections
- [ ] "End before 5 PM" → Avoids evening classes

#### 5. Course Count Constraints
- [ ] "Exactly 3 classes" → Schedule has exactly 3 courses
- [ ] "At most 4 classes" → Schedule has ≤ 4 courses

#### 6. Multiple Semesters
- [ ] Schedule spans Fall 2025 and Spring 2026
- [ ] Courses distributed across semesters
- [ ] Each semester respects `k` limit

## Logging & Debugging

### Solver Logs (FastAPI)
When a request comes in, you'll see:
```
================================================================================
SCHEDULE SOLVER - NEW REQUEST
================================================================================
📚 Total Courses in Pool: 100
✅ Bookmarked Courses: 4
❌ Completed (Excluded): 12
🎯 Available for Selection: 88
📋 User Constraints: 2
🔢 Max Courses/Semester: 4
📅 Semesters: Fall2025, Spring2026

Completed courses (will be excluded): [CASCS101, CASCS111, ...]
Bookmarked courses (soft preference): [CASCS112, CASCS210, ...]

User constraints:
  • disallowed_days (hard): {'days': ['Fri']}
  • earliest_start (soft): {'time': '10:00'}

🔧 Initializing CP-SAT solver...
⚡ Running solver (time limit: 10s)...

✅ SOLUTION FOUND (OPTIMAL)
📝 Chosen Classes: 8
📅 Chosen Sections: 8

Selected courses: CASCS112, CASCS210, CASCS237, CASCS330, ...

🎯 Objective Scores by Tier:
  custom: 1500
  bookmarks: 2000
  degree: 8000
  comfort: 3500

📊 Courses per Semester:
  Fall2025: 4 courses
  Spring2026: 4 courses
================================================================================
```

### Backend Logs (Express)
```
=== Schedule Generation Request ===
User: user@bu.edu
Feedback: I want Friday off
Semester: all

User ID: 123, Major: Computer Science
Bookmarked courses: 4
Completed courses: 12
Available courses for scheduling: 88
Created 176 section relations

--- Parsing constraints from feedback ---
Parsed 1 constraints: ['disallowed_days']

--- Calling solver ---
Total sections: 176
Completed courses (filtered): 12
Bookmarked courses: 4
Constraints: 1
Max courses per semester: 4

--- Solution ---
Chosen sections: 8
Chosen classes: 8
```

## Common Issues & Fixes

### ❌ "No feasible schedule found"
**Causes:**
- Too many conflicting hard constraints
- Not enough available courses
- All available sections conflict with constraints

**Solutions:**
- Relax some hard constraints to soft
- Reduce number of required courses
- Check if too many courses are marked completed

### ❌ Solver returns same schedule regardless of constraints
**Causes:**
- Constraints not being parsed correctly
- Constraint weight too low
- Solver not receiving constraints

**Debug:**
1. Check backend logs - are constraints parsed?
2. Check solver logs - are constraints applied?
3. Try a hard constraint (mode: "hard") instead of soft

### ❌ Completed courses appearing in schedule
**Causes:**
- `completed_courses` not being passed to solver
- Backend not fetching completed courses correctly

**Debug:**
1. Check backend logs for "Completed courses: X"
2. Check solver logs for "❌ Completed (Excluded): X"
3. Verify database has completed courses for user

### ❌ Only bookmarked courses selected (no variety)
**Causes:**
- Bookmark bonus weight too high
- Not enough non-bookmarked courses fetched

**Fix:**
- Backend limits to 100 courses - check if more needed
- Adjust bookmark bonus weight in solver (currently 1.0)

## Performance Benchmarks

- **Solver time**: Usually < 1 second for 100 courses, 2 semesters
- **LLM parsing**: ~1-2 seconds (depends on API)
- **Total request time**: ~2-5 seconds end-to-end

## Future Enhancements

- [ ] Support for actual course section data (not mock)
- [ ] Multi-year planning (4 semesters+)
- [ ] Prerequisite chain planning
- [ ] Study abroad course integration
- [ ] Real-time conflict detection
- [ ] Save/share generated schedules
- [ ] Compare multiple schedule variations

## Related Documentation

- `SCHEDULE_BUILDER_GUIDE.md` - Setup and architecture
- `SCHEDULE_BUILDER_SUMMARY.md` - Quick reference
- `SCHEDULE_BUILDER_QUICKSTART.md` - Getting started
- `apps/solver/README.md` - Solver API details

## Contact & Support

If you encounter issues not covered here:
1. Check solver logs at `logs/solver.log`
2. Check backend terminal output
3. Run `./validate-schedule-builder.sh` for diagnostics
4. Review test output from `test-schedule-e2e.py`


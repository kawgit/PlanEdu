# Schedule Solver Service

FastAPI service that wraps the CP-SAT schedule solver for generating optimized course schedules.

## Features

- **Constraint-Based Scheduling**: Uses Google OR-Tools CP-SAT solver
- **REST API**: Simple JSON-based API for schedule generation
- **Flexible Constraints**: Supports 16+ constraint types including:
  - Time preferences (earliest start, latest end, free days)
  - Course requirements (include/exclude courses)
  - Instructor preferences
  - Hub requirements
  - Workload limits

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or use the project's virtual environment
source ../../venv/bin/activate
pip install -r requirements.txt
```

## Running the Service

### Development Mode

```bash
# From apps/solver directory
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Health Check

```bash
GET /health
```

Returns service status and supported constraints.

### Solve Schedule

```bash
POST /solve
Content-Type: application/json

{
  "relations": [...],       # Course sections with time slots
  "conflicts": [...],       # Conflicting section pairs
  "groups": {...},          # Course groupings for requirements
  "hubs": {...},            # Hub requirements
  "semesters": [...],       # Semester IDs
  "bookmarks": [...],       # Bookmarked course IDs
  "k": 4,                   # Max courses per semester
  "constraints": [...],     # User constraints
  "time_limit_sec": 5       # Solver timeout
}
```

Response:

```json
{
  "status": "OPTIMAL",
  "chosen_sections": ["cs111_fall2024_A1", ...],
  "chosen_classes": ["CASCS111", ...],
  "objective_scores": {
    "bookmarks": 3000,
    "degree": 2000,
    "comfort": 1500
  },
  "scale": 1000
}
```

### Validate Constraints

```bash
POST /validate-constraints
Content-Type: application/json

[
  {
    "id": "c1",
    "kind": "free_day",
    "payload": {"days": ["Fri"], "count": 1}
  }
]
```

## Supported Constraints

### Course Selection
- `include_course`: Force specific courses
- `exclude_course`: Avoid specific courses
- `include_section`: Force specific sections
- `exclude_section`: Avoid specific sections

### Instructor Preferences
- `include_instructor`: Prefer specific instructors
- `exclude_instructor`: Avoid specific instructors
- `professor_rating_weight`: Bonus for highly-rated professors

### Time Preferences
- `disallowed_days`: No classes on certain days
- `earliest_start`: No classes before X time
- `latest_end`: No classes after X time
- `free_day`: Keep days free
- `block_time_window`: Block specific time slots

### Workload
- `max_courses_per_semester`: Limit courses per semester
- `min_courses_per_semester`: Minimum courses per semester

### Requirements
- `require_group_counts`: Fulfill major requirements
- `hub_targets`: Fulfill hub requirements
- `enforce_ordering`: Prerequisites

### Advanced
- `section_filter`: Complex time/instructor filters
- `bookmarked_bonus`: Boost bookmarked courses
- `lexicographic_priority`: Custom objective ordering
- `pin_sections`: Force specific sections

## Constraint Format

Each constraint has:

```json
{
  "id": "unique_id",
  "kind": "constraint_type",
  "mode": "hard|soft",        # optional, default: "soft"
  "weight": 1.0,              # optional, for soft constraints
  "payload": {...}            # constraint-specific data
}
```

### Constraint Modes

- **hard**: Must be satisfied (adds model constraint)
- **soft**: Preferred (adds weighted objective term)

## Integration

The solver service integrates with the backend Express server:

1. Backend receives schedule generation request
2. Backend parses user feedback into constraints (via LLM)
3. Backend queries database for course data
4. Backend calls solver API with data + constraints
5. Solver returns optimized schedule
6. Backend enriches with course details
7. Frontend displays schedule

## Environment Variables

```bash
# None required - solver runs standalone
# Backend sets SOLVER_URL to point here (default: http://localhost:8000)
```

## Testing

```bash
# Test health endpoint
curl http://localhost:8000/health

# Test solve endpoint (requires valid data)
curl -X POST http://localhost:8000/solve \
  -H "Content-Type: application/json" \
  -d @test_data.json
```

## Troubleshooting

### Solver returns INFEASIBLE

- Too many hard constraints
- Conflicting requirements
- Not enough available sections

Solutions:
- Reduce required courses
- Convert hard constraints to soft
- Check for time conflicts

### Slow performance

- Increase `time_limit_sec`
- Reduce problem size (fewer courses/semesters)
- Simplify constraints

### Import errors

Make sure `scheduleSolver.py` is in `../backend/src/`:

```bash
ls ../backend/src/scheduleSolver.py
```

## Architecture

```
┌─────────────┐      HTTP      ┌──────────────┐
│   Frontend  │ ─────────────> │   Backend    │
│  (React)    │                │  (Express)   │
└─────────────┘                └──────────────┘
                                      │
                                      │ HTTP
                                      ▼
                               ┌──────────────┐
                               │    Solver    │
                               │  (FastAPI)   │
                               └──────────────┘
                                      │
                                      │ Python
                                      ▼
                               ┌──────────────┐
                               │  CP-SAT      │
                               │  (OR-Tools)  │
                               └──────────────┘
```

## License

Part of the DSXBU project.


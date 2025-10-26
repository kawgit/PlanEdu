# Solver Tests

This directory contains tests for the CP-SAT Schedule Solver service.

## Test Files

### `test-schedule-e2e.py` ✅

Comprehensive end-to-end tests for the FastAPI solver service.

**What it tests:**
- ✅ Solver health check endpoint
- ✅ Basic schedule generation (no constraints)
- ✅ Completed courses exclusion (hard requirement)
- ✅ Constraint variations produce different results
- ✅ `target_courses_per_semester` constraint works correctly

**How to run:**
```bash
# From project root
cd apps/solver/tests
source ../../../venv/bin/activate
python3 test-schedule-e2e.py
```

**Expected output:**
```
✅ PASS  Solver Health Check
✅ PASS  Basic Schedule Generation
✅ PASS  Completed Courses Exclusion
✅ PASS  Constraint Variations
✅ PASS  Target Courses Constraint

TOTAL: 5/5 tests passed
```

## Requirements

- Python 3.8+
- Virtual environment activated
- Solver service running on port 8000
- Dependencies: `requests`

## Validation Status

**Last Run:** All 5/5 tests passing ✅

## Related Documentation

- [Schedule Builder Validation](../../../docs/schedule-builder/SCHEDULE_BUILDER_VALIDATION.md)
- [Test Instructions](../../../docs/schedule-builder/TEST_INSTRUCTIONS.md)


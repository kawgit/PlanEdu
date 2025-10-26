# Backend Tests

This directory contains tests for the Express backend integration with the Schedule Builder.

## Test Files

### `test-llm-parsing.js`

Tests the natural language constraint parsing via LLM (Gemini).

**What it tests:**
- Natural language → structured constraints conversion
- Various constraint types (disallowed_days, earliest_start, block_time_window, etc.)
- Multiple constraints in single feedback
- Complex schedule preferences

**Test Cases:**
1. "No Friday classes" → `disallowed_days`
2. "Classes after 10 AM" → `earliest_start`
3. "Lunch break 12-1" → `block_time_window`
4. "Exactly 3 classes" → `target_courses_per_semester`
5. Multiple constraints at once
6. Complex schedule preferences

**How to run:**
```bash
# From project root
export GEMINI_API_KEY="your-api-key"
node apps/backend/tests/test-llm-parsing.js
```

**Requirements:**
- Backend running on port 3001
- GEMINI_API_KEY environment variable set
- Node.js 18+

**Expected output:**
```
✅ PASS  No Friday classes
✅ PASS  Late start time
✅ PASS  Lunch break
✅ PASS  Exactly 3 classes
✅ PASS  Multiple constraints
✅ PASS  Complex schedule preference

TOTAL: 6/6 tests passed
```

## Requirements

- Backend service running on port 3001
- GEMINI_API_KEY set in environment
- Solver service running on port 8000
- Test user account in database

## Validation Status

**Status:** Ready for testing (requires GEMINI_API_KEY)

**Note:** LLM parsing is probabilistic. Some variations in parsed constraints are expected. As long as constraints are generally correct, the system is working.

## Related Documentation

- [Test Instructions](../../../docs/schedule-builder/TEST_INSTRUCTIONS.md)
- [Constraint Parser](../src/utils/constraintParser.ts)


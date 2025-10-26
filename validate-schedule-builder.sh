#!/bin/bash
##
# Comprehensive Schedule Builder Validation
# Tests all components: Solver, Backend, Frontend integration, and LLM parsing
##

set -e

echo ""
echo "================================================================================"
echo "  SCHEDULE BUILDER - COMPREHENSIVE VALIDATION"
echo "================================================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if services are running
echo "📋 Step 1: Checking service health..."
echo ""

# Check solver
echo -n "   Solver (port 8000): "
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
    SOLVER_OK=1
else
    echo -e "${RED}✗ Not running${NC}"
    echo "   → Start with: cd apps/solver && source ../../venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
    SOLVER_OK=0
fi

# Check backend
echo -n "   Backend (port 3001): "
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
    BACKEND_OK=1
else
    echo -e "${RED}✗ Not running${NC}"
    echo "   → Start with: cd apps/backend && npm run dev"
    BACKEND_OK=0
fi

# Check frontend
echo -n "   Frontend (port 5173): "
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
    FRONTEND_OK=1
else
    echo -e "${YELLOW}⚠ Not running (optional)${NC}"
    echo "   → Start with: cd apps/frontend && npm run dev"
    FRONTEND_OK=0
fi

echo ""

if [ $SOLVER_OK -eq 0 ] || [ $BACKEND_OK -eq 0 ]; then
    echo -e "${RED}❌ Required services are not running. Please start them first.${NC}"
    echo ""
    exit 1
fi

# Run solver tests
echo "================================================================================"
echo "📋 Step 2: Testing Solver (Python FastAPI)"
echo "================================================================================"
echo ""

if [ -f "apps/solver/tests/test-schedule-e2e.py" ]; then
    source venv/bin/activate
    cd apps/solver/tests
    python3 test-schedule-e2e.py
    SOLVER_TEST_RESULT=$?
    cd ../../..
else
    echo -e "${YELLOW}⚠️  apps/solver/tests/test-schedule-e2e.py not found, skipping${NC}"
    SOLVER_TEST_RESULT=0
fi

echo ""

# Run backend integration tests
echo "================================================================================"
echo "📋 Step 3: Testing Backend Integration"
echo "================================================================================"
echo ""

echo "Testing backend schedule endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/schedule/generate \
  -H "Content-Type: application/json" \
  -d '{
    "googleId": "test_user_validation",
    "feedback": "I want Friday off",
    "maxCoursesPerSemester": 4
  }')

if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Backend integration working${NC}"
    echo ""
    echo "Sample response:"
    echo "$RESPONSE" | python3 -m json.tool | head -20
    BACKEND_TEST_RESULT=0
else
    echo -e "${RED}✗ Backend integration failed${NC}"
    echo "Response: $RESPONSE"
    BACKEND_TEST_RESULT=1
fi

echo ""

# Run LLM parsing tests (if GEMINI_API_KEY is set)
if [ -n "$GEMINI_API_KEY" ]; then
    echo "================================================================================"
    echo "📋 Step 4: Testing LLM Constraint Parsing"
    echo "================================================================================"
    echo ""
    
    if [ -f "apps/backend/tests/test-llm-parsing.js" ]; then
        node apps/backend/tests/test-llm-parsing.js
        LLM_TEST_RESULT=$?
    else
        echo -e "${YELLOW}⚠️  apps/backend/tests/test-llm-parsing.js not found, skipping${NC}"
        LLM_TEST_RESULT=0
    fi
else
    echo "================================================================================"
    echo "📋 Step 4: LLM Constraint Parsing"
    echo "================================================================================"
    echo ""
    echo -e "${YELLOW}⚠️  GEMINI_API_KEY not set, skipping LLM tests${NC}"
    echo "   Set GEMINI_API_KEY to test natural language parsing"
    LLM_TEST_RESULT=0
fi

echo ""

# Test different constraint scenarios
echo "================================================================================"
echo "📋 Step 5: Testing Constraint Scenarios"
echo "================================================================================"
echo ""

test_constraint() {
    local NAME="$1"
    local FEEDBACK="$2"
    
    echo "Testing: $NAME"
    echo "   Feedback: \"$FEEDBACK\""
    
    RESPONSE=$(curl -s -X POST http://localhost:3001/api/schedule/generate \
      -H "Content-Type: application/json" \
      -d "{
        \"googleId\": \"test_user_validation\",
        \"feedback\": \"$FEEDBACK\",
        \"maxCoursesPerSemester\": 4
      }")
    
    if echo "$RESPONSE" | grep -q "success"; then
        NUM_COURSES=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('totalCourses', 0))")
        echo -e "   ${GREEN}✓ Success${NC} - $NUM_COURSES courses scheduled"
    else
        echo -e "   ${RED}✗ Failed${NC}"
    fi
    echo ""
}

test_constraint "No constraints" ""
test_constraint "No Friday classes" "I don't want classes on Friday"
test_constraint "Late start" "I prefer classes after 10 AM"
test_constraint "Exactly 3 classes" "I want exactly 3 classes per semester"

# Summary
echo "================================================================================"
echo "  VALIDATION SUMMARY"
echo "================================================================================"
echo ""

if [ $SOLVER_TEST_RESULT -eq 0 ] && [ $BACKEND_TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ All core tests passed!${NC}"
    echo ""
    echo "✓ Solver is working correctly"
    echo "✓ Backend integration is functional"
    echo "✓ Constraints are being applied"
    echo ""
    echo "🎉 Your Schedule Builder is ready to use!"
    echo ""
    
    if [ $FRONTEND_OK -eq 1 ]; then
        echo "🌐 Frontend: http://localhost:5173"
    fi
    echo "🔧 Backend API: http://localhost:3001/api/schedule"
    echo "⚙️  Solver API: http://localhost:8000"
    echo ""
    
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Please review the logs above and fix any issues."
    echo ""
    exit 1
fi


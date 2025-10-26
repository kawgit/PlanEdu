#!/bin/bash
# Diagnostic script for Schedule Builder issues

echo "🔍 Schedule Builder Diagnostic Tool"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ISSUES_FOUND=0

# Function to check service
check_service() {
    local name=$1
    local url=$2
    
    echo -n "Checking $name... "
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Running${NC}"
        return 0
    else
        echo -e "${RED}❌ Not responding${NC}"
        ((ISSUES_FOUND++))
        return 1
    fi
}

# 1. Check if services are running
echo "1️⃣  Checking Services"
echo "===================="

check_service "Backend (port 3001)" "http://localhost:3001/api"
BACKEND_OK=$?

check_service "Solver (port 8000)" "http://localhost:8000/health"
SOLVER_OK=$?

check_service "Frontend (port 5173)" "http://localhost:5173"
FRONTEND_OK=$?

echo ""

# 2. Test Backend → Solver connectivity
echo "2️⃣  Testing Backend → Solver Connection"
echo "========================================"

if [ $BACKEND_OK -eq 0 ]; then
    echo -n "Testing /api/schedule/test endpoint... "
    RESPONSE=$(curl -s http://localhost:3001/api/schedule/test 2>/dev/null)
    
    if echo "$RESPONSE" | grep -q '"solverConnected":true'; then
        echo -e "${GREEN}✅ Backend can reach solver${NC}"
    else
        echo -e "${RED}❌ Backend cannot reach solver${NC}"
        echo "Response: $RESPONSE"
        ((ISSUES_FOUND++))
    fi
else
    echo -e "${YELLOW}⚠️  Skipped (backend not running)${NC}"
fi

echo ""

# 3. Check Solver Health
echo "3️⃣  Checking Solver Health"
echo "=========================="

if [ $SOLVER_OK -eq 0 ]; then
    SOLVER_HEALTH=$(curl -s http://localhost:8000/health 2>/dev/null)
    
    echo "Solver Status:"
    echo "$SOLVER_HEALTH" | grep -o '"status":"[^"]*"' | sed 's/"status":"/  Status: /' | sed 's/"$//'
    echo "$SOLVER_HEALTH" | grep -o '"solver":"[^"]*"' | sed 's/"solver":"/  Solver: /' | sed 's/"$//'
    
    # Check if scheduleSolver.py is accessible
    echo ""
    echo -n "Checking if scheduleSolver.py exists... "
    if [ -f "apps/backend/src/scheduleSolver.py" ]; then
        echo -e "${GREEN}✅ Found${NC}"
    else
        echo -e "${RED}❌ Missing${NC}"
        echo "Expected location: apps/backend/src/scheduleSolver.py"
        ((ISSUES_FOUND++))
    fi
else
    echo -e "${YELLOW}⚠️  Solver not running${NC}"
fi

echo ""

# 4. Check if user has bookmarks (requires user to provide Google ID)
echo "4️⃣  Checking User Data"
echo "======================"
echo "To test with your account, enter your Google ID (or press Enter to skip):"
read -r GOOGLE_ID

if [ -n "$GOOGLE_ID" ]; then
    echo ""
    echo -n "Checking bookmarks for user... "
    
    BOOKMARKS=$(curl -s "http://localhost:3001/api/user/bookmarks?googleId=$GOOGLE_ID" 2>/dev/null)
    
    if echo "$BOOKMARKS" | grep -q '\['; then
        BOOKMARK_COUNT=$(echo "$BOOKMARKS" | grep -o '"id"' | wc -l | tr -d ' ')
        
        if [ "$BOOKMARK_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✅ Found $BOOKMARK_COUNT bookmarked courses${NC}"
        else
            echo -e "${RED}❌ No bookmarked courses${NC}"
            echo "You need to bookmark courses in Class Swiper first!"
            ((ISSUES_FOUND++))
        fi
    else
        echo -e "${RED}❌ Failed to fetch bookmarks${NC}"
        echo "Response: $BOOKMARKS"
        ((ISSUES_FOUND++))
    fi
else
    echo -e "${YELLOW}⚠️  Skipped user data check${NC}"
    echo "Note: You need bookmarked courses to generate a schedule"
fi

echo ""

# 5. Test constraint parsing
echo "5️⃣  Testing LLM Constraint Parser"
echo "==================================="
echo -n "Checking GEMINI_API_KEY... "

if grep -q "GEMINI_API_KEY" apps/backend/.env 2>/dev/null; then
    KEY_VALUE=$(grep "GEMINI_API_KEY" apps/backend/.env | cut -d'=' -f2 | tr -d ' ')
    if [ -n "$KEY_VALUE" ] && [ "$KEY_VALUE" != "your_api_key_here" ]; then
        echo -e "${GREEN}✅ Configured${NC}"
    else
        echo -e "${RED}❌ Not configured${NC}"
        echo "Set GEMINI_API_KEY in apps/backend/.env"
        ((ISSUES_FOUND++))
    fi
else
    echo -e "${RED}❌ .env file not found or key missing${NC}"
    ((ISSUES_FOUND++))
fi

echo ""

# 6. Test a simple solve request
echo "6️⃣  Testing Solver with Sample Data"
echo "====================================="

if [ $SOLVER_OK -eq 0 ]; then
    echo "Sending test solve request..."
    
    TEST_DATA='{
      "relations": [
        {
          "rid": "test_cs111_fall_a",
          "class_id": "CASCS111",
          "semester": "Fall2024",
          "days": ["Mon", "Wed", "Fri"],
          "start": 540,
          "end": 620,
          "instructor_id": "prof_a",
          "professor_rating": 4.5
        },
        {
          "rid": "test_cs112_fall_a",
          "class_id": "CASCS112",
          "semester": "Fall2024",
          "days": ["Tue", "Thu"],
          "start": 600,
          "end": 680,
          "instructor_id": "prof_b",
          "professor_rating": 4.2
        }
      ],
      "conflicts": [],
      "groups": {},
      "hubs": {},
      "semesters": ["Fall2024"],
      "bookmarks": ["CASCS111", "CASCS112"],
      "k": 4,
      "constraints": [],
      "time_limit_sec": 5
    }'
    
    SOLVE_RESPONSE=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "$TEST_DATA" \
      http://localhost:8000/solve 2>/dev/null)
    
    if echo "$SOLVE_RESPONSE" | grep -q '"status":"OPTIMAL"' || echo "$SOLVE_RESPONSE" | grep -q '"status":"FEASIBLE"'; then
        echo -e "${GREEN}✅ Solver returned a valid schedule${NC}"
        echo "Status: $(echo "$SOLVE_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
        echo "Chosen classes: $(echo "$SOLVE_RESPONSE" | grep -o '"chosen_classes":\[[^]]*\]' | cut -d'[' -f2 | cut -d']' -f1)"
    elif echo "$SOLVE_RESPONSE" | grep -q '"status":"INFEASIBLE"'; then
        echo -e "${YELLOW}⚠️  Solver returned INFEASIBLE (but solver is working)${NC}"
        echo "This is expected for some constraint combinations"
    else
        echo -e "${RED}❌ Solver error${NC}"
        echo "Response: $SOLVE_RESPONSE"
        ((ISSUES_FOUND++))
    fi
else
    echo -e "${YELLOW}⚠️  Skipped (solver not running)${NC}"
fi

echo ""

# Summary
echo "======================================"
echo "📊 Diagnostic Summary"
echo "======================================"

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No issues found!${NC}"
    echo ""
    echo "All components are working correctly."
    echo ""
    echo "If schedule generation still fails, it may be due to:"
    echo "  1. No bookmarked courses (use Class Swiper to bookmark courses)"
    echo "  2. Infeasible constraints (try simpler preferences)"
    echo "  3. No available sections for bookmarked courses"
    echo ""
    echo "Try generating a schedule with these test preferences:"
    echo "  'I prefer morning classes'"
else
    echo -e "${RED}⚠️  Found $ISSUES_FOUND issue(s)${NC}"
    echo ""
    echo "Common solutions:"
    echo ""
    
    if [ $BACKEND_OK -ne 0 ]; then
        echo "📌 Backend not running:"
        echo "   cd apps/backend && npm run dev"
        echo ""
    fi
    
    if [ $SOLVER_OK -ne 0 ]; then
        echo "📌 Solver not running:"
        echo "   cd apps/solver"
        echo "   source ../../venv/bin/activate"
        echo "   uvicorn main:app --port 8000 --reload"
        echo ""
    fi
    
    if [ $FRONTEND_OK -ne 0 ]; then
        echo "📌 Frontend not running:"
        echo "   cd apps/frontend && npm run dev"
        echo ""
    fi
    
    echo "📌 Or use the automated startup script:"
    echo "   ./start-schedule-builder.sh"
fi

echo ""
echo "💡 For detailed logs:"
echo "   Backend:  tail -f apps/backend/logs/* (or console output)"
echo "   Solver:   tail -f logs/solver.log"
echo "   Frontend: tail -f logs/frontend.log"
echo ""


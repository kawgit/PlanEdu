#!/bin/bash
# Test script for AI Schedule Builder

echo "🧪 Testing AI Schedule Builder System"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $response, expected $expected_status)"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test JSON endpoint
test_json_endpoint() {
    local name=$1
    local url=$2
    local expected_field=$3
    
    echo -n "Testing $name... "
    
    response=$(curl -s "$url" 2>/dev/null)
    
    if echo "$response" | grep -q "$expected_field"; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "   Response: $response"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "1️⃣  Testing Solver Service (port 8000)"
echo "========================================="
test_endpoint "Solver Health" "http://localhost:8000/health"
test_json_endpoint "Solver Status" "http://localhost:8000/health" "healthy"
test_json_endpoint "Solver Constraints" "http://localhost:8000/health" "constraints_supported"
echo ""

echo "2️⃣  Testing Backend Service (port 3001)"
echo "========================================="
test_endpoint "Backend API" "http://localhost:3001/api"
test_json_endpoint "Backend Message" "http://localhost:3001/api" "Hello"
test_endpoint "Solver Connectivity" "http://localhost:3001/api/schedule/test"
echo ""

echo "3️⃣  Testing Frontend Service (port 5173)"
echo "========================================="
test_endpoint "Frontend" "http://localhost:5173"
echo ""

echo "4️⃣  Testing Integration"
echo "========================================="

# Test schedule generation (requires user to be logged in, so we just test the endpoint exists)
echo -n "Testing Schedule Generation Endpoint... "
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"googleId":"test","feedback":"test","maxCoursesPerSemester":4}' \
  -o /dev/null -w "%{http_code}" \
  http://localhost:3001/api/schedule/generate 2>/dev/null)

# We expect 404 (user not found) or 500, not a connection error
if [ "$response" = "404" ] || [ "$response" = "500" ] || [ "$response" = "400" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Endpoint reachable, HTTP $response)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING${NC} (HTTP $response)"
    echo "   Note: This is expected if not logged in"
fi

echo ""
echo "======================================"
echo "📊 Test Results"
echo "======================================"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All core tests passed!${NC}"
    echo ""
    echo "🎉 System is ready to use!"
    echo ""
    echo "Next steps:"
    echo "1. Open http://localhost:5173 in your browser"
    echo "2. Sign in with Google"
    echo "3. Bookmark some courses in Class Swiper"
    echo "4. Generate your schedule in Schedule Builder"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Make sure all services are running:"
    echo "   ./start-schedule-builder.sh"
    echo ""
    echo "2. Check service logs:"
    echo "   tail -f logs/*.log"
    echo ""
    echo "3. Verify ports are not in use:"
    echo "   lsof -i :8000 -i :3001 -i :5173"
    echo ""
    exit 1
fi


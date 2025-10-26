#!/bin/bash
# Debug actual schedule generation error

echo "🐛 Debugging Schedule Generation"
echo "================================"
echo ""

# Try to find a user with bookmarks
echo "Finding users with bookmarks..."
echo ""

# Make a test request with verbose output
echo "Testing schedule generation with verbose output..."
echo ""

curl -v -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "googleId": "test",
    "feedback": "I prefer morning classes",
    "maxCoursesPerSemester": 4
  }' \
  http://localhost:3001/api/schedule/generate 2>&1 | grep -E "(HTTP|error|Error|success|message)"

echo ""
echo ""
echo "📋 To test with YOUR account:"
echo "   1. Open browser console (F12)"
echo "   2. Run: localStorage.getItem('userGoogleId')"
echo "   3. Copy your Google ID"
echo "   4. Run this:"
echo ""
echo "   GOOGLE_ID='paste_your_id_here'"
echo "   curl -X POST -H 'Content-Type: application/json' \\"
echo "     -d '{\"googleId\":\"'\$GOOGLE_ID'\",\"feedback\":\"test\",\"maxCoursesPerSemester\":4}' \\"
echo "     http://localhost:3001/api/schedule/generate | python3 -m json.tool"
echo ""


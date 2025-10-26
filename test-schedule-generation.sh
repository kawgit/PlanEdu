#!/bin/bash
# Test schedule generation with your actual user

echo "🧪 Testing Schedule Generation"
echo "=============================="
echo ""
echo "Enter your Google ID (from localStorage):"
read GOOGLE_ID

if [ -z "$GOOGLE_ID" ]; then
    echo "❌ Google ID required"
    exit 1
fi

echo ""
echo "1️⃣  Checking your bookmarks..."
BOOKMARKS=$(curl -s "http://localhost:3001/api/user/bookmarks?googleId=$GOOGLE_ID")
BOOKMARK_COUNT=$(echo "$BOOKMARKS" | grep -o '"id"' | wc -l | tr -d ' ')

if [ "$BOOKMARK_COUNT" -eq 0 ]; then
    echo "❌ You have 0 bookmarked courses"
    echo ""
    echo "📝 Action needed:"
    echo "   1. Go to http://localhost:5173"
    echo "   2. Navigate to 'Class Swiper'"
    echo "   3. Swipe right on 5-10 courses"
    echo "   4. Then try schedule generation again"
    exit 1
fi

echo "✅ Found $BOOKMARK_COUNT bookmarked courses"
echo ""

echo "2️⃣  Testing schedule generation..."
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"googleId\": \"$GOOGLE_ID\",
    \"feedback\": \"I prefer morning classes\",
    \"maxCoursesPerSemester\": 4
  }" \
  http://localhost:3001/api/schedule/generate)

echo ""
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Schedule generated successfully!"
    echo ""
    TOTAL=$(echo "$RESPONSE" | grep -o '"totalCourses":[0-9]*' | cut -d':' -f2)
    echo "Total courses scheduled: $TOTAL"
    echo ""
    echo "Response (first 500 chars):"
    echo "$RESPONSE" | head -c 500
    echo "..."
elif echo "$RESPONSE" | grep -q '"success":false'; then
    echo "⚠️  Schedule generation returned success:false"
    echo ""
    echo "Full response:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo "❌ Schedule generation failed"
    echo ""
    echo "Error response:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
fi

echo ""


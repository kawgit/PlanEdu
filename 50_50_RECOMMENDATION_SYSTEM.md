# 🎯 50/50 Balanced Recommendation System

## Overview

The new recommendation system provides **perfect balance** between major requirements and hub fulfillment:

- **50% Major Courses** (10 courses): From your major department, personalized to your interests
- **50% Hub Courses** (10 courses): Fulfill missing hubs, also personalized to your interests

---

## 🎓 How It Works

### Pool 1: Major Courses (10 courses)

**Selection Criteria:**
1. ✅ From your major department (e.g., CS for CS majors)
2. ✅ Prerequisites met (strict checking)
3. ✅ Not already taken
4. ✅ Ranked by **pure similarity** to your interests

**Scoring:**
```python
major_score = 100% * cosine_similarity(your_embedding, course_embedding)
```

**What This Means:**
- Courses that match YOUR specific interests within your major
- High similarity = topics you're interested in (AI, systems, theory, etc.)
- Uses your embedding to understand what type of CS student you are

---

### Pool 2: Hub Courses (10 courses)

**Selection Criteria:**
1. ✅ Fulfills at least ONE missing hub requirement
2. ✅ Prerequisites met (strict checking)
3. ✅ Not already taken
4. ✅ Ranked by **similarity + hub urgency**

**Scoring:**
```python
hub_score = (
    0.6 * cosine_similarity(your_embedding, course_embedding) +  # 60% interest match
    0.4 * hub_urgency                                             # 40% urgency
)

# Hub urgency = 1 / (number of courses offering this hub)
# Rare hubs get higher priority
```

**What This Means:**
- Hub courses that ALSO match your interests
- If a hub has few course options, it gets higher priority
- Still personalized using your embedding

---

## 🧠 Vector Embedding + LLM Intelligence

### Vector Embedding Usage

Your **1536-dimensional embedding vector** represents:
- Your major and interests
- Your completed courses
- Your swipe history (likes/dislikes)

**For Major Courses:**
```
Your Vector:     [0.8, 0.2, 0.5, ..., 0.1]
CS 460 (AI):     [0.75, 0.3, 0.45, ..., 0.2]  
                      ↓
          Cosine Similarity = 0.92
                      ↓
       High match! → Recommended as major course
```

**For Hub Courses:**
```
Your Vector:     [0.8, 0.2, 0.5, ..., 0.1]
PH 105 (Physics): [0.4, 0.6, 0.2, ..., 0.5]
                      ↓
          Similarity = 0.65
          Hub Urgency = 0.8 (rare hub)
                      ↓
      Combined = 0.6*0.65 + 0.4*0.8 = 0.71
                      ↓
      Recommended! (matches you + fulfills rare hub)
```

### LLM (Gemini) Usage

**Two-Layer Prerequisite Filtering:**

1. **Rule-Based Layer** (Fast):
   - Explicit prereqs in description
   - Course number sequences (CS 112 → CS 210)
   - Department-level requirements

2. **LLM Layer** (Intelligent):
   - Analyzes course descriptions
   - Detects equivalent courses
   - Conservative blocking (when in doubt, block)
   - Temperature = 0.1 for consistent decisions

**Example LLM Analysis:**
```
Course: CS 330 (Algorithms)
Description: "Prerequisite: CS 112 (Data Structures)"
Your Courses: CS 111, MA 123

LLM Decision:
{
  "can_take": false,
  "reason": "Requires CS 112 which is not completed"
}
→ BLOCKED from recommendations
```

---

## 📊 Example Output

### For a CS Major needing 7 hubs:

```bash
Computing 50/50 recommendations for user 1...
  ✓ User embedding loaded (1536 dimensions)
  ✓ User major: Computer Science
  ✓ Excluding 15 completed + 3 bookmarked
  ✓ User needs 7 hub requirements
  ✓ Found 247 candidate courses
  → Checking prerequisites for 247 courses...
  ✓ Prerequisite check: 189 eligible, 58 blocked
  → Splitting into major and hub pools...
  ✓ Found 45 eligible major courses
  ✓ Found 67 hub-fulfilling courses
  
  ✓ Returning 20 recommendations:
     - 10 major courses (50%)
     - 10 hub courses (50%)
     - 12 departments
     - 4 schools
     - Top major course: CASCS 460 (score=0.921)
     - Top hub course: CASPH 105 (score=0.712, hubs=2)
```

### Major Courses (10):
1. CS 460 (AI) - score: 0.921 (highly aligned with your AI interests)
2. CS 411 (Systems) - score: 0.885
3. CS 350 (Theory) - score: 0.867
4. CS 440 (Networks) - score: 0.853
5. CS 330 (Algorithms) - score: 0.841
6. CS 320 (Programming Languages) - score: 0.829
7. CS 455 (Security) - score: 0.817
8. CS 425 (Databases) - score: 0.805
9. CS 412 (Compilers) - score: 0.793
10. CS 365 (HCI) - score: 0.781

### Hub Courses (10):
1. PH 105 (Physics) - score: 0.712, fulfills: Physical World
2. EN 210 (Literature) - score: 0.689, fulfills: Aesthetic Exploration
3. PS 101 (Psychology) - score: 0.672, fulfills: Social Inquiry
4. EC 101 (Economics) - score: 0.658, fulfills: Social Inquiry  
5. WR 150 (Writing) - score: 0.645, fulfills: Writing
6. HI 105 (History) - score: 0.632, fulfills: Historical Consciousness
7. PO 111 (Politics) - score: 0.619, fulfills: Civic Engagement
8. AN 102 (Anthropology) - score: 0.607, fulfills: Social Inquiry
9. SO 100 (Sociology) - score: 0.594, fulfills: Global Citizenship
10. MU 101 (Music) - score: 0.581, fulfills: Aesthetic Exploration

---

## 🔧 Configuration

### Adjust the Split

In `apps/scripts/recommend_courses.py`:

```python
# Current: 50/50 split
MAJOR_COURSES_COUNT = 10  # 50% major
HUB_COURSES_COUNT = 10    # 50% hub

# Want more major courses? (60/40)
MAJOR_COURSES_COUNT = 12  # 60% major
HUB_COURSES_COUNT = 8     # 40% hub

# Want more hub courses? (40/60)
MAJOR_COURSES_COUNT = 8   # 40% major
HUB_COURSES_COUNT = 12    # 60% hub
```

### Adjust Hub Scoring

```python
# Current: 60% interest, 40% urgency
HUB_SIMILARITY_WEIGHT = 0.6
HUB_URGENCY_WEIGHT = 0.4

# Prioritize interest over urgency (80/20)
HUB_SIMILARITY_WEIGHT = 0.8
HUB_URGENCY_WEIGHT = 0.2

# Prioritize urgency over interest (30/70)
HUB_SIMILARITY_WEIGHT = 0.3
HUB_URGENCY_WEIGHT = 0.7
```

---

## 🎯 Key Improvements Over Old System

### Before (Problems):
| Issue | Example |
|-------|---------|
| Too many CS courses | 15 CS + 5 random → overwhelming |
| Not enough hub coverage | Ignoring hub requirements |
| No balance | Either all major or all hubs |
| Low diversity | Same type of courses |

### After (Solutions):
| Solution | Result |
|----------|--------|
| Perfect 50/50 split | 10 CS + 10 hub → balanced |
| Guaranteed hub coverage | All 10 hub courses fulfill missing hubs |
| Predictable structure | Always 50/50 |
| Interest-aligned hubs | Hub courses match your style |

---

## 🧪 Testing

### Test the System

```bash
# With user embedding
echo '{"userId": YOUR_USER_ID}' | python3 apps/scripts/recommend_courses.py 2>&1

# Expected output:
# ✓ Found 45 eligible major courses
# ✓ Found 67 hub-fulfilling courses
# ✓ Returning 20 recommendations:
#    - 10 major courses (50%)
#    - 10 hub courses (50%)
```

### Via API

```bash
curl "http://localhost:3001/api/recommendations?googleId=YOUR_GOOGLE_ID&limit=20"
```

**Expected JSON:**
```json
{
  "recommendations": [
    {
      "id": 123,
      "code": "CASCS 460",
      "title": "Artificial Intelligence",
      "category": "major",
      "final_score": 0.921,
      "similarity": 0.921
    },
    {
      "id": 456,
      "code": "CASPH 105",
      "title": "General Physics",
      "category": "hub",
      "final_score": 0.712,
      "similarity": 0.650,
      "hub_urgency": 0.800,
      "fulfills_hubs": [3, 7]
    },
    // ... 18 more courses
  ]
}
```

---

## 💡 Smart Features

### 1. Hub Urgency

Courses that fulfill rare hubs get priority:

```python
# Hub with many options (30 courses offer it)
urgency = 1 / 30 = 0.033

# Hub with few options (5 courses offer it)
urgency = 1 / 5 = 0.200   ← Higher priority!
```

This ensures you can complete hard-to-find hubs before they fill up.

### 2. Interest Alignment for Hubs

Instead of random hub courses, you get hub courses that match your style:

**Example: CS major interested in logic/theory**
- Gets Philosophy (logic-heavy)
- Gets Physics (mathematical)
- NOT random humanities courses

**Example: CS major interested in design/UX**
- Gets Art/Design courses
- Gets Psychology (HCI-related)
- NOT math-heavy science courses

### 3. Automatic Backfill

If one pool is short (e.g., only 8 major courses eligible), the system:
1. Fills with those 8 major courses
2. Adds 2 more hub courses to reach 20 total
3. Maintains balance as much as possible

---

## 🚀 Usage in Your App

The system is automatically integrated. When users swipe:

```typescript
// Frontend
GET /api/recommendations?googleId=USER_ID

// Backend automatically:
// 1. Gets user embedding
// 2. Filters by prerequisites (2-layer)
// 3. Splits into major/hub pools
// 4. Returns 10+10 balanced recommendations
```

### User Flow:

1. User loads swiper
2. System shows 10 major + 10 hub courses
3. User swipes (updates embedding)
4. Next load shows new 10+10 mix
5. Cycle repeats until requirements met

---

## 📈 Expected Results

### For CS Majors:

- **10 CS courses**: Specific to your interests (AI, systems, theory, etc.)
- **10 hub courses**: Fulfill requirements, aligned with your learning style
- **Balanced progression**: Major requirements + hub requirements in parallel
- **No prerequisite errors**: All courses are eligible

### For Other Majors:

Same 50/50 split applies:
- Math major: 10 MA courses + 10 hubs
- Business major: 10 BU courses + 10 hubs
- Biology major: 10 BI courses + 10 hubs

---

## 🔍 Debugging

### "Not enough major courses"

```bash
# Check how many major courses are eligible
python3 -c "
import apps/scripts/recommend_courses as r
# ... check major_pool size
"
```

**Possible causes:**
- Prerequisites too strict → many CS courses blocked
- Already completed most major courses
- Major not correctly set in database

**Solutions:**
- Adjust prerequisite checking
- Lower MAJOR_COURSES_COUNT to 8
- Backfill will add more hub courses

### "Not enough hub courses"

**Possible causes:**
- Already completed most hubs
- Not many courses fulfill remaining hubs
- Prerequisites blocking hub courses

**Solutions:**
- System will backfill from major pool
- Check which hubs are remaining
- May need to manually add hub course data

---

## ✅ Summary

### What You Get:

✅ **50% major courses** - from your department, matching your interests  
✅ **50% hub courses** - fulfill requirements, personalized to you  
✅ **Vector embedding** - understands what type of student you are  
✅ **LLM prerequisite checking** - no courses you can't take  
✅ **Hub urgency** - prioritizes rare hubs  
✅ **Interest alignment** - all courses match your style  

### Configuration:

```python
# In recommend_courses.py
MAJOR_COURSES_COUNT = 10      # Adjust split
HUB_COURSES_COUNT = 10        # Adjust split
HUB_SIMILARITY_WEIGHT = 0.6   # Interest vs urgency
HUB_URGENCY_WEIGHT = 0.4      # Interest vs urgency
```

### Result:

**Balanced, personalized, prerequisite-checked recommendations that help you progress toward graduation!** 🎓

---

**Status**: ✅ Active and Running  
**Last Updated**: October 26, 2025


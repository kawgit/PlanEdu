# 🚀 Improved Recommendation System

## Overview

Major improvements to both **prerequisite checking** and **major course representation** to ensure:
1. ✅ **Stricter prerequisite enforcement** - no more courses you can't take
2. ✅ **More CS electives for CS majors** - at least 12 major-related courses guaranteed

---

## 🔐 1. Enhanced Prerequisite Checking

### Two-Layer System

#### Layer 1: Rule-Based Checks (Fast)
Catches common patterns instantly:

- ✅ **Explicit prerequisites** in description: "Prerequisite: CS 112"
- ✅ **Course sequences**: CS 200+ requires CS 111/112
- ✅ **CS 300+ requires 200-level** courses
- ✅ **Math courses require calculus** background
- ✅ **Instructor consent** courses blocked

#### Layer 2: Gemini LLM (Intelligent)
Handles complex cases:

- ✅ **Conservative by default** - blocks when uncertain
- ✅ **Temperature = 0.1** for consistent, strict decisions
- ✅ **Advanced courses (300+) require foundation**
- ✅ **Equivalent course detection** (CS 237 = MA 581)
- ✅ **Beginner-friendly** - only intro courses for new students

### Example Rule-Based Checks

```python
# CS 210 (200-level) requires CS 111 or CS 112
if course_num >= 200 and not (has_cs111 or has_cs112):
    return (False, "CS 210 typically requires CS 111 or CS 112")

# CS 330 (300-level) requires 200-level CS courses
if course_num >= 300:
    if not has_200_level:
        return (False, "CS 330 (300-level) requires 200-level CS")
```

### Strict LLM Prompt

```
BE CONSERVATIVE: If you're not sure prerequisites are met, say can_take: false.

CRITICAL RULES:
1. If description mentions ANY prerequisite, it MUST be completed
2. 200+ level needs 100-level foundation
3. 300+ level needs 200-level foundation
4. No completed courses = only 100-level introductory courses
5. When uncertain, respond with can_take: false
```

### Error Handling

On API failure:
- ❌ **Block advanced courses (300+)** - too risky
- ✅ **Allow intro courses (100-level)** - safe
- ❌ **Default: block** - conservative approach

---

## 🎓 2. Major Course Prioritization

### Increased Major Bonus

**Old**: 15% boost for major courses
**New**: 35% boost for major courses

```python
MAJOR_BONUS = 0.35  # 35% boost
MIN_MAJOR_COURSES = 12  # Guarantee at least 12 major courses
```

### No Diversity Penalty for Major Courses

CS majors get **unlimited CS courses** without diversity penalty:

```python
def compute_department_diversity_score(
    selected_courses,
    candidate_dept,
    is_major_dept=False
):
    # If this is the user's major department, don't penalize it
    if is_major_dept:
        return 1.0  # Neutral - no penalty
    
    # Otherwise, penalize over-represented departments
    ...
```

### Minimum Major Course Guarantee

After MMR re-ranking, system **ensures** at least 12 major courses:

```python
if len(major_courses) < MIN_MAJOR_COURSES:
    # Replace worst non-major courses with best major courses
    replacements = MIN_MAJOR_COURSES - len(major_courses)
    # ... swap logic ...
```

### Adjusted Weights

```python
SIMILARITY_WEIGHT = 0.7    # Balance similarity with other factors
HUB_COVERAGE_WEIGHT = 0.2  # NEW hubs only
DIVERSITY_WEIGHT = 0.05    # Minimal (not applied to major)
MAJOR_BONUS = 0.35         # Strong 35% boost
```

**Effective Score Formula**:
```
base_score = (0.7 * similarity) + (0.2 * hub_coverage) + (0.35 * major_bonus)
```

For a CS major viewing a CS course:
- High similarity (0.9): 0.7 × 0.9 = 0.63
- Some hub coverage (0.5): 0.2 × 0.5 = 0.10
- Major bonus: 0.35 × 1.0 = 0.35
- **Total: 1.08** 🔥

For a non-major course:
- High similarity (0.9): 0.7 × 0.9 = 0.63
- High hub coverage (1.0): 0.2 × 1.0 = 0.20
- No major bonus: 0.35 × 0 = 0.00
- **Total: 0.83**

Major courses get a **30% advantage**!

---

## 📊 3. Logging & Debugging

### Detailed Prerequisite Logs

```
→ Checking prerequisites for 247 courses...
  ✗ CASCS210: CS 210 typically requires CS 111 or CS 112 [RULE]
  ✗ CASCS330: Requires CS 112 (data structures) [LLM]
  ✗ CASCS411: 300-level course requires 200-level foundation [LLM]
  ✗ CASMA442: Already completed equivalent course MA 242 [RULE]
  ... and 54 more
✓ Prerequisite check: 189 eligible, 58 blocked
```

### Major Course Stats

```
✓ Returning 20 recommendations:
   - 14 major-related courses
   - 8 departments
   - 3 schools
```

---

## 🎯 4. How It Works End-to-End

### For a CS Major (completed CS 111, CS 112, MA 123)

1. **Fetch all candidate courses** (not completed/bookmarked)
2. **Rule-based filter**:
   - ✅ CS 210 (needs CS 112) → **PASS**
   - ❌ CS 330 (needs 200-level) → **BLOCKED**
   - ❌ CS 460 (400-level) → **BLOCKED**
3. **LLM filter** (Gemini double-checks remaining):
   - ✅ CS 210 → **PASS** (has CS 112)
   - ❌ CS 320 → **BLOCKED** (needs CS 210)
4. **Scoring**:
   - CS 210: sim=0.85, hub=0.3, major=1.0 → **1.145**
   - PH 105: sim=0.50, hub=1.0, major=0.0 → **0.550**
5. **MMR Re-ranking** (with diversity):
   - CS courses NOT penalized (major dept)
   - Other depts get diversity bonus
6. **Minimum Major Guarantee**:
   - Count major courses: 11 found
   - Need 12 minimum → add 1 more CS course
   - Replace worst non-CS with best CS
7. **Final Result**:
   - 12+ CS courses
   - 4-6 other courses for hubs/variety
   - **All courses are eligible to take!**

---

## 🚀 5. Testing

### Test with User ID

```bash
echo '{"userId": 1}' | python3 apps/scripts/recommend_courses.py 2>&1
```

Expected output:
```
Computing recommendations for user 1...
  ✓ User embedding loaded (1536 dimensions)
  ✓ User major: Computer Science
  ✓ Excluding 15 completed + 3 bookmarked classes
  ✓ User needs 7 hub requirements
  ✓ Found 247 candidate courses
  → Checking prerequisites for 247 courses...
    ✗ CASCS330: CS 330 (300-level) requires 200-level CS courses [RULE]
    ✗ CASMA442: Already completed equivalent MA 242 [RULE]
    ... and 56 more
  ✓ Prerequisite check: 189 eligible, 58 blocked
  ✓ Top course: CASCS 210 (sim=0.842, hub=0.200, major=1.0)
  ✓ Returning 20 recommendations:
     - 14 major-related courses
     - 7 departments
     - 3 schools
```

### Via Backend API

```bash
curl "http://localhost:3001/api/recommendations?googleId=YOUR_GOOGLE_ID&limit=20"
```

---

## 📈 6. Before vs After

### Before (Problems)
- ❌ Recommended CS 330 without CS 210
- ❌ Only 6-8 CS courses for CS majors
- ❌ Too much diversity penalty on CS dept
- ❌ Equivalent courses (MA 442 = MA 242) appeared

### After (Solutions)
- ✅ **Two-layer prerequisite checking**
- ✅ **12+ CS courses guaranteed**
- ✅ **No diversity penalty on major dept**
- ✅ **Rule-based + LLM catches equivalents**
- ✅ **35% major bonus** (vs 15% before)
- ✅ **Conservative on errors** (block if unsure)

---

## 🔧 7. Configuration

### Tuning Parameters

In `apps/scripts/recommend_courses.py`:

```python
# Adjust these if needed
MIN_MAJOR_COURSES = 12      # Min major courses (out of 20)
MAJOR_BONUS = 0.35          # Major course boost (0-1)
SIMILARITY_WEIGHT = 0.7     # User interest weight
HUB_COVERAGE_WEIGHT = 0.2   # New hub weight
DIVERSITY_WEIGHT = 0.05     # Dept variety weight
```

### Strict vs Lenient

To make prerequisite checking **more lenient**:
1. Lower Gemini temperature: `0.1 → 0.3`
2. Change default on error: `False → True`
3. Remove rule-based layer (keep LLM only)

To make **more strict**:
1. Increase temperature: stays at `0.1`
2. Add more rule-based patterns
3. Increase `MIN_MAJOR_COURSES` if too much variety

---

## ✅ Summary

### Key Improvements

1. **Prerequisite Checking**:
   - Two-layer system (rule-based + LLM)
   - Conservative defaults (block when unsure)
   - Temperature=0.1 for consistency
   - Handles equivalents and sequences

2. **Major Representation**:
   - 35% major bonus (up from 15%)
   - No diversity penalty on major dept
   - Guaranteed minimum 12 major courses
   - Automatic replacement of low-scoring non-major

3. **User Experience**:
   - CS majors see mostly CS electives
   - Still get 6-8 courses for hubs/variety
   - No courses with unmet prerequisites
   - Better logging for debugging

### Expected Results

For **CS Major**:
- 12-15 CS courses
- 5-8 other courses (hubs, variety)
- All courses have prerequisites met
- High similarity to interests

For **Non-CS Major**:
- Most courses in their major
- Mix of hub fulfillment courses
- Some high-similarity electives
- All prerequisites satisfied

---

**Status**: ✅ Active and Ready
**Last Updated**: October 26, 2025


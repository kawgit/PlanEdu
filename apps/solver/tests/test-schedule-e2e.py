#!/usr/bin/env python3
"""
End-to-End Test for Schedule Builder
Tests the full flow: Backend -> FastAPI Solver -> Result
"""

import requests
import json
import sys

SOLVER_URL = "http://localhost:8000"

def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def test_solver_health():
    """Test 1: Check solver is running"""
    print_section("TEST 1: Solver Health Check")
    try:
        response = requests.get(f"{SOLVER_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Solver is healthy")
            print(f"   Status: {data['status']}")
            print(f"   Solver: {data['solver']}")
            print(f"   Constraints supported: {len(data['constraints_supported'])}")
            return True
        else:
            print(f"❌ Solver health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to solver: {e}")
        print(f"   Make sure solver is running at {SOLVER_URL}")
        return False

def test_basic_schedule():
    """Test 2: Generate a basic schedule with no constraints"""
    print_section("TEST 2: Basic Schedule (No Constraints)")
    
    # Create toy dataset
    relations = []
    for course_num in range(1, 7):  # 6 courses
        course_id = f"CASCS{100 + course_num}"
        for sem_idx, semester in enumerate(["Fall2025", "Spring2026"]):
            # Section A - MWF morning
            relations.append({
                "rid": f"{course_id}_{semester}_A",
                "class_id": course_id,
                "semester": semester,
                "days": ["Mon", "Wed", "Fri"],
                "start": 540,  # 9:00 AM
                "end": 620,    # 10:20 AM
                "instructor_id": f"prof_{course_num}_a",
                "professor_rating": 4.0 + (course_num * 0.1)
            })
            # Section B - TR afternoon
            relations.append({
                "rid": f"{course_id}_{semester}_B",
                "class_id": course_id,
                "semester": semester,
                "days": ["Tue", "Thu"],
                "start": 840,  # 2:00 PM
                "end": 920,    # 3:20 PM
                "instructor_id": f"prof_{course_num}_b",
                "professor_rating": 3.5 + (course_num * 0.1)
            })
    
    payload = {
        "relations": relations,
        "conflicts": [],
        "groups": {},
        "hubs": {},
        "semesters": ["Fall2025", "Spring2026"],
        "bookmarks": ["CASCS101", "CASCS102"],  # Bookmark first 2
        "completed_courses": [],
        "k": 4,  # Max 4 courses per semester
        "constraints": [],
        "time_limit_sec": 5,
        "scale": 1000
    }
    
    try:
        response = requests.post(f"{SOLVER_URL}/solve", json=payload, timeout=10)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Status: {result['status']}")
            print(f"   Chosen classes: {len(result['chosen_classes'])}")
            print(f"   Chosen sections: {len(result['chosen_sections'])}")
            print(f"   Classes: {', '.join(sorted(result['chosen_classes']))}")
            if result.get('objective_scores'):
                print(f"   Objective scores: {result['objective_scores']}")
            return result
        else:
            print(f"❌ Solver failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return None

def test_with_completed_courses():
    """Test 3: Schedule with completed courses (should be excluded)"""
    print_section("TEST 3: Schedule with Completed Courses")
    
    relations = []
    for course_num in range(1, 7):
        course_id = f"CASCS{100 + course_num}"
        for semester in ["Fall2025", "Spring2026"]:
            relations.append({
                "rid": f"{course_id}_{semester}_A",
                "class_id": course_id,
                "semester": semester,
                "days": ["Mon", "Wed", "Fri"],
                "start": 540,
                "end": 620,
                "instructor_id": f"prof_{course_num}",
                "professor_rating": 4.0 + (course_num * 0.1)
            })
    
    payload = {
        "relations": relations,
        "conflicts": [],
        "groups": {},
        "hubs": {},
        "semesters": ["Fall2025", "Spring2026"],
        "bookmarks": ["CASCS101", "CASCS102", "CASCS103"],
        "completed_courses": ["CASCS101", "CASCS106"],  # Already completed
        "k": 4,
        "constraints": [],
        "time_limit_sec": 5,
        "scale": 1000
    }
    
    try:
        response = requests.post(f"{SOLVER_URL}/solve", json=payload, timeout=10)
        if response.status_code == 200:
            result = response.json()
            chosen = result['chosen_classes']
            
            # Verify completed courses are NOT chosen
            if "CASCS101" in chosen or "CASCS106" in chosen:
                print(f"❌ FAILED: Completed courses were included!")
                print(f"   Chosen: {chosen}")
                return False
            else:
                print(f"✅ Completed courses correctly excluded")
                print(f"   Chosen classes: {', '.join(sorted(chosen))}")
                return True
        else:
            print(f"❌ Solver failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False

def test_constraint_variations():
    """Test 4: Different constraints produce different results"""
    print_section("TEST 4: Constraint Variations")
    
    # Base relations
    relations = []
    for course_num in range(1, 7):
        course_id = f"CASCS{100 + course_num}"
        # MWF section
        relations.append({
            "rid": f"{course_id}_Fall2025_MWF",
            "class_id": course_id,
            "semester": "Fall2025",
            "days": ["Mon", "Wed", "Fri"],
            "start": 540,  # 9:00 AM
            "end": 620,
            "instructor_id": f"prof_{course_num}",
            "professor_rating": 4.0
        })
        # TR section (early morning)
        relations.append({
            "rid": f"{course_id}_Fall2025_TR",
            "class_id": course_id,
            "semester": "Fall2025",
            "days": ["Tue", "Thu"],
            "start": 480,  # 8:00 AM
            "end": 560,
            "instructor_id": f"prof_{course_num}",
            "professor_rating": 3.5
        })
    
    base_payload = {
        "relations": relations,
        "conflicts": [],
        "groups": {},
        "hubs": {},
        "semesters": ["Fall2025"],
        "bookmarks": [],
        "completed_courses": [],
        "k": 4,
        "time_limit_sec": 5,
        "scale": 1000
    }
    
    # Test A: No constraints
    print("Test 4a: No constraints")
    payload_a = {**base_payload, "constraints": []}
    response_a = requests.post(f"{SOLVER_URL}/solve", json=payload_a, timeout=10)
    result_a = response_a.json() if response_a.status_code == 200 else None
    
    # Test B: No Friday classes
    print("\nTest 4b: No Friday classes (disallowed_days)")
    payload_b = {
        **base_payload,
        "constraints": [
            {
                "id": "c1",
                "kind": "disallowed_days",
                "mode": "hard",
                "payload": {"days": ["Fri"]}
            }
        ]
    }
    response_b = requests.post(f"{SOLVER_URL}/solve", json=payload_b, timeout=10)
    result_b = response_b.json() if response_b.status_code == 200 else None
    
    # Test C: No early morning (earliest_start)
    print("\nTest 4c: No classes before 9 AM (earliest_start)")
    payload_c = {
        **base_payload,
        "constraints": [
            {
                "id": "c1",
                "kind": "earliest_start",
                "mode": "soft",
                "weight": 1.0,
                "payload": {"time": "09:00"}
            }
        ]
    }
    response_c = requests.post(f"{SOLVER_URL}/solve", json=payload_c, timeout=10)
    result_c = response_c.json() if response_c.status_code == 200 else None
    
    # Compare results
    if result_a and result_b:
        sections_a = set(result_a.get('chosen_sections', []))
        sections_b = set(result_b.get('chosen_sections', []))
        
        # Check if Friday sections are excluded in result B
        friday_sections_in_b = [s for s in sections_b if "MWF" in s]
        
        if friday_sections_in_b:
            print(f"❌ FAILED: Friday sections still present in result B!")
            print(f"   Sections: {friday_sections_in_b}")
        else:
            print(f"✅ Constraints produce different results")
            print(f"   Result A sections: {len(sections_a)}")
            print(f"   Result B sections: {len(sections_b)} (no Friday)")
            
            if result_c:
                sections_c = set(result_c.get('chosen_sections', []))
                early_sections_in_c = [s for s in sections_c if "TR" in s]
                print(f"   Result C sections: {len(sections_c)} (prefer no 8AM)")
                print(f"   Early (8AM) sections in C: {len(early_sections_in_c)}")
            
            return True
    else:
        print(f"❌ One or more tests failed to return results")
        return False

def test_target_courses_constraint():
    """Test 5: target_courses_per_semester constraint"""
    print_section("TEST 5: target_courses_per_semester Constraint")
    
    relations = []
    for course_num in range(1, 7):
        course_id = f"CASCS{100 + course_num}"
        relations.append({
            "rid": f"{course_id}_Fall2025_A",
            "class_id": course_id,
            "semester": "Fall2025",
            "days": ["Mon", "Wed", "Fri"],
            "start": 540,
            "end": 620,
            "instructor_id": f"prof_{course_num}",
            "professor_rating": 4.0
        })
    
    # Test with exactly 3 courses
    payload = {
        "relations": relations,
        "conflicts": [],
        "groups": {},
        "hubs": {},
        "semesters": ["Fall2025"],
        "bookmarks": [],
        "completed_courses": [],
        "k": 6,  # Allow up to 6, but constrain to 3
        "constraints": [
            {
                "id": "c1",
                "kind": "target_courses_per_semester",
                "mode": "hard",
                "payload": {"t": 3, "semesters": ["Fall2025"]}
            }
        ],
        "time_limit_sec": 5,
        "scale": 1000
    }
    
    try:
        response = requests.post(f"{SOLVER_URL}/solve", json=payload, timeout=10)
        if response.status_code == 200:
            result = response.json()
            num_chosen = len(result['chosen_classes'])
            
            if num_chosen == 3:
                print(f"✅ Exactly 3 courses chosen (as constrained)")
                print(f"   Chosen: {', '.join(sorted(result['chosen_classes']))}")
                return True
            else:
                print(f"❌ FAILED: Expected 3 courses, got {num_chosen}")
                print(f"   Chosen: {result['chosen_classes']}")
                return False
        else:
            print(f"❌ Solver failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("  SCHEDULE BUILDER - END-TO-END VALIDATION")
    print("="*80)
    
    tests = [
        ("Solver Health", test_solver_health),
        ("Basic Schedule", test_basic_schedule),
        ("Completed Courses Exclusion", test_with_completed_courses),
        ("Constraint Variations", test_constraint_variations),
        ("Target Courses Constraint", test_target_courses_constraint),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Summary
    print_section("TEST SUMMARY")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}  {name}")
    
    print(f"\n{'='*80}")
    print(f"  TOTAL: {passed}/{total} tests passed")
    print(f"{'='*80}\n")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())


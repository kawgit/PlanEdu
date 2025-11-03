from solver import ScheduleSolver
from utils import load_graduation_constraints, load_courses_and_slots, load_groups, load_prerequisite_constraints

num_future_semesters = 8
num_courses_per_semester = 4

bookmarked_ids = {
    "CAS CS 523",
    "CAS CS 565",
    "CAS CS 505",
    "CAS CS 542",
    "CAS CS 541",
}

completed_ids = {
    "CAS CS 101",
    "CAS CS 111",
    "CAS EC 101",
    "CAS EC 102",
    "CAS LS 212",
    "CAS MA 115",
    "CAS MA 123",
    "CAS MA 124",
    "CAS PO 151",
    "CAS PY 211",
    "CAS PY 212",
}

courses, slots = load_courses_and_slots()

for course_id, course in courses.items():
    if course_id in bookmarked_ids:
        course["score"] += 1000

for course_id in completed_ids:
    assert course_id in courses, f"Course {course_id} not found in courses"

groups = load_groups()
prerequisite_constraints = load_prerequisite_constraints()
graduation_constraints = load_graduation_constraints()

print(f"Loaded {len(courses)} courses, {len(slots)} slots, {len(bookmarked_ids)} bookmarked courses, and {len(completed_ids)} completed courses.")

print("Initializing solver...")
solver = ScheduleSolver(courses, slots, groups, prerequisite_constraints, graduation_constraints, completed_ids, num_future_semesters, num_courses_per_semester)

print("Solving...")
solver.solve(time_limit=5, verbosity="detailed")

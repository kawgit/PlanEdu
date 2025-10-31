from schedule_solver import ScheduleSolver
from utils import load_courses_and_slots

# Settings

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
    "CAS MA 115",
    "CAS PO 151",
    "CAS PY 212",
    "CAS PY 211",
    "CAS CS 237",
    "CAS CS 330",
    "CAS EC 201",
    "CAS MA 231",
    "CAS CS 101",
    "CAS CS 111",
    "CAS EC 102",
    "CAS EC 101",
    "CAS LS 212",
    "CAS MA 123",
    "CAS MA 124",
}

# Rest of script

courses, slots = load_courses_and_slots()

for course_id, course in courses.items():
    if course_id in bookmarked_ids:
        course["score"] += 1000

print(f"Loaded {len(courses)} courses, {len(slots)} slots, {len(bookmarked_ids)} bookmarked courses, and {len(completed_ids)} completed courses.")

print("Initializing solver...")
solver = ScheduleSolver(courses, slots, completed_ids, num_future_semesters, num_courses_per_semester)

print("Solving...")
solver.solve(time_limit=1, verbosity="detailed")

from schedule_solver import ScheduleSolver
from utils import extract_course_number, load_courses_and_slots

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

courses, slots = load_courses_and_slots()

for course_id, course in courses.items():
    if course_id in bookmarked_ids:
        course["score"] += 1000

groups = {
    "BS CS A": {
        "CAS CS 111",
        "CAS CS 112",
        "CAS CS 131",
        "CAS CS 210",
        "CAS CS 330",
    },
    "BS CS B": {
        "CAS CS 132",
        "CAS CS 235",
        "CAS CS 237",
    },
    "BS CS C": {
        "CAS CS 320",
        "CAS CS 332",
        "CAS CS 350",
        "CAS CS 351",
    },
}

def belongs_to_group_d(course):
    return course["school"] == "CAS" and course["department"] == "CS" and 300 <= extract_course_number(course["id"]) <= 599 and course["id"] not in groups["BS CS A"] and course["id"] not in groups["BS CS B"] and course["id"] not in groups["BS CS C"]

groups["BS CS D"] = {course["id"] for course in courses.values() if belongs_to_group_d(course)}

groups["BS CS A-D"] = set(groups["BS CS A"] | groups["BS CS B"] | groups["BS CS C"] | groups["BS CS D"])

graduation_constraints = {
    "all_from_group_a": {
        "group_id": "BS CS A",
        "count": len(groups["BS CS A"]),
    },
    "at_least_2_from_group_b": {
        "group_id": "BS CS B",
        "count": 2,
    },
    "at_least_2_from_group_c": {
        "group_id": "BS CS C",
        "count": 2,
    },
    "at_least_15_from_all_groups": {
        "group_id": "BS CS A-D",
        "count": 15
    }
}

print(f"Loaded {len(courses)} courses, {len(slots)} slots, {len(bookmarked_ids)} bookmarked courses, and {len(completed_ids)} completed courses.")

print("Initializing solver...")
solver = ScheduleSolver(courses, slots, groups, graduation_constraints, completed_ids, num_future_semesters, num_courses_per_semester)

print("Solving...")
solver.solve(time_limit=3, verbosity="detailed")

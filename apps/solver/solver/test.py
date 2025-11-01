from schedule_solver import ScheduleSolver
from utils import extract_course_number, load_courses_and_slots, load_hubs

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

groups.update(load_hubs())

graduation_constraint = {
    "id": "graduation",
    "type": "and",
    "children": [
        {
            "id": "all from group A",
            "type": "group",
            "group_id": "BS CS A",
            "count": len(groups["BS CS A"]),
        },
        {
            "id": "at least 2 from group B",
            "type": "group",
            "group_id": "BS CS B",
            "count": 2,
        },
        {
            "id": "at least 2 from group C",
            "type": "group",
            "group_id": "BS CS C",
            "count": 2,
        },
        {
            "id": "at least 15 from all groups",
            "type": "group",
            "group_id": "BS CS A-D",
            "count": 15
        },
        {
            "id": "Hub: Philosophical, Aesthetic, and Historical Interpretation",
            "type": "group",
            "group_id": "load_hubs",
            "count": 1,
        },
    ]
}

prerequisite_constraints = {
    "CAS CS 532": {
        "type": "or",
        "children": [
            "pre CAS CS 541",
            "pre CAS CS 542"
        ]
    },
    "CAS CS 565": {
        "pre junior standing"
    },
    "CAS CS 505": {
        "pre CAS CS 365"
    },
    "CAS CS 542": {
        "pre CAS CS 365"
    },
    "CAS CS 541": {
        "type": "and",
        "children": [
            "pre CAS CS 111",
            {
                "type": "or",
                "children": [
                    "pre CAS CS 132",
                    "pre CAS MA 242",
                    "pre CAS EK 103"
                ]
            },
            {
                "type": "or",
                "children": [
                    "pre CAS CS 237",
                    "pre CAS MA 581",
                    "pre CAS EK 381"
                ]
            }
        ]
    },
}


print(f"Loaded {len(courses)} courses, {len(slots)} slots, {len(bookmarked_ids)} bookmarked courses, and {len(completed_ids)} completed courses.")

print("Initializing solver...")
solver = ScheduleSolver(courses, slots, groups, graduation_constraints, prerequisite_constraints, completed_ids, num_future_semesters, num_courses_per_semester)

print("Solving...")
solver.solve(time_limit=3, verbosity="detailed")

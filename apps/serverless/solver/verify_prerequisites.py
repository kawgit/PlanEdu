from solver import Constraint
from utils import load_courses_and_slots, load_groups, load_prerequisite_constraints

attributes = []
courses, slots = load_courses_and_slots()
groups = load_groups()
prerequisite_constraints = load_prerequisite_constraints()

course_misses = set()
group_misses = set()
attribute_misses = set()

def verify(constraint_id: str, constraint: Constraint):
    
    try:
        match constraint["type"]:
            case "when":
                assert type(constraint["offset"]) == int
                verify(constraint_id, constraint["child"])
            case "and":
                for child in constraint["children"]:
                    verify(constraint_id, child)
            case "or":
                for child in constraint["children"]:
                    verify(constraint_id, child)
            case "not":
                verify(constraint_id, constraint["child"])
            case "range":
                assert type(constraint["school"]) == str
                assert type(constraint["department"]) == str
                assert type(constraint["min_number"]) == int
                assert type(constraint["max_number"]) == int
            case "group":
                assert type(constraint["group_id"]) == str
                assert type(constraint["count"]) == int
                if constraint["group_id"] not in groups:
                    group_misses.add(constraint["group_id"])
            case "course":
                if constraint["course_id"] not in courses:
                    course_misses.add(constraint["course_id"])
            case "attribute":
                assert "value" in constraint
                if constraint["key"] not in attributes:
                    attribute_misses.add(constraint["key"])
        
    except Exception as error:
        print(f"Error verifying constraint {constraint_id}: {error}")
    
for constraint_id, constraint in prerequisite_constraints.items():
    verify(constraint_id, constraint)

print(f"Course misses: {course_misses}")
print(f"Group misses: {group_misses}")
print(f"Attribute misses: {attribute_misses}")
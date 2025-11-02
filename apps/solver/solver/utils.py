import json
import time
from pathlib import Path

from ortools.sat.python import cp_model


def load_courses_and_slots():
    slots = []
    courses = {}

    data_path = Path(__file__).parent.parent / "data" / "class_data.json"
    with open(data_path, "r") as f:
        json_courses = json.load(f)
        for i, json_course in enumerate(json_courses):
            course = {}
            
            course["school"] = json_course["school"]
            course["department"] = json_course["department"]
            course["number"] = json_course["number"]
            
            course["id"] = f"{json_course['school']} {json_course['department']} {json_course['number']}"
            course["name"] = f"{json_course['school']} {json_course['department']} {json_course['number']}: {json_course['title']}"
            course["slots_ids"] = []
            course["units"] = 4 # hueristic for now, should actually scrape this in the future
            course["score"] = -len(course["name"]) # arbitrary toy score for now

            for section in json_course["sections"]:
                slot = f"{section['days']} {section['startTime']} {section['endTime']}"
                if slot not in slots:
                    slots.append(slot)

                course["slots_ids"].append(slots.index(slot))

            courses[course["id"]] = course
            
    return courses, slots

def load_groups():
    
    file_names = ["hub_groups", "major_groups"]
    groups = {}
    
    for file_name in file_names:
        with open(Path(__file__).parent.parent / "data" / f"{file_name}.json", "r") as f:
            groups.update(json.load(f))
        
    return groups

def load_prerequisite_constraints():
    with open(Path(__file__).parent.parent / "data" / "prerequisite_constraints.json", "r") as f:
        return json.load(f)

def load_graduation_constraints():
    file_names = ["hub_constraints", "major_constraints"]
    constraints = []
    
    for file_name in file_names:
        with open(Path(__file__).parent.parent / "data" / f"{file_name}.json", "r") as f:
            constraints.append(json.load(f))
            
    return {
        "id": "Graduation Requirements",
        "type": "and",
        "children": constraints
    }

class ObjectiveLogger(cp_model.CpSolverSolutionCallback):
    def __init__(self, objective_expr):
        super().__init__()
        self._objective = objective_expr
        self._start = time.time()
        self._best = None

    def on_solution_callback(self):
        value = self.ObjectiveValue()  # works if model.Maximize/Minimize called
        now = time.time() - self._start
        if self._best is None or value > self._best:
            self._best = value
            print(f"[{now:6.2f}s]  New objective = {value:.3f}")

def extract_course_number(course_id: str) -> int:
    return int("".join(filter(str.isdigit, course_id)))
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
            if not json_course["sections"]:
                continue
            
            course = {}
            
            course["id"] = i
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

def map_course_names_to_ids(courses, names):
    ids = set()
    for course_id, course in courses.items():
        if any(name in course["name"] for name in names):
            ids.add(course_id)
    return ids

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
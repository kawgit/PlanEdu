import json
import time
from ortools.sat.python import cp_model

semesters = [f"{year} {season}" for year in range(2024, 2029) for season in ["Spring", "Fall"]][1:-1]
seats_per_semester = 4
next_semester = semesters[0]

slots = []
courses = []

with open("../scraping/data/class_data.json", "r") as f:
    json_courses = json.load(f)
    for i, json_course in enumerate(json_courses):
        course = {}
        course["id"] = i
        course["name"] = f"{json_course['school']} {json_course['department']} {json_course['number']}: {json_course['title']}"
        course["slots_ids"] = []
        course["score"] = -len(course["name"]) # arbitrary toy score for now

        for section in json_course["sections"]:
            slot = f"{section['days']} {section['startTime']} {section['endTime']}"
            if slot not in slots:
                slots.append(slot)

            course["slots_ids"].append(slots.index(slot))

        courses.append(course)

print("Loaded", len(courses), "courses and", len(slots), "slots")

def minutes_since_midnight(time_str):
    h, m = map(int, time_str.split(":"))
    return h * 60 + m

forbidden_slot_pairs = []
for i in range(len(slots)):
    for j in range(i, len(slots)):
        slot_i = slots[i]
        slot_j = slots[j]

        slot_i_days, slot_i_start, slot_i_end = slot_i.split()
        slot_j_days, slot_j_start, slot_j_end = slot_j.split()

        if slot_i_days != slot_j_days:
            continue

        slot_i_start = minutes_since_midnight(slot_i_start)
        slot_i_end = minutes_since_midnight(slot_i_end)
        slot_j_start = minutes_since_midnight(slot_j_start)
        slot_j_end = minutes_since_midnight(slot_j_end)

        if slot_i_start >= slot_j_end or slot_i_end <= slot_j_start:
            continue

        forbidden_slot_pairs.append((i, j))
        forbidden_slot_pairs.append((j, i))
print("Created", len(forbidden_slot_pairs), "forbidden slot pairs")

allowed_course_slot_pairs = []
for course in courses:
    for slot_id in course["slots_ids"]:
        course_id = course["id"]
        allowed_course_slot_pairs.append((course_id, slot_id))
print("Created", len(allowed_course_slot_pairs), "allowed course slot pairs")

bookmarked_names = ["CAS CS 523", "CAS CS 565", "CAS CS 505", "CAS CS 542", "CAS CS 541"]
bookmarked_ids = []

for i, course in enumerate(courses):
    if any(bookmarked_name in course["name"] for bookmarked_name in bookmarked_names):
        bookmarked_ids.append(i)

model = cp_model.CpModel()

def candidates_for(sem):
    if sem == next_semester:
        return [c["id"] for c in courses if c["slots_ids"]]
    # heuristic: bookmarks + top-N by score
    bookmarked = set(bookmarked_ids)
    rest = sorted((i for i in range(len(courses)) if i not in bookmarked),
                  key=lambda i: courses[i]["score"], reverse=True)
    N = 100
    return list(bookmarked) + rest[:N]

course_seats = {}
for semester in semesters:
    course_seats[semester] = []
    semester_candidates = cp_model.Domain.FromValues(candidates_for(semester))
    for course_seat_index in range(seats_per_semester):
        course_seats[semester].append(model.NewIntVarFromDomain(semester_candidates, f"course_seat_{semester}_{course_seat_index}"))
course_seats_flattened = [seat for semester in semesters for seat in course_seats[semester]]

next_semester_course_seats = course_seats[next_semester]

next_semester_slot_seats = []
for course_seat_index in range(seats_per_semester):
    next_semester_slot_seats.append(model.NewIntVar(0, len(slots) - 1, f"slot_seat_{course_seat_index}"))

# Do not allow any duplicate courses across different semesters
model.AddAllDifferent(course_seats_flattened)

# Only allow selection of slots that are allowed for the course
for course_seat_index in range(seats_per_semester):
    model.AddAllowedAssignments([next_semester_course_seats[course_seat_index], next_semester_slot_seats[course_seat_index]], allowed_course_slot_pairs)

# Forbid selection of slots that collide with other slots
for i in range(seats_per_semester):
    for j in range(i + 1, seats_per_semester):
        model.AddForbiddenAssignments([next_semester_slot_seats[i], next_semester_slot_seats[j]], forbidden_slot_pairs)

# Define took course variables
took_course = {}
for course in courses:
    id = course["id"]
    took_course[id] = model.NewBoolVar(f"took_course_{id}")
    
    # Create list of bools representing if a given course seat matches the course
    matches = []
    for semester_seats in course_seats.values():
        for course_seat in semester_seats:
            match = model.NewBoolVar(f"match_{id}_{course_seat}")
            model.Add(id == course_seat).OnlyEnforceIf(match)
            model.Add(id != course_seat).OnlyEnforceIf(match.Not())
            matches.append(match)

    # Set took_course to true if any of the matches are true
    model.AddBoolOr(matches + [took_course[id].Not()])
    for match in matches:
        model.AddImplication(match, took_course[id])

# Define objective function
obj = sum(1000 * took_course[id] for id in bookmarked_ids) + sum(took_course[course["id"]] * course["score"] for course in courses)
model.Maximize(obj)

solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 10
solver.parameters.num_search_workers = 4
solver.parameters.search_branching = cp_model.AUTOMATIC_SEARCH

solver.parameters.cp_model_presolve = False
solver.parameters.symmetry_level = 0
solver.parameters.cp_model_probing_level = 0
solver.parameters.use_sat_inprocessing = False

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

print("Solving...")
logger = ObjectiveLogger(model)
res = solver.Solve(model, logger)

print("Status:", solver.StatusName(res), "in", solver.WallTime(), "seconds with objective value", int(solver.ObjectiveValue()))
for semester in semesters:
    print(semester)
    for course_seat_index in range(seats_per_semester):
        course_id = solver.Value(course_seats[semester][course_seat_index])
        print("  ", courses[course_id]["name"], end=" ")

        if semester != next_semester:
            print()
            continue

        slot_id = solver.Value(next_semester_slot_seats[course_seat_index])
        print(slots[slot_id])

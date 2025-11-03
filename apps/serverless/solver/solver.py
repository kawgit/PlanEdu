import random
from ortools.sat.python import cp_model
from typing import Any, List, Dict, Literal, Set

from utils import ObjectiveLogger, stoi

GroupId = str
CourseId = str
SlotId = str
SemesterIndex = int
Constraint = Dict[str, Any]

class ScheduleSolver:
    def __init__(self,
                 courses: Dict[CourseId, Dict[str, Any]],
                 slots: List[SlotId],
                 groups: Dict[GroupId, Set[CourseId]],
                 prerequisite_constraints: Dict[CourseId, Constraint],
                 graduation_constraints: Constraint, 
                 completed_ids: Set[CourseId],
                 num_future_semesters: int,
                 num_courses_per_semester: int = 4):
        
        self.courses = courses
        self.slots = slots
        self.groups = groups
        self.prerequisite_constraints = prerequisite_constraints
        self.graduation_constraints = graduation_constraints
        self.completed_ids = completed_ids
        self.num_future_semesters = num_future_semesters
        self.num_courses_per_semester = num_courses_per_semester
        self.last_semester_index = num_future_semesters - 1
        self.vars_to_hint: Set[cp_model.BoolVarT] = set()
        
        assert self.completed_ids.issubset(self.courses.keys())
        
        self.model = cp_model.CpModel()
        
        # Build decision space
        self._build_slot_vars()
        self._build_course_vars()
        
        # Build intermediate variables
        self._build_merged_slot_vars()
        self._build_merged_course_vars()
        
        # Build constraints
        self._enforce_exactly_one_slot_per_course()
        self._enforce_no_overlapping_slots()
        self._enforce_no_duplicate_courses()
        self._enforce_num_courses_per_semester()
        self._enforce_completed_courses()
        self._enforce_prerequisite_constraints(self.prerequisite_constraints)
        self._enforce_graduation_constraints(self.graduation_constraints)
        
        # Build hints
        self._hint_courses(list(self.courses.keys()), 8)
        self._hint_constraint(self.graduation_constraints)
        self._add_hints()
        
        # Build objective
        self._build_objective()
        
        # Build solver
        self._build_solver()
    
    def _build_slot_vars(self):
        self.slot_vars: Dict[CourseId, Dict[SlotId, cp_model.BoolVarT]] = {}        
        for course_id in self.courses.keys():
            course = self.courses[course_id]
            self.slot_vars[course_id] = {}
            for slot_id in course["slots_ids"]:
                self.slot_vars[course_id][slot_id] = self.model.NewBoolVar(f"slot_{course_id}_{slot_id}")
    
    def _build_course_vars(self):
        self.course_vars: Dict[SemesterIndex, Dict[CourseId, cp_model.BoolVarT]] = {}
        for semester_index in range(-1, self.num_future_semesters):
            self.course_vars[semester_index] = {}
            for course_id in self.courses.keys():
                self.course_vars[semester_index][course_id] = self.model.NewBoolVar(f"course_{semester_index}_{course_id}")

    def _build_merged_slot_vars(self):
        self.merged_slot_vars: Dict[SlotId, cp_model.BoolVarT] = {}
        for slot in self.slots:
            slot_vars = []
            for course_id in self.slot_vars:
                if slot in self.slot_vars[course_id]:
                    slot_vars.append(self.slot_vars[course_id][slot])
            
            if len(slot_vars) == 0:
                continue
            
            self.merged_slot_vars[slot] = self.model.NewBoolVar(f"merged_slot_{slot}")
            self.model.AddAtMostOne(slot_vars)
            self.model.AddMaxEquality(self.merged_slot_vars[slot], slot_vars)

    def _build_merged_course_vars(self):
        
        self.merged_course_vars: Dict[SemesterIndex, Dict[CourseId, cp_model.BoolVarT]] = {}
        
        for semester_index in range(-1, self.num_future_semesters):
            self.merged_course_vars[semester_index] = {}
        
        for course_id in self.courses.keys():
            
            course_vars = []
            
            for semester_index in range(-1, self.num_future_semesters):
                if course_id in self.course_vars[semester_index]:
                    course_vars.append(self.course_vars[semester_index][course_id])
                
                merged_var = self.model.NewBoolVar(f"merged_course_{semester_index}_{course_id}")
                
                if len(course_vars) == 0:
                    self.model.Add(merged_var == 0)
                else:
                    self.model.AddMaxEquality(merged_var, course_vars)
                    
                self.merged_course_vars[semester_index][course_id] = merged_var

    def _enforce_exactly_one_slot_per_course(self):
        for course_id in self.slot_vars:
            course_slot_vars = self.slot_vars[course_id].values()
            course_var = self.course_vars[0][course_id]
            self.model.Add(sum(course_slot_vars) == course_var)

    def _enforce_no_overlapping_slots(self):
        forbidden_slot_pairs = self._build_forbidden_slot_pairs()
        
        for slot_i, slot_j in forbidden_slot_pairs:
            if slot_i not in self.merged_slot_vars or slot_j not in self.merged_slot_vars:
                continue
            
            self.model.AddAtMostOne([self.merged_slot_vars[slot_i], self.merged_slot_vars[slot_j]])
        
    def _build_forbidden_slot_pairs(self):
        
        def minutes_since_midnight(time_str):
            h, m = map(int, time_str.split(":"))
            return h * 60 + m

        forbidden_slot_pairs = []
        
        for i in range(len(self.slots)):
            for j in range(i + 1, len(self.slots)):
                slot_i = self.slots[i]
                slot_j = self.slots[j]

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

                forbidden_slot_pairs.append((slot_i, slot_j))
                
        return forbidden_slot_pairs

    def _enforce_no_duplicate_courses(self):
        for course_id in self.courses.keys():
            
            course_vars = []
            
            for semester_index in range(-1, self.num_future_semesters):
                if course_id in self.course_vars[semester_index]:
                    course_vars.append(self.course_vars[semester_index][course_id])
            
            if len(course_vars) == 0:
                continue
            
            self.model.AddAtMostOne(course_vars)

    def _enforce_num_courses_per_semester(self):
        for semester_index in range(self.num_future_semesters):
            course_vars = self.course_vars[semester_index].values()
            self.model.Add(sum(course_vars) == self.num_courses_per_semester)

    def _enforce_completed_courses(self):
        for course_id, course_var in self.course_vars[-1].items():
            self.model.Add(course_var == (1 if course_id in self.completed_ids else 0))

    def _enforce_prerequisite_constraints(self, prerequisite_constraints: Dict[CourseId, Constraint]):
        
        for course_id, constraint in prerequisite_constraints.items():
            for semester_index in range(self.num_future_semesters):
                prerequisite_var = self._evaluate_constraint(constraint, semester_index - 1)
                if prerequisite_var is not None:
                    self.model.AddImplication(self.course_vars[semester_index][course_id], prerequisite_var)
    
    def _enforce_graduation_constraints(self, constraint: Constraint):
        
        graduation_var = self._evaluate_constraint(constraint, self.last_semester_index)
        assert graduation_var is not None
        self.model.Add(graduation_var == 1)

    def _evaluate_constraint(self, constraint: Constraint, semester_index: SemesterIndex):
        
        try:
            if constraint["type"] == "when":
                new_semester_index = semester_index + constraint["offset"]
                new_semester_index = max(new_semester_index, -1)
                new_semester_index = min(new_semester_index, self.last_semester_index)
                return self._evaluate_constraint(constraint["child"], new_semester_index)
            
            var = self.model.NewBoolVar(f"constraint_{constraint['id'] if 'id' in constraint else random.randint(0, 1000000)}")
            
            match (constraint["type"]):
                case "and":
                    assert constraint["children"] != []
                    child_vars = [self._evaluate_constraint(child, semester_index) for child in constraint["children"]]
                    child_vars = [child_var for child_var in child_vars if child_var is not None]
                    if len(child_vars) != 0:
                        self.model.AddMultiplicationEquality(var, child_vars)
                case "or":
                    assert constraint["children"] != []
                    child_vars = [self._evaluate_constraint(child, semester_index) for child in constraint["children"]]
                    child_vars = [child_var for child_var in child_vars if child_var is not None]
                    if len(child_vars) != 0:
                        self.model.AddMaxEquality(var, child_vars)
                case "not":
                    child_var = self._evaluate_constraint(constraint["child"], semester_index)
                    if child_var is not None:
                        self.model.Add(var + child_var == 1)
                case "range":
                    course_ids = self._find_course_ids_in_range(constraint["school"], constraint["department"], constraint["min_number"], constraint["max_number"])
                    range_vars = [self.merged_course_vars[semester_index][course_id] for course_id in course_ids]
                    if len(range_vars) != 0:
                        self.model.Add(sum(range_vars) >= constraint["count"]).OnlyEnforceIf(var)
                        self.model.Add(sum(range_vars) <= constraint["count"] - 1).OnlyEnforceIf(var.Not())
                case "group":
                    if constraint["group_id"] not in self.groups:
                        raise ValueError(f"Group not found: {constraint['group_id']}")
                    group_vars = [self.merged_course_vars[semester_index][course_id] for course_id in self.groups[constraint["group_id"]]]
                    if len(group_vars) != 0:
                        self.model.Add(sum(group_vars) >= constraint["count"]).OnlyEnforceIf(var)
                        self.model.Add(sum(group_vars) <= constraint["count"] - 1).OnlyEnforceIf(var.Not())
                case "course":
                    if constraint["course_id"] not in self.merged_course_vars[semester_index]:
                        raise ValueError(f"Course not found in merged course vars for semester {semester_index}: {constraint['course_id']}")
                    self.model.Add(var == self.merged_course_vars[semester_index][constraint["course_id"]])
                case "attribute":
                    pass # TODO: Implement attribute / standing constraints
                case _:
                    raise ValueError(f"Invalid constraint type: {constraint['type']}")
            
            return var
        
        except Exception as e:
            print("Warning: Error evaluating constraint:", e)
            return None
    
    def _find_course_ids_in_range(self, school: str, department: str, min_number: int, max_number: int):
        course_ids = []
        for course_id, course in self.courses.items():
            if course["school"] == school and course["department"] == department and stoi(course["number"]) >= min_number and stoi(course["number"]) <= max_number:
                course_ids.append(course_id)
        return course_ids
    
    def _hint_constraint(self, constraint: Constraint):
        if constraint["type"] == "course":
            self._hint_courses([constraint["course_id"]])
        elif constraint["type"] == "group":
            self._hint_courses(list(self.groups[constraint["group_id"]]), constraint["count"])
        elif "child" in constraint and constraint["child"] != None:
            self._hint_constraint(constraint["child"])
        elif "children" in constraint and constraint["children"] != []:
            for child in constraint["children"]:
                self._hint_constraint(child)
    
    def _hint_courses(self, course_ids: List[CourseId], top_k: int = None):
        if top_k is not None:
            course_ids.sort(key=lambda course_id: self.courses[course_id]["score"], reverse=True)
            course_ids = course_ids[:top_k]
            
        for course_id in course_ids:
            self.vars_to_hint.add(self.merged_course_vars[self.last_semester_index][course_id])

    def _add_hints(self):
        for var in self.vars_to_hint:
            self.model.AddHint(var, 1)

    def _build_objective(self):
        self.objective = 0
        for course_id, course in self.courses.items():
            for semester_index in range(self.num_future_semesters):
                if course_id not in self.course_vars[semester_index]:
                    continue
                self.objective += self.course_vars[semester_index][course_id] * course["score"] * (10 / (self.num_future_semesters + 5))
        self.model.Maximize(self.objective)
    
    def _build_solver(self):
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = 5
        self.solver.parameters.num_search_workers = 4
        self.solver.parameters.search_branching = cp_model.AUTOMATIC_SEARCH
        self.solver.parameters.log_search_progress = True
        self.solver.parameters.cp_model_presolve = False
        self.solver.parameters.symmetry_level = 0
        self.solver.parameters.cp_model_probing_level = 0
        self.solver.parameters.use_sat_inprocessing = False
    
    def solve(self, time_limit: int = 5, verbosity: Literal["none", "minimal", "detailed"] = "none"):
        
        self.solver.parameters.max_time_in_seconds = time_limit
        self.solver.parameters.log_search_progress = verbosity == "detailed"
        self.solver.Solve(self.model, ObjectiveLogger(self.objective) if verbosity == "minimal" else None)
        
        if self.solver.status_name() == "INFEASIBLE":
            return
        
        for semester_index in range(self.num_future_semesters):
            print(f"Semester {semester_index}:")
            for course_id, course in self.courses.items():
                
                if course_id not in self.course_vars[semester_index]:
                    continue
                
                if self.solver.Value(self.course_vars[semester_index][course_id]):
                    
                    if semester_index == 0:
                        for slot_id in self.slot_vars[course_id]:
                            if self.solver.Value(self.slot_vars[course_id][slot_id]):
                                print(f"{self.slots[slot_id]:<15}", end=" ")
                                break
                    
                    print(course['name'])
 
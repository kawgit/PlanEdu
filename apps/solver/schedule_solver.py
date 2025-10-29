from ortools.sat.python import cp_model
from typing import Any, List, Dict, Literal, Set

from utils import ObjectiveLogger

SemesterIndex = int
CourseId = int
SlotId = str

class ScheduleSolver:
    def __init__(self, courses: List[Dict[str, Any]], slots: List[SlotId], completed_ids: Set[CourseId], num_future_semesters: int, num_courses_per_semester: int = 4):
        self.courses = courses
        self.slots = slots
        self.all_ids = set(course["id"] for course in courses)
        self.completed_ids = completed_ids
        self.num_future_semesters = num_future_semesters
        self.num_courses_per_semester = num_courses_per_semester
        
        assert self.completed_ids.issubset(self.all_ids)
        
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
        
        # Build objective
        self._build_objective()
        
        # Build solver
        self._build_solver()
    
    def _build_slot_vars(self):
        self.slot_vars: Dict[CourseId, cp_model.IntVar] = {}        
        candidates = self._select_semester_candidates(0)
        for candidate in candidates:
            course_id = candidate["id"]
            self.slot_vars[course_id] = {}
            for slot_id in candidate["slots_ids"]:
                self.slot_vars[course_id][slot_id] = self.model.NewBoolVar(f"slot_{course_id}_{slot_id}")
    
    def _build_course_vars(self):
        self.course_vars: Dict[SemesterIndex, Dict[CourseId, cp_model.BoolVarT]] = {}
        for semester_index in range(self.num_future_semesters):
            self.course_vars[semester_index] = {}
            candidates = self._select_semester_candidates(semester_index)
            for candidate in candidates:
                course_id = candidate["id"]   
                self.course_vars[semester_index][course_id] = self.model.NewBoolVar(f"course_{semester_index}_{course_id}")
    
    def _select_semester_candidates(self, semester_index: SemesterIndex):
        
        if semester_index == 0:
            return self.courses
        
        candidate_courses = [course for course in self.courses if course["id"] not in self.completed_ids]
        candidate_courses.sort(key=lambda course: course["score"], reverse=True)
        candidate_courses = candidate_courses[:100]
        
        return candidate_courses

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
        
        self.merged_course_vars: Dict[CourseId, cp_model.BoolVarT] = {}
        
        for course in self.courses:
            
            course_id = course["id"]
            course_vars = []
            
            for semester_index in range(self.num_future_semesters):
                if course_id in self.course_vars[semester_index]:
                    course_vars.append(self.course_vars[semester_index][course_id])
            
            if len(course_vars) == 0:
                continue
            
            self.merged_course_vars[course_id] = self.model.NewBoolVar(f"took_{course_id}")
            self.model.AddAtMostOne(course_vars)
            self.model.AddMaxEquality(self.merged_course_vars[course_id], course_vars)

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
        for course in self.courses:
            
            course_id = course["id"]
            course_vars = []
            
            for semester_index in range(self.num_future_semesters):
                if course_id in self.course_vars[semester_index]:
                    course_vars.append(self.course_vars[semester_index][course_id])
            
            if len(course_vars) == 0:
                continue
            
            self.model.AddAtMostOne(course_vars)

    def _enforce_num_courses_per_semester(self):
        for semester_index in range(self.num_future_semesters):
            course_vars = self.course_vars[semester_index].values()
            self.model.Add(sum(course_vars) == self.num_courses_per_semester)

    def _build_objective(self):
        self.objective = 0
        for course in self.courses:
            if course["id"] not in self.merged_course_vars:
                continue
            self.objective += self.merged_course_vars[course["id"]] * course["score"]
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
        
        for semester_index in range(self.num_future_semesters):
            print(f"Semester {semester_index}:")
            for course in self.courses:
                course_id = course["id"]
                
                if course_id not in self.course_vars[semester_index]:
                    continue
                
                if self.solver.Value(self.course_vars[semester_index][course_id]):
                    print(f"  {course['name']}", end=" ")
                    
                    if semester_index > 0:
                        print()
                        continue
                    
                    for slot_id in self.slot_vars[course_id]:
                        if self.solver.Value(self.slot_vars[course_id][slot_id]):
                            print(self.slots[slot_id], end=" ")
                    
                    print()
 
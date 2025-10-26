# scheduleSolver.py
# pip install ortools

from ortools.sat.python import cp_model
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple, Set


class ScheduleSolver:
    """
    CP-SAT wrapper for class/section scheduling with NL->JSON constraints.

    Data contracts (adapt to your schema):
      relations: List[dict] with keys:
        - rid: str
        - class_id: str
        - semester: str
        - days: List[str]         # ["Mon","Tue","Wed","Thu","Fri"]
        - start: int              # minutes from 00:00
        - end: int                # minutes from 00:00
        - instructor_id: Optional[str]
        - building_id: Optional[str]
        - rating: Optional[float] # normalized [0..1] if available
      conflicts: List[Tuple[str,str]]  # overlapping rids (same semester)

      groups: Dict with (example):
        - "A","B","C","D_eligible": Set[str]  # class_ids per group
        - "CS320","CS330","CS332","CS350","CS351": str class_id (optional)
      hubs: Dict:
        - "requirements": Dict[tag, int]
        - "classes_by_tag": Dict[tag, Set[class_id]]
    """

    def __init__(
        self,
        relations: List[Dict[str, Any]],
        conflicts: List[Tuple[str, str]],
        groups: Dict[str, Any],
        hubs: Dict[str, Any],
        semesters: List[str],
        bookmarks: Set[str],
        k: int = 4,
    ):
        self.model = cp_model.CpModel()
        self.relations = relations
        self.conflicts = conflicts
        self.groups = groups
        self.hubs = hubs
        self.semesters = semesters
        self.bookmarks = set(bookmarks)
        self.k = k

        # Integer scaling for soft weights (avoid float expressions)
        self._SCALE = 1000
        self._S = lambda v: int(round(float(v) * self._SCALE))

        # Vars
        self.z: Dict[str, cp_model.IntVar] = {}  # section pick
        self.x: Dict[str, cp_model.IntVar] = {}  # class chosen

        # Indexes
        self.class_to_rids: Dict[str, List[str]] = defaultdict(list)
        self.semester_to_rids: Dict[str, List[str]] = defaultdict(list)
        self.rid_to_relation: Dict[str, Dict[str, Any]] = {}
        self.class_ids: Set[str] = set()

        # Objective term storage (grouped, as (BoolVar, int_coeff) pairs)
        self.objective_groups: Dict[str, List[Tuple[cp_model.IntVar, int]]] = {
            "bookmarks": [],
            "degree_progress": [],
            "comfort": [],
            "custom": [],
        }

        # Lexicographic tiers (optional)
        self.lexi_tiers: List[str] = []

        # Build core variables/constraints
        self._build_variables()
        self._add_core_constraints()

        # Constraint registry (kind -> handler)
        self.registry = {
            # Selection & exclusion
            "include_course": self._apply_include_course,
            "exclude_course": self._apply_exclude_course,
            "include_section": self._apply_include_section,
            "exclude_section": self._apply_exclude_section,
            "include_instructor": self._apply_include_instructor,
            "exclude_instructor": self._apply_exclude_instructor,
            # Time/day/windows
            "allowed_days": self._apply_allowed_days,
            "disallowed_days": self._apply_disallowed_days,
            "earliest_start": self._apply_earliest_start,
            "latest_end": self._apply_latest_end,
            "block_time_window": self._apply_block_time_window,
            # Load & pacing
            "max_courses_per_semester": self._apply_max_courses_per_semester,
            "min_courses_per_semester": self._apply_min_courses_per_semester,
            # Degree & hubs
            "require_group_counts": self._apply_require_group_counts,
            "hub_targets": self._apply_hub_targets,
            # Ordering
            "enforce_ordering": self._apply_enforce_ordering,
            # QoL
            "free_day": self._apply_free_day,
            # Objective shaping
            "bookmarked_bonus": self._apply_bookmarked_bonus,
            "professor_rating_weight": self._apply_professor_rating_weight,
            "lexicographic_priority": self._apply_lexi_priority,
        }

    # ------------------------- Build & Core -------------------------

    def _build_variables(self):
        for r in self.relations:
            rid = r["rid"]
            cid = r["class_id"]
            sem = r["semester"]
            self.rid_to_relation[rid] = r
            self.class_to_rids[cid].append(rid)
            self.semester_to_rids[sem].append(rid)
            self.class_ids.add(cid)
            self.z[rid] = self.model.NewBoolVar(f"z_{rid}")

        for cid in self.class_ids:
            self.x[cid] = self.model.NewBoolVar(f"x_{cid}")

        # Link: x_c == OR(z_r) and <= 1 section per class
        for cid, rids in self.class_to_rids.items():
            # x_c <= sum(z_r)
            self.model.Add(sum(self.z[rid] for rid in rids) >= self.x[cid])
            # each z_r -> x_c
            for rid in rids:
                self.model.Add(self.z[rid] <= self.x[cid])
            # at most one section
            self.model.Add(sum(self.z[rid] for rid in rids) <= 1)

    def _add_core_constraints(self):
        # No-overlap pairs
        for rid1, rid2 in self.conflicts:
            self.model.Add(self.z[rid1] + self.z[rid2] <= 1)
        # Default per-semester cap
        for s in self.semesters:
            rids = self.semester_to_rids.get(s, [])
            if rids:
                self.model.Add(sum(self.z[r] for r in rids) <= self.k)

    # Safe accessor: returns 0 if class has no variable (not in relations)
    def _x_var(self, cid: str):
        return self.x[cid] if cid in self.x else 0

    # Objective utils
    def _add_term(self, group: str, var: cp_model.IntVar, coeff_int: int):
        if coeff_int != 0:
            self.objective_groups[group].append((var, coeff_int))

    def _group_expr(self, group: str):
        pairs = self.objective_groups[group]
        return sum(coeff * var for (var, coeff) in pairs) if pairs else 0

    def _group_value(self, solver: cp_model.CpSolver, group: str) -> int:
        return sum(coeff * solver.Value(var) for (var, coeff) in self.objective_groups[group])

    # ------------------------- API -------------------------

    def add_constraints(self, constraints: List[Dict[str, Any]]):
        for c in constraints:
            kind = c.get("kind")
            if kind not in self.registry:
                raise ValueError(f"Unknown constraint kind: {kind}")
            self.registry[kind](c)

    def solve(
        self,
        time_limit_sec: Optional[int] = 5,
        maximize: bool = True,
        use_lexicographic: bool = True,
    ) -> Dict[str, Any]:
        solver = cp_model.CpSolver()
        if time_limit_sec:
            solver.parameters.max_time_in_seconds = float(time_limit_sec)
        solver.parameters.num_search_workers = 8

        if self.lexi_tiers and use_lexicographic:
            # Only proceed if at least one tier actually has terms
            if not any(len(self.objective_groups.get(t, [])) for t in self.lexi_tiers):
                return self._single_pass_solve(solver, maximize)

            best_values: Dict[str, int] = {}

            for tier in self.lexi_tiers:
                pairs = self.objective_groups.get(tier, [])
                if not pairs:
                    continue  # nothing to optimize in this tier

                # Build an IntLinearExpr from pairs (coeff * var)
                expr = sum(coeff * var for (var, coeff) in pairs)

                if maximize:
                    self.model.Maximize(expr)
                else:
                    self.model.Minimize(expr)

                status = solver.Solve(self.model)
                if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                    return {"status": "INFEASIBLE", "explain": f"failed at tier {tier}"}

                # Compute integer objective value explicitly (avoid ObjectiveValue float)
                tier_val = sum(coeff * solver.Value(var) for (var, coeff) in pairs)
                best_values[tier] = int(tier_val)

                # Lock-in this tier’s value for subsequent tiers
                if maximize:
                    self.model.Add(expr >= int(tier_val))
                else:
                    self.model.Add(expr <= int(tier_val))

            return self._extract_solution(solver, "OPTIMAL_OR_FEASIBLE", best_values)

        # Single-pass objective: sum all groups
        all_pairs: List[Tuple[cp_model.IntVar, int]] = []
        for g in self.objective_groups.values():
            all_pairs.extend(g)
        if not all_pairs:
            # Default objective: maximize bookmark coverage
            for cid in self.bookmarks:
                self._add_term("bookmarks", self._x_var(cid), self._S(1.0))
            all_pairs = self.objective_groups["bookmarks"]
        expr = sum(coeff * var for (var, coeff) in all_pairs)
        if maximize:
            self.model.Maximize(expr)
        else:
            self.model.Minimize(expr)
        return self._single_pass_solve(solver, maximize)

    def _single_pass_solve(self, solver: cp_model.CpSolver, maximize: bool) -> Dict[str, Any]:
        status = solver.Solve(self.model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return {"status": "INFEASIBLE"}
        return self._extract_solution(
            solver, "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE", {}
        )

    def _extract_solution(
        self, solver: cp_model.CpSolver, status_label: str, lexibest: Dict[str, int]
    ) -> Dict[str, Any]:
        chosen_rids = [rid for rid, var in self.z.items() if solver.Value(var) == 1]
        chosen_classes = [cid for cid, var in self.x.items() if solver.Value(var) == 1]
        scores = {name: self._group_value(solver, name) for name in self.objective_groups}
        return {
            "status": status_label,
            "chosen_sections": chosen_rids,
            "chosen_classes": chosen_classes,
            "objective_scores": scores,
            "scale": self._SCALE,
            "lexi_bounds": lexibest,
        }

    # ------------------------- Handlers -------------------------

    # Selection / exclusion
    def _apply_include_course(self, c: Dict[str, Any]):
        for cid in c["payload"]["course_ids"]:
            if cid not in self.x:
                # Explicitly make infeasible to surface the issue (no section exists)
                self.model.Add(0 == 1)
            else:
                self.model.Add(self.x[cid] == 1)

    def _apply_exclude_course(self, c: Dict[str, Any]):
        for cid in c["payload"]["course_ids"]:
            if cid in self.x:
                self.model.Add(self.x[cid] == 0)

    def _apply_include_section(self, c: Dict[str, Any]):
        for rid in c["payload"]["section_ids"]:
            self.model.Add(self.z[rid] == 1)

    def _apply_exclude_section(self, c: Dict[str, Any]):
        for rid in c["payload"]["section_ids"]:
            self.model.Add(self.z[rid] == 0)

    def _apply_include_instructor(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard")
        weight = float(c.get("weight", 1.0))
        insts = set(c["payload"]["instructor_ids"])
        rids = [rid for rid, r in self.rid_to_relation.items() if r.get("instructor_id") in insts]
        if not rids:
            return
        if mode == "hard":
            self.model.Add(sum(self.z[r] for r in rids) >= 1)
        else:
            for rid in rids:
                self._add_term("comfort", self.z[rid], self._S(weight))

    def _apply_exclude_instructor(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard")
        weight = float(c.get("weight", 1.0))
        insts = set(c["payload"]["instructor_ids"])
        rids = [rid for rid, r in self.rid_to_relation.items() if r.get("instructor_id") in insts]
        if not rids:
            return
        if mode == "hard":
            for rid in rids:
                self.model.Add(self.z[rid] == 0)
        else:
            for rid in rids:
                self._add_term("comfort", self.z[rid], -self._S(weight))

    # Time, day, windows
    def _apply_allowed_days(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard")
        weight = float(c.get("weight", 1.0))
        allowed = set(c["payload"]["days"])
        for rid, r in self.rid_to_relation.items():
            meets = set(r["days"])
            if not meets.issubset(allowed):
                if mode == "hard":
                    self.model.Add(self.z[rid] == 0)
                else:
                    self._add_term("comfort", self.z[rid], -self._S(weight))

    def _apply_disallowed_days(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard")
        weight = float(c.get("weight", 1.0))
        banned = set(c["payload"]["days"])
        for rid, r in self.rid_to_relation.items():
            if any(d in banned for d in r["days"]):
                if mode == "hard":
                    self.model.Add(self.z[rid] == 0)
                else:
                    self._add_term("comfort", self.z[rid], -self._S(weight))

    def _apply_earliest_start(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard")
        weight = float(c.get("weight", 1.0))
        tmin = self._hhmm_to_minutes(c["payload"]["time"])
        for rid, r in self.rid_to_relation.items():
            if r["start"] < tmin:
                if mode == "hard":
                    self.model.Add(self.z[rid] == 0)
                else:
                    self._add_term("comfort", self.z[rid], -self._S(weight))

    def _apply_latest_end(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard")
        weight = float(c.get("weight", 1.0))
        tmax = self._hhmm_to_minutes(c["payload"]["time"])
        for rid, r in self.rid_to_relation.items():
            if r["end"] > tmax:
                if mode == "hard":
                    self.model.Add(self.z[rid] == 0)
                else:
                    self._add_term("comfort", self.z[rid], -self._S(weight))

    def _apply_block_time_window(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard")
        weight = float(c.get("weight", 1.0))
        start = self._hhmm_to_minutes(c["payload"]["start"])
        end = self._hhmm_to_minutes(c["payload"]["end"])
        days = set(c["payload"].get("days", ["Mon", "Tue", "Wed", "Thu", "Fri"]))

        def overlap(a_start, a_end, b_start, b_end) -> bool:
            return not (a_end <= b_start or b_end <= a_start)

        for rid, r in self.rid_to_relation.items():
            if any(d in days for d in r["days"]) and overlap(r["start"], r["end"], start, end):
                if mode == "hard":
                    self.model.Add(self.z[rid] == 0)
                else:
                    self._add_term("comfort", self.z[rid], -self._S(weight))

    # Load & pacing
    def _apply_max_courses_per_semester(self, c: Dict[str, Any]):
        k = int(c["payload"]["k"])
        sems = c.get("semesters", self.semesters)
        for s in sems:
            rids = self.semester_to_rids.get(s, [])
            if rids:
                self.model.Add(sum(self.z[r] for r in rids) <= k)

    def _apply_min_courses_per_semester(self, c: Dict[str, Any]):
        m = int(c["payload"]["m"])
        sems = c.get("semesters", self.semesters)
        for s in sems:
            rids = self.semester_to_rids.get(s, [])
            if rids:
                self.model.Add(sum(self.z[r] for r in rids) >= m)

    # Degree & hubs
    def _apply_require_group_counts(self, c: Dict[str, Any]):
        p = c["payload"]
        A = self.groups.get("A", set())
        B = self.groups.get("B", set())
        Cg = self.groups.get("C", set())
        D_elig = self.groups.get("D_eligible", set())

        if "A" in p:
            self.model.Add(sum(self._x_var(cid) for cid in A) == int(p["A"]))
        if "B_min" in p:
            self.model.Add(sum(self._x_var(cid) for cid in B) >= int(p["B_min"]))
        if "C_min" in p:
            self.model.Add(sum(self._x_var(cid) for cid in Cg) >= int(p["C_min"]))
        if "AD_total_min" in p:
            self.model.Add(
                sum(self._x_var(cid) for cid in (A | B | Cg | D_elig)) >= int(p["AD_total_min"])
            )

        # Special rule (350/351 with 320/332)
        c350 = self.groups.get("CS350")
        c351 = self.groups.get("CS351")
        c320 = self.groups.get("CS320")
        c332 = self.groups.get("CS332")
        # Only add if identifiers exist in mapping
        if all(v is not None for v in [c350, c351, c320, c332]):
            self.model.Add(
                self._x_var(c350) + self._x_var(c351) <= self._x_var(c320) + self._x_var(c332) + 1
            )

    def _apply_hub_targets(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard")
        weight = float(c.get("weight", 1.0))
        req_map: Dict[str, int] = c["payload"]
        for tag, need in req_map.items():
            classes_with_tag = self.hubs.get("classes_by_tag", {}).get(tag, set())
            if mode == "hard":
                self.model.Add(sum(self._x_var(cid) for cid in classes_with_tag) >= int(need))
            else:
                for cid in classes_with_tag:
                    self._add_term("degree_progress", self._x_var(cid), self._S(weight))

    # Ordering / prerequisites (simple linearization across semesters)
    def _apply_enforce_ordering(self, c: Dict[str, Any]):
        before = c["payload"]["before"]
        after = c["payload"]["after"]
        sem_order = {s: i for i, s in enumerate(sorted(set(self.semesters)))}
        before_rids = self.class_to_rids.get(before, [])
        after_rids = self.class_to_rids.get(after, [])
        for rid_b in before_rids:
            sb = self.rid_to_relation[rid_b]["semester"]
            for rid_a in after_rids:
                sa = self.rid_to_relation[rid_a]["semester"]
                if sem_order[sa] <= sem_order[sb]:
                    self.model.Add(self.z[rid_b] + self.z[rid_a] <= 1)

    # QoL: Free day (per semester, among listed days)
    def _apply_free_day(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard")
        weight = float(c.get("weight", 1.0))
        days = c["payload"].get("days", ["Mon", "Tue", "Wed", "Thu", "Fri"])
        count = int(c["payload"].get("count", 1))

        for s in self.semesters:
            rids_s = self.semester_to_rids.get(s, [])
            free_vars = []
            for d in days:
                z_on_day = [self.z[rid] for rid in rids_s if d in self.rid_to_relation[rid]["days"]]
                day_used = self.model.NewBoolVar(f"day_used_{s}_{d}")
                if z_on_day:
                    self.model.Add(sum(z_on_day) >= day_used)
                    for v in z_on_day:
                        self.model.Add(day_used >= v)
                else:
                    self.model.Add(day_used == 0)
                free_day = self.model.NewBoolVar(f"free_day_{s}_{d}")
                self.model.Add(free_day + day_used == 1)
                free_vars.append(free_day)

            if mode == "hard":
                self.model.Add(sum(free_vars) >= count)
            else:
                for v in free_vars:
                    self._add_term("comfort", v, self._S(weight))

    # Objective shaping
    def _apply_bookmarked_bonus(self, c: Dict[str, Any]):
        bonus = float(c["payload"].get("bonus", 1.0))
        for cid in c["payload"]["course_ids"]:
            self._add_term("bookmarks", self._x_var(cid), self._S(bonus))

    def _apply_professor_rating_weight(self, c: Dict[str, Any]):
        alpha = float(c["payload"].get("alpha", 1.0))
        for rid, r in self.rid_to_relation.items():
            rating = r.get("rating", None)
            if rating is not None:
                self._add_term("comfort", self.z[rid], self._S(alpha * float(rating)))

    def _apply_lexi_priority(self, c: Dict[str, Any]):
        self.lexi_tiers = list(c["payload"].get("tiers", []))

    # ------------------------- Utils -------------------------

    @staticmethod
    def _hhmm_to_minutes(hhmm: str) -> int:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)


# ------------------------- Feasible Toy Example -------------------------

if __name__ == "__main__":
    # 1 semester, 3 courses, no conflicts, k=2
    relations = [
        {
            "rid": "r_cs320_TTh_14",
            "class_id": "CAS CS 320",
            "semester": "2026SP",
            "days": ["Tue", "Thu"],
            "start": 14 * 60 + 0,
            "end": 15 * 60 + 15,
            "instructor_id": "Kim,Ana",
            "building_id": "CAS",
            "rating": 0.6,
        },
        {
            "rid": "r_cs237_MW_10",
            "class_id": "CAS CS 237",
            "semester": "2026SP",
            "days": ["Mon", "Wed"],
            "start": 10 * 60 + 0,
            "end": 11 * 60 + 15,
            "instructor_id": "Doe,Alex",
            "building_id": "CAS",
            "rating": 0.9,
        },
        {
            "rid": "r_cs330_TTh_11",
            "class_id": "CAS CS 330",
            "semester": "2026SP",
            "days": ["Tue", "Thu"],
            "start": 11 * 60 + 0,
            "end": 12 * 60 + 15,
            "instructor_id": "Zed,Bob",
            "building_id": "ENG",
            "rating": 0.7,
        },
    ]
    conflicts: List[Tuple[str, str]] = []  # no overlaps in this toy

    groups = {
        "A": {"CAS CS 330"},         # treat CS330 as Group A
        "B": {"CAS CS 237"},         # CS237 as Group B
        "C": {"CAS CS 320"},         # CS320 as Group C
        "D_eligible": set(),
        "CS320": "CAS CS 320",
        "CS330": "CAS CS 330",
        "CS332": "CAS CS 332",
        "CS350": "CAS CS 350",
        "CS351": "CAS CS 351",
    }

    hubs = {"requirements": {}, "classes_by_tag": {}}

    semesters = ["2026SP"]
    bookmarks = {"CAS CS 237", "CAS CS 320"}  # user prefers 237 & 320
    k = 2

    solver = ScheduleSolver(relations, conflicts, groups, hubs, semesters, bookmarks, k)

    constraints = [
        # Group counts matched to toy data (feasible)
        {
            "id": "c_req",
            "kind": "require_group_counts",
            "mode": "hard",
            "payload": {"A": 1, "B_min": 1, "C_min": 0, "AD_total_min": 2},
        },
        # Cap per semester (redundant with default, explicit here)
        {"id": "c_k", "kind": "max_courses_per_semester", "mode": "hard", "payload": {"k": 2}},
        # Example day rule
        {"id": "c_no_fri", "kind": "disallowed_days", "mode": "hard", "payload": {"days": ["Fri"]}},
        # Soft comfort: avoid starting too early
        {
            "id": "c_start_after_9",
            "kind": "earliest_start",
            "mode": "soft",
            "weight": 1.0,
            "payload": {"time": "09:00"},
        },
        # Soft: reward bookmarked classes
        {
            "id": "c_bookmarks",
            "kind": "bookmarked_bonus",
            "mode": "soft",
            "weight": 1.0,
            "payload": {"course_ids": ["CAS CS 237", "CAS CS 320"], "bonus": 2.0},
        },
        # Optional: professor rating weight
        {"id": "c_rating", "kind": "professor_rating_weight", "mode": "soft", "payload": {"alpha": 0.5}},
        # Lexicographic: maximize bookmarks then comfort
        {"id": "c_lexi", "kind": "lexicographic_priority", "payload": {"tiers": ["bookmarks", "comfort"]}},
    ]

    solver.add_constraints(constraints)
    result = solver.solve(time_limit_sec=3, use_lexicographic=True)
    print(result)

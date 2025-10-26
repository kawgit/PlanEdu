# pip install ortools
from ortools.sat.python import cp_model
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple, Set


# -------------------- Objective Manager (exact lexicographic in 1 pass) --------------------
class ObjectiveManager:
    def __init__(self, scale: int = 1000, tiers: List[str] = None):
        self._SCALE = int(scale)
        self.S = lambda v: int(round(float(v) * self._SCALE))
        self.tiers = tiers or ["bookmarks", "degree", "comfort", "custom"]
        self.terms: Dict[str, List[Tuple[cp_model.IntVar, int]]] = {t: [] for t in self.tiers}

    def add(self, tier: str, var: cp_model.IntVar, weight: float):
        if tier not in self.terms:
            self.terms[tier] = []
        w = self.S(weight)
        if w != 0:
            self.terms[tier].append((var, w))

    def _ub(self, tier: str) -> int:
        return sum(abs(c) for (_, c) in self.terms.get(tier, []))

    def bigM_weights(self) -> Dict[str, int]:
        Ws, acc = {}, 0
        for t in reversed(self.tiers):
            Ws[t] = 1 + acc
            acc += self._ub(t)
        return Ws

    def objective(self) -> cp_model.LinearExpr:
        Ws = self.bigM_weights()
        return sum(Ws[t] * sum(c * v for (v, c) in self.terms[t]) for t in self.tiers)

    def values_by_tier(self, solver: cp_model.CpSolver) -> Dict[str, int]:
        return {t: sum(c * solver.Value(v) for (v, c) in self.terms[t]) for t in self.tiers}

    @property
    def scale(self) -> int:
        return self._SCALE


# ------------------------------------- Schedule Solver -------------------------------------
class ScheduleSolver:
    def __init__(
        self,
        relations: List[Dict[str, Any]],
        conflicts: List[Tuple[str, str]],
        groups: Dict[str, Any],
        hubs: Dict[str, Any],
        semesters: List[str],
        bookmarks: Set[str],
        completed_courses: Set[str] = None,
        k: int = 4,
        tiers: List[str] = None,
        scale: int = 1000,
    ):
        self.model = cp_model.CpModel()
        self.relations = relations
        self.conflicts = conflicts
        self.groups = groups or {}
        self.hubs = hubs or {"requirements": {}, "classes_by_tag": {}}
        self.semesters = semesters
        self.bookmarks = set(bookmarks or [])
        self.completed = set(completed_courses or [])
        self.k = int(k)

        # Vars & indexes
        self.z: Dict[str, cp_model.IntVar] = {}
        self.x: Dict[str, cp_model.IntVar] = {}
        self.class_to_rids: Dict[str, List[str]] = defaultdict(list)
        self.semester_to_rids: Dict[str, List[str]] = defaultdict(list)
        self.rid_to_relation: Dict[str, Dict[str, Any]] = {}
        self.class_ids: Set[str] = set()

        # Objective manager
        self.obj = ObjectiveManager(scale=scale, tiers=tiers or ["bookmarks", "degree", "comfort", "custom"])

        self._build_variables()
        self._add_core_constraints()

        # Registry of constraint kinds
        self.registry = {
            "include_course": self._apply_include_course,
            "exclude_course": self._apply_exclude_course,
            "include_section": self._apply_include_section,
            "exclude_section": self._apply_exclude_section,
            "include_instructor": self._apply_include_instructor,
            "exclude_instructor": self._apply_exclude_instructor,
            "section_filter": self._apply_section_filter,
            "max_courses_per_semester": self._apply_max_courses_per_semester,
            "min_courses_per_semester": self._apply_min_courses_per_semester,
            "require_group_counts": self._apply_require_group_counts,
            "hub_targets": self._apply_hub_targets,
            "enforce_ordering": self._apply_enforce_ordering,
            "free_day": self._apply_free_day,
            "bookmarked_bonus": self._apply_bookmarked_bonus,
            "lexicographic_priority": self._apply_lexi_priority,
            "disallowed_days": self._apply_disallowed_days,
            "earliest_start": self._apply_earliest_start,
            "latest_end": self._apply_latest_end,
            "block_time_window": self._apply_block_time_window,
            "professor_rating_weight": self._apply_professor_rating_weight,
            "pin_sections": self._apply_pin_sections,
            "target_courses_per_semester": self._apply_target_courses_per_semester,
        }

    # --------------------------- Core model ---------------------------
    def _build_variables(self):
        for r in self.relations:
            rid = r["rid"]
            cid = r["class_id"]
            sem = r["semester"]
            
            # Skip completed courses
            if cid in self.completed:
                continue
                
            self.rid_to_relation[rid] = r
            self.class_to_rids[cid].append(rid)
            self.semester_to_rids[sem].append(rid)
            self.class_ids.add(cid)
            self.z[rid] = self.model.NewBoolVar(f"z_{rid}")

        for cid, rids in self.class_to_rids.items():
            xcid = self._x(cid)
            self.model.Add(sum(self.z[rid] for rid in rids) >= xcid)
            for rid in rids:
                self.model.Add(self.z[rid] <= xcid)
            self.model.Add(sum(self.z[rid] for rid in rids) <= 1)

    def _add_core_constraints(self):
        # Time conflicts
        for rid1, rid2 in self.conflicts:
            if rid1 in self.z and rid2 in self.z:
                self.model.Add(self.z[rid1] + self.z[rid2] <= 1)
        
        # Max courses per semester
        for s in self.semesters:
            rids = self.semester_to_rids.get(s, [])
            if rids:
                self.model.Add(sum(self.z[r] for r in rids) <= self.k)
        
        # Baseline objective: reward selecting any non-completed course
        for cid in self.class_ids:
            if cid not in self.completed:
                self.obj.add("degree", self._x(cid), 1.0)
        
        # Bookmark bonus (optional nudge, not a requirement)
        for cid in self.bookmarks:
            if cid not in self.completed:
                self.obj.add("bookmarks", self._x(cid), 1.0)

    def _x(self, cid: str) -> cp_model.IntVar:
        if cid not in self.x:
            self.x[cid] = self.model.NewBoolVar(f"x_{cid}")
            # Completed courses are fixed to 0
            if cid in self.completed:
                self.model.Add(self.x[cid] == 0)
            elif cid not in self.class_to_rids:
                self.model.Add(self.x[cid] == 0)
        return self.x[cid]

    # --------------------------- Utils ---------------------------
    @staticmethod
    def _hhmm_to_minutes(hhmm: Optional[str]) -> Optional[int]:
        if hhmm is None:
            return None
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)

    def over_sections(self, predicate, *, mode="hard", weight=1.0, tier="comfort"):
        for rid, r in self.rid_to_relation.items():
            if predicate(r):
                if mode == "hard":
                    self.model.Add(self.z[rid] == 0)
                else:
                    self.obj.add(tier, self.z[rid], -float(weight))

    def _or_var(self, lits: List[cp_model.IntVar], name: str) -> cp_model.IntVar:
        v = self.model.NewBoolVar(name)
        if not lits:
            self.model.Add(v == 0)
            return v
        self.model.AddBoolOr(lits + [v.Not()])
        for lit in lits:
            self.model.AddImplication(lit, v)
        return v

    # --------------------------- API ---------------------------
    def add_constraints(self, constraints: List[Dict[str, Any]]):
        for c in constraints:
            kind = c.get("kind")
            if kind not in self.registry:
                raise ValueError(f"Unknown constraint kind: {kind}")
            self.registry[kind](c)

    def solve(self, time_limit_sec: int = 5, maximize: bool = True) -> Dict[str, Any]:
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_sec)
        solver.parameters.num_search_workers = 8
        expr = self.obj.objective()
        if maximize:
            self.model.Maximize(expr)
        else:
            self.model.Minimize(expr)
        status = solver.Solve(self.model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return {"status": "INFEASIBLE"}
        return {
            "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
            "chosen_sections": [rid for rid, var in self.z.items() if solver.Value(var) == 1],
            "chosen_classes": [cid for cid, var in self.x.items() if solver.Value(var) == 1],
            "objective_scores": self.obj.values_by_tier(solver),
            "scale": self.obj.scale,
        }

    # --------------------------- Constraint Handlers ---------------------------
    def _apply_include_course(self, c: Dict[str, Any]):
        for cid in c["payload"]["course_ids"]:
            self.model.Add(self._x(cid) == 1)

    def _apply_exclude_course(self, c: Dict[str, Any]):
        for cid in c["payload"]["course_ids"]:
            self.model.Add(self._x(cid) == 0)

    def _apply_include_section(self, c: Dict[str, Any]):
        for rid in c["payload"]["section_ids"]:
            self.model.Add(self.z[rid] == 1)

    def _apply_exclude_section(self, c: Dict[str, Any]):
        for rid in c["payload"]["section_ids"]:
            self.model.Add(self.z[rid] == 0)

    def _apply_include_instructor(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard"); w = float(c.get("weight", 1.0))
        insts = set(c["payload"]["instructor_ids"])
        rids = [rid for rid, r in self.rid_to_relation.items() if r.get("instructor_id") in insts]
        if mode == "hard" and rids:
            self.model.Add(sum(self.z[r] for r in rids) >= 1)
        else:
            for rid in rids:
                self.obj.add("comfort", self.z[rid], w)

    def _apply_exclude_instructor(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard"); w = float(c.get("weight", 1.0))
        insts = set(c["payload"]["instructor_ids"])
        rids = [rid for rid, r in self.rid_to_relation.items() if r.get("instructor_id") in insts]
        if mode == "hard":
            for rid in rids:
                self.model.Add(self.z[rid] == 0)
        else:
            for rid in rids:
                self.obj.add("comfort", self.z[rid], -w)

    def _apply_section_filter(self, c: Dict[str, Any]):
        p = c["payload"]; mode = c.get("mode", "hard"); w = float(c.get("weight", 1.0))
        days_any = set(p.get("days_any", []))
        inst_any = set(p.get("instructors_any", []))
        start_lt = self._hhmm_to_minutes(p.get("start_lt"))
        end_gt = self._hhmm_to_minutes(p.get("end_gt"))
        overlaps = [
            (self._hhmm_to_minutes(o["start"]), self._hhmm_to_minutes(o["end"]), set(o.get("days", [])))
            for o in p.get("overlap", [])
        ]

        def pred(r):
            if days_any and not (set(r["days"]) & days_any):
                return False
            if inst_any and r.get("instructor_id") not in inst_any:
                return False
            bad = False
            if start_lt is not None and r["start"] < start_lt:
                bad = True
            if end_gt is not None and r["end"] > end_gt:
                bad = True
            for a, b, D in overlaps:
                if (not D or set(r["days"]) & D) and not (r["end"] <= a or b <= r["start"]):
                    bad = True
            return bad

        self.over_sections(pred, mode=mode, weight=w, tier="comfort")

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

    def _apply_require_group_counts(self, c: Dict[str, Any]):
        p = c["payload"]
        A = self.groups.get("A", set()); B = self.groups.get("B", set())
        Cg = self.groups.get("C", set()); D = self.groups.get("D_eligible", set())
        if "A" in p:       self.model.Add(sum(self._x(cid) for cid in A) == int(p["A"]))
        if "B_min" in p:   self.model.Add(sum(self._x(cid) for cid in B) >= int(p["B_min"]))
        if "C_min" in p:   self.model.Add(sum(self._x(cid) for cid in Cg) >= int(p["C_min"]))
        if "AD_total_min" in p:
            self.model.Add(sum(self._x(cid) for cid in (A | B | Cg | D)) >= int(p["AD_total_min"]))

        # Optional special rule (CS350/351 vs CS320/332)
        c350 = self.groups.get("CS350"); c351 = self.groups.get("CS351")
        c320 = self.groups.get("CS320"); c332 = self.groups.get("CS332")
        if all(v is not None for v in [c350, c351, c320, c332]):
            self.model.Add(self._x(c350) + self._x(c351) <= self._x(c320) + self._x(c332) + 1)

    def _apply_hub_targets(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard"); w = float(c.get("weight", 1.0))
        req: Dict[str, int] = c["payload"]
        by_tag: Dict[str, Set[str]] = self.hubs.get("classes_by_tag", {})
        for tag, need in req.items():
            S = [self._x(cid) for cid in by_tag.get(tag, set())]
            if mode == "hard":
                self.model.Add(sum(S) >= int(need))
            else:
                for v in S:
                    self.obj.add("degree", v, w)

    def _apply_enforce_ordering(self, c: Dict[str, Any]):
        before = c["payload"]["before"]; after = c["payload"]["after"]
        sem_idx = {s: i for i, s in enumerate(sorted(set(self.semesters)))}
        for rb in self.class_to_rids.get(before, []):
            sb = self.rid_to_relation[rb]["semester"]
            for ra in self.class_to_rids.get(after, []):
                sa = self.rid_to_relation[ra]["semester"]
                if sem_idx[sa] <= sem_idx[sb]:
                    self.model.Add(self.z[rb] + self.z[ra] <= 1)

    def _apply_free_day(self, c: Dict[str, Any]):
        mode = c.get("mode", "hard"); w = float(c.get("weight", 1.0))
        days = c["payload"].get("days", ["Mon", "Tue", "Wed", "Thu", "Fri"])
        count = int(c["payload"].get("count", 1))
        for s in self.semesters:
            free_vars = []
            rids_s = self.semester_to_rids.get(s, [])
            for d in days:
                lits = [self.z[rid] for rid in rids_s if d in self.rid_to_relation[rid]["days"]]
                used = self._or_var(lits, f"used_{s}_{d}")
                free = self.model.NewBoolVar(f"free_{s}_{d}")
                self.model.Add(free + used == 1)
                free_vars.append(free)
            if mode == "hard":
                self.model.Add(sum(free_vars) >= count)
            else:
                for v in free_vars:
                    self.obj.add("comfort", v, w)

    def _apply_bookmarked_bonus(self, c: Dict[str, Any]):
        bonus = float(c["payload"].get("bonus", 1.0))
        for cid in c["payload"]["course_ids"]:
            self.obj.add("bookmarks", self._x(cid), bonus)

    def _apply_lexi_priority(self, c: Dict[str, Any]):
        tiers = list(c["payload"].get("tiers", []))
        if tiers:
            old_terms = self.obj.terms
            self.obj = ObjectiveManager(scale=self.obj.scale, tiers=tiers)
            for t, pairs in old_terms.items():
                nt = t if t in self.obj.terms else "custom"
                for (v, w) in pairs:
                    self.obj.terms[nt].append((v, w))

    def _apply_disallowed_days(self, c: Dict[str, Any]):
        """Disallow classes on specific days (e.g., no Friday classes)"""
        mode = c.get("mode", "hard"); w = float(c.get("weight", 1.0))
        days_set = set(c["payload"].get("days", []))
        
        def pred(r):
            return bool(set(r["days"]) & days_set)
        
        self.over_sections(pred, mode=mode, weight=w, tier="comfort")

    def _apply_earliest_start(self, c: Dict[str, Any]):
        """Enforce earliest class start time (e.g., no classes before 10 AM)"""
        mode = c.get("mode", "hard"); w = float(c.get("weight", 1.0))
        earliest = self._hhmm_to_minutes(c["payload"]["time"])  # e.g., "10:00"
        
        def pred(r):
            return r["start"] < earliest
        
        self.over_sections(pred, mode=mode, weight=w, tier="comfort")

    def _apply_latest_end(self, c: Dict[str, Any]):
        """Enforce latest class end time (e.g., no classes after 5 PM)"""
        mode = c.get("mode", "hard"); w = float(c.get("weight", 1.0))
        latest = self._hhmm_to_minutes(c["payload"]["time"])  # e.g., "17:00"
        
        def pred(r):
            return r["end"] > latest
        
        self.over_sections(pred, mode=mode, weight=w, tier="comfort")

    def _apply_block_time_window(self, c: Dict[str, Any]):
        """Block out a specific time window (e.g., lunch break 12-1 PM)"""
        mode = c.get("mode", "hard"); w = float(c.get("weight", 1.0))
        start = self._hhmm_to_minutes(c["payload"]["start"])
        end = self._hhmm_to_minutes(c["payload"]["end"])
        days_set = set(c["payload"].get("days", []))
        
        def pred(r):
            # Check if section overlaps with blocked window
            if days_set and not (set(r["days"]) & days_set):
                return False  # Different days, no conflict
            # Check time overlap
            return not (r["end"] <= start or r["start"] >= end)
        
        self.over_sections(pred, mode=mode, weight=w, tier="comfort")

    def _apply_professor_rating_weight(self, c: Dict[str, Any]):
        """Bonus for sections with highly-rated professors"""
        w = float(c.get("weight", 1.0))
        threshold = float(c["payload"].get("threshold", 4.0))
        
        for rid, r in self.rid_to_relation.items():
            rating = r.get("professor_rating", 0.0)
            if rating >= threshold:
                bonus = (rating - threshold) * w
                self.obj.add("comfort", self.z[rid], bonus)

    def _apply_pin_sections(self, c: Dict[str, Any]):
        """Force specific sections to be included (hard constraint)"""
        for rid in c["payload"]["section_ids"]:
            if rid in self.z:
                self.model.Add(self.z[rid] == 1)

    def _apply_target_courses_per_semester(self, c: Dict[str, Any]):
        """Set exact number of courses per semester (not just max)"""
        t = int(c["payload"]["t"])
        sems = c["payload"].get("semesters", self.semesters)
        for s in sems:
            rids = self.semester_to_rids.get(s, [])
            if rids:
                self.model.Add(sum(self.z[r] for r in rids) == t)

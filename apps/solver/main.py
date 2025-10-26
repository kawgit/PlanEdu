#!/usr/bin/env python3
"""
FastAPI Service for Schedule Solver

Wraps the ScheduleSolver class and exposes a REST API for generating optimized schedules.
Supports constraint-based scheduling using CP-SAT.

Usage:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Set, Tuple
import sys
import os

# Add backend/src directory to path to import scheduleSolver
backend_src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/src"))
sys.path.insert(0, backend_src_path)

try:
    from scheduleSolver import ScheduleSolver
except ImportError as e:
    print(f"ERROR: Cannot import ScheduleSolver from {backend_src_path}")
    print(f"Make sure scheduleSolver.py exists at: {os.path.join(backend_src_path, 'scheduleSolver.py')}")
    raise

app = FastAPI(title="Schedule Solver API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3001"],  # Frontend and backend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Request/Response Models
# ============================================================================

class SolveRequest(BaseModel):
    """Request model for /solve endpoint"""
    relations: List[Dict[str, Any]] = Field(..., description="List of class-to-slot relations")
    conflicts: List[Tuple[str, str]] = Field(default=[], description="List of conflicting section pairs")
    groups: Dict[str, Any] = Field(default={}, description="Course groupings for degree requirements")
    hubs: Dict[str, Any] = Field(default={}, description="Hub requirements and class mappings")
    semesters: List[str] = Field(..., description="List of semester IDs")
    bookmarks: List[str] = Field(default=[], description="List of bookmarked course IDs")
    completed_courses: List[str] = Field(default=[], description="List of completed course IDs to exclude")
    k: int = Field(default=4, description="Maximum courses per semester")
    constraints: List[Dict[str, Any]] = Field(default=[], description="Additional user constraints")
    time_limit_sec: int = Field(default=5, description="Solver time limit in seconds")
    scale: int = Field(default=1000, description="Objective function scaling factor")

    class Config:
        json_schema_extra = {
            "example": {
                "relations": [
                    {
                        "rid": "cs111_fall2024_A1",
                        "class_id": "CASCS111",
                        "semester": "Fall2024",
                        "days": ["Mon", "Wed"],
                        "start": 540,  # 9:00 AM in minutes
                        "end": 620,    # 10:20 AM in minutes
                        "instructor_id": "prof_smith",
                        "professor_rating": 4.5
                    }
                ],
                "conflicts": [["cs111_fall2024_A1", "math121_fall2024_B2"]],
                "groups": {
                    "A": ["CASCS111", "CASCS112"],
                    "B": ["CASCS131", "CASCS132"]
                },
                "hubs": {
                    "requirements": {"Hub1": 2, "Hub2": 1},
                    "classes_by_tag": {
                        "Hub1": ["CASWR100", "CASWR120"],
                        "Hub2": ["CASPH101"]
                    }
                },
                "semesters": ["Fall2024", "Spring2025"],
                "bookmarks": ["CASCS111", "CASMA121"],
                "k": 4,
                "constraints": [
                    {
                        "id": "c1",
                        "kind": "free_day",
                        "mode": "soft",
                        "weight": 1.0,
                        "payload": {"days": ["Fri"], "count": 1}
                    }
                ],
                "time_limit_sec": 5,
                "scale": 1000
            }
        }


class SolveResponse(BaseModel):
    """Response model for /solve endpoint"""
    status: str = Field(..., description="Solver status: OPTIMAL, FEASIBLE, or INFEASIBLE")
    chosen_sections: Optional[List[str]] = Field(None, description="List of chosen section IDs")
    chosen_classes: Optional[List[str]] = Field(None, description="List of chosen class IDs")
    objective_scores: Optional[Dict[str, int]] = Field(None, description="Objective scores by tier")
    scale: Optional[int] = Field(None, description="Scaling factor used")
    error: Optional[str] = Field(None, description="Error message if solver failed")


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Schedule Solver API",
        "status": "online",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "solver": "CP-SAT (OR-Tools)",
        "constraints_supported": [
            "include_course", "exclude_course", "include_section", "exclude_section",
            "include_instructor", "exclude_instructor", "section_filter",
            "max_courses_per_semester", "min_courses_per_semester",
            "require_group_counts", "hub_targets", "enforce_ordering",
            "free_day", "bookmarked_bonus", "lexicographic_priority",
            "disallowed_days", "earliest_start", "latest_end",
            "block_time_window", "professor_rating_weight", "pin_sections",
            "target_courses_per_semester"
        ]
    }


@app.post("/solve", response_model=SolveResponse)
async def solve_schedule(request: SolveRequest):
    """
    Solve a schedule optimization problem using CP-SAT.
    
    Takes course data, constraints, and preferences, and returns an optimized schedule.
    """
    try:
        print("\n" + "="*80)
        print("SCHEDULE SOLVER - NEW REQUEST")
        print("="*80)
        
        # Convert bookmarks and completed to sets
        bookmarks_set = set(request.bookmarks)
        completed_set = set(request.completed_courses)
        
        # Count available courses (relations minus completed)
        all_courses = set(r["class_id"] for r in request.relations)
        available_courses = all_courses - completed_set
        
        print(f"📚 Total Courses in Pool: {len(all_courses)}")
        print(f"✅ Bookmarked Courses: {len(bookmarks_set)}")
        print(f"❌ Completed (Excluded): {len(completed_set)}")
        print(f"🎯 Available for Selection: {len(available_courses)}")
        print(f"📋 User Constraints: {len(request.constraints)}")
        print(f"🔢 Max Courses/Semester: {request.k}")
        print(f"📅 Semesters: {', '.join(request.semesters)}")
        
        if completed_set:
            print(f"\nCompleted courses (will be excluded): {sorted(list(completed_set))[:5]}{'...' if len(completed_set) > 5 else ''}")
        if bookmarks_set:
            print(f"Bookmarked courses (soft preference): {sorted(list(bookmarks_set))[:5]}{'...' if len(bookmarks_set) > 5 else ''}")
        if request.constraints:
            print(f"\nUser constraints:")
            for c in request.constraints:
                print(f"  • {c.get('kind', 'unknown')} ({c.get('mode', 'soft')}): {c.get('payload', {})}")
        
        # Initialize solver
        print("\n🔧 Initializing CP-SAT solver...")
        solver = ScheduleSolver(
            relations=request.relations,
            conflicts=request.conflicts,
            groups=request.groups,
            hubs=request.hubs,
            semesters=request.semesters,
            bookmarks=bookmarks_set,
            completed_courses=completed_set,
            k=request.k,
            scale=request.scale
        )
        
        # Add user constraints
        if request.constraints:
            try:
                print(f"Adding {len(request.constraints)} user constraints...")
                solver.add_constraints(request.constraints)
            except ValueError as e:
                print(f"❌ Invalid constraint: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Invalid constraint: {str(e)}")
        
        # Solve
        print(f"\n⚡ Running solver (time limit: {request.time_limit_sec}s)...")
        result = solver.solve(time_limit_sec=request.time_limit_sec, maximize=True)
        
        # Check if feasible
        if result["status"] == "INFEASIBLE":
            print("❌ INFEASIBLE - No solution found")
            print("="*80 + "\n")
            return SolveResponse(
                status="INFEASIBLE",
                error="No feasible schedule found. Try relaxing some constraints."
            )
        
        # Log results
        chosen_classes = result.get("chosen_classes", [])
        chosen_sections = result.get("chosen_sections", [])
        objective_scores = result.get("objective_scores", {})
        
        print(f"\n✅ SOLUTION FOUND ({result['status']})")
        print(f"📝 Chosen Classes: {len(chosen_classes)}")
        print(f"📅 Chosen Sections: {len(chosen_sections)}")
        
        if chosen_classes:
            print(f"\nSelected courses: {', '.join(sorted(chosen_classes))}")
        
        if objective_scores:
            print("\n🎯 Objective Scores by Tier:")
            for tier, score in objective_scores.items():
                print(f"  {tier}: {score}")
        
        # Count courses per semester
        semester_counts = {}
        for rid in chosen_sections:
            rel = next((r for r in request.relations if r["rid"] == rid), None)
            if rel:
                sem = rel.get("semester", "unknown")
                semester_counts[sem] = semester_counts.get(sem, 0) + 1
        
        if semester_counts:
            print("\n📊 Courses per Semester:")
            for sem, count in semester_counts.items():
                print(f"  {sem}: {count} courses")
        
        print("="*80 + "\n")
        
        # Return successful result
        return SolveResponse(
            status=result["status"],
            chosen_sections=result.get("chosen_sections", []),
            chosen_classes=result.get("chosen_classes", []),
            objective_scores=result.get("objective_scores", {}),
            scale=result.get("scale", request.scale)
        )
        
    except ValueError as e:
        print(f"❌ ValueError: {str(e)}")
        print("="*80 + "\n")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        print("="*80 + "\n")
        raise HTTPException(status_code=500, detail=f"Solver error: {str(e)}")


@app.post("/validate-constraints")
async def validate_constraints(constraints: List[Dict[str, Any]]):
    """
    Validate a list of constraints without running the solver.
    
    Useful for checking constraint syntax before submitting a solve request.
    """
    # Initialize a dummy solver to validate constraints
    try:
        dummy_solver = ScheduleSolver(
            relations=[],
            conflicts=[],
            groups={},
            hubs={},
            semesters=["dummy"],
            bookmarks=set(),
            k=4
        )
        
        invalid_constraints = []
        for c in constraints:
            kind = c.get("kind")
            if kind not in dummy_solver.registry:
                invalid_constraints.append({
                    "constraint": c,
                    "error": f"Unknown constraint kind: {kind}"
                })
        
        if invalid_constraints:
            return {
                "valid": False,
                "invalid_constraints": invalid_constraints
            }
        
        return {
            "valid": True,
            "message": "All constraints are valid"
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)


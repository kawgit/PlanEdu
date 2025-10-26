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
            "block_time_window", "professor_rating_weight", "pin_sections"
        ]
    }


@app.post("/solve", response_model=SolveResponse)
async def solve_schedule(request: SolveRequest):
    """
    Solve a schedule optimization problem using CP-SAT.
    
    Takes course data, constraints, and preferences, and returns an optimized schedule.
    """
    try:
        # Convert bookmarks to set
        bookmarks_set = set(request.bookmarks)
        
        # Initialize solver
        solver = ScheduleSolver(
            relations=request.relations,
            conflicts=request.conflicts,
            groups=request.groups,
            hubs=request.hubs,
            semesters=request.semesters,
            bookmarks=bookmarks_set,
            k=request.k,
            scale=request.scale
        )
        
        # Add user constraints
        if request.constraints:
            try:
                solver.add_constraints(request.constraints)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=f"Invalid constraint: {str(e)}")
        
        # Solve
        result = solver.solve(time_limit_sec=request.time_limit_sec, maximize=True)
        
        # Check if feasible
        if result["status"] == "INFEASIBLE":
            return SolveResponse(
                status="INFEASIBLE",
                error="No feasible schedule found. Try relaxing some constraints."
            )
        
        # Return successful result
        return SolveResponse(
            status=result["status"],
            chosen_sections=result.get("chosen_sections", []),
            chosen_classes=result.get("chosen_classes", []),
            objective_scores=result.get("objective_scores", {}),
            scale=result.get("scale", request.scale)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
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


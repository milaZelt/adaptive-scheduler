"""Stateless FastAPI wrapper around solver.engine.solve(). Holds zero
Supabase credentials and no database access of any kind (decisions record:
Next.js gathers all input server-side, POSTs it here, and is solely
responsible for persisting the result). Only ever reachable from Next.js's
own server-side Route Handler, never a browser directly - so no CORS
middleware is configured on purpose; adding permissive CORS here would
weaken that trust boundary.
"""

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException

from solver.engine import solve
from solver.types import BusyInterval, FlexibleTaskInput, SessionPlacement, TaskResult

from .auth import require_shared_secret
from .schemas import (
    BusyIntervalIn,
    FlexibleTaskIn,
    SessionPlacementOut,
    SolveRequest,
    SolveResponse,
    TaskResultOut,
)

# Loads backend/.env for local dev (see .env.example) - auth.py then reads
# SOLVER_SHARED_SECRET via os.environ per-request. No-op in production if a
# real environment variable is already set instead of a .env file.
load_dotenv()

app = FastAPI(
    title="Nextly Solver",
    description="Stateless CP-SAT scheduling service for Nextly flexible tasks.",
)


def _to_busy_interval(b: BusyIntervalIn) -> BusyInterval:
    return BusyInterval(day=b.day, start_hour=b.start_hour, end_hour=b.end_hour)


def _to_flexible_task(t: FlexibleTaskIn) -> FlexibleTaskInput:
    return FlexibleTaskInput(
        id=t.id,
        priority=t.priority,
        deadline_day=t.deadline_day,
        remaining_minutes=t.remaining_minutes,
        min_session_minutes=t.min_session_minutes,
        max_session_minutes=t.max_session_minutes,
        splittable=t.splittable,
    )


def _from_session_placement(s: SessionPlacement) -> SessionPlacementOut:
    return SessionPlacementOut(task_id=s.task_id, day=s.day, start_hour=s.start_hour, end_hour=s.end_hour)


def _from_task_result(r: TaskResult) -> TaskResultOut:
    return TaskResultOut(
        task_id=r.task_id,
        scheduled=r.scheduled,
        sessions=[_from_session_placement(s) for s in r.sessions],
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse, dependencies=[Depends(require_shared_secret)])
def solve_endpoint(request: SolveRequest) -> SolveResponse:
    tasks = [_to_flexible_task(t) for t in request.tasks]
    busy_intervals = [_to_busy_interval(b) for b in request.busy_intervals]

    try:
        result = solve(tasks=tasks, busy_intervals=busy_intervals, horizon_days=request.horizon_days)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=f"Solver failed to converge: {exc}") from exc

    return SolveResponse(
        task_results={tid: _from_task_result(r) for tid, r in result.task_results.items()},
        all_sessions=[_from_session_placement(s) for s in result.all_sessions],
    )

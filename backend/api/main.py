"""A stateless FastAPI wrapper around solver.engine.solve(). It holds no
Supabase credentials and touches no database - Next.js gathers the input,
POSTs it here, and saves the result itself.

Only Next.js's own server can reach this, never a browser directly.
That's why there's no CORS setup here on purpose - adding CORS would open
this up to browsers too, which we don't want.
"""

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException

from solver.engine import solve
from solver.types import BusyInterval, FlexibleTaskInput, SessionPlacement, TaskResult

from .auth import require_shared_secret
from .schemas import (
    BusyIntervalIn,
    FlexibleTaskPayload,
    SessionPlacementOut,
    SolveRequest,
    SolveResponse,
    TaskResultOut,
)

# Loads backend/.env for local dev (see .env.example). auth.py then
# reads SOLVER_SHARED_SECRET from the environment on each request. Does
# nothing in production, where a real env var is already set.
load_dotenv()

app = FastAPI(
    title="Nextly Solver",
    description="Stateless CP-SAT scheduling service for Nextly flexible tasks.",
)


def _to_busy_interval(b: BusyIntervalIn) -> BusyInterval:
    return BusyInterval(day=b.day, start_hour=b.start_hour, end_hour=b.end_hour)


def _to_flexible_task(t: FlexibleTaskPayload) -> FlexibleTaskInput:
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

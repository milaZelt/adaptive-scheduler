"""Plain data contracts for the solver. Deliberately framework-free (no
Pydantic/FastAPI here) - Ticket 3 wraps these in a real HTTP schema later.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class BusyInterval:
    """A fixed or Google-imported event the solver must not place flexible
    work against (with padding). Fixed/Google events are never constrained
    against each other - only used here as read-only inputs."""

    day: int  # 0-indexed within the horizon
    start_hour: float  # decimal hour, e.g. 10.0
    end_hour: float


@dataclass(frozen=True)
class FlexibleTaskInput:
    """A flexible task's remaining work, already resolved upstream (Ticket 4
    computes remaining_minutes from the task's required duration minus any
    completed past sessions; overdue tasks are filtered out before reaching
    the solver at all - it never sees them)."""

    id: str
    priority: str  # "High" | "Medium" | "Low"
    deadline_day: int  # 0-indexed within the horizon, inclusive
    remaining_minutes: int
    min_session_minutes: int
    max_session_minutes: int
    splittable: bool


@dataclass(frozen=True)
class SessionPlacement:
    task_id: str
    day: int
    start_hour: float
    end_hour: float


@dataclass(frozen=True)
class TaskResult:
    task_id: str
    scheduled: bool  # True iff the task's *entire* remaining_minutes was placed
    sessions: list[SessionPlacement] = field(default_factory=list)


@dataclass(frozen=True)
class SolveResult:
    task_results: dict[str, TaskResult]
    all_sessions: list[SessionPlacement]

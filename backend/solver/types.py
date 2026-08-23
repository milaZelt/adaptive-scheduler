"""Plain data types for the solver. No Pydantic or FastAPI here on purpose
- the API layer wraps these in its own HTTP schema.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class BusyInterval:
    """A fixed or Google event that flexible tasks must avoid (with some
    padding). Read-only input - these events are never checked against
    each other."""

    day: int  # 0-indexed within the horizon
    start_hour: float  # decimal hour, e.g. 10.0
    end_hour: float


@dataclass(frozen=True)
class FlexibleTaskInput:
    """A flexible task's remaining work. remaining_minutes is the full
    duration minus sessions already done, computed upstream. Overdue
    tasks are filtered out earlier - the solver never sees them."""

    id: str
    priority: str  # "High" | "Medium" | "Low" - keep in sync with constants.PRIORITY_ORDER and api/schemas.Priority
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
    scheduled: bool  # True only if the task's *entire* remaining_minutes was placed
    sessions: list[SessionPlacement] = field(default_factory=list)


@dataclass(frozen=True)
class SolveResult:
    task_results: dict[str, TaskResult]
    all_sessions: list[SessionPlacement]

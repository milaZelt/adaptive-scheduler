"""HTTP-facing request/response contracts. Mirrors solver/types.py field for
field, but stays a separate Pydantic layer on purpose - the solver package
remains framework-free, and this is where input gets validated as untrusted
(the same principle the decisions record applies on the Next.js side to
FastAPI's response applies here in reverse: FastAPI shouldn't blindly trust
whatever Next.js sends either).
"""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

Priority = Literal["High", "Medium", "Low"]

# Generous sanity cap, not a product rule - the actual 14-day horizon is a
# Next.js/frontend constant (PLANNING_HORIZON_DAYS) this API doesn't need to
# know about or duplicate. This just guards against pathological input.
MAX_HORIZON_DAYS = 60


class BusyIntervalIn(BaseModel):
    day: int = Field(ge=0, description="0-indexed day offset within the horizon (0 = today).")
    start_hour: float = Field(ge=0, le=24, description="Decimal hour, e.g. 9.5 = 9:30am.")
    end_hour: float = Field(ge=0, le=24)

    @model_validator(mode="after")
    def check_order(self) -> "BusyIntervalIn":
        if self.end_hour <= self.start_hour:
            raise ValueError("end_hour must be after start_hour")
        return self


class FlexibleTaskIn(BaseModel):
    id: str = Field(min_length=1)
    priority: Priority
    deadline_day: int = Field(ge=0, description="0-indexed day offset within the horizon, inclusive.")
    remaining_minutes: int = Field(gt=0, description="Duration still needed - already resolved upstream.")
    min_session_minutes: int = Field(gt=0)
    max_session_minutes: int = Field(gt=0)
    splittable: bool

    @model_validator(mode="after")
    def check_session_bounds(self) -> "FlexibleTaskIn":
        if self.max_session_minutes < self.min_session_minutes:
            raise ValueError("max_session_minutes must be >= min_session_minutes")
        return self


class SolveRequest(BaseModel):
    horizon_days: int = Field(gt=0, le=MAX_HORIZON_DAYS)
    busy_intervals: list[BusyIntervalIn] = Field(default_factory=list)
    tasks: list[FlexibleTaskIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_no_duplicate_task_ids(self) -> "SolveRequest":
        seen_ids: set[str] = set()
        for t in self.tasks:
            if t.id in seen_ids:
                raise ValueError(f"duplicate task id: {t.id}")
            seen_ids.add(t.id)
        return self

    @model_validator(mode="after")
    def check_task_deadlines_within_horizon(self) -> "SolveRequest":
        for t in self.tasks:
            if t.deadline_day >= self.horizon_days:
                raise ValueError(
                    f"task {t.id!r} deadline_day ({t.deadline_day}) must be "
                    f"less than horizon_days ({self.horizon_days})"
                )
        return self

    @model_validator(mode="after")
    def check_busy_intervals_within_horizon(self) -> "SolveRequest":
        for b in self.busy_intervals:
            if b.day >= self.horizon_days:
                raise ValueError(
                    f"busy interval day ({b.day}) must be less than horizon_days ({self.horizon_days})"
                )
        return self


class SessionPlacementOut(BaseModel):
    task_id: str
    day: int
    start_hour: float
    end_hour: float


class TaskResultOut(BaseModel):
    task_id: str
    scheduled: bool
    sessions: list[SessionPlacementOut]


class SolveResponse(BaseModel):
    task_results: dict[str, TaskResultOut]
    all_sessions: list[SessionPlacementOut]

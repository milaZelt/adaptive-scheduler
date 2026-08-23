"""Core CP-SAT scheduling engine for flexible tasks.

We solve priority tiers one at a time: all High tasks first, then Medium,
then Low. Each tier's result is locked in before the next tier runs, so a
lower priority can never change a higher priority's outcome.

Within one tier, we break ties in this order:

  1. Schedule as many tasks as possible.
  2. Prefer tasks with an earlier deadline.
  3. Prefer shorter tasks (frees up room for more tasks to fit).
  4. Prefer fewer, longer sessions over more short fragments.
  5. Prefer the earliest open time slot.

How this works: we solve the same model multiple times in a row. Each
solve sets one goal, solves it, then locks in that result as a
constraint before solving the next goal.
"""

import logging
import time
from dataclasses import dataclass

from ortools.sat.python import cp_model

from .constants import (
    MAX_CANDIDATE_SESSIONS,
    MINUTES_PER_DAY,
    PADDING_MIN,
    PRIORITY_ORDER,
    SNAP_MIN,
    WINDOW_END_MIN,
    WINDOW_START_MIN,
)
from .types import BusyInterval, FlexibleTaskInput, SessionPlacement, SolveResult, TaskResult

logger = logging.getLogger(__name__)

STAGE_TIME_LIMIT_S = 10.0


class _Candidate:
    """One possible session slot for a task. A splittable task gets several
    of these to pick from - any number can be used. A non-splittable task
    gets just one, always its full remaining duration."""

    def __init__(self, task: FlexibleTaskInput, index: int, model: cp_model.CpModel):
        self.index = index
        self.name = name = f"{task.id}_{index}"

        if task.splittable:
            lo, hi = task.min_session_minutes, task.max_session_minutes
        else:
            lo = hi = task.remaining_minutes

        self.presence = model.NewBoolVar(f"present_{name}")
        self.day = model.NewIntVar(0, task.deadline_day, f"day_{name}")
        self.duration = model.NewIntVar(lo, hi, f"dur_{name}")
        # Duration must be a multiple of SNAP_MIN (the frontend's 15-min
        # grid). This makes a bad duration fail loudly here instead of
        # silently landing off-grid.
        model.AddModuloEquality(0, self.duration, SNAP_MIN)

        # hour_start is minutes-since-midnight on whichever day this lands on.
        self.hour_start = model.NewIntVar(WINDOW_START_MIN, WINDOW_END_MIN, f"hs_{name}")
        model.AddModuloEquality(0, self.hour_start, SNAP_MIN)
        # Only applies if this candidate is actually used. That way an
        # unused candidate (like one too long to fit the window) can't
        # break the whole model just by existing.
        model.Add(self.hour_start + self.duration <= WINDOW_END_MIN).OnlyEnforceIf(self.presence)

        horizon_minutes = (task.deadline_day + 1) * MINUTES_PER_DAY
        self.abs_start = model.NewIntVar(0, horizon_minutes, f"abs_start_{name}")
        model.Add(self.abs_start == self.day * MINUTES_PER_DAY + self.hour_start)
        # This range must be big enough for abs_start + duration even when
        # this candidate isn't used - the window check above only applies
        # when it is.
        self.abs_end = model.NewIntVar(0, horizon_minutes + hi, f"abs_end_{name}")
        model.Add(self.abs_end == self.abs_start + self.duration)

        self.interval = model.NewOptionalIntervalVar(
            self.abs_start, self.duration, self.abs_end, self.presence, f"iv_{name}"
        )

        # A padded copy of this interval, bigger by PADDING_MIN/2 on each
        # side. Used only by the no-overlap check below: if two padded
        # copies don't overlap, the real sessions have a gap of at least
        # PADDING_MIN. This applies to every pair of flexible sessions,
        # even two sessions from the same split task.
        half = PADDING_MIN // 2
        pad_lo = -half
        pad_hi = horizon_minutes + half
        self.padded_start = model.NewIntVar(pad_lo, pad_hi, f"pstart_{name}")
        model.Add(self.padded_start == self.abs_start - half)
        self.padded_duration = model.NewIntVar(0, hi + PADDING_MIN, f"pdur_{name}")
        model.Add(self.padded_duration == self.duration + PADDING_MIN)
        self.padded_end = model.NewIntVar(pad_lo, pad_hi + hi + PADDING_MIN, f"pend_{name}")
        model.Add(self.padded_end == self.padded_start + self.padded_duration)
        self.padded_interval = model.NewOptionalIntervalVar(
            self.padded_start, self.padded_duration, self.padded_end, self.presence, f"piv_{name}"
        )

        # 0 when this candidate isn't used. This keeps unused candidates
        # from throwing off the stage-5 tie-break sum, since their
        # abs_start would otherwise be unconstrained.
        self.effective_start = model.NewIntVar(0, horizon_minutes, f"effstart_{name}")
        model.Add(self.effective_start == self.abs_start).OnlyEnforceIf(self.presence)
        model.Add(self.effective_start == 0).OnlyEnforceIf(self.presence.Not())


def _num_candidates(task: FlexibleTaskInput) -> int:
    if not task.splittable:
        return 1
    # Upper bound on how many pieces this task could plausibly need, capped.
    needed = -(-task.remaining_minutes // task.min_session_minutes)  # ceil div
    return max(1, min(MAX_CANDIDATE_SESSIONS, needed))


def _solve_and_lock(model: cp_model.CpModel, solver: cp_model.CpSolver, terms: list, maximize: bool) -> None:
    if not terms:
        return
    expr = sum(terms)
    if maximize:
        model.Maximize(expr)
    else:
        model.Minimize(expr)
    solver.parameters.max_time_in_seconds = STAGE_TIME_LIMIT_S
    status = solver.Solve(model)
    # FEASIBLE means CP-SAT found a working solution but ran out of time
    # proving it's the best one. We still accept it. Real task lists are
    # much bigger than our test fixtures, so rejecting FEASIBLE would break
    # Update Schedule for exactly the users who need it most. CP-SAT
    # usually finds a strong solution fast, so FEASIBLE is normally close
    # to optimal anyway. Also, later stages only tighten the value
    # further, never make it worse - so an imperfect stage 1 can't hurt
    # later stages.
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"solver stage found no solution (status={solver.StatusName(status)})")
    if status == cp_model.FEASIBLE:
        logger.info("solver stage settled for FEASIBLE, not proven OPTIMAL, within %ss", STAGE_TIME_LIMIT_S)
    value = round(solver.ObjectiveValue())
    model.Add(expr == value)


@dataclass
class _TaskVars:
    task: FlexibleTaskInput
    candidates: list[_Candidate]
    scheduled: cp_model.IntVar


def _build_task_vars(task: FlexibleTaskInput, model: cp_model.CpModel) -> _TaskVars:
    """One task's candidate sessions, plus a `scheduled` bool. True if the
    used candidates add up to the task's full remaining_minutes, false if
    none are used. All-or-nothing, enforced right here."""
    candidates = [_Candidate(task, i, model) for i in range(_num_candidates(task))]

    scheduled = model.NewBoolVar(f"scheduled_{task.id}")
    effective_durations = []
    for c in candidates:
        cap = task.max_session_minutes if task.splittable else task.remaining_minutes
        eff = model.NewIntVar(0, cap, f"eff_{task.id}_{c.index}")
        model.Add(eff == c.duration).OnlyEnforceIf(c.presence)
        model.Add(eff == 0).OnlyEnforceIf(c.presence.Not())
        effective_durations.append(eff)

    total = sum(effective_durations)
    model.Add(total == task.remaining_minutes).OnlyEnforceIf(scheduled)
    model.Add(total == 0).OnlyEnforceIf(scheduled.Not())

    return _TaskVars(task=task, candidates=candidates, scheduled=scheduled)


def _add_flex_vs_flex_constraint(model: cp_model.CpModel, all_candidates: list[_Candidate]) -> None:
    """Keeps a minimum gap between any two flexible sessions, including two
    sessions from the same split task. Uses the padded shadow intervals to
    do it."""
    if all_candidates:
        model.AddNoOverlap([c.padded_interval for c in all_candidates])


def _add_flex_vs_fixed_constraints(
    model: cp_model.CpModel,
    all_candidates: list[_Candidate],
    busy_intervals: list[BusyInterval],
) -> None:
    """Keeps every flexible candidate a padded gap away from every fixed or
    Google busy interval. Fixed/Google intervals are never checked against
    each other, only against flexible ones."""
    for c in all_candidates:
        for i, busy in enumerate(busy_intervals):
            busy_start = busy.day * MINUTES_PER_DAY + round(busy.start_hour * 60)
            busy_end = busy.day * MINUTES_PER_DAY + round(busy.end_hour * 60)
            name = f"{c.name}_{i}"
            before = model.NewBoolVar(f"before_{name}")
            after = model.NewBoolVar(f"after_{name}")
            model.Add(c.abs_end <= busy_start - PADDING_MIN).OnlyEnforceIf([c.presence, before])
            model.Add(c.abs_start >= busy_end + PADDING_MIN).OnlyEnforceIf([c.presence, after])
            model.AddBoolOr([before, after]).OnlyEnforceIf(c.presence)


def solve(
    tasks: list[FlexibleTaskInput],
    busy_intervals: list[BusyInterval],
    horizon_days: int,
    stage_timings: list[dict] | None = None,
) -> SolveResult:
    if not tasks:
        return SolveResult(task_results={}, all_sessions=[])

    model = cp_model.CpModel()
    task_vars: dict[str, _TaskVars] = {task.id: _build_task_vars(task, model) for task in tasks}
    all_candidates = [c for tv in task_vars.values() for c in tv.candidates]

    _add_flex_vs_flex_constraint(model, all_candidates)
    _add_flex_vs_fixed_constraints(model, all_candidates, busy_intervals)

    solver = cp_model.CpSolver()

    # Optional hook for benchmarking - records how long each stage takes.
    # Does nothing if stage_timings is None, so production pays no cost.
    # Defined here so it can reuse model, solver, and stage_timings
    # directly.
    def _stage(priority: str, label: str, terms: list, maximize: bool) -> None:
        start = time.perf_counter()
        _solve_and_lock(model, solver, terms, maximize=maximize)
        if stage_timings is not None:
            stage_timings.append(
                {"priority": priority, "stage": label, "elapsed_s": time.perf_counter() - start}
            )

    for priority in PRIORITY_ORDER:
        tier = [tv for tv in task_vars.values() if tv.task.priority == priority]
        if not tier:
            continue

        # Stage 1: maximize count of completed tasks in this tier.
        _stage(priority, "count", [tv.scheduled for tv in tier], maximize=True)

        # Stage 2: among ties, prefer tasks with an earlier deadline.
        urgency_terms = [(horizon_days - tv.task.deadline_day) * tv.scheduled for tv in tier]
        _stage(priority, "urgency", urgency_terms, maximize=True)

        # Stage 3: among remaining ties, prefer completing shorter tasks.
        minutes_terms = [tv.task.remaining_minutes * tv.scheduled for tv in tier]
        _stage(priority, "shorter_task", minutes_terms, maximize=False)

        # Stage 4: among remaining ties, prefer fewer/longer sessions per task.
        session_count_terms = [c.presence for tv in tier for c in tv.candidates]
        _stage(priority, "fewer_sessions", session_count_terms, maximize=False)

        # Stage 5: among remaining ties, prefer the earliest available placement.
        earliest_terms = [c.effective_start for tv in tier for c in tv.candidates]
        _stage(priority, "earliest_placement", earliest_terms, maximize=False)

    task_results: dict[str, TaskResult] = {}
    all_sessions: list[SessionPlacement] = []

    for task_id, tv in task_vars.items():
        scheduled = solver.Value(tv.scheduled) == 1
        sessions = []
        if scheduled:
            for c in tv.candidates:
                if solver.Value(c.presence) == 1:
                    start_min = solver.Value(c.hour_start)
                    dur_min = solver.Value(c.duration)
                    placement = SessionPlacement(
                        task_id=task_id,
                        day=solver.Value(c.day),
                        start_hour=start_min / 60,
                        end_hour=(start_min + dur_min) / 60,
                    )
                    sessions.append(placement)
                    all_sessions.append(placement)
        task_results[task_id] = TaskResult(task_id=task_id, scheduled=scheduled, sessions=sessions)

    return SolveResult(task_results=task_results, all_sessions=all_sessions)

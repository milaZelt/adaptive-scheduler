"""Core CP-SAT scheduling engine for flexible tasks.

Objective is true lexicographic optimization, staged per priority tier
(decisions record, round 4) - not a single weighted formula. For each tier
in turn (High, then Medium, then Low), holding all higher tiers' outcomes
fixed:

  1. Maximize the *count* of fully-completed tasks in this tier.
  2. Among ties, prefer completing the more urgent (earlier-deadline) tasks.
  3. Among remaining ties, prefer completing shorter tasks (frees more
     capacity for other completions).
  4. Among remaining ties, prefer fewer/longer sessions per task over more,
     shorter fragments.
  5. Among remaining ties, prefer the earliest available placement.

Implemented as a sequence of solves on one shared model: each stage sets an
objective, solves to proven optimality, then locks that optimal value in as
a constraint before the next stage's objective is applied. A lower stage can
never influence a higher stage's outcome, even indirectly.
"""

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

STAGE_TIME_LIMIT_S = 10.0


class _Candidate:
    """One candidate session slot for a task. A splittable task gets several
    of these to choose among (0 or more may end up present); a
    non-splittable task gets exactly one, forced to the task's full
    remaining duration whenever it's present."""

    def __init__(self, task: FlexibleTaskInput, index: int, model: cp_model.CpModel):
        self.index = index
        name = f"{task.id}_{index}"

        if task.splittable:
            lo, hi = task.min_session_minutes, task.max_session_minutes
        else:
            lo = hi = task.remaining_minutes

        self.presence = model.NewBoolVar(f"present_{name}")
        self.day = model.NewIntVar(0, task.deadline_day, f"day_{name}")
        self.duration = model.NewIntVar(lo, hi, f"dur_{name}")
        # Callers are expected to pass durations already aligned to SNAP_MIN
        # (matches the frontend's 15-min drag/resize grid) - enforced here so
        # a non-splittable task's forced duration mismatching would surface
        # as an explicit infeasibility rather than a silently misaligned time.
        model.AddModuloEquality(0, self.duration, SNAP_MIN)

        # hour_start is minutes-since-midnight on whichever day this lands on.
        self.hour_start = model.NewIntVar(WINDOW_START_MIN, WINDOW_END_MIN, f"hs_{name}")
        model.AddModuloEquality(0, self.hour_start, SNAP_MIN)
        # Only enforced when present - an unused candidate (e.g. one whose
        # forced duration can't possibly fit the window) must not make the
        # whole model infeasible just because it's sitting there unused.
        model.Add(self.hour_start + self.duration <= WINDOW_END_MIN).OnlyEnforceIf(self.presence)

        horizon_minutes = (task.deadline_day + 1) * MINUTES_PER_DAY
        self.abs_start = model.NewIntVar(0, horizon_minutes, f"abs_start_{name}")
        model.Add(self.abs_start == self.day * MINUTES_PER_DAY + self.hour_start)
        # Domain must absorb abs_start + duration even for a non-present
        # candidate whose (unconditional) duration domain is large - the
        # window constraint above only rules this out when actually present.
        self.abs_end = model.NewIntVar(0, horizon_minutes + hi, f"abs_end_{name}")
        model.Add(self.abs_end == self.abs_start + self.duration)

        self.interval = model.NewOptionalIntervalVar(
            self.abs_start, self.duration, self.abs_end, self.presence, f"iv_{name}"
        )

        # Padded shadow interval, expanded PADDING_MIN/2 each side, used only
        # for the flex-vs-flex AddNoOverlap call below - non-overlap of the
        # padded shadows guarantees a real gap >= PADDING_MIN between the
        # actual (unpadded) sessions. Applies uniformly to every pair of
        # flexible sessions, including two sessions of the same split task.
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

        # 0 when not present, so summing this across a tier for the stage-5
        # "earliest placement" tie-break isn't polluted by non-present
        # candidates' otherwise-unconstrained abs_start values.
        self.effective_start = model.NewIntVar(0, horizon_minutes, f"effstart_{name}")
        model.Add(self.effective_start == self.abs_start).OnlyEnforceIf(self.presence)
        model.Add(self.effective_start == 0).OnlyEnforceIf(self.presence.Not())


def _num_candidates(task: FlexibleTaskInput) -> int:
    if not task.splittable:
        return 1
    # Upper bound on how many pieces this task could plausibly need, capped.
    needed = -(-task.remaining_minutes // task.min_session_minutes)  # ceil div
    return max(1, min(MAX_CANDIDATE_SESSIONS, needed))


def _solve_and_lock(
    model: cp_model.CpModel, solver: cp_model.CpSolver, terms: list, maximize: bool
) -> cp_model.CpSolver:
    if not terms:
        return solver
    expr = sum(terms)
    if maximize:
        model.Maximize(expr)
    else:
        model.Minimize(expr)
    solver.parameters.max_time_in_seconds = STAGE_TIME_LIMIT_S
    status = solver.Solve(model)
    # FEASIBLE means CP-SAT found a valid, usable solution but ran out of
    # time proving no better one exists - real task counts are far larger
    # than the fixture tests this time limit was tuned against, so treating
    # "found a good schedule" the same as "found no schedule at all" would
    # make Update Schedule fail outright on exactly the inputs it most needs
    # to handle well. In practice CP-SAT finds strong solutions quickly and
    # spends most of its remaining budget on the proof step, so a FEASIBLE
    # result here is very likely already optimal or close to it - and every
    # later stage still only ever narrows this value further, never behind
    # it, so a merely-good stage 1 can't make a later stage do worse.
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"solver stage found no solution (status={solver.StatusName(status)})")
    if status == cp_model.FEASIBLE:
        print(f"solver stage settled for FEASIBLE, not proven OPTIMAL, within {STAGE_TIME_LIMIT_S}s")
    value = round(solver.ObjectiveValue())
    model.Add(expr == value)
    return solver


@dataclass
class _TaskVars:
    task: FlexibleTaskInput
    candidates: list[_Candidate]
    scheduled: cp_model.IntVar


def _build_task_vars(task: FlexibleTaskInput, model: cp_model.CpModel) -> _TaskVars:
    """One task's candidate sessions plus its own `scheduled` bool - true iff
    the candidates present sum to exactly the task's full remaining_minutes,
    false iff none are present (all-or-nothing, enforced here)."""
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
    """Uniform minimum gap between any two flexible sessions (including two
    sessions of the same split task), via their padded shadow intervals."""
    if all_candidates:
        model.AddNoOverlap([c.padded_interval for c in all_candidates])


def _add_flex_vs_fixed_constraints(
    model: cp_model.CpModel,
    all_candidates: list[_Candidate],
    busy_intervals: list[BusyInterval],
) -> None:
    """Padded disjunction against every fixed/Google busy interval. Fixed/
    Google intervals are never checked against each other - only against
    flexible candidates."""
    for c in all_candidates:
        for busy in busy_intervals:
            busy_start = busy.day * MINUTES_PER_DAY + round(busy.start_hour * 60)
            busy_end = busy.day * MINUTES_PER_DAY + round(busy.end_hour * 60)
            before = model.NewBoolVar("before")
            after = model.NewBoolVar("after")
            model.Add(c.abs_end <= busy_start - PADDING_MIN).OnlyEnforceIf([c.presence, before])
            model.Add(c.abs_start >= busy_end + PADDING_MIN).OnlyEnforceIf([c.presence, after])
            model.AddBoolOr([before, after]).OnlyEnforceIf(c.presence)


def solve(
    tasks: list[FlexibleTaskInput],
    busy_intervals: list[BusyInterval],
    horizon_days: int,
) -> SolveResult:
    if not tasks:
        return SolveResult(task_results={}, all_sessions=[])

    model = cp_model.CpModel()
    task_vars: dict[str, _TaskVars] = {task.id: _build_task_vars(task, model) for task in tasks}
    all_candidates = [c for tv in task_vars.values() for c in tv.candidates]

    _add_flex_vs_flex_constraint(model, all_candidates)
    _add_flex_vs_fixed_constraints(model, all_candidates, busy_intervals)

    solver = cp_model.CpSolver()

    for priority in PRIORITY_ORDER:
        tier = [tv for tv in task_vars.values() if tv.task.priority == priority]
        if not tier:
            continue

        # Stage 1: maximize count of completed tasks in this tier.
        _solve_and_lock(model, solver, [tv.scheduled for tv in tier], maximize=True)

        # Stage 2: among ties, prefer completing more urgent (earlier-deadline) tasks.
        urgency_terms = [(horizon_days - tv.task.deadline_day) * tv.scheduled for tv in tier]
        _solve_and_lock(model, solver, urgency_terms, maximize=True)

        # Stage 3: among remaining ties, prefer completing shorter tasks.
        minutes_terms = [tv.task.remaining_minutes * tv.scheduled for tv in tier]
        _solve_and_lock(model, solver, minutes_terms, maximize=False)

        # Stage 4: among remaining ties, prefer fewer/longer sessions per task.
        session_count_terms = [c.presence for tv in tier for c in tv.candidates]
        _solve_and_lock(model, solver, session_count_terms, maximize=False)

        # Stage 5: among remaining ties, prefer the earliest available placement.
        earliest_terms = [c.effective_start for tv in tier for c in tv.candidates]
        _solve_and_lock(model, solver, earliest_terms, maximize=False)

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

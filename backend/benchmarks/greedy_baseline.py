"""A simple greedy scheduler: process tasks in priority/deadline order,
place each into the earliest slot it fits, never revisit an earlier
decision - the "obvious first attempt" a competent engineer would reach
for without a constraint solver. Built only to produce an honest
comparison against solver.engine.solve(); never used by the real app.
"""

from solver.constants import (
    MINUTES_PER_DAY,
    PADDING_MIN,
    PRIORITY_ORDER,
    SNAP_MIN,
    WINDOW_END_MIN,
    WINDOW_START_MIN,
)
from solver.types import BusyInterval, FlexibleTaskInput, SessionPlacement, SolveResult, TaskResult


def _fixed_occupied_windows(busy_intervals: list[BusyInterval]) -> list[tuple[int, int]]:
    """Fixed/Google busy intervals as absolute minute ranges, padded by the
    full PADDING_MIN on each side - matches the real solver's flex-vs-fixed
    rule, so the comparison is fair."""
    windows = []
    for b in busy_intervals:
        start = b.day * MINUTES_PER_DAY + round(b.start_hour * 60) - PADDING_MIN
        end = b.day * MINUTES_PER_DAY + round(b.end_hour * 60) + PADDING_MIN
        windows.append((start, end))
    return windows


def _fits(start: int, end: int, occupied: list[tuple[int, int]]) -> bool:
    return not any(start < o_end and end > o_start for o_start, o_end in occupied)


def _find_slot(
    duration: int, deadline_day: int, occupied: list[tuple[int, int]], start_from: int = 0
) -> tuple[int, int] | None:
    """Earliest [start, end) of exactly `duration` minutes, within the
    8AM-11PM window on some day 0..deadline_day, clear of every occupied
    window, snapped to SNAP_MIN, never scanning earlier than start_from."""
    for day in range(deadline_day + 1):
        day_start = max(day * MINUTES_PER_DAY + WINDOW_START_MIN, start_from)
        if day_start % SNAP_MIN:
            day_start += SNAP_MIN - (day_start % SNAP_MIN)
        day_end = day * MINUTES_PER_DAY + WINDOW_END_MIN
        start = day_start
        while start + duration <= day_end:
            end = start + duration
            if _fits(start, end, occupied):
                return start, end
            start += SNAP_MIN
    return None


def _place_task(task: FlexibleTaskInput, occupied: list[tuple[int, int]]) -> list[tuple[int, int]] | None:
    """Greedily finds session(s) covering the task's full remaining_minutes.
    All-or-nothing, like the real solver: returns None if the full duration
    can't be found before the deadline, rather than a partial placement."""
    if not task.splittable:
        window = _find_slot(task.remaining_minutes, task.deadline_day, occupied)
        return [window] if window else None

    placements: list[tuple[int, int]] = []
    local_occupied = list(occupied)
    remaining = task.remaining_minutes
    cursor = 0

    while remaining > 0:
        duration = min(task.max_session_minutes, remaining)
        duration -= duration % SNAP_MIN
        if duration < task.min_session_minutes:
            return None
        window = _find_slot(duration, task.deadline_day, local_occupied, start_from=cursor)
        if window is None:
            return None
        start, end = window
        placements.append((start, end))
        half = PADDING_MIN // 2
        local_occupied.append((start - half, end + half))
        remaining -= duration
        cursor = end

    return placements


def solve_greedy(
    tasks: list[FlexibleTaskInput],
    busy_intervals: list[BusyInterval],
    horizon_days: int,
) -> SolveResult:
    """Same input/output shape as solver.engine.solve(), so callers can
    compare the two directly. horizon_days is accepted only for signature
    symmetry with the real solver - each task's own deadline_day already
    bounds how far this scans."""
    del horizon_days
    priority_rank = {p: i for i, p in enumerate(PRIORITY_ORDER)}
    ordered = sorted(tasks, key=lambda t: (priority_rank[t.priority], t.deadline_day, t.remaining_minutes))

    occupied = _fixed_occupied_windows(busy_intervals)
    task_results: dict[str, TaskResult] = {}
    all_sessions: list[SessionPlacement] = []

    for task in ordered:
        placements = _place_task(task, occupied)
        if placements is None:
            task_results[task.id] = TaskResult(task_id=task.id, scheduled=False, sessions=[])
            continue

        sessions = []
        for start, end in placements:
            day = start // MINUTES_PER_DAY
            placement = SessionPlacement(
                task_id=task.id,
                day=day,
                start_hour=(start - day * MINUTES_PER_DAY) / 60,
                end_hour=(end - day * MINUTES_PER_DAY) / 60,
            )
            sessions.append(placement)
            all_sessions.append(placement)
            half = PADDING_MIN // 2
            occupied.append((start - half, end + half))
        task_results[task.id] = TaskResult(task_id=task.id, scheduled=True, sessions=sessions)

    return SolveResult(task_results=task_results, all_sessions=all_sessions)

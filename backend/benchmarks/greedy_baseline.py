"""A simple greedy scheduler. It goes through tasks in priority/deadline
order, places each one in the earliest slot that fits, and never
revisits an earlier choice - the "obvious first try" you'd reach for
without a real solver. Built only to compare against
solver.engine.solve(); the real app never uses this.
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
    """Turns fixed/Google busy intervals into absolute minute ranges,
    padded by PADDING_MIN on each side. Matches the real solver's
    flex-vs-fixed rule, so the comparison stays fair."""
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
    """Finds the earliest open slot of exactly `duration` minutes. Searches
    days 0 to deadline_day, inside the 8AM-11PM window, snapped to
    SNAP_MIN, avoiding every occupied window. Never looks earlier than
    start_from."""
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
    """Greedily finds session(s) that cover the task's full
    remaining_minutes. All-or-nothing, like the real solver: returns None
    if it can't fit the full duration before the deadline, instead of a
    partial placement."""
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
    compare them directly. horizon_days is accepted only to match the
    real solver's signature - each task's own deadline_day already
    limits the search."""
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

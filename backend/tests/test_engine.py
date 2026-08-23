"""Fixture-driven tests for the core CP-SAT engine.

Each test isolates one specific scheduling rule, so a future change that
breaks one piece of behavior fails precisely, not vaguely.
"""

from unittest.mock import patch

from solver.engine import solve
from solver.types import BusyInterval, FlexibleTaskInput


def task(
    id,
    priority="Medium",
    deadline_day=0,
    remaining_minutes=60,
    min_session_minutes=30,
    max_session_minutes=120,
    splittable=False,
):
    return FlexibleTaskInput(
        id=id,
        priority=priority,
        deadline_day=deadline_day,
        remaining_minutes=remaining_minutes,
        min_session_minutes=min_session_minutes,
        max_session_minutes=max_session_minutes,
        splittable=splittable,
    )


def busy(day, start_hour, end_hour):
    return BusyInterval(day=day, start_hour=start_hour, end_hour=end_hour)


def total_minutes(sessions):
    return sum(round((s.end_hour - s.start_hour) * 60) for s in sessions)


# ---------------------------------------------------------------------------
# One impossible task must not break the whole solve.
# ---------------------------------------------------------------------------


def test_over_capacity_task_reports_unscheduled_others_still_placed():
    impossible = task(
        "huge", priority="High", deadline_day=0, remaining_minutes=20 * 60,
        splittable=False,
    )
    fine = task("small", priority="Medium", deadline_day=0, remaining_minutes=60, splittable=False)

    result = solve([impossible, fine], busy_intervals=[], horizon_days=1)

    assert result.task_results["huge"].scheduled is False
    assert result.task_results["huge"].sessions == []
    assert result.task_results["small"].scheduled is True
    assert total_minutes(result.task_results["small"].sessions) == 60


# ---------------------------------------------------------------------------
# Priority wins regardless of task length.
# ---------------------------------------------------------------------------


def test_high_priority_short_task_wins_contested_slot_over_medium_long_task():
    # Only usable capacity in the whole horizon: a 60-min gap at day0 22:00-23:00.
    busy_intervals = [
        busy(0, 9.0, 21.5),  # padded [8:30, 22:00] -> leaves [8:00,8:30]=30min, [22:00,23:00]=60min
    ]
    high_short = task("algorithms", priority="High", deadline_day=0, remaining_minutes=60, splittable=False)
    medium_long = task(
        "reading", priority="Medium", deadline_day=0, remaining_minutes=90,
        splittable=True, min_session_minutes=30, max_session_minutes=60,
    )
    # medium_long could use both gaps (30+60=90) if high_short weren't
    # there. But both tasks need the same 60-min gap - real contention.

    result = solve([high_short, medium_long], busy_intervals=busy_intervals, horizon_days=1)

    assert result.task_results["algorithms"].scheduled is True
    assert result.task_results["reading"].scheduled is False


# ---------------------------------------------------------------------------
# Objective tier 2: equal priority, earlier deadline wins a contested slot.
# ---------------------------------------------------------------------------


def test_equal_priority_earlier_deadline_wins_contested_slot():
    # Only one 60-min slot exists in the whole 2-day horizon (day0 22:00-23:00).
    # Day1 only has a 30-min gap, too short for either task.
    busy_intervals = [
        busy(0, 8.0, 21.5),  # padded [7:30,22:00] -> leaves [22:00,23:00]=60min on day0
        busy(1, 8.0, 22.5),  # padded [7:30,23:00] -> leaves [22:30,23:00]=30min on day1 (too short)
    ]
    due_soon = task("algorithms", priority="Medium", deadline_day=0, remaining_minutes=60, splittable=False)
    due_later = task("reading", priority="Medium", deadline_day=1, remaining_minutes=60, splittable=False)

    result = solve([due_soon, due_later], busy_intervals=busy_intervals, horizon_days=2)

    assert result.task_results["algorithms"].scheduled is True
    assert result.task_results["reading"].scheduled is False


# ---------------------------------------------------------------------------
# Objective tier 3: equal priority and urgency, shorter task wins.
# ---------------------------------------------------------------------------


def test_equal_priority_equal_deadline_shorter_task_preferred():
    # Exactly one 180-min block is free. short(60) and long(180) each fit
    # alone, but not together (60+180 > 180) - real contention, same
    # deadline.
    busy_intervals = [busy(0, 8.0, 19.5)]  # padded [7:30,20:00] -> leaves [20:00,23:00]=180min
    short_task = task("gym", priority="Medium", deadline_day=0, remaining_minutes=60, splittable=False)
    long_task = task("thesis", priority="Medium", deadline_day=0, remaining_minutes=180, splittable=False)

    result = solve([short_task, long_task], busy_intervals=busy_intervals, horizon_days=1)

    assert result.task_results["gym"].scheduled is True
    assert result.task_results["thesis"].scheduled is False


# ---------------------------------------------------------------------------
# This test checks the full chain in one scenario: count, then urgency
# (both within High), then High completely blocking Medium from the same
# slot. The tests above only check one step at a time - none of them
# prove the steps work correctly together.
#
# Stage 3 (shorter-task) is not tested again here - it's already covered
# by test_equal_priority_equal_deadline_shorter_task_preferred. Adding it
# here too would need much more complex numbers, without testing anything
# new.
# ---------------------------------------------------------------------------


def test_full_chain_count_then_urgency_then_locks_out_medium_entirely():
    # Every day is fully blocked except one 60-min slot on day0. H1 and H2
    # both need that exact slot - nowhere else is open in the whole 6-day
    # horizon - so only one High task can be scheduled. Urgency then picks
    # H1 (due day0) over H2 (due day5). M1 wants the same slot but is
    # Medium priority, so it gets nothing - even though it would have fit
    # fine if neither High task existed.
    busy_intervals = [busy(0, 8.0, 21.5)]  # leaves [22:00,23:00] on day0
    busy_intervals += [busy(d, 8.0, 23.0) for d in range(1, 6)]  # every other day fully blocked

    h1_due_soon = task("h1", priority="High", deadline_day=0, remaining_minutes=60, splittable=False)
    h2_due_later = task("h2", priority="High", deadline_day=5, remaining_minutes=60, splittable=False)
    m1_same_slot = task("m1", priority="Medium", deadline_day=0, remaining_minutes=60, splittable=False)

    result = solve(
        [h1_due_soon, h2_due_later, m1_same_slot], busy_intervals=busy_intervals, horizon_days=6
    )

    # Stage 1 (count) + stage 2 (urgency): only one High task fits - the
    # one with the sooner deadline.
    assert result.task_results["h1"].scheduled is True
    assert result.task_results["h2"].scheduled is False
    # Medium never gets a chance at High's slot, even though m1 could
    # have used it just as well.
    assert result.task_results["m1"].scheduled is False


# ---------------------------------------------------------------------------
# Final tie-break: earliest available placement, once every higher-priority
# objective is already locked.
# ---------------------------------------------------------------------------


def test_earliest_slot_preferred_when_all_higher_stages_are_tied():
    # Two separate gaps for the *same single task*: an early one
    # (8:00-9:00) and a big late one (15:00-23:00). Nothing else competes
    # for either gap, so stages 1-4 (count, urgency, minutes, session
    # count) don't care which one gets picked - the task is the same
    # either way. Only stage 5 can be the reason the early gap wins.
    busy_intervals = [busy(0, 9.5, 14.5)]  # padded [9:00,15:00] -> gaps [8:00,9:00] and [15:00,23:00]
    only_task = task("gym", priority="High", deadline_day=0, remaining_minutes=60, splittable=False)

    result = solve([only_task], busy_intervals=busy_intervals, horizon_days=1)

    assert result.task_results["gym"].scheduled is True
    session = result.task_results["gym"].sessions[0]
    assert session.start_hour == 8.0, (
        f"expected the earliest available slot (8:00), got {session.start_hour}"
    )


# ---------------------------------------------------------------------------
# All-or-nothing: no partial placement when full duration can't fit.
# ---------------------------------------------------------------------------


def test_all_or_nothing_no_partial_placement_when_insufficient_capacity():
    # Only 120 min free; task needs 180 - must get nothing, not a 120-min slice.
    busy_intervals = [busy(0, 8.0, 20.5)]  # padded [7:30,21:00] -> leaves [21:00,23:00]=120min
    big_task = task(
        "thesis", priority="High", deadline_day=0, remaining_minutes=180,
        splittable=True, min_session_minutes=30, max_session_minutes=90,
    )

    result = solve([big_task], busy_intervals=busy_intervals, horizon_days=1)

    assert result.task_results["thesis"].scheduled is False
    assert result.task_results["thesis"].sessions == []


# ---------------------------------------------------------------------------
# Padding around fixed/Google events.
# ---------------------------------------------------------------------------


def test_padding_makes_a_would_otherwise_fit_slot_infeasible():
    # The raw gap between the two busy blocks is exactly 30 min. It would
    # fit a 30-min task with no padding, but 30-min padding on each side
    # eats up the whole gap.
    busy_intervals = [busy(0, 8.0, 9.75), busy(0, 10.25, 23.0)]
    small_task = task("quick", priority="Medium", deadline_day=0, remaining_minutes=30, splittable=False)

    result = solve([small_task], busy_intervals=busy_intervals, horizon_days=1)

    assert result.task_results["quick"].scheduled is False


def test_padded_zone_around_fixed_event_never_used_for_placement():
    busy_intervals = [busy(0, 10.0, 11.0)]
    # Big enough to use most of the day, but not so big it's infeasible.
    # Free time ignoring padding = 14h - 1h = 13h = 780min. With padding,
    # the event removes [9.5,11.5] (2h), leaving 12h = 720min - plenty for
    # a 600-min splittable task.
    big_task = task(
        "study", priority="High", deadline_day=0, remaining_minutes=600,
        splittable=True, min_session_minutes=30, max_session_minutes=120,
    )

    result = solve([big_task], busy_intervals=busy_intervals, horizon_days=1)

    assert result.task_results["study"].scheduled is True
    for s in result.task_results["study"].sessions:
        assert s.end_hour <= 9.5 or s.start_hour >= 11.5, (
            f"session {s.start_hour}-{s.end_hour} intrudes on the padded zone around the 10-11 event"
        )


# ---------------------------------------------------------------------------
# Padding between two flexible sessions (different tasks).
# ---------------------------------------------------------------------------


def test_minimum_gap_enforced_between_two_flexible_sessions():
    # Free region is exactly 150 min (8:00-10:30): just enough for 60+30gap+60.
    busy_intervals = [busy(0, 11.0, 23.0)]
    a = task("a", priority="High", deadline_day=0, remaining_minutes=60, splittable=False)
    b = task("b", priority="High", deadline_day=0, remaining_minutes=60, splittable=False)

    result = solve([a, b], busy_intervals=busy_intervals, horizon_days=1)

    assert result.task_results["a"].scheduled is True
    assert result.task_results["b"].scheduled is True
    sess_a = result.task_results["a"].sessions[0]
    sess_b = result.task_results["b"].sessions[0]
    first, second = sorted([sess_a, sess_b], key=lambda s: s.start_hour)
    gap_minutes = round((second.start_hour - first.end_hour) * 60)
    assert gap_minutes >= 30


# ---------------------------------------------------------------------------
# Window bounds: never before 8AM, never after 11PM.
# ---------------------------------------------------------------------------


def test_sessions_never_placed_outside_the_8am_to_11pm_window():
    # 300 min fits easily in the open 900-min window, with room for 30-min
    # gaps between sessions. Big enough to force real placement, but far
    # from the window's actual limit - that limit isn't what this test
    # checks.
    big_task = task(
        "study", priority="High", deadline_day=0, remaining_minutes=300,
        splittable=True, min_session_minutes=30, max_session_minutes=120,
    )

    result = solve([big_task], busy_intervals=[], horizon_days=1)

    assert result.task_results["study"].scheduled is True
    for s in result.task_results["study"].sessions:
        assert s.start_hour >= 8.0
        assert s.end_hour <= 23.0


# ---------------------------------------------------------------------------
# Split rules: min/max session length is respected. A non-splittable task
# always gets exactly 1 session.
# ---------------------------------------------------------------------------


def test_splittable_task_sessions_respect_min_and_max_length():
    splittable_task = task(
        "reading", priority="High", deadline_day=0, remaining_minutes=180,
        splittable=True, min_session_minutes=45, max_session_minutes=90,
    )

    result = solve([splittable_task], busy_intervals=[], horizon_days=1)

    sessions = result.task_results["reading"].sessions
    assert result.task_results["reading"].scheduled is True
    assert len(sessions) >= 1
    for s in sessions:
        duration = round((s.end_hour - s.start_hour) * 60)
        assert 45 <= duration <= 90


def test_non_splittable_task_produces_exactly_one_session():
    single = task("gym", priority="High", deadline_day=0, remaining_minutes=90, splittable=False)

    result = solve([single], busy_intervals=[], horizon_days=1)

    sessions = result.task_results["gym"].sessions
    assert result.task_results["gym"].scheduled is True
    assert len(sessions) == 1
    assert round((sessions[0].end_hour - sessions[0].start_hour) * 60) == 90


def test_splitting_prefers_fewer_longer_sessions_over_more_fragments():
    # 180 min, splittable 30-120: could split as 1.5h+1.5h, or 1h+1h+1h,
    # etc. Stage 4 should prefer the fewest sessions (2, close to max
    # length) over splitting into 3+ pieces for no reason.
    splittable_task = task(
        "reading", priority="High", deadline_day=0, remaining_minutes=180,
        splittable=True, min_session_minutes=30, max_session_minutes=120,
    )

    result = solve([splittable_task], busy_intervals=[], horizon_days=1)

    sessions = result.task_results["reading"].sessions
    assert result.task_results["reading"].scheduled is True
    assert len(sessions) == 2, f"expected 2 sessions (fewest possible), got {len(sessions)}: {sessions}"


# ---------------------------------------------------------------------------
# Fixed/Google events are never constrained against each other.
# ---------------------------------------------------------------------------


def test_overlapping_fixed_events_do_not_break_the_solve():
    overlapping = [busy(0, 10.0, 12.0), busy(0, 11.0, 13.0)]
    elsewhere = task("gym", priority="High", deadline_day=0, remaining_minutes=60, splittable=False)

    result = solve([elsewhere], busy_intervals=overlapping, horizon_days=1)

    assert result.task_results["gym"].scheduled is True


# ---------------------------------------------------------------------------
# Every placement must align to the 15-min grid.
#
# This has to be a *feasibility* test, not just a "does the output look
# aligned" test. An earlier version kept passing even after the alignment
# rule was deleted, because CP-SAT happened to land on clean values by
# luck. A test that passes whether or not the bug exists proves nothing.
#
# Here, the gap between two busy intervals is sized so the task fits in
# exactly one position, and that position is not 15-min aligned. So
# alignment isn't just a preference the solver might stumble into - it's
# the actual difference between feasible and not.
# ---------------------------------------------------------------------------


def test_task_that_only_fits_a_misaligned_slot_is_left_unscheduled():
    # The free gap (after padding) is exactly [566, 596] minutes-since-
    # midnight, i.e. 9:26-9:56. That's 30 minutes wide, matching the task
    # exactly - but neither boundary is a multiple of 15 (566 % 15 == 11,
    # 596 % 15 == 11).
    busy_intervals = [
        busy(0, 480 / 60, 536 / 60),  # 8:00-8:56, padded end = 566
        busy(0, 626 / 60, 1380 / 60),  # 10:26-23:00, padded start = 596
    ]
    only_fits_misaligned = task(
        "quick", priority="High", deadline_day=0, remaining_minutes=30, splittable=False
    )

    result = solve([only_fits_misaligned], busy_intervals=busy_intervals, horizon_days=1)

    # The only slot that satisfies duration+window+padding is [566,596].
    # The 15-min grid rule correctly blocks it, so this task must come
    # back unscheduled - not silently placed at 9:26.
    assert result.task_results["quick"].scheduled is False


def test_splittable_task_placements_align_to_15_minute_grid():
    splittable_task = task(
        "reading", priority="High", deadline_day=0, remaining_minutes=195,
        splittable=True, min_session_minutes=45, max_session_minutes=105,
    )

    result = solve([splittable_task], busy_intervals=[], horizon_days=1)

    assert result.task_results["reading"].scheduled is True
    for s in result.task_results["reading"].sessions:
        start_min = round(s.start_hour * 60)
        end_min = round(s.end_hour * 60)
        assert start_min % 15 == 0, f"start {s.start_hour} not 15-min aligned"
        assert end_min % 15 == 0, f"end {s.end_hour} not 15-min aligned"


# ---------------------------------------------------------------------------
# No tasks at all.
# ---------------------------------------------------------------------------


def test_empty_task_list_returns_empty_result():
    result = solve([], busy_intervals=[busy(0, 10.0, 11.0)], horizon_days=1)

    assert result.task_results == {}
    assert result.all_sessions == []


# ---------------------------------------------------------------------------
# A stage that only reaches FEASIBLE (not proven OPTIMAL) in time must
# still be accepted, not treated as a failure. Real task counts are much
# bigger than any fixture above, and this is exactly what happened in
# production: a stage timed out on the *proof* step while it already had
# a good, feasible solution.
#
# This test is confirmed to actually catch the bug, not just pass by
# luck: with STAGE_TIME_LIMIT_S patched down, the old check
# (status != OPTIMAL) raises on this exact scenario, and the fix accepts
# it.
#
# This test depends on timing, so it can't be made fully deterministic -
# the only way to reliably force FEASIBLE-not-OPTIMAL is single-threaded
# search, which isn't what production actually runs. 0.3s worked alone
# but flaked under real machine load. 3.0s has been reliable with more
# margin, and is still fast enough to not slow down the test suite.
# ---------------------------------------------------------------------------


def test_feasible_but_unproven_optimal_stage_result_is_accepted():
    # 10 splittable tasks across a full 14-day horizon, with daily
    # contention. Complex enough that proving optimality takes real
    # search time, even though CP-SAT finds a full, valid solution fast.
    tasks = [
        task(
            f"t{i}", priority="High", deadline_day=13, remaining_minutes=180,
            min_session_minutes=30, max_session_minutes=90, splittable=True,
        )
        for i in range(10)
    ]
    busy_intervals = [busy(d, 12.0, 13.0) for d in range(14)]

    with patch("solver.engine.STAGE_TIME_LIMIT_S", 3.0):
        result = solve(tasks, busy_intervals=busy_intervals, horizon_days=14)

    # We don't check the exact placement, since a FEASIBLE-not-OPTIMAL
    # result can differ between runs. We only check that the call
    # succeeded and returned a complete, valid result - which is exactly
    # what the old code refused to do.
    assert len(result.task_results) == 10
    for r in result.task_results.values():
        assert r.scheduled is True
        assert total_minutes(r.sessions) == 180

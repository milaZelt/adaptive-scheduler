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
# Graceful infeasibility: one impossible task must not sink the whole solve.
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
# Objective: priority is duration-agnostic.
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
    # medium_long could use both gaps (30+60=90) if high_short didn't exist,
    # but they both need the 60-min gap - genuine contention.

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
    # Exactly one 180-min block free; short(60) and long(180) both fit alone,
    # not together (60+180 > 180) - genuine contention, same deadline.
    busy_intervals = [busy(0, 8.0, 19.5)]  # padded [7:30,20:00] -> leaves [20:00,23:00]=180min
    short_task = task("gym", priority="Medium", deadline_day=0, remaining_minutes=60, splittable=False)
    long_task = task("thesis", priority="Medium", deadline_day=0, remaining_minutes=180, splittable=False)

    result = solve([short_task, long_task], busy_intervals=busy_intervals, horizon_days=1)

    assert result.task_results["gym"].scheduled is True
    assert result.task_results["thesis"].scheduled is False


# ---------------------------------------------------------------------------
# Full lexicographic chain in one scenario: count, then urgency (both within
# High), then complete dominance over Medium for the same resource. The
# tests above each isolate one transition, but none prove the tiers compose
# correctly end to end. Stage 3 (shorter-task) isn't re-proven here - it's
# already covered by test_equal_priority_equal_deadline_shorter_task_preferred,
# and cramming all three stages plus cross-tier dominance into one scenario
# would need much more contrived numbers for no added rigor.
# ---------------------------------------------------------------------------


def test_full_chain_count_then_urgency_then_locks_out_medium_entirely():
    # Every day is fully blocked except a single 60-min slot on day0. H1 and
    # H2 both need that exact slot (nowhere else is open anywhere in the
    # 6-day horizon), so only one High task can be scheduled - urgency must
    # then pick H1 (due day0) over H2 (due day5). M1 wants the identical
    # slot and is Medium priority - it must come away with nothing, even
    # though it would have fit perfectly had either High task not existed.
    busy_intervals = [busy(0, 8.0, 21.5)]  # leaves [22:00,23:00] on day0
    busy_intervals += [busy(d, 8.0, 23.0) for d in range(1, 6)]  # every other day fully blocked

    h1_due_soon = task("h1", priority="High", deadline_day=0, remaining_minutes=60, splittable=False)
    h2_due_later = task("h2", priority="High", deadline_day=5, remaining_minutes=60, splittable=False)
    m1_same_slot = task("m1", priority="Medium", deadline_day=0, remaining_minutes=60, splittable=False)

    result = solve(
        [h1_due_soon, h2_due_later, m1_same_slot], busy_intervals=busy_intervals, horizon_days=6
    )

    # Stage 1 (count) + stage 2 (urgency): only one High task can fit: the
    # sooner-deadline one.
    assert result.task_results["h1"].scheduled is True
    assert result.task_results["h2"].scheduled is False
    # Cross-tier dominance: Medium never gets a look-in at High's resource,
    # even though m1 is individually just as capable of using that slot.
    assert result.task_results["m1"].scheduled is False


# ---------------------------------------------------------------------------
# Final tie-break: earliest available placement, once every higher-priority
# objective is already locked.
# ---------------------------------------------------------------------------


def test_earliest_slot_preferred_when_all_higher_stages_are_tied():
    # Two isolated gaps for the *same single task*: an early one (8:00-9:00)
    # and a large late one (15:00-23:00). Nothing else competes for either,
    # so stages 1-4 (count, urgency, total minutes, session count) are
    # completely indifferent between them - whichever gap gets picked, the
    # task itself is identical either way. Only stage 5 can be responsible
    # for preferring the early gap over the late one.
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
    # Raw gap between the two busy blocks is exactly 30 min - would fit a
    # 30-min task with zero padding, but 30-min padding on each side of each
    # busy interval consumes the entire gap.
    busy_intervals = [busy(0, 8.0, 9.75), busy(0, 10.25, 23.0)]
    small_task = task("quick", priority="Medium", deadline_day=0, remaining_minutes=30, splittable=False)

    result = solve([small_task], busy_intervals=busy_intervals, horizon_days=1)

    assert result.task_results["quick"].scheduled is False


def test_padded_zone_around_fixed_event_never_used_for_placement():
    busy_intervals = [busy(0, 10.0, 11.0)]
    # Big enough to force use of most of the day, but not so big it's infeasible:
    # free capacity ignoring padding = 14h - 1h = 13h = 780min; with padding the
    # event effectively removes [9.5,11.5] (2h), leaving 12h = 720min - plenty
    # for a 600-min splittable task.
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
    # 300 min comfortably fits an open 900-min window with room for 30-min
    # gaps between sessions - large enough to force real placement, not so
    # large it approaches the window's actual capacity limit (irrelevant to
    # what this test checks).
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
# Split mechanics: min/max session length respected; non-splittable = 1 session.
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
    # 180 min, splittable 30-120: could be e.g. 1.5h+1.5h or 1h+1h+1h etc.
    # Objective tier 4 should prefer the fewest sessions (2, using close to
    # the max length) over needlessly fragmenting into 3+.
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
# Time granularity: every placement aligns to the 15-min grid.
#
# This must be a *feasibility* test, not just a "does the output look
# aligned" test - an earlier version kept passing even with the alignment
# constraint deleted, because CP-SAT happened to land on clean values by
# chance. A test that passes whether or not the bug exists proves nothing.
# Here the gap between two busy intervals is sized to fit the task at
# exactly one non-15-aligned position - so alignment isn't just a
# preference the solver might stumble into, it's the difference between
# feasible and not.
# ---------------------------------------------------------------------------


def test_task_that_only_fits_a_misaligned_slot_is_left_unscheduled():
    # Free gap (after padding) is exactly [566, 596] minutes-since-midnight
    # = 9:26-9:56 - 30 minutes wide, matching the task exactly, but neither
    # boundary is a multiple of 15 (566 % 15 == 11, 596 % 15 == 11).
    busy_intervals = [
        busy(0, 480 / 60, 536 / 60),  # 8:00-8:56, padded end = 566
        busy(0, 626 / 60, 1380 / 60),  # 10:26-23:00, padded start = 596
    ]
    only_fits_misaligned = task(
        "quick", priority="High", deadline_day=0, remaining_minutes=30, splittable=False
    )

    result = solve([only_fits_misaligned], busy_intervals=busy_intervals, horizon_days=1)

    # The only slot that satisfies duration+window+padding is [566,596], which
    # the 15-min grid constraint correctly forbids - so this must come back
    # unscheduled, not silently placed at 9:26.
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
# A stage that only reaches FEASIBLE (not proven OPTIMAL) within its time
# budget must still be accepted, not treated as a failure - real task counts
# are far larger than every fixture above, and this is what production
# actually hit with real user data: a stage timing out on the *proof* step
# while still holding a perfectly good, checked-feasible solution. Confirmed
# to actually discriminate, not just pass: with STAGE_TIME_LIMIT_S patched
# down for this fixture, the pre-fix check (status != OPTIMAL) raises on
# this exact scenario; the fix accepts it.
#
# This is inherently a timing-based test - there's no reliable way to force
# CP-SAT's default parallel search to land on FEASIBLE-not-OPTIMAL other
# than forcing single-threaded search, which would no longer represent what
# production actually runs. 0.3s originally worked in isolation but flaked
# under real machine load (other test/build tooling running at the same
# time). 3.0s has held reliably with a lot more margin, and is still fast
# enough not to slow the suite down.
# ---------------------------------------------------------------------------


def test_feasible_but_unproven_optimal_stage_result_is_accepted():
    # 10 splittable tasks across a full 14-day horizon with daily contention
    # - enough combinatorial depth that proving optimality takes a bit of
    # real search, even though CP-SAT finds a complete, valid solution fast.
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

    # Not asserting a specific placement (a FEASIBLE-not-OPTIMAL result is
    # allowed to differ run-to-run within CP-SAT's search) - just that the
    # call succeeded at all and returned a complete, structurally valid
    # result, which is exactly what the pre-fix code refused to do.
    assert len(result.task_results) == 10
    for r in result.task_results.values():
        assert r.scheduled is True
        assert total_minutes(r.sessions) == 180

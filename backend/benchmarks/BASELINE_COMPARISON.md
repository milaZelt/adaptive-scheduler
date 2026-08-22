# Solver vs. greedy baseline

Does the CP-SAT solver actually do better than the obvious first attempt
someone would write without it? Answered empirically, not assumed.

## Setup

- **Greedy baseline** (`greedy_baseline.py`): sorts tasks by priority, then
  deadline, then duration; places each into the earliest slot it fits;
  never revisits an earlier decision. The same rules as the real solver
  (8AM-11PM window, 30-min padding, all-or-nothing per task) so the
  comparison is fair - the only difference is *how* a slot gets chosen.
- **40 test scenarios** (`compare_baseline.py`), each with 12 tasks and a
  calendar busy 9AM-8PM every day for 7 days - deliberately tight, so
  tasks genuinely compete for the little free time left. Deterministic
  per seed (not random), so every run is reproducible.
- Both schedulers run on the exact same 40 scenarios. Solver runs use the
  same single-core, time-capped safety posture as the rest of
  `backend/benchmarks/`.

## Results

**High-priority tasks completed** - the number that matters most:

| | Count |
|---|---|
| Solver scheduled more than greedy | 19 / 40 |
| Tied | 21 / 40 |
| **Greedy scheduled more than solver** | **0 / 40 - never** |

Solver: 121 high-priority tasks completed. Greedy: 102. **+18.6%, with zero
losses across all 40 scenarios.**

**All tasks combined** (every priority level) - solver: 201, greedy: 187
(+7.5%). Wins more often than not (19/40 vs. 5/40, 16 ties) but not
strictly dominant like the high-priority number - see the caveat below.

## Why greedy occasionally wins on total count, never on high-priority

The solver locks in each priority tier before moving to the next, and
within a tier its tie-break rules (earlier deadline, then shorter task,
then fewest sessions, then earliest slot) only consider that tier - never
how the choice affects tiers solved afterward. So in rare cases the
solver's tier-locally-optimal placement leaves a worse-shaped gap for
lower tiers than a different, equally valid placement would have. Not a
bug - a real consequence of a strictly sequential, no-lookahead
lexicographic design that never lets a lower tier influence a higher
one's outcome, even indirectly. Confirmed this isn't a time-limit
artifact by re-running an affected scenario with a much larger time
budget (20s vs. the normal 3s cap) - the result didn't change.

## The one-line, no-asterisk claim

> Benchmarked against a greedy baseline across 40 contested-capacity
> scenarios: the CP-SAT solver matched or exceeded greedy on high-priority
> task completion in 100% of cases (+18.6% on average), never once
> sacrificing higher-priority work the way a naive approach occasionally
> does.

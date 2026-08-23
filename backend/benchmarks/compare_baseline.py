"""Compares the real CP-SAT solver against the greedy baseline
(greedy_baseline.py). Uses scenarios where capacity is deliberately
tight, so tasks really compete for the same time. This gives a real,
measured answer to "does the solver actually beat the obvious first
try, and by how much?" instead of just assuming it.

Same safety limits as bench_solver.py: one CPU core, a tight time limit
per stage, small scenarios. The greedy side is free (plain Python, no
solving) - only the real-solver calls are capped.

Run: python -m benchmarks.compare_baseline [--quick]
(from backend/, with the venv active)
"""

import argparse
import json
from pathlib import Path
from unittest.mock import patch

from benchmarks._solver_patch import force_single_worker
from benchmarks.greedy_baseline import solve_greedy
from solver.constants import PRIORITY_ORDER
from solver.engine import solve
from solver.types import BusyInterval, FlexibleTaskInput

# Same single-worker, tight-time-limit setup as bench_solver.py - see
# _solver_patch.py for why. Both scripts use the same function, so they
# can't drift out of sync on how it's applied.
COMPARE_STAGE_TIME_LIMIT_S = 3.0
force_single_worker()

HORIZON_DAYS = 7


def make_scarce_scenario(seed: int, task_count: int) -> tuple[list[FlexibleTaskInput], list[BusyInterval]]:
    """A scenario made tight on purpose: most of each day is busy, so
    tasks really compete for the little free time left. This differs
    from bench_solver.py's scenarios, which are built for timing, not
    for contention. It's deterministic per seed, not random, so a run
    can be repeated exactly."""
    tasks = []
    for i in range(task_count):
        priority = PRIORITY_ORDER[(seed + i) % len(PRIORITY_ORDER)]
        splittable = (seed + i) % 3 == 0
        remaining_minutes = 45 + ((seed + i) % 5) * 15
        deadline_day = (i % max(1, HORIZON_DAYS // 2))  # bunch deadlines into the first half
        tasks.append(
            FlexibleTaskInput(
                id=f"t{i}",
                priority=priority,
                deadline_day=deadline_day,
                remaining_minutes=remaining_minutes,
                min_session_minutes=30 if splittable else remaining_minutes,
                max_session_minutes=60 if splittable else remaining_minutes,
                splittable=splittable,
            )
        )
    # Busy 9AM-8PM every day. That leaves only 8-9AM and 8-11PM free
    # (4h/day), instead of bench_solver.py's 12h/day - real scarcity.
    busy = [BusyInterval(day=d, start_hour=9.0, end_hour=20.0) for d in range(HORIZON_DAYS)]
    return tasks, busy


def _count_scheduled(result, tasks: list[FlexibleTaskInput], priority: str | None = None) -> int:
    ids = {t.id for t in tasks if priority is None or t.priority == priority}
    return sum(1 for tid, r in result.task_results.items() if tid in ids and r.scheduled)


def compare_one(seed: int, task_count: int) -> dict:
    tasks, busy = make_scarce_scenario(seed, task_count)

    greedy_result = solve_greedy(tasks, busy, horizon_days=HORIZON_DAYS)
    with patch("solver.engine.STAGE_TIME_LIMIT_S", COMPARE_STAGE_TIME_LIMIT_S):
        solver_result = solve(tasks=tasks, busy_intervals=busy, horizon_days=HORIZON_DAYS)

    return {
        "seed": seed,
        "task_count": task_count,
        "greedy_total": _count_scheduled(greedy_result, tasks),
        "solver_total": _count_scheduled(solver_result, tasks),
        "greedy_high": _count_scheduled(greedy_result, tasks, "High"),
        "solver_high": _count_scheduled(solver_result, tasks, "High"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quick", action="store_true", help="Fewer scenarios, for a fast sanity check.")
    args = parser.parse_args()

    seeds = range(5) if args.quick else range(40)
    task_count = 12

    results = [compare_one(seed, task_count) for seed in seeds]

    total_greedy = sum(r["greedy_total"] for r in results)
    total_solver = sum(r["solver_total"] for r in results)
    high_greedy = sum(r["greedy_high"] for r in results)
    high_solver = sum(r["solver_high"] for r in results)
    scenarios_where_solver_wins = sum(1 for r in results if r["solver_total"] > r["greedy_total"])
    scenarios_where_greedy_wins = sum(1 for r in results if r["greedy_total"] > r["solver_total"])

    print(f"{len(results)} scenarios, {task_count} tasks each\n")
    print(f"Total tasks completed - greedy: {total_greedy}  solver: {total_solver}")
    print(f"High-priority tasks completed - greedy: {high_greedy}  solver: {high_solver}")
    print(f"Scenarios where solver completed more tasks: {scenarios_where_solver_wins}/{len(results)}")
    print(f"Scenarios where greedy completed more tasks: {scenarios_where_greedy_wins}/{len(results)}")

    if not args.quick:
        out_path = Path(__file__).parent / "baseline_comparison.json"
        out_path.write_text(json.dumps(results, indent=2))
        print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()

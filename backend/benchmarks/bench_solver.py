"""Benchmarks the CP-SAT solver's real-world performance across a range of
task counts. A standalone script, not a pytest test - exploratory timing
runs don't belong in a fast, deterministic CI suite. CI runs this same
script with --quick instead: a small, fast subset, as a sanity check.

Run: python -m benchmarks.bench_solver [--quick]
(from backend/, with the venv active - same as running pytest)
"""

import argparse
import json
import statistics
import time
from pathlib import Path
from unittest.mock import patch

from ortools.sat.python import cp_model

from solver.constants import PRIORITY_ORDER
from solver.engine import solve
from solver.types import BusyInterval, FlexibleTaskInput

# Tighter than production's 10s-per-stage default, on purpose: combined with
# the single-worker cap below, this limits how long any one stage can run on
# that one core before giving up. It either returns FEASIBLE, or - if
# nothing was found yet - fails loudly instead of grinding silently (see
# bench_one's try/except).
BENCHMARK_STAGE_TIME_LIMIT_S = 3.0

# Hard cap CP-SAT to one worker thread for every solver instance this script
# creates - a real ceiling on machine usage (at most one core, never a
# multi-core spike), since this runs on a personal dev machine that's doing
# other things at the same time. Production (engine.py, run on its own
# backend host) is untouched - this only patches CpSolver within this
# script's own process.
_original_cp_solver_init = cp_model.CpSolver.__init__


def _single_worker_init(self, *args, **kwargs):
    _original_cp_solver_init(self, *args, **kwargs)
    self.parameters.num_search_workers = 1


cp_model.CpSolver.__init__ = _single_worker_init

HORIZON_DAYS = 14
DEFAULT_REPEATS = 3


def make_tasks(count: int) -> list[FlexibleTaskInput]:
    """A realistic task set of the given size, with mixed priorities and
    splittability. Deterministic (no randomness), so runs are directly
    comparable across repeats and machines."""
    tasks = []
    for i in range(count):
        priority = PRIORITY_ORDER[i % len(PRIORITY_ORDER)]
        splittable = i % 3 == 0
        remaining_minutes = 60 + (i % 4) * 30
        tasks.append(
            FlexibleTaskInput(
                id=f"t{i}",
                priority=priority,
                deadline_day=2 + (i % (HORIZON_DAYS - 2)),
                remaining_minutes=remaining_minutes,
                min_session_minutes=30 if splittable else remaining_minutes,
                max_session_minutes=90 if splittable else remaining_minutes,
                splittable=splittable,
            )
        )
    return tasks


def make_busy_intervals() -> list[BusyInterval]:
    """A modest daily commitment (e.g. classes) across the horizon, so the
    solver has real contention to resolve instead of an empty calendar -
    closer to a real user's calendar."""
    return [BusyInterval(day=d, start_hour=9.0, end_hour=11.0) for d in range(HORIZON_DAYS)]


def summarize_stage_timings(stage_timings: list[dict], top_n: int = 3) -> list[dict]:
    """Average elapsed time per (priority, stage) label across every
    repeat, sorted slowest first - shows where a solve's time actually
    goes, not just the total."""
    grouped: dict[tuple[str, str], list[float]] = {}
    for entry in stage_timings:
        grouped.setdefault((entry["priority"], entry["stage"]), []).append(entry["elapsed_s"])

    summarized = [
        {"priority": priority, "stage": stage, "mean_s": round(statistics.mean(vals), 3)}
        for (priority, stage), vals in grouped.items()
    ]
    summarized.sort(key=lambda s: s["mean_s"], reverse=True)
    return summarized[:top_n]


def bench_one(task_count: int, repeats: int) -> dict:
    tasks = make_tasks(task_count)
    busy = make_busy_intervals()
    durations = []
    not_converged = 0
    stage_timings: list[dict] = []
    with patch("solver.engine.STAGE_TIME_LIMIT_S", BENCHMARK_STAGE_TIME_LIMIT_S):
        for _ in range(repeats):
            start = time.perf_counter()
            try:
                solve(
                    tasks=tasks,
                    busy_intervals=busy,
                    horizon_days=HORIZON_DAYS,
                    stage_timings=stage_timings,
                )
            except RuntimeError:
                # A stage hit BENCHMARK_STAGE_TIME_LIMIT_S without finding a
                # feasible solution (status=UNKNOWN). Real data, not a bug -
                # the single core spent that long and still came up empty -
                # so it's counted below instead of crashing the run.
                not_converged += 1
            durations.append(time.perf_counter() - start)

    sorted_durations = sorted(durations)
    p95_index = max(0, int(len(sorted_durations) * 0.95) - 1)
    return {
        "task_count": task_count,
        "not_converged": not_converged,
        "repeats": repeats,
        "mean_s": round(statistics.mean(durations), 3),
        "median_s": round(statistics.median(durations), 3),
        "p95_s": round(sorted_durations[p95_index], 3),
        "max_s": round(max(durations), 3),
        "slowest_stages": summarize_stage_timings(stage_timings),
    }


def write_chart(results: list[dict], path: Path) -> None:
    """Minimal hand-rolled SVG bar chart (task count vs. mean solve time) -
    four bars don't need a plotting library, and .svg renders natively when
    viewing this file on GitHub."""
    width, height, pad = 480, 280, 40
    plot_h = height - 2 * pad
    max_s = max(r["mean_s"] for r in results) or 1.0
    bar_w = (width - 2 * pad) / len(results)

    bars = []
    for i, r in enumerate(results):
        bar_h = (r["mean_s"] / max_s) * plot_h
        x = pad + i * bar_w + bar_w * 0.15
        y = height - pad - bar_h
        w = bar_w * 0.7
        # Flags any run where a stage hit the time cap without converging,
        # so the chart itself discloses when a bar's number is less solid.
        label_color = "#b91c1c" if r["not_converged"] > 0 else "#1f2937"
        bars.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{bar_h:.1f}" fill="#2563eb" />'
            f'<text x="{x + w / 2:.1f}" y="{y - 6:.1f}" text-anchor="middle" font-size="12" '
            f'fill="{label_color}">{r["mean_s"]}s</text>'
            f'<text x="{x + w / 2:.1f}" y="{height - pad + 16:.1f}" text-anchor="middle" font-size="12" '
            f'fill="#1f2937">{r["task_count"]}</text>'
        )

    title = f"Mean solve time vs. task count (single-core, {BENCHMARK_STAGE_TIME_LIMIT_S}s/stage cap)"
    parts = [
        f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">',
        # Explicit background - without it the text colors below assume a
        # light canvas and read as near-invisible on a dark viewer/OS theme.
        f'<rect width="{width}" height="{height}" fill="white" />',
        f'<line x1="{pad}" y1="{height - pad}" x2="{width - pad}" y2="{height - pad}" stroke="#9ca3af" />',
        *bars,
        f'<text x="{width / 2}" y="18" text-anchor="middle" font-size="13" fill="#1f2937">{title}</text>',
        f'<text x="{width / 2}" y="{height - 8}" text-anchor="middle" font-size="11" fill="#6b7280">'
        f"task count</text>",
        "</svg>",
    ]
    path.write_text("".join(parts))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Small, fast subset for CI sanity checks instead of the full sweep.",
    )
    args = parser.parse_args()

    task_counts = [5, 10] if args.quick else [5, 10, 15, 20]
    repeats = 1 if args.quick else DEFAULT_REPEATS

    results = [bench_one(count, repeats) for count in task_counts]

    header = (
        f"{'Tasks':>6} {'Mean (s)':>10} {'Median (s)':>12} {'P95 (s)':>10} "
        f"{'Max (s)':>10} {'Not conv.':>10}"
    )
    print(header)
    for r in results:
        print(
            f"{r['task_count']:>6} {r['mean_s']:>10} {r['median_s']:>12} "
            f"{r['p95_s']:>10} {r['max_s']:>10} {r['not_converged']:>10}"
        )
        for s in r["slowest_stages"]:
            print(f"         -> {s['priority']}/{s['stage']}: {s['mean_s']}s")

    if not args.quick:
        out_path = Path(__file__).parent / "results.json"
        out_path.write_text(json.dumps(results, indent=2))
        print(f"\nWrote {out_path}")

        chart_path = Path(__file__).parent / "results_chart.svg"
        write_chart(results, chart_path)
        print(f"Wrote {chart_path}")


if __name__ == "__main__":
    main()

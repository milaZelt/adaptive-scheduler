"""Benchmarks the CP-SAT solver's real-world speed across different task
counts. A standalone script, not a pytest test - slow exploratory timing
runs don't belong in a fast CI suite. CI runs this same script with
--quick instead, for a small, fast sanity check.

Run: python -m benchmarks.bench_solver [--quick]
(from backend/, with the venv active - same as running pytest)
"""

import argparse
import json
import statistics
import time
from pathlib import Path
from unittest.mock import patch

from benchmarks._solver_patch import force_single_worker
from solver.constants import PRIORITY_ORDER
from solver.engine import solve
from solver.types import BusyInterval, FlexibleTaskInput

# Tighter than production's 10s default, on purpose. Combined with the
# single-worker limit below, this caps how long one stage can run before
# giving up. It either returns FEASIBLE, or fails loudly instead of
# grinding silently if it found nothing yet (see bench_one's
# try/except).
BENCHMARK_STAGE_TIME_LIMIT_S = 3.0

force_single_worker()

HORIZON_DAYS = 14
DEFAULT_REPEATS = 3


def make_tasks(count: int) -> list[FlexibleTaskInput]:
    """A realistic set of tasks of the given size, with mixed priorities
    and splittability. No randomness, so runs stay comparable across
    repeats and machines."""
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
    """A small daily commitment (like classes) across the horizon, so the
    solver has real contention to resolve instead of an empty calendar.
    Closer to a real user's calendar."""
    return [BusyInterval(day=d, start_hour=9.0, end_hour=11.0) for d in range(HORIZON_DAYS)]


def summarize_stage_timings(stage_timings: list[dict], top_n: int = 3) -> list[dict]:
    """Average time per (priority, stage) across every repeat, sorted
    slowest first. Shows where a solve's time actually goes, not just
    the total."""
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
                # A stage hit the time limit without finding a solution
                # (status=UNKNOWN). This is real data, not a bug - the
                # single core just ran out of time. We count it below
                # instead of crashing the run.
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
    """A small hand-made SVG bar chart: task count vs. mean solve time.
    Four bars don't need a plotting library, and .svg shows up directly
    on GitHub."""
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
        # Marks runs where a stage hit the time cap without converging,
        # so the chart shows when a number is less solid.
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
        # Explicit white background. Without it, the text colors below
        # assume a light background and are hard to see in dark mode.
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

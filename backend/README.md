# Nextly solver backend

Ticket 1: the core CP-SAT scheduling engine, standalone (no FastAPI, no
Supabase). Wrapping it in a real HTTP service is Ticket 3.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run tests

```bash
source .venv/bin/activate
python -m pytest tests/ -v
```

## What's here

- `solver/types.py` - plain data contracts (`FlexibleTaskInput`, `BusyInterval`, `SolveResult`, ...).
- `solver/constants.py` - global scheduling constants (8AM-11PM window, 30-min padding, etc).
- `solver/engine.py` - the CP-SAT model and the lexicographic per-priority-tier solve.
- `tests/test_engine.py` - one fixture per rule from the decisions record.

`solve(tasks, busy_intervals, horizon_days)` is the only public entry point. It assumes
its inputs are already resolved (overdue tasks filtered out, remaining-duration
already computed) - that data assembly is Ticket 4's job, not this module's.

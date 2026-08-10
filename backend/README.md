# Nextly solver backend

Ticket 1: the core CP-SAT scheduling engine, standalone (no FastAPI, no
Supabase). Ticket 3: wraps it in a stateless FastAPI service - still no
Supabase access, this service never touches the database.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in SOLVER_SHARED_SECRET
```

## Run tests

```bash
source .venv/bin/activate
python -m pytest tests/ -v
```

## Run the API locally

```bash
source .venv/bin/activate
uvicorn api.main:app --reload
```

`GET /health` needs no auth. `POST /solve` requires an
`X-Nextly-Shared-Secret` header matching `SOLVER_SHARED_SECRET` - everything
else is rejected with 401. This service is only ever meant to be called from
Next.js's own server-side Route Handler (Ticket 4), never a browser directly,
so there's no CORS configuration.

## What's here

- `solver/types.py` - plain data contracts (`FlexibleTaskInput`, `BusyInterval`, `SolveResult`, ...).
- `solver/constants.py` - global scheduling constants (8AM-11PM window, 30-min padding, etc).
- `solver/engine.py` - the CP-SAT model and the lexicographic per-priority-tier solve.
- `api/schemas.py` - Pydantic request/response models, with their own validation independent of the solver's own assumptions (defense in depth - FastAPI doesn't blindly trust its caller either).
- `api/auth.py` - the shared-secret check.
- `api/main.py` - the FastAPI app: `GET /health`, `POST /solve`.
- `tests/test_engine.py` - one fixture per solver rule from the decisions record.
- `tests/test_api.py` - HTTP-layer tests: auth enforcement, request validation, and a round-trip check against one known `test_engine.py` scenario (not a re-proof of the whole algorithm - that's `test_engine.py`'s job).

`solve(tasks, busy_intervals, horizon_days)` remains the only public entry point
into the solver itself. It assumes its inputs are already resolved (overdue
tasks filtered out, remaining-duration already computed) - that data assembly
is Ticket 4's job, not this module's. The FastAPI layer doesn't change that
contract, just puts an HTTP+auth+validation skin on it.

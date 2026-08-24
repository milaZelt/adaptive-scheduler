# Architecture & Decisions

My internal reference for how Nextly actually works, and why I built it this way. This isn't the pitch (that's `README.md`), it's my own reasoning, including the stuff I considered and rejected, so a re-read months from now still makes sense to me.

## Contents

1. [System overview](#1-system-overview)
2. [The solver](#2-the-solver)
3. [Data model](#3-data-model)
4. [Update Schedule: the full pipeline](#4-update-schedule-the-full-pipeline)
5. [Explainability](#5-explainability)
6. [Google Calendar integration](#6-google-calendar-integration)
7. [Auth & demo mode](#7-auth--demo-mode)
8. [Frontend architecture](#8-frontend-architecture)
9. [Testing strategy](#9-testing-strategy)
10. [Deployment & production hardening](#10-deployment--production-hardening)
11. [Deliberately not built](#11-deliberately-not-built)

---

## 1. System overview

Three pieces, and it matters how they're allowed to talk to each other:

- **Next.js app** (`frontend/`), marketing site plus the authenticated calendar at `/app`. Deployed on Vercel.
- **FastAPI solver** (`backend/`), a stateless CP-SAT scheduling service. Deployed on Render. Holds no Supabase credentials, touches no database, and has no CORS configured on purpose: I only want it reachable from Next.js's own server, never a browser directly.
- **Supabase**, Postgres plus Auth plus Row-Level Security. Every user-owned table is RLS-scoped so one user's data isn't reachable through another's queries even if my application code had a bug. That's the actual security boundary, not a convention I have to remember to enforce myself.

There are two different request paths, on purpose, not one uniform pipeline:

1. **Regular data (tasks, events, categories, notes, marking a session Completed/Missed): browser talks straight to Supabase.** The frontend uses Supabase's own client-side JS SDK with the public anon key. Next.js's server isn't in the loop at all for a plain "create this task" or "delete this event." RLS is what keeps this safe: the anon key alone can't read or write another user's rows, so there's no server-side gatekeeper needed for these.
2. **Anything that needs a secret Next.js's server has to hold on to (calling the solver, importing Google Calendar): browser talks to a Next.js Route Handler, which then talks to Supabase and/or the outside service on the server side.** This is `app/api/update-schedule` and `app/api/import-google-calendar`. The browser never sees `SOLVER_SHARED_SECRET` or a Google refresh token; those only ever exist server-side.

```
Browser → Supabase directly (regular CRUD, RLS-gated, no secrets involved)

Browser → Next.js Route Handler (Vercel) → Supabase (persist result)
                                          ↳ FastAPI solver (Render), shared-secret auth
                                          ↳ Google Calendar, OAuth
```

I split the solver into its own service instead of running CP-SAT inside a Next.js API route because OR-Tools is a native-code dependency, and a CP-SAT solve can legitimately take several seconds. Both fit a long-running Python service much better than a serverless JS function. I kept it stateless (no DB access) so I could reason about and test it in complete isolation from everything else. `backend/tests/` never touches Supabase at all.

---

## 2. The solver

`backend/solver/engine.py`. Pure function: `solve(tasks, busy_intervals, horizon_days) -> SolveResult`. No I/O, no DB, no HTTP, just CP-SAT. `backend/api/main.py` puts an HTTP plus auth plus validation skin on top of it and nothing else.

### 2.1 The objective is lexicographic, not a weighted sum

I first considered a single objective like `sum(priority_weight * completed)`. I rejected it early because weights are always arbitrary, and a large enough pile of Medium tasks can out-score a genuinely important High task, which defeats the point of having priorities at all.

Instead I built **sequential staged solves, one per priority tier**:

1. Solve for High only: maximize count of fully-completed High tasks.
2. Lock that count in as a hard constraint. Solve again, now also breaking ties by preferring earlier deadlines among High tasks.
3. Lock that in too. Solve again preferring shorter tasks among remaining ties (more completions for the same capacity).
4. Repeat the whole 3-stage process for Medium, with High's placements already spent.
5. Repeat again for Low, with High and Medium already spent.
6. A final stage prefers the earliest available placement among any remaining ties. I added this stage only after a real bug showed I needed it (see below).

A lower tier can **never** influence a higher tier's outcome, even indirectly, because I lock each tier's result as a constraint before the next tier's solve even starts.

### 2.2 Padding, all-or-nothing, splitting

- **30-minute padding** around any busy interval (fixed event, Google event, or another flexible session) when placing flexible work, symmetric on both sides. Doesn't affect fixed/Google events relative to each other.
- **All-or-nothing per task**: a task gets its full remaining duration placed, or none of it. No partial credit.
- **Session length bounds plus 15-minute grid alignment** are real constraints, not just UI formatting. This was a real bug once (see 2.4).
- **8AM-11PM solving window** is its own constant (`backend/solver/constants.py`), deliberately separate from whatever hours the calendar grid happens to display.

### 2.3 What I considered and rejected

- **A single weighted objective.** Rejected, see 2.1.
- **`AddHint` solution warm-starting** (seed the solver with the previous run's placement to speed up re-solves). I discussed this with myself and decided against it: I have no confirmed real performance problem to justify it. If solver latency ever becomes an actual complaint, this is the correctness-preserving fix I'd reach for first, since hints can only speed up search or be neutral, never change what counts as optimal.
- **A "check for a free slot before re-solving" fast path.** I explicitly rejected this as unsound: my objective is genuinely global (a new High task can and should bump an already-placed lower-priority one), so a fast path that only fills empty gaps could silently settle for a worse arrangement than a real solve would find, with zero signal to me or the user that it happened. Not worth trading correctness for a speed gain I don't actually need.
- **A two-tier planning horizon** (a 14-day committed window plus a 60-90 day feasibility lookahead). I rejected this: Nextly schedules near-term work, not long-range projects. See §4 for what I built instead.

### 2.4 Real bugs I found in this file (worth remembering, none caught by inspection, all by a failing test I wrote first)

- The window-fit constraint wasn't gated on `presence`, so an unused candidate could wrongly make the *whole model* infeasible.
- `abs_end`'s variable domain was too narrow for the unconditional `abs_start + duration` equality on large, non-present candidates.
- 15-minute grid alignment was declared as a constant but never actually wired into a constraint. My original test for this was a false positive (it passed even with the constraint fully deleted, since CP-SAT happened to land on a clean value for that fixture by chance). I replaced it with a feasibility-based test: exactly one slot exists, deliberately non-aligned, so a correct engine must leave the task unscheduled.
- Stage 5 (earliest-placement tie-break) didn't exist originally. I added it after a dedicated regression test showed the solver picking the *late* slot between two otherwise-identical gaps, not even by coincidence, that's genuinely what it did without this stage.
- **The FEASIBLE-vs-OPTIMAL bug**, which I found via real usage after I'd already shipped this: `_solve_and_lock` treated any CP-SAT status other than `OPTIMAL` as fatal, including `FEASIBLE` (a valid, complete, checked solution CP-SAT found but couldn't finish *proving* optimal within its time budget). Every fixture test I'd written was small enough to always reach `OPTIMAL`, so I never caught this in the test suite, but real task counts hit it on my very first real Update Schedule run. I fixed it to accept `FEASIBLE` too (still rejects `INFEASIBLE`/`UNKNOWN`/`MODEL_INVALID`). Lesson for myself: small hand-built fixtures can hide a whole class of bug that only real-scale data exposes.

---

## 3. Data model

Tables (see `frontend/supabase/migrations/`): `categories`, `events`, `flexible_tasks`, `scheduled_sessions`, `schedule_runs`, `user_notes`, `google_credentials`, `demo_seeded`. Every one is RLS-scoped to `auth.uid() = user_id`, and every one has `user_id references auth.users(id) on delete cascade`, which matters a lot for demo cleanup (§7.4).

### 3.1 Why I made `scheduled_sessions` a separate table from `events`

`events` is anything the *user* placed (fixed commitments, imported Google events). `scheduled_sessions` is anything the *solver* placed. Keeping them separate is what makes "Fixed = you decide when, Flexible = Nextly decides when" an actual enforced boundary instead of a UI convention I'd have to remember: `scheduled_sessions` rows have no drag/resize/delete handlers at all in the grid components. Not a disabled flag, I just never wrote those handlers for that component. The only mutation I allow on a session is the Completed/Missed toggle.

### 3.2 Why `flexible_tasks.deadline` is always inside the 14-day horizon

I originally considered letting a task's deadline be arbitrarily far out and having the solver's search window vary per task. I rejected that: Nextly's job is scheduling near-term work, not tracking multi-week projects. If someone tries to save a task with a deadline beyond 14 days, I prompt them to convert it into a scoped near-term request (an hour amount plus an in-window due date) *before* saving, so nothing about the original long-term framing sticks around. Consequence: every `flexible_tasks` row's deadline is in-horizon *by construction*, so I never have an "out-of-range deadline" case to handle anywhere downstream. Much simpler than carrying that case through the whole pipeline.

### 3.3 `security invoker` vs `security definer`

Two Postgres RPCs matter here:

- **`apply_schedule_update`** (migration 0007), `security invoker`. It's a delete-then-insert-then-status-update that needs to be atomic (the JS Supabase client has no multi-statement transaction support), but I still want it running with the *caller's* RLS permissions, not elevated ones. A user should only ever touch their own rows through it.
- **`cleanup_expired_demo_users`** (migration 0015), `security definer`, because it genuinely needs elevated privilege: deleting from `auth.users` isn't something a normal user role can do, and I only ever call this from a scheduled `pg_cron` job, never from a client request.

My rule of thumb: `security invoker` unless the function's entire purpose *requires* privilege the caller shouldn't have, and if it does, make sure nothing client-reachable can trigger it with attacker-controlled arguments.

### 3.4 `schedule_runs`, the one thing I couldn't derive

Staleness detection (§4.3) mostly works by comparing `updated_at` timestamps on tasks/sessions against "when did Update Schedule last run." My first instinct was to derive "last run" from `max(scheduled_sessions.created_at)`, no extra table needed. That breaks for one real case: a successful run that schedules *zero* sessions (all tasks overdue, nothing fit, or no eligible tasks at all) has nothing to anchor on, which makes a successful empty run indistinguishable from "never run." `schedule_runs` is a minimal one-row-per-user table I upsert from `apply_schedule_update` on every successful run regardless of session count. The one piece of staleness state I genuinely couldn't derive from existing data.

---

## 4. Update Schedule: the full pipeline

`frontend/app/api/update-schedule/route.ts`. I made this the single largest piece of the app by design. It's one coherent behavior (what happens when the user asks Nextly to replan), not several unrelated smaller ones.

Here's the whole thing in order, before I get into why each step is shaped the way it is:

1. **Gate.** Before touching anything else, check whether any past `scheduled_sessions` row is still unresolved. If so, stop and return that list so the UI can show `ResolveSessionsModal` (§4.2). Nothing past this point runs until the user answers.
2. **Gather.** Pull the user's fixed events (including any imported from Google) and eligible flexible tasks for the current 14-day horizon, computing each task's real remaining duration (§4.3).
3. **Solve.** POST that data to the FastAPI backend over the shared-secret-authenticated `/solve` endpoint.
4. **Validate.** Treat the solver's response as untrusted input, same as any external API response, and check it before trusting it (§4.4).
5. **Persist.** Call the `apply_schedule_update` Postgres RPC, which deletes the old sessions in the horizon and inserts the new ones in one atomic transaction, and stamps `schedule_runs` so staleness detection has something to compare against (§4.5).
6. **Return.** Send the fresh task/session state back to the client so the UI updates without needing a second round-trip.

The rest of this section is why each of those six steps looks the way it does.

### 4.1 Nothing changes the schedule except this button

My general rule: **no silent reshuffling, ever.** A new task, a missed session, a conflicting fixed event: none of these auto-run the solver. They mark the schedule stale (§4.3's banner) and wait for the user to explicitly click Update Schedule. "Regenerate" means *recalculate from current information*, not necessarily *produce something different*. If nothing meaningful changed, re-running can legitimately reproduce the same placements.

### 4.2 Unresolved past sessions block the run

If any past `scheduled_sessions` row is still `unresolved` (no Completed/Missed answer), I refuse to let Update Schedule run until the user resolves it via `ResolveSessionsModal`. I have no honest basis for "how much work remains" otherwise. This is reactive, not proactive: the prompt only appears the moment Update Schedule is clicked, never as a daily notification. It only ever applies to solver-generated sessions; fixed events were never subject to completion tracking (they live in `events`, not `scheduled_sessions`, so there's nothing to filter here, it falls out of the table split in §3.1 for free).

### 4.3 Data gathering

- Fixed events come from a general, source-agnostic query. I did this deliberately, so Google-imported events (`source='google'`) get automatically respected by the solver at zero extra cost. No special-casing needed anywhere in this pipeline for where an event came from.
- Remaining duration per task = required duration minus the durations of that task's **completed** past sessions. I deduct *every* completed session regardless of date, not just ones strictly before today. (Real bug I hit once: excluding same-day completed sessions from the deduction meant a session completed earlier today would get wiped by this same run without its time ever being credited, silently re-scheduling work already done.)
- I filter out overdue tasks here, before the solver ever sees them. The solver itself has no concept of "overdue," it just assumes everything it receives is eligible.

### 4.4 Persisting: trust nothing from the solver blindly

I validate the FastAPI response as untrusted input on the way back in (horizon bounds, task ownership, no-overlap), the same trust posture in both directions as the request. Real gap I found once in review: my validation function checked `all_sessions`, but my persistence logic was building rows from a *different* field (`task_results[x].sessions`). Validating one representation while trusting a different one defeats the entire point. I fixed it by deriving persisted rows entirely from the validated field, plus a cross-consistency check that `scheduled: true/false` agrees with actual session presence.

### 4.5 Staleness banner

`lib/calendar/staleness.ts`, `computeStaleness()`, three triggers: new/edited task, missed session, a fixed-event conflict against a today-or-future session. Each comparison is `updatedAt > lastRunAt`, deliberately never `>=`. `apply_schedule_update` touches every included task's `updated_at` in the *same transaction* it stamps `lastRunAt`, so `>=` would have permanently flagged every just-solved task as newly-changed forever.

---

## 5. Explainability

`SessionDetailModal`'s "Why this slot?" section, built from `placement_reason` (jsonb, captured once at solve time, never a second solve, never inferred after the fact).

What it actually contains: `priority`, `deadline`, `sessionIndex`/`sessionCount` (for split tasks), `otherTierTasksCount` (how many same-priority tasks existed in this solve), and `blockedBy` (the nearest same-day busy interval, fixed event or another flexible session, ending within about 32 minutes of this session's start). All of it is either data I already gathered before the single solve, or data the solve already returned. I compute it in JS *after* the solve completes, at zero extra solver cost.

I deliberately didn't build any claim about what a specific placement "beat" in the search, or reasoning from inside CP-SAT's search itself (why stage N landed exactly here vs. there). A single solve's output data can't honestly support the first claim, and the second is real solver instrumentation, not a template change. Genuinely interesting, but out of scope for what I actually set out to do.

---

## 6. Google Calendar integration

### 6.1 Token lifecycle (`lib/google/credentials.ts`)

Supabase only ever refreshes its *own* session JWT, it never refreshes the Google OAuth token. `getValidGoogleAccessToken` calls Google's token endpoint directly with the stored refresh token, using my own `GOOGLE_OAUTH_CLIENT_ID`/`SECRET` (a second copy of the same OAuth client Supabase's dashboard also has configured; Supabase's own copy lives only inside Supabase's server, so I need my own to call Google directly). I return `null` (not a throw) on a revoked/invalid refresh token, since that's a "user needs to reconnect" state, not a retryable error.

I deliberately don't cache the initial access token from sign-in. `Session.expires_in` describes Supabase's own JWT, not Google's `provider_token`, so I have no real TTL for it at sign-in time. Caching it would mean guessing. Simpler and always correct to just do one genuine refresh on first real use.

### 6.2 Timezone safety

I read every timed Google event's date/hour as literal digits straight out of the RFC3339 string (`"2026-08-15T14:30:00-04:00"` → date `2026-08-15`, hour `14.5`), never through a `Date` object. The embedded offset already encodes the correct wall-clock moment; interpreting it through the server's own timezone (unknown and irrelevant at deploy time) would silently shift it. Same rule I follow everywhere in this app for "now"/"today": never computed server-side, always resolved on the client and sent up.

### 6.3 All-day and multi-day events

Google's `end.date` is exclusive even for a single-day all-day event. I expand a multi-day span into one row per spanned day, clipped to the horizon. My import route fetches a horizon padded a day on each side specifically to absorb timezone-boundary mismatches, and `eventConversion.ts` re-clips to the real horizon using each event's own literal date, so the padding can only pull in extra raw data, never lose real data. I clamp an event crossing midnight (no clean fit in my one-date-per-row model) to end at midnight rather than dropping it.

### 6.4 Import is a wholesale replace, not a diff

I delete every existing `source='google'` row in the horizon and replace it with the fresh fetch, rather than diffing against what's already stored. Deliberate: a plain list query can't distinguish "deleted on Google" from "just outside this page of results," so a diff would risk silently keeping stale events forever. A full replace can't have that failure mode.

---

## 7. Auth & demo mode

### 7.1 Why I used anonymous Supabase auth, not a fake local demo state

I weighed three approaches for "Try Demo":

1. A parallel, from-scratch demo UI. I rejected this, it defeats the entire point of code reuse since every real component calls `useAppState()`, which only a real Supabase session can satisfy.
2. A local-only `DemoStateProvider` feeding the same context shape with plain React state. Genuinely zero database rows, but it means re-implementing my app's entire state logic (about 77 fields/functions, including cascade-deletes) a second time by hand. Realistically 300-400+ lines of *duplicated business logic* I'd have to keep correct in two places forever.
3. **Real anonymous Supabase auth** (`signInAnonymously()`). My real `AppStateProvider` and every hook just work unchanged against a real (if anonymous) session. Costs one small, isolated, per-visitor row that's never presented to the visitor as "saved" and gets swept up automatically (§7.4).

I went with (3): less code, and critically, the *safer kind* of less code (no duplicated logic to drift out of sync), for a very small, fully-contained storage cost.

### 7.2 Seed-once, race-safe

I initially thought about checking "are the tables empty" as the seeding trigger, but that's wrong: a visitor is free to delete the starter content, and it must never silently come back. `demo_seeded` (one row per user, mere existence means "already seeded") plus `seed_demo_content`'s `insert ... on conflict do nothing` plus `get diagnostics row_count` is what makes this safe under concurrency (two tabs opening right after sign-in, racing each other), not just a check-then-act read.

### 7.3 Demo caps and rate limiting

I enforce both server-side in `update-schedule/route.ts`, not just in the UI (`DEMO_MAX_TASKS`, `DEMO_RATE_LIMIT`/`DEMO_RATE_WINDOW_MS`). Known, accepted limitation: my rate-limit counter is an in-memory `Map`, which only works reliably if Vercel happens to reuse the same warm instance across requests. A determined adversarial burst across multiple cold instances could bypass it. That's fine at this project's real traffic; if it ever mattered, the fix would be a shared store (Redis/Upstash), which I haven't built since there's no confirmed real problem.

### 7.4 Auto-cleanup (migration 0015)

A `pg_cron` job runs `cleanup_expired_demo_users()` every 6 hours, deleting `auth.users` rows where `is_anonymous = true and created_at < now() - interval '24 hours'`. Because every user-owned table already has `on delete cascade` back to `auth.users`, deleting that one row is genuinely sufficient, nothing else needs touching. I run this entirely inside Postgres specifically so the Supabase **service role key never has to enter the deployed app at all**. I only ever use that key for the one-time, manually-run E2E test-user creation script, never in live application code.

---

## 8. Frontend architecture

### 8.1 Marketing vs app split

`app/page.tsx` (marketing, mostly server components) vs `app/app/page.tsx` → `CalendarApp.tsx` (authenticated, client-heavy). I gave them different visual languages on purpose: the marketing page has its own gradient/glass design tokens added *additively* to `globals.css` (`--grad`, `--glass*`, etc.) specifically without touching `body`'s own background, so the authenticated app's look stays untouched by any marketing redesign.

### 8.2 `Drawer` vs `Modal`, when to use which

Two different shared primitives in `components/`, and picking the wrong one is exactly the bug I hit with `ResolveSessionsModal` (see commit `da78255`):

- **`Modal`** (`components/ui/Modal.tsx`), small, centered, fixed max-width, no internal scroll handling. Right for short, static content: confirmations (`ConfirmDialog`), small detail views.
- **`Drawer`** (`components/calendar/events/Drawer.tsx`), full-height slide-out panel, header and footer pinned (`flex-shrink: 0`), body scrolls independently (`flex: 1; overflow-y: auto`). Right for anything with a variable-length list or a form: `FixedEventForm`, `FlexibleEventForm`, `ResolveSessionsModal`.

My rule going forward: if the content's length depends on user data (a list of N items, a list of N unresolved sessions), it's a `Drawer`, not a `Modal`. `Modal` has no scroll story at all and will silently break past a few items.

### 8.3 State: local vs `AppStateContext`

`AppStateContext.tsx` holds everything shared across the whole authenticated app (tasks, events, sessions, all the CRUD plus solver-trigger functions). Not everything needs to live there, though: I kept the `RightPanel` collapse/expand toggle as local `useState` inside `RightPanel.tsx` itself, because the layout is a plain flex row (`.layout { display: flex }`, `.panelCenter { flex: 1 }`). Shrinking `.panelRight`'s own width automatically hands the freed space back to the calendar grid with zero coordination needed elsewhere. My rule of thumb: state goes in context only if something *outside* the component that owns it needs to read or change it.

### 8.4 Style/logic separation

Every component pairs a `.tsx` (structure/behavior) with its own `.module.css` (all visual styling), no inline style objects except where a value is genuinely computed at runtime (like a category's user-chosen color). I reviewed this explicitly once and confirmed it's clean app-wide. The one legitimate exception is Google's official brand-color SVG in the sign-in button (`#4285F4` etc.), fixed third-party brand identity, not part of Nextly's own theme system, so I correctly hardcoded it rather than tokenizing it.

---

## 9. Testing strategy

| Layer | Tool | What it covers |
|---|---|---|
| Solver | pytest (`backend/tests/test_engine.py`) | Every objective rule as its own fixture: count, urgency tie-break, length tie-break, placement tie-break, feasibility under grid alignment. |
| Solver API | pytest (`backend/tests/test_api.py`) | Auth enforcement, request validation, one real HTTP round-trip reusing a known engine fixture (proves the wrapping, doesn't re-prove the algorithm). |
| Frontend pure logic | Vitest | Date/timezone helpers, recurrence expansion, staleness detection, Google event conversion, all pure functions, no React rendering needed. |
| Frontend E2E | Playwright | Real browser, real Supabase, real solver: marketing loads, sign-in redirects correctly, a task/event round-trips through creation, Update Schedule produces a real placement. |
| Solver performance | `backend/benchmarks/bench_solver.py` | Real latency numbers (5/10/25/50/100 tasks), not asserted in CI as pass/fail since CI runners are too noisy for absolute timing claims. CI only runs a small fast subset as a sanity check. |

### 9.1 The E2E auth problem, and how I solved it

The only real sign-in path is Google OAuth, which I can't reliably script (bot detection, no stable non-interactive login). My solution: a dedicated Supabase test user, created once via a manual, never-automated script (`scripts/create-e2e-test-user.ts`, needs the service role key, the *only* place I ever use that key) using `signInWithPassword` instead. Every actual test run uses only the anon key, same as the real app. The service role key is never needed again after that one setup step and never touches CI.

---

## 10. Deployment & production hardening

### 10.1 Why Vercel plus Render, not one host

Vercel is the first-party Next.js host, zero-config for the App Router. The solver needs a real long-running Python process (OR-Tools is a native dependency, solves can take several seconds), the opposite of what a serverless function is good at, so I put it on Render as a separate service instead of a Vercel API route.

### 10.2 The Vercel timeout bug (real, I found and fixed it before this ever shipped)

Vercel's Hobby plan defaults serverless functions to a 10-second timeout. Render's free tier can take up to a minute to wake from a cold start. Without an override, the very first Update Schedule call after any idle period would get hard-killed by Vercel *before* Render even responded, bypassing my own graceful "couldn't reach the scheduling service" error path entirely, since Vercel's kill happens first. I fixed it with `export const maxDuration = 60` on `update-schedule/route.ts` (and `30` on `import-google-calendar/route.ts`, a lower but real risk for a large calendar's paginated fetch).

### 10.3 The solver warm-up ping

`wakeSolver()` (`lib/wakeSolver.ts`) fires a fire-and-forget ping to `/api/wake-solver` (which itself pings the Render backend's `/health`) from three points: marketing page mount, the moment "Sign in with Google" is clicked, and the moment "Try Demo" is clicked. None of this *prevents* Render from sleeping after 15 idle minutes, it just moves the wake-up as early as possible in the user's actual flow, so by the time they'd reach Update Schedule, the backend has often already had 10-30+ seconds of head start. The Update Schedule button also shows a reassuring note ("still working, this can take up to a minute") if a request runs past 8 seconds. I deliberately didn't show it immediately, since most requests are fast and a permanent warning would be worse than an occasional honest one.

### 10.4 CI (`.github/workflows/ci.yml`)

Three jobs: `frontend` (lint, build, unit tests), `backend` (pytest plus a fast benchmark sanity subset), `e2e` (depends on both, spins up a real solver backend plus a real frontend dev server, runs the full Playwright suite against them). The `e2e` job is the one real external-dependency tradeoff in the whole pipeline: it hits the actual Supabase project from GitHub's own runners on every push, a small but genuine ongoing flakiness/cost surface the other three jobs don't have.

---

## 11. Deliberately not built

Worth keeping a record of these so I don't "rediscover" and re-relitigate any of them later without a real reason:

- **Long-range project tracking beyond 14 days.** I kept this out of scope by design: Nextly schedules near-term work, not multi-week projects (§2.3, §3.2).
- **Drag/resize/delete on solver-placed sessions.** Would blur the "Fixed = you decide, Flexible = Nextly decides" boundary and risk silently violating constraints Nextly can no longer see. A future "lock this time" override is a reasonable idea I haven't designed.
- **CP-SAT solution hinting (`AddHint`).** No confirmed real latency problem to justify it (§2.3).
- **Reasoning from inside the solver's search** for explainability. Real instrumentation work, not a template change, and not what I actually set out to do (§5).
- **A separate demo-only UI or state layer.** I rejected this in favor of reusing the real app via anonymous auth (§7.1).
- **Mobile-responsive calendar app.** My explicit, deliberate scope decision: this is a desktop tool, not a phone app. The marketing page's own mobile layout has a known real bug (navbar doesn't collapse, wraps ugly) that I also explicitly left alone under the same decision.
- **A shared/distributed rate limiter for demo abuse.** In-memory is a known, accepted soft limit at this project's real scale (§7.3).

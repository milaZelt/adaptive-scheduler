-- Fixes a real gap: staleness was going to be derived purely from existing
-- timestamps (max(scheduled_sessions.created_at) as a "last successful run"
-- proxy) - but a run that legitimately schedules zero sessions (everything
-- overdue, or nothing fit, or no eligible tasks at all) leaves no fresh row
-- to anchor that proxy on, making a successful empty run indistinguishable
-- from "never run." This table is the minimal fix: one row per user, always
-- upserted by apply_schedule_update on every successful run regardless of
-- how many sessions came out of it - not a reversal of "derive staleness
-- from existing data," just the one piece that genuinely couldn't be
-- derived from scheduled_sessions alone.

create table if not exists public.schedule_runs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.schedule_runs enable row level security;

drop policy if exists "schedule_runs_select_own" on public.schedule_runs;
create policy "schedule_runs_select_own" on public.schedule_runs
  for select using (auth.uid() = user_id);

drop policy if exists "schedule_runs_insert_own" on public.schedule_runs;
create policy "schedule_runs_insert_own" on public.schedule_runs
  for insert with check (auth.uid() = user_id);

drop policy if exists "schedule_runs_update_own" on public.schedule_runs;
create policy "schedule_runs_update_own" on public.schedule_runs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "schedule_runs_delete_own" on public.schedule_runs;
create policy "schedule_runs_delete_own" on public.schedule_runs
  for delete using (auth.uid() = user_id);

-- Same signature as 0007 - create or replace in place, no drop needed.
create or replace function public.apply_schedule_update(
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_sessions jsonb,
  p_task_statuses jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.scheduled_sessions
  where user_id = p_user_id
    and date >= p_start_date
    and date <= p_end_date;

  insert into public.scheduled_sessions
    (user_id, task_id, category_id, date, start_time, end_time, placement_reason)
  select
    p_user_id,
    (s->>'task_id')::uuid,
    (s->>'category_id')::uuid,
    (s->>'date')::date,
    (s->>'start_time')::numeric,
    (s->>'end_time')::numeric,
    s->'placement_reason'
  from jsonb_array_elements(p_sessions) as s;

  update public.flexible_tasks
  set scheduling_status = (t->>'status')
  from jsonb_array_elements(p_task_statuses) as t
  where flexible_tasks.id = (t->>'task_id')::uuid
    and flexible_tasks.user_id = p_user_id;

  -- Runs even when p_sessions is empty - this is the whole point.
  insert into public.schedule_runs (user_id, updated_at)
  values (p_user_id, now())
  on conflict (user_id) do update set updated_at = excluded.updated_at;
end;
$$;

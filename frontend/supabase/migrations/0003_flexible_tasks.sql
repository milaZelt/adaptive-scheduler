-- Flexible task definitions (solver input). Never contains a scheduled
-- date/time - that's scheduled_sessions, added in a later migration once
-- Update Schedule exists (Ticket 4). A task's deadline is always within the
-- rolling 14-day planning horizon by construction: the frontend converts any
-- farther-out request into a scoped near-term one before it ever reaches
-- this table (decisions record, round 3/4) - the CHECK constraint below is
-- the same rule enforced again at the database layer.

create table if not exists public.flexible_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  priority text not null check (priority in ('High', 'Medium', 'Low')),

  -- 14-day horizon, today counting as day 1 of 14 (matches the solver's own
  -- day-0-through-day-13 convention) - keep in sync with PLANNING_HORIZON_DAYS
  -- in frontend/lib/calendar/constants.ts.
  deadline date not null check (deadline <= current_date + 13),

  time_estimate_mode text not null check (time_estimate_mode in ('single', 'range')),
  time_estimate_value numeric(5,2),
  time_estimate_min numeric(5,2),
  time_estimate_max numeric(5,2),

  split_ok boolean not null default false,
  session_min numeric(5,2),
  session_max numeric(5,2),

  description text,

  scheduling_status text not null default 'not_yet_scheduled'
    check (scheduling_status in ('not_yet_scheduled', 'scheduled', 'couldnt_fit', 'overdue')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint flexible_tasks_estimate_shape check (
    (time_estimate_mode = 'single' and time_estimate_value is not null and time_estimate_value > 0)
    or
    (time_estimate_mode = 'range' and time_estimate_min is not null and time_estimate_max is not null
      and time_estimate_max > time_estimate_min and time_estimate_min > 0)
  ),
  constraint flexible_tasks_split_shape check (
    (not split_ok)
    or
    (split_ok and session_min is not null and session_max is not null
      and session_max >= session_min and session_min > 0)
  )
);

create index if not exists flexible_tasks_user_id_idx on public.flexible_tasks(user_id);
create index if not exists flexible_tasks_category_id_idx on public.flexible_tasks(category_id);

alter table public.flexible_tasks enable row level security;

drop policy if exists "flexible_tasks_select_own" on public.flexible_tasks;
create policy "flexible_tasks_select_own" on public.flexible_tasks
  for select using (auth.uid() = user_id);

drop policy if exists "flexible_tasks_insert_own" on public.flexible_tasks;
create policy "flexible_tasks_insert_own" on public.flexible_tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "flexible_tasks_update_own" on public.flexible_tasks;
create policy "flexible_tasks_update_own" on public.flexible_tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "flexible_tasks_delete_own" on public.flexible_tasks;
create policy "flexible_tasks_delete_own" on public.flexible_tasks
  for delete using (auth.uid() = user_id);

-- Reuses the trigger function already created in 0001_calendar_schema.sql.
drop trigger if exists flexible_tasks_set_updated_at on public.flexible_tasks;
create trigger flexible_tasks_set_updated_at
  before update on public.flexible_tasks
  for each row execute function public.set_updated_at();

-- Solver output. Deliberately a separate table from `events` (decisions
-- record, round 3): solver-authored and user-authored data never share a
-- table, so Update Schedule's delete-then-replace can never touch a
-- hand-authored event no matter how the query is written, and there's no
-- CHECK-constraint gymnastics needed to keep the two apart.
--
-- Rows here are read-only in V1 beyond completion_status - no drag/resize/
-- delete on the placement itself. Users act through the underlying
-- flexible_tasks row (edit/delete) or Update Schedule (a fresh placement).

create table if not exists public.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.flexible_tasks(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,

  date date not null,
  start_time numeric(5,2) not null,
  end_time numeric(5,2) not null,

  -- Structured facts captured at solve time (Ticket 4), rendered into a
  -- template at display time (Ticket 6) - "why" is a claim about calendar
  -- state at the moment of solving, so it has to be captured then, not
  -- reconstructed later from whatever the calendar looks like by then.
  placement_reason jsonb,

  -- Not a silent "assume completed" fallback: a past session left
  -- unresolved blocks the next Update Schedule (decisions record, round 4)
  -- rather than being quietly treated as done.
  completion_status text not null default 'unresolved'
    check (completion_status in ('unresolved', 'completed', 'missed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint scheduled_sessions_end_after_start check (end_time > start_time)
);

create index if not exists scheduled_sessions_user_id_idx on public.scheduled_sessions(user_id);
create index if not exists scheduled_sessions_task_id_idx on public.scheduled_sessions(task_id);
create index if not exists scheduled_sessions_user_date_idx on public.scheduled_sessions(user_id, date);

alter table public.scheduled_sessions enable row level security;

drop policy if exists "scheduled_sessions_select_own" on public.scheduled_sessions;
create policy "scheduled_sessions_select_own" on public.scheduled_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "scheduled_sessions_insert_own" on public.scheduled_sessions;
create policy "scheduled_sessions_insert_own" on public.scheduled_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "scheduled_sessions_update_own" on public.scheduled_sessions;
create policy "scheduled_sessions_update_own" on public.scheduled_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scheduled_sessions_delete_own" on public.scheduled_sessions;
create policy "scheduled_sessions_delete_own" on public.scheduled_sessions
  for delete using (auth.uid() = user_id);

-- Reuses the trigger function already created in 0001_calendar_schema.sql.
drop trigger if exists scheduled_sessions_set_updated_at on public.scheduled_sessions;
create trigger scheduled_sessions_set_updated_at
  before update on public.scheduled_sessions
  for each row execute function public.set_updated_at();

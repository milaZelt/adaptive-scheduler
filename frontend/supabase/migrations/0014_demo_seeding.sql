-- Backs Ticket 10's "Try Demo" (anonymous sign-in, reuses the real app
-- entirely - see the plan doc). Seeding must happen exactly once per
-- account, not "whenever the tables look empty": a visitor is free to
-- delete the starter content, and that must not silently come back.
--
-- demo_seeded's mere existence for a user_id is the "already seeded" flag -
-- no other columns needed. seed_demo_content's insert into it uses
-- on conflict do nothing + checks whether that insert actually landed
-- (get diagnostics ... row_count) before doing anything else - this is
-- what makes it safe under concurrency (two tabs racing right after sign-in),
-- not just a check-then-act flag read.

create table if not exists public.demo_seeded (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.demo_seeded enable row level security;

drop policy if exists "demo_seeded_select_own" on public.demo_seeded;
create policy "demo_seeded_select_own" on public.demo_seeded
  for select using (auth.uid() = user_id);

drop policy if exists "demo_seeded_insert_own" on public.demo_seeded;
create policy "demo_seeded_insert_own" on public.demo_seeded
  for insert with check (auth.uid() = user_id);

create or replace function public.seed_demo_content(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_inserted int;
  v_cat_classes uuid := gen_random_uuid();
  v_cat_deep_work uuid := gen_random_uuid();
  v_cat_personal uuid := gen_random_uuid();
  v_task_notes uuid := gen_random_uuid();
  v_task_email uuid := gen_random_uuid();
  -- Weekly-recurring fixed events are anchored to the nearest upcoming
  -- occurrence of their day-of-week (today counts), so "weekly" recurrence
  -- (lib/calendar/recurrence.ts: same getDay() as the anchor, every week
  -- from then on) actually produces a full standing week no matter which
  -- day someone happens to open the demo on. dow uses Postgres's extract(dow),
  -- 0=Sunday..6=Saturday - same convention as JS's Date.getDay().
  v_dow int := extract(dow from current_date)::int;
  v_next_mon date := current_date + ((1 - v_dow + 7) % 7);
  v_next_tue date := current_date + ((2 - v_dow + 7) % 7);
  v_next_wed date := current_date + ((3 - v_dow + 7) % 7);
  v_next_thu date := current_date + ((4 - v_dow + 7) % 7);
  v_next_fri date := current_date + ((5 - v_dow + 7) % 7);
  v_next_sat date := current_date + ((6 - v_dow + 7) % 7);
  v_next_sun date := current_date + ((0 - v_dow + 7) % 7);
begin
  insert into public.demo_seeded (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    -- Already seeded, or lost a race to another tab doing the same thing
    -- at the same instant - either way, nothing more to do.
    return;
  end if;

  insert into public.categories (id, user_id, name, color, checked)
  values
    (v_cat_classes, p_user_id, 'Classes', '#EDDCD2', true),
    (v_cat_deep_work, p_user_id, 'Deep Work', '#BCD4E6', true),
    (v_cat_personal, p_user_id, 'Personal', '#C5DEDD', true);

  -- A standing weekly routine, not a pile of one-off appointments, covering
  -- all seven days - not just Mon-Thu. That matters beyond realism: the
  -- solver's tie-break for otherwise-equal placements prefers the earliest
  -- open slot, so a day left with zero fixed events (Fri-Sun, in an earlier
  -- version of this seed) could end up absorbing every single flexible
  -- session whenever the demo happened to be opened on that day - exactly
  -- what happened landing on a Saturday. Real occupancy on every day is
  -- what actually spreads placements out, not just how it looks.
  insert into public.events (user_id, category_id, title, event_type, date, all_day, start_time, end_time, repeat)
  values
    (p_user_id, v_cat_classes, 'Algorithms Lecture', 'fixed', v_next_mon, false, 10.0, 11.5, 'weekly'),
    (p_user_id, v_cat_personal, 'Gym', 'fixed', v_next_mon, false, 18.0, 19.0, 'weekly'),
    (p_user_id, v_cat_personal, 'Work Shift', 'fixed', v_next_tue, false, 9.0, 17.0, 'weekly'),
    (p_user_id, v_cat_classes, 'Seminar', 'fixed', v_next_tue, false, 18.5, 20.0, 'weekly'),
    (p_user_id, v_cat_classes, 'Statistics Lecture', 'fixed', v_next_wed, false, 10.0, 11.5, 'weekly'),
    (p_user_id, v_cat_classes, 'Study Group', 'fixed', v_next_thu, false, 14.0, 15.5, 'weekly'),
    (p_user_id, v_cat_personal, 'Gym', 'fixed', v_next_thu, false, 18.0, 19.0, 'weekly'),
    (p_user_id, v_cat_classes, 'Discussion Section', 'fixed', v_next_fri, false, 11.0, 12.5, 'weekly'),
    (p_user_id, v_cat_personal, 'Weekend Workout', 'fixed', v_next_sat, false, 9.0, 10.0, 'weekly'),
    (p_user_id, v_cat_personal, 'Brunch with Friends', 'fixed', v_next_sat, false, 12.0, 13.5, 'weekly'),
    (p_user_id, v_cat_personal, 'Meal Prep', 'fixed', v_next_sun, false, 10.0, 11.5, 'weekly');

  -- Four still unscheduled, mixing priority/deadline/split so the status
  -- list looks like a real backlog, not one sample of each field.
  insert into public.flexible_tasks
    (user_id, category_id, title, priority, deadline, estimate_hours, split_ok, session_min, session_max)
  values
    (p_user_id, v_cat_deep_work, 'Finish project proposal', 'High', current_date + 3, 3, true, 1, 2),
    (p_user_id, v_cat_deep_work, 'Prepare presentation slides', 'High', current_date + 4, 2.5, true, 1, 1.5),
    (p_user_id, v_cat_deep_work, 'Read chapters 4-5', 'Medium', current_date + 5, 2, false, null, null),
    (p_user_id, v_cat_personal, 'Grocery shopping', 'Low', current_date + 2, 1, false, null, null);

  -- Two more are pre-scheduled (their own rows, plus matching
  -- scheduled_sessions rows with real-shaped placement_reasons) so the
  -- demo shows off the "why this slot?" explanation and a Scheduled
  -- section immediately, before the visitor has clicked anything. Anchored
  -- to the same v_next_mon/v_next_thu dates as the recurring events above
  -- (not current_date) so their blockedBy explanations stay true - Gym and
  -- Study Group actually do occur on those dates.
  insert into public.flexible_tasks
    (id, user_id, category_id, title, priority, deadline, estimate_hours, split_ok, scheduling_status)
  values
    (v_task_notes, p_user_id, v_cat_deep_work, 'Review lecture notes', 'High', v_next_mon + 1, 1, false, 'scheduled'),
    (v_task_email, p_user_id, v_cat_deep_work, 'Email professor', 'Medium', v_next_thu + 1, 0.5, false, 'scheduled');

  insert into public.scheduled_sessions
    (user_id, task_id, category_id, date, start_time, end_time, placement_reason, completion_status)
  values
    (
      p_user_id, v_task_notes, v_cat_deep_work, v_next_mon, 19.5, 20.5,
      jsonb_build_object(
        'priority', 'High',
        'deadline', (v_next_mon + 1)::text,
        'sessionIndex', 1,
        'sessionCount', 1,
        'otherTierTasksCount', 2,
        'blockedBy', jsonb_build_object('title', 'Gym', 'start', 18, 'end', 19)
      ),
      'unresolved'
    ),
    (
      p_user_id, v_task_email, v_cat_deep_work, v_next_thu, 16.0, 16.5,
      jsonb_build_object(
        'priority', 'Medium',
        'deadline', (v_next_thu + 1)::text,
        'sessionIndex', 1,
        'sessionCount', 1,
        'otherTierTasksCount', 1,
        'blockedBy', jsonb_build_object('title', 'Study Group', 'start', 14, 'end', 15.5)
      ),
      'unresolved'
    );

  -- Reuses the existing My Note widget as the demo's instructions surface,
  -- instead of a longer on-screen banner - it's already real, already
  -- editable, and already visible without adding anything new. MyNote.tsx
  -- gives this a distinct "guide" visual treatment in demo mode, so the
  -- content itself is written as short, blank-line-separated points rather
  -- than one dense paragraph, to match.
  insert into public.user_notes (user_id, content)
  values (
    p_user_id,
    E'This calendar is already loaded with example tasks and events.\n\nAdd your own task or event, then click Update Schedule to see the real solver place it.\n\nGoogle Calendar import isn''t available in demo mode.'
  )
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.seed_demo_content(uuid) from public;
grant execute on function public.seed_demo_content(uuid) to authenticated;

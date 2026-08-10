-- Update Schedule needs a true transactional delete-then-insert (decisions
-- record) - the JS Supabase client has no multi-statement transaction
-- support from application code, so this has to be a Postgres function:
-- a single RPC call is atomic by construction, where two sequential client
-- calls (delete, then insert) could partially fail and leave a user with
-- zero sessions for the horizon until they retry.
--
-- security invoker (explicit, matches the default, but stated for clarity
-- on security-sensitive code): runs with the calling user's own RLS
-- context, not elevated privileges. p_user_id is not a trust boundary by
-- itself - the existing RLS policies on both tables still fully apply
-- inside this function, so even a caller-side bug passing the wrong id
-- can't touch another user's rows. It's there so the DELETE/INSERT/UPDATE
-- scope is explicit and readable, not because RLS needs the help.

create or replace function public.apply_schedule_update(
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_sessions jsonb,       -- array of {task_id, category_id, date, start_time, end_time, placement_reason}
  p_task_statuses jsonb   -- array of {task_id, status}
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
end;
$$;

revoke all on function public.apply_schedule_update(uuid, date, date, jsonb, jsonb) from public;
grant execute on function public.apply_schedule_update(uuid, date, date, jsonb, jsonb) to authenticated;

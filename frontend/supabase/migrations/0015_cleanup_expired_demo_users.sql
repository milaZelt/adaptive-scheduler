-- Anonymous "Try Demo" accounts (Ticket 10) were deliberately left to
-- accumulate forever - see the plan doc's own "flagged, deliberately not
-- built now" note. This sweeps them out automatically instead.
--
-- Deleting straight from auth.users is what actually removes an account -
-- every user-owned table (categories, events, flexible_tasks,
-- scheduled_sessions, user_notes, schedule_runs, demo_seeded,
-- google_credentials) already cascades off auth.users(id) on delete
-- cascade, so nothing else needs touching here.
--
-- Runs as a scheduled Postgres job (pg_cron), not application code - this
-- keeps the Supabase service role key out of the deployed app entirely,
-- matching the project's existing rule that it's only ever used for the
-- one-time E2E test-user script.

create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_expired_demo_users()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from auth.users
  where is_anonymous = true
    and created_at < now() - interval '24 hours';
end;
$$;

select cron.schedule(
  'cleanup-expired-demo-users',
  '0 */6 * * *',
  $$select public.cleanup_expired_demo_users();$$
);

-- Also sweep once immediately, so anything already stale (including any
-- demo accounts created during testing) doesn't sit around for up to 6
-- hours waiting on the first scheduled run.
select public.cleanup_expired_demo_users();

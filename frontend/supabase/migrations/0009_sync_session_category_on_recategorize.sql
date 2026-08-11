-- A flexible task's already-placed scheduled_sessions rows carry their own
-- denormalized category_id (Ticket 4), copied at solve time for query
-- convenience. If the user later recategorizes the task, those existing
-- session rows were left pointing at the old category - wrong display color
-- on the grid, wrong response to the sidebar's per-category show/hide
-- toggle, and (worse) an orphaned-category session would get silently
-- cascade-deleted if the *old* category is ever deleted, even though the
-- task itself had already moved on to a different one.
--
-- Fix-forward: keep the denormalized copy in sync going forward via a
-- trigger, and backfill any rows that are already stale from before this
-- existed.

create or replace function public.sync_scheduled_sessions_category()
returns trigger
language plpgsql
as $$
begin
  if new.category_id is distinct from old.category_id then
    update public.scheduled_sessions
    set category_id = new.category_id
    where task_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists flexible_tasks_sync_session_category on public.flexible_tasks;
create trigger flexible_tasks_sync_session_category
  after update of category_id on public.flexible_tasks
  for each row execute function public.sync_scheduled_sessions_category();

-- One-time correction for any rows already stale before this trigger existed.
update public.scheduled_sessions ss
set category_id = ft.category_id
from public.flexible_tasks ft
where ss.task_id = ft.id
  and ss.category_id is distinct from ft.category_id;

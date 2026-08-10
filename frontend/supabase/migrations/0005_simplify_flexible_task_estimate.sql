-- Simplifies flexible_tasks time estimates to a single required duration,
-- removing the single/range distinction from V1 entirely. "The user decides
-- how much time they want scheduled; Nextly decides when to place it" - a
-- range estimate would require deciding how to collapse it into the one
-- number the solver actually needs, which is unnecessary complexity for V1.
--
-- Fix-forward, not an edit to the already-applied 0003: backfills the new
-- column from whatever existing single/range data is there (range rows, if
-- any, consolidate to their midpoint - a one-time data-preservation choice,
-- not a resurrection of the removed feature) before dropping the old shape.

alter table public.flexible_tasks add column if not exists estimate_hours numeric(5,2);

update public.flexible_tasks
set estimate_hours = case
  when time_estimate_mode = 'single' then time_estimate_value
  else round((time_estimate_min + time_estimate_max) / 2.0, 2)
end
where estimate_hours is null;

alter table public.flexible_tasks alter column estimate_hours set not null;

alter table public.flexible_tasks drop constraint if exists flexible_tasks_estimate_hours_positive;
alter table public.flexible_tasks add constraint flexible_tasks_estimate_hours_positive
  check (estimate_hours > 0);

alter table public.flexible_tasks drop constraint if exists flexible_tasks_estimate_shape;
alter table public.flexible_tasks drop column if exists time_estimate_mode;
alter table public.flexible_tasks drop column if exists time_estimate_value;
alter table public.flexible_tasks drop column if exists time_estimate_min;
alter table public.flexible_tasks drop column if exists time_estimate_max;

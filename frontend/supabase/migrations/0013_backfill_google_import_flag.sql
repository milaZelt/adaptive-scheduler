-- Backfill for a "Google Calendar" category created by an import that ran
-- before migration 0012 added is_google_import - that existing row got the
-- column's default (false) since nothing retroactively knew it should be
-- true, so it still showed up as a normal, selectable category despite
-- being the reserved import target. Safe to run more than once.
update public.categories
set is_google_import = true
where name = 'Google Calendar' and is_google_import = false;

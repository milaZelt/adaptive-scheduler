-- Ticket 8: lets events carry a source and be de-duplicated across repeat
-- imports. 'local' events (the only kind that existed before this) stay
-- fully user-editable as always; 'google' events are read-only copies of a
-- real Google Calendar event, replaced wholesale on each import rather
-- than diffed field-by-field (see the route handler for why).

alter table public.events
  add column if not exists source text not null default 'local'
    check (source in ('local', 'google')),
  add column if not exists google_event_id text;

-- Partial (non-null only) so local events, which never have a
-- google_event_id, don't collide with each other under this constraint.
-- Keyed on date too, not just google_event_id alone - a multi-day all-day
-- Google event is deliberately expanded into one row per spanned day (see
-- eventConversion.ts), so the same google_event_id legitimately recurs
-- across several rows as long as each is a different date.
create unique index if not exists events_user_google_event_id_idx
  on public.events(user_id, google_event_id, date)
  where google_event_id is not null;

-- Where imported events land, tracked by id rather than matched by name -
-- a user who renames "Google Calendar" to something else keeps getting
-- their imports there instead of a second category being silently
-- recreated next time.
alter table public.google_credentials
  add column if not exists import_category_id uuid references public.categories(id) on delete set null;

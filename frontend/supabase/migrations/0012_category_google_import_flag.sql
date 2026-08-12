-- Replaces google_credentials.import_category_id with a flag on the
-- category itself. The category needs to self-describe "I'm the reserved
-- Google-import category" anyway - the client (excluding it from new
-- event/task creation, and blocking rename on it) has no reason to know
-- about google_credentials at all, and a flag on categories serves both
-- that and the import route's own find-or-create lookup, without needing
-- both to agree with each other.

alter table public.categories
  add column if not exists is_google_import boolean not null default false;

alter table public.google_credentials
  drop column if exists import_category_id;

-- Rename notes -> user_notes to match the app's table-naming convention.
-- Safe to run even though 0001 already created + policied `notes`; this just
-- renames the table and its policies in place (data is preserved).

alter table if exists public.notes rename to user_notes;

alter policy if exists "notes_select_own" on public.user_notes rename to "user_notes_select_own";
alter policy if exists "notes_insert_own" on public.user_notes rename to "user_notes_insert_own";
alter policy if exists "notes_update_own" on public.user_notes rename to "user_notes_update_own";
alter policy if exists "notes_delete_own" on public.user_notes rename to "user_notes_delete_own";

alter trigger notes_set_updated_at on public.user_notes rename to user_notes_set_updated_at;

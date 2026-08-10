-- One-time cleanup: 0001 and 0002 were accidentally re-pasted and re-run
-- together after already having been successfully applied earlier. Because
-- 0001's `create table if not exists public.notes` doesn't know "notes"
-- conceptually became "user_notes", it recreated a stray empty `notes`
-- table, which then collided with 0002's rename targets (both the table
-- rename and the policy renames) on subsequent runs.
--
-- This migration forces the correct end state directly rather than trying
-- to complete the interrupted rename chain: drop the stray table, drop both
-- possible policy/trigger name variants (old and new) via IF EXISTS so it's
-- safe regardless of which ones actually exist, then recreate the correct
-- ones fresh. Touches no rows - user_notes's actual data is untouched.

drop table if exists public.notes;

drop policy if exists "notes_select_own" on public.user_notes;
drop policy if exists "notes_insert_own" on public.user_notes;
drop policy if exists "notes_update_own" on public.user_notes;
drop policy if exists "notes_delete_own" on public.user_notes;
drop policy if exists "user_notes_select_own" on public.user_notes;
drop policy if exists "user_notes_insert_own" on public.user_notes;
drop policy if exists "user_notes_update_own" on public.user_notes;
drop policy if exists "user_notes_delete_own" on public.user_notes;

create policy "user_notes_select_own" on public.user_notes
  for select using (auth.uid() = user_id);
create policy "user_notes_insert_own" on public.user_notes
  for insert with check (auth.uid() = user_id);
create policy "user_notes_update_own" on public.user_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_notes_delete_own" on public.user_notes
  for delete using (auth.uid() = user_id);

drop trigger if exists notes_set_updated_at on public.user_notes;
drop trigger if exists user_notes_set_updated_at on public.user_notes;
create trigger user_notes_set_updated_at
  before update on public.user_notes
  for each row execute function public.set_updated_at();

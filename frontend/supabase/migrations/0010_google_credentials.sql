-- Ticket 7: stores the Google OAuth refresh token captured at sign-in (via
-- access_type=offline&prompt=consent) so a later request can mint a fresh
-- access token without the user re-consenting. One row per user - Supabase's
-- own session only carries the provider tokens transiently at exchange time,
-- it doesn't persist them anywhere queryable, so this table is the durable
-- copy. Never read from the browser (lib/google/credentials.ts is
-- server-only) - RLS still scopes it to its own owner regardless, same as
-- every other per-user table in this app.

create table if not exists public.google_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scope text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_credentials enable row level security;

drop policy if exists "google_credentials_select_own" on public.google_credentials;
create policy "google_credentials_select_own" on public.google_credentials
  for select using (auth.uid() = user_id);

drop policy if exists "google_credentials_insert_own" on public.google_credentials;
create policy "google_credentials_insert_own" on public.google_credentials
  for insert with check (auth.uid() = user_id);

drop policy if exists "google_credentials_update_own" on public.google_credentials;
create policy "google_credentials_update_own" on public.google_credentials
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "google_credentials_delete_own" on public.google_credentials;
create policy "google_credentials_delete_own" on public.google_credentials
  for delete using (auth.uid() = user_id);

-- Reuses the trigger function already created in 0001_calendar_schema.sql.
drop trigger if exists google_credentials_set_updated_at on public.google_credentials;
create trigger google_credentials_set_updated_at
  before update on public.google_credentials
  for each row execute function public.set_updated_at();

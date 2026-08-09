-- Calendar persistence schema: categories, events, notes.
-- Every user-owned table carries user_id + RLS scoped to auth.uid().
-- Run this once in the Supabase Dashboard SQL Editor (or via `supabase db push`
-- once the project is linked).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- CATEGORIES
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null,
  checked boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_id_idx on public.categories(user_id);

alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- EVENTS (fixed events only for now; event_type is future-proofing for
-- flexible-event scheduling, not used by the app yet)
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  event_type text not null default 'fixed' check (event_type in ('fixed', 'flexible')),
  date date not null,
  all_day boolean not null default false,
  start_time numeric(5,2),
  end_time numeric(5,2),
  description text,
  repeat text not null default 'none'
    check (repeat in ('none', 'daily', 'weekly', 'monthly', 'annually', 'weekday', 'custom')),
  custom_recurrence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_time_required_unless_allday
    check (all_day or (start_time is not null and end_time is not null)),
  constraint events_end_after_start
    check (all_day or end_time > start_time)
);

create index if not exists events_user_id_idx on public.events(user_id);
create index if not exists events_user_date_idx on public.events(user_id, date);
create index if not exists events_category_id_idx on public.events(category_id);

alter table public.events enable row level security;

drop policy if exists "events_select_own" on public.events;
create policy "events_select_own" on public.events
  for select using (auth.uid() = user_id);

drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own" on public.events
  for insert with check (auth.uid() = user_id);

drop policy if exists "events_update_own" on public.events;
create policy "events_update_own" on public.events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "events_delete_own" on public.events;
create policy "events_delete_own" on public.events
  for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- NOTES — exactly one row per user (user_id is the primary key).
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

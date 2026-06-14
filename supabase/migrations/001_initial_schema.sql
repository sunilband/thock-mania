-- Profiles table — synced from auth.users on sign-up
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Anyone can read profiles (for leaderboard display names/avatars)
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Anonymous'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Test results table — stores every valid test (powers leaderboard + history)
create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wpm integer not null,
  raw integer not null,
  accuracy numeric(5,2) not null,
  consistency numeric(5,2) not null,
  mode text not null,
  mode_detail text not null,
  elapsed_seconds numeric(6,2) not null,
  correct_chars integer not null default 0,
  incorrect_chars integer not null default 0,
  extra_chars integer not null default 0,
  missed_chars integer not null default 0,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.test_results enable row level security;

-- Everyone can read test results (leaderboard)
create policy "Test results are viewable by everyone"
  on public.test_results for select using (true);

-- Users can insert their own results
create policy "Users can insert own results"
  on public.test_results for insert with check (auth.uid() = user_id);

-- Index for leaderboard queries (top WPM)
create index idx_test_results_wpm on public.test_results (wpm desc);
create index idx_test_results_user on public.test_results (user_id, created_at desc);

-- Site stats table — visitor count, total tests, etc.
create table if not exists public.site_stats (
  key text primary key,
  value bigint not null default 0
);

-- Seed the visitor counter
insert into public.site_stats (key, value) values ('visitor_count', 0)
  on conflict (key) do nothing;

-- Enable RLS
alter table public.site_stats enable row level security;

-- Everyone can read site stats
create policy "Site stats are viewable by everyone"
  on public.site_stats for select using (true);

-- Only server (service role) or RPC can increment — no direct client writes
-- We'll use an RPC function for atomic increment

create or replace function public.increment_visitor_count()
returns bigint as $$
declare
  new_val bigint;
begin
  update public.site_stats
    set value = value + 1
    where key = 'visitor_count'
    returning value into new_val;
  return new_val;
end;
$$ language plpgsql security definer;

-- Function to get visitor count without incrementing
create or replace function public.get_visitor_count()
returns bigint as $$
declare
  result bigint;
begin
  select value into result from public.site_stats where key = 'visitor_count';
  return result;
end;
$$ language plpgsql security definer;

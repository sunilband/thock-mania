-- Allow anonymous users in profiles table
-- Remove the FK constraint to auth.users so we can store anonymous profiles
-- Add is_anonymous flag and anonymous_uid for cookie-based identification

-- Add columns for anonymous user support
alter table public.profiles add column if not exists is_anonymous boolean default false;
alter table public.profiles add column if not exists anonymous_uid text;

-- Index for fast anonymous UID lookups
create unique index if not exists idx_profiles_anonymous_uid 
  on public.profiles (anonymous_uid) where anonymous_uid is not null;

-- Allow anyone to insert profiles (for anonymous users)
create policy "Anyone can insert anonymous profiles"
  on public.profiles for insert with check (true);

-- Update test_results policy to allow anonymous inserts (user_id matches any valid profile)
drop policy if exists "Users can insert own results" on public.test_results;
create policy "Anyone can insert results for their profile"
  on public.test_results for insert with check (
    exists (select 1 from public.profiles where id = user_id)
  );

-- Function to migrate anonymous data to a logged-in user
-- Call this after login with the anonymous_uid from the cookie
create or replace function public.migrate_anonymous_to_user(
  p_anonymous_uid text,
  p_user_id uuid
)
returns void as $$
declare
  v_anon_profile_id uuid;
begin
  -- Find the anonymous profile
  select id into v_anon_profile_id
    from public.profiles
    where anonymous_uid = p_anonymous_uid and is_anonymous = true;

  if v_anon_profile_id is null then
    return;
  end if;

  -- Move all test results from anonymous profile to the logged-in user
  update public.test_results
    set user_id = p_user_id
    where user_id = v_anon_profile_id;

  -- Delete the anonymous profile (cascade would clean up but results are already moved)
  delete from public.profiles where id = v_anon_profile_id;
end;
$$ language plpgsql security definer;

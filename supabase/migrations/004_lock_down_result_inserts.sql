-- Lock down test_results writes to the server only.
--
-- Before this migration ANY visitor could insert rows directly with the public
-- anon key (`supabase.from('test_results').insert(...)` from the browser),
-- completely bypassing the anti-cheat server action. We remove every client
-- INSERT policy so that, with RLS enabled and no permissive policy, the anon
-- and authenticated roles can no longer insert at all.
--
-- The server writes results exclusively through the SERVICE ROLE key
-- (lib/supabase/admin.ts → submitTest), which bypasses RLS. SELECT stays public
-- so the leaderboard and history keep working.

drop policy if exists "Anyone can insert results for their profile" on public.test_results;
drop policy if exists "Users can insert own results" on public.test_results;

-- (No INSERT policy is recreated — only the service role may write.)
-- SELECT remains public via the existing "Test results are viewable by everyone".

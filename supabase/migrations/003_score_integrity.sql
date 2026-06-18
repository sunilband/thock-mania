-- Defense-in-depth: enforce score sanity at the database level.
-- Even if the server action is bypassed, the DB rejects impossible values.
-- These bounds mirror the server-side ceilings in lib/score-submission.ts and
-- lib/validate-result.ts (human typing limits with generous headroom).

alter table public.test_results
  add constraint test_results_wpm_range
    check (wpm >= 0 and wpm <= 300),
  add constraint test_results_raw_range
    check (raw >= 0 and raw <= 350),
  -- raw (all keystrokes) can never be slower than net wpm
  add constraint test_results_raw_gte_wpm
    check (raw >= wpm),
  add constraint test_results_accuracy_range
    check (accuracy >= 0 and accuracy <= 100),
  add constraint test_results_consistency_range
    check (consistency >= 0 and consistency <= 100),
  add constraint test_results_elapsed_positive
    check (elapsed_seconds > 0 and elapsed_seconds <= 3600),
  add constraint test_results_chars_nonneg
    check (
      correct_chars >= 0 and incorrect_chars >= 0
      and extra_chars >= 0 and missed_chars >= 0
    ),
  add constraint test_results_mode_valid
    check (mode in ('time', 'words', 'quote', 'zen'));

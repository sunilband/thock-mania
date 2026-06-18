# RCA: Leaderboard Score Integrity

## Summary

The Thock Mania leaderboard accepted **arbitrary, attacker-controlled scores**. A user could post any WPM they wanted with trivial effort (editing a network request, or inserting a row directly from the browser console). The root cause was a trust boundary error: the score was computed in the browser and accepted by the backend without verification, and the database itself permitted direct client writes. We re-architected scoring so the **server is the source of truth**, locked writes to a privileged path, and added defense-in-depth.

**Severity:** High (integrity). No data loss or PII exposure, but the leaderboard — a core competitive feature — was fully forgeable.

---

## Timeline / Trigger

Discovered when a user demonstrated editing the `fetch` payload in DevTools to submit `wpm: 301` (and observed it landing on the leaderboard). Investigation revealed multiple compounding issues, not just the one edited field.

---

## Vulnerabilities found

### V1 — Backend trusted client-computed scores
- **What:** The `saveTestResult` server action inserted whatever WPM/accuracy/etc. the client sent.
- **Root cause:** Trust boundary violation — a value computed on a machine the attacker controls was treated as authoritative.
- **Exploit:** Edit/replay the request body with any numbers.
- **Impact:** Any score on the leaderboard.

### V2 — Database allowed direct client inserts (the critical one)
- **What:** RLS policy `"Anyone can insert results for their profile"` let the **public anon key** insert into `test_results` directly.
- **Root cause:** Over-permissive RLS; the app server action was treated as the only writer, but the table was writable by anyone holding the public key (which ships to every browser by design).
- **Exploit:** `supabase.from('test_results').insert({...})` straight from the console — bypassing all app code.
- **Impact:** Complete bypass of any application-layer checks. *This made V1's fix insufficient on its own.*

### V3 — Anti-cheat ran only on the client
- **What:** `validateResult()` (impossible WPM, AFK, burst, etc.) executed in the browser.
- **Root cause:** Security control placed on the untrusted side of the boundary.
- **Exploit:** Skip the client entirely (V1/V2); the checks never run.
- **Impact:** Anti-cheat provided no real protection.

### V4 — Client chose the target text
- **What:** Words were generated in the browser.
- **Root cause:** Even if the server recomputed a score, the *input* (the words) was attacker-controlled, so a cheater could pick trivial words and "type" them.
- **Impact:** Recomputation alone would be meaningless without server-owned text.

### V5 — No proof a human actually typed
- **What:** Nothing tied a score to real, time-distributed keystrokes.
- **Root cause:** Only final aggregates existed; the act of typing wasn't captured.
- **Impact:** A script could produce a perfect result instantly.

---

## The single root cause

All five reduce to one principle violation:

> **Never trust input from the client. A value the client computes or can write directly is not a fact.**

The system trusted (a) the computed score, (b) direct DB access, (c) client-side validation, (d) client-chosen words, and (e) the mere claim that typing happened.

---

## Remediation — what we changed

We inverted the trust model so the **server computes and verifies everything**, with layered enforcement:

| # | Layer | Fix | Addresses |
|---|-------|-----|-----------|
| 1 | Server-owned words | `startTest` generates the word list server-side and signs it into an HMAC token (`lib/server-words.ts`, `lib/test-challenge.ts`) | V4 |
| 2 | Server recomputation | `submitTest` ignores client scores and recomputes WPM/accuracy/chars from the signed words + the player's raw input via the shared `countWpm` (`lib/score-submission.ts`) | V1, V3 |
| 3 | Keystroke-timing validation | Client sends per-keystroke timestamps; server rejects superhuman speed (>30 cps, >10% sub-12ms gaps), robotic cadence (interval CV < 0.05), and timelines that don't support the claimed characters | V5 |
| 4 | Tamper-proof challenge | HMAC signature + 15-min expiry + `uid` match prevents altering words/mode, replay, or cross-user submission | V1, V4 |
| 5 | RLS lockdown | Migration `004` removes all client INSERT policies; only the **service-role** key writes (`lib/supabase/admin.ts`) | V2 |
| 6 | DB CHECK constraints | Migration `003` bounds wpm/raw/accuracy/consistency/elapsed/chars/mode as a final backstop | V1, V2 |
| 7 | Rate limiting | ≤ 1 save per profile per 1.5s | abuse/spam |
| 8 | Fail-closed | If the service-role key isn't configured, runs save to localStorage only — never via an insecure path | misconfig |

**Secrets handling:** the service-role key and signing secret are server-only (no `NEXT_PUBLIC_`), and the modules importing them use `import "server-only"` so the build fails if they ever leak into client code. The public anon key stays public (correct — it's gated by RLS).

---

## Defense-in-depth (why one fix wasn't enough)

V1's fix (server validation) was meaningless while V2 (direct DB insert) existed. The lesson: enforce at **every** layer the attacker can reach —

1. App logic can't be trusted to be the only path → **RLS** closes the DB.
2. RLS + server logic can't catch a *plausible* forged score → **server recomputation + timing** raises the bar.
3. Code can have bugs → **DB constraints** catch impossible values regardless.

---

## Request flow (after remediation)

```
startTest()                         submitTest({ token, wordInputs, typed, wordIndex, keystrokeTimes })
  │ resolve identity (server)         │ verify HMAC token + expiry + uid match
  │ generate words (server)           │ recompute score from SIGNED words + raw input (countWpm)
  │ sign {uid,mode,words,iat} → token │ validate keystroke timing (cps / bursts / cadence)
  └─ return { words, token }          │ rate-limit per profile
                                      │ write via service-role client (RLS-exempt)
                                      └─ DB CHECK constraints backstop
```

The browser never sends a trusted score; it sends raw inputs the server re-grades.

---

## Residual risk (honest assessment)

Because typing fundamentally happens on the client, a determined attacker can still **fabricate a believable keystroke timeline** (correct words spread over realistic, human-variance intervals) and pass. We accept this consciously:

- Cheating went from *"edit one number in DevTools"* (seconds, no skill) to *"write a human-like typing simulator that beats statistical timing checks"* (significant effort, detectable with better heuristics).
- Fully eliminating it would require behavioral/biometric analysis or a trusted client — disproportionate for a typing game.
- Zen mode has no fixed duration, so it is scored purely from its keystroke timeline (documented).

Future hardening options if abuse appears: server-side keystroke-rhythm anomaly scoring, per-account anomaly review, optional proof-of-work, or shadow-flagging suspicious runs.

---

## Verification

- **RLS:** confirmed `rls_enabled = true` on all tables; `test_results` has no INSERT policy.
- **Attack tests (browser):** direct insert → blocked by RLS; tampered token → `invalid_challenge`; instant/uniform timing → `impossible_cps` / `robotic_cadence`; mismatched chars → `char_count_mismatch`.
- **Regression:** genuine runs still save (`{ success: true }`); typecheck and production build pass.

---

## Action items / follow-ups

- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in all environments (Vercel + local) — without it, leaderboard saves fail closed.
- [ ] Keep `TEST_SIGNING_SECRET` stable and identical across instances.
- [ ] Apply migrations `003` and `004` to every environment.
- [ ] (Optional) Enable Vercel Skew Protection to remove the post-deploy version-skew window.
- [ ] (Optional) Add server-side anomaly logging to monitor for timeline-fabrication attempts.

---

## Reference: key files

| File | Role |
|------|------|
| `lib/server-words.ts` | Server-side word generation |
| `lib/test-challenge.ts` | HMAC sign/verify of the challenge token |
| `lib/score-submission.ts` | Authoritative score recomputation + timing validation |
| `lib/actions.ts` | `startTest` / `submitTest` server actions |
| `lib/supabase/admin.ts` | Service-role (RLS-exempt) write client |
| `supabase/migrations/003_score_integrity.sql` | Value CHECK constraints |
| `supabase/migrations/004_lock_down_result_inserts.sql` | RLS insert lockdown |

See also the **Anti-Cheat / Score Integrity** section in `AGENTS.md` for the maintained design reference.

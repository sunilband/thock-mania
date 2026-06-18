# Thock Mania — Agent Rules

> **Self-updating rule**: Whenever a change is made that contradicts or extends anything documented here, this file MUST be updated to reflect the new behaviour before the task is considered complete.

---

## Project Overview

Thock Mania is a typing test PWA with mechanical keyboard sounds, real-time WPM tracking, an interactive on-screen keyboard, multiple themes, Google auth, a global leaderboard, and visitor counting. Built by Sunil Band.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5.9 (strict) |
| Package Manager | Bun |
| Styling | Tailwind CSS 4 (PostCSS plugin, oklch colors) |
| Animation | Motion (framer-motion successor) |
| Icons | @phosphor-icons/react, @tabler/icons-react |
| Charts | recharts 3.8 |
| Numbers | @number-flow/react (animated counters) |
| Auth/DB | Supabase (@supabase/ssr + @supabase/supabase-js) |
| PWA | Serwist (@serwist/turbopack) |
| Linting | Biome 2.4 (via ultracite presets) |
| Compiler | React Compiler (production only) |

---

## Project Structure

```
app/                          Next.js App Router
├── api/
│   ├── leaderboard/          GET top 50 unique users by WPM
│   ├── test-results/         POST save result, GET user history
│   └── visitor-count/        GET/POST visitor counter
├── auth/callback/            OAuth code → session exchange
├── leaderboard/              Leaderboard page
├── page.tsx                  Main typing test (client component)
├── layout.tsx                Root layout (providers, fonts, SEO)
├── globals.css               Theme vars, accent schemes, base styles
├── manifest.ts / sw.ts       PWA config
└── not-found.tsx

components/
├── auth/                     AuthProvider, UserMenu
├── layout/                   AppChrome (shell), Logo, VisitorCount
├── settings/                 SettingsProvider, panels, pickers
├── theme/                    ThemeProvider (next-themes), switchers
├── typing/                   TypingTest, WordItem, Results, History, Controls
└── ui/                       Keyboard system, Drawer, Popover, Slider, etc.

hooks/                        use-typing-test, use-media-query
lib/                          Utilities, Supabase clients, types, storage, server actions
supabase/migrations/          SQL schema
proxy.ts                      Supabase session refresh + anonymous UID cookie (Next.js 16 convention)
```

---

## Provider Hierarchy

```
ThemeProvider (dark/light/system via next-themes)
  → Suspense
    → IdentityProvider (resolves identity promise via React `use()`)
      → AuthProvider (Supabase user state + anonymous identity from IdentityProvider)
        → SettingsProvider (all user preferences, localStorage)
          → AppChrome (shell UI + context for header state)
```

---

## Header Layout

The site header contains (left to right):
1. **Logo** — "Thock Mania" text + icon (click resets test)
2. **Visitor count** — animated number ("X thocks and counting"), next to logo
3. **Settings button** — gear icon with ⌘K shortcut hint
4. **Leaderboard button** — trophy icon, always visible (routes to /leaderboard)
5. **User menu** — Sign in button (if logged out) OR avatar pill with dropdown containing: profile info, History button, Sign out

---

## Authentication

- **Provider**: Supabase with Google OAuth only
- **Flow**: `signInWithGoogle()` → OAuth redirect → `/auth/callback` → session
- **Middleware**: `proxy.ts` (Next.js 16 convention) refreshes Supabase session cookies and sets the anonymous UID cookie on every non-static request
- **Profile creation**: Postgres trigger auto-inserts `profiles` row on sign-up (display_name + avatar_url from Google metadata)
- **Client access**: `useAuth()` hook provides `user`, `loading`, `signInWithGoogle`, `signOut`, `anonProfileId`, `displayName`, `avatarUrl`

### Anonymous Users
- Every visitor gets a persistent anonymous UID via a cookie (`kz-anon-uid`), set by middleware on first request
- Cookie lasts 2 years, `SameSite=Lax`, not httpOnly
- No localStorage or client-side cookie reading — the layout reads the cookie server-side and passes identity (displayName, avatarUrl) as props to AuthProvider
- The cookie is automatically attached to server action calls, so the server always knows who the user is
- An anonymous profile is created in the DB on-demand by `resolveUser()` server-side helper
- Anonymous users get a deterministic display name (via `unique-names-generator`) and avatar (via DiceBear shapes API)
- Anonymous users' results are saved to the DB and appear on the leaderboard
- When an anonymous user signs in with Google, `migrateAnonymousData()` server action moves all test results to the authenticated profile and deletes the anonymous one
- The user menu always shows the avatar pill (anonymous or logged in); anonymous users see "Sign in with Google" inside the dropdown

### Server Actions
- `startTest()` — **server** generates the word list (so the player can't choose easy words), signs it into an opaque challenge token (HMAC, `lib/test-challenge.ts`), and returns `{ words, author, token }`. Returns `null` when no identity resolves (client then runs a local, unranked test).
- `submitTest()` — receives the signed token + the player's raw typed word-inputs + keystroke timestamps. Verifies the token, recomputes the score authoritatively (`lib/score-submission.ts`) against the server's own words, validates keystroke timing, then writes via the **service-role** client. The client-computed score is never trusted or stored.
- `getTestHistory()` — fetches user's history, resolves identity server-side
- `migrateAnonymousData()` — migrates anonymous data to logged-in user
- `getResolvedIdentity()` — returns displayName, avatarUrl, isAnonymous
- Located in `lib/actions.ts`

---

## Database Schema (Supabase)

### profiles
- `id` uuid (PK, FK → auth.users)
- `display_name` text
- `avatar_url` text
- `created_at` timestamptz

### test_results
- `id` uuid (PK)
- `user_id` uuid (FK → profiles)
- `wpm`, `raw` integer
- `accuracy`, `consistency` numeric(5,2)
- `mode`, `mode_detail` text
- `elapsed_seconds` numeric(6,2)
- `correct_chars`, `incorrect_chars`, `extra_chars`, `missed_chars` integer
- `created_at` timestamptz

### site_stats
- `key` text (PK) — currently only `'visitor_count'`
- `value` bigint

### RPC Functions
- `increment_visitor_count()` — atomic increment, returns new value
- `get_visitor_count()` — returns current value

### RLS
- All tables: public SELECT
- `test_results`: **no client INSERT policy** (migration 004) — clients (anon/authenticated) cannot insert at all. Only the service-role key (`submitTest`) writes results, bypassing RLS. This is what prevents direct `supabase.from('test_results').insert(...)` cheating from the browser console.
- `profiles`: UPDATE restricted to `auth.uid() = id`; anonymous profile INSERT allowed (display data only, not a cheat vector)

---

## Leaderboard Rules

- Shows top 50 scores with period toggle: **Global** (default), **Weekly**, **Daily**
- **One entry per user** — only their highest WPM within the selected period is shown
- Deduplication happens server-side (fetch top 500 within date range, deduplicate by `user_id`, take first 50)
- API accepts `?period=global|weekly|daily` query param
- Displays: rank, avatar, display name, WPM, accuracy, mode, date
- Period toggle uses `motion layoutId` animation for the active indicator

---

## Visitor Count

- Uses `sessionStorage` key `kz-visited` to track if already counted this session
- First visit per session: POST increments counter
- Subsequent visits: GET fetches current count
- Displayed with `@number-flow/react` animated number + "thocks and counting" label

---

## Anti-Cheat / Score Integrity

**Principle: the server computes every score. The browser's numbers are never trusted.**

A typing test runs in the browser, so the client could always lie about its WPM. Authentication (Supabase/JWT) doesn't help — a *legitimately signed-in* user can still submit a *fake* score. The only defense is to have the server compute the score from inputs it controls. That's what this system does.

### The four layers

1. **Server-owned words.** `startTest()` generates the word list on the server (`lib/server-words.ts`) and signs `{ uid, mode, modeDetail, durationSeconds, words, iat }` into an opaque HMAC token (`lib/test-challenge.ts`, `TEST_SIGNING_SECRET`). The client renders these words and echoes the token back on submit. It cannot swap in easy words, change the mode/duration, submit as another user, or replay a stale token — any change breaks the signature (15-min TTL).

2. **Server-side recomputation.** `submitTest()` ignores any client score. It recomputes WPM / raw / accuracy / character counts from the server's signed `words` + the player's raw `wordInputs`/`typed`/`wordIndex`, using the same `countWpm` the client uses (`lib/score-submission.ts`). Timed runs use the signed `durationSeconds` for elapsed; other modes derive elapsed from the keystroke timeline. Consistency is recomputed from keystroke timing.

3. **Keystroke-timing validation (anti-automation gate).** The client records the timestamp of every character/space keystroke (`keystrokeTimesRef`). The server rejects runs that aren't physically human: non-monotonic timelines, `forwardChars > keystrokes`, keystrokes after a timed clock ends, sustained > 30 chars/sec, > 10% sub-12ms intervals (superhuman), or inter-key interval CV < 0.05 (robotic/constant cadence). This is what stops a script from "typing" correct words instantly.

4. **Locked-down writes + DB constraints.** RLS (migration `004`) removes all client INSERT policies, so a browser cannot `insert` into `test_results` directly with the public key. Only the **service-role** client (`lib/supabase/admin.ts`, used by `submitTest`) can write. CHECK constraints (migration `003`) bound every column as a final backstop. If the service-role key is missing, saves **fail closed** (localStorage only) rather than taking an insecure path.

### Threat → defense

| Attack | Defense |
|--------|---------|
| Edit `wpm` in the save request | Server recomputes from typed input; client number ignored |
| Insert a row directly via the public Supabase key | RLS blocks all client inserts (004); service-role only |
| Type easy words ("aaa aaa") and submit | Server picks + signs the words; client can't choose them |
| Script that fills correct words instantly | Keystroke-timing validation (cps, sub-12ms, cadence) |
| Tamper with the signed token | HMAC signature check fails |
| Replay an old/another user's token | TTL expiry + uid-match check |
| Spam many saves | Per-profile rate limit (1.5s) |

### Residual limitation (be honest about this)

Because typing happens on a machine the attacker controls, a determined cheater can still fabricate a *believable keystroke timeline* (correct words spread over realistic, human-variance intervals). The heuristics make this hard, but not impossible. Cheating has moved from "edit one number in devtools" (trivial) to "write a human-like typing simulator" (serious effort). Fully eliminating it would require behavioral/biometric analysis or a trusted client — out of scope. Zen mode has no fixed duration, so it is scored purely from its keystroke timeline.

### Client-side `validateResult()` is UX only

`lib/validate-result.ts` runs in the browser to show the "invalid result" screen for obviously broken runs. It is **not** a security boundary — all real enforcement is server-side.

---



## Test Result Saving (server-authoritative)

Scores are computed by the **server**, from inputs the server controls. The browser never sends a trusted score.

**Flow:**
1. Test setup (mount / every reset) → `startTest()` server action:
   - server generates the word list (`lib/server-words.ts`, from `public/languages/*.json` / quotes),
   - signs `{ uid, mode, modeDetail, durationSeconds, words, iat }` into an opaque HMAC token (`lib/test-challenge.ts`),
   - returns `{ words, author, token }`. The client renders these words and stores the token.
2. While typing, the hook records the **raw keystroke timeline** (`keystrokeTimesRef` — ms offset of every character + space) and the committed `wordInputs`.
3. Test completes → `ResultsScreen` mounts:
   - `validateResult()` runs client-side (UX only) → shows "invalid result" screen if it fails.
   - Always saves to localStorage + checks personal best (client display).
   - Calls `submitTest({ token, wordInputs, typed, wordIndex, keystrokeTimes })`.
4. If the run has **no token** (offline / no identity), it is saved to localStorage only — never submitted (fail-closed, no insecure path).

> **No text-swap guarantee:** words are now fetched async from `startTest`. The hook clears the displayed words at the start of every reset and uses a monotonic `wordRequestIdRef` so only the *latest* request's words are ever applied. A slow/superseded response (overlapping resets, StrictMode double-mount) is discarded — the user never sees one word set replaced in place by another (worst case is a brief empty area while loading). "Restart same test" reuses the existing words + token without refetching.

### Server-Side Scoring (the security boundary) — `lib/score-submission.ts`

`submitTest()`:
1. **Verifies the challenge** — `verifyChallenge(token)` checks the HMAC signature + 15-min expiry. A tampered token (swapped words, changed mode/duration, different user) fails the signature.
2. **Identity match** — the resolved profile must equal the `uid` the challenge was issued to.
3. **Recomputes the score** from the server's own `payload.words` + the player's `wordInputs`/`typed`/`wordIndex`, using the SAME `countWpm` the client uses (so honest runs match what the player saw). Produces wpm, raw, accuracy, char breakdown.
   - elapsed: timed runs use the signed `durationSeconds`; others derive from the keystroke timeline.
   - consistency: recomputed server-side from the keystroke timing (per-second rate variance).
4. **Validates keystroke timing** (`validateTiming`) — the real anti-automation gate: monotonic timeline, `forwardChars ≤ keystrokes`, no keystrokes after a timed clock ends, sustained CPS ≤ 30, < 10% sub-12ms intervals (superhuman), and inter-key interval CV ≥ 0.05 (rejects robotic/constant cadence).
5. **Rate limit** — ≤ 1 save per profile per `MIN_SAVE_INTERVAL_MS` (1500ms).
6. **Writes via the service-role client** (`lib/supabase/admin.ts`) — the only path that can insert (RLS blocks all client inserts, migration 004).

Defense-in-depth:
- **RLS lockdown** (migration 004) — clients cannot insert `test_results` directly; only the service role.
- **DB CHECK constraints** (migration 003) — bounds on wpm/raw/accuracy/consistency/elapsed/chars/mode.

**Why server-owned words matter:** if the client could pick the target text it could "type" trivial words instantly. Generating + signing them server-side means a run can only be graded against text the server chose.

**Residual limitation (inherent to any client-side typing test):** a determined attacker can still fabricate a believable keystroke timeline (correct words spread over realistic, human-variance intervals). This is the accepted boundary — cheating has moved from "edit one number in devtools" to "write a human-like typing simulator," which the timing heuristics make non-trivial. Truly eliminating it would require behavioral/biometric analysis or a trusted client.

---

## Settings System

All persisted in localStorage with `tc-` prefix:

| Key | Values |
|-----|--------|
| `tc-accent` | classic, mint, royal, dolch, sand, scarlet, carbon |
| `tc-font` | geist-mono, jetbrains-mono, fira-code, etc. |
| `tc-show-keyboard` | true/false |
| `tc-keyboard-size` | full, 1800, tkl, 75, 65, 60, 40 |
| `tc-sound-enabled` | true/false |
| `tc-sound-volume` | 0–1 float |
| `tc-realtime-wpm` | true/false (live stats) |
| `tc-faah-mode` | true/false (sound on wrong keys) |
| `tc-ghost-mode` | true/false (dim upcoming words) |
| `tc-caret-style` | line, block, underline |
| `tc-test-mode` | time, words, quote, zen |
| `tc-time-option` | 15, 30, 60, 120 |
| `tc-word-option` | 10, 25, 50, 100 |
| `tc-quote-length` | short, medium, long |
| `tc-punctuation` | true/false |
| `tc-numbers` | true/false |
| `tc-difficulty` | easy, hard |

---

## History Panel

- Opens from user menu dropdown (when logged in)
- When **authenticated**: fetches from `/api/test-results` (DB-backed, up to 100 entries)
- When **not authenticated**: reads from localStorage (`kz-history` key)
- Falls back to localStorage if DB fetch fails
- Shows summary stats (avg WPM, best WPM, avg accuracy) + recent runs list

---

## Coding Conventions

### General
- **All interactive components are `"use client"`**. Server components only for metadata/layout shell.
- **File naming**: kebab-case for files and folders. PascalCase for component exports.
- **Path alias**: `@/*` maps to project root.
- **Imports**: sorted by Biome (external → internal, alphabetical).
- **No ESLint, no Prettier** — Biome handles everything.

### State Management
- React Context for cross-cutting state (auth, settings, app chrome)
- No Redux/Zustand — local state + refs in hooks
- `useRef` as synchronous mirrors for values that must stay consistent within a single input event
- **No useEffect for derived state** — compute inline during render

### Styling
- Tailwind utility classes with `cn()` helper (clsx + tailwind-merge)
- CSS custom properties in oklch color space
- Accent themes via `[data-accent="X"]` selectors
- Body background tinted with `color-mix()` using keyboard theme colors
- Motion library for entrance/exit animations (staggered delays, spring physics)

### API Routes
- Located in `app/api/*/route.ts`
- Use server-side Supabase client (`lib/supabase/server.ts`)
- Auth check: `supabase.auth.getUser()` — return 401 if no user for protected routes
- Return JSON with consistent shape: `{ entries: [] }`, `{ error: "..." }`, `{ success: true }`

### Anti-cheat
- Scores are computed and enforced **server-side**; the client is never trusted. See the dedicated **Anti-Cheat / Score Integrity** section above for the full design.
- Client-side `validateResult()` (`lib/validate-result.ts`) is UX only (the "invalid result" screen).
- Key files: `lib/server-words.ts`, `lib/test-challenge.ts`, `lib/score-submission.ts`, `lib/supabase/admin.ts`; migrations `003` (CHECK constraints) and `004` (RLS lockdown).

### Error Handling
- Fire-and-forget for non-critical saves (DB write from results screen)
- `.catch(() => { /* comment explaining silence */ })` pattern for intentional silencing
- localStorage is always the fallback when DB is unavailable

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K / Ctrl+K | Toggle settings |
| ⌘H / Ctrl+H | Toggle history |
| Tab + Enter | Restart test |
| Shift + Enter | End zen mode |

---

## Typing Input (keyboard & mobile)

The typing test reads from a hidden, visually-empty `<input>` (in `components/typing/typing-test.tsx`), but the per-word state machine lives in `hooks/use-typing-test.ts`. Input is driven by the **native `InputEvent`'s `inputType` + `data`**, NOT by the input element's `value`.

### Why not the value
On Android Gboard the hidden zero-size input has its caret stuck at index 0, so every inserted character is *prepended* and the element's `value` comes out reversed (e.g. typing "these end" yields `"dne eseht"`). The `data` field, by contrast, always reports each edit in the correct order on every platform. Reading the value (or binding a controlled `value={typed}`) breaks mobile typing; the input is therefore **uncontrolled** and its value is never read.

### How it works (`handleNativeInput(inputType, data)`)
- `insertText` / `insertReplacementText` / `insertFromPaste` / `insertFromComposition` → feed each char of `data` through `handleTypedInput` (a space routes to `processSpace`, others to `processChar`).
- `insertCompositionText` (IME / glide typing / predictions) → `data` is the *cumulative* word being composed; diff it against `composingPrevRef` (`applyTextDiff`) and apply the delta. `compositionstart` resets the buffer; `compositionend` applies any final delta and clears it.
- `deleteContentBackward` / `deleteContent` / `deleteByCut` → one `processBackspace` (which also navigates to the previous word when the current word is empty).
- `deleteWordBackward` → `clearWordOrNavigateBack`.
- `keydown` is reserved for **shortcuts only** (Tab/Enter, Alt/Ctrl word-delete); Gboard reports keyCode 229 for typing, so it is never used for character entry or backspace.

### Ref consistency
`typedRef` / `wordIndexRef` / `wordInputsRef` are the **synchronous** source of truth, written by the processors and reset paths. They are deliberately NOT re-synced from (async) state on every render — doing so races with the rapid multi-event bursts Gboard fires per word and clobbers the refs mid-word, scrambling characters.

### Debug overlay
Append `?debug=true` to the URL to show a fixed overlay with the derived state (`typed`/`idx`/`inputs`) and a rolling log of raw input events (`inputType`/`data`/`value`). Off by default; tap it to clear the log.

---

## PWA

- Service worker source: `app/sw.ts`, imports `defaultCache` from `@serwist/turbopack/worker`
- Built on-demand by the route handler `app/serwist/[path]/route.ts` (via `createSerwistRoute`), served at `/serwist/sw.js` — compatible with Next.js 16 Turbopack builds
- Bundled with `esbuild-wasm` during `next build` (platform-independent; generates a fresh precache manifest each build). Set via `useNativeEsbuild: false` to keep Windows (local) and Linux (Vercel) builds consistent
- Runtime caching via Serwist `defaultCache`
- Registered client-side by `<SerwistProvider swUrl="/serwist/sw.js">` in `app/layout.tsx` (disabled in development)
- Config wraps `next.config.ts` with `withSerwist` from `@serwist/turbopack`
- Sound sprite preloaded via `<link rel="preload">` in `<head>`

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** privileged key; the ONLY way `test_results` rows are written (`submitTest` → `lib/supabase/admin.ts`). Never expose to the client. |
| `TEST_SIGNING_SECRET` | **Server-only** HMAC secret for signing test challenges. Must be stable across all deployments (e.g. `openssl rand -hex 32`). Required in production. |

---

## Build & Dev Commands

| Command | Purpose |
|---------|---------|
| `bun run dev` | Development server (webpack mode) |
| `bun run build` | Production build |
| `bun run typecheck` | TypeScript check (`tsc --noEmit`) |
| `bun run lint` | Biome check |
| `bun run lint:fix` | Biome auto-fix |
| `bun run format` | Biome format |

---

## Flash Prevention

A blocking `<script>` in `<head>` applies both the dark/light theme class AND the accent `data-accent` attribute before first paint to prevent FOUC:
- Reads `theme` from localStorage → applies class to `<html>`
- Reads `tc-accent` from localStorage → sets `data-accent` attribute on `<html>`

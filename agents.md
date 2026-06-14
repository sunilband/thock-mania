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
| PWA | Serwist (@serwist/next) |
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
lib/                          Utilities, Supabase clients, types, storage
supabase/migrations/          SQL schema
middleware.ts                 Supabase session refresh
```

---

## Provider Hierarchy

```
ThemeProvider (dark/light/system via next-themes)
  → AuthProvider (Supabase user state)
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
- **Middleware**: Refreshes session cookies on every non-static request
- **Profile creation**: Postgres trigger auto-inserts `profiles` row on sign-up (display_name + avatar_url from Google metadata)
- **Client access**: `useAuth()` hook provides `user`, `loading`, `signInWithGoogle`, `signOut`

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
- `test_results`: INSERT restricted to `auth.uid() = user_id`
- `profiles`: UPDATE restricted to `auth.uid() = id`

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

## Test Result Saving

1. Test completes → `ResultsScreen` mounts
2. `validateResult()` runs anti-cheat checks (impossible WPM, flat history, AFK, etc.)
3. If **valid**:
   - Always saves to localStorage (`addTestToHistory()`, max 100 entries)
   - Always checks personal best (`saveIfPersonalBest()`)
   - If **authenticated**: fire-and-forget POST to `/api/test-results`
4. If **invalid**: shows "invalid result" screen, no data saved

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
- Client-side validation before any save (`lib/validate-result.ts`)
- Checks: impossible WPM (>300), impossible raw (>350), impossible CPS (>30), burst spikes (>600), flat WPM history, perfect consistency at speed, AFK detection
- Invalid results are never saved to localStorage or DB

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

## PWA

- Service worker: `app/sw.ts` → compiled to `/public/sw.js`
- Runtime caching via Serwist `defaultCache`
- Disabled in development
- Manual registration in `AppChrome` component
- Sound sprite preloaded via `<link rel="preload">` in `<head>`

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |

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

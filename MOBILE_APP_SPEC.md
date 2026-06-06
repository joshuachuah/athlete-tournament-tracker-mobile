# Mobile App Spec — Athlete Tournament Tracker (React Native)

A native iOS/Android companion to the existing web app. Athletes track tournament
expenses, model prize-money scenarios, and see net profit/loss per event — on the
phone they already carry to every tournament.

> **Guiding principle:** the mobile app is a **new client over the existing
> backend**, not a new system. The Flask API stays the single source of truth for
> all money math (P&L, currency conversion, subsidy netting). The app renders and
> collects input — it never re-implements the formula. See the project
> `CLAUDE.md` "Core Domain Logic" section, which still governs.

---

## 1. Goals & Non-Goals

### Goals
- Full feature parity with the web app's core loop: profile → add tournaments →
  scenario P&L → dashboard runway.
- Mobile-first ergonomics the web app only approximates: bottom-tab nav, native
  forms, pull-to-refresh, offline read access, and (optional) push reminders.
- Reuse the existing Flask API and Supabase auth verbatim — zero backend rewrite
  for v1.
- Share TypeScript domain types with the web frontend so the contract can't drift.

### Non-Goals (v1)
- No new backend endpoints unless explicitly called out (§9).
- No on-device P&L recalculation as the source of truth — the server owns it.
- **No offline support in v1.** The app requires connectivity (every write and
  every calculation goes through the server). Offline read-cache is Phase 3 — see
  §8 and the rationale in §16.
- **No biometric lock in v1.** Phase 3.
- No tablet-optimized layouts. Phone portrait first.
- No Android/iOS widgets, no watchOS. (Noted as future work in §15.)

---

## 2. Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Expo (SDK 54+) + React Native** | Managed workflow, OTA updates, EAS Build/Submit. Avoids native toolchain friction. |
| Language | **TypeScript** (strict) | Share types with web (`src/types`). |
| Navigation | **Expo Router** (file-based) | Mirrors the Next.js mental model the team already uses. |
| Server state | **@tanstack/react-query v5** | Same library/version as web — reuse query patterns and `api` client shape. |
| Auth | **@supabase/supabase-js** + `expo-auth-session` | Same Supabase project; Google OAuth via native flow. |
| Secure storage | **expo-secure-store** | Supabase session token (never AsyncStorage for tokens). |
| Local cache | **AsyncStorage** | Cached profile so the app opens to the dashboard without a round-trip. (No offline read-mirror in v1 — Phase 3.) |
| Styling | **NativeWind v4** (Tailwind for RN) | Reuse the web design tokens (profit/loss/warning colors, spacing scale). |
| Icons | **lucide-react-native** | Same icon set as web (`lucide-react`). |
| Forms | **react-hook-form** + **zod** | `zod` already a web dep; share validation schemas. |
| Dates | Native `Intl` + **date-fns** | Lightweight formatting/parsing. |
| Push (optional) | **expo-notifications** | Tournament reminders, break-even alerts. |

> **React Compiler note:** RN supports the React Compiler via the Babel plugin.
> Follow the global guidance — write straightforward components, skip manual
> `useMemo`/`useCallback`/`memo` for ~95% of cases, and keep render functions pure
> so the compiler can memoize safely.

---

## 3. Architecture

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│   React Native App (Expo)   │         │   Supabase (Auth + DB)   │
│                             │  OAuth  │                          │
│  Expo Router screens        │◄───────►│  Google sign-in          │
│  React Query cache          │         │  Postgres (via Flask)    │
│  api client (fetch)         │         └──────────────────────────┘
│  SecureStore (session)      │                    ▲
│  AsyncStorage (profile)     │                    │ SQLAlchemy
└──────────────┬──────────────┘                    │
               │ HTTPS JSON                ┌────────┴──────────┐
               └──────────────────────────►│   Flask API       │
                                           │  /api/profile     │
                                           │  /api/tournaments │
                                           │  /api/fx          │
                                           │  /api/.../search  │
                                           │  utils/pnl.py ◄── single source of P&L
                                           │  utils/currency.py│
                                           └───────────────────┘
```

- The app talks to the **same Flask base URL** as the web app
  (`EXPO_PUBLIC_API_URL`, default `http://localhost:5000` in dev).
- Auth is identical: Supabase issues the session; the app reads the signed-in
  email and uses it to load/save the athlete profile via `/api/profile`.
- All monetary values are stored in the athlete's **home currency** server-side.
  The app displays both home and tournament currency side-by-side (project rule #4).

### CORS
The Flask app reads `CORS_ORIGINS` (see `backend/app.py`). Native apps don't send
a browser `Origin`, so requests from the device generally bypass CORS — but for
Expo web preview and tooling, add the Expo dev origin if needed. No code change
required for native builds.

---

## 4. Authentication Flow

Reuse the existing Supabase project (`NEXT_PUBLIC_SUPABASE_URL` /
`..._ANON_KEY` → `EXPO_PUBLIC_SUPABASE_URL` / `..._ANON_KEY`).

1. **Splash / bootstrap** — read session from SecureStore via Supabase client
   configured with a custom `storage` adapter backed by `expo-secure-store`.
2. **Login screen** — "Continue with Google" button → `expo-auth-session` opens
   the system browser → Supabase OAuth callback via a deep link
   (`athletetracker://auth/callback`).
3. **Profile gate** — after auth, `GET /api/profile?email=<session email>`:
   - `null` → route to **Onboarding / Profile setup**.
   - profile object → cache it (mirrors web's `localStorage` user) and route to
     **Dashboard**.
4. **Sign out** — `supabase.auth.signOut()` + clear SecureStore + clear React
   Query cache + clear cached profile.

> **One provider, not two.** The web app splits `AuthContext` / `UserContext` and
> uses a `useSyncExternalStore` + localStorage + module-cache dance — but that
> machinery exists *only* to avoid Next.js SSR hydration mismatches. React Native
> has no SSR, so collapse it into a single `AuthProvider` holding
> `{ session, profile }` with plain `useState`. Persist the resolved profile in
> AsyncStorage so the app opens straight to the dashboard while the session
> rehydrates. (See §16 for why this simplification is safe to make.)

Biometric app-lock (expo-local-authentication) is **Phase 3**, not v1.

---

## 5. Navigation Map (Expo Router)

```
app/
  _layout.tsx               # Root: providers (Auth, Profile, QueryClient, theme)
  index.tsx                 # Bootstrap/splash → redirect by auth+profile state
  login.tsx                 # Google sign-in
  onboarding.tsx            # First-run profile setup (name, country, currency, sport, savings…)
  (tabs)/
    _layout.tsx             # Bottom tab navigator
    dashboard.tsx           # Tab 1 — season overview, runway, tournament list
    add.tsx                 # Tab 2 — entry point to the add-tournament flow
    profile.tsx             # Tab 3 — edit athlete profile, sign out
  tournaments/
    [id].tsx                # Tournament detail — scenarios, break-even, edit
    new/
      _layout.tsx           # Stepped wizard container (5 steps, §7)
      details.tsx           # Step 1
      prizes.tsx            # Step 2
      travel.tsx            # Step 3
      subsidy.tsx           # Step 4
      spending.tsx          # Step 5 → submit → projection
  search.tsx                # Tournament search (PSA live + known) → prefill new
```

**Bottom tabs:** Dashboard · Add (center, prominent) · Profile.

---

## 6. Data Layer

Port the web `src/lib/api.ts` almost verbatim — same endpoints, same shapes.
Only difference: base URL env var name and using `expo-constants`/`process.env`.

```ts
// lib/api.ts (RN)
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";

export const api = {
  profile: {
    get:  (email: string) => request<AthleteProfile | null>(`/api/profile?email=${encodeURIComponent(email)}`),
    save: (data) => request<AthleteProfile>("/api/profile", { method: "POST", body: JSON.stringify(data) }),
  },
  tournaments: {
    list:   (user_id: string) => request<TournamentWithPnL[]>(`/api/tournaments?user_id=${user_id}`),
    get:    (id: string)      => request<TournamentWithPnL>(`/api/tournaments/${id}`),
    create: (data)            => request<TournamentWithPnL>("/api/tournaments", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data)        => request<TournamentWithPnL>(`/api/tournaments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id)              => request<{ success: boolean }>(`/api/tournaments/${id}`, { method: "DELETE" }),
    search: (q, sport?)       => request<KnownTournament[]>(`/api/tournaments/search?q=${encodeURIComponent(q)}${sport ? `&sport=${sport}` : ""}`),
  },
  fx: {
    convert: (from, to, amount) => request(`/api/fx?from=${from}&to=${to}&amount=${amount}`),
  },
};
```

**Shared types:** publish `src/types/index.ts` (`AthleteProfile`, `Tournament`,
`PrizeRounds`, `PnLResult`, `ScenarioResult`, `SubsidyCovers`) to a shared
location. Options, simplest first:
- Copy the file into the RN project and keep it in sync (acceptable for v1).
- Or extract a tiny `@athlete/types` workspace package consumed by both web and
  mobile (preferred long-term — kills contract drift).

**React Query keys** match web: `["tournaments", userId]`, `["tournament", id]`,
`["profile", email]`. Configure `staleTime` (~60s). In v1 the cache lives in
memory only — persisting it to AsyncStorage for offline reads is Phase 3 (§8).

---

## 7. Screen Specs

Each screen maps to an existing web page. Behavior and rules are inherited from
the web app and `CLAUDE.md`; below are the mobile-specific notes.

### 7.1 Dashboard (`(tabs)/dashboard.tsx`)
Mirrors `src/app/dashboard/page.tsx`.
- **Header:** "Welcome back", athlete name, `{year} Season Overview`.
- **Stats grid (2×2):** YTD Earnings (green), YTD Expenses (red), Net Result
  (green/red + "Profitable season" / "In the red"), Tournaments count
  (`{ytd} this year`). Compute identically to web from the `pnl` on each
  tournament — do **not** recompute net from raw fields.
- **Runway banner** (project rule #3): `Math.floor(savings / avg_net_spend)`.
  - `avg_net_spend` = mean of realistic-scenario losses across tournaments.
  - No losses → "Profitable on average" (green).
  - `runway <= 3` → warning style.
- **Tournament list:** card per tournament with name, profit/loss badge (realistic
  net), location, start date, a **scenario bar** (worst/realistic/best), and
  break-even round. Tap → detail.
- **Mobile extras:** pull-to-refresh (refetch list), skeleton loaders, empty state
  ("No tournaments yet" → Add).

### 7.2 Tournament Detail (`tournaments/[id].tsx`)
Mirrors `src/app/tournaments/[id]/page.tsx`.
- **Three scenario cards** — worst (R1 exit) / realistic / best (title), each
  showing prize money, net result, profitable flag. Project rule #1: never a
  single number.
- **Break-even round** prominently (project rule #2).
- **Currency:** show home + tournament currency side-by-side (rule #4). Use
  `/api/fx` for the tournament-currency view; cache rates 1h (server already does).
- **Expense breakdown:** flights, accommodation, daily × days, coaching, entry,
  misc, with subsidy netting applied (the server returns adjusted figures).
- **Edit:** opens the same wizard pre-filled; `PATCH` on save; P&L recalculates
  server-side and the card updates. Debounce inline edits 300ms (rule from
  CLAUDE.md "Editing a tournament").
- **Delete:** confirm sheet → `DELETE` → back to dashboard, invalidate list.

### 7.3 Add Tournament Wizard (`tournaments/new/*`)
Five steps (matches CLAUDE.md "Adding a new tournament"):
1. **Details** — name, location, country, currency, start/end date, duration
   (auto-derive `duration_days` from dates), entry fee.
2. **Prizes** — per-round amounts (`r1, r2, r3, qf, sf, f, w`) in tournament
   currency. Optional fields.
3. **Travel** — flight cost, accommodation total (nightly × nights helper).
4. **Subsidy & Sponsorship** — **subsidy fields hidden behind an "I am subsidized"
   toggle** (project rule #5). When on: `subsidy_by`, `subsidy_amount`,
   `subsidy_covers` ∈ {flights, accommodation, full_expenses, flat_stipend}.
   Plus `sponsorship_allocated`.
5. **Spending plan** — `daily_spending_cap`, coaching/physio, misc. Warn if planned
   daily spend exceeds cap. Optionally auto-suggest a cap from destination COL
   (future; static table fallback).
6. **Submit** → `POST /api/tournaments` → show generated projection across all
   scenarios.

Wizard UX: progress indicator, per-step validation (zod), back/next, save draft
locally so a backgrounded app doesn't lose input. Values entered in tournament
currency; server converts to home currency on create (see
`backend/routes/tournaments.py:_to_home_currency`).

### 7.4 Tournament Search (`search.tsx`)
Mirrors `src/components/tournaments/TournamentSearch.tsx` →
`GET /api/tournaments/search?q=&sport=`.
- Debounced search input (~300ms). Results show name, tier/tour level, location,
  dates, estimated prize total.
- Tap a result → prefill the Add wizard with name, location, country, currency,
  duration, and estimated `prize_rounds`.
- Squash gets PSA live results merged server-side; the client just renders.

### 7.5 Profile / Onboarding (`onboarding.tsx`, `(tabs)/profile.tsx`)
Mirrors `src/app/profile/page.tsx` → `/api/profile`.
- Fields: name, home_country, home_currency (3-letter, validated), sport,
  monthly_income, savings_balance, monthly_sponsorship.
- Server validation: required name/country/currency/sport; currency must be 3
  chars (mirror client-side with zod for instant feedback).
- On save, cache the returned profile (used as `user.id` for tournament queries
  and `home_currency` for all display).
- Profile screen also hosts **Sign out**. (Biometric-lock toggle: Phase 3.)

---

## 8. Offline & Caching

**v1: online-only.** Every screen needs the server — writes require the
conversion+P&L pipeline, and reads come from `/api/tournaments` with the `pnl`
already computed. The only thing cached locally is the **profile** (AsyncStorage),
so the app opens to the dashboard while the session rehydrates instead of flashing
a loader. No data-mirror, no offline banner, no FX cache. When the network is
down, show standard React Query error/retry states.

**Phase 3 — offline read (deferred):** persist the React Query cache (tournaments
list + detail) to AsyncStorage with `@tanstack/query-async-storage-persister`,
add an "offline — last synced" banner, and cache the last `/api/fx` response per
pair for dual-currency display. Writes stay online-only even then; an optimistic
offline queue is explicitly out of scope.

This deferral is deliberate — see §16.

---

## 9. Backend Changes Required

**v1 target: none.** Every screen is served by existing endpoints
(`/api/profile`, `/api/tournaments`, `/api/tournaments/<id>`,
`/api/tournaments/search`, `/api/fx`, `/health`).

Nice-to-have (only if push notifications ship):
- A small endpoint to register an Expo push token per user, and a scheduled job to
  send tournament-start and break-even reminders. Gate behind a feature flag.
- If added, follow the project testing rule: **Python unit tests required for any
  new backend logic**, and keep `backend/utils/` coverage ≥ 80%.

---

## 10. Design System

Reuse web tokens via NativeWind so the two clients look like one product.

| Token | Use |
|---|---|
| `profit` / `profit-soft` | Positive net, profitable badges, runway-OK banner |
| `loss` | Negative net, loss badges |
| `warning` | Runway ≤ 3, over-cap spend warnings |
| `foreground` / `muted-foreground` | Text hierarchy |
| `secondary` / `border` | Surfaces, dividers |

- **Typography:** mirror web — serif for display headings, mono for the small
  uppercase eyebrow labels ("WELCOME BACK", section headers), sans for body.
- **Money formatting:** port `formatMoney(value, currency)` and `formatDate` from
  `src/lib/utils.ts`. **Never render a monetary value without its currency code**
  (project rule #4 — e.g. `$4,800 USD`, `₦7,200,000 NGN`).
- **Layout:** designed for 375px portrait first (project rule #6); tab bar + safe
  areas via `react-native-safe-area-context`.
- Optional: lean on the `frontend-design` skill for high-polish screens.

---

## 11. Project Structure

```
mobile/
  app/                      # Expo Router screens (see §5)
  components/
    ui/                     # Card, Badge, Button, Input — RN ports of src/components/ui
    dashboard/              # StatCard, RunwayBanner, ScenarioBar, TournamentCard
    tournament/             # Scenario cards, expense breakdown, wizard steps
  context/
    auth.tsx                # Single provider: { session, profile } — plain useState + AsyncStorage
  lib/
    api.ts                  # fetch client (§6)
    supabase.ts             # Supabase client w/ SecureStore storage adapter
    utils.ts                # formatMoney, formatDate (ported from web)
    queryClient.ts          # React Query client (in-memory; persister added in Phase 3)
  types/                    # shared types (copied from web for v1)
  app.json / app.config.ts  # Expo config, deep link scheme, env wiring
  eas.json                  # Build/submit profiles
  __tests__/                # Jest + RNTL
```

---

## 12. Environment & Config

`.env` (Expo reads `EXPO_PUBLIC_*` at build time):

```
EXPO_PUBLIC_API_URL=http://localhost:5000      # Flask base (prod: deployed URL)
EXPO_PUBLIC_SUPABASE_URL=                       # same project as web
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

- **Never** ship the Open Exchange Rates key or Supabase service-role key in the
  app — FX stays server-side (project "Important Notes"). The app only ever calls
  `/api/fx`.
- Deep link scheme: `athletetracker://` (register in `app.json`, add to Supabase
  redirect allow-list).
- Dev: point `EXPO_PUBLIC_API_URL` at the LAN IP of the machine running Flask
  (e.g. `http://192.168.x.x:5000`) so a physical device can reach it.

---

## 13. Testing

Inherit the project's testing posture (CLAUDE.md "Testing & CI"):
- **Domain math stays server-tested** — `backend/tests/test_pnl.py` and
  `test_currency.py` remain the authority; the app must not fork the formula, so
  there's nothing new to test there.
- **App tests (Jest + React Native Testing Library):**
  - Components render P&L/scenario data correctly (worst/realistic/best present,
    currency code always shown, break-even displayed).
  - Runway banner thresholds (profitable / normal / ≤3 warning).
  - Subsidy toggle hides/shows fields (rule #5).
  - Wizard validation (zod) and date→duration derivation.
  - API client request shapes (mocked fetch).
- **CI:** extend `.github/workflows/ci.yml` (or a new workflow) with a mobile job:
  `tsc --noEmit`, ESLint, and Jest. Keep the existing Python + web jobs unchanged.
- **E2E (optional):** Maestro flows for login → add tournament → see projection.

---

## 14. Build & Release

- **EAS Build** for iOS/Android binaries; **EAS Submit** to the stores.
- **EAS Update** (OTA) for JS-only fixes between store releases.
- Profiles in `eas.json`: `development` (dev client), `preview` (internal
  TestFlight / internal track), `production`.
- Versioning: tie to web release cadence; document in repo `README.md`.

---

## 15. Phased Roadmap

**Phase 1 — Foundation**
Expo + Router scaffold, NativeWind tokens, Supabase auth (Google), profile
onboarding, API client, shared types. Exit: sign in → create/load profile.

**Phase 2 — Core loop**
Dashboard (stats, runway, list), tournament detail (scenarios, break-even,
dual-currency), add-tournament wizard, edit/delete. Exit: full feature parity with
web for a single athlete.

**Phase 3 — Mobile delight**
Tournament search prefill, offline read cache, pull-to-refresh, polish, empty/
loading/error states, biometric lock. Exit: store-ready beta.

**Phase 4 — Beyond web (optional)**
Push reminders (needs the §9 backend endpoint + tests), home-screen widget for
runway, offline write queue, season export (PDF/CSV).

---

## 16. Architecture Decisions & Rejected Alternatives

The system is deliberately three tiers (RN client → Flask → Supabase/Postgres),
and the v1 client is deliberately thin. Both are choices, recorded here so they
aren't "simplified" away by mistake.

### Keep Flask — do **not** go direct-to-Supabase
The tempting simplification is to drop Flask and have the app talk straight to
Supabase (auth + Postgres + auto-REST/RLS), removing a service. **Rejected**, because:
- `backend/utils/pnl.py` is the single source of truth for P&L, and `CLAUDE.md`
  forbids client-side money math. Going direct forces the P&L + subsidy-netting +
  currency logic into Postgres functions or Edge Functions — a rewrite of `pnl.py`
  that **forks the formula** and abandons the Python test suite + 80% coverage gate.
- The Open Exchange Rates key must stay server-side, so you'd *still* need a
  server-side function for `/api/fx` regardless.
- Net result: you don't remove server code, you re-implement it elsewhere and
  break an invariant. That's more complexity, not less. The three tiers are earned
  — Flask is where the trusted math and the secret key live.

### Collapse the two web providers into one
The web app's `AuthContext` / `UserContext` split, the `useSyncExternalStore`,
the localStorage module-cache — all of it exists to survive Next.js SSR hydration.
RN has no SSR, so a single `AuthProvider` with plain `useState` + AsyncStorage is
correct and strictly simpler (§4). Carrying the web pattern over would be cargo-cult.

### Thin v1 client — offline, biometrics, MMKV deferred
- **Offline read-cache, FX caching, offline banner → Phase 3 (§8).** v1 is
  online-only. The app needs the server for every write (conversion + P&L) and
  reads come back with `pnl` precomputed, so an offline mirror buys little for real
  upfront cost (cache hydration, staleness, invalidation). Not worth it for v1.
- **Biometric lock → Phase 3.** Nice for financial data, not core to the loop.
- **Storage: AsyncStorage, not MMKV.** One library, and it's what the Phase 3
  React Query persister integrates with out of the box. Revisit MMKV only if
  profiling shows a real bottleneck.
- **Shared types: copy the file for v1**, extract `@athlete/types` later if drift
  becomes a problem.

### Kept as-is (already the simple option)
Expo + Expo Router, React Query (same version/patterns as web), the ported `fetch`
`api` client, SecureStore for the token only, NativeWind for shared tokens,
react-hook-form for the 5-step wizard. None of these add a tier or a concept the
web app doesn't already have.

---

## Appendix A — Endpoint Reference (existing)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/profile?email=` | Load athlete profile (or `null`) |
| POST | `/api/profile` | Create/update profile (upsert by email) |
| GET | `/api/tournaments?user_id=` | List tournaments **with `pnl` + `home_currency`** |
| POST | `/api/tournaments` | Create (server converts to home currency, computes P&L) |
| GET | `/api/tournaments/:id` | Single tournament with `pnl` |
| PATCH | `/api/tournaments/:id` | Update fields, recompute P&L |
| DELETE | `/api/tournaments/:id` | Delete |
| GET | `/api/tournaments/search?q=&sport=` | Known + PSA-live results |
| GET | `/api/fx?from=&to=&amount=` | Convert; returns `{converted, rate}` |
| GET | `/health` | Liveness |

## Appendix B — Core Types (shared with web, `src/types/index.ts`)

`AthleteProfile`, `Tournament`, `PrizeRounds` (`r1 r2 r3 qf sf f w`),
`SubsidyCovers` (`flights | accommodation | full_expenses | flat_stipend`),
`Scenario` (`worst | realistic | best`), `ScenarioResult`
(`{ scenario, round, prize_money, net_result, profitable }`), `PnLResult`
(`{ total_expenses, total_income_base, scenarios[], break_even_round }`).

The list/detail endpoints return `TournamentWithPnL = Tournament & { pnl: PnLResult; home_currency: string }`.

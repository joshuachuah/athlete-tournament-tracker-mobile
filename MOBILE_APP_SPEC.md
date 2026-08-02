# Mobile App Spec — Athlete Tournament Tracker

This document describes the behavior and architecture currently shipped by the
Expo mobile app. Sections 1–14 are current-state documentation. Section 15 is the
only roadmap section; every entry there is explicitly marked shipped, deferred,
or rejected.

> **Product invariants**
>
> - The Flask backend owns P&L, subsidy netting, currency conversion, and all
>   other authoritative financial calculations.
> - The app collects input and renders server-derived financial results. It does
>   not fork the backend formula.
> - Every rendered money value includes an ISO currency code.
> - React Compiler owns memoization. Components stay pure and do not introduce
>   `useMemo`, `useCallback`, or `React.memo`.

---

## 1. Product Scope

The app supports the core athlete workflow:

1. Sign in with Google through Supabase Auth.
2. Create or load an athlete profile.
3. Search for a known tournament or start one from scratch.
4. Create, edit, and delete tournament projections.
5. Review server-generated worst, realistic, and best scenarios, break-even,
   tax-adjusted prize values, expenses, season totals, and runway.

The shipped app is phone-portrait first. It requires the API for tournament
reads, writes, FX conversion, and P&L. It does not provide a persisted offline
tournament mirror, biometric lock, widgets, or push reminders.

## 2. Shipped Technology

`package.json` and `pnpm-lock.yaml` are the dependency authorities. The main
runtime choices are:

| Concern | Shipped choice |
|---|---|
| Framework | Expo SDK 54, React Native 0.81, React 19 |
| Language | Strict TypeScript |
| Navigation | Expo Router 6 with native tabs and stack routes |
| Server state | TanStack React Query 5 |
| Authentication | Supabase JS, Expo AuthSession, and Expo WebBrowser |
| Session storage | Expo SecureStore through the Supabase storage adapter |
| Local profile and draft storage | `expo-sqlite/localStorage/install` |
| Forms and validation | React Hook Form is installed; the tournament form uses local state and zod schemas |
| Styling | React Native style objects and `StyleSheet`, using tokens from `constants/theme.ts` |
| Dates and money | date-fns plus `Intl.NumberFormat` helpers in `lib/utils.ts` |
| Icons | lucide-react-native and native tab icons |
| Tests | Jest, jest-expo, and React Native Testing Library |
| Memoization | React Compiler via `babel-plugin-react-compiler` |

The app does not depend on a utility-class styling runtime. Colors, radii, and
spacing are defined in `constants/theme.ts`; components apply those tokens with
React Native style objects.

## 3. Current Architecture

```text
Expo Router screens and components
        |
        +-- AuthProvider --------------------> Supabase Auth
        |      |                                  |
        |      +-- SecureStore session            +-- Google OAuth
        |      +-- SQLite-backed profile cache
        |
        +-- TanStack Query --> lib/api.ts --> Flask /api and /health
        |                                      |
        |                                      +-- trusted P&L and FX logic
        |                                      +-- database persistence
        |
        +-- TournamentDraftProvider --> SQLite-backed per-user draft
```

- `EXPO_PUBLIC_API_URL` selects the Flask base URL and defaults to
  `http://localhost:5000` for local development.
- `lib/api.ts` attaches a Supabase bearer token when a session is available,
  applies a 15-second request deadline, preserves caller cancellation, and
  validates successful JSON responses with zod.
- The backend must authorize from the bearer token. The client still sends
  legacy `email` and `user_id` query values because the shipped `/api` contract
  requires them, but those values are not trusted identity proofs.
- Supabase is used directly for authentication, not for tournament data access.
- The app renders nested `pnl` values returned by Flask. Dashboard aggregation
  consumes those server results instead of reconstructing P&L from raw inputs.

## 4. Authentication and Profile Bootstrap

The implementation lives in `lib/supabase.ts` and `context/auth.tsx`.

1. The Supabase client persists and refreshes its session through an Expo
   SecureStore adapter. URL detection is disabled because native callback
   handling is explicit.
2. `AuthProvider` calls `supabase.auth.getSession()` and subscribes to auth state
   changes.
3. Google sign-in requests a Supabase OAuth URL and opens it with
   `WebBrowser.openAuthSessionAsync`. The callback is
   `https://web-production-2fa073.up.railway.app/auth/callback` on iOS 17.4+
   and `athletetracker://auth/callback` on older supported iOS.
4. The Supabase client uses PKCE. The callback handler exchanges a one-time
   authorization `code` and rejects access-token or refresh-token URL fragments.
5. Once a session has both a user ID and email, the provider loads the cached
   profile only when it belongs to that Supabase user, then refreshes it through
   `GET /api/profile?email=`.
6. Missing profiles route to onboarding; resolved profiles route to the
   dashboard.
7. Sign-out clears session/profile state, the per-user profile cache, and the
   React Query cache before calling Supabase sign-out.

### OAuth hardening status

**Shipped locally; external verification pending:** the client configures
`flowType: "pkce"` and accepts code-only callbacks. The live Supabase redirect
allow-list and signed iOS/Android login, cancellation, cold-start, and relaunch
flows have not been verified. Local implementation therefore does not by itself
establish production OAuth readiness.

The app never records provider IDs, access tokens, refresh tokens, or private
environment values in documentation or local profile storage.

## 5. Navigation

```text
app/
  _layout.tsx                       providers and root Stack
  index.tsx                         introduction and auth/profile bootstrap
  login.tsx                         combined Apple/Google login and sign-up
  onboarding.tsx                    first profile setup
  (tabs)/
    _layout.tsx                     Dashboard, Add, Profile native tabs
    dashboard.tsx                   season overview and tournament list
    add.tsx                         start-from-scratch or search choices
    profile.tsx                     profile editing and sign-out
  search.tsx                        known/live tournament search and prefill
  tournaments/
    [id].tsx                        detail, scenarios, edit, and delete
    new/
      _layout.tsx                   draft provider and Stack
      index.tsx                     redirect to details
      details.tsx                   canonical progressive form route
      prizes.tsx                    legacy redirect
      travel.tsx                    legacy redirect
      subsidy.tsx                   legacy redirect
      spending.tsx                  legacy redirect
```

The old step paths remain only for compatibility with saved links and navigation
history. `LegacyTournamentRedirect` sends each one to the canonical details
route and preserves an edit ID when present.

Protected routes mount their query-owning content only after auth bootstrap is
ready. The root route introduces the product to signed-out users, while direct
protected links route them to login. Signed-in users without a profile route to
onboarding.

## 6. Data and Cache Behavior

### API client

The shipped client uses the currency-correct v2 tournament contract. Profile,
search, FX, and health routes remain on their existing paths:

```ts
api.profile.get(email);             // GET /api/profile?email=
api.profile.save(profile);          // POST /api/profile
api.profile.delete();               // DELETE /api/profile
api.tournaments.list(userId);       // GET /api/v2/tournaments
api.tournaments.get(id);            // GET /api/v2/tournaments/:id
api.tournaments.create(payload);    // POST /api/v2/tournaments
api.tournaments.update(id, payload);// PATCH /api/v2/tournaments/:id
api.tournaments.delete(id);         // DELETE /api/v2/tournaments/:id
api.tournaments.search(query, sport);// GET /api/tournaments/search
api.fx.convert(from, to, amount);   // GET /api/fx
api.health();                       // GET /health
```

Successful responses pass through the schemas in `lib/api-schemas.ts`. Invalid
responses fail with `INVALID_RESPONSE`; network, timeout, and caller-abort
failures use distinct API error codes.

### React Query

- The shared `QueryClient` retries queries once and uses a 60-second default
  `staleTime`.
- Tournament lists use `['tournaments', profile.id]`; detail uses
  `['tournament', id]`; search uses
  `['tournament-search', debouncedQuery, profile.sport]`.
- Display FX uses one normalized `['fx-rate', from, to]` unit-rate query per
  currency pair with a one-hour `staleTime`; `MoneyPair` applies the returned
  server rate and target-currency rounding to each displayed amount.
- Query functions forward TanStack Query's cancellation signal to the API
  client for lists, search, detail, edit hydration, and FX rates.
- Profile saves, tournament saves, deletes, auth identity changes, and sign-out
  invalidate or clear the relevant caches.
- Tournament writes capture the initiating user, profile, and bearer token.
  Completion effects are ignored if the authenticated user changes before the
  request settles.
- React Query data remains in memory. It is not restored after process exit.

### Local persistence

`lib/storage.ts` installs Expo SQLite's `localStorage` implementation.

- Profiles are stored in a versioned envelope keyed to the Supabase user ID.
  A cache from another account is removed instead of reused.
- Tournament drafts are stored in a runtime-validated, versioned envelope under
  a per-user key. Known legacy partial drafts migrate through defaults; corrupt
  or unknown data falls back safely. Successful saves clear the draft, and
  abandoned edit drafts are guarded against reuse.
- Supabase session material is separate and remains in SecureStore.

## 7. Screens

### Dashboard

`app/(tabs)/dashboard.tsx` ships:

- athlete greeting and current-season net;
- earned, spent, and tournament-count cards;
- profitable/loss or neutral unavailable season status, including partial
  projection coverage;
- runway derived from server-returned realistic scenarios;
- tournament cards with realistic result, scenario bar, and break-even round;
- pull-to-refresh through `RefreshControl`;
- loading, retryable error, and empty states.

All dashboard money is formatted with the athlete's `home_currency` code.

### Tournament detail

`app/tournaments/[id].tsx` renders the server response:

- worst, realistic, and best scenario cards when supplied;
- pre-tax and `prize_money_after_tax` values when a tax rate applies;
- server-provided break-even round;
- server-adjusted income, expense, and net values;
- home-currency values with a tournament-currency FX view when the codes differ;
- edit navigation and confirmed delete with query invalidation;
- neutral projection-unavailable UI when scenarios are absent;
- exact deleted-detail cache eviction before list invalidation and navigation;
- loading and retryable error states.

The response schema permits either no scenarios or exactly one of each scenario
kind. Partial or duplicate scenario sets are rejected before reaching the UI.

### Progressive tournament form

`app/tournaments/new/details.tsx` mounts one `TournamentForm`; there is no active
stepped wizard. Required details stay visible. Prize/tax, travel, funding, and
spending are collapsible sections with summaries.

The form:

- derives inclusive duration from validated date-only values;
- collects entry, prize, travel, accommodation, spending, subsidy,
  sponsorship, and prize-tax inputs;
- computes an accommodation total helper locally for form input only;
- hides subsidy details until "I am subsidized" is enabled;
- warns when planned extras per day exceed the daily cap;
- expands the first invalid financial section on submit;
- persists a per-user draft and clears it after a successful create/update;
- supports known-tournament prefill and server-backed edit prefill.

Creating or updating returns a server projection and navigates to tournament
detail. The backend remains authoritative for conversion and P&L.

### Tournament search

`app/search.tsx` ships a 300ms-debounced search after two entered characters.
It displays server-provided name, location, date, tier/tour level, and estimated
prize total when available. Selecting a result prefills known details, currency,
dates, prize rounds, and prize tax rate into the progressive form. The screen
includes initial, loading, empty-result, and retryable error states.

### Profile and onboarding

Profile fields are name, home country, three-letter home currency, sport,
monthly income, savings balance, and monthly sponsorship. Identity and home
currency can be edited from Profile. Financial values can only be viewed or
edited after biometric authentication in Private finances, and that destination
re-locks when the app leaves the foreground. Saves are bearer-bound, normalize
the currency code to uppercase, update the user-bound local cache, and invalidate
the profile query key. An actual normalized home-currency change also invalidates
tournament list, detail, and shared FX-rate caches. The Account tab provides
sign-out.

## 8. Currency and Financial Contract

### Shipped `/api/v2` tournament semantics

- Tournament create, list, get, preview, update, and delete use `/api/v2`.
- Flat monetary fields and `prize_rounds` are always denominated in the
  tournament's `currency`, including v2 responses used to prefill edits.
- Nested `pnl` amounts are always denominated in `home_currency`.
- A currency-changing PATCH sends every flat monetary field and the complete
  `prize_rounds` map, as required by the v2 contract.
- `/api/fx` supplies display-only conversions from tournament currency to home
  currency in `MoneyPair`.

These rules remain mandatory:

- The backend owns P&L and conversion.
- `pnl.total_expenses`, `pnl.total_income_base`, scenario prize/net values, and
  `break_even_round` are server-derived.
- The UI formats each monetary value with an explicit currency code.
- Secrets and provider credentials never enter the mobile financial payload.

## 9. Offline Behavior

Tournament and FX data are online-only. When connectivity fails, server-backed
screens show their existing error/retry UI. The profile cache may let the auth
gate resolve without waiting for a fresh profile, and a draft survives process
restart, but neither is an offline tournament read model.

Writes are never queued for later synchronization.

## 10. Design System

`constants/theme.ts` defines the shipped palette, radii, and spacing:

- `profit` / `profitSoft` for positive outcomes;
- `loss` / `lossSoft` for negative outcomes;
- `warning` / `warningSoft` for runway and spending warnings;
- `foreground` / `mutedForeground` for text hierarchy;
- `surface`, `surfaceMuted`, and `border` for structure;
- `accent` / `accentSoft` for primary actions.

Layouts use React Native style objects, safe areas, flexible rows, and wrapping
for narrow phone screens. `formatMoney` always appends the uppercase ISO code,
including when `Intl.NumberFormat` also prints a symbol.

## 11. Repository Structure

```text
app/                         Expo Router screens
components/
  dashboard/                cards, scenario bar, runway
  tournament/               form, scenario, FX, expense components
  ui/                       shared controls and screen states
constants/theme.ts           design tokens
context/auth.tsx             session and profile lifecycle
context/tournament-draft.tsx per-user persisted form draft
hooks/use-debounced-value.ts search debounce
lib/
  api.ts                     authenticated request client
  api-schemas.ts             runtime response validation
  dashboard.ts               aggregation of server P&L results
  query-client.ts            shared in-memory query cache
  storage.ts                 SQLite-backed profile/draft persistence
  supabase.ts                Supabase client and SecureStore adapter
  tournament-draft.ts        draft schemas and payload mapping
  utils.ts                   date, money, and scenario helpers
types/index.ts               current mobile domain types
__tests__/                   Jest and RNTL coverage
.github/workflows/ci.yml     dependency, Expo, typecheck, and test gate
docs/production-readiness.md release evidence and known gaps
app.json / eas.json          Expo identity and EAS profiles
```

## 12. Environment and Build Configuration

The app reads these public build-time values:

```text
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The Supabase anon key is designed for public clients; a service-role key, FX
provider key, or other server secret must never ship in the app. Physical-device
development must use an API host reachable by that device rather than assuming
its `localhost` points to the development machine.

`app.json` defines the `athletetracker` scheme and phone-portrait app identity.
`eas.json` contains development, preview, and production build profiles; preview
and production provide the deployed API URL. Current release evidence and gaps
belong in `docs/production-readiness.md`.

## 13. Testing and CI

The mobile repository tests client behavior, not a duplicate P&L formula.
Coverage includes API request/response handling, auth/profile cache isolation,
runtime schemas, draft lifecycle and validation, progressive form behavior,
legacy redirects, money input, dashboard aggregation, scenario rendering, and
date/currency helpers.

Local gates use pnpm:

```sh
pnpm typecheck
pnpm test --runInBand
```

The merge-blocking CI workflow installs from the frozen lockfile, runs
`pnpm exec expo install --check`, typechecks, and runs Jest. React Doctor is a
separate workflow. No test result should be claimed current unless that command
or its CI run was actually observed.

## 14. Architecture Decisions

### Flask remains the financial boundary — rejected alternative

Direct tournament CRUD against Supabase is rejected. It would bypass the
backend's trusted P&L, subsidy, authorization, and FX boundary or require those
rules to be reimplemented elsewhere.

### One native auth/profile provider — shipped

React Native has no server-rendered hydration boundary, so a single
`AuthProvider` owns the Supabase session and athlete profile lifecycle. Identity
and request-version guards prevent stale async work from crossing account
changes.

### Thin online client — shipped

Server state stays in React Query memory. Only the user-bound profile and
tournament draft persist locally. Server writes remain online-only.

### Copied mobile types — shipped

`types/index.ts` is the mobile contract copy. A shared package may be considered
later, but the current app validates response shapes at runtime to catch drift.

## 15. Roadmap Status

| Capability | Status | Notes |
|---|---|---|
| Expo/Router foundation, Supabase sign-in, profile lifecycle | **Shipped** | Current app foundation |
| Dashboard, tournament detail, create/edit/delete | **Shipped** | Uses server-derived projections |
| Progressive single-page tournament form | **Shipped** | Old step routes redirect |
| Search and known-tournament prefill | **Shipped** | Includes tax-rate prefill |
| Pull-to-refresh and standard loading/error/empty states | **Shipped** | Present on relevant server-backed screens |
| Explicit PKCE-only OAuth callback | **Shipped locally** | Live allow-list and signed iOS/Android callbacks remain unverified |
| Persisted offline tournament reads and last-synced UI | **Deferred** | No implementation commitment yet |
| Biometric app lock | **Deferred** | Not installed or exposed in UI |
| Push reminders | **Deferred** | Would require client and backend work |
| Home-screen widgets and season export | **Deferred** | Optional product ideas only |
| Shared cross-repository type package | **Deferred** | Current mobile copy remains authoritative here |
| Offline write queue | **Rejected** | Conflicts with the online server-authoritative write model |
| Direct tournament access to Supabase | **Rejected** | Would bypass the financial boundary |

---

## Appendix A — Shipped Endpoint Reference

| Method | Path | Mobile use |
|---|---|---|
| GET | `/health` | API health response |
| GET | `/api/profile?email=` | Load athlete profile or `null` |
| POST | `/api/profile` | Create/update the signed-in athlete profile |
| GET | `/api/v2/tournaments` | List currency-correct tournaments with `pnl` and `home_currency` |
| POST | `/api/v2/tournaments` | Create from tournament-currency input |
| POST | `/api/v2/tournaments/pnl-preview` | Preview server-converted outcomes in home currency |
| GET | `/api/v2/tournaments/:id` | Load one currency-correct tournament with P&L |
| PATCH | `/api/v2/tournaments/:id` | Update using tournament-currency monetary inputs |
| DELETE | `/api/v2/tournaments/:id` | Delete one tournament |
| GET | `/api/tournaments/search?q=&sport=` | Search known and live server records |
| GET | `/api/fx?from=&to=&amount=` | Return `{ converted, rate }` for display conversion |

## Appendix B — Current Core Types

`types/index.ts` defines:

- `AthleteProfile`, including `home_currency`, income, savings, and sponsorship;
- `Tournament`, including flat costs, `prize_rounds`, and `prize_tax_rate`;
- `KnownTournament`, including optional prize rounds and prize tax rate;
- `ScenarioResult`, including `prize_money`, `prize_money_after_tax`,
  `net_result`, and `profitable`;
- `PnLResult`, including total expenses, total income, scenarios, and nullable
  break-even round;
- `TournamentWithPnL = Tournament & { pnl: PnLResult; home_currency: string }`.

Runtime schemas in `lib/api-schemas.ts` are intentionally loose about unknown
fields for compatibility but strict about every field the UI consumes.

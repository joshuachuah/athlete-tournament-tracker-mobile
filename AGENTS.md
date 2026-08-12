# Athlete Tracker Mobile — Agent Guide

Athlete Tracker is a Expo/React Native client for athletes to track tournaments, budgets, and P&L.
The app is the UI and session layer. The sibling Flask API is the source of
truth for persistence, currency conversion, and every financial calculation.
Auth is Supabase (PKCE). Phone-portrait iOS first; web exists but isn't the product.

## Non-negotiables

- Never compute P&L, subsidy netting, or FX in the app. Collect input, render
  what the server returns. Every rendered money value shows its ISO currency code.
- React Compiler owns memoization (babel plugin is on). No `useMemo`,
  `useCallback`, or `React.memo`.
- No Tailwind/NativeWind here. Style with `StyleSheet` and tokens from
  `constants/theme.ts`. Don't hardcode colors, radii, or spacing.
- Parse API responses through the zod schemas in `lib/api-schemas.ts`.
  Extend the schema, don't cast.
- `EXPO_PUBLIC_*` vars ship inside the client bundle. Config only — never a
  secret, service-role key, or token.
- The auth stack (`lib/supabase.ts`, `lib/apple-auth.ts`, `lib/auth-redirect.ts`,
  `context/auth.tsx`) has been through multiple security reviews. Treat changes
  there as high-risk: keep PKCE-only, never accept tokens from URL fragments,
  and add tests for what you touch.

## Verify loop

Every change, before calling it done:

1. `pnpm typecheck`
2. `pnpm test`
3. UI work: check it on the iOS simulator, not just web — SecureStore, auth,
   and native tabs behave differently. `pnpm doctor` before finishing UI work.

## Dev servers

- `pnpm start` runs Metro. It's long-running: start it in the background,
  and check port 8081 for an existing instance before spawning another.
  JS-only changes hot-reload through Metro — no rebuild needed.
- Rebuild native (`pnpm ios:simulator`) only when native deps, `app.json`,
  or anything under `ios/` changed. `--build-only` verifies the build
  without launching.
- The app needs the Flask API. If requests fail, hit `<EXPO_PUBLIC_API_URL>/health`
  from the same runtime first (simulator → `localhost:5000`, Android emulator →
  `10.0.2.2:5000`, device → LAN IP). Don't debug the app for a server that isn't up.
- Kill any server you started when you're done.

## iOS / React Native

- `ios/` is committed. Prefer `app.json` / config-plugin changes; only touch
  `ios/` directly when there's no config path, and say so in the PR.
- New screens follow expo-router file conventions under `app/`. Respect safe
  areas; the app is phone-portrait first.
- Session data lives in SecureStore via the Supabase adapter; local profile and
  drafts in `expo-sqlite` localStorage. Don't invent a new storage layer.

## Dependencies

Adding or bumping a package is a real decision here, not a reflex.
`pnpm-workspace.yaml` enforces a 7-day release age, provenance checks, and CVE
gates; `pnpm check:dependency-advisories` runs in CI. Always
`pnpm install --frozen-lockfile`. Propose new deps before adding them.

## Pull requests

- Titles match the repo's history: short, imperative, sentence case, no
  conventional-commit prefixes. "Harden native Google OAuth", not
  "feat(auth): harden oauth".
- Branch naming: `agent/<short-slug>`.
- Description: the problem in a sentence or two, then how you solved it.
  End with a blurb naming the model and harness that made the change.
- Open a real PR, not a draft — drafts skip review-bot coverage.
- After opening: watch checks and bot comments on the latest push. Fix real
  findings; dismiss false positives with a written reason. Done when bots are
  green on the latest commit.

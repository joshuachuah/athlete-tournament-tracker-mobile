# Athlete Tracker Mobile

Athlete Tracker Mobile is an Expo/React Native client for athletes to manage profiles, tournament plans, budgets, and results. The app handles the mobile UI and session, delegates authentication to Supabase, and sends authenticated requests to the sibling Flask API, which remains the source of truth for persistence, currency conversion, and P&L calculations.

## Prerequisites

- Node.js 22 with Corepack enabled.
- pnpm 10.33.0, as pinned in [`package.json`](./package.json).
- Access to the sibling Flask API and its health endpoint.
- Access to the shared Supabase project for the public project URL, public anonymous key, and redirect allow-list.
- Xcode and an iOS Simulator for iOS development, or Android Studio, the Android SDK, and an emulator for Android development. A browser is sufficient for the web target.

From the repository root, enable Corepack and install the locked dependency graph:

```sh
corepack enable
pnpm install --frozen-lockfile
```

## Environment

Create the ignored local environment file from the committed template:

```sh
cp .env.example .env
```

Fill in the three variables from the API and Supabase projects:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Base URL of the sibling Flask API, without a trailing slash. |
| `EXPO_PUBLIC_SUPABASE_URL` | Public URL of the shared Supabase project. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous client key for that Supabase project. Never substitute a service-role key. |

Expo bundles every `EXPO_PUBLIC_*` value into the client. These variables are configuration, not secret storage. Never commit a real `.env` file, auth token, signing key, EAS token, provider credential, Supabase service-role key, or server-side FX credential.

### API addressing

The API URL must be reachable from the runtime that runs the app:

| Runtime | Typical local API URL |
| --- | --- |
| iOS Simulator | `http://localhost:5000` |
| Android emulator | `http://10.0.2.2:5000` |
| Physical device | `http://<development-machine-LAN-IP>:5000` |

For a physical device, put the device and development machine on the same network and ensure the Flask server listens on an address the LAN can reach. Before starting the app, open `<EXPO_PUBLIC_API_URL>/health` in the same simulator, emulator, or device context and confirm that it returns the API health response. A successful request from the development machine alone does not prove that a device can reach the server.

### Supabase callback

The current native configuration uses the `athletetracker` app scheme and requests the callback URL `athletetracker://auth/callback`. Add that exact URL to the Supabase Auth redirect allow-list for the shared project before testing native Google sign-in. Do not broaden the allow-list with an unnecessary wildcard.

The app implements PKCE and accepts only one-time authorization-code callbacks; it does not accept access or refresh tokens from callback URL fragments. Live allow-list inspection and signed iOS/Android callback verification remain external release prerequisites, so local implementation does not by itself establish production OAuth readiness. The app continues to use the legacy `/api` tournament contract and currency semantics; Plan 016 is intentionally deferred.

## Run the app

Start Expo and choose a target interactively:

```sh
pnpm start
```

Or start a target directly:

```sh
pnpm ios
pnpm android
pnpm web
```

The Flask API must be running at `EXPO_PUBLIC_API_URL`. Supabase-backed sign-in also requires valid public Supabase configuration and the callback allow-list entry described above.

## Verify a change

Run the same correctness stack as CI from a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm exec expo install --check
pnpm typecheck
pnpm test --runInBand
```

Success means the lockfile stays unchanged, Expo reports compatible dependencies, TypeScript exits cleanly, and the complete Jest suite passes.

## Project documentation

- [`MOBILE_APP_SPEC.md`](./MOBILE_APP_SPEC.md) records the product and architecture history.
- [`docs/production-readiness.md`](./docs/production-readiness.md) records operational decisions, external verification gaps, and accepted release risks.
- The numbered implementation plan index is maintained as a local planning artifact and is intentionally not published in this repository. Ask a maintainer for the current index before executing or revising a numbered plan.

Keep this README's commands current when scripts or runtime versions change. Detailed release operations belong in the production-readiness documentation rather than here.

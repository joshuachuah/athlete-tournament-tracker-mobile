# Athlete Tracker Mobile

Athlete Tracker Mobile is an Expo/React Native client for athletes to manage profiles, tournament plans, budgets, and results. The app handles the mobile UI and session, delegates authentication to Supabase, and sends authenticated requests to the sibling Flask API, which remains the source of truth for persistence, currency conversion, and P&L calculations.

## Prerequisites

- Node.js 22 with Corepack enabled.
- pnpm 10.33.0, as pinned in [`package.json`](./package.json).
- Access to the sibling Flask API and its health endpoint.
- Access to the shared Supabase project for the project URL, publishable key,
  and redirect allow-list.
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
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public client key for that Supabase project. Never substitute a secret or service-role key. |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Optional public privacy-policy URL. Defaults to `<EXPO_PUBLIC_API_URL>/privacy`. |
| `EXPO_PUBLIC_ACCOUNT_DELETION_URL` | Optional public account-deletion information URL. Defaults to `<EXPO_PUBLIC_API_URL>/account-deletion`. |

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

Native Google OAuth uses `athletetracker://auth/callback` in development,
TestFlight, and production. Add that exact URL to the Supabase Auth redirect
allow-list before testing a signed build. Do not broaden the allow-list with an
unnecessary wildcard.

The app implements PKCE and accepts only one-time authorization-code callbacks; it does not accept access or refresh tokens from callback URL fragments. Live allow-list inspection and signed iOS/Android callback verification remain external release prerequisites, so local implementation does not by itself establish production OAuth readiness. Tournament CRUD and P&L preview use the currency-correct `/api/v2` contract; tournament search, profile, FX, and health retain their existing routes.

### Passwordless email

The email option sends a six-digit Supabase OTP and uses the same flow for
login and signup. Enable the Email provider in Supabase Auth, then update the
email template to include `{{ .Token }}` so the athlete can enter the code in
the app. The client intentionally sets `shouldCreateUser: true`; a first-time
email creates an Auth user and follows the existing onboarding path.

Before release, verify first-time and returning email sign-in, invalid and
expired codes, resend/rate-limit behavior, and delivery to representative mail
providers. This flow is passwordless and does not use email callback URLs.

### Sign in with Apple

The iOS app uses Expo's native Authentication Services integration, passes
Apple's identity token to Supabase, and sends the one-time authorization code
to the authenticated API so it can retain an encrypted revocation token. Before
a signed release:

1. Enable Sign in with Apple for `com.athletetracker.mobile` in the Apple
   Developer portal.
2. Enable the Apple provider in Supabase and include the bundle identifier in
   the provider's authorized client IDs.
3. Configure the sibling API's Apple team, key, client, private-key, and token
   encryption secrets.
4. Verify first sign-in, returning sign-in, cancellation, relaunch, server-side
   token revocation, and account deletion on a signed physical-device build.

Apple only supplies the person's name on the first authorization. The app saves
that name to Supabase metadata when available; onboarding remains the source of
the Athlete Tracker profile.

### Account deletion and legal URLs

Account deletion calls the sibling API's authenticated `DELETE /api/profile`
endpoint. The API deployment must have `SUPABASE_SECRET_KEY` plus its
server-only Apple credentials configured before the full Apple flow can
succeed. Never place those values in an `EXPO_PUBLIC_*` variable.
Newly authenticated users can sign out or delete directly from onboarding;
profile or financial fields are never required before deletion is available.

The Account screen links to the public privacy policy and account-deletion
instructions. The default URLs are `<EXPO_PUBLIC_API_URL>/privacy` and
`<EXPO_PUBLIC_API_URL>/account-deletion`; the optional public URL variables can
point to approved hosted copies instead.

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

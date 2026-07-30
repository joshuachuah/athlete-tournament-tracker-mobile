# Production readiness

## Dependency risk register

Reviewed on 2026-07-25 against Expo `54.0.36`, Expo CLI `54.0.26`,
React `19.1.0`, React Native `0.81.5`, and pnpm `10.33.0`. The live
`pnpm audit --prod` baseline was 17 findings: 1 critical, 11 high, and 5
moderate. The scoped, same-major overrides below reduce that to 8 findings:
0 critical, 5 high, and 3 moderate.

| Advisory / package | Owning chain | Reachability | Action / owner / trigger | Next review date |
| --- | --- | --- | --- | --- |
| GHSA-23hp-3jrh-7fpw and earlier `tar` advisories | `expo > @expo/cli > tar` | Expo CLI archive handling at build time | **Resolved through the critical/high floor.** Mobile dependency owner pins the CLI path from `7.5.16` to same-major `7.5.20`; this removes the critical and prior high findings. | 2026-07-28 |
| GHSA-r292-9mhp-454m / `tar` | `expo > @expo/cli > tar` | Expo CLI archive handling at build time | **Time-gated moderate.** `7.5.21` is compatible with the CLI's `^7.5.2` range, but was published 2026-07-21 22:11 UTC and is blocked by the seven-day release-age policy until 2026-07-28 22:11 UTC. Mobile dependency owner retries after that time. | 2026-07-29 |
| Earlier exponential-expansion advisories / `brace-expansion` | `expo > @expo/cli > minimatch`, plus the CLI's `glob` and React Native dev-middleware paths | CLI glob matching at build/development time | **Resolved where compatible.** Mobile dependency owner pins the three existing major lines to `1.1.16`, `2.1.2`, and `5.0.7`, all within their owning `minimatch` ranges. | 2026-07-30 |
| GHSA-mh99-v99m-4gvg / `brace-expansion` | The same three CLI paths through `minimatch@3.1.5`, `9.0.9`, and `10.2.5` | CLI glob matching at build/development time | **Accepted high pending upstream.** The only patched release is `5.0.8`. It is time-gated until 2026-07-30 11:39 UTC for the `minimatch@10` path and is outside the declared major ranges of `minimatch@3` and `9`. Mobile dependency owner updates the 5.x path after the gate and removes the remaining acceptance when Expo/React Native tooling moves the older paths to a compatible major. No cross-major override. | 2026-07-30 |
| GHSA-52cp-r559-cp3m / `js-yaml` | `expo > @expo/cli > @expo/xcpretty > js-yaml` | Xcode output formatting at build time | **Resolved.** Mobile dependency owner pins the permitted `^4.1.0` path from `4.2.0` to `4.3.0`. The existing Istanbul-only 3.x override remains independently scoped at `3.15.0`. | 2026-08-25 |
| GHSA-395f-4hp3-45gv / `shell-quote` | `react-native > react-devtools-core > shell-quote` | React Native development tooling | **Resolved.** Mobile dependency owner pins the permitted `^1.6.1` path from `1.8.4` to `1.9.0`. | 2026-08-25 |
| GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, and GHSA-r28c-9q8g-f849 / `postcss` | `expo > @expo/metro-config > postcss` | Metro build configuration; the app does not process untrusted CSS at runtime | **Accepted: 2 high and 1 moderate.** Expo SDK 54 Metro declares `~8.4.32`, while the complete patched floor is `8.5.18`. Mobile dependency owner must not force an out-of-range override; remove the acceptance when Expo publishes a compatible Metro range or during the next SDK upgrade. | 2026-08-08 |
| GHSA-w5hq-g745-h8pq / `uuid` | `expo > @expo/config-plugins > xcode > uuid` | Native project generation only | **Accepted moderate.** `xcode@3.0.1` declares `uuid@^7.0.3`, while the patch is `11.1.1`. Mobile dependency owner removes the acceptance when Expo/Xcode tooling updates its declared major. | 2026-08-08 |
| Prior `undici` advisories | `expo > @expo/cli > undici` | Expo CLI networking at build time | **Resolved.** The existing same-major override remains locked at `6.27.0`, within Expo CLI's declared range. | 2026-08-25 |

Expo `54.0.36` and Expo CLI `54.0.26` cleared the release-age gate on
2026-07-22. The supported `pnpm add expo@~54.0.36` workflow initially hit
`ERR_PNPM_TRUST_DOWNGRADE` for `semver@6.3.1` under
`expo@54.0.36 > babel-preset-expo@54.0.12 >
@babel/plugin-transform-runtime@7.29.7`. The package was already locked and used
before this update, and pnpm issue 10622 tracks the OIDC-provenance comparison as an
open bug. The repository keeps `trustPolicy: no-downgrade` intact with no exception.
Expo is locked at `54.0.36`; a clean frozen install from the reviewed lockfile
succeeds and the compatibility check reports that dependencies are up to date.
Any future command that resolves this graph again can still hit the upstream
provenance comparison. Do not bypass the policy; rerun the supported update
workflow when pnpm fixes the comparison.

Although pnpm reports these Expo/React Native chains as production dependencies,
`pnpm why` confines the remaining advisories to CLI, Metro, native-project
generation, and development tooling rather than shipped application logic. Re-run
the live audit and graph review on every date above and at every Expo SDK upgrade.

## React health decisions

The `TournamentForm` mount effect intentionally depends on `initialDraft.editId`.
`DetailsStep` supplies identity-bearing `prefill:*`, `edit:*`, and `resume` keys, so
an identity change remounts the form. Regression coverage proves that a prefill is
persisted to draft context on mount, switching edit keys cannot submit stale values,
and field edits keep form state and draft context synchronized. The exhaustive-effect
hypothesis is therefore accepted as a false positive; expanding the dependency to the
whole draft risks a provider render loop.

The form-size diagnostic is accepted maintainability debt. Extract a section only
when that section gains independent behavior or a second consumer, not solely to
improve a scanner score. React Compiler remains the memoization owner; do not add
`useMemo`, `useCallback`, or `React.memo`.

## Production observability decision

On 2026-07-16, the owner declined third-party production telemetry for the initial
release. Plan 014 is rejected rather than partially implemented: there is no Sentry
SDK, DSN, source-map token, session replay, or application telemetry configured. The
real EAS project binding and executor access were verified separately on 2026-07-15;
they remain valid for signed builds and do not imply that runtime monitoring exists.

The accepted risk is that the team will not receive centralized crash detection,
unhandled-error alerts, release correlation, or automatic production stack-trace
symbolication. Failures must be learned through user reports and reproduced manually.
This is an explicit product/operations tradeoff, not evidence that observability has
been completed.

For manual support, request only the app version/build, platform and OS version,
user-visible error code, approximate occurrence time, and reproduction steps. Never
request credentials, tokens, headers, request or response bodies, email addresses,
user IDs, profile data, tournament data, or financial data.

Reconsider production telemetry if repeated crashes cannot be reproduced, support
volume makes manual diagnosis ineffective, or incident/compliance requirements need
centralized evidence. Any future provider requires a new privacy review and an
explicit implementation plan before collecting data.

## Native OAuth callback migration

The native Supabase client uses PKCE and accepts only a one-time authorization code
from the browser callback. Reusable access and refresh tokens in URL fragments are
rejected. The `athletetracker://auth/callback` target remains as the fallback for
supported iOS releases older than 17.4, while newer iOS uses the associated-domain
HTTPS callback.
the external redirect allow-list and signed migration builds can be verified; no
callback target has been removed from Supabase as part of this local change.

| Environment | Callback target | Supabase redirect allow-list | Signed iOS login, cancellation, cold start, and relaunch | Signed Android login, cancellation, cold start, and relaunch | Local review date |
| --- | --- | --- | --- | --- | --- |
| Preview | `athletetracker://auth/callback` | **NOT VERIFIED** - executor has no live project inspection in this task | **NOT VERIFIED** - no signed build ID available | **NOT VERIFIED** - no signed build ID available | 2026-07-17 |
| Production | `athletetracker://auth/callback` | **NOT VERIFIED** - executor has no live project inspection in this task | **NOT VERIFIED** - no signed build ID available | **NOT VERIFIED** - no signed build ID available | 2026-07-17 |

The private-use scheme can still be claimed by another installed app. PKCE prevents
an intercepted authorization code from being exchanged without the verifier stored
by this app, but the callback-denial risk remains. Before release, approve either a
claimed HTTPS universal/app link with deployed association files or a reverse-domain
private-use scheme, add the exact preview and production URLs to Supabase, and test
both signed platforms. Keep the legacy callback allow-listed until the new builds and
an old migration-window build pass. Expo Go is not sufficient evidence.

## Account deletion, privacy, and iOS sign-in

The mobile app exposes permanent deletion from Account settings, requires an
explicit confirmation phrase, and calls the authenticated backend before clearing
the local profile, tournament draft, legacy draft, and query cache. The backend is
responsible for deleting the Supabase Auth user and the cascading profile and
tournament records. A failed API response leaves the device session and cached
state intact so the user can retry the idempotent server flow; the API commits
local database deletion before removing the Supabase Auth identity so a database
failure cannot strand personal data behind an unusable login.
Profileless users can access the same deletion flow or sign out directly from
onboarding without first providing profile or financial information.

The iOS target includes the Sign in with Apple capability and native button.
Supabase exchanges Apple's identity token and the app preserves the first
authorization's name metadata when available. These local checks do not prove the
external provider configuration or entitlement:

- deploy the backend with `SUPABASE_SERVICE_ROLE_KEY`,
  `PRIVACY_CONTACT_EMAIL`, and all five `APPLE_*` server credentials;
- enable Apple for `com.athletetracker.mobile` in Apple Developer and Supabase;
- deploy and review the public `/privacy` and `/account-deletion` pages;
- obtain legal/product approval for the privacy copy and app-store disclosures;
- exercise Google and Apple deletion on signed preview and production builds.

The app sends Apple's one-time authorization code to the authenticated API
immediately after Supabase sign-in. The API exchanges it server-side and stores
only an encrypted Apple refresh token. Account deletion revokes that token with
Apple before deleting local data and the Supabase Auth identity. This exchange,
storage, and revocation flow must be exercised on a signed physical-device build
against preview and production Apple credentials before release.

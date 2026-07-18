# Production readiness

## Dependency risk register

Reviewed on 2026-07-13 against Expo `54.0.35`, Expo CLI `54.0.25`,
React `19.1.0`, React Native `0.81.5`, and pnpm `10.33.0`.

| Advisory / package | Owning chain | Reachability | Compatible patched version available | Action | Next review date |
| --- | --- | --- | --- | --- | --- |
| GHSA-vxpw-j846-p89q, GHSA-p88m-4jfj-68fv, GHSA-35p6-xmwp-9g52, GHSA-g8m3-5g58-fq7m / `undici` | `expo > @expo/cli > undici` | Build-time CLI only; no app JavaScript or native-runtime chain was printed by `pnpm why` | Yes. Expo CLI declares `^6.18.2`, which permits patched `6.27.0` | Resolved with a same-major pnpm override to `^6.27.0`; locked at `6.27.0` | 2026-08-13 |
| GHSA-qx2v-qp2m-jg93 / `postcss` | `expo > @expo/metro-config > postcss` | Build-time Metro configuration; the app does not process untrusted CSS at runtime | No within the owner's `~8.4.32` range; patched release is `8.5.10` | Accept until Expo SDK 54 publishes a compatible Metro update; do not force an out-of-range override | 2026-08-13 |
| GHSA-w5hq-g745-h8pq / `uuid` | `expo > @expo/config-plugins > xcode > uuid` | Native project generation only | No within `xcode`'s `^7.0.3` range; patched release is `11.1.1` | Accept until Expo/Xcode tooling upgrades its declared major range | 2026-08-13 |
| GHSA-h67p-54hq-rp68 / `js-yaml` | Jest/Istanbul coverage configuration through `@istanbuljs/load-nyc-config` | Test-time only; the separate `js-yaml@4.2.0` used by Expo's Xcode formatter is not affected | Yes. Istanbul's loader declares `^3.13.1`, which permits patched `3.15.0` | Resolved with a targeted same-major pnpm override from `3.14.2` to `3.15.0` | 2026-08-13 |

The final `pnpm audit --prod` report contains two moderate advisories and no high or
critical advisory. Although pnpm labels these paths as production because
Expo is an application dependency, graph inspection confines them to build or test
tools rather than the shipped JavaScript/native runtime. Re-run the audit and graph
review monthly and at every Expo SDK upgrade.

`pnpm update` was attempted on 2026-07-13. The repository's
`trustPolicy: no-downgrade` correctly rejected `semver@6.3.1` because its trust
evidence was weaker than an earlier release. The policy was not bypassed or weakened;
only Expo's supported React Native correction and the range-compatible Undici and
JS-YAML security patches were retained.

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
rejected. The existing `athletetracker://auth/callback` target remains in place until
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

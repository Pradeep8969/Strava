# Pre-Phase 1C checkpoint review

Reviewed 2026-11-16 on `main`, based on `e44359e` (the existing baseline).
Origin is `https://github.com/Pradeep8969/Strava.git`; fetching `main` confirmed
zero commits ahead/behind before this checkpoint. No tracked deletions were found.
All pre-existing source edits and new implementation/test files were preserved.

Scope includes the six-tab application, Google authentication/profile/photo
fallback, GPS reliability, web/native map improvements, offline recovery,
account-scoped route synchronization, atomic IndexedDB/SQLite writes, conflict and
tombstone handling, SQL migrations and RLS tests. The current planner and inactive
routing contract remain intact; no Phase 1C implementation was started.

## Security and exclusions

Reviewed tracked and nonignored candidate paths and scanned text for private keys,
provider credentials, JWTs, credential-bearing URLs and assigned secrets. Five
matches were manually confirmed as synthetic auth/URL-validation test fixtures.
An exact-value comparison against nonempty local environment values found no
matches in candidate files. These checks reduce risk but are not a formal audit.
Public place coordinates and synthetic test coordinates are source/fixtures;
private saved-route exports and downloaded recordings are excluded.

The ignore rules now exclude new generated artifacts, route-backup/export JSON,
compressed SQL backups and SQLite sidecars, in addition to existing environment,
credential, private-route, database, dependency and build-output exclusions.
No new artifact screenshots, logs, deployment workspaces, disposable databases,
private backups or recovery archives are staged. Existing baseline images remain
part of existing history. Local files and browser storage were not cleared.

The deployed planned-route migration's local SHA-256 remains
`a8b35317a9937d6a47ecf0107919546582ab3268f865e19076a1ba749703b8d2`.
The deployment report is historical evidence; no hosted migration or record was
changed during checkpoint preparation.

## Dependency preparation and validation

Installed the already-declared SDK-compatible image picker, which was missing
locally. Expo's installer aligned React Native to `0.88.1` and safe-area-context
to `~5.11.1`, as required by installed Expo SDK 58. npm reconciled the previously
incomplete lockfile and resolved versions within the declared ranges. The lockfile
change is substantial and is intentionally included for reproducible installs.

- TypeScript, ESLint and all 235 unit tests across 43 files pass.
- Expo dependency compatibility check passes; Expo Doctor passes all 20 checks.
- Web, Android and iOS JavaScript/Hermes exports pass using public synthetic
  fixture configuration. Exports do not establish native compilation or device
  acceptance, and are ignored local artifacts.
- Browser verification covers recording/acquisition/recovery, Google avatar
  fallback, planner lifecycle, real IndexedDB atomicity, offline sync,
  reconciliation, account isolation, conflicts and deletion propagation.
  Configured-map and missing-map suites require separate fixture exports.
  Final runs: 13 passed/4 conditionally skipped in the missing-map suite, and
  10 passed/2 conditionally skipped in the configured-map suite. No final browser
  failures remained; the live CDN map check was not run.
- The recording browser test now reloads the persisted Activities screen before
  opening a workout, avoiding ambiguity with the mounted Home card of the same
  name. Production application behavior was not changed for this test correction.
- SQL/RLS tests are included but were not executed against a database in this
  checkpoint task. Prior disposable-database results remain historical evidence.
- npm audit reports eight moderate advisories and zero high/critical advisories.
  No force audit fix or SDK downgrade was applied; dependency advisory remediation
  remains separate follow-up work.

Real-device Google login, background location, native map rendering, signing and
same-account synchronization remain unverified. Local Android Maps and EAS
project-ID configuration were empty; RevenueCat public SDK keys were also empty.
Hosted OAuth redirect settings were not inspected or changed. No EAS cloud build,
app-store deployment or OTA publication was started.

Follow [physical-device instructions](mobile-device-testing.md) for prerequisites,
approval-dependent build commands, installation, Metro QR connection and the
controlled-account acceptance checklist.

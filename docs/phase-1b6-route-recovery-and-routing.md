# Phase 1B.6 — route preservation and routing preparation

Date: 2026-11-16. No live routing provider, key, billing, deployment, commit,
database migration, or production-data operation was introduced.

## Evidence and missing-route diagnosis

Before edits, working-tree status and SHA-256 hashes of all pre-existing changed
files were recorded in `artifacts/phase1b6/baseline.json`. The existing phases remain
in place. Only Explore and Route Studio among those pre-existing modified files
were extended in this phase; map and GPS implementations were untouched.

Web planned routes use IndexedDB database `stravakinda`, version 1, object store
`kv`, key `routes`. Native uses SQLite `stravakinda.db`, table `kv`, key `routes`,
with JSON in `body`. Both store the complete route array. Browser transactions
already wait for commit before reporting success. Neither backend automatically
syncs planned routes through Supabase or the signed-in account. Base-map tiles
still require internet; saved geometry does not provide offline navigation.

The baseline commit uses the same storage key. Repository searches found no older
planned-route localStorage key or schema migration. localStorage is used elsewhere
for auth and organizer storage; those records were not read or modified. Other
unavailable historical builds could have used different keys; absence from this
repository is not proof that no such browser data exists.

Confirmed code issues:

- Route Studio's strict loader rejected the entire list if one record was bad.
- Explore consumed raw records, allowing malformed records to break rendering.
- Saving/deleting another plan normalized all existing plans before writing,
  dropping unknown metadata and replacing legacy values unnecessarily.
- Writes were serialized only within one JS instance. Two tabs could both read
  an old array and overwrite each other's additions.

These issues are demonstrated with fixtures. **They do not establish the cause of
the user's missing routes.** The user's original browser profile was not accessed;
no original route records have been found, exported, imported, or declared lost.
The exact URLs, browser/profile, device, diagnostic inventory and any storage
error are still needed. `localhost` and `127.0.0.1`, different ports, HTTP/HTTPS,
different browser profiles and different devices have separate storage. A test
confirmed that the same saved fixture exists after restart at its original origin
but is absent at the alternate hostname. Private browsing, explicit site-data
removal and browser eviction are other possibilities, not established causes.

## Changes and preservation

- Read-only per-record inspection displays valid legacy/current plans with a
  visible warning for malformed/duplicate records. Source values are untouched.
- Saving/deleting is blocked when the source has malformed or duplicate records.
  New plans are validated; duplicate IDs are rejected.
- Normal writes retain original existing record values and unknown metadata.
- The existing serial queue now also uses an origin-scoped Web Lock when
  available, preventing cooperating tabs from losing concurrent saves. Older
  browsers without Web Locks retain the existing single-instance protection;
  avoid concurrent edits there. Old app tabs that do not acquire the lock are
  also outside this guarantee; close/reopen them after updating.
- Route Studio explains browser/device-local storage. Storage errors remain
  visible through its existing action/error UI; success follows the write.
- Workout storage, strict 35 m GPS requirement, maps, credentials and navigation
  are unchanged. No existing records were automatically converted or rewritten.

## Read-only recovery procedure

1. Open each exact original app URL in the original browser/profile. Do not clear
   site data, reinstall the app, or use a private window for this investigation.
2. In browser DevTools, run the reviewed contents of
   `scripts/route-storage-diagnostic.js`. It reports the current origin, route
   storage locations, counts, route names and read errors. It inspects existing
   IndexedDB route/plan stores or `kv` route/plan keys and matching localStorage
   keys. It excludes auth/session/token keys, makes no network requests, does
   not write storage, and does not print geometry. Names themselves may be
   sensitive; share only the diagnostic information you are comfortable sharing.
3. IndexedDB enumeration is required. Unsupported enumeration or blocked reads
   produce a warning; inspect Application > IndexedDB manually in that case.
   An absent database is not created by the diagnostic. It cannot cross origins,
   read another browser/profile, inspect native SQLite, or recover deleted bytes.
4. If records exist, explicitly invoke
   `window.stravaRouteRecovery.exportPrivateBackup()` to download a private
   route-only bundle. **This file contains coordinates. Do not upload, log, or
   commit it.** The report remains coordinate-free; export is a separate action.
5. From the repository run
   `node scripts/route-backup.mjs "<path-to-downloaded-private-export.json>"`.
   This creates a uniquely named file in ignored `private-route-backups/`, opens
   it with exclusive creation, verifies its bytes by SHA-256 readback and writes
   a checksum sidecar. It never overwrites a backup or changes app storage.
   Git ignore prevents accidental tracking, not access by other local users;
   keep the folder private using the device's normal account/file permissions.

`previewRecovery(current, incoming)` provides a tested **preview only**: it
deduplicates IDs and identical name/ordered-waypoint signatures, never replaces a
conflicting ID, and refuses a writable result if either source has unreadable
records. It does not persist or automatically migrate anything. Different IDs
with different names are not assumed duplicates merely because geometry matches.

No import was enabled: there are no original records yet to inspect and no
verified backup of them. After locating/exporting them, inspect the exact legacy
format, verify the backup, and implement/test an explicit additive import against
that format, preserving originals and reporting skipped conflicts. Unsupported
formats and malformed records remain preserved for manual investigation. Do not
silently discard them to make a migration pass. Native recovery requires a
separate private backup/export from the original app container; this task did not
access a device container or modify SQLite schema.

## Why routes cross buildings

`createPlan()` connects ordered user waypoints directly and calculates spherical
segment distance. A basemap does not turn that geometry into road directions.
Existing plans remain explicitly **Straight-line mode**, with approximate
distance and unverified access/terrain warnings. They are never silently rerouted.

## Provider research

Public documentation was checked on the date above. No authenticated account,
quota dashboard or live directions endpoint was accessed. Nepal suitability is
inferred from global OpenStreetMap coverage, not measured local route quality.
Mapped paths do not guarantee legal access, current conditions or trail safety.

| Option | Profiles / Nepal suitability | Limits, cost and requirements |
| --- | --- | --- |
| MapTiler Routing | Public page describes pedestrian/bicycle routing, but calls it active development/beta. Nepal entitlement/coverage unverified. | No generally available routing entitlement or price was established for this account. Existing map key is not proof of access. Confirm beta access, endpoint, quotas, terms and offline retention with MapTiler. |
| openrouteservice / HeiGIT | Global OSM engine; walking/hiking/cycling profiles. Running would deliberately use a foot profile, not promise a running-specific safety model. Recommended pilot candidate. | Free Standard key available. Hosted restrictions include 50 waypoints; confirm actual daily/minute quota in the new account dashboard. Historical published Standard allowance is 2,000 directions/day and 40/minute, **not a verified entitlement for this project**. Attribution and result licensing apply; confirm storage/personal-data terms before sending user waypoints. |
| GraphHopper hosted | OSM routing with pedestrian/hike/bicycle profiles; check profile availability and Nepal samples with an approved account. | Published Free: 500 credits/day, 5 locations; Basic: €69/month, 5,000 credits/day, 30 locations. Credits are not universally requests. Terms restrict production commercial free use and allow temporary client caching; permanent offline retention/proxy redistribution need clarification/agreement. |
| Self-hosted Valhalla | OSM pedestrian/bicycle costing; Nepal extract and pedestrian trail preferences can be configured. | MIT engine; OSM data licensing/attribution still applies. No engine subscription, but servers, graph builds/updates, monitoring and operational work cost money. Demo server is fair-use, not a production SLA. Self-hosting is the better fallback if hosted retention terms are unsuitable. |

Sources: [MapTiler routing beta](https://www.maptiler.com/routing/),
[MapTiler API reference](https://docs.maptiler.com/cloud/api/reference/),
[HeiGIT API](https://api.heigit.org/),
[ORS hosted restrictions](https://giscience.github.io/openrouteservice/hosted-api-restrictions),
[account plans](https://account.heigit.org/info/plans),
[GraphHopper pricing](https://www.graphhopper.com/pricing/),
[GraphHopper API](https://docs.graphhopper.com/openapi),
[GraphHopper terms](https://www.graphhopper.com/terms/),
[Valhalla documentation](https://valhalla.github.io/valhalla/).

Important current change: HeiGIT announced retirement of the deprecated
`api.openrouteservice.org` URL on November 16, 2026. A future integration must use
the current `api.heigit.org/openrouteservice/v2/directions/{profile}/geojson`
contract, not an old tutorial. See the
[official transition announcement](https://heigit.org/changes-in-the-openrouteservice-universe/)
and [current API playground](https://playground.heigit.org/).

The new plans/ToS pages require JavaScript and did not expose readable terms to
the research tool. Do not substitute historical limits for dashboard verification.
A recent [maintainer clarification](https://ask.openrouteservice.org/t/free-plan-in-an-app-with-a-paid-tier-license-cc-by-sa-4-0-personal-data-and-attribution-questions/8079/)
permits commercial Standard use and identifies CC-BY-SA 4.0 for results; it does
not resolve every retention, privacy or downstream licensing detail. Review those
requirements before enabling permanent offline geometry storage.

## Inactive routing architecture and next approval

`features/routes/routing.ts` contains only a provider contract and validation.
Nothing imports it into production screens, makes HTTP requests, adds secrets,
or changes the saved-plan format. It separates ordered selected waypoints,
activity profile, returned LineString, provider distance, waypoint geometry
indices, loading/error status, provenance, attribution and offline permission.
It copies request coordinates before awaiting, rejects malformed geometry,
invalid distances/indices and mismatched provenance, propagates cancellation and
typed rate-limit/retry-after errors, and never substitutes a straight line on
failure. Retries are explicit; no hidden request multiplication occurs.

After approval: implement one provider adapter behind a controlled backend with
secret key, request validation, per-user/global quotas and minimal coordinate
logging. Propose an explicit Calculate/Retry action rather than a request per
pointer movement. A pilot estimate of 20 users × 10 calculations is 200 requests
per day, excluding retries; verify minute bursts and account quota. This is a
usage estimate, not a bill or guarantee of free access. No paid tier is approved.

Keep old plans on their current format. Design a separately versioned additive
routed-plan record before enabling save: preserve user waypoints, profile and
provider-returned path separately, and retain successful geometry offline only
when terms permit. The renderer must use routed geometry, not waypoint chords.
Edits invalidate prior calculated results; cancel stale requests and reject late
responses. No offline turn-by-turn navigation, downloaded map tiles or road
routing activation is implemented here.

## Exact phase files

Modified: `.gitignore`, `services/planned-routes.ts`,
`src/app/(tabs)/explore.tsx`, `src/app/routes.tsx`, `tests/planner.test.ts`,
`tests/database.test.ts`.

Added: `features/routes/recovery.ts`, `features/routes/routing.ts`,
`scripts/route-storage-diagnostic.js`, `scripts/route-backup.mjs`,
`tests/route-recovery.test.ts`, `tests/routing.test.ts`,
`tests/route-backup.test.ts`, `tests/browser/route-persistence.spec.ts`,
this document, `artifacts/phase1b6/baseline.json` and
`artifacts/phase1b6/preservation-audit.json`. The audit confirms every pre-existing
uncommitted file remains present; only the two route screens received the
incremental loading/storage-copy changes described above. Other pre-existing
uncommitted files retain their baseline hashes.

## Validation and manual checks

- TypeScript and ESLint: passed.
- Unit tests: 39 files / 212 tests passed, including native SQLite reopen,
  legacy metadata retention, malformed data, duplicate protection, save failure,
  recovery preview, immutable verified backups and inactive routing validation.
- Playwright: 25 passed / 2 expected mode-specific skips across planner,
  premium maps, recording and route persistence. The live-CDN and missing-key
  planner cases are excluded by the configured-map adapter mode, not failures.
- Persistence suite additionally rerun after adding alternate-origin isolation:
  full Edge process restart, legacy/malformed records, read-only diagnostics and
  simultaneous tab saves. All use isolated synthetic fixtures, never real routes.
- Web export passed. No new native module/API was added; Android/iOS exports and
  device lifecycle tests were not repeated in this phase.

Manually: inspect yesterday's and today's exact origin/profile, run the read-only
diagnostic, and privately export/verify any found records. On the same origin,
save a new named plan, fully exit/reopen the browser, then check Route Studio
and Explore. Test storage denial/full-disk errors without clearing real data.
Verify native app termination/relaunch on Android/iOS with a disposable plan;
SQLite integration tests do not establish real device eviction/reinstall behavior.
Provider approval and representative Nepal road/trail tests remain outstanding.

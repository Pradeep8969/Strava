# Private account route synchronization

Production safety review: see [route-cloud-sync-predeployment-review.md](route-cloud-sync-predeployment-review.md). The atomic-write follow-up resolves the lockless multi-tab application blocker; the later [production backup verification](production-backup-verification.md) resolves database backup readiness within its stated scope. **Deployment remains unexecuted and requires explicit final approval.** Browser support is independent of brand; the review documents Chromium/Chrome/Edge/Firefox/WebKit coverage and Safari/mobile validation limits.

Implementation date: 2026-11-16. **Not deployed.** No hosted database push, production reset, commit or push was performed. Initial working-tree status is recorded in `artifacts/route-cloud-sync/initial-git-status.txt`. Existing Phase 1A/1B/1B.5/1B.6 work remains in place.

## Architecture and reused code

The existing Expo SDK 58 application, Supabase client/session provider, Google OAuth, planner model and validation, route recovery inspection, MapTiler maps, navigation and six tabs remain. The existing `services/database.web.ts` IndexedDB `kv` store and `services/database.ts` SQLite `kv` table provide persistence without a storage-version change. `services/planned-routes.ts` continues to own the untouched legacy `routes` key. Recorded workouts and their synchronization service are independent and unchanged by this work.

`features/routes/cloud-sync.ts` implements reconciliation with an injected transport. `services/route-cloud.ts` implements account persistence and the Supabase transport. `hooks/useRouteSync.ts` installs one application-level coordinator. `hooks/useRouteLibrary.ts` reads a projection of legacy routes plus the current account's cache for Explore and Route Studio.

The account cache key is `account-routes:v1:<auth user UUID>`. It stores full plans, server revision, an operation UUID, deletion intent, status and any conflicting cloud version. It never uses email or display name. Web and native use the same repository with platform-resolved persistence. All account-cache writes use an atomic `updateValue`: one IndexedDB readwrite transaction across tabs, or a native SQLite transaction with its write reservation acquired before reading. Web Locks are not required. Network operations remain outside transactions. Existing-route actions check the observed local mutation token and reject stale edits/deletes clearly. Sync merges compare their full observed entry inside the atomic transaction, preserving newer pending edits/deletions and other tabs' acknowledgments. Separate tabs can make duplicate network attempts; the server's conditional RPC makes those attempts idempotent. See the review follow-up for current tests and mixed-version tab precautions.

## Cloud schema and security

New additive migration: `supabase/migrations/202611160001_planned_route_cloud_sync.sql`.

`public.planned_routes` is separate from activities/workouts:

| Column | Meaning |
| --- | --- |
| `id uuid` | Stable route ID, primary key |
| `user_id uuid` | Owner, references `auth.users(id)` |
| `plan jsonb` | Existing plan: title, ordered waypoints, ordered LineString geometry, distanceMeters, planningMode, kind, createdAt |
| `revision bigint` | Positive server-managed revision |
| `mutation_id uuid` | Last accepted operation; retry acknowledgement |
| `created_at`, `updated_at` | Server-managed timestamps |
| `deleted_at` | Durable tombstone |

The current planner has no sport selector and only supports straight-line plans. This migration preserves that model rather than inventing a sport or routing provider. The validator rejects unsupported modes. Road-following routing is not introduced. Future sport/routed-mode support needs an explicit schema/model change.

Constraints enforce route identity, bounded nonempty title, 2–10,000 valid coordinate pairs, exact waypoint/geometry correspondence, nonnegative distance and a 4 MB JSON limit. JSON arrays retain order; no coordinate rounding, simplification or conversion to fixed-precision geometry occurs. JavaScript number precision remains the existing application boundary. Local saves validate before writing; SQL independently validates writes. Account deletion cascades with the existing auth-user lifecycle.

RLS is enabled. Authenticated SELECT uses `user_id = auth.uid()` and an `(user_id,id)` index supports scoped reads. Anonymous clients have no table access. Direct client INSERT/UPDATE/DELETE privileges are revoked deliberately: client writes must use `write_planned_route`, which derives ownership from `auth.uid()`, validates payloads and serializes writes with row locks. This narrow security-definer function uses an empty search path and fully qualified objects. PUBLIC/anonymous execution is revoked. The caller cannot submit an owner ID or bypass revision checks. Physical client deletion is disallowed so tombstones survive. Owners delete through the same authenticated RPC with deletion intent.

There is no Realtime publication or public-feed integration for this private table. No geometry, token, payload or raw server error is logged or sent to analytics by the new code. No service-role key is used in the client. The client uses the existing public project URL/key and a JWT pinned for each job; identity changes cannot reassign an upload. RLS is the server security boundary even if local cache data is altered.

## Offline queue and automatic discovery

1. Signed-in save creates a stable UUID, validates the plan, writes it to that account's local cache and marks it pending before starting networking.
2. The coordinator wakes on session restoration/sign-in, queue changes, foreground resumption, browser `online`/visibility events, manual Retry Sync, and a 60-second active-app timer. Hidden/background apps do not poll.
3. On native, reconnection while already active is discovered on the next reconciliation (normally within 60 seconds); foregrounding or Retry Sync runs immediately. No new native network dependency was added. Background/OS-suspended execution is not promised.
4. Pending/failed entries upload through the authenticated conditional RPC. Only a successful response or a downloaded matching operation acknowledges synchronization. Requests time out after 20 seconds. Failed uploads retain their operation IDs and offline copies for safe retry.
5. Full account reconciliation reads every page, including tombstones, ordered by stable ID, in batches of 100. No timestamp cursor can permanently skip records. Changes during pagination are reconciled on subsequent passes. Realtime hints are unnecessary for this initial implementation; they are not a source of truth.
6. Downloads persist to the platform cache before library refresh, so geometry can be opened after restart without a successful cloud download. Map tiles continue to require internet unless separately cached by the map stack.

Only one job per account per application runtime runs at a time. A queue event during a job requests another pass. An edit/delete made during an upload remains queued; it advances onto its own acknowledged upload revision, never onto an unrelated remote edit. A newer third-device edit still fails the next conditional update. Account switches invalidate the job's continuation and isolate the pinned JWT and cache. An already-issued request may complete for the old account, but cannot write into or display in the next account's cache. The next old-account login retries safely.

## Conflicts and deletions

Creates use stable IDs with retry-safe insert-on-conflict semantics. Updates require the expected server revision. Reusing the last accepted mutation ID acknowledges the existing row without creating a duplicate. Older replays after subsequent edits become conflicts rather than overwrites.

A stale write becomes **Conflict**. Its local plan is retained intact and is not automatically retried. A full read retains the current cloud version alongside it. The UI explains two explicit choices:

- Open the local version and save a new copy with a new UUID, preserving that work as another account route.
- Choose **Use cloud version (discard local conflict)**. This explicitly discards the losing local edit and adopts the current cloud version or tombstone.

Existing Route Studio behavior is retained: opening and saving a route creates a copy rather than editing the original. The repository supports conditional same-ID edits for callers and conflict tests; no new in-place editing workflow is introduced.

Delete first persists deletion intent locally and hides the normal list entry. The RPC turns it into a permanent tombstone with a new revision. Other devices download the tombstone and hide the route. A stale offline edit cannot clear `deleted_at` or recreate that ID. If the stale edit conflicts with a deletion, its preserved local conflict is explicitly labeled; it is not an active cloud route or a resurrection. Tombstones are not purged automatically. A failed deletion remains queued and is retried; a revision conflict requires the same explicit resolution as edits.

## Legacy routes and UI

No scanning-to-upload, adoption, conversion, merging by geometry, or automatic migration of legacy routes occurs. The legacy `routes` key is never written by the cloud repository. Signed-out saves continue using the legacy service. Signing in alone never changes ownership or uploads a local-only route. Explicitly opening a legacy plan and saving a new account copy is a new user-directed save; the original remains local-only.

Existing local import/export/recovery scripts remain available and unchanged. They are optional recovery tools, not required for new account routes. Legacy records with unknown metadata remain preserved by the existing service. Malformed legacy records continue to block legacy writes/deletes until recovery, but do not block an independent valid account save.

Status labels distinguish **Local-only · Saved offline**, **Saved offline · Pending sync**, **Syncing**, **Synced**, **Sync failed — retry**, and **Conflict**. Route Studio and Explore provide Retry Sync for authenticated users. Route Studio shows general download errors without exposing server payloads. Signed-out messaging explains that account synchronization requires sign-in. Account-owned routes are masked synchronously on identity changes, and screen state is keyed by user ID so opened private geometry and previews cannot remain in another account's editor. Sign-out retains the private cache for that account's next login; it does not expose it in the signed-out library.

Cache separation is an application access boundary, not local encryption: someone with browser-profile/OS filesystem access can inspect storage. This follows the existing IndexedDB/SQLite architecture. Browser storage clearing, eviction, different origins and OS removal can still remove offline copies; already-synced account routes can be downloaded again. Unsynced/local-only routes cannot be recovered from the cloud.

## Validation results

- Full disposable local migration reset: passed, including every existing migration and the new migration. Used independent project `stravakinda-route-sync-test`, API port 55321 and PostgreSQL port 55322, never the hosted project.
- Database security suite: **89 assertions passed in six SQL files**, including **17 new route assertions** for creation, owner read/update/delete, precision, retry, stale edits, ownership mutation, hard-delete prevention, invalid payloads, other-account isolation, anonymous access and resurrection prevention. Fixtures run in rolled-back transactions.
- Application database lint (`--schema public`): **no findings**. Full default lint also ran and reported PostGIS extension dynamic-SQL/missing optional-object findings; these are outside this additive application schema. The initial route-validator volatility warning was corrected and the final migration reset/lint/security suite rerun successfully.
- TypeScript: passed. ESLint: passed.
- Unit suite: **224 tests passed in 41 files**. New core/storage tests cover direction-independent transport, Android/iOS shared repository behavior, offline cache serialization, retry after lost responses, duplicate prevention, conflicts, tombstones, logout cancellation, account isolation, legacy non-upload and edits during requests. Platform labels in pure unit tests are transport simulations, not real-device runs.
- Web, Android and iOS exports: passed with process-only fixture Supabase/MapTiler values. `.env` and stored MapTiler credentials were not edited. These generated exports are test artifacts, not release builds.
- Browser suite: **18 passed, 2 skipped**. Actual installed Edge and Brave exchanged routes using controlled HTTP/auth fixtures; an already-open browser discovered the other browser's save through the 60-second timer without a manual hint. Covered retry, cached reload, deletion, logout/account switching, existing planner lifecycle, complete browser-process restart for legacy plans, malformed legacy preservation, simultaneous tab saves, six-tab navigation at three widths in light/dark themes, and optional import/export regression tests. Live MapLibre access and the separate missing-key export scenario were skipped by the configured-map test mode. The fixture intercepts Supabase requests and never accesses real user routes. This does not claim hosted-backend end-to-end validation.
- Physical Android/iOS behavior, real OAuth-to-hosted-route synchronization, real-device restart and mobile reconnection remain release acceptance checks. Exports and shared repository tests do not replace those checks.

Commands use `npm.cmd`/`npx.cmd` on this Windows machine because PowerShell blocks the `.ps1` shims. The downloaded Supabase CLI was 3.1.0; its disposable config uses `[local_smtp]`. The repository's older Supabase config was not changed as part of this task. Use the isolated config or a compatible CLI when reproducing local database tests.

## Exact implementation files

Added:

- `features/routes/cloud-sync.ts`
- `services/route-cloud.ts`
- `hooks/useRouteLibrary.ts`
- `hooks/useRouteSync.ts`
- `supabase/migrations/202611160001_planned_route_cloud_sync.sql`
- `supabase/tests/planned_routes.test.sql`
- `tests/route-cloud-sync.test.ts`
- `tests/route-cloud-storage.test.ts`
- `tests/browser/route-cloud-sync.spec.ts`
- `docs/route-cloud-sync.md`
- `artifacts/route-cloud-sync/initial-git-status.txt`
- `artifacts/route-cloud-sync/validation-summary.json`
- `artifacts/route-cloud-sync/.gitignore` (keeps the disposable stack and generated logs out of source)

Modified for this task:

- `src/app/_layout.tsx`: install coordinator within the existing session provider.
- `src/app/routes.tsx`: account-aware save/delete, cache-backed list, status/retry/conflict recovery, account-keyed editor.
- `src/app/(tabs)/explore.tsx`: account-aware live library, status/retry, account-keyed preview.
- `tests/supabase-schema.test.ts`: additive table count, 26 → 27.

Other changes visible in Git predate this task. No applied migration or existing storage/auth/map service was edited for synchronization.

## Safe deployment order — requires separate approval

1. Review this additive migration, security-definer RPC and the final diff alongside the recorded initial dirty tree. Do not reset the existing uncommitted work.
2. In a fresh isolated work directory, copy the migration chain/tests and use a distinct local Supabase project/ports. Run local reset, application-schema lint and the complete SQL suite. Do not use hosted connection strings for reset/testing. For the existing disposable directory:

   ```powershell
   npx.cmd --yes supabase db reset --local --workdir artifacts/route-cloud-sync/disposable
   npx.cmd --yes supabase db lint --local --schema public --workdir artifacts/route-cloud-sync/disposable
   npx.cmd --yes supabase test db --workdir artifacts/route-cloud-sync/disposable
   npm.cmd run typecheck
   npm.cmd run lint
   npm.cmd test
   ```

3. Verify hosted migration history, auth configuration and role/default privileges against staging. Confirm an appropriate recent database backup/PITR recovery point, retention, restore procedure and responsible operator. This task has not created or restored a production backup.
4. Obtain explicit approval before applying anything to the hosted project. **Do not run hosted `supabase db push` as part of this implementation.** Once approved, apply the database migration before releasing the new app. Older clients continue to use their existing local-only library; they do not understand the new account cache.
5. Run controlled staging account tests, then release normal builds/web assets pointed at the intended backend. Do not publish the fixture exports from this task. Google OAuth and MapTiler configuration must remain the normal approved configuration.
6. Perform the real-browser and real-device acceptance checks below before production rollout. Verify that both clients use the intended Supabase project and the new migration exists there.

Rollback: roll back the app first if needed. Leave the additive table, RLS and RPC in place to preserve cloud records and tombstones. Do not drop the table, clear caches, remove tombstones or restore an old production backup as a routine rollback. Investigate and use a forward additive fix; any destructive database recovery needs a separate reviewed plan/approval. An old app cannot see the account cache, but its data remains stored. Full reconciliation currently downloads the whole account library including tombstones every active minute; monitor scale before introducing a future cursor/compaction protocol. Never remove tombstones without a protocol that excludes stale-client resurrection.

## Exact Edge ↔ Brave verification after approval

Use controlled test accounts and synthetic waypoints, never real/private athlete routes. No Developer Tools or manual import is required.

1. After approved migration and app release, open the same deployed app in Edge and Brave. Sign into the **same Supabase account** in both using the existing sign-in flow. Leave any existing local-only routes intact.
2. In Edge → Route Studio, choose two synthetic waypoints, name the plan `Edge sync check <date>`, and press **Save route**. Verify it is saved locally and becomes **Synced**.
3. Keep Brave active on Explore/Route Studio. Within the next 60-second reconciliation, verify exactly one matching route appears. Switching back to the app also triggers reconciliation. If needed, **Retry Sync** should complete without adding a duplicate. Open it and compare waypoint order, distance and name.
4. In Brave save `Brave sync check <date>` with different synthetic waypoints. Verify exactly one matching route appears automatically in Edge. Leave both browsers open for another minute and confirm neither duplicates.
5. With the map already open, disconnect networking. In either browser save `Offline sync check <date>`. Verify the plan remains visible as pending/failed with an offline copy. Reconnect: browser online detection should retry automatically. Verify **Synced** and one copy in the other browser. Repeat Retry Sync and confirm counts stay unchanged.
6. Close and reopen the browser using the same profile/origin, sign in if required, then disconnect networking. Open a previously cached account route. Geometry must remain available; missing base-map tiles are expected offline. Do not clear browser site data.
7. Delete only a synthetic account route on Edge. Verify it disappears in Brave after automatic reconciliation, including after restart/reconnect. Do not delete existing user routes. Concurrent stale edits must show a recoverable conflict rather than resurrecting the deleted ID; repository tests cover this since the current UI saves opened routes as new copies.
8. Open a synthetic private route, sign out, then sign into a second controlled account in the same browser. Verify the first account's routes, geometry, open editor and previews are absent. Sign back into the original account and verify its cache/library returns. The second account must never receive those routes.
9. Confirm older routes still show **Local-only · Saved offline**, remain only in their original browser/device, and were never uploaded by sign-in or Retry Sync. Optional import/export remains optional; do not run it for this verification.

## Android/iOS acceptance requirements

Install proper development/release builds against the approved staging backend. On both physical platforms, sign into the same controlled account through unchanged OAuth, confirm session restoration and the same account library, save synthetic routes in both directions, force-close/relaunch, then inspect downloaded routes offline. Test airplane-mode saves, immediate foreground retries, reconnection while active (up to the 60-second timer), background/resume, token refresh, account switching, logout with an opened route, deletion propagation and a network response lost during upload. Verify a second account cannot see the first account's geometry. Test storage-full/permission failures and confirm the UI never reports a failed local save as saved. No physical-device validation is claimed by this implementation report.

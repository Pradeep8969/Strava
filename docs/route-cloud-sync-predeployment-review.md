# Route cloud sync: production pre-deployment safety review

Reviewed 2026-11-16 for **nwwjkxnilxavhkvfzrku**, identified by the CLI as the production project. **Latest status: R1 is resolved locally and the database backup blocker is now resolved by a fresh, checksum-verified logical archive with an isolated restore test. Deployment is eligible for final explicit approval, not executed.** See [production-backup-verification.md](production-backup-verification.md) for scope, private location, integrity evidence and remaining platform/Storage limitations. No production migration, database push, reset, restore, backup overwrite, user-data change, commit or Git push was performed. The original review findings below are retained as history; their earlier NO-GO conclusions are superseded only within the verified database-backup scope.

## 1. Local and remote migration status

There are ten local migration files. Nine are tracked in Git and unchanged against HEAD. The new route migration is untracked/pending, as expected; it was not edited during this review.

| Version | Local file suffix | Production applied |
| --- | --- | --- |
| 202610250001 | initial.sql | Yes |
| 202610250002 | social_limits.sql | Yes |
| 202611140001 | welcome_notifications.sql | Yes |
| 202611140002 | push_preparation.sql | Yes |
| 202611140003 | existing_auth_profiles.sql | Yes |
| 202611140004 | api_privileges.sql | Yes |
| 202611140005 | push_claim_qualification.sql | Yes |
| 202611150001 | athlete_provider_profile.sql | Yes |
| 202611150002 | profile_editor.sql | Yes |
| **202611160001** | **planned_route_cloud_sync.sql** | **No — sole pending migration** |

Exact pending file: `supabase/migrations/202611160001_planned_route_cloud_sync.sql`.

SHA-256 of its current bytes:

```text
a8b35317a9937d6a47ecf0107919546582ab3268f865e19076a1ba749703b8d2
```

Read-only CLI migration listing confirmed no unexpected local-only or remote-only versions. An explicit `db query --read-only` transaction read only `supabase_migrations.schema_migrations`. All nine remote statement arrays match local SQL after token normalization of comments/whitespace/statement separators, preserving quoted SQL strings. Stored statement arrays are not original-file byte checksums, so this is a normalized SQL-content comparison, not a claim of byte-identical remote files. Local file hashes and comparison results are in `artifacts/route-cloud-review/migration-history-comparison.json`.

Catalog-only production queries confirmed the new table and both function signatures are absent, so there are no naming collisions. Six enabled DDL triggers were identified: standard `extensions` functions for extension grants, GraphQL placeholders and PostgREST schema notifications. No application-specific DDL trigger appeared. This was not a complete remote schema-drift audit.

Initial dirty-tree inventory: `artifacts/route-cloud-review/initial-git-status.txt`. Previous implementation and Phase 1A/1B/1B.5/1B.6 edits were preserved. This review changed only test/review documentation and added evidence/configuration; it did not change the production application, authentication, map configuration, local routes or migration SQL.

## 2. RLS, RPC and additive-schema assessment

**Pass for the reviewed threat model and tests.**

- `planned_routes` is a new, separate table with a stable UUID primary key; owner UUID references `auth.users(id)` with deletion cascade. JSON stores the existing ordered waypoint/LineString model without coordinate rounding. Revision, mutation UUID, server timestamps and deletion timestamp support synchronization.
- RLS is enabled. The sole client table privilege is authenticated SELECT, filtered by `user_id = auth.uid()`. Anonymous roles have no table access. No public geometry view, feed, Realtime publication or service-role client key is introduced.
- Direct authenticated INSERT/UPDATE/DELETE is deliberately unavailable. Mutations must use the RPC. This is stronger than ownership-only direct-write policies because clients cannot bypass concurrency/tombstone enforcement.
- `write_planned_route` requires non-null `auth.uid()`, derives ownership internally and accepts no owner parameter. Its security-definer search path is empty and references are qualified. PUBLIC/anonymous execution is revoked; authenticated execution is granted. Another user's row returns no data and cannot be updated/deleted/claimed. Ownership cannot change.
- Stable IDs plus insert-on-conflict and mutation acknowledgements make retries idempotent. Row locking and expected-revision checks reject stale edits. The RPC refuses to change an existing tombstone, preventing resurrection. A replay of an older operation after a later edit becomes a conflict rather than overwriting it.
- Validation requires valid JSON structure, a bounded nonempty name, supported straight-line mode, 2–10,000 ordered valid coordinates, geometry matching those points, nonnegative distance and a 4 MB SQL JSON-text limit. Constraints independently validate writes; arrays preserve order and numeric precision within the existing JavaScript-number boundary.
- `(user_id,id)` supports scoped paginated reads. Primary-key lookup supports conditional writes. Full-library reconciliation does not currently require an updated-at index.
- DDL adds only the new table/index/policy and two new functions/grants. No existing table, data, policy or function is rewritten or dropped. Creating the foreign key can briefly lock the referenced auth table during DDL, and normal PostgREST DDL notifications occur; additive does not mean zero transient locking. There is no backfill of existing users/routes.

Local tests verified owner create/read/update/soft-delete, other-account and anonymous isolation, ownership-change/direct-delete denial, stale-revision rejection, idempotence, precision, null payload rejection and no resurrection. They do not prove future production configuration cannot drift. Recheck privileges and RLS after any approved deployment.

## 3. Account and synchronization review

Google OAuth, PKCE callback/session provider, Supabase session persistence and MapTiler credentials were neither changed nor replaced. Account ownership uses only the authenticated Supabase UUID. Each browser/profile/origin/device keeps its own `account-routes:v1:<UUID>` cache in existing IndexedDB or SQLite; the cloud account library connects them.

Legacy `routes` storage is read separately and never automatically adopted or uploaded. Signed-out planning remains local-only. A user explicitly opening and saving a new account copy is an intentional new save, not automatic historical migration. Import/export tools remain optional.

Local saves complete before networking. Queue operation IDs survive failed attempts. Job JWTs are pinned to the initiating session; switches invalidate further continuation and cannot write results into another account cache. Account-owned lists are masked on identity changes and editors/previews remount by account. An already-issued old-account request can finish for that old account, but cannot be reassigned to the new account. Sign-out retains isolated cached data for subsequent login.

Reconciliation runs on session restoration/sign-in, queue changes, active-app resumption, browser online/visibility events, manual retry and an active 60-second timer. Native reconnection while continuously active is discovered on that timer, not an immediate network listener. Background/OS-suspended synchronization is not promised. Full paginated reads include durable tombstones and do not depend on Realtime. Conflicts retain local geometry and the cloud version; users can explicitly save a copy or adopt the cloud version. Route Studio still saves opened routes as copies; same-ID edits are a repository feature, not a newly introduced UI.

### Original conditional data-loss finding — R1 resolved by the follow-up below

**R1 — Originally high when Web Locks was unavailable: cross-tab offline lost updates.** The following describes the pre-fix implementation, not the current code.

`services/route-cloud.ts:32` falls back to the existing in-process `serial()` queue if `navigator.locks` is absent. Cache updates consist of separate `getValue` and `setValue` operations on a whole-account object. Two separate tabs have separate serial queues: both can read the same old object and then write different new objects, with the last write silently removing the other pending route. Server idempotence cannot restore a route lost before upload.

`tests/route-cloud-predeployment.test.ts` reproduces this with two isolated JS runtimes, independent serial queues, shared storage and synchronized reads. The required assertion is two saved routes; observed storage contains one. It is explicitly `it.fails` and reported as **one expected failure**, not a passing safety guarantee. No real browser records are used.

Current tested secure-context engines expose Web Locks and passed normal operation tests; this finding is conditional, not a claim that normal current Firefox or Safari always loses data. Nevertheless, silently accepting writes with the weaker fallback is unsafe. Before release, use atomic IndexedDB read/modify/write transactions across tabs (preferred), or implement an explicit safe capability guard that prevents unsafe multi-context writes. Do not replace it with a localStorage spinlock. Re-run the reproduction as a normal passing regression test after correction. Native's single application runtime is not the reproduced multi-tab scenario.

### Other reliability observations

- The custom 20-second fetch timeout is cleared when response headers arrive; it does not bound a body stream that stalls afterward. Extend cancellation through response-body consumption or bound the complete PostgREST operation, and test a stalled-body response. This is a reliability hardening item; no data loss was demonstrated for it.
- Cache read/modify/write guards preserve edits made during network requests and advance only onto their own acknowledged upload revision. Revision conflicts with unrelated newer edits remain explicit.
- Restored offline access requires an available authenticated session. Expired/revoked sessions needing a network refresh may prevent access until reauthentication; cached geometry must not be exposed merely because a UUID exists in local storage. This expired-session/offline boundary was not physically validated.
- IndexedDB/SQLite caches are not separate encrypted vaults. Storage clearing, quota failures, eviction, private browsing, OS removal, a changed origin or profile can remove offline-only data. Already-synced routes can be downloaded again; pending/local-only routes cannot. HTTPS is required in deployment for secure browser APIs. See [browser storage limits](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## 4. Original backup-readiness finding — superseded by the verified backup report

Read-only `supabase backups list` for this project returned:

```text
listed backups: 0
pitr_enabled: false
walg_enabled: true
physical_backup_data: empty
```

This establishes **no verified available recovery point through that API**. It does not prove no private/offsite backup exists. WAL-G being enabled alone is not evidence of a recent completed recoverable backup. No backup timestamp/checksum/restore validation was supplied elsewhere in the repository. The existing `scripts/route-backup.mjs` safely makes unique verified copies of manually exported browser-route bundles, but it is **not a production Supabase database backup**. `docs/DEPLOYMENT.md` has release gates, not an implemented full production backup runbook.

Before approval, obtain a fresh completed production recovery point and document its UTC timestamp, project, scope, retention, encrypted location, operator and recovery procedure. Cover `public` schema/data (profiles, activities/points, social/account data and future routes), auth users/identities and relevant auth data, migration history, storage metadata, application functions, policies/grants and any custom roles/extensions needed to recreate the application. Confirm managed-schema export/restore coverage against the chosen Supabase-supported backup method rather than assuming a default CLI dump includes everything.

Use a verified platform backup/recovery facility, or a separately approved complete logical backup with the Supabase backup/restore procedure and explicit schema/data coverage. Keep uniquely timestamped non-overwriting files outside Git; encrypt and checksum them and verify readability. Check restore compatibility in a new isolated database or staging project; **do not restore production**. Document OAuth/project configuration and secret re-provisioning separately without putting secrets in the report. No backup was created/downloaded/restored or overwritten during this review.

Supabase database backups contain Storage metadata, **not the stored object bytes**. Avatars or other bucket files need a separate authenticated object-copy/snapshot process with bucket/key inventory, hashes, retention and recoverability checks. Protect bytes and metadata consistently; route geometry itself lives in PostgreSQL, not object storage. No buckets or objects were touched. References: [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [supported CLI backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## 5. Validation and browser compatibility

Production checks were read-only migration/catalog queries and backup listing. All fixture mutations were local or in-memory. The isolated Supabase project was `stravakinda-route-predeploy-review`, API port 56321/PostgreSQL 56322; it has no production link.

| Check | Result |
| --- | --- |
| Full isolated local migration reset | Passed, all ten migrations |
| Local application-schema database lint | No findings |
| Complete local database/RLS suite | 89 assertions passed, 6 SQL files |
| TypeScript and ESLint | Passed |
| Unit suite | 224 passed; **1 explicit expected failure for R1**, 42 files |
| New compatibility matrix | **10 passed**, two scenarios per engine/channel |
| Prior Edge/Brave and route/navigation regression run | Previous implementation: 18 passed, 2 mode-specific skips; not all rerun here |
| Web/Android/iOS exports | Passed in previous implementation; production code unchanged in this review |

Compatibility matrix uses browser-independent fixtures and the same application repository: bundled Chromium, installed Chrome, installed Edge, Firefox and Playwright WebKit. Each passed IndexedDB persistence, cached-session restoration, offline saves, reconnection, account switching/logout, same-account independent caches, precision, duplicate prevention, remote edits, stale-edit conflict preservation, explicit conflict resolution and tombstone propagation. Tests simulate controlled auth/HTTP responses and never forward to production. The current UI does not edit in place; tests inject only synthetic same-ID cache edits to exercise that repository path.

The initial run incorrectly required a failed-upload label within five seconds; pending is also valid while transport retries run. That test assumption was corrected without changing production logic. Firefox required browser subprocess access outside the restricted sandbox. The final complete matrix passed. Fixture reconnection dispatches the standard online event after toggling context network state, so physical OS notification timing still requires acceptance testing.

Playwright WebKit on Windows is engine coverage, **not actual Safari/macOS/iOS certification**. Run real Safari on supported macOS/iOS versions, Android Chrome and the native Android/iOS applications against an approved staging backend. Brave was covered in the prior installed-browser test; its dedicated test remains intact. Production synchronization code contains no browser-name/path/profile branches. Browser names/channels occur only in test launch configuration. Browser caches remain separate, regardless of browser brand. See [Playwright browser scope](https://playwright.dev/docs/browsers).

Reproduce matrix against the existing process-only fixture export:

```powershell
npx.cmd playwright test --config playwright.route-cloud.config.ts
```

The served export must use `https://route-sync-fixture.supabase.co`, a dummy public key and test map adapter configuration. Do not publish it or use real accounts. If preparing another export, use child-process environment overrides; do not edit `.env` or MapTiler credentials. Tests abort other Supabase-project requests.

## 6. Original go/no-go and prepared deployment command — latest status is at the top

**NO-GO for production remains.** The additive migration passes local security/migration checks and is the only pending version. Deployment requires (a) verified fresh backup/recovery readiness, (b) R1 resolution — **now completed locally**, (c) real Safari/mobile and approved staging acceptance evidence appropriate to rollout, and (d) explicit deployment authorization. Full-response timeout hardening and expired-session/offline behavior should also be verified before claiming universal reliability. No production backup inspection/action or deployment was performed by the concurrency follow-up.

Prepared command for a future authorized operator, **NOT EXECUTED**:

```powershell
npx.cmd --yes supabase@3.1.0 db push --remote=nwwjkxnilxavhkvfzrku --workdir artifacts/route-cloud-review/remote
```

The isolated remote-inspection directory contains only a minimal CLI-3-compatible config, the reviewed migration chain and ignored local link metadata. The repository's older config remains untouched. `npx --yes` permits fetching the pinned CLI package; the deployment remains a separate authorization step. Before using this command, recopy/review any intentionally changed pending migration, verify hashes, inspect history read-only again and confirm exactly `202611160001` is pending. The command applies **all** pending migrations; it is not a filename-specific apply. Do not use `--include-all`, repair history, reset remotely, or execute it simply because the command is documented here.

If authorized later, apply the database migration before releasing the application. Validate actual grants/RLS/function ownership and a fresh read-only migration list afterward. If a release fails, roll back the application and leave the additive table/tombstones intact. Prefer an approved forward fix; do not drop routes, purge caches/tombstones or restore production as routine rollback.

## 7. Post-deployment verification, only after separate approval

Use controlled accounts and synthetic geometry. Edge and Brave below are examples, not product constraints; repeat with Chrome, Firefox, Safari and mobile clients.

1. Confirm production history now includes exactly the approved migration and all nine prior versions. Confirm RLS, table grants, RPC execute grants and function ownership match the review. Use two controlled accounts to check ownership via the app/API without touching existing athlete routes.
2. Sign into the same controlled Supabase account in Edge and Brave on the released app. In Edge save `Sync verification A <date>` with two synthetic waypoints. Verify Saved offline/Pending becomes Synced and exactly one copy appears in active Brave within 60 seconds, or on foregrounding. Open it and compare order, name and distance.
3. Save a second synthetic route in Brave. Verify it appears once in Edge. Repeat Retry Sync in both and confirm no duplicates. Do not import or convert old local routes.
4. With the app already loaded, go offline and save another synthetic route. Check its cached pending/failed state. Reconnect and confirm automatic upload and one remote copy. Restart/reload, then test cached geometry with backend requests unavailable. Missing map tiles or a cold offline web-app launch without cached app assets are distinct from cached geometry availability.
5. Open an account route, sign out and switch to the second controlled account in the same browser. Confirm no previous private route/editor/preview appears and no old pending work uploads to the second account. Return to the first account and confirm its cache is still present.
6. Delete only a synthetic account route. Confirm disappearance in the other client after reconciliation and after restart/reconnect. Exercise stale-edit conflict resolution in staging; never manipulate real user caches. Confirm legacy local-only routes remain unchanged and absent from cloud uploads.
7. Repeat key flows on actual Safari/macOS/iOS, Android browsers and native Android/iOS builds. Verify token refresh, restricted/private storage behavior, foreground reconnection, account switching and tombstones. Do not claim parity based solely on the Windows WebKit test.

## Review files

Added `playwright.route-cloud.config.ts`, `tests/fixtures/route-cloud-backend.ts`, `tests/browser/route-cloud-compatibility.spec.ts`, `tests/route-cloud-predeployment.test.ts`, this report and sanitized `artifacts/route-cloud-review/` evidence. The original architecture document links to this later review. Ignored `remote/` and `local/` work directories contain raw inspection output and disposable CLI state and must not be committed or published. No credentials or production route geometry are included in the report/evidence summaries.

## Follow-up: atomic multi-tab route writes (2026-11-16)

**Application blocker R1: resolved in the updated build. Production backup blocker: unchanged and outside this task.**

The previous expected-failure reproduction was run before editing and reproduced the loss. It is now a normal passing regression, with no `it.fails` annotation. The fix changes local storage operations only; migration SQL and its SHA-256 above remain unchanged. No production connection, reset, backup action or deployment was used for this follow-up.

### Atomicity and same-route collisions

`services/database.web.ts` now exports synchronous-callback `updateValue`. It opens one IndexedDB **readwrite** transaction on `kv`, reads the account key, applies the mutation synchronously inside the read request callback, and schedules the replacement before yielding. IndexedDB serializes overlapping readwrite transactions on that store across tabs and database connections. Success resolves only at transaction completion, never at request success. Callback failures, rejected asynchronous callbacks, quota failures, unavailable transactions and aborts reject the operation. There is no get/put fallback, Web Locks dependency, spinlock or per-tab-only substitute. Existing database name, version, stores, account keys and cache format remain unchanged.

All account mutations now use that primitive: create/edit/delete queue writes, explicit cloud-conflict adoption and sync-result merges. `services/database.ts` implements the same contract with Expo SDK 58 `withExclusiveTransactionAsync` on its transaction connection. It acquires the SQLite write reservation before reading, then updates the existing `kv` row. SQLite failures/busy conditions roll back and report an unsaved write; they cannot silently succeed. The existing serial queue is additional ordering within a native runtime, not the cross-context correctness mechanism. Unit tests use real on-disk SQLite, including a competing write lock, rollback and reopen. Physical Android/iOS validation is still not claimed.

Same-route writes additionally require the mutation token observed by the caller. The transaction compares that token against the current route before editing or deleting. Competing different-route writes both commit; competing stale same-route writes produce one winner and a clear **“changed in another tab or sync; changes were not saved”** error for the loser. The caller can reload or save a new copy. A rejected edit is not falsely labeled pending/saved. Existing Route Studio still saves opened plans as copies. Its delete and conflict-resolution buttons pass the cached mutation token. Explicit conflict adoption is guarded too. The route library exposes the token only as local UI metadata, not as a replacement for Supabase ownership or cloud revisions.

Malformed account-cache containers fail without replacement. Legacy local-only `routes` records are untouched. No account is inferred from email, display name, browser name or profile. Account IDs, stable route IDs, pending operation IDs, conflicts, cloud revisions, tombstones and geometry remain intact.

### In-flight synchronization guards

Each sync job retains an observed snapshot per route. Inside the atomic storage transaction, it replaces an entry only if the persisted entry still matches that observed state. The observation advances only after its own replacement commits. A mutation-ID-only comparison was insufficient: another tab could have acknowledged the same operation at a newer revision/status. Comparing the full observed entry prevents a late failure from downgrading that acknowledgment.

If a newer local edit/deletion is queued during an upload, its payload, mutation token, pending status and deletion intent remain intact. Only the base revision may advance onto the job's own acknowledged operation. It never advances onto an unrelated remote edit. Network calls stay outside storage transactions, so offline saves do not wait for an upload. Account invalidation is checked again inside the atomic merge; pinned old-account replies cannot affect another account's cache.

### Latest validation

- TypeScript and ESLint: passed.
- All unit tests: **228 passed in 42 files; zero expected failures**. The original reproduction is a normal passing test.
- Native on-disk SQLite: concurrent cache updates, rollback, competing-lock failure, preservation of legacy keys and restart persistence passed.
- Browser matrix: **40 passed**, eight cases each on Chromium, installed Chrome, installed Edge, Firefox and Playwright WebKit. Six cases per browser use the actual web IndexedDB adapter/repository/reconciliation with `navigator.locks` explicitly undefined; storage is not mocked. Controlled transport and valid-plan fixture validation are substituted only in the concurrency harness. The two existing application compatibility cases use the bundled app and authenticated HTTP fixtures.
- Covered concurrent creates; different-route and same-route edits; delete/update collisions; new saves and pending deletions during reconnection/acknowledgment; two sync jobs acknowledging/failing the same operation; account invalidation; accepted writes surviving tab closure during an upload and reload; quota errors; transaction abort after `put`; callback failure; and retry after a failed transaction.
- Existing Edge/Brave sync, Route Studio planner and persistence regressions against the final build: **6 passed, 2 skipped** (live-map and separate missing-key scenarios are excluded by configured-map mode). Local account deletion through the real Route Studio button and optional legacy preservation were verified.
- Existing database/RLS regression: **89 passed across six SQL files**, using the unlinked disposable local stack on PostgreSQL port 56322. No production database was queried or reset by the follow-up. No migration changes were needed.
- Web, Android and iOS exports: passed using process-only fixture environment values. OAuth, `.env`, and MapTiler credentials were not changed.

Reproduce with `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, and `npx.cmd playwright test --config playwright.route-cloud.config.ts` against the fixture export. The browser regression runs outside the restricted process sandbox on this Windows machine so Firefox/WebKit can launch. WebKit automation is **not real Safari certification**; real Safari/macOS/iOS and physical native acceptance remain required.

### Remaining boundaries and rollout precautions

Atomicity prevents this application race; it cannot protect against users clearing site data, browser eviction/private-mode lifecycle, disk/OS failure or loss of unuploaded data outside the browser's durability guarantees. Unavailable transactional storage fails closed rather than using weaker writes. Old code already running in an old open tab still has the original unsafe implementation: **reload/close all old route-sync tabs before using the fixed build**, including during acceptance/release. No destructive cache conversion or database upgrade was introduced to force old tabs closed.

The separate backup-readiness gate, real-device acceptance, complete-response timeout observation and expired-session/offline boundary from the review remain unchanged. Do not interpret R1 resolution as production deployment authorization.

### Files changed by this follow-up

- `services/database.web.ts`, `services/database.ts`: atomic key mutation APIs.
- `services/route-cloud.ts`: transactional mutations, expected-token guards and atomic observed-state sync merges.
- `hooks/useRouteLibrary.ts`, `src/app/routes.tsx`: carry/pass local mutation tokens for existing-route actions.
- `tests/route-cloud-predeployment.test.ts`, `tests/route-cloud-storage.test.ts`, `tests/database.test.ts`: passing original regression, stale writes, malformed cache and native transaction tests.
- New `tests/fixtures/route-atomic-repository.ts` and `tests/browser/route-cloud-atomic.spec.ts`: real IndexedDB multi-tab concurrency tests with Web Locks disabled.
- `playwright.route-cloud.config.ts`: include the atomic suite in every browser project.
- This report, `docs/route-cloud-sync.md`, and `artifacts/route-cloud-atomic/` status/validation evidence.

Previously uncommitted work was preserved. Neither applied migrations nor the pending migration, workout persistence behavior, Google OAuth or MapTiler configuration was changed.

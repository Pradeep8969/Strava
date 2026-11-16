# Controlled production route-sync migration deployment

**APPLIED:** `202611160001_planned_route_cloud_sync.sql` to production Supabase project **`nwwjkxnilxavhkvfzrku`**, under the owner's explicit authorization for this one migration. No application release or Git commit/push was performed.

## Execution record

- CLI: **3.1.0**, verified from the installed executable and actual help.
- Started: `2026-11-16T09:21:41.019Z`.
- Completed: `2026-11-16T09:21:43.599Z`, exit code 0.
- Post-deployment verification: `2026-11-16T09:24:13.658Z`.
- Applied version: **202611160001**. Remote migration count increased from nine to ten, with no other versions added.
- Reviewed SQL SHA-256: `a8b35317a9937d6a47ecf0107919546582ab3268f865e19076a1ba749703b8d2`.

The command used the existing isolated, verified deployment workspace and explicitly selected the production reference. Both dry runs and execution specified **`--skip-vault`**. Neither roles nor seed inclusion flags were used. CLI `--yes` supplied the documented confirmation after all checks passed.

Recorded invocation shape, **already executed; not an instruction to repeat it**:

```text
Supabase CLI 3.1.0 db push --skip-vault --yes --remote=nwwjkxnilxavhkvfzrku --workdir artifacts/route-cloud-review/remote --output-format json
```

The final dry run and execution result both listed exactly:

```text
migrations: [202611160001_planned_route_cloud_sync.sql]
roles: []
seeds: []
target: nwwjkxnilxavhkvfzrku / production
```

## Safety prerequisites

All passed before execution:

- Initial Git status recorded; existing uncommitted source work preserved.
- Root and isolated workspace project references both matched the approved project.
- Private `database-session.dump` existed and was nonempty, **765,834 bytes**.
- Its recalculated SHA-256 matched **`9e3deeb4684039720063668d8245f7f7faa7af06e25fad846388a71d4ac20268`**.
- The verified manifest identified that exact project, file, size and checksum. The restore result and final recovery verification passed, including all 75 COPY sections.
- All nine files in the private backup/evidence checksum inventory matched. No backup file was moved, altered or copied into repository artifacts.
- The restricted sandbox initially could not see the ACL-protected backup. A read-only elevated check confirmed access restriction rather than missing data; no hosted change occurred until every backup assertion passed.
- The nine previously applied local migration files matched the recorded hashes. Their remote statement arrays matched the prior review snapshot.
- Local and isolated migration directories contained exactly the same ten SQL files and bytes. The new SQL hash matched the reviewed snapshot, its complete contents were re-read, and its additive table/index/RLS/RPC/revision/tombstone design remained intact.
- No conflicting table/type/index or route-function name existed in production.
- The isolated config contained only the reviewed project ID; there were no roles, seed or environment files to include. Vault updates were explicitly skipped.
- Atomic IndexedDB readwrite transactions, SQLite exclusive transactions/write reservation, and account-cache `updateValue` writes remained present.

## Read-only production verification

All checks passed without creating test routes or reading private user records:

- Exactly the original nine versions plus **202611160001** are applied; local and remote histories align.
- `public.planned_routes`, its primary-key index and `(user_id,id)` index exist with the expected columns.
- RLS is enabled, with exactly the authenticated owner-SELECT policy using `auth.uid()`.
- Authenticated table access is SELECT only; direct INSERT/UPDATE/DELETE/TRUNCATE is unavailable. Anonymous table access is denied.
- The foreign key references `auth.users(id)` with deletion cascade, and the positive-revision and route-validation constraints exist.
- The route RPC is owned by `postgres`, security-definer, has an empty search path, grants EXECUTE to authenticated clients and denies PUBLIC/anonymous execution.
- The validator is immutable, security-invoker, has the expected permissions and empty search path. Both installed function bodies exactly match the reviewed SQL, including ownership derivation, row locks, conditional revisions, retry acknowledgments and tombstone enforcement.
- Every pre-existing relation/owner/RLS/ACL entry, function definition/security/ACL entry, policy, index, constraint and prior migration row matched the pre-deployment catalog snapshot. This covers existing profile, auth, activity/workout and Storage database objects.

The migration created the authorized schema objects; no existing-data DML, user-route edits/deletions, reset, restore, history repair, Vault update, role/seed deployment or other migration was issued. Metadata preservation and additive SQL support the data-preservation conclusion; this is not a claim that other live users made no independent changes during the operation.

## Application readiness and outstanding verification

Source configuration identifies the approved Supabase project and an anonymous/public client key, without exposing that key. Signed-in saves queue into the account-scoped cloud library; signed-out saves retain legacy local storage. Legacy routes are not scanned for upload or reassigned. Session-pinned jobs, account-scoped caches, synchronous masking on account switches, editor remounts, local atomic writes, retries, reconnect/foreground events and active-minute reconciliation remain present.

**No web or mobile application was published. The current generated `dist` web export still contains controlled test-fixture configuration and must not be published or used for real-account acceptance.** Use a correctly configured build containing the new synchronization source. Reload all old route-sync tabs before testing the fixed build.

TypeScript and ESLint passed again. The earlier 228 unit tests, 40 browser matrix cases and 89 disposable-database assertions are prior automated fixture results, not real-account/device verification from this production deployment. This deployment added automated read-only production catalog/privilege/body/preservation checks. Real Google-account, real Safari, Android and iOS behavior was **not** exercised here.

The private backup's Storage-object, service-credential/configuration, encryption-key and local-only/offsite limitations remain as documented in `production-backup-verification.md`.

## Manual two-browser verification

Use a controlled Google test account and synthetic waypoints. These are instructions for the owner to perform after this task; no such routes were inserted by the agent.

1. Use an app build containing the sync changes and targeting `nwwjkxnilxavhkvfzrku`. For local source testing, start `npm.cmd run web` from a shell without test-fixture overrides, then open the printed URL in **two different browsers**, such as Edge and Brave. Do not serve/publish the fixture `dist` export. Refresh/close old tabs first.
2. Sign into the **same Google test account** in both browsers through the existing sign-in flow. Open Route Studio in both. This uses the same Supabase UUID; browser names, profiles and email matching do not determine route ownership.
3. In browser A add two synthetic waypoints, name the plan `Sync A <date>`, and press **Save route**. Confirm Saved offline/Pending transitions to **Synced**. Keep browser B active in Explore/Route Studio and verify exactly one matching route appears within 60 seconds, or after foregrounding. Open it and compare name, waypoint order and distance.
4. Save `Sync B <date>` in browser B and verify it appears exactly once in A. Press **Retry Sync** in each and confirm counts do not increase. No manual route import is needed.
5. With the page already loaded, disconnect networking and save another synthetic plan. Verify pending/failed status and retained geometry. Reconnect and confirm automatic upload plus one copy in the other browser. Browser base-map tiles and a cold web-app launch may still need network/cached assets.
6. Reload/restart with networking available to verify session/cache restoration. Sign out and switch to a second controlled account: the first account's routes, editor and previews must be absent. Sign back into the original account and confirm its library returns. Existing local-only routes must remain labeled local-only and must not have uploaded.
7. If testing deletion, delete only a deliberately created synthetic test route and verify disappearance in the other browser after reconciliation/restart. Do not delete existing athlete routes. Exercise stale-edit conflicts with controlled fixtures/staging; Route Studio currently saves opened plans as new copies.

Repeat the same checks in Chrome and Firefox, and actual Safari on supported Apple hardware; Windows WebKit automation is not Safari certification. On Android/iOS use compatible builds containing the changes and the same production project configuration. Test same-account library arrival in both directions, offline saves/reconnect, force-close/session restoration, foreground resumption, account switching/logout isolation, duplicates and synthetic deletion propagation. No native build/release, OAuth change or device verification was performed by this deployment task.

**Deployment is complete. Stop here; no further hosted writes or application releases are authorized by this report.**

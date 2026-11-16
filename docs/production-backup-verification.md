# Production database backup and recovery verification

Project: `nwwjkxnilxavhkvfzrku`. Verified on 2026-11-16. **Database backup readiness: VERIFIED for the logical database archive and isolated restore described here. No migration was deployed.** This is not a certification of complete Supabase project/service or Storage-object recovery.

## Backup record

| Field | Value |
| --- | --- |
| Snapshot operation started (UTC) | `2026-11-16T07:48:12.873Z` |
| Archive completed (UTC) | `2026-11-16T07:49:46.477Z` |
| Verification completed (UTC) | `2026-11-16T08:00:41.867Z` |
| Folder | `C:\Users\prade\StravaKinda-Private-Backups\nwwjkxnilxavhkvfzrku_20261116T073554Z_f1cb9065` |
| Archive | `database-session.dump` |
| Format | PostgreSQL custom-format logical archive (`PGDMP`) |
| Size | **765,834 bytes** |
| SHA-256 | `9e3deeb4684039720063668d8245f7f7faa7af06e25fad846388a71d4ac20268` |
| Verified manifest | `backup-manifest-verified.json` in the private folder |
| Integrity inventory | `SHA256SUMS.txt` in the private folder |

The folder is outside the Git repository. Inheritance was disabled and access limited to the current Windows account and SYSTEM. Archive contents, source records, raw data streams, connection strings, passwords and tokens were not displayed, uploaded to chat/GitHub/external storage, or copied into repository artifacts. At-rest encryption was not established or verified; Windows ACLs are the local protection. Existing browser-route backups were not modified.

All filenames were created exclusively in a new timestamped/unique folder. An initial direct-IPv6 attempt failed and its incomplete `.partial` file/status were retained privately as failed-attempt evidence. The successful archive used a different new filename. Neither previous backups nor the failed partial were overwritten. The original manifest is retained as historical metadata; **use `backup-manifest-verified.json` for the final verified status**.

## Supported tools and source access

- Supabase CLI **3.1.0**, using the existing cached Windows executable after the restricted npm invocation could not access its registry.
- Docker client/server **29.9.3**.
- PostgreSQL `pg_dump`, `pg_restore` and `psql` **17.11**, matching production PostgreSQL **17.11**. Tools came from the existing local `public.ecr.aws/supabase/postgres:17.11.0.019` image; native PostgreSQL binaries were not on PATH.
- Actual installed help was inspected for `supabase db dump`, backup listing, `pg_dump`, `pg_restore`, `psql`, `initdb` and `pg_ctl`. No guessed backup flags were used.

Read-only managed-backup inspection again reported **zero listed backups**, **PITR disabled**, and WAL-G enabled. WAL-G enabled alone does not establish a recoverable managed backup. No paid backup/PITR feature, remote restore or backup policy was enabled.

Read-only schema/permission inspection found no inaccessible tables in the relevant application/auth/storage/migration schemas. The CLI's supported dry-run connection plan was inspected **in memory only**. Its temporary connection parameters were passed as environment variables, never written into a script/configuration or printed. No service-role key was used or introduced into the client.

The direct endpoint was unreachable over IPv6 from Docker. The existing project session-pooler endpoint was verified from existing local link metadata, not constructed from a guessed region. A read-only `SELECT 1` through that IPv4-compatible session pooler succeeded. The archive used that session connection with SSL required and `default_transaction_read_only=on`, and `--role=postgres` as specified by the installed CLI's dump plan. No role grants or schema/data modifications were issued to make the dump work.

The actual PostgreSQL dump options were:

```text
pg_dump --format=custom --role=postgres --lock-wait-timeout=10000 --file=/backup/database-session.dump.partial
```

Connection parameters were supplied through transient environment variables, not command-line connection strings. No schema filter, RLS-limited dump option or data exclusion was used. The successful partial was renamed to its complete archive filename only after a zero exit code and valid archive header. `pg_dump` provided a consistent database snapshot; metadata inspection requests are separate snapshots. The final catalog/migration comparison detected no source schema or migration changes across the operation.

## Scope and private recovery material

The full database archive contains non-system database schemas and their data, functions, policies, privileges, ownership, extension declarations, and migration metadata. This includes `public`, `auth`, `storage`, `supabase_migrations`, `extensions`, `graphql`, `graphql_public`, `realtime` and `vault`. PostgreSQL extension-managed objects are recovered through the matching extension installation, as normal for logical dumps. The restore confirmed matching extension names, namespaces and versions. There were no PostgreSQL large objects to verify separately.

Application tables, recorded workout/point data, account/profile data, authentication database records including password hashes, and database Storage metadata are in the archive. This statement describes scope, not record counts or contents. The planned-route table is correctly absent because its migration remains pending.

Separate protected files include:

- `roles-metadata-complete.json`: non-predefined role attributes and memberships **without cluster-role passwords**; complete metadata also covers the extra role referenced by the archive.
- Source/restored catalog snapshots and final prerequisite checks: schema/table ownership and RLS flags, function identities/security settings, policies, extension versions and all nine migration records/statements.
- `data-fingerprints.json`: per-COPY-section hashes/counts and sequence hashes, with no row contents.
- `recovery-verification-final.json`, `restore-result.json`, and `backup-manifest-verified.json`: verification outcomes and limitations.
- `SHA256SUMS.txt`: integrity hashes of the archive and relevant sidecars.

These files stay in the private folder. Repository documentation and artifacts contain only sanitized status, checksums and location information.

## Disposable recovery test

The unchanged archive was restored with `pg_restore --single-transaction --exit-on-error` into a **new local PostgreSQL container**. The container had:

- Docker network mode `none`, no published ports and no application/Auth/Realtime/Storage services running.
- A read-only bind mount of the protected backup folder.
- A fresh database initialized in a RAM-backed tmpfs, with local socket connections only.
- Server statement/error-context logging suppressed for the restore; raw record/error streams were not logged.

The test used inert NOLOGIN prerequisite roles so database ownership/ACL references could be recreated without restoring service passwords or enabling logins. One archive-referenced role was missing from the initial prerequisite list. The first restore transaction rolled back; the missing role was supplied locally and complete password-free role metadata was captured. The subsequent **full archive restore passed in one transaction**, without editing, filtering or excluding archive objects. This demonstrates database recovery with explicit role prerequisites, not password/service-login recovery.

Verification passed for:

1. Archive SHA-256 before and after restoration; archive directory readable with `pg_restore --list`.
2. Source-versus-restored schema names; table/view/sequence identities, owners and RLS flags; function identities, owners and security settings; policies; migration statements; and extension names/versions/namespaces.
3. All **75 COPY-data sections** and sequence-value statements, using hash-only comparison of the archive's data stream against a logical re-dump of the restored database. Row order was normalized within each COPY section. No row contents were displayed or written to logs. No large objects were present.
4. Isolation configuration: networking disabled, no exposed ports, read-only backup mount and tmpfs database storage.

Management API and direct SQL JSON representations use different object-key orders; catalog comparisons canonicalized object keys while preserving array order and values. The initial order-sensitive comparison was not treated as a content mismatch after canonical verification. Integrity and data comparisons remained independent of that normalization.

The disposable container was stopped and automatically removed after verification, discarding the RAM-backed recovered records. Only the protected backup/recovery files remain.

## Recovery limitations and separate services

- This is a **verified logical database backup**, not a physical/PITR backup or a full Supabase project clone. No managed backup entries or PITR coverage were available at inspection. This one-time backup does not establish an ongoing backup schedule.
- **Supabase Storage object bytes are not in the database dump.** Bucket/object metadata is present; avatars or other stored files need a separate authenticated object backup and inventory. No Storage objects were copied, modified or deleted in this task.
- Supabase project configuration, API/JWT signing keys, OAuth provider secrets and redirect settings, Edge Function deployments/secrets, Auth/Storage/Realtime service configuration, and Vault root encryption keys require separate provisioning/recovery. No credentials were exported into scripts. A restored Vault ciphertext table alone does not establish decryptability without its external key arrangements.
- Role names/attributes/memberships are recorded, but cluster/service-role passwords were not backed up or restored. The isolated test used NOLOGIN prerequisites and did not validate service logins, Google OAuth, user sign-in through GoTrue, or live Realtime/Storage behavior. Auth database records and password hashes themselves **are** included.
- Logical recovery requires compatible PostgreSQL and extensions. The test used the matching Supabase PostgreSQL image; normal bare PostgreSQL may lack PostGIS, Vault or required role/service definitions. Use a Supabase-supported destination/bootstrap and explicitly provision roles/extensions before a real recovery.
- This local-only copy has no verified offsite protection and may be lost with the host or disk. No external upload was authorized or performed. ACL protection is verified; disk encryption and disaster recovery from loss of this Windows account/machine are not verified.
- A new backup should be taken if approval/deployment is delayed or significant production changes occur. This backup represents its snapshot, not later user activity. Do not infer that live user rows remained unchanged by other users during the task.

References: [Supabase backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [database backup coverage](https://supabase.com/docs/guides/platform/backups), [supported IPv4 session-pooler connection](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Final deployment-prerequisite check

Read-only production verification at `2026-11-16T07:58:38.113Z` confirmed:

- Exactly **nine applied migrations**, unchanged from the prior remote statement snapshot. Their local files also match the recorded SHA-256 values.
- Exactly **one pending migration**: `202611160001_planned_route_cloud_sync.sql`.
- Pending migration SHA-256 remains `a8b35317a9937d6a47ecf0107919546582ab3268f865e19076a1ba749703b8d2`.
- Atomic `updateValue` account-cache writes and the actual IndexedDB readwrite transaction remain present; no Web Locks dependency was reintroduced.
- Source schemas, critical table/ownership/RLS metadata, functions, policies, extensions and migrations matched the pre-backup catalog snapshot.
- No production user-data write, route deletion/edit, database reset, restore, migration execution, or `supabase db push` was issued. Existing uncommitted application work and browser data were preserved.

**The database backup blocker is resolved within the stated scope. Route-sync deployment is eligible to be presented for final explicit approval; it has not been deployed or authorized by this verification.** Review and accept the recovery limitations, keep the protected archive intact, recheck migration history and freshness immediately before an approved release, then apply only the reviewed migration and perform the documented controlled-account checks. Do not use this report as permission to deploy or to restore production.

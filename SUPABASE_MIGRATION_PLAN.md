# StravaKinda Supabase schema recovery plan

Prepared from the repository on 2026-11-14. **No remote database connection, migration, auth-user change, function deployment, commit or push was performed.** The empty remote `public` schema is your reported state; it has not been independently inspected. All commands below are instructions for you to run later, not commands already executed.

## Diagnosis and scope

Google OAuth creates an account in Supabase's managed `auth.users`. It does not install this application's tables. The application uses `public` by default in `services/supabase.ts`, and Profile selects `profiles` with `.single()`. Its memberships query selects `club_members` then `clubs`. Missing tables explain the reported errors; an empty memberships result after installation is normal for a user who has not joined any clubs. Reloading the PostgREST cache alone cannot create a missing table.

The original migrations are retained unchanged. Do not manually recreate their tables in the Dashboard, rename migration versions, blanket-add `IF NOT EXISTS`, or mark unapplied SQL as applied. Migration history, rather than repeated `CREATE TABLE`, prevents duplicate schema creation. The three new migrations are prepared only; they have **not** been executed against PostgreSQL here.

## Exact order and dependencies

| Order | File in `supabase/migrations/` | Contents and prerequisites |
| --- | --- | --- |
| 1 | `202610250001_initial.sql` | PostGIS in `extensions`; 22 public tables; indexes; RLS; auth INSERT trigger; activity visibility/upload and AI-quota RPCs; private avatars bucket and Storage policy. Requires an actual Supabase database with managed `auth`, `storage`, roles and `extensions` schema, not a bare empty PostgreSQL database. |
| 2 | `202610250002_social_limits.sql` | `social_rate_limits` table and before-insert limits for comments, reactions, follows and reports. Depends on profiles and the four social tables. |
| 3 | `202611140001_welcome_notifications.sql` | Adds `notifications.title`, unique welcome-per-user partial index, read-state permissions/policy and conditional Realtime publication membership. Replaces the existing profile initializer, retaining the auth INSERT trigger. |
| 4 | `202611140002_push_preparation.sql` | `push_devices`, `notification_push_jobs`, enqueue trigger, consent-based registration and server-only claim RPC. Depends on profiles, settings, notifications and its title column. Queues existing welcomes; does not deploy a worker or scheduler. |
| 5 | `202611140003_existing_auth_profiles.sql` **new** | Makes profile/settings creation conflict-safe, preserves the welcome behavior for future signups, and inserts missing profiles/settings for every existing auth account. No tables, auth updates/deletes, or retrospective notifications. |
| 6 | `202611140004_api_privileges.sql` **new** | Explicit API/service grants and function permissions across the existing 25 tables; removes inherited client write/TRUNCATE privileges that RLS alone does not control. Preserves every RLS policy. Notifies PostgREST to reload the schema. |
| 7 | `202611140005_push_claim_qualification.sql` **new** | Fixes a static-review finding in the existing push claim RPC: its `RETURNS TABLE` output variable `attempts` collides with an unqualified job column in an UPDATE. Qualifies job references and retains service-only execution. No tables or policies change. |

The final application schema has **25 tables**, not 25 additional tables. All seven migration versions must appear in history. Existing 12-digit numeric version prefixes are preserved; don't regenerate these files under new timestamps.

### Foreign-key graph

- `auth.users.id` -> `profiles.id` is the root FK. The root is an existing auth account; the backfill never creates or changes one.
- Profiles are referenced by `user_settings.user_id`, both sides of `blocks`/`follows`, `activities.user_id`, `routes.user_id`, reaction/comment users, `clubs.owner_id`, memberships/entries, `segments.creator_id`, efforts, subscriptions, metrics, insights, notifications, zones, reports, AI/social counters, push devices and push jobs.
- `activities.id` -> `activity_points.activity_id`, `activity_reactions.activity_id`, `comments.activity_id`, `segment_efforts.activity_id`. The reaction/comment FKs support the app's nested PostgREST count queries.
- `clubs.id` -> `club_members.club_id`, `challenges.club_id`; `challenges.id` -> `challenge_entries.challenge_id`; `segments.id` -> `segment_efforts.segment_id`.
- `notifications.id` -> `notification_push_jobs.notification_id` (also the job PK, enforcing one job per notification). Job `installation_id` is a delivery snapshot, not a device FK; device re-registration/deletion must not destroy delivery history.
- All defined application FKs use `ON DELETE CASCADE`. This is existing schema behavior, not a proposed auth deletion. Do not invoke the `delete-account` Edge Function during recovery. It deletes auth users and cascades app data.
- Composite PKs prevent duplicate memberships, entries, follows, blocks and reactions. Profiles/settings use the auth UUID as PK; username is separately unique and nullable. Missing profile backfill does not guess usernames, copy email into public fields or overwrite names/privacy/settings. The profile editor can fill blank display fields later.

## Schema/query comparison

| Consumer | Actual relations/RPCs and contract | Audit result |
| --- | --- | --- |
| Profile/editor (`src/app/(tabs)/profile.tsx`) | `profiles(name,username,bio,is_private,avatar_path)` by auth ID; update own fields with returned `id`; `club_members(club_id)` then `clubs(id,name)`; signed avatar URL | Columns exist in initial SQL. Existing users require backfill because this UI updates, not inserts, profiles. Avatar paths are Storage object paths, not Google photo URLs. |
| Community and club detail | `clubs(id,name,description)`, `club_members(club_id,joined_at)`, `challenges(id,club_id,title,target_m,starts_at,ends_at)`, `challenge_entries(challenge_id,joined_at)`; join via ignore-duplicate upsert; leave via delete | Matches SQL. RLS deliberately returns only the viewer's memberships/entries. It does not provide membership counts/rosters. No clubs or challenges are seeded by these migrations. |
| Feed/comments/search | Activities summaries with `activity_reactions(count),comments(count)`; `profiles(id,name,username)` and avatar path; follows, blocks, reactions and comments; reports | Names/columns/FK aggregates match. `ignoreDuplicates:true` uses `ON CONFLICT DO NOTHING`, so no UPDATE policy is needed for follows/reactions/memberships. Profile search requires a username; newly backfilled profiles with NULL username won't appear in username search until edited. |
| Workout sync (`services/sync.ts`) | `save_workout(payload)`; owner summary reads/deletes on `activities`; paged `activity_points(latitude,longitude,recorded_at,accuracy,altitude,altitude_accuracy,segment)` ordered by `seq` | Payload and selected columns match initial SQL. JWT is pinned per sync run; server derives owner from `auth.uid()`, not a client-supplied user ID. Conflicting activity UUID owned by another user raises an exception. Points replace transactionally; raw points remain owner-only. |
| Inbox/coordinator | `notifications(id,user_id,kind,title,body,created_at,read_at)`; UPDATE `read_at`; Realtime INSERT/UPDATE | Needs migration 3, not merely the initial notifications table. Auth INSERT only generates welcome, not sign-in events. Client cannot create/delete/reassign notifications or edit title/body. |
| Native push | `register_push_device(installation,token,device_platform,enable_consent)`, `disable_push_device(installation)` | Signatures match migration 4. Tables are not client-readable. Consent defaults false; no push registration is created by recovery. |
| Edge Functions | AI: `reserve_ai_request(target)` and own activity summaries; worker: `claim_notification_push_jobs()` and job/device updates; delete-account: private Storage and Auth admin | Relations and RPCs exist. These functions validate the user token or separate worker secret themselves despite `verify_jwt=false` in config. Their deployment/secrets/scheduling are separate; do not deploy or invoke them as part of this plan. |
| Other features | `privacy_zones` inserts and owner segment listing (`competition.tsx`) | Match initial SQL. Raw GPS, zones and segment geometry remain owner-scoped; no redacted shared-route API is implemented. |

The static contract test scans literal application table/RPC/select references, verifies 25 unique table definitions and public FK creation order, and checks the non-destructive backfill. It does not replace PostgreSQL execution, mutation/RPC validation or RLS tests.

The existing push claim function has an unqualified `attempts>=5` expression even though `attempts` is also a PL/pgSQL output variable. Under the default [PL/pgSQL variable-conflict behavior](https://www.postgresql.org/docs/17/plpgsql-implementation.html) this can raise an ambiguous-column error when invoked. The seventh migration prepares the qualified replacement. The existing notification pgTAP suite invokes this RPC even without a registered device, so the local SQL rehearsal must exercise it; no push worker is required for that test. This finding is separate from the absent-profile/membership tables.

### Intentional architecture boundaries, not missing migrations

- Native workouts persist in SQLite; browser workout storage is a preview. OAuth login does not automatically upload every local recording. Sync uploads only finished workouts already bound to the signed-in account, with automatic sync enabled separately. Existing unowned recordings require the existing explicit link action; schema recovery must not assign them to your Google account.
- Saved route plans currently use local `routes` key storage even though a cloud `public.routes` table is defined. Migration installation does not sync those plans.
- Events are local demonstration data and organizer drafts persist locally. No application query references a missing cloud `events` table. Do not invent one to fix memberships.
- `user_settings` is server-side storage used by push; the app's ordinary preferences/sports choices remain local. Backfill keeps the original defaults (km, dark, private workout visibility, notifications disabled) only for missing settings.
- No server producer for challenges, verified segment efforts, training metrics or AI insights is deployed here. Owner reads can validly return empty results. Club ownership does not automatically insert a membership. Server/manual provisioning of real clubs/challenges is a separate task; never seed fake memberships to suppress an error.
- Premium validation currently checks RevenueCat server-side. The `subscriptions` table is protected, but no webhook/cache-population migration or function is present in this checkout.
- `save_workout` conflict updates change metadata/visibility and replace points, while retaining the originally inserted summary metrics/times. App edits currently concern metadata. If track editing is introduced, review summary recomputation in a separate change. Verification remains false; self-reported summary metrics are not verified rankings.

## Authentication, welcomes and security review

The existing `on_auth_user_created` trigger is AFTER INSERT on `auth.users`. It creates profile -> settings -> welcome in that order, satisfying the notification FK. Normal returning Google logins update an existing account, so they neither replay that trigger nor repair a missing profile. The new migration performs that repair explicitly, independent of OAuth provider.

**Existing-account policy:** the backfill creates only missing profiles/settings. It sends **no late welcome** for your existing Google user, matching migration 3's original "no backfill for returning users" behavior. Existing welcome/read state is retained. Future new auth users still receive exactly one in-app welcome and one queued job. The partial unique index `(user_id) WHERE kind='welcome'` plus conflict handling prevents duplicates. No push is sent without a configured worker, enabled settings and a registered consenting device. Realtime publication membership is conditional; verify it separately if inbox refresh works but live updates do not.

RLS remains enabled on every app table:

| Group | Row boundary |
| --- | --- |
| Profiles | Self or non-private/unblocked profile reads; self updates only. No client INSERT. |
| Settings/blocks/routes/zones/segments | Owner-bound access; segment geometry is not a public trail feed. |
| Activities | Self, or permitted public/following summaries subject to profile privacy and blocks. Existing followers may see follower summaries of a private profile. SQL helper is definer/stable to avoid RLS recursion. |
| Activity points | Only the activity owner can read, even when its summary is public. Writes occur through `save_workout`. |
| Follows/reactions/comments/reports | Caller identity checked against actor columns; visibility/block checks apply; social write-rate triggers remain attached. Reports readable only by reporter (plus trusted admin). |
| Clubs/members/challenges/entries | Club reads respect blocked owners; owner edits clubs; membership/entry reads are self-only; challenge visibility is public/global or member-scoped. Clients have no challenge creation policy. |
| Notifications | Owner reads and read-state updates only. |
| Subscription/metrics/insights/efforts | Owner reads; no client grants to populate trusted data. |
| AI/social counters, push devices/jobs | No client table access; controlled definer RPCs and service-role jobs only. |

Historical migrations relied on Supabase's table default grants except for inbox/push. RLS does not itself grant SELECT/INSERT permissions and does not guard TRUNCATE. The final additive migration sets required privileges explicitly instead of assuming project defaults. It retains anonymous SELECT on `activities` with **zero anonymous row policies**, preserving the existing anonymous-empty-result test; it does not expose summaries anonymously. It grants only editable profile columns and notification `read_at`, and revokes client direct activity/point/trusted-table writes. It leaves global default privileges and managed Auth/Storage role grants alone.

All app definer functions use an empty search path and schema-qualified application references. Trigger helpers cannot be called as client RPCs. AI quota and worker claims are service-only; the app receives only its public URL/anon (publishable) key. Never put a service-role key, database password, provider secret or worker secret in Expo public variables, CLI command arguments, logs or this repository. This audit does not certify unknown remote custom grants/functions; preflight must catch drift first.

Operational follow-ups: `social_rate_limits` has no scheduled retention job in this checkout; set a reviewed server-side retention policy before substantial production traffic. Additional FK indexes may be useful at scale (reverse/member/entry user lookups in particular); absence is a performance issue, not evidence of missing tables. Notification job user/notification consistency relies on the trusted enqueue function; its tables are inaccessible to client writes. The private avatars bucket's existing conflict-ignore creation will not correct an already-public bucket: stop and review if verification finds a public bucket. Owner-only Storage policies also mean another athlete's avatar signing can fail; the UI has a fallback and recovery must not make the bucket public.

## Commands to run later (PowerShell, Supabase CLI v3)

These commands follow the current [Supabase CLI reference](https://supabase.com/docs/reference/cli/introduction). **Use v3 for this runbook:** the explicit remote selector is `--remote`; older `--linked`/`--local` flags are deprecated in v3 and removed in v4. `npx.cmd` avoids this machine's PowerShell execution-policy issue with `npx.ps1`. `--yes` below belongs to npm's package-download prompt, not Supabase's deployment approval. No CLI is installed by this change.

Run each phase separately; inspect output and stop on any error. Do not paste the whole runbook as one unattended script. Record the exact version printed by the first command and use that same CLI build for rehearsal and deployment; `@3` selects the v3 release line.

### 1. Local rehearsal only

Requires Docker Desktop running, internet to fetch the CLI/images, and a **disposable** local Supabase database. Existing local data must be backed up before resetting it. No `--remote` appears in this phase. Do not change your app's working remote OAuth configuration just to run these database checks.

```powershell
Set-Location 'D:\StravaKinda_Nepal_Redesigned_Project\StravaKinda-main'
npx.cmd --yes supabase@3 --version
npx.cmd --yes supabase@3 start
# LOCAL ONLY: recreates the disposable local database; never add --remote.
npx.cmd --yes supabase@3 db reset --no-seed
npx.cmd --yes supabase@3 migration list
npx.cmd --yes supabase@3 db lint --schema public --fail-on error
npx.cmd --yes supabase@3 test db
npx.cmd --yes supabase@3 db query --read-only --file supabase/verification/after-migrations.sql
npm.cmd run check
```

`supabase test db` runs the existing privacy/notification suites and the new transactional profile-backfill suite. **Never run these fixtures against the remote project.** The new suite embeds the complete repair migration in a transaction-local helper and executes it twice (a Vitest contract check enforces exact equality with the migration file), simulates missing profile/settings using only synthetic fixtures, checks preserved data/no duplicate welcomes, checks grants/RLS and rolls back. This tests idempotence of the data repair, not replaying the non-idempotent baseline table-creation SQL. Resolve failures before proceeding. `db lint` is useful but insufficient to prove every RPC branch executes; inspect advisor warnings and do authenticated app smoke tests as well.

### 2. Identify the intended remote and inspect without applying migrations

Confirm the project reference against the Dashboard project URL **and** the hostname of your app's `EXPO_PUBLIC_SUPABASE_URL`. Do not print any keys. `supabase/config.toml`'s `project_id="stravakinda"` is a local identifier, not your hosted project reference. The command output should identify the expected target on every remote operation.

```powershell
$ProjectRef = 'REPLACE_WITH_YOUR_SUPABASE_PROJECT_REF'
npx.cmd --yes supabase@3 login
npx.cmd --yes supabase@3 link $ProjectRef
npx.cmd --yes supabase@3 migration list --remote=$ProjectRef
npx.cmd --yes supabase@3 db query --remote=$ProjectRef --read-only --file supabase/verification/preflight.sql
```

Authenticate through the CLI's normal flow; supply the database password only through its secure prompt/credential storage. Keep credentials out of chat and command history. Do not run `db pull` to invent a replacement initial migration. Do not use `migration repair` to paper over missing tables.

Proceed only if: there are no existing app tables/functions/conflicting auth provisioning triggers, no conflicting avatars policy/bucket settings, and remote history has none of these migrations recorded. An empty public schema **with recorded migrations** indicates drift; stop for a reconciled repair plan rather than marking history reverted or replaying the baseline. Existing partial app tables, unrecognized migrations or custom provisioning triggers similarly require review. Extensions in other schemas (especially PostGIS outside `extensions`) need review because SQL explicitly uses `extensions.geography`/`extensions.st_*`.

### 3. Preserve a recovery point and preview the exact pending set

Create/confirm a platform backup or snapshot that includes Auth data before schema changes. Existing OAuth users must be retained. Supplemental logical dumps below are read-only; their files can contain sensitive Auth/Storage metadata, so store them outside the repository in a protected folder. They are not a substitute for a tested full restore; Storage object binaries require separate backup if present.

```powershell
$BackupDir = Join-Path $env:USERPROFILE ('StravaKinda-private-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $BackupDir | Out-Null
npx.cmd --yes supabase@3 db dump --remote=$ProjectRef --schema public,auth,storage --file (Join-Path $BackupDir 'schema.sql')
npx.cmd --yes supabase@3 db dump --remote=$ProjectRef --schema public,auth,storage --data-only --file (Join-Path $BackupDir 'data.sql')
npx.cmd --yes supabase@3 db push --remote=$ProjectRef --dry-run
```

On the reported pristine remote, the preview must contain **exactly the seven versions listed above**, in that order. Dry-run lists pending migrations; it does not prove that SQL executes successfully or that backfill/RLS is correct. Do not add `--include-all`, `--include-seed` or `--include-roles`. If a dump fails, fix the backup/recovery path before applying changes.

### 4. Apply only after rehearsal, backup and dry-run review

**This is the deployment step you have not authorized the assistant to execute.** Run it yourself only when the earlier gates pass, preferably in a controlled maintenance window. It updates the hosted database and its migration history. It does not deploy Edge Functions or alter hosted Google OAuth configuration.

```powershell
npx.cmd --yes supabase@3 db push --remote=$ProjectRef
npx.cmd --yes supabase@3 migration list --remote=$ProjectRef
npx.cmd --yes supabase@3 db query --remote=$ProjectRef --read-only --file supabase/verification/after-migrations.sql
```

Do not run remote `db reset`, `migration down`, trigger removal, `auth.users` UPDATE/DELETE, table drops, or RLS disabling. If any migration fails, stop, retain the exact error/version and re-inspect history and objects. A previous migration may already be committed. Review the failed step before retrying ordinary `db push`; never manually replay all initial SQL or assume the seven-file operation was globally atomic. For a code defect, prepare a reviewed forward correction; restore only through the previously tested recovery procedure if necessary.

## Verification SQL and expected results

The complete queries are supplied as files so you can run them through CLI or paste them into the project's SQL Editor:

1. `supabase/verification/preflight.sql` works even when app tables/history are absent. Records auth-user count, tables, extensions and relevant auth triggers without displaying auth secrets. Inspect counts before/after allowing for any legitimate new signups during deployment.
2. `supabase/verification/after-migrations.sql` verifies history, missing-profile/settings counts (**0**), duplicates (**no rows**), all **25** tables with RLS, policies, validated FKs, triggers, unique welcome index, private avatar bucket, Realtime membership and API permissions. `client_truncate_grants` must be **0**. Zero policies on the four server-only tables (`ai_usage`, `social_rate_limits`, `push_devices`, `notification_push_jobs`) is deliberate, not a reason to turn RLS off.
3. Edit the UUID placeholder in `supabase/verification/as-user.sql` using your existing Google user's **Auth user ID** (not email/provider identity ID), then run it in SQL Editor or with the same remote read-only query command. It uses `SET LOCAL ROLE authenticated` plus a transaction-local `request.jwt.claim.sub`, then rolls back. Expect one own profile/settings row, zero cross-user memberships/private activities/raw points/inbox rows. Own memberships can be empty; own welcomes can be **0** for a returning account, **1** if one already existed, never more than 1. SQL Editor's default admin context bypasses RLS, so raw admin SELECTs alone do not establish privacy.

Useful quick queries after installation:

```sql
-- Both missing counts must be zero; duplicates are already prevented by PKs.
select count(*) as missing_profiles from auth.users u
left join public.profiles p on p.id=u.id where p.id is null;
select count(*) as missing_settings from auth.users u
left join public.user_settings s on s.user_id=u.id where s.user_id is null;

select user_id,count(*) from public.notifications where kind='welcome'
group by user_id having count(*)>1; -- no rows

select tablename,rowsecurity from pg_tables
where schemaname='public' order by tablename; -- all 25 true

select tgname,pg_get_triggerdef(oid) from pg_trigger
where tgrelid='auth.users'::regclass and not tgisinternal;
-- Exactly one application on_auth_user_created AFTER INSERT trigger.
```

If the tables exist but PostgREST still reports a stale cache, the final migration already issues the documented reload. You can repeat this SQL-admin command separately (not within a read-only CLI query):

```sql
NOTIFY pgrst, 'reload schema';
```

Then verify `public` remains in the hosted API exposed schemas, the app targets this same project, and retry/refetch Profile and memberships or restart the app to clear stale errors. Keep the existing Google account; returning sign-in alone is not a provisioning repair. Verify profile save, empty/real memberships, social reads, inbox read state and **opt-in** owned-workout sync using real data. Do not automatically link/upload guest GPS recordings for a smoke test.

### Optional targeted repair SQL

Migration 5 already repairs **all** existing accounts, including yours. If you want a later single-account repair instead of repeating a migration, edit the Auth UUID in `supabase/verification/targeted-profile-backfill.sql`, review it, and run that file as SQL admin. It is transaction-wrapped, checks the auth account exists and uses `ON CONFLICT DO NOTHING` for both keys. It never creates tables, changes existing auth/profile data, generates welcomes or alters RLS. This optional write is separate from the read-only verification commands; do not run it until the schema is installed.

## Local checks completed and remaining gate

- Passed `npm.cmd run typecheck`, `npm.cmd run lint`, and **87 Vitest tests**, including the new static migration/application contract tests.
- Reviewed all four original SQL migrations, existing two pgTAP suites, app table/RPC callers, sync ownership, Storage usage, auth provisioning, notifications/push and Edge Function authorization. No Expo/React Native implementation or OAuth configuration was changed.
- **Not executed:** PostgreSQL migration replay, `supabase db lint`, the three pgTAP suites, or remote preflight/deployment. Docker, `psql` and Supabase CLI are unavailable in this environment. The prepared SQL must pass the local rehearsal before deployment. No live remote security state is asserted.

Primary documentation consulted: [migration workflow](https://supabase.com/docs/guides/deployment/database-migrations), [auth profile triggers](https://supabase.com/docs/guides/auth/managing-user-data), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [CLI commands and target flags](https://supabase.com/docs/reference/cli/introduction), [PostgREST reload](https://supabase.com/kb/troubleshooting/refresh-postgrest-schema).

## Profile-backfill test portability fix (2026-11-15)

The user reports that local CLI v3 reset applied all seven migrations and public-schema lint passed; notifications and privacy pgTAP suites also passed. The backfill suite failed before its 24 assertions because psql's relative include resolved to a migration path absent from the pg_prove container. Supabase CLI mounts the tests directory, not the sibling migrations directory. Changing the relative path alone cannot expose that file.

The backfill suite is now self-contained: a temporary helper executes the complete unchanged migration payload twice within the existing rollback transaction. All 24 assertions remain, including missing profiles/settings, preservation of existing data and auth users, idempotence, welcome behavior, privileges and RLS. The static contract suite rejects drift between the embedded payload and the actual migration. No production migration or schema SQL changed, so another schema lint is not required for this fix.

Assistant validation: the four static migration contract tests passed. The requested local command was attempted, but npm registry access failed with EACCES; an offline retry failed with ENOTCACHED. Docker API access is also denied to this assistant session. Database tests therefore remain unverified after this fix; rerun locally:

```powershell
npx.cmd --yes supabase@3 test db
```

No hosted database, existing Google user, RLS policy, commit, push or deployment was changed.

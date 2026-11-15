# Phase 6 setup and release verification

No cloud project, provider or push delivery was configured or deployed during this implementation. Only `.env.example` exists here; the required public Supabase variables were absent. Never put provider secrets, service-role keys or worker secrets in `EXPO_PUBLIC_*` variables.

## Supabase and migrations

1. Select your existing Supabase project. Copy its project URL and public anon key into a local, untracked `.env` using `.env.example`. Do not use a service-role key in the app.
2. Apply the existing migrations in order to a **disposable test project first**, followed by `202611140001_welcome_notifications.sql` and `202611140002_push_preparation.sql`. With a configured local Supabase CLI/Docker installation: `supabase start`, `supabase db reset`, then `supabase test db`. This includes the existing privacy suite and the new 16-assertion notification suite. These database tests were provided but could not run here: no Docker/PostgreSQL/real project credentials were available.
3. For a remote project, inspect migration history and back up data before a separately authorized migration operation. This task did not run `db push` or modify a remote database. The new partial unique index deliberately fails if preexisting duplicate `kind='welcome'` rows exist; investigate them rather than deleting user records blindly.
4. Enable Email signup and email confirmation in Authentication settings. Configure real SMTP, sender identity, rate limits and production email delivery. Keep confirmation/recovery templates using Supabase's supported confirmation URL so PKCE redirects are preserved. Test expired links, resend limits and email changes separately.
5. In URL Configuration, use the actual HTTPS web application origin as production Site URL. Add exact redirect URLs below. Configure SPA fallback so `/auth/callback` loads the exported app on a direct request.
6. Verify `public.notifications` is included in the `supabase_realtime` publication. The migration adds it when that publication exists. Existing SELECT RLS restricts rows to `auth.uid()`; the new grants/policy permit updates to `read_at` only. Clients have no INSERT or DELETE privilege and cannot edit title, body, kind or owner.
7. Keep/deploy the existing authenticated `delete-account` function only through a separately authorized release. It validates the user's JWT server-side, deletes owned avatars and deletes the Auth user. Profile, notification, device and push-job rows cascade. Local workouts/drafts are not deleted or reassigned. Export accessible local activities before deleting an account: locally account-bound records remain private to that old identity.

## Redirects and native builds

| Context | App callback / Supabase redirect allowlist |
| --- | --- |
| Android/iOS development or production build | `stravakinda://auth/callback` |
| Expo web development | `http://localhost:8081/auth/callback` and/or `http://127.0.0.1:8081/auth/callback` |
| Local exported-web preview | `http://127.0.0.1:4173/auth/callback` or `http://localhost:4173/auth/callback` |
| Production web | `https://YOUR-ACTUAL-WEB-HOST/auth/callback` |

`app.config.ts` already uses scheme `stravakinda`, iOS bundle `com.stravakinda.app` and Android package `com.stravakinda.app`. No native directories were generated or edited. Use a development build to verify the custom scheme; Expo Go is not the release environment for this OAuth redirect. Build using the project's existing EAS profiles after credentials are configured.

The app derives the web callback from the current origin and rejects non-HTTPS origins except localhost/127.0.0.1 development URLs. It does not accept arbitrary return URLs or session tokens supplied in an incoming link. PKCE verification is delegated to Supabase Auth; open verification/recovery links on the same device/browser that requested them. For a different device, request a new link there. Missing, denied, expired and already-used links show a recovery action.

OAuth uses `signInWithOAuth` plus the system browser via the installed Expo Linking module; web uses a full-page redirect. Native users return through Expo Router and can explicitly cancel a pending browser sign-in in the app. Closing an external browser alone cannot be detected as a modal dismissal with Linking; the UI explains how to retry. Explicit cancellation records a device-local cancellation marker and rejects a subsequent callback before code exchange. A new OAuth attempt replaces the marker; new confirmation/recovery requests clear it. In-flight callbacks are coalesced; completed codes are not treated as reusable sessions.

## Google

1. In Google Cloud, configure an OAuth consent screen, app identity, support email and authorized domains. Add test users while in testing mode.
2. Create an OAuth **Web application** client for Supabase's hosted OAuth flow. Add `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (or your actual custom Auth-domain callback) as the authorized redirect URI. This provider redirect is different from the app callback in the table above.
3. Add the Google client ID and secret to the Google provider configuration in Supabase Authentication and enable it. They are not app environment variables. Restrict requested scopes to what this app needs (identity/email/profile).
4. Test a new Google identity and a returning Google identity on web and a physical development build. Verify consent cancellation and a disabled-provider configuration. Complete Google's publishing/verification requirements before public release.

## Facebook

1. Create/configure the appropriate Meta app and Facebook Login use case for your actual product, domains and platform identifiers. In development mode, explicitly add testers/roles.
2. Enable the OAuth login settings required by Meta and add `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (or your custom Auth-domain equivalent) as the exact valid OAuth redirect URI.
3. Configure Facebook App ID and App Secret in the Supabase Facebook provider and enable it. Request only the necessary identity/email permissions. Email may be absent; account ownership always uses the Supabase user ID.
4. Supply real privacy policy, terms and data-deletion instructions/URLs for Meta review. The current app's authenticated deletion endpoint is **not** a Meta signed-request data-deletion callback. If Meta requires that callback for your app configuration, implement and review a server-verified signed-request workflow before release; do not expose the existing admin deletion operation anonymously.
5. Test new/returning users, denied permissions, cancellation, missing email and disabled provider. Complete Meta app review/live-mode requirements as applicable.

## Identity linking and iOS release

There is no client email-matching merge, automatic workout claim, organizer import or call to `linkIdentity()`. Supabase may perform its own supported verified-identity automatic linking; treat its returned user ID as authoritative. Do not add an app-level merge based on email strings. If manual linking is introduced later, require an authenticated session and Supabase's supported linking workflow with explicit intent.

For this consumer fitness application, Google/Facebook primary-account login should be treated as an iOS release blocker until an equivalent privacy-preserving login option is provided and reviewed. Apple guideline 4.8 requires qualifying alternatives that limit data collection, support private email and avoid advertising tracking without consent; email/password alone is not assumed to satisfy it. Sign in with Apple is not implemented or displayed as working in this phase.

## Welcome and inbox verification

The existing `auth.users` INSERT trigger invokes `create_profile()`. Its replacement creates the profile/settings and welcome in one transaction. A partial unique index enforces one welcome per user. No returning-user backfill, login timestamp heuristic or client insert exists. Email confirmation can be pending while the notification is already stored; it becomes readable only after successful authentication. App refresh/reinstall cannot reset the server record.

On a disposable migrated project:

1. Record the count for existing users. Sign in repeatedly; their welcome counts must not increase.
2. Register a new email user. As a privileged test administrator, verify exactly one profile, settings row, `kind='welcome'` notification and push-job row for that user. Before confirmation, unauthenticated clients must not read the inbox.
3. Confirm email on the initiating device. Open the bell/inbox and verify the exact welcome title and message. Mark read, refresh/restart and check unread count stays zero.
4. Repeat for a fresh Google user and a fresh Facebook user; sign each out/in repeatedly. Revisit a consumed callback; no additional welcome may appear.
5. Verify user A cannot SELECT user B's notification or UPDATE B's read state, cannot INSERT/DELETE notifications, and cannot change owner/title/body/kind. Run `supabase/tests/notifications.test.sql`; its fixtures roll back. Browser fixture tests do not prove database RLS.
6. With an active signed-in inbox, insert a separate permitted test account notification using trusted administrator/server logic. Realtime should refresh immediately. Disconnect networking, reconnect and confirm saved unread messages are fetched even if the event was missed. Check foreground and manual refresh too.
7. Switch accounts during an in-flight fetch and while the inbox is open. Old items/counts must clear, and new items must be scoped to the new ID. Sign out and verify no bell/private inbox remains.
8. Verify a local guest event plan remains in the guest workspace after login/logout and is not automatically assigned. Confirm account A's bound workouts/maps/history are hidden from B/guests but still present in storage. Unlinked device activities remain accessible locally and require the existing per-activity explicit Link action before upload.

## Push preparation — intentionally not activated here

Network access prevented installing Expo modules (`EACCES` fetching compatibility/registry data; no cached packages). The failed dependency additions were removed so the project remains installable and builds with its existing lockfile. The production fallback adapter is disabled and the inbox explains this. `integrations/expo-push.native.ts.template` contains the Expo SDK adapter, and the activation script installs it into Metro's native platform path only after the packages exist.

On a machine with package access:

```powershell
npx expo install expo-notifications expo-device
node scripts/activate-expo-push.mjs
# Configure the real EXPO_PUBLIC_EAS_PROJECT_ID and set EXPO_PUBLIC_PUSH_ENABLED=true.
# Then run TypeScript/lint and create a new native development build.
```

Required app variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`; optional push activation: `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_PUBLIC_PUSH_ENABLED=true`. Existing RevenueCat/maps variables remain unchanged. No Google/Facebook secret belongs in the app.

Configure an actual Expo/EAS project and Android FCM v1 / Apple APNs credentials. Enable the Expo Notifications config plugin through the flag before building. Verify the generated adapter against the resolved SDK 58 module versions. It requests permission only from the signed-in inbox's Enable button, supports provisional iOS authorization, creates an Android channel, uses SecureStore for installation ID/per-account opt-in, registers via an authenticated RPC, retries failed registration while signed in and sends taps only to the private inbox after matching user ID. Signup never waits for notification permission.

Server-only setup: configure a random **32+ character `PUSH_WORKER_SECRET`**, and optionally `EXPO_ACCESS_TOKEN` for Expo push enhanced security. The Edge runtime's Supabase service-role credentials stay server-side. The `deliver-notifications` function accepts a POST with that worker secret, not arbitrary users/tokens/payloads. Deploy and schedule it only in a separately authorized release; no scheduler or delivery was enabled here.

Durable jobs wait for token registration and explicit consent. A service-role-only claim RPC uses row locks/`SKIP LOCKED`; each notification has one job. The worker sends to the most recently registered active device, records Expo tickets, polls receipts, disables invalid tokens, and backs off explicit retryable failures (maximum five attempts). Once accepted/sent, a welcome is not automatically pushed again on reinstall or another device. Stale or ambiguous sends enter `uncertain` and require operator reconciliation instead of blind resends. Expo transport is not claimed to offer exactly-once delivery; the **database welcome record** is the exactly-once invariant.

Push logout unregister is best-effort before sign-out; offline/in-flight transport can still deliver an already accepted generic account message. No GPS, organizer contacts or private event details are included in push payloads. Foreground/tap handling rejects another account's payload, but OS background display behavior must be checked on devices. Remote push, token rotation, foreground/background delivery, receipt processing and logout races remain unverified until the modules, credentials and physical devices are available. Add a token-rotation listener and test it before treating push as production-ready.

## Primary references

- [Expo SDK 58 Linking](https://docs.expo.dev/versions/v58.0.0/sdk/linking/), [Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/)
- [Supabase mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Google provider](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Facebook provider](https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [Expo push tickets/receipts](https://docs.expo.dev/push-notifications/sending-notifications/), [Apple review guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple)

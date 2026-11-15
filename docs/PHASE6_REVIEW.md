# Phase 6 — authentication and account notifications

Implemented in the existing Expo SDK 58 application. **Live integration remains blocked by project/provider credentials. Push is prepared but disabled.** No cloud migrations, function deployments, commits or pushes were performed.

## Audit findings and implementation

The app already had Supabase email signup/login/reset, a PKCE callback, native chunked SecureStore sessions, profile creation on `auth.users` insertion, authenticated account deletion, owner-scoped sync and a read-only notifications table. There was no notification inbox, welcome generation, OAuth UI or Expo Notifications dependency. Only `.env.example` was present; no real public Supabase environment variables were configured in this workspace. Existing migrations/services were extended rather than introducing another auth backend.

- Auth now has a Nepal-inspired photographic hero, two-column desktop presentation, mobile layout, sign-in/create-account modes, Google/Facebook controls, email/password, password visibility, recovery, resend/verification, loading and errors. Light/dark surfaces reuse the shared design system and approved editorial asset.
- Email operations still use the existing Supabase client. Google/Facebook use Supabase OAuth with PKCE and real browser redirects; native uses the installed Expo Linking module with the existing `stravakinda` scheme. No simulated login or account is included in application code.
- The callback rejects missing/error/token-fragment flows, coalesces concurrent duplicate codes and uses the SDK's `PASSWORD_RECOVERY` event to distinguish recovery from ordinary confirmation. Recovery controls appear only after a successful authenticated exchange. Explicit pending-browser cancellation is recorded locally and checked before exchange; no arbitrary redirect URL is opened from notification data.
- Native sessions remain in SecureStore; web PKCE/session values now use browser localStorage so a full OAuth redirect/refresh can restore the session. No token is written to workout SQLite or Organizer storage. Session hooks ignore late initial results after an auth event and unsubscribe on unmount.
- Sign-out reuses Supabase plus best-effort push-device unregister and the existing RevenueCat logout. Account deletion still calls the existing authenticated Edge function; its confirmation is now usable on web as well as native. Local records are retained without reassignment.
- The existing account-creation trigger creates the exact welcome notification in the same transaction as profile/settings. A unique partial index enforces one welcome per user. No login flag, client insert, login timestamp heuristic or old-user backfill creates welcomes. Unconfirmed users see their saved welcome only after authenticating.
- The authenticated Home header has a bell/count. `/notifications` fetches recent and saved unread rows, gets the authoritative unread count, subscribes to owner-filtered Realtime updates, refreshes on subscription/reconnect/foreground and provides polling/manual retry. It supports mark-as-read, loading, empty, error and pagination states. Old account items/counts and subscriptions are cleared on switch/logout; late fetches cannot populate a new account's inbox.
- RLS retains owner-only SELECT; column grants and an owner UPDATE policy allow only `read_at` changes. Ordinary clients cannot insert, delete, change the message or reassign notifications. A new pgTAP suite checks these guarantees against a migrated Supabase database; it has **not been executed here**.

## Local data boundaries

Authentication does not mutate local workouts, import guest drafts, change workout owners or enable new sync consent. Existing sync only uploads explicitly account-bound finished activities and pins the job's JWT. Existing per-activity Link remains the explicit route for claiming an unowned recording. Organizer guest/account namespaces are unchanged and are never auto-merged.

The audit found that Home/Activities could display known other-owner local workouts. Small access guards now hide those summaries, detail routes, GPX statistics/maps and an in-progress other-owner recording from another account or guest. Settings export also excludes inaccessible account-owned records. All data remains stored and becomes visible again to the proper account. Unowned device recordings remain accessible locally; they are never silently attached/uploaded. This is device-local storage with the existing encryption/privacy boundaries, not a claim that SQLite/localStorage resists a compromised device or malicious same-origin script.

## Push preparation and limits

Added private device registration RPCs, consent checks, a unique durable welcome job, service-role-only claims, server-secret-protected delivery code, ticket/receipt handling and cautious retries. The native adapter template covers permission, Expo token acquisition, SecureStore installation/consent, safe owner-matched taps and foreground updates. The client retries delayed registration while signed in. Permission is requested only from the inbox's explicit Enable action and never blocks signup.

Installing Expo modules failed because network requests were denied (`EACCES`) and no packages were cached. Failed manifest additions were removed; the existing lockfile/dependency set is retained. Push therefore remains disabled through `services/push-platform.ts`. The optional adapter is a template requiring module installation, activation, TypeScript validation and a new configured development build. It was **not included in the successful native exports** and has not been verified on a device. Token-rotation handling and physical-device lifecycle tests remain release work. The delivery worker/SQL were not deployed or run against an external service.

The in-app database welcome is exactly-once per user. Expo transport is not represented as exactly-once: accepted jobs are not blindly resent, ambiguous sends become `uncertain`, and explicit retryable failures back off. Tokens may be registered later without losing the pending welcome job. See the setup guide for credentials, operator reconciliation and logout/in-flight delivery limits.

## Visual verification

Reviewed the original app concepts and reused their Nepal photography, navy typography, orange action, teal accent and white-surface direction. The entire infographic is never used as a screen background. Mobile refinement moved the password toggle beside the field and reduced hero text/spacing to eliminate clipped overlay text. Desktop keeps a tall hero alongside the form. Existing main-screen designs remain intact apart from the bell and required privacy guards.

Ten viewport screenshots are in `artifacts/phase6-review/`: sign-in and create-account validation at **390 × 1000** and **1440 × 1000**, light/dark, plus a simulated populated inbox at both widths. Tests wait for actual headings/images before capture and check document overflow. All account/notification/workout fixtures are isolated test data; no fictional workout was written to the user's store.

- [Mobile sign-in](../artifacts/phase6-review/sign-in-390-light.png)
- [Desktop sign-in](../artifacts/phase6-review/sign-in-1440-light.png)
- [Dark mobile sign-in](../artifacts/phase6-review/sign-in-390-dark.png)
- [Create account validation](../artifacts/phase6-review/create-account-validation-1440-light.png)
- [Mobile inbox fixture](../artifacts/phase6-review/inbox-390-light.png)

## Actual validation

| Check | Result |
| --- | --- |
| `npm run check` | TypeScript and ESLint clean; **81 unit tests / 17 files pass** |
| `npx playwright test --workers=2` | **81 browser tests pass**, including previous phases |
| Expo production web export | Pass |
| Expo Android/iOS exports | Pass, with push fallback disabled; output under `artifacts/phase6-review/native-build/` |
| Real Supabase migrations / pgTAP RLS tests | **Not run**: no configured project/PostgreSQL/Docker |
| Actual email delivery / Google / Facebook | **Not verified**: credentials/provider configuration absent |
| Expo push adapter / remote delivery | **Not activated or device-verified**: dependency/network, credentials and device prerequisites |

Unit tests cover credential/redirect checks, native browser requests for both providers, callback errors/cancellation/coalescing, recovery events, sign-out, session storage chunks/web storage, inbox merge/owner filters/read-only updates/error handling, and the local access predicate. Existing GPS, SQLite, subscriptions, sync and organizer tests continue to pass.

Browser provider/email tests replace the served Supabase module with an isolated simulated server. They cover new and returning accounts, one welcome in the simulated record set, confirmation/recovery, denied OAuth, restoration, read state, Realtime insertion, offline/reconnect, account switching, confirmed deletion and preservation of guest drafts. A separate test uses in-memory GPS fixtures to verify other-account cards/maps are hidden while all records remain stored. Those simulations do **not** establish real provider behavior, database-trigger execution or RLS enforcement. No live login, email, notification or push was sent.

## Files changed

| Area | Files |
| --- | --- |
| Auth UI/routes | `components/auth-screen.tsx`, `components/auth-callback.tsx`, `src/app/auth.tsx`, `src/app/auth/callback.tsx` |
| Auth/session/access | `services/auth.ts`, `services/supabase.ts`, `hooks/useSession.ts`, `features/auth/validation.ts`, `features/auth/local-access.ts` |
| Inbox | `services/notifications.ts`, `store/inbox.ts`, `components/notification-coordinator.tsx`, `components/notification-bell.tsx`, `src/app/notifications.tsx`, `src/app/_layout.tsx` |
| Existing screens, scoped changes | `src/app/(tabs)/index.tsx`, `activities.tsx`, `record.tsx`, `profile.tsx`; `src/app/activity/[id].tsx`; `src/app/settings.tsx` |
| Push preparation | `services/push.ts`, `services/push-platform.ts`, `components/push-preferences.tsx`, `integrations/expo-push.native.ts.template`, `scripts/activate-expo-push.mjs`, `app.config.ts` |
| Supabase | `supabase/config.toml`, `supabase/migrations/202611140001_welcome_notifications.sql`, `202611140002_push_preparation.sql`, `supabase/functions/deliver-notifications/index.ts`, `supabase/tests/notifications.test.sql` |
| Tests | `tests/auth.test.ts`, `tests/auth-storage.test.ts`, `tests/notifications.test.ts`, `tests/fixtures/auth-backend.ts`, `tests/browser/auth-notifications.spec.ts`, `tests/browser/phase3-design.spec.ts` |
| Setup/reporting | `.env.example`, `.gitignore`, `docs/PHASE6_SETUP.md`, this report, `docs/PROGRESS.md`, `DESIGN_REDESIGN_README.md` |

## Remaining configuration and release blockers

Follow [the exact setup guide](PHASE6_SETUP.md) for Supabase URLs/keys/migration order, Google and Facebook console settings, callback allowlists, welcome/RLS testing, push installation/EAS/FCM/APNs credentials and worker deployment prerequisites. No credentials or secrets are hardcoded. Production SMTP, provider reviews, real legal/privacy/deletion URLs and an equivalent privacy-preserving iOS login option need completion/review. Sign in with Apple is not implemented or implied to work. Live publication/payments for Organizer Studio remain unavailable, as before.

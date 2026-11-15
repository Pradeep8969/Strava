# Automatic Google profile synchronization

Google OAuth completion now automatically fetches fresh Supabase Auth user and Google identity metadata, then synchronizes nonempty name/photo fields in public.profiles before enabling Continue to Profile. The manual import action has been removed.

Each Google sign-in restores the Google name and photo, including existing placeholder profiles and manually edited names/photos. Missing or unsafe metadata never clears valid saved fields. Manual edits remain until the next Google sign-in; refreshing an already synchronized session does not revert edits. Edit Profile explains this behavior.

Only the Google OAuth attempt schedules synchronization. Having a linked Google identity does not trigger Google synchronization during email/password or Facebook sign-in. Google identity metadata takes precedence; user metadata is used only when there are no conflicting linked identities. Email and the provider identity are read from Auth and remain there: the public profiles schema has no email/provider columns, and private email is not copied to a publicly readable table. All profile lookups and writes use the Supabase Auth user ID, never Google's subject ID.

Updates contain only available changed name/avatar_path fields under existing authenticated owner RLS and column grants. Bio, username, privacy, sports, workouts, statistics and memberships are untouched. New users use the existing auth INSERT trigger; missing profiles use the existing idempotent ensure_athlete_profile RPC. No new migration is necessary when the existing athlete profile migration has already been deployed.

The callback displays a synchronization loading message and blocks Continue to Profile until completion. Failed synchronization has a Retry profile synchronization action that does not exchange the OAuth code again. A per-user pending marker allows Profile loading to resume interrupted syncs after refresh. Profile/avatar query caches are invalidated after completion. No Google synchronization runs merely because a token refresh occurs.

## Verify with your real Google account

1. Run the app using its existing configured Supabase project and OAuth redirect settings.
2. Sign out, click Continue with Google, and choose your existing Google account.
3. Wait for confirmation and click Continue to Profile. Confirm your Google name and photo appear without importing anything.
4. Inspect public.profiles: the row ID must equal Authentication Users ID, with name and avatar_path populated. Existing bio/privacy and activity/membership records should remain unchanged.
5. Refresh: the synchronized details should remain. Edit bio, name and photo, then save. Refresh should retain these edits. Sign out and sign in through Google again: available Google name/photo should return while the bio remains edited.
6. Repeat with a genuinely new Google test account and confirm only one Auth user/profile exists. Repeat sign-in to confirm no duplicate records.
7. On web, Android and iOS test a valid Google photo, a missing photo, and an unavailable HTTPS image. Missing/failed images show the fallback icon. Failed image loading does not erase the saved URL.
8. Test email/password and Facebook on linked accounts: they must not replace saved fields with Google metadata.
9. In a test environment, interrupt a profile update and retry synchronization; confirm the callback does not attempt to consume the OAuth code a second time.

Automated checks: npm run check (TypeScript, lint, Vitest), plus the auth-notifications Playwright suite against a fresh web export. Browser tests simulate Supabase and Google metadata; live OAuth and native device rendering require manual verification. No remote database writes, deployments, commits or pushes are performed by these checks.

# Profile and Edit Profile upgrade

Profile retains StravaKinda's Himalayan imagery, colors, fonts, shared identity and six bottom tabs. The references were described in the request, but no screenshot attachments were available in this session; the implementation follows the written requirements and existing design.

## Features and data

- The header uses the shared authenticated athlete name/avatar, completed persisted workouts, and exact owner-visible follower/following counts. Loading/failed counts show a dash rather than invented numbers. Share Profile shares/copies a real `/athlete/:id` route; the route requires authentication and respects the existing profile RLS/private-profile restrictions.
- Progress reuses real training statistics, weekly/monthly charts, sports, records and milestones. Activities reuses ActivityCard and the same workout store as the global Activity journal. More contains clubs/challenges, profile details, account/sync and toolkit links. Settings stays in the global header.
- Edit Profile supports first/last names, avatar, bio, city, province, primary sport, birthdate, gender and weight (kg), plus existing username/privacy controls. Optional fields can be cleared. Birthdates must be real past dates within 120 years; weight must be 20–500 kg. Names retain the existing 80-character full-name limit.
- The display name remains `public.profiles.name`. Additional fields are in owner-only `public.athlete_details`, including names/location/sport. Keeping birthdate/gender/weight out of `profiles` prevents existing public-profile SELECT policies from exposing those details. A security-invoker RPC saves base/profile details together with RLS and concurrency checks. No other athlete fields or activity data are changed.
- Drafts are stored per Supabase user ID in the existing local database, including photo bytes for previews. They survive switching tabs/navigation/refresh and do not replace remote values until Save. Cancel explicitly confirms discarding. Signing into another account never loads the previous account's draft.

## Image handling

Tapping the edit avatar opens Delete Picture, Take Picture, Choose Existing and Cancel. Web uses a file picker or a permission-requesting camera preview with explicit capture/cancel and stopped media tracks. Native uses Expo ImagePicker's SDK 58 native module through an optional Expo binding, requests permissions, supports editing/confirmation and recovers pending Android picker results. Missing native modules display an actionable message instead of crashing the app.

Only JPEG, PNG and WebP up to 5 MB are accepted, with MIME and file-header checks. Chosen bytes are previewed in the draft. Save uploads an ArrayBuffer to a unique `avatars/<auth-user-id>/<uuid>.<extension>` object (the bucket name is `avatars`; object keys start at `<auth-user-id>/`). No temporary file path is stored in the remote profile. The stable object key is saved in `profiles.avatar_path`; shared avatar queries resolve private signed URLs. Upload paths are immutable and shared queries are invalidated after saves, preventing old-photo cache reuse.

Successful replacements/deletion remove only the old account-prefixed custom object after the profile transaction succeeds. Failed saves attempt cleanup of only the new upload and leave the existing avatar intact. Failed cleanup can leave an unreferenced private object; it never rolls back a successful profile save or deletes unrelated files. Delete Picture is staged until Save and uses an available Google photo or the default icon. Google account metadata is never modified.

Google sign-in still refreshes the available display name. It initializes/fills provider avatars but preserves an account-owned Storage key on future sign-ins. Its avatar update compares the previously read path, so a concurrent custom upload wins. Clearing the custom avatar permits Google/default fallback. First/last editor values are reconciled with the canonical display name when Google has refreshed it.

## Required setup: review and apply separately

1. Review `supabase/migrations/202611150002_profile_editor.sql` after existing migrations. It adds only the owner-only details table/policy and transactional save RPC; it preserves users, profiles, activities, existing objects, and RLS. The existing private avatars bucket/owner-prefix policy remains in force; the migration restates the current 5 MB JPEG/PNG/WebP bucket restrictions.
2. Apply the migration to a disposable Supabase project first. Run `supabase/tests/profile_editor.test.sql` there; its fixtures roll back. Check another account cannot read/update personal details or upload/delete someone else's avatar. These PostgreSQL/RLS tests have been prepared but were not executed in this environment. Static schema tests are not a substitute for executing SQL.
3. After reviewing/testing, apply only the new migration through your normal Supabase migration workflow. Do not reset or rerun old migrations. Until then, the existing profile/header/Google flow works, but the expanded editor reports the unavailable details migration instead of pretending to save fields.
4. Install the SDK-compatible native module with `npx expo install expo-image-picker` from a network-enabled shell. The install attempted here was blocked by network `EACCES`; offline installation also failed because the package/dependency metadata was not cached. `package.json` records SDK 58's `~58.0.10`, but installation and lockfile reconciliation are still required. Do not run `npm ci` expecting this uninstalled module to be present before completing this step.
5. Build a new Android/iOS development build after installation. `app.config.ts` includes photo/camera descriptions and enables the picker plugin when installed, without requesting microphone access. No native directories were edited. Use your normal reviewed EAS workflow; no build/deploy has been submitted automatically.

## Verification

Sign in, check real header counts, switch between Progress/Activities/More, and open an activity. Edit each field and save; refresh and sign out/in to verify persistence. Try invalid dates/weight and empty optional fields. Leave an unsaved draft, navigate/refresh, reopen it, and confirm it remains until Save/Discard. Switch accounts and verify no previous draft/identity is shown.

Choose a small JPEG/PNG/WebP; verify the preview before Save, signed avatar after Save, and image across shared identity consumers. Try invalid content, oversized files, denied camera/library permissions, and cancellation. Upload a custom photo, sign out/in through Google and confirm it survives. Delete it and Save, then confirm Google/default fallback and removal of only that custom object. Test Share Profile while logged into another account, including private profiles.

TypeScript, lint, unit tests and browser tests cover field validation, ownership checks, upload/delete services, native permission/cancel/missing-module handling, Google/custom precedence, drafts, private-details save requests, real activity lists and account switching. Browser cloud/OAuth/storage actions use isolated fixtures. Actual native camera/gallery, Android process recreation, restricted storage/RLS, signed-URL expiry and live upload require a configured Supabase test project and real-device verification.

## Files changed

- Profile/UI: `src/app/(tabs)/profile.tsx`, `src/app/(tabs)/index.tsx` (shared avatar in the existing profile action), `components/profile-editor.tsx`, `src/app/athlete/[id].tsx`.
- Validation/services: `features/athlete/edit-profile.ts`, `services/profile.ts`, `services/profile-details.ts`, `services/avatar.ts`, `services/avatar-picker.ts`, `services/avatar-picker.web.ts`, `services/google-profile-sync.ts`.
- Native dependency/config: `package.json`, `app.config.ts` (installation/lockfile update still required).
- Database review: the new migration and SQL test above.
- Automated tests: `tests/profile-editor.test.ts`, `tests/google-profile-sync.test.ts`, `tests/supabase-schema.test.ts`, `tests/fixtures/auth-backend.ts`, `tests/browser/auth-notifications.spec.ts`, `tests/browser/phase3-design.spec.ts`.
- This report: `docs/profile-upgrade.md`.

No remote migration, deployment, commit or push was performed.

Final validation: TypeScript and ESLint passed; 138 unit tests passed; 65 Playwright tests passed with one configured-map test intentionally skipped; web, Android and iOS exports passed. SQL/Storage policies were reviewed statically and their rollback-only tests prepared, but no live PostgreSQL test or native camera session was run. Native picker installation remains blocked in this environment as described above.

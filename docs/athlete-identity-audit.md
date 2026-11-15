# Authenticated identity and settings audit

## Findings and implementation

- Home had a hardcoded current-user greeting. It now derives the first name from the authenticated `public.profiles` row through `useCurrentAthlete`.
- Profile had its own profile/avatar query implementation. Home and Profile now observe the same account-keyed React Query entries (`athlete-profile`, `athlete-avatar`). Profile saves and Google OAuth completion refresh these entries for every observer.
- Social feed cards independently loaded the signed-in athlete's avatar and treated every avatar as a private Storage key. Own posts/comments now use the shared name, and own posts use the shared HTTPS-or-signed-Storage avatar with the existing image error fallback. Other athletes' identities remain attached to their own posts/comments.
- Session management previously created an Auth subscription and session lookup per consumer. `SessionProvider` now performs one initial lookup and subscribes once for the app. Changing accounts or signing out removes the previous account's identity cache. Queries and displayed data are scoped to the current Supabase user ID.
- Home had a mobile gear duplicating the global destination. It now has an Open profile action at all widths. Profile's heading gear and redundant toolkit settings row were removed. Record's header gear was removed, preserving its title alignment.
- `SettingsButton` is shared by application headers. The tab header is available on mobile and desktop, retaining a single settings button on every tab. Stack routes use the same control; Settings itself has no self-link. Six bottom tabs and existing page designs remain.
- Record's removed gear opened `/settings`; it did not provide separate recording configuration. Those controls remain there under the explicit Recording settings label: activity visibility and auto-pause, with existing units/location/privacy controls retained. Distinct actions such as Privacy settings, Adjust weekly goal, device location settings and store subscription management remain available.

## Screens reviewed

Home, Explore, Record, Events, Activities, Profile, Clubs, Challenges, Community, social feed/comments, Analytics, Plus, Organizer, notifications, search, routes, coach, activity/event detail, account screens and settings were searched/reviewed through their routes, shared components and data modules.

The current-user identity inconsistencies were Home and own social feed avatars/names, with duplicated query handling in Profile. Other athlete references, competition column headings, community copy, account email displays, activity data and separately editable device-local organizer business profiles are intentional and were preserved. No runtime user names were hardcoded.

## Behavior and verification

After Google sign-in, Profile shows the full profile name and Home greets its first word. Before session/profile loading finishes, Home says `Namaste.` without displaying a false athlete name. A signed-out account retains the generic greeting; a genuinely missing name has safe fallback behavior. Background refetches retain an already loaded identity instead of replacing it with a loading screen.

Edit the name in Profile and save, then switch to Home; the greeting should update. Refresh and verify persistence. Sign out and switch accounts; the previous account's identity should disappear. Google still restores its available name/photo at the next Google sign-in, as explained in the editor. Email/password and Facebook use the same profile query without Google assumptions.

At mobile and desktop widths, visit every tab. There should be one Open settings button in the application header. On Profile and Record, it opens Settings & privacy, where Recording settings and Auto pause remain available.

Unit coverage includes first-name derivation, Unicode/whitespace, session/profile loading, mismatched cached users and missing-name fallback. Browser coverage includes shared updates, refresh, switching/sign-out, one global settings entry and navigation on six tabs at mobile/desktop widths, existing Google synchronization and responsive navigation. Supabase browser fixtures return detached response snapshots and keep credentials/OAuth interactions simulated.

## Files changed

- Identity/session: `hooks/useSession.ts`, `hooks/useCurrentAthlete.ts`, `features/athlete/identity.ts`.
- Shared UI: `components/settings-button.tsx`, `components/SocialActivityCard.tsx`.
- Routes/layouts: `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/index.tsx`, `src/app/(tabs)/profile.tsx`, `src/app/(tabs)/record.tsx`, `src/app/settings.tsx`.
- Tests: `tests/athlete-identity.test.ts`, `tests/browser/auth-notifications.spec.ts`, `tests/browser/preview.spec.ts`, `tests/browser/phase3-design.spec.ts`, `tests/fixtures/auth-backend.ts`.
- Report: `docs/athlete-identity-audit.md`.

No new dependency, migration, credential change, remote database change, deployment, commit or push is required.

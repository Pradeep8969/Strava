# Phase 4 — Clubs, Challenges & Social

Implemented in the existing Expo SDK 58 / React Native application on 2026-11-14. No dependencies, database migrations or unrelated backend systems were added. Nothing was committed, pushed or deployed.

## Working UI and integrations

| Area | Implemented behavior | Existing integration |
| --- | --- | --- |
| Community directory | Photographic-style Nepal covers, real club names/descriptions, search, Discover/My clubs controls, membership status and join/leave | `clubs`, the viewer's `club_members` rows, existing RLS |
| Club detail | `/club/[id]`, about section, membership controls, Overview/Feed/Challenges/Events/Members sections and unavailable-club recovery | Exact club lookup; viewer-scoped membership; club challenges are queried only for members |
| Challenges | `/challenges`, search/Joined controls, actual targets/start/end dates, join/leave, accessible progress bars, warm joined-card treatment | `challenges`, the viewer's `challenge_entries`, completed workouts in the existing store |
| Social feed | Community/Following navigation, real profile names or neutral fallbacks, sport icons, distance/moving-time/pace, actual kudos/comment counts, loading/retry/empty states | RLS-visible `activities` summaries, `profiles`, `follows`, embedded reaction/comment counts |
| Kudos and comments | Add/remove own kudos, expand comments, post comments, actual refreshed counts | Existing `activity_reactions` and `comments` writes and rate limits; latest 30 comments loaded and displayed chronologically |
| Avatars and routes | Signed-in athlete's existing private avatar; other athletes use initials. Own matching local workout geometry can appear in a feed card | Existing private avatar storage and gap-aware `RoutePreview`; no feed request for `activity_points` |
| Sharing | Native share sheet for public summaries; selectable/copyable public summary on web | React Native Share / browser clipboard; no GPS coordinates or private/follower-only summary sharing |
| Competition | `/competition`, photographic-style hero, clearly planned empty results table, own segment-definition previews | `segments` metadata filtered to the current creator; no route geometry or fabricated competitive results |

Join/leave updates invalidate community, club-detail and Profile membership queries. Existing account permissions remain authoritative. Social screen state resets across account changes; cached posts from a previous account are not displayed after sign-out. Home's existing `useFeed` and all six redesigned main screens were left untouched.

## Progress calculation

Challenge progress is explicitly labeled a **personal device estimate**, not an official score. It includes finished local or current-account workouts that start after both the challenge start and the athlete's join time, and finish before the challenge end/current time. Another account's linked workouts, paused sessions, future finishes and workouts crossing the time boundary are excluded. Distances come from the existing `stats` utility. The bar caps at 100%; actual distance is not capped. Unknown join dates/invalid goals do not produce a made-up progress value.

The existing challenge model supports distance goals and has no sport-specific eligibility field. Cards therefore say “All sports · distance challenge.” No fictional sport restriction, participant total, official result or activity-count goal is inferred.

## Reference review

All three original reference images were inspected as design guides. Individual mockups informed the UI; no infographic is embedded as a screen background.

- Reference 01, Social & Community and Clubs & Challenges: compact identity rows, scenic club covers, clear membership actions, sport metrics, kudos/comment controls and club sections.
- Reference 02, Clubs & Communities and Challenges: navy segmented navigation, warm featured challenge surfaces, orange sport/trophy accents, teal progress and compact date presentation.
- Reference 03, Social & Community: rounded white activity surfaces, orange navigation emphasis, restrained spacing and a clear shared-activity hierarchy.

Reviewed screenshots at **390 × 844** and **1440 × 844**, in light and dark themes. Refinements corrected mobile cover crops that initially showed mostly sky, added warm joined-challenge cards, clarified the planned leaderboard with an empty results table, and removed repeated club titles in the detail page. Mobile uses a single column with swipeable club-section controls; desktop uses a wider content column with community/competition panels alongside it.

Covers reuse the existing original generated Nepal-inspired editorial images (`himalayan-editorial.jpg`, `ridge-editorial.jpg`, `pokhara-editorial.jpg`). They are decorative covers, not claimed photographs of a particular real club or athlete's workout.

## Screenshots

Saved under `artifacts/phase4-review/` at both widths and themes:

- `clubs-guest-…png`, `challenges-guest-…png`, `social-guest-…png`: actual unsigned-in application states.
- `clubs-test-fixture-…png`, `club-detail-test-fixture-…png`, `challenges-test-fixture-…png`, `social-test-fixture-…png`: populated UI with isolated test input.
- `competition-…png`: explicitly planned competition interface, with no sample rankings.

Files marked `test-fixture` contain mocked accounts, clubs and activity input solely for browser verification. These are not real accounts or workouts. The adapter replaces a module in a test-served response; it does not modify source services, seed a real backend or add sample data/debug hooks to production code. Own GPS sketches use isolated test coordinates injected into the preview store only during that test.

## Validation

- TypeScript: `npm.cmd run typecheck` passed.
- Lint: `npm.cmd run lint` passed without warnings.
- Unit tests: **45 passed across 11 files**. New coverage includes privacy-scoped reads/writes, Following with no follows, permission failures, comment validation/latest-thread ordering, and challenge eligibility/boundary calculations.
- Browser tests: **52 passed**, including the existing Home/Record, Explore/Events and Activities/Profile suites. After the comment-thread refinement, all **10 focused Phase 4 checks** were rerun.
- Web export: `npx.cmd expo export --platform web` passed.

Browser checks cover both viewport sizes/themes, image loading, heading bounds and horizontal overflow; guest state, directory search, club/challenge join/leave, club sections, actual local progress, kudos toggle, reading/posting comments, sharing controls, Following filtering, read/write errors, retry, sign-out and missing-club recovery. Requests for raw social GPS are explicitly checked to be absent.

## Changed files

| Files | Purpose |
| --- | --- |
| `src/app/community.tsx`, `src/app/social.tsx` | Replace existing community/social presentation while preserving their routes |
| `src/app/challenges.tsx`, `src/app/club/[id].tsx`, `src/app/competition.tsx` | Challenge directory, club details and competition preview routes |
| `features/community/CommunityScreen.tsx` | Responsive club/challenge discovery UI |
| `features/community/data.ts` | Reads and writes through existing Supabase tables/permissions |
| `features/community/progress.ts` | Actual-workout personal challenge progress |
| `components/community-ui.tsx`, `components/SocialActivityCard.tsx` | Covers, navigation, cards, membership actions and social interactions |
| `hooks/useCommunity.ts` | Account-keyed loading, focus refresh and membership cache invalidation |
| `tests/community.test.ts` | Read/write/privacy and progress checks |
| `tests/fixtures/community-backend.ts`, `tests/browser/phase4-design.spec.ts` | Isolated populated/guest screenshots and interaction/error tests |
| `.gitignore` | Ignore generated Phase 4 screenshot artifacts |
| `docs/PHASE4_UI_REVIEW.md`, `docs/PROGRESS.md`, `DESIGN_REDESIGN_README.md` | Review and integration notes |

The local `dist/` web export and screenshot artifacts were regenerated. GPS recording, storage, offline sync, authentication services, privacy settings, schema/RLS and existing redesigned main-screen source files were not modified.

## Unimplemented or constrained by existing services

- **Club member/participant totals and directories:** `members_read` and `entries_read` expose only the viewer's rows. Counting those rows as total participation would be misleading. Only the viewer's own club/challenge counts are shown.
- **Club-specific activity feeds:** activities have no club association, and the member list is private. The club Feed section is labeled Planned and links to the working community feed.
- **Club events:** no club-event backend exists. The Events section is labeled Planned and can open the existing Nepal Events demonstration directory.
- **Club location and custom banner uploads:** no corresponding columns exist. Real club metadata is shown without invented locations; covers are local editorial artwork.
- **Activity photos and other athletes' photo avatars:** there is no activity-media model, and the avatar bucket is owner-only. No scenic stock image is presented as an athlete's uploaded workout photo. Other athletes receive initials derived from available profile names.
- **Public competitive results:** existing segment geometry/efforts are private; no reviewed public ranking service exists. The preview contains no fake ranks, times, attempts, leaderboard totals or records. Only the viewer's existing segment-definition metadata can be listed.
- **Official challenge scoring, broader history pagination and realtime updates:** not added. Personal progress is local; directories/feed/thread reads are bounded and refresh explicitly/on focus.
- **Live and device verification:** authenticated behavior was tested with a mock backend, not a live Supabase project. Native share sheets, private-storage policies and GPS rendering still need device/live-service validation. Existing deployment/service configuration remains required.

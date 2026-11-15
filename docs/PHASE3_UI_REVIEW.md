# Phase 3 — Activities & Athlete Profile

## Activities refinement — 2026-11-14

Refined the existing Activities screen without replacing its structure or workout calculations. Desktop history now fills the available space alongside a 320px chart sidebar. At 1360px and wider, search and sport filters share a row; narrower desktop and mobile layouts keep them stacked. Actions in the empty state have a bounded desktop width. Activities opts into larger summary/chart/card typography; other screens retain the shared components' default appearance.

The empty journal now uses the existing approved Himalayan editorial image, or the existing Pokhara image for cycling. Each sport has its own message: no runs, walks, rides or hikes recorded yet. Search misses remain distinct and offer Reset filters even for a completely empty journal. Images are decorative editorial artwork, never presented as recorded workouts or mapped routes.

Changed files in this refinement: `src/app/(tabs)/activities.tsx`, `components/athlete-training.tsx`, `tests/browser/phase3-design.spec.ts`, and this report. No workout statistics, GPS, storage, authentication, synchronization or navigation services changed. No dependencies were added.

Verified running, walking, cycling and hiking cards at 390px and 1440px using isolated test fixtures injected into the preview's in-memory store. Checks include actual route sketches, a walking activity without GPS, unknown hiking elevation, unchanged aggregate totals while filtering, sorting and reset behavior. Reloading the preview is explicitly checked to return the workout count to zero: fixtures are not written to user storage. Existing activity-detail navigation checks remain in place.

TypeScript, lint and all 45 unit tests passed. All 54 browser tests passed, including the earlier screen suites and two new Activities refinement tests. Web export succeeded. Screenshots were visually reviewed at 390px and 1440px in light/dark themes; focused populated-card captures are saved as `artifacts/phase3-review/activities-refined-{sport}-fixture-{width}.png`, with empty-state captures alongside them. Nothing was committed, pushed or deployed.

Implemented directly in the existing Expo SDK 58 project on 2026-11-14. No packages were added. No commit, push or deployment was performed.

## Implemented

- Activities: compact training totals, actual completed-workout history, search, newest/oldest sorting, running/walking/cycling/hiking filters, pagination, sport icons, privacy icons, route sketches and distance/moving-time/pace/elevation summaries. Empty, filtered-empty, loading and storage-error states are handled.
- Training: week-by-day and six-calendar-month distance charts, with a weekly goal using the existing preferences. No placeholder bars, percentages or trend improvements are invented. The Month tab shows monthly totals over six months, rather than individual days within a month.
- Profile: Nepal-inspired landscape banner, centered avatar/name/bio, account-metadata location when supplied, private-profile status, statistics, locally persisted sport preferences, weekly progress, whole-activity personal bests, the earned first-completion milestone and real club membership links.
- Profile statistics and personal bests include unlinked local workouts and workouts linked to the current account. Another account's linked workouts are not attributed to this athlete. Activities continues to show the device's workout history.
- Existing avatars load through signed URLs from the private `avatars` bucket, with an icon fallback. No public avatar bucket or invented athlete identity was introduced.
- Profile editing, username validation, privacy switch, sync/restore, sign-out, settings, privacy zones, analytics, community and subscription navigation remain available. Profile queries are keyed by user; the profile subtree resets across account changes so drafts and avatar details are not shown after sign-out. Load errors include retry controls.
- Activity details retain actual metrics, splits, editable title/description, sport/visibility controls, native replay, export, account linking and deletion logic. The page now shares the athlete presentation layer. Browser details show actual route geometry instead of the old scenic illustration; replay is disabled on web because there is no cursor-capable web map.

Recorded route sketches reuse the existing bounded, gap-aware `RoutePreview`. No fabricated route coordinates or completed activities are present in app code. Distance and moving time use the existing `stats` utility. Elevation is shown only when measured altitude is available. Personal bests identify the source workout and explicitly describe whole activities; the run-pace comparison requires at least 1 km and excludes other sports. These are not certified race or segment records.

## Reference comparison and refinements

All three original reference images were inspected. The individual profile mockup in reference 02 informed the centered identity, three-column statistics, bio and sport preferences. Reference 01's analytics mockups informed compact segmented chart controls, teal distance bars and summary typography. References 01/03's activity-summary screens informed route thumbnails, compact metric rows, white/navy surfaces and orange accents.

Screenshots were reviewed at 390 × 844 and 1440 × 844 in light and dark themes. Refinements included moving the mobile chart directly beneath totals, keeping desktop history/chart columns side by side, moving profile editing adjacent to the identity card, correcting the banner crop to retain the peaks, and adding cross-platform ARIA state to preferences/chart controls. The existing tab header is hidden only for the newly redesigned Activities/Profile mobile screens. Other screens keep their existing header behavior.

Screenshots are in `artifacts/phase3-review/`:

- `activities-{390|1440}-{light|dark}.png`: training overview and history layout.
- `activities-empty-…png`, `activities-month-…png`: lower empty-state and monthly-chart views.
- `profile-{390|1440}-{light|dark}.png`, `profile-progress-…png`: identity and lower progress/community sections.
- Files containing `test-fixture` show isolated test workouts or a mocked account. They are test evidence, not actual user activities or live account data.

The banner reuses `assets/himalayan-editorial.jpg`, the original generated photographic-style artwork already used by the redesigned app. No infographic is used as a background; no new external image dependency was added.

## Validation

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed. Generated Playwright trace assets are now excluded from lint, alongside existing generated build output.
- `npm.cmd test`: 35 tests passed across 10 files. New tests cover zero data, unfinished/future exclusions, calendar-month/year boundaries and sport-aware record eligibility.
- `npx.cmd expo export --platform web`: passed.
- `npx.cmd playwright test`: all 42 browser tests passed, including the existing Home/Record and Explore/Events checks, mobile/desktop layouts and light/dark themes.
- After the final banner adjustment, the eight focused Phase 3 checks were rerun and screenshots refreshed.

Browser tests check overflow, heading bounds, image loading, filters, weekly/monthly controls, sport-preference persistence across navigation, populated cards, detail metrics, account scoping, profile edits, privacy changes and sign-out. Populated tests inject fixtures into the existing preview runtime only; authenticated tests replace the backend module in the served test response. They do not modify production services, seed a real database, persist invented workouts or contact real accounts.

## Files changed in this pass

| File | Purpose |
| --- | --- |
| `src/app/(tabs)/activities.tsx` | Training history redesign |
| `src/app/(tabs)/profile.tsx` | Athlete identity, profile controls and progress |
| `src/app/(tabs)/_layout.tsx` | Hide redundant Activities/Profile mobile headers |
| `src/app/activity/[id].tsx` | Refined detail layout and real web route sketch |
| `components/athlete-training.tsx` | Scoped training panels, stats, charts, cards, records and links |
| `features/athlete/metrics.ts` | Completed summaries, calendar-month grouping and record selection |
| `tests/athlete.test.ts`, `tests/fixtures/training.ts` | Actual-data calculations tested with isolated inputs |
| `tests/browser/phase3-design.spec.ts` | Screenshot and interaction coverage |
| `eslint.config.js`, `.gitignore` | Exclude generated test artifacts |
| `docs/PHASE3_UI_REVIEW.md`, `docs/PROGRESS.md`, `DESIGN_REDESIGN_README.md` | Implementation and validation notes |

The local `dist/` web export and screenshot artifacts were regenerated. Home, Record, Explore, Events and the existing shared activity card were not redesigned or edited. GPS services, storage/offline sync, Supabase authentication/services, account settings and database migrations were not modified.

## Remaining limitations

- Native maps, GPS, native replay and device persistence were not tested on an Android/iOS device in this pass. Existing native configuration is still required.
- Real Supabase account operations were not exercised against a live project; authenticated UI behavior was tested with a mocked backend. Existing service credentials and policies remain required.
- Avatar upload and location editing are not implemented. Existing stored avatars and account-metadata location are displayed; missing values are not fabricated.
- Sport preferences are per-account/local-device selections, not cloud profile fields. The current schema has no sport-preference or location columns; no schema migration was added.
- Statistics cover completed workouts present on this device. Use the existing sync/restore workflow for linked cloud workouts. No public leaderboard, follower totals, certified race records or additional achievement backend was invented.
- The banner is generated editorial artwork, not a newly sourced documentary photograph.

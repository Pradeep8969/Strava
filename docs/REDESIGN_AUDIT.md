# Architecture audit and implementation plan

## Baseline

Expo SDK 58, React Native 0.88, React 19, Expo Router screens in `src/app`, shared presentation in `components`, Zustand snapshots, SQLite on native, memory-only browser preview, TanStack Query remote reads, Supabase authentication/Postgres RLS. No native project directories or Git metadata are present in this workspace.

Reviewed screens, shared components, hooks, persistence, recorder/recovery, synchronization, tracking/analytics utilities, config, migrations, Edge Functions, tests, existing documentation and design references. Existing native recording and authentication boundaries must remain intact.

Baseline typecheck passes; lint fails on five JSX apostrophes. Browser tests reference obsolete screen titles and controls. React Native Web's View implementation logs string children as unexpected text nodes. Optional message/error/action strings used as JSX `&&` conditions can return empty strings to container components. Replace these with explicit element-or-null branches and enforce a lint rule. Check development rendering as well as production exports, because the View diagnostic is development-only.

## Priorities

1. Correct JSX guards across all screens, enforce against regression, repair lint and browser checks.
2. Refine reusable theme, accessible controls, responsive navigation and dashboard with real weekly chart data.
3. Improve Explore, Record, Activities, Events and Profile while preserving services, storage keys and routes.
4. Improve existing community interactions and membership state; keep competitive rankings explicitly planned.
5. Run typecheck, lint, logic tests, web export and browser interaction/console checks; document limits.

## Backend boundaries identified before implementation

| Capability | Existing support | Remaining requirement |
| --- | --- | --- |
| Local recording/history/analytics | SQLite, native recorder, tracking utilities | Outdoor device calibration, long-track performance testing |
| Athlete feed, kudos, comments | activities, activity_reactions, comments with RLS | Live backend verification, pagination, moderation |
| Clubs and challenges | clubs, club_members, challenges, challenge_entries | Management tools, trusted progress aggregation |
| Competitive segments | segments and owner-readable segment_efforts schema | Trusted server matcher, anti-cheat validation, privacy-reviewed ranking RPC; no public leaderboard API exists |
| Events and organizer details | No event tables or service | Verified events/organizers schema, publication RLS, organizer verification, search API, optional merchant provider |
| Nearby trail discovery | Native map, local waypoint routes | Licensed trail/search/routing provider, access and elevation information |
| Privacy | Activity visibility, private profile, blocks, zones | Public track redaction and follow requests; raw tracks stay owner-only |

No migration or external service provisioning is needed for the interface work. Do not seed imaginary events, rankings, athlete data, routes or payments. Existing local artwork is reused; its prior documentation describes it as original. No new third-party imagery is imported.

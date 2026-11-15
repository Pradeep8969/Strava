# StravaKinda — Nepal fitness interface

The existing Expo/React Native application has been improved in place. GPS services, SQLite, Supabase authentication, synchronization and existing routes are preserved.

Phase 6 adds the authentication redesign and private welcome-notification inbox, with server migrations and OAuth integrations awaiting your project/provider configuration. See [implementation and tests](docs/PHASE6_REVIEW.md) and [Supabase/Google/Facebook/push setup](docs/PHASE6_SETUP.md). Push remains disabled until its dependencies, credentials and device build are ready.

Phase 5.5 extends Organizer Studio into a persistent local event-planning workspace. See [the implementation and verification report](docs/PHASE55_ORGANIZER_REVIEW.md) and [backend integration plan](docs/ORGANIZER_BACKEND_PLAN.md). Publishing, registrations and payments remain unavailable.

Phase 5 implements Analytics and Plus dashboards alongside an Organizer Studio preview. Open Organizer Studio from Analytics or Plus. See [the implementation, screenshots and validation report](docs/PHASE5_UI_REVIEW.md).

Phase 4 adds Clubs, Challenges and Social UI, with existing Supabase integrations and explicit planned states where services are missing. See [the implementation and validation report](docs/PHASE4_UI_REVIEW.md).

Phase 3 adds the Activities and Athlete Profile redesign. See [the implementation, screenshot comparison, validation and remaining work](docs/PHASE3_UI_REVIEW.md).

Read the [architecture audit and priorities](docs/REDESIGN_AUDIT.md) and [implementation report](docs/REDESIGN_CHANGES.md) for exactly what changed, validation results and remaining requirements.

The latest Home and Record pass follows the three supplied mobile design references. See the [reference comparison, asset prompt and screenshot notes](docs/REFERENCE_UI_REVIEW.md). Home now uses a compact photo-led feed; Record uses a focused dark instrument panel.

Phase 2 redesigns Explore and Nepal Events using the same references while preserving Home and Record. See [the changed files, asset prompts, comparison and remaining work](docs/PHASE2_UI_REVIEW.md).

```powershell
npm run check
npm run web
```

For local production preview checks, finish the export before starting the browser tests:

```powershell
npm run export:all
npm run test:web
```

The interface includes real weekly charts and local milestones, community summary highlights, activity search/sorting and route sketches, saved-route selection, event-category search, improved recording metrics and membership-aware club/challenge actions. Mobile bottom navigation and desktop side navigation support both themes.

Events now use explicitly labeled visual demonstrations with working search, filters and detail pages. Verified events/organizers, registrations, payments, trusted competitive rankings, nearby trail search and offline map tiles require further backend work. No athlete data or purported real-world events were fabricated. Original project mountain artwork and generated editorial photographs are used.

The web app remains a memory-only layout preview. Use Android/iOS development builds for actual GPS recording and interactive maps. Successful bundle exports do not establish physical-device behavior or live backend correctness. See [testing instructions](docs/TESTING.md) and [setup](docs/SETUP.md).

No commit, push or deployment was performed.

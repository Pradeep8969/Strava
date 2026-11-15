# Phase 2 — Explore and Nepal Events

Updated 2026-11-14. Implemented in the existing Expo SDK 58 / React Native / TypeScript application. All three original design images were inspected visually; individual screen patterns were translated into components. No infographic is used as an app background.

## Latest refinement pass

The existing Phase 2 implementation was refined directly. Changed source files in this pass: `src/app/(tabs)/explore.tsx`, `src/app/(tabs)/events.tsx`, `src/app/event/[id].tsx`, `components/discovery-ui.tsx`, `components/DiscoveryMap.web.tsx`, and `tests/browser/phase2-design.spec.ts`; this report was also updated. The local `dist/` export and screenshot artifacts were regenerated.

- Compact rectangular sport filters now use the app's orange accent, following reference 03. Explore has directly selectable Kathmandu/Pokhara areas, selected destination borders/badges, richer decorative schematic detail, and larger desktop destination images. The map is now 240px on mobile and 490px on desktop. Screenshot review prompted the shorter mobile map so destination names appear above the bottom navigation at 390px.
- Featured event imagery is larger, with sport and featured-concept overlays, a readable full sample date and an event-preview affordance. The detail hero is larger on both viewports. Demo status, organizer placeholders and disabled registration remain explicit.
- Compared refreshed 390px and 1440px screenshots against the map/photo hierarchy in reference 01, compact event browsing in reference 02, and orange filters/photo cards in reference 03. Reviewed light/dark rendering and the event-detail screenshot. The schematic deliberately differs from the reference's real map; no synthetic GPS tracks were added.
- Validation: TypeScript and lint passed; 31 unit tests passed; all 34 browser tests passed. After the final mobile size refinement and new area-switch assertions, TypeScript, lint and all 5 focused Phase 2 browser tests passed again. Web export succeeded. Screenshots for Explore, Events and event details are refreshed in `artifacts/phase2-review/` for 390px/1440px and both themes.
- Remaining limitation: the local images are original generated photographic-style artwork, not actual photographs. A licensed Pexels download was attempted but the workspace network rejected the connection. No remote image dependency or unlicensed replacement was introduced. Actual photography remains outstanding. Native map rendering was not device-tested in this browser-only pass; Android still requires the existing Google Maps key configuration. Real events, organizer verification, registration/payments and road-routing services remain unimplemented.

Home, Record, native map implementation, GPS, persistence, authentication and Supabase services were not modified in this pass. No dependencies were added, and nothing was committed, pushed or deployed.

## Implemented

- Explore: compact search and sport filters, prominent native map, an original labeled web cartographic schematic, photographic destination inspiration cards, area selection, saved-route search/selection and Route studio access.
- Existing `routes` local storage is read on screen focus. Only saved waypoint geometry supplies distance. Reliable measured altitude pairs can supply elevation; planning points with no altitude do not acquire invented ascent. Distances are explicitly straight-line plans, not recorded workout metrics or road routing.
- Native discovery maps use the installed react-native-maps library and existing Android map key. The camera waits for map readiness. No location permission is requested or recording started by Explore.
- Web schematic: approximate Kathmandu Valley/Pokhara place anchors, original decorative contours and water shapes, readable responsive labels, and a clear not-for-navigation notice. These are not surveyed roads, map tiles or GPS tracks. Only a user's selected saved route can create a route line, labeled as waypoint geometry without a base map.
- Events: original photographic cards, responsive featured section, working search/sport filters, sample date blocks, location and format chips, and real Expo Router navigation to `/event/[id]`.
- Demo details: photographic header, date/location panels, Overview/Organizer tabs, organizer placeholder status, disabled registration and missing-event recovery. All four listings are explicitly fictional visual demonstrations. No organizer identity or contact details are represented as verified.
- Consistent light/dark colors and typography reuse the existing athlete presentation layer. Only the mobile header visibility for Explore/Events was adjusted in the tab layout.

## Visual review and corrections

Reference 01 supplied the map-and-photo-card hierarchy and event detail composition. References 02 and 03 informed compact search, sport chips, date/location presentation and event discovery cards.

Screenshots are captured by `tests/browser/phase2-design.spec.ts` at 390 × 844 and 1440 × 844, in both light and dark themes, under `artifacts/phase2-review/`. Event detail screenshots are included at both widths.

The first visual review found excessive empty space between Explore's map and cards caused by flex sizing intended for desktop columns. Flex growth is now limited to desktop. Mobile map height was reduced to 280px so the first photographic cards appear in the initial viewport; desktop uses 460px. SVG labels now use viewport-sized coordinates instead of being compressed with the terrain. Category chips were tightened so all five choices fit the 390px viewport. The desktop featured-event photograph was enlarged to preserve more of the mountain composition. Repeated explanatory blocks were reduced to concise badges and notices.

Intentional differences from the mockups: no invented athlete routes, participant counts, verified organizers, registration fees, paid actions or confirmed dates. Browser maps are schematic; supported native builds display actual maps. The reference's sample route distances and event inventory are not treated as real data.

## Changed files

| Files | Purpose |
| --- | --- |
| `src/app/(tabs)/explore.tsx` | Map-focused discovery and saved plans |
| `src/app/(tabs)/events.tsx` | Photographic demonstration event directory |
| `src/app/event/[id].tsx` | Working event detail route and error recovery |
| `src/app/(tabs)/_layout.tsx` | Hide redundant mobile headers only for Explore/Events |
| `components/DiscoveryMap.tsx`, `components/DiscoveryMap.web.tsx` | Native map and meaningful labeled web alternative |
| `components/discovery-ui.tsx` | Shared search, filters, photos, badges, titles and buttons |
| `features/discovery/catalog.ts` | Editorial destinations, geographic anchors and supplied-route metrics |
| `features/events/catalog.ts` | Explicitly labeled demonstration events and filtering |
| `assets/pokhara-editorial.jpg`, `assets/ridge-editorial.jpg` | Original photographic-style editorial assets |
| `tests/discovery.test.ts` | Filter and actual-data metric checks |
| `tests/browser/phase2-design.spec.ts` | Screenshots and interaction/empty/detail/console checks |
| `tests/browser/preview.spec.ts` | Updated expectations for redesigned screen titles and filters |
| `.gitignore` | Ignore local Phase 2 screenshot artifacts |
| `docs/PHASE2_UI_REVIEW.md`, `DESIGN_REDESIGN_README.md`, `docs/PROGRESS.md` | Current implementation and validation notes |

Home and Record source files, tracking/recorder services, SQLite/browser persistence, authentication, synchronization, Supabase services, schemas and migrations were not edited. No dependency was added. Existing routes and all six tabs remain available.

## Assets and exact prompts

The built-in imagegen tool generated two original Nepal-inspired editorial scenes. Outputs were converted to local JPEG assets; the original generated PNG files were left intact. These are not photographs documenting an actual event or a verified route. The existing `assets/himalayan-editorial.jpg` is reused without modification.

1. `assets/pokhara-editorial.jpg` — 1536 × 1024, about 544 KB.

> Use case: photorealistic-natural. Asset type: original photographic editorial landscape for a Nepal sports app event card. Wide 3:2 documentary travel photograph inspired by Pokhara, Nepal. Calm blue-green lake in foreground with two small colorful wooden boats near a tree-lined shoreline promenade, distant immense snowy Annapurna-like Himalayan peaks and soft green foothills under clear blue morning sky. Rich natural greens and blue water, soft warm sunlight, sharp real stone and wood texture. Attractive composition safe to crop to 16:9, mountains in upper third, water and promenade below. No identifiable people, no text, no signage, no logos, no race or event branding, no infographic, no UI. This is Nepal-inspired editorial imagery, not documentation of a real sports event or an identified navigable route.

2. `assets/ridge-editorial.jpg` — 1536 × 1024, about 668 KB.

> Use case: photorealistic-natural. Asset type: original photographic editorial landscape for a Nepal fitness app's hiking and trail-running discovery cards. Wide 3:2 photograph of a narrow stony trail on a lush green Himalayan ridge, Nepali terraced foothills and small village roofs in the middle distance, distant dramatic white snow peaks glowing in clear late morning sunshine. A few small prayer flags beside the trail, fresh rhododendron flowers along the edge. Immersive documentary outdoor photography, believable terrain and natural colors, 35mm landscape composition safe for a 16:9 crop. No people, no text, no signs, no logos, no graphics, no UI, no infographic. Original atmospheric Nepal-inspired scene, not a map or a photograph documenting a verified event or known safe route.

## Validation results

- TypeScript and ESLint pass; all 31 unit tests pass.
- All 34 production Playwright tests pass, including the existing Home/Record reference checks and four-width light/dark navigation checks.
- All 5 focused Phase 2 tests pass against the development server, including console-error checks. No unexpected text-node or browser runtime errors were reported.
- Android, iOS and web bundle exports pass. This is not physical-device or live-service verification.
- Final Explore, Events and event-detail screenshots were reviewed at 390px and 1440px in both themes after the spacing, label and photo-crop refinements. Local artifacts remain in `artifacts/phase2-review/`.
- Expo served development using its fallback React Native DevTools because the sandbox cannot write the latest download to the external cache; the app and tests ran successfully.

## Remaining work

- Real event and organizer tables/services, verified publication permissions, actual inventory, dates/venues/course validation, organizer contact verification, registration, tickets and merchant/payment integration.
- Licensed trail/route search, road snapping, turn instructions, route difficulty/elevation providers and offline base-map tiles. Destination inspiration is not a verified trail catalog.
- Live Supabase integration and physical Android/iOS map checks. The local browser is still a memory-only preview and cannot record GPS. Android maps still require the existing restricted map key.

No registrations, transactions, athlete statistics or GPS recordings were fabricated or inserted into storage. No commit, push or deployment was performed.


# Phase 1B: interactive maps

## Inspection before implementation

Web maps share `DiscoveryMap.web.tsx`, a pinned MapLibre GL JS loader, MapTiler styles using the existing public key, attribution, Nepal place search, city selection, route sources, retry/loading/offline feedback, and geographic markers. RecorderMap and PlannerMap already reuse this component. Record's accepted GPS updates and 35 m acquisition validation are implemented independently of map tiles. Route Studio already adds numbered waypoints, draws straight lines, calculates approximate distance, undoes, fits, names, saves offline, and restores plans in the existing `routes` key. Plans and workouts are separate. RoutePreview is a bounded, non-geographic route sketch, not a base map.

Native maps use the existing `react-native-maps` dependency: Apple maps on iOS and the existing configured Android map service. Native PlannerMap already supports tap placement, numbered markers and explicit fit. TrackMap draws segmented GPS lines but always recenters on new points. Native DiscoveryMap's saved-route overlays were incorrectly mounted in its missing-key fallback instead of its MapView. Android has an explicit unavailable state when its existing native map configuration is absent. This phase retains these dependencies; MapTiler/MapLibre remains the web implementation.

Web TrackMap is still a scenic illustration, and web Activity Details bypasses it for RoutePreview. Details enforces `canAccessLocalWorkout` before rendering local data. Account-owned tracks are hidden from other accounts; unowned tracks remain device-local. Privacy Zones explicitly says shared-route redaction is unfinished. This phase must not introduce other-user route access or render raw shared geometry. Existing public feeds do not provide a route-viewing path through Details.

All named adapters, route preview/planner utilities, storage, Record/Explore/Route Studio/Details screens, recorder services, and map/planner/recording/privacy-related tests were inspected. Phase 1A files were fingerprinted before edits and are to remain byte-for-byte unchanged. No key, dependency, navigation, authentication, Supabase, or storage-format changes are planned.

## Changes made

- Record web maps use the latest accepted stored GPS point as a teal location marker. No separate map geolocation request is made in recording mode. Follow location can be toggled; user-originated pan/zoom suspends follow; Recenter location restores it. Paused recordings remain pannable and recenterable. Geometry updates do not recreate the map, and duplicate coordinates do not trigger camera movement. The memoized Record adapter avoids rebuilding map data on the screen timer tick. Acquisition feedback subscribes to the existing Phase 1A state without changing that state or the 35 m rule.
- Shared web maps now fit only for initial display, region/selection changes, explicit fit requests, or map retry. Waypoint edits and style changes preserve the camera. Selected route lines are teal; other routes remain orange. Existing zoom, place search, street/outdoor style, keyboard, offline, loading and retry controls remain.
- Existing Nepal destination anchors now have clickable web markers labeled as references, not verified trails. Explore selection shows a route sketch, kind, waypoint/fix count, and segmented recorded distance or approximate straight-line plan distance. It keeps one interactive map instance across selection and region changes.
- Web TrackMap now reuses the interactive map adapter instead of the scenic illustration. Activity Details draws the stored GPS track, fits it, preserves statistics, and skips initialization for empty/invalid geometry. A shared owner/device geometry guard explicitly rejects raw other-account tracks regardless of public/follower visibility. No new shared-track endpoint or privacy-zone redaction claim was introduced.
- Native Explore overlays now render inside MapView, with selectable route markers and segmented polylines, selected-route color, Recenter, loading and retry controls. Its unavailable fallback contains no native overlays.
- Native TrackMap adds Follow/Fit/Recenter controls, suspends recording follow on map touches, waits for native readiness before camera movement, uses an accepted-point marker instead of a separate unfiltered native location dot, preserves invalid/gap/paused breaks, and skips empty activity maps. The existing Android configuration guard remains. Native PlannerMap already met waypoint/fit requirements and was preserved.
- Route Studio keeps existing add/undo/fit/name/offline save/restore behavior and its `routes` storage format. Clear now confirms on browser and native; cancelling preserves points. Copy explicitly says roads, trails, terrain and access restrictions are unverified. Re-saving an opened route still makes a copy.
- Sketch generation now preserves invalid/masked gaps and supports plan sketches without applying recording time-gap rules. Plans are labeled as waypoint sketches rather than recorded GPS.
- Map source-rendering failures show retry feedback without taking down recording controls. MapLibre continues to show source-provided attribution; the MapTiler logo/link was added, and redundant custom text attribution was removed after live screenshot review. The [MapTiler attribution guide](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/) documents source text credits and free-account logo requirements.

## Exact Phase 1B files

Existing implementation files changed:

1. `components/DiscoveryMap.web.tsx`
2. `components/DiscoveryMap.tsx`
3. `components/RecorderMap.web.tsx`
4. `components/TrackMap.web.tsx`
5. `components/TrackMap.tsx`
6. `components/RoutePreview.tsx`
7. `features/discovery/map-data.ts`
8. `features/discovery/maplibre.web.ts`
9. `features/routes/preview.ts`
10. `src/app/(tabs)/explore.tsx`
11. `src/app/activity/[id].tsx`
12. `src/app/routes.tsx`

New implementation file: `features/routes/activity-map.ts`.

Existing tests changed: `tests/map-data.test.ts`, `tests/route-preview.test.ts`, `tests/browser/planner.spec.ts`, `tests/fixtures/maplibre-adapter.js`.

New tests: `tests/activity-map.test.ts`, `tests/maplibre-loader.test.ts`, `tests/maps-native.test.ts`, `tests/browser/premium-maps.spec.ts`.

Documentation: `docs/phase-1b-premium-maps.md`.

Live browser screenshot evidence: `artifacts/maps/explore-live-390.png`, `artifacts/maps/explore-live-1440.png`, `artifacts/maps/planner-live-390.png`. Waypoints in the planner screenshot are explicitly automated test clicks, not a recorded workout or verified route.

All 11 pre-existing Phase 1A files were checked by SHA-256 and remained unchanged. In particular, the recorder services, Record screen, acquisition module, recording tests, tracking code/tests, and Phase 1A reports were not edited. They still appear as uncommitted work in Git. Stored activities/plans, planned-route services and format, keys/environment files, Supabase, OAuth, dependencies, and six-tab navigation were not changed. No deployment, commit, or push was performed.

## Tests and results

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd test`: **35 files / 193 tests passed**, including the existing 180 tests and 13 added unit tests. Coverage includes loader sharing/CSS readiness/failure/retry/timeout, route segmentation/distance/selection, invalid and masked gaps, owner-only geometry, native overlay placement, empty maps, and accepted GPS markers.
- Configured-map Playwright run (`MAP_ADAPTER_TEST=true`): **24 passed, 2 mode-specific skips** across map adapter, premium maps, planner, and the unchanged Phase 1A recording suite. Test doubles verify actual geometry passed to the renderer, latest-marker updates, camera follow/recenter, stable instances, map errors/retry, a thrown rendering error, saving through map failure, planner undo/clear/cancel/save/restore, Details statistics/access protection, mobile/desktop layouts, and all six tabs.
- Missing-configuration run: **3 passed, 3 mode-specific skips**. Tests used an isolated no-key child-process export (`EXPO_NO_DOTENV=1`, empty test-process map key, development mode disabled); no environment file or stored credential was changed. The normal configured web export was restored afterward.
- Live-provider run: **4 passed** using actual MapLibre and configured MapTiler tiles in Edge/Chromium: canvas/control/region behavior at 390 and 1440 px, provider-library failure/navigation, and mouse/touch waypoint placement. Live screenshots were inspected. The configured-map mode's two skipped tests were covered by this live run and the missing-map run.
- Web, Android and iOS Expo exports passed. Native exports check bundling only, not an installed app or physical GPS.
- `git diff --check`: passed. No unresolved unrelated type/lint/unit failures were found.

Initial missing-key tests were run against a configured export and failed their environment assumptions; they passed unchanged in the correct isolated export. Initial live tests could not reach the MapLibre CDN inside the sandbox. A direct connectivity check failed there and returned HTTP 200 outside it; the same four live assertions then passed outside the sandbox. These assertions were not relaxed. An intermediate effect-feedback lint error was corrected before final checks.

## Capabilities and limitations

| Area | Web | Android / iOS |
| --- | --- | --- |
| Provider | Existing MapLibre + MapTiler key/styles | Existing react-native-maps service; no new framework or key |
| Record | Accepted GPS marker/line, follow, manual pan/zoom, recenter, independent error recovery | Accepted marker/segmented line and follow/recenter, subject to existing native map configuration |
| Route Studio | Numbered click/tap waypoints, undo, confirmed Clear, explicit fit, approximate distance, offline save/restore | Existing tap/numbered marker/line/fit implementation and shared confirmed Clear/save/restore |
| Explore | Saved-route markers, catalog destination references, selected preview, recenter/search/zoom | Saved-route markers/lines fixed; catalog references, selected preview and recenter |
| Activity Details | Interactive stored GPS track and fit; empty/inaccessible tracks never initialize a map | Existing native stored track/replay with readiness, fit and empty-track handling |

- No configured road/trail-routing service exists. Plans connect waypoints with straight lines and do not verify roads, trails, terrain, access, safety or elevation. Road routing, directions and turn-by-turn navigation remain deferred pending an explicit routing-service design.
- Shared-route privacy-zone redaction remains unimplemented in the existing product. Other-user raw tracks stay inaccessible, including public activities. Owners can view their own full local track; no coordinates are newly shared. Existing GPX export still includes the complete owner track and keeps its warning.
- Offline storage preserves geometry, not downloaded base-map tiles. CDN/provider/key/quota/connectivity failures still require a working connection/configuration for tiles. Maps do not control recording or alter accepted GPS.
- The web base-map street/outdoor styles are preserved. App map controls and panels use existing light/dark theme colors; changing app theme does not introduce another map framework or new style requirement.
- Android/iOS retain different providers from web. Native map readiness is observable, but the installed dependency does not expose a uniform tile-error callback; a map-ready event alone cannot prove every tile loaded. The loading timeout/retry cannot diagnose every native provider failure.
- Browser recording remains foreground-only and requires a real fresh fix at 35 m or better. Desktop location providers may never meet that requirement. No background-recording or GPS-hardware guarantee was added.
- Native tests inspect component contracts with mocked native modules; browser GPS/adapter tests use isolated test-only fixtures. No physical Android/iOS device, outdoor GPS session, Safari-specific behavior, or battery/lock-screen behavior was verified here.

## Manual verification

1. **Record:** Open Record on HTTPS/localhost, allow GPS, and wait for an accepted fix. On a narrow screen choose Map. Move outdoors and check the teal marker and segmented line. Pan/zoom; subsequent fixes must update the line without snapping the camera back. Choose Follow or Recenter, pause, pan/recenter again, resume, and finish. Block tiles/library access and confirm recording controls and local save still work. Retry the map after restoring connectivity. The 35 m acquisition rule must remain unchanged.
2. **Explore:** Use Kathmandu/Pokhara, pan and zoom, click a labeled destination reference, then select one of your saved plans or GPS-route markers. Check the title, sketch, kind and distance label. Recenter and switch street/outdoor styles without creating duplicate maps or unexpectedly resetting the view. Check phone/desktop widths and light/dark app themes.
3. **Route Studio:** Open from Explore. Click/tap numbered waypoints; check connecting lines and approximate distance. Undo, Fit, cancel Clear, then confirm Clear. Create/name/save a plan, reload, Open it, and verify the same order and approximate distance. Try offline storage restoration; tile availability remains separate. Confirm no workout was created by planning.
4. **Activity Details:** Open an existing saved workout from Activities. Compare line shape/segments and statistics with the recording. Fit/Recenter, pan and zoom. Open a zero-GPS activity and confirm the empty message and absence of map requests. Verify another account's track stays unavailable; public visibility alone must not expose raw start/end points.
5. **Real devices:** On installed Android/iOS development builds, verify native map configuration, touch/pinch behavior, accepted-marker accuracy, follow suspension/recenter, pause gaps, replay, loading/retry and base-map attribution. Test permission denial and actual connectivity loss with existing data intact. Check background/lock-screen recording separately under the Phase 1A limitations.

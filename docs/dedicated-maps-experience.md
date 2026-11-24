# Dedicated Maps experience

## Navigation audit and result

| Before | Now |
| --- | --- |
| Home, Explore, Record, Events, Activities, Profile | **Home, Maps, Record, Events, Activities, Profile**. Six visible tabs, with Record in the same position. |
| Explore put discovery, saved routes and workouts in a scrolling page with an embedded map. | Maps opens directly on a Kathmandu-centered map. Route ideas → Open Explore opens the original screen. The Home link and `/explore` still work. |
| Explore and Route Studio linked to the saved-route library. | Maps has an immediate bookmark shortcut to `/saved-routes`. Its Saved panel can also select an individual route on the map or open the library. |
| `/routes` opens Route Studio, with a scoped `edit` parameter for making a copy. | Create route opens the same planner. Existing links, Edit a Copy and Follow Route continue to use their original destinations and parameters. |
| Record, Events, Activities, Profile and authentication had their own destinations. | Their routes stay in place. GPS collection, Manual Start, activity history, authentication and route sync use the existing implementations. |

## Maps and Route Studio

- Android uses the app’s MapLibre Native adapter and MapTiler Streets v2. One-finger pan, pinch zoom, two-finger rotation and double-tap zoom use the native gesture handlers. Floating buttons recenter once on request, reset north and fit the selected route. Late location fixes are ignored after a gesture, another camera action or leaving the tab. Location access is foreground-only and independent of recording.
- Search and its scrollable results overlay the map. The dock expands for Route ideas or Saved and collapses using the same control. A selected saved plan uses a high-contrast line and start/finish markers. Its preview provides Follow Route and Edit a Copy. Distance reflects stored straight-line geometry. The Saved panel filters distance and exposes measured elevation when the library contains reliable altitude pairs. Difficulty and surface are absent from the current data.
- Route ideas use existing running and cycling catalog entries. Selecting one shows its destination area. The Walking filter reports an empty result because the catalog has no walking entries. Hiking and trail-running editorial links remain in Explore. The catalog contains no verified route geometry, measured distances, difficulty, ascent or surface. No demonstration route is presented as public trail data.
- Create route opens the existing start/destination and crosshair workflow. Waypoint edits, undo, clear and straight-line saving use the existing editor. For new plans opened from Maps, the title, user-positioned waypoints and undo history survive a round trip to Maps during the current JS session. This draft is scoped to the current owner. It clears on reload and does not carry preview geometry. Fixture, synthetic and USB Valhalla previews stay in Route Studio under the existing development gates and remain read-only.
- Web uses the existing MapLibre GL JS renderer. iOS uses the app’s existing Apple Maps adapter. Android can render saved geometry on a local background when the configured Streets style is unavailable, with a retry when a native key is configured. Offline tiles and full offline address search are outside this implementation.

## Search and provider status

Maps searches bundled Kathmandu Valley landmarks and latitude/longitude pairs, saved titles from the current route library, and existing editorial idea titles or regions. The Places scope offers local suggestions and distinguishes invalid coordinates from a valid query with no matching landmark. Search changes cancel the previous debounce, outdated results are hidden, and selection dismisses the keyboard. Maps sends no search terms or coordinates to a geocoder.

The existing web Explore place finder is a separate, disclosed integration. MapTiler documents authenticated forward geocoding and autocomplete, with usage metering and app-specific key restrictions. The project’s actual geocoding entitlement, remaining quota, restrictions and commercial terms were unavailable. The Maps tab keeps geocoding offline. [Geocoding API](https://docs.maptiler.com/cloud/api/geocoding/) · [Usage metering](https://docs.maptiler.com/guides/account/sessions-vs-requests/) · [API key restrictions](https://docs.maptiler.com/guides/developer/credentials/api-key/) · [MapTiler Cloud terms](https://www.maptiler.com/terms/cloud/)

The dedicated map offers the project’s existing Streets v2 basemap. It retains MapTiler and OpenStreetMap credits and uses the existing restricted Android key and User-Agent setup. Web retains source attribution and the MapTiler logo when configured. Terrain, satellite and new sources were left out pending product and licensing decisions. [Android provider configuration](android-maplibre-testing.md) · [MapTiler attribution guide](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/)

## Layout and performance

The map uses the space between the system bars, dock and existing tab bar. Controls use compact 44–48 dp minimum targets, existing theme tokens, safe-area offsets and wrapping labels. Search results are bounded by the measured map height, and the dock collapses to return space to the map.

The Explore map’s embedded layout recomputes its fit when selected geometry changes and presents more overlay data than the map-first screen needs. The new Android canvas is memoized, renders only the selected route and pin, and uses statically initialized camera state. Search text and panel state do not replace the map style or drive camera frames through React. The configured Streets style loads once through the existing cache before the dedicated native canvas mounts. Native gestures change the camera directly. These are code-level findings and design changes. Actual frame pacing and tile latency require measurement on the OnePlus 5T.

## Tests and build

- `npm.cmd run typecheck`, `npm.cmd run lint` and `npm.cmd test` passed. Vitest ran 361 tests, including the existing Record, Follow Route, account scope, development gating and routing persistence regressions.
- Dedicated tests cover offline search, cancellation, activity, distance and elevation filters, account-scoped layer data, native gesture configuration and camera event forwarding.
- Ten focused Playwright checks passed. They cover six-tab navigation at three widths in light and dark themes, legacy Explore access, the dock, saved-route library, Route Studio, draft restoration, camera commands, saved geometry and existing recording regressions. Map behavior was checked with an isolated browser adapter.
- Android JavaScript and web bundle exports passed using fixture configuration.
- The current matching Android MapLibre development APK needs a **Metro reload only**. The change adds no dependency, native setting or permission. Do not replace the APK or erase application data for this validation.

## OnePlus 5T acceptance

The verified baseline records all 10 physical Dedicated Maps acceptance checks passing on a OnePlus 5T. The steps below can be used to repeat device validation.

1. Start Metro with `npx.cmd expo start --dev-client`. Reload the existing APK with its authorized Android MapTiler configuration. Open Maps from Home. Confirm the six tabs, Kathmandu street labels, tappable provider attribution, and visible system navigation.
2. Pan with one finger, pinch in and out, rotate with two fingers and double-tap zoom. Repeat while a results panel is open and after returning from another tab. Verify that closing search, filtering and switching tabs preserve the camera. Rotate and reset north. Observe frame pacing with cold and warm tiles.
3. Tap My location. Test both permission outcomes, disabled location, and panning while a fix is pending. Check that a late fix never overrides the pan and that changing map position creates no activity.
4. Search for `Thamel`, `27.7043, 85.3076`, `91, 85` and `New Road`. Check suggestions, marker placement, coordinate validation and the local coverage message. Switch to Saved and Ideas, and type quickly to check stale results. Repeat with the keyboard up, enlarged fonts and TalkBack. Use Back to dismiss the keyboard and close the search or panel.
5. Open Saved, filter by distance and select an existing straight-line plan. Check start, finish, Fit map to route, preview and Edit a Copy. Reopen the plan offline, then check Follow Route → Record and Manual Start. With separate test accounts, confirm account routes are isolated and the existing offline/local library still opens.
6. Open Create route, set and confirm Start and Destination, edit a waypoint, undo, clear and undo. Back out to Maps and reopen the draft. Save a named straight-line test plan and reopen it. With the existing authorized USB setup available, verify the fixture and live previews only appear under the development gates and never offer geometry saving.
7. Open original Explore, Events, Activities and Profile. Exercise Record and activity history with disposable test activity data. Repeat the previous [Android repair acceptance checks](android-ui-regression-repair.md) on the phone.

## Commercial-release blockers

- Measure map frame pacing and tile load failures, and validate a release build before distribution.
- Verify MapTiler account entitlements, production quota, key restrictions, attribution and commercial terms. Online geocoding or additional styles need separate approval and verified Nepal coverage.
- Keep public routing limited to straight-line plans and clearly labeled editorial ideas until production routing rights, trail/road access, geometry provenance and verification are established. Development preview data remains outside saved routes and sync.

## Files changed

| Area | Files |
| --- | --- |
| Navigation and editor | `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/maps.tsx`, `src/app/routes.tsx` |
| Dedicated UI | `components/maps/MapsScreen.tsx`, `components/maps/MapsCanvas.tsx`, `components/maps/MapsCanvas.web.tsx` |
| Existing map adapters | `components/maps/NativeMap.android.tsx`, `components/maps/NativeMap.tsx`, `components/DiscoveryMap.web.tsx` |
| Map and search data | `features/maps/dedicated.ts`, `features/maps/dedicated-canvas.ts`, `features/maps/native-types.ts`, `features/discovery/map-data.ts`, `features/discovery/maplibre.web.ts`, `features/routes/waypoint-placement.ts` |
| Regression coverage | `tests/dedicated-maps.test.ts`, `tests/maplibre-native-adapter.test.ts`, `tests/live-route-studio.test.ts`, `tests/browser/dedicated-maps.spec.ts`, `tests/browser/bottom-navigation.spec.ts`, `tests/fixtures/maplibre-adapter.js` |
| Handover | `docs/dedicated-maps-experience.md` |

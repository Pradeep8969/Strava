# Explore interactive maps

Inspection: Expo SDK 58, React Native 0.88, TypeScript 6, `react-native-maps` 1.29.11, `expo-location`/`expo-task-manager`, SQLite, Zustand, Vitest and Playwright were already present. MapLibre was not installed. Explore's web SVG was the schematic replaced here; native DiscoveryMap already used react-native-maps. TrackMap and RecorderMap keep their existing platform implementations. `services/recorder.ts` still owns foreground/background fixes, accuracy filtering, pause/resume and persistence; it was not modified. Route studio stores waypoint plans under the local `routes` key, while finished workouts retain TrackPoint geometry and segments in the workout store.

Explore uses MapLibre GL JS 5.6.2 on web, loaded only when a configured map mounts. Its pinned JS/CSS are served by unpkg; installation via `npx.cmd expo install maplibre-gl` was attempted but blocked by this workspace's network policy. No dependency or lockfile edits were made. For self-hosted environments, vendor these exact distribution assets and update `features/discovery/maplibre.web.ts`. The loader has an error/timeout fallback and permits retry. MapLibre is BSD-3-Clause; retain its license when vendoring.

## Configuration

- `EXPO_PUBLIC_MAPTILER_KEY`: public browser MapTiler Cloud key. Streets v2 is the default OSM-based map; Outdoor v2 provides a terrain-focused cartographic style (not invented elevation or a 3D elevation model). Enable these maps and geocoding on your chosen account/plan. No key means an explicit configuration fallback, not a schematic.
- `EXPO_PUBLIC_MAP_DEVELOPMENT=true`: explicitly permits the MapLibre demo style ONLY on localhost/127.0.0.1/::1, when there is no MapTiler key. This low-detail demo is for local testing, never a production provider. It has no outdoor style or geocoding.
- `EXPO_PUBLIC_GOOGLE_MAPS_KEY`: existing Android native map configuration, unchanged. Restrict in Google Cloud to the Android package and signing certificate and Maps SDK for Android. iOS retains its existing Apple map provider. Never put private service tokens in EXPO_PUBLIC variables.

Set variables in your local Expo environment and restart/re-export web. Never commit actual credentials. Create distinct development, staging and production MapTiler keys; configure Allowed HTTP origins to only the intended production domains. Do not allow localhost or wildcard origins on production keys. These restrictions must be configured in the provider account; source code cannot enforce them. Native apps do not use the browser MapTiler key.

MapTiler usage is metered: MapLibre requests tiles/styles/fonts and each place search uses geocoding quota. Limits, commercial rights, overage billing and suspension depend on your active plan, not this application. Check the account dashboard and current [pricing](https://www.maptiler.com/cloud/pricing/) before release; configure budget alerts and monitor request usage. There is no unlimited/free production assumption. Search is debounced 500ms, cancelled on change and restricted to Nepal. Map instances persist through route, city, theme and layout changes; style toggles fetch a different style. No tile prefetch or offline bulk downloader exists. Never bulk download public OSM tiles.

Attribution stays visible through MapLibre's expanded attribution control and includes MapTiler and OpenStreetMap links in production, in addition to source-provided attribution. Do not hide it with CSS. See [data licensing](https://www.maptiler.com/copyright/), [API key restrictions](https://docs.maptiler.com/guides/developer/credentials/api-key/), [maps API](https://docs.maptiler.com/cloud/api/maps/) and [geocoding](https://docs.maptiler.com/cloud/api/geocoding/). MapTiler's terms and your subscription govern production use; check any additional source attribution in a replacement style.

## Data and privacy

Shared `MapRoute` geometry supports saved straight-line waypoint plans and existing local finished workouts. GPS lines preserve pauses, time gaps and invalid-fix breaks. Existing account ownership checks apply to workouts; nothing is fetched from other users or published. Private local routes remain local. Route coordinates are passed to a client-side GeoJSON source, never a geocoding or upload endpoint. The tile provider necessarily sees requested map areas and client IP; centering on location causes viewport tile requests. My location uses browser geolocation only after a button press, never watches or records location. Search sends the typed place name to MapTiler and does not include current GPS coordinates. No reverse geocoding or automatic sharing is performed.

The existing browser database is an in-memory preview with no recorded workouts; this change does not pretend it can read native SQLite. Any saved plans available through its existing `routes` key can appear on Explore. Web Route studio remains its existing native-map preview; waypoint creation there still requires the native app. Native SQLite, recording, background GPS, TrackMap, RecorderMap and Route studio are preserved. Real native-device behavior must still be checked on signed Android/iOS builds.

## Operations and verification

Allow HTTPS resources from unpkg.com, api.maptiler.com and their style resources in your CSP; MapLibre workers need blob worker support. For the opt-in development style, allow demotiles.maplibre.org. Restrictive CSP, unavailable WebGL, blocked CDN, missing keys, quota exhaustion and offline requests surface a readable fallback with retry. Cards, filters, city selection and Route studio remain usable. Map canvas supports keyboard arrows and +/-; marker and control buttons are keyboard focusable. Device location requires HTTPS or localhost.

Run `npm run typecheck`, `npm run lint`, `npm test`, `npx expo export --platform web`, then `npm run test:web`. Interactive browser tests use isolated provider responses; no fake GPS is shipped into application data. Live provider verification needs a valid restricted MapTiler key and internet access. No deployment is performed.

### Verification performed for this change

- TypeScript and ESLint passed; 84 unit tests passed, including isolated geometry, gaps and demo-style production-host rejection.
- Android, iOS and web Metro exports passed. This verifies bundle compatibility, not device permissions/rendering or GPS hardware.
- Browser fallback/Explore checks passed at 390 and 1440, light and dark. Explicit local-development adapter tests passed at both widths: geometry source updates, pause separation, inaccessible-account exclusion, empty filtering, location denial, and one map construction across city changes. The adapter is a test double, not evidence that external tiles render.
- Full browser regression run after export: 83 passed, 5 opt-in map checks skipped. The opt-in adapter checks (2 passed) and intentional CDN-failure check (1 passed) were also run separately. An earlier browser run overlapped an export replacing `dist` and failed; the completed-export regression run passed.
- The intentional CDN failure/recovery/navigation test passed. Real MapLibre canvas tests were attempted at both widths and failed because the external library did not load in this restricted environment. Live zoom/pan, MapTiler styles/geocoding, attribution appearance with real tiles and physical Android/iOS checks remain unverified. No provider key was supplied.

To reproduce the isolated adapter checks in PowerShell, with the preview server running:

```powershell
$env:EXPO_PUBLIC_MAP_DEVELOPMENT='true'
npx.cmd expo export --platform web
$env:MAP_ADAPTER_TEST='true'
npx.cmd playwright test maps-adapter.spec.ts
```

For external MapLibre checks use `MAP_LIVE_TEST=true` instead and run `maps-live.spec.ts` on an internet-enabled machine. Use a restricted MapTiler key instead of the demo switch to inspect detailed Kathmandu/Pokhara streets and the outdoor style. Default CI skips these opt-in configurations so it never silently uses a demo provider in production. After local testing, remove these temporary shell variables and export again for the normal configuration. Tests do not activate map services or create credentials.

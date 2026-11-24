# Android maps and APK testing

Prepared 2026-11-16. No EAS build, billing setup, account/key change, deployment, Supabase change, migration, commit or push was performed.

## Compatibility and implementation

Installed versions: Expo **58.0.25** (package range remains `~58.0.19`), React Native **0.88.1**, React **19.3.0**. The only added direct dependency is **`@maplibre/maplibre-react-native` 11.5.1**, pinned exactly. Existing dependency ranges were not upgraded.

[Official MapLibre requirements](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/) specify React Native >=0.80, the new architecture for v11, and Android API >=23. These requirements match this project's React Native version and architecture. [The official 11.5.1 release](https://github.com/maplibre/maplibre-react-native/releases/tag/v11.5.1) and installed v11 source/types were checked. This verifies the documented compatibility requirements and JavaScript API integration; Gradle compilation and physical-device compatibility still require the authorized build and device validation below.

[Expo setup](https://maplibre.org/maplibre-react-native/docs/setup/expo/) requires the plugin `@maplibre/maplibre-react-native` and a rebuilt native binary. Expo Go is unsupported. The plugin is registered in `app.config.ts`, using its default Android location engine (no Google Maps key or Google-specific MapLibre location engine). Generated `android/` and `ios/` folders were not created or edited.

Metro chooses `components/maps/NativeMap.android.tsx` on Android. It translates the shared screen API to the current v11 `Map`, `Camera`, `Marker`, `GeoJSONSource`, and `Layer` APIs:

| Screen | Android behavior |
| --- | --- |
| Explore | MapTiler streets-v2 base map, catalog markers, saved-route markers/selection, selected route colors and segmented geometry, recenter/fit, load failure/retry |
| GPS recording | Existing accepted GPS fixes only; segmented track, latest-fix marker, follow/pan/recenter, loading/failure/retry |
| Saved activity details | Stored track fit, replay marker, empty-track behavior |
| Route Studio | Tap to add numbered waypoints, straight-line geometry, fit and retry; existing undo/save/restore stays in the existing screen/services |

The existing small `RoutePreview` cards remain explicitly labeled sketches without a base map. No tile request is needed for those previews. Route Studio still does **not** provide road/trail routing, navigation, verified access or offline map downloads. Stored plans, workout points, segmentation, GPS permission/background-task logic and Supabase synchronization were not changed. No MapLibre location component or second GPS acquisition stream is enabled.

The Android adapter uses the same MapTiler `streets-v2` style URL builder as web. It does not send the browser key to native, use demo tiles, or require a Google Maps key. Camera coordinates use longitude/latitude order and degenerate bounds are padded. Native TextureView rendering allows map clipping and attribution overlays inside the existing rounded cards.

Web `.web.tsx` implementations and the web key handling remain unchanged. iOS keeps the existing `react-native-maps` default Apple Maps renderer and overlays. **Native build impact on iOS:** adding the official MapLibre plugin also registers its iOS integration and autolinks the unused MapLibre SDK, including the documented Podfile hook; an iOS binary would need rebuilding and validation, although no iOS screen switches renderers. `react-native-maps` remains installed for iOS. The optional legacy Google Maps plugin/environment entry is intentionally retained pending successful real-device validation of every Android screen; it is no longer an Android screen rendering prerequisite. Its later cleanup is a separate follow-up after that validation, not a reason to configure billing.

## MapTiler account checks before device testing

The [official credential guidance](https://docs.maptiler.com/guides/developer/credentials/api-key/) supports mobile/native applications. Restrictions differ by platform:

- Keep `EXPO_PUBLIC_MAPTILER_KEY` and its HTTP-origin restrictions for web unchanged.
- Set **`EXPO_PUBLIC_MAPTILER_ANDROID_KEY`** to a key in the existing MapTiler account that is appropriate for native app use. Do not put the value in Git, logs, screenshots or chat. No account/key settings were changed by this task.
- Native requests do not carry browser origins. Do not copy browser-only origin restrictions onto the Android key, and do not relax the web key. If a suitable native key does not already exist, configuring one in the existing account is a remaining user step; no new paid service is needed.
- For the native key, use Allowed User-Agent substring **`StravaKinda-Android/com.stravakinda.app/1.0`** and no browser-origin rule. MapTiler applies origin and User-Agent restrictions with AND logic when both are set. The package name or an Android signing certificate is not a substitute for MapTiler's documented User-Agent rule. This is a public-client restriction, not a secret credential or tamper-proof app attestation.
- The adapter sets that User-Agent through [MapLibre TransformRequestManager](https://maplibre.org/maplibre-react-native/docs/modules/transform-request-manager/) before mounting the map. A stable rule ID avoids accumulating duplicate rules across retries/maps. The URL match is restricted to `https://api.maptiler.com/`, including style, sprite, glyph, TileJSON and tile requests. Confirm it works for **all** resources on the phone; a style loading alone does not prove glyph/tile access. Additional/custom resource hosts would require their own verified configuration.
- Check Account/Analytics for the actual plan, remaining **tile/API request quota**, usage limits and any existing spending settings. All keys share the account quota. MapLibre is a third-party renderer: do not budget it as an unlimited MapTiler SDK JS map session; panning/zooming loads tiles. [MapTiler pricing](https://www.maptiler.com/cloud/pricing/) distinguishes sessions from third-party tile requests. No universal numeric quota is assumed because this account's plan was not accessible or verified. Do not upgrade the plan or enable paid overage for this task.
- The [Free plan](https://www.maptiler.com/cloud/pricing/) covers testing/prototypes and personal/noncommercial use, subject to its quota. Commercial distribution needs separate license review. No offline bulk downloads or tile mirroring were added.
- [MapTiler attribution requirements](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/) require MapTiler and OpenStreetMap credit links and the MapTiler logo on Free accounts. The Android map keeps native source attribution enabled and adds visible, tappable MapTiler-logo/copyright and OSM links. The official logo SVG is bundled with its rasterized Android-compatible PNG; source: `https://api.maptiler.com/resources/logo.svg`. Preserve any additional source-specific credits exposed by the style. See also [MapTiler terms](https://www.maptiler.com/terms/).

No real MapTiler key or live native tile access was validated in this task. Missing-key fallbacks continue to leave recording and local route data available. A restricted/invalid/exhausted key or offline connection should show map failure/retry without affecting recording; verify that on-device.

## Existing EAS project and APK profile

`app.config.ts` preserves the previous environment override/fallback and identifiers:

- Project: `@prade.ep/stravakinda`
- Project ID: `e6ddc1e7-87f1-4b85-85c9-d7eea4fff615`
- Android package and iOS bundle ID: `com.stravakinda.app`
- Scheme: `stravakinda`

`eas.json` already had `developmentClient: true`, `distribution: internal`, and `android.buildType: apk`; these remain. The development profile now explicitly selects `environment: development`. This is an installable **development APK**, requiring Metro for application JavaScript. The existing preview APK profile is unchanged.

Ignored local `.env` files are not a substitute for cloud build variables. Before the future build, set the native MapTiler public key and the app's existing public runtime variables in this project's EAS **development** environment. Keep the EAS project ID equal to the ID above if its override is present. Preserve existing Supabase public URL/anon-key values and OAuth settings; do not change the backend. A MapTiler public key is embedded in the app and is not a server secret; use plain-text or sensitive visibility appropriate for build-time public variables, not a server-only service token. See [Expo environment usage](https://docs.expo.dev/eas/environment-variables/usage/).

## Exact remaining APK steps — not executed

1. Complete the MapTiler account/key/quota checks above. Put the Android key in local `.env` and EAS development variables, without changing the web key. Ensure all existing required public app variables are available for the cloud build too.
2. From the repository directory, verify the existing account/project with the read-only commands:

   ```powershell
   npx.cmd eas-cli@latest whoami
   npx.cmd eas-cli@latest project:info
   ```

   Expect `prade.ep`, `@prade.ep/stravakinda` and the ID above. Do not run `eas init` or create another project if these disagree.
3. **Only after separately authorizing the build**, run:

   ```powershell
   npx.cmd eas-cli@latest build --platform android --profile development
   ```

   Use the existing project's Android signing credentials if available. This step uploads source and runs a native cloud build; it was not run here. Review the build log for native compilation/codegen issues. Do not treat a JavaScript export as a successful native build.
4. Open the completed build's APK download link on the Android phone. Download/install it, allowing installation from that browser if Android requests it. An emulator is not required. Alternatively, with USB debugging and adb already configured:

   ```powershell
   adb install -r .\StravaKinda-development.apk
   ```

   Replace the filename with the actual downloaded APK. If Android reports a signing mismatch, **stop**; do not uninstall the existing app or clear app storage, which could delete unsynced recordings. Resolve signing or preserve local data first.
5. Start Metro from this repository with the local native key configured:

   ```powershell
   npx.cmd expo start --dev-client --lan
   ```

   Keep the computer and phone on the same LAN, allow the Metro connection through the firewall if required, and open the development server from the installed development client. The APK's launcher is not Expo Go. The cloud build and local Metro environment must both use the intended public configuration. See [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) and [APK installation](https://docs.expo.dev/build-reference/apk/).
6. Complete the real-device matrix below before removing the retained optional Google Maps configuration. Rebuild after native dependency/plugin changes; changing a style/key in JavaScript alone does not install a native SDK.

## Separate Google OAuth review

The app currently uses **Supabase browser OAuth with PKCE**, not a Google native sign-in SDK: `services/auth.ts` calls `signInWithOAuth`, opens the provider URL with Expo Linking, and the callback exchanges the code. `features/auth/validation.ts` returns **`stravakinda://auth/callback`** for native; `src/app/auth/callback.tsx` is the existing callback route. These files/credentials were not changed.

The [Supabase Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google) requires the configured Google **web OAuth client's** authorized redirect URI to point to this Supabase project's HTTPS `/auth/v1/callback`. That provider callback and the app return URL are distinct. Verify, without changing credentials here, that Supabase's allowed redirect URLs include the exact native return URL `stravakinda://auth/callback`. See [native deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

For this browser-mediated flow, EAS signing/package/SHA-1 does not automatically configure Google OAuth, and putting a custom native scheme directly into the Google web client's authorized HTTPS redirect list is not the fix. An Android Google client bound to package/signing fingerprints would be a separate native-sign-in integration; none was introduced. The build registers the existing app scheme, but the provider settings, Supabase redirect allowlist, browser handoff, PKCE storage and callback exchange still need end-to-end device validation. No Google billing attempt or credential change is part of this work.

## Validation and remaining device matrix

Automated verification:

- `npx.cmd expo-doctor`: **20/20 passed**.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd test`: **44 test files / 245 tests passed**. Added Android adapter tests cover key isolation, scoped User-Agent, lifecycle/failure callbacks, tap translation, user gestures, camera fit/recenter, invalid/single/polar bounds, gap/paused-track geometry, marker callbacks and numbered children. Native screen regression tests cover Explore/recording/saved replay/Route Studio without a Google key; existing web, GPS and cloud synchronization unit tests remain in the full suite.
- `npx.cmd expo config --type introspect --json`: passed; only non-sensitive fields were printed. MapLibre plugin recognized; EAS project ID, package, bundle ID and scheme unchanged. No native directories generated.
- `npx.cmd expo export --platform android --output-dir artifacts/maplibre-android-export`: passed.
- `npx.cmd expo export --platform all --output-dir artifacts/maplibre-platform-export`: **Android, iOS and web passed**. A process-only dummy native MapTiler key was used for this export; it is not a working credential and no environment file was edited. Do not use these test export artifacts as a release.
- Platform bundle inspection: Android includes MapLibre native-view/adapter identifiers and no `AIRMap` view identifier; iOS includes the existing `AIRMap` renderer identifiers and no Android adapter; web excludes both native view implementations. `AIRMap` is the react-native-maps view family name, including Apple Maps on iOS; its presence there does not mean Google is selected on iOS. This checks JavaScript bundle selection, not native SDK packaging or rendering.
- Lockfile comparison: **zero existing dependency version changes**; only the MapLibre dependency tree was added.
- `git diff --check`: passed.

Tests use mocked native views and synthetic GPS fixtures; they do not establish native rendering, actual GPS accuracy, account restrictions or physical-device performance. Browser end-to-end tests and live-provider tests were not run in this task. Exports do not compile Gradle or CocoaPods. No APK exists from this task because the native build was explicitly deferred.

Before calling the migration device-verified, check all of the following on the installed APK:

- Explore tiles, labels, source credits/logo links, route marker selection and selected geometry; recenter, zoom/pan, tab changes, multiple maps and retry.
- Recording foreground permission grant/deny, accepted-fix marker, segmented track across pause/resume or lost GPS, pan stopping follow, follow/recenter restoring it. Lock/unlock and background recording should preserve the existing foreground-service behavior. Do not use private historical workouts as test fixtures.
- Saved route/activity details, replay cursor and fit; no route/no coordinates remain understandable. Existing sketch preview cards stay available without network.
- Route Studio tap placement, numbered markers, marker taps not adding accidental waypoints, straight lines, undo/clear confirmation, fit, local save/reopen. No road routing is implied.
- Airplane mode, denied map requests, exhausted quota (simulate safely rather than consuming it), returning online, retry and app restart. Recording and local data must survive tile failures. Native key User-Agent restrictions must work for styles, glyphs, sprites, TileJSON and tiles, while an unrelated User-Agent is denied.
- Existing OAuth callback handoff and PKCE completion; separately check route sync with a designated test account after returning online. No production mutations were performed during this task, so native end-to-end synchronization remains untested.
- Physical GPU rendering/clipping/overlays, touch targets, attribution readability, memory and frame behavior on the actual phone. iOS native compilation/runtime remains a separate check if an iOS binary is later requested.

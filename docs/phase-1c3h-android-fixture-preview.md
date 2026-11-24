# Phase 1C.3H — Android fixture preview

## Open the demo on Android

Go to **Explore → Open route builder** (the **+** beside **Discover routes**) **→ Route Studio → Preview Kathmandu Roads (Demo)**. The button is directly below the Route Studio heading and appears before the planning controls. **Back to planning** returns to the draft with its original name, waypoints, and planning mode.

The earlier synthetic demo uses React Native's `__DEV__` gate and requires choosing the road-following tab and adding at least two waypoints before a preview appears. The fixture demo uses the documented development JavaScript bundle flag plus the Android platform check. Its separate button opens a populated sample immediately, with no draft or map key required. The flag comes from the bundle mode, so an installed APK alone does not determine visibility. Production bundles, iOS and web have no fixture entry or fixture screen. There is no separate flag or deep link. The cause of the earlier physical-device visibility issue remains unverified. [React Native development global](https://reactnative.dev/docs/global-__DEV__)

## What to expect

The six samples are Kathmandu walking, Kathmandu cycling from Durbar Square, Patan walking, Bhaktapur walking, a Kathmandu multi-waypoint walk via Asan, and the Swayambhu steps walk. They use sanitized Valhalla 3.8.3 responses from the [local pilot](phase-1c3-kathmandu-pilot.md#phase-1c3f-local-routing-validation). The shared [Valhalla decoder](../features/routes/valhalla-routing.ts) validates the response and converts polyline6 to map coordinates. Changing samples immediately replaces the shape and fits the map to the route and requested pins.

The map shows the decoded line, orange requested Start, Finish and intermediate markers, and a separate teal snap dot when a point is over 25 m away. Travel mode, distance, and estimated duration appear below the map. The screenshot comparison to use for Kathmandu cycling is the requested Durbar Square pin and a separate route start about 63 m away, with advice to pick a bicycle-accessible road. Walking from Kathmandu Durbar Square shows a caution at about 36 m. Thresholds are normal through 25 m, caution over 25 m through 50 m, and large over 50 m. The original pins remain in place.

Fixtures load synchronously. There is no pending fixture request to cancel. Only the currently selected fixture renders, and closing the preview discards the sample selection. Invalid fixture data clears the map and shows a friendly error with the same route back to planning. The existing asynchronous preview/controller tests cover cancellation and late results.

## Physical-phone verification

Use the existing Android development APK with the required native MapLibre module. From the checkout root, start a development Metro session:

```powershell
npx expo start --dev-client
```

Open that Metro server in the installed development client and fully reload JavaScript. Metro reload is sufficient for this change because the implementation and fixtures are JavaScript assets and use the existing native map stack. If the installed app cannot connect to Metro or lacks the project's native modules, verify that it is the matching development client. A new native APK is needed only if the installed client is absent or incompatible. A release-style bundle with development mode disabled will hide the button. [Using an installed Expo development build](https://docs.expo.dev/develop/development-builds/use-development-builds/)

1. In Route Studio, create an unsaved draft with at least two waypoints and a recognizable name. Open the fixture demo from the button near the heading.
2. Confirm the first route appears without placing any points. Swipe the sample selector to reach all six options. Verify auto-fit and street-following bends, the Asan intermediate waypoint, and the Swayambhu stair alignment. If the basemap is unavailable, confirm the route and markers still appear on the geometry-only map.
3. Choose Kathmandu cycling. Verify the requested start and offset snap dot remain distinct and the 63 m warning is visible. Confirm ordinary snaps do not add extra markers.
4. Switch rapidly across cities and repeat the same selection. Only the selected route should remain visible. Tap **Back to planning** and check that the unsaved draft is intact. Reopen the demo and confirm that it starts on Kathmandu walking.
5. Confirm the saved-route list stays unchanged and the demo offers no Save or Follow Route action. Verify the ordinary planner and existing saved-route actions after exiting. Confirm the fixture button is absent during the next normal production-build check.

Automated checks cover platform and development-mode gating, all fixture geometry, map props, marker separation, warnings, rapid selection, malformed results, and the read-only demo controls. The captured shapes and estimates represent particular routes in the pilot snapshot. They do not provide live routing, current access checks, or navigation. Basemap tiles can still require an existing map key and network access. No demo geometry is saved locally or remotely. Physical Android rendering and launcher visibility still need the checklist above.

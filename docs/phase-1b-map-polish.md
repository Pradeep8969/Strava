# Phase 1B.5 map refinement

## Baseline and findings before edits

The pre-existing working-tree status and SHA-256 hashes are recorded in `artifacts/phase1b5/baseline-working-tree.json`. Earlier Phase 1A/1B work remains uncommitted; this phase extends it without reset/stash/revert. Before screenshots and browser measurements are in `artifacts/phase1b5/before/`.

- Record Recenter was disabled unless an accepted workout point existed. Its tracking handler only read that point and otherwise returned without feedback. An 80 m desktop fix cannot pass the unchanged 35 m recording rule, so it supplies no recording target. The generic map-only location path was hidden in recording mode.
- Style loading listened to `load` and `style.load` only. MapLibre 5.6.2 defaults to a style-diff path that can complete via style/data events without emitting another `style.load`. The existing style-switch banner therefore has no guaranteed completion or timeout path.
- The combined geometry/marker effect removes all markers and recreates them for every waypoint and selection update. Initial `load` and `style.load` can also trigger duplicate setup. ResizeObserver calls resize immediately for every notification. The map is already instance-stable during normal selection, so a wholesale map replacement is unwarranted.
- Record stacks large distance and pace metrics vertically beside a short, crowded map. Its map uses light app chrome inside a dark screen and repeats a route sketch and instructions. Explore repeats a large sketch below an already drawn route. Route Studio separates summary/name/save and repeats routing limitations. Details uses the same overfull general-purpose toolbar, including irrelevant destination markers.

## Root causes and fixes

### Recenter and location isolation

Recenter now issues an imperative camera move instead of relying on a follow-state transition to cause movement. It stops an in-progress camera animation, prioritizes the latest accepted workout point, and enables following only for accepted workout GPS. If no accepted point exists, it can use a separate browser fix for **map-only** positioning. Validity includes finite in-range coordinates, a finite nonnegative accuracy, a timestamp within 60 seconds, and no timestamp more than 1 second ahead. This deliberately differs from the unchanged 35 m/15-second recording acquisition gate.

Map-only fixes live in a component ref and use a separate blue marker and explicit accuracy message. They never enter a workout, recorder, distance/pace calculation, or persistence API. Recenter can reuse a recent map-only fix; requests in progress are deduplicated. If accepted GPS arrives during a map-only request, the callback prioritizes accepted GPS. Permission denial, timeout, unsupported location, stale/invalid data and unavailable services produce feedback instead of a silent no-op. No default-city fallback is described as the user's position.

Manual movement disables follow without recentering; Follow explicitly resumes accepted-GPS tracking. Recenter remains enabled on a ready web map even when no workout has started. Follow stays disabled until an accepted point exists. Accepted and approximate markers have distinct accessible names. The live test verifies `getCenter()` and projects the target within **2 pixels** of the viewport center; it also verifies that recentering an accepted track makes no extra GPS request.

### Style loading and geometry readiness

The loading banner was a real reproduced lifecycle bug, not just excess copy: at 390, 768 and 1440 px the original map reported `isStyleLoaded() === true` while `Loading map style` remained visible. The [pinned MapLibre 5.6.2 source](https://github.com/maplibre/maplibre-gl-js/blob/v5.6.2/src/ui/map.ts) shows the default style-diff path; a successful diff need not produce a second `style.load` event.

The adapter now observes style/data/source/idle events, coalesces readiness checks to an animation frame, and publishes readiness once per style request. The style transform callback identifies when the requested style was actually applied, so old-map events cannot prematurely clear a new style request. Initial and switched styles have timeout/retry feedback. Provider errors remain visible rather than being cleared merely because tiles or an old style remain visible. Disposed-map callbacks cannot mark a replacement map as failed. Loading/error overlays do not capture map pan gestures; Retry remains interactive.

A second correctness issue was found in the geometry update guard: `isStyleLoaded()` also becomes false while an existing GeoJSON worker is busy. Using it to gate every `setData()` can silently drop a new edit. Existing sources now queue their latest data while the worker is busy; actual style transitions still gate updates and replay the latest geometry on readiness. A regression test forces this busy-source condition.

### Measured rendering work

- Markers are reconciled by stable route/waypoint IDs. Adding a point creates that marker, moving one updates its position, and Undo/Clear removes only missing markers. Selection updates existing marker styles and layer paint instead of uploading the whole route again.
- Route GeoJSON is memoized by geometry. Source and layer creation are retained across normal edits; a style replacement restores them once. Initial load/style notifications no longer cause duplicate setup.
- Resize notifications are coalesced to a frame and unchanged sizes are ignored. The measured resize count was already small; this is not claimed as the principal speed gain.
- Record's timer now reuses measured geometry statistics instead of traversing the whole track every second. Active/elapsed time still use the existing timing functions and formulas. No workout calculation algorithm, threshold, ordering or storage format changed.
- The map instance was already stable during ordinary pan/selection. It remains stable; it was not replaced to address lag.

## Measurements

`scripts/map-polish-review.mjs` instruments the actual pinned library in an isolated Edge browser context. JSON records live in `artifacts/phase1b5/before/measurements.json` and `artifacts/phase1b5/after/measurements.json`. `readyMs` is navigation-to-MapLibre-`load`, a useful startup proxy, **not** a complete interaction/FPS benchmark. The 20-point workload batches the first three points, then adds 17 individually.

| Work observed | Before | After |
| --- | ---: | ---: |
| Marker constructions for 20 waypoint edits, each tested width | 207 | 20 |
| Explore marker constructions through route selection | 14 | 7 |
| Activity Details markers, including irrelevant destination anchors | 6 | 1 route marker |
| Explore geometry writes caused by selection | 1 | 0 |
| Map instances per screen | 1 | 1 |
| Route source/layer additions before style switching | 1 / 1 | 1 / 1 |
| 20-point workload geometry updates | 18 | 18 |
| Loaded style with a stale loading banner after switch | 3 of 3 widths | 0 of 3 widths |
| Horizontal document overflow in the 12 main screen/width captures | None | None |

The marker construction reduction is approximately **90%** for that workload. That is a reduction in rendering work, not a claim that every interaction is 90% faster.

Desktop navigation-to-load samples were Explore **868 → 857 ms**, Record **725 → 717 ms**, Studio **627 → 685 ms**, Details **893 → 685 ms**. Across all after captures the range was **606–1695 ms**. CDN/cache/tile/network and scheduling variation affect these single-run samples; there is no reliable evidence here for a broad startup-speed improvement. Resource durations and long-task samples are retained in the JSON, but sustained FPS, low-end-device CPU and memory were not benchmarked. Provider/CDN delays remain external costs.

## Layout refinements

- **Shared web maps:** consistent 44 px primary/zoom targets, rounded containers, focus outlines, accessible control names, a single primary toolbar row, and an explicit Options disclosure for style/place search. Attribution and the existing MapTiler logo remain visible. Map canvases reserve their height while loading. The existing light/dark tokens remain; Record explicitly uses dark map chrome.
- **Record:** larger map, narrower metric column, side-by-side distance/pace, compact geometry metrics, stronger Start/Pause/Resume and Finish presentation, readable acquisition text, and a GPS status visible in mobile Map mode. The repeated sketch and duplicate instructions were removed; foreground/storage safety guidance remains. Sport selection, permissions, controls, background option, confirmed discard and save behavior are preserved.
- **Explore:** the desktop map column is wider and mobile/tablet map height is increased. Nepal inspiration cards/images remain. Selected details are a compact distance/type/count summary rather than another large sketch. Saved-route selection styling and all destination/route actions remain. The removed sketch assertion was replaced with an exact assertion that its waypoint geometry is drawn on the interactive map.
- **Route Studio:** map and Fit/Undo/Clear form one workspace; the summary/name/save card sits beside it on desktop and below on narrow screens. The routing warning appears once, with straight-line labeling and unverified trails/terrain still explicit. Empty-plan disabled states, numbering, distance, confirmation/cancel, offline save and restoration remain.
- **Activity Details:** map and statistics sit side by side on desktop and stack on smaller screens. The irrelevant destination anchors and crowded default toolbar are gone. The web-disabled replay button is omitted; native replay remains. Empty tracks show a contained empty state without initializing a map. Ownership/privacy checks and statistics are unchanged.

## Visual review and artifacts

No new screenshot attachments were supplied in this turn; the user's described observations guided inspection. Before/after captures use the current app with isolated, explicitly test-only data and real MapTiler tiles. They are not production recordings or verified routes.

All four screens were captured and visually inspected at **390, 768 and 1440 px**, including empty and three-waypoint Studio states. This provides 15 before and 15 after screenshots. Captures are 1080 px tall; the app's internal ScrollViews remain scrollable. Some baseline Explore captures were scrolled to the selected route; final captures include the map header. Final Details captures wait for loaded route sources and camera stability to avoid mistaking partial asynchronous drawing for final geometry.

| Screen | Before examples | After examples |
| --- | --- | --- |
| Record | [desktop](../artifacts/phase1b5/before/record-1440.png) | [mobile](../artifacts/phase1b5/after/record-390.png), [tablet](../artifacts/phase1b5/after/record-768.png), [desktop](../artifacts/phase1b5/after/record-1440.png) |
| Explore | [desktop](../artifacts/phase1b5/before/explore-1440.png) | [mobile](../artifacts/phase1b5/after/explore-390.png), [tablet](../artifacts/phase1b5/after/explore-768.png), [desktop](../artifacts/phase1b5/after/explore-1440.png) |
| Studio | [desktop](../artifacts/phase1b5/before/studio-1440.png) | [mobile empty](../artifacts/phase1b5/after/studio-390.png), [mobile waypoints](../artifacts/phase1b5/after/studio-waypoints-390.png), [tablet waypoints](../artifacts/phase1b5/after/studio-waypoints-768.png), [desktop waypoints](../artifacts/phase1b5/after/studio-waypoints-1440.png) |
| Details | [desktop](../artifacts/phase1b5/before/activity-1440.png) | [mobile](../artifacts/phase1b5/after/activity-390.png), [tablet](../artifacts/phase1b5/after/activity-768.png), [desktop](../artifacts/phase1b5/after/activity-1440.png) |

Review found no horizontal overflow, clipped primary controls, overlapping cards, or obstructed attribution. Record/Explore retain six visible tabs. Studio/Details remain existing stack screens, with their normal back navigation. Below-fold saved routes/forms intentionally require scrolling. Native device layouts and platform font differences still require device review.

## Tests and results

- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`: passed; **36 unit files / 200 tests**.
- Configured-map Playwright: **33 passed / 2 mode-specific skips**. Includes the unchanged Phase 1A recording suite and existing planner/map/Details/privacy checks, plus new approximate/no-location recenter, cache/request isolation, style-diff readiness, marker reuse, busy-source updates and retry cleanup/stale-event tests.
- Live MapLibre/MapTiler Playwright: **4 passed**. Real camera movement, manual pan/follow, accepted-GPS priority and no redundant request are checked at all three widths, including a 2 px projection tolerance. A real mouse/touch Studio test checks waypoints, Fit and style-switch completion. These tests required network access outside the sandbox, as in Phase 1B.
- Web, Android and iOS Expo exports passed. Native exports validate bundling, not installed-device behavior.
- `git diff --check`: passed. No final unresolved unit/type/lint failure was found. Missing-key-mode tests were not rerun in this phase; the configured run's legacy live-only and missing-key cases were skipped by their existing guards.

Intermediate regression findings were corrected rather than weakening meaningful assertions: mobile Map mode lacked the exact GPS status displayed in Metrics mode; the compact footer initially hid empty-route feedback after a permission error; both are restored. One preview request returned 404 because I rebuilt the export during a test run; tests were rerun against a stable export. Existing Explore tests now assert actual map geometry instead of the intentionally removed duplicate sketch, and open Options before testing the relocated style control.

## Exact phase files

Existing files extended in this phase:

1. `components/DiscoveryMap.web.tsx`
2. `components/PlannerMap.web.tsx`
3. `components/RecorderMap.web.tsx`
4. `components/TrackMap.web.tsx`
5. `features/discovery/map-data.ts`
6. `features/discovery/maplibre.web.ts`
7. `src/app/(tabs)/explore.tsx`
8. `src/app/(tabs)/record.tsx`
9. `src/app/routes.tsx`
10. `src/app/activity/[id].tsx`
11. `tests/browser/premium-maps.spec.ts`
12. `tests/fixtures/maplibre-adapter.js`

New files:

- `features/discovery/map-location.ts`
- `features/discovery/map-markers.web.ts`
- `tests/map-polish.test.ts`
- `tests/browser/map-polish.spec.ts`
- `tests/browser/map-polish-live.spec.ts`
- `scripts/map-polish-review.mjs`
- `docs/phase-1b-map-polish.md`
- `artifacts/phase1b5/`: working-tree baseline, preservation audit, measurement JSON and before/after screenshots.

The preservation audit distinguishes these extensions from older uncommitted work. Recorder services, acquisition diagnostics and thresholds, tracking calculations, storage/planned-route services and formats, privacy access helpers, native map adapters, earlier reports/tests not listed above, and existing screenshot artifacts remain unchanged. No source work was reset, stashed or discarded. No auth, credential, dependency, migration, hosted data, tab or provider changes were made. Nothing was committed, pushed or deployed.

## Remaining limitations and manual checks

- Map-only fallback is implemented for web. Native maps retain their accepted-point Recenter behavior and existing configuration limits; no new native provider or dependency was added.
- Test installed Android/iOS builds for tablet sizing, text/font scaling, touch/pinch behavior, follow/recenter, native readiness/retry, real GPS and background/lock-screen restrictions. This phase does not establish reliable background recording.
- Browser recording still requires an actual fix within 35 m and remains foreground-only. A desktop can recenter approximately while still being unable to record. Test real browser/Windows permission prompts and actual GPS accuracy; automated GPS inputs are isolated fixtures.
- Road-following routing remains unavailable. Waypoint distances are approximate; roads, trails, terrain, access and safety are not verified. Offline storage preserves geometry, not downloaded base-map tiles.
- Other-account raw GPS stays inaccessible. No shared-route redaction endpoint or new privacy behavior was introduced; owners retain their existing local route access.
- Manually try Recenter before Start on the affected desktop; it should show approximate accuracy or a useful location error. Start must still wait if accuracy is about 80 m. With an accepted track, pan, confirm follow stops, and Recenter to the accepted point. Switch street/outdoor styles and confirm the loading message clears without a camera jump. Add/undo/clear/save/reopen a plan and inspect an existing/private/empty activity at phone, tablet and desktop sizes. Verify light/dark app themes and text scaling on your devices.

Phase 1B.5 stops here; no Phase 2 work was started.

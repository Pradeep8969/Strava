# Phase 1A recording reliability

## Existing implementation inspected

- `src/app/(tabs)/record.tsx` already has sport selection, GPS acquisition status, timer, metrics, Start/Pause/Resume, Finish, and confirmed Discard on web and native. `useAction` prevents repeated UI submissions.
- `services/recorder.web.ts` already uses actual browser Geolocation, requests permission on Start/Resume, rejects insecure origins and unsupported browsers, and explains permission denial, timeout, unavailable GPS, inaccurate fixes, and unavailable storage. It pauses on hidden pages, pagehide, GPS errors, and loss of valid readings. It recovers reloads at the last saved evidence. There is no native-only recording restriction to remove.
- `services/recorder.ts` already uses Expo Location foreground subscriptions and an Expo TaskManager background task, optional background permission requests, and AppState handling. `app.config.ts` already enables the location background modes and Android foreground service through the Expo plugin.
- `utils/tracking.ts` already filters accuracy, invalid coordinates, non-increasing timestamps, sport-specific implausible speeds, and stationary jitter. Pause/Resume separates route segments. Distance and moving pace omit paused connections and GPS gaps longer than 60 seconds. Zero distance has no pace. Active time excludes pauses; elapsed time includes pauses.
- Existing SQLite (native) and IndexedDB (web) storage upsert by workout ID. No new schema or data migration is needed. The shared store refreshes after writes. Activities and Profile filter completed, account-accessible workouts; Activity Details reads the same stored workout and statistics.
- Web RecorderMap uses existing DiscoveryMap/MapLibre configuration and a recorded-route preview. Native RecorderMap delegates to the existing react-native-maps TrackMap. Neither map rendering nor tile availability is required to save GPS.

## Defects fixed

- Native service commands were not serialized, so simultaneous starts could pass the unfinished-workout check. Commands now queue, and creation rechecks inside the existing storage queue.
- Native callbacks from replaced subscriptions could still write to a resumed recording. Subscription generations now reject those callbacks, including callbacks already waiting for storage.
- Native foreground GPS errors had no handler. Errors now stop that subscription, pause at saved evidence, and explain how to retry. GPS save failures also freeze the visible timer and give a storage error. A retained interruption cutoff prevents subsequent Pause/Finish from counting the stopped interval if the pause could not be persisted.
- Native Resume now validates state, rechecks permission and location services, and detaches its watcher if setup or saving fails. Completed activities cannot be resumed or discarded through the recording service.
- Repeated native Finish previously changed the saved end time. Finish is now idempotent. Finished workouts also bypass native auto-pause processing.
- Both platforms previously stopped GPS before attempting Finish persistence; web also did this for Pause. A failed write could leave a recording marked active with no watcher. These operations now save before stopping, so a failed save remains retryable with the watcher attached.
- Native recovery leaves an already attached session alone and checks recovery again on returning to the foreground.
- Shared point validation now rejects future timestamps and fixes captured before the latest Resume, protecting route order and paused-time calculations.
- The Record screen previously stopped refreshing wall-clock elapsed time while paused. It now keeps refreshing for the unfinished session; active time still stays frozen.

## Exact source files changed

1. `services/recorder.ts`
2. `services/recorder.web.ts`
3. `utils/tracking.ts`
4. `src/app/(tabs)/record.tsx`
5. `tests/recorder-native.test.ts`
6. `tests/recorder-web.test.ts`
7. `tests/tracking.test.ts`
8. `tests/browser/recording.spec.ts`
9. `docs/phase-1a-recording-reliability.md` (this report)

Authentication, Supabase migrations, production data, credentials, storage formats, six-tab navigation, profiles, clubs, events, social features, and map configuration were not changed. No dependencies were installed, and nothing was committed, pushed, or deployed.

## Validation

- Baseline: all 32 unit test files / 163 tests passed.
- Final `npm.cmd run check`: TypeScript, ESLint, and all 32 unit test files / 173 tests passed.
- Recording Playwright suite in Edge/Chromium: 6 passed, 1 skipped. Covers mobile and desktop recording, pause/resume, real IndexedDB writes, activity history, reload, Profile statistics, Activity Details, permission denial, unsupported geolocation, GPS failure, recovery, confirmed discard, cancelled discard, and in-app navigation.
- The configured-map adapter test was skipped by its existing environment guard (`MAP_ADAPTER_TEST`); live MapTiler tiles were not verified.
- Web, Android, and iOS Expo exports passed. These verify bundling, not an installed native app. Browser GPS fixtures are confined to tests; production uses actual location providers.
- The first extended browser run exposed an ambiguous test locator on Details (the same title appears in its heading and editor). The assertion now targets the heading. An intermediate lint error from a synchronous state update was corrected; final lint passes. No unrelated unit/type/lint failures were found.
- PowerShell blocks `npm.ps1` under the existing execution policy; commands ran through `npm.cmd`/`npx.cmd` without changing that policy. Windows error 1909 did not occur.

## Physical-device verification and limitations

- Test real Android and iOS permission prompts, denial/revocation, disabled location services, first GPS acquisition, outdoor movement, stationary drift, pause/move/resume, zero-distance finish, storage pressure, and process interruption. Compare durations and routes in Activities, Profile, and Details after reopening the app.
- Background configuration and task code exist, but that does not prove lock-screen reliability. Use an installed development build with the existing native configuration and background permission, then test screen locking, foreground/background transitions, Android battery restrictions, and iOS behavior. Expo Go and exported JavaScript bundles do not establish background support. Force termination can stop tracking. See the SDK 58 [Location documentation](https://docs.expo.dev/versions/v58.0.0/sdk/location/).
- Browser recording remains foreground-only. Test physical browser GPS and real permission prompts over HTTPS or localhost, including Safari on iOS and Chrome on Android. Automated browser coverage here uses Edge/Chromium with explicit GPS fixtures.
- Duplicate commands are protected within one running app instance. Cross-tab mutual exclusion is not implemented; avoid simultaneous recording in multiple browser tabs. IndexedDB checks are not a cross-tab transaction lock.
- Native silent GPS loss still displays Waiting for GPS rather than using the web watchdog. Active time can continue without fixes; moving distance/pace require accepted GPS evidence. Background task errors retain the existing persisted diagnostic path and need device validation.
- A storage failure cannot guarantee persistence of its pause or newest GPS samples. Previously saved data remains recoverable; retry after resolving storage problems. Browser page termination can prevent asynchronous pause writes, so reload recovery uses the last persisted evidence.
- No cloud upload, production authentication, real native build installation, or outdoor GPS accuracy was verified during these local checks.

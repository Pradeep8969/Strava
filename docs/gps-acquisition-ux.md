# Phase 1A follow-up: browser GPS acquisition

## Cause established from source

The reported message came from `locate()` after the browser's **success** callback. It therefore was not the permission-denied, timeout, unavailable-location, insecure-origin, or missing-Geolocation path. The success callback's point failed `freshBrowserPoint`: usable coordinates, finite accuracy between 0 and 35 metres, a timestamp no more than 15 seconds old, and no more than 1 second ahead of the device clock.

The former message combined all those reasons without showing the accuracy or age, so the exact failed field on the user's Windows browser cannot be reconstructed. No actual desktop fix or diagnostic metadata was supplied. Poor browser-reported accuracy is a plausible explanation, not a verified measurement. Loading MapTiler tiles is independent of browser location acquisition and does not demonstrate that the browser can supply a recording-quality fix.

The application defect was the diagnostic/acquisition experience: one unusable fix became an alarming generic error with no accuracy details. The accuracy requirement itself remains unchanged.

## Change

- Start and Resume publish transient acquisition state before requesting the browser location. The Record screen shows **Waiting for accurate GPS** while requesting or after an unusable fix.
- Failed quality validation reports the actual browser accuracy rounded upward to whole metres, with the existing **35 m or better** requirement. Stale fixes show their age and the 15-second requirement; future timestamps and invalid coordinates have separate explanations.
- **Retry GPS** requests a fresh fix through the existing Start/Resume path without reloading. It also appears after permission, timeout, and unavailable-location errors, whose existing messages remain distinct.
- Quality failures use neutral explanatory text instead of the generic error alert. These failures still reject at the service layer; only their expected acquisition error is handled as waiting by the Record screen. Storage and other errors remain errors.
- Acquisition is one explicit request per attempt, not continuous polling. The waiting explanation says that recording has not started/resumed and that Retry requests another fix. No workout is created and no active timer starts until a valid fix is returned. A failed Resume preserves the paused workout.
- Only status/detail strings are held in memory. No coordinates, diagnostics, or acquisition state are persisted. Finish/Discard clear this transient feedback.

## Files changed in this follow-up

1. `features/recording/acquisition.ts` — transient state, quality feedback, expected waiting error.
2. `services/recorder.web.ts` — publish acquisition feedback around existing browser acquisition and clear it on completion/discard.
3. `src/app/(tabs)/record.tsx` — waiting feedback and Retry GPS.
4. `tests/recorder-web.test.ts` — accuracy, stale/future fix diagnostics, acquiring state, failed Resume, and retries after quality/permission/provider errors.
5. `tests/browser/recording.spec.ts` — rejected-fix feedback and retry flows, permission/provider error retries, map-region and six-tab checks.
6. `docs/gps-acquisition-ux.md` — this report.

Previous Phase 1A work remains in the workspace. This follow-up did not change native recording, validators/thresholds, map providers/configuration, navigation, storage schemas, Supabase, credentials, or dependencies. Nothing was committed or pushed.

## Validation

- `npm.cmd run check`: TypeScript and ESLint passed; 32 unit test files / **180 tests passed**.
- Recording Playwright suite: **11 passed, 1 skipped** using Edge/Chromium. The existing configured-map adapter test remains skipped without `MAP_ADAPTER_TEST`. The acquisition tests confirm that the map region and all six tabs remain present.
- Web Expo export and `git diff --check` passed.
- No final failed tests. Browser tests use explicit test-only location callbacks; they do not establish the user's actual desktop provider accuracy or replace physical browser/device verification.

## Desktop limitations and verification

The [Geolocation specification](https://www.w3.org/TR/geolocation/) permits sources such as GPS and network-derived estimates; requesting high accuracy does not guarantee that the device/provider can deliver it. A desktop browser may remain unable to meet 35 m even with permission allowed. Retrying cannot manufacture better hardware/provider data. The application deliberately continues to block recording in that case.

On the affected Windows browser, press Start and inspect the newly displayed accuracy and age. Retry after checking browser site permission and Windows location services. Confirm that poor fixes leave the timer at zero and create no activity. If the provider never meets the requirement, verify on a GPS-equipped phone rather than relaxing validation. Verify real permission prompts and fresh measurements outside test fixtures. Browser recording remains foreground-only.

# Current milestone: physical-device testing

This checkpoint preserves the six tabs, OAuth/profile editor and avatar fallback,
GPS recording, maps, offline route recovery, account route sync, atomic storage,
conflict/deletion handling, migrations and security tests. The straight-line
planner is preserved. The routing contract is inactive; Phase 1C has not begun.

The applied migration is recorded in
[the deployment report](route-cloud-sync-production-deployment.md). Earlier
predeployment/backup reports describe their historical snapshots. Do not rerun
their deployment commands. No hosted database changes are needed for this guide.

## Choose a development build

Use a custom StravaKinda development build for Android and iPhone. Expo Go is
insufficient for acceptance of background location and the app's custom OAuth
callback (`stravakinda://auth/callback`). The app also includes native purchase
integration. `expo-dev-client` and an internal `development` profile already exist;
the Android profile produces an APK. No cloud build has been requested by this
checkpoint. Cloud builds require separate owner approval and may consume quota.

Reference: [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/),
[using the installed build](https://docs.expo.dev/develop/development-builds/use-development-builds/),
[SDK 58 location](https://docs.expo.dev/versions/v58.0.0/sdk/location/),
[SDK 58 native maps](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/).

## Before requesting a build

Install Node.js LTS (including npm) and Git on Windows. This repository uses npm,
not Bun. PowerShell may block `npm.ps1`/`npx.ps1`; use the `.cmd` forms below.
No Android Studio or Xcode is needed for cloud builds. iPhone cloud builds require
a paid Apple Developer membership and signing access; Android does not require a
Google Play developer account. An Expo account is required for EAS cloud builds.
Scanning a Metro QR code does not require signing into Expo on the phone.

Open PowerShell:

```powershell
Set-Location 'D:\StravaKinda_Nepal_Redesigned_Project\StravaKinda-main'
npm.cmd run check
npx.cmd expo install --check
npx.cmd expo-doctor
```

Resolve dependency failures before building. Do not upgrade the SDK or run a broad
dependency fix without reviewing its changes.

Keep local values in ignored `.env`; use `.env.example` as a list of names only.
Configure matching EAS environment values before cloud compilation: ignored local
environment files are not a reliable source for the cloud build. Use the Expo
dashboard's environment editor, avoiding values in terminal commands or logs.
`EXPO_PUBLIC_*` values are compiled into the app and are visible to app users.
Only public client configuration belongs there, never service-role/provider
secrets or database credentials.

Required checks:

- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` must identify the
  intended project; use its public anon/publishable client key.
- `EXPO_PUBLIC_EAS_PROJECT_ID` must identify an Expo project owned by the intended
  account. It was empty during checkpoint review. After approval, project linking
  can use `npx.cmd eas-cli@latest init`; review any generated config changes.
- Android needs `EXPO_PUBLIC_GOOGLE_MAPS_KEY`, currently empty. Enable Maps SDK for
  Android with billing as required, restrict the key to `com.stravakinda.app` and
  the development signing certificate SHA-1. Rebuild after changing native map
  configuration. iOS uses Apple Maps by default and needs no Google Maps key.
- RevenueCat platform keys were empty. Supply public SDK keys only if testing
  subscriptions; purchase acceptance remains a separate task.
- Confirm Google provider configuration and that Supabase's allowed redirect URLs
  include `stravakinda://auth/callback`. Google redirects to Supabase's HTTPS auth
  callback, then Supabase redirects to the app. This review did not inspect or
  change hosted OAuth settings. Never paste authorization links into reports.
- Leave optional push disabled for this milestone. Enabling it also requires
  native notification dependencies and adapter setup.

## A. Physical Android phone

1. After the owner approves a cloud build, sign in and request it from PowerShell:

   ```powershell
   npx.cmd eas-cli@latest login
   npx.cmd eas-cli@latest build --platform android --profile development
   ```

2. When complete, open the private EAS installation link on your Android phone,
   download the APK, allow installation from that browser when prompted, and
   install StravaKinda. Expo Go is not needed. Keep build links private.
3. Put the phone and PC on the same Wi-Fi. Start Metro:

   ```powershell
   Set-Location 'D:\StravaKinda_Nepal_Redesigned_Project\StravaKinda-main'
   npx.cmd expo start --dev-client --lan
   ```

4. Allow Node.js through Windows Firewall on your private network. Scan Metro's
   QR code with the phone camera/QR reader and open it in StravaKinda. Alternatively
   open the development app and select the detected server. Keep PowerShell open.
   Guest Wi-Fi/client isolation and VPNs can prevent connections. If LAN access
   fails, try `npx.cmd expo start --dev-client --tunnel`; follow any tunnel-helper
   install prompt. The tunnel needs internet access on both devices.

## B. Physical iPhone from Windows

1. After approval, log in to Expo and register the phone for internal distribution:

   ```powershell
   npx.cmd eas-cli@latest login
   npx.cmd eas-cli@latest device:create
   ```

   Follow the registration URL on the iPhone to register its device ID. Apple
   signing access and a paid Apple Developer membership are required for this
   cloud path. Register before building so the provisioning profile includes it.
2. Request the device build (after approval):

   ```powershell
   npx.cmd eas-cli@latest build --platform ios --profile development
   ```

3. Open the resulting private installation link in Safari on the registered
   iPhone and install the app. This installs an iOS build, not an APK. Enable
   Settings > Privacy & Security > Developer Mode if prompted, restart and confirm.
   Follow any signing/trust prompt. A simulator build cannot be installed here.
4. On the same Wi-Fi as Windows, start Metro with the command in the Android
   section. Scan the QR code using the iPhone Camera and open StravaKinda.
   Allow local-network access if requested. Use the tunnel fallback if necessary.

## Acceptance checklist on both phones

Use a controlled test account and deliberately created test routes. Real-account
sync testing writes new route records: perform it only when the owner authorizes
those test writes. This checkpoint itself makes no hosted writes.

1. Open Home, Explore, Record, Events, Activities and Profile. Check narrow-screen
   layout, scrolling, light/dark appearance and navigation back from details.
2. Choose Google login in StravaKinda; complete it in the browser on that same
   phone and confirm automatic return to the app. Verify the expected account,
   name and avatar, profile editing, custom photo selection, Google-photo fallback,
   logout and login again. Do not share screenshots containing personal details.
   If callback fails, verify the custom build/scheme and hosted allowlist before
   changing code or credentials.
3. Outdoors with a clear sky view, enable precise location. Record a short safe
   walk after a good GPS fix. Verify marker, map tiles, recenter, distance, pause,
   resume and finish. Confirm poor-fix/denied-permission messaging without
   fabricated distance. Permit background location when testing screen lock;
   Android foreground-service notification and battery restrictions matter.
   Verify lock/unlock and app foreground recovery. Force-quit can stop OS location
   delivery; distinguish saved-record recovery from continuous tracking.
4. Reopen the saved test activity and confirm its route is present. Disconnect
   internet and verify locally stored routes remain available; map tiles may
   require internet. Reopen the app and check recovery. Do not clear app/browser
   data or reinstall over valuable unexported local routes.
5. Log into the same controlled account on another device or a correctly
   configured fresh web build. Create a synthetic straight-line planned route,
   wait for Synced, and confirm it arrives on the other client. Repeat offline
   save/reconnect, app restart and foreground resume, checking no duplicates.
   Existing signed-out browser routes stay local and are not automatically moved
   to an account. Review the route transfer guide separately if needed.
6. With authorization, delete only a newly created synthetic route and confirm
   propagation. Verify logout/account switching hides the previous account's
   library. Use isolated automated fixtures for stale-edit conflict scenarios.
   Preserve all pre-existing routes and private recovery files.

Do not publish the existing `dist` export: it was produced for controlled fixture
tests. Real-device Metro must use the intended public configuration, not fixture
environment overrides. Do not commit recordings, screenshots showing private
routes, route exports, `.env`, private recovery material, or build outputs.

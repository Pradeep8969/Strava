# Phase 1C.3I — Private live Android routing preview

The preview is prepared for a separately approved physical-device test. Valhalla remains stopped and no USB mapping has been created. The [fixture preview](phase-1c3h-android-fixture-preview.md) remains available on the same screen.

## Isolation and preview behavior

Open **Explore → + beside Discover routes → Route Studio → Live Kathmandu Routing (USB)**. The button appears alongside **Preview Kathmandu Roads (Demo)** only when the bundle is a development bundle, the platform is Android, and `EXPO_PUBLIC_VALHALLA_USB_BASE_URL` is exactly `http://127.0.0.1:8002`. Set the variable in the PowerShell session that launches Metro. There is no default endpoint, production configuration, Wi-Fi address, or credential. The existing Valhalla adapter uses Expo's native fetch with redirects rejected and credentials omitted. The host pilot continues to bind only to `127.0.0.1:8002`. [Expo SDK 58 fetch](https://docs.expo.dev/versions/v58.0.0/sdk/expo/#expofetch-api) · [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)

The preview copies up to 50 waypoints from the planner into temporary screen state. Tap the map to append a point, undo or clear points, or use the three-point Kathmandu sample. **Calculate route** submits the current points. Walking and running use pedestrian costing, and cycling uses bicycle costing. Running shows a walking-pace duration estimate. Waypoint and mode edits clear the result and cancel in-flight requests. The controller enforces its 15-second deadline and suppresses late responses. **Cancel calculation**, route blur, and **Back to planning** clear the active request. Failed calculations can be retried with the same points.

The map draws the decoded road shape and original pins. Caution snaps over 25 m and large snaps over 50 m show separate teal dots with warnings. Large snaps preserve the route and the original pins. Missing API and disconnected ADB can look identical to the client, so the connection message asks the tester to check the cable, reverse mapping, and host API. Invalid input or malformed responses, no-route failures, and timeouts have separate routing categories and safe user-facing messages. The preview has no Save, Follow Route or sync action. Returning to planning preserves the original draft.

## Android cleartext readiness

The installed Expo SDK 58 dependency is 58.0.19. Its local `node_modules/expo/template.tgz` contains both `debug` and `debugOptimized` Android manifests with `android:usesCleartextTraffic="true"`. The template's main manifest and this project's Expo config have no cleartext override or network-security config. The existing development APK is expected to allow this HTTP request if built from those standard debug sources. Its merged manifest and runtime behavior were not inspected because ADB and the APK were unavailable in this phase. An APK with a custom network-security config can behave differently. [Expo SDK 58 debug manifest](https://raw.githubusercontent.com/expo/expo/sdk-58/templates/expo-template-bare-minimum/android/app/src/debug/AndroidManifest.xml) · [Android network security configuration](https://developer.android.com/privacy-and-security/security-config)

Start with the existing development APK and reload Metro. If app networking reports that cleartext to `127.0.0.1` is blocked after host readiness and reverse forwarding are confirmed, inspect the installed APK's merged manifest with Android SDK `apkanalyzer manifest print`. A confirmed native policy block requires a separately approved development-only, loopback-scoped network-security change and a new development APK. Metro reload cannot change a compiled manifest. Release settings were left alone.

## PowerShell runbook for the separately approved live test

Use Android SDK Platform Tools, an unlocked physical phone with USB debugging enabled, and an authorized USB cable. Run from the repository root. Select the physical USB device serial from `adb devices -l`; its state must be `device`. Review the normal [pilot preflight](phase-1c3-kathmandu-pilot.md#powershell-runbook), confirm there is no existing host listener or device mapping for port 8002, and preserve existing mappings. [Android Debug Bridge](https://developer.android.com/tools/adb)

```powershell
adb devices -l
$serial = Read-Host 'Authorized USB device serial'
adb -s $serial get-state
adb -s $serial reverse --list
Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue

$compose = 'ops/kathmandu-valhalla/compose.yaml'
$project = 'stravakinda-kathmandu-pilot'
docker compose -p $project -f $compose config --quiet
# After approval and a successful preflight, start only the pinned local API.
docker compose -p $project -f $compose up -d --no-deps --pull never valhalla
docker compose -p $project -f $compose port valhalla 8002
curl.exe --fail --silent --show-error --noproxy '*' http://127.0.0.1:8002/status
# Continue only if the binding is 127.0.0.1:8002 and status reports 3.8.3 with route available.

adb -s $serial reverse --no-rebind tcp:8002 tcp:8002
adb -s $serial reverse --list
```

Verify `tcp:8002 tcp:8002` in the reverse list. In the Metro shell, start or restart the development bundle with the opt-in:

```powershell
$env:EXPO_PUBLIC_VALHALLA_USB_BASE_URL = 'http://127.0.0.1:8002'
npx expo start --dev-client
```

Open and reload the Metro bundle in the installed development client. In the live preview, select **Use sample points**, then **Calculate route** for Walking and Running. Verify the intermediate Asan pin, the road-following line, totals and duration label. In Cycling, verify the Kathmandu Durbar Square start warning. Test cancellation and retry, then turn off the route mapping or disconnect USB to verify the controlled connection error. Reconnect and recreate the mapping only if needed for retry. Verify the fixture preview and original planner draft after **Back to planning**.

When finished, remove only the reverse mapping created for this test and stop only the pilot API. Preserve the graph, images, containers and other mappings. After stopping Metro, clear the opt-in in its shell as well if it was a separate shell.

```powershell
adb -s $serial reverse --remove tcp:8002
adb -s $serial reverse --list
docker compose -p $project -f $compose stop valhalla
docker compose -p $project -f $compose ps --all valhalla
Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue
Remove-Item Env:EXPO_PUBLIC_VALHALLA_USB_BASE_URL -ErrorAction SilentlyContinue
```

Automated tests inject pilot responses and faults. They cover development and origin gating, loading, cancellation, stale responses, retries, mapped errors, large snaps, read-only controls, no persistence imports, and fixture regression. The live USB connection and the installed APK's native policy still require physical verification. Saving road-following routes to Supabase remains blocked pending the additive schema, validators and data-use review in the [routing readiness audit](phase-1c3-routing-readiness.md).

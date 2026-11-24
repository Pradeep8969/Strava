# Phase 1C.3J — Live Kathmandu routing reliability

Open **Explore → + beside Discover routes → Route Studio → Live Kathmandu Routing (USB)** on the OnePlus 5T using the existing development client. The entry requires an Android development bundle and the exact opt-in origin `http://127.0.0.1:8002`. Set `$env:EXPO_PUBLIC_VALHALLA_USB_BASE_URL = 'http://127.0.0.1:8002'` in the Metro shell, run `npx expo start --dev-client`, and reload the installed client. See the [live preview setup](phase-1c3i-live-android-preview.md).

## OnePlus 5T test matrix

Reported passes refer to the earlier physical run. Repeat the matrix against the updated Metro bundle before signing off. Use a recognizable unsaved planner title, mode and waypoint order so restoration is easy to compare.

| Case | Steps and expected result | Physical status |
| --- | --- | --- |
| Walking | Use the exact two-point baseline below if available in the draft, or use the three-point sample and its totals in the multi-waypoint row. For the exact two points, expect Walking, 1.43 km and Estimated 00:16:55. The line follows streets. The requested start remains orange and a teal dot appears about 36 m away with a caution. | Reported pass |
| Running | Use the same exact two points. Expect the same geometry and totals as Walking, with Running and Estimated 00:16:55 (walking pace). | Reported pass |
| Cycling | Use the same exact two points. Expect Cycling, 1.65 km and Estimated 00:06:01. The requested start remains orange and a teal dot appears about 63 m away with advice to choose a bicycle-accessible road. | Reported pass |
| Multi-waypoint and edits | Select Walking and Use sample points. Expect Start, Waypoint 2 at Asan, and Finish in that order, a continuous line through the Asan snap, 1.59 km and Estimated 00:18:45. The two normal snaps add no teal dots. Undo, add a different point, then recalculate and check the new order. Clear points and verify Calculate is disabled below two points. The preview accepts up to 50 ordered points. | Multi-waypoint reported pass. Repeat edit and limit checks. |
| Rapid changes | Calculate, switch modes or edit points, and calculate again. The previous line and totals clear on edit. Only the latest calculation can publish a line or error. Use the held connection below to exercise edits while a request is pending. | Rapid switching reported pass |
| API stopped and USB forwarding missing | Test each independently while the Metro bundle remains loaded. Calculate with the API stopped and reverse mapping present. Then restore the API and remove only the pilot reverse mapping (or unplug USB). Expect the USB service message and Retry route after a connection failure. If the connection hangs, expect the timeout message at about 15 seconds. Keep the current mode and requested pins. No route line or totals should appear. | Offline/API unavailable reported pass. Repeat the two causes independently. |
| Recovery | Reconnect USB, restore the mapping if needed, confirm host status, and tap Retry route. Expect the same mode and pins to calculate successfully with no preview restart. | Reported pass |
| Cancel and timeout | Use the held connection below. Calculate should become Cancel calculation in the same position. Tap it before 15 seconds. Expect the cancellation message and Calculate route, the same pins and mode, and no route line, totals or later error. Repeat without pressing Cancel. Expect timeout guidance and Retry route at about 15 seconds. | Pending physical verification |
| Back to planning | Edit preview points and mode, then tap Back to planning. The original title, waypoint order and planning mode should match the draft before entry. Repeat during a held request. Reopening should start with the original planner points and Walking. Verify the preview has no Save or Follow Route action. | Back to planning reported pass. Repeat during a held request. |
| Visibility | Remove the exact opt-in and restart Metro. The live entry should disappear. The fixture preview should still be available on Android development bundles. Production, iOS and web gating are covered by automated tests. | Automated gate verified |

The exact two-point baselines are the original Start `[85.3076, 27.7043]` and Finish `[85.3139, 27.7125]`, in longitude/latitude order. Use the three-point sample for repeatable on-device calculations without relying on map-tap precision. The [pilot table](phase-1c3-kathmandu-pilot.md#phase-1c3f-local-routing-validation) records the exact reference routes and raw estimates for the pinned graph.

## Check the API and the USB mapping

Run these checks manually from the repository root. Select the OnePlus serial shown as `device` by ADB. A previously authorized reverse entry can disappear after reconnecting.

```powershell
adb devices -l
$serial = Read-Host 'OnePlus USB serial'
adb -s $serial get-state
adb -s $serial reverse --list

$compose = 'ops/kathmandu-valhalla/compose.yaml'
$project = 'stravakinda-kathmandu-pilot'
docker compose -p $project -f $compose port valhalla 8002
curl.exe --fail --silent --show-error --noproxy '*' --max-time 5 http://127.0.0.1:8002/status
```

Expect `127.0.0.1:8002` from Compose and HTTP 200 with version 3.8.3 and `route` available from the status endpoint. The phone should show `tcp:8002 tcp:8002` in its reverse list. If absent, add it and recheck.

```powershell
adb -s $serial reverse --no-rebind tcp:8002 tcp:8002
adb -s $serial reverse --list
```

For a deliberate outage, stop only the pilot API. Check that the port is free before restarting. If another process owns the port, identify it before proceeding. Use the existing pinned image and graph as described in the [pilot preflight](phase-1c3-kathmandu-pilot.md#powershell-runbook).

```powershell
docker compose -p $project -f $compose stop valhalla
docker compose -p $project -f $compose ps --all valhalla
Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue

docker compose -p $project -f $compose up -d --no-deps --pull never valhalla
docker compose -p $project -f $compose port valhalla 8002
curl.exe --fail --silent --show-error --noproxy '*' --max-time 5 http://127.0.0.1:8002/status
```

At the end of a test session, remove the pilot reverse mapping if you created it, preserve other reverse mappings, and return the pilot API to its prior state. Clear the opt-in from the Metro shell when you no longer need the preview.

```powershell
adb -s $serial reverse --remove tcp:8002
adb -s $serial reverse --list
Remove-Item Env:EXPO_PUBLIC_VALHALLA_USB_BASE_URL -ErrorAction SilentlyContinue
```

## Hold a request for physical cancellation testing

Warm local routes can finish before Android paints the loading state. To exercise it deterministically, manually stop the pilot API, verify port 8002 is free, keep USB forwarding active, and run this temporary listener in a separate host PowerShell session. It binds only to IPv4 loopback and holds connections without sending an HTTP response.

```powershell
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8002)
try {
  $listener.Start()
  Read-Host 'Run Cancel and Timeout on the phone, then press Enter to close the listener'
} finally {
  $listener.Stop()
}
```

Start each test with at least two points. For Cancel, press the replacement button promptly and wait past the original deadline. For Timeout, leave the request pending. For Back to planning, exit while pending. Close the listener, restart the pilot API using the commands above, check status and forwarding, and calculate again. The mocked transport test separately delivers a valid response after cancellation to check stale-result suppression.

## Report failures and decide readiness

Record the matrix row, OnePlus Android version, development bundle revision, mode, ordered waypoint coordinates, steps, expected and observed behavior, elapsed time, and a screenshot or screen recording if possible. For connection failures include the host status outcome and whether the selected phone showed the reverse mapping. For geometry failures include the visible distance, duration, and snap labels plus the corresponding pilot response if available. Redact device serials, keys, tokens and personal route coordinates before sharing.

Running uses pedestrian geometry and a walking-pace estimate. Distances and durations describe the snapped path in the pilot graph. Large offsets warn about snapping but still display the route. The pilot has limited geographic coverage. The basemap can require separate tile connectivity even while the USB route service works. Connection refusal can look identical for a stopped API and a disconnected reverse mapping. The preview keeps its results in screen state for inspection only.

The reported physical results and automated checks support continuing read-only development. Close out physical readiness by passing the pending cancellation and timeout checks and repeating outage recovery, draft restoration and snap checks on the updated bundle. Persistence or Follow Route needs its own design and validation, including the open questions in the [routing readiness audit](phase-1c3-routing-readiness.md).

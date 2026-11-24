# Phase 1C.3G — Valhalla routing adapter prototype

The [Valhalla adapter](../features/routes/valhalla-routing.ts) implements the existing [routing contract](../features/routes/routing.ts). It is an opt-in module for a local development harness. Route Studio and its demo continue to use their existing provider selection.

| App mode | Valhalla costing | Duration |
| --- | --- | --- |
| Walking | `pedestrian` | Walking estimate |
| Running | `pedestrian` | Walking-compatible estimate supplied by Valhalla |
| Cycling | `bicycle` | Bicycle estimate |

Hiking is unavailable in the prototype. Each request sends two to 50 ordered `break` locations to `POST /route` in Valhalla's native JSON format, with kilometer units. Each intermediate waypoint therefore creates a leg boundary. [Valhalla 3.8.3 route API](https://raw.githubusercontent.com/valhalla/valhalla/3.8.3/docs/docs/api/route/api-reference.md)

## Development endpoint and data flow

Pass an explicit development flag and a locally configured origin to `createValhallaRoutingProvider`. There is no default origin, environment binding, or UI call site. A standalone development harness can read `VALHALLA_DEV_BASE_URL` from its local environment and pass it as `baseUrl`. For the [local pilot](phase-1c3-kathmandu-pilot.md#phase-1c3f-local-routing-validation), the value is `http://127.0.0.1:8002`. Only literal IPv4 loopback HTTP origins with an explicit port are accepted. Requests omit credentials and tell fetch to reject redirects.

Use `calculateRoute` or one `createRouteRequestController` per draft. The shared runner snapshots inputs, forwards an abort signal, and enforces the default 15-second deadline, which includes reading the response. The controller cancels superseded requests and discards stale outcomes. Clear it on draft dismissal or account change. The provider has no routing state or timer of its own.

The adapter validates input coordinates, response units and totals, leg count, optional echoed location coordinates and order, and decoded geometry. Native Valhalla leg shapes use latitude-first delta encoding at six decimal places. The adapter returns GeoJSON longitude-first coordinates, converts kilometers to meters, and retains seconds. It joins only legs with identical endpoints, removes the duplicated junction vertex, and indexes each original waypoint's route position. The shared preview cap is 100,000 vertices. The result carries OpenStreetMap attribution and `offlineStoragePermitted: false`.

## Snap policy

The captured 3.8.3 responses echo input pins in `trip.locations`. Decoded leg endpoints provide the actual routed positions. `RoutedPath.waypointSnaps` preserves both the requested and snapped coordinates, the great-circle offset in meters, and a typed severity in request order.

| Offset | Severity |
| --- | --- |
| Up to 25 m | Normal |
| Over 25 m through 50 m | Caution |
| Over 50 m | Large |

These are pilot UI thresholds. Caution and large severities are warnings, and valid paths still return at either severity. The captured Kathmandu and Bhaktapur Durbar Square cycling snaps are approximately 63.1 m and 54.7 m. Future UI should keep the original waypoint pins visible and explain the offset without rewriting the draft.

## Errors

| Condition | Shared category |
| --- | --- |
| Valhalla 100, 120, 130, 150 | `invalid` |
| Valhalla 125 | `unavailable` |
| Valhalla 171 | `no-route` |
| Disabled or invalid endpoint, unsupported mode, HTTP 401 or 403 | `unavailable` |
| HTTP 429 | `rate-limit` |
| Shared deadline, HTTP 408 or 504 | `timeout` |
| Request aborted | `cancelled` |
| Connection refused or other fetch failure | `network` |
| Invalid success JSON, units, totals, locations or geometry | `invalid` |
| Other non-200 responses | `provider` |

The adapter maps the pilot's Valhalla codes on HTTP 400. Messages are controlled by the adapter and omit provider response text and transport details.

## Tests and next phase

The [adapter tests](../tests/valhalla-routing.test.ts) inject sanitized payloads from four local pilot responses. They cover walking, running and cycling costing, ordered waypoints, geometry precision and continuity, units, snap warnings, invalid inputs and responses, endpoint gating, error mapping, network failures, cancellation, timeout, and stale-request and draft isolation. They run without an API, Docker, or network access. Repository checks use `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd test`.

The prototype covers the Kathmandu pilot response format. Running duration uses a walking estimate. Coverage, access tags, and bicycle suitability still depend on the graph and need physical checks. Production provider authorization, operational limits, and data-use policy are unresolved.

For a separately approved Android phase, first use the captured fixtures in a development-only Route Studio preview and verify geometry, original markers, snap warnings, cancellation, and error states on hardware. Then approve a private device transport, such as USB reverse port forwarding with a scoped debug cleartext policy, before any live test. Verify it on physical Android hardware with the host API still loopback-only, repeat the two Durbar Square cycling cases using confirmed bicycle-accessible entrances, and remove the temporary device forwarding at the end. The Android app has not been connected to or tested with this adapter.

**Saving real road-following geometry to Supabase remains blocked** pending additive schema and validator work, backward-compatibility checks, and appropriate data-use review for saving, sync, retention, and export. [Routing and persistence readiness](phase-1c3-routing-readiness.md)

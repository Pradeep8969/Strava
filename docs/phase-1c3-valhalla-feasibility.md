# Phase 1C.3C — Valhalla local feasibility and Nepal routing validation

Reviewed 21 November 2026. The local pilot appears feasible on this hardware, subject to a working Docker Linux engine and verified resource allocations. **No local Valhalla instance ran. All Nepal route cases remain untested.** This experiment stops at preflight because the engine is unavailable and its memory and disk allocation cannot be confirmed.

This report follows the [routing readiness audit](phase-1c3-routing-readiness.md) and [provider evaluation](phase-1c3-provider-evaluation.md).

## 1. Local preflight

| Check | Observed result |
| --- | --- |
| Windows and virtualization | Windows 11 Pro 26H2, build 26300, x64 Docker client, 12 logical CPUs. Firmware virtualization enabled and a hypervisor reported present. |
| WSL | WSL 3.0.5.0 with kernel 6.18.58.1-1. Default version is 2. The existing `docker-desktop` WSL 2 distribution was stopped. No separate Linux distribution appeared in the listing. WSL 1 support is irrelevant to the chosen backend. |
| Docker and Compose | Docker client 29.9.3 and Compose 5.7.0 installed. The selected `desktop-linux` context could not open the Linux engine named pipe. No server version or engine resources available. Verified with read-only checks outside the sandbox after sandbox access errors. |
| Host memory | Approximately 15.2 GiB visible and 7.3 GiB free at measurement. This is host memory. Docker's usable memory and current contention remain unverified. |
| Host disk | C: 33.6 GiB and D: 169.6 GiB available. Docker's image store location and free space within its virtual disk remain unverified. |
| Local tools | No `osmium` or `valhalla_service` on the Windows PATH. The official image supplies Valhalla. Osmium is needed for the documented bounded extract. |

Use Docker Desktop in Linux-container mode with the WSL 2 backend. Installed WSL and host RAM exceed Docker's documented WSL 2.1.5 and 8 GB prerequisites. Check Docker's Windows support and Desktop licensing for the account's organization before use. For this bounded pilot, plan for at least **6 GiB available to the Linux engine**, two build threads and **15 GiB free headroom** on each backing volume used for artifacts or the Docker image store. These are initial planning budgets, not Valhalla minimums or measured requirements. Keep memory headroom for Windows and stop on sustained memory pressure or excessive disk growth. [Docker Windows requirements](https://docs.docker.com/desktop/setup/install/windows-install/) · [Microsoft WSL guide](https://learn.microsoft.com/en-us/windows/wsl/install) · [Valhalla container guide](https://github.com/valhalla/valhalla/blob/master/docker/README.md)

## 2. Reproducible local setup

These steps are for a manually authorized run. The current checkout needs no runtime changes.

1. Open the already installed Docker Desktop from the Start menu. Confirm Linux containers and the WSL 2 backend. In PowerShell run the checks below. Proceed only when `docker version` reports a server, `OSType` is Linux, the engine allocation meets the pilot budget and the Docker storage location has sufficient free space. Use Docker Desktop's settings to check the location of its disk image. If Desktop cannot start, collect its diagnostics using the linked Docker documentation. On a different machine missing Docker or WSL, follow the linked official installation instructions and rerun preflight. [Docker troubleshooting](https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/)

   ```powershell
   wsl --version
   wsl --list --verbose
   docker context show
   docker version
   docker info --format '{{.OSType}} CPUs={{.NCPU}} MemoryBytes={{.MemTotal}} Root={{.DockerRootDir}}'
   [System.IO.DriveInfo]::GetDrives() | Where-Object IsReady |
     Select-Object Name, AvailableFreeSpace
   ```

2. Choose an empty data directory outside the repo, for example `D:\valhalla-nepal-pilot`. Use the Geofabrik Nepal PBF, listed at **396 MB** at review, then cut one buffered rectangle covering both cities and the intervening corridor. No public, maintained smaller two-city PBF was verified here. This downloads one country PBF and builds only the subset. Recheck the current download size and Docker image size before downloading either. The subset size and graph size are unknown until measured. Select a dated PBF from the download page for reproducibility and record its source URL, published size, timestamp and SHA-256. Verify against the published checksum when available. [Geofabrik Nepal](https://download.geofabrik.de/asia/nepal/) · [Osmium extract manual](https://docs.osmcode.org/osmium/latest/osmium-extract.html)

   In an existing Linux environment with access to the data directory, check `osmium --version`. If a separate Debian/Ubuntu WSL distribution and Osmium are absent, an operator can provision them manually using the Microsoft guide and run `sudo apt update` followed by `sudo apt install osmium-tool`. Do not install packages in Docker Desktop's internal distribution. An existing Linux machine with Osmium can prepare the same clipped PBF. The example assumes the approved source file has been placed at `D:\valhalla-nepal-pilot\source\nepal.osm.pbf`.

   ```bash
   cd /mnt/d/valhalla-nepal-pilot
   mkdir -p graph-v1
   sha256sum source/nepal.osm.pbf
   osmium extract --bbox 83.80,27.52,85.58,28.42 --strategy smart \
     --output graph-v1/nepal-pilot.osm.pbf source/nepal.osm.pbf
   osmium fileinfo graph-v1/nepal-pilot.osm.pbf
   sha256sum graph-v1/nepal-pilot.osm.pbf
   ```

   Record clip size, bounds and checksums. Keep just the clipped PBF in the graph input directory to prevent a full-country build. Use cases well inside the rectangle for coverage judgments. Extraction can truncate access relations or legitimate routes near its edges, so classify edge failures separately.

3. From the [official scripted image registry](https://github.com/valhalla/valhalla/pkgs/container/valhalla-scripted), choose the Linux amd64 digest corresponding to a published stable Valhalla release. After checking resource budgets, set `$image` to that immutable reference and run the following in PowerShell. The initial build deliberately omits elevation and transit. The only published port is loopback. The mounted directory holds the build output and stays outside Git. [Official container guide](https://github.com/valhalla/valhalla/blob/master/docker/README.md)

   ```powershell
   $graph = 'D:\valhalla-nepal-pilot\graph-v1'
   $image = 'ghcr.io/valhalla/valhalla-scripted@sha256:<registry-digest>'
   docker pull $image
   if ($LASTEXITCODE) { throw 'Valhalla image pull failed' }
   docker run -d --name stravakinda-valhalla-pilot --restart=no --cpus=2 --memory=5g `
     --publish 127.0.0.1:8002:8002 `
     --mount "type=bind,source=$graph,target=/custom_files" `
     -e server_threads=2 -e build_elevation=False -e build_transit=False `
     -e build_time_zones=False -e use_default_speeds_config=False $image
   docker logs --follow stravakinda-valhalla-pilot
   ```

   After the build, confirm the loopback binding with `docker port stravakinda-valhalla-pilot`. In another shell run `Invoke-RestMethod http://127.0.0.1:8002/status -TimeoutSec 10`. Capture the engine version and tileset timestamp. A positive control route is needed to prove the tiles actually route. Measure build wall time, peak memory, graph/artifact size and warm/cold route latency with the image digest and graph version recorded. `docker stats` during the build can sample container memory. If the build exits from memory pressure, reduce `server_threads` or narrow the clip and rerun in a new artifact directory. When finished, use `docker stop stravakinda-valhalla-pilot` to stop the experiment while retaining the graph. [Valhalla status API](https://valhalla.github.io/valhalla/api/status/api-reference/)

## 3. Nepal validation matrix

All entries below are **NOT RUN**. The named places are public test landmarks. Pick and record exact coordinates at public, mapped entrances or street segments in the pinned extract before submitting. Landmark centroids can produce misleading off-network snaps.

| Case | Public test locations and purpose | Result |
| --- | --- | --- |
| Kathmandu walking | Ratna Park to Kathmandu Durbar Square. Compare pedestrian access and bends with mapped streets. | Not run |
| Kathmandu cycling | Tundikhel perimeter road to the Patan Durbar Square vicinity via public streets. Choose bike-accessible approach roads and inspect crossings and restrictions. | Not run |
| Pokhara walking | Basundhara Park entrance to Phewa Lakeside public approach. Inspect availability of mapped paths and appropriate access near the shore. | Not run |
| Pokhara cycling | Pokhara tourist bus park approach to Hallan Chowk. Check street routing, cycle access and junctions. | Not run |
| Ordered multi-waypoint | Kathmandu Durbar Square approach → Ratna Park → Narayanhiti Palace Museum approach. Use three breaks and verify two legs and original order. | Not run |
| Small roads and paths | Pick one public Kathmandu alley and one public Pokhara footpath from the pinned OSM extract. Confirm access tags, expected connectivity and whether cycling should avoid the test segment. | Not run |
| Unsnappable and disconnected | Use a point well offshore within Phewa Lake with a conservative snap cutoff. Also locate a publicly mapped isolated way inside the graph, prove it can snap locally, then route from it to a known connected public road. If there is no confirmed isolated way, record that case as unverified. | Not run |

For each case, POST to loopback only. The PowerShell helper below takes location objects with numeric `lat` and `lon` and `type = 'break'`. Use an OSRM-compatible GeoJSON response for easy visual inspection. Repeat positive cases in native JSON to capture the leg shapes and waypoint fields needed for the adapter. Use a small documented `search_cutoff` for negative controls and confirm actual snap offsets for positives. [Route request, formats and errors](https://valhalla.github.io/valhalla/api/route/api-reference/)

```powershell
function Invoke-PilotRoute {
  param(
    [ValidateSet('pedestrian', 'bicycle')] [string]$Costing,
    [object[]]$Locations,
    [switch]$Native
  )
  $body = @{ costing = $Costing; locations = $Locations; units = 'kilometers' }
  if ($Native) {
    $body.format = 'json'
  } else {
    $body.format = 'osrm'
    $body.shape_format = 'geojson'
  }
  Invoke-RestMethod -Uri 'http://127.0.0.1:8002/route' -Method Post `
    -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8 -Compress) `
    -TimeoutSec 20
}
```

Capture request, HTTP status, structured failure code or canonical line, snapped offsets, ordered leg count, distance, duration and judgment with a reason for each row. Keep fixture evidence in the local data directory. For expected HTTP failures inspect the response body, for example with `curl.exe -i` and a JSON request file. A test passes only if the following checks hold.

- Geometry is a finite WGS84 LineString of longitude/latitude pairs in bounds, with at least two distinct positions. On a chosen route with a known bend, compare the line to the pinned OSM ways and verify it follows those ways instead of crossing obstacles on a direct chord. Vertex count alone does not establish road following.
- Input order is preserved through snapping, and each break matches a leg junction in order. Report unexpectedly large offsets and check permitted traversal with the actual profile tags.
- Totals are finite and positive. Compare native summary kilometers and seconds with the OSRM-compatible meters and seconds and with map scale, expected detours and plausible speed. Check approximate geodesic line length for scale and unit errors. A route without elevation cannot validate grade-dependent cycling ETA.
- The negative cases return a clear routing error without usable line geometry. Valhalla documents structured errors for unconnected regions (170), no nearby suitable edges (171) and no path (442). Report the code actually returned. Distinguish a clip-edge failure from a real missing or disconnected local path. Neither the experiment nor the future adapter should manufacture a direct line on failure.

## 4. Adapter fit and decision

[The current routing contract](../features/routes/routing.ts) already accepts ordered coordinates and an activity profile, and returns a LineString, totals, ordered waypoint indices and provenance. It snapshots requests, checks coordinate validity, uses an `AbortSignal`, defaults to a 15-second deadline and rejects stale results and invalid paths. The existing MapTiler and demo providers can remain independent.

- A future Valhalla provider can map Walking and Running to `pedestrian` and Cycling to `bicycle`. Keep the app activity separate from Valhalla costing. Use conservative cycling defaults and label Running's ETA as a pedestrian estimate until a running speed model is validated. Keep Hiking out of the initial adapter.
- Request ordered breaks and bounded snapping. Use native JSON with kilometers and seconds and decode each leg's polyline6 into longitude/latitude pairs. Check the decoder against OSRM GeoJSON output from the same pinned graph. Join only at validated shared vertices, deduplicate the leg junction and derive waypoint indices there. Treat malformed shapes, discontinuous legs and ambiguous waypoint mapping as invalid output. Preserve user-selected points separately from snapped endpoints. [Valhalla response and geometry format](https://valhalla.github.io/valhalla/api/route/api-reference/)
- Bound bytes before parsing, waypoint count before issuing a route, vertex count while decoding, and validate finite coordinate bounds, ordered leg counts, snap offsets, totals and provenance before accepting results. Map known structured no-route responses, cancellation, timeouts and transport failures into existing typed errors. Pass the `AbortSignal` into fetch and enforce a gateway deadline as browser cancellation may not stop work already dispatched to the engine.
- Use an authenticated, rate-limited first-party route endpoint backed by a private Linux Valhalla service. Keep raw graph endpoints private, allowlist request options, restrict body size and egress, avoid precise location logs and tie results to the current session. This avoids upstream API keys in Android or web builds. The local proof remains on loopback.
- Once the versioned persistence design and data rights are approved, save the validated route geometry and provenance separately from waypoint markers. Offline Follow Route reads the stored geometry, with an available app shell on web. Route calculation still requires connectivity. The current SQLite and IndexedDB schemas can hold versioned records, and cloud sync needs the additive Supabase route contract documented in Phase 1C.3A. Planned estimates stay independent from recorded GPS metrics.

**Next implementation decision:** Build and run the local Nepal corpus before selecting a production adapter. If the corpus passes and the operational and licensing gates are acceptable, the next code step should be an isolated, opt-in Valhalla adapter with sanitized fixtures and wire-contract tests. Keep planner, persistence rollout and recording integration separate.

## 5. Licensing and operations

- **Attribution and ODbL.** Display readable OpenStreetMap credit linked to its copyright and license information on the route view, including offline. Include origin, attribution and applicable license notices in exports and redistributed artifacts. Review ODbL treatment of the graph, individual geometry exports, and aggregate or bulk route storage separately. Derivative Database and Produced Work obligations may differ, and share-alike or a source offer may be required in specific distributions. Review licenses for any future elevation or administrative inputs. The engine's MIT license and the graph data's license are separate. No final license conclusion was reached. [Valhalla data sources](https://valhalla.github.io/valhalla/contributing/data/data-sources/) · [OSM attribution](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) · [OSMF Produced Work guidance](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline)
- **Graph refresh.** Start with a weekly refresh candidate. Fetch a dated PBF and verify checksums. Reapply the pinned region, build options and image digest in a new build directory. Record source/version provenance, run the same positive and negative corpus, compare graph size and routing deltas, and promote only a tested artifact. Monitor graph age and report clipping, access-tag changes and failed refreshes. Keep the previous known-good graph available.
- **Backup and rollback.** Preserve a manifest, build config, extract reference/checksum, graph tar and tested runtime version. Use immutable artifacts with checksums, retain the last known-good version separately and practice restoring it. Roll back by switching the serving instance to that graph and matching image. Keep backups of user route records separate from reconstructable graph artifacts.
- **Hosting and costs.** Benchmark before choosing server sizes. Allow separate build CPU, RAM and scratch disk, plus Linux serving capacity with warm graph storage and memory headroom. For production reliability estimate two serving replicas, build jobs, artifact/backup storage, bandwidth, API gateway, observability and operator time. Self-hosting trades vendor quotas for availability ownership and capacity planning. OOM, slow rebuilds, regional clipping, stale tags, regressions, and abuse are material risks. No hosting or cost figures were measured in this phase.

## 6. Repository validation

- `npm.cmd run typecheck` passed.
- `npm.cmd run lint` passed.
- `npm.cmd test` passed, with 303 tests across 49 files.

The validation above covers the existing repository and did not exercise Valhalla or Nepal coverage. Only this feasibility report was added.

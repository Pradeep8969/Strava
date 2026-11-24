# Phase 1C.3 — Kathmandu Valley Valhalla pilot

The Phase 1C.3E graph build and Phase 1C.3F loopback API test succeeded. Walking and cycling requests returned mapped routes in Kathmandu, Lalitpur and Bhaktapur. Route Studio still uses its development demo. See the [readiness audit](phase-1c3-routing-readiness.md), [provider evaluation](phase-1c3-provider-evaluation.md) and [Valhalla feasibility report](phase-1c3-valhalla-feasibility.md).

## Configuration and resource budget

The [pilot Compose project](../ops/kathmandu-valhalla/compose.yaml) uses the official Valhalla **3.8.3** base image, pinned to its published multi-platform digest. The [build script](../ops/kathmandu-valhalla/build-graph.sh) uses one graph-building thread and marks the graph ready after a successful build with tile output. The builder has no network or published ports. The API mounts the artifacts read-only, enables only route and status actions, and publishes only **127.0.0.1:8002**. Elevation, transit, traffic, and auxiliary admin and timezone databases are omitted. Both services disable automatic restart and implicit image pulls. [Official image and digest](https://github.com/valhalla/valhalla/pkgs/container/valhalla/1065046398?tag=3.8.3) · [Graph builder CLI](https://github.com/valhalla/valhalla/blob/3.8.3/src/mjolnir/valhalla_build_tiles.cc)

Build and serve sequentially. Each container is capped at **1 CPU and 3 GiB RAM**, with no additional swap allowance. The reported 7.36 GiB engine allocation less approximately 1.68 GiB for Supabase and the full pilot cap leaves a nominal 2.68 GiB before other engine workloads. Budget **5 GiB free on D:** for the PBF, scratch space, graph and results, plus **5 GiB for the Docker image store**. Budget 10 GiB on a shared backing drive. These are planning reserves. Measure actual memory and disk use during the experiment.

## Extract

Request a custom **raw OSM PBF** from BBBike. The exact WGS84 rectangle is **west 85.23°, south 27.58°, east 85.50°, north 27.82°** (bbox 85.23,27.58,85.50,27.82 in longitude/latitude order). It covers approximately 710 km² around central Kathmandu, Lalitpur and Bhaktapur, with buffer for surrounding streets and walking paths. Plan for **10–50 MB**, inferred from the extent and typical BBBike city extract sizes. The estimate is unmeasured. Review the actual size before proceeding if it exceeds 50 MB. Complete ways can extend beyond the request rectangle. [BBBike custom extracts](https://extract.bbbike.org/extract.html) · [BBBike city extract sizes](https://download.bbbike.org/)

Store all generated files in **D:\stravakinda-kathmandu-valhalla\v1**, outside the checkout and Git. The fixed Compose bind mounts require this directory to exist. Record the exact selection, provider snapshot timestamp, download date, byte size, published MD5 and local SHA-256. Credit **© OpenStreetMap contributors** with a link to the OSM copyright page on maps and shared pilot outputs. OSM data is licensed under ODbL 1.0. Review attribution, share-alike and source availability obligations before distributing graph data or other derived artifacts. [OSM copyright and license](https://www.openstreetmap.org/copyright) · [OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)

## PowerShell runbook

Extract validation, the Phase 1C.3E graph build, and the Phase 1C.3F API test are complete. The pilot API is stopped.

### Extract acquisition status

| Field | Result |
| --- | --- |
| Source record | [BBBike custom extract service](https://extract.bbbike.org/extract.html), raw OSM PBF, southwest 85.23° E / 27.58° N and northeast 85.50° E / 27.82° N |
| Provider-issued download URL | Pending custom extract request |
| Intended file | `D:\stravakinda-kathmandu-valhalla\v1\kathmandu-valley.osm.pbf` |
| File existence, byte size and SHA-256 | The pilot file contains the validated third extract (36,814,022 bytes). Its SHA-256 matches the original download. |
| Format, bounds and readability | The third OSM PBF decoded successfully. Its highway extent spans the required Valley rectangle, with highway nodes in all 36 sampled grid cells. |
| Terms | BBBike offers free general end-user access under a fair-use policy and without warranty. OSM data is ODbL 1.0 and requires credit to © OpenStreetMap contributors. [BBBike terms](https://extract.bbbike.org/extract.html#terms) · [OSM copyright and license](https://www.openstreetmap.org/copyright) |

The JavaScript form requires an interactive submission. No request was submitted in this session. Use these steps to obtain the source record without downloading the payload.

1. Open the [BBBike extract form](https://extract.bbbike.org/) in a browser with JavaScript enabled. Search for Kathmandu and click **create**.
2. Enable **show lng/lat**. Set **Left lower corner (South-West)** to lng **85.23**, lat **27.58**. Set **Right top corner (North-East)** to lng **85.50**, lat **27.82**. Confirm the map selection covers the three cities.
3. Choose **PBF** under raw OpenStreetMap data, without an elevation or contour option. Name the area **Kathmandu Valley Valhalla Pilot** and click **Extract**. Use an email address you control or BBBike's documented `nobody` option and retrieve the completed request from the status page. [BBBike request instructions](https://extract.bbbike.org/extract.html)
4. From the completed request, copy the direct HTTPS URL for the raw PBF and the provider MD5. Confirm the completed request matches the exact rectangle and format. Use the HEAD check below to verify the actual byte size before the download. If the URL redirects, confirm the final BBBike URL and check that URL directly. Stop if the final source or size is unverifiable or exceeds **50,000,000 bytes**.

Run from the repository root. Check Linux engine mode, memory allocation and contention, available disk space and port occupancy. Confirm the Docker Desktop disk image location and free capacity in Desktop settings. Proceed only if the resource reserves are available and port 8002 is free.

~~~powershell
$compose = 'ops/kathmandu-valhalla/compose.yaml'
$pilot = 'D:\stravakinda-kathmandu-valhalla\v1'
wsl --list --verbose
docker context show
docker version
docker info --format '{{.OSType}} CPUs={{.NCPU}} MemoryBytes={{.MemTotal}}'
docker stats --no-stream
Get-PSDrive -Name C,D | Select-Object Name,Used,Free
Get-NetTCPConnection -State Listen -LocalPort 8002 -ErrorAction SilentlyContinue
docker compose -f $compose --profile build config --quiet
~~~

The validation commands assume Osmium is available in a regular WSL distribution with D: mounted at /mnt/d. Use `wsl -d <distribution> -- ...` to select it if needed. If Osmium is unavailable, record that blocker and keep the file pending validation. [Osmium fileinfo](https://docs.osmcode.org/osmium/latest/osmium-fileinfo.html)

~~~powershell
$url = [uri](Read-Host 'Paste the BBBike HTTPS link for the raw PBF')
if ($url.Scheme -ne 'https' -or $url.DnsSafeHost -notmatch '(^|\.)bbbike\.org$' -or
    $url.AbsolutePath -notlike '*.osm.pbf') { throw 'Expected a direct BBBike HTTPS link for raw OSM PBF.' }
$head = curl.exe --silent --show-error --fail --head --proto '=https' --write-out 'HTTP_END %{http_code}\n' $url.AbsoluteUri
if ($LASTEXITCODE -ne 0 -or $head[-1] -ne 'HTTP_END 200') { throw 'Verify the direct URL before downloading.' }
$lengthHeader = @($head | Where-Object { $_ -match '^Content-Length:\s*[0-9]+\s*$' })
if ($lengthHeader.Count -ne 1) { throw 'Exact download size is unverified.' }
$expectedBytes = [long](($lengthHeader[0] -split ':', 2)[1].Trim())
if ($expectedBytes -le 0 -or $expectedBytes -gt 50000000) { throw 'Download exceeds the approved size or is empty.' }
$md5 = (Read-Host 'Paste the provider MD5 for the raw PBF').Trim()
if ($md5 -notmatch '^[0-9a-fA-F]{32}$') { throw 'Invalid MD5.' }
$null = [IO.Directory]::CreateDirectory($pilot)
$partial = Join-Path $pilot 'kathmandu-valley.partial.osm.pbf'
$pbf = Join-Path $pilot 'kathmandu-valley.osm.pbf'
if ((Test-Path -LiteralPath $partial) -or (Test-Path -LiteralPath $pbf)) { throw 'Pilot extract already exists. Verify it before retrying.' }
curl.exe --fail --proto '=https' --max-filesize $expectedBytes --output $partial $url.AbsoluteUri
if ($LASTEXITCODE -ne 0) { throw 'Extract download failed.' }
$size = (Get-Item -LiteralPath $partial -ErrorAction Stop).Length
if ($size -ne $expectedBytes) { throw 'Extract size differs from verified download size.' }
if ((Get-FileHash -LiteralPath $partial -Algorithm MD5).Hash -ne $md5) { throw 'Provider checksum mismatch.' }
Get-FileHash -LiteralPath $partial -Algorithm SHA256
wsl -- osmium fileinfo -e /mnt/d/stravakinda-kathmandu-valhalla/v1/kathmandu-valley.partial.osm.pbf
if ($LASTEXITCODE -ne 0) { throw 'PBF parsing failed.' }
wsl -- osmium check-refs /mnt/d/stravakinda-kathmandu-valhalla/v1/kathmandu-valley.partial.osm.pbf
if ($LASTEXITCODE -ne 0) { throw 'Review missing way-node references.' }
~~~

Review fileinfo for nonzero node and way counts and geographic bounds covering the three cities. Compare the requested extent with provider selection metadata if the PBF has no header bounds. Record the provider's generation date if shown. Free BBBike extracts can omit object timestamps. Finalize the validated PBF and stop at the end of this acquisition phase.

~~~powershell
Move-Item -LiteralPath $partial -Destination $pbf -ErrorAction Stop
~~~

### Graph build and API commands for a separate approval

~~~powershell
docker compose -f $compose pull --policy always valhalla
if ($LASTEXITCODE -ne 0) { throw 'Pinned image pull failed.' }
docker compose -f $compose up -d --no-deps --pull never graph-builder
if ($LASTEXITCODE -ne 0) { throw 'Graph builder failed to start.' }
$builder = docker compose -f $compose --profile build ps --all --quiet graph-builder
if (-not $builder) { throw 'Graph builder container not found.' }
~~~

In another PowerShell window from the repository root, monitor the builder. Press Ctrl+C to leave either monitor. Stop the pilot if the builder sustains more than 90% of its memory cap, the engine experiences memory pressure or free disk drops below the reserve.

~~~powershell
$compose = 'ops/kathmandu-valhalla/compose.yaml'
$builder = docker compose -f $compose --profile build ps --all --quiet graph-builder
docker stats $builder
# In a separate window, or after leaving stats
docker compose -f $compose --profile build logs --follow graph-builder
~~~

Back in the first window, wait for the build and record the exit status, OOM flag, timestamps, cgroup peak memory and artifact size. If the build fails, retain the failed output for diagnosis and retry in an empty graph directory after review.

~~~powershell
docker wait $builder
docker inspect --format 'exit={{.State.ExitCode}} oom={{.State.OOMKilled}} started={{.State.StartedAt}} finished={{.State.FinishedAt}}' $builder
$peak = Join-Path $pilot 'build-peak-memory-bytes.txt'
if (Test-Path -LiteralPath $peak) { Get-Content -LiteralPath $peak }
Get-ChildItem -LiteralPath $pilot -Recurse -File | Measure-Object Length -Sum
if ((docker inspect --format '{{.State.ExitCode}} {{.State.OOMKilled}}' $builder) -ne '0 false' -or
    -not (Test-Path -LiteralPath (Join-Path $pilot 'graph.ready'))) { throw 'Graph build did not succeed.' }
docker compose -f $compose up -d --no-deps --pull never valhalla
if ($LASTEXITCODE -ne 0) { throw 'API failed to start.' }
docker compose -f $compose port valhalla 8002
Invoke-RestMethod -Uri 'http://127.0.0.1:8002/status' -TimeoutSec 5
~~~

Confirm the exact loopback binding and a successful status response. The helper captures raw JSON, HTTP status and total time for successes and errors.

~~~powershell
function Invoke-PilotRoute {
  param([string]$Name, [string]$Costing, [hashtable[]]$Locations)
  $request = Join-Path $pilot "$Name-request.json"
  $result = Join-Path $pilot "$Name-response.json"
  @{ costing = $Costing; units = 'kilometers'; locations = $Locations } |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $request -Encoding Ascii
  $curlArgs = @('--silent', '--show-error', '--noproxy', '*', '--max-time', '15',
    '--header', 'Content-Type: application/json', '--data-binary', "@$request",
    '--output', $result, '--write-out', 'HTTP %{http_code}, total %{time_total}s\n',
    'http://127.0.0.1:8002/route')
  curl.exe @curlArgs
  if ($LASTEXITCODE -ne 0) { throw 'Routing transport failed.' }
  Get-Content -LiteralPath $result -Raw | ConvertFrom-Json
}

Invoke-PilotRoute 'kathmandu-walk' 'pedestrian' @(
  @{lon=85.3076; lat=27.7043}, @{lon=85.3139; lat=27.7125}
)
Invoke-PilotRoute 'kathmandu-bike' 'bicycle' @(
  @{lon=85.3139; lat=27.7125}, @{lon=85.3209; lat=27.6951}
)
~~~

Stop only the pilot API. Preserve the container, graph and test artifacts for review.

~~~powershell
docker compose -p stravakinda-kathmandu-pilot -f ops/kathmandu-valhalla/compose.yaml stop valhalla
~~~

## Route test matrix

Coordinates are approximate public landmark pins in longitude/latitude order. Check them against the downloaded OSM snapshot and record any adjustment to a public entrance. Run remaining cases through the same helper. Set `type='break'` on each multi-waypoint location.

| Case | Profile and ordered coordinates | Expected check |
| --- | --- | --- |
| Kathmandu walking | Pedestrian, Kathmandu Durbar Square 85.3076,27.7043 → Garden of Dreams 85.3139,27.7125 | Walkable streets and mapped connections |
| Kathmandu cycling | Bicycle, Garden of Dreams 85.3139,27.7125 → Tundikhel eastern edge near Bhadrakali 85.3209,27.6951 | Bicycle-accessible streets and direction restrictions |
| Lalitpur walking | Pedestrian, Patan Durbar Square 85.3252,27.6733 → Banglamukhi area 85.3269,27.6780 | Continuous old-town street route |
| Bhaktapur walking | Pedestrian, Bhaktapur Durbar Square 85.4278,27.6721 → Dattatreya Square 85.4359,27.6737 | Continuous old-town street route |
| Multiple waypoints | Pedestrian, Kathmandu Durbar Square 85.3076,27.7043 → Asan 85.3120,27.7083 → Garden of Dreams 85.3139,27.7125 | Two legs with a continuous junction near Asan |
| Narrow streets and footpaths | Pedestrian, Asan 85.3120,27.7083 → Indra Chowk 85.3102,27.7059. Also test Swayambhu eastern stair approach 85.2925,27.7145 → near stupa 85.2904,27.7149 | Compare mapped lanes and steps. Record access tags, detours or missing connections. Retest using verified public path entrances if necessary. |
| Unroutable | Pedestrian, Kathmandu Durbar Square 85.3076,27.7043 → Phewa Lake, Pokhara 83.9420,28.2090. Repeat with an in-bounds point confirmed off-network in Taudaha Lake, starting near 85.2803,27.6489, with `search_cutoff=10` on the lake location. | Controlled client error. If the second case unexpectedly snaps, record the snap distance. |
| Invalid requests | One location only, two locations with latitude 95 at the destination, and unsupported costing `invalid-profile` | HTTP 4xx, JSON error code and message, and no successful trip |

For HTTP 200 responses require `trip.status = 0` and record the following. [Pinned route API reference](https://github.com/valhalla/valhalla/blob/3.8.3/docs/docs/api/route/api-reference.md)

- Decode every leg shape as polyline6 and inspect it as a GeoJSON LineString in longitude/latitude order. Reject non-finite coordinates, longitude outside ±180°, latitude outside ±90°, and swapped or implausibly distant points. Count vertices per leg and for the full route after deduplicating shared endpoints. Require at least two distinct vertices per leg.
- Overlay geometry on OSM and inspect turns, access restrictions, crossings and leg junctions. Measure snaps from input pins and investigate snaps beyond 50 m for ordinary cases.
- Record `trip.summary.length` in kilometres and `trip.summary.time` in seconds. Require positive finite values. Compare reported distance with the decoded line length and the straight-line waypoint baseline. Investigate substantial discrepancies and implausible speeds.
- Log HTTP status and Valhalla error fields for negative cases. Distinguish validation errors from missing routable edges or no path. Rerun a known-good route to verify service health.
- Record the first request after API startup separately. Collect 20 sequential warm samples each for representative walking and cycling routes. Record median, p95 and maximum end-to-end time. Use warm p95 below 1 second as an initial pilot target.
- Record graph build wall time, peak bytes from the cgroup counter or highest sampled Docker memory, OOM flag, exit code and artifact size. Store results and evidence in the pilot directory on D:.

## Preparation validation

- `docker compose -f ops/kathmandu-valhalla/compose.yaml --profile build config --quiet` passed. Docker emitted a sandbox warning about access to its user configuration file.
- `npm.cmd run typecheck` and `npm.cmd run lint` passed.
- `npm.cmd test` passed with 303 tests across 49 files.

## Second extract validation

The second download, `D:\planet_85.277_27.696_ab3c99ae.osm.pbf`, is **9,062,530 bytes**, below the **50,000,000-byte** limit. Its SHA-256 is `5c79cbcb9b3743df7584a36d1ccd5e822f8db88621e3641f3aab0a2d6240d245`.

The first download was unavailable at its original path. The existing 355,320-byte pilot copy matches the SHA-256 previously verified for the original, `0f26472bfa7cd92f37acd33e9a6bd295824694e8fd8bc9dc0f414c8f0575fab4`, and served as the comparison file.

| Decoded data | First extract | Second extract |
| --- | ---: | ---: |
| OSM data blocks | 6 | 124 |
| Nodes | 27,037 | 810,101 |
| Ways | 5,225 | 163,583 |
| Relations | 41 | 404 |
| Highway-tagged ways | 283 | 10,560 |
| Missing way-node references | 0 | 0 |

| Extent | West | South | East | North |
| --- | ---: | ---: | ---: | ---: |
| Required Valley rectangle | 85.230000 | 27.580000 | 85.500000 | 27.820000 |
| Second extract header | 85.277000 | 27.668000 | 85.373000 | 27.750000 |
| Second extract nodes and way geometry | 84.540004 | 27.434034 | 85.427319 | 27.881313 |
| Second extract highway geometry | 85.253574 | 27.668219 | 85.376769 | 27.751415 |
| First extract highway geometry | 85.317017 | 27.699783 | 85.337088 | 27.717722 |

Highway geometry falls short on all four sides and has nodes in only 9 of 36 equal grid cells across the required rectangle. The wider all-node bounds include geometry outside the decoded highway extent.

| Pilot matrix landmark | First extract, nearest highway segment | Second extract, nearest highway segment |
| --- | ---: | ---: |
| Kathmandu Durbar Square | 939 m | 36 m |
| Lalitpur (Patan) Durbar Square | 2,968 m | 463 m |
| Bhaktapur Durbar Square | 9,967 m | 5,583 m |

The second extract also has highway segments within 11 m of the Garden of Dreams and 3 m of the Tundikhel pin. The nearest eligible segments to the Kathmandu and Patan pins are in the same connected component in preliminary undirected walking and cycling checks based on shared OSM nodes and basic highway and access tags. The Patan segment is 463 m from the square, and the Banglamukhi segment is 378 m from its pin, leaving gaps in local coverage. Bhaktapur's nearest segments are more than 5 km away, so the extract does not establish a usable corridor to Bhaktapur. These topology checks do not evaluate turn restrictions, directionality or Valhalla route results.

**Decision.** Keep the first extract at the pilot path and retain the second download at its source path. Neither file is ready for a controlled Valley-wide graph build. Request a custom BBBike raw OSM PBF using the full rectangle in the acquisition instructions, then repeat the geometry and corridor checks. The provider-issued URL remains unrecorded. Graph building awaits a validated extract and separate approval.

## Third extract validation

The third download, `D:\planet_85.202,27.385_85.528,28.013.osm.pbf`, is **36,814,022 bytes**, below the **50,000,000-byte** limit. The preserved download and the installed `D:\stravakinda-kathmandu-valhalla\v1\kathmandu-valley.osm.pbf` both have SHA-256 `35f213d76f2a2e38ce6984dd8bb2ba7fb2c779ba4e525c47b897dafe8e12ac8e`. The former pilot file was preserved as `kathmandu-valley.first-extract.osm.pbf` in the same directory and its first-extract checksum was verified.

All 597 OSM data blocks decoded successfully. The file contains 4,072,190 nodes, 684,160 ways, and 1,258 relations. Of the ways, 56,186 carry a `highway` tag, comprising 854,461 segments. Every way-node reference resolved.

| Extent | West | South | East | North |
| --- | ---: | ---: | ---: | ---: |
| Required Valley rectangle | 85.230000 | 27.580000 | 85.500000 | 27.820000 |
| Third extract header | 85.202000 | 27.385000 | 85.528000 | 28.013000 |
| Third extract nodes | 84.540004 | 27.312999 | 85.945644 | 28.164423 |
| Third extract way geometry | 84.540004 | 27.312999 | 85.945644 | 28.164423 |
| Third extract highway geometry | 85.131795 | 27.312999 | 85.558739 | 28.084249 |

Highway nodes occur in all 36 cells of the same equal 6 × 6 grid over the required rectangle, compared with 3 cells and 283 highway-tagged ways in the first extract and 9 cells and 10,560 highway-tagged ways in the second.

| Pilot matrix landmark | First extract, nearest highway | Second extract, nearest highway | Third extract, nearest highway | Third extract, walking / cycling candidates |
| --- | ---: | ---: | ---: | ---: |
| Kathmandu Durbar Square | 939 m | 36 m | 36 m | 36 m / 63 m |
| Patan Durbar Square | 2,968 m | 463 m | 3 m | 3 m / 9 m |
| Bhaktapur Durbar Square | 9,967 m | 5,583 m | 10 m | 10 m / 55 m |

For each profile, the nearest eligible segments to all three squares and the Garden of Dreams, Tundikhel, Banglamukhi, and Dattatreya Square pins share one connected component. The check used shared OSM node IDs, basic highway and access tags, and undirected links. It establishes mapped connectivity across the three cities. Turn restrictions, directionality, actual Valhalla snapping and route results remain untested. The Kathmandu and Bhaktapur cycling candidate distances exceed the runbook's 50 m investigation threshold and should be checked during route testing.

**Decision.** The third extract passes dataset validation and is installed for a controlled Valhalla graph build. The build still awaits separate approval. The provider-issued URL remains unrecorded.

## Phase 1C.3E controlled graph build

Preflight passed. The 36,814,022-byte pilot PBF matched SHA-256 `35f213d76f2a2e38ce6984dd8bb2ba7fb2c779ba4e525c47b897dafe8e12ac8e`. Docker Compose v5.7.0 validated the pilot configuration. The Linux engine reported 12 CPUs and 7,900,774,400 bytes of RAM, with approximately 1.76 GiB of reported Supabase memory use. Free space before the pull was 169.48 GiB on D: and 32.74 GiB on C:. The pilot output directory had no existing graph, and no listener was reported on TCP port 8002.

The pinned Valhalla **3.8.3** Linux amd64 image pulled successfully. Docker reported and locally verified the repository digest `sha256:70b45295d81035e3562e1bbf996a28d5fc55e1ccc5d7e3fff9f297d3b1a1359f` and an image size of **964,046,064 bytes**. The engine storage root is `/var/lib/docker`. The Docker Desktop backing disk was observed at `C:\Users\prade\AppData\Local\Docker\wsl\disk\docker_data.vhdx`. C: had 31.91 GiB free after the pull, above the 5 GiB reserve.

~~~powershell
docker compose -p stravakinda-kathmandu-pilot -f ops/kathmandu-valhalla/compose.yaml up -d --no-deps --pull never graph-builder
~~~

The builder ran `valhalla_build_tiles -c /pilot/valhalla.json -j 1 /pilot/kathmandu-valley.osm.pbf` with one build thread and elevation disabled. Runtime inspection confirmed 1 CPU, 3 GiB RAM with no additional swap, no network, and no restart policy. The container exited **0** with `OOMKilled=false` after **159.67 seconds** of wall time. The measured cgroup memory peak was **174,952,448 bytes (166.85 MiB)**. Across 31 Docker samples, CPU averaged **15.84%** and peaked at **101.35%** as displayed by Docker's interval sampler. The configured one-CPU quota remained in force. Supabase container IDs and states matched before and after. No Supabase containers or volumes were modified.

Artifacts are under `D:\stravakinda-kathmandu-valhalla\v1`. The `tiles\` directory contains **15 nonempty .gph tiles totaling 20,928,744 bytes** across levels 0, 1, and 2. The generated `valhalla.json` is 9,119 bytes, and the zero-byte `graph.ready` marker exists.

| Level | Tiles | Bytes |
| --- | ---: | ---: |
| 0 | 1 | 655,232 |
| 1 | 2 | 1,987,200 |
| 2 | 12 | 18,286,312 |

The build completed tile validation and inter-tile edge binning. The log reported the expected absence of timezone, transit and elevation data. It reported zero possible duplicate edges at every level and no incomplete OSM coverage or tile-generation failures. The build log, resource samples, and cgroup peak are in `phase-1c3e-build.log`, `phase-1c3e-resource-samples.log`, and `build-peak-memory-bytes.txt`.

**Decision.** The artifacts are ready for a separately approved API start and routing test. The API was not started and route behavior remains unverified.

## Phase 1C.3F local routing validation

Preflight verified the pinned Valhalla 3.8.3 digest from Phase 1C.3E, all 15 nonempty graph tiles totaling 20,928,744 bytes, `valhalla.json`, and `graph.ready`. The Linux engine had 12 CPUs and 7.36 GiB RAM, with approximately 1.76 GiB reported in use by running containers. C: had 31.91 GiB free and D: had 169.46 GiB free. Port 8002 was free. Resolved Compose and runtime inspection confirmed the single API service, the `127.0.0.1:8002` host binding, a read-only pilot mount, one CPU, a 3 GiB limit with no additional swap, and restart policy `no`.

~~~powershell
docker compose -p stravakinda-kathmandu-pilot -f ops/kathmandu-valhalla/compose.yaml up -d --no-deps --pull never valhalla
docker compose -p stravakinda-kathmandu-pilot -f ops/kathmandu-valhalla/compose.yaml stop valhalla
~~~

Startup `/status` returned HTTP 200 in 55.7 ms, identified version 3.8.3, and listed only `route` and `status`. Startup logged `stat: No such file or directory` and warnings for the absent tile and traffic archives. Directory-based graph tiles served all positive requests. After testing, Compose stopped the API and released port 8002. The stopped container recorded exit 137 with `OOMKilled=false`. Supabase container IDs and states matched before and after, and its containers and volumes were untouched.

Coordinates below are longitude, latitude. Each positive request returned HTTP 200, Valhalla trip status 0, and “Found route between points.” Vertices count the full decoded polyline6 shape with shared leg endpoints counted once. Snaps are straight-line offsets from input pins to the returned geometry in waypoint order.

| Route | Ordered coordinates | Distance (km) | Duration (s) | Vertices | Snaps (m) |
| --- | --- | ---: | ---: | ---: | --- |
| Kathmandu walk | 85.3076,27.7043 → 85.3139,27.7125 | 1.434 | 1015.743 | 67 | 36.0 / 10.6 |
| Patan walk | 85.3252,27.6733 → 85.3269,27.6780 | 0.690 | 489.168 | 43 | 9.5 / 8.2 |
| Bhaktapur walk | 85.4278,27.6721 → 85.4359,27.6737 | 0.961 | 682.601 | 58 | 9.5 / 10.1 |
| Multi-waypoint walk via Asan | 85.3076,27.7043 → 85.3120,27.7083 → 85.3139,27.7125 | 1.591 | 1125.566 | 93 | 36.0 / 8.8 / 10.6 |
| Asan–Indra Chowk walk | 85.3120,27.7083 → 85.3102,27.7059 | 0.537 | 379.746 | 33 | 8.8 / 6.6 |
| Swayambhu steps | 85.2925,27.7145 → 85.2904,27.7149 | 0.219 | 154.749 | 17 | 9.8 / 12.1 |
| Kathmandu cycle | 85.3139,27.7125 → 85.3209,27.6951 | 2.723 | 561.246 | 75 | 10.6 / 2.9 |
| Kathmandu Durbar Square cycle | 85.3076,27.7043 → 85.3139,27.7125 | 1.652 | 361.513 | 93 | 63.1 / 10.6 |
| Patan cycle | 85.3252,27.6733 → 85.3269,27.6780 | 0.724 | 158.031 | 37 | 9.5 / 8.2 |
| Bhaktapur cycle | 85.4278,27.6721 → 85.4359,27.6737 | 1.315 | 291.501 | 63 | 54.7 / 10.1 |
| Kathmandu–Patan–Bhaktapur cycle via Asan | 85.3076,27.7043 → 85.3120,27.7083 → 85.3252,27.6733 → 85.4278,27.6721 | 18.472 | 3971.205 | 790 | 63.1 / 8.8 / 9.5 / 54.7 |

Decoded shapes followed mapped OSM highways. In an offline comparison against the source PBF, samples spaced at most 8 m along each shape were within approximately 0.1 m of highway geometry. Multi-leg routes had no gap at shared endpoints. About 203 m of the Swayambhu route matched `highway=steps` on OSM ways 24707651 and 925755319. The Asan–Indra Chowk route followed residential streets and a mapped path. Actual cycling snaps at Kathmandu and Bhaktapur Durbar Squares confirmed the earlier concerns and exceeded the 50 m investigation threshold. These are landmark-pin offsets. Field access and bicycle suitability still need physical verification.

| Negative case | HTTP | Valhalla code | Response |
| --- | ---: | ---: | --- |
| Destination latitude 95 | 400 | 130 | Failed to parse location |
| Costing `invalid-profile` | 400 | 125 | No costing method found |
| Phewa Lake outside coverage | 400 | 171 | No suitable edges near location |
| Taudaha Lake with 10 m search cutoff | 400 | 171 | No suitable edges near location |
| Truncated JSON body | 400 | 100 | Failed to parse json request |
| One waypoint | 400 | 120 | Insufficient number of locations provided |
| 100 waypoints | 400 | 150 | Exceeded max locations: 50 |

Post-failure `/status` returned HTTP 200 in 14.2 ms, and all 40 subsequent warm requests succeeded. The first route took 251.8 ms. For 20 sequential warm Kathmandu requests per profile, walking median/p95/max latency was 5.6/7.1/11.7 ms and cycling was 7.2/8.7/8.8 ms. Six Docker spot samples during the run showed 76.38–77.69 MiB RAM and 0.15–0.20% CPU. These are observed samples. Peak memory and CPU and sustained load capacity remain unmeasured.

Evidence is preserved under `D:\stravakinda-kathmandu-valhalla\v1\phase-1c3f-OTsBYV`, including `api.log`, raw requests and responses, decoded GeoJSON shapes, and `summary.json` with timings, resources and isolation checks.

**Decision.** The results support prototyping a Valhalla adapter against the local API. Before Android integration, verify bicycle-accessible pins at both Durbar Squares, define how the adapter handles long snaps and Valhalla errors, and agree on a separately approved device-reachable test setup. Android integration and physical-device routing remain untested.

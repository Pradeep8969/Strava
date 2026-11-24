#!/bin/sh
set -eu

test -s /pilot/kathmandu-valley.osm.pbf
if [ -e /pilot/tiles ] || [ -e /pilot/graph.ready ]; then
    echo "Use an empty graph directory before building." >&2
    exit 1
fi

valhalla_build_config > /pilot/valhalla.json
python3 - <<'PY'
import json
from pathlib import Path

path = Path("/pilot/valhalla.json")
config = json.loads(path.read_text())
mjolnir = config["mjolnir"]
mjolnir["tile_dir"] = "/pilot/tiles"
mjolnir["concurrency"] = 1
mjolnir["max_cache_size"] = 128 * 1024 * 1024
mjolnir["data_processing"]["use_admin_db"] = False
for key in ("tile_extract", "traffic_extract", "admin", "timezone", "transit_dir"):
    mjolnir[key] = ""
config["additional_data"]["elevation"] = ""
config["loki"]["actions"] = ["status", "route"]
path.write_text(json.dumps(config, indent=2) + "\n")
PY

if [ -r /sys/fs/cgroup/memory.peak ]; then
    trap 'cat /sys/fs/cgroup/memory.peak > /pilot/build-peak-memory-bytes.txt' 0
fi
valhalla_build_tiles -c /pilot/valhalla.json -j 1 /pilot/kathmandu-valley.osm.pbf
test -n "$(find /pilot/tiles -name '*.gph' -print -quit)"
touch /pilot/graph.ready

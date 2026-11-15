import { useEffect, useMemo, useRef, useState } from "react";
import { areaRegions } from "../features/discovery/catalog";
import {
  mapConfiguration,
  routeFeatures,
  validCoordinate,
  type DiscoveryMapProps,
  type MapRoute,
} from "../features/discovery/map-data";
import {
  loadMapLibre,
  type BrowserMap,
  type BrowserMarker,
  type MapLibre,
} from "../features/discovery/maplibre.web";
import { useColors } from "./ui";
const emptyRoutes: MapRoute[] = [];
export default function DiscoveryMap({
  area = "valley",
  points,
  height = 330,
  routes = emptyRoutes,
  selectedId,
  onSelect,
  onWaypoint,
  fitRequest = 0,
}: DiscoveryMapProps) {
  const c = useColors();
  const host = useRef<HTMLDivElement>(null),
    map = useRef<BrowserMap | null>(null),
    library = useRef<MapLibre | null>(null);
  const [status, setStatus] = useState("Loading map "),
    [ready, setReady] = useState(0),
    [retry, setRetry] = useState(0),
    [terrain, setTerrain] = useState(false);
  const [offline, setOffline] = useState(false),
    [locationStatus, setLocationStatus] = useState("");
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<{ name: string; center: number[] }[]>([]),
    [searchStatus, setSearchStatus] = useState("");
  const key = process.env.EXPO_PUBLIC_MAPTILER_KEY;
  const config =
    typeof window === "undefined"
      ? null
      : mapConfiguration(
          key,
          process.env.EXPO_PUBLIC_MAP_DEVELOPMENT === "true",
          window.location.hostname,
          terrain,
        );
  const style = config?.style;
  const geometry = useMemo(
    () =>
      points?.length
        ? [
            {
              id: "selected",
              title: "Saved waypoint plan",
              points,
              kind: "plan" as const,
            },
          ]
        : routes,
    [points, routes],
  );
  const latest = useRef({ area, geometry, selectedId, onSelect, onWaypoint });
  latest.current = { area, geometry, selectedId, onSelect, onWaypoint };
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!style || !host.current) {
      setStatus(
        "Map not configured. Add a restricted MapTiler public key to enable the live map.",
      );
      return;
    }
    let disposed = false;
    let instance: BrowserMap | undefined;
    let observer: ResizeObserver | undefined;
    const timeout = setTimeout(() => {
      if (!disposed)
        setStatus(
          "Map is taking too long to load. Check your connection and retry.",
        );
    }, 25000);
    setStatus("Loading map ");
    void loadMapLibre()
      .then((lib) => {
        if (disposed || !host.current) return;
        library.current = lib;
        const region = areaRegions[latest.current.area];
        instance = new lib.Map({
          container: host.current,
          style,
          center: [region.longitude, region.latitude],
          zoom: 11,
          attributionControl: false,
          keyboard: true,
        });
        map.current = instance;
        instance.addControl(
          new lib.NavigationControl({ showCompass: false }),
          "top-right",
        );
        instance.addControl(
          new lib.AttributionControl({
            compact: false,
            customAttribution: key
              ? '<a href="https://www.maptiler.com/copyright/">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>'
              : undefined,
          }),
        );
        instance
          .getCanvas()
          .setAttribute(
            "aria-label",
            "Interactive geographic map. Arrow keys pan; plus and minus zoom.",
          );
        instance.on("click", (event) => {
          const coordinate = {
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
          };
          if (validCoordinate(coordinate))
            latest.current.onWaypoint?.(coordinate);
        });
        instance.on("load", () => {
          clearTimeout(timeout);
          if (!disposed) {
            setStatus("");
            setReady((v) => v + 1);
          }
        });
        instance.on("style.load", () => {
          if (!disposed) {
            setStatus("");
            setReady((v) => v + 1);
          }
        });
        instance.on("error", () => {
          if (!disposed)
            setStatus(
              "Map provider unavailable or some tiles failed. Check connection, key and quota, then retry.",
            );
        });
        observer = new ResizeObserver(() => instance?.resize());
        observer.observe(host.current);
      })
      .catch(() => {
        clearTimeout(timeout);
        if (!disposed)
          setStatus("Unable to load the map. Check your connection and retry.");
      });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      observer?.disconnect();
      instance?.remove();
      map.current = null;
    };
    // Styles switch separately; data and region updates never recreate the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry, Boolean(style)]);
  const previousStyle = useRef(style);
  useEffect(() => {
    if (map.current && style && previousStyle.current !== style) {
      setStatus("Loading map style ");
      map.current.setStyle(style);
    }
    previousStyle.current = style;
  }, [style]);
  useEffect(() => {
    const instance = map.current,
      lib = library.current;
    if (!instance || !lib || !ready || !instance.isStyleLoaded()) return;
    const data = routeFeatures(geometry);
    if (instance.getSource("routes"))
      instance.getSource("routes")!.setData(data);
    else {
      instance.addSource("routes", { type: "geojson", data });
      instance.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        paint: { "line-color": "#ED633E", "line-width": 4 },
        layout: { "line-join": "round", "line-cap": "round" },
      });
    }
    const markers = onWaypoint
      ? geometry.flatMap((route) =>
          route.points.filter(validCoordinate).map((point, index) => {
            const element = document.createElement("span");
            element.textContent = String(index + 1);
            element.setAttribute("aria-label", "Waypoint " + (index + 1));
            element.style.cssText =
              "background:#ED633E;color:white;border:2px solid white;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;font-weight:bold;pointer-events:none";
            return new lib.Marker({ element })
              .setLngLat([point.longitude, point.latitude])
              .addTo(instance);
          }),
        )
      : geometry.flatMap((route) => {
          const point = route.points.find(validCoordinate);
          if (!point) return [];
          const button = document.createElement("button");
          button.textContent = "\u25cf";
          button.title = `${route.title}   ${route.kind === "plan" ? "Straight-line plan" : "Recorded GPS"}`;
          button.setAttribute("aria-label", button.title);
          button.style.cssText =
            "background:#fff;color:#255E49;border:2px solid #255E49;border-radius:50%;width:36px;height:36px;cursor:pointer";
          button.onclick = () => {
            latest.current.onSelect?.(route.id);
            const p = route.points.filter(validCoordinate);
            if (p.length) fit(p.map((v) => [v.longitude, v.latitude]));
          };
          return [
            new lib.Marker({ element: button })
              .setLngLat([point.longitude, point.latitude])
              .addTo(instance),
          ];
        });
    return () => markers.forEach((marker) => marker.remove());
  }, [geometry, ready, onWaypoint]);
  function fit(coordinates: number[][]) {
    if (!coordinates.length) return;
    const lng = coordinates.map((p) => p[0]),
      lat = coordinates.map((p) => p[1]);
    map.current?.fitBounds(
      [
        [Math.min(...lng), Math.min(...lat)],
        [Math.max(...lng), Math.max(...lat)],
      ],
      { padding: 45, maxZoom: 15, duration: 0 },
    );
  }
  const previousFit = useRef({ request: -1, ready: -1 });
  useEffect(() => {
    if (!ready) return;
    if (onWaypoint) {
      if (
        previousFit.current.request === fitRequest &&
        previousFit.current.ready === ready
      )
        return;
      previousFit.current = { request: fitRequest, ready };
    }
    const selected =
      geometry.find((r) => r.id === selectedId) ??
      (points?.length ? geometry[0] : undefined);
    if (selected)
      fit(
        selected.points
          .filter(validCoordinate)
          .map((p) => [p.longitude, p.latitude]),
      );
    else {
      const region = areaRegions[area];
      map.current?.flyTo({
        center: [region.longitude, region.latitude],
        zoom: 11,
        duration: 0,
      });
    }
  }, [area, selectedId, geometry, points, ready, fitRequest, onWaypoint]);
  const userMarker = useRef<BrowserMarker | null>(null),
    locationAttempt = useRef(0);
  useEffect(
    () => () => {
      locationAttempt.current++;
      userMarker.current?.remove();
    },
    [],
  );
  function locate() {
    const attempt = ++locationAttempt.current;
    if (!navigator.geolocation) {
      setLocationStatus("Location is unavailable in this browser.");
      return;
    }
    setLocationStatus("Requesting location permission ");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (
          attempt !== locationAttempt.current ||
          !map.current ||
          !library.current
        )
          return;
        const coord = [position.coords.longitude, position.coords.latitude];
        userMarker.current?.remove();
        userMarker.current = new library.current.Marker({ color: "#2463eb" })
          .setLngLat(coord)
          .addTo(map.current);
        map.current.flyTo({ center: coord, zoom: 14 });
        setLocationStatus(
          "Location shown on this device. No route was shared.",
        );
      },
      (error) => {
        if (attempt === locationAttempt.current)
          setLocationStatus(
            error.code === 1
              ? "Location permission denied. You can still explore the map."
              : "Unable to get your location. Try again outdoors.",
          );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  useEffect(() => {
    const controller = new AbortController();
    if (!key || query.trim().length < 3) return;
    const timer = setTimeout(() => {
      setSearchStatus("Searching places ");
      void fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(query.trim())}.json?key=${encodeURIComponent(key)}&country=np&limit=5`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error();
          return response.json();
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          setResults(
            (data.features ?? [])
              .filter(
                (f: { center?: number[] }) =>
                  f.center?.length === 2 &&
                  validCoordinate({
                    longitude: f.center[0],
                    latitude: f.center[1],
                  }),
              )
              .map((f: { place_name: string; center: number[] }) => ({
                name: f.place_name,
                center: f.center,
              })),
          );
          setSearchStatus("Choose a place from the results.");
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults([]);
            setSearchStatus(
              "Place search unavailable. Try a city selector instead.",
            );
          }
        });
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, query]);
  const buttonStyle = {
    fontFamily: "inherit",
    fontSize: 12,
    minHeight: 40,
    borderRadius: 8,
    border: `1px solid ${c.border}`,
    background: c.panel,
    color: c.text,
    padding: "6px 10px",
    cursor: "pointer",
  };
  return (
    <section
      aria-label={`Interactive map of ${area === "valley" ? "Kathmandu Valley" : "Pokhara"}`}
      style={{
        fontFamily: "Arial, sans-serif",
        color: c.text,
        background: c.panel,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8 }}>
        <button
          style={buttonStyle}
          disabled={!ready || offline}
          onClick={locate}
        >
          My location
        </button>
        <button
          style={buttonStyle}
          disabled={!key}
          aria-pressed={terrain}
          onClick={() => setTerrain((v) => !v)}
        >
          {terrain ? "Street map" : "Outdoor map"}
        </button>
        {key ? (
          <input
            aria-label="Search map places"
            placeholder="Search places in Nepal"
            value={query}
            onChange={(e) => {
              setResults([]);
              setQuery(e.target.value);
            }}
            style={{
              ...buttonStyle,
              width: 190,
              maxWidth: "100%",
              boxSizing: "border-box",
            }}
          />
        ) : null}
      </div>
      {results.map((r, i) => (
        <button
          key={i}
          style={buttonStyle}
          onClick={() => {
            map.current?.flyTo({ center: r.center, zoom: 14 });
            setResults([]);
            setQuery("");
          }}
        >
          {r.name}
        </button>
      ))}
      <div style={{ position: "relative", height }}>
        <div
          ref={host}
          style={{ width: "100%", height: "100%", background: c.greenSoft }}
        />
        {status || offline ? (
          <div
            role="status"
            style={{
              position: "absolute",
              left: 12,
              right: 50,
              top: 12,
              background: c.panel,
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {offline
              ? "You are offline. Base-map tiles require internet; saved geometry stays on this device."
              : status}
            {style && !status.startsWith("Loading") ? (
              <button
                style={buttonStyle}
                onClick={() => {
                  setReady(0);
                  locationAttempt.current++;
                  setRetry((v) => v + 1);
                }}
              >
                Retry map
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        aria-live="polite"
        style={{ padding: "7px 10px", fontSize: 11, lineHeight: "17px" }}
      >
        {config?.development
          ? "DEVELOPMENT STYLE   MapLibre demo tiles   local testing only. "
          : ""}
        {!geometry.length
          ? "No saved route geometry. "
          : "Orange lines: your saved geometry; plans use straight lines. "}
        {locationStatus ||
          searchStatus ||
          "Use arrow keys to pan and + / - to zoom. Location is requested only when you choose My location."}
        {key
          ? " Place searches are sent to MapTiler; your GPS and route geometry are not uploaded."
          : null}
      </div>
    </section>
  );
}

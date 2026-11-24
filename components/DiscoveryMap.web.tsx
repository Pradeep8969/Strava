import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { areaPlaces, areaRegions } from "../features/discovery/catalog";
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
import {
  clearMapMarkers,
  syncMapMarkers,
  type MarkerCache,
  type MapMarker,
} from "../features/discovery/map-markers.web";
import {
  mapOnlyLocation,
  type MapLocation,
} from "../features/discovery/map-location";
import { demoRouteColor } from "../features/routes/demo-preview";
import { kathmanduRegion } from "../features/maps/dedicated";
import {
  coordinateBounds,
  lngLat,
  regionCamera,
} from "../features/maps/native-camera";
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
  tracking = false,
  variant = tracking ? "record" : onWaypoint ? "planner" : "explore",
  tone = "default",
  demoCoordinates,
  dedicated,
}: DiscoveryMapProps) {
  const palette = useColors();
  const c =
    tone === "dark"
      ? {
          ...palette,
          panel: "#202D34",
          text: "#ECF4F7",
          border: "#3A4A53",
          greenSoft: "#263A43",
          muted: "#B2C4CD",
        }
      : palette;
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
  const [following, setFollowing] = useState(true);
  const [locating, setLocating] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const markers = useRef<MarkerCache>(new Map());
  const loading = useRef({ pending: true, applied: true, error: false });
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastCamera = useRef("");
  const acceptedPoint = useMemo(
    () =>
      tracking
        ? routes
            .find((route) => route.kind === "recording")
            ?.points.filter(validCoordinate)
            .at(-1)
        : undefined,
    [routes, tracking],
  );
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
  const dedicatedMode = !!dedicated;
  const dedicatedReady = dedicated?.onReady;
  const dedicatedPin = dedicated?.pin;
  useImperativeHandle(
    dedicated?.mapRef,
    () => ({
      centerOn: (point, zoom, duration = 250) =>
        map.current?.flyTo({ center: lngLat(point), zoom, duration }),
      animateToRegion: (region, duration) =>
        map.current?.flyTo({ ...regionCamera(region), duration }),
      async resetNorth() {
        map.current?.resetNorth?.();
      },
      fitToCoordinates(points, { edgePadding, animated }) {
        const bounds = coordinateBounds(points);
        if (bounds)
          map.current?.fitBounds([bounds.slice(0, 2), bounds.slice(2)], {
            padding: edgePadding,
            maxZoom: 16,
            duration: animated ? 350 : 0,
          });
      },
    }),
    [],
  );
  useEffect(() => {
    if (ready) dedicatedReady?.();
  }, [ready, dedicatedReady]);
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
  const latest = useRef({
    area,
    geometry,
    selectedId,
    onSelect,
    onWaypoint,
    acceptedPoint,
    onGesture: dedicated?.onGesture,
  });
  latest.current = {
    area,
    geometry,
    selectedId,
    onSelect,
    onWaypoint,
    acceptedPoint,
    onGesture: dedicated?.onGesture,
  };
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
    const markerCache = markers.current;
    let instance: BrowserMap | undefined;
    let observer: ResizeObserver | undefined;
    let frame = 0,
      resizeFrame = 0;
    loading.current = { pending: true, applied: true, error: false };
    loadTimer.current = setTimeout(() => {
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
        const region = dedicatedMode
          ? kathmanduRegion
          : areaRegions[latest.current.area];
        instance = new lib.Map({
          container: host.current,
          style,
          center: [region.longitude, region.latitude],
          zoom: dedicatedMode ? regionCamera(region).zoom : 11,
          attributionControl: false,
          keyboard: true,
        });
        map.current = instance;
        if (!dedicatedMode)
          instance.addControl(
            new lib.NavigationControl({ showCompass: false }),
            "top-right",
          );
        instance.addControl(
          new lib.AttributionControl({
            compact: false,
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
        instance.on("movestart", (event) => {
          if (event.originalEvent) {
            latest.current.onGesture?.();
            lastCamera.current = "";
            setFollowing(false);
          }
        });
        const settle = () => {
          if (frame || disposed || !loading.current.pending) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            if (
              disposed ||
              !loading.current.pending ||
              !loading.current.applied ||
              !instance?.isStyleLoaded()
            )
              return;
            loading.current.pending = false;
            clearTimeout(loadTimer.current);
            if (!loading.current.error) setStatus("");
            setReady((value) => value + 1);
          });
        };
        // Style diffs need not emit style.load; source/data/idle also establish readiness.
        for (const event of [
          "load",
          "style.load",
          "styledata",
          "sourcedata",
          "idle",
        ])
          instance.on(event, settle);
        instance.on("error", () => {
          if (disposed) return;
          clearTimeout(loadTimer.current);
          loading.current.error = true;
          setStatus(
            "Map provider unavailable or some tiles failed. Check connection, key and quota, then retry.",
          );
        });
        let lastSize = "";
        observer = new ResizeObserver((entries) => {
          const rectangle = entries[0]?.contentRect;
          const size = `${rectangle?.width}:${rectangle?.height}`;
          if (size === lastSize || resizeFrame) return;
          lastSize = size;
          resizeFrame = requestAnimationFrame(() => {
            resizeFrame = 0;
            if (!disposed) instance?.resize();
          });
        });
        observer.observe(host.current);
      })
      .catch(() => {
        clearTimeout(loadTimer.current);
        if (!disposed)
          setStatus("Unable to load the map. Check your connection and retry.");
      });
    return () => {
      disposed = true;
      clearTimeout(loadTimer.current);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
      observer?.disconnect();
      clearMapMarkers(markerCache);
      lastCamera.current = "";
      userMarker.current?.remove();
      userMarker.current = null;
      locationPending.current = false;
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
      loading.current = { pending: true, applied: false, error: false };
      clearTimeout(loadTimer.current);
      loadTimer.current = setTimeout(
        () =>
          setStatus(
            "Map style is taking too long to load. Check your connection and retry.",
          ),
        25000,
      );
      const targetMap = map.current;
      map.current.setStyle(style, {
        transformStyle: (_previous, next) => {
          if (map.current === targetMap) loading.current.applied = true;
          return next;
        },
      });
    }
    previousStyle.current = style;
  }, [style]);
  const routeData = useMemo(() => routeFeatures(geometry), [geometry]);
  useEffect(() => {
    const instance = map.current;
    // An existing GeoJSON worker may be busy; setData queues the latest update.
    // isStyleLoaded() also includes that worker and would silently drop edits.
    if (!instance || !ready || loading.current.pending) return;
    try {
      const existing = instance.getSource("routes");
      if (existing) existing.setData(routeData);
      else instance.addSource("routes", { type: "geojson", data: routeData });
      if (!instance.getLayer("routes"))
        instance.addLayer({
          id: "routes",
          type: "line",
          source: "routes",
          paint: {
            "line-color": dedicatedMode ? "#087B77" : "#ED633E",
            "line-width": dedicatedMode ? 5 : 4,
          },
          layout: { "line-join": "round", "line-cap": "round" },
        });
    } catch {
      const timer = setTimeout(
        () =>
          setStatus(
            "Map provider unavailable or route rendering failed. Retry the map; GPS recording remains independent.",
          ),
        0,
      );
      return () => clearTimeout(timer);
    }
  }, [routeData, ready, dedicatedMode]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || loading.current.pending) return;
    const id = "route-studio-demo";
    const existing = instance.getSource(id);
    if (!existing && !demoCoordinates) return;
    const data = {
      type: "FeatureCollection",
      features: demoCoordinates
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: demoCoordinates },
            },
          ]
        : [],
    };
    try {
      if (existing) existing.setData(data);
      else instance.addSource(id, { type: "geojson", data });
      if (!instance.getLayer(id))
        instance.addLayer({
          id,
          type: "line",
          source: id,
          paint: { "line-color": demoRouteColor, "line-width": 4 },
          layout: { "line-join": "round", "line-cap": "round" },
        });
    } catch {
      const timer = setTimeout(
        () => setStatus("Could not draw the demo geometry. Retry the map."),
        0,
      );
      return () => clearTimeout(timer);
    }
  }, [demoCoordinates, ready]);
  useEffect(() => {
    if (map.current?.getLayer("routes"))
      map.current.setPaintProperty("routes", "line-color", [
        "case",
        [
          "==",
          ["get", variant === "record" ? "kind" : "id"],
          variant === "record" ? "plan" : (selectedId ?? ""),
        ],
        "#167F83",
        "#ED633E",
      ]);
  }, [selectedId, ready, variant]);
  useEffect(() => {
    const instance = map.current,
      lib = library.current;
    if (!instance || !lib || !ready) return;
    const items: MapMarker[] = [];
    if (onWaypoint) {
      for (const route of geometry)
        route.points.filter(validCoordinate).forEach((point, index) =>
          items.push({
            id: route.id + ":waypoint:" + index,
            ...point,
            label: "Waypoint " + (index + 1),
            text: String(index + 1),
            kind: "waypoint",
          }),
        );
    } else if (dedicatedMode) {
      const points = geometry[0]?.points.filter(validCoordinate);
      if (points && points.length > 1) {
        items.push({
          id: "start",
          ...points[0],
          label: "Route start",
          text: "S",
          kind: "waypoint",
        });
        items.push({
          id: "finish",
          ...points[points.length - 1],
          label: "Route finish",
          text: "F",
          kind: "waypoint",
        });
      }
      if (dedicatedPin)
        items.push({
          id: "map-pin",
          ...dedicatedPin,
          text: "◆",
          kind: "place",
        });
    } else if (!tracking) {
      for (const route of geometry) {
        const point = route.points.find(validCoordinate);
        if (point)
          items.push({
            id: "route:" + route.id,
            ...point,
            label:
              route.title +
              "   " +
              (route.kind === "plan" ? "Straight-line plan" : "Recorded GPS"),
            text: "●",
            kind: "route",
            selected: route.id === selectedId,
            onClick: () => {
              if (
                latest.current.onSelect &&
                latest.current.selectedId !== route.id
              )
                latest.current.onSelect(route.id);
              else
                fit(
                  route.points
                    .filter(validCoordinate)
                    .map((p) => [p.longitude, p.latitude]),
                );
            },
          });
      }
    }
    if (variant === "explore" && !dedicatedMode)
      for (const place of areaPlaces[area])
        items.push({
          id: "place:" + area + place.name,
          ...place,
          kind: "place",
          text: "◇",
          label: place.name + " · Destination reference, not a verified trail",
          onClick: () => {
            instance.flyTo({
              center: [place.longitude, place.latitude],
              zoom: 13,
              duration: 300,
            });
            setLocationStatus(
              place.name + " · Destination reference, not a verified trail",
            );
          },
        });
    if (acceptedPoint)
      items.push({
        id: "accepted-location",
        ...acceptedPoint,
        kind: "accepted",
        text: "",
        label: "Latest accepted GPS location",
      });
    syncMapMarkers(lib, instance, markers.current, items);
  }, [
    geometry,
    ready,
    onWaypoint,
    tracking,
    area,
    selectedId,
    acceptedPoint,
    variant,
    dedicatedMode,
    dedicatedPin,
  ]);
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
  const previousFit = useRef("");
  useEffect(() => {
    if (!ready || tracking || dedicatedMode) return;
    const intent = JSON.stringify([area, selectedId, fitRequest, retry]);
    if (previousFit.current === intent) return;
    previousFit.current = intent;
    const selected =
      geometry.find((r) => r.id === selectedId) ??
      (points?.length ? geometry[0] : undefined);
    if (demoCoordinates) fit(demoCoordinates.map(([lon, lat]) => [lon, lat]));
    else if (selected)
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
  }, [
    area,
    selectedId,
    geometry,
    points,
    ready,
    fitRequest,
    tracking,
    retry,
    demoCoordinates,
    dedicatedMode,
  ]);
  const acceptedLongitude = acceptedPoint?.longitude;
  const acceptedLatitude = acceptedPoint?.latitude;
  useEffect(() => {
    if (acceptedLongitude !== undefined && acceptedLatitude !== undefined) {
      userMarker.current?.remove();
      userMarker.current = null;
    }
    if (
      ready &&
      tracking &&
      following &&
      acceptedLongitude !== undefined &&
      acceptedLatitude !== undefined
    ) {
      const target = `${acceptedLongitude}:${acceptedLatitude}`;
      if (lastCamera.current !== target) {
        lastCamera.current = target;
        map.current?.flyTo({
          center: [acceptedLongitude, acceptedLatitude],
          zoom: 15,
          duration: 300,
        });
      }
    }
  }, [acceptedLongitude, acceptedLatitude, ready, tracking, following]);
  function recenter() {
    if (tracking) {
      const accepted = latest.current.acceptedPoint;
      if (accepted) centerAccepted(accepted);
      else if (
        mapLocation.current &&
        Date.now() - mapLocation.current.timestamp <= 60000
      )
        centerApproximate(mapLocation.current);
      else locate();
      return;
    }
    const selected =
      geometry.find((route) => route.id === selectedId) ??
      (points?.length ? geometry[0] : undefined);
    if (demoCoordinates) fit(demoCoordinates.map(([lon, lat]) => [lon, lat]));
    else if (selected)
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
        duration: 400,
      });
    }
  }
  const userMarker = useRef<BrowserMarker | null>(null),
    locationAttempt = useRef(0);
  const mapLocation = useRef<MapLocation | null>(null);
  const locationPending = useRef(false);
  function centerAccepted(point: { longitude: number; latitude: number }) {
    map.current?.stop?.();
    map.current?.flyTo({
      center: [point.longitude, point.latitude],
      zoom: 15,
      duration: 300,
    });
    lastCamera.current = `${point.longitude}:${point.latitude}`;
    setFollowing(true);
    userMarker.current?.remove();
    userMarker.current = null;
    setLocationStatus("Centered on the latest accepted GPS location.");
  }
  function centerApproximate(point: MapLocation) {
    if (!map.current || !library.current) return;
    userMarker.current?.remove();
    const element = document.createElement("span");
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "Approximate map-only location");
    element.style.cssText =
      "display:block;width:18px;height:18px;border-radius:50%;background:#2C73B9;border:3px solid white;box-shadow:0 0 0 6px #2C73B933";
    userMarker.current = new library.current.Marker({ element })
      .setLngLat([point.longitude, point.latitude])
      .addTo(map.current);
    map.current.stop?.();
    map.current.flyTo({
      center: [point.longitude, point.latitude],
      zoom: 14,
      duration: 300,
    });
    setLocationStatus(
      `Approximate location: about ${Math.ceil(point.accuracy)} m. Map only; recording still requires 35 m or better.`,
    );
  }
  useEffect(
    () => () => {
      locationAttempt.current++;
      userMarker.current?.remove();
    },
    [],
  );
  function locate() {
    if (locationPending.current) return;
    if (!window.isSecureContext) {
      setLocationStatus("Map location requires HTTPS or localhost.");
      return;
    }
    const attempt = ++locationAttempt.current;
    if (!navigator.geolocation) {
      setLocationStatus("Location is unavailable in this browser.");
      return;
    }
    setLocationStatus("Requesting location permission ");
    locationPending.current = true;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (
          attempt !== locationAttempt.current ||
          !map.current ||
          !library.current
        )
          return;
        locationPending.current = false;
        setLocating(false);
        const accepted = latest.current.acceptedPoint;
        if (tracking && accepted) {
          centerAccepted(accepted);
          return;
        }
        const point = mapOnlyLocation(position);
        if (!point) {
          setLocationStatus(
            "The browser returned stale or invalid map location. Retry location access.",
          );
          return;
        }
        mapLocation.current = point;
        centerApproximate(point);
      },
      (error) => {
        if (attempt === locationAttempt.current) {
          locationPending.current = false;
          setLocating(false);
          setLocationStatus(
            error.code === 1
              ? "Location permission denied. You can still explore the map."
              : error.code === 3
                ? "Map location timed out. Retry location access."
                : "Location is unavailable. Check device location services and retry.",
          );
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  useEffect(() => {
    const controller = new AbortController();
    if (dedicatedMode || !key || query.trim().length < 3) return;
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
  }, [key, query, dedicatedMode]);
  const buttonStyle = {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    minHeight: 44,
    borderRadius: 10,
    border: `1px solid ${c.border}`,
    background: c.panel,
    color: c.text,
    padding: "8px 12px",
    cursor: "pointer",
  };
  return (
    <section
      className="sk-map"
      aria-label={`Interactive map of ${area === "valley" ? "Kathmandu Valley" : "Pokhara"}`}
      style={{
        fontFamily: "Arial, sans-serif",
        color: c.text,
        background: c.panel,
        border: dedicatedMode ? undefined : `1px solid ${c.border}`,
        borderRadius: dedicatedMode ? 0 : 16,
        height: dedicatedMode ? "100%" : undefined,
        overflow: "hidden",
      }}
    >
      <style>
        {
          ".sk-map button:disabled{opacity:.45;cursor:not-allowed}.sk-map button:focus-visible,.sk-map input:focus-visible{outline:3px solid #38a6a3;outline-offset:2px}.sk-map .maplibregl-ctrl-group button{width:44px;height:44px}.sk-map .maplibregl-ctrl-attrib{font-size:11px}"
        }
      </style>
      {!dedicatedMode ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            padding: 10,
          }}
        >
          <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
            {tracking ? (
              <button
                style={buttonStyle}
                aria-label="Follow location"
                title="Follow accepted workout GPS only"
                disabled={!ready || !acceptedPoint}
                aria-pressed={following ? Boolean(acceptedPoint) : false}
                onClick={() => {
                  lastCamera.current = "";
                  setFollowing((value) => !value);
                }}
              >
                Follow
              </button>
            ) : (
              <button
                style={buttonStyle}
                disabled={!ready || locating || offline}
                onClick={locate}
              >
                My location
              </button>
            )}
            <button
              style={buttonStyle}
              aria-label={tracking ? "Recenter location" : "Recenter map"}
              disabled={!ready || locating}
              onClick={recenter}
            >
              {locating ? "Locating..." : "Recenter"}
            </button>
          </div>
          <button
            style={buttonStyle}
            aria-label="Map options"
            aria-expanded={optionsOpen}
            onClick={() => setOptionsOpen((value) => !value)}
          >
            Options
          </button>
        </div>
      ) : null}
      {!dedicatedMode && optionsOpen ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            padding: "0 10px 10px",
            borderBottom: "1px solid " + c.border,
          }}
        >
          <button
            style={buttonStyle}
            disabled={!key || !ready || status.startsWith("Loading")}
            aria-pressed={terrain}
            onClick={() => setTerrain((value) => !value)}
          >
            {terrain ? "Street map" : "Outdoor map"}
          </button>
          {key ? (
            <input
              aria-label="Search map places"
              placeholder="Search places in Nepal"
              value={query}
              onChange={(event) => {
                setResults([]);
                setQuery(event.target.value);
              }}
              style={{
                ...buttonStyle,
                flex: "1 1 160px",
                width: 160,
                minWidth: 0,
                boxSizing: "border-box",
              }}
            />
          ) : null}
          {key ? (
            <span
              style={{
                fontSize: 12,
                lineHeight: "18px",
                color: c.muted,
                flexBasis: "100%",
              }}
            >
              Place searches are sent to MapTiler. Saved route geometry stays on
              this device.
            </span>
          ) : null}
        </div>
      ) : null}
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
      <div
        style={{
          position: "relative",
          height: dedicatedMode ? "100%" : height,
        }}
      >
        <div
          ref={host}
          style={{ width: "100%", height: "100%", background: c.greenSoft }}
        />
        {key ? (
          <a
            href="https://www.maptiler.com"
            aria-label="MapTiler map provider"
            style={{ position: "absolute", left: 10, bottom: 30, zIndex: 1 }}
          >
            <img
              src="https://api.maptiler.com/resources/logo.svg"
              alt="MapTiler logo"
              width={100}
            />
          </a>
        ) : null}
        {status || offline ? (
          <div
            role="status"
            style={{
              position: "absolute",
              pointerEvents: "none",
              left: 12,
              right: 50,
              top: dedicatedMode ? "40%" : 12,
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
                style={{ ...buttonStyle, pointerEvents: "auto", marginLeft: 8 }}
                onClick={() => {
                  locationPending.current = false;
                  setLocating(false);
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
      {!dedicatedMode ? (
        <div
          aria-live="polite"
          style={{
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: "18px",
            color: c.muted,
          }}
        >
          {config?.development ? "Development map style. " : ""}
          {variant === "explore" && geometry.length === 0
            ? "No saved route geometry. "
            : ""}
          {(tracking &&
          acceptedPoint &&
          locationStatus.startsWith("Approximate")
            ? "Teal marks the latest accepted GPS location."
            : locationStatus) ||
            searchStatus ||
            (tracking
              ? "Teal marks accepted GPS. Recenter can use a map-only position."
              : variant === "activity"
                ? "Recorded GPS. Pauses and signal gaps stay separate."
                : variant === "planner"
                  ? demoCoordinates
                    ? "Orange connects waypoints. Teal shows the synthetic demo."
                    : "Straight-line waypoints, not road-following directions."
                  : geometry.length
                    ? "Orange routes; teal selection. Plans use straight lines."
                    : variant === "explore"
                      ? "Browse Nepal or open Route Studio."
                      : "No saved route geometry.")}
        </div>
      ) : null}
    </section>
  );
}

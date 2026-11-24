import {
  isRouteCoordinate,
  maxRouteCoordinates,
  RoutingError,
  type RouteCoordinate,
  type RoutedPath,
  type RouteWaypointSnap,
  type RoutingProvider,
  type RoutingRequest,
} from "./routing";

const id = "valhalla";
const profiles = ["walking", "running", "cycling"] as const;
export const valhallaMaxWaypoints = 50;
const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const invalidResponse = () =>
  new RoutingError("invalid", "The routing service returned an unusable path.");
const cancelled = () => new RoutingError("cancelled", "Routing cancelled.");
const samePoint = (a: RouteCoordinate, b: RouteCoordinate) =>
  a[0] === b[0] && a[1] === b[1];

function decodeShape(shape: unknown, vertexLimit: number): RouteCoordinate[] {
  if (typeof shape !== "string" || shape.length > vertexLimit * 12)
    throw invalidResponse();
  const points: RouteCoordinate[] = [];
  let offset = 0;
  let lat = 0;
  let lon = 0;
  function delta() {
    let value = 0;
    for (let shift = 0; shift <= 25; shift += 5) {
      const digit = shapeString.charCodeAt(offset++) - 63;
      if (!Number.isFinite(digit) || digit < 0 || digit > 63)
        throw invalidResponse();
      value += (digit & 31) * 2 ** shift;
      if (digit < 32) return value % 2 ? -(value + 1) / 2 : value / 2;
    }
    throw invalidResponse();
  }
  const shapeString = shape;
  while (offset < shapeString.length) {
    if (points.length >= vertexLimit) throw invalidResponse();
    lat += delta();
    lon += delta();
    const point = [lon / 1e6, lat / 1e6] as const;
    if (!isRouteCoordinate(point)) throw invalidResponse();
    points.push(point);
  }
  if (points.length < 2) throw invalidResponse();
  return points;
}

function measureSnap(
  requested: RouteCoordinate,
  snapped: RouteCoordinate,
): RouteWaypointSnap {
  const radians = Math.PI / 180;
  const latDelta = (snapped[1] - requested[1]) * radians;
  const lonDelta = (snapped[0] - requested[0]) * radians;
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(requested[1] * radians) *
      Math.cos(snapped[1] * radians) *
      Math.sin(lonDelta / 2) ** 2;
  const distanceMeters =
    12_742_000 * Math.asin(Math.sqrt(Math.min(1, haversine)));
  return {
    requested,
    snapped,
    distanceMeters,
    severity:
      distanceMeters > 50
        ? "large"
        : distanceMeters > 25
          ? "caution"
          : "normal",
  };
}

export function decodeValhallaRoute(
  body: unknown,
  request: RoutingRequest,
): RoutedPath {
  const trip = record(record(body)?.trip);
  const summary = record(trip?.summary);
  const length = summary?.length;
  const time = summary?.time;
  const legs = trip?.legs;
  const locations = trip?.locations;
  if (
    trip?.status !== 0 ||
    trip.units !== "kilometers" ||
    typeof length !== "number" ||
    !Number.isFinite(length * 1000) ||
    length <= 0 ||
    typeof time !== "number" ||
    !Number.isFinite(time) ||
    time < 0 ||
    !Array.isArray(legs) ||
    legs.length !== request.waypoints.length - 1
  )
    throw invalidResponse();
  if (
    locations !== undefined &&
    (!Array.isArray(locations) ||
      locations.length !== request.waypoints.length ||
      !locations.every((value, index) => {
        const location = record(value);
        return (
          isRouteCoordinate([location?.lon, location?.lat]) &&
          (location?.original_index === undefined ||
            location.original_index === index)
        );
      }))
  )
    throw invalidResponse();

  const coordinates: RouteCoordinate[] = [];
  const waypointIndices = [0];
  for (const leg of legs) {
    const previous = coordinates.at(-1);
    const points = decodeShape(
      record(leg)?.shape,
      maxRouteCoordinates - coordinates.length + Number(!!previous),
    );
    if (previous && !samePoint(previous, points[0])) throw invalidResponse();
    for (let i = previous ? 1 : 0; i < points.length; i++)
      coordinates.push(points[i]);
    waypointIndices.push(coordinates.length - 1);
  }
  if (!coordinates.some((point) => !samePoint(point, coordinates[0])))
    throw invalidResponse();
  return {
    geometry: { type: "LineString", coordinates },
    distanceMeters: length * 1000,
    durationSeconds: time,
    waypointIndices,
    // Valhalla 3.8.3 echoes input pins in trip.locations. Leg endpoints carry the snaps.
    waypointSnaps: waypointIndices.map((index, i) =>
      measureSnap(request.waypoints[i], coordinates[index]),
    ),
    provenance: {
      provider: id,
      profile: request.profile,
      calculatedAt: new Date().toISOString(),
      attribution: "© OpenStreetMap contributors",
      offlineStoragePermitted: false,
    },
  };
}

function providerError(status: number, body: unknown) {
  if (status === 401 || status === 403)
    return new RoutingError("unavailable", "Routing access is unavailable.");
  if (status === 429)
    return new RoutingError("rate-limit", "Routing is busy. Try again later.");
  if (status === 408 || status === 504)
    return new RoutingError("timeout", "Routing timed out. Try again.");
  if (status === 400) {
    switch (record(body)?.error_code) {
      case 100:
      case 120:
      case 130:
      case 150:
        return new RoutingError(
          "invalid",
          "The routing service rejected the waypoints or request.",
        );
      case 125:
        return new RoutingError(
          "unavailable",
          "This routing mode is unavailable.",
        );
      case 171:
      case 442:
        return new RoutingError(
          "no-route",
          "No route was found through these waypoints.",
        );
    }
  }
  return new RoutingError(
    "provider",
    "The routing service could not complete the request.",
  );
}

export type ValhallaRoutingFetch = (
  url: string,
  init: RequestInit,
) => Promise<Pick<Response, "status" | "json">>;

/** Explicit opt-in from a development harness. Use calculateRoute or its controller. */
export function createValhallaRoutingProvider({
  development,
  baseUrl,
  fetcher = fetch,
}: {
  development: boolean;
  baseUrl?: string;
  fetcher?: ValhallaRoutingFetch;
}): RoutingProvider {
  const local =
    development &&
    /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/?$/.exec(baseUrl ?? "");
  const endpoint =
    local && Number(local[1]) <= 65535
      ? `http://127.0.0.1:${local[1]}/route`
      : undefined;
  return {
    id,
    profiles,
    async calculate(request, signal) {
      if (signal.aborted) throw cancelled();
      if (!endpoint || request.profile === "hiking")
        throw new RoutingError(
          "unavailable",
          "Local routing is unavailable for this activity.",
        );
      if (
        request.waypoints.length < 2 ||
        request.waypoints.length > valhallaMaxWaypoints ||
        !Array.from(request.waypoints).every(isRouteCoordinate)
      )
        throw new RoutingError(
          "invalid",
          "Choose between 2 and 50 valid waypoints.",
        );
      let response: Awaited<ReturnType<ValhallaRoutingFetch>>;
      try {
        response = await fetcher(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          redirect: "error",
          credentials: "omit",
          signal,
          body: JSON.stringify({
            costing: request.profile === "cycling" ? "bicycle" : "pedestrian",
            units: "kilometers",
            format: "json",
            locations: request.waypoints.map(([lon, lat]) => ({
              lon,
              lat,
              type: "break",
            })),
          }),
        });
      } catch {
        if (signal.aborted) throw cancelled();
        throw new RoutingError(
          "network",
          "Could not reach the local routing service.",
        );
      }
      if (signal.aborted) throw cancelled();
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (signal.aborted) throw cancelled();
        if (response.status === 200) throw invalidResponse();
      }
      if (signal.aborted) throw cancelled();
      if (response.status !== 200) throw providerError(response.status, body);
      return decodeValhallaRoute(body, request);
    },
  };
}

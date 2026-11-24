import {
  isRouteCoordinate,
  maxRouteCoordinates,
  RoutingError,
  type RouteCoordinate,
  type RoutedPath,
  type RoutingProvider,
  type RoutingRequest,
} from "./routing";

const id = "maptiler";
const profiles = ["walking", "running", "cycling"] as const;
const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const invalidResponse = () =>
  new RoutingError("invalid", "MapTiler returned an unusable road route.");

export type MapTilerRoutingFetch = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

function readRoute(body: unknown, request: RoutingRequest): RoutedPath {
  const response = record(body);
  const route = record(response?.route);
  const summary = record(route?.summary);
  const legs: unknown = route?.legs;
  const distance = summary?.totalLength;
  const duration = summary?.totalTime;
  const attribution = response?.attribution;
  if (
    (response?.units !== undefined && response.units !== "km") ||
    typeof distance !== "number" ||
    !Number.isFinite(distance * 1000) ||
    distance <= 0 ||
    (duration !== undefined &&
      (typeof duration !== "number" ||
        !Number.isFinite(duration) ||
        duration < 0)) ||
    typeof attribution !== "string" ||
    !attribution.trim() ||
    !Array.isArray(legs) ||
    legs.length !== request.waypoints.length - 1
  )
    throw invalidResponse();

  const coordinates: RouteCoordinate[] = [];
  const waypointIndices = [0];
  for (const leg of legs) {
    const geometry = record(leg)?.geometry;
    const previous = coordinates.at(-1);
    if (
      !Array.isArray(geometry) ||
      geometry.length < 2 ||
      coordinates.length + geometry.length - Number(!!previous) >
        maxRouteCoordinates
    )
      throw invalidResponse();
    for (let index = 0; index < geometry.length; index++) {
      const point: unknown = geometry[index];
      if (!isRouteCoordinate(point)) throw invalidResponse();
      if (previous && index === 0) {
        // Each leg must meet the previous one. Never draw an inferred connector.
        if (point[0] !== previous[0] || point[1] !== previous[1])
          throw invalidResponse();
      } else coordinates.push(point);
    }
    waypointIndices.push(coordinates.length - 1);
  }
  return {
    geometry: { type: "LineString", coordinates },
    waypointIndices,
    distanceMeters: distance * 1000,
    ...(duration !== undefined ? { durationSeconds: duration } : {}),
    provenance: {
      provider: id,
      profile: request.profile,
      calculatedAt: new Date().toISOString(),
      attribution,
      offlineStoragePermitted: false,
    },
  };
}

/** Explicit opt-in adapter. The caller supplies a Directions-entitled key. */
export function createMapTilerRoutingProvider({
  apiKey,
  fetcher = fetch,
}: {
  apiKey: string;
  fetcher?: MapTilerRoutingFetch;
}): RoutingProvider {
  const key = apiKey.trim();
  return {
    id,
    profiles,
    async calculate(request, signal) {
      if (!key)
        throw new RoutingError(
          "unavailable",
          "MapTiler Directions is not configured.",
        );
      if (request.profile === "hiking")
        throw new RoutingError(
          "unavailable",
          "MapTiler Directions has no configured hiking profile.",
        );
      let response: Response;
      try {
        response = await fetcher(
          `https://api.maptiler.com/routing/v1/directions?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile: request.profile === "cycling" ? "bicycle" : "pedestrian",
              locations: request.waypoints.map(([lon, lat]) => ({
                lon,
                lat,
                waypoint: true,
              })),
              response: { units: "km" },
            }),
          },
        );
      } catch {
        // Transport errors can contain the credential-bearing URL.
        throw new RoutingError(
          "network",
          "Could not reach MapTiler Directions.",
        );
      }
      if (response.status === 401 || response.status === 403)
        throw new RoutingError(
          "unavailable",
          "MapTiler Directions access was denied.",
        );
      if (response.status === 429) {
        const seconds = response.headers.get("Retry-After")?.trim();
        const retryAfter =
          seconds && /^\d+$/.test(seconds) ? Number(seconds) : undefined;
        throw new RoutingError(
          "rate-limit",
          "MapTiler Directions is limiting requests. Try again later.",
          Number.isFinite(retryAfter) ? retryAfter : undefined,
        );
      }
      if (!response.ok) {
        const error: unknown = await response.json().catch(() => undefined);
        if (record(error)?.code === "MT_PATH_NOT_FOUND")
          throw new RoutingError(
            "no-route",
            "MapTiler could not find a route through these waypoints.",
          );
        throw new RoutingError(
          "provider",
          "MapTiler Directions could not complete the request.",
        );
      }
      const body: unknown = await response.json().catch(() => {
        throw invalidResponse();
      });
      return readRoute(body, request);
    },
  };
}

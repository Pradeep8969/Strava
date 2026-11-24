/** Preview contract. Supported storage records are defined separately. */
export type RoutingProfile = "walking" | "running" | "cycling" | "hiking";
export type RouteCoordinate = readonly [longitude: number, latitude: number];
export type RoutingRequest = {
  waypoints: readonly RouteCoordinate[];
  profile: RoutingProfile;
};
export type RouteWaypointSnap = {
  requested: RouteCoordinate;
  snapped: RouteCoordinate;
  distanceMeters: number;
  severity: "normal" | "caution" | "large";
};
export type RoutedPath = {
  geometry: { type: "LineString"; coordinates: RouteCoordinate[] };
  distanceMeters: number;
  durationSeconds?: number;
  /** Indices in returned geometry, in original user waypoint order. */
  waypointIndices: number[];
  /** Snap results in request order. Caution and large entries are warnings. */
  waypointSnaps?: RouteWaypointSnap[];
  provenance: {
    provider: string;
    profile: RoutingProfile;
    calculatedAt: string;
    attribution: string;
    offlineStoragePermitted: boolean;
  };
};
export type RoutingErrorCode =
  | "unavailable"
  | "invalid"
  | "cancelled"
  | "rate-limit"
  | "network"
  | "offline"
  | "timeout"
  | "no-route"
  | "provider";
export class RoutingError extends Error {
  constructor(
    public code: RoutingErrorCode,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export interface RoutingProvider {
  readonly id: string;
  readonly profiles: readonly RoutingProfile[];
  calculate(request: RoutingRequest, signal: AbortSignal): Promise<RoutedPath>;
}
export type RoutingState =
  | { status: "idle" }
  | { status: "loading"; request: RoutingRequest }
  | { status: "ready"; request: RoutingRequest; path: RoutedPath }
  | { status: "error"; request: RoutingRequest; error: RoutingError };
/** Proposed additive record, deliberately NOT accepted by today's storage loader.
 * Activating persistence requires backup + compatibility review first.
 */
export type SavedRoutedPlan = {
  kind: "plan";
  planningMode: "follow-roads-paths";
  id: string;
  title: string;
  createdAt: string;
  request: RoutingRequest;
  path: RoutedPath;
};
export const maxRouteCoordinates = 100_000;
export const isRouteCoordinate = (p: unknown): p is RouteCoordinate =>
  Array.isArray(p) &&
  p.length === 2 &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;

type RouteRequestOptions = {
  /** Pass false when the caller knows the device is offline. */
  online?: boolean;
  timeoutMs?: number;
};

const cancelled = () => new RoutingError("cancelled", "Routing cancelled.");
const snapshotRequest = (request: RoutingRequest): RoutingRequest => ({
  profile: request.profile,
  waypoints: request.waypoints.map(([longitude, latitude]) => [
    longitude,
    latitude,
  ]),
});

export async function calculateRoute(
  provider: RoutingProvider | undefined,
  request: RoutingRequest,
  signal: AbortSignal,
  { online, timeoutMs = 15000 }: RouteRequestOptions = {},
): Promise<RoutedPath> {
  if (signal.aborted) throw cancelled();
  if (online === false)
    throw new RoutingError(
      "offline",
      "Connect to the internet to calculate a road route.",
    );
  if (!provider || !provider.profiles.includes(request.profile))
    throw new RoutingError(
      "unavailable",
      "Follow roads/paths is not configured for this activity.",
    );
  if (
    request.waypoints.length < 2 ||
    !Array.from(request.waypoints).every(isRouteCoordinate)
  )
    throw new RoutingError("invalid", "Choose at least two valid waypoints.");
  // Isolate in-flight work from later waypoint edits; no optimization/reordering.
  const snapshot = snapshotRequest(request);
  const controller = new AbortController();
  let interrupt!: (error: RoutingError) => void;
  const interrupted = new Promise<never>((_, reject) => {
    interrupt = reject;
  });
  const abort = () => {
    interrupt(cancelled());
    controller.abort();
  };
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    interrupt(new RoutingError("timeout", "Routing timed out. Try again."));
    controller.abort();
  }, timeoutMs);
  try {
    const result = await Promise.race([
      interrupted,
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw cancelled();
        return provider.calculate(snapshot, controller.signal);
      }),
    ]);
    if (signal.aborted) throw cancelled();
    if (
      !result ||
      result.geometry?.type !== "LineString" ||
      !Array.isArray(result.geometry.coordinates) ||
      result.geometry.coordinates.length < 2 ||
      result.geometry.coordinates.length > maxRouteCoordinates ||
      !Array.from(result.geometry.coordinates).every(isRouteCoordinate) ||
      !result.geometry.coordinates.some(
        ([x, y], i, points) =>
          i > 0 && (x !== points[i - 1][0] || y !== points[i - 1][1]),
      ) ||
      !Number.isFinite(result.distanceMeters) ||
      result.distanceMeters <= 0 ||
      (result.durationSeconds !== undefined &&
        (!Number.isFinite(result.durationSeconds) ||
          result.durationSeconds < 0)) ||
      !Array.isArray(result.waypointIndices) ||
      result.waypointIndices.length !== snapshot.waypoints.length ||
      result.waypointIndices[0] !== 0 ||
      result.waypointIndices.at(-1) !==
        result.geometry.coordinates.length - 1 ||
      !Array.from(result.waypointIndices).every(
        (n, i, indices) =>
          Number.isInteger(n) &&
          n >= 0 &&
          n < result.geometry.coordinates.length &&
          (!i || n >= indices[i - 1]),
      ) ||
      result.provenance?.provider !== provider.id ||
      result.provenance.profile !== snapshot.profile ||
      !Number.isFinite(Date.parse(result.provenance.calculatedAt)) ||
      typeof result.provenance.attribution !== "string" ||
      !result.provenance.attribution.trim() ||
      typeof result.provenance.offlineStoragePermitted !== "boolean"
    )
      throw new RoutingError(
        "invalid",
        "The routing service returned an unusable path. No route was created.",
      );
    return result;
  } catch (error) {
    if (signal.aborted) throw cancelled();
    if (error instanceof RoutingError) throw error;
    throw new RoutingError(
      "network",
      "Routing failed. Check the connection and retry.",
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

/** Own one controller per draft. Clear it on edits without a request or on account change. */
export function createRouteRequestController(
  provider: RoutingProvider | undefined,
) {
  let active: AbortController | undefined;
  let state: RoutingState = { status: "idle" };
  return {
    getState: () => state,
    clear() {
      active?.abort();
      active = undefined;
      state = { status: "idle" };
    },
    async request(input: RoutingRequest, options?: RouteRequestOptions) {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      // Snapshot valid edits immediately without converting malformed input.
      const request = Array.from(input.waypoints).every(isRouteCoordinate)
        ? snapshotRequest(input)
        : { profile: input.profile, waypoints: [] };
      state = { status: "loading", request };
      try {
        const path = await calculateRoute(
          provider,
          request,
          controller.signal,
          options,
        );
        if (active === controller) state = { status: "ready", request, path };
      } catch (error) {
        if (active === controller)
          state = { status: "error", request, error: error as RoutingError };
      } finally {
        if (active === controller) active = undefined;
      }
    },
  };
}

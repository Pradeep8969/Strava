/** Inactive contract only: no provider, endpoint, key, fetch or UI activation. */
export type RoutingProfile = "walking" | "running" | "cycling" | "hiking";
export type RouteCoordinate = readonly [longitude: number, latitude: number];
export type RoutingRequest = {
  waypoints: readonly RouteCoordinate[];
  profile: RoutingProfile;
};
export type RoutedPath = {
  geometry: { type: "LineString"; coordinates: RouteCoordinate[] };
  distanceMeters: number;
  /** Indices in returned geometry, in original user waypoint order. */
  waypointIndices: number[];
  provenance: {
    provider: string;
    profile: RoutingProfile;
    calculatedAt: string;
    attribution: string;
    offlineStoragePermitted: boolean;
  };
};
export type RoutingErrorCode =
  "unavailable" | "invalid" | "cancelled" | "rate-limit" | "network";
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
const coordinate = (p: RouteCoordinate) =>
  Array.isArray(p) &&
  p.length === 2 &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;

/** A future provider normalizes its response here; never substitute waypoints. */
export async function calculateRoute(
  provider: RoutingProvider | undefined,
  request: RoutingRequest,
  signal: AbortSignal,
): Promise<RoutedPath> {
  if (signal.aborted) throw new RoutingError("cancelled", "Routing cancelled.");
  if (!provider || !provider.profiles.includes(request.profile))
    throw new RoutingError(
      "unavailable",
      "Follow roads/paths is not configured for this activity.",
    );
  if (request.waypoints.length < 2 || !request.waypoints.every(coordinate))
    throw new RoutingError("invalid", "Choose at least two valid waypoints.");
  // Isolate in-flight work from later waypoint edits; no optimization/reordering.
  const snapshot: RoutingRequest = {
    profile: request.profile,
    waypoints: request.waypoints.map((p) => [...p] as RouteCoordinate),
  };
  try {
    const result = await provider.calculate(snapshot, signal);
    if (signal.aborted)
      throw new RoutingError("cancelled", "Routing cancelled.");
    if (
      !result ||
      result.geometry?.type !== "LineString" ||
      !Array.isArray(result.geometry.coordinates) ||
      result.geometry.coordinates.length < 2 ||
      !result.geometry.coordinates.every(coordinate) ||
      !Number.isFinite(result.distanceMeters) ||
      result.distanceMeters < 0 ||
      !Array.isArray(result.waypointIndices) ||
      result.waypointIndices.length !== snapshot.waypoints.length ||
      !result.waypointIndices.every(
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
    if (signal.aborted)
      throw new RoutingError("cancelled", "Routing cancelled.");
    if (error instanceof RoutingError) throw error;
    throw new RoutingError(
      "network",
      "Routing failed. Check the connection and retry.",
    );
  }
}

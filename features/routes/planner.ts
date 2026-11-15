import type { TrackPoint } from "../../types/activity";
import { validCoordinate } from "../discovery/map-data";
import { distance } from "../../utils/tracking";

export type PlannerMapProps = {
  points: TrackPoint[];
  onWaypoint: (coordinate: { latitude: number; longitude: number }) => void;
  fitRequest: number;
};
export const planningLabel = "Approximate straight-line distance";
export const routingUnavailable =
  "Road-following unavailable: no working routing service is configured. Roads, access restrictions and safety are not checked.";
export type PlannedRoute = {
  id: string;
  title: string;
  points: TrackPoint[];
  geometry: { type: "LineString"; coordinates: number[][] };
  distanceMeters: number;
  planningMode: "straight-line";
  kind: "plan";
  createdAt: string | null;
};
export function waypoint(coordinate: {
  latitude: number;
  longitude: number;
}): TrackPoint {
  if (!validCoordinate(coordinate))
    throw new Error("Invalid waypoint. Choose a location on the map.");
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    timestamp: Date.now(),
    accuracy: 0,
    altitude: null,
    altitudeAccuracy: null,
    segment: 0,
  };
}
export function planDistance(points: TrackPoint[]) {
  if (!points.every(validCoordinate))
    throw new Error("Route contains invalid waypoints.");
  return points.reduce(
    (sum, p, i) => sum + (i ? distance(points[i - 1], p) : 0),
    0,
  );
}
export function createPlan(
  title: string,
  points: TrackPoint[],
  id: string,
  createdAt: string | null,
): PlannedRoute {
  if (!title.trim() || points.length < 2)
    throw new Error("Add a route name and at least two waypoints.");
  return {
    id,
    title: title.trim(),
    points: points.map((p) => ({ ...p })),
    geometry: {
      type: "LineString",
      coordinates: points.map((p) => [p.longitude, p.latitude]),
    },
    distanceMeters: planDistance(points),
    planningMode: "straight-line",
    kind: "plan",
    createdAt,
  };
}
/** Legacy plans have no reliable creation date; never invent one. */
export function restorePlans(value: unknown): PlannedRoute[] {
  if (!Array.isArray(value))
    throw new Error(
      "Saved routes could not be read. Existing storage has been preserved.",
    );
  return value.map((route) => {
    if (
      !route ||
      typeof route.id !== "string" ||
      typeof route.title !== "string" ||
      !Array.isArray(route.points) ||
      route.points.some((p: TrackPoint | null) => !p || !validCoordinate(p)) ||
      (route.planningMode && route.planningMode !== "straight-line")
    )
      throw new Error(
        "A saved route is invalid or uses an unsupported planning mode. Existing storage has been preserved.",
      );
    return createPlan(
      route.title,
      route.points,
      route.id,
      typeof route.createdAt === "string" ? route.createdAt : null,
    );
  });
}

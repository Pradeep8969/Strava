import type { TrackPoint } from "../../types/activity";
import { trackSegments } from "../../utils/tracking";
import type { Area, SavedRoute } from "./catalog";

export type MapRoute = SavedRoute & { kind: "plan" | "recording" };
export type DiscoveryMapProps = {
  area?: Area;
  points?: TrackPoint[];
  height?: number;
  routes?: MapRoute[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onWaypoint?: (coordinate: { latitude: number; longitude: number }) => void;
  fitRequest?: number;
};
export const validCoordinate = (p: { latitude: number; longitude: number }) =>
  Number.isFinite(p.latitude) &&
  Math.abs(p.latitude) <= 90 &&
  Number.isFinite(p.longitude) &&
  Math.abs(p.longitude) <= 180;

/** Never bridge pauses, missing fixes, or invalid coordinates. Plans remain straight lines. */
export function mapSegments(route: MapRoute): TrackPoint[][] {
  const chunks: TrackPoint[][] = [];
  for (const point of route.points) {
    if (!validCoordinate(point)) {
      chunks.push([]);
      continue;
    }
    if (!chunks.length) chunks.push([]);
    chunks[chunks.length - 1].push(point);
  }
  return chunks
    .flatMap((chunk) =>
      route.kind === "recording" ? trackSegments(chunk) : [chunk],
    )
    .filter((chunk) => chunk.length > 1);
}
export function routeFeatures(routes: MapRoute[]) {
  return {
    type: "FeatureCollection" as const,
    features: routes.flatMap((route) =>
      mapSegments(route).map((segment) => ({
        type: "Feature" as const,
        properties: { id: route.id, kind: route.kind },
        geometry: {
          type: "LineString" as const,
          coordinates: segment.map((p) => [p.longitude, p.latitude]),
        },
      })),
    ),
  };
}

export function mapConfiguration(
  key: string | undefined,
  development: boolean,
  hostname: string,
  terrain = false,
) {
  if (key?.trim())
    return {
      style: `https://api.maptiler.com/maps/${terrain ? "outdoor-v2" : "streets-v2"}/style.json?key=${encodeURIComponent(key.trim())}`,
      development: false,
    };
  if (development && ["localhost", "127.0.0.1", "::1"].includes(hostname))
    return {
      style: "https://demotiles.maplibre.org/style.json",
      development: true,
    };
  return null;
}

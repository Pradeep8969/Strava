import { mapCoordinate } from "./demo-preview";
import type { RouteCoordinate, RoutedPath } from "./routing";

export function roadPreviewMap(
  waypoints: readonly RouteCoordinate[],
  path?: RoutedPath,
) {
  return {
    line: path?.geometry.coordinates.map(mapCoordinate) ?? [],
    markers: waypoints.map((requested, index) => {
      const snap = path?.waypointSnaps?.[index];
      return {
        label:
          index === 0
            ? "Start"
            : index === waypoints.length - 1
              ? "Finish"
              : `Waypoint ${index + 1}`,
        requested: mapCoordinate(requested),
        snapped:
          snap && snap.severity !== "normal"
            ? mapCoordinate(snap.snapped)
            : undefined,
        offset: Math.round(snap?.distanceMeters ?? 0),
        severity: snap?.severity ?? "normal",
      };
    }),
  };
}

export type RoadPreviewMap = ReturnType<typeof roadPreviewMap>;

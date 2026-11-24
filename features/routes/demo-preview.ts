import { distance } from "../../utils/tracking";
import {
  createRouteRequestController,
  RoutingError,
  type RouteCoordinate,
  type RoutingProvider,
  type RoutingRequest,
  type RoutingState,
} from "./routing";

export const demoRouteColor = "#007A87";
export const demoProfiles = {
  walking: { bend: 0.2, metersPerSecond: 1.3 },
  running: { bend: 0.3, metersPerSecond: 2.8 },
  cycling: { bend: 0.4, metersPerSecond: 5.5 },
} as const;
export type DemoProfile = keyof typeof demoProfiles;
export const demoProfileOptions = Object.keys(demoProfiles) as DemoProfile[];
export const mapCoordinate = ([longitude, latitude]: RouteCoordinate) => ({
  longitude,
  latitude,
});

/** Synthetic bends and sample speeds for exercising the preview UI. */
export const demoRoutingProvider: RoutingProvider = {
  id: "route-studio-demo",
  profiles: demoProfileOptions,
  async calculate({ waypoints, profile }) {
    if (profile === "hiking")
      throw new RoutingError(
        "unavailable",
        "This demo profile is unavailable.",
      );
    const settings = demoProfiles[profile];
    const coordinates: RouteCoordinate[] = [waypoints[0]];
    const waypointIndices = [0];
    let distanceMeters = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const start = waypoints[i - 1];
      const end = waypoints[i];
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      if (!dx && !dy)
        throw new RoutingError(
          "no-route",
          "Move or remove overlapping waypoints to calculate the demo.",
        );
      if (Math.abs(dx) > 180)
        throw new RoutingError(
          "no-route",
          "The demo cannot join waypoints across the date line.",
        );
      const middle: RouteCoordinate = [
        Math.max(
          -180,
          Math.min(180, (start[0] + end[0]) / 2 - dy * settings.bend),
        ),
        Math.max(
          -90,
          Math.min(90, (start[1] + end[1]) / 2 + dx * settings.bend),
        ),
      ];
      coordinates.push(middle, end);
      waypointIndices.push(coordinates.length - 1);
      distanceMeters +=
        distance(mapCoordinate(start), mapCoordinate(middle)) +
        distance(mapCoordinate(middle), mapCoordinate(end));
    }
    return {
      geometry: { type: "LineString", coordinates },
      waypointIndices,
      distanceMeters,
      durationSeconds: distanceMeters / settings.metersPerSecond,
      provenance: {
        provider: demoRoutingProvider.id,
        profile,
        calculatedAt: new Date().toISOString(),
        attribution: "Synthetic demo geometry",
        offlineStoragePermitted: false,
      },
    };
  },
};

/** The caller cleans up on edits, screen blur, and unmount. */
export function scheduleDemoPreview(
  provider: RoutingProvider | undefined,
  request: RoutingRequest,
  publish: (state: RoutingState) => void,
) {
  const controller = createRouteRequestController(provider);
  const timer = setTimeout(() => {
    void controller.request(request).then(() => {
      const state = controller.getState();
      if (state.status !== "idle") publish(state);
    });
  }, 250);
  return () => {
    clearTimeout(timer);
    controller.clear();
  };
}

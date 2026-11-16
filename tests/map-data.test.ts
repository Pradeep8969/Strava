import { describe, expect, it } from "vitest";
import {
  mapConfiguration,
  mapSegments,
  routeFeatures,
  routeDistance,
  type MapRoute,
} from "../features/discovery/map-data";
import type { TrackPoint } from "../types/activity";
const point = (
  longitude: number,
  timestamp = 1000,
  segment = 0,
): TrackPoint => ({
  latitude: 27.7,
  longitude,
  timestamp,
  segment,
  accuracy: 5,
  altitude: null,
  altitudeAccuracy: null,
});
describe("geographic map data", () => {
  it("never enables demo tiles on production hosts", () => {
    expect(mapConfiguration(undefined, true, "example.com")).toBeNull();
    expect(mapConfiguration(undefined, false, "localhost")).toBeNull();
    expect(mapConfiguration(undefined, true, "localhost")?.development).toBe(
      true,
    );
    expect(
      mapConfiguration("public-key", false, "example.com", true)?.style,
    ).toContain("outdoor-v2");
  });
  it("keeps GPS pauses and missing fixes separate", () => {
    const route: MapRoute = {
      id: "fixture",
      title: "Isolated GPS fixture",
      kind: "recording",
      points: [
        point(85),
        point(85.01, 2000),
        point(85.02, 70001, 1),
        point(85.03, 71000, 1),
        point(NaN),
        point(85.04),
        point(85.05, 2000),
      ],
    };
    expect(mapSegments(route).map((s) => s.length)).toEqual([2, 2, 2]);
    expect(routeFeatures([route]).features[0].geometry.coordinates[0]).toEqual([
      85, 27.7,
    ]);
  });
  it("preserves real waypoint plans, rejects invalid coordinates, and supports empty data", () => {
    expect(routeFeatures([]).features).toEqual([]);
    expect(
      mapSegments({
        id: "p",
        title: "Plan",
        kind: "plan",
        points: [point(85), point(85.1, 100000)],
      }),
    ).toHaveLength(1);
    expect(
      mapSegments({
        id: "p",
        title: "Plan",
        kind: "plan",
        points: [point(85), point(200), point(85.1)],
      }),
    ).toEqual([]);
  });
  it("highlights the selected route and calculates distance without bridging gaps", () => {
    const route: MapRoute = {
      id: "track",
      title: "Track",
      kind: "recording",
      points: [
        point(85, 1000),
        point(85.001, 2000),
        point(86, 100000),
        point(86.001, 101000),
      ],
    };
    const data = routeFeatures([route], "track");
    expect(data.features).toHaveLength(2);
    expect(data.features.every((feature) => feature.properties.selected)).toBe(
      true,
    );
    expect(routeDistance(route)).toBeGreaterThan(190);
    expect(routeDistance(route)).toBeLessThan(200);
    expect(routeDistance({ ...route, points: [] })).toBe(0);
  });
});

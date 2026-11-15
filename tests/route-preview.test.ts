import { expect, it } from "vitest";
import { routePreview } from "../features/routes/preview";
import type { TrackPoint } from "../types/activity";
const point = (
  latitude: number,
  longitude: number,
  timestamp: number,
  segment = 0,
): TrackPoint => ({
  latitude,
  longitude,
  timestamp,
  segment,
  accuracy: 5,
  altitude: null,
  altitudeAccuracy: null,
});
it("preserves pauses and GPS gaps instead of drawing a continuous invented track", () => {
  const points = [
    point(27, 85, 0),
    point(27.01, 85, 1000),
    point(28, 86, 90000),
    point(28.01, 86, 91000),
    point(29, 87, 92000, 1),
    point(29.01, 87, 93000, 1),
  ];
  const groups = routePreview(points, 300, 100);
  expect(groups).toHaveLength(3);
  expect(groups.every((group) => group.length === 2)).toBe(true);
  expect(
    groups
      .flat()
      .every((p) => p.x >= 12 && p.x <= 288 && p.y >= 12 && p.y <= 88),
  ).toBe(true);
});
it("handles missing geometry, zero width and crossing the date line", () => {
  expect(routePreview([], 300, 100)).toEqual([]);
  expect(routePreview([point(27, 85, 0)], 0, 100)).toEqual([]);
  const group = routePreview(
    [point(0, 179.9, 0), point(0, -179.9, 1000)],
    300,
    100,
  );
  expect(
    group.flat().every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  ).toBe(true);
  expect(group[0][0].x).toBeLessThan(group[0][1].x);
});

import { expect, it } from "vitest";
import {
  filterIdeas,
  routeIdeas,
  waypointDistance,
  waypointElevation,
} from "../features/discovery/catalog";
import { demoEvents, filterEvents } from "../features/events/catalog";
import type { TrackPoint } from "../types/activity";
const point = (
  longitude: number,
  altitude: number | null = null,
  altitudeAccuracy: number | null = null,
): TrackPoint => ({
  latitude: 27.7,
  longitude,
  timestamp: 1000,
  accuracy: 5,
  segment: 0,
  altitude,
  altitudeAccuracy,
});
it("filters editorial destinations by both place and sport without inventing metrics", () => {
  expect(filterIdeas(" POKHARA ", "Cycling").map((idea) => idea.id)).toEqual([
    "pokhara",
  ]);
  expect(filterIdeas("Pokhara", "Hiking")).toEqual([]);
  expect(filterIdeas("", "Trail running").map((idea) => idea.id)).toEqual([
    "nagarkot",
  ]);
  expect(
    routeIdeas.every(
      (idea) =>
        !("points" in idea) && !("distance" in idea) && !("elevation" in idea),
    ),
  ).toBe(true);
});
it("derives planned distance only from supplied geometry and leaves absent elevation unavailable", () => {
  expect(waypointDistance([])).toBe(0);
  expect(waypointDistance([point(85), point(85.01)])).toBeGreaterThan(900);
  expect(waypointElevation([point(85), point(85.01)])).toBeNull();
  expect(waypointElevation([point(85, 100, 5), point(85.01, 110, 5)])).toBe(10);
  expect(
    waypointElevation([point(85, 100, 50), point(85.01, 110, 50)]),
  ).toBeNull();
  expect(waypointElevation([point(85, 100, 5), point(85.01, 100, 5)])).toBe(0);
});
it("filters visual demonstration events without enabling registrations or payments", () => {
  expect(filterEvents("pokhara", "Cycling").map((event) => event.id)).toEqual([
    "lakeside-ride",
  ]);
  expect(filterEvents("pokhara", "Running")).toEqual([]);
  expect(filterEvents("unknown", "All")).toEqual([]);
  expect(new Set(demoEvents.map((event) => event.id)).size).toBe(
    demoEvents.length,
  );
  expect(
    demoEvents.every(
      (event) =>
        !("registrationUrl" in event) &&
        !("payment" in event) &&
        !("price" in event),
    ),
  ).toBe(true);
});

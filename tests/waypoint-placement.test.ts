import { expect, it } from "vitest";
import {
  applyWaypointEdit,
  findWaypointLocations,
  parseWaypointCoordinates,
} from "../features/routes/waypoint-placement";
import { createPlan, savedLine, waypoint } from "../features/routes/planner";

it("finds offline landmarks and accepts valid latitude/longitude without swapping axes", () => {
  expect(
    findWaypointLocations(" Durbar Square ").map(({ label }) => label),
  ).toEqual(["Patan Durbar Square", "Bhaktapur Durbar Square"]);
  expect(findWaypointLocations("27.7043, 85.3076")).toEqual([
    { label: "27.7043, 85.3076", latitude: 27.7043, longitude: 85.3076 },
  ]);
  for (const query of ["27,181", "91,85", "x,85", "85,", "27,85,0"])
    expect(parseWaypointCoordinates(query)).toBeUndefined();
  expect(findWaypointLocations("Unknown address")).toEqual([]);
});

it("inserts before Finish and replaces points only on confirmation", () => {
  const start = waypoint({ latitude: 27.7, longitude: 85.3 });
  const finish = waypoint({ latitude: 27.8, longitude: 85.4 });
  const draft = [start, finish];
  const point = { latitude: 27.73, longitude: 85.36 };
  const updated = applyWaypointEdit(draft, { index: 1, insert: true }, point);
  expect(draft).toEqual([start, finish]);
  expect(updated).toEqual([start, expect.objectContaining(point), finish]);
  const replaced = applyWaypointEdit(
    updated,
    { index: 0, insert: false },
    point,
  );
  expect(replaced).toEqual([
    expect.objectContaining(point),
    updated[1],
    finish,
  ]);
  const plan = createPlan("Legacy", replaced, "route", null);
  expect(plan.planningMode).toBe("straight-line");
  expect(plan.geometry.coordinates[0]).toEqual([85.36, 27.73]);
});

it("uses stored line coordinates without treating an interior geometry vertex as a waypoint", () => {
  const points = [
    waypoint({ latitude: 27.7, longitude: 85.3 }),
    waypoint({ latitude: 27.8, longitude: 85.4 }),
  ];
  expect(
    savedLine(points, {
      type: "LineString",
      coordinates: [
        [85.3, 27.7],
        [85.32, 27.75],
        [85.4, 27.8],
      ],
    })[1],
  ).toEqual({ latitude: 27.75, longitude: 85.32 });
  expect(points).toHaveLength(2);
});

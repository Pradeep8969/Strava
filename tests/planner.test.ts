import { beforeEach, expect, it, vi } from "vitest";
import {
  createPlan,
  planDistance,
  restorePlans,
  waypoint,
  planningLabel,
  routingUnavailable,
} from "../features/routes/planner";
import { loadPlans, savePlan, deletePlan } from "../services/planned-routes";
const storage = vi.hoisted(() => new Map<string, unknown>());
vi.mock("../services/database", () => ({
  getValue: async (key: string) => storage.get(key) ?? null,
  setValue: async (key: string, value: unknown) => {
    storage.set(key, JSON.parse(JSON.stringify(value)));
  },
  serial: async (fn: () => Promise<unknown>) => fn(),
}));
beforeEach(() => storage.clear());
const points = () => [
  waypoint({ latitude: 0, longitude: 0 }),
  waypoint({ latitude: 0, longitude: 1 }),
];
it("calculates kilometres and handles undo, clear and invalid waypoints", () => {
  expect(planDistance(points()) / 1000).toBeCloseTo(111.195, 2);
  expect(planDistance(points().slice(0, -1))).toBe(0);
  expect(planDistance([])).toBe(0);
  expect(() => waypoint({ latitude: NaN, longitude: 0 })).toThrow(
    "Invalid waypoint",
  );
  expect(() => waypoint({ latitude: 91, longitude: 0 })).toThrow();
});
it("persists complete plans, restores copies and never writes a workout", async () => {
  const plan = createPlan(
    " Morning ",
    points(),
    "one",
    "2026-11-15T00:00:00.000Z",
  );
  await savePlan(plan);
  expect(await loadPlans()).toEqual([plan]);
  expect(plan.geometry.coordinates).toEqual([
    [0, 0],
    [1, 0],
  ]);
  const opened = (await loadPlans())[0];
  await savePlan(
    createPlan(opened.title, opened.points, "two", opened.createdAt),
  );
  expect(await loadPlans()).toHaveLength(2);
  await expect(savePlan(plan)).rejects.toThrow("already exists");
  expect(storage.has("workouts")).toBe(false);
  expect(await deletePlan("one")).toHaveLength(1);
});
it("migrates legacy plans without inventing dates and protects corrupt storage", async () => {
  expect(
    restorePlans([{ id: "old", title: "Old", points: points() }])[0].createdAt,
  ).toBeNull();
  storage.set("routes", [{ id: "broken" }]);
  await expect(
    savePlan(createPlan("New", points(), "new", null)),
  ).rejects.toThrow();
  expect(storage.get("routes")).toEqual([{ id: "broken" }]);
  expect(() =>
    restorePlans([
      {
        id: "road",
        title: "Road",
        points: points(),
        planningMode: "road-following",
      },
    ]),
  ).toThrow("unsupported");
});
it("labels approximate distances and unavailable road routing explicitly", () => {
  expect(planningLabel).toContain("Approximate straight-line");
  expect(routingUnavailable).toContain("Road-following unavailable");
  expect(routingUnavailable).toContain("safety are not checked");
});

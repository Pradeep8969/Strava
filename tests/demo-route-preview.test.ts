import { expect, it, vi } from "vitest";
import {
  demoRoutingProvider,
  scheduleDemoPreview,
} from "../features/routes/demo-preview";
import {
  calculateRoute,
  type RoutedPath,
  type RoutingRequest,
} from "../features/routes/routing";
import { createPlan, waypoint } from "../features/routes/planner";

const walking: RoutingRequest = {
  profile: "walking",
  waypoints: [
    [85.31, 27.71],
    [85.32, 27.71],
    [85.33, 27.72],
  ],
};
const run = (request: RoutingRequest) =>
  calculateRoute(demoRoutingProvider, request, new AbortController().signal);

it("builds deterministic demo geometry offline, retaining ordered waypoints and profile estimates", async () => {
  const walkingPath = await run(walking);
  expect((await run(walking)).geometry).toEqual(walkingPath.geometry);
  expect(walkingPath.waypointIndices).toEqual([0, 2, 4]);
  expect(
    walkingPath.waypointIndices.map(
      (index) => walkingPath.geometry.coordinates[index],
    ),
  ).toEqual(walking.waypoints);
  expect(walkingPath.provenance.offlineStoragePermitted).toBe(false);
  const running = await run({ ...walking, profile: "running" });
  const cycling = await run({ ...walking, profile: "cycling" });
  expect(running.geometry).not.toEqual(walkingPath.geometry);
  expect(cycling.geometry).not.toEqual(running.geometry);
  expect(cycling.durationSeconds).toBeLessThan(running.durationSeconds!);
  expect(running.durationSeconds).toBeLessThan(walkingPath.durationSeconds!);
});

it("debounces edits and suppresses cancelled or late responses", async () => {
  const path = await run(walking);
  vi.useFakeTimers();
  try {
    const resolve: ((result: RoutedPath) => void)[] = [];
    const calculate = vi.fn<typeof demoRoutingProvider.calculate>(
      () => new Promise((done) => resolve.push(done)),
    );
    const provider = { ...demoRoutingProvider, calculate };
    const publish = vi.fn();
    const first = scheduleDemoPreview(provider, walking, publish);
    await vi.advanceTimersByTimeAsync(249);
    expect(calculate).not.toHaveBeenCalled();
    first();
    const second = scheduleDemoPreview(provider, walking, publish);
    await vi.advanceTimersByTimeAsync(250);
    const oldSignal = calculate.mock.calls[0][1];
    second();
    const latest = { ...walking, profile: "running" } as const;
    const cleanup = scheduleDemoPreview(provider, latest, publish);
    await vi.advanceTimersByTimeAsync(250);
    resolve[1]({
      ...path,
      provenance: { ...path.provenance, profile: "running" },
    });
    await vi.advanceTimersByTimeAsync(0);
    resolve[0](path);
    await vi.advanceTimersByTimeAsync(0);
    expect(oldSignal.aborted).toBe(true);
    expect(publish).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        status: "ready",
        request: latest,
      }),
    );
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it("surfaces unavailable and overlapping-waypoint errors without creating a route", async () => {
  vi.useFakeTimers();
  try {
    const publish = vi.fn();
    const cleanup = scheduleDemoPreview(undefined, walking, publish);
    await vi.advanceTimersByTimeAsync(250);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        error: expect.objectContaining({ code: "unavailable" }),
      }),
    );
    cleanup();
  } finally {
    vi.useRealTimers();
  }
  await expect(
    run({
      ...walking,
      waypoints: [walking.waypoints[0], walking.waypoints[0]],
    }),
  ).rejects.toMatchObject({ code: "no-route" });
});

it("keeps ordinary saved geometry derived only from selected points", async () => {
  const demo = await run(walking);
  const points = walking.waypoints.map(([longitude, latitude]) =>
    waypoint({ longitude, latitude }),
  );
  const saved = createPlan("Test plan", points, "mock-id", null);
  expect(saved.geometry.coordinates).toEqual(walking.waypoints);
  expect(saved.geometry.coordinates).not.toEqual(demo.geometry.coordinates);
  expect(saved.planningMode).toBe("straight-line");
});

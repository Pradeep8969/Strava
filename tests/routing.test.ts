import { expect, it, vi } from "vitest";
import {
  calculateRoute,
  createRouteRequestController,
  RoutingError,
  type RoutedPath,
  type RoutingProvider,
  type RoutingRequest,
} from "../features/routes/routing";
const request: RoutingRequest = {
  profile: "walking",
  waypoints: [
    [0, 0],
    [1, 1],
  ],
};
const walking: RoutingRequest = { ...request, profile: "running" };
const path: RoutedPath = {
  geometry: {
    type: "LineString",
    coordinates: [
      [0, 0],
      [0.5, 0.8],
      [1, 1],
    ],
  },
  distanceMeters: 180000,
  waypointIndices: [0, 2],
  provenance: {
    provider: "fixture",
    profile: "running",
    calculatedAt: "2026-11-16T00:00:00Z",
    attribution: "Test fixture",
    offlineStoragePermitted: false,
  },
};
const provider = (result = path): RoutingProvider => ({
  id: "fixture",
  profiles: ["running"],
  calculate: async () => result,
});

it("reports known offline status without invoking the provider", async () => {
  const p = { ...provider(), calculate: vi.fn() };
  await expect(
    calculateRoute(p, walking, new AbortController().signal, { online: false }),
  ).rejects.toMatchObject({ code: "offline" });
  expect(p.calculate).not.toHaveBeenCalled();
});

it("times out even if a provider ignores cancellation", async () => {
  vi.useFakeTimers();
  try {
    const p = provider();
    p.calculate = (_request, signal) => {
      expect(signal.aborted).toBe(false);
      return new Promise(() => {});
    };
    const attempt = calculateRoute(p, walking, new AbortController().signal, {
      timeoutMs: 50,
    });
    const assertion = expect(attempt).rejects.toMatchObject({
      code: "timeout",
    });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it("rejects an in-flight cancellation and propagates the abort", async () => {
  const controller = new AbortController();
  const p = provider();
  let providerSignal: AbortSignal | undefined;
  p.calculate = (_request, signal) => {
    providerSignal = signal;
    return new Promise(() => {});
  };
  const attempt = calculateRoute(p, walking, controller.signal);
  await Promise.resolve();
  controller.abort();
  await expect(attempt).rejects.toMatchObject({ code: "cancelled" });
  expect(providerSignal?.aborted).toBe(true);
});

it("keeps only the latest route result and clears previews when an account or draft changes", async () => {
  const p = provider();
  const resolvers: ((value: RoutedPath) => void)[] = [];
  p.calculate = () => new Promise((resolve) => resolvers.push(resolve));
  const controller = createRouteRequestController(p);
  const original = controller.request(walking);
  await Promise.resolve();
  const waypoints: [number, number][] = [
    [10, 10],
    [11, 11],
  ];
  const edit = controller.request({ ...walking, waypoints });
  waypoints[0][0] = 90;
  await Promise.resolve();
  const updated = { ...path, distanceMeters: 181000 };
  resolvers[1](updated);
  await edit;
  resolvers[0](path);
  await original;
  expect(controller.getState()).toMatchObject({
    status: "ready",
    request: {
      waypoints: [
        [10, 10],
        [11, 11],
      ],
    },
    path: updated,
  });
  const beforeAccountChange = controller.request(walking);
  await Promise.resolve();
  controller.clear();
  resolvers[2](path);
  await beforeAccountChange;
  expect(controller.getState()).toEqual({ status: "idle" });
});
it("does not configure a provider or fabricate a straight-line fallback", async () => {
  await expect(
    calculateRoute(undefined, walking, new AbortController().signal),
  ).rejects.toMatchObject({ code: "unavailable" });
});
it("keeps waypoint order, geometry and provider distance separate", async () => {
  const p = provider();
  p.calculate = async (r) => {
    expect(r.waypoints).toEqual(walking.waypoints);
    return path;
  };
  expect(
    await calculateRoute(p, walking, new AbortController().signal),
  ).toEqual(path);
});
it("rejects invalid geometry and reordered waypoints", async () => {
  for (const invalid of [
    { ...path, waypointIndices: [2, 0] },
    { ...path, distanceMeters: -1 },
    {
      ...path,
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [NaN, 0],
          [0, 0],
        ] as [number, number][],
      },
    },
  ]) {
    await expect(
      calculateRoute(provider(invalid), walking, new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid" });
  }
});
it("handles cancellation, explicit rate limits and retry without automatic extra calls", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    calculateRoute(provider(), walking, controller.signal),
  ).rejects.toMatchObject({ code: "cancelled" });
  const p = provider();
  p.calculate = async () => {
    throw new RoutingError("rate-limit", "Retry later", 30);
  };
  await expect(
    calculateRoute(p, walking, new AbortController().signal),
  ).rejects.toMatchObject({ code: "rate-limit", retryAfterSeconds: 30 });
  p.calculate = async () => path;
  expect(
    await calculateRoute(p, walking, new AbortController().signal),
  ).toEqual(path);
});
it("never falls back to straight lines for unavailable services or network errors", async () => {
  await expect(
    calculateRoute(
      undefined,
      {
        profile: "walking",
        waypoints: [
          [0, 0],
          [1, 0],
        ],
      },
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "unavailable" });
  const p = provider();
  p.calculate = async () => {
    throw new Error("Provider unreachable");
  };
  await expect(
    calculateRoute(p, walking, new AbortController().signal),
  ).rejects.toMatchObject({ code: "network" });
});

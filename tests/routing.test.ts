import { expect, it } from "vitest";
import {
  calculateRoute,
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

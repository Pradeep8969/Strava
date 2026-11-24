import { expect, it, vi } from "vitest";
import {
  calculateRoute,
  createRouteRequestController,
  type RoutingRequest,
} from "../features/routes/routing";
import {
  createValhallaRoutingProvider,
  type ValhallaRoutingFetch,
} from "../features/routes/valhalla-routing";
import fixtures from "../features/routes/valhalla-pilot.json";

const origin = "http://127.0.0.1:8002";
const walk = fixtures["walk-kathmandu"];
const bike = fixtures["bike-bhaktapur"];
const multi = fixtures["walk-multi"];
const input = (
  fixture = walk,
  profile: RoutingRequest["profile"] = "walking",
): RoutingRequest => ({
  profile,
  waypoints: fixture.trip.locations.map(({ lon, lat }) => [lon, lat]),
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const provider = (fetcher: ValhallaRoutingFetch) =>
  createValhallaRoutingProvider({
    development: true,
    baseUrl: origin,
    fetcher,
  });
const run = (fetcher: ValhallaRoutingFetch, request = input()) =>
  calculateRoute(provider(fetcher), request, new AbortController().signal);

it.each([
  ["walking", "pedestrian", walk, 1434, 1015.743, 67],
  ["running", "pedestrian", walk, 1434, 1015.743, 67],
  ["cycling", "bicycle", bike, 1315, 291.501, 63],
] as const)(
  "maps %s and retains pilot totals and geometry",
  async (profile, costing, fixture, meters, seconds, vertices) => {
    const fetcher = vi
      .fn<ValhallaRoutingFetch>()
      .mockResolvedValue(json(fixture));
    const request = input(fixture, profile);
    const path = await run(fetcher, request);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(origin + "/route");
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      credentials: "omit",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      costing,
      units: "kilometers",
      format: "json",
      locations: request.waypoints.map(([lon, lat]) => ({
        lon,
        lat,
        type: "break",
      })),
    });
    expect(path.distanceMeters).toBeCloseTo(meters, 8);
    expect(path.durationSeconds).toBe(seconds);
    expect(path.geometry.coordinates).toHaveLength(vertices);
    expect(path.geometry.coordinates[0]).toEqual(
      profile === "cycling" ? [85.427328, 27.672359] : [85.307343, 27.70453],
    );
    expect(path.provenance).toMatchObject({
      provider: "valhalla",
      profile,
      offlineStoragePermitted: false,
    });
  },
);

it("joins captured multi-leg geometry and measures snaps at each waypoint", async () => {
  const request = input(multi);
  const result = await run(async () => json(multi), request);
  expect(result.geometry.coordinates).toHaveLength(93);
  expect(result.waypointIndices).toEqual([0, 48, 92]);
  expect(result.waypointSnaps?.map((snap) => snap.severity)).toEqual([
    "caution",
    "normal",
    "normal",
  ]);
  expect(result.waypointSnaps?.map((snap) => snap.requested)).toEqual(
    request.waypoints,
  );
  expect(result.waypointSnaps?.map((snap) => snap.snapped)).toEqual(
    result.waypointIndices.map((i) => result.geometry.coordinates[i]),
  );
  expect(result.waypointSnaps?.[0].distanceMeters).toBeCloseTo(36, 0);
  expect(result.waypointSnaps?.[1].distanceMeters).toBeCloseTo(8.8, 0);
});

it.each([
  [bike, 54.7],
  [fixtures["bike-kathmandu-square"], 63.1],
] as const)(
  "keeps a valid cycling result with a large snap",
  async (fixture, meters) => {
    const result = await run(
      async () => json(fixture),
      input(fixture, "cycling"),
    );
    expect(result.waypointSnaps?.[0].severity).toBe("large");
    expect(result.waypointSnaps?.[0].distanceMeters).toBeCloseTo(meters, 0);
  },
);

it("blocks non-development and non-loopback endpoints before fetch", async () => {
  const fetcher = vi.fn<ValhallaRoutingFetch>();
  const signal = new AbortController().signal;
  for (const [development, baseUrl] of [
    [false, origin],
    [true, undefined],
    [true, "http://192.0.2.1:8002"],
    [true, "http://127.0.0.1:8002@192.0.2.1"],
    [true, origin + "?proxy=1"],
    [true, "http://127.0.0.1:65536"],
  ] as const) {
    const routing = createValhallaRoutingProvider({
      development,
      baseUrl,
      fetcher,
    });
    await expect(routing.calculate(input(), signal)).rejects.toMatchObject({
      code: "unavailable",
    });
  }
  expect(fetcher).not.toHaveBeenCalled();
});

it("rejects missing, invalid or excessive waypoints before fetch", async () => {
  const fetcher = vi.fn<ValhallaRoutingFetch>();
  const request = input();
  const routing = provider(fetcher);
  for (const waypoints of [
    [[85, 95], request.waypoints[1]],
    [[Infinity, 27], request.waypoints[1]],
    request.waypoints.slice(0, 1),
    Array.from({ length: 51 }, () => request.waypoints[0]),
  ] as const) {
    await expect(
      routing.calculate(
        { ...request, waypoints },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid" });
  }
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([
  [400, 100, "invalid"],
  [400, 120, "invalid"],
  [400, 125, "unavailable"],
  [400, 130, "invalid"],
  [400, 150, "invalid"],
  [400, 171, "no-route"],
  [400, 1234, "provider"],
  [500, 171, "provider"],
  [403, undefined, "unavailable"],
  [429, undefined, "rate-limit"],
  [504, undefined, "timeout"],
] as const)(
  "normalizes HTTP %s / Valhalla %s as %s",
  async (status, error_code, code) => {
    const result = run(async () =>
      json({ error_code, error: "private upstream detail" }, status),
    );
    await expect(result).rejects.toMatchObject({ code });
    await expect(result).rejects.not.toThrow("private upstream detail");
  },
);

it("sanitizes connection failures and rejects malformed or discontinuous routes", async () => {
  await expect(
    run(async () => {
      throw new Error("ECONNREFUSED");
    }),
  ).rejects.toMatchObject({
    code: "network",
    message: "Could not reach the local routing service.",
  });
  await expect(
    run(async () => new Response("invalid JSON")),
  ).rejects.toMatchObject({ code: "invalid" });
  await expect(
    run(async () => new Response("invalid JSON", { status: 502 })),
  ).rejects.toMatchObject({ code: "provider" });
  for (const body of [
    { trip: { ...multi.trip, units: "miles" } },
    { trip: { ...multi.trip, summary: { length: -1, time: 1 } } },
    { trip: { ...multi.trip, summary: { length: 1, time: "2" } } },
    { trip: { ...multi.trip, legs: [walk.trip.legs[0], multi.trip.legs[1]] } },
    { trip: { ...multi.trip, legs: [{ shape: "_" }, multi.trip.legs[1]] } },
    {
      trip: {
        ...multi.trip,
        legs: [{ shape: "???\u007f" }, multi.trip.legs[1]],
      },
    },
    {
      trip: {
        ...multi.trip,
        legs: [{ shape: "a_gsiaD????" }, multi.trip.legs[1]],
      },
    },
    { trip: { ...multi.trip, legs: multi.trip.legs.slice(0, 1) } },
    {
      trip: {
        ...multi.trip,
        locations: [{ lon: 180.1, lat: 0 }, ...multi.trip.locations.slice(1)],
      },
    },
  ]) {
    await expect(
      run(async () => json(body), input(multi)),
    ).rejects.toMatchObject({ code: "invalid" });
  }
});

it("propagates abort to fetch and enforces the shared request timeout", async () => {
  const fetcher = vi.fn<ValhallaRoutingFetch>(() => new Promise(() => {}));
  const routing = provider(fetcher);
  const controller = new AbortController();
  const request = calculateRoute(routing, input(), controller.signal);
  await Promise.resolve();
  controller.abort();
  await expect(request).rejects.toMatchObject({ code: "cancelled" });
  expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(true);

  await expect(
    calculateRoute(routing, input(), new AbortController().signal, {
      timeoutMs: 5,
    }),
  ).rejects.toMatchObject({ code: "timeout" });
  expect(fetcher.mock.calls[1][1].signal?.aborted).toBe(true);
});

it("discards stale Valhalla results and isolates independent draft controllers", async () => {
  let resolveOld!: (result: Response) => void;
  const fetcher = vi
    .fn<ValhallaRoutingFetch>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockImplementation(async () => json(multi));
  const routing = provider(fetcher);
  const draft = createRouteRequestController(routing);
  const other = createRouteRequestController(routing);
  const pending = draft.request(input());
  await Promise.resolve();
  await Promise.all([
    draft.request(input(multi)),
    other.request(input(multi, "running")),
  ]);
  resolveOld(json(walk));
  await pending;
  await Promise.resolve();
  expect(draft.getState()).toMatchObject({
    status: "ready",
    path: { distanceMeters: 1591 },
  });
  draft.clear();
  expect(draft.getState()).toEqual({ status: "idle" });
  expect(other.getState()).toMatchObject({
    status: "ready",
    request: { profile: "running" },
  });
});

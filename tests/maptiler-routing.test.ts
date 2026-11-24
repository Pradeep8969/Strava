import { expect, it, vi } from "vitest";
import {
  createMapTilerRoutingProvider,
  type MapTilerRoutingFetch,
} from "../features/routes/maptiler-routing";
import {
  calculateRoute,
  type RoutingRequest,
} from "../features/routes/routing";

const waypoints = [
  [85.31, 27.71],
  [85.32, 27.72],
  [85.33, 27.73],
] as const;
const joint = [85.3201, 27.7201];
const responseBody = {
  units: "km",
  attribution: "MapTiler and OpenStreetMap contributors",
  route: {
    summary: { totalLength: 3.52, totalTime: 1880 },
    legs: [
      { geometry: [[85.3101, 27.7101], [85.311, 27.713], joint] },
      { geometry: [joint, [85.323, 27.724], [85.3301, 27.7301]] },
    ],
  },
};
const request: RoutingRequest = { profile: "walking", waypoints };
function run(
  fetcher: MapTilerRoutingFetch,
  input = request,
  apiKey = "fixture/+key",
) {
  return calculateRoute(
    createMapTilerRoutingProvider({ apiKey, fetcher }),
    input,
    new AbortController().signal,
  );
}
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

it.each([
  ["walking", "pedestrian"],
  ["running", "pedestrian"],
  ["cycling", "bicycle"],
] as const)(
  "maps %s to %s with ordered longitude/latitude waypoints and validated geometry",
  async (profile, mapped) => {
    const fetcher = vi
      .fn<MapTilerRoutingFetch>()
      .mockResolvedValue(json(responseBody));
    const result = await run(fetcher, { ...request, profile });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "https://api.maptiler.com/routing/v1/directions?key=fixture%2F%2Bkey",
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      profile: mapped,
      locations: waypoints.map(([lon, lat]) => ({ lon, lat, waypoint: true })),
      response: { units: "km" },
    });
    expect(result).toMatchObject({
      geometry: {
        type: "LineString",
        coordinates: [
          ...responseBody.route.legs[0].geometry,
          ...responseBody.route.legs[1].geometry.slice(1),
        ],
      },
      distanceMeters: 3520,
      durationSeconds: 1880,
      waypointIndices: [0, 2, 4],
      provenance: {
        provider: "maptiler",
        profile,
        offlineStoragePermitted: false,
      },
    });
    expect(result.geometry.coordinates[0]).not.toEqual(waypoints[0]);
  },
);

it("supports a response without duration or an echoed units field", async () => {
  const body = {
    ...responseBody,
    units: undefined,
    route: {
      ...responseBody.route,
      summary: { totalLength: 3.52 },
    },
  };
  await expect(
    run(vi.fn<MapTilerRoutingFetch>().mockResolvedValue(json(body))),
  ).resolves.not.toHaveProperty("durationSeconds");
});

it("rejects malformed, oversized, disconnected, or incorrectly measured responses", async () => {
  for (const body of [
    null,
    { ...responseBody, units: "mi" },
    { ...responseBody, attribution: "" },
    {
      ...responseBody,
      route: { ...responseBody.route, summary: { totalLength: -1 } },
    },
    {
      ...responseBody,
      route: {
        ...responseBody.route,
        summary: { totalLength: 3, totalTime: "60" },
      },
    },
    ...[
      [],
      [
        {
          geometry: [
            [85, 27],
            [85, 28],
          ],
        },
      ],
      [
        responseBody.route.legs[0],
        {
          geometry: [
            [86, 27],
            [85, 28],
          ],
        },
      ],
      [responseBody.route.legs[0], { geometry: [joint, [85, 127]] }],
      [
        responseBody.route.legs[0],
        { geometry: Array.from({ length: 100001 }, () => joint) },
      ],
    ].map((legs) => ({
      ...responseBody,
      route: { ...responseBody.route, legs },
    })),
  ]) {
    await expect(
      run(vi.fn<MapTilerRoutingFetch>().mockResolvedValue(json(body))),
    ).rejects.toMatchObject({ code: "invalid" });
  }
  await expect(
    run(
      vi.fn<MapTilerRoutingFetch>().mockResolvedValue(new Response("{broken")),
    ),
  ).rejects.toMatchObject({ code: "invalid" });
});

it("classifies provider and transport errors without exposing the request key", async () => {
  for (const [response, code] of [
    [json({}, 403), "unavailable"],
    [json({}, 500), "provider"],
    [json({ code: "MT_PATH_NOT_FOUND" }, 400), "no-route"],
  ] as const)
    await expect(
      run(vi.fn<MapTilerRoutingFetch>().mockResolvedValue(response)),
    ).rejects.toMatchObject({ code });
  await expect(
    run(
      vi
        .fn<MapTilerRoutingFetch>()
        .mockResolvedValue(json({}, 429, { "Retry-After": "30" })),
    ),
  ).rejects.toMatchObject({ code: "rate-limit", retryAfterSeconds: 30 });
  const failed = vi
    .fn<MapTilerRoutingFetch>()
    .mockRejectedValue(new Error("request URL contains fixture secret"));
  await expect(run(failed)).rejects.toMatchObject({
    code: "network",
    message: "Could not reach MapTiler Directions.",
  });

  const missing = vi.fn<MapTilerRoutingFetch>();
  await expect(run(missing, request, " ")).rejects.toMatchObject({
    code: "unavailable",
  });
  expect(missing).not.toHaveBeenCalled();
});

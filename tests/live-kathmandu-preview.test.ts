import {
  Children,
  isValidElement,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import { expect, it, vi } from "vitest";
import LiveKathmanduPreview from "../components/LiveKathmanduPreview";
import {
  liveKathmanduEndpoint,
  liveKathmanduError,
  requestLiveKathmanduRoute,
} from "../features/routes/live-kathmandu-preview";
import { roadPreviewMap } from "../features/routes/road-preview";
import {
  createRouteRequestController,
  type RoutingRequest,
} from "../features/routes/routing";
import {
  createValhallaRoutingProvider,
  type ValhallaRoutingFetch,
} from "../features/routes/valhalla-routing";
import fixtures from "../features/routes/valhalla-pilot.json";

const expo = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("expo/fetch", () => expo);
vi.mock("expo-router", () => ({ useFocusEffect: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: vi.fn((value: unknown) => [
    typeof value === "function" ? value() : value,
    vi.fn(),
  ]),
  useMemo: vi.fn((read: () => unknown) => read()),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("../components/PlannerMap", () => ({ default: "PlannerMap" }));
vi.mock("../components/dashboard-ui", () => ({
  DashboardTabs: "DashboardTabs",
}));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Copy: "Copy",
  Heading: "Heading",
  Row: "Row",
  Screen: "Screen",
}));
vi.mock("../services/planned-routes", () => {
  throw new Error("Preview imported local persistence");
});
vi.mock("../services/route-cloud", () => {
  throw new Error("Preview imported cloud persistence");
});
const origin = "http://127.0.0.1:8002";
const fixture = fixtures["bike-kathmandu-square"];
const request: RoutingRequest = {
  profile: "cycling",
  waypoints: fixture.trip.locations.map(({ lon, lat }) => [lon, lat]),
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
const controllerFor = (fetcher: ValhallaRoutingFetch) =>
  createRouteRequestController(
    createValhallaRoutingProvider({
      development: true,
      baseUrl: origin,
      fetcher,
    }),
  );

it("requires Android development mode and the explicit exact USB origin", () => {
  expect(liveKathmanduEndpoint(true, "android", origin)).toBe(origin);
  for (const invalid of [
    undefined,
    "",
    "http://192.0.2.1:8002",
    "http://localhost:8002",
    "https://127.0.0.1:8002",
    "http://127.0.0.1:8081",
    origin + "/route",
    origin + "?proxy=1",
    origin + "@192.0.2.1",
  ])
    expect(liveKathmanduEndpoint(true, "android", invalid)).toBeUndefined();
  expect(liveKathmanduEndpoint(false, "android", origin)).toBeUndefined();
  expect(liveKathmanduEndpoint(true, "web", origin)).toBeUndefined();
  expect(liveKathmanduEndpoint(true, "ios", origin)).toBeUndefined();
});

it("publishes loading and ready, uses only the loopback URL and renders preserved snaps", async () => {
  const fetcher = vi
    .fn<ValhallaRoutingFetch>()
    .mockResolvedValue(json(fixture));
  const publish = vi.fn();
  const controller = controllerFor(fetcher);
  await requestLiveKathmanduRoute(controller, request, publish);
  expect(publish.mock.calls.map(([state]) => state.status)).toEqual([
    "loading",
    "ready",
  ]);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    origin + "/route",
    expect.objectContaining({
      redirect: "error",
      credentials: "omit",
    }),
  );
  const state = controller.getState();
  if (state.status !== "ready") throw new Error("Expected route");
  const map = roadPreviewMap(request.waypoints, state.path);
  expect(map.line).toHaveLength(93);
  expect(map.markers[0]).toMatchObject({
    requested: { latitude: 27.7043, longitude: 85.3076 },
    snapped: { latitude: 27.703738, longitude: 85.307512 },
    severity: "large",
    offset: 63,
  });
  expect(state.path.provenance.offlineStoragePermitted).toBe(false);
});

it("suppresses cancelled and out-of-order results, keeping the latest request", async () => {
  const settle: ((response: Response) => void)[] = [];
  const fetcher = vi.fn<ValhallaRoutingFetch>(
    () => new Promise((resolve) => settle.push(resolve)),
  );
  const controller = controllerFor(fetcher);
  const publish = vi.fn();
  const old = requestLiveKathmanduRoute(controller, request, publish);
  await Promise.resolve();
  const latest = requestLiveKathmanduRoute(
    controller,
    { ...request, profile: "running" },
    publish,
  );
  await Promise.resolve();
  expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(true);
  settle[1](json(fixture));
  await latest;
  settle[0](json(fixture));
  await old;
  expect(publish.mock.calls.map(([state]) => state.status)).toEqual([
    "loading",
    "loading",
    "ready",
  ]);
  expect(controller.getState()).toMatchObject({
    status: "ready",
    request: { profile: "running" },
  });
  publish.mockClear();
  const pending = requestLiveKathmanduRoute(controller, request, publish);
  await Promise.resolve();
  controller.clear();
  expect(fetcher.mock.calls[2][1].signal?.aborted).toBe(true);
  settle[2](json(fixture));
  await pending;
  expect(controller.getState()).toEqual({ status: "idle" });
  expect(publish.mock.calls.map(([state]) => state.status)).toEqual([
    "loading",
  ]);
});

it("handles USB failure, timeout, no route, invalid coordinates and malformed responses, then retries", async () => {
  const fetcher = vi
    .fn<ValhallaRoutingFetch>()
    .mockRejectedValueOnce(new Error("private transport detail"))
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValueOnce(json({ error_code: 171 }, 400))
    .mockResolvedValueOnce(json({ error_code: 442 }, 400))
    .mockResolvedValueOnce(json({ trip: {} }))
    .mockResolvedValueOnce(json(fixture));
  const controller = controllerFor(fetcher);
  const publish = vi.fn();
  for (const code of [
    "network",
    "timeout",
    "no-route",
    "no-route",
    "invalid",
  ] as const) {
    await requestLiveKathmanduRoute(controller, request, publish, {
      timeoutMs: 10,
    });
    expect(controller.getState()).toMatchObject({
      status: "error",
      error: { code },
    });
    expect(liveKathmanduError(code)).not.toContain("private transport detail");
  }
  await requestLiveKathmanduRoute(
    controller,
    {
      ...request,
      waypoints: [
        [85, 95],
        [85, 27],
      ],
    },
    publish,
  );
  expect(controller.getState()).toMatchObject({
    status: "error",
    error: { code: "invalid" },
  });
  expect(fetcher).toHaveBeenCalledTimes(5);
  await requestLiveKathmanduRoute(controller, request, publish);
  expect(controller.getState()).toMatchObject({ status: "ready" });
  expect(liveKathmanduError("network")).toContain("port 8002 is reversed");
});

function elements(
  node: ReactNode,
): { type: unknown; props: Record<string, unknown> }[] {
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(elements)];
}

it("opens an independent read-only draft without fetching or exposing save and follow actions", () => {
  const close = vi.fn();
  const tree = LiveKathmanduPreview({
    endpoint: origin,
    initialWaypoints: request.waypoints,
    onClose: close,
  });
  const all = elements(tree);
  const buttons = all.filter(({ type }) => type === "Button");
  expect(buttons.map(({ props }) => props.title)).toEqual([
    "Back to planning",
    "Use sample points",
    "Undo point",
    "Clear points",
    "Calculate route",
  ]);
  const map = all.find(({ type }) => type === "PlannerMap")?.props;
  expect(map?.roadPreview).toMatchObject({
    line: [],
    markers: [{ label: "Start" }, { label: "Finish" }],
  });
  (map?.onWaypoint as (p: { latitude: number; longitude: number }) => void)({
    latitude: 27,
    longitude: 85,
  });
  (buttons[0].props.onPress as () => void)();
  expect(close).toHaveBeenCalledOnce();
  expect(expo.fetch).not.toHaveBeenCalled();
  expect(request.waypoints).toHaveLength(2);
});

it("replaces Calculate with Cancel in place and ignores a response after the user cancels", async () => {
  let resolveResponse!: (response: Response) => void;
  expo.fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
  );
  const state: unknown[] = [];
  let stateIndex = 0;
  const memos = vi.mocked(useMemo);
  const states = vi.mocked(useState);
  let controller: unknown;
  const close = vi.fn();
  const render = () => {
    stateIndex = 0;
    memos.mockImplementationOnce(
      (read) => (controller ??= read()) as ReturnType<typeof read>,
    );
    return elements(
      LiveKathmanduPreview({
        endpoint: origin,
        initialWaypoints: request.waypoints,
        onClose: close,
      }),
    );
  };
  const buttons = (tree: ReturnType<typeof render>) =>
    tree.filter(({ type }) => type === "Button");
  const press = (button: ReturnType<typeof buttons>[number]) =>
    (button.props.onPress as () => void)();
  states.mockImplementation(
    (initial?: unknown): [unknown, (value: unknown) => void] => {
      const index = stateIndex++;
      if (index === state.length)
        state.push(typeof initial === "function" ? initial() : initial);
      return [
        state[index],
        (value: unknown) => {
          state[index] = value;
        },
      ];
    },
  );
  try {
    const initialTree = render();
    const initial = buttons(initialTree);
    const index = initial.findIndex(
      ({ props }) => props.title === "Calculate route",
    );
    press(initial[index]);
    await Promise.resolve();
    const loadingTree = render();
    const loading = buttons(loadingTree);
    expect(loading[index].props.title).toBe("Cancel calculation");
    expect(loadingTree.indexOf(loading[index])).toBe(
      initialTree.indexOf(initial[index]),
    );
    press(loading[index]);
    expect(expo.fetch.mock.lastCall?.[1].signal.aborted).toBe(true);
    resolveResponse(json(fixture));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const after = render();
    expect(buttons(after)[index].props.title).toBe("Calculate route");
    expect(
      after.some(
        ({ props }) => props.children === "Route calculation cancelled.",
      ),
    ).toBe(true);
    expect(
      after.find(({ type }) => type === "PlannerMap")?.props.roadPreview,
    ).toEqual(roadPreviewMap(request.waypoints));
    expect(close).not.toHaveBeenCalled();
  } finally {
    states.mockReset();
    memos.mockReset();
    expo.fetch.mockClear();
  }
});

import { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Routes from "../src/app/routes";
import fixtures from "../features/routes/valhalla-pilot.json";
import { waypoint } from "../features/routes/planner";

const mock = vi.hoisted(() => ({
  fetch: vi.fn(),
  save: vi.fn(),
  queue: vi.fn(),
  publish: vi.fn(),
  mode: "Road-following",
  profile: "walking",
  platform: "android",
  cleanup: undefined as undefined | (() => void),
  points: [] as unknown[],
  interactive: false,
  hooks: [] as unknown[],
  hookIndex: 0,
  falseStates: 0,
  confirmClear: undefined as undefined | (() => void),
  dismiss: vi.fn(),
}));
function hookSlot(initial: unknown) {
  const index = mock.hookIndex++;
  if (!(index in mock.hooks)) mock.hooks[index] = initial;
  return index;
}
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (value: unknown) => {
    const initial = typeof value === "function" ? value() : value;
    if (!mock.interactive)
      return [
        initial === "Straight-line"
          ? mock.mode
          : initial === "walking"
            ? mock.profile
            : typeof initial === "object" && initial && "history" in initial
              ? { ...initial, points: mock.points }
              : initial === false
                ? ++mock.falseStates === 3
                : initial,
        mock.publish,
      ];
    const index = hookSlot(initial);
    return [
      mock.hooks[index],
      (next: unknown) => {
        mock.hooks[index] =
          typeof next === "function" ? next(mock.hooks[index]) : next;
      },
    ];
  },
  useMemo: (read: () => unknown) => read(),
  useLayoutEffect: () => undefined,
  useCallback: (read: unknown) => read,
  useRef: (current: unknown) => {
    if (!mock.interactive) return { current };
    return mock.hooks[hookSlot({ current })];
  },
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mock.platform;
    },
  },
  Text: "Text",
  View: "View",
  Modal: "Modal",
  Keyboard: { dismiss: mock.dismiss },
  Alert: {
    alert: (
      _title: string,
      _detail: string,
      buttons: { onPress?: () => void }[],
    ) => {
      mock.confirmClear = buttons.at(-1)?.onPress;
    },
  },
  useWindowDimensions: () => ({ width: 360 }),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useFocusEffect: (start: () => (() => void) | undefined) => {
    mock.cleanup = start();
  },
}));
vi.mock("expo/fetch", () => ({ fetch: mock.fetch }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "new-route" }));
vi.mock("../components/PlannerMap", () => ({ default: "PlannerMap" }));
vi.mock("../components/KathmanduRoadsPreview", () => ({
  default: "KathmanduRoadsPreview",
}));
vi.mock("../components/LiveKathmanduPreview", () => ({
  default: "LiveKathmanduPreview",
}));
vi.mock("../components/RoadPreviewDetails", () => ({
  default: "RoadPreviewDetails",
}));
vi.mock("../components/WaypointSearch", () => ({ default: "WaypointSearch" }));
vi.mock("../components/SavedRouteOpen", () => ({
  SavedRouteOpen: "SavedRouteOpen",
  FollowRouteActions: "FollowRouteActions",
}));
vi.mock("../components/dashboard-ui", () => ({
  DashboardTabs: "DashboardTabs",
}));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Copy: "Copy",
  Heading: "Heading",
  Field: "Field",
  Row: "Row",
  Screen: "Screen",
  useColors: () => ({}),
}));
vi.mock("../hooks/useSession", () => ({ useSession: () => undefined }));
vi.mock("../hooks/useAction", () => ({
  useAction: () => ({
    busy: false,
    run: (action: () => Promise<void>) => action(),
  }),
}));
vi.mock("../hooks/useRoutePreview", () => ({
  useRoutePreview: () => ({ status: "idle" }),
}));
vi.mock("../hooks/useRouteLibrary", () => ({
  useRouteLibrary: () => ({ plans: [], loaded: true, settled: true }),
}));
vi.mock("../hooks/useRouteSync", () => ({
  useRouteSyncStatus: () => ({ syncing: false }),
}));
vi.mock("../services/planned-routes", () => ({ savePlan: mock.save }));
vi.mock("../services/route-cloud", () => ({
  queueAccountRoute: mock.queue,
  notifyRouteLibrary: vi.fn(),
}));

const origin = "http://127.0.0.1:8002";
const fixture = fixtures["walk-kathmandu"];
function nodes(value: unknown): ReactElement<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isValidElement<Record<string, any>>(value)) return [];
  return [value, ...nodes(value.props.children)];
}
const render = () => {
  mock.hookIndex = 0;
  mock.falseStates = 0;
  return nodes((Routes().type as () => ReactElement)());
};
beforeEach(() => {
  vi.stubGlobal("__DEV__", true);
  vi.stubEnv("EXPO_PUBLIC_VALHALLA_USB_BASE_URL", origin);
  vi.clearAllMocks();
  mock.mode = "Road-following";
  mock.profile = "walking";
  mock.platform = "android";
  mock.interactive = false;
  mock.hooks = [];
  mock.save.mockResolvedValue(undefined);
  mock.points = fixture.trip.locations.map(({ lat, lon }) =>
    waypoint({ latitude: lat, longitude: lon }),
  );
});

it("builds, edits, previews, and saves a straight-line route from an empty Android draft", async () => {
  mock.interactive = true;
  const start = { latitude: 27.7043, longitude: 85.3076 };
  const finish = { latitude: 27.70505, longitude: 85.31471 };
  const stop = { latitude: 27.71, longitude: 85.31 };
  const moved = { latitude: 27.72, longitude: 85.32 };
  const button = (title: string) =>
    render().find((node) => node.props.title === title)!.props;
  const map = () => render().find((node) => node.type === "PlannerMap")!.props;
  expect(button("Set Destination").disabled).toBe(true);
  expect(button("Save route offline").disabled).toBe(true);
  map().onWaypoint(start);
  expect(map().placement.target).toEqual(start);
  const abandoned = map().placement.onConfirm;
  map().onCancelPlacement();
  abandoned(start);
  expect(map().points).toEqual([]);
  button("Set Start").onPress();
  button("Search for Start").onPress();
  render()
    .find(({ props }) => typeof props.onSelect === "function")!
    .props.onSelect(start);
  expect(render().some(({ type }) => type === "Modal")).toBe(false);
  expect(map().points).toEqual([]);
  expect(map().placement.target).toEqual(start);
  map().placement.onConfirm(start);
  button("Set Destination").onPress();
  map().placement.onConfirm(finish);
  expect(map().fitRequest).toBe(1);
  expect(button("Save route offline").disabled).toBe(false);
  button("Add waypoint").onPress();
  map().placement.onConfirm(stop);
  button("Edit waypoint 2").onPress();
  map().placement.onConfirm(moved);
  expect(map().points[1]).toMatchObject(moved);
  button("Undo point").onPress();
  expect(map().points[1]).toMatchObject(stop);
  button("Clear waypoints").onPress();
  mock.confirmClear!();
  expect(map().points).toEqual([]);
  button("Undo point").onPress();
  expect(map().points).toMatchObject([start, stop, finish]);
  button("Save route offline").onPress();
  await vi.waitFor(() => expect(map().points).toEqual([]));
  expect(mock.save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      planningMode: "straight-line",
      geometry: {
        type: "LineString",
        coordinates: [
          [start.longitude, start.latitude],
          [stop.longitude, stop.latitude],
          [finish.longitude, finish.latitude],
        ],
      },
    }),
  );
  expect(mock.fetch).not.toHaveBeenCalled();
});

it("starts the USB preview only after Calculate route is pressed", async () => {
  mock.interactive = true;
  const button = (title: string) =>
    render().find(({ props }) => props.title === title)!.props;
  const map = () => render().find(({ type }) => type === "PlannerMap")!.props;
  for (const point of mock.points as {
    latitude: number;
    longitude: number;
  }[]) {
    map().onWaypoint(point);
    map().placement.onConfirm(point);
  }
  button("Routing tools").onPress();
  render()
    .find(({ props }) => props.label === "Route planning mode")!
    .props.onChange("Road-following");
  const calculate = button("Calculate route");
  await Promise.resolve();
  expect(mock.fetch).not.toHaveBeenCalled();
  mock.fetch.mockImplementationOnce(() => new Promise(() => {}));
  calculate.onPress();
  expect(button("Cancel calculation").onPress).toBeTypeOf("function");
  await Promise.resolve();
  expect(mock.fetch).toHaveBeenCalledOnce();
});
afterEach(() => {
  mock.cleanup?.();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("runs real loopback costing for the selected draft and keeps the result out of Save", async () => {
  const reply = () => new Response(JSON.stringify(fixture), { status: 200 });
  let settle!: (response: Response) => void;
  mock.fetch
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        }),
    )
    .mockResolvedValueOnce(reply());
  const tree = render();
  const map = tree.find(({ type }) => type === "PlannerMap")!;
  expect(map.props.hideWaypointLine).toBe(true);
  expect(map.props.roadPreview.line).toEqual([]);
  expect(tree.some(({ props }) => /^Save route/.test(props.title ?? ""))).toBe(
    false,
  );
  await Promise.resolve();
  const first = mock.fetch.mock.calls[0][1];
  const cancel = tree.find(
    ({ props }) => props.title === "Cancel calculation",
  )!;
  cancel.props.onPress();
  expect(first.signal.aborted).toBe(true);
  mock.cleanup?.();
  mock.profile = "cycling";
  render();
  await vi.waitFor(() =>
    expect(mock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          status: "ready",
          path: expect.objectContaining({
            provenance: expect.objectContaining({
              provider: "valhalla",
              offlineStoragePermitted: false,
            }),
          }),
        }),
      }),
    ),
  );
  settle(reply());
  expect(
    mock.fetch.mock.calls.map(([url, init]) => [
      url,
      JSON.parse(init.body).costing,
    ]),
  ).toEqual([
    [origin + "/route", "pedestrian"],
    [origin + "/route", "bicycle"],
  ]);
  expect(mock.save).not.toHaveBeenCalled();
  expect(mock.queue).not.toHaveBeenCalled();
});

it.each([
  [true, "android", "http://localhost:8002"],
  [true, "ios", origin],
  [false, "android", origin],
] as const)(
  "blocks live transport when development=%s platform=%s origin=%s",
  async (development, platform, configured) => {
    vi.stubGlobal("__DEV__", development);
    vi.stubEnv("EXPO_PUBLIC_VALHALLA_USB_BASE_URL", configured);
    mock.platform = platform;
    const tree = render();
    await Promise.resolve();
    expect(mock.fetch).not.toHaveBeenCalled();
    expect(
      tree.some(({ props }) => props.title === "Live Kathmandu Routing (USB)"),
    ).toBe(false);
    if (development && platform === "android") {
      expect(
        tree.find(({ type }) => type === "PlannerMap")?.props.hideWaypointLine,
      ).toBe(true);
      expect(
        tree.some(({ props }) =>
          /^Road-following unavailable/.test(
            typeof props.children === "string" ? props.children : "",
          ),
        ),
      ).toBe(true);
      expect(
        tree.some(({ props }) => /^Save route/.test(props.title ?? "")),
      ).toBe(false);
    }
  },
);

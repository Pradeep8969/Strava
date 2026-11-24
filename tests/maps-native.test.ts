import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import DiscoveryMap from "../components/DiscoveryMap";
import TrackMap from "../components/TrackMap";
import RecorderMap from "../components/RecorderMap";
import { trainingFixture } from "./fixtures/training";

const native = vi.hoisted(() => ({
  os: "ios",
  ready: false,
  runEffects: false,
  camera: { fitToCoordinates: vi.fn(), animateToRegion: vi.fn() },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({
    current: native.runEffects && value === null ? native.camera : value,
  }),
  useState: (value: unknown) => [
    value === false && native.ready ? true : value,
    vi.fn(),
  ],
  useEffect: (effect: () => void | (() => void)) => {
    if (native.runEffects) effect()?.();
  },
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return native.os;
    },
  },
  View: "View",
  Text: "Text",
}));
vi.mock("../components/maps/NativeMap", () => ({
  default: "MapView",
  Marker: "Marker",
  Polyline: "Polyline",
}));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Copy: "Copy",
  Card: "Card",
  useColors: () => ({ bg: "#F6F7F4", text: "#123", muted: "#456" }),
}));
vi.mock("../components/athlete", () => ({ AthleteText: "Text" }));
vi.mock("expo-location", () => ({}));
function elements(value: unknown): ReactElement<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!isValidElement<Record<string, any>>(value)) return [];
  return [value, ...elements(value.props.children)];
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  native.ready = false;
  native.runEffects = false;
});
it.each(["ios", "android"])(
  "renders native %s saved route overlays inside MapView and selects markers",
  (os) => {
    native.os = os;
    vi.stubEnv("EXPO_PUBLIC_GOOGLE_MAPS_KEY", "");
    vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "test-native-key");
    const workout = trainingFixture();
    const onSelect = vi.fn();
    const nodes = elements(
      DiscoveryMap({
        routes: [
          {
            id: workout.id,
            title: workout.title,
            kind: "recording",
            points: workout.points,
          },
        ],
        selectedId: workout.id,
        onSelect,
      }),
    );
    const map = nodes.find((element) => element.type === "MapView")!;
    const overlays = elements(map.props.children);
    expect(
      overlays.find((element) => element.type === "Polyline")!.props
        .coordinates,
    ).toEqual(workout.points);
    overlays
      .find(
        (element) =>
          element.type === "Marker" && element.props.title === workout.title,
      )!
      .props.onPress();
    expect(onSelect).toHaveBeenCalledWith(workout.id);
  },
);
it("never puts native map overlays in the missing-configuration fallback", () => {
  native.os = "android";
  vi.stubEnv("EXPO_PUBLIC_GOOGLE_MAPS_KEY", "");
  vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "");
  const nodes = elements(
    DiscoveryMap({
      routes: [
        {
          id: "r",
          title: "Route",
          kind: "recording",
          points: trainingFixture().points,
        },
      ],
    }),
  );
  expect(
    nodes.some((element) =>
      ["MapView", "Marker", "Polyline"].includes(String(element.type)),
    ),
  ).toBe(false);
});
it.each(["ios", "android"])(
  "avoids %s map initialization for empty details and uses only accepted recording markers without a Google key",
  (os) => {
    native.os = os;
    vi.stubEnv("EXPO_PUBLIC_GOOGLE_MAPS_KEY", "");
    vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "test-native-key");
    expect(
      elements(TrackMap({ points: [] })).some(
        (element) => element.type === "MapView",
      ),
    ).toBe(false);
    const workout = trainingFixture();
    const nodes = elements(
      RecorderMap({ points: workout.points, current: true }),
    );
    expect(
      nodes.find((element) => element.type === "MapView")!.props
        .showsUserLocation,
    ).toBeUndefined();
    expect(
      nodes.find((element) => element.type === "Marker")!.props.coordinate,
    ).toEqual(workout.points.at(-1));
  },
);
it("draws no recording line across an Android GPS reacquisition", () => {
  native.os = "android";
  vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "test-native-key");
  const [first, second, third] = trainingFixture().points;
  const recovered = { ...third, segment: second.segment + 1 };
  const points = [first, second, recovered];
  const nodes = elements(RecorderMap({ points, current: true }));
  expect(
    nodes
      .filter((node) => node.type === "Polyline")
      .map((node) => node.props.coordinates),
  ).toEqual([[first, second]]);
  expect(
    nodes.find((node) => node.type === "Marker")?.props.coordinate,
  ).toEqual(recovered);
});
it("draws an offline guide separately from accepted GPS geometry on Android", () => {
  native.os = "android";
  vi.stubGlobal("__DEV__", false);
  vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "");
  const points = trainingFixture().points.slice(0, 2);
  const guide = {
    points: points.map((point) => ({
      ...point,
      longitude: point.longitude + 0.03,
    })),
  };
  const nodes = elements(RecorderMap({ points, current: true, guide }));
  expect(
    nodes.find((node) => node.type === "MapView")?.props.showOfflineGeometry,
  ).toBe(true);
  expect(
    nodes.filter((node) => node.type === "Polyline").map((node) => node.props),
  ).toEqual([
    expect.objectContaining({
      coordinates: guide.points,
      strokeColor: "#167F83",
    }),
    expect.objectContaining({ coordinates: points, strokeColor: "#ff784b" }),
  ]);
  expect(
    nodes.find(
      (node) =>
        node.type === "Marker" &&
        node.props.title === "Latest accepted GPS location",
    )?.props.coordinate,
  ).toEqual(points.at(-1));
});

it.each([2, 3])(
  "fits an offline Android guide of %i waypoints before Start",
  (count) => {
    native.os = "android";
    vi.stubGlobal("__DEV__", false);
    vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "");
    const guide = { points: trainingFixture().points.slice(0, count) };
    const nodes = elements(RecorderMap({ points: [], current: false, guide }));
    const map = nodes.find((node) => node.type === "MapView")!;
    expect(map.props.showOfflineGeometry).toBe(true);
    expect(map.props.initialFit.points).toEqual(guide.points);
    expect(
      nodes
        .filter((node) => node.type === "Marker")
        .map((node) => [node.props.title, node.props.coordinate]),
    ).toEqual(
      guide.points.map((point, index) => [
        index === 0 ? "Start" : index === count - 1 ? "Finish" : "Waypoint 2",
        point,
      ]),
    );
    expect(nodes.filter((node) => node.type === "Polyline")).toHaveLength(1);
  },
);

it("keeps a recovered or actively recording guide fitted when a GPS point exists", () => {
  native.os = "android";
  native.ready = true;
  native.runEffects = true;
  vi.stubGlobal("__DEV__", false);
  const guide = { points: trainingFixture().points };
  const point = { ...guide.points[0], longitude: 84 };
  const nodes = elements(
    RecorderMap({ points: [point], current: true, guide }),
  );
  expect(
    nodes.find((node) => node.type === "MapView")?.props.initialFit.points,
  ).toEqual(guide.points);
  expect(native.camera.fitToCoordinates).not.toHaveBeenCalled();
  expect(native.camera.animateToRegion).not.toHaveBeenCalled();
  expect(
    nodes.some(
      (node) =>
        node.type === "Button" && node.props.title === "Follow location",
    ),
  ).toBe(true);
});
it("keeps native saved activity replay geometry and replay markers without a Google key", () => {
  native.os = "android";
  vi.stubEnv("EXPO_PUBLIC_GOOGLE_MAPS_KEY", "");
  vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "test-native-key");
  const workout = trainingFixture();
  const cursor = workout.points[2];
  const nodes = elements(TrackMap({ points: workout.points, cursor }));
  expect(
    nodes.find((node) => node.type === "Polyline")!.props.coordinates,
  ).toEqual(workout.points);
  expect(
    nodes.find(
      (node) =>
        node.type === "Marker" && node.props.title === "Replay position",
    )!.props.coordinate,
  ).toEqual(cursor);
  expect(
    nodes.find(
      (node) =>
        node.type === "Button" && node.props.title === "Fit map to route",
    ),
  ).toBeDefined();
});

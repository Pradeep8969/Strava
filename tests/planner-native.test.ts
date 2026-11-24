import { afterEach, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import PlannerMap from "../components/PlannerMap";
import { AndroidCameraControls } from "../components/maps/AndroidCameraControls";
import { waypoint } from "../features/routes/planner";
import { readKathmanduPreview } from "../features/routes/kathmandu-preview";
const state = vi.hoisted(() => ({
  os: "ios",
  ready: false,
  height: 640,
  fit: vi.fn(),
  getCenter: vi.fn(),
  centerOn: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({
    current:
      value === null
        ? {
            fitToCoordinates: state.fit,
            getCenter: state.getCenter,
            centerOn: state.centerOn,
          }
        : value,
  }),
  useEffect: (run: () => void | (() => void)) => {
    if (state.ready) run()?.();
  },
  useMemo: (read: () => unknown) => read(),
  useCallback: (callback: unknown) => callback,
  useState: (value: unknown) => [
    value === false && state.ready ? true : value,
    vi.fn(),
  ],
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
  View: "View",
  useWindowDimensions: () => ({ width: 360, height: state.height }),
  Text: "Text",
}));
vi.mock("../components/maps/NativeMap", () => ({
  default: "MapView",
  Marker: "Marker",
  Polyline: "Polyline",
}));
vi.mock("../components/ui", () => ({ Copy: "Copy", Button: "Button" }));
vi.mock("../components/athlete", () => ({ IconButton: "IconButton" }));
vi.mock("expo-location", () => ({}));
void createElement;
afterEach(() => {
  state.ready = false;
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it.each(["ios", "android"])(
  "preserves %s map placement, endpoint markers and route geometry",
  (os) => {
    state.os = os;
    vi.stubEnv("EXPO_PUBLIC_GOOGLE_MAPS_KEY", "");
    vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "test-native-key");
    const points = [
      waypoint({ latitude: 27.7, longitude: 85.3 }),
      waypoint({ latitude: 27.71, longitude: 85.31 }),
    ];
    const onWaypoint = vi.fn();
    const tree = PlannerMap({ points, onWaypoint, fitRequest: 1 });
    const props = tree.props as {
      children: ReactElement<{
        children: ReactElement<Record<string, any>>[];
      }>[];
    };
    const map = props.children[0].props.children[0].props;
    map.onPress({
      nativeEvent: { coordinate: { latitude: 28, longitude: 84 } },
    });
    expect(onWaypoint).toHaveBeenCalledWith({ latitude: 28, longitude: 84 });
    map.onPress({
      nativeEvent: { coordinate: { latitude: NaN, longitude: 84 } },
    });
    expect(onWaypoint).toHaveBeenCalledTimes(1);
    expect(map.children[0].props.coordinates).toEqual(points);
    expect(map.children[1][1].props.title).toBe("Finish");
    map.onMapReady();
    expect(state.fit).not.toHaveBeenCalled();
    state.ready = true;
    PlannerMap({ points, onWaypoint, fitRequest: 1 });
    expect(state.fit).toHaveBeenLastCalledWith(
      points,
      expect.objectContaining({ animated: true }),
    );
  },
);
it("explains missing Android configuration and unsupported platforms", () => {
  state.os = "android";
  vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "");
  expect(
    PlannerMap({ points: [], onWaypoint: vi.fn(), fitRequest: 0 }).props
      .children,
  ).toContain("not configured");
  state.os = "windows";
  expect(
    PlannerMap({ points: [], onWaypoint: vi.fn(), fitRequest: 0 }).props
      .children,
  ).toContain("supported on web");
});
it("draws Android demo geometry separately from straight lines and endpoint markers", () => {
  state.os = "android";
  vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "test-native-key");
  const points = [
    waypoint({ latitude: 27.7, longitude: 85.3 }),
    waypoint({ latitude: 27.71, longitude: 85.31 }),
  ];
  const tree = PlannerMap({
    points,
    demoCoordinates: [
      [85.3, 27.7],
      [85.304, 27.707],
      [85.31, 27.71],
    ],
    onWaypoint: vi.fn(),
    fitRequest: 0,
  });
  const map = tree.props.children[0].props.children[0].props;
  expect(map.children[0].props.coordinates).toEqual(points);
  expect(map.children[1]).toHaveLength(2);
  expect(map.children[2].props).toMatchObject({
    coordinates: [
      { latitude: 27.7, longitude: 85.3 },
      { latitude: 27.707, longitude: 85.304 },
      { latitude: 27.71, longitude: 85.31 },
    ],
    strokeColor: "#007A87",
  });
});

it("renders the recorded line and both marker types on Android's geometry-only map", () => {
  state.os = "android";
  vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "");
  const fixture = readKathmanduPreview("Kathmandu cycling")!.map;
  const tree = PlannerMap({ points: [], fitRequest: 0, roadPreview: fixture });
  const map = tree.props.children[0].props.children[0].props;
  expect(map.showOfflineGeometry).toBe(true);
  expect(map.children[0]).toBeNull();
  expect(map.children[3].props.coordinates).toEqual(fixture.line);
  expect(map.children[4][0].props).toMatchObject({
    coordinate: { latitude: 27.7043, longitude: 85.3076 },
    title: "Requested Start",
  });
  expect(map.children[5][0].props).toMatchObject({
    coordinate: { latitude: 27.703738, longitude: 85.307512 },
    title: "Snapped Start",
  });
});

it("centers the map on a selected location and confirms only the current crosshair coordinate", async () => {
  state.os = "android";
  state.ready = true;
  const target = { latitude: 27.71, longitude: 85.31 };
  const center = { latitude: 27.72, longitude: 85.32 };
  const confirm = vi.fn(),
    cancel = vi.fn();
  state.getCenter.mockResolvedValue(center);
  const tree = PlannerMap({
    points: [],
    fitRequest: 0,
    placement: { target, onConfirm: confirm },
    onCancelPlacement: cancel,
  });
  const map = tree.props.children[0].props.children[0].props;
  expect(map.onPress).toBeUndefined();
  expect(state.centerOn).toHaveBeenCalledWith(target, 17, 0);
  expect(confirm).not.toHaveBeenCalled();
  const [confirmButton, cancelButton] = tree.props.children[1].props.children;
  cancelButton.props.onPress();
  expect(cancel).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
  confirmButton.props.onPress();
  await Promise.resolve();
  expect(confirm).toHaveBeenCalledExactlyOnceWith(center);
});

it("uses compact, named camera controls on a small Android viewport", () => {
  state.os = "android";
  const tree = PlannerMap({ points: [], fitRequest: 0 });
  const viewport = tree.props.children[0];
  expect(viewport.props.style.height).toBeCloseTo(358.4);
  const overlay = viewport.props.children[2];
  expect(overlay.props.pointerEvents).toBe("box-none");
  const controls = AndroidCameraControls(overlay.props.children.props);
  expect(controls.props.style.flexDirection).toBe("column");
  expect(
    controls.props.children
      .filter(Boolean)
      .map((node: ReactElement<{ label: string }>) => node.props.label),
  ).toEqual(["Zoom in", "Zoom out", "Reset map to north"]);
});

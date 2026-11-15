import { expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import PlannerMap from "../components/PlannerMap";
import { waypoint } from "../features/routes/planner";
const state = vi.hoisted(() => ({ os: "ios", fit: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({
    current: value === null ? { fitToCoordinates: state.fit } : value,
  }),
  useEffect: () => undefined,
  useState: (value: unknown) => [value, vi.fn()],
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
  View: "View",
}));
vi.mock("react-native-maps", () => ({
  default: "MapView",
  Marker: "Marker",
  Polyline: "Polyline",
}));
vi.mock("../components/ui", () => ({ Copy: "Copy", Button: "Button" }));
void createElement;
it.each(["ios", "android"])(
  "preserves %s map placement, numbered markers and route geometry",
  (os) => {
    state.os = os;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY = "test";
    const points = [
      waypoint({ latitude: 27.7, longitude: 85.3 }),
      waypoint({ latitude: 27.71, longitude: 85.31 }),
    ];
    const onWaypoint = vi.fn();
    const tree = PlannerMap({ points, onWaypoint, fitRequest: 1 });
    const props = tree.props as {
      children: ReactElement<{ children: ReactElement<Record<string, any>> }>[];
    };
    const map = props.children[0].props.children.props;
    map.onPress({
      nativeEvent: { coordinate: { latitude: 28, longitude: 84 } },
    });
    expect(onWaypoint).toHaveBeenCalledWith({ latitude: 28, longitude: 84 });
    map.onPress({
      nativeEvent: { coordinate: { latitude: NaN, longitude: 84 } },
    });
    expect(onWaypoint).toHaveBeenCalledTimes(1);
    expect(map.children[0].props.coordinates).toEqual(points);
    expect(map.children[1][1].props.title).toBe("Waypoint 2");
  },
);
it("explains missing Android configuration and unsupported platforms", () => {
  state.os = "android";
  delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
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

import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import DiscoveryMap from "../components/DiscoveryMap";
import TrackMap from "../components/TrackMap";
import { trainingFixture } from "./fixtures/training";

const native = vi.hoisted(() => ({ os: "ios" }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, vi.fn()],
  useEffect: () => undefined,
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
}));
vi.mock("react-native-maps", () => ({
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
function elements(value: unknown): ReactElement<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!isValidElement<Record<string, any>>(value)) return [];
  return [value, ...elements(value.props.children)];
}
afterEach(() => vi.unstubAllEnvs());
it.each(["ios", "android"])(
  "renders native %s saved route overlays inside MapView and selects markers",
  (os) => {
    native.os = os;
    vi.stubEnv("EXPO_PUBLIC_GOOGLE_MAPS_KEY", "test-only");
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
it("avoids native map initialization for empty details and uses only accepted recording markers", () => {
  native.os = "ios";
  expect(
    elements(TrackMap({ points: [] })).some(
      (element) => element.type === "MapView",
    ),
  ).toBe(false);
  const workout = trainingFixture();
  const nodes = elements(TrackMap({ points: workout.points, current: true }));
  expect(
    nodes.find((element) => element.type === "MapView")!.props
      .showsUserLocation,
  ).toBeUndefined();
  expect(
    nodes.find((element) => element.type === "Marker")!.props.coordinate,
  ).toEqual(workout.points.at(-1));
});

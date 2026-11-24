import { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RecordActivity from "../src/app/(tabs)/record";
import { createPlan, waypoint } from "../features/routes/planner";

const test = vi.hoisted(() => ({
  start: vi.fn(),
  library: { plans: [] as unknown[], settled: false },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => [
    typeof initial === "function" ? initial() : initial,
    vi.fn(),
  ],
  useMemo: (read: () => unknown) => read(),
  useEffect: vi.fn(),
}));
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  Pressable: "Pressable",
  View: "View",
  useWindowDimensions: () => ({ width: 360 }),
}));
vi.mock("expo-router", () => ({
  router: {},
  useLocalSearchParams: () => ({ guide: "local:guide", sport: "walking" }),
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("../components/athlete", () => ({
  AthletePage: "AthletePage",
  AthleteText: "Text",
  IconButton: "IconButton",
}));
vi.mock("../components/RecorderMap", () => ({ default: "TrackMap" }));
vi.mock("../components/ui", () => ({ Empty: "Empty" }));
vi.mock("../store/app", () => ({
  useApp: () => ({
    ready: true,
    workouts: [],
    preferences: { units: "km", defaultVisibility: "private" },
  }),
}));
vi.mock("../hooks/useSession", () => ({ useSession: () => undefined }));
vi.mock("../hooks/useRouteLibrary", () => ({
  useRouteLibrary: () => test.library,
}));
vi.mock("../hooks/useAction", () => ({
  useAction: () => ({ run: (action: () => unknown) => action(), busy: false }),
}));
vi.mock("../services/recorder", () => ({ startWorkout: test.start }));
vi.mock("../features/recording/acquisition", () => ({
  useGpsAcquisition: () => ({ state: "idle" }),
  useGpsDiagnostics: () => ({}),
}));

const route = createPlan(
  "Guide",
  [
    waypoint({ latitude: 27.7, longitude: 85.3 }),
    waypoint({ latitude: 27.8, longitude: 85.4 }),
  ],
  "guide",
  null,
);
function nodes(value: unknown): ReactElement<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isValidElement<Record<string, any>>(value)) return [];
  return [value, ...nodes(value.props.children)];
}
beforeEach(() => {
  vi.stubGlobal("__DEV__", false);
  test.start.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

it("puts an accessible and operable manual Start ahead of the guide map", () => {
  test.library = { plans: [route], settled: true };
  const tree = nodes(RecordActivity());
  const start = tree.find(
    ({ props }) => props.accessibilityLabel === "Start walking activity",
  )!;
  const map = tree.find(({ props }) => props.guide === route)!;
  expect(tree.indexOf(start)).toBeLessThan(tree.indexOf(map));
  expect(start.props).toMatchObject({
    accessibilityRole: "button",
    disabled: false,
    accessibilityState: { disabled: false },
  });
  expect(map.props).toMatchObject({ guide: route, points: [] });
  expect(test.start).not.toHaveBeenCalled();
  start.props.onPress();
  expect(test.start).toHaveBeenCalledExactlyOnceWith("walking", undefined, {
    scope: "local",
    id: "guide",
  });
});

it("can start manually before a guide lookup resolves", () => {
  test.library = { plans: [], settled: false };
  const start = nodes(RecordActivity()).find(
    ({ props }) => props.accessibilityLabel === "Start walking activity",
  )!;
  expect(start.props.disabled).toBe(false);
  start.props.onPress();
  expect(test.start).toHaveBeenCalledExactlyOnceWith("walking", undefined, {
    scope: "local",
    id: "guide",
  });
});

import { isValidElement, type ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { Button, Screen } from "../components/ui";
import { createPlan, waypoint } from "../features/routes/planner";
import Explore from "../src/app/(tabs)/explore";
import SavedRoutes from "../src/app/saved-routes";

const fixture = vi.hoisted(() => ({
  plans: [] as unknown[],
  search: "",
  push: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (read: () => unknown) => read(),
  useState: (value: unknown) => [
    value === "" ? fixture.search : value,
    vi.fn(),
  ],
}));
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  useWindowDimensions: () => ({ width: 360, height: 640, fontScale: 1.5 }),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 24 }),
}));
vi.mock("expo-router", () => ({ router: { push: fixture.push } }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("../components/athlete", () => ({
  AthletePage: "AthletePage",
  AthleteText: "Text",
}));
vi.mock("../components/discovery-ui", () => ({
  DiscoveryButton: "DiscoveryButton",
  DiscoverySearch: "DiscoverySearch",
  DiscoveryTitle: "DiscoveryTitle",
  DemoBadge: "DemoBadge",
  Photo: "Photo",
  SportFilters: "SportFilters",
}));
vi.mock("../components/DiscoveryMap", () => ({ default: "DiscoveryMap" }));
vi.mock("../components/SavedRouteOpen", () => ({
  SavedRouteOpen: "SavedRouteOpen",
}));
vi.mock("../hooks/useSession", () => ({ useSession: () => undefined }));
vi.mock("../hooks/useAction", () => ({ useAction: () => ({ busy: false }) }));
vi.mock("../hooks/useRouteLibrary", () => ({
  useRouteLibrary: () => ({ plans: fixture.plans, settled: true }),
  routeStatus: () => "Saved offline",
}));
vi.mock("../hooks/useRouteSync", () => ({ useRouteSyncStatus: () => ({}) }));
vi.mock("../services/planned-routes", () => ({}));
vi.mock("../services/route-cloud", () => ({}));
vi.mock("../store/app", () => ({
  useApp: (select: (state: unknown) => unknown) =>
    select({ workouts: [], preferences: { units: "km", theme: "light" } }),
}));

function nodes(value: unknown): ReactElement<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isValidElement<Record<string, any>>(value)) return [];
  return [value, ...nodes(value.props.children)];
}
function render(screen: () => ReactElement) {
  const element = screen();
  return nodes(
    (element.type as (props: unknown) => ReactElement)(element.props),
  );
}

beforeEach(() => {
  fixture.plans = [];
  fixture.search = "";
  fixture.push.mockClear();
});

it("opens the dedicated offline route library from Explore and can start a new route from an empty library", () => {
  render(Explore)
    .find(({ props }) => props.title === "My saved routes")!
    .props.onPress();
  expect(fixture.push).toHaveBeenLastCalledWith("/saved-routes");
  const saved = render(SavedRoutes);
  expect(
    saved.some(({ props }) => props.children === "No saved routes yet."),
  ).toBe(true);
  saved.find(({ props }) => props.title === "New route")!.props.onPress();
  expect(fixture.push).toHaveBeenLastCalledWith("/routes");
});

it("filters route titles in Explore and keeps unknown streets out of discovery results", () => {
  const points = [
    waypoint({ latitude: 27.7, longitude: 85.3 }),
    waypoint({ latitude: 27.71, longitude: 85.31 }),
  ];
  const matching = createPlan("River workout", points, "river", null);
  fixture.plans = [matching, createPlan("Ridge loop", points, "ridge", null)];
  fixture.search = " RIVER ";
  const explore = render(Explore);
  expect(
    explore.find(({ props }) => props.label === "Search routes")?.props
      .placeholder,
  ).toBe("Search routes");
  expect(
    explore
      .filter(({ type }) => type === "SavedRouteOpen")
      .map(({ props }) => props.route.id),
  ).toEqual(["river"]);
  render(SavedRoutes)
    .find(({ type }) => type === "SavedRouteOpen")!
    .props.onEdit();
  expect(fixture.push).toHaveBeenLastCalledWith({
    pathname: "/routes",
    params: { edit: "local:river" },
  });
  fixture.search = "New Road";
  const unknown = render(Explore);
  expect(unknown.some(({ type }) => type === "SavedRouteOpen")).toBe(false);
  expect(
    unknown.some(({ props }) => props.children === "No matching saved routes"),
  ).toBe(true);
  expect(
    unknown.some(({ props }) => props.children === "No matching route ideas"),
  ).toBe(true);
});

it("keeps a full wrapping button label and makes lower actions scrollable with the keyboard and bottom inset", () => {
  const button = Button({ title: "Confirm position", onPress: vi.fn() });
  expect(button.props.accessibilityLabel).toBe("Confirm position");
  expect(button.props.style({ pressed: false })).toMatchObject({
    minHeight: 47,
    maxWidth: "100%",
    flexShrink: 1,
  });
  expect(button.props.children.props).toMatchObject({
    children: "Confirm position",
  });
  expect(button.props.children.props.numberOfLines).toBeUndefined();
  const screen = Screen({ children: button, compact: true });
  expect(screen.props).toMatchObject({
    keyboardShouldPersistTaps: "handled",
    keyboardDismissMode: "on-drag",
    contentContainerStyle: { paddingBottom: 40 },
  });
});

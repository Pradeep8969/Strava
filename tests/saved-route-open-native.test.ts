import { isValidElement, type ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  FollowRouteActions,
  SavedRouteOpen,
} from "../components/SavedRouteOpen";
import { findRouteGuide, parseRouteGuide } from "../features/routes/guide";
import { createPlan, waypoint } from "../features/routes/planner";

const native = vi.hoisted(() => ({ open: false, navigate: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: () => [
    native.open,
    (open: boolean) => {
      native.open = open;
    },
  ],
}));
vi.mock("react-native", () => ({
  Modal: "Modal",
  Pressable: "Pressable",
  Platform: { OS: "android" },
}));
vi.mock("expo-router", () => ({ router: { navigate: native.navigate } }));
vi.mock("../components/PlannerMap", () => ({ default: "PlannerMap" }));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Copy: "Copy",
  Heading: "Heading",
  Row: "Row",
  Screen: "Screen",
  useColors: () => ({ raised: "#123456" }),
}));

function elements(value: unknown): ReactElement<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!isValidElement<Record<string, any>>(value)) return [];
  return [value, ...elements(value.props.children)];
}

const route = createPlan(
  "Offline walk",
  [
    waypoint({ latitude: 27.7, longitude: 85.3 }),
    waypoint({ latitude: 27.71, longitude: 85.31 }),
  ],
  "offline-route",
  null,
);
beforeEach(() => {
  native.open = false;
  native.navigate.mockClear();
});

it("opens an Android preview from the actual button callback without editing or navigating", () => {
  const onEdit = vi.fn();
  const render = () => elements(SavedRouteOpen({ route, onEdit }));
  expect(render().some((node) => node.type === "Modal")).toBe(false);
  render()
    .find(
      (node) =>
        node.type === "Pressable" &&
        node.props.accessibilityLabel === "Open Offline walk",
    )!
    .props.onPress();
  const preview = render().find((node) => node.type === "Modal")!;
  expect(preview.props.visible).toBe(true);
  expect(
    elements(preview).find((node) => node.type === "PlannerMap")?.props,
  ).toMatchObject({
    points: route.points,
    fitRequest: 1,
  });
  expect(onEdit).not.toHaveBeenCalled();
  expect(native.navigate).not.toHaveBeenCalled();
  preview.props.onRequestClose();
  expect(render().some((node) => node.type === "Modal")).toBe(false);
});

it.each([
  ["Walking", "walking"],
  ["Running", "running"],
  ["Cycling", "cycling"],
])("hands %s to Record using only a route reference", (label, sport) => {
  const close = vi.fn();
  elements(FollowRouteActions({ route, onNavigate: close }))
    .find((node) => node.type === "Button" && node.props.title === label)!
    .props.onPress();
  expect(close).toHaveBeenCalledOnce();
  expect(native.navigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/record",
    params: { guide: "local:offline-route", sport },
  });
});

it("resolves matching IDs only in the requested local or current account scope", () => {
  const account = { ...route, accountId: "account-a" };
  const other = { ...route, accountId: "account-b" };
  const localRef = parseRouteGuide("local:offline-route");
  const accountRef = parseRouteGuide("account:offline-route");
  expect(findRouteGuide([account, route], localRef, "account-a")).toBe(route);
  expect(findRouteGuide([other, route, account], accountRef, "account-a")).toBe(
    account,
  );
  expect(
    findRouteGuide([account, route], accountRef, "account-b"),
  ).toBeUndefined();
  expect(
    findRouteGuide([{ ...account, deleted: true }], accountRef, "account-a"),
  ).toBeUndefined();
  expect(findRouteGuide([], localRef)).toBeUndefined();
  expect(
    parseRouteGuide(["local:offline-route", "account:offline-route"]),
  ).toBeUndefined();
  expect(
    elements(FollowRouteActions({ route: { ...route, deleted: true } })).some(
      (node) => node.type === "Button",
    ),
  ).toBe(false);
});

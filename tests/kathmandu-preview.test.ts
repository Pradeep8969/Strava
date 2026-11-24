import { afterEach, expect, it, vi } from "vitest";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import KathmanduRoadsPreview from "../components/KathmanduRoadsPreview";
import RoadPreviewDetails from "../components/RoadPreviewDetails";
import {
  canPreviewKathmanduRoads,
  kathmanduPreviewError,
  kathmanduSamples,
  readKathmanduPreview,
  type KathmanduSample,
} from "../features/routes/kathmandu-preview";
import fixtures from "../features/routes/valhalla-pilot.json";

const state = vi.hoisted(() => ({
  sample: undefined as KathmanduSample | undefined,
  malformed: false,
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: KathmanduSample) => [
    state.sample ?? initial,
    (next: KathmanduSample) => {
      state.sample = next;
    },
  ],
  useMemo: (read: () => unknown) => read(),
}));
vi.mock("../components/PlannerMap", () => ({ default: "PlannerMap" }));
vi.mock("../components/dashboard-ui", () => ({
  DashboardTabs: "DashboardTabs",
}));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Copy: "Copy",
  Heading: "Heading",
  Screen: "Screen",
}));
vi.mock("../features/routes/kathmandu-preview", async (original) => {
  const actual =
    await original<typeof import("../features/routes/kathmandu-preview")>();
  return {
    ...actual,
    readKathmanduPreview: (sample: KathmanduSample, body?: unknown) =>
      actual.readKathmanduPreview(sample, state.malformed ? null : body),
  };
});

void createElement;

function elements(
  node: ReactNode,
): { type: unknown; props: Record<string, unknown> }[] {
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(elements)];
}
function text(node: ReactNode): string {
  if (
    isValidElement<Parameters<typeof RoadPreviewDetails>[0]>(node) &&
    node.type === RoadPreviewDetails
  )
    return text(RoadPreviewDetails(node.props));
  if (isValidElement<{ children?: ReactNode }>(node))
    return text(node.props.children);
  if (Array.isArray(node)) return node.map(text).join("");
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : "";
}

afterEach(() => {
  state.sample = undefined;
  state.malformed = false;
  vi.unstubAllGlobals();
});

it("makes the preview available only to Android development bundles", () => {
  expect(canPreviewKathmanduRoads(true, "android")).toBe(true);
  expect(canPreviewKathmanduRoads(false, "android")).toBe(false);
  expect(canPreviewKathmanduRoads(true, "web")).toBe(false);
  expect(canPreviewKathmanduRoads(true, "ios")).toBe(false);
});

it("loads all six captured routes with genuine geometry and ordered requested markers", () => {
  const counts = [67, 93, 43, 58, 93, 17];
  expect(kathmanduSamples).toHaveLength(counts.length);
  for (const [i, sample] of kathmanduSamples.entries()) {
    const result = readKathmanduPreview(sample)!;
    expect(result.map.line).toHaveLength(counts[i]);
    expect(result.map.markers[0].label).toBe("Start");
    expect(result.map.markers.at(-1)?.label).toBe("Finish");
    expect(result.path.provenance.offlineStoragePermitted).toBe(false);
  }
  const multi = readKathmanduPreview("Walk via Asan")!;
  expect(multi.map.markers[1]).toMatchObject({
    label: "Waypoint 2",
    requested: { latitude: 27.7083, longitude: 85.312 },
  });
  expect(multi.map.line[48]).toEqual({
    latitude: 27.708378,
    longitude: 85.312012,
  });
});

it("keeps requested pins separate from large snapped positions and presents a warning", () => {
  state.sample = "Kathmandu cycling";
  const tree = KathmanduRoadsPreview({ onClose: vi.fn() });
  const { map } = readKathmanduPreview(state.sample)!;
  expect(map.markers[0]).toEqual({
    label: "Start",
    requested: { latitude: 27.7043, longitude: 85.3076 },
    snapped: { latitude: 27.703738, longitude: 85.307512 },
    offset: 63,
    severity: "large",
  });
  expect(text(tree)).toContain("Start is about 63 m from the cycling route.");
  expect(text(tree)).toContain("Choose a nearby bicycle-accessible road");
  expect(
    elements(tree).find((element) => element.type === "PlannerMap")?.props
      .roadPreview,
  ).toEqual(map);
});

it("renders only the latest selection and exposes only an exit action without network or editing", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const close = vi.fn();
  const render = () => elements(KathmanduRoadsPreview({ onClose: close }));
  const first = render();
  const onChange = first.find(({ type }) => type === "DashboardTabs")?.props
    .onChange as (sample: KathmanduSample) => void;
  onChange("Patan walking");
  onChange("Bhaktapur walking");
  onChange("Swayambhu steps");
  const latest = render();
  const map = latest.find(({ type }) => type === "PlannerMap")?.props;
  expect(map?.roadPreview).toEqual(
    readKathmanduPreview("Swayambhu steps")?.map,
  );
  expect(map?.points).toEqual([]);
  expect(map?.onWaypoint).toBeUndefined();
  const actions = latest.filter(({ type }) => type === "Button");
  expect(actions.map(({ props }) => props.title)).toEqual(["Back to planning"]);
  (actions[0].props.onPress as () => void)();
  expect(close).toHaveBeenCalledOnce();
  expect(fetcher).not.toHaveBeenCalled();
});

it("clears map output and offers a safe exit for malformed fixtures", () => {
  expect(readKathmanduPreview("Kathmandu walking", {})).toBeNull();
  expect(
    readKathmanduPreview("Kathmandu walking", {
      trip: { ...fixtures["walk-kathmandu"].trip, legs: [{ shape: "_" }] },
    }),
  ).toBeNull();
  expect(
    readKathmanduPreview("Kathmandu walking", {
      trip: {
        ...fixtures["walk-kathmandu"].trip,
        locations: [{ lon: 200, lat: 0 }, null],
      },
    }),
  ).toBeNull();
  state.malformed = true;
  const tree = KathmanduRoadsPreview({ onClose: vi.fn() });
  expect(text(tree)).toContain(kathmanduPreviewError);
  expect(elements(tree).some(({ type }) => type === "PlannerMap")).toBe(false);
});

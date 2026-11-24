import { afterEach, expect, it, vi } from "vitest";
import {
  ideasOnMap,
  mapScopes,
  savedMapLayer,
  scheduleMapSearch,
  searchPlaces,
  searchSaved,
} from "../features/maps/dedicated";
import { routeFeatures } from "../features/discovery/map-data";
import { createPlan, waypoint } from "../features/routes/planner";

const short = createPlan(
  "Valley loop",
  [
    waypoint({ latitude: 27.71, longitude: 85.31 }),
    waypoint({ latitude: 27.72, longitude: 85.32 }),
  ],
  "valley",
  null,
);
const long = { ...short, title: "Ridge loop", distanceMeters: 5000 };

afterEach(() => vi.useRealTimers());

it("searches local landmarks and coordinates without promising addresses or serving out-of-range coordinates", () => {
  expect(mapScopes).toEqual(["Places", "Saved", "Ideas"]);
  expect(searchPlaces("").places.map(({ label }) => label)).toContain("Thamel");
  expect(
    searchPlaces(" bhaktapur ").places.map(({ label }) => label),
  ).toContain("Bhaktapur Durbar Square");
  expect(searchPlaces("27.71, 85.32").places[0]).toMatchObject({
    latitude: 27.71,
    longitude: 85.32,
  });
  expect(searchPlaces("91, 85")).toEqual({ places: [], invalid: true });
  expect(searchPlaces("New Road")).toEqual({ places: [], invalid: false });
});

it("cancels superseded and dismissed searches", () => {
  vi.useFakeTimers();
  const apply = vi.fn();
  const cancelOld = scheduleMapSearch("Tha", apply);
  vi.advanceTimersByTime(100);
  cancelOld();
  scheduleMapSearch(" Thamel ", apply);
  vi.advanceTimersByTime(180);
  expect(apply.mock.calls).toEqual([["Thamel"]]);
  scheduleMapSearch("private query", apply)();
  vi.runAllTimers();
  expect(apply).toHaveBeenCalledTimes(1);
});

it("filters saved distances and measured elevation without treating unknown metadata as a measurement", () => {
  const measured = {
    ...short,
    points: short.points.map((point, index) => ({
      ...point,
      altitude: 1300 + index * 8,
      altitudeAccuracy: 5,
    })),
  };
  const plans = [short, long, { ...short, title: "Removed", deleted: true }];
  expect(searchSaved(plans, " LOOP ", "Under 5 km", "Any")).toEqual([short]);
  expect(searchSaved(plans, "", "5 km or more", "Any")).toEqual([long]);
  expect(searchSaved([short, measured], "", "Any", "Measured")).toEqual([
    measured,
  ]);
});

it("excludes unverified hiking and trail-running lines and offers editorial ideas by supported activity", () => {
  expect(ideasOnMap("", "Walking")).toEqual([]);
  expect(ideasOnMap("", "Cycling").map(({ id }) => id)).toEqual(["pokhara"]);
  expect(ideasOnMap("valley", "Running").map(({ id }) => id)).toEqual([
    "valley",
  ]);
  expect(ideasOnMap("Shivapuri", "All")).toEqual([]);
});

it("renders the stored geometry as a scoped straight-line plan", () => {
  const plan = { ...short, accountId: "owner" };
  const layer = savedMapLayer(plan);
  expect(routeFeatures([layer], layer.id).features).toEqual([
    {
      type: "Feature",
      properties: {
        id: routeFeatures([layer]).features[0].properties.id,
        kind: "plan",
        selected: true,
      },
      geometry: plan.geometry,
    },
  ]);
  expect(layer.id).not.toBe(savedMapLayer(short).id);
});

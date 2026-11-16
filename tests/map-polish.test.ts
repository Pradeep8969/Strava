import { afterEach, expect, it, vi } from "vitest";
import { mapOnlyLocation } from "../features/discovery/map-location";
import {
  clearMapMarkers,
  syncMapMarkers,
  type MapMarker,
  type MarkerCache,
} from "../features/discovery/map-markers.web";
import type { BrowserMap, MapLibre } from "../features/discovery/maplibre.web";

const position = (accuracy = 80, timestamp = Date.now()) =>
  ({
    timestamp,
    coords: { latitude: 27.7, longitude: 85.3, accuracy },
  }) as GeolocationPosition;
afterEach(() => vi.unstubAllGlobals());
it("permits valid approximate coordinates for maps without changing recording acquisition", () => {
  expect(mapOnlyLocation(position())).toMatchObject({
    latitude: 27.7,
    longitude: 85.3,
    accuracy: 80,
  });
});
it.each([
  () => position(Infinity),
  () => position(-1),
  () => position(80, Date.now() - 60001),
  () => position(80, Date.now() + 2000),
  () => ({ ...position(), coords: { ...position().coords, latitude: NaN } }),
])("rejects invalid or stale map-only coordinates", (sample) => {
  expect(mapOnlyLocation(sample())).toBeNull();
});
it("reuses marker objects across updates and selection; removes only undone/cleared points", () => {
  vi.stubGlobal("document", {
    createElement: () => ({ style: {}, setAttribute: vi.fn() }),
  });
  const created: {
    remove: ReturnType<typeof vi.fn>;
    setLngLat: ReturnType<typeof vi.fn>;
  }[] = [];
  class Marker {
    remove = vi.fn();
    setLngLat = vi.fn(() => this);
    addTo() {
      return this;
    }
    constructor() {
      created.push(this);
    }
  }
  const library = { Marker } as unknown as MapLibre;
  const cache: MarkerCache = new Map();
  const map = {} as BrowserMap;
  const first: MapMarker = {
    id: "first",
    longitude: 85.3,
    latitude: 27.7,
    text: "1",
    label: "Waypoint 1",
    kind: "waypoint",
  };
  const second: MapMarker = {
    ...first,
    id: "second",
    longitude: 85.31,
    text: "2",
    label: "Waypoint 2",
  };
  syncMapMarkers(library, map, cache, [first]);
  syncMapMarkers(library, map, cache, [first, second]);
  syncMapMarkers(library, map, cache, [{ ...first, longitude: 85.32 }, second]);
  expect(created).toHaveLength(2);
  expect(created[0].setLngLat).toHaveBeenCalledTimes(2);
  expect(created.every((entry) => entry.remove.mock.calls.length === 0)).toBe(
    true,
  );
  syncMapMarkers(library, map, cache, [first]);
  expect(created[1].remove).toHaveBeenCalledTimes(1);
  clearMapMarkers(cache);
  expect(cache.size).toBe(0);
  expect(created[0].remove).toHaveBeenCalledTimes(1);
});

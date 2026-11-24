import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
import NativeMap, {
  Marker,
  Polyline,
} from "../components/maps/NativeMap.android";
import { MapAttribution } from "../components/maps/MapAttribution";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import {
  loadAndroidStyle,
  prepareAndroidStyle,
} from "../features/maps/android-style";
import { coordinateBounds, regionCamera } from "../features/maps/native-camera";
import {
  androidMapConfiguration,
  mapTilerRequestMatch,
  mapTilerUserAgent,
} from "../features/maps/native-configuration";
import { mapSegments } from "../features/discovery/map-data";
import type { MapHandle } from "../features/maps/native-types";
import { trainingFixture } from "./fixtures/training";

const state = vi.hoisted(() => ({
  camera: {
    easeTo: vi.fn(),
    fitBounds: vi.fn(),
    setStop: vi.fn(),
    getZoom: vi.fn(),
    getCenter: vi.fn(),
  },
  header: vi.fn(),
  nextId: 0,
  openURL: vi.fn(),
  style: null as string | null,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: () => ({ current: state.camera }),
  useId: () => `test-${state.nextId++}`,
  useEffect: () => undefined,
  useEffectEvent: (callback: unknown) => callback,
  useState: (initial: unknown) => [
    typeof initial === "function"
      ? initial()
      : initial === null
        ? state.style
        : initial,
    vi.fn(),
  ],
  useMemo: (fn: () => unknown) => fn(),
  useImperativeHandle: (
    ref: { current: unknown } | undefined,
    fn: () => unknown,
  ) => {
    if (ref) ref.current = fn();
  },
}));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Image: "Image",
  Pressable: "Pressable",
  Linking: { openURL: state.openURL },
}));
vi.mock("@maplibre/maplibre-react-native", () => ({
  Map: "LibreMap",
  Camera: "Camera",
  Marker: "LibreMarker",
  GeoJSONSource: "GeoJSONSource",
  Layer: "Layer",
  TransformRequestManager: { addHeader: state.header },
}));
vi.mock("../assets/maptiler-logo.png", () => ({ default: 1 }));
function nodes(value: unknown): ReactElement<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isValidElement<Record<string, any>>(value)) return [];
  return [value, ...nodes(value.props.children)];
}
const region = {
  latitude: 27.7,
  longitude: 85.3,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};
const streets: StyleSpecification = {
  version: 8,
  sources: {
    maptiler_planet: {
      type: "vector",
      url: "https://api.maptiler.com/tiles/v3/tiles.json?key=test",
    },
    maptiler_attribution: {
      type: "vector",
      attribution: "MapTiler · OpenStreetMap contributors",
    },
  },
  sprite: "https://api.maptiler.com/sprites/general/sprite",
  glyphs: "https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=test",
  layers: [
    {
      id: "roads",
      type: "line",
      source: "maptiler_planet",
      "source-layer": "transportation",
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "native-test-key");
  vi.stubEnv("EXPO_PUBLIC_GOOGLE_MAPS_KEY", "");
  state.style = JSON.stringify(prepareAndroidStyle(streets));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Android MapLibre adapter", () => {
  it("enables native Maps gestures and forwards only user-driven moves", () => {
    const gesture = vi.fn();
    const tree = nodes(
      NativeMap({
        initialRegion: region,
        dedicated: true,
        onTouchStart: gesture,
      }),
    );
    const map = tree.find((node) => node.type === "LibreMap")!;
    expect(map.props).toMatchObject({
      dragPan: true,
      touchZoom: true,
      touchRotate: true,
      doubleTapZoom: true,
      attribution: true,
      compass: false,
    });
    expect(
      nodes(map).find((node) => node.type === "Camera")?.props,
    ).not.toHaveProperty("viewState");
    map.props.onRegionWillChange({ nativeEvent: { userInteraction: false } });
    expect(gesture).not.toHaveBeenCalled();
    map.props.onRegionWillChange({ nativeEvent: { userInteraction: true } });
    expect(gesture).toHaveBeenCalledOnce();
  });
  it("mounts saved route geometry with a local style before any remote style is available", () => {
    state.style = null;
    vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "");
    const coordinates = [region, { latitude: 27.71, longitude: 85.31 }];
    const route = Polyline({
      id: "record-planned-guide",
      coordinates,
      strokeColor: "#ED633E",
      strokeWidth: 5,
    });
    const ready = vi.fn();
    const tree = NativeMap({
      initialRegion: region,
      initialFit: {
        points: coordinates,
        padding: { top: 42, right: 42, bottom: 42, left: 42 },
      },
      showOfflineGeometry: true,
      children: route,
      onMapReady: ready,
    });
    const map = nodes(tree).find((node) => node.type === "LibreMap")!;
    expect(JSON.parse(map.props.mapStyle)).toMatchObject({
      version: 8,
      sources: {},
    });
    expect(map.props.mapStyle).not.toContain("http");
    expect(
      nodes(map).find((node) => node.type === "Camera")?.props.initialViewState,
    ).toMatchObject({
      bounds: coordinateBounds(coordinates),
      padding: { top: 42, right: 42, bottom: 42, left: 42 },
    });
    const bounds = coordinateBounds(coordinates)!;
    expect(bounds[0]).toBeLessThan(85.3);
    expect(bounds[1]).toBeLessThan(27.7);
    expect(bounds[2]).toBeGreaterThan(85.31);
    expect(bounds[3]).toBeGreaterThan(27.71);
    map.props.onDidFinishLoadingMap();
    expect(ready).toHaveBeenCalledOnce();
    const source = nodes(map).find((node) => node.type === "GeoJSONSource")!;
    expect(source.props.id).toBe("record-planned-guide-source");
    expect(nodes(source).find((node) => node.type === "Layer")?.props.id).toBe(
      "record-planned-guide-line",
    );
    expect(source.props.data.geometry.coordinates).toEqual([
      [
        [85.3, 27.7],
        [85.31, 27.71],
      ],
    ]);
  });
  it("handles empty, invalid, degenerate and polar camera bounds", () => {
    expect(coordinateBounds([])).toBeNull();
    expect(coordinateBounds([{ latitude: NaN, longitude: 2 }])).toBeNull();
    for (const latitude of [-90, -85, 27.7, 85, 90]) {
      const bounds = coordinateBounds([{ latitude, longitude: 85 }])!;
      expect(bounds[0]).toBeLessThan(bounds[2]);
      expect(bounds[1]).toBeLessThan(bounds[3]);
      expect(bounds.every(Number.isFinite)).toBe(true);
    }
  });
  it("uses the existing MapTiler style with a separate native key and never falls back to browser keys or demo tiles", () => {
    expect(androidMapConfiguration()?.style).toBe(
      "https://api.maptiler.com/maps/streets-v2/style.json?key=native-test-key",
    );
    vi.stubEnv("EXPO_PUBLIC_MAPTILER_ANDROID_KEY", "");
    vi.stubEnv("EXPO_PUBLIC_MAPTILER_KEY", "browser-only");
    vi.stubEnv("EXPO_PUBLIC_MAP_DEVELOPMENT", "true");
    expect(androidMapConfiguration()).toBeNull();
    expect(NativeMap({ initialRegion: region })).toBeNull();
  });
  it("sets a stable host-scoped User-Agent, shows attribution, and forwards map lifecycle failures without logging keys", () => {
    const ready = vi.fn(),
      error = vi.fn();
    const tree = nodes(
      NativeMap({
        initialRegion: region,
        onMapReady: ready,
        onMapError: error,
      }),
    );
    expect(state.header).toHaveBeenCalledWith({
      id: "stravakinda-maptiler-user-agent",
      match: mapTilerRequestMatch,
      name: "User-Agent",
      value: mapTilerUserAgent,
    });
    const match = new RegExp(mapTilerRequestMatch);
    expect(match.test("https://api.maptiler.com/tiles/v3/1/2/3.pbf")).toBe(
      true,
    );
    expect(match.test("https://api.maptiler.com.evil.test/style.json")).toBe(
      false,
    );
    const map = tree.find((n) => n.type === "LibreMap")!;
    const style = JSON.parse(map.props.mapStyle);
    expect(style.sources).not.toHaveProperty("maptiler_attribution");
    expect(style.sources.maptiler_planet).toMatchObject(
      streets.sources.maptiler_planet,
    );
    expect(map.props.attribution).toBe(true);
    expect(map.props.androidView).toBe("texture");
    expect(tree.some((n) => n.type === MapAttribution)).toBe(true);
    map.props.onDidFinishLoadingMap();
    map.props.onDidFailLoadingMap();
    expect(ready).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    expect(
      tree.find((n) => n.type === "Camera")!.props.trackUserLocation,
    ).toBeUndefined();
    expect(map.props.showsUserLocation).toBeUndefined();
  });
  it("waits for the prepared style before mounting the native parser", () => {
    state.style = null;
    expect(NativeMap({ initialRegion: region })).toBeNull();
  });
  it("removes only the tileless attribution placeholder while preserving layers, URLs, and credits", () => {
    const result = prepareAndroidStyle(streets);
    expect(result.sources).toEqual({
      maptiler_planet: {
        ...streets.sources.maptiler_planet,
        attribution: "MapTiler · OpenStreetMap contributors",
      },
    });
    expect(result.layers).toBe(streets.layers);
    expect(result.glyphs).toBe(streets.glyphs);
    expect(result.sprite).toBe(streets.sprite);
    expect(streets.sources).toHaveProperty("maptiler_attribution");
    const sourced = structuredClone(streets);
    sourced.sources.maptiler_attribution = {
      type: "vector",
      tiles: ["https://example.test/{z}/{x}/{y}.pbf"],
    };
    expect(prepareAndroidStyle(sourced)).toBe(sourced);
    expect(() =>
      prepareAndroidStyle({
        ...streets,
        layers: [
          {
            id: "attribution-layer",
            type: "line",
            source: "maptiler_attribution",
          },
        ],
      }),
    ).toThrow("invalid attribution source");
  });
  it("uses the configured User-Agent, retries authorization failures, and shares a successful load", async () => {
    const fetchStyle = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => streets,
      });
    vi.stubGlobal("fetch", fetchStyle);
    const url = androidMapConfiguration()!.style;
    await expect(loadAndroidStyle(url)).rejects.toThrow(
      /^Could not load the Android MapTiler style\.$/,
    );
    const loading = loadAndroidStyle(url);
    expect(loadAndroidStyle(url)).toBe(loading);
    expect(JSON.parse(await loading)).toEqual(prepareAndroidStyle(streets));
    expect(fetchStyle).toHaveBeenCalledTimes(2);
    expect(fetchStyle).toHaveBeenLastCalledWith(
      url,
      expect.objectContaining({
        headers: { "User-Agent": mapTilerUserAgent },
      }),
    );
  });
  it("translates valid map taps to waypoints and stops following only for user camera gestures", () => {
    const onPress = vi.fn(),
      onTouchStart = vi.fn();
    const tree = nodes(
      NativeMap({ initialRegion: region, onPress, onTouchStart }),
    );
    const map = tree.find((n) => n.type === "LibreMap")!;
    map.props.onPress({ nativeEvent: { lngLat: [85.32, 27.72] } });
    expect(onPress).toHaveBeenCalledWith({
      nativeEvent: { coordinate: { longitude: 85.32, latitude: 27.72 } },
    });
    map.props.onPress({ nativeEvent: { lngLat: [NaN, 27.72] } });
    expect(onPress).toHaveBeenCalledOnce();
    map.props.onRegionWillChange({ nativeEvent: { userInteraction: false } });
    expect(onTouchStart).not.toHaveBeenCalled();
    map.props.onRegionWillChange({ nativeEvent: { userInteraction: true } });
    expect(onTouchStart).toHaveBeenCalledOnce();
  });
  it("enables pan, pinch, and rotation with no continuous camera callback", async () => {
    state.camera.getZoom.mockResolvedValue(15);
    state.camera.getCenter.mockResolvedValue([85.32, 27.72]);
    const ref = { current: null as MapHandle | null };
    const map = nodes(NativeMap({ ref, initialRegion: region })).find(
      (node) => node.type === "LibreMap",
    )!;
    expect(map.props).toMatchObject({
      dragPan: true,
      touchZoom: true,
      touchRotate: true,
      touchPitch: false,
    });
    expect(map.props.onRegionIsChanging).toBeUndefined();
    expect(map.props.onRegionWillChange).toBeUndefined();
    expect(map.props.onPress).toBeUndefined();
    expect(await ref.current!.getCenter?.()).toEqual({
      longitude: 85.32,
      latitude: 27.72,
    });
    await ref.current!.zoomBy?.(1);
    await ref.current!.zoomBy?.(-1);
    await ref.current!.resetNorth?.();
    expect(state.camera.setStop.mock.calls).toEqual([
      [{ zoom: 16, duration: 180, easing: "ease" }],
      [{ zoom: 14, duration: 180, easing: "ease" }],
      [{ bearing: 0, duration: 180, easing: "ease" }],
    ]);
    ref.current!.centerOn?.({ longitude: 85.31, latitude: 27.73 });
    expect(state.camera.easeTo).toHaveBeenLastCalledWith({
      center: [85.31, 27.73],
      duration: 200,
    });
  });
  it("reuses the screen camera API for recentering and fitting tracks with padding, including a single fix", () => {
    const ref = { current: null as MapHandle | null };
    NativeMap({ ref, initialRegion: region });
    ref.current!.animateToRegion(region, 400);
    expect(state.camera.easeTo).toHaveBeenCalledWith({
      ...regionCamera(region),
      duration: 400,
    });
    const options = {
      edgePadding: { top: 40, bottom: 40, left: 35, right: 35 },
      animated: false,
    };
    ref.current!.fitToCoordinates([region], options);
    expect(state.camera.fitBounds).toHaveBeenCalledWith(
      coordinateBounds([region]),
      { padding: options.edgePadding, duration: 0 },
    );
    ref.current!.fitToCoordinates([], options);
    expect(state.camera.fitBounds).toHaveBeenCalledOnce();
    ref.current!.animateToRegion({ ...region, longitude: NaN });
    expect(state.camera.easeTo).toHaveBeenCalledOnce();
  });
  it("preserves route colors/width and breaks invalid geometry rather than bridging missing fixes", () => {
    const coordinates = [
      region,
      { ...region, longitude: 85.31 },
      { ...region, latitude: NaN },
      region,
      { ...region, longitude: 85.32 },
    ];
    const tree = nodes(
      Polyline({ coordinates, strokeColor: "#167F83", strokeWidth: 5 }),
    );
    const source = tree.find((n) => n.type === "GeoJSONSource")!;
    expect(source.props.data.type).toBe("Feature");
    expect(source.props).not.toHaveProperty("tiles");
    expect(source.props.data.geometry).toEqual({
      type: "MultiLineString",
      coordinates: [
        [
          [85.3, 27.7],
          [85.31, 27.7],
        ],
        [
          [85.3, 27.7],
          [85.32, 27.7],
        ],
      ],
    });
    expect(tree.find((n) => n.type === "Layer")!.props.paint).toEqual({
      "line-color": "#167F83",
      "line-width": 5,
    });
    expect(
      Polyline({ coordinates: [region], strokeColor: "red", strokeWidth: 4 }),
    ).toBeNull();
  });
  it("keeps paused recording segments separate when rendered as native geometry", () => {
    const workout = trainingFixture();
    const points = workout.points.map((p, i) => ({
      ...p,
      segment: i < 2 ? 0 : 1,
    }));
    const groups = mapSegments({
      id: "track",
      title: "Track",
      kind: "recording",
      points,
    });
    expect(groups.length).toBeGreaterThan(1);
    for (const coordinates of groups) {
      const tree = nodes(
        Polyline({ coordinates, strokeColor: "orange", strokeWidth: 5 }),
      );
      expect(tree[0].props.data.geometry.coordinates).toEqual([
        coordinates.map((p) => [p.longitude, p.latitude]),
      ]);
    }
  });
  it("preserves marker selection and numbered children without adding a planner waypoint from a marker tap", () => {
    const onPress = vi.fn(),
      stopPropagation = vi.fn();
    const marker = Marker({
      coordinate: region,
      title: "Waypoint 2",
      children: createElement("Text", null, "2"),
      onPress,
    })!;
    expect(marker.props.lngLat).toEqual([85.3, 27.7]);
    marker.props.onPress({ stopPropagation });
    expect(onPress).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(nodes(marker).some((n) => n.props.children === "2")).toBe(true);
    expect(
      Marker({
        coordinate: { latitude: NaN, longitude: 85 },
        title: "Invalid",
      }),
    ).toBeNull();
  });
});

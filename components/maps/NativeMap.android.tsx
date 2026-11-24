import {
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Text, View } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker as MapLibreMarker,
  TransformRequestManager,
  type CameraRef,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import { validCoordinate } from "../../features/discovery/map-data";
import {
  coordinateBounds,
  lngLat,
  regionCamera,
} from "../../features/maps/native-camera";
import {
  androidMapConfiguration,
  mapTilerRequestMatch,
  mapTilerUserAgent,
} from "../../features/maps/native-configuration";
import type {
  MarkerProps,
  NativeMapProps,
  PolylineProps,
} from "../../features/maps/native-types";
import { MapAttribution } from "./MapAttribution";
import { loadAndroidStyle } from "../../features/maps/android-style";

const offlineStyle = JSON.stringify({
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#E4ECE8" },
    },
  ],
});

export default function NativeMap({
  ref,
  children,
  initialRegion,
  initialFit,
  debugGuideLayer,
  onMapReady,
  onMapError,
  showOfflineGeometry,
  onTouchStart,
  onPress,
  style,
}: NativeMapProps) {
  const camera = useRef<CameraRef>(null);
  const nativeMap = useRef<MapRef>(null);
  const inspecting = useRef(false);
  const lastInspection = useRef(0);
  const [guideCheck, setGuideCheck] = useState<{
    style?: string;
    points?: NonNullable<NativeMapProps["initialFit"]>["points"];
    rendered?: boolean;
    fitted?: boolean;
  }>({});
  const fitPoints = initialFit?.points;
  const [initialViewState] = useState(() => {
    const bounds = fitPoints ? coordinateBounds(fitPoints) : null;
    return bounds
      ? { bounds, padding: initialFit?.padding }
      : regionCamera(initialRegion);
  });
  const styleUrl = androidMapConfiguration()?.style;
  const [mapStyle, setMapStyle] = useState<string | null>(null);
  const [baseMapUnavailable, setBaseMapUnavailable] = useState(false);
  const notifyMapError = useEffectEvent(() => onMapError?.());
  // Install the native request rule before mounting Map; stable ID is shared by
  // simultaneous maps and survives a retry without accumulating rules.
  const [configured] = useState(() => {
    TransformRequestManager.addHeader({
      id: "stravakinda-maptiler-user-agent",
      match: mapTilerRequestMatch,
      name: "User-Agent",
      value: mapTilerUserAgent,
    });
    return true;
  });
  useEffect(() => {
    if (!styleUrl) return;
    let active = true;
    void loadAndroidStyle(styleUrl).then(
      (loaded) => {
        if (active) setMapStyle(loaded);
      },
      () => {
        if (!active) return;
        if (showOfflineGeometry) setBaseMapUnavailable(true);
        else notifyMapError();
      },
    );
    return () => {
      active = false;
    };
  }, [styleUrl, showOfflineGeometry]);
  useImperativeHandle(
    ref,
    () => ({
      async getCenter() {
        const center = await nativeMap.current?.getCenter();
        if (!center) return;
        const [longitude, latitude] = center;
        const point = { longitude, latitude };
        return validCoordinate(point) ? point : undefined;
      },
      async zoomBy(delta) {
        const zoom = await nativeMap.current?.getZoom();
        if (zoom !== undefined && Number.isFinite(zoom))
          await camera.current?.setStop({
            zoom: Math.max(0, Math.min(20, zoom + delta)),
            duration: 180,
            easing: "ease",
          });
      },
      async resetNorth() {
        await camera.current?.setStop({
          bearing: 0,
          duration: 180,
          easing: "ease",
        });
      },
      centerOn(point, zoom, duration = 200) {
        if (validCoordinate(point))
          camera.current?.easeTo({
            center: lngLat(point),
            ...(zoom === undefined ? {} : { zoom }),
            duration,
          });
      },
      animateToRegion(region, duration = 400) {
        if (validCoordinate(region))
          camera.current?.easeTo({ ...regionCamera(region), duration });
      },
      fitToCoordinates(points, options) {
        const bounds = coordinateBounds(points);
        if (bounds)
          camera.current?.fitBounds(bounds, {
            padding: options.edgePadding,
            duration: options.animated ? 400 : 0,
          });
      },
    }),
    [],
  );
  const onlineStyle = styleUrl ? mapStyle : null;
  const styleToRender =
    onlineStyle ?? (showOfflineGeometry ? offlineStyle : null);
  if (!configured || !styleToRender) return null;
  const checkIsCurrent =
    guideCheck.style === styleToRender && guideCheck.points === fitPoints;
  const guideVerified =
    checkIsCurrent && guideCheck.rendered && guideCheck.fitted;
  const inspectGuide = () => {
    const map = nativeMap.current;
    const now = Date.now();
    if (
      !map ||
      !debugGuideLayer ||
      !fitPoints ||
      inspecting.current ||
      guideVerified ||
      now - lastInspection.current < 500
    )
      return;
    inspecting.current = true;
    lastInspection.current = now;
    void Promise.all([
      map.queryRenderedFeatures({ layers: [debugGuideLayer] }),
      map.getBounds(),
    ])
      .then(([features, [west, south, east, north]]) => {
        const fitted = fitPoints.every(
          ({ longitude, latitude }) =>
            longitude >= west &&
            longitude <= east &&
            latitude >= south &&
            latitude <= north,
        );
        setGuideCheck({
          style: styleToRender,
          points: fitPoints,
          rendered: features.length > 0,
          fitted,
        });
      })
      .catch(() => {
        // The native style can change while a diagnostic read is pending.
      })
      .finally(() => {
        inspecting.current = false;
      });
  };
  return (
    <View style={[{ flex: 1 }, style]}>
      <Map
        ref={nativeMap}
        style={{ flex: 1 }}
        mapStyle={styleToRender}
        androidView="texture"
        dragPan
        touchZoom
        touchRotate
        touchPitch={false}
        attribution
        compass
        onDidFinishLoadingMap={onMapReady}
        onDidFinishRenderingMapFully={
          debugGuideLayer && !guideVerified ? inspectGuide : undefined
        }
        onDidFailLoadingMap={() => {
          if (showOfflineGeometry && onlineStyle) {
            setMapStyle(null);
            setBaseMapUnavailable(true);
          } else onMapError?.();
        }}
        onRegionWillChange={
          onTouchStart
            ? (event) => {
                if (event.nativeEvent.userInteraction) onTouchStart();
              }
            : undefined
        }
        onPress={
          onPress
            ? (event) => {
                const [longitude, latitude] = event.nativeEvent.lngLat;
                const coordinate = { latitude, longitude };
                if (validCoordinate(coordinate))
                  onPress({ nativeEvent: { coordinate } });
              }
            : undefined
        }
      >
        <Camera ref={camera} initialViewState={initialViewState} />
        {children}
      </Map>
      {onlineStyle ? <MapAttribution /> : null}
      {showOfflineGeometry && (baseMapUnavailable || !styleUrl) ? (
        <Text
          pointerEvents="none"
          style={{ position: "absolute", bottom: 8, left: 8, color: "#243733" }}
        >
          Base map unavailable
        </Text>
      ) : null}
      {debugGuideLayer ? (
        <Text
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            backgroundColor: "white",
            color: "#243733",
            padding: 4,
            fontSize: 11,
          }}
        >
          Guide source/layer rendered:{" "}
          {checkIsCurrent && guideCheck.rendered ? "yes" : "no"} · Camera
          fitted: {checkIsCurrent && guideCheck.fitted ? "yes" : "no"}
        </Text>
      ) : null}
    </View>
  );
}

export function Marker({
  coordinate,
  title,
  description,
  pinColor = "#ED633E",
  children,
  onPress,
}: MarkerProps) {
  const id = useId();
  const [selected, setSelected] = useState(false);
  if (!validCoordinate(coordinate)) return null;
  return (
    <MapLibreMarker
      id={id}
      lngLat={lngLat(coordinate)}
      onPress={(event) => {
        event.stopPropagation();
        setSelected((value) => !value);
        onPress?.();
      }}
    >
      <View
        accessible
        accessibilityRole={onPress ? "button" : "text"}
        accessibilityLabel={[title, description].filter(Boolean).join(". ")}
        collapsable={false}
      >
        {children ?? (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 3,
              borderColor: "white",
              backgroundColor: pinColor,
            }}
          />
        )}
        {selected ? (
          <Text
            style={{
              backgroundColor: "white",
              color: "#101416",
              padding: 6,
              maxWidth: 180,
            }}
          >
            {title}
            {description ? `\n${description}` : ""}
          </Text>
        ) : null}
      </View>
    </MapLibreMarker>
  );
}

export function Polyline({
  id,
  coordinates,
  strokeColor,
  strokeWidth,
}: PolylineProps) {
  const generatedId = useId();
  const sourceId = id ?? generatedId;
  const data = useMemo(() => {
    // Invalid fixes break geometry instead of joining across missing data.
    const groups: number[][][] = [[]];
    for (const point of coordinates) {
      if (!validCoordinate(point)) groups.push([]);
      else groups[groups.length - 1].push(lngLat(point));
    }
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "MultiLineString" as const,
        coordinates: groups.filter((group) => group.length > 1),
      },
    };
  }, [coordinates]);
  if (!data.geometry.coordinates.length) return null;
  return (
    <GeoJSONSource id={`${sourceId}-source`} data={data}>
      <Layer
        id={`${sourceId}-line`}
        type="line"
        paint={{ "line-color": strokeColor, "line-width": strokeWidth }}
        layout={{ "line-cap": "round", "line-join": "round" }}
      />
    </GeoJSONSource>
  );
}

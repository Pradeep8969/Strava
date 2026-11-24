import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View, useWindowDimensions } from "react-native";
import { MapLocationButton } from "./maps/MapLocationButton";
import MapView, { Marker, Polyline } from "./maps/NativeMap";
import { AndroidCameraControls } from "./maps/AndroidCameraControls";
import type { MapHandle } from "../features/maps/native-types";
import { androidMapConfiguration } from "../features/maps/native-configuration";
import { Button, Copy } from "./ui";
import { savedLine, type PlannerMapProps } from "../features/routes/planner";
import { validCoordinate } from "../features/discovery/map-data";
import { demoRouteColor, mapCoordinate } from "../features/routes/demo-preview";

export default function PlannerMap({
  points,
  onWaypoint,
  fitRequest,
  demoCoordinates,
  roadPreview,
  savedGeometry,
  placement,
  onCancelPlacement,
  hideWaypointLine,
}: PlannerMapProps) {
  const android = Platform.OS === "android";
  const { height } = useWindowDimensions();
  const map = useRef<MapHandle>(null);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("Loading map…");
  const [cameraMessage, setCameraMessage] = useState("");
  const target = placement?.target;
  const placing = useRef(false);
  const placementActive = !!placement;
  useEffect(() => {
    placing.current = placementActive;
  }, [placementActive]);
  const line = useMemo(
    () => savedLine(points, savedGeometry),
    [points, savedGeometry],
  );
  const demoLine = useMemo(
    () => demoCoordinates?.map(mapCoordinate),
    [demoCoordinates],
  );
  const routedLine = roadPreview?.line.length ? roadPreview.line : undefined;
  const latest =
    useRef<readonly { latitude: number; longitude: number }[]>(points);
  useEffect(() => {
    latest.current = roadPreview
      ? [
          ...roadPreview.line,
          ...roadPreview.markers.map(({ requested }) => requested),
        ]
      : (demoLine ?? line);
  }, [line, demoLine, roadPreview]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ready)
        setStatus(
          "Map unavailable. Check your connection and native map configuration, then retry.",
        );
    }, 25000);
    return () => clearTimeout(timer);
  }, [ready, retry]);
  const fit = useCallback(() => {
    if (latest.current.length)
      map.current?.fitToCoordinates([...latest.current], {
        edgePadding: { top: 40, bottom: 40, left: 40, right: 40 },
        animated: true,
      });
  }, []);
  useEffect(() => {
    if (ready && !placing.current) fit();
  }, [fitRequest, ready, fit, routedLine]);
  useEffect(() => {
    if (ready && target) map.current?.centerOn?.(target, 17, 0);
  }, [ready, target]);
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    return (
      <Copy>Interactive planning is supported on web, Android and iOS.</Copy>
    );
  if (
    android &&
    !androidMapConfiguration() &&
    !points.length &&
    !roadPreview &&
    !placement &&
    !onCancelPlacement &&
    onWaypoint
  )
    return (
      <Copy>
        The Android MapTiler key is not configured in this build. GPS recording
        remains available. Open Route studio on web to plan with the configured
        MapTiler map.
      </Copy>
    );
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          height: Math.max(
            220,
            Math.min(480, height * (placement ? 0.44 : 0.56)),
          ),
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        <MapView
          key={retry}
          showOfflineGeometry
          ref={map}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: 27.7172,
            longitude: 85.324,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          onMapReady={() => {
            setReady(true);
            setStatus("");
          }}
          onMapError={() =>
            setStatus(
              "Map unavailable. Check your connection and MapTiler key restrictions, then retry.",
            )
          }
          onPress={
            onWaypoint
              ? (event) => {
                  const p = event.nativeEvent.coordinate;
                  if (validCoordinate(p)) onWaypoint(p);
                }
              : undefined
          }
        >
          {!hideWaypointLine && line.length > 1 ? (
            <Polyline
              coordinates={line}
              strokeColor="#ED633E"
              strokeWidth={5}
            />
          ) : null}
          {(roadPreview ? [] : points).map((p, i) => (
            <Marker
              key={i}
              coordinate={p}
              title={
                i === 0
                  ? "Start"
                  : i === points.length - 1
                    ? "Finish"
                    : `Waypoint ${i + 1}`
              }
            >
              <View
                style={{
                  backgroundColor: "#ED633E",
                  borderRadius: 18,
                  padding: 8,
                }}
              >
                <Text style={{ color: "#111", fontWeight: "800" }}>
                  {i === 0 ? "S" : i === points.length - 1 ? "F" : i + 1}
                </Text>
              </View>
            </Marker>
          ))}
          {demoLine ? (
            <Polyline
              coordinates={demoLine}
              strokeColor={demoRouteColor}
              strokeWidth={4}
            />
          ) : null}
          {roadPreview ? (
            <Polyline
              coordinates={roadPreview.line}
              strokeColor={demoRouteColor}
              strokeWidth={5}
            />
          ) : null}
          {roadPreview?.markers.map(({ label, requested }) => (
            <Marker
              key={label}
              coordinate={requested}
              title={`Requested ${label}`}
            />
          ))}
          {roadPreview?.markers.map(({ label, snapped, offset }) =>
            snapped ? (
              <Marker
                key={label}
                coordinate={snapped}
                title={`Snapped ${label}`}
                description={`About ${offset} m from the requested point`}
              >
                <View
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 7,
                    borderWidth: 2,
                    borderColor: "white",
                    backgroundColor: demoRouteColor,
                  }}
                />
              </Marker>
            ) : null,
          )}
        </MapView>
        {placement ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              inset: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              allowFontScaling={false}
              importantForAccessibility="no"
              style={{
                color: "#111",
                backgroundColor: "#FFF",
                fontSize: 24,
                width: 28,
                height: 28,
                lineHeight: 28,
                textAlign: "center",
                includeFontPadding: false,
              }}
            >
              +
            </Text>
          </View>
        ) : null}
        {android ? (
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", top: 8, right: 8 }}
          >
            <AndroidCameraControls
              map={map}
              ready={ready}
              vertical
              onFit={
                !placement && (points.length || roadPreview?.line.length)
                  ? fit
                  : undefined
              }
            />
          </View>
        ) : null}
      </View>
      {placement ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button
            title="Confirm position"
            disabled={!ready}
            onPress={() => {
              const currentMap = map.current;
              setCameraMessage("");
              void (async () => {
                try {
                  const point = await currentMap?.getCenter?.();
                  if (!point) throw new Error();
                  if (map.current === currentMap) placement.onConfirm(point);
                } catch {
                  setCameraMessage("Could not read the map center. Try again.");
                }
              })();
            }}
          />
          <Button
            secondary
            title="Cancel placement"
            onPress={() => onCancelPlacement?.()}
          />
        </View>
      ) : null}
      {android && placement ? (
        <MapLocationButton map={map} ready={ready} />
      ) : null}
      {cameraMessage ? <Copy>{cameraMessage}</Copy> : null}
      {status ? (
        <>
          <Copy>{status}</Copy>
          <Button
            secondary
            title="Retry map"
            onPress={() => {
              setReady(false);
              setStatus("Loading map…");
              setRetry((v) => v + 1);
            }}
          />
        </>
      ) : null}
    </View>
  );
}

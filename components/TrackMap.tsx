import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, Polyline } from "./maps/NativeMap";
import type { MapHandle, MapPressEvent } from "../features/maps/native-types";
import { androidMapConfiguration } from "../features/maps/native-configuration";
import type { TrackPoint } from "../types/activity";
import { mapSegments, validCoordinate } from "../features/discovery/map-data";
import { areaRegions } from "../features/discovery/catalog";
import { View, Platform, Text } from "react-native";
import { Button, Card, Copy, useColors } from "./ui";
import { AndroidCameraControls } from "./maps/AndroidCameraControls";
import { MapLocationButton } from "./maps/MapLocationButton";
import { savedLine, type PlannedRoute } from "../features/routes/planner";

const guideColor = "#167F83";
const gpsColor = "#ff784b";
const guidePadding = { top: 42, right: 42, bottom: 42, left: 42 };
const guideLineId = "record-planned-guide";

export default function TrackMap({
  points,
  onPress,
  current = false,
  cursor,
  guide,
}: {
  points: TrackPoint[];
  onPress?: (event: MapPressEvent) => void;
  current?: boolean;
  cursor?: TrackPoint;
  guide?: { points: TrackPoint[]; geometry?: PlannedRoute["geometry"] };
}) {
  const android = Platform.OS === "android";
  const map = useRef<MapHandle>(null);
  const c = useColors();
  const valid = useMemo(() => points.filter(validCoordinate), [points]);
  const groups = useMemo(
    () =>
      mapSegments({
        id: "track",
        title: "Recorded GPS",
        kind: "recording",
        points,
      }),
    [points],
  );
  const last = valid.at(-1);
  const guidePoints = guide?.points;
  const guideGeometry = guide?.geometry;
  const guideLine = useMemo(
    () => (guidePoints ? savedLine(guidePoints, guideGeometry) : undefined),
    [guidePoints, guideGeometry],
  );
  const [followChoice, setFollowChoice] = useState<{
    guidePoints?: TrackPoint[];
    enabled: boolean;
  }>();
  const following =
    followChoice && followChoice.guidePoints === guidePoints
      ? followChoice.enabled
      : !guidePoints && !android;
  const setFollowing = (enabled: boolean) =>
    setFollowChoice({ guidePoints, enabled });
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("Loading map…");
  const cameraPosition = useRef("");
  const fittedGuide = useRef(android ? guideLine : undefined);
  const fitGuide = useCallback(
    (animated = false) => {
      if (!guideLine?.length) return;
      map.current?.fitToCoordinates(guideLine, {
        edgePadding: guidePadding,
        animated,
      });
    },
    [guideLine],
  );
  useEffect(() => {
    if (!ready) return;
    if (android && fittedGuide.current === guideLine) return;
    fittedGuide.current = guideLine;
    fitGuide();
  }, [android, guideLine, ready, fitGuide]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ready)
        setStatus(
          "Map unavailable. Check your connection and native map configuration, then retry.",
        );
    }, 25000);
    return () => clearTimeout(timer);
  }, [ready, retry]);
  const recenter = useCallback(() => {
    if (!ready || !last) return;
    if (current && android && map.current?.centerOn) map.current.centerOn(last);
    else if (current)
      map.current?.animateToRegion(
        { ...last, latitudeDelta: 0.008, longitudeDelta: 0.008 },
        400,
      );
    else
      map.current?.fitToCoordinates(valid, {
        edgePadding: { top: 35, bottom: 35, left: 35, right: 35 },
        animated: false,
      });
  }, [ready, last, current, valid, android]);
  useEffect(() => {
    if (!following) {
      cameraPosition.current = "";
      return;
    }
    if (!current) {
      recenter();
      return;
    }
    if (!ready || !last) return;
    const position = `${retry}:${last.latitude}:${last.longitude}`;
    if (cameraPosition.current !== position) {
      cameraPosition.current = position;
      recenter();
    }
  }, [recenter, current, following, ready, last, retry]);
  if (!guidePoints && !current && !last && !onPress)
    return <Copy>No recorded route for this activity.</Copy>;
  if (Platform.OS === "android" && !androidMapConfiguration() && !guidePoints)
    return (
      <Card>
        <Copy>Map not configured</Copy>
        <Copy muted>
          Your GPS recording still works. A map will appear after the app’s
          Android MapTiler key is configured.
        </Copy>
      </Card>
    );
  return (
    <View style={{ gap: 8 }}>
      {android ? (
        <AndroidCameraControls
          map={map}
          ready={ready}
          onExplore={following ? () => setFollowing(false) : undefined}
        />
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {guidePoints ? (
          <Button
            secondary
            title={android ? "Fit route" : "Fit guide"}
            disabled={!ready}
            onPress={() => {
              setFollowing(false);
              fitGuide(android);
            }}
          />
        ) : null}
        {current ? (
          <Button
            secondary
            title={following ? "Following location" : "Follow location"}
            disabled={!last || !ready}
            onPress={() => setFollowing(!following)}
          />
        ) : null}
        {android && (current || guidePoints) ? (
          <MapLocationButton map={map} ready={ready} latest={last} />
        ) : (
          <Button
            secondary
            title={current ? "Recenter location" : "Fit map to route"}
            disabled={!last || !ready}
            onPress={recenter}
          />
        )}
      </View>
      <View style={{ borderRadius: 20, overflow: "hidden", height: 290 }}>
        <MapView
          key={retry}
          showOfflineGeometry={!!guidePoints}
          initialFit={
            guideLine ? { points: guideLine, padding: guidePadding } : undefined
          }
          debugGuideLayer={
            guidePoints && __DEV__ ? `${guideLineId}-line` : undefined
          }
          ref={map}
          style={{ flex: 1 }}
          userInterfaceStyle={c.bg === "#F6F7F4" ? "light" : "dark"}
          onMapReady={() => {
            setReady(true);
            setStatus("");
          }}
          onMapError={() =>
            setStatus(
              "Map unavailable. Check your connection and MapTiler key restrictions, then retry.",
            )
          }
          onTouchStart={
            current && following ? () => setFollowing(false) : undefined
          }
          onPress={onPress}
          initialRegion={
            last
              ? { ...last, latitudeDelta: 0.02, longitudeDelta: 0.02 }
              : areaRegions.valley
          }
        >
          {guideLine ? (
            <Polyline
              id={guideLineId}
              coordinates={guideLine}
              strokeWidth={7}
              strokeColor={guideColor}
            />
          ) : null}
          {groups.map((group, i) => (
            <Polyline
              key={i}
              coordinates={group}
              strokeWidth={5}
              strokeColor={gpsColor}
            />
          ))}
          {guidePoints?.map((point, index) => {
            const label =
              index === 0
                ? "Start"
                : index === guidePoints.length - 1
                  ? "Finish"
                  : `Waypoint ${index + 1}`;
            return (
              <Marker key={`guide-${index}`} coordinate={point} title={label}>
                <View
                  style={{
                    backgroundColor: guideColor,
                    borderColor: "white",
                    borderWidth: 2,
                    borderRadius: 14,
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{ color: "white", fontSize: 11, fontWeight: "700" }}
                  >
                    {index === 0 || index === guidePoints.length - 1
                      ? label
                      : index + 1}
                  </Text>
                </View>
              </Marker>
            );
          })}
          {current && last ? (
            <Marker
              coordinate={last}
              title="Latest accepted GPS location"
              pinColor={guidePoints ? gpsColor : guideColor}
            />
          ) : null}
          {cursor && validCoordinate(cursor) ? (
            <Marker coordinate={cursor} title="Replay position" />
          ) : null}
        </MapView>
        {!last && !onPress && !guidePoints ? (
          <View
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              right: 12,
              padding: 12,
              borderRadius: 10,
              backgroundColor: "#1a2023",
            }}
          >
            <Copy muted>Waiting for an accurate GPS fix</Copy>
          </View>
        ) : null}
      </View>
      {status ? (
        <>
          <Copy>{status}</Copy>
          <Button
            secondary
            title="Retry map"
            onPress={() => {
              setReady(false);
              fittedGuide.current = android ? guideLine : undefined;
              setStatus("Loading map…");
              setRetry((value) => value + 1);
            }}
          />
        </>
      ) : null}
    </View>
  );
}

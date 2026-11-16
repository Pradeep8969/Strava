import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, {
  Marker,
  Polyline,
  type MapPressEvent,
} from "react-native-maps";
import type { TrackPoint } from "../types/activity";
import { mapSegments, validCoordinate } from "../features/discovery/map-data";
import { areaRegions } from "../features/discovery/catalog";
import { View, Platform } from "react-native";
import { Button, Card, Copy, useColors } from "./ui";
export default function TrackMap({
  points,
  onPress,
  current = false,
  cursor,
}: {
  points: TrackPoint[];
  onPress?: (event: MapPressEvent) => void;
  current?: boolean;
  cursor?: TrackPoint;
}) {
  const map = useRef<MapView>(null);
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
  const [following, setFollowing] = useState(true);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("Loading map…");
  const cameraPosition = useRef("");
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
    if (current)
      map.current?.animateToRegion(
        { ...last, latitudeDelta: 0.008, longitudeDelta: 0.008 },
        400,
      );
    else
      map.current?.fitToCoordinates(valid, {
        edgePadding: { top: 35, bottom: 35, left: 35, right: 35 },
        animated: false,
      });
  }, [ready, last, current, valid]);
  useEffect(() => {
    if (!current) {
      recenter();
      return;
    }
    if (!following) {
      cameraPosition.current = "";
      return;
    }
    if (!ready || !last) return;
    const position = `${retry}:${last.latitude}:${last.longitude}`;
    if (cameraPosition.current !== position) {
      cameraPosition.current = position;
      recenter();
    }
  }, [recenter, current, following, ready, last, retry]);
  if (!current && !last && !onPress)
    return <Copy>No recorded route for this activity.</Copy>;
  if (Platform.OS === "android" && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY)
    return (
      <Card>
        <Copy>Map not configured</Copy>
        <Copy muted>
          Your GPS recording still works. A map will appear after the app’s
          Android map service is configured.
        </Copy>
      </Card>
    );
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {current ? (
          <Button
            secondary
            title={following ? "Following location" : "Follow location"}
            disabled={!last || !ready}
            onPress={() => setFollowing((value) => !value)}
          />
        ) : null}
        <Button
          secondary
          title={current ? "Recenter location" : "Fit map to route"}
          disabled={!last || !ready}
          onPress={() => {
            if (following || !current) recenter();
            else setFollowing(true);
          }}
        />
      </View>
      <View style={{ borderRadius: 20, overflow: "hidden", height: 290 }}>
        <MapView
          key={retry}
          ref={map}
          style={{ flex: 1 }}
          userInterfaceStyle={c.bg === "#F6F7F4" ? "light" : "dark"}
          onMapReady={() => {
            setReady(true);
            setStatus("");
          }}
          onTouchStart={current ? () => setFollowing(false) : undefined}
          onPress={onPress}
          initialRegion={
            last
              ? { ...last, latitudeDelta: 0.02, longitudeDelta: 0.02 }
              : areaRegions.valley
          }
        >
          {groups.map((group, i) => (
            <Polyline
              key={i}
              coordinates={group}
              strokeWidth={5}
              strokeColor="#ff784b"
            />
          ))}
          {current && last ? (
            <Marker
              coordinate={last}
              title="Latest accepted GPS location"
              pinColor="#167F83"
            />
          ) : null}
          {cursor && validCoordinate(cursor) ? (
            <Marker coordinate={cursor} title="Replay position" />
          ) : null}
        </MapView>
        {!last && !onPress ? (
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
              setStatus("Loading map…");
              setRetry((value) => value + 1);
            }}
          />
        </>
      ) : null}
    </View>
  );
}

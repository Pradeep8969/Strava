import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Button, Copy } from "./ui";
import type { PlannerMapProps } from "../features/routes/planner";
import { validCoordinate } from "../features/discovery/map-data";

export default function PlannerMap({
  points,
  onWaypoint,
  fitRequest,
}: PlannerMapProps) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("Loading map…");
  const latest = useRef(points);
  useEffect(() => {
    latest.current = points;
  }, [points]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ready)
        setStatus(
          "Map unavailable. Check your connection and native map configuration, then retry.",
        );
    }, 25000);
    return () => clearTimeout(timer);
  }, [ready, retry]);
  useEffect(() => {
    if (ready && latest.current.length)
      map.current?.fitToCoordinates(latest.current, {
        edgePadding: { top: 40, bottom: 40, left: 40, right: 40 },
        animated: true,
      });
  }, [fitRequest, ready]);
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    return (
      <Copy>Interactive planning is supported on web, Android and iOS.</Copy>
    );
  if (Platform.OS === "android" && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY)
    return (
      <Copy>
        The existing Android map service is not configured in this build. GPS
        recording remains available. Open Route studio on web to plan with the
        configured MapTiler map.
      </Copy>
    );
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 360, borderRadius: 20, overflow: "hidden" }}>
        <MapView
          key={retry}
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
          onPress={(event) => {
            const p = event.nativeEvent.coordinate;
            if (validCoordinate(p)) onWaypoint(p);
          }}
        >
          {points.length > 1 ? (
            <Polyline
              coordinates={points}
              strokeColor="#ED633E"
              strokeWidth={5}
            />
          ) : null}
          {points.map((p, i) => (
            <Marker key={i} coordinate={p} title={`Waypoint ${i + 1}`}>
              <View
                style={{
                  backgroundColor: "#ED633E",
                  borderRadius: 18,
                  padding: 8,
                }}
              >
                <Copy>{i + 1}</Copy>
              </View>
            </Marker>
          ))}
        </MapView>
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
              setRetry((v) => v + 1);
            }}
          />
        </>
      ) : null}
    </View>
  );
}

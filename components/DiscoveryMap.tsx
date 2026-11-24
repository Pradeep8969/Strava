import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import MapView, { Marker, Polyline } from "./maps/NativeMap";
import type { MapHandle } from "../features/maps/native-types";
import { androidMapConfiguration } from "../features/maps/native-configuration";
import { AthleteText as Text } from "./athlete";
import { Button, useColors } from "./ui";
import { areaPlaces, areaRegions } from "../features/discovery/catalog";
import type { TrackPoint } from "../types/activity";
import {
  mapSegments,
  validCoordinate,
  type DiscoveryMapProps,
} from "../features/discovery/map-data";
const emptyPoints: TrackPoint[] = [];

export default function DiscoveryMap({
  area = "valley",
  points = emptyPoints,
  height = 330,
  routes = [],
  selectedId,
  onSelect,
}: DiscoveryMapProps) {
  points = routes.find((r) => r.id === selectedId)?.points ?? points;
  const map = useRef<MapHandle>(null),
    ready = useRef(false),
    c = useColors();
  const [status, setStatus] = useState("Loading map…");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ready.current)
        setStatus(
          "Map unavailable. Check your connection and native map configuration, then retry.",
        );
    }, 25000);
    return () => clearTimeout(timer);
  }, [retry]);
  const fit = useCallback(() => {
    if (!ready.current) return;
    const valid = points.filter(validCoordinate);
    if (valid.length)
      map.current?.fitToCoordinates(valid, {
        edgePadding: { top: 40, bottom: 40, left: 35, right: 35 },
        animated: false,
      });
    else map.current?.animateToRegion(areaRegions[area]);
  }, [area, points]);
  useEffect(fit, [fit]);
  if (Platform.OS === "android" && !androidMapConfiguration())
    return (
      <View
        style={{
          height,
          borderRadius: 14,
          padding: 24,
          backgroundColor: c.greenSoft,
          justifyContent: "center",
          gap: 10,
        }}
      >
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>
          Explore Nepal
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>
          Configure the Android MapTiler key to view this map. Saved route
          geometry and GPS recording are preserved.
        </Text>
      </View>
    );
  return (
    <View style={{ gap: 8 }}>
      <Button secondary title="Recenter map" onPress={fit} />
      <View style={{ height, borderRadius: 14, overflow: "hidden" }}>
        <MapView
          key={retry}
          ref={map}
          style={{ flex: 1 }}
          initialRegion={areaRegions[area]}
          onMapReady={() => {
            ready.current = true;
            setStatus("");
            fit();
          }}
          onMapError={() =>
            setStatus(
              "Map unavailable. Check your connection and MapTiler key restrictions, then retry.",
            )
          }
          userInterfaceStyle={c.bg === "#F6F7F4" ? "light" : "dark"}
        >
          {routes.flatMap((route) =>
            mapSegments(route).map((group, i) => (
              <Polyline
                key={`${route.id}:${i}`}
                coordinates={group}
                strokeColor={route.id === selectedId ? "#167F83" : "#ED633E"}
                strokeWidth={4}
              />
            )),
          )}
          {routes.map((route) => {
            const point = route.points.find(validCoordinate);
            return point ? (
              <Marker
                key={route.id}
                coordinate={point}
                title={route.title}
                description={
                  route.kind === "plan" ? "Straight-line plan" : "Recorded GPS"
                }
                onPress={() => onSelect?.(route.id)}
              />
            ) : null;
          })}
          {points.length > 1 && !routes.length ? (
            <Polyline
              coordinates={points}
              strokeColor="#ED633E"
              strokeWidth={4}
            />
          ) : (
            areaPlaces[area].map((place) => (
              <Marker
                key={place.name}
                coordinate={place}
                title={place.name}
                description="Destination reference · not a mapped trail"
              />
            ))
          )}
        </MapView>
      </View>
      {status ? (
        <>
          <Text style={{ color: c.muted }}>{status}</Text>
          <Button
            secondary
            title="Retry map"
            onPress={() => {
              ready.current = false;
              setStatus("Loading map…");
              setRetry((v) => v + 1);
            }}
          />
        </>
      ) : null}
    </View>
  );
}

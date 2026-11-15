import { useCallback, useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { AthleteText as Text } from "./athlete";
import { useColors } from "./ui";
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
  const map = useRef<MapView>(null),
    ready = useRef(false),
    c = useColors();
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
  if (Platform.OS === "android" && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY)
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
        {routes.flatMap((route) =>
          mapSegments(route).map((group, i) => (
            <Polyline
              key={`${route.id}:${i}`}
              coordinates={group}
              strokeColor="#ED633E"
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
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>
          Explore Nepal
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>
          Configure the Android map key to view this map. Saved route geometry
          and GPS recording are preserved.
        </Text>
      </View>
    );
  return (
    <View style={{ height, borderRadius: 14, overflow: "hidden" }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={areaRegions[area]}
        onMapReady={() => {
          ready.current = true;
          fit();
        }}
        userInterfaceStyle={c.bg === "#F6F7F4" ? "light" : "dark"}
      >
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
  );
}

import { memo, useMemo } from "react";
import type { TrackPoint } from "../types/activity";
import type { MapRoute } from "../features/discovery/map-data";
import { validCoordinate } from "../features/discovery/map-data";
import DiscoveryMap from "./DiscoveryMap";
import { Copy, useColors } from "./ui";
import { View, useWindowDimensions } from "react-native";

export default memo(function TrackMap({
  points,
  current = false,
}: {
  points: TrackPoint[];
  onPress?: unknown;
  current?: boolean;
  cursor?: TrackPoint;
}) {
  const width = useWindowDimensions().width;
  const c = useColors();
  const routes = useMemo<MapRoute[]>(
    () => [
      {
        id: "workout-track",
        title: "Recorded activity route",
        kind: "recording",
        points,
      },
    ],
    [points],
  );
  // Do not load MapLibre or request tiles for an activity without usable GPS.
  if (!points.some(validCoordinate))
    return (
      <View
        style={{
          minHeight: 160,
          padding: 24,
          justifyContent: "center",
          borderRadius: 16,
          backgroundColor: c.greenSoft,
        }}
      >
        <Copy>No recorded route for this activity.</Copy>
      </View>
    );
  return (
    <DiscoveryMap
      routes={routes}
      selectedId="workout-track"
      height={width >= 1100 ? 440 : width >= 768 ? 400 : 320}
      tracking={current}
      variant={current ? "record" : "activity"}
    />
  );
});

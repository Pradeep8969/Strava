import { useMemo } from "react";
import { View } from "react-native";
import DiscoveryMap from "./DiscoveryMap";
import { RoutePreview } from "./RoutePreview";
import type { TrackPoint } from "../types/activity";
import type { MapRoute } from "../features/discovery/map-data";

export default function RecorderMap({
  points,
}: {
  points: TrackPoint[];
  current?: boolean;
}) {
  const routes = useMemo<MapRoute[]>(
    () =>
      points.length
        ? [
            {
              id: "current-recording",
              title: "Your recorded route",
              kind: "recording",
              points,
            },
          ]
        : [],
    [points],
  );
  return (
    <View
      style={{
        minHeight: 260,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#253740",
      }}
    >
      <DiscoveryMap
        height={300}
        routes={routes}
        selectedId="current-recording"
      />
      {points.length > 1 ? <RoutePreview points={points} /> : null}
    </View>
  );
}

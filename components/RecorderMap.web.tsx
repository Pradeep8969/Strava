import { memo, useMemo } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import DiscoveryMap from "./DiscoveryMap";
import type { TrackPoint } from "../types/activity";
import type { MapRoute } from "../features/discovery/map-data";
import { useGpsAcquisition } from "../features/recording/acquisition";

export default memo(function RecorderMap({
  points,
}: {
  points: TrackPoint[];
  current?: boolean;
}) {
  const acquisition = useGpsAcquisition((state) => state.state);
  const width = useWindowDimensions().width;
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
        height={width >= 1100 ? 430 : width >= 768 ? 380 : 320}
        routes={routes}
        selectedId="current-recording"
        tracking
        tone="dark"
        variant="record"
      />
      {!points.length &&
      (acquisition === "acquiring" || acquisition === "waiting") ? (
        <Text
          style={{
            color: "#CED8DD",
            padding: 12,
            fontSize: 13,
            lineHeight: 20,
          }}
        >
          Waiting for accurate GPS — recording requires 35 m or better.
        </Text>
      ) : null}
    </View>
  );
});

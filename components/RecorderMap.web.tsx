import { memo, useMemo } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import DiscoveryMap from "./DiscoveryMap";
import type { TrackPoint } from "../types/activity";
import type { MapRoute } from "../features/discovery/map-data";
import { useGpsAcquisition } from "../features/recording/acquisition";

export default memo(function RecorderMap({
  points,
  guide,
}: {
  points: TrackPoint[];
  current?: boolean;
  guide?: { title: string; points: TrackPoint[] };
}) {
  const acquisition = useGpsAcquisition((state) => state.state);
  const width = useWindowDimensions().width;
  const routes = useMemo<MapRoute[]>(
    () => [
      ...(guide
        ? [
            {
              id: "planned-guide",
              title: guide.title,
              kind: "plan" as const,
              points: guide.points,
            },
          ]
        : []),
      ...(points.length
        ? [
            {
              id: "current-recording",
              title: "Your recorded route",
              kind: "recording" as const,
              points,
            },
          ]
        : []),
    ],
    [points, guide],
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
        selectedId={
          points.length || !guide ? "current-recording" : "planned-guide"
        }
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

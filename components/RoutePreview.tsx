import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { routePreview } from "../features/routes/preview";
import type { TrackPoint } from "../types/activity";
import { useColors } from "./ui";

export function RoutePreview({ points }: { points: TrackPoint[] }) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const groups = useMemo(
    () => routePreview(points, width, 100),
    [points, width],
  );
  return (
    <View
      style={{
        backgroundColor: c.greenSoft,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Recorded route sketch, without a base map"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: 100 }}
      >
        {groups.flatMap((group, index) =>
          group.slice(1).map((point, i) => {
            const previous = group[i];
            const dx = point.x - previous.x,
              dy = point.y - previous.y;
            const size = Math.hypot(dx, dy);
            return (
              <View
                key={`${index}-${i}`}
                style={{
                  position: "absolute",
                  left: (previous.x + point.x) / 2 - size / 2,
                  top: (previous.y + point.y) / 2 - 1.5,
                  height: 3,
                  width: size,
                  borderRadius: 2,
                  backgroundColor: c.forest,
                  transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                }}
              />
            );
          }),
        )}
      </View>
      <Text
        style={{
          color: c.forest,
          fontSize: 10,
          paddingHorizontal: 12,
          paddingBottom: 9,
        }}
      >
        RECORDED ROUTE · NO BASE MAP
      </Text>
    </View>
  );
}

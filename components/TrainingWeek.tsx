import { View } from "react-native";
import { AthleteText as Text } from "./athlete";
import { Card, Copy, useColors } from "./ui";
import { dailyTotals } from "../features/analytics/metrics";
import { length } from "../utils/format";
import type { Workout } from "../types/activity";

export function TrainingWeek({
  workouts,
  units,
}: {
  workouts: Workout[];
  units: "km" | "mi";
}) {
  const c = useColors();
  const days = dailyTotals(workouts);
  const max = Math.max(1, ...days.map((day) => day.meters));
  return (
    <Card>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: "800" }}>
        A little movement, every day.
      </Text>
      <Copy muted>Your week at a glance · {units} recorded</Copy>
      <View style={{ flexDirection: "row", gap: 10, height: 150 }}>
        {days.map((day) => (
          <View
            key={day.start}
            style={{ flex: 1, alignItems: "center", gap: 7 }}
          >
            <Text style={{ color: c.muted, fontSize: 10 }}>
              {length(day.meters, units)}
            </Text>
            <View
              style={{
                flex: 1,
                width: "100%",
                alignItems: "center",
                justifyContent: "flex-end",
                backgroundColor: c.raised,
                borderRadius: 8,
              }}
            >
              <View
                accessible
                accessibilityLabel={`${day.label}: ${length(day.meters, units)} ${units}`}
                style={{
                  width: "100%",
                  maxWidth: 48,
                  height:
                    day.meters > 0
                      ? `${Math.max(3, (day.meters / max) * 100)}%`
                      : 0,
                  borderRadius: 8,
                  backgroundColor: c.forest,
                }}
              />
            </View>
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700" }}>
              {day.label}
            </Text>
          </View>
        ))}
      </View>
      <Copy muted>
        {days.some((day) => day.count > 0)
          ? "Based on your finished activities on this device."
          : "An open week of possibilities. Your finished activities will fill this chart."}
      </Copy>
    </Card>
  );
}

import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { AthleteText as Text } from "./athlete";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "./ui";
import type { Workout } from "../types/activity";
import { stats } from "../utils/tracking";
import { length, duration } from "../utils/format";
import { useApp } from "../store/app";
import { RoutePreview } from "./RoutePreview";
export default function ActivityCard({ workout: w }: { workout: Workout }) {
  const units = useApp((s) => s.preferences.units),
    c = useColors(),
    s = stats(w);
  const icon =
    w.sport === "cycling"
      ? "bicycle-outline"
      : w.sport === "hiking"
        ? "trail-sign-outline"
        : "walk-outline";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${w.title}`}
      onPress={() => router.push(`/activity/${w.id}`)}
      style={({ pressed }) => ({
        backgroundColor: c.panel,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        padding: 19,
        gap: 12,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View
          style={{
            width: 44,
            height: 44,
            backgroundColor: c.greenSoft,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={21} color={c.forest} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: c.text, fontWeight: "800", fontSize: 16 }}>
            {w.title}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            {w.sport.toUpperCase()} ·{" "}
            {new Date(w.startedAt).toLocaleDateString()} · {w.visibility}
          </Text>
        </View>
        <Ionicons name="chevron-forward" color={c.muted} size={20} />
      </View>
      {w.points.length > 1 ? <RoutePreview points={w.points} /> : null}
      <View style={{ flexDirection: "row", gap: 20, flexWrap: "wrap" }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 19, fontWeight: "900" }}>
            {length(s.meters, units)}{" "}
            <Text style={{ fontSize: 12, fontWeight: "500" }}>{units}</Text>
          </Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>Distance</Text>
        </View>
        <View style={{ gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 19, fontWeight: "900" }}>
            {duration(s.movingMs)}
          </Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>Moving time</Text>
        </View>
        <View style={{ gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 19, fontWeight: "900" }}>
            {w.points.length}
          </Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>GPS points</Text>
        </View>
      </View>
    </Pressable>
  );
}

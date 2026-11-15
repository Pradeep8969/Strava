import {
  useMemo,
  useState,
  type ComponentProps,
  type PropsWithChildren,
} from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AthleteText as Text } from "./athlete";
import { useColors } from "./ui";
import { RoutePreview } from "./RoutePreview";
import { dailyTotals } from "../features/analytics/metrics";
import {
  monthlyTraining,
  personalRecords,
  trainingSummary,
} from "../features/athlete/metrics";
import { waypointElevation } from "../features/discovery/catalog";
import { duration, length, pace } from "../utils/format";
import { stats } from "../utils/tracking";
import type { Sport, Workout } from "../types/activity";

export const sportNames: Record<Sport, string> = {
  running: "Running",
  walking: "Walking",
  cycling: "Cycling",
  hiking: "Hiking",
};
export const sportIcons: Record<
  Sport,
  ComponentProps<typeof Ionicons>["name"]
> = {
  running: "fitness-outline",
  walking: "walk-outline",
  cycling: "bicycle-outline",
  hiking: "trail-sign-outline",
};
export function TrainingPanel({ children }: PropsWithChildren) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 14,
        padding: 17,
        gap: 15,
      }}
    >
      {children}
    </View>
  );
}
export function TrainingStats({
  workouts,
  units,
  readable = false,
}: {
  workouts: Workout[];
  units: "km" | "mi";
  readable?: boolean;
}) {
  const c = useColors();
  const s = useMemo(() => trainingSummary(workouts), [workouts]);
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: c.panel,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: c.border,
        paddingVertical: 19,
      }}
    >
      {[
        [length(s.meters, units), `Distance · ${units}`, "navigate-outline"],
        [duration(s.movingMs), "Moving time", "time-outline"],
        [String(s.count), "Activities", "fitness-outline"],
      ].map(([value, label, icon], i) => (
        <View
          key={label}
          style={{
            flex: 1,
            minWidth: 0,
            alignItems: "center",
            gap: 7,
            borderLeftWidth: i ? 1 : 0,
            borderLeftColor: c.border,
          }}
        >
          <Ionicons
            name={icon as ComponentProps<typeof Ionicons>["name"]}
            size={17}
            color={i === 1 ? c.forest : c.accent}
          />
          <Text
            testID={`training-stat-${i}`}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              color: c.text,
              fontSize: i === 1 ? (readable ? 19 : 17) : readable ? 26 : 24,
              fontWeight: "700",
              letterSpacing: -0.7,
            }}
          >
            {value}
          </Text>
          <Text style={{ color: c.muted, fontSize: readable ? 11 : 10 }}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}
export function TrainingChart({
  workouts,
  units,
  goalKm,
  readable = false,
}: {
  workouts: Workout[];
  units: "km" | "mi";
  goalKm?: number;
  readable?: boolean;
}) {
  const c = useColors();
  const [period, setPeriod] = useState<"Week" | "Month">("Week");
  const days = useMemo(() => dailyTotals(workouts), [workouts]);
  const months = useMemo(() => monthlyTraining(workouts), [workouts]);
  const items = period === "Week" ? days : months;
  const total = items.reduce((sum, item) => sum + item.meters, 0);
  const max = Math.max(1, ...items.map((item) => item.meters));
  const weekMeters = days.reduce((sum, d) => sum + d.meters, 0);
  const progress =
    goalKm && goalKm > 0
      ? Math.min(100, (weekMeters / (goalKm * 1000)) * 100)
      : 0;
  return (
    <TrainingPanel>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: c.text,
            fontSize: readable ? 17 : 16,
            fontWeight: "700",
          }}
        >
          Your training
        </Text>
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: "row",
            backgroundColor: c.raised,
            borderRadius: 8,
            padding: 3,
          }}
        >
          {(["Week", "Month"] as const).map((p) => (
            <Pressable
              key={p}
              accessibilityRole="tab"
              aria-selected={p === period}
              accessibilityLabel={p}
              accessibilityState={{ selected: p === period }}
              onPress={() => setPeriod(p)}
              style={{
                minHeight: 34,
                paddingHorizontal: 12,
                borderRadius: 6,
                justifyContent: "center",
                backgroundColor: p === period ? c.text : "transparent",
              }}
            >
              <Text
                style={{
                  color: p === period ? c.panel : c.muted,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {p}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Text
          style={{
            color: c.text,
            fontSize: 27,
            fontWeight: "700",
            letterSpacing: -0.8,
          }}
        >
          {length(total, units)}
        </Text>
        <Text style={{ color: c.muted, fontSize: 11 }}>
          {units} · {period === "Week" ? "this week" : "last 6 months"}
        </Text>
      </View>
      <View
        accessibilityLabel={`${period === "Week" ? "Weekly" : "Monthly"} distance chart`}
        style={{
          height: 113,
          flexDirection: "row",
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        {items.map((item) => (
          <View
            key={item.start}
            accessible
            accessibilityLabel={`${item.label}: ${length(item.meters, units)} ${units}, ${item.count} activities`}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6,
            }}
          >
            <Text style={{ fontSize: readable ? 10 : 9, color: c.muted }}>
              {length(item.meters, units)}
            </Text>
            <View
              style={{
                width: "100%",
                maxWidth: 32,
                height: 70,
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  height:
                    item.meters > 0 ? Math.max(3, (item.meters / max) * 70) : 0,
                  backgroundColor: c.forest,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: readable ? 11 : 10,
                color: c.muted,
                paddingBottom: 8,
              }}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </View>
      {goalKm !== undefined ? (
        <View style={{ gap: 9 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text style={{ color: c.muted, fontSize: 11 }}>
              Weekly distance goal
            </Text>
            <Text style={{ color: c.forest, fontWeight: "600", fontSize: 11 }}>
              {length(weekMeters, units)} / {length(goalKm * 1000, units)}{" "}
              {units}
            </Text>
          </View>
          <View
            accessibilityRole="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            accessibilityLabel="Weekly distance goal"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }}
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: c.raised,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${progress}%`,
                height: 6,
                backgroundColor: c.forest,
                borderRadius: 3,
              }}
            />
          </View>
        </View>
      ) : null}
      {!items.some((i) => i.count > 0) ? (
        <Text style={{ color: c.muted, fontSize: 11 }}>
          Your next outing starts the story.
        </Text>
      ) : null}
    </TrainingPanel>
  );
}
export function TrainingActivityCard({
  workout: w,
  units,
  readable = false,
}: {
  workout: Workout;
  units: "km" | "mi";
  readable?: boolean;
}) {
  const c = useColors(),
    s = useMemo(() => stats(w), [w]);
  const altitudeKnown = waypointElevation(w.points) !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${w.title}`}
      onPress={() => router.push(`/activity/${w.id}`)}
      style={({ pressed }) => ({
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 14,
        padding: 15,
        gap: 14,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            backgroundColor: w.sport === "cycling" ? c.blueSoft : c.greenSoft,
            borderRadius: 12,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name={sportIcons[w.sport]}
            color={w.sport === "cycling" ? c.blue : c.forest}
            size={22}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              color: c.text,
              fontWeight: "700",
              fontSize: readable ? 17 : 16,
            }}
          >
            {w.title}
          </Text>
          <Text style={{ fontSize: readable ? 12 : 10, color: c.muted }}>
            {sportNames[w.sport]} ·{" "}
            {new Date(w.startedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        </View>
        <Ionicons
          name={
            w.visibility === "private"
              ? "lock-closed-outline"
              : w.visibility === "followers"
                ? "people-outline"
                : "globe-outline"
          }
          accessibilityLabel={`${w.visibility} activity`}
          color={c.muted}
          size={15}
        />
      </View>
      {w.points.length > 1 ? (
        <RoutePreview points={w.points} />
      ) : (
        <View
          style={{
            padding: 13,
            backgroundColor: c.raised,
            borderRadius: 9,
            flexDirection: "row",
            gap: 7,
          }}
        >
          <Ionicons name="location-outline" size={15} color={c.muted} />
          <Text style={{ fontSize: 11, color: c.muted }}>
            No recorded route
          </Text>
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {[
          [`${length(s.meters, units)} ${units}`, "Distance"],
          [duration(s.movingMs), "Moving time"],
          [pace(s.pace, units), `Pace /${units}`],
          [altitudeKnown ? `${Math.round(s.elevation)} m` : "—", "Elevation"],
        ].map(([value, label]) => (
          <View key={label} style={{ flexGrow: 1, minWidth: 60, gap: 4 }}>
            <Text
              style={{
                color: c.text,
                fontSize: readable ? 16 : 15,
                fontWeight: "700",
              }}
            >
              {value}
            </Text>
            <Text style={{ color: c.muted, fontSize: readable ? 11 : 10 }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
export function AthleteRecords({
  workouts,
  units,
}: {
  workouts: Workout[];
  units: "km" | "mi";
}) {
  const c = useColors();
  const { longest, fastestRun } = useMemo(
    () => personalRecords(workouts),
    [workouts],
  );
  return (
    <TrainingPanel>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="trophy-outline" size={20} color={c.accent} />
        <Text
          accessibilityRole="header"
          style={{ color: c.text, fontSize: 16, fontWeight: "700" }}
        >
          Personal bests
        </Text>
      </View>
      {longest ? (
        <>
          <TrainingLink
            title="Longest activity"
            detail={`${length(longest.meters, units)} ${units} · ${longest.workout.title}`}
            icon="navigate-outline"
            onPress={() => router.push(`/activity/${longest.workout.id}`)}
          />
          {fastestRun ? (
            <TrainingLink
              title="Best average run pace"
              detail={`${pace(fastestRun.pace, units)} /${units} · runs of at least 1 ${"km"}`}
              icon="speedometer-outline"
              onPress={() => router.push(`/activity/${fastestRun.workout.id}`)}
            />
          ) : null}
          <Text style={{ color: c.muted, fontSize: 10 }}>
            Whole activities recorded on this device · not race records.
          </Text>
        </>
      ) : (
        <>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>
            Your best is still ahead.
          </Text>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
            Finish an activity with recorded distance to unlock your personal
            bests.
          </Text>
        </>
      )}
    </TrainingPanel>
  );
}
export function TrainingLink({
  title,
  detail,
  icon,
  onPress,
}: {
  title: string;
  detail: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 52,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: c.greenSoft,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={c.forest} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>
          {title}
        </Text>
        <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>
          {detail}
        </Text>
      </View>
      <Ionicons name="chevron-forward" color={c.muted} size={15} />
    </Pressable>
  );
}

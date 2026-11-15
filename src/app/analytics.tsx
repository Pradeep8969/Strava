import { useCallback, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AthletePage, AthleteText as Text } from "../../components/athlete";
import {
  AthleteRecords,
  TrainingPanel,
  sportNames,
  sportIcons,
} from "../../components/athlete-training";
import { DiscoveryTitle } from "../../components/discovery-ui";
import { CommunityAction } from "../../components/community-ui";
import {
  DashboardHeader,
  DashboardMetric,
  DashboardTabs,
  DataBarChart,
  DataLineChart,
} from "../../components/dashboard-ui";
import { Loading, useColors } from "../../components/ui";
import {
  analyticsSnapshot,
  athleteWorkouts,
  earnedMilestones,
  type AnalyticsPeriod,
  type AnalyticsSport,
} from "../../features/analytics/dashboard";
import { useSession } from "../../hooks/useSession";
import { useApp } from "../../store/app";
import { duration, length, pace } from "../../utils/format";

export default function Analytics() {
  const { workouts, preferences: p, ready, error } = useApp();
  const c = useColors(),
    session = useSession();
  const width = useWindowDimensions().width,
    wide = width >= 1100,
    tablet = width >= 700;
  const [period, setPeriod] = useState<AnalyticsPeriod>("Week");
  const [sportLabel, setSportLabel] = useState("All sports");
  const [metric, setMetric] = useState("Distance");
  const [now, setNow] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      return useApp.subscribe((next, old) => {
        if (next.workouts !== old.workouts) setNow(Date.now());
      });
    }, []),
  );
  const own = useMemo(
    () => athleteWorkouts(workouts, session?.user.id, now),
    [workouts, session?.user.id, now],
  );
  const sport: AnalyticsSport =
    sportLabel === "All sports"
      ? "all"
      : (sportLabel.toLowerCase() as AnalyticsSport);
  const summary = useMemo(
    () => analyticsSnapshot(own, period, sport, now),
    [own, period, sport, now],
  );
  const week = useMemo(
    () => analyticsSnapshot(own, "Week", "all", now),
    [own, now],
  );
  const records = useMemo(
    () => own.filter((w) => sport === "all" || w.sport === sport),
    [own, sport],
  );
  const milestones = useMemo(() => earnedMilestones(own), [own]);
  const goal = Math.max(1, p.weeklyGoalKm * 1000),
    percent = Math.min(100, (week.meters / goal) * 100);
  const formatValue = (value: number) =>
    metric === "Distance"
      ? length(value, p.units)
      : metric === "Time"
        ? `${Math.round(value / 60000)}m`
        : String(value);
  const chartData = summary.buckets.map((b) => ({
    label: b.label,
    value:
      metric === "Distance"
        ? b.meters
        : metric === "Time"
          ? b.movingMs
          : b.count,
  }));
  return (
    <AthletePage>
      <DashboardHeader
        title="Your training insights"
        subtitle="Train. Reflect. Find your rhythm."
        action={{
          icon: "diamond-outline",
          label: "Explore StravaKinda Plus",
          onPress: () => router.push("/subscription"),
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Ionicons name="analytics-outline" size={16} color={c.forest} />
        <Text style={{ color: c.muted, fontSize: 11 }}>
          Your real workouts. A clearer perspective.
        </Text>
      </View>
      <DashboardTabs
        items={["Week", "Month", "Year"] as const}
        value={period}
        onChange={setPeriod}
        label="Analytics period"
      />
      <DashboardTabs
        items={["All sports", "Running", "Walking", "Cycling", "Hiking"]}
        value={sportLabel}
        onChange={setSportLabel}
        label="Analytics sport"
      />
      {!ready ? (
        <Loading />
      ) : (
        <View style={{ gap: 12 }}>
          {Array.from({ length: tablet ? 1 : 2 }, (_, row) => (
            <View key={row} style={{ flexDirection: "row", gap: 12 }}>
              {(tablet ? [0, 1, 2, 3] : [row * 2, row * 2 + 1]).map((i) => (
                <DashboardMetric
                  key={i}
                  icon={
                    (
                      [
                        "navigate-outline",
                        "time-outline",
                        "fitness-outline",
                        "calendar-outline",
                      ] as const
                    )[i]
                  }
                  label={
                    [
                      `Distance · ${p.units}`,
                      "Moving time",
                      "Activities",
                      "Active days",
                    ][i]
                  }
                  value={
                    [
                      length(summary.meters, p.units),
                      duration(summary.movingMs),
                      String(summary.count),
                      String(summary.activeDays),
                    ][i]
                  }
                  detail={
                    i === 3
                      ? `of ${summary.elapsedDays} days so far`
                      : `This ${period.toLowerCase()} · recorded`
                  }
                  testID={`analytics-total-${i}`}
                />
              ))}
            </View>
          ))}
        </View>
      )}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.accent, fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: wide ? 1.45 : undefined, minWidth: 0, gap: 18 }}>
          <TrainingPanel>
            <DiscoveryTitle
              title="Your progress"
              detail={`${period === "Week" ? "Daily" : period === "Month" ? "Seven-day groups" : "Monthly"} totals · ${new Date(summary.start).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
            />
            <DashboardTabs
              items={["Distance", "Time", "Activities"]}
              value={metric}
              onChange={setMetric}
              label="Chart metric"
            />
            <DataBarChart
              data={chartData}
              formatValue={formatValue}
              label={`${period} ${metric.toLowerCase()} chart`}
              highlightIndex={summary.buckets.findIndex(
                (b) => b.start <= now && b.end > now,
              )}
            />
            <Text style={{ color: c.muted, fontSize: 10, lineHeight: 17 }}>
              Completed activities on this device. Time shows moving minutes;
              future dates contribute no activity.
            </Text>
          </TrainingPanel>
          <TrainingPanel>
            <DiscoveryTitle
              title="Sport breakdown"
              detail={`This ${period.toLowerCase()} · ${sportLabel.toLowerCase()}`}
            />
            {summary.sports.map((s) => (
              <View key={s.sport} style={{ gap: 9 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 35,
                      height: 35,
                      borderRadius: 10,
                      backgroundColor: c.greenSoft,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name={sportIcons[s.sport]}
                      color={c.forest}
                      size={20}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{ color: c.text, fontSize: 13, fontWeight: "600" }}
                    >
                      {sportNames[s.sport]}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 10 }}>
                      {s.count} {s.count === 1 ? "activity" : "activities"} ·{" "}
                      {duration(s.movingMs)}
                    </Text>
                  </View>
                  <Text
                    style={{ color: c.text, fontSize: 14, fontWeight: "700" }}
                  >
                    {length(s.meters, p.units)} {p.units}
                  </Text>
                </View>
                <View
                  style={{
                    marginLeft: 45,
                    height: 4,
                    backgroundColor: c.raised,
                    borderRadius: 2,
                  }}
                >
                  <View
                    style={{
                      width: `${summary.meters > 0 ? (s.meters / summary.meters) * 100 : 0}%`,
                      backgroundColor: c.forest,
                      height: 4,
                      borderRadius: 2,
                    }}
                  />
                </View>
              </View>
            ))}
          </TrainingPanel>
        </View>
        <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 18 }}>
          <View
            style={{
              backgroundColor: "#142431",
              borderRadius: 14,
              padding: 18,
              gap: 15,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                accessibilityRole="header"
                style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "700" }}
              >
                Distance trend
              </Text>
              <Ionicons name="pulse-outline" color="#8DDDBF" size={22} />
            </View>
            <Text style={{ color: "#B9CCD5", fontSize: 11 }}>
              Recorded distance, not a fitness score
            </Text>
            <DataLineChart
              data={summary.buckets
                .filter((b) => b.start <= now)
                .map((b) => ({
                  label: b.label,
                  value: b.meters,
                }))}
              label={`${period} recorded distance trend`}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <View style={{ gap: 5 }}>
                <Text
                  style={{ color: "#8DDDBF", fontSize: 22, fontWeight: "700" }}
                >
                  {length(summary.meters, p.units)} {p.units}
                </Text>
                <Text style={{ color: "#B9CCD5", fontSize: 10 }}>
                  Selected period
                </Text>
              </View>
              <View style={{ gap: 5 }}>
                <Text
                  style={{ color: "#FF936E", fontSize: 22, fontWeight: "700" }}
                >
                  {summary.activeDays}
                </Text>
                <Text style={{ color: "#B9CCD5", fontSize: 10 }}>
                  Days with activity
                </Text>
              </View>
            </View>
          </View>
          <TrainingPanel>
            <DiscoveryTitle
              title="Keep showing up"
              detail="Weekly distance goal · all sports"
            />
            <Text style={{ color: c.text, fontSize: 23, fontWeight: "700" }}>
              {length(week.meters, p.units)}{" "}
              <Text style={{ color: c.muted, fontSize: 12 }}>
                / {length(goal, p.units)} {p.units}
              </Text>
            </Text>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Analytics weekly goal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percent)}
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(percent),
              }}
              style={{
                height: 7,
                borderRadius: 4,
                backgroundColor: c.raised,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${percent}%`,
                  height: 7,
                  backgroundColor: c.forest,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text style={{ color: c.muted, fontSize: 11, lineHeight: 18 }}>
              {week.activeDays} active {week.activeDays === 1 ? "day" : "days"}{" "}
              this week. Every outing counts.
            </Text>
            <CommunityAction
              secondary
              title="Adjust weekly goal"
              onPress={() => router.push("/settings")}
            />
          </TrainingPanel>
          <TrainingPanel>
            <DiscoveryTitle title="Measured insights" />
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{ color: c.text, fontSize: 23, fontWeight: "700" }}
                >
                  {pace(summary.pace, p.units)}
                </Text>
                <Text style={{ color: c.muted, fontSize: 10 }}>
                  Average moving pace /{p.units}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{ color: c.text, fontSize: 23, fontWeight: "700" }}
                >
                  {summary.elevation === null
                    ? "—"
                    : `${Math.round(summary.elevation)} m`}
                </Text>
                <Text style={{ color: c.muted, fontSize: 10 }}>
                  Measured ascent
                </Text>
              </View>
            </View>
            <Text style={{ color: c.muted, fontSize: 10, lineHeight: 17 }}>
              {summary.altitudeCount
                ? `${summary.altitudeCount} activities with reliable altitude pairs.`
                : "Elevation unavailable without reliable recorded altitude."}
            </Text>
          </TrainingPanel>
        </View>
      </View>
      <View style={{ flexDirection: tablet ? "row" : "column", gap: 20 }}>
        <View style={{ flex: tablet ? 1 : undefined, minWidth: 0 }}>
          <AthleteRecords workouts={records} units={p.units} />
        </View>
        <View style={{ flex: tablet ? 1 : undefined, minWidth: 0 }}>
          <TrainingPanel>
            <DiscoveryTitle
              title="Earned through movement"
              detail="All-time milestones · actual completed activities"
            />
            {milestones.map((m) => (
              <View
                key={m.id}
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <Ionicons
                  name={m.earned ? "ribbon" : "lock-closed-outline"}
                  size={23}
                  color={m.earned ? c.accent : c.muted}
                />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text
                    style={{ color: c.text, fontSize: 13, fontWeight: "600" }}
                  >
                    {m.title}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 11 }}>
                    {m.detail}
                  </Text>
                </View>
                <Text
                  style={{ color: m.earned ? c.forest : c.muted, fontSize: 10 }}
                >
                  {m.earned ? "Earned" : "Not yet"}
                </Text>
              </View>
            ))}
          </TrainingPanel>
        </View>
      </View>
      <TrainingPanel>
        <DiscoveryTitle
          title="Advanced analysis"
          detail="No estimates without the right data."
        />
        <View style={{ flexDirection: tablet ? "row" : "column", gap: 14 }}>
          {[
            [
              "Heart rate & power",
              "Sensor data is not available in your workout model.",
            ],
            [
              "VO₂ max & training load",
              "Unavailable · requires validated sensor processing.",
            ],
            [
              "Personal heatmaps & plans",
              "Planned · privacy-safe analysis and structured training.",
            ],
          ].map(([title, detail]) => (
            <View
              key={title}
              style={{
                flex: tablet ? 1 : undefined,
                backgroundColor: c.raised,
                padding: 14,
                borderRadius: 10,
                gap: 9,
              }}
            >
              <Ionicons name="lock-closed-outline" color={c.muted} size={18} />
              <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>
                {title}
              </Text>
              <Text style={{ color: c.muted, fontSize: 11, lineHeight: 18 }}>
                {detail}
              </Text>
            </View>
          ))}
        </View>
        <CommunityAction
          title="Explore StravaKinda Plus"
          onPress={() => router.push("/subscription")}
        />
      </TrainingPanel>
      <TrainingPanel>
        <DiscoveryTitle
          title="Bring people to the starting line."
          detail="Organizer studio · preview workspace"
        />
        <CommunityAction
          secondary
          title="Open organizer preview"
          onPress={() => router.push("/organizer")}
        />
      </TrainingPanel>
    </AthletePage>
  );
}

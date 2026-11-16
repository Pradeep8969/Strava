import { browserRecordingIssue } from "../../../features/recording/browser";
import {
  useGpsAcquisition,
  WaitingForGpsError,
} from "../../../features/recording/acquisition";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AthletePage,
  AthleteText as Text,
  IconButton,
} from "../../../components/athlete";
import TrackMap from "../../../components/RecorderMap";
import { useApp } from "../../../store/app";
import { useSession } from "../../../hooks/useSession";
import { canAccessLocalWorkout } from "../../../features/auth/local-access";
import { Empty } from "../../../components/ui";
import { useAction } from "../../../hooks/useAction";
import {
  startWorkout,
  pauseWorkout,
  resumeWorkout,
  finishWorkout,
  discardWorkout,
  enableBackground,
} from "../../../services/recorder";
import { activeTime, stats } from "../../../utils/tracking";
import { duration, length, pace } from "../../../utils/format";
import type { Sport } from "../../../types/activity";

const sports = [
  { value: "running", label: "Running", icon: "walk-outline" },
  { value: "cycling", label: "Cycling", icon: "bicycle-outline" },
  { value: "walking", label: "Walking", icon: "footsteps-outline" },
  { value: "hiking", label: "Hiking", icon: "trail-sign-outline" },
] as const;
export default function Record() {
  const { workouts, preferences: p, error, ready } = useApp();
  const webIssue = Platform.OS === "web" ? browserRecordingIssue() : null;
  const acquisition = useGpsAcquisition();
  const session = useSession(),
    action = useAction();
  const wide = useWindowDimensions().width >= 1100;
  const [sport, setSport] = useState<Sport>("running");
  const [view, setView] = useState<"Metrics" | "Map">("Metrics");
  const [now, setNow] = useState(() => Date.now());
  const w = workouts.find((item) => item.state !== "finished");
  const unfinishedId = w?.id;
  useEffect(() => {
    if (!unfinishedId) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [unfinishedId]);
  // Geometry changes with the workout, not with every elapsed-time tick.
  const measured = useMemo(() => (w ? stats(w, w.startedAt) : null), [w]);
  const s =
    w && measured
      ? {
          ...measured,
          activeMs: activeTime(w, w.endedAt ?? now),
          elapsedMs: (w.endedAt ?? now) - w.startedAt,
        }
      : null;
  const last = w?.points.at(-1);
  const signal =
    !!last && w?.state === "recording" && now - last.timestamp <= 15000;
  const status =
    webIssue ??
    (Platform.OS === "web" &&
    (acquisition.state === "acquiring" || acquisition.state === "waiting")
      ? "Waiting for accurate GPS"
      : !w
        ? "Ready to record"
        : w.state === "paused"
          ? "Recording paused"
          : signal
            ? "GPS signal received"
            : "Waiting for GPS");
  const currentSport = w?.sport ?? sport;
  const elevation = useMemo(
    () =>
      w?.points.some((point, index) => {
        const previous = w.points[index - 1];
        return (
          previous &&
          previous.segment === point.segment &&
          point.timestamp - previous.timestamp <= 60000 &&
          [previous, point].every(
            (fix) =>
              fix.altitude !== null &&
              fix.altitudeAccuracy !== null &&
              fix.altitudeAccuracy <= 10,
          )
        );
      }),
    [w],
  );
  const acquire = async () => {
    try {
      if (w) await resumeWorkout(w.id);
      else await startWorkout(sport, session?.user.id);
    } catch (error) {
      // Low quality fixes are expected acquisition feedback, not a recording error.
      if (!(error instanceof WaitingForGpsError)) throw error;
    }
  };
  const start = () => void action.run(acquire);
  const toggle = () => {
    if (!w) return start();
    void action.run(() =>
      w.state === "recording" ? pauseWorkout(w.id) : acquire(),
    );
  };
  const mainLabel = !w
    ? `Start ${sport} activity`
    : w.state === "recording"
      ? "Pause activity"
      : "Resume activity";
  const map = (
    <View style={{ gap: 12 }}>
      <TrackMap points={w?.points ?? []} current={!!w} />
      {w ? (
        <Text style={{ color: "#AEBCC4", fontSize: 13, lineHeight: 19 }}>
          {w.points.length} accepted GPS fixes · {w.rejected} rejected
        </Text>
      ) : null}
    </View>
  );
  if (w && !canAccessLocalWorkout(w, session?.user.id))
    return (
      <AthletePage dark>
        <Empty
          title="Recording belongs to another account"
          detail="Sign in to that account to continue. The recording and its GPS data have not been discarded."
        />
        <IconButton
          icon="person-outline"
          label="Open recording account"
          onPress={() => router.push("/profile")}
        />
      </AthletePage>
    );
  return (
    <AthletePage dark>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton
          dark
          icon="chevron-back"
          label="Back to Home"
          onPress={() => router.push("/")}
        />
        <Text
          accessibilityRole="header"
          style={{ color: "white", fontSize: 18, fontWeight: "600" }}
        >
          Record activity
        </Text>
        <View style={{ width: 48, height: 48 }} />
      </View>
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: wide ? 0.85 : 1, minWidth: 0, gap: 16 }}>
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              backgroundColor: "#202D34",
              padding: 4,
              borderRadius: 11,
            }}
          >
            {sports.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{
                  selected: currentSport === item.value,
                  disabled: !!w || action.busy,
                }}
                disabled={!!w || action.busy}
                onPress={() => setSport(item.value)}
                style={{
                  flex: 1,
                  minHeight: 56,
                  borderRadius: 8,
                  backgroundColor:
                    currentSport === item.value ? "#374750" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={currentSport === item.value ? "#FFFFFF" : "#98A9B3"}
                />
                <Text
                  style={{
                    color: currentSport === item.value ? "white" : "#98A9B3",
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {view === "Map" && !wide ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: "#B2C4CD", fontSize: 13 }}>{status}</Text>
              {map}
            </View>
          ) : (
            <View
              style={{
                alignItems: "center",
                gap: 16,
                paddingVertical: 12,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <Ionicons
                  name={signal ? "locate" : "locate-outline"}
                  size={15}
                  color={signal ? "#61D49D" : "#A4B5BE"}
                />
                <Text
                  style={{
                    color: signal ? "#61D49D" : "#A4B5BE",
                    fontSize: 13,
                  }}
                >
                  {status}
                </Text>
              </View>
              <View style={{ alignItems: "center", gap: 5 }}>
                <Text
                  testID="record-active-time"
                  style={{
                    color: "white",
                    fontSize: wide ? 66 : 54,
                    fontWeight: "600",
                    letterSpacing: -2,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {duration(s?.activeMs ?? 0)}
                </Text>
                <Text style={{ color: "#A4B5BE", fontSize: 11 }}>
                  Active time
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-evenly",
                  gap: 16,
                }}
              >
                <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                  <Text
                    testID="record-distance"
                    style={{
                      color: "white",
                      fontSize: 48,
                      fontWeight: "600",
                      letterSpacing: -2,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {length(s?.meters ?? 0, p.units)}
                  </Text>
                  <Text style={{ color: "#C7D2D8", fontSize: 13 }}>
                    {p.units === "km" ? "Kilometres" : "Miles"}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                  <Text
                    style={{
                      color: "white",
                      fontSize: 38,
                      fontWeight: "600",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {pace(s?.pace ?? null, p.units)}
                  </Text>
                  <Text style={{ color: "#A4B5BE", fontSize: 11 }}>
                    Avg. pace /{p.units}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  width: "100%",
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: "#33434C",
                }}
              >
                <RecordMetric
                  value={
                    s && s.movingMs > 0
                      ? (
                          s.meters /
                          (p.units === "mi" ? 1609.344 : 1000) /
                          (s.movingMs / 3600000)
                        ).toFixed(1)
                      : "—"
                  }
                  label={`Speed ${p.units}/h`}
                />
                <RecordMetric
                  value={elevation && s ? String(Math.round(s.elevation)) : "—"}
                  label="Elevation gain m"
                />
              </View>
            </View>
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 26,
              paddingTop: 8,
              paddingBottom: 4,
            }}
          >
            <IconButton
              dark
              icon="map-outline"
              label={
                wide
                  ? "Open route studio"
                  : view === "Map"
                    ? "Show metrics"
                    : "Show map"
              }
              onPress={() =>
                wide
                  ? router.push("/routes")
                  : setView(view === "Map" ? "Metrics" : "Map")
              }
            />
            <View style={{ alignItems: "center", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={mainLabel}
                accessibilityState={{
                  disabled:
                    action.busy ||
                    !ready ||
                    (w?.state !== "recording" && !!webIssue),
                }}
                disabled={
                  action.busy ||
                  !ready ||
                  (w?.state !== "recording" && !!webIssue)
                }
                onPress={toggle}
                style={({ pressed }) => ({
                  width: wide ? 128 : 104,
                  height: 60,
                  borderRadius: 18,
                  backgroundColor: webIssue ? "#B84C32" : "#FF5B32",
                  borderWidth: 5,
                  borderColor: "#493A35",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Ionicons
                  name={w?.state === "recording" ? "pause" : "play"}
                  color="white"
                  size={30}
                />
              </Pressable>
              <Text
                style={{ color: "#CED8DD", fontSize: 13, fontWeight: "700" }}
              >
                {!w ? "START" : w.state === "recording" ? "PAUSE" : "RESUME"}
              </Text>
            </View>
            <View style={{ alignItems: "center", gap: 8 }}>
              <IconButton
                dark
                icon={w ? "stop" : "shield-checkmark-outline"}
                disabled={action.busy}
                label={w ? "Finish & save" : "Privacy settings"}
                style={
                  w
                    ? {
                        width: 60,
                        height: 60,
                        borderRadius: 18,
                        backgroundColor: "#304750",
                      }
                    : undefined
                }
                onPress={() => {
                  if (w) {
                    if (!action.busy)
                      void action.run(
                        () => finishWorkout(w.id),
                        "Activity saved. Find it in Activities.",
                      );
                  } else router.push("/settings");
                }}
              />
              {w ? (
                <Text
                  style={{ color: "#CED8DD", fontSize: 12, fontWeight: "700" }}
                >
                  FINISH
                </Text>
              ) : null}
            </View>
          </View>
          <Text
            style={{
              color: "#9BAEB9",
              fontSize: 13,
              textAlign: "center",
              lineHeight: 17,
            }}
          >
            {action.busy && !w
              ? "Requesting location permission and waiting for GPS..."
              : w
                ? `Moving ${duration(s!.movingMs)} · Elapsed ${duration(s!.elapsedMs)}`
                : `${p.defaultVisibility.charAt(0).toUpperCase() + p.defaultVisibility.slice(1)} visibility · Saved on this device`}
          </Text>
          {Platform.OS === "web" &&
          (acquisition.state === "acquiring" ||
            acquisition.state === "waiting" ||
            acquisition.state === "error") ? (
            <View style={{ gap: 8 }}>
              {acquisition.detail ? (
                <Text
                  style={{ color: "#CED8DD", fontSize: 13, lineHeight: 20 }}
                >
                  {acquisition.detail}
                </Text>
              ) : null}
              {acquisition.state !== "acquiring" ? (
                <TextButton
                  label="Retry GPS"
                  disabled={action.busy}
                  onPress={() => void action.run(acquire)}
                />
              ) : null}
            </View>
          ) : null}
          {action.message || error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: "#FFB39A", fontSize: 13, lineHeight: 20 }}
            >
              {action.message || error}
            </Text>
          ) : null}
        </View>
        {wide ? (
          <View
            style={{
              flex: 1.35,
              minWidth: 0,
              gap: 16,
              padding: 18,
              backgroundColor: "#202D34",
              borderRadius: 16,
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
              Your route
            </Text>
            {map}
            <SessionNotes recording={!!w} />
          </View>
        ) : null}
      </View>
      {w ? (
        <View
          style={{
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: "#33434C",
            paddingTop: 16,
          }}
        >
          {Platform.OS !== "web" ? (
            <TextButton
              label="Enable background recording"
              disabled={action.busy}
              onPress={() =>
                void action.run(
                  () => enableBackground(w.id),
                  "Background tracking enabled. OS battery limits still apply; force termination may stop recording.",
                )
              }
            />
          ) : null}
          <TextButton
            label="Discard workout"
            disabled={action.busy}
            onPress={() => {
              if (Platform.OS === "web") {
                if (
                  window.confirm(
                    "Discard this unfinished workout from this device?",
                  )
                )
                  void action.run(() => discardWorkout(w.id));
                return;
              }
              Alert.alert(
                "Discard workout?",
                "This deletes the unfinished recording from this device.",
                [
                  { text: "Keep", style: "cancel" },
                  {
                    text: "Discard",
                    style: "destructive",
                    onPress: () => void action.run(() => discardWorkout(w.id)),
                  },
                ],
              );
            }}
          />
        </View>
      ) : null}
      {!wide ? <SessionNotes recording={!!w} /> : null}
    </AthletePage>
  );
}
function RecordMetric({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
      <Text
        style={{
          color: "white",
          fontSize: 24,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text style={{ color: "#A4B5BE", fontSize: 12, textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );
}
function SessionNotes({ recording }: { recording: boolean }) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: "#33434C",
        paddingTop: 17,
        gap: 7,
      }}
    >
      <Text style={{ color: "#E3EAEE", fontSize: 13, fontWeight: "600" }}>
        {recording ? "Your session, safely saved" : "Before you head out"}
      </Text>
      <Text style={{ color: "#B2C4CD", fontSize: 13, lineHeight: 20 }}>
        {Platform.OS === "web"
          ? "Browser recording is foreground-only. Keep this page visible; resume after interruptions. Workouts are saved on this device. Clearing site data removes unsynced recordings."
          : "Location permission is required. Foreground recording pauses when you leave the app. Background recording needs an installed development build and uses more battery. Offline base maps are not available."}
      </Text>
    </View>
  );
}
function TextButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: "#D5E0E6", fontSize: 12, textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
}

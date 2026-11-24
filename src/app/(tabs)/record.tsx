import { browserRecordingIssue } from "../../../features/recording/browser";
import { GPS_GAP_MS } from "../../../features/recording/native-gps";
import {
  useGpsAcquisition,
  useGpsDiagnostics,
  WaitingForGpsError,
} from "../../../features/recording/acquisition";
import { memo, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AthletePage,
  AthleteText as Text,
  IconButton,
} from "../../../components/athlete";
import TrackMap from "../../../components/RecorderMap";
import { mutateWorkout, useApp } from "../../../store/app";
import { useSession } from "../../../hooks/useSession";
import { useRouteLibrary } from "../../../hooks/useRouteLibrary";
import {
  findRouteGuide,
  guideSports,
  parseRouteGuide,
} from "../../../features/routes/guide";
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
import type { Sport, Workout } from "../../../types/activity";

const emptyTrack: Workout["points"] = [];
const RecordingMap = Platform.OS === "android" ? memo(TrackMap) : TrackMap;

const sports = [
  { value: "running", label: "Running", icon: "walk-outline" },
  { value: "cycling", label: "Cycling", icon: "bicycle-outline" },
  { value: "walking", label: "Walking", icon: "footsteps-outline" },
  { value: "hiking", label: "Hiking", icon: "trail-sign-outline" },
] as const;
function useRecordingMetrics(w: Workout | undefined) {
  // Geometry changes with the workout, not with every elapsed-time tick.
  const measured = useMemo(() => (w ? stats(w, w.startedAt) : null), [w]);
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
  return { measured, elevation };
}

export default function Record() {
  const { workouts, preferences: p, error, ready } = useApp();
  const webIssue = Platform.OS === "web" ? browserRecordingIssue() : null;
  const acquisition = useGpsAcquisition();
  const diagnostics = useGpsDiagnostics();
  const session = useSession(),
    action = useAction();
  const wide = useWindowDimensions().width >= 1100;
  const params = useLocalSearchParams<{ guide?: string; sport?: string }>();
  const [sportChoice, setSportChoice] = useState<{
    key: string;
    sport: Sport;
  }>();
  const [viewChoice, setViewChoice] = useState<{
    key: string;
    view: "Metrics" | "Map";
  }>();
  const [now, setNow] = useState(() => Date.now());
  const w = workouts.find((item) => item.state !== "finished");
  const requestedGuide = parseRouteGuide(params.guide);
  const guideId = w?.routeGuide?.id;
  const guideScope = w?.routeGuide?.scope;
  const reference = w
    ? guideId && guideScope
      ? { id: guideId, scope: guideScope }
      : undefined
    : requestedGuide;
  const { plans, settled } = useRouteLibrary(!!reference);
  const guide = findRouteGuide(plans, reference, session?.user.id);
  const selectionKey = JSON.stringify([
    w?.id,
    params.guide,
    params.sport,
    reference?.id,
  ]);
  const sport =
    sportChoice?.key === selectionKey
      ? sportChoice.sport
      : (requestedGuide &&
          guideSports.find((item) => item.value === params.sport)?.value) ||
        "running";
  const view =
    viewChoice?.key === selectionKey
      ? viewChoice.view
      : guide
        ? "Map"
        : "Metrics";
  const clearGuideParams = () =>
    router.setParams({ guide: undefined, sport: undefined });
  const guideWorkoutId = guideId ? w?.id : undefined;
  const exitGuide = () =>
    void action.run(async () => {
      if (guideWorkoutId)
        await mutateWorkout(guideWorkoutId, (current) => ({
          ...current,
          routeGuide: undefined,
        }));
      clearGuideParams();
    });
  const unfinishedId = w?.id;
  useEffect(() => {
    if (!unfinishedId) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [unfinishedId]);
  const { measured, elevation } = useRecordingMetrics(w);
  const s =
    w && measured
      ? {
          ...measured,
          activeMs: activeTime(w, w.endedAt ?? now),
          elapsedMs: (w.endedAt ?? now) - w.startedAt,
        }
      : null;
  const last = w?.points.at(-1);
  const isWeb = Platform.OS === "web";
  const fixAt = isWeb ? last?.timestamp : w?.gpsFixAt;
  const signal =
    fixAt != null && w?.state === "recording" && now - fixAt <= GPS_GAP_MS;
  const waitingForNativeGps = !isWeb && w?.state === "recording" && !signal;
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
            : waitingForNativeGps && fixAt != null
              ? "GPS signal lost. Reacquiring"
              : "Waiting for GPS");
  const currentSport = w?.sport ?? sport;
  const cycling = currentSport === "cycling";
  const movingPace = s?.movingPace ?? null;
  const movingSpeed =
    s && s.movingMs > 0
      ? (
          s.movingMeters /
          (p.units === "mi" ? 1609.344 : 1000) /
          (s.movingMs / 3600000)
        ).toFixed(1)
      : "—";
  const shortDistance =
    !isWeb &&
    s &&
    s.meters > 0 &&
    s.meters < (p.units === "mi" ? 16.09344 : 10);
  const acquire = async () => {
    try {
      if (w) await resumeWorkout(w.id);
      else
        await startWorkout(
          sport,
          session?.user.id,
          guide || !settled ? reference : undefined,
        );
    } catch (error) {
      // Low quality fixes are expected acquisition feedback, not a recording error.
      if (!(error instanceof WaitingForGpsError)) throw error;
    }
  };
  const androidMapBelowControls =
    Platform.OS === "android" && view === "Map" && !wide;
  const controlsDisabled =
    action.busy || !ready || (w?.state !== "recording" && !!webIssue);
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
      <RecordingMap
        points={w?.points ?? emptyTrack}
        current={!!w}
        guide={guide}
      />
      {w ? (
        <Text style={{ color: "#AEBCC4", fontSize: 13, lineHeight: 19 }}>
          {w.points.length} recorded track points · {w.rejected} rejected fixes
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
          {guide || reference || params.guide !== undefined ? (
            <View style={{ gap: 6 }}>
              <Text
                style={{ color: "#CED8DD" }}
                accessibilityLiveRegion="polite"
              >
                {guide
                  ? `Following ${guide.title} · Teal planned route (straight-line) · Orange recorded GPS`
                  : w && !reference
                    ? "Finish or discard the current activity before starting a guided activity."
                    : reference && !settled
                      ? "Loading saved route…"
                      : "Saved route unavailable. You can record without a guide."}
              </Text>
              {__DEV__ && !isWeb ? (
                <Text style={{ color: "#CED8DD", fontSize: 12 }}>
                  Guide reference received: {reference ? "yes" : "no"} ·
                  Storage:{" "}
                  {guide
                    ? "resolved"
                    : reference && !settled
                      ? "loading"
                      : "unavailable"}{" "}
                  · Waypoints: {guide?.points.length ?? 0} · Geometry lines:{" "}
                  {guide && guide.points.length >= 2 ? 1 : 0}
                </Text>
              ) : null}
              <TextButton
                label="Exit route guide"
                disabled={action.busy}
                onPress={exitGuide}
              />
            </View>
          ) : null}
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
                onPress={() =>
                  setSportChoice({ key: selectionKey, sport: item.value })
                }
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
          {action.message ||
          error ||
          (!isWeb && w?.state === "paused" && acquisition.state === "error") ? (
            <Text
              accessibilityRole="alert"
              style={{ color: "#FFB39A", fontSize: 13, lineHeight: 20 }}
            >
              {action.message || error || acquisition.detail}
            </Text>
          ) : null}
          {androidMapBelowControls ? null : view === "Map" && !wide ? (
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
                  {isWeb ? "Active time" : "GPS-tracked time"}
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
                    {shortDistance
                      ? s.meters.toFixed(1)
                      : length(s?.meters ?? 0, p.units)}
                  </Text>
                  <Text style={{ color: "#C7D2D8", fontSize: 13 }}>
                    {shortDistance
                      ? "Metres"
                      : p.units === "km"
                        ? "Kilometres"
                        : "Miles"}
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
                    {cycling ? movingSpeed : pace(movingPace, p.units)}
                  </Text>
                  <Text style={{ color: "#A4B5BE", fontSize: 11 }}>
                    {cycling
                      ? `Moving speed ${p.units}/h`
                      : `Moving pace /${p.units}`}
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
                {!cycling ? (
                  <RecordMetric
                    value={movingSpeed}
                    label={`Moving speed ${p.units}/h`}
                  />
                ) : null}
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
                  : setViewChoice({
                      key: selectionKey,
                      view: view === "Map" ? "Metrics" : "Map",
                    })
              }
            />
            <View style={{ alignItems: "center", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={mainLabel}
                accessibilityState={{ disabled: controlsDisabled }}
                disabled={controlsDisabled}
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
                <Text
                  style={{ color: "white", fontSize: 12, fontWeight: "700" }}
                >
                  {!w ? "START" : w.state === "recording" ? "PAUSE" : "RESUME"}
                </Text>
              </Pressable>
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
                      void action.run(async () => {
                        await finishWorkout(w.id);
                        if (params.guide !== undefined) clearGuideParams();
                      }, "Activity saved. Find it in Activities.");
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
          {androidMapBelowControls ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: "#B2C4CD", fontSize: 13 }}>{status}</Text>
              {map}
            </View>
          ) : null}
          {waitingForNativeGps ? (
            <Text style={{ color: "#CED8DD", fontSize: 13, lineHeight: 20 }}>
              {acquisition.detail ||
                "Waiting for an accurate fix. Go outdoors with a clear view of the sky and check that precise location is enabled."}
            </Text>
          ) : null}
          {w?.state === "recording" && movingPace === null ? (
            <Text style={{ color: "#CED8DD", fontSize: 13 }}>
              {cycling ? "Speed" : "Pace"} appears after GPS measures movement.
            </Text>
          ) : null}
          {__DEV__ && !isWeb ? (
            <Text
              selectable
              testID="native-gps-diagnostics"
              style={{ color: "#CED8DD", fontSize: 13, lineHeight: 20 }}
            >
              {[
                "GPS diagnostics",
                `Permission ${diagnostics.permission} · ${diagnostics.precision}`,
                `Watcher ${diagnostics.watcher}`,
                `Last fix age ${diagnostics.lastFixAt === null ? "unavailable" : `${Math.max(0, Math.floor((now - diagnostics.lastFixAt) / 1000))} s`} · accuracy ${diagnostics.accuracy === null ? "unavailable" : `${diagnostics.accuracy.toFixed(1)} m`}`,
                `Accepted fixes ${diagnostics.accepted} · rejected ${diagnostics.rejected}`,
                `Accepted fixes without a new track point ${diagnostics.withoutTrackPoint}`,
                `Last rejection ${diagnostics.rejection || "none"}`,
                `Track points ${w?.points.length ?? 0} · distance ${(s?.meters ?? 0).toFixed(1)} m`,
                cycling
                  ? `Moving speed ${movingSpeed === "—" ? "waiting for measured movement" : `${movingSpeed} ${p.units}/h`}`
                  : `Moving pace ${movingPace === null ? "waiting for measured movement" : `${pace(movingPace, p.units)}/${p.units}`}`,
              ].join("\n")}
            </Text>
          ) : null}
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
          {!isWeb && w.state === "recording" ? (
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

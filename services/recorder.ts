import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { randomUUID } from "expo-crypto";
import { AppState } from "react-native";
import { resume } from "../utils/tracking";
import {
  emptyGpsDiagnostics,
  useGpsAcquisition,
  useGpsDiagnostics,
} from "../features/recording/acquisition";
import {
  nativeGpsWorkout,
  pauseNativeGps,
  trackNativeFix,
} from "../features/recording/native-gps";
import {
  getValue,
  readWorkouts,
  serial,
  setValue,
  writeWorkout,
  deleteWorkout,
} from "./database";
import { mutateWorkout, useApp } from "../store/app";
import type {
  RouteGuideReference,
  Sport,
  TrackPoint,
  Workout,
} from "../types/activity";
export const BACKGROUND_TASK = "stravakinda-location-v1";
const development = typeof __DEV__ !== "undefined" && __DEV__;
let watcher: Location.LocationSubscription | null = null;
let foregroundId: string | null = null;
let autoPaused = false;
let stationarySince: number | null = null;
let generation = 0;
let commands: Promise<unknown> = Promise.resolve();
function command<T>(work: () => Promise<T>): Promise<T> {
  const next = commands.then(work);
  commands = next.catch(() => undefined);
  return next;
}
function detachForeground() {
  generation++;
  watcher?.remove();
  watcher = null;
  foregroundId = null;
  if (development && useGpsDiagnostics.getState().watcher !== "failed")
    useGpsDiagnostics.setState({ watcher: "stopped" });
}
function reportSaveFailure(id: string, error: unknown, gpsError = false) {
  detachForeground();
  const detail = gpsError
    ? "GPS updates failed. Check location permission and reception, then resume."
    : `Recording paused because it could not be saved: ${String(error)}. Check device storage before resuming.`;
  useGpsAcquisition.setState({ state: "error", detail });
  useApp.setState((state) => ({
    workouts: state.workouts.map((w) =>
      w.id === id && w.state !== "finished" ? pauseNativeGps(w) : w,
    ),
    error: detail,
  }));
}
export function fromLocation(l: Location.LocationObject): TrackPoint {
  return {
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
    timestamp: l.timestamp,
    accuracy: l.coords.accuracy ?? Infinity,
    altitude: Number.isFinite(l.coords.altitude) ? l.coords.altitude : null,
    altitudeAccuracy:
      l.coords.altitudeAccuracy !== null &&
      Number.isFinite(l.coords.altitudeAccuracy) &&
      l.coords.altitudeAccuracy >= 0
        ? l.coords.altitudeAccuracy
        : null,
    segment: 0,
  };
}
async function ingest(
  id: string,
  locations: Location.LocationObject[],
  token?: number,
) {
  const receivedAt = Date.now();
  await mutateWorkout(id, (w) =>
    (token !== undefined ? token !== generation : foregroundId === id)
      ? w
      : locations
          .sort((a, b) => a.timestamp - b.timestamp)
          .reduce((current, l) => {
            if (development) {
              const accuracy = l.coords.accuracy;
              useGpsDiagnostics.setState({
                lastFixAt: Number.isFinite(l.timestamp) ? l.timestamp : null,
                accuracy:
                  accuracy !== null &&
                  Number.isFinite(accuracy) &&
                  accuracy >= 0
                    ? accuracy
                    : null,
              });
            }
            if (current.state !== "recording" && !autoPaused) return current;
            const speed = l.coords.speed;
            const useAutoPause =
              useApp.getState().preferences.autoPause &&
              speed !== null &&
              Number.isFinite(speed) &&
              speed >= 0 &&
              (l.coords.accuracy ?? 100) <= 20;
            const autoResuming =
              autoPaused &&
              useAutoPause &&
              speed >= 0.5 &&
              current.state === "paused";
            const beforeFix = current;
            if (autoResuming) current = resume(current, l.timestamp);
            const result = trackNativeFix(
              current,
              fromLocation(l),
              receivedAt,
              token !== undefined,
            );
            if (result.issue) {
              if (development)
                useGpsDiagnostics.setState((state) => ({
                  rejected: state.rejected + 1,
                  rejection: result.issue,
                }));
              if (token !== undefined)
                useGpsAcquisition.setState({
                  state: "waiting",
                  detail: result.issue,
                });
              return autoResuming
                ? { ...beforeFix, rejected: result.workout.rejected }
                : result.workout;
            }
            if (result.ignored && development)
              useGpsDiagnostics.setState((state) => ({
                rejected: state.rejected + 1,
                rejection: "Duplicate or out-of-order fix",
              }));
            if (
              result.workout.gpsFixAt === current.gpsFixAt ||
              result.workout.gpsFixAt !== l.timestamp
            )
              return result.workout;
            if (development)
              useGpsDiagnostics.setState((state) => ({
                accepted: state.accepted + 1,
                withoutTrackPoint:
                  state.withoutTrackPoint +
                  Number(
                    result.workout.points.length === current.points.length,
                  ),
              }));
            if (token !== undefined)
              useGpsAcquisition.setState({ state: "ready", detail: "" });
            if (autoResuming) autoPaused = false;
            if (useAutoPause) {
              if (speed < 0.5) {
                stationarySince ??= l.timestamp;
                if (
                  l.timestamp - stationarySince > 15000 &&
                  current.state === "recording"
                ) {
                  autoPaused = true;
                  return pauseNativeGps(result.workout);
                }
              } else {
                stationarySince = null;
              }
            }
            return result.workout;
          }, w),
  );
}
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  BACKGROUND_TASK,
  async ({ data, error }) => {
    if (error) {
      await setValue("backgroundError", error.message);
      return;
    }
    const id = await getValue<string>("backgroundWorkout");
    if (id && data?.locations) await ingest(id, data.locations);
  },
);
export async function attachForeground(id: string) {
  detachForeground();
  useGpsAcquisition.setState({ state: "acquiring", detail: "" });
  foregroundId = id;
  const token = generation;
  if (development) useGpsDiagnostics.setState({ watcher: "starting" });
  try {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 0,
      },
      (location) => {
        if (token !== generation) return;
        void ingest(id, [location], token).catch((e) => {
          if (token === generation) reportSaveFailure(id, e);
        });
      },
      () => {
        if (token !== generation) return;
        if (development) useGpsDiagnostics.setState({ watcher: "failed" });
        reportSaveFailure(id, undefined, true);
        void command(() => mutateWorkout(id, pauseNativeGps)).catch((e) =>
          reportSaveFailure(id, e),
        );
      },
    );
    if (token !== generation) subscription.remove();
    else {
      watcher = subscription;
      if (development) useGpsDiagnostics.setState({ watcher: "started" });
    }
  } catch {
    if (development && token === generation)
      useGpsDiagnostics.setState({ watcher: "failed" });
    if (token === generation)
      useGpsAcquisition.setState({
        state: "error",
        detail: "Could not start GPS. Check location settings, then resume.",
      });
    throw new Error(
      "Could not start GPS. Check location settings, then resume.",
    );
  }
}
async function requireLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (development) {
    const accuracy = permission.android?.accuracy ?? permission.ios?.accuracy;
    useGpsDiagnostics.setState({
      permission:
        permission.status ?? (permission.granted ? "granted" : "denied"),
      precision:
        accuracy === "fine" || accuracy === "full"
          ? "precise"
          : accuracy === "coarse" || accuracy === "reduced"
            ? "approximate"
            : (accuracy ?? "unknown"),
    });
  }
  if (!permission.granted)
    throw new Error(
      "Location permission is required. In your phone's app settings, allow location while using StravaKinda, then retry.",
    );
  if (permission.android?.accuracy === "coarse")
    throw new Error(
      "Enable precise location for StravaKinda in your phone's app settings, then retry.",
    );
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Turn on your phone's location services, then retry.");
}
async function start(
  sport: Sport,
  ownerId?: string,
  routeGuide?: RouteGuideReference,
) {
  if ((await readWorkouts()).some((w) => w.state !== "finished"))
    throw new Error("Resume or discard your unfinished workout first.");
  if (development) useGpsDiagnostics.setState(emptyGpsDiagnostics);
  await requireLocation();
  const now = Date.now();
  const w: Workout = {
    id: randomUUID(),
    title: `${sport[0].toUpperCase()}${sport.slice(1)} workout`,
    description: "",
    sport,
    visibility: useApp.getState().preferences.defaultVisibility,
    startedAt: now,
    endedAt: null,
    state: "recording",
    activeMs: 0,
    resumedAt: now,
    gpsFixAt: null,
    segment: 0,
    points: [],
    rejected: 0,
    ownerId,
    routeGuide,
  };
  await serial(async () => {
    if ((await readWorkouts()).some((item) => item.state !== "finished"))
      throw new Error("Resume or discard your unfinished workout first.");
    await writeWorkout(w);
  });
  await useApp.getState().refresh();
  try {
    await attachForeground(w.id);
  } catch {
    detachForeground();
    await mutateWorkout(w.id, pauseNativeGps);
    throw new Error(
      "Could not start GPS. Check location settings, then resume.",
    );
  }
  return w;
}
async function pauseRecording(id: string) {
  autoPaused = false;
  stationarySince = null;
  await mutateWorkout(id, pauseNativeGps);
  await stop();
}
async function resumeRecording(id: string) {
  let existing = (await readWorkouts()).find((w) => w.id === id);
  if (existing?.state === "recording" && foregroundId !== id)
    existing = await mutateWorkout(id, pauseNativeGps);
  if (!existing || existing.state !== "paused")
    throw new Error("Only a paused workout can be resumed.");
  await requireLocation();
  autoPaused = false;
  stationarySince = null;
  await mutateWorkout(id, (x) => resume(nativeGpsWorkout(x)));
  try {
    await attachForeground(id);
  } catch {
    detachForeground();
    await mutateWorkout(id, pauseNativeGps);
    throw new Error(
      "Could not restart GPS. Check location settings, then resume.",
    );
  }
}
async function background(id: string) {
  const existing = (await readWorkouts()).find((w) => w.id === id);
  if (!existing || existing.state !== "recording")
    throw new Error(
      "Resume your workout before enabling background recording.",
    );
  if (!(await TaskManager.isAvailableAsync()))
    throw new Error(
      "Background recording needs an installed development build.",
    );
  await requireLocation();
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK)) return;
  const result = await Location.requestBackgroundPermissionsAsync();
  if (!result.granted)
    throw new Error(
      "Allow background location in system settings to use this option.",
    );
  await setValue("backgroundWorkout", id);
  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "StravaKinda is recording",
        notificationBody: "Your route is being saved on this device.",
      },
    });
  } catch (e) {
    await setValue("backgroundWorkout", null);
    throw e;
  }
}
async function stop() {
  detachForeground();
  autoPaused = false;
  stationarySince = null;
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK))
    await Location.stopLocationUpdatesAsync(BACKGROUND_TASK);
  await setValue("backgroundWorkout", null);
}
async function finish(id: string) {
  await mutateWorkout(id, (w) => {
    if (w.state === "finished") return w;
    if (!w.points.length)
      throw new Error(
        "No GPS fixes have been recorded. Wait for GPS, or pause and keep the unfinished workout.",
      );
    return {
      ...pauseNativeGps(w),
      state: "finished",
      endedAt: Date.now(),
      routeGuide: undefined,
    };
  });
  await stop();
}
async function discard(id: string) {
  const existing = (await readWorkouts()).find((w) => w.id === id);
  if (existing?.state === "finished")
    throw new Error("Use Activities to delete a completed workout.");
  await stop();
  await deleteWorkout(id);
  await useApp.getState().refresh();
}
async function recover() {
  const active = (await readWorkouts()).find((w) => w.state !== "finished");
  if (!active || foregroundId === active.id || active.state === "paused")
    return;
  if (
    (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK)) &&
    (await getValue<string>("backgroundWorkout")) === active.id
  ) {
    try {
      await attachForeground(active.id);
    } catch (error) {
      detachForeground();
      await mutateWorkout(active.id, pauseNativeGps);
      throw error;
    }
    return;
  }
  // No proof of movement after process interruption. Stop the timer at last evidence.
  await mutateWorkout(active.id, pauseNativeGps);
}
export const startWorkout = (
  sport: Sport,
  ownerId?: string,
  routeGuide?: RouteGuideReference,
) => command(() => start(sport, ownerId, routeGuide));
export const pauseWorkout = (id: string) => command(() => pauseRecording(id));
export const resumeWorkout = (id: string) => command(() => resumeRecording(id));
export const finishWorkout = (id: string) => command(() => finish(id));
export const discardWorkout = (id: string) => command(() => discard(id));
export const enableBackground = (id: string) => command(() => background(id));
export const recoverRecording = () => command(recover);
let lifecycleInstalled = false;
export function installRecorderLifecycle() {
  if (lifecycleInstalled) return;
  lifecycleInstalled = true;
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void useApp
        .getState()
        .refresh()
        .then(recoverRecording)
        .catch((e) => useApp.setState({ error: String(e) }));
      return;
    }
    if (state !== "background") return;
    if (foregroundId)
      void command(async () => {
        const id = foregroundId;
        if (!id) return;
        const backgroundStarted =
          await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK);
        detachForeground();
        if (!backgroundStarted) await pauseRecording(id);
      }).catch((e) => useApp.setState({ error: String(e) }));
  });
}

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { randomUUID } from "expo-crypto";
import { AppState } from "react-native";
import { addPoint, pause, resume } from "../utils/tracking";
import {
  getValue,
  readWorkouts,
  serial,
  setValue,
  writeWorkout,
  deleteWorkout,
} from "./database";
import { mutateWorkout, useApp } from "../store/app";
import type { Sport, TrackPoint, Workout } from "../types/activity";
export const BACKGROUND_TASK = "stravakinda-location-v1";
let watcher: Location.LocationSubscription | null = null;
let foregroundId: string | null = null;
let autoPaused = false;
let stationarySince: number | null = null;
let generation = 0;
let interruptedAt: number | null = null;
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
}
function reportSaveFailure(id: string, error: unknown, gpsError = false) {
  detachForeground();
  const workout = useApp.getState().workouts.find((w) => w.id === id);
  if (workout)
    interruptedAt = Math.max(
      workout.resumedAt ?? workout.startedAt,
      workout.points.at(-1)?.timestamp ?? workout.startedAt,
    );
  useApp.setState((state) => ({
    workouts: state.workouts.map((w) =>
      w.id === id
        ? pause(
            w,
            Math.max(
              w.resumedAt ?? w.startedAt,
              w.points.at(-1)?.timestamp ?? w.startedAt,
            ),
          )
        : w,
    ),
    error: gpsError
      ? `Recording paused because GPS failed: ${String(error)}. Check location permission and reception, then resume.`
      : `Recording paused because it could not be saved: ${String(error)}. Check device storage before resuming.`,
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
  await mutateWorkout(id, (w) =>
    token !== undefined && token !== generation
      ? w
      : locations
          .sort((a, b) => a.timestamp - b.timestamp)
          .reduce((current, l) => {
            if (current.state === "finished") return current;
            if (
              useApp.getState().preferences.autoPause &&
              l.coords.speed !== null &&
              l.coords.speed >= 0 &&
              (l.coords.accuracy ?? 100) <= 20
            ) {
              if (l.coords.speed < 0.5) {
                stationarySince ??= l.timestamp;
                if (
                  l.timestamp - stationarySince > 15000 &&
                  current.state === "recording"
                ) {
                  autoPaused = true;
                  return pause(current, l.timestamp);
                }
              } else {
                stationarySince = null;
                if (autoPaused && current.state === "paused") {
                  autoPaused = false;
                  current = resume(current, l.timestamp);
                }
              }
            }
            return addPoint(current, fromLocation(l));
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
  foregroundId = id;
  const token = generation;
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 3000,
      distanceInterval: 3,
    },
    (location) => {
      if (token !== generation) return;
      void ingest(id, [location], token).catch((e) => reportSaveFailure(id, e));
    },
    (reason) => {
      if (token !== generation) return;
      reportSaveFailure(id, reason, true);
      void command(() =>
        mutateWorkout(id, (w) =>
          pause(
            w,
            Math.max(
              w.resumedAt ?? w.startedAt,
              w.points.at(-1)?.timestamp ?? w.startedAt,
            ),
          ),
        ),
      ).catch((e) => reportSaveFailure(id, e));
    },
  );
  if (token !== generation) subscription.remove();
  else watcher = subscription;
}
async function start(sport: Sport, ownerId?: string) {
  if ((await readWorkouts()).some((w) => w.state !== "finished"))
    throw new Error("Resume or discard your unfinished workout first.");
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Location permission is needed to record your route. Enable it in your phone settings.",
    );
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Turn on your phone’s location services first.");
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
    segment: 0,
    points: [],
    rejected: 0,
    ownerId,
  };
  await serial(async () => {
    if ((await readWorkouts()).some((item) => item.state !== "finished"))
      throw new Error("Resume or discard your unfinished workout first.");
    await writeWorkout(w);
  });
  await useApp.getState().refresh();
  interruptedAt = null;
  try {
    await attachForeground(w.id);
  } catch (e) {
    detachForeground();
    await mutateWorkout(w.id, (x) => pause(x));
    throw e;
  }
  return w;
}
async function pauseRecording(id: string) {
  autoPaused = false;
  stationarySince = null;
  await mutateWorkout(id, (x) => pause(x, interruptedAt ?? Date.now()));
}
async function resumeRecording(id: string) {
  let existing = (await readWorkouts()).find((w) => w.id === id);
  if (existing?.state === "recording" && foregroundId !== id)
    existing = await mutateWorkout(id, (w) =>
      pause(
        w,
        Math.max(
          w.resumedAt ?? w.startedAt,
          w.points.at(-1)?.timestamp ?? w.startedAt,
        ),
      ),
    );
  if (!existing || existing.state !== "paused")
    throw new Error("Only a paused workout can be resumed.");
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Location permission is needed. Enable it in your phone settings.",
    );
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Turn on your phone's location services first.");
  autoPaused = false;
  stationarySince = null;
  try {
    await attachForeground(id);
    await mutateWorkout(id, (x) => resume(x));
    interruptedAt = null;
  } catch (error) {
    detachForeground();
    throw error;
  }
}
async function background(id: string) {
  const existing = (await readWorkouts()).find((w) => w.id === id);
  if (!existing || existing.state === "finished")
    throw new Error("No unfinished workout to record.");
  if (!(await TaskManager.isAvailableAsync()))
    throw new Error(
      "Background recording needs an installed development build.",
    );
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
      distanceInterval: 5,
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
  await mutateWorkout(id, (w) => ({
    ...(w.state === "finished" ? w : pause(w, interruptedAt ?? Date.now())),
    state: "finished",
    endedAt: w.endedAt ?? Date.now(),
  }));
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
  if (!active || foregroundId === active.id) return;
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK)) {
    await attachForeground(active.id);
    return;
  }
  // No proof of movement after process interruption. Stop the timer at last evidence.
  await mutateWorkout(active.id, (w) =>
    pause(
      w,
      Math.max(
        w.resumedAt ?? w.startedAt,
        w.points.at(-1)?.timestamp ?? w.startedAt,
      ),
    ),
  );
}
export const startWorkout = (sport: Sport, ownerId?: string) =>
  command(() => start(sport, ownerId));
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
      void (async () => {
        if (!(await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK))) {
          const id = foregroundId;
          detachForeground();
          if (id) await pauseWorkout(id);
        }
      })().catch((e) => useApp.setState({ error: String(e) }));
  });
}

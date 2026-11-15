import { randomUUID } from "expo-crypto";
import { addPoint, pause, resume } from "../utils/tracking";
import {
  browserRecordingIssue,
  browserLocationError,
  browserPoint,
  freshBrowserPoint,
} from "../features/recording/browser";
import { readWorkouts, writeWorkout, deleteWorkout, serial } from "./database";
import { mutateWorkout, useApp } from "../store/app";
import type { Sport, Workout } from "../types/activity";
let activeId: string | null = null;
let watchId: number | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;
let generation = 0;
let lastEvidence = 0;
let commands: Promise<unknown> = Promise.resolve();
function command<T>(work: () => Promise<T>): Promise<T> {
  const next = commands.then(work);
  commands = next.catch(() => undefined);
  return next;
}
function stop() {
  generation++;
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  if (watchdog) clearInterval(watchdog);
  watchId = null;
  watchdog = null;
  activeId = null;
}
function report(error: unknown) {
  useApp.setState({
    error: error instanceof Error ? error.message : String(error),
  });
}
function requireForeground() {
  const issue = browserRecordingIssue();
  if (issue) throw new Error(issue);
  if (document.visibilityState === "hidden")
    throw new Error(
      "Keep this page visible while starting or resuming a recording.",
    );
}
async function locate() {
  requireForeground();
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(browserLocationError(error))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });
  requireForeground();
  const point = browserPoint(position);
  if (!freshBrowserPoint(point))
    throw new Error(
      "GPS is stale or not accurate enough. Move outdoors and try again; accuracy must be within 35 metres.",
    );
  return point;
}
function loseSignal(message: string) {
  const id = activeId;
  if (!id) return;
  const evidence = lastEvidence;
  stop();
  // Stop the visible timer even if persisting the pause fails (quota/permissions).
  useApp.setState((state) => ({
    workouts: state.workouts.map((w) =>
      w.id === id
        ? pause(w, Math.max(w.resumedAt ?? w.startedAt, evidence))
        : w,
    ),
  }));
  void command(async () => {
    await mutateWorkout(id, (w) =>
      pause(w, Math.max(w.resumedAt ?? w.startedAt, evidence)),
    );
    report(new Error(message));
  }).catch(report);
}
function watch(id: string) {
  activeId = id;
  const token = ++generation;
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (generation !== token || activeId !== id) return;
      if (Date.now() - lastEvidence > 20000) {
        loseSignal(
          "Recording paused after a GPS or browser suspension gap. Resume to start a new route segment.",
        );
        return;
      }
      const point = browserPoint(position);
      void mutateWorkout(id, (w) => {
        if (generation !== token || w.state !== "recording") return w;
        if (!freshBrowserPoint(point))
          return { ...w, rejected: w.rejected + 1 };
        const next = addPoint(w, point);
        if (next.rejected === w.rejected)
          lastEvidence = Math.max(lastEvidence, point.timestamp);
        return next;
      }).catch((error) => {
        loseSignal(
          "Recording paused because browser storage failed. Check available storage before resuming.",
        );
        report(error);
      });
    },
    (error) => {
      if (generation === token) loseSignal(browserLocationError(error));
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );
  watchdog = setInterval(() => {
    if (Date.now() - lastEvidence > 20000)
      loseSignal(
        "Recording paused after GPS readings stopped. Keep this page visible and resume when GPS is available.",
      );
  }, 5000);
}
export function startWorkout(sport: Sport, ownerId?: string) {
  return command(async () => {
    if ((await readWorkouts()).some((w) => w.state !== "finished"))
      throw new Error("Resume or discard your unfinished workout first.");
    const point = await locate();
    const now = Math.min(Date.now(), point.timestamp);
    const workout: Workout = {
      id: randomUUID(),
      title: `${sport[0].toUpperCase()}${sport.slice(1)} workout`,
      description: "",
      sport,
      visibility: useApp.getState().preferences.defaultVisibility,
      ownerId,
      startedAt: now,
      endedAt: null,
      state: "recording",
      resumedAt: now,
      activeMs: 0,
      segment: 0,
      points: [],
      rejected: 0,
    };
    await serial(async () => {
      if ((await readWorkouts()).some((w) => w.state !== "finished"))
        throw new Error("An unfinished workout already exists.");
      await writeWorkout(addPoint(workout, point));
    });
    await useApp.getState().refresh();
    lastEvidence = point.timestamp;
    try {
      requireForeground();
      watch(workout.id);
    } catch (error) {
      stop();
      await mutateWorkout(workout.id, (w) => pause(w));
      throw error;
    }
    return workout;
  });
}
export function pauseWorkout(id: string) {
  return command(async () => {
    stop();
    await mutateWorkout(id, (w) => pause(w));
  });
}
export function resumeWorkout(id: string) {
  return command(async () => {
    let existing = (await readWorkouts()).find((w) => w.id === id);
    if (existing?.state === "recording" && activeId !== id) {
      existing = await mutateWorkout(id, (w) =>
        pause(
          w,
          Math.max(
            w.resumedAt ?? w.startedAt,
            w.points.at(-1)?.timestamp ?? w.startedAt,
          ),
        ),
      );
    }
    if (!existing || existing.state !== "paused")
      throw new Error("Only a paused workout can be resumed.");
    const point = await locate();
    stop();
    await mutateWorkout(id, (w) => addPoint(resume(w, point.timestamp), point));
    lastEvidence = point.timestamp;
    try {
      requireForeground();
      watch(id);
    } catch (error) {
      stop();
      await mutateWorkout(id, (w) => pause(w));
      throw error;
    }
  });
}
export function finishWorkout(id: string) {
  return command(async () => {
    stop();
    await mutateWorkout(id, (w) =>
      w.state === "finished"
        ? w
        : { ...pause(w), state: "finished", endedAt: Date.now() },
    );
  });
}
export function discardWorkout(id: string) {
  return command(async () => {
    stop();
    const workout = (await readWorkouts()).find((w) => w.id === id);
    if (workout?.state === "finished")
      throw new Error("Use Activities to delete a completed workout.");
    await deleteWorkout(id);
    await useApp.getState().refresh();
  });
}
export async function enableBackground(_id: string) {
  throw new Error(
    "Browser recording is foreground-only. Keep this page visible; use the Android/iOS app for background recording.",
  );
}
export async function recoverRecording() {
  const active = (await readWorkouts()).find((w) => w.state === "recording");
  if (!active || active.id === activeId) return;
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
let installed = false;
export function installRecorderLifecycle() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const suspend = () =>
    loseSignal(
      "Browser recording paused when the page left the foreground. Resume when you return.",
    );
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") suspend();
  });
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", () => {
    void recoverRecording().catch(report);
  });
}

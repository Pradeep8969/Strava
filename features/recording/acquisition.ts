import { create } from "zustand";
import type { TrackPoint } from "../../types/activity";
import { freshBrowserPoint } from "./browser";

// Transient acquisition feedback only; never persists coordinates or workouts.
export const useGpsAcquisition = create<{
  state: "idle" | "acquiring" | "waiting" | "ready" | "error";
  detail: string;
}>(() => ({ state: "idle", detail: "" }));

export const emptyGpsDiagnostics = {
  permission: "unknown",
  precision: "unknown",
  watcher: "idle",
  lastFixAt: null as number | null,
  accuracy: null as number | null,
  accepted: 0,
  withoutTrackPoint: 0,
  rejected: 0,
  rejection: "",
};
export const useGpsDiagnostics = create<typeof emptyGpsDiagnostics>(
  () => emptyGpsDiagnostics,
);

export class WaitingForGpsError extends Error {}

export function acquisitionDetail(point: TrackPoint, now = Date.now()) {
  const accuracy =
    Number.isFinite(point.accuracy) && point.accuracy >= 0
      ? `Last reported accuracy: approximately ${Math.ceil(point.accuracy)} m; recording requires 35 m or better.`
      : "The browser did not report a usable accuracy. Recording requires 35 m or better.";
  const age = now - point.timestamp;
  const timing = !Number.isFinite(age)
    ? "The browser returned an invalid location timestamp."
    : age > 15000
      ? `This measurement is stale (${Math.floor(age / 1000)} seconds old); a fix from the last 15 seconds is required.`
      : age < -1000
        ? "The measurement timestamp is ahead of the device clock. Check the device time and retry."
        : "";
  const coordinatesValid =
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180;
  return `${accuracy} ${timing} ${coordinatesValid ? "" : "The browser returned invalid location coordinates."} No recording has started or resumed. Retry GPS to request a fresh fix. A desktop location provider may be unable to meet this accuracy.`.replace(
    / +/g,
    " ",
  );
}

export function validateAcquisition(point: TrackPoint) {
  if (!freshBrowserPoint(point)) {
    const detail = acquisitionDetail(point);
    useGpsAcquisition.setState({ state: "waiting", detail });
    throw new WaitingForGpsError(detail);
  }
  useGpsAcquisition.setState({ state: "ready", detail: "" });
  return point;
}

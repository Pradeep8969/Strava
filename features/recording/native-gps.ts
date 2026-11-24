import type { TrackPoint, Workout } from "../../types/activity";
import { addPoint, pause, validPoint } from "../../utils/tracking";

export const GPS_GAP_MS = 15000;

export function nativeGpsWorkout(workout: Workout): Workout {
  if (workout.gpsFixAt !== undefined) return workout;
  // Retain previously accumulated time and geometry on older drafts.
  return { ...workout, gpsFixAt: null };
}

export function pauseNativeGps(workout: Workout) {
  return pause({ ...nativeGpsWorkout(workout), gpsFixAt: null });
}

export function trackNativeFix(
  workout: Workout,
  point: TrackPoint,
  receivedAt: number,
  foreground: boolean,
): { workout: Workout; issue?: string; ignored?: boolean } {
  if (workout.state !== "recording") return { workout };
  const current = nativeGpsWorkout(workout);
  const previousFix = current.gpsFixAt ?? null;
  const gap = previousFix === null ? 0 : point.timestamp - previousFix;
  let issue: string | undefined;
  if (!validPoint(point)) {
    issue =
      Number.isFinite(point.accuracy) && point.accuracy > 35
        ? `Last reported accuracy: ${Math.ceil(point.accuracy)} m. Recording needs 35 m or better.`
        : "The device returned an unusable location fix.";
  } else if (
    point.timestamp > receivedAt + 1000 ||
    (foreground && receivedAt - point.timestamp > GPS_GAP_MS) ||
    point.timestamp < (current.resumedAt ?? current.startedAt)
  ) {
    issue = "The device returned an out-of-date location fix.";
  } else if (previousFix !== null && gap <= 0) {
    // An overlapping background/foreground delivery can repeat an accepted fix.
    return { workout: current, ignored: true };
  }
  if (issue)
    return { workout: { ...current, rejected: current.rejected + 1 }, issue };

  const last = current.points.at(-1);
  const newSegment =
    last?.segment === current.segment &&
    (gap > GPS_GAP_MS || previousFix === null);
  const candidate = newSegment
    ? { ...current, segment: current.segment + 1 }
    : current;
  const next = addPoint(candidate, point);
  if (next.rejected !== current.rejected)
    return {
      workout: { ...current, rejected: next.rejected },
      issue:
        "The device returned a location inconsistent with the recorded route.",
    };
  // Stationary fixes still confirm reception even when geometry ignores jitter.
  return {
    workout: {
      ...next,
      gpsFixAt: point.timestamp,
      activeMs: current.activeMs + (gap <= GPS_GAP_MS ? gap : 0),
    },
  };
}

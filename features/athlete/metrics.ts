import type { Workout } from "../../types/activity";
import { stats } from "../../utils/tracking";

export function completedTraining(workouts: Workout[], now = Date.now()) {
  return workouts
    .filter((w) => w.state === "finished" && w.startedAt <= now)
    .map((workout) => ({ workout, ...stats(workout) }));
}

export function trainingSummary(workouts: Workout[], now = Date.now()) {
  const entries = completedTraining(workouts, now);
  return {
    count: entries.length,
    meters: entries.reduce((n, w) => n + w.meters, 0),
    movingMs: entries.reduce((n, w) => n + w.movingMs, 0),
  };
}

/** Six calendar months, including this month; never infer missing workouts. */
export function monthlyTraining(workouts: Workout[], now = Date.now()) {
  const today = new Date(now);
  const entries = completedTraining(workouts, now);
  return Array.from({ length: 6 }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const items = entries.filter(
      (w) => w.workout.startedAt >= +start && w.workout.startedAt < +end,
    );
    return {
      start: +start,
      label: start.toLocaleDateString("en", { month: "short" }),
      meters: items.reduce((n, w) => n + w.meters, 0),
      count: items.length,
    };
  });
}

/** Whole-activity records, not certified course or distance-specific race PRs. */
export function personalRecords(workouts: Workout[], now = Date.now()) {
  const entries = completedTraining(workouts, now).filter((w) => w.meters > 0);
  const longest = entries.reduce<(typeof entries)[number] | null>(
    (best, w) => (!best || w.meters > best.meters ? w : best),
    null,
  );
  const runs = entries.filter(
    (w) =>
      w.workout.sport === "running" &&
      w.meters >= 1000 &&
      w.movingMs > 0 &&
      w.pace !== null,
  );
  const fastestRun = runs.reduce<(typeof entries)[number] | null>(
    (best, w) => (!best || w.pace! < best.pace! ? w : best),
    null,
  );
  return { longest, fastestRun };
}

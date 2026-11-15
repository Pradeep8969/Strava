import type { Workout } from "../../types/activity";
import { stats } from "../../utils/tracking";
/** Local calendar boundaries avoid assigning late-night activities to UTC days. */
export function dailyTotals(workouts: Workout[], now = Date.now()) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const start = new Date(monday);
    start.setDate(start.getDate() + i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const items = workouts.filter(
      (w) =>
        w.state === "finished" &&
        w.startedAt >= +start &&
        w.startedAt < +end &&
        w.startedAt <= now,
    );
    return {
      start: +start,
      label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
      count: items.length,
      meters: items.reduce((sum, w) => sum + stats(w).meters, 0),
    };
  });
}
export function weeklyTotals(workouts: Workout[], now = Date.now()) {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - ((end.getDay() + 6) % 7));
  return Array.from({ length: 8 }, (_, i) => {
    const start = +end - (7 - i) * 7 * 86400000;
    const items = workouts.filter(
      (w) =>
        w.state === "finished" &&
        w.startedAt >= start &&
        w.startedAt < start + 7 * 86400000,
    );
    return {
      start,
      meters: items.reduce((sum, w) => sum + stats(w).meters, 0),
      count: items.length,
    };
  });
}

import type { Sport, Workout } from "../../types/activity";
import { stats } from "../../utils/tracking";
import { waypointElevation } from "../discovery/catalog";

export type AnalyticsPeriod = "Week" | "Month" | "Year";
export type AnalyticsSport = Sport | "all";
export type AnalyticsBucket = {
  start: number;
  end: number;
  label: string;
  meters: number;
  movingMs: number;
  count: number;
};
const dayKey = (timestamp: number) => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function athleteWorkouts(
  workouts: Workout[],
  userId: string | undefined,
  now: number,
) {
  return workouts.filter(
    (w) =>
      w.state === "finished" &&
      (!w.ownerId || w.ownerId === userId) &&
      w.startedAt <= now &&
      w.endedAt !== null &&
      w.endedAt >= w.startedAt &&
      w.endedAt <= now,
  );
}
export function calendarBuckets(period: AnalyticsPeriod, now: number) {
  const today = new Date(now),
    year = today.getFullYear(),
    month = today.getMonth();
  const start = new Date(year, month, today.getDate());
  if (period === "Week")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  else if (period === "Month") start.setDate(1);
  else start.setMonth(0, 1);
  const count =
    period === "Week"
      ? 7
      : period === "Month"
        ? Math.ceil(new Date(year, month + 1, 0).getDate() / 7)
        : 12;
  return Array.from({ length: count }, (_, i) => {
    const from = new Date(start),
      to = new Date(start);
    if (period === "Year") {
      from.setMonth(i);
      to.setMonth(i + 1);
    } else if (period === "Week") {
      from.setDate(start.getDate() + i);
      to.setDate(start.getDate() + i + 1);
    } else {
      from.setDate(1 + i * 7);
      to.setDate(
        Math.min(1 + (i + 1) * 7, new Date(year, month + 1, 0).getDate() + 1),
      );
    }
    const label =
      period === "Year"
        ? from.toLocaleDateString("en", { month: "short" })
        : period === "Week"
          ? from.toLocaleDateString("en", { weekday: "short" })
          : `${from.getDate()}–${new Date(+to - 1).getDate()}`;
    return { start: +from, end: +to, label };
  });
}
export function analyticsSnapshot(
  workouts: Workout[],
  period: AnalyticsPeriod,
  sport: AnalyticsSport,
  now: number,
) {
  const ranges = calendarBuckets(period, now);
  const start = ranges[0].start,
    end = ranges.at(-1)!.end;
  const entries = workouts
    .filter(
      (w) =>
        w.state === "finished" &&
        w.startedAt >= start &&
        w.startedAt < end &&
        w.startedAt <= now &&
        w.endedAt !== null &&
        w.endedAt <= now &&
        w.endedAt >= w.startedAt &&
        (sport === "all" || w.sport === sport),
    )
    .map((workout) => ({ workout, ...stats(workout) }));
  const buckets: AnalyticsBucket[] = ranges.map((range) => {
    const items = entries.filter(
      (e) =>
        e.workout.startedAt >= range.start && e.workout.startedAt < range.end,
    );
    return {
      ...range,
      meters: items.reduce((n, e) => n + e.meters, 0),
      movingMs: items.reduce((n, e) => n + e.movingMs, 0),
      count: items.length,
    };
  });
  const meters = entries.reduce((n, e) => n + e.meters, 0),
    movingMs = entries.reduce((n, e) => n + e.movingMs, 0);
  const altitude = entries.filter(
    (e) => waypointElevation(e.workout.points) !== null,
  );
  const activeDays = new Set(entries.map((e) => dayKey(e.workout.startedAt)))
    .size;
  const cursor = new Date(start);
  let elapsedDays = 0;
  while (+cursor <= now && +cursor < end) {
    elapsedDays++;
    cursor.setDate(cursor.getDate() + 1);
  }
  const sports = (["running", "walking", "cycling", "hiking"] as Sport[]).map(
    (type) => {
      const items = entries.filter((e) => e.workout.sport === type);
      return {
        sport: type,
        meters: items.reduce((n, e) => n + e.meters, 0),
        movingMs: items.reduce((n, e) => n + e.movingMs, 0),
        count: items.length,
      };
    },
  );
  return {
    start,
    end,
    buckets,
    meters,
    movingMs,
    count: entries.length,
    pace: meters > 0 && movingMs > 0 ? movingMs / meters : null,
    activeDays,
    elapsedDays,
    sports,
    elevation: altitude.length
      ? altitude.reduce((n, e) => n + e.elevation, 0)
      : null,
    altitudeCount: altitude.length,
  };
}
export function earnedMilestones(workouts: Workout[]) {
  const finished = workouts.filter((w) => w.state === "finished"),
    meters = finished.reduce((n, w) => n + stats(w).meters, 0);
  return [
    {
      id: "first",
      title: "First outing",
      detail: "Save one completed activity",
      earned: finished.length >= 1,
    },
    {
      id: "ten",
      title: "Finding your rhythm",
      detail: "Complete 10 activities",
      earned: finished.length >= 10,
    },
    {
      id: "distance",
      title: "A hundred kilometres",
      detail: "Record 100 km in total",
      earned: meters >= 100000,
    },
  ];
}

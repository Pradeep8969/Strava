import { expect, it } from "vitest";
import { dailyTotals, weeklyTotals } from "../features/analytics/metrics";
import type { Workout } from "../types/activity";
it("returns eight zero weeks with no invented activity", () => {
  const weeks = weeklyTotals([], Date.UTC(2026, 9, 25));
  expect(weeks).toHaveLength(8);
  expect(weeks.every((w) => w.meters === 0 && w.count === 0)).toBe(true);
});
it("groups finished activities by local day and excludes future or unfinished sessions", () => {
  const now = +new Date(2026, 10, 13, 12);
  const sample = (startedAt: number, state: Workout["state"]): Workout => ({
    id: String(startedAt),
    title: "Test fixture",
    description: "",
    sport: "walking",
    visibility: "private",
    startedAt,
    endedAt: startedAt + 1000,
    state,
    activeMs: 1000,
    resumedAt: null,
    segment: 0,
    points: [],
    rejected: 0,
  });
  const days = dailyTotals(
    [
      sample(+new Date(2026, 10, 9, 0), "finished"),
      sample(+new Date(2026, 10, 9, 23, 59), "finished"),
      sample(+new Date(2026, 10, 10, 0), "finished"),
      sample(+new Date(2026, 10, 8, 23, 59), "finished"),
      sample(+new Date(2026, 10, 14), "finished"),
      sample(+new Date(2026, 10, 11), "paused"),
    ],
    now,
  );
  expect(days.map((day) => day.count)).toEqual([2, 1, 0, 0, 0, 0, 0]);
  expect(days.map((day) => day.meters)).toEqual([0, 0, 0, 0, 0, 0, 0]);
});

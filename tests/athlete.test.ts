import { expect, it } from "vitest";
import {
  monthlyTraining,
  personalRecords,
  trainingSummary,
} from "../features/athlete/metrics";
import { trainingFixture } from "./fixtures/training";
import { stats } from "../utils/tracking";

const now = +new Date(2026, 10, 14, 12);
it("keeps new athletes at zero with no invented records or chart bars", () => {
  expect(trainingSummary([], now)).toEqual({
    count: 0,
    meters: 0,
    movingMs: 0,
  });
  expect(personalRecords([], now)).toEqual({ longest: null, fastestRun: null });
  expect(monthlyTraining([], now)).toHaveLength(6);
  expect(
    monthlyTraining([], now).every((m) => m.meters === 0 && m.count === 0),
  ).toBe(true);
});
it("uses recorded metrics and excludes paused and future workouts", () => {
  const run = trainingFixture();
  const s = stats(run);
  expect(
    trainingSummary(
      [run, { ...run, state: "paused" }, { ...run, startedAt: now + 1 }],
      now,
    ),
  ).toEqual({ count: 1, meters: s.meters, movingMs: s.movingMs });
});
it("groups six local calendar months across year boundaries", () => {
  const jan = +new Date(2027, 0, 15, 12);
  const december = trainingFixture(
    "dec",
    "hiking",
    +new Date(2026, 11, 31, 23, 59),
  );
  const january = trainingFixture("jan", "running", +new Date(2027, 0, 1));
  const months = monthlyTraining(
    [
      december,
      january,
      trainingFixture("old", "walking", +new Date(2026, 6, 31)),
    ],
    jan,
  );
  expect(months.map((m) => m.label)).toEqual([
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
  ]);
  expect(months.map((m) => m.count)).toEqual([0, 0, 0, 0, 1, 1]);
  expect(months[4].meters).toBeCloseTo(stats(december).meters);
});
it("does not compare cycling pace with running or award records to short GPS fragments", () => {
  const run = trainingFixture();
  const bike = trainingFixture("ride", "cycling");
  bike.points = bike.points.map((p) => ({
    ...p,
    longitude: p.longitude + (p.timestamp - bike.startedAt) / 10000000,
  }));
  const short = {
    ...trainingFixture("fragment"),
    points: run.points.slice(0, 2),
  };
  const records = personalRecords([run, bike, short], now);
  expect(records.longest?.workout.id).toBe("ride");
  expect(records.fastestRun?.workout.id).toBe(run.id);
  expect(personalRecords([short], now).fastestRun).toBeNull();
});

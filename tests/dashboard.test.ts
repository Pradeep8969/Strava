import { expect, it } from "vitest";
import {
  analyticsSnapshot,
  athleteWorkouts,
  calendarBuckets,
  earnedMilestones,
} from "../features/analytics/dashboard";
import {
  emptyEventDraft,
  validateEventDraft,
} from "../features/organizer/drafts";
import { trainingFixture } from "./fixtures/training";
import { stats } from "../utils/tracking";

const now = +new Date(2026, 10, 14, 12);
it("keeps empty analytics genuinely zero and unavailable sensor-derived values absent", () => {
  for (const period of ["Week", "Month", "Year"] as const) {
    const s = analyticsSnapshot([], period, "all", now);
    expect(s.count).toBe(0);
    expect(s.meters).toBe(0);
    expect(s.movingMs).toBe(0);
    expect(s.pace).toBeNull();
    expect(s.elevation).toBeNull();
    expect(s.activeDays).toBe(0);
    expect(
      s.buckets.every(
        (b) => b.meters === 0 && b.movingMs === 0 && b.count === 0,
      ),
    ).toBe(true);
  }
});
it("uses local calendar boundaries for weeks crossing a year and for leap-year months", () => {
  const week = calendarBuckets("Week", +new Date(2027, 0, 1, 12));
  expect(new Date(week[0].start).getDay()).toBe(1);
  expect(new Date(week[0].start).getFullYear()).toBe(2026);
  expect(week).toHaveLength(7);
  const feb = calendarBuckets("Month", +new Date(2028, 1, 29, 12));
  expect(feb).toHaveLength(5);
  expect(new Date(feb.at(-1)!.end).getMonth()).toBe(2);
  expect(
    feb.reduce(
      (sum, bucket) => sum + Math.round((bucket.end - bucket.start) / 86400000),
      0,
    ),
  ).toBe(29);
  expect(calendarBuckets("Year", now)).toHaveLength(12);
});
it("excludes other accounts, future or incomplete sessions and invalid completion times", () => {
  const w = trainingFixture("run", "running", now - 3600000);
  const own = athleteWorkouts(
    [
      w,
      { ...w, id: "linked", ownerId: "viewer" },
      { ...w, ownerId: "other" },
      { ...w, state: "paused" },
      { ...w, endedAt: now + 1 },
      { ...w, endedAt: null },
      { ...w, endedAt: w.startedAt - 1 },
    ],
    "viewer",
    now,
  );
  expect(own.map((x) => x.id)).toEqual(["run", "linked"]);
});
it("aggregates actual distance and moving time and counts a training day only once", () => {
  const run = trainingFixture("run", "running", now - 3600000),
    ride = trainingFixture("ride", "cycling", now - 7200000);
  const s = analyticsSnapshot([run, ride], "Week", "all", now);
  expect(s.meters).toBeCloseTo(stats(run).meters + stats(ride).meters);
  expect(s.movingMs).toBe(stats(run).movingMs + stats(ride).movingMs);
  expect(s.activeDays).toBe(1);
  expect(s.elapsedDays).toBe(6);
  expect(s.buckets.reduce((n, b) => n + b.count, 0)).toBe(2);
  const running = analyticsSnapshot([run, ride], "Week", "running", now);
  expect(running.count).toBe(1);
  expect(running.sports.find((s) => s.sport === "cycling")?.count).toBe(0);
});
it("separates current-month from year history and does not synthesize altitude", () => {
  const recent = trainingFixture("recent", "hiking", now - 3600000);
  recent.points = recent.points.map((p) => ({
    ...p,
    altitude: null,
    altitudeAccuracy: null,
  }));
  const earlier = trainingFixture("earlier", "hiking", +new Date(2026, 9, 1));
  expect(analyticsSnapshot([recent, earlier], "Month", "all", now).count).toBe(
    1,
  );
  expect(analyticsSnapshot([recent, earlier], "Year", "all", now).count).toBe(
    2,
  );
  expect(analyticsSnapshot([recent], "Week", "all", now).elevation).toBeNull();
});
it("awards milestones only after actual completed activity thresholds", () => {
  expect(earnedMilestones([]).every((m) => !m.earned)).toBe(true);
  const workouts = Array.from({ length: 10 }, (_, i) =>
    trainingFixture(String(i)),
  );
  expect(earnedMilestones(workouts).map((m) => m.earned)).toEqual([
    true,
    true,
    false,
  ]);
  expect(
    earnedMilestones([{ ...workouts[0], state: "paused" }]).every(
      (m) => !m.earned,
    ),
  ).toBe(true);
});
it("validates preview event calendar dates, including leap days, without publishing anything", () => {
  const draft = {
    ...emptyEventDraft(),
    title: "Test preview",
    location: "Test location",
    date: "2028-02-29",
  };
  expect(validateEventDraft(draft)).toBeNull();
  expect(validateEventDraft({ ...draft, date: "2027-02-29" })).toBe(
    "Enter a valid calendar date.",
  );
  expect(validateEventDraft({ ...draft, date: "2028-04-31" })).toBe(
    "Enter a valid calendar date.",
  );
  expect(validateEventDraft({ ...draft, date: "02/29/2028" })).toContain(
    "YYYY-MM-DD",
  );
});
it("rejects empty preview names and invalid proposed capacities", () => {
  expect(validateEventDraft(emptyEventDraft())).toContain("event name");
  const draft = {
    ...emptyEventDraft(),
    title: "Test preview",
    location: "Test location",
    date: "2028-02-29",
  };
  for (const capacity of ["0", "-1", "2.5", "100001", "abc"])
    expect(validateEventDraft({ ...draft, capacity })).toContain("capacity");
  expect(validateEventDraft({ ...draft, capacity: "120" })).toBeNull();
});

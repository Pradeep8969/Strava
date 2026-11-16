import { expect, it } from "vitest";
import { activityMapPoints } from "../features/routes/activity-map";
import { trainingFixture } from "./fixtures/training";

it("shows the full local track only to its owner or the unowned device view", () => {
  const workout = trainingFixture();
  expect(activityMapPoints(workout)).toBe(workout.points);
  workout.ownerId = "owner";
  expect(activityMapPoints(workout, "owner")).toBe(workout.points);
});
it.each(["private", "followers", "public"] as const)(
  "fails closed for %s other-user geometry until privacy-zone redaction exists",
  (visibility) => {
    const workout = { ...trainingFixture(), ownerId: "owner", visibility };
    expect(activityMapPoints(workout)).toEqual([]);
    expect(activityMapPoints(workout, "another-user")).toEqual([]);
  },
);

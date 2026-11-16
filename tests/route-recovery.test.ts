import { expect, it } from "vitest";
import {
  inspectPlans,
  previewRecovery,
  summarizePlans,
} from "../features/routes/recovery";
import { createPlan, waypoint } from "../features/routes/planner";
const plan = () =>
  createPlan(
    "Fixture",
    [
      waypoint({ latitude: 0, longitude: 0 }),
      waypoint({ latitude: 0, longitude: 1 }),
    ],
    "one",
    null,
  );
it("opens valid legacy records alongside malformed data without mutating originals", () => {
  const legacy = {
    id: "legacy",
    title: "Legacy",
    points: plan().points,
    extra: "preserve",
  };
  const raw = [legacy, null, { id: "broken" }];
  const before = JSON.stringify(raw);
  const result = inspectPlans(raw);
  expect(result.plans.map((p) => p.title)).toEqual(["Legacy"]);
  expect(result.plans[0].createdAt).toBeNull();
  expect(result.unreadable).toBe(2);
  expect(result.warning).toContain("preserved");
  expect(JSON.stringify(raw)).toBe(before);
});
it("handles malformed containers and duplicates without presenting duplicate plans", () => {
  expect(inspectPlans({ routes: [] }).unreadable).toBe(1);
  expect(inspectPlans([plan(), plan()])).toMatchObject({
    total: 2,
    unreadable: 1,
  });
  expect(inspectPlans([])).toMatchObject({ total: 0, unreadable: 0 });
});
it("previews recovery without overwrites, including matching geometry with a new id", () => {
  const original = plan();
  const result = previewRecovery(
    [original],
    [
      original,
      { ...original, id: "copy" },
      { ...original, id: "new", title: "Different" },
    ],
  );
  expect(result.duplicates).toBe(2);
  expect(result.additions.map((p) => p.id)).toEqual(["new"]);
  expect(previewRecovery([null], [original]).writable).toBe(false);
  expect(JSON.stringify(summarizePlans([original]))).not.toContain("longitude");
});

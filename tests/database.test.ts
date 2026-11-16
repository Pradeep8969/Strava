import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Workout } from "../types/activity";
import { emptyEventDraft } from "../features/organizer/drafts";
import { createPlan, waypoint } from "../features/routes/planner";
const context = vi.hoisted(() => ({
  path: "",
  connections: [] as { close: () => void }[],
}));
vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => {
    const db = new DatabaseSync(context.path);
    context.connections.push(db);
    const connection = {
      execAsync: async (sql: string) => db.exec(sql),
      runAsync: async (sql: string, ...params: (string | number)[]) =>
        db.prepare(sql).run(...params),
      getAllAsync: async (sql: string, ...params: string[]) =>
        db.prepare(sql).all(...params),
      getFirstAsync: async (sql: string, ...params: string[]) =>
        db.prepare(sql).get(...params),
      withExclusiveTransactionAsync: async (
        action: (tx: any) => Promise<void>,
      ) => {
        const isolated = new DatabaseSync(context.path);
        try {
          isolated.exec("BEGIN IMMEDIATE");
          await action({
            runAsync: async (sql: string, ...params: (string | number)[]) =>
              isolated.prepare(sql).run(...params),
            getFirstAsync: async (sql: string, ...params: string[]) =>
              isolated.prepare(sql).get(...params),
          });
          isolated.exec("COMMIT");
        } catch (error) {
          if (isolated.isTransaction) isolated.exec("ROLLBACK");
          throw error;
        } finally {
          isolated.close();
        }
      },
    };
    return connection;
  },
}));
let directory = "";
afterEach(() => {
  for (const db of context.connections) db.close();
  context.connections = [];
  if (directory) rmSync(directory, { recursive: true, force: true });
  vi.resetModules();
});
it("atomically updates native account caches and rolls back failed mutations without touching legacy keys", async () => {
  directory = mkdtempSync(join(tmpdir(), "stravakinda-atomic-test-"));
  context.path = join(directory, "atomic.db");
  const db = await import("../services/database");
  await db.setValue("routes", [{ id: "legacy", unknown: "preserve" }]);
  const key = "account-routes:v1:fixture";
  await Promise.all([
    db.updateValue<Record<string, string>>(key, (value) => ({
      ...value,
      a: "pending",
    })),
    db.updateValue<Record<string, string>>(key, (value) => ({
      ...value,
      b: "pending",
    })),
  ]);
  expect(await db.getValue(key)).toEqual({ a: "pending", b: "pending" });
  const blocker = new DatabaseSync(context.path);
  blocker.exec("BEGIN IMMEDIATE");
  try {
    await expect(
      db.updateValue(key, () => ({ lost: "must not commit" })),
    ).rejects.toThrow("route was not saved");
  } finally {
    blocker.exec("ROLLBACK");
    blocker.close();
  }
  expect(await db.getValue(key)).toEqual({ a: "pending", b: "pending" });
  await expect(
    db.updateValue(key, () => {
      throw new Error("Fixture callback failed");
    }),
  ).rejects.toThrow("Fixture callback failed");
  expect(await db.getValue(key)).toEqual({ a: "pending", b: "pending" });
  expect(await db.getValue("routes")).toEqual([
    { id: "legacy", unknown: "preserve" },
  ]);
  vi.resetModules();
  expect(await (await import("../services/database")).getValue(key)).toEqual({
    a: "pending",
    b: "pending",
  });
});
it("reopens native planned routes from disk without changing legacy metadata", async () => {
  directory = mkdtempSync(join(tmpdir(), "stravakinda-test-"));
  context.path = join(directory, "routes.db");
  let plans = await import("../services/planned-routes");
  const plan = createPlan(
    "Native fixture",
    [
      waypoint({ latitude: 0, longitude: 0 }),
      waypoint({ latitude: 0, longitude: 1 }),
    ],
    "native",
    null,
  );
  await plans.savePlan(plan);
  for (const db of context.connections) db.close();
  context.connections = [];
  vi.resetModules();
  plans = await import("../services/planned-routes");
  expect(await plans.loadPlans()).toEqual([plan]);
});
it("persists workouts and preferences across connection restarts, then deletes", async () => {
  directory = mkdtempSync(join(tmpdir(), "stravakinda-test-"));
  context.path = join(directory, "test.db");
  let repository = await import("../services/database");
  const w: Workout = {
    id: "persistent",
    title: "Real persistence test",
    description: "",
    sport: "walking",
    visibility: "private",
    startedAt: 1000,
    endedAt: null,
    state: "paused",
    activeMs: 5000,
    resumedAt: null,
    segment: 0,
    rejected: 0,
    points: [
      {
        latitude: 0,
        longitude: 0,
        accuracy: 3,
        altitude: null,
        altitudeAccuracy: null,
        timestamp: 1000,
        segment: 0,
      },
    ],
  };
  await repository.serial(() => repository.writeWorkout(w));
  await repository.setValue("units", "mi");
  vi.resetModules();
  repository = await import("../services/database");
  expect(await repository.readWorkouts()).toEqual([w]);
  expect(await repository.getValue("units")).toBe("mi");
  await repository.setValue("deleted:pending", true);
  await repository.setValue("deleted:finished", "confirmed");
  expect(await repository.pendingDeletionIds()).toEqual(["pending"]);
  await repository.deleteWorkout(w.id);
  expect(await repository.readWorkouts()).toEqual([]);
});
it("serializes overlapping writes and recovers the queue after failure", async () => {
  const { serial } = await import("../services/database");
  const order: number[] = [];
  await Promise.all([
    serial(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push(1);
    }),
    serial(async () => {
      order.push(2);
    }),
  ]);
  await expect(
    serial(async () => {
      throw new Error("disk unavailable");
    }),
  ).rejects.toThrow("disk unavailable");
  await serial(async () => {
    order.push(3);
  });
  expect(order).toEqual([1, 2, 3]);
});

it("persists organizer plans and private profile through SQLite disk reopen without changing workouts or preferences", async () => {
  directory = mkdtempSync(join(tmpdir(), "stravakinda-test-"));
  context.path = join(directory, "organizer.db");
  let organizer = await import("../features/organizer/repository");
  const database = await import("../services/database");
  await database.setValue("units", "mi");
  const draft = {
    ...emptyEventDraft(),
    id: "isolated-sqlite-plan",
    title: "Test organizer plan",
    location: "Test venue",
    date: "2027-04-10",
    schedule: "06:00 briefing",
  };
  await organizer.updateWorkspace("test-account", (w) => ({
    ...w,
    drafts: [draft],
    profile: {
      ...w.profile,
      name: "Test organizer",
      email: "private@example.test",
      sports: ["Hiking"],
    },
  }));
  for (const db of context.connections) db.close();
  context.connections = [];
  vi.resetModules();
  organizer = await import("../features/organizer/repository");
  const reopened = await organizer.loadWorkspace("test-account");
  expect(reopened.drafts).toEqual([draft]);
  expect(reopened.profile.email).toBe("private@example.test");
  expect((await organizer.loadWorkspace()).drafts).toEqual([]);
  const reopenedDatabase = await import("../services/database");
  expect(await reopenedDatabase.readWorkouts()).toEqual([]);
  expect(await reopenedDatabase.getValue("units")).toBe("mi");
  await organizer.updateWorkspace("test-account", (w) => ({
    ...w,
    drafts: [],
  }));
  expect((await organizer.loadWorkspace("test-account")).profile.name).toBe(
    "Test organizer",
  );
});

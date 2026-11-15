import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Workout } from "../types/activity";
import { emptyEventDraft } from "../features/organizer/drafts";
const context = vi.hoisted(() => ({
  path: "",
  connections: [] as { close: () => void }[],
}));
vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => {
    const db = new DatabaseSync(context.path);
    context.connections.push(db);
    return {
      execAsync: async (sql: string) => db.exec(sql),
      runAsync: async (sql: string, ...params: (string | number)[]) =>
        db.prepare(sql).run(...params),
      getAllAsync: async (sql: string, ...params: string[]) =>
        db.prepare(sql).all(...params),
      getFirstAsync: async (sql: string, ...params: string[]) =>
        db.prepare(sql).get(...params),
    };
  },
}));
let directory = "";
afterEach(() => {
  for (const db of context.connections) db.close();
  context.connections = [];
  if (directory) rmSync(directory, { recursive: true, force: true });
  vi.resetModules();
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

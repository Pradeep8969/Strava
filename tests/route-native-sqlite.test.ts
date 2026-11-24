import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it, vi } from "vitest";
import { createPlan, waypoint } from "../features/routes/planner";
import {
  findRouteGuide,
  parseRouteGuide,
  recorderGuideLocation,
} from "../features/routes/guide";

const native = vi.hoisted(() => ({
  open: vi.fn(),
}));
vi.mock("expo-sqlite", () => ({ openDatabaseAsync: native.open }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "test-mutation" }));

it("reopens offline routes and edited copies through the native adapter after restarting SQLite", async () => {
  const directory = mkdtempSync(join(tmpdir(), "stravakinda-test-"));
  let connection: DatabaseSync | undefined;
  native.open.mockImplementation(async (filename: string) => {
    const db = new DatabaseSync(join(directory, filename));
    connection = db;
    const adapter = {
      execAsync: async (sql: string) => db.exec(sql),
      runAsync: async (sql: string, ...args: string[]) =>
        db.prepare(sql).run(...args),
      getFirstAsync: async (sql: string, ...args: string[]) =>
        db.prepare(sql).get(...args),
    };
    return {
      ...adapter,
      withExclusiveTransactionAsync: async (
        run: (tx: typeof adapter) => Promise<void>,
      ) => {
        db.exec("BEGIN IMMEDIATE");
        try {
          await run(adapter);
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      },
    };
  });
  try {
    const id = "11111111-1111-4111-8111-111111111111";
    const points = [
      waypoint({ latitude: 27.7, longitude: 85.3 }),
      waypoint({ latitude: 27.71, longitude: 85.31 }),
    ];
    const plan = createPlan("Offline route", points, id, null);
    const legacy = {
      id: "legacy",
      title: "Legacy route",
      points,
      extra: "keep",
    };
    const storage = await import("../services/database");
    await storage.setValue("routes", [legacy]);
    const library = await import("../services/planned-routes");
    await library.savePlan(plan);
    const opened = (await library.inspectSavedPlans()).plans.find(
      (route) => route.id === id,
    )!;
    expect(opened.geometry.coordinates).toEqual([
      [85.3, 27.7],
      [85.31, 27.71],
    ]);
    const copy = createPlan(
      "Edited copy",
      [...opened.points, waypoint({ latitude: 27.72, longitude: 85.32 })],
      "edited",
      null,
    );
    await library.savePlan(copy);
    const cloud = await import("../services/route-cloud");
    await cloud.queueAccountRoute("account-a", {
      ...plan,
      title: "Private account route",
    });

    connection!.close();
    connection = undefined;
    vi.resetModules();

    const restarted = await import("../services/planned-routes");
    const plans = (await restarted.inspectSavedPlans()).plans;
    const reference = parseRouteGuide(
      recorderGuideLocation(plan, "walking").params.guide,
    );
    expect(findRouteGuide(plans, reference)).toEqual(plan);
    expect(plans.find((route) => route.id === "edited")).toEqual(copy);
    const restartedStorage = await import("../services/database");
    expect(await restartedStorage.getValue("routes")).toEqual([
      legacy,
      plan,
      copy,
    ]);
    const restartedCloud = await import("../services/route-cloud");
    const accountCache = await restartedCloud.readAccountRoutes("account-a");
    const accountGuide = { ...accountCache[id].plan, accountId: "account-a" };
    const accountReference = parseRouteGuide(
      recorderGuideLocation(accountGuide, "walking").params.guide,
    );
    expect(
      findRouteGuide([accountGuide, ...plans], accountReference, "account-a"),
    ).toEqual(accountGuide);
    expect(
      findRouteGuide([accountGuide, ...plans], accountReference, "account-b"),
    ).toBeUndefined();
    expect(
      (await restartedCloud.readAccountRoutes("account-a"))[id].plan.title,
    ).toBe("Private account route");
    expect(await restartedCloud.readAccountRoutes("account-b")).toEqual({});
    expect(native.open).toHaveBeenCalledTimes(2);
  } finally {
    connection?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

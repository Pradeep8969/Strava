import { describe, expect, it } from "vitest";
import { createPlan, waypoint } from "../features/routes/planner";
import {
  reconcileRoutes,
  type CloudRoute,
  type RouteCache,
  type RouteEntry,
  type RouteTransport,
} from "../features/routes/cloud-sync";

const id = "10000000-0000-4000-8000-000000000001";
const plan = (title = "Private fixture") =>
  createPlan(
    title,
    [
      waypoint({ latitude: 27.123456789, longitude: 85.123456789 }),
      waypoint({ latitude: 27.2, longitude: 85.2 }),
    ],
    id,
    "2026-11-16T00:00:00Z",
  );
const pending = (title?: string): RouteEntry => ({
  plan: plan(title),
  revision: 0,
  mutation: "operation-1",
  deleted: false,
  status: "pending",
});
function fixture() {
  const rows = new Map<string, CloudRoute>();
  let offline = false,
    loseResponse = false,
    writes = 0;
  const transport: RouteTransport = {
    async write(entry) {
      if (offline) throw new Error("offline");
      const previous = rows.get(entry.plan.id);
      if (previous?.mutation_id === entry.mutation)
        return structuredClone(previous);
      if (previous?.deleted_at || (previous?.revision ?? 0) !== entry.revision)
        return null;
      const row: CloudRoute = {
        id: entry.plan.id,
        user_id: "athlete",
        plan: structuredClone(entry.plan),
        revision: (previous?.revision ?? 0) + 1,
        mutation_id: entry.mutation,
        deleted_at: entry.deleted ? "2026-11-16T00:00:00Z" : null,
      };
      rows.set(row.id, row);
      writes++;
      if (loseResponse) {
        loseResponse = false;
        throw new Error("response lost");
      }
      return structuredClone(row);
    },
    async read() {
      if (offline) throw new Error("offline");
      return structuredClone([...rows.values()]);
    },
  };
  const sync = async (cache: RouteCache, current = () => true) =>
    reconcileRoutes("athlete", cache, transport, async () => {}, current);
  return {
    rows,
    transport,
    sync,
    offline: (value: boolean) => (offline = value),
    loseResponse: () => (loseResponse = true),
    writes: () => writes,
  };
}
describe("account route repository used by web, Android and iOS", () => {
  it.each([
    ["Edge", "Brave"],
    ["Brave", "Edge"],
    ["Android", "iOS"],
  ])(
    "%s creates and %s receives the same precise geometry; restart restores cache",
    async () => {
      const f = fixture(),
        source: RouteCache = { [id]: pending() },
        target: RouteCache = {};
      await f.sync(source);
      await f.sync(target);
      expect(target[id].plan).toEqual(source[id].plan);
      const restarted = JSON.parse(JSON.stringify(target));
      f.offline(true);
      expect(restarted[id].plan.points[0].longitude).toBe(85.123456789);
      expect(restarted[id].status).toBe("synced");
    },
  );
  it("offline writes remain queued; reconnect and repeated reconciliation upload once", async () => {
    const f = fixture(),
      cache: RouteCache = { [id]: pending() };
    f.offline(true);
    await expect(f.sync(cache)).rejects.toThrow();
    expect(cache[id].status).toBe("failed");
    f.offline(false);
    await f.sync(cache);
    await f.sync(cache);
    expect(f.writes()).toBe(1);
    expect(Object.keys(cache)).toEqual([id]);
  });
  it("lost successful upload response retries idempotently", async () => {
    const f = fixture(),
      cache: RouteCache = { [id]: pending() };
    f.loseResponse();
    await f.sync(cache);
    await f.sync(cache);
    expect(f.writes()).toBe(1);
    expect(cache[id].status).toBe("synced");
  });
  it("concurrent edits preserve losing copy without overwriting newer geometry", async () => {
    const f = fixture(),
      a: RouteCache = { [id]: pending() },
      b: RouteCache = {};
    await f.sync(a);
    await f.sync(b);
    a[id] = {
      ...a[id],
      plan: plan("newer"),
      mutation: "edit-a",
      status: "pending",
    };
    b[id] = {
      ...b[id],
      plan: plan("losing edit"),
      mutation: "edit-b",
      status: "pending",
    };
    await f.sync(a);
    await f.sync(b);
    await f.sync(b);
    expect(b[id].status).toBe("conflict");
    expect(b[id].plan.title).toBe("losing edit");
    expect(b[id].remote?.plan.title).toBe("newer");
    expect(f.rows.get(id)?.plan.title).toBe("newer");
  });
  it("tombstones download and stale edits cannot resurrect deleted routes", async () => {
    const f = fixture(),
      a: RouteCache = { [id]: pending() },
      b: RouteCache = {},
      c: RouteCache = {};
    await f.sync(a);
    await f.sync(b);
    a[id] = { ...a[id], deleted: true, mutation: "delete", status: "pending" };
    await f.sync(a);
    await f.sync(c);
    expect(c[id].deleted).toBe(true);
    b[id] = { ...b[id], mutation: "stale-edit", status: "pending" };
    await f.sync(b);
    expect(b[id].status).toBe("conflict");
    expect(b[id].remote?.deleted_at).toBeTruthy();
    expect(f.writes()).toBe(2);
  });
  it("logout cancels work and other-user geometry never enters cache", async () => {
    const f = fixture(),
      cache: RouteCache = { [id]: pending() };
    await f.sync(cache, () => false);
    expect(f.writes()).toBe(0);
    await f.sync(cache);
    f.rows.get(id)!.user_id = "other-athlete";
    const other: RouteCache = {};
    await expect(f.sync(other)).rejects.toThrow("owner");
    expect(other).toEqual({});
  });
});

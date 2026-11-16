import { beforeEach, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { createPlan, waypoint } from "../features/routes/planner";
import {
  queueAccountRoute,
  readAccountRoutes,
  syncAccountRoutes,
} from "../services/route-cloud";
const f = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  write: vi.fn(),
  read: vi.fn(),
  counter: 0,
  clients: [] as unknown[],
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => `mutation-${++f.counter}` }));
vi.mock("../services/database", () => {
  let pending: Promise<unknown> = Promise.resolve();
  return {
    updateValue: (key: string, update: (value: unknown) => unknown) => {
      const next = pending.then(() => {
        const value = update(structuredClone(f.values.get(key) ?? null));
        f.values.set(key, structuredClone(value));
        return value;
      });
      pending = next.catch(() => {});
      return next;
    },
    getValue: async (key: string) => structuredClone(f.values.get(key) ?? null),
    setValue: async (key: string, value: unknown) => {
      f.values.set(key, structuredClone(value));
    },
    serial: (action: () => Promise<unknown>) => {
      const next = pending.then(action);
      pending = next.catch(() => {});
      return next;
    },
  };
});
vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options: unknown) => {
    f.clients.push(options);
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      range: () => f.read(),
    };
    return { rpc: (...args: unknown[]) => f.write(...args), from: () => query };
  },
}));
const id = "10000000-0000-4000-8000-000000000011";
const plan = (title = "Fixture") =>
  createPlan(
    title,
    [
      waypoint({ latitude: 0, longitude: 0 }),
      waypoint({ latitude: 0, longitude: 1 }),
    ],
    id,
    null,
  );
const session = (user = "athlete") =>
  ({ user: { id: user }, access_token: `${user}-token` }) as Session;
beforeEach(() => {
  f.values.clear();
  f.clients.length = 0;
  f.write.mockReset();
  f.read.mockReset();
  f.read.mockResolvedValue({ data: [], error: null });
});
it("keeps legacy values intact and never uploads them or another account's cache", async () => {
  const legacy = [
    { ...plan(), unknownMetadata: "preserve" },
    { invalid: "preserve too" },
  ];
  f.values.set("routes", structuredClone(legacy));
  await queueAccountRoute("other", plan());
  await syncAccountRoutes(session(), () => true);
  expect(f.write).not.toHaveBeenCalled();
  expect(f.values.get("routes")).toEqual(legacy);
  expect(await readAccountRoutes("athlete")).toEqual({});
  expect((await readAccountRoutes("other"))[id].status).toBe("pending");
});
it("persists before networking and isolates same route IDs by user", async () => {
  await queueAccountRoute("athlete", plan("A"));
  await queueAccountRoute("other", plan("B"));
  expect(f.write).not.toHaveBeenCalled();
  expect((await readAccountRoutes("athlete"))[id].plan.title).toBe("A");
  expect((await readAccountRoutes("other"))[id].plan.title).toBe("B");
});
it("does not block local saves on network requests or acknowledge an edit made during upload", async () => {
  await queueAccountRoute("athlete", plan());
  let finish!: (value: unknown) => void;
  f.write.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const job = syncAccountRoutes(session(), () => true);
  await vi.waitFor(() => expect(f.write).toHaveBeenCalledOnce());
  const expected = (await readAccountRoutes("athlete"))[id].mutation;
  await queueAccountRoute(
    "athlete",
    plan("Edited while uploading"),
    false,
    expected,
  );
  const operation = f.write.mock.calls[0][1];
  finish({
    data: [
      {
        id,
        user_id: "athlete",
        plan: plan(),
        revision: 1,
        mutation_id: operation.operation_id,
        deleted_at: null,
      },
    ],
    error: null,
  });
  await job;
  expect((await readAccountRoutes("athlete"))[id]).toMatchObject({
    status: "pending",
    revision: 1,
    plan: { title: "Edited while uploading" },
  });
  expect(f.clients[0]).toMatchObject({
    global: { headers: { Authorization: "Bearer athlete-token" } },
    auth: { persistSession: false },
  });
});
it("ignores in-flight results after logout without discarding the pending queue", async () => {
  await queueAccountRoute("athlete", plan());
  let active = true;
  f.write.mockImplementation(async () => {
    active = false;
    return { data: [], error: null };
  });
  await syncAccountRoutes(session(), () => active);
  expect((await readAccountRoutes("athlete"))[id].status).toBe("pending");
});
it("rejects stale same-route edits and deletes without replacing the winning pending operation", async () => {
  await queueAccountRoute("athlete", plan());
  const original = (await readAccountRoutes("athlete"))[id].mutation;
  await queueAccountRoute("athlete", plan("Winner"), false, original);
  const before = await readAccountRoutes("athlete");
  await expect(
    queueAccountRoute("athlete", plan("Stale"), false, original),
  ).rejects.toThrow("changed in another tab");
  await expect(
    queueAccountRoute("athlete", plan(), true, original),
  ).rejects.toThrow("changed in another tab");
  await expect(queueAccountRoute("athlete", plan("No token"))).rejects.toThrow(
    "changed in another tab",
  );
  expect(await readAccountRoutes("athlete")).toEqual(before);
});
it("preserves a malformed account cache instead of replacing it with a new route", async () => {
  f.values.set("account-routes:v1:athlete", ["preserve malformed data"]);
  await expect(queueAccountRoute("athlete", plan())).rejects.toThrow(
    "needs recovery",
  );
  expect(f.values.get("account-routes:v1:athlete")).toEqual([
    "preserve malformed data",
  ]);
});

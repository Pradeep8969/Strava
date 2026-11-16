import { expect, test, type Page } from "@playwright/test";
import {
  createPlan,
  waypoint,
  type PlannedRoute,
} from "../../features/routes/planner";
import {
  atomicCache,
  atomicOther,
  atomicOwner,
  installAtomicRepository,
} from "../fixtures/route-atomic-repository";

const plan = (index: number, title = `Fixture ${index}`) =>
  createPlan(
    title,
    [
      waypoint({ latitude: 27.123456789, longitude: 85.123456789 }),
      waypoint({ latitude: 27.2, longitude: 85.2 }),
    ],
    `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    null,
  );
async function save(
  page: Page,
  route: PlannedRoute,
  deleted = false,
  expected?: string,
) {
  return page.evaluate(
    async ({ route, deleted, expected, user }) => {
      try {
        await window.__atomic.repo.queueAccountRoute(
          user,
          route,
          deleted,
          expected,
        );
        return "saved";
      } catch (error) {
        return (error as Error).message;
      }
    },
    { route, deleted, expected, user: atomicOwner },
  );
}
test.beforeEach(async ({ page }) => {
  await page.goto("/routes");
  await installAtomicRepository(page);
});
async function another(page: Page) {
  const other = await page.context().newPage();
  await other.goto("/routes");
  await installAtomicRepository(other);
  return other;
}

test("lockless tabs retain simultaneous offline creates and independent edits after close/reload", async ({
  page,
}) => {
  const other = await another(page);
  expect(await page.evaluate(() => navigator.locks)).toBeUndefined();
  const results = await Promise.all([
    save(page, plan(1)),
    save(other, plan(2)),
  ]);
  expect(results).toEqual(["saved", "saved"]);
  let cache = await atomicCache(page);
  expect(Object.keys(cache)).toHaveLength(2);
  expect(
    await Promise.all([
      save(page, plan(1, "Edited A"), false, cache[plan(1).id].mutation),
      save(other, plan(2, "Edited B"), false, cache[plan(2).id].mutation),
    ]),
  ).toEqual(["saved", "saved"]);
  await other.evaluate((user) => window.__atomic.start(user), atomicOwner);
  await expect
    .poll(() => other.evaluate(() => window.__atomic.writes.length))
    .toBe(1);
  await other.close(); // accepted local writes survive closure during a pending upload
  await page.reload();
  await installAtomicRepository(page);
  cache = await atomicCache(page);
  expect(
    Object.values(cache)
      .map((e) => e.plan.title)
      .sort(),
  ).toEqual(["Edited A", "Edited B"]);
  expect(Object.values(cache).every((e) => e.status === "pending")).toBe(true);
});

test("same-route stale edits and deletes reject clearly instead of overwriting", async ({
  page,
}) => {
  const other = await another(page);
  await save(page, plan(1));
  const expected = (await atomicCache(page))[plan(1).id].mutation;
  const results = await Promise.all([
    save(page, plan(1, "Edit A"), false, expected),
    save(other, plan(1, "Edit B"), false, expected),
  ]);
  expect(results.filter((r) => r === "saved")).toHaveLength(1);
  expect(results.find((r) => r !== "saved")).toContain(
    "changed in another tab",
  );
  let cache = await atomicCache(page);
  const winner = cache[plan(1).id];
  const race = await Promise.all([
    save(page, plan(1), true, winner.mutation),
    save(other, plan(1, "Next edit"), false, winner.mutation),
  ]);
  expect(race.filter((r) => r === "saved")).toHaveLength(1);
  expect(race.find((r) => r !== "saved")).toContain("changed in another tab");
  cache = await atomicCache(page);
  expect(Object.keys(cache)).toHaveLength(1);
  expect(
    await save(other, plan(1, "Stale restore"), false, winner.mutation),
  ).toContain("changed in another tab");
});

test("delayed acknowledgement preserves new routes, edits and pending deletions across tabs", async ({
  page,
}) => {
  const other = await another(page);
  await save(page, plan(1));
  await page.evaluate((user) => window.__atomic.start(user), atomicOwner);
  await expect
    .poll(() => page.evaluate(() => window.__atomic.writes.length))
    .toBe(1);
  const expected = (await atomicCache(other))[plan(1).id].mutation;
  expect(
    await save(other, plan(1, "Offline newer edit"), false, expected),
  ).toBe("saved");
  expect(await save(other, plan(2))).toBe("saved");
  await page.evaluate(() => window.__atomic.ack(0));
  await page.evaluate(() => window.__atomic.jobs[0]);
  let cache = await atomicCache(page);
  expect(Object.keys(cache)).toHaveLength(2);
  expect(cache[plan(1).id]).toMatchObject({
    revision: 1,
    status: "pending",
    plan: { title: "Offline newer edit" },
  });
  await page.evaluate((user) => window.__atomic.start(user), atomicOwner);
  await expect
    .poll(() => page.evaluate(() => window.__atomic.writes.length))
    .toBe(2);
  cache = await atomicCache(other);
  expect(await save(other, plan(1), true, cache[plan(1).id].mutation)).toBe(
    "saved",
  );
  await page.evaluate(() => window.__atomic.ack(1));
  // The same job then uploads the other queued route.
  await expect
    .poll(() => page.evaluate(() => window.__atomic.writes.length))
    .toBe(3);
  await page.evaluate(() => window.__atomic.ack(2));
  await page.evaluate(() => window.__atomic.jobs[1]);
  cache = await atomicCache(page);
  expect(cache[plan(1).id]).toMatchObject({
    revision: 2,
    deleted: true,
    status: "pending",
    plan: { title: "Offline newer edit" },
  });
  expect(cache[plan(2).id].status).toBe("synced");
});

test("a failed stale sync cannot downgrade another tab's successful acknowledgement", async ({
  page,
}) => {
  const other = await another(page);
  await save(page, plan(1));
  await Promise.all([
    page.evaluate((user) => window.__atomic.start(user), atomicOwner),
    other.evaluate((user) => window.__atomic.start(user), atomicOwner),
  ]);
  for (const tab of [page, other])
    await expect
      .poll(() => tab.evaluate(() => window.__atomic.writes.length))
      .toBe(1);
  await other.evaluate(() => window.__atomic.ack(0));
  await other.evaluate(() => window.__atomic.jobs[0]);
  await page.evaluate(() => window.__atomic.fail(0));
  await page.evaluate(() => window.__atomic.jobs[0]);
  expect((await atomicCache(page))[plan(1).id]).toMatchObject({
    revision: 1,
    status: "synced",
  });
});

test("account invalidation isolates an in-flight reply and keeps both account caches", async ({
  page,
}) => {
  const other = await another(page);
  await save(page, plan(1));
  await page.evaluate((user) => window.__atomic.start(user), atomicOwner);
  await expect
    .poll(() => page.evaluate(() => window.__atomic.writes.length))
    .toBe(1);
  await page.evaluate(() => {
    window.__atomic.active = false;
  });
  await other.evaluate(
    ({ user, route }) => window.__atomic.repo.queueAccountRoute(user, route),
    { user: atomicOther, route: plan(2) },
  );
  await page.evaluate(() => window.__atomic.ack(0));
  await page.evaluate(() => window.__atomic.jobs[0]);
  expect((await atomicCache(page))[plan(1).id].status).toBe("pending");
  expect(Object.keys(await atomicCache(page, atomicOther))).toEqual([
    plan(2).id,
  ]);
});

test("quota errors, transaction aborts and thrown callbacks roll back without reporting success", async ({
  page,
}) => {
  await save(page, plan(1));
  const before = await atomicCache(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Fixture quota", "QuotaExceededError");
    };
    (window as any).__restorePut = () => {
      IDBObjectStore.prototype.put = original;
    };
  });
  expect(await save(page, plan(2))).toContain("route was not saved");
  await page.evaluate(() => (window as any).__restorePut());
  expect(await atomicCache(page)).toEqual(before);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<typeof original>
    ) {
      const request = original.apply(this, args);
      this.transaction.abort();
      return request;
    };
    (window as any).__restorePut = () => {
      IDBObjectStore.prototype.put = original;
    };
  });
  expect(await save(page, plan(2))).toContain("route was not saved");
  await page.evaluate(() => (window as any).__restorePut());
  expect(await atomicCache(page)).toEqual(before);
  const error = await page.evaluate(async (user) => {
    try {
      await window.__atomic.db.updateValue(`account-routes:v1:${user}`, () => {
        throw new Error("Fixture callback failed");
      });
      return "saved";
    } catch (e) {
      return (e as Error).message;
    }
  }, atomicOwner);
  expect(error).toBe("Fixture callback failed");
  expect(await atomicCache(page)).toEqual(before);
  expect(await save(page, plan(2))).toBe("saved");
});

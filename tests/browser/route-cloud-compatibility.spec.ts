import { expect, test } from "@playwright/test";
import {
  changeFixtureAccount,
  otherOwner,
  owner,
  placeFixturePlan,
  readFixtureCache,
  routeCloudBackend,
} from "../fixtures/route-cloud-backend";

test("IndexedDB, restored sessions, offline queue, reconnect, account isolation and duplicate prevention", async ({
  browser,
  baseURL,
}) => {
  const cloud = routeCloudBackend(),
    first = await browser.newContext(),
    second = await browser.newContext();
  try {
    const connection = await cloud.install(first);
    await cloud.install(second);
    const a = await first.newPage(),
      b = await second.newPage();
    await a.goto(`${baseURL}/routes`);
    await expect(
      a.getByRole("button", { name: "Save route", exact: true }),
    ).toBeVisible();
    connection.offline = true;
    await first.setOffline(true);
    await placeFixturePlan(a, "Offline fixture");
    await expect
      .poll(async () => Object.values(await readFixtureCache(a)).length)
      .toBe(1);
    expect(cloud.rows.size).toBe(0);
    // Transport retry duration differs by engine. Pending and failed are both
    // correct durable offline states; neither may be acknowledged as synced.
    expect(Object.values(await readFixtureCache(a))[0].status).toMatch(
      /pending|failed/,
    );
    connection.offline = false;
    await first.setOffline(false);
    await a.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => cloud.rows.size, { timeout: 30000 }).toBe(1);
    await expect(a.getByText("Synced", { exact: true })).toBeVisible();
    await a.getByRole("button", { name: "Retry Sync", exact: true }).click();
    await expect(a.getByText("Synced", { exact: true })).toBeVisible();
    expect(cloud.writes()).toBe(1);
    await b.goto(`${baseURL}/routes`);
    await expect(
      b.getByText("Offline fixture · 2 waypoints", { exact: true }),
    ).toBeVisible();
    expect(
      Object.values(await readFixtureCache(b))[0].plan.points[0].longitude,
    ).toBe(85.123456789);
    // Failed cloud reads after restart do not hide persisted geometry.
    connection.offline = true;
    await a.reload();
    await expect(
      a.getByText("Offline fixture · 2 waypoints", { exact: true }),
    ).toBeVisible();
    await changeFixtureAccount(a, otherOwner);
    await expect(
      a.getByText("Offline fixture · 2 waypoints", { exact: true }),
    ).toHaveCount(0);
    expect(await readFixtureCache(a, otherOwner)).toEqual({});
    await changeFixtureAccount(a, null);
    await expect(
      a.getByRole("button", { name: "Save route offline", exact: true }),
    ).toBeVisible();
    await expect(
      a.getByText("Offline fixture · 2 waypoints", { exact: true }),
    ).toHaveCount(0);
    connection.offline = false;
    await changeFixtureAccount(a, owner);
    await expect(
      a.getByText("Offline fixture · 2 waypoints", { exact: true }),
    ).toBeVisible();
  } finally {
    await first.close();
    await second.close();
  }
});

test("remote edits reconcile, stale edits preserve conflicts, and tombstones propagate", async ({
  context,
  page,
}) => {
  const cloud = routeCloudBackend();
  await cloud.install(context);
  await page.goto("/routes");
  await placeFixturePlan(page, "Original fixture");
  await expect.poll(() => cloud.rows.size).toBe(1);
  const row = [...cloud.rows.values()][0];
  cloud.rows.set(row.id, {
    ...row,
    plan: { ...row.plan, title: "Remote edit fixture" },
    revision: 2,
    mutation_id: "remote-edit",
  });
  await page.getByRole("button", { name: "Retry Sync", exact: true }).click();
  await expect(
    page.getByText("Remote edit fixture · 2 waypoints", { exact: true }),
  ).toBeVisible();
  // The existing UI saves copies. Inject only a controlled stale same-ID edit to
  // exercise repository conflict handling through the normal application coordinator.
  await page.evaluate(
    async ({ id, owner }) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("stravakinda", 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction("kv", "readwrite"),
            store = tx.objectStore("kv"),
            key = `account-routes:v1:${owner}`,
            get = store.get(key);
          get.onsuccess = () => {
            const cache = get.result;
            cache[id] = {
              ...cache[id],
              plan: { ...cache[id].plan, title: "Preserved local edit" },
              revision: 1,
              mutation: crypto.randomUUID(),
              status: "pending",
            };
            store.put(cache, key);
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(new Error("Fixture edit failed"));
        };
      });
    },
    { id: row.id, owner },
  );
  await page.getByRole("button", { name: "Retry Sync", exact: true }).click();
  await expect(page.getByText(/Conflict — local edit preserved/)).toBeVisible();
  expect(cloud.rows.get(row.id)?.plan.title).toBe("Remote edit fixture");
  expect((await readFixtureCache(page))[row.id].plan.title).toBe(
    "Preserved local edit",
  );
  await page
    .getByRole("button", {
      name: "Use cloud version (discard local conflict)",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Remote edit fixture · 2 waypoints", { exact: true }),
  ).toBeVisible();
  cloud.rows.set(row.id, {
    ...cloud.rows.get(row.id)!,
    revision: 3,
    mutation_id: "remote-delete",
    deleted_at: new Date().toISOString(),
  });
  await page.getByRole("button", { name: "Retry Sync", exact: true }).click();
  await expect(
    page.getByText("Remote edit fixture · 2 waypoints", { exact: true }),
  ).toHaveCount(0);
  expect((await readFixtureCache(page))[row.id].deleted).toBe(true);
  await page.reload();
  await expect(
    page.getByText("Remote edit fixture · 2 waypoints", { exact: true }),
  ).toHaveCount(0);
});

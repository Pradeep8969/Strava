import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const host = "https://route-sync-fixture.supabase.co";
const user = {
  id: "00000000-0000-4000-8000-000000000011",
  email: "fixture@example.test",
  aud: "authenticated",
  user_metadata: {},
  app_metadata: {},
  created_at: "2026-11-16T00:00:00Z",
};
type Row = {
  id: string;
  user_id: string;
  plan: unknown;
  revision: number;
  mutation_id: string;
  deleted_at: string | null;
};
async function setup(
  context: BrowserContext,
  cloud: Map<string, Row>,
  failure: { value: boolean },
  writes: { value: number },
) {
  await context.addInitScript(
    ({ user }) => {
      const key = "sb-route-sync-fixture-auth-token";
      if (!sessionStorage.getItem("fixture-initialized")) {
        const token =
          btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) +
          "." +
          btoa(JSON.stringify({ sub: user.id, exp: 4102444800 })) +
          ".fixture";
        localStorage.setItem(
          key,
          JSON.stringify({
            access_token: token,
            refresh_token: "fixture",
            expires_at: 4102444800,
            expires_in: 3600,
            token_type: "bearer",
            user,
          }),
        );
        sessionStorage.setItem("fixture-initialized", "yes");
      }
    },
    { user },
  );
  await context.route("**/*.supabase.co/**", async (route) => {
    if (!route.request().url().startsWith(host)) return route.abort();
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.startsWith("/auth/")) body = user;
    else if (path.endsWith("/rpc/write_planned_route")) {
      if (failure.value)
        return route.fulfill({
          status: 503,
          json: { message: "fixture unavailable" },
        });
      const p = route.request().postDataJSON(),
        old = cloud.get(p.route_id);
      if (old?.mutation_id === p.operation_id) body = [old];
      else if (
        (!old || !old.deleted_at) &&
        (old?.revision ?? 0) === p.expected_revision
      ) {
        const row = {
          id: p.route_id,
          user_id: user.id,
          plan: p.route_plan,
          revision: (old?.revision ?? 0) + 1,
          mutation_id: p.operation_id,
          deleted_at: p.remove_route ? new Date().toISOString() : null,
        };
        cloud.set(row.id, row);
        writes.value++;
        body = [row];
      }
    } else if (path.endsWith("/planned_routes")) {
      if (failure.value)
        return route.fulfill({
          status: 503,
          json: { message: "fixture unavailable" },
        });
      body = [...cloud.values()];
    }
    await route.fulfill({ json: body });
  });
  await context.route("https://unpkg.com/**", (route) =>
    route.fulfill({
      contentType: route.request().url().endsWith(".css")
        ? "text/css"
        : "text/javascript",
      body: route.request().url().endsWith(".css")
        ? ""
        : readFileSync("tests/fixtures/maplibre-adapter.js", "utf8"),
    }),
  );
}
async function save(page: Page, title: string) {
  await expect(page.locator("canvas")).toBeVisible();
  await page.evaluate(() => {
    const map = (
      window as unknown as {
        __mapAdapter: { events: Record<string, ((event: unknown) => void)[]> };
      }
    ).__mapAdapter;
    for (const lng of [85.123456789, 85.2])
      map.events.click.forEach((fn) =>
        fn({ lngLat: { lat: 27.123456789, lng } }),
      );
  });
  await page.getByLabel("Route name", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save route", exact: true }).click();
  await expect(
    page.getByText(`${title} · 2 waypoints`, { exact: true }),
  ).toBeVisible();
}
test("Edge and Brave exchange private routes, retry offline saves, restore cache and sync deletion", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180000);
  const bravePath =
    process.env.BRAVE_PATH ??
    "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
  test.skip(!existsSync(bravePath), "Requires installed Brave (or BRAVE_PATH)");
  const brave = await chromium.launch({
    executablePath: bravePath,
    headless: true,
  });
  const edgeContext = await browser.newContext(),
    braveContext = await brave.newContext();
  const cloud = new Map<string, Row>(),
    failure = { value: false },
    writes = { value: 0 };
  try {
    await setup(edgeContext, cloud, failure, writes);
    await setup(braveContext, cloud, failure, writes);
    const edge = await edgeContext.newPage();
    await edge.goto(`${baseURL}/routes`);
    await save(edge, "Edge fixture");
    await expect.poll(() => cloud.size).toBe(1);
    const other = await braveContext.newPage();
    await other.goto(`${baseURL}/routes`);
    await expect(
      other.getByText("Edge fixture · 2 waypoints", { exact: true }),
    ).toBeVisible();
    failure.value = true;
    await save(other, "Brave offline fixture");
    await expect(
      other.getByText("Sync failed — retry", { exact: true }),
    ).toBeVisible();
    failure.value = false;
    await other
      .getByRole("button", { name: "Retry Sync", exact: true })
      .click();
    await expect.poll(() => cloud.size).toBe(2);
    // An already-active browser discovers changes without manual retry or hints.
    await expect(
      edge.getByText("Brave offline fixture · 2 waypoints", { exact: true }),
    ).toBeVisible({ timeout: 75000 });
    expect(writes.value).toBe(2);
    failure.value = true;
    await other.reload();
    await expect(
      other.getByText("Edge fixture · 2 waypoints", { exact: true }),
    ).toBeVisible();
    failure.value = false;
    await edge
      .getByRole("button", { name: "Delete saved route", exact: true })
      .first()
      .click();
    await expect
      .poll(() => [...cloud.values()].filter((row) => row.deleted_at).length)
      .toBe(1);
    await other.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await expect(
      other.getByText("Edge fixture · 2 waypoints", { exact: true }),
    ).toHaveCount(0);
    await other.evaluate(() => {
      const key = "sb-route-sync-fixture-auth-token";
      const session = JSON.parse(localStorage.getItem(key)!);
      session.user.id = "00000000-0000-4000-8000-000000000012";
      localStorage.setItem(key, JSON.stringify(session));
    });
    await other.reload();
    await expect(
      other.getByText("Brave offline fixture · 2 waypoints", { exact: true }),
    ).toHaveCount(0);
    await other.evaluate(() =>
      localStorage.removeItem("sb-route-sync-fixture-auth-token"),
    );
    await other.reload();
    await expect(
      other.getByText("Brave offline fixture · 2 waypoints", { exact: true }),
    ).toHaveCount(0);
    await expect(
      other.getByRole("button", { name: "Save route offline", exact: true }),
    ).toBeVisible();
  } finally {
    await edgeContext.close();
    await braveContext.close();
    await brave.close();
  }
});

import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import type { CloudRoute } from "../../features/routes/cloud-sync";

export const owner = "00000000-0000-4000-8000-000000000011";
export const otherOwner = "00000000-0000-4000-8000-000000000012";
const sessionKey = "sb-route-sync-fixture-auth-token";
export function fixtureSession(id: string) {
  return {
    access_token: `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64")}.${Buffer.from(JSON.stringify({ sub: id, exp: 4102444800 })).toString("base64")}.fixture`,
    refresh_token: "fixture",
    expires_at: 4102444800,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id,
      email: "fixture@example.test",
      aud: "authenticated",
      user_metadata: {},
      app_metadata: {},
      created_at: "2026-11-16T00:00:00Z",
    },
  };
}
/** Controlled private backend. Never forwards requests to any Supabase project. */
export function routeCloudBackend() {
  const rows = new Map<string, CloudRoute>();
  let writes = 0;
  return {
    rows,
    writes: () => writes,
    async install(context: BrowserContext) {
      const connection = { offline: false };
      await context.addInitScript(
        ({ sessionKey, session }) => {
          if (!sessionStorage.getItem("route-review-initialized")) {
            localStorage.setItem(sessionKey, JSON.stringify(session));
            sessionStorage.setItem("route-review-initialized", "true");
          }
        },
        { sessionKey, session: fixtureSession(owner) },
      );
      await context.route("**/*.supabase.co/**", async (route) => {
        if (
          !route
            .request()
            .url()
            .startsWith("https://route-sync-fixture.supabase.co/")
        )
          return route.abort();
        if (connection.offline) return route.abort("internetdisconnected");
        const jwt = (route.request().headers().authorization ?? "").split(
          " ",
        )[1];
        let id: string | undefined;
        try {
          id = JSON.parse(
            Buffer.from(jwt.split(".")[1], "base64").toString(),
          ).sub;
        } catch {
          /* Anonymous fixture request. */
        }
        const url = new URL(route.request().url());
        if (!id)
          return route.fulfill({
            status: 401,
            json: { message: "Authentication required" },
          });
        if (url.pathname.startsWith("/auth/"))
          return route.fulfill({ json: fixtureSession(id).user });
        let body: unknown = [];
        if (url.pathname.endsWith("/rpc/write_planned_route")) {
          const p = route.request().postDataJSON(),
            previous = rows.get(p.route_id);
          if (previous && previous.user_id !== id) body = [];
          else if (previous?.mutation_id === p.operation_id) body = [previous];
          else if (
            !previous?.deleted_at &&
            (previous?.revision ?? 0) === p.expected_revision
          ) {
            const row: CloudRoute = {
              id: p.route_id,
              user_id: id,
              plan: p.route_plan,
              revision: (previous?.revision ?? 0) + 1,
              mutation_id: p.operation_id,
              deleted_at: p.remove_route ? new Date().toISOString() : null,
            };
            rows.set(row.id, row);
            writes++;
            body = [row];
          }
        } else if (url.pathname.endsWith("/planned_routes")) {
          body =
            url.searchParams.get("user_id") === `eq.${id}`
              ? [...rows.values()].filter((row) => row.user_id === id)
              : [];
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
      return connection;
    },
  };
}
export async function changeFixtureAccount(page: Page, id: string | null) {
  await page.evaluate(
    ({ sessionKey, session }) => {
      if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
      else localStorage.removeItem(sessionKey);
    },
    { sessionKey, session: id ? fixtureSession(id) : null },
  );
  await page.reload();
}
export async function readFixtureCache(page: Page, id = owner) {
  return page.evaluate(async (id) => {
    return await new Promise<
      Record<string, import("../../features/routes/cloud-sync").RouteEntry>
    >((resolve, reject) => {
      const request = indexedDB.open("stravakinda", 1);
      request.onerror = () => reject(new Error("Fixture cache open failed"));
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction("kv", "readonly"),
          value = tx.objectStore("kv").get(`account-routes:v1:${id}`);
        tx.oncomplete = () => {
          db.close();
          resolve(value.result ?? {});
        };
        tx.onerror = () => reject(new Error("Fixture cache read failed"));
      };
    });
  }, id);
}
export async function placeFixturePlan(page: Page, title: string) {
  await page.locator("canvas").waitFor();
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
}

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createPlan, waypoint } from "../../features/routes/planner";

test("Maps keeps discovery, the saved-route library and Route Studio reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Explore" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Maps", exact: true }).click();
  const map = page.getByRole("region", {
    name: "Interactive map of Kathmandu Valley",
  });
  await expect(map).toBeVisible();
  const frame = await map.boundingBox();
  expect(frame?.height).toBeGreaterThan(360);
  await page.getByRole("button", { name: "Route ideas", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Route ideas", expanded: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Route ideas", expanded: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Walking", exact: true }),
  ).toHaveCount(0);
  await expect(map).toBeVisible();
  await page
    .getByRole("button", { name: "Route ideas", expanded: false })
    .click();
  await page.getByRole("radio", { name: "Walking", exact: true }).click();
  await expect(page.getByText("No matching route ideas.")).toBeVisible();
  await page.getByRole("button", { name: "Open Explore" }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(
    page.getByRole("heading", { name: "Discover routes", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Maps", exact: true }).click();
  await page
    .getByRole("button", { name: "Open saved-route library", exact: true })
    .click();
  await expect(page).toHaveURL(/\/saved-routes$/);
  await page.goBack();
  await page.getByRole("button", { name: "Create route", exact: true }).click();
  await expect(page).toHaveURL(/\/routes\?from=maps$/);
  await expect(
    page.getByRole("heading", { name: "Route Studio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save route offline", exact: true }),
  ).toBeDisabled();
});

test("Maps keeps search offline and applies explicit camera actions to real saved geometry", async ({
  page,
}) => {
  test.skip(
    process.env.MAP_ADAPTER_TEST !== "true",
    "Requires the local map adapter export",
  );
  await page.route("https://unpkg.com/**", (route) => {
    const css = route.request().url().endsWith(".css");
    return route.fulfill({
      contentType: css ? "text/css" : "text/javascript",
      body: css
        ? ""
        : readFileSync("tests/fixtures/maplibre-adapter.js", "utf8"),
    });
  });
  await page.route("https://api.maptiler.com/**", (route) => route.abort());
  const geocoding: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/geocoding/")) geocoding.push(request.url());
  });
  const plan = createPlan(
    "Valley fixture",
    [
      waypoint({ latitude: 27.71, longitude: 85.31 }),
      waypoint({ latitude: 27.72, longitude: 85.32 }),
    ],
    "valley-fixture",
    null,
  );
  await page.goto("/");
  await page.evaluate(
    (plan) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("stravakinda", 1);
        open.onupgradeneeded = () => {
          open.result.createObjectStore("workouts", { keyPath: "id" });
          open.result.createObjectStore("kv");
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put([plan], "routes");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    plan,
  );
  await page.getByRole("tab", { name: "Maps", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reset map to north" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Reset map to north" }).click();
  const adapter = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __mapAdapter: {
              center: number[];
              cameraCalls: { type: string }[];
              sources: {
                routes: { data: { features: { geometry: unknown }[] } };
              };
            };
          }
        ).__mapAdapter,
    );
  expect((await adapter()).cameraCalls.at(-1)?.type).toBe("north");
  const search = () =>
    page.getByRole("button", { name: "Search maps", exact: true }).click();
  await search();
  const input = page.getByRole("textbox", { name: "Search within Maps" });
  await input.fill("Thamel");
  await expect(
    page.getByRole("button", { name: "Thamel", exact: true }),
  ).toBeVisible();
  await input.fill("New Road");
  await expect(
    page.getByRole("button", { name: "Thamel", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("No matching landmarks. Try coordinates."),
  ).toBeVisible();
  await input.fill("27.7043, 85.3076");
  await page
    .getByRole("button", { name: "27.7043, 85.3076", exact: true })
    .click();
  expect((await adapter()).center).toEqual([85.3076, 27.7043]);
  await search();
  await page.getByRole("radio", { name: "Saved", exact: true }).click();
  await input.fill("Valley");
  await page
    .getByRole("button", { name: "Valley fixture", exact: true })
    .click();
  const fixturePreview = page.getByRole("button", {
    name: "Preview saved route Valley fixture",
  });
  await expect(fixturePreview).toBeVisible();
  await expect(page.getByText(/Straight-line plan/)).toBeVisible();
  await expect
    .poll(
      async () => (await adapter()).sources.routes.data.features[0]?.geometry,
    )
    .toEqual(plan.geometry);
  await page.getByRole("button", { name: "Fit map to route" }).click();
  expect((await adapter()).cameraCalls.at(-1)?.type).toBe("fit");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __mapConstructions: number })
          .__mapConstructions,
    ),
  ).toBe(1);
  await fixturePreview.click();
  await page.getByRole("button", { name: "Walking", exact: true }).click();
  await expect(page).toHaveURL(/\/record(?:\?|$)/);
  await page.getByRole("tab", { name: "Maps", exact: true }).click();
  const create = page.getByRole("button", {
    name: "Create route",
    exact: true,
  });
  await create.click();
  const title = page.getByLabel("Route name", { exact: true });
  await title.fill("Unsaved walking draft");
  await page.goBack();
  await create.click();
  await expect(title).toHaveValue("Unsaved walking draft");
  expect(geocoding).toEqual([]);
});

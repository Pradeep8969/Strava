import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("Explore opens My Saved Routes directly and distinguishes route search", async ({
  page,
}) => {
  await page.goto("/explore");
  const search = page.getByRole("textbox", { name: "Search routes" });
  await expect(search).toHaveAttribute("placeholder", "Search routes");
  await search.fill("Unknown fixture street");
  await expect(page.getByText("No matching saved routes")).toBeVisible();
  await expect(page.getByText("No matching route ideas")).toBeVisible();
  await page
    .getByRole("button", { name: "My saved routes", exact: true })
    .click();
  await expect(page).toHaveURL(/\/saved-routes$/);
  await expect(page.getByText("No saved routes yet.")).toBeVisible();
  await page.getByRole("button", { name: "New route", exact: true }).click();
  await expect(page).toHaveURL(/\/routes$/);
  await expect(
    page.getByRole("button", { name: "Save route offline", exact: true }),
  ).toBeDisabled();
});

test("Route studio live MapLibre supports mouse and touch placement", async ({
  browser,
}) => {
  test.skip(process.env.MAP_LIVE_TEST !== "true", "Requires live map access");
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/routes");
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("button", { name: "My location", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  await canvas.click({ position: { x: 90, y: 130 } });
  await canvas.tap({ position: { x: 200, y: 220 } });
  await expect(page.getByLabel("Waypoint 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page
    .getByRole("button", { name: "Fit map to route", exact: true })
    .click();
  await page.screenshot({
    path: "artifacts/maps/planner-live-390.png",
    fullPage: true,
  });
  await context.close();
});

test("Route studio explains unavailable maps and offline tiles", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.MAP_ADAPTER_TEST === "true",
    "Requires normal missing-key export",
  );
  await page.goto("/routes");
  await expect(
    page.getByRole("tab", { name: "Road-following demo" }),
  ).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Map not configured");
  await expect(
    page.getByText(/Approximate straight-line distance/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save route offline", exact: true }),
  ).toBeDisabled();
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("You are offline");
});

test("development route preview edits, redraws, and saves only straight-line plans", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.ROUTE_DEMO_TEST !== "true",
    "Requires a development web export with mock maps",
  );
  const fixture = readFileSync("tests/fixtures/maplibre-adapter.js", "utf8");
  const directionsRequests: string[] = [];
  await page.route("**/routing/v1/directions**", (route) => {
    directionsRequests.push(route.request().method());
    return route.abort();
  });
  await page.route("https://unpkg.com/**", (route) =>
    route.fulfill({
      contentType: route.request().url().endsWith(".css")
        ? "text/css"
        : "text/javascript",
      body: route.request().url().endsWith(".css") ? "" : fixture,
    }),
  );
  type Adapter = {
    events: Record<string, ((event: unknown) => void)[]>;
    sources: Record<
      string,
      { data: { features: { geometry: { coordinates: number[][] } }[] } }
    >;
  };
  const add = (lng: number) =>
    page.evaluate((value) => {
      const adapter = (window as unknown as { __mapAdapter: Adapter })
        .__mapAdapter;
      adapter.events.click.forEach((fn) =>
        fn({ lngLat: { lng: value, lat: 27.7 } }),
      );
    }, lng);
  const coordinates = (id: string) =>
    page.evaluate(
      (id) =>
        (window as unknown as { __mapAdapter: Adapter }).__mapAdapter.sources[
          id
        ]?.data.features[0]?.geometry.coordinates ?? [],
      id,
    );
  await page.goto("/routes");
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Routing tools", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Straight-line" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Road-following demo" }).click();
  const save = page.getByRole("button", {
    name: "Save route offline",
    exact: true,
  });
  await expect(save).toHaveCount(0);
  await add(85.3);
  await add(85.31);
  await add(85.32);
  await expect(page.getByText(/Demo distance .*Demo estimate/)).toBeVisible();
  const walking = await coordinates("route-studio-demo");
  expect(walking).toHaveLength(5);
  await page.getByRole("tab", { name: "cycling" }).click();
  await expect
    .poll(() => coordinates("route-studio-demo"))
    .not.toEqual(walking);
  await expect(page.getByText(/Demo distance .*Demo estimate/)).toBeVisible();

  await page
    .getByRole("button", { name: "Move waypoint 2", exact: true })
    .click();
  await add(85.3);
  await expect(
    page.getByText(/Move or remove overlapping waypoints/),
  ).toBeVisible();
  await expect.poll(() => coordinates("route-studio-demo")).toEqual([]);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Remove waypoint 2" }).click();
  await expect(page.getByText(/Demo distance .*Demo estimate/)).toBeVisible();
  await expect.poll(() => coordinates("route-studio-demo")).toHaveLength(3);
  await expect(
    page.getByRole("button", { name: "Open My route", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Straight-line" }).click();
  await expect.poll(() => coordinates("route-studio-demo")).toEqual([]);
  await save.click();
  await expect(page.getByText(/Route geometry saved/)).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "My saved routes" }).click();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Open My route", exact: true })
    .click();
  await expect
    .poll(() => coordinates("routes"))
    .toEqual([
      [85.3, 27.7],
      [85.32, 27.7],
    ]);
  await page.getByRole("button", { name: "Edit a copy in planner" }).click();
  await expect(page.getByText("Save your edits as a new route.")).toBeVisible();
  await page.getByLabel("Route name", { exact: true }).fill("Edited copy");
  await save.click();
  await page.getByRole("button", { name: "My saved routes" }).click();
  await expect(
    page.getByRole("button", { name: "Open Edited copy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open My route", exact: true })
    .click();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Cycling", exact: true }).click();
  await expect(page).toHaveURL(/\/record\?.*guide=/);
  await expect(page.getByText(/Following .* Teal planned route/)).toBeVisible();
  await expect
    .poll(() => coordinates("routes"))
    .toEqual([
      [85.3, 27.7],
      [85.32, 27.7],
    ]);
  await expect(
    page.getByRole("button", { name: "Start cycling activity" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Exit route guide" }).click();
  await expect(page.getByText(/Teal planned route/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start running activity" }),
  ).toBeEnabled();
  await page.goto("/record?guide=local%3Amissing&sport=walking");
  await expect(page.getByText(/Saved route unavailable/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start walking activity" }),
  ).toBeEnabled();
  expect(directionsRequests).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`Route studio planner lifecycle at ${width}`, async ({ page }) => {
    test.skip(
      process.env.MAP_ADAPTER_TEST !== "true",
      "Requires configured map export",
    );
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://unpkg.com/**", (route) =>
      route.fulfill({
        contentType: route.request().url().endsWith(".css")
          ? "text/css"
          : "text/javascript",
        body: route.request().url().endsWith(".css")
          ? ""
          : readFileSync("tests/fixtures/maplibre-adapter.js", "utf8"),
      }),
    );
    await page.goto("/routes");
    await expect(page.locator("canvas")).toBeVisible();
    const add = async (lng: number) =>
      page.evaluate((lng) => {
        const map = (
          window as unknown as {
            __mapAdapter: {
              events: Record<string, ((event: unknown) => void)[]>;
            };
          }
        ).__mapAdapter;
        map.events.click.forEach((fn) => fn({ lngLat: { lat: 27.7, lng } }));
      }, lng);
    await add(85.3);
    await add(85.31);
    await add(85.32);
    await expect(page.getByLabel("Waypoint 3", { exact: true })).toBeVisible();
    await expect(page.getByText(/3 waypoints/, { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Undo point", exact: true }).click();
    await expect(page.getByLabel("Waypoint 3", { exact: true })).toHaveCount(0);
    await page
      .getByRole("button", { name: "Fit map to route", exact: true })
      .click();
    await page.getByLabel("Route name", { exact: true }).fill("Test plan");
    await page
      .getByRole("button", { name: "Save route offline", exact: true })
      .click();
    await expect(page.getByText(/Route geometry saved/)).toBeVisible();
    await page.getByRole("button", { name: "My saved routes" }).click();
    await page
      .getByRole("button", { name: "Open Test plan", exact: true })
      .click();
    await page.getByRole("button", { name: "Edit a copy in planner" }).click();
    await expect(page.getByLabel("Waypoint 2", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/This route connects waypoints directly/),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "Clear waypoints", exact: true })
      .click();
    await expect(page.getByLabel("Waypoint 2", { exact: true })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Clear waypoints", exact: true })
      .click();
    await expect(page.getByLabel("Waypoint 1", { exact: true })).toHaveCount(0);
    await page.evaluate(() =>
      (
        window as unknown as {
          __mapAdapter: { events: Record<string, (() => void)[]> };
        }
      ).__mapAdapter.events.error.forEach((fn) => fn()),
    );
    await expect(page.getByRole("status")).toContainText(
      "Map provider unavailable",
    );
  });
}

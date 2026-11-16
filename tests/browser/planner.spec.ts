import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

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
    await page.reload();
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.getByLabel("Waypoint 2", { exact: true })).toBeVisible();
    await expect(page.getByText(/Road-following unavailable/)).toBeVisible();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByLabel("Waypoint 2", { exact: true })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Clear", exact: true }).click();
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

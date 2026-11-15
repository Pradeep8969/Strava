import { expect, test } from "@playwright/test";
// Explicit separate local-development export required; never enabled in default production checks.
test.skip(
  process.env.MAP_LIVE_TEST !== "true",
  "Needs localhost development map export and CDN access",
);
for (const width of [390, 1440]) {
  test(`MapLibre real canvas, controls and cities at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/explore");
    const map = page.getByRole("region", {
      name: "Interactive map of Kathmandu Valley",
    });
    await expect(map.locator(".maplibregl-canvas")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      map.getByRole("button", { name: "Zoom in", exact: true }),
    ).toBeVisible();
    await map.getByRole("button", { name: "Zoom in", exact: true }).click();
    await map.getByRole("button", { name: "Zoom out", exact: true }).click();
    const canvas = map.locator("canvas");
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 80, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 130, { steps: 8 });
    await page.mouse.up();
    await canvas.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("+");
    await page
      .getByRole("button", { name: "Show Pokhara map", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Interactive map of Pokhara" })
        .locator("canvas"),
    ).toBeVisible();
    await page.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (_success, failure) =>
        failure?.({
          code: 1,
          message: "denied",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
    });
    await page
      .getByRole("button", { name: "My location", exact: true })
      .click();
    await expect(page.getByText(/Location permission denied/)).toBeVisible();
    await page.screenshot({
      path: `artifacts/maps/explore-live-${width}.png`,
      fullPage: true,
    });
  });
}
test("Map library failure allows recovery and preserves navigation", async ({
  page,
}) => {
  await page.route("https://unpkg.com/**", (route) => route.abort());
  await page.goto("/explore");
  await expect(
    page.getByText("Unable to load the map. Check your connection and retry."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry map" })).toBeVisible();
  await page
    .getByRole("button", { name: "Open route builder", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Route studio" }),
  ).toBeVisible();
});

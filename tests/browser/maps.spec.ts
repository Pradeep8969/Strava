import { expect, test } from "@playwright/test";
for (const width of [390, 1440]) {
  test(`Explore map fallback, cities and navigation at ${width}`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/explore");
    const map = page.getByRole("region", {
      name: "Interactive map of Kathmandu Valley",
    });
    await expect(map).toBeVisible();
    await expect(map.getByRole("status")).toContainText("Map not configured");
    await expect(map.getByText(/No saved route geometry/)).toBeVisible();
    expect(await map.locator("svg").count()).toBe(0);
    await page
      .getByRole("button", { name: "Show Pokhara map", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Interactive map of Pokhara" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Show Kathmandu map", exact: true })
      .click();
    await context.setOffline(true);
    await expect(map.getByRole("status")).toContainText("You are offline");
    await context.setOffline(false);
    await page.screenshot({
      path: `artifacts/maps/explore-fallback-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "New route", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Route Studio", exact: true }),
    ).toBeVisible();
  });
}

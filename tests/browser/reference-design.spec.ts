import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`Home and Record reference review at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Namaste, athlete." }),
    ).toBeVisible();
    const photo = page.getByRole("img", {
      name: "Original Himalayan landscape editorial artwork",
    });
    await expect(photo).toBeVisible();
    await expect(photo).toHaveJSProperty("complete", true);
    expect(
      await photo.evaluate(
        (element) => (element as HTMLImageElement).naturalWidth,
      ),
    ).toBeGreaterThan(0);
    await page.screenshot({
      path: `artifacts/reference-review/home-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Following", exact: true }).click();
    await expect(page.getByText("Your people, your motivation.")).toBeVisible();
    await page.getByRole("tab", { name: "Clubs", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Explore clubs & challenges" }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "For you", exact: true }).click();
    await page
      .getByRole("button", { name: "Record an activity", exact: true })
      .click();
    await expect(page.getByTestId("record-active-time")).toHaveText("00:00:00");
    await expect(page.getByTestId("record-distance")).toHaveText("0.00");
    await expect(
      page.getByRole("button", { name: "Start running activity" }),
    ).toBeDisabled();
    await page.screenshot({
      path: `artifacts/reference-review/record-${width}.png`,
      fullPage: true,
    });
    if (width === 390) {
      await page
        .getByRole("button", { name: "Show map", exact: true })
        .first()
        .click();
      await expect(page.getByText("Your route belongs here.")).toBeVisible();
      await page.screenshot({
        path: `artifacts/reference-review/record-map-${width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Show metrics", exact: true })
        .first()
        .click();
    }
    await page.getByRole("button", { name: "Cycling", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Start cycling activity" }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  });
}

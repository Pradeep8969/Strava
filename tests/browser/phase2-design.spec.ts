import { expect, test } from "@playwright/test";

for (const width of [390, 1440])
  for (const theme of ["light", "dark"]) {
    test(`Explore and demo events at ${width}px in ${theme}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await page
        .getByRole("button", { name: "Open settings", exact: true })
        .click();
      await page.getByRole("button", { name: theme, exact: true }).click();
      await page.getByRole("link", { name: "Go back" }).click();
      await page.getByRole("tab", { name: "Explore", exact: false }).click();
      await expect(
        page.getByRole("heading", { name: "Discover routes", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", {
          name: /Interactive map of Kathmandu Valley/,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Your next route starts here."),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Show Pokhara map", exact: true })
        .click();
      await expect(
        page.getByRole("region", {
          name: /Interactive map of Pokhara/,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Show Kathmandu map", exact: true })
        .click();
      await expect(
        page.getByRole("region", {
          name: /Interactive map of Kathmandu Valley/,
        }),
      ).toBeVisible();
      if (width === 390) {
        const trailFilter = await page
          .getByRole("button", { name: "Trail running", exact: true })
          .boundingBox();
        expect(trailFilter).not.toBeNull();
        expect(trailFilter!.x + trailFilter!.width).toBeLessThanOrEqual(width);
        const firstCard = await page
          .getByRole("button", {
            name: "Explore Shivapuri foothills",
            exact: true,
          })
          .boundingBox();
        expect(firstCard?.y).toBeLessThan(760);
      }
      await page.screenshot({
        path: `artifacts/phase2-review/explore-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Cycling", exact: true }).click();
      await page
        .getByRole("button", { name: "Explore Pokhara lakeside", exact: true })
        .click();
      await expect(
        page.getByRole("region", {
          name: /Interactive map of Pokhara/,
        }),
      ).toBeVisible();
      await page
        .getByLabel("Search routes", { exact: true })
        .fill("no matches");
      await expect(page.getByText("No matching route ideas")).toBeVisible();
      await page
        .getByRole("button", { name: "Clear search routes", exact: true })
        .click();
      await page.getByRole("tab", { name: "Events", exact: false }).click();
      await expect(
        page.getByRole("heading", { name: "Nepal events", exact: true }),
      ).toBeVisible();
      const photo = page.getByRole("img", {
        name: "Himalayan Trail Weekend · demonstration event editorial image",
      });
      await expect(photo).toHaveJSProperty("complete", true);
      expect(
        await photo.evaluate(
          (element) => (element as HTMLImageElement).naturalWidth,
        ),
      ).toBeGreaterThan(0);
      await page.screenshot({
        path: `artifacts/phase2-review/events-${width}-${theme}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", {
          name: "View demo event Himalayan Trail Weekend",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Himalayan Trail Weekend",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Not a confirmed event · all dates and formats are illustrative.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Registration unavailable",
          exact: true,
        }),
      ).toBeDisabled();
      await page.screenshot({
        path: `artifacts/phase2-review/event-detail-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.getByRole("tab", { name: "Organizer", exact: true }).click();
      await expect(
        page.getByText("Demonstration organizer", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Not a verified organization", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Back to events", exact: true })
        .click();
      await page.getByRole("button", { name: "Cycling", exact: true }).click();
      await expect(
        page.getByRole("button", {
          name: "View demo event Pokhara Lakeside Ride",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "View demo event Himalayan Trail Weekend",
          exact: true,
        }),
      ).toHaveCount(0);
      await page
        .getByLabel("Search demonstration events", { exact: true })
        .fill("no matches");
      await expect(
        page.getByText("No matching demonstration events"),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
      ).toBe(false);
      expect(errors).toEqual([]);
    });
  }
test("missing demonstration event has a working recovery path", async ({
  page,
}) => {
  await page.goto("/event/not-found");
  await expect(
    page.getByRole("heading", { name: "Event unavailable", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to events", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nepal events", exact: true }),
  ).toBeVisible();
});

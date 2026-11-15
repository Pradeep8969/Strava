import { expect, test } from "@playwright/test";
import { authBackendFixture } from "../fixtures/auth-backend";

test("journal, recording, filters and theme settings remain usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Namaste, athlete." }),
  ).toBeVisible();
  await expect(
    page.getByText("Your story starts outside.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record an activity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start running activity" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cycling", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start cycling activity" }),
  ).toBeEnabled();
  await page.getByRole("tab", { name: "Activities" }).click();
  await expect(page.getByText("No adventures recorded yet")).toBeVisible();
  await page
    .getByLabel("Search your activities", { exact: true })
    .fill("nonexistent");
  await expect(page.getByText("No matching activities")).toBeVisible();
  await page.getByRole("tab", { name: "Events" }).click();
  await page.getByRole("button", { name: "Cycling", exact: true }).click();
  await expect(page.getByText("Pokhara Lakeside Ride")).toBeVisible();
  await expect(page.getByText("Valley Sunrise Run")).toHaveCount(0);
  await page.getByLabel("Search demonstration events").fill("no matches");
  await expect(
    page.getByText("No matching demonstration events"),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Profile" }).click();
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page.getByRole("button", { name: "dark", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "dark", exact: true }),
  ).toHaveCSS("background-color", "rgb(255, 129, 92)");
  await page.getByRole("button", { name: "light", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "light", exact: true }),
  ).toHaveCSS("background-color", "rgb(207, 66, 31)");
  expect(errors).toEqual([]);
});

for (const width of [360, 390, 768, 1440]) {
  for (const theme of ["dark", "light"]) {
    test(`all tabs fit ${width}px in ${theme} theme`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      await page.getByRole("button", { name: "Open settings" }).click();
      await page.getByRole("button", { name: theme, exact: true }).click();
      await page.getByRole("link", { name: "Go back" }).click();
      await expect(
        page.getByRole("heading", { name: "Namaste, athlete." }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
      ).toBe(false);
      const headingEdges = await page
        .getByRole("heading")
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().right),
        );
      for (const right of headingEdges)
        expect(right).toBeLessThanOrEqual(width + 1);
      await page.screenshot({
        path: `test-results/home-${width}-${theme}.png`,
        fullPage: true,
      });
      for (const [tab, heading] of [
        ["Explore", "Discover routes"],
        ["Record", "Record activity"],
        ["Activities", "Activity journal"],
        ["Events", "Nepal events"],
        ["Profile", "Your space"],
      ]) {
        await page.getByRole("tab", { name: tab }).click();
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          ),
        ).toBe(false);
        await page.screenshot({
          path: `test-results/${tab.toLowerCase()}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    });
  }
}

for (const [route, content] of [
  ["/", "Namaste, athlete."],
  ["/explore", "Discover routes"],
  ["/record", "Record activity"],
  ["/activities", "Activity journal"],
  ["/events", "Nepal events"],
  ["/profile", "Your space"],
  ["/analytics", "Your training insights"],
  ["/community", "Your community"],
  ["/social", "Better together."],
  ["/search", "Find your people."],
  ["/routes", "Route studio"],
  ["/settings", "Settings & privacy"],
  ["/privacy-zones", "Keep home, home."],
  ["/coach", "A little guidance."],
  ["/subscription", "Free recording and your basic history remain free."],
  ["/activity/missing", "Activity unavailable"],
  ["/unknown-screen", "A different path."],
  ["/auth", "Welcome back."],
]) {
  test(`route ${route} renders without raw text or runtime errors`, async ({
    page,
  }) => {
    if (route === "/auth") {
      await page.route("**/__common-*.js", async (request) => {
        const response = await request.fetch();
        let body = await response.text();
        const marker = body.indexOf("Connect Supabase using .env");
        expect(marker).toBeGreaterThan(0);
        const start = body.lastIndexOf("__d(", marker);
        const end = body.slice(marker).match(/\},(\d+),\[[^\]]*\]\);/)!;
        body =
          body.slice(0, start) +
          `__d(${authBackendFixture.toString()},${end[1]},[]);` +
          body.slice(marker + end.index! + end[0].length);
        await request.fulfill({ response, body });
      });
    }
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(content, { exact: true }).last()).toBeVisible();
    if (route === "/auth") {
      await page.getByLabel("Email", { exact: true }).fill("test@example.test");
      await page
        .getByLabel("Password", { exact: true })
        .fill("testpassword123");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(
        page.getByText("Account service is unavailable. Please try again.", {
          exact: true,
        }),
      ).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

import { expect, test, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { trainingFixture } from "../fixtures/training";
import { stats } from "../../utils/tracking";
import { length } from "../../utils/format";

async function capture(page: Page, name: string, width: number, theme: string) {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const rightEdges = await page
    .getByRole("heading")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().right),
    );
  expect(rightEdges.every((edge) => edge <= width + 1)).toBe(true);
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((nodes) =>
          nodes.every(
            (node) =>
              (node as HTMLImageElement).complete &&
              (node as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: `artifacts/phase5-review/${name}-${width}-${theme}.png`,
  });
}
async function openAnalytics(page: Page, theme: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page.getByRole("button", { name: theme, exact: true }).click();
  await page.getByRole("link", { name: "Go back" }).click();
  await page.getByRole("tab", { name: "Activities", exact: false }).click();
  await page
    .getByRole("button", { name: "Training trends", exact: true })
    .click();
}
async function analyticsFixtures(page: Page) {
  const run = trainingFixture(
    "analytics-run",
    "running",
    +new Date("2026-11-11T08:00:00Z"),
  );
  const walk = trainingFixture(
    "analytics-walk",
    "walking",
    +new Date("2026-11-05T08:00:00Z"),
  );
  walk.points = walk.points.map((p) => ({
    ...p,
    altitude: null,
    altitudeAccuracy: null,
  }));
  const ride = trainingFixture(
    "analytics-ride",
    "cycling",
    +new Date("2026-10-05T08:00:00Z"),
  );
  const hidden = {
    ...trainingFixture("other-account", "running", run.startedAt),
    ownerId: "another-account",
  };
  const unfinished = { ...run, id: "paused", state: "paused" as const };
  const dir = "dist/_expo/static/js/web",
    common = readdirSync(dir).find((f) => f.startsWith("__common-"))!;
  const body = readFileSync(`${dir}/${common}`, "utf8"),
    index = body.indexOf(".mutateWorkout=");
  const moduleId = Number(body.slice(index).match(/\},(\d+),\[/)![1]);
  await page.evaluate(
    ({ moduleId, workouts }) => {
      const runtime = globalThis as unknown as {
        __r: (id: number) => { useApp: { setState: (state: unknown) => void } };
      };
      runtime.__r(moduleId).useApp.setState({ workouts, ready: true });
    },
    { moduleId, workouts: [run, walk, ride, hidden, unfinished] },
  );
  return { run, walk, ride };
}
for (const width of [390, 768, 1440])
  for (const theme of ["light", "dark"]) {
    test(`Phase 5 dashboards ${width}px ${theme}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.clock.setFixedTime(new Date("2026-11-14T12:00:00Z"));
      await page.setViewportSize({ width, height: 900 });
      await openAnalytics(page, theme);
      await expect(page.getByTestId("analytics-total-2")).toHaveText("0");
      await capture(page, "analytics-empty", width, theme);
      const { run, walk, ride } = await analyticsFixtures(page);
      await expect(page.getByTestId("analytics-total-2")).toHaveText("1");
      await expect(page.getByTestId("analytics-total-0")).toHaveText(
        length(stats(run).meters, "km"),
      );
      await page.getByRole("tab", { name: "Month", exact: true }).click();
      await expect(page.getByTestId("analytics-total-2")).toHaveText("2");
      await page.getByRole("tab", { name: "Year", exact: true }).click();
      await expect(page.getByTestId("analytics-total-2")).toHaveText("3");
      const trend = page.getByRole("img", {
        name: "Year recorded distance trend",
        exact: true,
      });
      await expect(trend.getByText("Nov", { exact: true })).toBeVisible();
      await expect(trend.getByText("Dec", { exact: true })).toHaveCount(0);
      await expect(page.getByTestId("analytics-total-0")).toHaveText(
        length(
          stats(run).meters + stats(walk).meters + stats(ride).meters,
          "km",
        ),
      );
      await capture(page, "analytics-year-test-fixture", width, theme);
      await page.getByRole("tab", { name: "Cycling", exact: true }).click();
      await expect(page.getByTestId("analytics-total-2")).toHaveText("1");
      await page.getByRole("tab", { name: "All sports", exact: true }).click();
      await page.getByRole("tab", { name: "Time", exact: true }).click();
      await expect(
        page.getByLabel("Year time chart", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("heading", { name: "Advanced analysis", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByText("Unavailable · requires validated sensor processing.", {
          exact: true,
        }),
      ).toBeVisible();
      await capture(page, "analytics-analysis-test-fixture", width, theme);
      await page
        .getByRole("button", { name: "Explore StravaKinda Plus", exact: true })
        .last()
        .click();
      await expect(
        page.getByText("Free recording and your basic history remain free.", {
          exact: true,
        }),
      ).toBeVisible();
      await capture(page, "subscription", width, theme);
      await page
        .getByRole("button", { name: "Load store plans", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("button", { name: "Load store plans", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Restore purchases", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Check premium access", exact: true }),
      ).toBeDisabled();
      await capture(page, "subscription-store-state", width, theme);
      await page
        .getByRole("button", { name: "Open organizer preview", exact: true })
        .click();
      await expect(
        page.getByText("Organizer workspace preview", { exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId("organizer-metric-0")).toHaveText("0");
      for (const i of [1, 2, 3])
        await expect(page.getByTestId(`organizer-metric-${i}`)).toHaveText("0");
      await capture(page, "organizer-overview", width, theme);
      await page
        .getByRole("button", { name: "New preview event", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save preview draft", exact: true })
        .click();
      await expect(
        page.getByText("Enter an event name of 1–120 characters.", {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByLabel("Event name", { exact: true })
        .fill("Test preview trail day");
      await page
        .getByLabel("Proposed location", { exact: true })
        .fill("Kathmandu · test workspace");
      await page
        .getByLabel("Proposed date", { exact: true })
        .fill("2027-04-10");
      await page
        .getByLabel("Description", { exact: true })
        .fill("Isolated browser test preview. Not a real event.");
      await page
        .getByLabel("Proposed participant capacity (optional)", { exact: true })
        .fill("120");
      await page.getByRole("tab", { name: "Hiking", exact: true }).click();
      await page
        .getByRole("radio", { name: "Use lake banner", exact: true })
        .click();
      await expect(
        page.getByRole("radio", { name: "Use lake banner", exact: true }),
      ).toBeChecked();
      await expect(
        page.getByRole("button", {
          name: "Publish event · unavailable",
          exact: true,
        }),
      ).toBeDisabled();
      await page
        .getByRole("heading", { name: "Create preview event", exact: true })
        .scrollIntoViewIfNeeded();
      await capture(page, "organizer-form-test-fixture", width, theme);
      await page
        .getByRole("button", { name: "Save preview draft", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Edit Test preview trail day",
          exact: true,
        }),
      ).toBeVisible();
      await capture(page, "organizer-events-test-fixture", width, theme);
      await page
        .getByRole("button", {
          name: "Edit Test preview trail day",
          exact: true,
        })
        .click();
      await page
        .getByLabel("Event name", { exact: true })
        .fill("Updated test preview");
      await page
        .getByRole("button", { name: "Save preview draft", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Edit Updated test preview",
          exact: true,
        }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Overview", exact: true }).click();
      await expect(page.getByTestId("organizer-metric-0")).toHaveText("1");
      await page
        .getByRole("tab", { name: "Participants", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Take registration payments · unavailable",
          exact: true,
        }),
      ).toBeDisabled();
      await capture(page, "organizer-participants", width, theme);
      await page.getByRole("tab", { name: "Reports", exact: true }).click();
      await expect(
        page.getByText("Waiting for registration data", { exact: true }),
      ).toBeVisible();
      await capture(page, "organizer-reports", width, theme);
      await page.getByRole("tab", { name: "Organizer", exact: true }).click();
      await page
        .getByLabel("Organizer name", { exact: true })
        .fill("Test organizer preview");
      await page
        .getByLabel("Contact email", { exact: true })
        .fill("preview@example.test");
      await page
        .getByRole("button", { name: "Keep profile preview", exact: true })
        .click();
      await expect(
        page.getByText("Not a verified organizer profile", { exact: true }),
      ).toBeVisible();
      await capture(page, "organizer-profile-test-fixture", width, theme);
      await page.reload();
      await expect(page.getByTestId("organizer-metric-0")).toHaveText("1");
      await expect(
        page.getByText("Updated test preview", { exact: true }).first(),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "Delete Updated test preview",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Confirm delete draft", exact: true })
        .click();
      await expect(page.getByTestId("organizer-metric-0")).toHaveText("0");
      await page.getByRole("tab", { name: "Reports", exact: true }).click();
      await expect(
        page.getByText("No local drafts match this date range.", {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "View training analytics", exact: true })
        .click();
      await expect(page.getByTestId("analytics-total-2").last()).toHaveText(
        "0",
      );
      expect(errors).toEqual([]);
    });
  }

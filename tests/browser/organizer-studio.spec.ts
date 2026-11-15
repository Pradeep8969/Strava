import { chromium, expect, test, type Page } from "@playwright/test";
import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

const key = "stravakinda:organizer:v1:guest";
async function capture(page: Page, name: string, width: number, theme: string) {
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (n) =>
              (n as HTMLImageElement).complete &&
              (n as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const edges = await page
    .getByRole("heading")
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().right));
  expect(edges.every((right) => right <= width + 1)).toBe(true);
  await page.screenshot({
    path: `artifacts/phase55-review/${name}-detail-${width}-${theme}.png`,
  });
  await page
    .getByRole("heading", { name: "Organizer studio", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/phase55-review/${name}-${width}-${theme}.png`,
    fullPage: true,
  });
}
async function create(
  page: Page,
  title: string,
  sport = "Running",
  date = "2027-04-10",
) {
  await page
    .getByRole("button", { name: "New preview event", exact: true })
    .click();
  await page.getByLabel("Event name", { exact: true }).fill(title);
  await page
    .getByLabel("Proposed location", { exact: true })
    .fill("Kathmandu · isolated browser test");
  await page.getByLabel("Proposed date", { exact: true }).fill(date);
  await page.getByRole("tab", { name: sport, exact: true }).click();
  await page
    .getByLabel("Event schedule (optional)", { exact: true })
    .fill("06:00 · Briefing\n06:30 · Proposed start");
  await page
    .getByRole("button", { name: "Save preview draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Edit ${title}`, exact: true }),
  ).toBeVisible();
}
for (const width of [390, 768, 1440])
  for (const theme of ["light", "dark"]) {
    test(`persistent organizer studio ${width} ${theme}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.clock.setFixedTime(new Date("2026-11-14T12:00:00Z"));
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/settings");
      await page.getByRole("button", { name: theme, exact: true }).click();
      await page.goto("/organizer");
      // Web theme preferences are intentionally session-only. Set through shared UI after navigation.
      if (theme === "dark") {
        await page.goto("/");
        await page
          .getByRole("button", { name: "Open settings", exact: true })
          .click();
        await page.getByRole("button", { name: "dark", exact: true }).click();
        await page.getByRole("link", { name: "Go back" }).click();
        await page
          .getByRole("tab", { name: "Activities", exact: false })
          .click();
        await page
          .getByRole("button", { name: "Training trends", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Open organizer preview", exact: true })
          .click();
      }
      await expect(page.getByTestId("organizer-metric-0")).toHaveText("0");
      await capture(page, "overview-empty", width, theme);
      await create(page, "Test Nepal trail plan", "Hiking");
      await page
        .getByRole("button", {
          name: "Edit Test Nepal trail plan",
          exact: true,
        })
        .click();
      await page.getByRole("radio", { name: "Use ridge banner" }).click();
      await page
        .getByLabel("Description", { exact: true })
        .fill("Isolated test event plan. Not a confirmed race.");
      await capture(page, "event-editor", width, theme);
      await page
        .getByRole("button", { name: "Save preview draft", exact: true })
        .click();
      await create(page, "Test cycling plan", "Cycling", "2025-01-01");
      await page.getByRole("tab", { name: "Overview", exact: true }).click();
      await expect(page.getByTestId("organizer-metric-0")).toHaveText("2");
      await expect(page.getByTestId("organizer-metric-1")).toHaveText("1");
      await expect(page.getByTestId("organizer-metric-2")).toHaveText("2");
      await expect(page.getByTestId("organizer-metric-3")).toHaveText("2");
      await capture(page, "overview-populated", width, theme);
      await page.getByRole("tab", { name: "Events", exact: true }).click();
      await page
        .getByLabel("Search preview events", { exact: true })
        .fill("trail");
      await expect(
        page.getByRole("button", {
          name: "Edit Test cycling plan",
          exact: true,
        }),
      ).toHaveCount(0);
      await page.getByLabel("Search preview events", { exact: true }).fill("");
      await page.getByRole("tab", { name: "Hiking", exact: true }).click();
      await expect(
        page.getByRole("button", {
          name: "Edit Test cycling plan",
          exact: true,
        }),
      ).toHaveCount(0);
      await page.getByRole("tab", { name: "All drafts", exact: true }).click();
      await page
        .getByRole("tab", { name: "Proposed date", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: /^Edit Test/ }).first(),
      ).toHaveAttribute("aria-label", "Edit Test cycling plan");
      await capture(page, "event-management", width, theme);
      await page
        .getByRole("button", {
          name: "Preview Test Nepal trail plan",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("Unpublished event preview", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("06:00 · Briefing\n06:30 · Proposed start", {
          exact: true,
        }),
      ).toBeVisible();
      await capture(page, "event-preview", width, theme);
      await page
        .getByRole("button", { name: "Back to drafts", exact: true })
        .click();
      await page
        .getByRole("tab", { name: "Participants", exact: true })
        .click();
      await page
        .getByLabel("Search participants", { exact: true })
        .fill("Test");
      await page.getByRole("tab", { name: "Pending", exact: true }).click();
      await capture(page, "participants", width, theme);
      await page.getByRole("tab", { name: "Reports", exact: true }).click();
      await page.getByRole("tab", { name: "Upcoming", exact: true }).click();
      await expect(
        page.getByText(
          "1 unpublished drafts · 1 with schedules · 1 upcoming proposed dates",
          { exact: true },
        ),
      ).toBeVisible();
      await capture(page, "reports", width, theme);
      await page
        .getByRole("heading", { name: "Draft planning overview", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `artifacts/phase55-review/reports-categories-${width}-${theme}.png`,
      });
      await page.getByRole("tab", { name: "Organizer", exact: true }).click();
      await page
        .getByLabel("Organizer name", { exact: true })
        .fill("Test Nepal organizer");
      await page
        .getByLabel("Contact email", { exact: true })
        .fill("test@example.test");
      await page
        .getByLabel("Contact phone (optional)", { exact: true })
        .fill("+977 9800000000");
      await page
        .getByLabel("Contact website (optional)", { exact: true })
        .fill("javascript:alert(1)");
      await page
        .getByRole("button", { name: "Keep profile preview", exact: true })
        .click();
      await expect(
        page.getByText(
          "Contact and social links must be valid HTTPS URLs without credentials.",
          { exact: true },
        ),
      ).toBeVisible();
      await page
        .getByLabel("Contact website (optional)", { exact: true })
        .fill("https://example.test");
      await page
        .getByRole("button", { name: "Add Hiking", exact: true })
        .click();
      await page.getByRole("tab", { name: "lake", exact: true }).click();
      await page
        .getByRole("button", { name: "Keep profile preview", exact: true })
        .click();
      await expect(
        page.getByText(
          "Organizer profile saved privately on this device. Not verified or publicly visible.",
          { exact: true },
        ),
      ).toBeVisible();
      await capture(page, "organizer-profile", width, theme);
      await page.reload();
      await expect(page.getByTestId("organizer-metric-0")).toHaveText("2");
      await page.getByRole("tab", { name: "Organizer", exact: true }).click();
      await expect(
        page.getByLabel("Organizer name", { exact: true }),
      ).toHaveValue("Test Nepal organizer");
      await expect(
        page.getByRole("button", { name: "Remove Hiking", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("tab", { name: "lake", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      const next = await context.newPage();
      await next.goto("/organizer");
      await expect(next.getByTestId("organizer-metric-0")).toHaveText("2");
      await next.close();
      await page.getByRole("tab", { name: "Events", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Delete Test Nepal trail plan",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Keep draft", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Edit Test Nepal trail plan",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "Delete Test Nepal trail plan",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Confirm delete draft", exact: true })
        .click();
      await page.reload();
      await expect(page.getByTestId("organizer-metric-0")).toHaveText("1");
      expect(errors).toEqual([]);
    });
  }
test("invalid dates and storage quota errors preserve the editable event", async ({
  page,
}) => {
  await page.goto("/organizer");
  await page
    .getByRole("button", { name: "New preview event", exact: true })
    .click();
  await page
    .getByLabel("Event name", { exact: true })
    .fill("Test storage failure");
  await page
    .getByLabel("Proposed location", { exact: true })
    .fill("Test venue");
  await page.getByLabel("Proposed date", { exact: true }).fill("2027-02-29");
  await page
    .getByRole("button", { name: "Save preview draft", exact: true })
    .click();
  await expect(
    page.getByText("Enter a valid calendar date.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Proposed date", { exact: true }).fill("2028-02-29");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { restoreStorage: () => void }).restoreStorage =
      () => {
        Storage.prototype.setItem = original;
      };
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith("stravakinda:organizer:"))
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  await page
    .getByRole("button", { name: "Save preview draft", exact: true })
    .click();
  await expect(
    page.getByText(
      "Could not save to device storage. Your changes remain in this form. Check storage availability and try again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Event name", { exact: true })).toHaveValue(
    "Test storage failure",
  );
  await page.evaluate(() =>
    (window as unknown as { restoreStorage: () => void }).restoreStorage(),
  );
  await page
    .getByRole("button", { name: "Save preview draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Edit Test storage failure",
      exact: true,
    }),
  ).toBeVisible();
});
test("corrupt workspace is not silently overwritten and storage retry recovers", async ({
  page,
}) => {
  await page.goto("/organizer");
  await page.evaluate((k) => localStorage.setItem(k, "broken JSON"), key);
  await page.reload();
  await expect(
    page.getByText("Device storage unavailable", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    "broken JSON",
  );
  await page.evaluate((k) => localStorage.removeItem(k), key);
  await page
    .getByRole("button", { name: "Retry local storage", exact: true })
    .click();
  await expect(page.getByTestId("organizer-metric-0")).toHaveText("0");
});

test("local event drafts survive an actual browser process restart", async ({
  browserName,
}, testInfo) => {
  expect(browserName).toBe("chromium");
  const directory = resolve(testInfo.outputPath("organizer-browser-profile"));
  const allowed = resolve("test-results") + sep;
  if (!directory.startsWith(allowed))
    throw new Error("Test browser profile must stay inside test-results.");
  let browser = await chromium.launchPersistentContext(directory, {
    channel: "msedge",
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:4173/organizer");
    await create(page, "Test browser restart draft");
    await browser.close();
    browser = await chromium.launchPersistentContext(directory, {
      channel: "msedge",
      headless: true,
    });
    const reopened = await browser.newPage();
    await reopened.goto("http://127.0.0.1:4173/organizer");
    await expect(reopened.getByTestId("organizer-metric-0")).toHaveText("1");
    await expect(
      reopened.getByRole("button", {
        name: "Edit Test browser restart draft",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await browser.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("corrupt organizer recovery requires explicit confirmation", async ({
  page,
}) => {
  await page.goto("/organizer");
  await page.evaluate((k) => localStorage.setItem(k, '{"version":99}'), key);
  await page.reload();
  await page
    .getByRole("button", {
      name: "Reset local organizer workspace",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Cancel reset", exact: true }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    '{"version":99}',
  );
  await page
    .getByRole("button", {
      name: "Reset local organizer workspace",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Confirm erase organizer workspace",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("organizer-metric-0")).toHaveText("0");
});

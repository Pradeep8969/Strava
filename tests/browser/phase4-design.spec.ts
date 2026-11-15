import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { communityBackendFixture } from "../fixtures/community-backend";
import { trainingFixture } from "../fixtures/training";

async function mockedAccount(page: Page) {
  await page.route("**/__common-*.js", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    const marker = body.indexOf("Connect Supabase using .env");
    expect(marker).toBeGreaterThan(0);
    const start = body.lastIndexOf("__d(", marker);
    const end = body.slice(marker).match(/\},(\d+),\[[^\]]*\]\);/)!;
    body =
      body.slice(0, start) +
      `__d(${communityBackendFixture.toString()},${end[1]},[]);` +
      body.slice(marker + end.index! + end[0].length);
    await route.fulfill({ response, body });
  });
}
async function seedOwnRoute(page: Page, theme: string) {
  const dir = "dist/_expo/static/js/web";
  const common = readdirSync(dir).find((f) => f.startsWith("__common-"))!;
  const body = readFileSync(`${dir}/${common}`, "utf8");
  const index = body.indexOf(".mutateWorkout=");
  const moduleId = Number(body.slice(index).match(/\},(\d+),\[/)![1]);
  const workout = {
    ...trainingFixture("fixture-run", "running", Date.now() - 3600000),
    ownerId: "test-viewer",
  };
  await page.evaluate(
    ({ moduleId, workout, theme }) => {
      const runtime = globalThis as unknown as {
        __r: (id: number) => {
          useApp: {
            getState: () => { preferences: object };
            setState: (state: unknown) => void;
          };
        };
      };
      const store = runtime.__r(moduleId).useApp;
      store.setState({
        workouts: [workout],
        preferences: { ...store.getState().preferences, theme },
        ready: true,
      });
    },
    { moduleId, workout, theme },
  );
}
async function themeFromSettings(page: Page, theme: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page.getByRole("button", { name: theme, exact: true }).click();
  await page.getByRole("link", { name: "Go back" }).click();
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page
    .getByRole("button", { name: "Clubs & challenges", exact: true })
    .click();
}
async function capture(page: Page, name: string, width: number, theme: string) {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const edges = await page
    .getByRole("heading")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().right),
    );
  expect(edges.every((right) => right <= width + 1)).toBe(true);
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
    path: `artifacts/phase4-review/${name}-${width}-${theme}.png`,
  });
}
for (const width of [390, 1440])
  for (const theme of ["light", "dark"]) {
    test(`Community guest screens ${width}px ${theme}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setViewportSize({ width, height: 844 });
      await themeFromSettings(page, theme);
      await expect(
        page.getByText("Connect to your community", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Join club", exact: true }),
      ).toHaveCount(0);
      await capture(page, "clubs-guest", width, theme);
      await page
        .getByRole("tab", { name: "Challenges community", exact: true })
        .click();
      await capture(page, "challenges-guest", width, theme);
      await page
        .getByRole("tab", { name: "Feed community", exact: true })
        .click();
      await expect(
        page.getByText("Your community is waiting", { exact: true }),
      ).toBeVisible();
      await capture(page, "social-guest", width, theme);
      await page
        .getByRole("button", { name: "Following", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Give kudos", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", {
          name: "Explore competition preview",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("PLANNED", { exact: true }).last(),
      ).toBeVisible();
      await capture(page, "competition", width, theme);
      await page
        .getByRole("button", { name: "Your segments", exact: true })
        .click();
      await expect(
        page.getByText("Your segments, kept private", { exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });

    test(`Community with isolated backend fixtures ${width}px ${theme}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await mockedAccount(page);
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/community");
      await expect(
        page.getByRole("button", {
          name: "View club Test Valley Runners",
          exact: true,
        }),
      ).toBeVisible();
      await seedOwnRoute(page, theme);
      await capture(page, "clubs-test-fixture", width, theme);
      await page.getByLabel("Search clubs", { exact: true }).fill("no matches");
      await expect(
        page.getByText("No matching clubs", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("Search clubs", { exact: true }).fill("");
      const lakeside = page
        .getByRole("button", {
          name: "View club Test Pokhara Riders",
          exact: true,
        })
        .locator("..");
      await lakeside
        .getByRole("button", { name: "Join club", exact: true })
        .click();
      await expect(
        lakeside.getByRole("button", { name: "Leave club", exact: true }),
      ).toBeVisible();
      await lakeside
        .getByRole("button", { name: "Leave club", exact: true })
        .click();
      await expect(
        lakeside.getByRole("button", { name: "Join club", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "View club Test Valley Runners",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("You are a member", { exact: true }),
      ).toBeVisible();
      await capture(page, "club-detail-test-fixture", width, theme);
      await page.getByRole("button", { name: "Feed", exact: true }).click();
      await expect(
        page.getByText("Club activity feed", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Members", exact: true }).click();
      await expect(
        page.getByText(/Member directories and totals are private/),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Challenges", exact: true })
        .click();
      await expect(
        page.getByText("Test Valley Miles", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Join challenge", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Leave challenge", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Back from community", exact: true })
        .click();
      await page
        .getByRole("tab", { name: "Challenges community", exact: true })
        .click();
      const progress = page.getByRole("progressbar", {
        name: "Test 100 km Challenge personal progress",
        exact: true,
      });
      await expect(progress).toBeVisible();
      expect(
        Number(await progress.getAttribute("aria-valuenow")),
      ).toBeGreaterThan(0);
      await capture(page, "challenges-test-fixture", width, theme);
      await page
        .getByRole("tab", { name: "Feed community", exact: true })
        .click();
      await expect(
        page.getByText("Test morning trail run", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("img", {
          name: "Recorded route sketch, without a base map",
        }),
      ).toBeVisible();
      await capture(page, "social-test-fixture", width, theme);
      await page
        .getByRole("button", { name: "Give kudos", exact: true })
        .first()
        .click();
      await expect(
        page.getByRole("button", { name: "Remove kudos", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Remove kudos", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Comments on Test morning trail run",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("Test fixture · great morning to get outside!", {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByLabel("Comment on Test morning trail run", { exact: true })
        .fill("Test encouragement");
      await page
        .getByRole("button", { name: "Post comment", exact: true })
        .click();
      await expect(
        page.getByText("Test encouragement", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Share summary", exact: true })
        .first()
        .click();
      await expect(
        page.getByRole("button", { name: "Copy summary", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Following", exact: true })
        .click();
      await expect(
        page.getByText("Test lakeside ride", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Test morning trail run", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("img", {
          name: "Recorded route sketch, without a base map",
        }),
      ).toHaveCount(0);
      const calls = await page.evaluate(
        () =>
          (
            globalThis as unknown as {
              __communityTest: { calls: { table: string }[] };
            }
          ).__communityTest.calls,
      );
      expect(calls.some((call) => call.table === "activity_points")).toBe(
        false,
      );
      expect(errors).toEqual([]);
    });
  }
test("Community mutation/read failures, recovery and sign-out", async ({
  page,
}) => {
  await mockedAccount(page);
  await page.goto("/community");
  const card = page
    .getByRole("button", { name: "View club Test Pokhara Riders", exact: true })
    .locator("..");
  await expect(card).toBeVisible();
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __communityTest: { failWrites: (value: boolean) => void };
      }
    ).__communityTest.failWrites(true),
  );
  await card.getByRole("button", { name: "Join club", exact: true }).click();
  await expect(
    page.getByText("Test write rejected", { exact: true }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Join club", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __communityTest: { failReads: (value: boolean) => void };
      }
    ).__communityTest.failReads(true),
  );
  await page.getByRole("tab", { name: "Feed community", exact: true }).click();
  await expect(page.getByText(/Could not load the feed/)).toBeVisible();
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __communityTest: { failReads: (value: boolean) => void };
      }
    ).__communityTest.failReads(false),
  );
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText("Test morning trail run", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __communityTest: { signOut: () => Promise<unknown> };
      }
    ).__communityTest.signOut(),
  );
  await expect(
    page.getByText("Your community is waiting", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Test morning trail run", { exact: true }),
  ).toHaveCount(0);
});
test("Missing club has a working recovery path", async ({ page }) => {
  await mockedAccount(page);
  await page.goto("/club/not-found");
  await expect(
    page.getByText("Club unavailable", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to clubs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your community", exact: true }),
  ).toBeVisible();
});

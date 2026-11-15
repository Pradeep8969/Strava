import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { trainingFixture } from "../fixtures/training";
import { stats } from "../../utils/tracking";
import { length } from "../../utils/format";

const bundleDir = "dist/_expo/static/js/web";
function storeModule() {
  const common = readdirSync(bundleDir).find((f) => f.startsWith("__common-"))!;
  const body = readFileSync(`${bundleDir}/${common}`, "utf8");
  const index = body.indexOf(".mutateWorkout=");
  if (index < 0)
    throw new Error("Workout store export not found in preview bundle");
  return Number(body.slice(index).match(/\},(\d+),\[/)![1]);
}
async function seedTestWorkouts(page: Page, includeHike = false) {
  // Browser-only test injection into the existing Metro runtime. No production
  // hooks, seed data, database writes or environment flags are added to the app.
  const start = Date.now() - 3600000;
  const run = trainingFixture("fixture-run", "running", start);
  const walk = {
    ...trainingFixture("fixture-walk", "walking", start - 86400000),
    points: [],
  };
  const otherOwner = {
    ...trainingFixture("other-owner", "cycling", start),
    ownerId: "other-account",
  };
  const hike = trainingFixture("fixture-hike", "hiking", start - 2 * 86400000);
  hike.points = hike.points.map((point) => ({
    ...point,
    altitude: null,
    altitudeAccuracy: null,
  }));
  await page.evaluate(
    ({ id, workouts }) => {
      const runtime = globalThis as unknown as {
        __r: (id: number) => { useApp: { setState: (state: unknown) => void } };
      };
      runtime.__r(id).useApp.setState({ workouts, ready: true, error: null });
    },
    {
      id: storeModule(),
      workouts: [
        run,
        walk,
        otherOwner,
        ...(includeHike
          ? [hike, trainingFixture("fixture-cycle", "cycling", start)]
          : []),
      ],
    },
  );
  return run;
}
async function checkLayout(page: Page, width: number) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const clipped = await page
    .getByRole("heading")
    .evaluateAll((elements) =>
      elements.some((el) => el.getBoundingClientRect().right > innerWidth + 1),
    );
  expect(clipped).toBe(false);
  const imageWidths = await page
    .locator("img")
    .evaluateAll((images) =>
      images.map(
        (image) =>
          (image as HTMLImageElement).complete &&
          (image as HTMLImageElement).naturalWidth > 0,
      ),
    );
  expect(imageWidths.every(Boolean)).toBe(true);
  expect(page.viewportSize()?.width).toBe(width);
}
async function chooseTheme(page: Page, theme: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page.getByRole("button", { name: theme, exact: true }).click();
  await page.getByRole("link", { name: "Go back" }).click();
}

for (const width of [390, 1440])
  for (const theme of ["light", "dark"]) {
    test(`Activities and Profile ${width}px ${theme}, honest empty states`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setViewportSize({ width, height: 844 });
      await chooseTheme(page, theme);
      await page
        .getByRole("tablist")
        .filter({ has: page.getByRole("tab", { name: "Home", exact: false }) })
        .getByRole("tab", { name: "Activities", exact: false })
        .click();
      await expect(page.getByTestId("training-stat-2")).toHaveText("0");
      await expect(page.getByText("No adventures recorded yet")).toBeVisible();
      await page.screenshot({
        path: `artifacts/phase3-review/activities-${width}-${theme}.png`,
      });
      await page
        .getByText("No adventures recorded yet", { exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `artifacts/phase3-review/activities-empty-${width}-${theme}.png`,
      });
      await page.getByRole("tab", { name: "Month", exact: true }).click();
      await expect(
        page.getByText("km · last 6 months", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("heading", { name: "Your training", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `artifacts/phase3-review/activities-month-${width}-${theme}.png`,
      });
      await page.getByRole("tab", { name: "Week", exact: true }).click();
      await page.getByRole("button", { name: "Walking", exact: true }).click();
      await expect(page.getByText("No walks recorded yet")).toBeVisible();
      await page
        .getByLabel("Search your activities", { exact: true })
        .fill("no matches");
      await expect(page.getByText("No matching activities")).toBeVisible();
      await checkLayout(page, width);
      await page.getByRole("tab", { name: "Profile", exact: false }).click();
      await expect(
        page.getByText("Your adventure awaits", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Edit profile", exact: true }),
      ).toHaveCount(0);
      const banner = page.getByRole("img", {
        name: "Nepal-inspired Himalayan profile banner",
      });
      await expect(banner).toHaveJSProperty("complete", true);
      await expect(banner).toHaveJSProperty("naturalWidth", 1536);
      await page.screenshot({
        path: `artifacts/phase3-review/profile-${width}-${theme}.png`,
      });
      const running = page.getByRole("checkbox", {
        name: "Prefer running",
        exact: true,
      });
      await running.click();
      await expect(running).toBeChecked();
      await page
        .getByRole("tablist")
        .filter({ has: page.getByRole("tab", { name: "Home", exact: false }) })
        .getByRole("tab", { name: "Activities", exact: false })
        .click();
      await page.getByRole("tab", { name: "Profile", exact: false }).click();
      await expect(running).toBeChecked();
      await page
        .getByText("Your first milestone is ahead", { exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByText("Your best is still ahead.", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `artifacts/phase3-review/profile-progress-${width}-${theme}.png`,
      });
      await checkLayout(page, width);
      await page
        .getByRole("button", { name: "Open settings", exact: true })
        .click();
      await expect(
        page
          .getByRole("heading", { name: "Settings & privacy", exact: true })
          .last(),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

for (const width of [390, 1440])
  test(`Activities refinements at ${width}px with isolated sport fixtures`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/activities");
    await expect(page.getByTestId("training-stat-2")).toHaveText("0");
    for (const [sport, title] of [
      ["Running", "No runs recorded yet"],
      ["Walking", "No walks recorded yet"],
      ["Cycling", "No rides recorded yet"],
      ["Hiking", "No hikes recorded yet"],
    ]) {
      await page.getByRole("button", { name: sport, exact: true }).click();
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      await expect(page.getByTestId("training-stat-2")).toHaveText("0");
    }
    const image = page.getByRole("img", {
      name: "Nepal-inspired landscape for your next adventure · editorial artwork",
    });
    await expect(image).toHaveJSProperty("complete", true);
    await expect(image).toHaveJSProperty("naturalWidth", 1536);
    await page.getByRole("button", { name: "All sports", exact: true }).click();
    await page
      .getByText("No adventures recorded yet", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/phase3-review/activities-refined-empty-${width}.png`,
    });
    await page
      .getByLabel("Search your activities", { exact: true })
      .fill("missing");
    await page
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    await expect(
      page.getByLabel("Search your activities", { exact: true }),
    ).toHaveValue("");
    await seedTestWorkouts(page, true);
    await expect(page.getByTestId("training-stat-2")).toHaveText("4");
    const totals = await page.getByTestId("training-stat-0").textContent();
    for (const sport of ["running", "walking", "cycling", "hiking"]) {
      await page
        .getByRole("button", {
          name: sport[0].toUpperCase() + sport.slice(1),
          exact: true,
        })
        .click();
      const card = page.getByRole("button", {
        name: `View Test fixture ${sport}`,
        exact: true,
      });
      await expect(card).toBeVisible();
      await expect(page.getByTestId("training-stat-0")).toHaveText(totals!);
      if (sport === "walking")
        await expect(
          card.getByText("No recorded route", { exact: true }),
        ).toBeVisible();
      else
        await expect(
          card.getByRole("img", {
            name: "Recorded route sketch, without a base map",
          }),
        ).toBeVisible();
      if (sport === "hiking")
        await expect(card.getByText("—", { exact: true })).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `artifacts/phase3-review/activities-refined-${sport}-fixture-${width}.png`,
      });
      await checkLayout(page, width);
    }
    await page.getByRole("button", { name: "All sports", exact: true }).click();
    await page
      .getByRole("button", { name: "Oldest first", exact: true })
      .or(page.getByRole("button", { name: "Newest first", exact: true }))
      .click();
    await expect(
      page.getByRole("button", { name: "Oldest first", exact: true }),
    ).toBeVisible();
    // Reload resets the browser's test-only in-memory store. Nothing was persisted.
    await page.reload();
    await expect(page.getByTestId("training-stat-2")).toHaveText("0");
    expect(errors).toEqual([]);
  });

for (const width of [390, 1440])
  test(`Recorded data UI at ${width}px with isolated test fixtures`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/activities");
    await expect(page.getByTestId("training-stat-2")).toHaveText("0");
    const run = await seedTestWorkouts(page);
    await expect(page.getByTestId("training-stat-2")).toHaveText("2");
    await page.getByRole("button", { name: "Running", exact: true }).click();
    const card = page.getByRole("button", {
      name: "View Test fixture running",
      exact: true,
    });
    await card.scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", {
        name: "View Test fixture walking",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      card.getByText(`${length(stats(run).meters, "km")} km`, { exact: true }),
    ).toBeVisible();
    await expect(
      card.getByRole("img", {
        name: "Recorded route sketch, without a base map",
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/phase3-review/activities-test-fixture-${width}.png`,
    });
    await card.click();
    await expect(
      page.getByRole("heading", { name: "Test fixture running", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      run.title,
    );
    await expect(
      page
        .getByLabel("Recorded activity statistics", { exact: true })
        .getByText(length(stats(run).meters, "km"), { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/phase3-review/activity-detail-test-fixture-${width}.png`,
    });
    await checkLayout(page, width);
    await page.getByRole("link", { name: "Go back" }).click();
    await page.getByRole("tab", { name: "Profile", exact: false }).click();
    // Other-account workouts remain stored but are hidden from this athlete's history and PRs.
    await expect(page.getByTestId("training-stat-2").last()).toHaveText("2");
    await page
      .getByRole("button", { name: "Longest activity", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Best average run pace", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/phase3-review/profile-records-test-fixture-${width}.png`,
    });
  });

/** Test-only Supabase adapter. Replaces one module in the served response, not disk. */
function accountFixture(
  _g: unknown,
  _r: unknown,
  _i: unknown,
  _a: unknown,
  _m: unknown,
  exports: Record<string, unknown>,
) {
  let session: unknown = {
    user: {
      id: "test-athlete",
      email: "athlete@example.test",
      user_metadata: { location: "Kathmandu, Nepal" },
    },
  };
  let profile = {
    id: "test-athlete",
    name: "Test Athlete",
    username: "test_athlete",
    bio: "Test account · mountains and morning runs",
    is_private: true,
    avatar_path: "test-athlete/avatar.svg",
  };
  const callbacks = new Set<(event: string, value: unknown) => void>();
  class Query {
    constructor(public table: string) {}
    select() {
      return this;
    }
    eq() {
      return this;
    }
    in() {
      return this;
    }
    update(value: Partial<typeof profile>) {
      profile = { ...profile, ...value };
      return this;
    }
    single() {
      return Promise.resolve({ data: profile, error: null });
    }
    maybeSingle() {
      return Promise.resolve({ data: { ...profile }, error: null });
    }
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve({
        data:
          this.table === "club_members"
            ? [{ club_id: "test-club" }]
            : this.table === "clubs"
              ? [{ id: "test-club", name: "Test fixture club" }]
              : [],
        error: null,
      }).then(resolve);
    }
  }
  const client = {
    from: (table: string) => new Query(table),
    rpc: async (_name: string, args: { patch: Partial<typeof profile> }) => {
      profile = { ...profile, ...args.patch };
      return { error: null };
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: {
            signedUrl:
              "data:image/svg+xml," +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#17695D"/><text x="40" y="48" text-anchor="middle" fill="white" font-family="Arial" font-size="24">TA</text></svg>',
              ),
          },
          error: null,
        }),
      }),
    },
    auth: {
      getUser: async () => ({
        data: { user: session ? (session as { user: unknown }).user : null },
        error: null,
      }),
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (
        callback: (event: string, value: unknown) => void,
      ) => {
        callbacks.add(callback);
        return {
          data: {
            subscription: { unsubscribe: () => callbacks.delete(callback) },
          },
        };
      },
      signOut: async () => {
        session = null;
        callbacks.forEach((callback) => callback("SIGNED_OUT", null));
        return { error: null };
      },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
  };
  exports.supabase = client;
  exports.backend = () => client;
  exports.storage = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };
}
for (const width of [390, 1440])
  test(`Authenticated profile editing and sign-out ${width}px with mocked backend`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/__common-*.js", async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      const marker = body.indexOf("Connect Supabase using .env");
      expect(marker).toBeGreaterThan(0);
      const start = body.lastIndexOf("__d(", marker);
      const end = body.slice(marker).match(/\},(\d+),\[[^\]]*\]\);/)!;
      body =
        body.slice(0, start) +
        `__d(${accountFixture.toString()},${end[1]},[]);` +
        body.slice(marker + end.index! + end[0].length);
      await route.fulfill({ response, body });
    });
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/profile");
    await expect(page.getByText("Test Athlete", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Kathmandu, Nepal", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Private athlete profile", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Your profile photo", exact: true }),
    ).toHaveJSProperty("complete", true);
    await page
      .getByRole("tablist", { name: "Profile sections", exact: true })
      .getByRole("tab", { name: "More", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Test fixture club", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/phase3-review/profile-authenticated-test-fixture-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    await page.getByLabel("First name", { exact: true }).fill("Updated");
    await page.getByLabel("Last name", { exact: true }).fill("Test Athlete");
    await page
      .getByRole("switch", { name: "Private profile", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Save profile", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Updated Test Athlete", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Private athlete profile", { exact: true }),
    ).toHaveCount(0);
    await checkLayout(page, width);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByText("Your adventure awaits", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Updated Test Athlete", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("img", { name: "Your profile photo", exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });

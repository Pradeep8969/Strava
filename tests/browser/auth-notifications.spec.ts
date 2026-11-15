import { expect, test, type Page } from "@playwright/test";
import { authBackendFixture } from "../fixtures/auth-backend";
import { readdirSync, readFileSync } from "node:fs";
import { trainingFixture } from "../fixtures/training";
async function mock(page: Page) {
  await page.route("**/__common-*.js", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    const marker = body.indexOf("Connect Supabase using .env");
    expect(marker).toBeGreaterThan(0);
    const start = body.lastIndexOf("__d(", marker);
    const end = body.slice(marker).match(/\},(\d+),\[[^\]]*\]\);/)!;
    body =
      body.slice(0, start) +
      `__d(${authBackendFixture.toString()},${end[1]},[]);` +
      body.slice(marker + end.index! + end[0].length);
    await route.fulfill({ response, body });
  });
}
async function screenshot(
  page: Page,
  name: string,
  width: number,
  theme: string,
) {
  await page
    .getByRole("heading", {
      name: /Welcome back\.|Adventure starts here\.|Your notifications/,
    })
    .first()
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((nodes) =>
          nodes.every(
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
  await page.screenshot({
    path: `artifacts/phase6-review/${name}-${width}-${theme}.png`,
  });
}
test("shared identity updates Home and Profile and clears on account switch and sign-out", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await expect(
    page.getByText("Google Test Runner", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Home", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Namaste, Google.", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("First name", { exact: true }).fill("Maya");
  await page.getByLabel("Last name", { exact: true }).fill("Sherpa");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Maya Sherpa", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Home", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Namaste, Maya.", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Namaste, Maya.", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      globalThis as unknown as { __authTest: { switchAccount: () => void } }
    ).__authTest.switchAccount(),
  );
  await expect(
    page.getByRole("heading", { name: "Namaste, Maya.", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("First name", { exact: true }).fill("Sita");
  await page.getByLabel("Last name", { exact: true }).fill("Rai");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Sita Rai", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Home", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Namaste, Sita.", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __authTest: { signOut: () => Promise<unknown> };
      }
    ).__authTest.signOut(),
  );
  await expect(
    page.getByRole("heading", { name: "Namaste, athlete.", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Maya|Sita/)).toHaveCount(0);
});
test("expanded profile fields, photo upload/custom Google precedence, deletion and drafts", async ({
  page,
}) => {
  await mock(page);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("https://example.test/google-photo.png", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: png }),
  );
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("City", { exact: true }).fill("Pokhara");
  await page.getByLabel("Province", { exact: true }).fill("Gandaki");
  await page
    .getByRole("button", { name: "Date of Birth", exact: true })
    .click();
  await chooseWheel(page, "Year", 1993);
  await chooseWheel(page, "Month", 5);
  await chooseWheel(page, "Day", 12);
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("72.5");
  await page
    .getByRole("button", { name: "Change profile picture", exact: true })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose Existing", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/Photo selected/)).toBeVisible();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Profile saved.", { exact: true })).toHaveCount(
    0,
  );
  const custom = await page
    .getByRole("img", { name: "Your profile photo", exact: true })
    .getAttribute("src");
  expect(custom).toContain("data:image/png");
  await page.getByRole("tab", { name: "Home", exact: false }).click();
  await expect(
    page.getByRole("img", { name: "Your account picture", exact: true }),
  ).toHaveAttribute("src", custom!);
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page.reload();
  await expect(
    page.getByText("Pokhara, Gandaki", { exact: true }).first(),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __authTest: { signOut: () => Promise<unknown> };
      }
    ).__authTest.signOut(),
  );
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Your profile photo", exact: true }),
  ).toHaveAttribute("src", custom!);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "72.5",
  );
  await expect(
    page.getByRole("button", { name: "Date of Birth", exact: true }),
  ).toHaveText("12 May 1993");
  await page
    .getByRole("button", { name: "Change profile picture", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete Picture", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete Picture", exact: true })
    .click();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Your profile photo", exact: true }),
  ).toHaveAttribute("src", "https://example.test/google-photo.png");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("City", { exact: true }).fill("Unsaved town");
  await page.reload();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue(
    "Unsaved town",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    page.getByText("Pokhara, Gandaki", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("tablist", { name: "Profile sections", exact: true })
    .getByRole("tab", { name: "Activities", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Record your first activity",
      exact: true,
    }),
  ).toBeVisible();
});
test("photo actions reject invalid files, explain camera denial, and cancel without uploading", async ({
  page,
}) => {
  await mock(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
      configurable: true,
    }),
  );
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Change profile picture", exact: true })
    .click();
  await page.getByRole("button", { name: "Take Picture", exact: true }).click();
  await expect(page.getByText(/Camera access was denied/)).toBeVisible();
  await page
    .getByRole("button", { name: "Change profile picture", exact: true })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose Existing", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("Choose a valid JPEG, PNG or WebP image.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Take Picture", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    page.getByText("Google Test Runner", { exact: true }),
  ).toBeVisible();
});
for (const width of [390, 1440]) {
  test(`one global settings button on all six tabs at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    for (const tab of [
      "Home",
      "Explore",
      "Record",
      "Events",
      "Activities",
      "Profile",
    ]) {
      await page.getByRole("tab", { name: tab, exact: false }).click();
      const settings = page.getByRole("button", {
        name: "Open settings",
        exact: true,
      });
      await expect(settings).toHaveCount(1);
      await expect(settings).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Recording settings", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Settings & privacy", exact: true }),
      ).toHaveCount(0);
      await settings.click();
      await expect(
        page
          .getByRole("heading", { name: "Settings & privacy", exact: true })
          .last(),
      ).toBeVisible();
      await expect(
        page.getByText("Recording settings", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("switch", { name: "Auto pause", exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Go back" }).click();
    }
  });
}
test("Google automatically synchronizes profile on first and returning sign-in with image fallback", async ({
  page,
}) => {
  await mock(page);
  await page.route("https://example.test/google-photo.png", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await expect(
    page.getByText("Google Test Runner", { exact: true }),
  ).toBeVisible();
  const photo = page.getByRole("img", {
    name: "Your profile photo",
    exact: true,
  });
  await expect(photo).toBeVisible();
  await expect
    .poll(() =>
      photo.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Import Google Profile", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("First name", { exact: true }).fill("Manual");
  await page.getByLabel("Last name", { exact: true }).fill("runner");
  await page.getByLabel("Bio", { exact: true }).fill("Preserve my bio");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Manual runner", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Manual runner", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __authTest: { signOut: () => Promise<unknown> };
      }
    ).__authTest.signOut(),
  );
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await expect(
    page.getByText("Google Test Runner", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Preserve my bio", { exact: true }),
  ).toBeVisible();
  await page.unroute("https://example.test/google-photo.png");
  await page.route("https://example.test/google-photo.png", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.reload();
  await expect(
    page.getByText("Google Test Runner", { exact: true }),
  ).toBeVisible();
  await expect(photo).toHaveCount(0);
});
for (const width of [390, 1440])
  for (const theme of ["light", "dark"])
    test(`premium authentication ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      await page
        .getByRole("button", { name: "Open settings", exact: true })
        .click();
      await page.getByRole("button", { name: theme, exact: true }).click();
      await page.getByRole("link", { name: "Go back" }).click();
      await page.getByRole("tab", { name: "Profile", exact: false }).click();
      await page
        .getByRole("button", {
          name: "Sign in or create an account",
          exact: true,
        })
        .click();
      await screenshot(page, "sign-in", width, theme);
      await page
        .getByLabel("Password", { exact: true })
        .fill("private-password");
      await page
        .getByRole("button", { name: "Show password", exact: true })
        .click();
      await expect
        .poll(() =>
          page
            .getByLabel("Password", { exact: true })
            .evaluate((n) => (n as HTMLInputElement).type),
        )
        .toBe("text");
      await page
        .getByRole("button", { name: "Hide password", exact: true })
        .click();
      await expect(
        page.getByLabel("Password", { exact: true }),
      ).toHaveAttribute("type", "password");
      await page
        .getByRole("tab", { name: "Create account", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await expect(
        page.getByText("Enter a valid email address.", { exact: true }),
      ).toBeVisible();
      await screenshot(page, "create-account-validation", width, theme);
    });
test("simulated email confirmation, inbox, read state, restoration, switch and no local draft attachment", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/organizer");
  await page
    .getByRole("button", { name: "New preview event", exact: true })
    .click();
  await page
    .getByLabel("Event name", { exact: true })
    .fill("Guest isolated draft");
  await page
    .getByLabel("Proposed location", { exact: true })
    .fill("Test venue");
  await page.getByLabel("Proposed date", { exact: true }).fill("2027-04-10");
  await page
    .getByRole("button", { name: "Save preview draft", exact: true })
    .click();
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("email@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(
      "Check your inbox to verify your email. Open the link on this device.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/auth/callback?code=confirm-email");
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", {
      name: "Welcome to StravaKinda! 🏔️",
      exact: true,
    }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(page.getByText(/^0 unread/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Welcome to StravaKinda! 🏔️",
      exact: true,
    }),
  ).toHaveCount(1);
  await page.goto("/organizer");
  await expect(page.getByTestId("organizer-metric-0")).toHaveText("0");
  await page.goto("/profile");
  await page
    .getByRole("tablist", { name: "Profile sections", exact: true })
    .getByRole("tab", { name: "More", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/organizer");
  await expect(page.getByTestId("organizer-metric-0")).toHaveText("1");
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("email@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "You’re connected.", exact: true }),
  ).toBeVisible();
  await page.goto("/notifications");
  expect(
    await page.evaluate(() =>
      (
        globalThis as unknown as { __authTest: { count: () => number } }
      ).__authTest.count(),
    ),
  ).toBe(1);
  await page.evaluate(() =>
    (
      globalThis as unknown as { __authTest: { switchAccount: () => void } }
    ).__authTest.switchAccount(),
  );
  await expect(page.getByText(/^1 unread/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark as read", exact: true }),
  ).toHaveCount(1);
});
for (const provider of ["Google", "Facebook"])
  test(`simulated new and returning ${provider} OAuth`, async ({ page }) => {
    await mock(page);
    await page.goto("/auth");
    await page
      .getByRole("button", { name: `Continue with ${provider}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Continue to Profile", exact: true })
      .click();
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", {
        name: "Welcome to StravaKinda! 🏔️",
        exact: true,
      }),
    ).toBeVisible();
    await page.evaluate(() =>
      (
        globalThis as unknown as {
          __authTest: { signOut: () => Promise<unknown> };
        }
      ).__authTest.signOut(),
    );
    await page.goto("/auth");
    await page
      .getByRole("button", { name: `Continue with ${provider}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Continue to Profile", exact: true })
      .click();
    await page.goto("/notifications");
    expect(
      await page.evaluate(() =>
        (
          globalThis as unknown as { __authTest: { count: () => number } }
        ).__authTest.count(),
      ),
    ).toBe(1);
  });
test("simulated recovery, provider cancellation and callback failures", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("recover@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Resend verification email",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/auth/callback?code=confirm-recover");
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __authTest: { signOut: () => Promise<unknown> };
      }
    ).__authTest.signOut(),
  );
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("recover@example.test");
  await page
    .getByRole("button", { name: "Forgot password", exact: true })
    .click();
  await expect(
    page.getByText(
      "If an account exists, a reset link is on its way. Open it on this device.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/auth/callback?code=recovery-test");
  await page
    .getByLabel("New password", { exact: true })
    .fill("new-test-password");
  await page.getByRole("button", { name: "Set password", exact: true }).click();
  await expect(
    page.getByText("Password updated. You can continue to your profile.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __authTest: { signOut: () => Promise<unknown> };
      }
    ).__authTest.signOut(),
  );
  await page.goto("/auth");
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __authTest: { cancel: (value: boolean) => void };
      }
    ).__authTest.cancel(true),
  );
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(
    page.getByText("Sign-in was cancelled. You can try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/auth/callback");
  await expect(
    page.getByRole("button", { name: "Return to sign in", exact: true }),
  ).toBeVisible();
});
test("simulated deletion requires confirmation and uses existing account endpoint", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Delete cloud account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep my account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm account deletion", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Delete cloud account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm account deletion", exact: true })
    .click();
  await expect(
    page.getByText(
      "Cloud account deleted. Local data has not been reassigned.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/notifications");
  await expect(
    page.getByRole("button", {
      name: "Sign in to view notifications",
      exact: true,
    }),
  ).toBeVisible();
});
test("account switching hides other-owner workouts and recording maps without deleting fixture data", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await page.getByRole("tab", { name: "Activities", exact: false }).click();
  await expect(page.getByTestId("training-stat-2")).toHaveText("0");
  const dir = "dist/_expo/static/js/web";
  const common = readdirSync(dir).find((f) => f.startsWith("__common-"))!;
  const body = readFileSync(`${dir}/${common}`, "utf8");
  const index = body.indexOf(".mutateWorkout=");
  const moduleId = Number(body.slice(index).match(/\},(\d+),\[/)![1]);
  const a = {
    ...trainingFixture("own-a"),
    title: "Private account A fixture",
    ownerId: "phase6-account-1",
  };
  const b = {
    ...trainingFixture("own-b"),
    title: "Private account B fixture",
    ownerId: "phase6-account-2",
  };
  const guest = trainingFixture("guest-local");
  const active = {
    ...b,
    id: "active-b",
    state: "paused" as const,
    endedAt: null,
  };
  await page.evaluate(
    ({ moduleId, workouts }) =>
      (
        globalThis as unknown as {
          __r: (id: number) => {
            useApp: { setState: (value: unknown) => void };
          };
        }
      )
        .__r(moduleId)
        .useApp.setState({ workouts, ready: true }),
    { moduleId, workouts: [a, b, guest, active] },
  );
  await expect(page.getByTestId("training-stat-2")).toHaveText("2");
  await expect(
    page.getByRole("button", {
      name: "View Private account B fixture",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Record", exact: false }).click();
  await expect(
    page.getByText("Recording belongs to another account", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      globalThis as unknown as { __authTest: { switchAccount: () => void } }
    ).__authTest.switchAccount(),
  );
  await page.getByRole("tab", { name: "Activities", exact: false }).click();
  await expect(
    page.getByRole("button", {
      name: "View Private account B fixture",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "View Private account A fixture",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      (id) =>
        (
          globalThis as unknown as {
            __r: (id: number) => {
              useApp: { getState: () => { workouts: unknown[] } };
            };
          }
        )
          .__r(id)
          .useApp.getState().workouts.length,
      moduleId,
    ),
  ).toBe(4);
});
test("simulated Realtime updates, offline retry and private inbox screenshots", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await page.goto("/notifications");
  await page.evaluate(() =>
    (
      globalThis as unknown as { __authTest: { insertUpdate: () => void } }
    ).__authTest.insertUpdate(),
  );
  await expect(
    page.getByRole("heading", { name: "Test account update", exact: true }),
  ).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await screenshot(page, "inbox", width, "light");
  }
  await page.evaluate(() =>
    (
      globalThis as unknown as { __authTest: { offline: (v: boolean) => void } }
    ).__authTest.offline(true),
  );
  await page
    .getByRole("button", { name: "Refresh notifications", exact: true })
    .click();
  await expect(
    page.getByText("Connection interrupted", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (
      globalThis as unknown as { __authTest: { offline: (v: boolean) => void } }
    ).__authTest.offline(false);
    window.dispatchEvent(new Event("online"));
  });
  await expect(
    page.getByText("Connection interrupted", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Test account update", exact: true }),
  ).toBeVisible();
});

async function chooseWheel(page: Page, label: string, value: number) {
  const wheel = page.getByRole("spinbutton", { name: label, exact: true });
  await wheel.focus();
  await wheel.press("Home");
  const minimum = label === "Year" ? new Date().getFullYear() - 120 : 1;
  for (let n = minimum; n < value; n++) await wheel.press("ArrowDown");
}

test("birthdate wheels cancel, clamp leap dates, restrict future dates and persist only after Save", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const field = page.getByRole("button", {
    name: "Date of Birth",
    exact: true,
  });
  await expect(field).toHaveText("Not set");
  await field.click();
  const dialog = page.getByRole("dialog", {
    name: "Choose Date of Birth",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await chooseWheel(page, "Year", 2004);
  await chooseWheel(page, "Month", 2);
  await chooseWheel(page, "Day", 29);
  await expect(
    page.getByRole("spinbutton", { name: "Day", exact: true }),
  ).toHaveAttribute("aria-valuemax", "29");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(field).toHaveText("Not set");
  await field.click();
  await chooseWheel(page, "Year", 2004);
  await chooseWheel(page, "Month", 2);
  await chooseWheel(page, "Day", 29);
  await page
    .getByRole("spinbutton", { name: "Year", exact: true })
    .press("ArrowDown");
  await expect(
    page.getByRole("spinbutton", { name: "Day", exact: true }),
  ).toHaveAttribute("aria-valuenow", "28");
  await page
    .getByRole("spinbutton", { name: "Year", exact: true })
    .press("ArrowUp");
  await chooseWheel(page, "Day", 29);
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(field).toHaveText("29 February 2004");
  await field.click();
  await expect(
    page.getByRole("spinbutton", { name: "Year", exact: true }),
  ).toHaveAttribute("aria-valuetext", "2004");
  await page
    .getByRole("spinbutton", { name: "Year", exact: true })
    .press("End");
  await page
    .getByRole("spinbutton", { name: "Month", exact: true })
    .press("End");
  await page.getByRole("spinbutton", { name: "Day", exact: true }).press("End");
  await expect(
    page.getByRole("spinbutton", { name: "Day", exact: true }),
  ).toHaveAttribute("aria-valuemax", String(new Date().getDate()));
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Profile saved.", { exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(field).toHaveText("29 February 2004");
  await field.click();
  const day = page.getByRole("spinbutton", { name: "Day", exact: true });
  await day.hover();
  await page.mouse.wheel(0, -88);
  await expect(day).not.toHaveAttribute("aria-valuenow", "29");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(field).toHaveText("29 February 2004");
});

test("profile save failures preserve the editor and allow retry", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("City", { exact: true }).fill("Pokhara");
  await page.evaluate(() => (globalThis as any).__authTest.offline(true));
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText(
      "Could not save profile. Simulated offline. Try saving again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Pokhara");
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => (globalThis as any).__authTest.offline(false));
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Pokhara", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Profile saved.", { exact: true })).toHaveCount(
    0,
  );
});

test.describe("touch birthdate picker", () => {
  test.use({ hasTouch: true, viewport: { width: 360, height: 740 } });
  test("touch drag scrolls a wheel and the dialog fits mobile and landscape", async ({
    page,
  }) => {
    await mock(page);
    await page.goto("/auth");
    await page
      .getByRole("button", { name: "Continue with Google", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Continue to Profile", exact: true })
      .tap();
    await page.getByRole("button", { name: "Edit profile", exact: true }).tap();
    await page
      .getByRole("button", { name: "Date of Birth", exact: true })
      .tap();
    const day = page.getByRole("spinbutton", { name: "Day", exact: true });
    await chooseWheel(page, "Day", 10);
    const box = (await day.boundingBox())!;
    const client = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 8; step++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - step * 10 }],
      });
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(day).not.toHaveAttribute("aria-valuenow", "10");
    await expect
      .poll(() =>
        day.evaluate((node) =>
          Math.abs(node.scrollTop / 44 - Math.round(node.scrollTop / 44)),
        ),
      )
      .toBeLessThan(0.01);
    await expect(
      page.getByRole("button", { name: "OK", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "artifacts/birthdate-picker/mobile.png" });
    await page.setViewportSize({ width: 844, height: 390 });
    await page
      .getByRole("button", { name: "OK", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "OK", exact: true }),
    ).toBeInViewport();
    await page
      .getByRole("dialog", { name: "Choose Date of Birth", exact: true })
      .getByRole("button", { name: "Cancel", exact: true })
      .tap();
    await expect(
      page.getByRole("button", { name: "Date of Birth", exact: true }),
    ).toHaveText("Not set");
  });
});

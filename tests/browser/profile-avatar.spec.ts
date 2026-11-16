import { expect, test } from "@playwright/test";
import { authBackendFixture } from "../fixtures/auth-backend";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test("recovers existing OAuth photo, preserves uploads and falls back safely", async ({
  page,
}) => {
  // Replace Supabase in the test bundle; never access production accounts.
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
  await page.route("https://example.test/*", (route) =>
    route.fulfill({
      status: route.request().url().includes("broken") ? 404 : 200,
      contentType: "image/png",
      body: route.request().url().includes("broken") ? Buffer.alloc(0) : png,
    }),
  );
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to Profile", exact: true })
    .click();
  const photo = page.getByRole("img", {
    name: "Your profile photo",
    exact: true,
  });
  const expectPhoto = async (url: string) => {
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute("src", url);
    await expect
      .poll(() =>
        photo.evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  };
  await expectPhoto("https://example.test/google-photo.png");
  const setStored = async (path: string | null) => {
    await page.evaluate((avatar_path) => {
      const key = "__phase6_server_fixture";
      const state = JSON.parse(localStorage.getItem(key)!);
      state.profiles[state.session.user.id].avatar_path = avatar_path;
      state.profiles[state.session.user.id].bio = "Keep edited bio";
      state.avatars[`${state.session.user.id}/custom.png`] =
        "https://example.test/custom.png";
      localStorage.setItem(key, JSON.stringify(state));
    }, path);
    await page.reload();
  };
  await setStored(null);
  await expectPhoto("https://example.test/google-photo.png");
  await page.reload();
  await expectPhoto("https://example.test/google-photo.png");
  expect(
    await page.evaluate(() => {
      const state = JSON.parse(
        localStorage.getItem("__phase6_server_fixture")!,
      );
      return {
        path: state.profiles[state.session.user.id].avatar_path,
        bio: state.profiles[state.session.user.id].bio,
      };
    }),
  ).toEqual({ path: null, bio: "Keep edited bio" });
  const ownPath = await page.evaluate(
    () =>
      `${JSON.parse(localStorage.getItem("__phase6_server_fixture")!).session.user.id}/custom.png`,
  );
  await setStored(ownPath);
  await expectPhoto("https://example.test/custom.png");
  await page.reload();
  await expectPhoto("https://example.test/custom.png");
  await setStored("https://example.test/broken.png");
  await expectPhoto("https://example.test/google-photo.png");
  await page.unroute("https://example.test/*");
  await page.route("https://example.test/*", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.reload();
  await expect(
    page.getByText("Google Test Runner", { exact: true }),
  ).toBeVisible();
  await expect(photo).toHaveCount(0);
  await page.evaluate(() =>
    (
      globalThis as unknown as { __authTest: { switchAccount: () => void } }
    ).__authTest.switchAccount(),
  );
  await expect(
    page.getByText("Google Test Runner", { exact: true }),
  ).toHaveCount(0);
  await expect(photo).toHaveCount(0);
});

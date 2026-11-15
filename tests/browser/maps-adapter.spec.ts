import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { trainingFixture } from "../fixtures/training";
test.skip(
  process.env.MAP_ADAPTER_TEST !== "true",
  "Requires explicit local development export",
);
for (const width of [390, 1440])
  test(`Map adapter lifecycle, GPS fixtures and denial at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("https://unpkg.com/**", (route) =>
      route.fulfill({
        contentType: route.request().url().endsWith(".css")
          ? "text/css"
          : "text/javascript",
        body: route.request().url().endsWith(".css")
          ? ""
          : readFileSync("tests/fixtures/maplibre-adapter.js", "utf8"),
      }),
    );
    await page.goto("/explore");
    await expect(
      page.getByRole("button", { name: "My location", exact: true }),
    ).toBeEnabled();
    const common = readdirSync("dist/_expo/static/js/web").find((f) =>
      f.startsWith("__common-"),
    )!;
    const body = readFileSync(`dist/_expo/static/js/web/${common}`, "utf8");
    const id = Number(
      body.slice(body.indexOf(".mutateWorkout=")).match(/\},(\d+),\[/)![1],
    );
    const run = trainingFixture();
    run.points[30].segment = 1;
    await page.evaluate(
      ({ id, run }) => {
        const runtime = globalThis as unknown as {
          __r: (id: number) => {
            useApp: { setState: (state: unknown) => void };
          };
        };
        runtime
          .__r(id)
          .useApp.setState({
            workouts: [
              run,
              { ...run, id: "inaccessible", ownerId: "other-user" },
            ],
          });
      },
      { id, run },
    );
    await expect(
      page.getByRole("button", { name: "Test fixture running", exact: false }),
    ).toHaveCount(1);
    const data = await page.evaluate(
      () =>
        (
          window as unknown as {
            __mapAdapter: {
              sources: {
                routes: {
                  data: {
                    features: { geometry: { coordinates: number[][] } }[];
                  };
                };
              };
            };
          }
        ).__mapAdapter.sources.routes.data,
    );
    expect(data.features.length).toBe(2);
    expect(data.features[0].geometry.coordinates[0]).toEqual([
      run.points[0].longitude,
      run.points[0].latitude,
    ]);
    await page
      .getByRole("button", { name: "Show Pokhara map", exact: true })
      .click();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __mapAdapter: { center: number[] } })
            .__mapAdapter.center,
      ),
    ).toEqual([83.98, 28.225]);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __mapConstructions: number })
            .__mapConstructions,
      ),
    ).toBe(1);
    await page.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (_success, failure) =>
        failure?.({
          code: 1,
          message: "denied",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
    });
    await page
      .getByRole("button", { name: "My location", exact: true })
      .click();
    await expect(page.getByText(/Location permission denied/)).toBeVisible();
    await page.getByLabel("Search routes", { exact: true }).fill("no matches");
    await expect(page.getByText(/No saved route geometry/)).toBeVisible();
    const empty = await page.evaluate(
      () =>
        (
          window as unknown as {
            __mapAdapter: {
              sources: { routes: { data: { features: unknown[] } } };
            };
          }
        ).__mapAdapter.sources.routes.data.features,
    );
    expect(empty).toHaveLength(0);
  });

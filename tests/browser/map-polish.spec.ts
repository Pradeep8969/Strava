import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

test.skip(
  process.env.MAP_ADAPTER_TEST !== "true",
  "Configured-map adapter export required",
);
type MapState = {
  center: number[];
  cameraCalls: unknown[];
  markers: unknown[];
  events: Record<string, ((value?: unknown) => void)[]>;
  sources: Record<string, { data: { features: unknown[] } }>;
};
async function setup(page: Page, code = 0, accuracy = 80) {
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
  await page.addInitScript(
    ({ code, accuracy }) => {
      (window as unknown as { __gpsRequests: number }).__gpsRequests = 0;
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (
            ok: PositionCallback,
            fail: PositionErrorCallback,
          ) => {
            (window as unknown as { __gpsRequests: number }).__gpsRequests++;
            queueMicrotask(() =>
              code
                ? fail({ code } as GeolocationPositionError)
                : ok({
                    timestamp: Date.now(),
                    coords: {
                      latitude: 27.8,
                      longitude: 85.4,
                      accuracy,
                      altitude: null,
                      altitudeAccuracy: null,
                      speed: null,
                      heading: null,
                    },
                  } as GeolocationPosition),
            );
          },
          watchPosition: () => 1,
          clearWatch: () => {},
        },
      });
    },
    { code, accuracy },
  );
}
async function mapSnapshot(page: Page) {
  return page.evaluate(() => {
    const map = (window as unknown as { __mapAdapter: MapState }).__mapAdapter;
    return {
      center: map.center,
      calls: map.cameraCalls.length,
      markers: map.markers.length,
      features: map.sources.routes?.data.features.length,
    };
  });
}
async function rows(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open("stravakinda", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db
            .transaction("workouts")
            .objectStore("workouts")
            .getAll();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
        };
      }),
  );
}
for (const width of [390, 768, 1440]) {
  test(`approximate Record recenter moves the camera without recording at ${width}`, async ({
    page,
  }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("/record");
    if (width < 1100)
      await page.getByRole("button", { name: "Show map", exact: true }).click();
    const button = page.getByRole("button", {
      name: "Recenter location",
      exact: true,
    });
    await expect(button).toBeEnabled();
    await button.click();
    await expect
      .poll(async () => (await mapSnapshot(page)).center)
      .toEqual([85.4, 27.8]);
    await expect(
      page.getByText(/Approximate location: about 80 m/),
    ).toBeVisible();
    expect((await mapSnapshot(page)).features).toBe(0);
    expect(await rows(page)).toEqual([]);
    await button.click();
    expect(
      await page.evaluate(
        () => (window as unknown as { __gpsRequests: number }).__gpsRequests,
      ),
    ).toBe(1);
    await page
      .getByRole("button", { name: "Start running activity", exact: true })
      .click();
    await expect(
      page.getByText("Waiting for accurate GPS", { exact: true }),
    ).toBeVisible();
    expect(await rows(page)).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
for (const [code, message] of [
  [1, "Location permission denied"],
  [2, "Location is unavailable"],
  [3, "Map location timed out"],
] as const) {
  test(`map location error ${code} gives feedback without moving the camera`, async ({
    page,
  }) => {
    await setup(page, code);
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto("/record");
    const button = page.getByRole("button", {
      name: "Recenter location",
      exact: true,
    });
    await expect(button).toBeEnabled();
    const before = await mapSnapshot(page);
    await button.click();
    await expect(page.getByText(new RegExp(message))).toBeVisible();
    expect((await mapSnapshot(page)).center).toEqual(before.center);
    expect(await rows(page)).toEqual([]);
    await expect(button).toBeEnabled();
  });
}
test("style diff clears loading without rebuilding the map or camera; waypoint markers are incremental", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/routes");
  await expect(
    page.getByRole("button", { name: "My location", exact: true }),
  ).toBeEnabled();
  for (let i = 0; i < 20; i++) {
    await page.evaluate(
      (i) =>
        (
          window as unknown as { __mapAdapter: MapState }
        ).__mapAdapter.events.click.forEach((fn) =>
          fn({ lngLat: { lat: 27.7, lng: 85.3 + i * 0.001 } }),
        ),
      i,
    );
    await expect(
      page.getByLabel(`Waypoint ${i + 1}`, { exact: true }),
    ).toBeVisible();
  }
  expect((await mapSnapshot(page)).markers).toBe(20);
  const before = await mapSnapshot(page);
  await page.getByRole("button", { name: "Map options", exact: true }).click();
  const outdoor = page.getByRole("button", {
    name: "Outdoor map",
    exact: true,
  });
  test.skip(
    !(await outdoor.isEnabled()),
    "Outdoor style needs the existing configured MapTiler key",
  );
  await outdoor.click();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect((await mapSnapshot(page)).features).toBe(1);
  expect((await mapSnapshot(page)).calls).toBe(before.calls);
  expect((await mapSnapshot(page)).markers).toBe(20);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __mapConstructions: number })
          .__mapConstructions,
    ),
  ).toBe(1);
});
test("busy GeoJSON sources do not drop the latest waypoint geometry", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/routes");
  await expect(
    page.getByRole("button", { name: "My location", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const map = (window as unknown as { __mapAdapter: MapState }).__mapAdapter;
    Object.assign(map, { styleReady: false });
    map.events.click.forEach((fn) => fn({ lngLat: { lat: 27.7, lng: 85.3 } }));
  });
  await expect(page.getByLabel("Waypoint 1", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as { __mapAdapter: MapState }
    ).__mapAdapter.events.click.forEach((fn) =>
      fn({ lngLat: { lat: 27.7, lng: 85.31 } }),
    ),
  );
  await expect.poll(async () => (await mapSnapshot(page)).features).toBe(1);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __mapAdapter: MapState }).__mapAdapter.sources
          .routes.data.features,
    ),
  ).toMatchObject([
    {
      geometry: {
        coordinates: [
          [85.3, 27.7],
          [85.31, 27.7],
        ],
      },
    },
  ]);
});
test("map retry cleans the old instance and its markers without reacting to stale errors", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/routes");
  await expect(
    page.getByRole("button", { name: "My location", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const map = (window as unknown as { __mapAdapter: MapState }).__mapAdapter;
    (window as unknown as { __oldMap: MapState }).__oldMap = map;
    map.events.click.forEach((fn) => fn({ lngLat: { lat: 27.7, lng: 85.3 } }));
    map.events.error.forEach((fn) => fn());
  });
  await page.getByRole("button", { name: "Retry map", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "My location", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Waypoint 1", { exact: true })).toHaveCount(1);
  expect(
    await page.evaluate(
      () => (window as unknown as { __mapRemovals: number }).__mapRemovals,
    ),
  ).toBe(1);
  await page.evaluate(() =>
    (window as unknown as { __oldMap: MapState }).__oldMap.events.error.forEach(
      (fn) => fn(),
    ),
  );
  await expect(page.getByRole("status")).toHaveCount(0);
});

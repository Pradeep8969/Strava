import { expect, test } from "@playwright/test";

test.skip(
  process.env.MAP_LIVE_TEST !== "true",
  "Requires actual MapLibre CDN and configured MapTiler access",
);
test.use({ hasTouch: true });
for (const width of [390, 768, 1440]) {
  test(`real MapLibre recenter changes the viewport using map-only GPS, then prioritizes accepted GPS at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.addInitScript(() => {
      type LiveMap = {
        jumpTo: (value: object) => void;
        getCenter: () => { lng: number; lat: number };
        project: (value: number[]) => { x: number; y: number };
        getContainer: () => HTMLElement;
        on: (event: string, callback: () => void) => void;
      };
      type State = {
        __liveMap: LiveMap;
        __accuracy: number;
        __gpsRequests: number;
      };
      const state = window as unknown as State;
      state.__accuracy = 80;
      state.__gpsRequests = 0;
      let library: unknown;
      Object.defineProperty(window, "maplibregl", {
        configurable: true,
        get: () => library,
        set: (value: { Map: new (options: unknown) => LiveMap }) => {
          const Map = value.Map;
          library = {
            ...value,
            Map: class extends Map {
              constructor(options: unknown) {
                super(options);
                state.__liveMap = this;
              }
            },
          };
        },
      });
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (ok: PositionCallback) => {
            state.__gpsRequests++;
            const approximate = state.__accuracy > 35;
            queueMicrotask(() =>
              ok({
                timestamp: Date.now(),
                coords: {
                  latitude: approximate ? 27.8 : 27.7,
                  longitude: approximate ? 85.4 : 85.3,
                  accuracy: state.__accuracy,
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
    });
    await page.goto("/record");
    if (width < 1100)
      await page.getByRole("button", { name: "Show map", exact: true }).click();
    const recenter = page.getByRole("button", {
      name: "Recenter location",
      exact: true,
    });
    await expect(recenter).toBeEnabled({ timeout: 30000 });
    await page.evaluate(() =>
      (
        window as unknown as { __liveMap: { jumpTo: (value: object) => void } }
      ).__liveMap.jumpTo({ center: [84, 28], zoom: 10 }),
    );
    await recenter.click();
    const center = () =>
      page.evaluate(() => {
        const point = (
          window as unknown as {
            __liveMap: { getCenter: () => { lng: number; lat: number } };
          }
        ).__liveMap.getCenter();
        return [Number(point.lng.toFixed(5)), Number(point.lat.toFixed(5))];
      });
    await expect.poll(center).toEqual([85.4, 27.8]);
    await expect(
      page.getByText(/Approximate location: about 80 m/),
    ).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __accuracy: number }).__accuracy = 5;
    });
    await page
      .getByRole("button", { name: "Start running activity", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause activity", exact: true }),
    ).toBeEnabled();
    const requests = await page.evaluate(
      () => (window as unknown as { __gpsRequests: number }).__gpsRequests,
    );
    const canvas = page.locator(".maplibregl-canvas");
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + 80, bounds.y + 80);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 220, bounds.y + 160, { steps: 6 });
    await page.mouse.up();
    await expect(
      page.getByRole("button", { name: "Follow location", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await recenter.click();
    await expect.poll(center).toEqual([85.3, 27.7]);
    expect(
      await page.evaluate(
        () => (window as unknown as { __gpsRequests: number }).__gpsRequests,
      ),
    ).toBe(requests);
    const centered = await page.evaluate(() => {
      const map = (
        window as unknown as {
          __liveMap: {
            project: (value: number[]) => { x: number; y: number };
            getContainer: () => HTMLElement;
          };
        }
      ).__liveMap;
      const point = map.project([85.3, 27.7]);
      const box = map.getContainer().getBoundingClientRect();
      return Math.hypot(point.x - box.width / 2, point.y - box.height / 2);
    });
    expect(centered).toBeLessThan(2);
  });
}
test("live Route Studio touch placement, fit and style-diff completion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1080 });
  await page.goto("/routes");
  await expect(
    page.getByRole("button", { name: "My location", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.click({ position: { x: 80, y: 120 } });
  await canvas.tap({ position: { x: 240, y: 220 } });
  await expect(page.getByLabel("Waypoint 2", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Fit map to route", exact: true })
    .click();
  await page.getByRole("button", { name: "Map options", exact: true }).click();
  await page.getByRole("button", { name: "Outdoor map", exact: true }).click();
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByLabel("Waypoint 2", { exact: true })).toBeVisible();
});

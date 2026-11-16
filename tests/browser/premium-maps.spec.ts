import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { trainingFixture } from "../fixtures/training";
import type { Workout } from "../../types/activity";

test.skip(
  process.env.MAP_ADAPTER_TEST !== "true",
  "Requires the explicit configured-map test export",
);
type Adapter = {
  center: number[];
  cameraCalls: unknown[];
  markers: { point: number[]; element: HTMLElement }[];
  events: Record<string, ((event?: unknown) => void)[]>;
  sources: {
    routes?: {
      data: { features: { geometry: { coordinates: number[][] } }[] };
    };
  };
};
async function adapter(page: Page) {
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
}
async function emit(page: Page, name: string, event: unknown = {}) {
  await page.evaluate(
    ({ name, event }) =>
      (window as unknown as { __mapAdapter: Adapter }).__mapAdapter.events[
        name
      ]?.forEach((fn) => fn(event)),
    { name, event },
  );
}
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const map = (window as unknown as { __mapAdapter: Adapter }).__mapAdapter;
    return {
      center: map.center,
      calls: map.cameraCalls.length,
      data: map.sources.routes?.data,
      latest: map.markers
        .filter(
          (marker) =>
            marker.element.isConnected &&
            marker.element.getAttribute("aria-label") ===
              "Latest accepted GPS location",
        )
        .map((marker) => marker.point),
      instances: (window as unknown as { __mapConstructions: number })
        .__mapConstructions,
    };
  });
}
async function gps(page: Page) {
  await page.addInitScript(() => {
    let callback: PositionCallback | undefined;
    const fix = (latitude = 27.7) =>
      ({
        timestamp: Date.now(),
        coords: {
          latitude,
          longitude: 85.3,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          speed: null,
          heading: null,
        },
      }) as GeolocationPosition;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) =>
          queueMicrotask(() => ok(fix())),
        watchPosition: (ok: PositionCallback) => {
          callback = ok;
          return 1;
        },
        clearWatch: () => {
          callback = undefined;
        },
      },
    });
    (window as unknown as { __gpsEmit: (latitude: number) => void }).__gpsEmit =
      (latitude) => callback?.(fix(latitude));
  });
}
async function seed(page: Page, workouts: Workout[], plans: unknown[] = []) {
  await page.goto("/activities");
  await page.evaluate(
    ({ workouts, plans }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("stravakinda", 1);
        open.onupgradeneeded = () => {
          open.result.createObjectStore("workouts", { keyPath: "id" });
          open.result.createObjectStore("kv");
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["workouts", "kv"], "readwrite");
          workouts.forEach((workout) =>
            tx.objectStore("workouts").put(workout),
          );
          tx.objectStore("kv").put(plans, "routes");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
      }),
    { workouts, plans },
  );
}

for (const width of [390, 1440]) {
  test(`Record GPS updates, manual camera, recenter and map recovery at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await adapter(page);
    await gps(page);
    await page.clock.install();
    await page.goto("/record");
    await page
      .getByRole("button", { name: "Start running activity", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause activity", exact: true }),
    ).toBeEnabled();
    if (width < 1100)
      await page.getByRole("button", { name: "Show map", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Follow location", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => (await snapshot(page)).latest)
      .toEqual([[85.3, 27.7]]);
    await emit(page, "movestart", { originalEvent: {} });
    await expect(
      page.getByRole("button", { name: "Follow location", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    const before = await snapshot(page);
    await page.clock.fastForward(10000);
    await page.evaluate(() =>
      (
        window as unknown as { __gpsEmit: (latitude: number) => void }
      ).__gpsEmit(27.7005),
    );
    await expect
      .poll(async () => (await snapshot(page)).latest)
      .toEqual([[85.3, 27.7005]]);
    const updated = await snapshot(page);
    expect(updated.data!.features[0].geometry.coordinates).toEqual([
      [85.3, 27.7],
      [85.3, 27.7005],
    ]);
    expect(updated.calls).toBe(before.calls);
    expect(updated.instances).toBe(before.instances);
    await page
      .getByRole("button", { name: "Recenter location", exact: true })
      .click();
    await expect
      .poll(async () => (await snapshot(page)).center)
      .toEqual([85.3, 27.7005]);
    await page
      .getByRole("button", { name: "Pause activity", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Recenter location", exact: true }),
    ).toBeEnabled();
    await emit(page, "error");
    await expect(page.getByRole("status")).toContainText(
      "Map provider unavailable",
    );
    await expect(
      page.getByRole("button", { name: "Resume activity", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Retry map", exact: true }).click();
    await expect
      .poll(async () => (await snapshot(page)).latest)
      .toEqual([[85.3, 27.7005]]);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveCount(6);
  });
  test(`Explore marker selection and preview preserve a single map at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await adapter(page);
    const workout = trainingFixture();
    await seed(
      page,
      [workout, { ...workout, id: "foreign", ownerId: "another-account" }],
      [
        {
          id: "plan",
          title: "Saved test plan",
          points: workout.points.slice(0, 3),
        },
      ],
    );
    await page.goto("/explore");
    await expect(page.locator("canvas")).toHaveCount(1);
    await page
      .getByRole("button", { name: /Saved test plan.*Straight-line plan/ })
      .click();
    await expect(
      page.getByText(/Approximate straight-line distance:/),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Straight-line waypoint sketch, without a base map",
      }),
    ).toHaveCount(0);
    expect(
      (await snapshot(page)).data!.features[0].geometry.coordinates,
    ).toEqual(
      workout.points
        .slice(0, 3)
        .map((point) => [point.longitude, point.latitude]),
    );
    await page
      .getByRole("button", { name: "Recenter map", exact: true })
      .click();
    expect((await snapshot(page)).instances).toBe(1);
    await page
      .getByRole("button", { name: "Map options", exact: true })
      .click();
    const outdoor = page.getByRole("button", {
      name: "Outdoor map",
      exact: true,
    });
    if (await outdoor.isEnabled()) {
      const cameraBeforeStyle = (await snapshot(page)).calls;
      await outdoor.click();
      await expect(
        page.getByRole("button", { name: "Street map", exact: true }),
      ).toBeVisible();
      await expect
        .poll(async () => (await snapshot(page)).data?.features.length)
        .toBeGreaterThan(0);
      expect((await snapshot(page)).calls).toBe(cameraBeforeStyle);
    }
    await expect(
      page.getByRole("button", { name: /Test fixture running.*Recorded GPS/ }),
    ).toHaveCount(1);
    await expect(
      page
        .getByRole("button", {
          name: /Destination reference, not a verified trail/,
        })
        .first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Show Pokhara map", exact: true })
      .click();
    await expect
      .poll(async () => (await snapshot(page)).center)
      .toEqual([83.98, 28.225]);
    expect((await snapshot(page)).instances).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
test("Activity Details renders actual segmented stored geometry and preserves statistics", async ({
  page,
}) => {
  await adapter(page);
  const workout = trainingFixture();
  workout.points[30].segment = 1;
  await seed(page, [workout]);
  await page.goto(`/activity/${workout.id}`);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(async () => (await snapshot(page)).data?.features.length)
    .toBe(2);
  expect(
    (await snapshot(page)).data!.features[0].geometry.coordinates[0],
  ).toEqual([workout.points[0].longitude, workout.points[0].latitude]);
  await expect(page.getByLabel("Recorded activity statistics")).toContainText(
    "Moving time",
  );
  await expect(
    page.getByRole("button", { name: "Recenter map", exact: true }),
  ).toBeEnabled();
});
test("empty and other-account activity details do not initialize maps or expose raw geometry", async ({
  page,
}) => {
  await adapter(page);
  const empty = { ...trainingFixture("empty"), points: [] };
  const foreign = {
    ...trainingFixture("foreign"),
    ownerId: "other-user",
    visibility: "public" as const,
  };
  await seed(page, [empty, foreign]);
  await page.goto("/activity/empty");
  await expect(
    page.getByText("No recorded route for this activity.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.goto("/activity/foreign");
  await expect(
    page.getByText("Activity unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});
test("map library failure leaves GPS recording usable and retry restores its route", async ({
  page,
}) => {
  await page.route("https://unpkg.com/**", (route) => route.abort());
  await gps(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/record");
  await expect(page.getByRole("status")).toContainText(
    "Unable to load the map",
  );
  await page
    .getByRole("button", { name: "Start running activity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause activity", exact: true }),
  ).toBeEnabled();
  await page.unroute("https://unpkg.com/**");
  await adapter(page);
  await page.getByRole("button", { name: "Retry map", exact: true }).click();
  await expect
    .poll(async () => (await snapshot(page)).latest)
    .toEqual([[85.3, 27.7]]);
  await page
    .getByRole("button", { name: "Finish & save", exact: true })
    .click();
  await expect(
    page.getByText("Activity saved. Find it in Activities.", { exact: true }),
  ).toBeVisible();
});
test("a route-rendering exception leaves the recording controls usable", async ({
  page,
}) => {
  await adapter(page);
  await gps(page);
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/record");
  await page
    .getByRole("button", { name: "Start running activity", exact: true })
    .click();
  await expect
    .poll(async () => (await snapshot(page)).latest)
    .toEqual([[85.3, 27.7]]);
  await page.evaluate(() => {
    const map = (window as unknown as { __mapAdapter: Adapter }).__mapAdapter;
    Object.assign(map.sources.routes!, {
      setData: () => {
        throw new Error("Test-only rendering failure");
      },
    });
  });
  await page.clock.fastForward(10000);
  await page.evaluate(() =>
    (window as unknown as { __gpsEmit: (latitude: number) => void }).__gpsEmit(
      27.7005,
    ),
  );
  await expect
    .poll(async () => (await snapshot(page)).latest)
    .toEqual([[85.3, 27.7005]]);
  await page.clock.runFor(1);
  await expect(page.getByRole("status")).toContainText(
    "route rendering failed",
  );
  await page
    .getByRole("button", { name: "Finish & save", exact: true })
    .click();
  await expect(
    page.getByText("Activity saved. Find it in Activities.", { exact: true }),
  ).toBeVisible();
});

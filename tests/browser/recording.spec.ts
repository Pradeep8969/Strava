import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function gps(
  page: Page,
  failure = 0,
  firstFix: { accuracy?: number; ageMs?: number } = {},
) {
  await page.addInitScript(
    ({ failure, firstFix }) => {
      let success: PositionCallback | undefined;
      let error: PositionErrorCallback | undefined;
      let requests = 0;
      const position = (latitude = 27.7, extra: object = {}) =>
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
            ...extra,
          },
        }) as GeolocationPosition;
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (
            ok: PositionCallback,
            fail: PositionErrorCallback,
          ) => {
            requests++;
            queueMicrotask(() =>
              failure && requests === 1
                ? fail({ code: failure } as GeolocationPositionError)
                : ok(
                    requests === 1
                      ? {
                          ...position(27.7, {
                            accuracy: firstFix.accuracy ?? 5,
                          }),
                          timestamp: Date.now() - (firstFix.ageMs ?? 0),
                        }
                      : position(),
                  ),
            );
          },
          watchPosition: (
            ok: PositionCallback,
            fail: PositionErrorCallback,
          ) => {
            success = ok;
            error = fail;
            return 1;
          },
          clearWatch: () => {
            success = undefined;
            error = undefined;
          },
        },
      });
      (window as unknown as { __gps: unknown }).__gps = {
        count: () => requests,
        emit: (latitude: number, extra = {}) =>
          success?.(position(latitude, extra)),
        fail: (code: number) => error?.({ code } as GeolocationPositionError),
      };
    },
    { failure, firstFix },
  );
}
async function stored(page: Page) {
  return page.evaluate(
    () =>
      new Promise<import("../../types/activity").Workout[]>(
        (resolve, reject) => {
          const open = indexedDB.open("stravakinda", 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("workouts", "readonly");
            const request = tx.objectStore("workouts").getAll();
            tx.oncomplete = () => {
              resolve(request.result);
              db.close();
            };
          };
        },
      ),
  );
}
for (const width of [390, 1440]) {
  test(`real browser pipeline records GPS callback measurements, pauses/resumes and persists at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await gps(page);
    await page.clock.install();
    await page.goto("/record");
    await expect(
      page.getByRole("button", { name: "Start running activity", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() =>
        (window as unknown as { __gps: { count: () => number } }).__gps.count(),
      ),
    ).toBe(0);
    await page
      .getByRole("button", { name: "Start running activity", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause activity", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByText(/Browser recording is foreground-only/),
    ).toBeVisible();
    await page.clock.fastForward(10000);
    await page.evaluate(() =>
      (
        window as unknown as { __gps: { emit: (lat: number) => void } }
      ).__gps.emit(27.7005),
    );
    await expect
      .poll(async () => (await stored(page))[0]?.points.length)
      .toBe(2);
    await expect(page.getByTestId("record-distance")).not.toHaveText("0.00");
    const measured = await page.getByTestId("record-distance").textContent();
    await page
      .getByRole("button", { name: "Pause activity", exact: true })
      .click();
    const time = await page.getByTestId("record-active-time").textContent();
    await page.clock.fastForward(30000);
    await expect(page.getByTestId("record-active-time")).toHaveText(time!);
    await page
      .getByRole("button", { name: "Resume activity", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause activity", exact: true }),
    ).toBeEnabled();
    await expect(page.getByTestId("record-distance")).toHaveText(measured!);
    if (width < 1100)
      await page.getByRole("button", { name: "Show map", exact: true }).click();
    await expect(
      page.getByRole("region", { name: /Interactive map/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Finish & save", exact: true })
      .click();
    await expect(
      page.getByText("Activity saved. Find it in Activities.", { exact: true }),
    ).toBeVisible();
    expect((await stored(page))[0].state).toBe("finished");
    expect((await stored(page))[0].segment).toBe(1);
    await page.getByRole("tab", { name: "Activities", exact: false }).click();
    await expect(
      page.getByText("Running workout", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Running workout", { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Home", exact: false }).click();
    await expect(
      page.getByText("Running workout", { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Profile", exact: false }).click();
    await expect(page.getByTestId("training-stat-2")).toHaveText("1");
    await expect(page.getByTestId("training-stat-0")).toHaveText(measured!);
    await page.getByRole("tab", { name: "Activities", exact: false }).click();
    // Reopen the persisted library without the Home tab's mounted duplicate card.
    await expect(page).toHaveURL(/\/activities$/);
    await page.reload();
    const activity = page.getByRole("button", {
      name: "View Running workout",
      exact: true,
    });
    await expect(activity).toHaveCount(1);
    await activity.click();
    await expect(page).toHaveURL(/\/activity\//);
    await expect(
      page.getByRole("heading", { name: "Running workout", exact: true }),
    ).toBeVisible();
    expect(await stored(page)).toHaveLength(1);
  });
}
for (const sample of [
  { accuracy: 120, ageMs: 0, detail: "approximately 120 m" },
  { accuracy: 5, ageMs: 20000, detail: "stale (20 seconds old)" },
]) {
  test(`explains rejected acquisition (${sample.detail}) and retries without reload`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gps(page, 0, sample);
    await page.goto("/record");
    await page
      .getByRole("button", { name: "Start running activity", exact: true })
      .click();
    await expect(
      page.getByText("Waiting for accurate GPS", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        new RegExp(sample.detail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      ),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await stored(page)).toEqual([]);
    await expect(page.getByTestId("record-active-time")).toHaveText("00:00:00");
    await expect(page.getByRole("tab")).toHaveCount(6);
    await expect(
      page.getByRole("region", { name: /Interactive map/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Retry GPS", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pause activity", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Retry GPS", exact: true }),
    ).toHaveCount(0);
    expect((await stored(page))[0].points).toHaveLength(1);
  });
}
for (const [code, detail] of [
  [1, "permission was denied"],
  [2, "location is unavailable"],
  [3, "GPS timed out"],
] as const) {
  test(`browser acquisition error ${code} explains the failure and permits retry`, async ({
    page,
  }) => {
    await gps(page, code);
    await page.goto("/record");
    await page
      .getByRole("button", { name: "Start running activity", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(detail);
    expect(await stored(page)).toEqual([]);
    await page.getByRole("button", { name: "Retry GPS", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pause activity", exact: true }),
    ).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await stored(page)).toHaveLength(1);
  });
}
test("denied permission leaves no workout and explains how to enable location", async ({
  page,
}) => {
  await gps(page, 1);
  await page.goto("/record");
  await page
    .getByRole("button", { name: "Start running activity", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Location permission was denied",
  );
  expect(await stored(page)).toEqual([]);
});
test("unsupported browser disables Start with an explanation", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "geolocation", { value: undefined }),
  );
  await page.goto("/record");
  await expect(
    page.getByRole("button", { name: "Start running activity", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/This browser does not support location recording/),
  ).toBeVisible();
});
test("GPS failure pauses, reload recovers safely, and web Discard actually deletes", async ({
  page,
}) => {
  await gps(page);
  await page.goto("/record");
  await page
    .getByRole("button", { name: "Start running activity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause activity", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() =>
    (
      window as unknown as { __gps: { fail: (code: number) => void } }
    ).__gps.fail(2),
  );
  await expect(
    page.getByRole("button", { name: "Resume activity", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("alert")).toContainText(
    "location is unavailable",
  );
  await page
    .getByRole("button", { name: "Resume activity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause activity", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume activity", exact: true }),
  ).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Discard workout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start running activity", exact: true }),
  ).toBeEnabled();
  expect(await stored(page)).toEqual([]);
});
test("in-app navigation preserves recording and cancelled discard keeps it", async ({
  page,
}) => {
  await gps(page);
  await page.goto("/record");
  await page
    .getByRole("button", { name: "Start running activity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause activity", exact: true }),
  ).toBeEnabled();
  const id = (await stored(page))[0].id;
  await page.getByRole("button", { name: "Back to Home", exact: true }).click();
  await page.getByRole("tab", { name: "Record", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "Pause activity", exact: true }),
  ).toBeEnabled();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Discard workout", exact: true })
    .click();
  expect((await stored(page)).map((w) => w.id)).toEqual([id]);
  expect((await stored(page))[0].state).toBe("recording");
});

test("interactive recording map receives measured GPS geometry when maps are configured", async ({
  page,
}) => {
  test.skip(
    process.env.MAP_ADAPTER_TEST !== "true",
    "Requires an explicit development map export",
  );
  await gps(page);
  await page.clock.install();
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
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/record");
  await page
    .getByRole("button", { name: "Start running activity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause activity", exact: true }),
  ).toBeEnabled();
  await page.clock.fastForward(10000);
  await page.evaluate(() =>
    (
      window as unknown as { __gps: { emit: (lat: number) => void } }
    ).__gps.emit(27.7005),
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const map = (
          window as unknown as {
            __mapAdapter?: {
              sources: Record<
                string,
                {
                  data: {
                    features: { geometry: { coordinates: number[][] } }[];
                  };
                }
              >;
            };
          }
        ).__mapAdapter;
        return map?.sources.routes?.data.features[0]?.geometry.coordinates;
      }),
    )
    .toEqual([
      [85.3, 27.7],
      [85.3, 27.7005],
    ]);
  await page
    .getByRole("button", { name: "Pause activity", exact: true })
    .click();
});

import { chromium, expect, test, type Page } from "@playwright/test";
import { readFileSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";

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
async function records(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open("stravakinda", 1);
        open.onerror = () => reject(new Error("Fixture database unavailable"));
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("kv", "readonly");
          const request = tx.objectStore("kv").get("routes");
          tx.oncomplete = () => {
            db.close();
            resolve(request.result);
          };
          tx.onerror = () => reject(new Error("Fixture read failed"));
        };
      }),
  );
}
test("saved plans survive a complete browser process restart on the same origin", async ({
  baseURL,
}, testInfo) => {
  test.skip(
    process.env.MAP_ADAPTER_TEST !== "true",
    "Requires configured map export",
  );
  const directory = mkdtempSync(resolve(testInfo.outputDir, "../profile-"));
  let context = await chromium.launchPersistentContext(directory, {
    channel: "msedge",
    headless: true,
  });
  try {
    let page = await context.newPage();
    await adapter(page);
    await page.goto(`${baseURL}/routes`);
    await expect(page.locator("canvas")).toBeVisible();
    await page.evaluate(() => {
      const map = (
        window as unknown as {
          __mapAdapter: { events: Record<string, ((e: unknown) => void)[]> };
        }
      ).__mapAdapter;
      for (const lng of [85.3, 85.31])
        map.events.click.forEach((fn) => fn({ lngLat: { lat: 27.7, lng } }));
    });
    await page
      .getByLabel("Route name", { exact: true })
      .fill("Restart fixture");
    await page
      .getByRole("button", { name: "Save route offline", exact: true })
      .click();
    await expect(page.getByText(/Route geometry saved/)).toBeVisible();
    const before = await records(page);
    await context.close();
    context = await chromium.launchPersistentContext(directory, {
      channel: "msedge",
      headless: true,
    });
    page = await context.newPage();
    await adapter(page);
    await page.goto(`${baseURL}/routes`);
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.getByLabel("Route name", { exact: true })).toHaveValue(
      "Restart fixture",
    );
    expect(await records(page)).toEqual(before);
    await page.goto(`${baseURL}/explore`);
    await expect(
      page.getByRole("button", { name: "Preview saved route Restart fixture" }),
    ).toBeVisible();
    const alternate = new URL(baseURL!);
    alternate.hostname =
      alternate.hostname === "localhost" ? "127.0.0.1" : "localhost";
    await page.goto(`${alternate.origin}/routes`);
    await expect(page.getByLabel("Route name", { exact: true })).toBeVisible();
    expect(await records(page)).toBeUndefined();
  } finally {
    await context.close();
  }
});

test("malformed records cannot hide valid legacy plans or be rewritten by loading", async ({
  page,
}) => {
  await adapter(page);
  await page.goto("/routes");
  await expect(page.getByLabel("Route name", { exact: true })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open("stravakinda", 1);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(
            [
              {
                id: "legacy",
                title: "Legacy fixture",
                points: [
                  { latitude: 27.7, longitude: 85.3 },
                  { latitude: 27.71, longitude: 85.31 },
                ],
                originalMetadata: "keep",
              },
              { id: "broken" },
            ],
            "routes",
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  const before = await records(page);
  await page.reload();
  await expect(
    page.getByText(/1 saved route record\(s\) could not be opened/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByLabel("Route name", { exact: true })).toHaveValue(
    "Legacy fixture",
  );
  await expect(
    page.getByRole("button", { name: "Save route offline", exact: true }),
  ).toBeDisabled();
  await page.goto("/explore");
  await expect(
    page.getByRole("button", { name: "Preview saved route Legacy fixture" }),
  ).toBeVisible();
  const diagnostic = await page.evaluate(
    readFileSync("scripts/route-storage-diagnostic.js", "utf8"),
  );
  expect(JSON.stringify(diagnostic)).not.toContain("85.3");
  expect(JSON.stringify(diagnostic)).toContain("Legacy fixture");
  expect(await records(page)).toEqual(before);
  await page.evaluate(() => {
    localStorage.setItem("legacy-plans", "{broken fixture");
    Object.defineProperty(indexedDB, "databases", {
      value: undefined,
      configurable: true,
    });
  });
  const unsupported = await page.evaluate(
    readFileSync("scripts/route-storage-diagnostic.js", "utf8"),
  );
  expect(JSON.stringify(unsupported)).toContain("Malformed route JSON");
  expect(JSON.stringify(unsupported)).toContain(
    "IndexedDB inventory unavailable",
  );
});

test("simultaneous saves in two tabs retain both plans", async ({
  context,
}) => {
  test.skip(
    process.env.MAP_ADAPTER_TEST !== "true",
    "Requires configured map export",
  );
  const pages = [await context.newPage(), await context.newPage()];
  for (const [index, page] of pages.entries()) {
    await adapter(page);
    await page.goto("/routes");
    await expect(page.locator("canvas")).toBeVisible();
    await page.evaluate(() => {
      const map = (
        window as unknown as {
          __mapAdapter: { events: Record<string, ((e: unknown) => void)[]> };
        }
      ).__mapAdapter;
      for (const lng of [85.3, 85.31])
        map.events.click.forEach((fn) => fn({ lngLat: { lat: 27.7, lng } }));
    });
    await page
      .getByLabel("Route name", { exact: true })
      .fill(`Tab fixture ${index}`);
  }
  await Promise.all(
    pages.map((page) =>
      page
        .getByRole("button", { name: "Save route offline", exact: true })
        .click(),
    ),
  );
  for (const page of pages)
    await expect(page.getByText(/Route geometry saved/)).toBeVisible();
  expect(await records(pages[0])).toHaveLength(2);
  await pages[0].reload();
  await expect(
    pages[0].getByRole("button", { name: "Open", exact: true }),
  ).toHaveCount(2);
});

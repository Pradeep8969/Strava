import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const route = (id: string, title = id) => ({
  id,
  title,
  points: [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
  ],
  privateMetadata: { preserve: true },
});
const pack = (value: unknown, origin: string) =>
  JSON.stringify({
    format: "stravakinda-route-backup-v1",
    origin,
    records: [{ location: "IndexedDB:stravakinda/kv/routes", value }],
  });
async function stored(page: Page, value?: unknown) {
  return page.evaluate(
    ({ write, value }) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open("stravakinda", 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction("kv", write ? "readwrite" : "readonly");
          const request = write
            ? tx.objectStore("kv").put(value, "routes")
            : tx.objectStore("kv").get("routes");
          tx.oncomplete = () => {
            db.close();
            resolve(write ? null : request.result);
          };
          tx.onabort = () => reject(new Error("Fixture transaction failed"));
        };
      }),
    { write: value !== undefined, value },
  );
}
type ImportTool = {
  chooseSource(): Promise<unknown>;
  preview(): Promise<unknown>;
  verifyDestinationBackup(): Promise<unknown>;
  commit(value: string): Promise<unknown>;
};
async function invoke(page: Page, method: keyof ImportTool, arg = "") {
  return page.evaluate(
    async ({ method, arg }) => {
      try {
        return {
          ok: true,
          result: await (
            window as unknown as { stravaRouteImport: ImportTool }
          ).stravaRouteImport[method](arg),
        };
      } catch (error) {
        return { ok: false, error: (error as Error).message };
      }
    },
    { method, arg },
  );
}
async function files(
  page: Page,
  method: "chooseSource" | "verifyDestinationBackup",
  text: string,
  checksum?: string,
) {
  const first = page.waitForEvent("filechooser");
  const result = invoke(page, method);
  const chooser = await first;
  const second = page.waitForEvent("filechooser");
  await chooser.setFiles({
    name: "fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await (
    await second
  ).setFiles({
    name: "fixture.json.sha256",
    mimeType: "text/plain",
    buffer: Buffer.from(
      checksum ?? createHash("sha256").update(text).digest("hex"),
    ),
  });
  return result;
}
test.beforeEach(async ({ page }) => {
  await page.route("https://unpkg.com/**", (r) => r.abort());
  await page.goto("/routes");
  await expect(page.getByLabel("Route name", { exact: true })).toBeVisible();
  await stored(page, [route("existing")]);
  await page.evaluate(readFileSync("scripts/route-import.js", "utf8"));
});
test("verified additive import retains originals and is repeatable without duplicates", async ({
  page,
}) => {
  const original = await stored(page),
    origin = new URL(page.url()).origin;
  const source = pack(
    [route("existing"), route("new"), route("copy", "existing")],
    origin,
  );
  expect((await files(page, "chooseSource", source)).ok).toBe(true);
  expect((await invoke(page, "preview")).result).toMatchObject({
    existing: 1,
    additions: 1,
    duplicates: 2,
    conflicts: [],
  });
  expect(await stored(page)).toEqual(original);
  expect((await invoke(page, "commit", "IMPORT ADDITIONS")).ok).toBe(false);
  expect(
    (await files(page, "verifyDestinationBackup", pack(original, origin))).ok,
  ).toBe(true);
  expect((await invoke(page, "commit", "IMPORT ADDITIONS")).ok).toBe(true);
  expect(await stored(page)).toEqual([route("existing"), route("new")]);
  await invoke(page, "preview");
  await files(
    page,
    "verifyDestinationBackup",
    pack(await stored(page), origin),
  );
  expect(
    (await invoke(page, "commit", "IMPORT ADDITIONS")).result,
  ).toMatchObject({ additions: 0, duplicates: 3 });
  await page.reload();
  expect(await stored(page)).toEqual([route("existing"), route("new")]);
  await page.goto("/explore");
  await expect(
    page.getByRole("button", { name: "Preview saved route new", exact: true }),
  ).toBeVisible();
});
test("rejects malformed, unsupported, conflicting and checksum-damaged sources", async ({
  page,
}) => {
  const original = await stored(page),
    origin = new URL(page.url()).origin;
  for (const source of [
    pack([{ id: "bad" }], origin),
    pack([{ ...route("new"), planningMode: "road-following" }], origin),
    pack([route("duplicate"), route("duplicate")], origin),
  ]) {
    expect((await files(page, "chooseSource", source)).ok).toBe(false);
    expect(await stored(page)).toEqual(original);
  }
  expect(
    (
      await files(
        page,
        "chooseSource",
        pack([route("new")], origin),
        "0".repeat(64),
      )
    ).ok,
  ).toBe(false);
  await files(
    page,
    "chooseSource",
    pack([route("existing", "Conflicting")], origin),
  );
  expect((await invoke(page, "preview")).result).toMatchObject({
    conflicts: ["Conflicting"],
  });
  await files(page, "verifyDestinationBackup", pack(original, origin));
  expect((await invoke(page, "commit", "IMPORT ADDITIONS")).ok).toBe(false);
  expect(await stored(page)).toEqual(original);
});
test("stale destination and failed transaction cannot overwrite or partially import", async ({
  page,
}) => {
  const original = await stored(page),
    origin = new URL(page.url()).origin;
  await files(page, "chooseSource", pack([route("new")], origin));
  await invoke(page, "preview");
  await files(page, "verifyDestinationBackup", pack(original, origin));
  const changed = [route("existing"), route("other-tab")];
  await stored(page, changed);
  expect(await invoke(page, "commit", "IMPORT ADDITIONS")).toMatchObject({
    ok: false,
    error: expect.stringContaining("changed after preview"),
  });
  expect(await stored(page)).toEqual(changed);
  await invoke(page, "preview");
  await files(page, "verifyDestinationBackup", pack(changed, origin));
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      const request = originalPut.apply(this, args);
      this.transaction.abort(); // Abort a real queued write, not merely a fake error.
      return request;
    };
  });
  expect(await invoke(page, "commit", "IMPORT ADDITIONS")).toMatchObject({
    ok: false,
    error: expect.stringContaining("rolled back"),
  });
  expect(await stored(page)).toEqual(changed);
});

test("actual export and verified disk backup transfer between isolated browsers preserves the source", async ({
  page,
  browser,
}, testInfo) => {
  const sourceContext = await browser.newContext();
  try {
    const edge = await sourceContext.newPage();
    await edge.route("https://unpkg.com/**", (r) => r.abort());
    await edge.goto(new URL("/routes", page.url()).href);
    await expect(edge.getByLabel("Route name", { exact: true })).toBeVisible();
    const originals = [route("edge-one"), route("edge-two")];
    await stored(edge, originals);
    await edge.evaluate(
      readFileSync("scripts/route-storage-diagnostic.js", "utf8"),
    );
    expect(await stored(edge)).toEqual(originals);
    const downloadEvent = edge.waitForEvent("download");
    await edge.evaluate(() =>
      (
        window as unknown as {
          stravaRouteRecovery: { exportPrivateBackup(): void };
        }
      ).stravaRouteRecovery.exportPrivateBackup(),
    );
    const download = await downloadEvent;
    const exportPath = testInfo.outputPath("synthetic-export.json");
    await download.saveAs(exportPath);
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/route-backup.mjs"), exportPath],
      { cwd: testInfo.outputDir, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    // Use only synthetic test exports; no normal browser profile is opened.
    const { readdirSync } = await import("node:fs");
    const directory = join(testInfo.outputDir, "private-route-backups");
    const file = readdirSync(directory).find((name) => name.endsWith(".json"))!;
    expect(
      (
        await files(
          page,
          "chooseSource",
          readFileSync(join(directory, file), "utf8"),
          readFileSync(join(directory, `${file}.sha256`), "utf8"),
        )
      ).ok,
    ).toBe(true);
    expect((await invoke(page, "preview")).result).toMatchObject({
      existing: 1,
      incoming: 2,
      additions: 2,
    });
    await files(
      page,
      "verifyDestinationBackup",
      pack(await stored(page), new URL(page.url()).origin),
    );
    expect((await invoke(page, "commit", "IMPORT ADDITIONS")).ok).toBe(true);
    expect(await stored(page)).toEqual([route("existing"), ...originals]);
    expect(await stored(edge)).toEqual(originals);
  } finally {
    await sourceContext.close();
  }
});

test("wrong destination backup and absent confirmation cannot trigger an import", async ({
  page,
}) => {
  const original = await stored(page),
    origin = new URL(page.url()).origin;
  await files(page, "chooseSource", pack([route("new")], origin));
  await invoke(page, "preview");
  expect(
    (await files(page, "verifyDestinationBackup", pack([], origin))).ok,
  ).toBe(false);
  expect(
    (
      await files(
        page,
        "verifyDestinationBackup",
        pack(original, "https://wrong-origin.invalid"),
      )
    ).ok,
  ).toBe(false);
  await files(page, "verifyDestinationBackup", pack(original, origin));
  expect((await invoke(page, "commit", "")).ok).toBe(false);
  expect(await stored(page)).toEqual(original);
});

test("malformed destination records are preserved and block preview", async ({
  page,
}) => {
  const origin = new URL(page.url()).origin;
  await files(page, "chooseSource", pack([route("new")], origin));
  for (const malformed of [null, [{ id: "broken" }]]) {
    await stored(page, malformed);
    expect((await invoke(page, "preview")).ok).toBe(false);
    expect(await stored(page)).toEqual(malformed);
  }
});

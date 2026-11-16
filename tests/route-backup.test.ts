import { expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

it("creates verified immutable private backups without modifying the export", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "stravakinda-route-backup-test-"),
  );
  const input = join(directory, "fixture.json");
  const text = JSON.stringify({
    format: "stravakinda-route-backup-v1",
    records: [
      {
        location: "IndexedDB:stravakinda/kv/routes",
        value: [{ id: "fixture", title: "Fixture" }],
      },
    ],
  });
  writeFileSync(input, text);
  const run = () =>
    spawnSync(process.execPath, [resolve("scripts/route-backup.mjs"), input], {
      cwd: directory,
      encoding: "utf8",
    });
  expect(run().status).toBe(0);
  expect(run().status).toBe(0);
  const backups = join(directory, "private-route-backups");
  const files = readdirSync(backups).filter((p) => p.endsWith(".json"));
  expect(files).toHaveLength(2);
  for (const file of files) {
    expect(readFileSync(join(backups, file), "utf8")).toBe(text);
    expect(readFileSync(join(backups, `${file}.sha256`), "utf8")).toBe(
      createHash("sha256").update(text).digest("hex"),
    );
  }
  expect(readFileSync(input, "utf8")).toBe(text);
});

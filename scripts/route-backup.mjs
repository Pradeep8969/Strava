// Copy an explicitly exported route-only bundle to an ignored, non-overwriting
// local backup. This tool NEVER imports or modifies browser/native storage.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
const input = process.argv[2];
if (!input)
  throw new Error("Usage: node scripts/route-backup.mjs <private-export.json>");
const bytes = await readFile(input);
const bundle = JSON.parse(bytes.toString("utf8"));
if (
  bundle.format !== "stravakinda-route-backup-v1" ||
  !Array.isArray(bundle.records) ||
  bundle.records.some(
    (r) =>
      typeof r.location !== "string" ||
      !/route|plan/i.test(r.location) ||
      /auth|token|session/i.test(r.location),
  )
)
  throw new Error("Not a route-only backup. No files written.");
const folder = resolve("private-route-backups");
await mkdir(folder, { recursive: true });
const path = resolve(folder, `${Date.now()}-${randomUUID()}.json`);
const hash = (value) => createHash("sha256").update(value).digest("hex");
await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
if (hash(await readFile(path)) !== hash(bytes))
  throw new Error("Backup verification failed. Do not import anything.");
await writeFile(`${path}.sha256`, hash(bytes), { flag: "wx", mode: 0o600 });
console.info(`Verified private backup: ${path}. Storage was not modified.`);

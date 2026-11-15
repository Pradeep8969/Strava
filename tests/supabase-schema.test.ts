import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationDir = "supabase/migrations";
const migrations = readdirSync(migrationDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const sql = migrations
  .map((file) => readFileSync(join(migrationDir, file), "utf8"))
  .join("\n");
const definitions = [
  ...sql.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\);/gi),
];
const tables = new Map(definitions.map((match) => [match[1], match[2]]));

function files(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory()
      ? files(path)
      : /\.tsx?$/.test(path)
        ? [path]
        : [];
  });
}
const applicationFiles = [
  "src",
  "features",
  "services",
  "hooks",
  "components",
  "supabase/functions",
].flatMap(files);

// Split column definitions without splitting checks, PKs or type arguments.
function columns(body: string) {
  let depth = 0,
    quoted = false,
    current = "";
  const parts: string[] = [];
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === "'") {
      if (quoted && body[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }
      quoted = !quoted;
    }
    if (!quoted && char === "(") depth++;
    if (!quoted && char === ")") depth--;
    if (!quoted && !depth && char === ",") {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return new Set(
    parts.map((part) => part.trim().match(/^(\w+)\s/)?.[1]).filter(Boolean),
  );
}
const tableColumns = new Map(
  [...tables].map(([table, body]) => [table, columns(body)]),
);
for (const match of sql.matchAll(
  /alter table public\.(\w+) add column (\w+)/gi,
))
  tableColumns.get(match[1])?.add(match[2]);

describe("Supabase migration/application contract (static, not a PostgreSQL execution test)", () => {
  it("has one definition per table and dependencies exist in migration order", () => {
    expect(definitions).toHaveLength(26);
    expect(tables.size).toBe(26);
    const seen = new Set<string>();
    for (const definition of definitions) {
      for (const reference of definition[2].matchAll(
        /references public\.(\w+)/g,
      )) {
        expect(
          seen.has(reference[1]),
          `${definition[1]} references ${reference[1]} before it exists`,
        ).toBe(true);
      }
      seen.add(definition[1]);
    }
    expect(new Set(migrations.map((file) => file.split("_")[0])).size).toBe(
      migrations.length,
    );
  });

  it("every literal database table/RPC query maps to an existing definition", () => {
    const functions = new Set(
      [
        ...sql.matchAll(/create (?:or replace )?function public\.(\w+)\(/gi),
      ].map((match) => match[1]),
    );
    for (const path of applicationFiles) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/\.from\(["'](\w+)["']\)/g)) {
        if (match[1] === "avatars") continue; // Storage bucket, not a public table.
        expect(tables.has(match[1]), `${path}: missing ${match[1]}`).toBe(true);
      }
      for (const match of source.matchAll(/\.rpc\(["'](\w+)["']/g))
        expect(
          functions.has(match[1]),
          `${path}: missing RPC ${match[1]}`,
        ).toBe(true);
      for (const match of source.matchAll(
        /\.from\(["'](\w+)["']\)\s*\.select\(\s*["']([^"']+)["']/g,
      )) {
        const available = tableColumns.get(match[1]);
        if (!available) continue;
        // Relation aggregates are checked separately through their FKs below.
        const selected = match[2]
          .replace(/\w+\(count\)/g, "")
          .split(",")
          .filter(Boolean);
        for (const column of selected)
          expect(
            column.trim() === "*" || available.has(column.trim()),
            `${path}: ${match[1]}.${column} missing`,
          ).toBe(true);
      }
    }
    for (const table of ["activity_reactions", "comments"])
      expect(tables.get(table)).toMatch(
        /activity_id uuid.*references public\.activities/,
      );
    for (const column of [
      "id",
      "club_id",
      "title",
      "target_m",
      "starts_at",
      "ends_at",
    ])
      expect(tableColumns.get("challenges")?.has(column)).toBe(true);
  });

  it("replays the exact backfill migration in the self-contained pg_prove test", () => {
    const repair = readFileSync(
      join(migrationDir, "202611140003_existing_auth_profiles.sql"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const test = readFileSync(
      "supabase/tests/profile_backfill.test.sql",
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(
      test.match(/execute \$migration\$\n([\s\S]*?)\$migration\$;/)?.[1],
    ).toBe(repair);
    expect(
      test.match(
        /do \$\$begin perform pg_temp\.replay_profile_backfill\(\); end\$\$;/g,
      ),
    ).toHaveLength(2);
    expect(test).not.toMatch(/^\\i(?:r)?\s/m);
  });

  it("repairs existing users without touching auth rows or generating returning-user welcomes", () => {
    const repair = readFileSync(
      join(migrationDir, "202611140003_existing_auth_profiles.sql"),
      "utf8",
    );
    expect(repair).not.toMatch(
      /\b(?:update|delete\s+from|insert\s+into)\s+auth\.users\b/i,
    );
    expect(repair).not.toMatch(/\bcreate\s+table\b/i);
    expect(repair).toMatch(
      /select id from auth\.users\s+on conflict\(id\) do nothing/,
    );
    expect(repair).toMatch(
      /select id from auth\.users\s+on conflict\(user_id\) do nothing/,
    );
    const outsideInitializer = repair.replace(/as \$\$[\s\S]*?end \$\$;/, "");
    expect(outsideInitializer).not.toMatch(/insert into public\.notifications/);
    expect(sql).not.toMatch(/disable row level security/i);
  });
});

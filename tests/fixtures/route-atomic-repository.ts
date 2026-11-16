import { readFileSync } from "node:fs";
import ts from "typescript";
import type { Page } from "@playwright/test";
import type { RouteCache, CloudRoute } from "../../features/routes/cloud-sync";

export type AtomicHarness = {
  repo: typeof import("../../services/route-cloud");
  db: typeof import("../../services/database.web");
  active: boolean;
  rows: CloudRoute[];
  writes: { payload: any; user: string; resolve: (value: any) => void }[];
  jobs: Promise<void>[];
  start: (user: string) => void;
  ack: (index: number) => void;
  fail: (index: number) => void;
};
declare global {
  interface Window {
    __atomic: AtomicHarness;
  }
}
export const atomicOwner = "00000000-0000-4000-8000-000000000011";
export const atomicOther = "00000000-0000-4000-8000-000000000012";

/** Actual web adapter + repository + reconciliation, loaded only by tests.
 * Auth/transport and already-valid fixture validation are controlled, not storage.
 * Each page gets its own module instances and connection to the real same-origin IDB. */
export async function installAtomicRepository(page: Page) {
  const sources = [
    "services/database.web.ts",
    "features/routes/cloud-sync.ts",
    "services/route-cloud.ts",
  ].map(
    (path) =>
      ts.transpileModule(readFileSync(path, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
  );
  await page.evaluate((sources) => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
    const load = (source: string, require: (name: string) => unknown) => {
      const exports: Record<string, any> = {};
      new Function("require", "exports", "process", source)(require, exports, {
        env: {
          EXPO_PUBLIC_SUPABASE_URL: "https://route-sync-fixture.supabase.co",
          EXPO_PUBLIC_SUPABASE_ANON_KEY: "fixture",
        },
      });
      return exports;
    };
    const db = load(sources[0], () => {
      throw new Error("Unexpected adapter dependency");
    });
    const core = load(sources[1], (name) => {
      if (name === "./planner")
        return { restorePlans: (plans: unknown) => plans };
      throw new Error("Unexpected reconciliation dependency");
    });
    const harness = {
      active: true,
      rows: [],
      writes: [],
      jobs: [],
    } as unknown as AtomicHarness;
    const repo = load(sources[2], (name) => {
      if (name === "./database") return db;
      if (name === "../features/routes/cloud-sync") return core;
      if (name === "expo-crypto")
        return { randomUUID: () => crypto.randomUUID() };
      if (name === "@supabase/supabase-js")
        return {
          createClient: (_url: string, _key: string, options: any) => {
            const user = options.global.headers.Authorization.slice(7);
            const query = {
              select: () => query,
              eq: () => query,
              order: () => query,
              range: async () => ({ data: harness.rows, error: null }),
            };
            return {
              rpc: (_name: string, payload: unknown) =>
                new Promise((resolve) =>
                  harness.writes.push({ payload, user, resolve }),
                ),
              from: () => query,
            };
          },
        };
      throw new Error("Unexpected repository dependency");
    });
    harness.repo = repo as AtomicHarness["repo"];
    harness.db = db as AtomicHarness["db"];
    harness.start = (user) => {
      harness.jobs.push(
        harness.repo.syncAccountRoutes(
          { user: { id: user }, access_token: user } as any,
          () => harness.active,
        ),
      );
    };
    harness.ack = (index) => {
      const { payload: p, user, resolve } = harness.writes[index];
      const row = {
        id: p.route_id,
        user_id: user,
        plan: p.route_plan,
        revision: p.expected_revision + 1,
        mutation_id: p.operation_id,
        deleted_at: p.remove_route ? new Date().toISOString() : null,
      };
      harness.rows = [row];
      resolve({ data: [row], error: null });
    };
    harness.fail = (index) =>
      harness.writes[index].resolve({
        data: null,
        error: { message: "Controlled network failure" },
      });
    window.__atomic = harness;
  }, sources);
}
export const atomicCache = (page: Page, user = atomicOwner) =>
  page.evaluate((user) => window.__atomic.repo.readAccountRoutes(user), user);
export async function setAtomicCache(
  page: Page,
  cache: RouteCache,
  user = atomicOwner,
) {
  await page.evaluate(
    ({ cache, user }) =>
      window.__atomic.db.updateValue(`account-routes:v1:${user}`, () => cache),
    { cache, user },
  );
}

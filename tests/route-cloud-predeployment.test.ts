import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { expect, it } from "vitest";
import * as core from "../features/routes/cloud-sync";
import { createPlan, waypoint } from "../features/routes/planner";

// Two runtimes share a simulated transactional adapter, not an in-tab queue.
// Real IndexedDB transactions are exercised by the five-engine browser suite.
it("simultaneous offline saves in lockless tabs retain both routes through atomic storage", async () => {
  const values = new Map<string, unknown>();
  let transactions: Promise<unknown> = Promise.resolve(),
    atomicWrites = 0;
  let reads = 0,
    release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const source = ts.transpileModule(
    readFileSync("services/route-cloud.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  function runtime() {
    let pending: Promise<unknown> = Promise.resolve();
    const database = {
      updateValue(key: string, update: (value: unknown) => unknown) {
        atomicWrites++;
        const next = transactions.then(() => {
          const value = update(structuredClone(values.get(key) ?? null));
          values.set(key, structuredClone(value));
          return value;
        });
        transactions = next.catch(() => {});
        return next;
      },
      async getValue(key: string) {
        const snapshot = structuredClone(values.get(key) ?? null);
        if (++reads === 2) release();
        await barrier;
        return snapshot;
      },
      async setValue(key: string, value: unknown) {
        values.set(key, structuredClone(value));
      },
      serial(action: () => Promise<unknown>) {
        const next = pending.then(action);
        pending = next.catch(() => {});
        return next;
      },
    };
    const exports: {
      queueAccountRoute?: (
        user: string,
        plan: ReturnType<typeof createPlan>,
      ) => Promise<void>;
    } = {};
    const require = (name: string) => {
      if (name === "./database") return database;
      if (name === "expo-crypto") return { randomUUID };
      if (name === "../features/routes/cloud-sync") return core;
      if (name === "@supabase/supabase-js") return {};
      throw new Error("Unexpected test dependency");
    };
    runInNewContext("(function(require,exports){" + source + "})", {
      navigator: {},
    })(require, exports);
    return exports.queueAccountRoute!;
  }
  const a = runtime(),
    b = runtime();
  const points = [
    waypoint({ latitude: 0, longitude: 0 }),
    waypoint({ latitude: 0, longitude: 1 }),
  ];
  await Promise.all([
    a("athlete", createPlan("Tab A", points, randomUUID(), null)),
    b("athlete", createPlan("Tab B", points, randomUUID(), null)),
  ]);
  expect(
    Object.keys(values.get("account-routes:v1:athlete") as object),
  ).toHaveLength(2);
  expect(atomicWrites).toBe(2);
});

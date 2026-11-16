import { createClient, type Session } from "@supabase/supabase-js";
import { getValue, updateValue } from "./database";
import { randomUUID } from "expo-crypto";
import {
  reconcileRoutes,
  validateCloudPlan,
  type RouteCache,
  type RouteEntry,
  type CloudRoute,
} from "../features/routes/cloud-sync";
import type { PlannedRoute } from "../features/routes/planner";

const listeners = new Set<() => void>();
const queueListeners = new Set<() => void>();
export const subscribeRouteQueue = (listener: () => void) => {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
};
export const subscribeRoutes = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const changed = () => listeners.forEach((listener) => listener());
export const notifyRouteLibrary = changed;
const key = (user: string) => `account-routes:v1:${user}`;
function cacheValue(value: RouteCache | null): RouteCache {
  if (value !== null && (typeof value !== "object" || Array.isArray(value)))
    throw new Error(
      "Account route storage needs recovery. Existing data is preserved; the route was not saved.",
    );
  return value ?? {};
}
export const readAccountRoutes = async (user: string) =>
  cacheValue(await getValue<RouteCache>(key(user)));
function assertUnchanged(
  previous: RouteEntry | undefined,
  expectedMutation?: string,
) {
  if (
    previous
      ? !expectedMutation || previous.mutation !== expectedMutation
      : expectedMutation !== undefined
  )
    throw new Error(
      "This route changed in another tab or sync. Your changes were not saved. Reload the route or save a new copy.",
    );
}
export async function queueAccountRoute(
  user: string,
  plan: PlannedRoute,
  deleted = false,
  expectedMutation?: string,
) {
  validateCloudPlan(plan);
  await updateValue<RouteCache>(key(user), (current) => {
    const cache = cacheValue(current),
      previous = cache[plan.id];
    assertUnchanged(previous, expectedMutation);
    if (previous?.status === "conflict")
      throw new Error(
        "Open this conflict and save a new copy, or use the cloud version.",
      );
    if (previous?.deleted)
      throw new Error("Deleted routes cannot be restored. Save a new copy.");
    cache[plan.id] = {
      plan: deleted && previous ? previous.plan : plan,
      revision: previous?.revision ?? 0,
      mutation: randomUUID(),
      deleted,
      status: "pending",
    };
    return cache;
  });
  changed();
  queueListeners.forEach((listener) => listener());
}
export async function acceptCloudVersion(
  user: string,
  id: string,
  expectedMutation: string,
) {
  await updateValue<RouteCache>(key(user), (current) => {
    const cache = cacheValue(current),
      row = cache[id]?.remote;
    assertUnchanged(cache[id], expectedMutation);
    if (!row) throw new Error("Retry Sync to load the cloud version first.");
    cache[id] = {
      plan: row.plan,
      revision: row.revision,
      mutation: row.mutation_id,
      deleted: !!row.deleted_at,
      status: "synced",
    };
    return cache;
  });
  changed();
}
const jobs = new Map<string, Promise<void>>();
export function syncAccountRoutes(session: Session, current: () => boolean) {
  const user = session.user.id;
  if (jobs.has(user)) return jobs.get(user)!;
  // Pin credentials: a late response from an old account cannot use the new session.
  const db = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${session.access_token}` },
        fetch: async (input, init) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 20000);
          try {
            return await fetch(input, { ...init, signal: controller.signal });
          } finally {
            clearTimeout(timeout);
          }
        },
      },
    },
  );
  const job = (async () => {
    if (!current()) return;
    const snapshot = await readAccountRoutes(user);
    const observed: RouteCache = JSON.parse(JSON.stringify(snapshot));
    await reconcileRoutes(
      user,
      snapshot,
      {
        async write(entry: RouteEntry) {
          const result = await db.rpc("write_planned_route", {
            route_id: entry.plan.id,
            expected_revision: entry.revision,
            operation_id: entry.mutation,
            route_plan: entry.plan,
            remove_route: entry.deleted,
          });
          if (result.error) throw new Error("Route upload failed");
          return (result.data?.[0] ?? null) as CloudRoute | null;
        },
        async read() {
          const rows: CloudRoute[] = [];
          for (let offset = 0; ; offset += 100) {
            if (!current()) return [];
            const result = await db
              .from("planned_routes")
              .select("id,user_id,plan,revision,mutation_id,deleted_at")
              .eq("user_id", user)
              .order("id")
              .range(offset, offset + 99);
            if (result.error) throw new Error("Route download failed");
            rows.push(...(result.data as CloudRoute[]));
            if (result.data.length < 100) return rows;
          }
        },
      },
      async (cache) => {
        const written: RouteCache = {};
        await updateValue<RouteCache>(key(user), (stored) => {
          const latest = cacheValue(stored);
          if (!current()) return latest;
          for (const [id, entry] of Object.entries(cache)) {
            // A save/delete during a network request must remain queued and intact.
            if (JSON.stringify(latest[id]) === JSON.stringify(observed[id])) {
              latest[id] = entry;
              written[id] = JSON.parse(JSON.stringify(entry));
            } else if (
              entry.status === "synced" &&
              entry.mutation === observed[id]?.mutation &&
              latest[id]?.revision === observed[id]?.revision &&
              (latest[id].status === "pending" ||
                latest[id].status === "failed")
            ) {
              // Rebase only onto our acknowledged in-flight operation, never
              // onto an unrelated remote edit. A later remote edit still fails CAS.
              latest[id].revision = entry.revision;
            }
          }
          return latest;
        });
        Object.assign(observed, written);
        changed();
      },
      current,
    );
  })().finally(() => {
    jobs.delete(user);
    changed();
  });
  jobs.set(user, job);
  return job;
}

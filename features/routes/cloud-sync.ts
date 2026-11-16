import { restorePlans, type PlannedRoute } from "./planner";

export type CloudRoute = {
  id: string;
  user_id: string;
  plan: PlannedRoute;
  revision: number;
  mutation_id: string;
  deleted_at: string | null;
};
export type RouteEntry = {
  plan: PlannedRoute;
  revision: number;
  mutation: string;
  deleted: boolean;
  status: "pending" | "synced" | "failed" | "conflict";
  remote?: CloudRoute;
};
export type RouteCache = Record<string, RouteEntry>;
export interface RouteTransport {
  write(entry: RouteEntry): Promise<CloudRoute | null>;
  read(): Promise<CloudRoute[]>;
}
export function validateCloudPlan(plan: PlannedRoute) {
  restorePlans([plan]);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      plan.id,
    ) ||
    plan.title.length > 120 ||
    plan.points.length > 10000 ||
    !Number.isFinite(plan.distanceMeters) ||
    plan.distanceMeters < 0 ||
    JSON.stringify(plan).length > 4000000 ||
    JSON.stringify(plan.geometry.coordinates) !==
      JSON.stringify(plan.points.map((p) => [p.longitude, p.latitude]))
  )
    throw new Error("Route is invalid or too large to sync.");
}
/** Reconcile a snapshot; the repository persists through short, guarded storage locks. */
export async function reconcileRoutes(
  userId: string,
  cache: RouteCache,
  transport: RouteTransport,
  persist: (cache: RouteCache) => Promise<void>,
  current: () => boolean,
) {
  for (const entry of Object.values(cache)) {
    if (!current()) return;
    if (entry.status !== "pending" && entry.status !== "failed") continue;
    try {
      const remote = await transport.write(entry);
      if (!current()) return;
      if (
        remote &&
        (remote.user_id !== userId ||
          remote.id !== entry.plan.id ||
          remote.plan.id !== entry.plan.id ||
          remote.mutation_id !== entry.mutation)
      )
        throw new Error("Invalid route acknowledgement");
      if (remote) {
        validateCloudPlan(remote.plan);
        cache[entry.plan.id] = {
          ...entry,
          revision: remote.revision,
          status: "synced",
        };
      } else entry.status = "conflict";
      await persist(cache);
    } catch {
      if (!current()) return;
      entry.status = "failed";
      await persist(cache);
    }
  }
  if (!current()) return;
  const rows = await transport.read();
  if (!current()) return;
  for (const row of rows) {
    if (row.user_id !== userId || row.id !== row.plan.id)
      throw new Error("Invalid cloud route owner or ID");
    validateCloudPlan(row.plan);
    const local = cache[row.id];
    if (local && row.mutation_id === local.mutation) {
      cache[row.id] = {
        ...local,
        revision: row.revision,
        status: "synced",
        deleted: !!row.deleted_at,
      };
      continue;
    }
    if (local && local.status !== "synced") {
      // Keep the losing edit intact for explicit recovery; never retry it blindly.
      if (local.status === "conflict" || row.revision !== local.revision) {
        local.status = "conflict";
        local.remote = row;
      }
    } else if (!local || row.revision >= local.revision) {
      cache[row.id] = {
        plan: row.plan,
        revision: row.revision,
        mutation: row.mutation_id,
        deleted: !!row.deleted_at,
        status: "synced",
      };
    }
  }
  await persist(cache);
}

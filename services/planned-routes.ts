import { getValue, setValue, serial } from "./database";
import { restorePlans, type PlannedRoute } from "../features/routes/planner";
import { inspectPlans } from "../features/routes/recovery";

export async function inspectSavedPlans() {
  return inspectPlans(await getValue<unknown>("routes"));
}

export async function loadPlans() {
  return restorePlans((await getValue<unknown>("routes")) ?? []);
}
function routeWrite<T>(action: () => Promise<T>) {
  return serial(() =>
    typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("stravakinda:planned-routes", action)
      : action(),
  );
}
export function savePlan(plan: PlannedRoute) {
  return routeWrite(async () => {
    if (inspectPlans([plan]).unreadable)
      throw new Error("Route is invalid. Existing storage has been preserved.");
    const raw = (await getValue<unknown>("routes")) ?? [];
    const existing = restorePlans(raw);
    if (inspectPlans(raw).unreadable)
      throw new Error(
        "Saved route records need recovery. Existing storage has been preserved.",
      );
    if (existing.some((r) => r.id === plan.id))
      throw new Error("This route already exists. Save a new copy.");
    const next = [...existing, plan];
    // Keep legacy records and unknown metadata byte-for-byte equivalent as values.
    await setValue("routes", [...(raw as unknown[]), plan]);
    return next;
  });
}
export function deletePlan(id: string) {
  return routeWrite(async () => {
    const raw = (await getValue<unknown>("routes")) ?? [];
    const existing = restorePlans(raw);
    if (inspectPlans(raw).unreadable)
      throw new Error(
        "Saved route records need recovery. Existing storage has been preserved.",
      );
    const next = existing.filter((r) => r.id !== id);
    await setValue(
      "routes",
      (raw as { id: string }[]).filter((r) => r.id !== id),
    );
    return next;
  });
}

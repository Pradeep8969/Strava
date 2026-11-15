import { getValue, setValue, serial } from "./database";
import { restorePlans, type PlannedRoute } from "../features/routes/planner";

export async function loadPlans() {
  return restorePlans((await getValue<unknown>("routes")) ?? []);
}
export function savePlan(plan: PlannedRoute) {
  return serial(async () => {
    const existing = await loadPlans();
    if (existing.some((r) => r.id === plan.id))
      throw new Error("This route already exists. Save a new copy.");
    const next = [...existing, plan];
    await setValue("routes", next);
    return next;
  });
}
export function deletePlan(id: string) {
  return serial(async () => {
    const next = (await loadPlans()).filter((r) => r.id !== id);
    await setValue("routes", next);
    return next;
  });
}

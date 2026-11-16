import { restorePlans, type PlannedRoute } from "./planner";

/** Read-only inspection. Never persist the normalized projection over the source. */
export function inspectPlans(value: unknown) {
  const plans: PlannedRoute[] = [];
  let unreadable = 0;
  const records =
    value == null ? [] : Array.isArray(value) ? value : [undefined];
  const ids = new Set<string>();
  for (const record of records) {
    try {
      const plan = restorePlans([record])[0];
      if (!plan.id.trim() || ids.has(plan.id)) throw new Error("Duplicate id");
      ids.add(plan.id);
      plans.push(plan);
    } catch {
      unreadable++;
    }
  }
  return {
    plans,
    unreadable,
    total: records.length,
    warning: unreadable
      ? `${unreadable} saved route record(s) could not be opened. Original records are preserved. Saving and deletion are blocked until recovery.`
      : "",
  };
}

/** Coordinate-free diagnostic; no raw records or authentication data. */
export function summarizePlans(value: unknown) {
  const { plans, unreadable, total } = inspectPlans(value);
  return {
    total,
    unreadable,
    routes: plans.map(({ title, planningMode }) => ({ title, planningMode })),
  };
}

/** Preview only: never writes storage, converts routes, or replaces conflicting ids. */
export function previewRecovery(current: unknown, incoming: unknown) {
  const source = inspectPlans(current);
  const candidates = inspectPlans(incoming);
  const ids = new Set(source.plans.map((p) => p.id));
  const signature = (p: PlannedRoute) =>
    JSON.stringify([
      p.title,
      p.points.map(({ latitude, longitude }) => [latitude, longitude]),
    ]);
  const signatures = new Set(source.plans.map(signature));
  const additions: PlannedRoute[] = [];
  let duplicates = 0;
  for (const plan of candidates.plans) {
    if (ids.has(plan.id) || signatures.has(signature(plan))) {
      duplicates++;
      continue;
    }
    ids.add(plan.id);
    signatures.add(signature(plan));
    additions.push(plan);
  }
  return {
    additions,
    duplicates,
    unreadable: source.unreadable + candidates.unreadable,
    writable: source.unreadable === 0 && candidates.unreadable === 0,
  };
}

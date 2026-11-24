import { useEffect, useState } from "react";
import { useSession } from "./useSession";
import { inspectSavedPlans } from "../services/planned-routes";
import { readAccountRoutes, subscribeRoutes } from "../services/route-cloud";
import type { PlannedRoute } from "../features/routes/planner";
import type { RouteCache, RouteEntry } from "../features/routes/cloud-sync";

export type LibraryRoute = PlannedRoute & {
  syncStatus?: RouteEntry["status"];
  accountId?: string;
  localMutation?: string;
  deleted?: boolean;
};
export function useRouteLibrary(enabled = true) {
  const user = useSession()?.user.id;
  const [state, setState] = useState<{
    user?: string;
    plans: LibraryRoute[];
    warning: string;
    loaded: boolean;
    settled: boolean;
  }>({ plans: [], warning: "", loaded: false, settled: false });
  useEffect(() => {
    if (!enabled) return;
    let active = true,
      sequence = 0;
    const reload = async () => {
      const request = ++sequence;
      try {
        const [localResult, accountResult] = await Promise.allSettled([
          inspectSavedPlans(),
          user ? readAccountRoutes(user) : Promise.resolve({}),
        ]);
        const legacy =
          localResult.status === "fulfilled"
            ? localResult.value
            : {
                plans: [],
                warning:
                  "Local routes could not be read. Existing records are preserved.",
                unreadable: 1,
              };
        const cache: RouteCache =
          accountResult.status === "fulfilled" ? accountResult.value : {};
        const deletions = Object.values(cache).filter(
          (entry) =>
            entry.deleted &&
            entry.status !== "synced" &&
            entry.status !== "conflict",
        );
        const deletionWarning = deletions.length
          ? `${deletions.length} route deletion(s) ${deletions.some((entry) => entry.status === "failed") ? "failed synchronization — Retry Sync" : "saved offline — pending synchronization"}.`
          : "";
        const plans: LibraryRoute[] = [
          ...legacy.plans,
          ...Object.values(cache)
            .filter((entry) => !entry.deleted || entry.status === "conflict")
            .map((entry) => ({
              ...entry.plan,
              syncStatus: entry.status,
              accountId: user,
              localMutation: entry.mutation,
              deleted: entry.deleted,
            })),
        ];
        if (active && request === sequence)
          setState({
            user,
            plans,
            warning: [
              legacy.warning,
              deletionWarning,
              accountResult.status === "rejected" &&
                "Account routes could not be read. Existing records are preserved.",
            ]
              .filter(Boolean)
              .join(" "),
            loaded: user
              ? accountResult.status === "fulfilled"
              : legacy.unreadable === 0,
            settled: true,
          });
      } catch {
        if (active && request === sequence)
          setState({
            user,
            plans: [],
            warning:
              "Saved routes could not be loaded. Storage is preserved. Retry Sync.",
            loaded: false,
            settled: true,
          });
      }
    };
    void reload();
    const unsubscribe = subscribeRoutes(() => {
      void reload();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, enabled]);
  // Mask old state during the render that precedes effect cleanup on account changes.
  return enabled && state.user === user
    ? state
    : {
        plans: [] as LibraryRoute[],
        warning: "",
        loaded: false,
        settled: false,
      };
}
export function routeStatus(route: LibraryRoute) {
  return route.syncStatus === "synced"
    ? "Synced"
    : route.syncStatus === "pending"
      ? "Saved offline · Pending sync"
      : route.syncStatus === "failed"
        ? "Sync failed — retry"
        : route.syncStatus === "conflict"
          ? "Conflict — local edit preserved. Open and save a new copy, or use cloud version."
          : "Local-only · Saved offline";
}

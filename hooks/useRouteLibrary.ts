import { useEffect, useState } from "react";
import { useSession } from "./useSession";
import { inspectSavedPlans } from "../services/planned-routes";
import { readAccountRoutes, subscribeRoutes } from "../services/route-cloud";
import type { PlannedRoute } from "../features/routes/planner";
import type { RouteEntry } from "../features/routes/cloud-sync";

export type LibraryRoute = PlannedRoute & {
  syncStatus?: RouteEntry["status"];
  accountId?: string;
  localMutation?: string;
};
export function useRouteLibrary() {
  const user = useSession()?.user.id;
  const [state, setState] = useState<{
    user?: string;
    plans: LibraryRoute[];
    warning: string;
    loaded: boolean;
  }>({ plans: [], warning: "", loaded: false });
  useEffect(() => {
    let active = true,
      sequence = 0;
    const reload = async () => {
      const request = ++sequence;
      try {
        const legacy = await inspectSavedPlans();
        const cache = user ? await readAccountRoutes(user) : {};
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
            })),
        ];
        if (active && request === sequence)
          setState({
            user,
            plans,
            warning: [legacy.warning, deletionWarning]
              .filter(Boolean)
              .join(" "),
            loaded: !!user || legacy.unreadable === 0,
          });
      } catch {
        if (active)
          setState({
            user,
            plans: [],
            warning:
              "Saved routes could not be loaded. Storage is preserved. Retry Sync.",
            loaded: false,
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
  }, [user]);
  // Mask old state during the render that precedes effect cleanup on account changes.
  return state.user === user
    ? state
    : { plans: [] as LibraryRoute[], warning: "", loaded: false };
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

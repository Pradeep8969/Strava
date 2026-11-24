import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { useSession } from "./useSession";
import {
  subscribeRouteQueue,
  syncAccountRoutes,
} from "../services/route-cloud";

const syncListeners = new Set<() => void>();
export const retryRouteSync = () =>
  syncListeners.forEach((listener) => listener());
let status = { syncing: false, error: "" };
const statusListeners = new Set<(value: typeof status) => void>();
function report(syncing: boolean, error = "") {
  status = { syncing, error };
  statusListeners.forEach((listener) => listener(status));
}
export function useRouteSyncStatus() {
  const [value, setValue] = useState(status);
  useEffect(() => {
    statusListeners.add(setValue);
    return () => {
      statusListeners.delete(setValue);
    };
  }, []);
  return value;
}
export function useRouteSync() {
  const session = useSession();
  useEffect(() => {
    if (!session) return;
    let active = true,
      running = false,
      rerun = false;
    const run = async () => {
      if (
        !active ||
        (AppState.currentState && AppState.currentState !== "active") ||
        (Platform.OS === "web" &&
          typeof document !== "undefined" &&
          document.visibilityState === "hidden")
      )
        return;
      if (running) {
        rerun = true;
        return;
      }
      running = true;
      report(true);
      let failed = false;
      try {
        await syncAccountRoutes(session, () => active);
      } catch {
        failed = true;
        /* Queue remains durable; no server errors or geometry in logs. */
      } finally {
        running = false;
        if (active) {
          report(
            false,
            failed ? "Sync failed — retry. Offline routes are preserved." : "",
          );
        }
        if (rerun && active) {
          rerun = false;
          void run();
        }
      }
    };
    const trigger = () => {
      void run();
    };
    // Each optional subscription is isolated so a failed setup/removal cannot
    // crash the authenticated tree or prevent the other listeners being removed.
    const cleanups: (() => void)[] = [];
    const safely = (action: () => void) => {
      try {
        action();
      } catch {
        report(
          false,
          "Sync unavailable — retry. Offline routes are preserved.",
        );
      }
    };
    safely(() => {
      const timer = setInterval(trigger, 60000);
      cleanups.push(() => clearInterval(timer));
    });
    safely(() => {
      const app = AppState.addEventListener("change", (state) => {
        if (state === "active") trigger();
      });
      cleanups.push(() => app.remove());
    });
    safely(() => {
      cleanups.push(subscribeRouteQueue(trigger));
    });
    syncListeners.add(trigger);
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        typeof window.addEventListener === "function" &&
        typeof window.removeEventListener === "function"
      ) {
        safely(() => {
          window.addEventListener("online", trigger);
          cleanups.push(() => window.removeEventListener("online", trigger));
        });
      }
      if (
        typeof document !== "undefined" &&
        typeof document.addEventListener === "function" &&
        typeof document.removeEventListener === "function"
      ) {
        safely(() => {
          document.addEventListener("visibilitychange", trigger);
          cleanups.push(() =>
            document.removeEventListener("visibilitychange", trigger),
          );
        });
      }
    }
    trigger();
    return () => {
      active = false;
      report(false);
      syncListeners.delete(trigger);
      cleanups.forEach((cleanup) => safely(cleanup));
    };
  }, [session]);
}

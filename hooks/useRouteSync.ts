import { useEffect, useState } from "react";
import { AppState } from "react-native";
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
        (typeof document !== "undefined" &&
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
    trigger();
    const timer = setInterval(trigger, 60000);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") trigger();
    });
    const queue = subscribeRouteQueue(trigger);
    syncListeners.add(trigger);
    if (typeof window !== "undefined")
      window.addEventListener("online", trigger);
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", trigger);
    return () => {
      active = false;
      report(false);
      clearInterval(timer);
      app.remove();
      queue();
      syncListeners.delete(trigger);
      if (typeof window !== "undefined")
        window.removeEventListener("online", trigger);
      if (typeof document !== "undefined")
        document.removeEventListener("visibilitychange", trigger);
    };
  }, [session]);
}

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { retryRouteSync, useRouteSync } from "../hooks/useRouteSync";

const h = vi.hoisted(() => ({
  session: null as Session | null,
  effect: undefined as undefined | (() => (() => void) | undefined),
  platform: { OS: "android" },
  app: { currentState: "active", addEventListener: vi.fn() },
  sync: vi.fn(),
  queue: vi.fn(),
  remove: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("react", () => ({
  useEffect: (effect: typeof h.effect) => {
    h.effect = effect;
  },
  useState: vi.fn(),
}));
vi.mock("react-native", () => ({ AppState: h.app, Platform: h.platform }));
vi.mock("../hooks/useSession", () => ({ useSession: () => h.session }));
vi.mock("../services/route-cloud", () => ({
  syncAccountRoutes: h.sync,
  subscribeRouteQueue: h.queue,
}));
const session = (id: string) => ({ user: { id }, access_token: id }) as Session;
let cleanup: (() => void) | undefined;
function mount() {
  // Effects are captured by the mocked React harness and executed below.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useRouteSync();
  cleanup = h.effect?.();
}
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  h.session = session("athlete-a");
  h.platform.OS = "android";
  h.app.currentState = "active";
  h.app.addEventListener.mockReturnValue({ remove: h.remove });
  h.queue.mockReturnValue(h.unsubscribe);
  h.sync.mockResolvedValue(undefined);
  // React Native defines window without DOM event methods.
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", undefined);
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it.each(["Google sign-in", "restored session"])(
  "starts Android sync after %s with a non-DOM window",
  async () => {
    if (expect.getState().currentTestName?.includes("Google")) {
      h.session = null;
      mount();
      expect(h.sync).not.toHaveBeenCalled();
      h.session = session("athlete-a");
    }
    expect(mount).not.toThrow();
    await settle();
    expect(h.sync).toHaveBeenCalledWith(h.session, expect.any(Function));
    cleanup?.();
    cleanup = undefined;
    expect(h.remove).toHaveBeenCalledOnce();
    expect(h.unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    retryRouteSync();
    expect(h.sync).toHaveBeenCalledTimes(1);
  },
);
it("skips background work and retries on foreground, queue, manual retry and timer", async () => {
  h.app.currentState = "background";
  mount();
  expect(h.sync).not.toHaveBeenCalled();
  const change = h.app.addEventListener.mock.calls[0][1];
  change("background");
  expect(h.sync).not.toHaveBeenCalled();
  h.app.currentState = "active";
  change("active");
  await settle();
  h.queue.mock.calls[0][0]();
  await settle();
  retryRouteSync();
  await settle();
  await vi.advanceTimersByTimeAsync(60000);
  expect(h.sync).toHaveBeenCalledTimes(4);
});
it("contains sync failures and allows retry", async () => {
  h.sync.mockRejectedValueOnce(new Error("offline"));
  mount();
  await settle();
  retryRouteSync();
  await settle();
  expect(h.sync).toHaveBeenCalledTimes(2);
});
it("invalidates old work on logout/account change and ignores late completion", async () => {
  let finish!: () => void;
  h.sync.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  mount();
  const current = h.sync.mock.calls[0][1];
  retryRouteSync(); // Coalesced while running; must not rerun after logout.
  cleanup?.();
  cleanup = undefined;
  expect(current()).toBe(false);
  h.session = null;
  mount();
  h.session = session("athlete-b");
  mount();
  await settle();
  finish();
  await settle();
  expect(h.sync.mock.calls.map(([s]) => s.user.id)).toEqual([
    "athlete-a",
    "athlete-b",
  ]);
});
it("isolates subscription setup and cleanup failures", async () => {
  h.app.addEventListener.mockImplementationOnce(() => {
    throw new Error("unavailable");
  });
  expect(mount).not.toThrow();
  await settle();
  h.unsubscribe.mockImplementationOnce(() => {
    throw new Error("cleanup");
  });
  expect(() => cleanup?.()).not.toThrow();
  cleanup = undefined;
  expect(vi.getTimerCount()).toBe(0);
  retryRouteSync();
  expect(h.sync).toHaveBeenCalledOnce();
});
it("preserves web online/visibility triggers and removes both listeners", async () => {
  h.platform.OS = "web";
  const win = new EventTarget(),
    doc = Object.assign(new EventTarget(), { visibilityState: "hidden" });
  const removeWindow = vi.spyOn(win, "removeEventListener"),
    removeDocument = vi.spyOn(doc, "removeEventListener");
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  mount();
  expect(h.sync).not.toHaveBeenCalled();
  doc.visibilityState = "visible";
  doc.dispatchEvent(new Event("visibilitychange"));
  await settle();
  win.dispatchEvent(new Event("online"));
  await settle();
  expect(h.sync).toHaveBeenCalledTimes(2);
  cleanup?.();
  cleanup = undefined;
  expect(removeWindow).toHaveBeenCalledWith("online", expect.any(Function));
  expect(removeDocument).toHaveBeenCalledWith(
    "visibilitychange",
    expect.any(Function),
  );
  win.dispatchEvent(new Event("online"));
  expect(h.sync).toHaveBeenCalledTimes(2);
});
it("tolerates web-like globals with missing event methods", async () => {
  h.platform.OS = "web";
  vi.stubGlobal("document", {});
  expect(mount).not.toThrow();
  await settle();
  expect(h.sync).toHaveBeenCalledOnce();
});

import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { Workout } from "../types/activity";
import { stats } from "../utils/tracking";
const fake = vi.hoisted(() => ({
  rows: new Map<string, Workout>(),
  get: vi.fn(),
  watch: vi.fn(),
  clear: vi.fn(),
  writes: vi.fn(),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "recording-id" }));
vi.mock("../services/database", () => ({
  readWorkouts: async () =>
    [...fake.rows.values()].map((row) => structuredClone(row)),
  writeWorkout: async (row: Workout) => {
    fake.writes();
    fake.rows.set(row.id, structuredClone(row));
  },
  deleteWorkout: async (id: string) => {
    fake.rows.delete(id);
  },
  getValue: async () => null,
  serial: async <T>(work: () => Promise<T>) => work(),
}));
let recorder: typeof import("../services/recorder.web");
let store: typeof import("../store/app");
let success: PositionCallback;
let fail: PositionErrorCallback;
let doc: EventTarget & { visibilityState: string };
function position(
  latitude = 27.7,
  extra: Partial<GeolocationCoordinates> = {},
): GeolocationPosition {
  return {
    timestamp: Date.now(),
    coords: {
      latitude,
      longitude: 85.3,
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      speed: null,
      heading: null,
      ...extra,
    },
  } as GeolocationPosition;
}
beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  fake.rows.clear();
  doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("document", doc);
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), { isSecureContext: true }),
  );
  vi.stubGlobal("indexedDB", {});
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: fake.get,
      watchPosition: fake.watch,
      clearWatch: fake.clear,
    },
  });
  fake.get.mockImplementation((ok) => ok(position()));
  fake.watch.mockImplementation((ok, error) => {
    success = ok;
    fail = error;
    return 7;
  });
  recorder = await import("../services/recorder.web");
  store = await import("../store/app");
  await store.useApp.getState().refresh();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("requests location only on Start, saves the real fix, and preserves owner/visibility", async () => {
  expect(fake.get).not.toHaveBeenCalled();
  await recorder.startWorkout("running", "supabase-owner");
  expect(fake.get).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );
  const row = fake.rows.get("recording-id")!;
  expect(row.ownerId).toBe("supabase-owner");
  expect(row.visibility).toBe("private");
  expect(row.points).toHaveLength(1);
  expect(row.points[0].latitude).toBe(27.7);
  expect(stats(row).meters).toBe(0);
  await expect(recorder.startWorkout("walking")).rejects.toThrow("unfinished");
});
it.each([
  [1, "permission"],
  [2, "unavailable"],
  [3, "timed out"],
])(
  "reports location error %s without creating a workout",
  async (code, message) => {
    fake.get.mockImplementation((_ok, error) => error({ code }));
    await expect(recorder.startWorkout("running")).rejects.toThrow(message);
    expect(fake.rows.size).toBe(0);
  },
);
it("rejects insecure/unsupported browsers and inaccurate initial GPS", async () => {
  vi.stubGlobal("window", { isSecureContext: false });
  await expect(recorder.startWorkout("running")).rejects.toThrow("HTTPS");
  vi.stubGlobal("window", { isSecureContext: true });
  fake.get.mockImplementation((ok) => ok(position(27.7, { accuracy: 200 })));
  await expect(recorder.startWorkout("running")).rejects.toThrow("accurate");
  expect(fake.rows.size).toBe(0);
});
it("accepts actual movement, filters stale/jump readings, and never connects paused segments", async () => {
  await recorder.startWorkout("running");
  vi.setSystemTime(110000);
  success(position(27.7003));
  await vi.waitFor(() =>
    expect(fake.rows.get("recording-id")!.points).toHaveLength(2),
  );
  const measured = stats(fake.rows.get("recording-id")!).meters;
  expect(measured).toBeGreaterThan(30);
  success({ ...position(), timestamp: 1000 });
  await vi.waitFor(() =>
    expect(fake.rows.get("recording-id")!.rejected).toBe(1),
  );
  success(position(28));
  await vi.waitFor(() =>
    expect(fake.rows.get("recording-id")!.rejected).toBe(2),
  );
  await recorder.pauseWorkout("recording-id");
  expect(fake.clear).toHaveBeenCalledWith(7);
  const oldCallback = success;
  vi.setSystemTime(120000);
  oldCallback(position(27.7004));
  expect(fake.rows.get("recording-id")!.points).toHaveLength(2);
  vi.setSystemTime(150000);
  fake.get.mockImplementation((ok) => ok(position(27.8)));
  await recorder.resumeWorkout("recording-id");
  expect(stats(fake.rows.get("recording-id")!).meters).toBeCloseTo(measured);
  expect(fake.rows.get("recording-id")!.segment).toBe(1);
  await recorder.finishWorkout("recording-id");
  expect(fake.rows.get("recording-id")!.state).toBe("finished");
  expect(store.useApp.getState().workouts[0].state).toBe("finished");
});
it("pauses after a watcher error or page suspension and requires explicit Resume", async () => {
  recorder.installRecorderLifecycle();
  await recorder.startWorkout("running");
  vi.setSystemTime(110000);
  fail({ code: 2 } as GeolocationPositionError);
  await vi.waitFor(() =>
    expect(fake.rows.get("recording-id")!.state).toBe("paused"),
  );
  expect(fake.rows.get("recording-id")!.activeMs).toBe(0);
  await recorder.resumeWorkout("recording-id");
  doc.visibilityState = "hidden";
  doc.dispatchEvent(new Event("visibilitychange"));
  await vi.waitFor(() =>
    expect(fake.rows.get("recording-id")!.state).toBe("paused"),
  );
  expect(store.useApp.getState().error).toContain("foreground");
});
it("pauses when GPS stops and recovers interrupted recordings at the last saved evidence", async () => {
  await recorder.startWorkout("running");
  await vi.advanceTimersByTimeAsync(25000);
  expect(fake.rows.get("recording-id")!.state).toBe("paused");
  fake.rows.set("recording-id", {
    ...fake.rows.get("recording-id")!,
    state: "recording",
    resumedAt: 100000,
  });
  await recorder.recoverRecording();
  expect(fake.rows.get("recording-id")!.state).toBe("paused");
  expect(fake.rows.get("recording-id")!.activeMs).toBe(0);
});
it("discards only the unfinished workout and ignores late watcher callbacks", async () => {
  await recorder.startWorkout("running");
  const late = success;
  await recorder.discardWorkout("recording-id");
  late(position());
  expect(fake.rows.size).toBe(0);
  expect(store.useApp.getState().workouts).toEqual([]);
});
it("does not count a suspended page gap even when a GPS callback arrives before the watchdog", async () => {
  await recorder.startWorkout("running");
  vi.setSystemTime(140000);
  success(position(27.701));
  await vi.waitFor(() =>
    expect(fake.rows.get("recording-id")!.state).toBe("paused"),
  );
  expect(fake.rows.get("recording-id")!.points).toHaveLength(1);
  expect(stats(fake.rows.get("recording-id")!).activeMs).toBe(0);
});
it("stops the visible timer on storage failure and can recover after storage becomes writable", async () => {
  await recorder.startWorkout("running");
  fake.writes.mockImplementation(() => {
    throw new Error("Storage full");
  });
  vi.setSystemTime(110000);
  success(position(27.7003));
  await vi.waitFor(() =>
    expect(store.useApp.getState().workouts[0].state).toBe("paused"),
  );
  await vi.waitFor(() => expect(store.useApp.getState().error).not.toBeNull());
  fake.writes.mockReset();
  await recorder.resumeWorkout("recording-id");
  expect(fake.rows.get("recording-id")!.state).toBe("recording");
});

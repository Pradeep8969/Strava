import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Workout } from "../types/activity";
import { stats } from "../utils/tracking";
const fake = vi.hoisted(() => ({
  rows: new Map<string, Workout>(),
  permission: vi.fn(),
  watch: vi.fn(),
  remove: vi.fn(),
  background: vi.fn(),
  writes: vi.fn(),
  error: null as null | ((reason: string) => void),
  location: null as null | ((point: unknown) => void),
}));
function fix(accuracy = 5, latitude = 27.7, timestamp = Date.now()) {
  fake.location!({
    timestamp,
    coords: {
      latitude,
      longitude: 85.3,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      speed: null,
    },
  });
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
vi.mock("expo-crypto", () => ({ randomUUID: () => "native-recording" }));
vi.mock("react-native", () => ({ AppState: { addEventListener: vi.fn() } }));
vi.mock("expo-task-manager", () => ({
  defineTask: vi.fn(),
  isAvailableAsync: async () => true,
}));
vi.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: fake.permission,
  hasServicesEnabledAsync: async () => true,
  watchPositionAsync: fake.watch,
  requestBackgroundPermissionsAsync: async () => ({ granted: true }),
  hasStartedLocationUpdatesAsync: async () => false,
  startLocationUpdatesAsync: fake.background,
}));
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
  setValue: vi.fn(),
  serial: async <T>(work: () => Promise<T>) => work(),
}));
beforeEach(() => {
  vi.stubGlobal("__DEV__", true);
  vi.resetModules();
  vi.resetAllMocks();
  fake.rows.clear();
  fake.permission.mockResolvedValue({ granted: true });
  fake.watch.mockImplementation(async (_options, callback, error) => {
    fake.location = callback;
    fake.error = error;
    return { remove: fake.remove };
  });
});
it("preserves the shared Android/iOS Expo recording lifecycle, storage, route segmentation and background request", async () => {
  const recorder = await import("../services/recorder");
  const { useApp } = await import("../store/app");
  await recorder.startWorkout("running", "owner");
  expect(fake.watch).toHaveBeenCalledWith(
    { accuracy: 4, timeInterval: 3000, distanceInterval: 0 },
    expect.any(Function),
    expect.any(Function),
  );
  const timestamp = Date.now();
  fake.location!({
    timestamp,
    coords: {
      latitude: 27.7,
      longitude: 85.3,
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      speed: null,
    },
  });
  await vi.waitFor(() =>
    expect(fake.rows.get("native-recording")!.points).toHaveLength(1),
  );
  await recorder.pauseWorkout("native-recording");
  expect(fake.rows.get("native-recording")!.state).toBe("paused");
  await recorder.resumeWorkout("native-recording");
  expect(fake.rows.get("native-recording")!.segment).toBe(1);
  await recorder.enableBackground("native-recording");
  expect(fake.background).toHaveBeenCalledWith(
    recorder.BACKGROUND_TASK,
    expect.objectContaining({
      showsBackgroundLocationIndicator: true,
      foregroundService: expect.any(Object),
    }),
  );
  await recorder.finishWorkout("native-recording");
  expect(fake.remove).toHaveBeenCalled();
  expect(fake.rows.get("native-recording")!.state).toBe("finished");
  expect(useApp.getState().workouts[0].ownerId).toBe("owner");
});
it("serializes simultaneous starts and keeps completed saves idempotent", async () => {
  const recorder = await import("../services/recorder");
  const results = await Promise.allSettled([
    recorder.startWorkout("cycling"),
    recorder.startWorkout("walking"),
  ]);
  expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(fake.permission).toHaveBeenCalledTimes(1);
  expect(fake.rows.size).toBe(1);
  fix();
  await vi.waitFor(() =>
    expect(fake.rows.get("native-recording")!.points).toHaveLength(1),
  );
  await recorder.finishWorkout("native-recording");
  const saved = structuredClone(fake.rows.get("native-recording"));
  await recorder.finishWorkout("native-recording");
  expect(fake.rows.get("native-recording")).toEqual(saved);
  await expect(recorder.resumeWorkout("native-recording")).rejects.toThrow(
    "paused",
  );
  await expect(recorder.discardWorkout("native-recording")).rejects.toThrow(
    "Activities",
  );
});
it("keeps a failed finish retryable without losing the active GPS watcher", async () => {
  const recorder = await import("../services/recorder");
  await recorder.startWorkout("hiking");
  fix();
  await vi.waitFor(() =>
    expect(fake.rows.get("native-recording")!.points).toHaveLength(1),
  );
  fake.writes.mockImplementationOnce(() => {
    throw new Error("Storage full");
  });
  await expect(recorder.finishWorkout("native-recording")).rejects.toThrow(
    "Storage full",
  );
  expect(fake.remove).not.toHaveBeenCalled();
  expect(fake.rows.get("native-recording")!.state).toBe("recording");
  await recorder.finishWorkout("native-recording");
  expect(fake.rows.get("native-recording")!.sport).toBe("hiking");
});
it("pauses on GPS errors and ignores callbacks from a replaced subscription", async () => {
  const recorder = await import("../services/recorder");
  await recorder.startWorkout("running");
  const late = fake.location!;
  fake.error!("GPS unavailable");
  await vi.waitFor(() =>
    expect(fake.rows.get("native-recording")!.state).toBe("paused"),
  );
  await recorder.resumeWorkout("native-recording");
  late({
    timestamp: Date.now(),
    coords: { latitude: 27.7, longitude: 85.3, accuracy: 5 },
  });
  expect(fake.rows.get("native-recording")!.points).toEqual([]);
});
it("recovers an interrupted session at its last evidence and leaves a live session alone", async () => {
  const recorder = await import("../services/recorder");
  await recorder.startWorkout("walking");
  await recorder.recoverRecording();
  expect(fake.rows.get("native-recording")!.state).toBe("recording");
  vi.resetModules();
  const restarted = await import("../services/recorder");
  await restarted.recoverRecording();
  expect(fake.rows.get("native-recording")!.state).toBe("paused");
  expect(fake.rows.get("native-recording")!.activeMs).toBe(0);
});
it("rechecks native permission on resume and preserves the paused recording on denial", async () => {
  const recorder = await import("../services/recorder");
  await recorder.startWorkout("running");
  await recorder.pauseWorkout("native-recording");
  fake.permission.mockResolvedValueOnce({ granted: false });
  await expect(recorder.resumeWorkout("native-recording")).rejects.toThrow(
    "permission",
  );
  expect(fake.rows.get("native-recording")!.state).toBe("paused");
  expect(fake.watch).toHaveBeenCalledTimes(1);
});
it("freezes the visible session after a GPS save failure and allows recovery", async () => {
  const recorder = await import("../services/recorder");
  const { useApp } = await import("../store/app");
  await recorder.startWorkout("running");
  fake.writes.mockImplementationOnce(() => {
    throw new Error("Storage full");
  });
  fake.location!({
    timestamp: Date.now(),
    coords: { latitude: 27.7, longitude: 85.3, accuracy: 5 },
  });
  await vi.waitFor(() =>
    expect(useApp.getState().workouts[0].state).toBe("paused"),
  );
  expect(useApp.getState().error).toContain("storage");
  await recorder.resumeWorkout("native-recording");
  expect(fake.rows.get("native-recording")!.state).toBe("recording");
});
it("preserves native permission denial and discard behavior", async () => {
  const recorder = await import("../services/recorder");
  fake.permission.mockResolvedValueOnce({ granted: false });
  await expect(recorder.startWorkout("walking")).rejects.toThrow("permission");
  expect(fake.rows.size).toBe(0);
  await recorder.startWorkout("walking");
  await recorder.discardWorkout("native-recording");
  expect(fake.rows.size).toBe(0);
});
it("waits for accurate fresh fixes and excludes acquisition and loss from native tracked time", async () => {
  const recorder = await import("../services/recorder");
  const { useGpsAcquisition } =
    await import("../features/recording/acquisition");
  const { useGpsDiagnostics } =
    await import("../features/recording/acquisition");
  const base = Date.now();
  vi.setSystemTime(base);
  await recorder.startWorkout("walking");
  const draft = () => fake.rows.get("native-recording")!;
  vi.setSystemTime(base + 60000);
  expect(stats(draft())).toMatchObject({
    elapsedMs: 60000,
    activeMs: 0,
    movingMs: 0,
    meters: 0,
  });
  await expect(recorder.finishWorkout(draft().id)).rejects.toThrow(
    "No GPS fixes",
  );
  expect(draft().state).toBe("recording");
  expect(fake.remove).not.toHaveBeenCalled();
  fix(50);
  await vi.waitFor(() => expect(draft().rejected).toBe(1));
  expect(useGpsAcquisition.getState().detail).toContain("50 m");
  fix(5, 27.7, base + 40000);
  await vi.waitFor(() => expect(draft().rejected).toBe(2));
  expect(useGpsAcquisition.getState().detail).toContain("out-of-date");
  fix();
  await vi.waitFor(() => expect(draft().points).toHaveLength(1));
  expect(draft().activeMs).toBe(0);
  expect(draft().gpsFixAt).toBe(base + 60000);
  vi.setSystemTime(base + 63000);
  fix();
  await vi.waitFor(() => expect(draft().gpsFixAt).toBe(base + 63000));
  expect(draft().points).toHaveLength(1);
  expect(stats(draft())).toMatchObject({
    activeMs: 3000,
    movingMs: 0,
    meters: 0,
  });
  vi.setSystemTime(base + 66000);
  fix(5, 27.70006);
  await vi.waitFor(() => expect(draft().points).toHaveLength(2));
  const tracked = stats(draft());
  expect(tracked.movingMs).toBe(6000);
  expect(tracked.meters).toBeGreaterThan(5);
  expect(tracked.movingPace).toBeCloseTo(6000 / tracked.meters);
  expect(useGpsDiagnostics.getState()).toMatchObject({
    watcher: "started",
    accepted: 3,
    rejected: 2,
    accuracy: 5,
    lastFixAt: base + 66000,
    rejection: expect.stringContaining("out-of-date"),
  });

  vi.setSystemTime(base + 96000);
  expect(stats(draft()).activeMs).toBe(6000);
  fix(5, 27.701);
  await vi.waitFor(() => expect(draft().points[2]?.segment).toBe(1));
  expect(stats(draft())).toMatchObject({
    activeMs: 6000,
    movingMs: 6000,
    meters: tracked.meters,
  });
  await recorder.pauseWorkout(draft().id);
  vi.setSystemTime(base + 120000);
  await recorder.resumeWorkout(draft().id);
  vi.setSystemTime(base + 140000);
  expect(stats(draft()).activeMs).toBe(6000);
  expect(draft().gpsFixAt).toBeNull();
  await recorder.finishWorkout(draft().id);
  expect(draft()).toMatchObject({ state: "finished", activeMs: 6000 });
  expect(draft().points).toHaveLength(3);
});

it("gives settings guidance for approximate-only access and preserves a draft on watch setup failure", async () => {
  const recorder = await import("../services/recorder");
  const { useGpsDiagnostics } =
    await import("../features/recording/acquisition");
  fake.permission.mockResolvedValueOnce({
    granted: true,
    android: { accuracy: "coarse" },
  });
  await expect(recorder.startWorkout("walking")).rejects.toThrow(
    "Enable precise location",
  );
  expect(fake.rows.size).toBe(0);
  expect(useGpsDiagnostics.getState()).toMatchObject({
    permission: "granted",
    precision: "approximate",
    watcher: "idle",
  });
  fake.permission.mockResolvedValueOnce({
    granted: true,
    android: { accuracy: "fine" },
  });
  fake.watch.mockRejectedValueOnce(new Error("Provider unavailable"));
  await expect(recorder.startWorkout("walking")).rejects.toThrow(
    "Could not start GPS",
  );
  expect(fake.rows.get("native-recording")).toMatchObject({
    state: "paused",
    activeMs: 0,
    points: [],
  });
  expect(useGpsDiagnostics.getState()).toMatchObject({
    permission: "granted",
    precision: "precise",
    watcher: "failed",
  });
});

it.each([
  { sport: "walking", displacement: 0.00004, accepted: true },
  { sport: "walking", displacement: 0.0002, accepted: false },
  { sport: "running", displacement: 0.0002, accepted: true },
  { sport: "cycling", displacement: 0.0005, accepted: true },
] as const)(
  "records $sport with its movement limit using only local storage ($displacement)",
  async ({ sport, displacement, accepted }) => {
    const recorder = await import("../services/recorder");
    const now = Date.now();
    vi.setSystemTime(now);
    await recorder.startWorkout(sport);
    const draft = () => fake.rows.get("native-recording")!;
    fix();
    await vi.waitFor(() => expect(draft().points).toHaveLength(1));
    vi.setSystemTime(now + 3000);
    fix(5, 27.7 + displacement);
    await vi.waitFor(() => {
      expect(draft().points).toHaveLength(accepted ? 2 : 1);
      expect(draft().rejected).toBe(accepted ? 0 : 1);
    });
    const result = stats(draft());
    expect(result.movingMs).toBe(accepted ? 3000 : 0);
    if (accepted) {
      expect(result.movingMeters).toBeGreaterThan(0);
      expect(result.movingPace).toBeCloseTo(3000 / result.movingMeters);
    } else {
      expect(result.meters).toBe(0);
      expect(result.movingPace).toBeNull();
    }
  },
);

it("keeps stationary jitter below the displacement threshold after 30 seconds and still records slow walking", async () => {
  const recorder = await import("../services/recorder");
  const { useGpsDiagnostics } =
    await import("../features/recording/acquisition");
  const start = Date.now();
  vi.setSystemTime(start);
  await recorder.startWorkout("walking");
  const draft = () => fake.rows.get("native-recording")!;
  const send = async (seconds: number, metres: number) => {
    const timestamp = start + seconds * 1000;
    vi.setSystemTime(timestamp);
    fix(5, 27.7 + metres / 111195, timestamp);
    await vi.waitFor(() => expect(draft().gpsFixAt).toBe(timestamp));
  };
  await send(0, 0);
  for (let seconds = 3; seconds <= 33; seconds += 3)
    await send(seconds, seconds % 2 ? 1.8 : -1.1);
  expect(draft().points).toHaveLength(1);
  expect(stats(draft()).meters).toBe(0);
  expect(useGpsDiagnostics.getState().withoutTrackPoint).toBe(11);
  await send(36, 2.6);
  await send(39, 4.1);
  await send(42, 5.9);
  await send(45, 7.5);
  expect(stats(draft()).meters).toBeCloseTo(7.5, 1);
  expect(stats(draft()).movingPace).toBeCloseTo(6000 / 3.4, 0);
});

it("recovers a guide reference without storing planned geometry in a workout", async () => {
  const recorder = await import("../services/recorder");
  const guide = { scope: "local", id: "saved-route" } as const;
  await recorder.startWorkout("cycling", undefined, guide);
  expect(fake.rows.get("native-recording")).toMatchObject({
    routeGuide: guide,
    points: [],
  });
  expect(stats(fake.rows.get("native-recording")!).meters).toBe(0);
  vi.resetModules();
  const restarted = await import("../services/recorder");
  await restarted.recoverRecording();
  expect(fake.rows.get("native-recording")).toMatchObject({
    state: "paused",
    routeGuide: guide,
  });
  await restarted.resumeWorkout("native-recording");
  fix();
  await vi.waitFor(() =>
    expect(fake.rows.get("native-recording")!.points).toHaveLength(1),
  );
  await restarted.finishWorkout("native-recording");
  expect(fake.rows.get("native-recording")!.routeGuide).toBeUndefined();
});

it("records GPS far from a saved guide starting point after manual Start", async () => {
  const recorder = await import("../services/recorder");
  const guide = { scope: "local", id: "kathmandu-guide" } as const;
  await recorder.startWorkout("walking", undefined, guide);
  // A fix well outside Kathmandu must still be accepted as the first recorded fix.
  fix(5, 28.25);
  await vi.waitFor(() =>
    expect(fake.rows.get("native-recording")?.points[0]?.latitude).toBe(28.25),
  );
  expect(fake.rows.get("native-recording")).toMatchObject({
    routeGuide: guide,
    state: "recording",
  });
});

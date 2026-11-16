import { beforeEach, expect, it, vi } from "vitest";
import type { Workout } from "../types/activity";
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
    { accuracy: 4, timeInterval: 3000, distanceInterval: 3 },
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

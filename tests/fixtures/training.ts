import type { Sport, Workout } from "../../types/activity";

/** Isolated test input only. Never loaded or persisted by the application. */
export function trainingFixture(
  id = "test-run",
  sport: Sport = "running",
  startedAt = +new Date(2026, 10, 10, 8),
): Workout {
  return {
    id,
    title: `Test fixture ${sport}`,
    description: "Browser test input, not a real workout",
    sport,
    visibility: "private",
    startedAt,
    endedAt: startedAt + 600000,
    state: "finished",
    activeMs: 600000,
    resumedAt: null,
    segment: 0,
    rejected: 0,
    points: Array.from({ length: 61 }, (_, i) => ({
      latitude: 27.71 + i * 0.0002,
      longitude: 85.32 + Math.sin(i / 10) * 0.0004,
      timestamp: startedAt + i * 10000,
      accuracy: 3,
      altitude: 1300 + i * 3,
      altitudeAccuracy: 3,
      segment: 0,
    })),
  };
}

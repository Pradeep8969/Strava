import type { Workout } from "../../types/activity";
import { stats } from "../../utils/tracking";
import type { Challenge } from "./data";

/** Personal device estimate, not a verified server score. No prorated GPS guesses. */
export function challengeProgress(
  challenge: Challenge,
  workouts: Workout[],
  userId: string,
  joinedAt: string,
  now = Date.now(),
) {
  const start = Math.max(Date.parse(challenge.starts_at), Date.parse(joinedAt));
  const end = Math.min(Date.parse(challenge.ends_at), now);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(challenge.target_m) ||
    challenge.target_m <= 0
  )
    return null;
  const completed = workouts.filter(
    (w) =>
      w.state === "finished" &&
      (!w.ownerId || w.ownerId === userId) &&
      w.startedAt >= start &&
      w.endedAt !== null &&
      w.endedAt <= end,
  );
  const meters = completed.reduce((sum, w) => sum + stats(w).meters, 0);
  return {
    meters,
    count: completed.length,
    percent: Math.min(100, Math.max(0, (meters / challenge.target_m) * 100)),
  };
}

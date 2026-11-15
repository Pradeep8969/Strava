import type { Workout } from "../../types/activity";
// Unowned recordings remain device-local and require the existing explicit Link action.
// Account-bound recordings are never displayed as another account's data.
export function canAccessLocalWorkout(
  workout: Pick<Workout, "ownerId">,
  userId?: string,
) {
  return !workout.ownerId || workout.ownerId === userId;
}

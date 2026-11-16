import type { Workout } from "../../types/activity";
import { canAccessLocalWorkout } from "../auth/local-access";

/** Local owner/device view only. Never fall back to raw other-user geometry.
 * Shared routes require server-redacted coordinates; that route API is not implemented.
 * Public/follower visibility alone must not bypass privacy-zone redaction.
 */
export function activityMapPoints(workout: Workout, viewerId?: string) {
  return canAccessLocalWorkout(workout, viewerId) ? workout.points : [];
}

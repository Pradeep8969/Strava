import type { User } from "@supabase/supabase-js";
import { avatarUrl, providerProfile } from "./profile";
import { isCustomAvatar } from "./edit-profile";

// Resolve for display only. Never backfill profiles or replace a saved upload.
export function athleteAvatarSources(
  user: Pick<User, "id" | "user_metadata" | "identities"> | undefined,
  profile: { id: string; avatar_path: string | null } | undefined,
) {
  if (!user) return [];
  const stored = profile?.id === user.id ? profile.avatar_path : null;
  const primary =
    avatarUrl(stored) || (isCustomAvatar(user.id, stored) ? stored : null);
  const google = providerProfile(user, "google").avatar;
  return [...new Set([primary, google].filter((v): v is string => !!v))];
}

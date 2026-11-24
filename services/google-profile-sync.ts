import { Platform } from "react-native";
import { backend, storage } from "./supabase";
import { loadAthleteProfile } from "./profile";
import { avatarUrl, providerProfile } from "../features/athlete/profile";
import { isCustomAvatar } from "../features/athlete/edit-profile";

const pendingKey = (userId: string) =>
  // Keep existing browser markers. Supabase user IDs are UUIDs.
  `stravakinda.google-profile-pending${Platform.OS === "web" ? ":" : "."}${userId}`;
const running = new Map<string, Promise<void>>();

export async function discardGoogleProfileSync(userId: string) {
  await storage.removeItem(pendingKey(userId));
}

// Only the Google OAuth callback schedules a sync. A linked Google identity alone
// does not mean the current sign-in used Google.
export async function scheduleGoogleProfileSync(userId: string) {
  await storage.setItem(pendingKey(userId), "pending");
  await resumeGoogleProfileSync(userId);
}

export function resumeGoogleProfileSync(userId: string): Promise<void> {
  const existing = running.get(userId);
  if (existing) return existing;
  const task = (async () => {
    if (!(await storage.getItem(pendingKey(userId)))) return;
    const client = backend();
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user || data.user.id !== userId)
      throw new Error("Your account changed. Sign in with Google again.");
    const identity = data.user.identities?.find(
      (item) => item.provider === "google",
    );
    if (!identity)
      throw new Error(
        "No Google identity was returned. Sign in with Google again.",
      );

    const metadata = providerProfile(data.user, "google");
    // Email and provider identity remain in Auth, not in the public profile.
    // Never use the Google subject/identity ID as the athlete primary key.
    const googleAccount = {
      ...metadata,
      email:
        typeof identity.identity_data?.email === "string"
          ? identity.identity_data.email
          : data.user.email,
      provider: identity.provider,
      identityId: identity.id,
    };
    const profile = await loadAthleteProfile(userId);
    const changes: { name?: string; avatar_path?: string } = {};
    if (googleAccount.name && googleAccount.name !== profile.name)
      changes.name = googleAccount.name;
    const photo = avatarUrl(googleAccount.avatar);
    if (
      photo &&
      photo !== profile.avatar_path &&
      !isCustomAvatar(userId, profile.avatar_path)
    )
      changes.avatar_path = photo;
    if (Object.keys(changes).length) {
      let query = client.from("profiles").update(changes).eq("id", userId);
      // A concurrent custom upload must win over an in-flight Google sync.
      if (changes.avatar_path)
        query =
          profile.avatar_path === null
            ? query.is("avatar_path", null)
            : query.eq("avatar_path", profile.avatar_path);
      const saved = await query.select("id").maybeSingle();
      if (saved.error) throw saved.error;
      if (saved.data?.id !== userId)
        throw new Error(
          "Google profile could not be saved. Please retry synchronization.",
        );
    }
    await storage.removeItem(pendingKey(userId));
  })().finally(() => running.delete(userId));
  running.set(userId, task);
  return task;
}

export class GoogleProfileSyncError extends Error {
  constructor(readonly userId: string) {
    super(
      "You are signed in, but your Google profile could not be synchronized. Retry to finish signing in.",
    );
    this.name = "GoogleProfileSyncError";
  }
}

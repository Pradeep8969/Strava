import { backend } from "./supabase";
import { profileChanges, avatarUrl } from "../features/athlete/profile";
import {
  isCustomAvatar,
  validateDetails,
  type ProfileDraft,
  type ProfileDetails,
} from "../features/athlete/edit-profile";
export async function loadProfileDetails(
  userId: string,
): Promise<(ProfileDetails & { revision: number }) | null> {
  const result = await backend()
    .from("athlete_details")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (result.error)
    throw new Error(
      "Extended profile details are unavailable. Ask your administrator to review and apply 202611150002_profile_editor.sql, then retry.",
    );
  return result.data;
}
export async function saveProfileDetails(
  userId: string,
  original: ProfileDraft,
  draft: ProfileDraft,
  revision: number,
) {
  validateDetails(draft);
  const client = backend();
  const auth = await client.auth.getUser();
  if (auth.error) throw auth.error;
  if (auth.data.user?.id !== userId)
    throw new Error("Your account changed. Reopen the profile editor.");
  const base = (row: ProfileDraft) => ({
    name: row.name,
    bio: row.bio,
    username: row.username,
    is_private: row.is_private,
    avatar_path: row.avatar_path,
  });
  const changes = profileChanges(base(original), {
    ...base(draft),
    avatar_path: original.avatar_path,
  });
  if (draft.avatar_path !== original.avatar_path) {
    if (
      draft.avatar_path &&
      !avatarUrl(draft.avatar_path) &&
      !isCustomAvatar(userId, draft.avatar_path)
    )
      throw new Error("Select an image owned by your account.");
    changes.avatar_path = draft.avatar_path;
  }
  const details: ProfileDetails = {
    first_name: draft.first_name.trim(),
    last_name: draft.last_name.trim(),
    city: draft.city.trim(),
    province: draft.province.trim(),
    primary_sport: draft.primary_sport,
    birthdate: draft.birthdate,
    gender: draft.gender,
    weight_kg: draft.weight_kg,
  };
  const result = await client.rpc("save_athlete_details", {
    patch: changes,
    details,
    expected: base(original),
    expected_revision: revision,
  });
  if (result.error)
    throw new Error(`Could not save profile. ${result.error.message}`);
}

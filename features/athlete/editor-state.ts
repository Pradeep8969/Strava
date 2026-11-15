import type { ProfileDraft, ProfileDetails } from "./edit-profile";
import { splitName, validateDetails } from "./edit-profile";
import { profileChanges } from "./profile";

export function editorDraft(
  base: Pick<
    ProfileDraft,
    "name" | "username" | "bio" | "is_private" | "avatar_path"
  >,
  details: (ProfileDetails & { revision: number }) | null,
) {
  const names =
    details && `${details.first_name} ${details.last_name}`.trim() === base.name
      ? details
      : splitName(base.name);
  const draft: ProfileDraft = {
    ...base,
    ...names,
    city: details?.city ?? "",
    province: details?.province ?? "",
    primary_sport: details?.primary_sport ?? null,
    birthdate: details?.birthdate ?? null,
    gender: details?.gender ?? null,
    weight_kg: details?.weight_kg ?? null,
  };
  return {
    original: draft,
    draft,
    revision: details?.revision ?? 0,
    photo: null,
    weightText: draft.weight_kg === null ? "" : String(draft.weight_kg),
  };
}

export function validEditorDraft(draft: ProfileDraft, weightText?: string) {
  try {
    const value = {
      ...draft,
      name: `${draft.first_name.trim()} ${draft.last_name.trim()}`.trim(),
      username: draft.username?.trim() || null,
      weight_kg:
        weightText === undefined
          ? draft.weight_kg
          : weightText.trim()
            ? Number(weightText)
            : null,
    };
    validateDetails(value);
    profileChanges(value, value);
    return true;
  } catch {
    return false;
  }
}

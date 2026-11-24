import type { ProfileDraft, ProfileDetails } from "./edit-profile";
import { ProfileFieldError, splitName, validateDetails } from "./edit-profile";
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
      ? { first_name: details.first_name, last_name: details.last_name }
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

function normalizedDraft(
  draft: ProfileDraft,
  weightText?: string,
): ProfileDraft {
  const weight = weightText?.trim();
  return {
    ...draft,
    first_name: draft.first_name.trim(),
    last_name: draft.last_name.trim(),
    city: draft.city.trim(),
    province: draft.province.trim(),
    username: draft.username?.trim() || null,
    weight_kg:
      weight === undefined
        ? draft.weight_kg
        : !weight
          ? null
          : /^\d+(?:[.,]\d+)?$/.test(weight)
            ? Number(weight.replace(",", "."))
            : NaN,
  };
}

export function assessEditorDraft(
  original: ProfileDraft,
  draft: ProfileDraft,
  weightText?: string,
) {
  const baseline = normalizedDraft(original);
  const value = normalizedDraft(draft, weightText);
  if (
    value.first_name !== baseline.first_name ||
    value.last_name !== baseline.last_name
  )
    value.name = `${value.first_name} ${value.last_name}`.trim();
  const changed = (Object.keys(value) as (keyof ProfileDraft)[]).some(
    (key) => !Object.is(value[key], baseline[key]),
  );
  try {
    validateDetails(value);
    profileChanges(value, value);
    return { value, changed, error: null };
  } catch (error) {
    if (!(error instanceof ProfileFieldError)) throw error;
    return { value, changed, error };
  }
}

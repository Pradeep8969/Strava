import type { Sport } from "../../types/activity";
import { calendarString, localCalendar } from "./birthdate";
export type ProfileDetails = {
  first_name: string;
  last_name: string;
  city: string;
  province: string;
  primary_sport: Sport | null;
  birthdate: string | null;
  gender: string | null;
  weight_kg: number | null;
};
export type ProfileDraft = ProfileDetails & {
  name: string;
  username: string | null;
  bio: string;
  is_private: boolean;
  avatar_path: string | null;
};
export class ProfileFieldError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}
export function splitName(name: string) {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(" ") };
}
export function validateDetails(draft: ProfileDetails, now = new Date()) {
  if (!draft.first_name.trim())
    throw new ProfileFieldError(
      "First name",
      "Enter a first name and a full name of up to 80 characters.",
    );
  if (
    [...`${draft.first_name.trim()} ${draft.last_name.trim()}`.trim()].length >
    80
  )
    throw new ProfileFieldError(
      "First or last name",
      "Enter a first name and a full name of up to 80 characters.",
    );
  for (const [field, value] of [
    ["City", draft.city],
    ["Province", draft.province],
  ])
    if (value.length > 100)
      throw new ProfileFieldError(
        field,
        `${field} must be at most 100 characters.`,
      );
  if (
    draft.primary_sport &&
    !["running", "walking", "cycling", "hiking"].includes(draft.primary_sport)
  )
    throw new ProfileFieldError(
      "Primary sport",
      "Choose a supported primary sport.",
    );
  if (
    draft.gender &&
    ![
      "woman",
      "man",
      "nonbinary",
      "self-described",
      "prefer-not-to-say",
    ].includes(draft.gender)
  )
    throw new ProfileFieldError(
      "Gender",
      "Choose a gender option or leave it blank.",
    );
  if (
    draft.weight_kg !== null &&
    (!Number.isFinite(draft.weight_kg) ||
      draft.weight_kg < 20 ||
      draft.weight_kg > 500)
  )
    throw new ProfileFieldError(
      "Weight (kg)",
      "Weight must be between 20 and 500 kilograms, or blank.",
    );
  if (draft.birthdate) {
    const date = new Date(`${draft.birthdate}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(draft.birthdate) ||
      !Number.isFinite(+date) ||
      date.toISOString().slice(0, 10) !== draft.birthdate ||
      draft.birthdate > calendarString(localCalendar(now)) ||
      date.getUTCFullYear() < now.getFullYear() - 120
    )
      throw new ProfileFieldError(
        "Date of birth",
        "Enter a valid birthdate as YYYY-MM-DD within the past 120 years.",
      );
  }
}
export function isCustomAvatar(
  userId: string,
  path: string | null | undefined,
) {
  return !!path && path.startsWith(`${userId}/`) && !path.includes("..");
}
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export function validateAvatar(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES)
    throw new Error("Choose a photo smaller than 5 MB.");
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(
    (mime === "image/jpeg" && jpeg) ||
    (mime === "image/png" && png) ||
    (mime === "image/webp" && webp)
  ))
    throw new Error("Choose a valid JPEG, PNG or WebP image.");
}

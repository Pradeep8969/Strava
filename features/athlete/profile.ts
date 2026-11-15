import type { User } from "@supabase/supabase-js";

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
export function avatarUrl(value: unknown): string | null {
  const candidate = text(value);
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password
      ? candidate
      : null;
  } catch {
    return null;
  }
}
export function providerProfile(
  user: Pick<User, "user_metadata" | "identities">,
  provider?: string,
) {
  // A named import must never borrow another linked provider's identity.
  const identities = (user.identities ?? []).filter(
    (identity) => !provider || identity.provider === provider,
  );
  const sources = [
    ...identities.map((i) => i.identity_data ?? {}),
    ...(!provider ||
    !user.identities?.length ||
    user.identities.length === identities.length
      ? [user.user_metadata]
      : []),
  ];
  const name =
    sources
      .map((m) => text(m.full_name) || text(m.name) || text(m.display_name))
      .find(Boolean) ?? "";
  const avatar =
    sources
      .map(
        (m) =>
          avatarUrl(m.avatar_url) ||
          avatarUrl(m.picture) ||
          avatarUrl(m.picture?.data?.url),
      )
      .find(Boolean) ?? null;
  return { name: Array.from(name).slice(0, 80).join(""), avatar };
}
export function profileChanges(
  original: {
    name: string;
    username: string | null;
    bio: string;
    is_private: boolean;
    avatar_path: string | null;
  },
  draft: typeof original,
) {
  if (!draft.name.trim() || Array.from(draft.name.trim()).length > 80)
    throw new Error("Enter a name of up to 80 characters.");
  if (draft.username && !/^[a-z0-9_]{3,30}$/.test(draft.username))
    throw new Error(
      "Use 3-30 lowercase letters, numbers, or underscores for your username.",
    );
  if (draft.bio.length > 500)
    throw new Error("Bio must be at most 500 characters.");
  if (
    draft.avatar_path !== original.avatar_path &&
    draft.avatar_path &&
    !avatarUrl(draft.avatar_path)
  )
    throw new Error("Use an HTTPS photo URL or leave it empty.");
  return Object.fromEntries(
    Object.entries(draft).filter(
      ([key, value]) => value !== original[key as keyof typeof original],
    ),
  );
}

import {
  organizerSports,
  validateEventDraft,
  type Banner,
  type EventDraft,
  type OrganizerSport,
} from "./drafts";

export type OrganizerProfile = {
  name: string;
  email: string;
  phone: string;
  location: string;
  about: string;
  website: string;
  social: string;
  sports: OrganizerSport[];
  banner: Banner;
};
export type Workspace = {
  version: 1;
  drafts: EventDraft[];
  profile: OrganizerProfile;
};
export function emptyWorkspace(): Workspace {
  return {
    version: 1,
    drafts: [],
    profile: {
      name: "",
      email: "",
      phone: "",
      location: "",
      about: "",
      website: "",
      social: "",
      sports: [],
      banner: "mountains",
    },
  };
}
export function workspaceKey(ownerId?: string): string {
  return `stravakinda:organizer:v1:${ownerId ? `account:${ownerId}` : "guest"}`;
}
export function validateProfile(p: OrganizerProfile): string | null {
  if (!p.name.trim() || p.name.trim().length > 100)
    return "Enter an organizer name of 1–100 characters.";
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
    return "Enter a valid contact email or leave it blank.";
  if (
    p.email.length > 254 ||
    p.phone.length > 30 ||
    (p.phone && !/^[+\d\s()-]{5,30}$/.test(p.phone))
  )
    return "Enter a valid contact phone or leave it blank.";
  if (p.location.length > 120 || p.about.length > 2000)
    return "Location must be at most 120 characters and description at most 2,000.";
  for (const link of [p.website, p.social]) {
    if (!link) continue;
    try {
      const url = new URL(link);
      if (
        url.protocol !== "https:" ||
        !url.hostname.includes(".") ||
        url.username ||
        url.password ||
        link.length > 500
      )
        throw new Error();
    } catch {
      return "Contact and social links must be valid HTTPS URLs without credentials.";
    }
  }
  if (!p.sports.every((s) => organizerSports.includes(s)))
    return "Choose supported sports.";
  if (!["mountains", "lake", "ridge"].includes(p.banner))
    return "Choose an available banner.";
  return null;
}
// Reject damaged/newer data instead of silently replacing a user's local plans.
export function parseWorkspace(value: unknown): Workspace {
  if (value === null) return emptyWorkspace();
  const w = value as Workspace;
  if (w?.version !== 1 || !Array.isArray(w.drafts) || !w.profile)
    throw new Error(
      "Unsupported or damaged organizer workspace. Existing storage has not been changed.",
    );
  const ids = new Set<string>();
  for (const d of w.drafts) {
    if (!d || typeof d.id !== "string" || !d.id || ids.has(d.id))
      throw new Error(
        "Invalid draft identifiers. Existing storage has not been changed.",
      );
    if (
      ["title", "location", "date", "description", "capacity"].some(
        (k) => typeof d[k as keyof EventDraft] !== "string",
      ) ||
      validateEventDraft(d)
    )
      throw new Error(
        "Invalid saved event. Existing storage has not been changed.",
      );
    if (
      (d.schedule !== undefined && typeof d.schedule !== "string") ||
      [d.createdAt, d.updatedAt].some(
        (t) => t !== undefined && (!Number.isFinite(t) || t < 0),
      )
    )
      throw new Error(
        "Invalid draft metadata. Existing storage has not been changed.",
      );
    ids.add(d.id);
  }
  const p = w.profile;
  if (
    [
      "name",
      "email",
      "phone",
      "location",
      "about",
      "website",
      "social",
      "banner",
    ].some((k) => typeof p[k as keyof OrganizerProfile] !== "string") ||
    !Array.isArray(p.sports) ||
    validateProfile({ ...p, name: p.name || "Unsaved organizer" })
  )
    throw new Error(
      "Invalid saved organizer profile. Existing storage has not been changed.",
    );
  return w;
}
export const draftSorts = [
  "Recently updated",
  "Proposed date",
  "Event name",
] as const;
export function selectDrafts(
  drafts: EventDraft[],
  search: string,
  sport: string,
  sort: string,
) {
  const query = search.trim().toLowerCase();
  return drafts
    .filter(
      (d) =>
        `${d.title} ${d.location} ${d.description}`
          .toLowerCase()
          .includes(query) &&
        (sport === "All drafts" || d.sport === sport),
    )
    .sort((a, b) =>
      sort === "Proposed date"
        ? a.date.localeCompare(b.date)
        : sort === "Event name"
          ? a.title.localeCompare(b.title)
          : (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    );
}
export function planningSummary(drafts: EventDraft[], today: string) {
  const upcoming = drafts
    .filter((d) => d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    upcoming,
    past: drafts.length - upcoming.length,
    categories: organizerSports.map((label) => ({
      label,
      value: drafts.filter((d) => d.sport === label).length,
    })),
    scheduled: drafts.filter((d) => !!d.schedule?.trim()).length,
  };
}

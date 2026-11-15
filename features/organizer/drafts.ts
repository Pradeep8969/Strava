export const organizerSports = [
  "Running",
  "Cycling",
  "Hiking",
  "Walking",
  "Trail running",
] as const;
export type OrganizerSport = (typeof organizerSports)[number];
export type Banner = "mountains" | "lake" | "ridge";
export type EventDraft = {
  id: string;
  title: string;
  location: string;
  date: string;
  sport: OrganizerSport;
  description: string;
  capacity: string;
  banner: Banner;
  schedule?: string;
  createdAt?: number;
  updatedAt?: number;
};
export function emptyEventDraft(): EventDraft {
  return {
    id: "",
    title: "",
    location: "",
    date: "",
    sport: "Running",
    description: "",
    capacity: "",
    banner: "mountains",
    schedule: "",
  };
}
export function validateEventDraft(draft: EventDraft): string | null {
  if (!draft.title.trim() || draft.title.trim().length > 120)
    return "Enter an event name of 1–120 characters.";
  if (!draft.location.trim() || draft.location.trim().length > 120)
    return "Enter a proposed location of 1–120 characters.";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(draft.date);
  if (!match) return "Enter a proposed date as YYYY-MM-DD.";
  const y = Number(match[1]),
    m = Number(match[2]),
    d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  if (
    y < 1900 ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  )
    return "Enter a valid calendar date.";
  if (!organizerSports.includes(draft.sport))
    return "Choose a supported sport.";
  if (
    draft.capacity.trim() &&
    (!/^\d+$/.test(draft.capacity.trim()) ||
      Number(draft.capacity) < 1 ||
      Number(draft.capacity) > 100000)
  )
    return "Proposed capacity must be a whole number from 1 to 100,000.";
  if (draft.description.length > 2000)
    return "Keep the description within 2,000 characters.";
  if ((draft.schedule ?? "").length > 2000)
    return "Keep the schedule within 2,000 characters.";
  if (!["mountains", "lake", "ridge"].includes(draft.banner))
    return "Choose an available preview banner.";
  return null;
}

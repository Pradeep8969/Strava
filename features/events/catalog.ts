import type { DiscoverySport } from "../discovery/catalog";
export type DemoEvent = {
  id: string;
  title: string;
  category: Exclude<DiscoverySport, "All">;
  location: string;
  day: string;
  month: string;
  date: string;
  format: string;
  photo: "mountains" | "lake" | "ridge";
  description: string;
};
/** Explicit visual demonstration data. Not connected to any real event/organizer. */
export const demoEvents: DemoEvent[] = [
  {
    id: "himalayan-trail",
    title: "Himalayan Trail Weekend",
    category: "Trail running",
    location: "Mountain regions · Nepal",
    day: "24",
    month: "OCT",
    date: "24 October 2027",
    format: "10K · 21K",
    photo: "mountains",
    description:
      "A concept for a weekend of mountain trails and shared movement. This sample layout shows how an organizer could introduce an event; no race, route or schedule is confirmed.",
  },
  {
    id: "lakeside-ride",
    title: "Pokhara Lakeside Ride",
    category: "Cycling",
    location: "Pokhara · Gandaki",
    day: "08",
    month: "NOV",
    date: "8 November 2027",
    format: "Social ride",
    photo: "lake",
    description:
      "A visual concept for a lakeside cycling gathering. The location, date and format illustrate the event interface and are not a published ride invitation.",
  },
  {
    id: "valley-run",
    title: "Valley Sunrise Run",
    category: "Running",
    location: "Kathmandu Valley",
    day: "16",
    month: "NOV",
    date: "16 November 2027",
    format: "5K · 10K",
    photo: "ridge",
    description:
      "An example of a city running event page. Distances are sample formats, not measured courses. There is no confirmed organizer, start line or registration.",
  },
  {
    id: "ridge-hike",
    title: "Weekend Ridge Hike",
    category: "Hiking",
    location: "Kathmandu Valley",
    day: "22",
    month: "NOV",
    date: "22 November 2027",
    format: "Group hike",
    photo: "ridge",
    description:
      "An example of a community hiking event. Trail access, weather, difficulty, itinerary and organizing details have not been verified. This is a visual demonstration only.",
  },
];
export function filterEvents(search: string, category: DiscoverySport) {
  const term = search.trim().toLocaleLowerCase();
  return demoEvents.filter(
    (event) =>
      (category === "All" || event.category === category) &&
      `${event.title} ${event.location} ${event.category}`
        .toLocaleLowerCase()
        .includes(term),
  );
}

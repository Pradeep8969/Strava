import type { TrackPoint } from "../../types/activity";
import { distance } from "../../utils/tracking";

export const discoverySports = [
  "All",
  "Running",
  "Cycling",
  "Hiking",
  "Trail running",
] as const;
export type DiscoverySport = (typeof discoverySports)[number];
export type Area = "valley" | "pokhara";
export type RouteIdea = {
  id: string;
  title: string;
  region: string;
  sport: Exclude<DiscoverySport, "All">;
  area: Area;
  photo: "mountains" | "lake" | "ridge";
};
/** Editorial destinations only: no claimed trail geometry, distance or ascent. */
export const routeIdeas: RouteIdea[] = [
  {
    id: "shivapuri",
    title: "Shivapuri foothills",
    region: "Kathmandu Valley",
    sport: "Hiking",
    area: "valley",
    photo: "ridge",
  },
  {
    id: "pokhara",
    title: "Pokhara lakeside",
    region: "Pokhara · Gandaki",
    sport: "Cycling",
    area: "pokhara",
    photo: "lake",
  },
  {
    id: "nagarkot",
    title: "Nagarkot ridgelines",
    region: "Kathmandu Valley",
    sport: "Trail running",
    area: "valley",
    photo: "mountains",
  },
  {
    id: "valley",
    title: "Valley morning loops",
    region: "Kathmandu Valley",
    sport: "Running",
    area: "valley",
    photo: "ridge",
  },
];
export type SavedRoute = { id: string; title: string; points: TrackPoint[] };
export function waypointDistance(points: TrackPoint[]) {
  return points.reduce(
    (total, point, index) =>
      total + (index > 0 ? distance(points[index - 1], point) : 0),
    0,
  );
}
export function filterIdeas(search: string, sport: DiscoverySport) {
  const term = search.trim().toLocaleLowerCase();
  return routeIdeas.filter(
    (idea) =>
      (sport === "All" || idea.sport === sport) &&
      `${idea.title} ${idea.region} ${idea.sport}`
        .toLocaleLowerCase()
        .includes(term),
  );
}
/** Only reliable recorded altitude pairs can supply a gain; planning points have none. */
export function waypointElevation(points: TrackPoint[]): number | null {
  let gain = 0,
    measured = false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (
      a.segment !== b.segment ||
      ![a, b].every(
        (p) =>
          p.altitude !== null &&
          Number.isFinite(p.altitude) &&
          p.altitudeAccuracy !== null &&
          p.altitudeAccuracy >= 0 &&
          p.altitudeAccuracy <= 10,
      )
    )
      continue;
    measured = true;
    const change = b.altitude! - a.altitude!;
    if (change >= 3 && change <= distance(a, b) * 0.5) gain += change;
  }
  return measured ? gain : null;
}
export const areaRegions = {
  valley: {
    latitude: 27.745,
    longitude: 85.37,
    latitudeDelta: 0.23,
    longitudeDelta: 0.31,
  },
  pokhara: {
    latitude: 28.225,
    longitude: 83.98,
    latitudeDelta: 0.13,
    longitudeDelta: 0.19,
  },
};
/** Approximate geographic anchors for the labeled schematic, never GPS recordings. */
export const areaPlaces = {
  valley: [
    { name: "Kathmandu", latitude: 27.7172, longitude: 85.324 },
    { name: "Shivapuri", latitude: 27.8167, longitude: 85.3833 },
    { name: "Nagarkot", latitude: 27.717, longitude: 85.52 },
    { name: "Patan", latitude: 27.675, longitude: 85.324 },
    { name: "Bhaktapur", latitude: 27.672, longitude: 85.429 },
  ],
  pokhara: [
    { name: "Pokhara", latitude: 28.2096, longitude: 83.9856 },
    { name: "Phewa Lake", latitude: 28.209, longitude: 83.941 },
    { name: "Sarangkot", latitude: 28.2432, longitude: 83.9486 },
  ],
};

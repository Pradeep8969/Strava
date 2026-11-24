import {
  areaPlaces,
  areaRegions,
  filterIdeas,
  waypointElevation,
} from "../discovery/catalog";
import {
  findWaypointLocations,
  parseWaypointCoordinates,
  waypointLandmarks,
} from "../routes/waypoint-placement";
import { routeGuideParam } from "../routes/guide";
import type { LibraryRoute } from "../../hooks/useRouteLibrary";

export const kathmanduRegion = {
  ...areaRegions.valley,
  latitude: 27.7172,
  longitude: 85.324,
  longitudeDelta: 0.09,
  latitudeDelta: 0.12,
};

export const mapScopes = ["Places", "Saved", "Ideas"] as const;
export type MapScope = (typeof mapScopes)[number];

export function searchPlaces(query: string) {
  const term = query.trim().toLowerCase();
  const known = areaPlaces.valley.map(({ name, ...position }) => ({
    ...position,
    label: name,
  }));
  if (!term) return { places: waypointLandmarks, invalid: false };
  if (/^[+\-.\d]/.test(term) && /[,;]/.test(term)) {
    const coordinate = parseWaypointCoordinates(term);
    return {
      places: coordinate
        ? [
            {
              ...coordinate,
              label: `${coordinate.latitude}, ${coordinate.longitude}`,
            },
          ]
        : [],
      invalid: !coordinate,
    };
  }
  return {
    places: [
      ...findWaypointLocations(term),
      ...known.filter(({ label }) => label.toLowerCase().includes(term)),
    ],
    invalid: false,
  };
}

export function searchSaved(
  plans: LibraryRoute[],
  query: string,
  distance: "Any" | "Under 5 km" | "5 km or more",
  elevation: "Any" | "Measured",
) {
  const term = query.trim().toLowerCase();
  return plans.filter(
    (plan) =>
      !plan.deleted &&
      plan.title.toLowerCase().includes(term) &&
      (distance === "Any" ||
        (distance === "Under 5 km"
          ? plan.distanceMeters < 5000
          : plan.distanceMeters >= 5000)) &&
      (elevation === "Any" || waypointElevation(plan.points) !== null),
  );
}

export function ideasOnMap(
  query: string,
  activity: "All" | "Walking" | "Running" | "Cycling",
) {
  if (activity === "Walking") return [];
  return filterIdeas(query, activity).filter(
    (idea) => idea.sport === "Running" || idea.sport === "Cycling",
  );
}

export function savedMapLayer(route: LibraryRoute) {
  const coordinates = route.geometry.coordinates;
  return {
    id: routeGuideParam(route),
    title: route.title,
    kind: "plan" as const,
    points: route.points.map((point, index) => {
      const [longitude, latitude] = coordinates[index] ?? [
        point.longitude,
        point.latitude,
      ];
      return { ...point, longitude, latitude };
    }),
  };
}

export function scheduleMapSearch(
  query: string,
  apply: (value: string) => void,
) {
  const timer = setTimeout(() => apply(query.trim()), 180);
  return () => clearTimeout(timer);
}

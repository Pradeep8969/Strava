import { roadPreviewMap } from "./road-preview";
import { decodeValhallaRoute } from "./valhalla-routing";
import fixtures from "./valhalla-pilot.json";
import { isRouteCoordinate, type RoutingRequest } from "./routing";

export const kathmanduPreviewTitle = "Preview Kathmandu Roads (Demo)";
export const kathmanduPreviewError =
  "This sample route could not be loaded. Choose another sample or return to planning.";

const samples = {
  "Kathmandu walking": { fixture: "walk-kathmandu", profile: "walking" },
  "Kathmandu cycling": { fixture: "bike-kathmandu-square", profile: "cycling" },
  "Patan walking": { fixture: "walk-patan", profile: "walking" },
  "Bhaktapur walking": { fixture: "walk-bhaktapur", profile: "walking" },
  "Walk via Asan": { fixture: "walk-multi", profile: "walking" },
  "Swayambhu steps": { fixture: "walk-stairs", profile: "walking" },
} as const;

export type KathmanduSample = keyof typeof samples;
export const kathmanduSamples = Object.keys(samples) as KathmanduSample[];
export const canPreviewKathmanduRoads = (
  development: boolean,
  platform: string,
) => development && platform === "android";

export function readKathmanduPreview(
  sample: KathmanduSample,
  body: unknown = fixtures[samples[sample].fixture],
) {
  try {
    const trip = (body as { trip?: { locations?: unknown } } | null)?.trip;
    if (!Array.isArray(trip?.locations) || trip.locations.length < 2)
      return null;
    const request: RoutingRequest = {
      profile: samples[sample].profile,
      waypoints: trip.locations.map((point) => [point?.lon, point?.lat]),
    };
    if (!request.waypoints.every(isRouteCoordinate)) return null;
    const path = decodeValhallaRoute(body, request);
    return {
      path,
      map: roadPreviewMap(request.waypoints, path),
    };
  } catch {
    return null;
  }
}

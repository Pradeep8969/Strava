import { validCoordinate } from "./map-data";

/** Map-only positioning: this type never enters recorder/storage/calculation APIs. */
export type MapLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};
export function mapOnlyLocation(
  position: GeolocationPosition,
  now = Date.now(),
): MapLocation | null {
  const point = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
  return validCoordinate(point) &&
    Number.isFinite(point.accuracy) &&
    point.accuracy >= 0 &&
    Number.isFinite(point.timestamp) &&
    point.timestamp >= now - 60000 &&
    point.timestamp <= now + 1000
    ? point
    : null;
}

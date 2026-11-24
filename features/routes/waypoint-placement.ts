import type { Coordinate } from "../maps/native-types";
import type { TrackPoint } from "../../types/activity";
import { validCoordinate } from "../discovery/map-data";
import { waypoint } from "./planner";

export type WaypointEdit = { index: number; insert: boolean };

export function applyWaypointEdit(
  points: TrackPoint[],
  edit: WaypointEdit,
  coordinate: Coordinate,
): TrackPoint[] {
  const { index, insert } = edit;
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= points.length + Number(insert)
  )
    return points;
  const updated = points.slice();
  updated.splice(index, insert ? 0 : 1, waypoint(coordinate));
  return updated;
}

export function parseWaypointCoordinates(
  query: string,
): Coordinate | undefined {
  const number = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)";
  const match = new RegExp(`^\\s*(${number})\\s*[,;]\\s*(${number})\\s*$`).exec(
    query,
  );
  if (!match) return;
  const point = { latitude: Number(match[1]), longitude: Number(match[2]) };
  return validCoordinate(point) ? point : undefined;
}

// Approximate map starting points. A user confirms the actual waypoint separately.
const landmarks = [
  { label: "Thamel", latitude: 27.71516, longitude: 85.31022 },
  { label: "Ratna Park", latitude: 27.70505, longitude: 85.31471 },
  { label: "Swayambhu", latitude: 27.7149, longitude: 85.2904 },
  { label: "Patan Durbar Square", latitude: 27.6733, longitude: 85.3252 },
  { label: "Bhaktapur Durbar Square", latitude: 27.6721, longitude: 85.4278 },
];

export function findWaypointLocations(query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  const point = parseWaypointCoordinates(text);
  if (point)
    return [{ ...point, label: `${point.latitude}, ${point.longitude}` }];
  return landmarks.filter(({ label }) => label.toLowerCase().includes(text));
}

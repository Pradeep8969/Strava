import { validCoordinate } from "../discovery/map-data";
import type { Coordinate, Region } from "./native-types";

export const lngLat = (p: Coordinate): [number, number] => [
  p.longitude,
  p.latitude,
];

export function regionCamera(region: Region) {
  return {
    center: lngLat(region),
    zoom: Math.max(
      0,
      Math.min(18, Math.log2(360 / Math.max(region.longitudeDelta, 0.0001))),
    ),
  };
}

/** Pad degenerate bounds so single fixes and perfectly straight tracks can fit. */
export function coordinateBounds(
  points: Coordinate[],
): [number, number, number, number] | null {
  const valid = points.filter(validCoordinate);
  if (!valid.length) return null;
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  for (const p of valid) {
    west = Math.min(west, p.longitude);
    east = Math.max(east, p.longitude);
    south = Math.min(south, p.latitude);
    north = Math.max(north, p.latitude);
  }
  const dx = Math.max((east - west) * 0.05, 0.0005);
  const dy = Math.max((north - south) * 0.05, 0.0005);
  return [
    Math.max(-180, west - dx),
    Math.max(-85.051129, Math.min(85.05, south - dy)),
    Math.min(180, east + dx),
    Math.min(85.051129, Math.max(-85.05, north + dy)),
  ];
}

import type { RefObject } from "react";
import type { MapRoute } from "../discovery/map-data";
import type { Coordinate, MapHandle } from "./native-types";

export type MapPin = Coordinate & { label: string };
export type MapsCanvasProps = {
  mapRef: RefObject<MapHandle | null>;
  route?: MapRoute;
  pin?: MapPin;
  onReady: () => void;
  onGesture: () => void;
};

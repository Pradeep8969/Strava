import type { ReactNode, Ref } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export type Coordinate = { latitude: number; longitude: number };
export type Region = Coordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};
export type MapPressEvent = { nativeEvent: { coordinate: Coordinate } };
export type MapPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
export type MapHandle = {
  getCenter?: () => Promise<Coordinate | undefined>;
  zoomBy?: (delta: number) => Promise<void>;
  resetNorth?: () => Promise<void>;
  centerOn?: (point: Coordinate, zoom?: number, duration?: number) => void;
  animateToRegion: (region: Region, duration?: number) => void;
  fitToCoordinates: (
    points: Coordinate[],
    options: {
      edgePadding: MapPadding;
      animated: boolean;
    },
  ) => void;
};
export type NativeMapProps = {
  ref?: Ref<MapHandle>;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  initialRegion: Region;
  initialFit?: { points: Coordinate[]; padding: MapPadding };
  debugGuideLayer?: string;
  userInterfaceStyle?: "light" | "dark";
  onMapReady?: () => void;
  onMapError?: () => void;
  showOfflineGeometry?: boolean;
  onTouchStart?: () => void;
  onPress?: (event: MapPressEvent) => void;
};
export type MarkerProps = {
  coordinate: Coordinate;
  title: string;
  description?: string;
  pinColor?: string;
  children?: ReactNode;
  onPress?: () => void;
};
export type PolylineProps = {
  id?: string;
  coordinates: Coordinate[];
  strokeColor: string;
  strokeWidth: number;
};

import { useImperativeHandle, useRef } from "react";
import MapView from "react-native-maps";
import type { NativeMapProps } from "../../features/maps/native-types";

// iOS keeps the existing default Apple Maps renderer and map overlays.
export { Marker, Polyline } from "react-native-maps";
export default function NativeMap({
  ref,
  onMapError: _onMapError,
  initialFit: _initialFit,
  debugGuideLayer: _debugGuideLayer,
  showOfflineGeometry: _showOfflineGeometry,
  ...props
}: NativeMapProps) {
  const map = useRef<MapView>(null);
  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (region, duration) =>
        map.current?.animateToRegion(region, duration),
      fitToCoordinates: (points, options) =>
        map.current?.fitToCoordinates(points, options),
    }),
    [],
  );
  return <MapView ref={map} {...props} />;
}

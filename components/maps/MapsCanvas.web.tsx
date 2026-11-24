import { memo, useMemo } from "react";
import DiscoveryMap from "../DiscoveryMap.web";
import type { MapsCanvasProps } from "../../features/maps/dedicated-canvas";

export default memo(function MapsCanvas({
  mapRef,
  route,
  pin,
  onReady,
  onGesture,
}: MapsCanvasProps) {
  const routes = useMemo(() => (route ? [route] : []), [route]);
  const dedicated = useMemo(
    () => ({ mapRef, pin, onReady, onGesture }),
    [mapRef, pin, onReady, onGesture],
  );
  return (
    <DiscoveryMap
      routes={routes}
      selectedId={route?.id}
      dedicated={dedicated}
    />
  );
});

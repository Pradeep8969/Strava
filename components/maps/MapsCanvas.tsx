import { memo, useMemo } from "react";
import { Text, View } from "react-native";
import NativeMap, { Marker, Polyline } from "./NativeMap";
import { kathmanduRegion } from "../../features/maps/dedicated";
import { mapSegments } from "../../features/discovery/map-data";
import type { MapsCanvasProps } from "../../features/maps/dedicated-canvas";

export default memo(function MapsCanvas({
  mapRef,
  route,
  pin,
  onReady,
  onGesture,
}: MapsCanvasProps) {
  const segments = useMemo(() => (route ? mapSegments(route) : []), [route]);
  const start = segments[0]?.[0];
  const finish = segments.at(-1)?.at(-1);
  return (
    <NativeMap
      ref={mapRef}
      initialRegion={kathmanduRegion}
      onMapReady={onReady}
      onTouchStart={onGesture}
      showOfflineGeometry
      dedicated
    >
      {segments.map((coordinates, index) => (
        <Polyline
          key={index}
          coordinates={coordinates}
          strokeColor="#087B77"
          strokeWidth={5}
        />
      ))}
      {start ? (
        <Marker coordinate={start} title="Route start">
          <Endpoint label="S" color="#087B77" />
        </Marker>
      ) : null}
      {finish ? (
        <Marker coordinate={finish} title="Route finish">
          <Endpoint label="F" color="#B13B24" />
        </Marker>
      ) : null}
      {pin ? (
        <Marker coordinate={pin} title={pin.label} pinColor="#2C73B9" />
      ) : null}
    </NativeMap>
  );
});

function Endpoint({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        minWidth: 26,
        minHeight: 26,
        paddingHorizontal: 3,
        borderWidth: 2,
        borderColor: "#fff",
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

import type { RefObject } from "react";
import { View } from "react-native";
import type { MapHandle } from "../../features/maps/native-types";
import { IconButton } from "../athlete";

export function AndroidCameraControls({
  map,
  ready,
  onExplore,
  onFit,
  vertical = false,
}: {
  map: RefObject<MapHandle | null>;
  ready: boolean;
  onExplore?: () => void;
  onFit?: () => void;
  vertical?: boolean;
}) {
  const zoom = (delta: number) => {
    onExplore?.();
    void map.current?.zoomBy?.(delta).catch(() => {
      // The map may have unmounted during the native read.
    });
  };
  return (
    <View
      pointerEvents="box-none"
      style={{
        flexDirection: vertical ? "column" : "row",
        flexWrap: "wrap",
        gap: 6,
      }}
    >
      <IconButton
        icon="add"
        label="Zoom in"
        disabled={!ready}
        onPress={() => zoom(1)}
      />
      {onFit ? (
        <IconButton
          icon="scan-outline"
          label="Fit map to route"
          disabled={!ready}
          onPress={onFit}
        />
      ) : null}
      <IconButton
        icon="remove"
        label="Zoom out"
        disabled={!ready}
        onPress={() => zoom(-1)}
      />
      <IconButton
        icon="compass-outline"
        label="Reset map to north"
        disabled={!ready}
        onPress={() => {
          onExplore?.();
          void map.current?.resetNorth?.().catch(() => {
            // The map may have unmounted before the camera command completed.
          });
        }}
      />
    </View>
  );
}

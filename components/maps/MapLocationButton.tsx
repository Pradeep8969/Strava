import { useState, type RefObject } from "react";
import * as Location from "expo-location";
import type { Coordinate, MapHandle } from "../../features/maps/native-types";
import { Button, Copy } from "../ui";

export function MapLocationButton({
  map,
  ready,
  latest,
}: {
  map: RefObject<MapHandle | null>;
  ready: boolean;
  latest?: Coordinate;
}) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  async function locate() {
    const currentMap = map.current;
    setMessage("");
    if (latest) {
      currentMap?.centerOn?.(latest);
      return;
    }
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setMessage("Allow location access to center the map on your position.");
        return;
      }
      const position = await Location.getCurrentPositionAsync();
      if (map.current === currentMap)
        currentMap?.centerOn?.(position.coords, 16);
    } catch {
      setMessage(
        "Could not get your location. Check that location services are enabled.",
      );
    } finally {
      setLocating(false);
    }
  }
  return (
    <>
      <Button
        secondary
        title="My location"
        disabled={!ready || locating}
        onPress={() => void locate()}
      />
      {message ? <Copy>{message}</Copy> : null}
    </>
  );
}

import { useEffect, useState } from "react";
import { Keyboard, Text } from "react-native";
import type { Coordinate } from "../features/maps/native-types";
import { findWaypointLocations } from "../features/routes/waypoint-placement";
import { Button, Copy, Field, useColors } from "./ui";

export default function WaypointSearch({
  onSelect,
}: {
  onSelect: (coordinate: Coordinate) => void;
}) {
  const [query, setQuery] = useState("");
  const colors = useColors();
  const [settled, setSettled] = useState("");
  const text = query.trim();
  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), 200);
    return () => clearTimeout(timer);
  }, [text]);
  const pending = !!text && settled !== text;
  const results = pending ? [] : findWaypointLocations(text);
  const invalidCoordinates =
    !!text && /^[+-.\d]/.test(text) && /[,;]/.test(text);
  return (
    <>
      <Field
        label="Kathmandu landmark or coordinates"
        placeholder="Thamel or 27.7043, 85.3076"
        value={query}
        maxLength={120}
        autoCorrect={false}
        returnKeyType="search"
        onChangeText={setQuery}
      />
      <Copy muted>
        Search a shortlist of Kathmandu Valley landmarks or enter latitude,
        longitude. Online address search is unavailable.
      </Copy>
      {pending ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
          Looking up location…
        </Text>
      ) : results.length ? (
        results.map(({ label, latitude, longitude }) => (
          <Button
            key={label}
            secondary
            title={`Show ${label} on map`}
            onPress={() => {
              Keyboard.dismiss();
              onSelect({ latitude, longitude });
            }}
          />
        ))
      ) : text ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
          {invalidCoordinates
            ? "Enter latitude from −90 to 90 and longitude from −180 to 180, separated by a comma."
            : "No offline match. Try Thamel or Ratna Park, enter coordinates, or go back and place the point on the map."}
        </Text>
      ) : null}
    </>
  );
}

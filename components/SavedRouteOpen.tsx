import { useState } from "react";
import { Modal, Pressable } from "react-native";
import { router } from "expo-router";
import { Button, Copy, Heading, Row, Screen, useColors } from "./ui";
import PlannerMap from "./PlannerMap";
import { guideSports, recorderGuideLocation } from "../features/routes/guide";
import type { LibraryRoute } from "../hooks/useRouteLibrary";

export function FollowRouteActions({
  route,
  onNavigate,
}: {
  route: LibraryRoute;
  onNavigate?: () => void;
}) {
  if (route.deleted)
    return <Copy>This saved route is unavailable for recording.</Copy>;
  return (
    <>
      <Copy>Follow route</Copy>
      <Row>
        {guideSports.map(({ value, label }) => (
          <Button
            key={value}
            title={label}
            onPress={() => {
              onNavigate?.();
              router.navigate(recorderGuideLocation(route, value));
            }}
          />
        ))}
      </Row>
    </>
  );
}

export function SavedRouteOpen({
  route,
  onEdit,
  label = `Open ${route.title}`,
}: {
  route: LibraryRoute;
  onEdit: (route: LibraryRoute) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const colors = useColors();
  const close = () => setOpen(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          minHeight: 48,
          padding: 12,
          borderRadius: 12,
          gap: 4,
          backgroundColor: colors.raised,
          opacity: pressed ? 0.77 : 1,
        })}
        onPress={() => setOpen(true)}
      >
        <Copy>
          {route.title} · {route.points.length} waypoints
        </Copy>
        <Copy muted>Open</Copy>
      </Pressable>
      {open ? (
        <Modal visible onRequestClose={close}>
          <Screen>
            <Heading>{route.title}</Heading>
            <Copy>
              {route.points.length} waypoints ·{" "}
              {(route.distanceMeters / 1000).toFixed(2)} km straight-line plan
            </Copy>
            <Row>
              <Button secondary title="Close preview" onPress={close} />
              <Button
                secondary
                title="Edit a copy in planner"
                onPress={() => {
                  close();
                  onEdit(route);
                }}
              />
            </Row>
            <PlannerMap
              points={route.points}
              savedGeometry={route.geometry}
              fitRequest={1}
            />
            <FollowRouteActions route={route} onNavigate={close} />
          </Screen>
        </Modal>
      ) : null}
    </>
  );
}

import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  demoRoutingProvider,
  scheduleDemoPreview,
} from "../features/routes/demo-preview";
import type {
  RoutingProfile,
  RoutingRequest,
  RoutingState,
} from "../features/routes/routing";
import type { TrackPoint } from "../types/activity";

export function useRoutePreview(
  enabled: boolean,
  points: TrackPoint[],
  profile: RoutingProfile,
) {
  const request = useMemo<RoutingRequest | null>(
    () =>
      enabled && points.length > 1
        ? {
            profile,
            waypoints: points.map(({ longitude, latitude }) => [
              longitude,
              latitude,
            ]),
          }
        : null,
    [enabled, points, profile],
  );
  const [result, setResult] = useState<{
    request: RoutingRequest;
    state: RoutingState;
  } | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!request) return;
      return scheduleDemoPreview(demoRoutingProvider, request, (state) =>
        setResult({ request, state }),
      );
    }, [request]),
  );

  const state: RoutingState = request
    ? result?.request === request
      ? result.state
      : { status: "loading", request }
    : { status: "idle" };
  return state;
}

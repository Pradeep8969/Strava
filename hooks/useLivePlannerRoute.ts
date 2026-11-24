import { useCallback, useMemo, useState } from "react";
import { fetch as expoFetch } from "expo/fetch";
import { useFocusEffect } from "expo-router";
import { Platform } from "react-native";
import type { TrackPoint } from "../types/activity";
import {
  liveKathmanduEndpoint,
  requestLiveKathmanduRoute,
} from "../features/routes/live-kathmandu-preview";
import {
  createRouteRequestController,
  type RoutingRequest,
  type RoutingState,
} from "../features/routes/routing";
import {
  createValhallaRoutingProvider,
  valhallaMaxWaypoints,
} from "../features/routes/valhalla-routing";

export function useLivePlannerRoute(
  endpoint: string | undefined,
  points: TrackPoint[],
  profile: RoutingRequest["profile"],
) {
  const origin = liveKathmanduEndpoint(__DEV__, Platform.OS, endpoint);
  const controller = useMemo(
    () =>
      origin
        ? createRouteRequestController(
            createValhallaRoutingProvider({
              development: true,
              baseUrl: origin,
              fetcher: expoFetch,
            }),
          )
        : undefined,
    [origin],
  );
  const [retry, setRetry] = useState({});
  const attempt = useMemo(
    () => ({
      retry,
      request:
        controller &&
        points.length >= 2 &&
        points.length <= valhallaMaxWaypoints
          ? {
              profile,
              waypoints: points.map(
                ({ longitude, latitude }) => [longitude, latitude] as const,
              ),
            }
          : undefined,
    }),
    [controller, points, profile, retry],
  );
  const [result, setResult] = useState<{
    attempt: typeof attempt;
    state: RoutingState;
  }>();
  const [cancelledAttempt, setCancelledAttempt] = useState<typeof attempt>();
  const cancelled = cancelledAttempt === attempt;
  useFocusEffect(
    useCallback(() => {
      if (!controller || !attempt.request || cancelled) return;
      void requestLiveKathmanduRoute(controller, attempt.request, (state) =>
        setResult({ attempt, state }),
      );
      return () => controller.clear();
    }, [attempt, cancelled, controller]),
  );
  const state: RoutingState =
    !attempt.request || cancelled
      ? { status: "idle" }
      : result?.attempt === attempt
        ? result.state
        : { status: "loading", request: attempt.request };
  return {
    state,
    cancelled,
    cancel: () => {
      controller?.clear();
      setCancelledAttempt(attempt);
    },
    retry: () => setRetry({}),
  };
}

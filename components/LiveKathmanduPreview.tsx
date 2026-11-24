import { useCallback, useMemo, useState } from "react";
import { fetch as expoFetch } from "expo/fetch";
import { useFocusEffect } from "expo-router";
import PlannerMap from "./PlannerMap";
import RoadPreviewDetails from "./RoadPreviewDetails";
import { DashboardTabs } from "./dashboard-ui";
import { Button, Copy, Heading, Row, Screen } from "./ui";
import {
  liveKathmanduError,
  liveKathmanduTitle,
  requestLiveKathmanduRoute,
} from "../features/routes/live-kathmandu-preview";
import { roadPreviewMap } from "../features/routes/road-preview";
import {
  createRouteRequestController,
  isRouteCoordinate,
  type RouteCoordinate,
  type RoutingState,
} from "../features/routes/routing";
import {
  createValhallaRoutingProvider,
  valhallaMaxWaypoints,
} from "../features/routes/valhalla-routing";

const modes = {
  Walking: "walking",
  Running: "running",
  Cycling: "cycling",
} as const;
const modeLabels = Object.keys(modes) as (keyof typeof modes)[];
const sample: readonly RouteCoordinate[] = [
  [85.3076, 27.7043],
  [85.312, 27.7083],
  [85.3139, 27.7125],
];

export default function LiveKathmanduPreview({
  endpoint,
  initialWaypoints,
  onClose,
}: {
  endpoint: string;
  initialWaypoints: readonly RouteCoordinate[];
  onClose: () => void;
}) {
  const [waypoints, setWaypoints] = useState(() =>
    initialWaypoints.slice(0, valhallaMaxWaypoints),
  );
  const [mode, setMode] = useState<keyof typeof modes>("Walking");
  const [state, setState] = useState<RoutingState>({ status: "idle" });
  const [cancelled, setCancelled] = useState(false);
  const controller = useMemo(
    () =>
      createRouteRequestController(
        createValhallaRoutingProvider({
          development: true,
          baseUrl: endpoint,
          fetcher: expoFetch,
        }),
      ),
    [endpoint],
  );

  const clear = useCallback(() => {
    controller.clear();
    setState(controller.getState());
    setCancelled(false);
  }, [controller]);
  useFocusEffect(
    useCallback(() => {
      clear();
      return () => controller.clear();
    }, [clear, controller]),
  );

  const path = state.status === "ready" ? state.path : undefined;
  const map = useMemo(() => roadPreviewMap(waypoints, path), [waypoints, path]);
  const loading = state.status === "loading";
  const cancel = () => {
    clear();
    setCancelled(true);
  };
  const calculate = () => {
    setCancelled(false);
    void requestLiveKathmanduRoute(
      controller,
      { profile: modes[mode], waypoints },
      setState,
    );
  };
  return (
    <Screen>
      <Heading eyebrow="Route Studio · Development preview">
        {liveKathmanduTitle}
      </Heading>
      <Button
        secondary
        title="Back to planning"
        onPress={() => {
          clear();
          onClose();
        }}
      />
      <Copy muted>
        Use USB to reach the local pilot. Tap the map to add points in order,
        then calculate. This preview is read-only.
      </Copy>
      <DashboardTabs
        items={modeLabels}
        value={mode}
        label="Travel mode"
        onChange={(next) => {
          if (next === mode) return;
          clear();
          setMode(next);
        }}
      />
      <PlannerMap
        points={[]}
        fitRequest={0}
        roadPreview={map}
        onWaypoint={({ longitude, latitude }) => {
          const point = [longitude, latitude] as const;
          if (
            !isRouteCoordinate(point) ||
            waypoints.length >= valhallaMaxWaypoints
          )
            return;
          clear();
          setWaypoints((current) =>
            current.length < valhallaMaxWaypoints
              ? [...current, point]
              : current,
          );
        }}
      />
      <Copy muted>
        {waypoints.length} of {valhallaMaxWaypoints} waypoints
      </Copy>
      <Row>
        <Button
          secondary
          title="Use sample points"
          onPress={() => {
            clear();
            setWaypoints([...sample]);
          }}
        />
        <Button
          secondary
          title="Undo point"
          disabled={!waypoints.length}
          onPress={() => {
            clear();
            setWaypoints((current) => current.slice(0, -1));
          }}
        />
        <Button
          secondary
          title="Clear points"
          disabled={!waypoints.length}
          onPress={() => {
            clear();
            setWaypoints([]);
          }}
        />
      </Row>
      <Button
        title={
          loading
            ? "Cancel calculation"
            : state.status === "error"
              ? "Retry route"
              : "Calculate route"
        }
        disabled={loading ? false : waypoints.length < 2}
        onPress={loading ? cancel : calculate}
      />
      {loading ? <Copy>Calculating route…</Copy> : null}
      {waypoints.length < 2 ? (
        <Copy muted>Add at least two valid waypoints.</Copy>
      ) : null}
      {cancelled ? <Copy>Route calculation cancelled.</Copy> : null}
      {state.status === "error" ? (
        <Copy>{liveKathmanduError(state.error.code)}</Copy>
      ) : null}
      {path ? <RoadPreviewDetails path={path} map={map} /> : null}
    </Screen>
  );
}

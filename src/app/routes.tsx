import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Screen,
  Copy,
  Card,
  Button,
  Field,
  Row,
  useColors,
} from "../../components/ui";
import PlannerMap from "../../components/PlannerMap";
import KathmanduRoadsPreview from "../../components/KathmanduRoadsPreview";
import LiveKathmanduPreview from "../../components/LiveKathmanduPreview";
import RoadPreviewDetails from "../../components/RoadPreviewDetails";
import WaypointSearch from "../../components/WaypointSearch";
import {
  liveKathmanduEndpoint,
  liveKathmanduError,
  liveKathmanduTitle,
} from "../../features/routes/live-kathmandu-preview";
import {
  canPreviewKathmanduRoads,
  kathmanduPreviewTitle,
} from "../../features/routes/kathmandu-preview";
import { FollowRouteActions } from "../../components/SavedRouteOpen";
import { DashboardTabs } from "../../components/dashboard-ui";
import type { TrackPoint } from "../../types/activity";
import { savePlan } from "../../services/planned-routes";
import {
  createPlan,
  waypoint,
  planDistance,
  planningLabel,
} from "../../features/routes/planner";
import type { Coordinate } from "../../features/maps/native-types";
import {
  applyWaypointEdit,
  type WaypointEdit,
} from "../../features/routes/waypoint-placement";
import { roadPreviewMap } from "../../features/routes/road-preview";
import { valhallaMaxWaypoints } from "../../features/routes/valhalla-routing";
import { useLivePlannerRoute } from "../../hooks/useLivePlannerRoute";
import { useAction } from "../../hooks/useAction";
import { useRoutePreview } from "../../hooks/useRoutePreview";
import {
  demoProfileOptions,
  type DemoProfile,
} from "../../features/routes/demo-preview";
import { duration } from "../../utils/format";

import { randomUUID } from "expo-crypto";
import { useSession } from "../../hooks/useSession";
import {
  useRouteLibrary,
  type LibraryRoute,
} from "../../hooks/useRouteLibrary";
import { findRouteGuide, parseRouteGuide } from "../../features/routes/guide";
import {
  queueAccountRoute,
  notifyRouteLibrary,
} from "../../services/route-cloud";
export default function Routes() {
  const user = useSession()?.user.id;
  const { edit, from } = useLocalSearchParams<{
    edit?: string;
    from?: string;
  }>();
  return edit ? (
    <EditRouteCopy key={user ?? "local"} edit={edit} />
  ) : (
    <RouteStudio
      key={user ?? "local"}
      mapsDraftOwner={from === "maps" ? (user ?? "local") : undefined}
    />
  );
}
type PlanningMode = "Straight-line" | "Road-following" | "Road-following demo";
type Placement = WaypointEdit & { label: string; target?: Coordinate };
type WaypointDraft = { points: TrackPoint[]; history: TrackPoint[][] };
// Keep the new-route draft for the Maps round trip. A preview result never enters it.
let mapsDraft:
  { owner: string; draft: WaypointDraft; title: string } | undefined;

function EditRouteCopy({ edit }: { edit: string }) {
  const user = useSession()?.user.id;
  const { plans, settled, warning } = useRouteLibrary();
  const route = findRouteGuide(plans, parseRouteGuide(edit), user);
  return route ? (
    <RouteStudio key={edit} source={route} />
  ) : (
    <Screen compact>
      <Copy>
        {warning ||
          (settled
            ? "This saved route is unavailable."
            : "Loading saved route...")}
      </Copy>
    </Screen>
  );
}

function RouteStudio({
  source,
  mapsDraftOwner,
}: { source?: LibraryRoute; mapsDraftOwner?: string } = {}) {
  const session = useSession();
  const { loaded, warning } = useRouteLibrary();

  const colors = useColors();
  const wide = useWindowDimensions().width >= 1100;
  const [fitRequest, setFitRequest] = useState(source ? 1 : 0),
    [draft, setDraft] = useState<WaypointDraft>(() =>
      mapsDraft && mapsDraft.owner === mapsDraftOwner
        ? mapsDraft.draft
        : { points: source?.points ?? [], history: [] },
    ),
    [title, setTitle] = useState(() =>
      mapsDraft && mapsDraft.owner === mapsDraftOwner
        ? mapsDraft.title
        : (source?.title ?? "My route"),
    ),
    a = useAction();
  useLayoutEffect(() => {
    if (mapsDraftOwner) mapsDraft = { owner: mapsDraftOwner, draft, title };
  }, [mapsDraftOwner, draft, title]);
  const { setMessage } = a;
  const [mode, setMode] = useState<PlanningMode>("Straight-line");
  const [profile, setProfile] = useState<DemoProfile>("walking");
  const [moveIndex, setMoveIndex] = useState<number | null>(null);
  const [placement, setPlacementState] = useState<Placement>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [calculate, setCalculate] = useState(false);
  const { points, history } = draft;
  const commit = useCallback(
    (edit: (current: TrackPoint[]) => TrackPoint[]) => {
      setDraft((current) => {
        const next = edit(current.points);
        return next === current.points
          ? current
          : { points: next, history: [...current.history, current.points] };
      });
    },
    [],
  );
  const activePlacement = useRef<Placement>(undefined);
  const changePlacement = (next?: Placement) => {
    setSearchOpen(false);
    activePlacement.current = next;
    setPlacementState(next);
  };
  const android = Platform.OS === "android";
  const [roadPreviewMode, setRoadPreviewMode] = useState<
    "fixture" | "live" | null
  >(null);
  const kathmanduAvailable = canPreviewKathmanduRoads(__DEV__, Platform.OS);
  const liveEndpoint = liveKathmanduEndpoint(
    __DEV__,
    Platform.OS,
    process.env.EXPO_PUBLIC_VALHALLA_USB_BASE_URL,
  );
  const kathmanduOpen = kathmanduAvailable && roadPreviewMode === "fixture";
  const liveOpen = liveEndpoint && roadPreviewMode === "live";
  const demo = __DEV__ && mode === "Road-following demo";
  const roadFollowing = __DEV__ && android && mode === "Road-following";
  const live = useLivePlannerRoute(
    roadFollowing && calculate && !kathmanduOpen && !liveOpen
      ? liveEndpoint
      : undefined,
    points,
    profile,
  );
  const livePath = live.state.status === "ready" ? live.state.path : undefined;
  const liveMap = useMemo(
    () =>
      roadFollowing
        ? roadPreviewMap(
            points.map(({ longitude, latitude }) => [longitude, latitude]),
            livePath,
          )
        : undefined,
    [roadFollowing, points, livePath],
  );
  const preview = useRoutePreview(
    demo && !kathmanduOpen && !liveOpen,
    points,
    profile,
  );
  const path = preview.status === "ready" ? preview.path : undefined;
  const meters = useMemo(() => planDistance(points), [points]);
  const addWaypoint = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
      try {
        const point = waypoint(coordinate);
        commit((current) =>
          demo && moveIndex !== null
            ? applyWaypointEdit(
                current,
                { index: moveIndex, insert: false },
                point,
              )
            : [...current, point],
        );
        setMoveIndex(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    },
    [commit, demo, moveIndex, setMessage],
  );
  const clearPoints = () => {
    commit(() => []);
    setMoveIndex(null);
    changePlacement();
  };
  if (kathmanduOpen)
    return <KathmanduRoadsPreview onClose={() => setRoadPreviewMode(null)} />;
  if (liveOpen)
    return (
      <LiveKathmanduPreview
        endpoint={liveEndpoint}
        initialWaypoints={points.map(({ longitude, latitude }) => [
          longitude,
          latitude,
        ])}
        onClose={() => setRoadPreviewMode(null)}
      />
    );
  const start = (target: Coordinate | undefined = points[0]) =>
    changePlacement({
      index: 0,
      label: "Start",
      insert: !points.length,
      target,
    });
  const finish = (
    target: Coordinate | undefined = points.length > 1
      ? points.at(-1)
      : undefined,
  ) =>
    changePlacement({
      index: Math.max(1, points.length - 1),
      label: "Destination",
      insert: points.length === 1,
      target,
    });
  const addStop = (target?: Coordinate) =>
    changePlacement({
      index: points.length - 1,
      label: `Waypoint ${points.length}`,
      insert: true,
      target,
    });

  return (
    <Screen compact>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          {android ? (
            placement ? (
              <>
                <Copy>
                  Move the map to position {placement.label}, then confirm.
                </Copy>
                <Row>
                  <Button
                    secondary
                    title={`Search for ${placement.label}`}
                    onPress={() => setSearchOpen(true)}
                  />
                </Row>
                {searchOpen ? (
                  <Modal visible onRequestClose={() => setSearchOpen(false)}>
                    <Screen compact>
                      <Button
                        secondary
                        title="Back to map"
                        onPress={() => {
                          Keyboard.dismiss();
                          setSearchOpen(false);
                        }}
                      />
                      <WaypointSearch
                        onSelect={(target) =>
                          changePlacement({ ...placement, target })
                        }
                      />
                    </Screen>
                  </Modal>
                ) : null}
              </>
            ) : (
              <>
                <Button
                  secondary
                  disabled={a.busy}
                  title={points.length ? "Edit Start" : "Set Start"}
                  onPress={() => start()}
                />
                <Button
                  secondary
                  disabled={!points.length || a.busy}
                  title={
                    points.length > 1 ? "Edit Destination" : "Set Destination"
                  }
                  onPress={() => finish()}
                />
                <Copy muted>
                  {points.length < 2
                    ? `Tap the map or search to place your ${points.length ? "Destination" : "Start"}.`
                    : "Tap the map or use Add waypoint to add a stop."}
                </Copy>
              </>
            )
          ) : (
            <Copy muted>Tap or click the map to connect your waypoints.</Copy>
          )}
          <PlannerMap
            points={points}
            onWaypoint={
              a.busy || placement
                ? undefined
                : !android
                  ? addWaypoint
                  : (target) => {
                      if (!points.length) start(target);
                      else if (points.length === 1) finish(target);
                      else addStop(target);
                    }
            }
            fitRequest={fitRequest}
            demoCoordinates={path?.geometry.coordinates}
            roadPreview={liveMap}
            hideWaypointLine={roadFollowing}
            onCancelPlacement={
              android
                ? () => {
                    Keyboard.dismiss();
                    changePlacement();
                  }
                : undefined
            }
            placement={
              placement
                ? {
                    target: placement.target,
                    onConfirm: (coordinate) => {
                      if (activePlacement.current !== placement) return;
                      Keyboard.dismiss();
                      commit((current) =>
                        applyWaypointEdit(current, placement, coordinate),
                      );
                      if (points.length === 1 && placement.insert)
                        setFitRequest((value) => value + 1);
                      changePlacement();
                    },
                  }
                : undefined
            }
          />
          {placement && live.state.status === "loading" ? (
            <Button
              secondary
              title="Cancel calculation"
              onPress={live.cancel}
            />
          ) : null}
          {!placement ? (
            <Row>
              {android ? (
                <Button
                  secondary
                  disabled={points.length < 2 || a.busy}
                  title="Add waypoint"
                  onPress={() => addStop()}
                />
              ) : (
                <Button
                  secondary
                  title="Fit map to route"
                  disabled={!points.length}
                  onPress={() => setFitRequest((v) => v + 1)}
                />
              )}
              <Button
                secondary
                disabled={!history.length || a.busy}
                title="Undo point"
                onPress={() => {
                  setMoveIndex(null);
                  setDraft((current) => {
                    const previous = current.history.at(-1);
                    return previous
                      ? {
                          points: previous,
                          history: current.history.slice(0, -1),
                        }
                      : current;
                  });
                }}
              />
              <Button
                secondary
                disabled={!points.length || a.busy}
                title="Clear waypoints"
                onPress={() => {
                  const question = "Clear all waypoints?";
                  const detail = "Your saved routes will be kept.";
                  if (Platform.OS === "web") {
                    if (window.confirm(question + " " + detail)) clearPoints();
                  } else {
                    Alert.alert(question, detail, [
                      { text: "Keep", style: "cancel" },
                      {
                        text: "Clear",
                        style: "destructive",
                        onPress: clearPoints,
                      },
                    ]);
                  }
                }}
              />
            </Row>
          ) : null}
          {android && !placement
            ? points.slice(1, -1).map((point, index) => (
                <Row key={index}>
                  <Button
                    secondary
                    disabled={a.busy}
                    title={`Edit waypoint ${index + 2}`}
                    onPress={() =>
                      changePlacement({
                        index: index + 1,
                        label: `Waypoint ${index + 2}`,
                        insert: false,
                        target: point,
                      })
                    }
                  />
                  <Button
                    secondary
                    disabled={a.busy}
                    title={`Remove waypoint ${index + 2}`}
                    onPress={() =>
                      commit((current) =>
                        current.filter((_, i) => i !== index + 1),
                      )
                    }
                  />
                </Row>
              ))
            : null}
          {demo && !android ? (
            <>
              {moveIndex !== null ? (
                <Row>
                  <Copy>Tap the map to move waypoint {moveIndex + 1}.</Copy>
                  <Button
                    secondary
                    title="Cancel move"
                    onPress={() => setMoveIndex(null)}
                  />
                </Row>
              ) : null}
              {points.map((_, index) => (
                <Row key={index}>
                  <Button
                    secondary
                    title={`Move waypoint ${index + 1}`}
                    onPress={() => setMoveIndex(index)}
                  />
                  <Button
                    secondary
                    title={`Remove waypoint ${index + 1}`}
                    onPress={() => {
                      setMoveIndex(null);
                      commit((current) =>
                        current.filter((_, i) => i !== index),
                      );
                    }}
                  />
                </Row>
              ))}
            </>
          ) : null}
        </View>
        {!placement ? (
          <View style={{ width: wide ? 320 : "100%", gap: 10 }}>
            <Card>
              {demo || roadFollowing ? (
                <DashboardTabs
                  wrap
                  items={demoProfileOptions}
                  value={profile}
                  onChange={setProfile}
                  label="Travel mode"
                />
              ) : null}
              {roadFollowing ? (
                <>
                  <Copy>Road-following preview</Copy>
                  <Copy muted>
                    Android development routing over USB. This preview is
                    read-only.
                  </Copy>
                  {!liveEndpoint ? (
                    <Copy>
                      Road-following unavailable. Connect an Android development
                      bundle with the configured USB loopback service.
                    </Copy>
                  ) : points.length < 2 ? (
                    <Copy>Confirm Start and Finish to calculate.</Copy>
                  ) : points.length > valhallaMaxWaypoints ? (
                    <Copy>
                      Road-following accepts up to {valhallaMaxWaypoints}{" "}
                      waypoints.
                    </Copy>
                  ) : !calculate ? (
                    <Button
                      title="Calculate route"
                      onPress={() => setCalculate(true)}
                    />
                  ) : live.state.status === "loading" ? (
                    <Button title="Cancel calculation" onPress={live.cancel} />
                  ) : live.state.status === "error" || live.cancelled ? (
                    <>
                      <Button title="Retry route" onPress={live.retry} />
                      <Copy>
                        {live.state.status === "error"
                          ? liveKathmanduError(live.state.error.code)
                          : "Route calculation cancelled."}
                      </Copy>
                    </>
                  ) : livePath && liveMap ? (
                    <RoadPreviewDetails path={livePath} map={liveMap} />
                  ) : null}
                </>
              ) : demo ? (
                <>
                  <Copy>Road-following demo preview</Copy>
                  <Copy muted>
                    Orange connects your waypoints. Teal shows simulated
                    geometry. The demo runs offline and uses no road or trail
                    data.
                  </Copy>
                  <Text
                    accessibilityLiveRegion="polite"
                    aria-live="polite"
                    style={{ color: colors.text }}
                  >
                    {preview.status === "loading"
                      ? "Calculating demo preview…"
                      : preview.status === "error"
                        ? preview.error.message
                        : path
                          ? `Demo distance ${(path.distanceMeters / 1000).toFixed(2)} km${path.durationSeconds === undefined ? "" : ` · Demo estimate ${duration(path.durationSeconds * 1000)}`}`
                          : "Add at least two waypoints to calculate the demo."}
                  </Text>
                  <Copy muted>
                    Switch to Straight-line to save your waypoints.
                  </Copy>
                </>
              ) : (
                <>
                  <Copy>
                    {planningLabel} · {(meters / 1000).toFixed(2)} km ·{" "}
                    {points.length} waypoints
                  </Copy>
                  <Copy muted>
                    {points.length < 2
                      ? "Add two waypoints to preview and save."
                      : !title.trim()
                        ? "Enter a route name to save."
                        : "This route connects waypoints directly. Trails and access are unverified."}
                  </Copy>
                  {source ? (
                    <Copy muted>Save your edits as a new route.</Copy>
                  ) : null}
                  {!loaded ? (
                    <Copy>{warning || "Loading route storage…"}</Copy>
                  ) : null}
                  <Field
                    label="Route name"
                    value={title}
                    onChangeText={setTitle}
                    maxLength={120}
                    editable={!a.busy}
                    returnKeyType="done"
                  />
                  <Button
                    title={session ? "Save route" : "Save route offline"}
                    disabled={
                      points.length < 2 || !title.trim() || a.busy || !loaded
                    }
                    onPress={() =>
                      void a.run(
                        async () => {
                          const plan = createPlan(
                            title,
                            points,
                            randomUUID(),
                            new Date().toISOString(),
                          );
                          if (session)
                            await queueAccountRoute(session.user.id, plan);
                          else {
                            await savePlan(plan);
                            notifyRouteLibrary();
                          }
                          setDraft({ points: [], history: [] });
                          setMoveIndex(null);
                        },
                        session
                          ? "Saved offline. Account routes sync automatically when connected. Base-map tiles require internet."
                          : "Route geometry saved on this device. Sign in to sync new account routes. Base-map tiles still require internet.",
                      )
                    }
                  />
                </>
              )}
            </Card>
            {a.message ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: colors.text }}
              >
                {a.message}
              </Text>
            ) : null}
            {source && !demo && !roadFollowing ? (
              <FollowRouteActions route={source} />
            ) : null}
            <Button
              secondary
              title="My saved routes"
              onPress={() => router.push("/saved-routes")}
            />
            {__DEV__ ? (
              <>
                <Button
                  secondary
                  title={toolsOpen ? "Hide routing tools" : "Routing tools"}
                  onPress={() => setToolsOpen(!toolsOpen)}
                />
                {toolsOpen ? (
                  <Card>
                    <DashboardTabs
                      wrap
                      items={[
                        "Straight-line",
                        ...(android ? ["Road-following" as const] : []),
                        "Road-following demo",
                      ]}
                      value={mode}
                      label="Route planning mode"
                      onChange={(next) => {
                        setMode(next);
                        setCalculate(false);
                        setMoveIndex(null);
                      }}
                    />
                    {kathmanduAvailable ? (
                      <Button
                        secondary
                        title={kathmanduPreviewTitle}
                        onPress={() => setRoadPreviewMode("fixture")}
                      />
                    ) : null}
                    {liveEndpoint ? (
                      <Button
                        secondary
                        title={liveKathmanduTitle}
                        onPress={() => setRoadPreviewMode("live")}
                      />
                    ) : null}
                  </Card>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

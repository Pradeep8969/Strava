import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, View, useWindowDimensions } from "react-native";
import {
  Screen,
  Heading,
  Copy,
  Card,
  Button,
  Field,
  Row,
} from "../../components/ui";
import PlannerMap from "../../components/PlannerMap";
import type { TrackPoint } from "../../types/activity";
import { savePlan, deletePlan } from "../../services/planned-routes";
import {
  createPlan,
  waypoint,
  planDistance,
  planningLabel,
  routingUnavailable,
} from "../../features/routes/planner";
import { useAction } from "../../hooks/useAction";

import { randomUUID } from "expo-crypto";
import { useSession } from "../../hooks/useSession";
import { useRouteLibrary, routeStatus } from "../../hooks/useRouteLibrary";
import { retryRouteSync, useRouteSyncStatus } from "../../hooks/useRouteSync";
import {
  queueAccountRoute,
  acceptCloudVersion,
  notifyRouteLibrary,
} from "../../services/route-cloud";
export default function Routes() {
  const user = useSession()?.user.id;
  return <RouteStudio key={user ?? "local"} />;
}
function RouteStudio() {
  const session = useSession();
  const { plans: saved, loaded, warning } = useRouteLibrary();
  const { syncing, error: syncError } = useRouteSyncStatus();
  const wide = useWindowDimensions().width >= 1100;
  const [fitRequest, setFitRequest] = useState(0),
    [points, setPoints] = useState<TrackPoint[]>([]),
    [title, setTitle] = useState("My route"),
    a = useAction();
  const { setMessage } = a;
  const meters = useMemo(() => planDistance(points), [points]);
  const addWaypoint = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
      try {
        const point = waypoint(coordinate);
        setPoints((current) => [...current, point]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    },
    [setMessage],
  );
  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <Heading eyebrow="Choose your own way">Route studio</Heading>
        <Copy muted>Tap or click the map to connect your waypoints.</Copy>
      </View>
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
          <PlannerMap
            points={points}
            onWaypoint={addWaypoint}
            fitRequest={fitRequest}
          />
          <Row>
            <Button
              secondary
              title="Fit map to route"
              disabled={!points.length}
              onPress={() => setFitRequest((v) => v + 1)}
            />
            <Button
              secondary
              disabled={!points.length}
              title="Undo point"
              onPress={() => setPoints((p) => p.slice(0, -1))}
            />
            <Button
              disabled={!points.length}
              secondary
              title="Clear"
              onPress={() => {
                if (Platform.OS === "web") {
                  if (
                    window.confirm(
                      "Clear all waypoints? Your saved routes will be kept.",
                    )
                  )
                    setPoints([]);
                } else
                  Alert.alert(
                    "Clear all waypoints?",
                    "Your saved routes will be kept.",
                    [
                      { text: "Keep", style: "cancel" },
                      {
                        text: "Clear",
                        style: "destructive",
                        onPress: () => setPoints([]),
                      },
                    ],
                  );
              }}
            />
          </Row>
          <Copy muted>
            {routingUnavailable} Trails and terrain are unverified.
          </Copy>
        </View>
        <View style={{ width: wide ? 300 : "100%", gap: 14 }}>
          <Card>
            <Copy>Straight-line mode</Copy>
            <Copy muted>
              {session
                ? "New routes save offline and sync privately to your account. Existing local-only routes stay local."
                : "Saved offline on this device. Sign in for automatic synchronization of new routes."}
            </Copy>
            <Copy>{planningLabel}</Copy>
            <Copy>
              {(meters / 1000).toFixed(2)} km · {points.length} waypoints
            </Copy>
            <Field
              label="Route name"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />
            <Button
              title={session ? "Save route" : "Save route offline"}
              disabled={points.length < 2 || !title.trim() || a.busy || !loaded}
              onPress={() =>
                void a.run(
                  async () => {
                    const plan = createPlan(
                      title,
                      points,
                      randomUUID(),
                      new Date().toISOString(),
                    );
                    if (session) await queueAccountRoute(session.user.id, plan);
                    else {
                      await savePlan(plan);
                      notifyRouteLibrary();
                    }
                    setPoints([]);
                  },
                  session
                    ? "Saved offline. Account routes sync automatically when connected. Base-map tiles require internet."
                    : "Route geometry saved on this device. Sign in to sync new account routes. Base-map tiles still require internet.",
                )
              }
            />
          </Card>
          <Copy muted>{syncing ? "Syncing" : syncError || warning}</Copy>
          {session ? (
            <Button secondary title="Retry Sync" onPress={retryRouteSync} />
          ) : null}
          {a.message ? <Copy>{a.message}</Copy> : null}
        </View>
      </View>
      {saved.map((r) => (
        <Card key={`${r.accountId ?? "local"}:${r.id}`}>
          <Copy muted>{routeStatus(r)}</Copy>
          <Copy>
            {r.title} · {r.points.length} waypoints
          </Copy>
          <Copy muted>
            {planningLabel}: {(r.distanceMeters / 1000).toFixed(2)} km -{" "}
            {r.createdAt
              ? new Date(r.createdAt).toLocaleDateString()
              : "Legacy plan: creation date unavailable"}
            . Saving an opened plan creates a new copy.
          </Copy>
          <Button
            secondary
            title="Open"
            onPress={() => {
              setPoints(r.points);
              setTitle(r.title);
              setFitRequest((v) => v + 1);
            }}
          />
          {r.syncStatus === "conflict" && r.accountId ? (
            <Button
              secondary
              title="Use cloud version (discard local conflict)"
              onPress={() =>
                void a.run(() =>
                  acceptCloudVersion(r.accountId!, r.id, r.localMutation!),
                )
              }
            />
          ) : null}
          <Button
            secondary
            title="Delete saved route"
            onPress={() =>
              void a.run(async () => {
                if (r.accountId)
                  await queueAccountRoute(
                    r.accountId,
                    r,
                    true,
                    r.localMutation,
                  );
                else {
                  await deletePlan(r.id);
                  notifyRouteLibrary();
                }
              })
            }
          />
        </Card>
      ))}
    </Screen>
  );
}

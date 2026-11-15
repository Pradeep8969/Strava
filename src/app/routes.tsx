import { useCallback, useEffect, useState } from "react";
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
import { loadPlans, savePlan, deletePlan } from "../../services/planned-routes";
import {
  createPlan,
  waypoint,
  planDistance,
  planningLabel,
  routingUnavailable,
  type PlannedRoute,
} from "../../features/routes/planner";
import { useAction } from "../../hooks/useAction";

export default function Routes() {
  const [saved, setSaved] = useState<PlannedRoute[]>([]),
    [fitRequest, setFitRequest] = useState(0),
    [loaded, setLoaded] = useState(false),
    [points, setPoints] = useState<TrackPoint[]>([]),
    [title, setTitle] = useState("My route"),
    a = useAction();
  const { run, setMessage } = a;
  useEffect(() => {
    void run(async () => {
      setSaved(await loadPlans());
      setLoaded(true);
    });
  }, [run]);
  const meters = planDistance(points);
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
      <Heading eyebrow="Choose your own way">Route studio</Heading>
      <Copy muted>
        Tap the map to add waypoints. This basic builder connects them with
        straight lines; roads and access restrictions are not checked.
      </Copy>
      <Copy>{planningLabel} - Straight-line mode</Copy>
      <Copy muted>{routingUnavailable}</Copy>
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
          onPress={() => setPoints([])}
        />
      </Row>
      <Field
        label="Route name"
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />
      <Copy>
        {(meters / 1000).toFixed(2)} km · {points.length} waypoints
      </Copy>
      <Button
        title="Save route offline"
        disabled={points.length < 2 || !title.trim() || a.busy || !loaded}
        onPress={() =>
          void a.run(async () => {
            const id =
              String(Date.now()) + "-" + Math.random().toString(36).slice(2);
            const next = await savePlan(
              createPlan(title, points, id, new Date().toISOString()),
            );
            setSaved(next);
            setPoints([]);
          }, "Route geometry saved on this device. Base-map tiles still require internet.")
        }
      />
      {saved.map((r) => (
        <Card key={r.id}>
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
          <Button
            secondary
            title="Delete saved route"
            onPress={() =>
              void a.run(async () => {
                const next = await deletePlan(r.id);
                setSaved(next);
              })
            }
          />
        </Card>
      ))}
      {a.message ? <Copy>{a.message}</Copy> : null}
    </Screen>
  );
}

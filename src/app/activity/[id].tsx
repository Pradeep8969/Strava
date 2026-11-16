import { useEffect, useState } from "react";
import { Alert, Platform, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Card,
  Copy,
  Button,
  Row,
  Metric,
  Field,
  Empty,
  Loading,
  useColors,
} from "../../../components/ui";
import { AthletePage, AthleteText as Text } from "../../../components/athlete";
import { DiscoveryTitle } from "../../../components/discovery-ui";
import {
  TrainingPanel,
  sportNames,
} from "../../../components/athlete-training";
import { activityMapPoints } from "../../../features/routes/activity-map";
import { waypointElevation } from "../../../features/discovery/catalog";
import TrackMap from "../../../components/TrackMap";
import { mutateWorkout, useApp } from "../../../store/app";
import { stats, gpx } from "../../../utils/tracking";
import { duration, length, pace } from "../../../utils/format";
import { useAction } from "../../../hooks/useAction";
import { shareFile } from "../../../services/export";
import { deleteWorkout, setValue } from "../../../services/database";
import { backend } from "../../../services/supabase";
import { useSession } from "../../../hooks/useSession";
import { canAccessLocalWorkout } from "../../../features/auth/local-access";
import type { Sport, Visibility } from "../../../types/activity";
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workouts, ready } = useApp();
  const userId = useSession()?.user.id;
  if (!ready)
    return (
      <AthletePage>
        <Loading />
      </AthletePage>
    );
  if (!workouts.some((w) => w.id === id && canAccessLocalWorkout(w, userId)))
    return (
      <AthletePage>
        <Empty
          title="Activity unavailable"
          detail="This activity may have been deleted."
        />
      </AthletePage>
    );
  return <DetailContent key={id} id={id} />;
}
function DetailContent({ id }: { id: string }) {
  const wide = useWindowDimensions().width >= 1100;
  const { workouts, preferences: p } = useApp(),
    w = workouts.find((x) => x.id === id),
    action = useAction(),
    session = useSession(),
    c = useColors();
  const [title, setTitle] = useState(w?.title ?? ""),
    [description, setDescription] = useState(w?.description ?? ""),
    [replay, setReplay] = useState(0),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !w) return;
    const timer = setInterval(
      () =>
        setReplay((i) => {
          if (i >= w.points.length - 1) {
            setPlaying(false);
            return 0;
          }
          return i + 1;
        }),
      150,
    );
    return () => clearInterval(timer);
  }, [playing, w]);
  if (!w)
    return (
      <Screen>
        <Empty
          title="Activity unavailable"
          detail="This activity may have been deleted."
        />
      </Screen>
    );
  const s = stats(w);
  return (
    <AthletePage>
      <DiscoveryTitle
        title={w.title}
        detail={`${sportNames[w.sport]} · ${new Date(w.startedAt).toLocaleDateString()} · ${w.visibility}`}
      />
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        <View
          style={{
            flex: wide ? 1.6 : undefined,
            width: wide ? undefined : "100%",
            minWidth: 0,
            gap: 12,
          }}
        >
          <TrackMap
            points={activityMapPoints(w, session?.user.id)}
            cursor={w.points[replay]}
          />
          {Platform.OS !== "web" ? (
            <Button
              secondary
              title={playing ? "Stop replay" : "Replay route"}
              disabled={!w.points.length}
              onPress={() => {
                setReplay(0);
                setPlaying(!playing);
              }}
            />
          ) : null}
        </View>
        <View
          style={{
            flex: wide ? 0.8 : undefined,
            width: wide ? undefined : "100%",
            minWidth: 0,
          }}
          accessibilityLabel="Recorded activity statistics"
        >
          <TrainingPanel>
            <Row>
              <Metric label={p.units} value={length(s.meters, p.units)} />
              <Metric
                label={`Pace /${p.units}`}
                value={pace(s.pace, p.units)}
              />
            </Row>
            <Row>
              <Metric label="Moving time" value={duration(s.movingMs)} />
              <Metric label="Elapsed" value={duration(s.elapsedMs)} />
            </Row>
            <Copy muted>
              Elevation gain:{" "}
              {waypointElevation(w.points) !== null
                ? `${s.elevation.toFixed(0)} m`
                : "Unavailable"}{" "}
              · reliable altitude only
            </Copy>
            <Copy muted>
              Average speed:{" "}
              {s.movingMs > 0
                ? (
                    ((s.meters / s.movingMs) * 3600) /
                    (p.units === "mi" ? 1.609344 : 1)
                  ).toFixed(1)
                : "—"}{" "}
              {p.units}/h
            </Copy>
          </TrainingPanel>
        </View>
      </View>
      <TrainingPanel>
        <DiscoveryTitle title="Kilometer splits" />
        {s.splits.length ? (
          s.splits.map((split) => (
            <View
              key={split.km}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Text style={{ color: c.muted, fontSize: 12, width: 34 }}>
                {split.km} km
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  backgroundColor: c.raised,
                  borderRadius: 4,
                }}
              >
                <View
                  style={{
                    width: `${Math.max(5, (Math.min(...s.splits.map((item) => item.seconds)) / Math.max(1, split.seconds)) * 100)}%`,
                    height: 8,
                    backgroundColor: c.forest,
                    borderRadius: 4,
                  }}
                />
              </View>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>
                {pace(split.seconds, "km")} /km
              </Text>
            </View>
          ))
        ) : (
          <Copy muted>Complete a kilometer to see your splits.</Copy>
        )}
      </TrainingPanel>
      <Card>
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
        />
        <Button
          title="Save changes"
          disabled={action.busy || !title.trim()}
          onPress={() =>
            void action.run(
              () =>
                mutateWorkout(w.id, (current) => ({
                  ...current,
                  title: title.trim(),
                  description,
                  syncedAt: undefined,
                })),
              "Changes saved locally. Sync to update your cloud copy.",
            )
          }
        />
        <Copy>Visibility</Copy>
        <Row>
          {(["private", "followers", "public"] as Visibility[]).map((v) => (
            <Button
              key={v}
              title={v}
              secondary={w.visibility !== v}
              onPress={() =>
                void action.run(() =>
                  mutateWorkout(w.id, (x) => ({
                    ...x,
                    visibility: v,
                    syncedAt: undefined,
                  })),
                )
              }
            />
          ))}
        </Row>
        <Copy>Activity type</Copy>
        <Row>
          {(["running", "walking", "cycling", "hiking"] as Sport[]).map(
            (sport) => (
              <Button
                key={sport}
                title={sport}
                secondary={w.sport !== sport}
                onPress={() =>
                  void action.run(() =>
                    mutateWorkout(w.id, (x) => ({
                      ...x,
                      sport,
                      syncedAt: undefined,
                    })),
                  )
                }
              />
            ),
          )}
        </Row>
      </Card>
      <Button
        title="Export GPX"
        secondary
        onPress={() =>
          void action.run(() =>
            shareFile(`${w.id}.gpx`, gpx(w), "application/gpx+xml"),
          )
        }
      />
      <Copy muted>
        GPX includes the complete private route. Share only with people you
        trust.
      </Copy>
      {!w.ownerId && session ? (
        <Button
          secondary
          title="Link this local activity to my account"
          onPress={() =>
            void action.run(
              () =>
                mutateWorkout(w.id, (x) => ({
                  ...x,
                  ownerId: session.user.id,
                  syncedAt: undefined,
                })),
              "Linked. Use Profile → Sync to upload.",
            )
          }
        />
      ) : null}
      <Button
        title="Delete activity"
        secondary
        onPress={() =>
          Alert.alert(
            "Delete activity?",
            "This removes the local activity and its synced copy if one exists.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () =>
                  void action.run(async () => {
                    if (w.ownerId) {
                      if (session?.user.id !== w.ownerId)
                        throw new Error(
                          "Sign in as the activity owner before deleting a linked workout.",
                        );
                      await setValue(`deleted-owner:${w.id}`, w.ownerId);
                      await setValue(`deleted:${w.id}`, true);
                      try {
                        const result = await backend()
                          .from("activities")
                          .delete()
                          .eq("id", w.id);
                        if (result.error) throw result.error;
                      } catch (e) {
                        await setValue(`deleted:${w.id}`, null);
                        throw e;
                      }
                    }
                    await deleteWorkout(w.id);
                    await useApp.getState().refresh();
                    router.back();
                  }),
              },
            ],
          )
        }
      />
      {action.message ? <Copy>{action.message}</Copy> : null}
    </AthletePage>
  );
}

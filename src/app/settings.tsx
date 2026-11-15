import { useState } from "react";
import { canAccessLocalWorkout } from "../../features/auth/local-access";
import { signOutAccount } from "../../services/auth";
import { Linking, Switch } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Heading,
  Card,
  Copy,
  Button,
  Row,
  Field,
} from "../../components/ui";
import { useApp } from "../../store/app";
import { useAction } from "../../hooks/useAction";
import { shareFile } from "../../services/export";
import { backend } from "../../services/supabase";
import { useSession } from "../../hooks/useSession";
import { logoutPurchases } from "../../services/purchases";
import { setValue } from "../../services/database";
export default function Settings() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { preferences: p, configure, workouts } = useApp(),
    a = useAction(),
    session = useSession();
  return (
    <Screen>
      <Heading eyebrow="Make it yours">Settings & privacy</Heading>
      {session ? (
        <Button
          secondary
          title="Stop automatic cloud sync"
          onPress={() =>
            void a.run(
              () => setValue(`sync-enabled:${session.user.id}`, false),
              "Automatic sync disabled. A request already in flight may still finish.",
            )
          }
        />
      ) : null}
      <Card>
        <Copy>Appearance</Copy>
        <Row>
          {(["dark", "light"] as const).map((theme) => (
            <Button
              key={theme}
              title={theme}
              secondary={p.theme !== theme}
              onPress={() => void a.run(() => configure({ theme }))}
            />
          ))}
        </Row>
        <Copy>Distance units</Copy>
        <Row>
          {(["km", "mi"] as const).map((units) => (
            <Button
              key={units}
              title={units}
              secondary={p.units !== units}
              onPress={() => void a.run(() => configure({ units }))}
            />
          ))}
        </Row>
        <Field
          label="Weekly goal (kilometers)"
          value={String(p.weeklyGoalKm)}
          keyboardType="numeric"
          onChangeText={(text) => {
            const n = Number(text);
            if (n > 0 && n <= 1000)
              void a.run(() => configure({ weeklyGoalKm: n }));
          }}
        />
        <Copy>Recording settings</Copy>
        <Copy muted>
          Defaults for new recordings, including visibility and auto-pause.
        </Copy>
        <Copy>New activity visibility</Copy>
        <Row>
          {(["private", "followers", "public"] as const).map(
            (defaultVisibility) => (
              <Button
                key={defaultVisibility}
                title={defaultVisibility}
                secondary={p.defaultVisibility !== defaultVisibility}
                onPress={() =>
                  void a.run(() => configure({ defaultVisibility }))
                }
              />
            ),
          )}
        </Row>
        <Row>
          <Copy>Auto-pause (GPS speed)</Copy>
          <Switch
            accessibilityLabel="Auto pause"
            value={p.autoPause}
            onValueChange={(autoPause) =>
              void a.run(() => configure({ autoPause }))
            }
          />
        </Row>
        <Copy muted>
          Auto-pause uses reliable GPS speed after 15 stationary seconds. It is
          experimental and needs outdoor validation.
        </Copy>
      </Card>
      <Button
        secondary
        title="Location permissions"
        onPress={() => void Linking.openSettings()}
      />
      <Button
        secondary
        title="Privacy zones"
        onPress={() => router.push("/privacy-zones")}
      />
      <Button
        secondary
        title="Export local data (JSON)"
        onPress={() =>
          void a.run(() =>
            shareFile(
              "stravakinda-export.json",
              JSON.stringify(
                {
                  workouts: workouts.filter((w) =>
                    canAccessLocalWorkout(w, session?.user.id),
                  ),
                  preferences: p,
                },
                null,
                2,
              ),
              "application/json",
            ),
          )
        }
      />
      <Copy muted>
        Export contains complete GPS tracks. Cloud social/account export is not
        yet implemented.
      </Copy>
      <Button
        secondary
        title="Manage subscription"
        onPress={() => router.push("/subscription")}
      />
      <Card>
        <Copy>About StravaKinda · 1.0.0</Copy>
        <Copy muted>
          Independent fitness journal. Not affiliated with Strava. Help: consult
          docs/SETUP.md. Privacy policy and Terms are draft placeholders
          requiring legal review before release. In-app notifications use your
          account. Optional mobile push requires a configured development build.
        </Copy>
      </Card>
      {session ? (
        <>
          <Button
            secondary
            title="Delete cloud account"
            disabled={a.busy}
            onPress={() => setConfirmDelete(true)}
          />
          {confirmDelete ? (
            <Card>
              <Copy>Delete cloud account permanently?</Copy>
              <Copy muted>
                Your cloud profile, activities and notifications will be
                deleted. Local data is retained without reassignment. Export
                accessible local activities first; old account-bound records
                remain private. Store subscriptions must be cancelled
                separately.
              </Copy>
              <Button
                title="Confirm account deletion"
                disabled={a.busy}
                onPress={() =>
                  void a.run(async () => {
                    const result =
                      await backend().functions.invoke("delete-account");
                    if (result.error) throw result.error;
                    const signedOut = await signOutAccount();
                    if (signedOut.error) throw signedOut.error;
                    await logoutPurchases().catch(() => undefined);
                    setConfirmDelete(false);
                  }, "Cloud account deleted. Local data has not been reassigned.")
                }
              />
              <Button
                secondary
                title="Keep my account"
                disabled={a.busy}
                onPress={() => setConfirmDelete(false)}
              />
            </Card>
          ) : null}
        </>
      ) : null}
      {a.message ? <Copy>{a.message}</Copy> : null}
    </Screen>
  );
}

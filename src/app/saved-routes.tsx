import { router } from "expo-router";
import { Button, Card, Copy, Screen } from "../../components/ui";
import { SavedRouteOpen } from "../../components/SavedRouteOpen";
import { routeGuideParam } from "../../features/routes/guide";
import { useAction } from "../../hooks/useAction";
import { routeStatus, useRouteLibrary } from "../../hooks/useRouteLibrary";
import { retryRouteSync, useRouteSyncStatus } from "../../hooks/useRouteSync";
import { useSession } from "../../hooks/useSession";
import { deletePlan } from "../../services/planned-routes";
import {
  acceptCloudVersion,
  notifyRouteLibrary,
  queueAccountRoute,
} from "../../services/route-cloud";

export default function SavedRoutes() {
  const userId = useSession()?.user.id;
  return <SavedRouteLibrary key={userId ?? "local"} signedIn={!!userId} />;
}

function SavedRouteLibrary({ signedIn }: { signedIn: boolean }) {
  const { plans, settled, warning } = useRouteLibrary();
  const { syncing, error } = useRouteSyncStatus();
  const action = useAction();
  return (
    <Screen compact>
      {warning ? <Copy>{warning}</Copy> : null}
      {syncing || error ? (
        <Copy>{syncing ? "Syncing routes…" : error}</Copy>
      ) : null}
      {action.message ? <Copy>{action.message}</Copy> : null}
      {!settled ? <Copy>Loading saved routes…</Copy> : null}
      {settled && !plans.length && !warning ? (
        <Card>
          <Copy>No saved routes yet.</Copy>
          <Button title="New route" onPress={() => router.push("/routes")} />
        </Card>
      ) : null}
      {plans.map((route) => (
        <Card key={routeGuideParam(route)}>
          <SavedRouteOpen
            route={route}
            onEdit={() =>
              router.push({
                pathname: "/routes",
                params: { edit: routeGuideParam(route) },
              })
            }
          />
          <Copy muted>
            {(route.distanceMeters / 1000).toFixed(2)} km · Straight-line plan
          </Copy>
          <Copy muted>{routeStatus(route)}</Copy>
          {route.syncStatus === "conflict" && route.accountId ? (
            <Button
              secondary
              disabled={action.busy}
              title="Use cloud version (discard local conflict)"
              onPress={() =>
                void action.run(() =>
                  acceptCloudVersion(
                    route.accountId!,
                    route.id,
                    route.localMutation!,
                  ),
                )
              }
            />
          ) : null}
          <Button
            secondary
            disabled={action.busy}
            title="Delete saved route"
            onPress={() =>
              void action.run(async () => {
                if (route.accountId)
                  await queueAccountRoute(
                    route.accountId,
                    route,
                    true,
                    route.localMutation,
                  );
                else {
                  await deletePlan(route.id);
                  notifyRouteLibrary();
                }
              })
            }
          />
        </Card>
      ))}
      {signedIn ? (
        <Button secondary title="Retry Sync" onPress={retryRouteSync} />
      ) : null}
    </Screen>
  );
}

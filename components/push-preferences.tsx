import { useState } from "react";
import { Platform } from "react-native";
import { TrainingPanel } from "./athlete-training";
import { DiscoveryTitle } from "./discovery-ui";
import { AthleteText as Text } from "./athlete";
import { useColors } from "./ui";
import { CommunityAction } from "./community-ui";
import { useSession } from "../hooks/useSession";
import { disablePush, pushAvailable, registerPush } from "../services/push";
export function PushPreferences() {
  const c = useColors(),
    session = useSession(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <TrainingPanel>
      <DiscoveryTitle
        title="A nudge for your next adventure"
        detail="Optional mobile notifications"
      />
      <Text style={{ fontSize: 12, lineHeight: 21, color: c.muted }}>
        {Platform.OS === "web"
          ? "Mobile push requires a configured Android or iOS development build."
          : pushAvailable
            ? "Permission is optional; your in-app inbox always works."
            : "Push requires Expo Notifications installation and development-build configuration."}
      </Text>
      <CommunityAction
        title="Enable mobile push"
        disabled={!pushAvailable || busy || !session}
        onPress={async () => {
          if (!session) return;
          setBusy(true);
          try {
            await registerPush(session.user.id, true);
            setMessage(
              "Device registered. Remote delivery requires configured server credentials.",
            );
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {pushAvailable ? (
        <CommunityAction
          title="Disable push on this device"
          secondary
          disabled={busy}
          onPress={async () => {
            if (!session) return;
            setBusy(true);
            try {
              await disablePush(session.user.id);
              setMessage("Push disabled on this device.");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
      {message ? (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: 12, lineHeight: 21, color: c.muted }}
        >
          {message}
        </Text>
      ) : null}
    </TrainingPanel>
  );
}

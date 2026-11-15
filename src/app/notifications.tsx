import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AthletePage, AthleteText as Text } from "../../components/athlete";
import {
  DashboardHeader,
  DashboardNotice,
} from "../../components/dashboard-ui";
import { TrainingPanel } from "../../components/athlete-training";
import { CommunityAction } from "../../components/community-ui";
import { useColors } from "../../components/ui";
import { useSession } from "../../hooks/useSession";
import { useInboxStore } from "../../store/inbox";
import { markNotificationRead } from "../../services/notifications";
import { PushPreferences } from "../../components/push-preferences";
export default function Notifications() {
  const c = useColors(),
    session = useSession(),
    inbox = useInboxStore(),
    [error, setError] = useState(""),
    [pending, setPending] = useState("");
  const current = !!session && inbox.owner === session.user.id;
  return (
    <AthletePage>
      <DashboardHeader
        title="Your notifications"
        subtitle="A little encouragement for the journey."
      />
      {!session ? (
        <TrainingPanel>
          <Text style={{ fontSize: 20, fontWeight: "700", color: c.text }}>
            Your next chapter is waiting.
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 21, color: c.muted }}>
            Sign in to see your private account updates.
          </Text>
          <CommunityAction
            title="Sign in to view notifications"
            onPress={() => router.push("/auth")}
          />
        </TrainingPanel>
      ) : (
        <>
          <Text style={{ fontSize: 12, color: c.muted }}>
            {current ? inbox.unreadCount : 0} unread ·{" "}
            {current && inbox.realtime
              ? "Live updates connected"
              : "Updates refresh on reconnect"}
          </Text>
          {current && inbox.loading ? (
            <ActivityIndicator color={c.forest} />
          ) : null}
          {current && inbox.error ? (
            <DashboardNotice
              title="Connection interrupted"
              detail={inbox.error}
            />
          ) : null}
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: c.accent, fontSize: 12 }}
            >
              {error}
            </Text>
          ) : null}
          {current
            ? inbox.items.map((item) => (
                <TrainingPanel key={item.id}>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: c.greenSoft,
                        padding: 12,
                        borderRadius: 12,
                      }}
                    >
                      <Ionicons
                        name={
                          item.kind === "welcome"
                            ? "trail-sign-outline"
                            : "notifications-outline"
                        }
                        color={c.forest}
                        size={25}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text
                        accessibilityRole="header"
                        style={{
                          color: c.text,
                          fontSize: 17,
                          fontWeight: "700",
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text style={{ color: c.muted, fontSize: 11 }}>
                        {new Date(item.created_at).toLocaleDateString()} ·{" "}
                        {item.read_at ? "Read" : "Unread"}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{ color: c.muted, fontSize: 13, lineHeight: 22 }}
                  >
                    {item.body}
                  </Text>
                  {!item.read_at ? (
                    <CommunityAction
                      title="Mark as read"
                      secondary
                      disabled={!!pending}
                      onPress={async () => {
                        setPending(item.id);
                        setError("");
                        try {
                          await markNotificationRead(session.user.id, item.id);
                          await inbox.refresh();
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setPending("");
                        }
                      }}
                    />
                  ) : null}
                </TrainingPanel>
              ))
            : null}
          {current &&
          !inbox.loading &&
          !inbox.error &&
          inbox.items.length === 0 ? (
            <TrainingPanel>
              <Ionicons
                name="notifications-off-outline"
                color={c.forest}
                size={35}
              />
              <Text style={{ fontSize: 20, fontWeight: "700", color: c.text }}>
                All quiet on the trail.
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 22, color: c.muted }}>
                Your account updates will appear here. A welcome is created only
                for genuinely new accounts.
              </Text>
            </TrainingPanel>
          ) : null}
          {current && inbox.hasMore ? (
            <CommunityAction
              title="Load older notifications"
              secondary
              disabled={inbox.loading}
              onPress={() => void inbox.more()}
            />
          ) : null}
          <CommunityAction
            secondary
            title="Refresh notifications"
            onPress={() => void inbox.refresh()}
          />
          <PushPreferences />
        </>
      )}
    </AthletePage>
  );
}

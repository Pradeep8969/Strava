import { View } from "react-native";
import { router } from "expo-router";
import { IconButton, AthleteText as Text } from "./athlete";
import { useColors } from "./ui";
import { useSession } from "../hooks/useSession";
import { useInboxStore } from "../store/inbox";
export function NotificationBell() {
  const session = useSession(),
    c = useColors(),
    inbox = useInboxStore();
  if (!session) return null;
  const count = inbox.owner === session.user.id ? inbox.unreadCount : 0;
  return (
    <View>
      <IconButton
        icon="notifications-outline"
        label={`Notifications, ${count} unread`}
        onPress={() => router.push("/notifications")}
      />
      {count > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -2,
            top: -3,
            minWidth: 19,
            height: 19,
            borderRadius: 10,
            backgroundColor: c.accent,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "700", color: c.onAccent }}>
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

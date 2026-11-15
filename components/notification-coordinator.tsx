import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { router } from "expo-router";
import { listenPush, registerPush } from "../services/push";
import { useSession } from "../hooks/useSession";
import { backend } from "../services/supabase";
import { fetchInbox } from "../services/notifications";
import { useInboxStore } from "../store/inbox";
export function NotificationCoordinator() {
  const session = useSession(),
    owner = session?.user.id;
  useEffect(() => {
    let active = true,
      running = false,
      again = false,
      limit = 50;
    useInboxStore.setState({
      owner: owner ?? null,
      items: [],
      unreadCount: 0,
      hasMore: false,
      error: "",
      loading: !!owner,
      realtime: false,
      limit,
    });
    if (!owner) return;
    const refresh = async () => {
      if (!active) return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        const result = await fetchInbox(owner, limit);
        if (active)
          useInboxStore.setState({ ...result, error: "", loading: false });
      } catch {
        if (active)
          useInboxStore.setState({
            error:
              "Notifications are unavailable. Reconnect or retry; your messages remain on the server.",
            loading: false,
          });
      } finally {
        running = false;
        if (again && active) {
          again = false;
          void refresh();
        }
      }
    };
    const more = async () => {
      limit += 50;
      useInboxStore.setState({ limit, loading: true });
      await refresh();
    };
    useInboxStore.setState({ refresh, more });
    void refresh();
    const retryPush = () => {
      void registerPush(owner).catch(() => undefined);
    };
    retryPush();
    const stopPush = listenPush(
      owner,
      () => router.push("/notifications"),
      () => void refresh(),
    );
    const client = backend();
    let channel: ReturnType<typeof client.channel> | undefined;
    try {
      channel = client
        .channel(`inbox:${owner}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${owner}`,
          },
          () => void refresh(),
        )
        .subscribe((status) => {
          if (!active) return;
          useInboxStore.setState({ realtime: status === "SUBSCRIBED" });
          if (status === "SUBSCRIBED") void refresh();
        });
    } catch {
      /* Polling and explicit retry remain available if Realtime isn't configured. */
    }
    const timer = setInterval(() => {
      if (AppState.currentState === "active") {
        void refresh();
        retryPush();
      }
    }, 60000);
    const focus = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
        retryPush();
      }
    });
    const online = () => void refresh();
    if (Platform.OS === "web") window.addEventListener("online", online);
    return () => {
      active = false;
      stopPush();
      clearInterval(timer);
      focus.remove();
      if (Platform.OS === "web") window.removeEventListener("online", online);
      if (channel) void client.removeChannel(channel);
      useInboxStore.setState({
        owner: null,
        items: [],
        unreadCount: 0,
        hasMore: false,
        loading: false,
        error: "",
        realtime: false,
        refresh: async () => {},
        more: async () => {},
      });
    };
  }, [owner]);
  return null;
}

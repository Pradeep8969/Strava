import { backend } from "./supabase";
export type InboxNotification = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};
export async function fetchInbox(userId: string, limit = 50) {
  const client = backend();
  const [recent, unread] = await Promise.all([
    client
      .from("notifications")
      .select("id,user_id,kind,title,body,created_at,read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    client
      .from("notifications")
      .select("id,user_id,kind,title,body,created_at,read_at", {
        count: "exact",
      })
      .eq("user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  if (recent.error || unread.error)
    throw new Error(
      "Notifications could not be loaded. Check your connection and try again.",
    );
  const rows = [
    ...(recent.data ?? []),
    ...(unread.data ?? []),
  ] as InboxNotification[];
  const items = Array.from(
    new Map(
      rows.filter((row) => row.user_id === userId).map((row) => [row.id, row]),
    ).values(),
  ).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    items,
    unreadCount: unread.count ?? 0,
    hasMore:
      (recent.data?.length ?? 0) >= limit ||
      (unread.data?.length ?? 0) >= limit,
  };
}
export async function markNotificationRead(userId: string, id: string) {
  const { error } = await backend()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);
  if (error)
    throw new Error("Could not mark this notification as read. Please retry.");
}

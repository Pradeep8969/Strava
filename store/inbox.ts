import { create } from "zustand";
import type { InboxNotification } from "../services/notifications";
type InboxState = {
  owner: string | null;
  items: InboxNotification[];
  unreadCount: number;
  hasMore: boolean;
  loading: boolean;
  error: string;
  realtime: boolean;
  limit: number;
  refresh: () => Promise<void>;
  more: () => Promise<void>;
};
export const useInboxStore = create<InboxState>(() => ({
  owner: null,
  items: [],
  unreadCount: 0,
  hasMore: false,
  loading: false,
  error: "",
  realtime: false,
  limit: 50,
  refresh: async () => {},
  more: async () => {},
}));

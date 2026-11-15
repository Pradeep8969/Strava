import { useQuery } from "@tanstack/react-query";
import { backend, supabase } from "../services/supabase";
export type FeedPost = {
  id: string;
  title: string;
  sport: string;
  distance_m: number;
  started_at: string;
};

/** Select summaries only. Supabase RLS remains the visibility boundary. */
export function useFeed(userId?: string, scope: "all" | "following" = "all") {
  return useQuery({
    queryKey: ["feed", userId, scope],
    enabled: !!supabase && !!userId,
    queryFn: async () => {
      let ids: string[] = [];
      if (scope === "following") {
        const follows = await backend()
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId!);
        if (follows.error) throw follows.error;
        ids = (follows.data ?? []).map((follow) => follow.following_id);
        if (!ids.length) return [] as FeedPost[];
      }
      let query = backend()
        .from("activities")
        .select("id,title,sport,distance_m,started_at");
      if (scope === "following") query = query.in("user_id", ids);
      const result = await query
        .order("started_at", { ascending: false })
        .limit(30);
      if (result.error) throw result.error;
      return result.data as FeedPost[];
    },
  });
}

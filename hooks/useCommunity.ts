import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { supabase } from "../services/supabase";
import { loadCommunity } from "../features/community/data";

export function useCommunity(userId?: string) {
  const query = useQuery({
    queryKey: ["community", userId],
    enabled: !!supabase && !!userId,
    queryFn: () => loadCommunity(userId!),
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (userId) void refetch();
    }, [userId, refetch]),
  );
  return query;
}
export function useRefreshCommunity() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["community"] }),
      client.invalidateQueries({ queryKey: ["community-club"] }),
      client.invalidateQueries({ queryKey: ["athlete-memberships"] }),
    ]);
  };
}

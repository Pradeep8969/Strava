import { queryOptions } from "@tanstack/react-query";
import { loadProfileDetails } from "./profile-details";

export const profileDetailsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["athlete-details", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: () => loadProfileDetails(userId!),
  });

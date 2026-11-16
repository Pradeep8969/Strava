import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "./useSession";
import { loadAthleteProfile } from "../services/profile";
import { resumeGoogleProfileSync } from "../services/google-profile-sync";
import { backend } from "../services/supabase";
import { avatarUrl } from "../features/athlete/profile";
import { athleteIdentity } from "../features/athlete/identity";
import { athleteAvatarSources } from "../features/athlete/avatar";
import { useState } from "react";

export function useCurrentAthlete() {
  const { session, loading: authLoading } = useAuthSession();
  const userId = session?.user.id;
  const profile = useQuery({
    queryKey: ["athlete-profile", userId],
    enabled: !!userId,
    staleTime: 30000,
    queryFn: async () => {
      await resumeGoogleProfileSync(userId!);
      return loadAthleteProfile(userId!);
    },
  });
  const data = userId && profile.data?.id === userId ? profile.data : undefined;
  const [failedAvatars, setFailedAvatars] = useState<string[]>([]);
  const sources = athleteAvatarSources(session?.user, data);
  const avatarPath = sources.find(
    (source) => !failedAvatars.includes(`${userId}:${source}`),
  );
  const avatar = useQuery({
    queryKey: ["athlete-avatar", userId, avatarPath],
    enabled: !!userId && !!avatarPath,
    staleTime: 600000,
    queryFn: async () => {
      const external = avatarUrl(avatarPath);
      if (external) return external;
      const result = await backend()
        .storage.from("avatars")
        .createSignedUrl(avatarPath!, 1800);
      if (result.error) {
        const fallback = sources.find((source) => avatarUrl(source));
        if (fallback) return fallback;
        throw result.error;
      }
      return result.data.signedUrl;
    },
  });
  const isLoading = authLoading || (!!userId && profile.isPending);
  return {
    session,
    userId,
    isAuthenticated: !!userId,
    authLoading,
    isLoading,
    ...athleteIdentity(userId, data, isLoading),
    avatarUrl: userId && avatarPath ? (avatar.data ?? null) : null,
    onAvatarError: () => {
      if (avatarPath)
        setFailedAvatars((failed) => [...failed, `${userId}:${avatarPath}`]);
    },
    profile,
    avatar,
    data,
  };
}

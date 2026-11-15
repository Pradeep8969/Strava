import { useState } from "react";
import { Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AthletePage } from "../../../components/athlete";
import { Button, Copy, Heading, Loading } from "../../../components/ui";
import { backend } from "../../../services/supabase";
import { useSession } from "../../../hooks/useSession";
import { avatarUrl } from "../../../features/athlete/profile";
export default function SharedAthlete() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const [failed, setFailed] = useState(false);
  const profile = useQuery({
    queryKey: ["shared-athlete", session?.user.id, id],
    enabled: !!session && typeof id === "string",
    queryFn: async () => {
      const result = await backend()
        .from("profiles")
        .select("id,name,bio,avatar_path")
        .eq("id", id)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  return (
    <AthletePage>
      {!session ? (
        <>
          <Heading>Meet the athlete</Heading>
          <Copy>Sign in to view profiles. Private profiles stay private.</Copy>
          <Button title="Sign in" onPress={() => router.push("/auth")} />
        </>
      ) : profile.isPending ? (
        <Loading />
      ) : profile.error || !profile.data ? (
        <>
          <Heading>Profile unavailable</Heading>
          <Copy>This profile may be private or unavailable.</Copy>
        </>
      ) : (
        <>
          {avatarUrl(profile.data.avatar_path) && !failed ? (
            <Image
              source={{ uri: profile.data.avatar_path }}
              accessibilityLabel="Athlete profile picture"
              style={{ width: 88, height: 88, borderRadius: 44 }}
              onError={() => setFailed(true)}
            />
          ) : null}
          <Heading>{profile.data.name || "Athlete"}</Heading>
          <Copy>{profile.data.bio}</Copy>
        </>
      )}
    </AthletePage>
  );
}

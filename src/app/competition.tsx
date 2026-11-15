import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AthletePage, AthleteText as Text } from "../../components/athlete";
import { DiscoveryTitle } from "../../components/discovery-ui";
import {
  TrainingPanel,
  sportIcons,
  sportNames,
} from "../../components/athlete-training";
import {
  CommunityHeader,
  CommunityHero,
  CommunityFilters,
  CommunityEmpty,
  CommunityError,
} from "../../components/community-ui";
import { useColors, Loading } from "../../components/ui";
import { useSession } from "../../hooks/useSession";
import { backend } from "../../services/supabase";
import type { Sport } from "../../types/activity";

export default function Competition() {
  const c = useColors(),
    session = useSession();
  const [tab, setTab] = useState("Overview");
  const query = useQuery({
    queryKey: ["community-segments", session?.user.id],
    enabled: !!session && tab === "Your segments",
    queryFn: async () => {
      const result = await backend()
        .from("segments")
        .select("id,title,sport")
        .eq("creator_id", session!.user.id)
        .limit(30);
      if (result.error) throw result.error;
      return result.data as { id: string; title: string; sport: Sport }[];
    },
  });
  return (
    <AthletePage>
      <CommunityHeader
        title="Segments & leaderboards"
        detail="A fair starting line."
      />
      <CommunityHero
        title="Chase your own horizon."
        subtitle="Competition preview · verified public rankings are planned."
        compact
      />
      <CommunityFilters
        items={["Overview", "Your segments"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Overview" ? (
        <TrainingPanel>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Ionicons name="podium-outline" size={30} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 10, letterSpacing: 1 }}>
              PLANNED
            </Text>
          </View>
          <DiscoveryTitle
            title="Earned on the trail."
            detail="Verified efforts. Fair comparisons."
          />
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>
            Public rankings need a reviewed results service. Your recordings are
            never turned into invented positions or segment attempts.
          </Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                padding: 13,
                gap: 12,
                backgroundColor: c.raised,
              }}
            >
              <Text style={{ color: c.muted, fontSize: 10, width: 30 }}>
                Rank
              </Text>
              <Text style={{ color: c.muted, fontSize: 10, flex: 1 }}>
                Athlete
              </Text>
              <Text style={{ color: c.muted, fontSize: 10 }}>
                Verified time
              </Text>
            </View>
            <View style={{ padding: 22, gap: 10, alignItems: "center" }}>
              <Ionicons
                name="shield-checkmark-outline"
                size={26}
                color={c.forest}
              />
              <Text
                style={{ color: c.muted, fontSize: 12, textAlign: "center" }}
              >
                No verified public rankings available
              </Text>
            </View>
          </View>
          <View style={{ gap: 14 }}>
            {[
              "Verified segment timing",
              "Privacy-safe route comparisons",
              "Community leaderboards",
            ].map((title) => (
              <View
                key={title}
                style={{ flexDirection: "row", gap: 9, alignItems: "center" }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={15}
                  color={c.muted}
                />
                <Text style={{ color: c.muted, fontSize: 12 }}>{title}</Text>
              </View>
            ))}
          </View>
        </TrainingPanel>
      ) : !session ? (
        <CommunityEmpty
          title="Your segments, kept private"
          detail="Sign in to view your own segment definitions. Public rankings are not available."
          signIn
        />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <CommunityError
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : query.data?.length ? (
        query.data.map((segment) => (
          <TrainingPanel key={segment.id}>
            <View
              style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
            >
              <Ionicons
                name={sportIcons[segment.sport]}
                color={c.forest}
                size={25}
              />
              <DiscoveryTitle
                title={segment.title}
                detail={`${sportNames[segment.sport]} · your private segment definition`}
              />
            </View>
            <Text style={{ color: c.muted, fontSize: 11 }}>
              No public ranking or verified attempt is attached.
            </Text>
          </TrainingPanel>
        ))
      ) : (
        <CommunityEmpty
          title="No private segments yet"
          detail="Your own saved segment definitions will appear here. No routes or efforts are generated for you."
          icon="trail-sign-outline"
        />
      )}
    </AthletePage>
  );
}

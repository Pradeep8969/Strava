import { useCallback, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AthletePage, AthleteText as Text } from "../../../components/athlete";
import { DiscoveryTitle } from "../../../components/discovery-ui";
import { TrainingPanel } from "../../../components/athlete-training";
import { Loading, useColors } from "../../../components/ui";
import {
  CommunityHeader,
  CommunityHero,
  CommunityFilters,
  CommunityAction,
  CommunityEmpty,
  CommunityError,
  ChallengeCard,
  MembershipAction,
  CompetitionPreview,
} from "../../../components/community-ui";
import { backend } from "../../../services/supabase";
import { useSession } from "../../../hooks/useSession";
import {
  challengeFields,
  type Challenge,
  type Club,
  type Entry,
} from "../../../features/community/data";

export default function ClubDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  return (
    <ClubContent
      key={`${id}-${session?.user.id ?? "guest"}`}
      id={id}
      userId={session?.user.id}
    />
  );
}
function ClubContent({ id, userId }: { id: string; userId?: string }) {
  const c = useColors(),
    wide = useWindowDimensions().width >= 1100;
  const [tab, setTab] = useState("Overview");
  const query = useQuery({
    queryKey: ["community-club", userId, id],
    enabled: !!userId && !!id,
    queryFn: async () => {
      const [club, membership, entries] = await Promise.all([
        backend()
          .from("clubs")
          .select("id,name,description")
          .eq("id", id)
          .maybeSingle(),
        backend()
          .from("club_members")
          .select("club_id,joined_at")
          .eq("club_id", id)
          .eq("user_id", userId!)
          .maybeSingle(),
        backend()
          .from("challenge_entries")
          .select("challenge_id,joined_at")
          .eq("user_id", userId!),
      ]);
      for (const result of [club, membership, entries])
        if (result.error) throw result.error;
      let challenges: Challenge[] = [];
      if (membership.data) {
        const result = await backend()
          .from("challenges")
          .select(challengeFields)
          .eq("club_id", id)
          .gt("ends_at", new Date().toISOString())
          .order("ends_at")
          .limit(20);
        if (result.error) throw result.error;
        challenges = result.data ?? [];
      }
      return {
        club: club.data as Club | null,
        member: !!membership.data,
        challenges,
        entries: (entries.data ?? []) as Entry[],
      };
    },
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (userId) void refetch();
    }, [userId, refetch]),
  );
  const data = userId ? query.data : undefined;
  return (
    <AthletePage>
      <CommunityHeader
        title="Club community"
        detail="A shared reason to get outside."
      />
      {!userId ? (
        <CommunityEmpty
          title="Sign in to explore this club"
          detail="Club details and membership use your account permissions."
          signIn
        />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <CommunityError
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : !data?.club ? (
        <>
          <CommunityEmpty
            title="Club unavailable"
            detail="This club may have been removed or is unavailable to your account."
          />
          <CommunityAction
            title="Back to clubs"
            onPress={() => router.replace("/community")}
          />
        </>
      ) : (
        <>
          <CommunityHero
            title={data.club.name}
            subtitle={
              data.member
                ? "Your club · Nepal-inspired editorial cover"
                : "Find your rhythm with a community."
            }
            kind="ridge"
          />
          <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
            <View
              style={{ flex: wide ? 1.6 : undefined, minWidth: 0, gap: 18 }}
            >
              <TrainingPanel>
                <DiscoveryTitle
                  title="About this club"
                  detail={data.member ? "You are a member" : "Club community"}
                />
                <Text style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>
                  {data.club.description || "A community for shared movement."}
                </Text>
                <MembershipAction
                  kind="club_members"
                  id={id}
                  userId={userId}
                  joined={data.member}
                />
              </TrainingPanel>
              <CommunityFilters
                items={["Overview", "Feed", "Challenges", "Events", "Members"]}
                value={tab}
                onChange={setTab}
              />
              {tab === "Overview" ? (
                <TrainingPanel>
                  <DiscoveryTitle title="Go further, together." />
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}
                  >
                    Discover this club’s available challenges and manage your
                    membership here.
                  </Text>
                  <CommunityAction
                    secondary
                    title="Open club challenges"
                    onPress={() => setTab("Challenges")}
                  />
                </TrainingPanel>
              ) : tab === "Challenges" ? (
                data.member ? (
                  data.challenges.length ? (
                    data.challenges.map((challenge) => (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        entry={data.entries.find(
                          (e) => e.challenge_id === challenge.id,
                        )}
                        userId={userId}
                      />
                    ))
                  ) : (
                    <CommunityEmpty
                      title="No open club challenges"
                      detail="New challenges will appear here when this club publishes them."
                      icon="trophy-outline"
                    />
                  )
                ) : (
                  <CommunityEmpty
                    title="A goal to share"
                    detail="Join this club to access its available challenges."
                    icon="lock-closed-outline"
                  />
                )
              ) : tab === "Feed" ? (
                <TrainingPanel>
                  <DiscoveryTitle title="Club activity feed" detail="PLANNED" />
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}
                  >
                    A club-specific feed needs a privacy-safe membership
                    service. You can explore shared community activities now.
                  </Text>
                  <CommunityAction
                    secondary
                    title="Explore community feed"
                    onPress={() => router.push("/social")}
                  />
                </TrainingPanel>
              ) : tab === "Events" ? (
                <TrainingPanel>
                  <DiscoveryTitle title="Club events" detail="PLANNED" />
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}
                  >
                    Club event listings are not connected yet.
                  </Text>
                  <CommunityAction
                    secondary
                    title="Browse Nepal event demos"
                    onPress={() => router.push("/events")}
                  />
                </TrainingPanel>
              ) : (
                <TrainingPanel>
                  <DiscoveryTitle title="Club members" />
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}
                  >
                    Member directories and totals are private under the current
                    permissions.{" "}
                    {data.member
                      ? "Your membership is active."
                      : "You have not joined this club."}
                  </Text>
                </TrainingPanel>
              )}
            </View>
            <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 18 }}>
              <CompetitionPreview />
              <Text style={{ color: c.muted, fontSize: 10, lineHeight: 17 }}>
                Club location and banner uploads are not available in the
                current schema. No location or member total has been inferred.
              </Text>
            </View>
          </View>
        </>
      )}
    </AthletePage>
  );
}

import { useCallback, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { AthletePage, AthleteText as Text } from "../../components/athlete";
import { DiscoveryTitle } from "../../components/discovery-ui";
import { TrainingPanel } from "../../components/athlete-training";
import {
  CommunityAction,
  CommunityEmpty,
  CommunityError,
  CommunityFilters,
  CommunityHeader,
  CommunityHero,
  CommunityNavigation,
  CompetitionPreview,
} from "../../components/community-ui";
import SocialActivityCard from "../../components/SocialActivityCard";
import { Loading, useColors } from "../../components/ui";
import { useSession } from "../../hooks/useSession";
import { loadSocialFeed } from "../../features/community/data";

export default function Social() {
  const session = useSession();
  return (
    <SocialContent
      key={session?.user.id ?? "guest"}
      userId={session?.user.id}
    />
  );
}
function SocialContent({ userId }: { userId?: string }) {
  const c = useColors(),
    wide = useWindowDimensions().width >= 1100;
  const [scope, setScope] = useState("Community");
  const feed = useQuery({
    queryKey: ["community-social", userId, scope],
    enabled: !!userId,
    queryFn: () =>
      loadSocialFeed(
        userId!,
        scope === "Following" ? "following" : "community",
      ),
  });
  const { refetch } = feed;
  useFocusEffect(
    useCallback(() => {
      if (userId) void refetch();
    }, [userId, refetch]),
  );
  return (
    <AthletePage>
      <CommunityHeader
        title="Better together."
        detail="Shared miles. Shared motivation."
      />
      <CommunityNavigation active="Feed" />
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: wide ? 1.6 : undefined, minWidth: 0, gap: 15 }}>
          <CommunityHero
            title="Move together. Belong here."
            subtitle="Stories from Nepal’s active community."
            kind="lake"
            compact
          />
          <CommunityFilters
            items={["Community", "Following"]}
            value={scope}
            onChange={setScope}
          />
          {userId ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <DiscoveryTitle
                title={
                  scope === "Following"
                    ? "Your people, in motion"
                    : "From the community"
                }
              />
              <CommunityAction
                secondary
                title="Refresh feed"
                disabled={feed.isFetching}
                onPress={() => void feed.refetch()}
              />
            </View>
          ) : null}
          {!userId ? (
            <CommunityEmpty
              title="Your community is waiting"
              detail="Sign in to follow real athletes, share encouragement and find your people. GPS routes stay private."
              signIn
            />
          ) : feed.isPending ? (
            <Loading />
          ) : feed.error ? (
            <CommunityError
              message={`Could not load the feed. ${feed.error.message}`}
              onRetry={() => void feed.refetch()}
            />
          ) : feed.data?.length ? (
            feed.data.map((post) => (
              <SocialActivityCard key={post.id} post={post} userId={userId} />
            ))
          ) : (
            <CommunityEmpty
              title={
                scope === "Following" ? "Find your people." : "A quiet moment"
              }
              detail={
                scope === "Following"
                  ? "Follow athletes to see the activities they share with you."
                  : "Shared activities will appear here when available. Your story could be the first."
              }
            />
          )}
        </View>
        <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 18 }}>
          <TrainingPanel>
            <DiscoveryTitle title="A little encouragement goes far." />
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>
              Find athletes, give kudos and share the journey.
            </Text>
            <CommunityAction
              title={userId ? "Search for athletes" : "Find your community"}
              onPress={() => router.push(userId ? "/search" : "/auth")}
            />
            <CommunityAction
              secondary
              title="Explore clubs"
              onPress={() => router.replace("/community")}
            />
          </TrainingPanel>
          <CompetitionPreview />
          <Text style={{ color: c.muted, fontSize: 10, lineHeight: 17 }}>
            Only activity summaries are shared. GPS routes from your device are
            visible only to you. Activity photo sharing is not connected yet.
          </Text>
        </View>
      </View>
    </AthletePage>
  );
}

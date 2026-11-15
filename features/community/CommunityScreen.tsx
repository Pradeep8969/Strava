import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { AthletePage, AthleteText as Text } from "../../components/athlete";
import { DiscoverySearch, DiscoveryTitle } from "../../components/discovery-ui";
import { TrainingPanel } from "../../components/athlete-training";
import { Loading, useColors } from "../../components/ui";
import {
  ChallengeCard,
  ClubCard,
  CommunityAction,
  CommunityEmpty,
  CommunityError,
  CommunityFilters,
  CommunityHeader,
  CommunityHero,
  CommunityNavigation,
  CompetitionPreview,
} from "../../components/community-ui";
import { useSession } from "../../hooks/useSession";
import { useCommunity } from "../../hooks/useCommunity";

export function CommunityScreen({
  section = "Clubs",
}: {
  section?: "Clubs" | "Challenges";
}) {
  const session = useSession();
  return (
    <CommunityContent
      key={`${session?.user.id ?? "guest"}-${section}`}
      userId={session?.user.id}
      section={section}
    />
  );
}
function CommunityContent({
  userId,
  section,
}: {
  userId?: string;
  section: "Clubs" | "Challenges";
}) {
  const c = useColors(),
    wide = useWindowDimensions().width >= 1100;
  const query = useCommunity(userId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Discover");
  const data = userId ? query.data : undefined;
  const clubs = (data?.clubs ?? []).filter(
    (club) =>
      `${club.name} ${club.description}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (filter !== "My clubs" ||
        data?.memberships.some((m) => m.club_id === club.id)),
  );
  const challenges = (data?.challenges ?? []).filter(
    (challenge) =>
      challenge.title.toLowerCase().includes(search.trim().toLowerCase()) &&
      (filter !== "Joined" ||
        data?.entries.some((e) => e.challenge_id === challenge.id)),
  );
  return (
    <AthletePage>
      <CommunityHeader
        title={section === "Clubs" ? "Your community" : "Challenges"}
        detail="Good company. Shared adventures."
      />
      <CommunityNavigation active={section} />
      <CommunityHero
        title={
          section === "Clubs"
            ? "Find your people. Go further."
            : "A little further, together."
        }
        subtitle={
          section === "Clubs"
            ? "Local clubs. Shared miles. A more active Nepal."
            : "Set your sights on the next small win."
        }
        kind={section === "Clubs" ? "ridge" : "lake"}
      />
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: wide ? 1.7 : undefined, minWidth: 0, gap: 15 }}>
          <DiscoveryTitle
            title={
              section === "Clubs"
                ? "Discover clubs"
                : "Find your next challenge"
            }
            detail={
              section === "Clubs"
                ? "A place to belong, a reason to get outside."
                : "Distance goals for every kind of movement."
            }
          />
          {userId ? (
            <>
              <DiscoverySearch
                label={
                  section === "Clubs" ? "Search clubs" : "Search challenges"
                }
                placeholder={
                  section === "Clubs"
                    ? "Search communities"
                    : "Search distance challenges"
                }
                value={search}
                onChangeText={setSearch}
              />
              <CommunityFilters
                items={
                  section === "Clubs"
                    ? ["Discover", "My clubs"]
                    : ["Discover", "Joined"]
                }
                value={filter}
                onChange={setFilter}
              />
            </>
          ) : null}
          {!userId ? (
            <CommunityEmpty
              title="Connect to your community"
              detail="Sign in to discover real clubs and challenges. Your next adventure could start with good company."
              signIn
            />
          ) : query.isPending ? (
            <Loading />
          ) : query.error ? (
            <CommunityError
              message={`Could not load your community. ${query.error.message}`}
              onRetry={() => void query.refetch()}
            />
          ) : section === "Clubs" ? (
            clubs.length ? (
              clubs.map((club, i) => (
                <ClubCard
                  key={club.id}
                  club={club}
                  joined={
                    !!data?.memberships.some((m) => m.club_id === club.id)
                  }
                  userId={userId}
                  cover={i % 2 ? "lake" : "ridge"}
                />
              ))
            ) : (
              <CommunityEmpty
                title={
                  search
                    ? "No matching clubs"
                    : filter === "My clubs"
                      ? "Your next crew is out there."
                      : "Space for a new community"
                }
                detail={
                  search
                    ? "Try a different name or clear your search."
                    : "Clubs will appear here when available. No sample memberships are shown."
                }
              />
            )
          ) : challenges.length ? (
            challenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                entry={data?.entries.find(
                  (e) => e.challenge_id === challenge.id,
                )}
                userId={userId}
              />
            ))
          ) : (
            <CommunityEmpty
              icon="trophy-outline"
              title={
                search
                  ? "No matching challenges"
                  : filter === "Joined"
                    ? "Your next goal is waiting."
                    : "A fresh starting line"
              }
              detail={
                search
                  ? "Try another challenge name."
                  : "Open distance challenges will appear here when available."
              }
            />
          )}
        </View>
        <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 18 }}>
          <TrainingPanel>
            <DiscoveryTitle title="Your corner of Nepal" />
            <View style={{ flexDirection: "row", gap: 20 }}>
              {[
                [data ? String(data.memberships.length) : "—", "Your clubs"],
                [data ? String(data.entries.length) : "—", "Your challenges"],
              ].map(([number, label]) => (
                <View key={label} style={{ flex: 1, gap: 5 }}>
                  <Text
                    style={{ color: c.text, fontSize: 26, fontWeight: "700" }}
                  >
                    {number}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 11 }}>{label}</Text>
                </View>
              ))}
            </View>
            <CommunityAction
              secondary
              title={userId ? "Open athlete feed" : "Meet the community"}
              onPress={() => router.replace("/social")}
            />
          </TrainingPanel>
          <CompetitionPreview />
          <View style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: c.muted, fontSize: 10, lineHeight: 17 }}>
              Member and participant totals stay hidden until a privacy-safe
              counting service is available. Covers are Nepal-inspired editorial
              artwork.
            </Text>
          </View>
        </View>
      </View>
    </AthletePage>
  );
}

import { useCallback, useMemo, useState, type ComponentProps } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { AthleteText as Text, IconButton } from "./athlete";
import { discoveryPhotos, DiscoveryTitle } from "./discovery-ui";
import { TrainingPanel } from "./athlete-training";
import { useColors } from "./ui";
import { useAction } from "../hooks/useAction";
import { useRefreshCommunity } from "../hooks/useCommunity";
import {
  changeMembership,
  type Club,
  type Challenge,
  type Entry,
} from "../features/community/data";
import { challengeProgress } from "../features/community/progress";
import { useApp } from "../store/app";
import { length } from "../utils/format";

export function CommunityHeader({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  const c = useColors();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton
          icon="chevron-back"
          label="Back from community"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: c.text,
              fontSize: 24,
              fontWeight: "700",
              letterSpacing: -0.7,
            }}
          >
            {title}
          </Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{detail}</Text>
        </View>
        <IconButton
          icon="person-add-outline"
          label="Find athletes"
          onPress={() => router.push("/search")}
        />
      </View>
    </>
  );
}
export function CommunityNavigation({
  active,
}: {
  active: "Feed" | "Clubs" | "Challenges";
}) {
  const c = useColors();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        backgroundColor: c.panel,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      {(["Feed", "Clubs", "Challenges"] as const).map((tab) => (
        <Pressable
          key={tab}
          accessibilityRole="tab"
          accessibilityLabel={`${tab} community`}
          aria-selected={active === tab}
          accessibilityState={{ selected: active === tab }}
          onPress={() => {
            if (tab !== active)
              router.replace(
                tab === "Feed"
                  ? "/social"
                  : tab === "Clubs"
                    ? "/community"
                    : "/challenges",
              );
          }}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 44,
            borderBottomWidth: 2,
            borderBottomColor: active === tab ? c.accent : "transparent",
          }}
        >
          <Text
            style={{
              color: active === tab ? c.accent : c.muted,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {tab}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function CommunityAction({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      aria-disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 43,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: secondary ? c.greenSoft : c.accent,
        justifyContent: "center",
        alignItems: "center",
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: secondary ? c.forest : c.onAccent,
          fontSize: 12,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function CommunityHero({
  title,
  subtitle,
  kind = "mountains",
  compact = false,
}: {
  title: string;
  subtitle: string;
  kind?: keyof typeof discoveryPhotos;
  compact?: boolean;
}) {
  const wide = useWindowDimensions().width >= 1100;
  return (
    <View
      style={{
        height: compact ? 125 : wide ? 205 : 170,
        backgroundColor: "#102D40",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <Image
        source={discoveryPhotos[kind]}
        accessibilityLabel="Nepal-inspired community editorial cover"
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
      <View
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(10,30,40,.38)",
          padding: 18,
          justifyContent: "flex-end",
          gap: 7,
        }}
      >
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          <Ionicons name="trail-sign-outline" color="#FFFFFF" size={12} />
          <Text
            style={{
              color: "#E4F1EA",
              fontSize: 9,
              fontWeight: "700",
              letterSpacing: 1.5,
            }}
          >
            NEPAL MOVES TOGETHER
          </Text>
        </View>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: compact ? 22 : 27,
            fontWeight: "700",
            letterSpacing: -0.6,
          }}
        >
          {title}
        </Text>
        <Text style={{ color: "#FFFFFF", fontSize: 11, lineHeight: 17 }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
export function CommunityFilters<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const c = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 7 }}
    >
      {items.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityLabel={item}
          aria-pressed={value === item}
          accessibilityState={{ selected: value === item }}
          onPress={() => onChange(item)}
          style={{
            minHeight: 40,
            borderRadius: 8,
            paddingHorizontal: 14,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: value === item ? c.text : c.border,
            backgroundColor: value === item ? c.text : c.panel,
          }}
        >
          <Text
            style={{
              color: value === item ? c.panel : c.text,
              fontSize: 11,
              fontWeight: "600",
            }}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function CommunityEmpty({
  title,
  detail,
  icon = "people-outline",
  signIn = false,
}: {
  title: string;
  detail: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  signIn?: boolean;
}) {
  const c = useColors();
  return (
    <TrainingPanel>
      <View style={{ alignItems: "center", gap: 11, paddingVertical: 11 }}>
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: c.greenSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={27} color={c.forest} />
        </View>
        <Text
          style={{
            color: c.text,
            fontSize: 17,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: c.muted,
            fontSize: 12,
            lineHeight: 20,
            textAlign: "center",
            maxWidth: 400,
          }}
        >
          {detail}
        </Text>
      </View>
      {signIn ? (
        <CommunityAction
          title="Sign in to connect"
          onPress={() => router.push("/auth")}
        />
      ) : null}
    </TrainingPanel>
  );
}
export function CommunityError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const c = useColors();
  return (
    <TrainingPanel>
      <Text
        accessibilityRole="alert"
        style={{ color: c.accent, fontSize: 12, lineHeight: 19 }}
      >
        {message}
      </Text>
      <CommunityAction secondary title="Try again" onPress={onRetry} />
    </TrainingPanel>
  );
}
export function ClubCard({
  club,
  joined,
  userId,
  cover = "ridge",
}: {
  club: Club;
  joined: boolean;
  userId: string;
  cover?: keyof typeof discoveryPhotos;
}) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: c.panel,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View club ${club.name}`}
        onPress={() => router.push(`/club/${club.id}`)}
      >
        <View style={{ height: 150, overflow: "hidden" }}>
          <Image
            source={discoveryPhotos[cover]}
            resizeMode="cover"
            accessibilityLabel="Nepal-inspired editorial club cover"
            style={{ width: "100%", height: 150 }}
          />
          <View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(9,29,40,.3)",
              justifyContent: "flex-end",
              padding: 15,
              gap: 6,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 21,
                fontWeight: "700",
                letterSpacing: -0.4,
              }}
            >
              {club.name}
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 10 }}>
              {joined ? "YOUR COMMUNITY" : "EXPLORE THIS COMMUNITY"}
            </Text>
          </View>
        </View>
      </Pressable>
      <View style={{ padding: 15, gap: 13 }}>
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
          {club.description || "A community for shared movement."}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Ionicons
              name={joined ? "checkmark-circle" : "people-outline"}
              color={c.forest}
              size={17}
            />
            <Text style={{ color: c.forest, fontSize: 11 }}>
              {joined ? "Member" : "Club community"}
            </Text>
          </View>
          <MembershipAction
            kind="club_members"
            id={club.id}
            userId={userId}
            joined={joined}
          />
        </View>
      </View>
    </View>
  );
}
export function MembershipAction({
  kind,
  id,
  userId,
  joined,
}: {
  kind: "club_members" | "challenge_entries";
  id: string;
  userId: string;
  joined: boolean;
}) {
  const a = useAction(),
    c = useColors(),
    refresh = useRefreshCommunity();
  const noun = kind === "club_members" ? "club" : "challenge";
  return (
    <View style={{ gap: 7, flexShrink: 1 }}>
      <CommunityAction
        title={`${joined ? "Leave" : "Join"} ${noun}`}
        secondary={joined}
        disabled={a.busy}
        onPress={() =>
          void a.run(
            async () => {
              await changeMembership(kind, id, userId, joined);
              await refresh();
            },
            `${joined ? "Left" : "Joined"} ${noun}.`,
          )
        }
      />
      {a.message ? (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: 10, color: c.muted, maxWidth: 210 }}
        >
          {a.message}
        </Text>
      ) : null}
    </View>
  );
}
export function ChallengeCard({
  challenge,
  entry,
  userId,
}: {
  challenge: Challenge;
  entry?: Entry;
  userId: string;
}) {
  const c = useColors(),
    { workouts, preferences } = useApp();
  const [now, setNow] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      return useApp.subscribe((next, previous) => {
        if (next.workouts !== previous.workouts) setNow(Date.now());
      });
    }, []),
  );
  const progress = useMemo(
    () =>
      entry
        ? challengeProgress(challenge, workouts, userId, entry.joined_at, now)
        : null,
    [challenge, workouts, userId, entry, now],
  );
  const date = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  return (
    <View
      style={{
        backgroundColor: entry ? c.cream : c.panel,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 14,
        padding: 17,
        gap: 15,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: c.accentSoft,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="trophy-outline" size={25} color={c.accent} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
            {challenge.title}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            All sports · distance challenge
          </Text>
        </View>
        {entry ? (
          <Ionicons name="checkmark-circle" size={19} color={c.forest} />
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
        <Text
          style={{
            color: c.text,
            fontSize: 25,
            fontWeight: "700",
            letterSpacing: -0.5,
          }}
        >
          {progress
            ? length(progress.meters, preferences.units)
            : length(challenge.target_m, preferences.units)}
        </Text>
        <Text style={{ color: c.muted, fontSize: 11 }}>
          {progress
            ? `/ ${length(challenge.target_m, preferences.units)} ${preferences.units}`
            : `${preferences.units} goal`}
        </Text>
      </View>
      <View
        accessibilityRole={progress ? "progressbar" : undefined}
        aria-label={`${challenge.title} personal progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress?.percent}
        accessibilityValue={
          progress ? { min: 0, max: 100, now: progress.percent } : undefined
        }
        style={{
          height: 7,
          borderRadius: 4,
          overflow: "hidden",
          backgroundColor: c.raised,
        }}
      >
        <View
          style={{
            width: `${progress?.percent ?? 0}%`,
            height: 7,
            borderRadius: 4,
            backgroundColor: c.forest,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Ionicons name="calendar-outline" size={13} color={c.muted} />
        <Text style={{ color: c.muted, fontSize: 11, flex: 1 }}>
          {date(challenge.starts_at)} – {date(challenge.ends_at)} ·{" "}
          {new Date(challenge.ends_at).getFullYear()}
        </Text>
        <Text style={{ color: c.forest, fontSize: 10 }}>
          {now < Date.parse(challenge.starts_at)
            ? "UPCOMING"
            : now >= Date.parse(challenge.ends_at)
              ? "ENDED"
              : "IN PROGRESS"}
        </Text>
      </View>
      <Text style={{ color: c.muted, fontSize: 10, lineHeight: 16 }}>
        {entry
          ? "Personal device estimate · completed activities since joining · not an official score"
          : "Join to track your own recorded progress."}
      </Text>
      <MembershipAction
        kind="challenge_entries"
        id={challenge.id}
        userId={userId}
        joined={!!entry}
      />
    </View>
  );
}
export function CompetitionPreview() {
  const c = useColors();
  return (
    <TrainingPanel>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Ionicons name="podium-outline" size={25} color={c.accent} />
        <Text style={{ color: c.muted, fontSize: 9, letterSpacing: 1 }}>
          PLANNED
        </Text>
      </View>
      <DiscoveryTitle
        title="Segments & leaderboards"
        detail="A fair starting line for everyone."
      />
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
        Verified efforts and public rankings need a dedicated results service.
      </Text>
      <CommunityAction
        secondary
        title="Explore competition preview"
        onPress={() => router.push("/competition")}
      />
    </TrainingPanel>
  );
}

import { useState } from "react";
import { NotificationBell } from "../../../components/notification-bell";
import { Image, Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  AthletePage,
  AthleteText as Text,
  IconButton,
  SmallLabel,
} from "../../../components/athlete";
import { useColors, Loading } from "../../../components/ui";
import { useApp } from "../../../store/app";
import { useCurrentAthlete } from "../../../hooks/useCurrentAthlete";
import { canAccessLocalWorkout } from "../../../features/auth/local-access";
import { useFeed } from "../../../hooks/useFeed";
import { stats } from "../../../utils/tracking";
import { duration, length } from "../../../utils/format";
import ActivityCard from "../../../components/ActivityCard";
import { TrainingWeek } from "../../../components/TrainingWeek";

export default function Home() {
  const { workouts, preferences: p, ready, error } = useApp();
  const c = useColors();
  const wide = useWindowDimensions().width >= 1100;
  const identity = useCurrentAthlete();
  const { session } = identity;
  const [failedAvatar, setFailedAvatar] = useState("");
  const [tab, setTab] = useState<"For you" | "Following" | "Clubs">("For you");
  const feed = useFeed(
    session?.user.id,
    tab === "Following" ? "following" : "all",
  );
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const finished = workouts
    .filter(
      (w) =>
        w.state === "finished" && canAccessLocalWorkout(w, session?.user.id),
    )
    .sort((a, b) => b.startedAt - a.startedAt);
  const week = finished.filter(
    (w) => w.startedAt >= +monday && w.startedAt <= +today,
  );
  const meters = week.reduce((sum, w) => sum + stats(w).meters, 0);
  const moving = week.reduce((sum, w) => sum + stats(w).movingMs, 0);
  const progress = Math.min(
    100,
    Math.max(0, (meters / Math.max(1, p.weeklyGoalKm * 1000)) * 100),
  );
  const greeting =
    today.getHours() < 12
      ? "Good morning,"
      : today.getHours() < 18
        ? "Good afternoon,"
        : "Good evening,";
  const card = {
    backgroundColor: c.panel,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 14,
  } as const;
  const goRecord = () => router.push("/record");
  return (
    <AthletePage>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21 }}>
            {greeting}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              color: c.text,
              fontWeight: "700",
              fontSize: 26,
              lineHeight: 31,
              letterSpacing: -0.8,
            }}
          >
            {identity.greeting}
          </Text>
        </View>
        <NotificationBell />
        {identity.avatarUrl && identity.avatarUrl !== failedAvatar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.push("/profile")}
            style={{
              width: 48,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              key={identity.avatarUrl}
              source={{ uri: identity.avatarUrl }}
              accessibilityLabel="Your account picture"
              style={{ width: 36, height: 36, borderRadius: 18 }}
              onError={() => {
                setFailedAvatar(identity.avatarUrl!);
                identity.onAvatarError();
              }}
            />
          </Pressable>
        ) : (
          <IconButton
            icon="person-outline"
            label="Open profile"
            onPress={() => router.push("/profile")}
          />
        )}
      </View>
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: wide ? 28 : 18,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 16 }}>
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: "row",
              padding: 4,
              borderRadius: 10,
              backgroundColor: c.raised,
              gap: 4,
            }}
          >
            {(["For you", "Following", "Clubs"] as const).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityLabel={item}
                accessibilityState={{ selected: tab === item }}
                onPress={() => setTab(item)}
                style={{
                  flex: 1,
                  minHeight: 38,
                  borderRadius: 7,
                  backgroundColor: tab === item ? c.text : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: tab === item ? c.panel : c.muted,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          {tab === "For you" ? (
            <View style={[card, { overflow: "hidden" }]}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  gap: 10,
                }}
              >
                <View
                  style={{
                    backgroundColor: c.greenSoft,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="trail-sign-outline"
                    color={c.forest}
                    size={19}
                  />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={{ color: c.text, fontSize: 13, fontWeight: "700" }}
                  >
                    The Nepal outdoors
                  </Text>
                  <SmallLabel>Inspiration for your next outing</SmallLabel>
                </View>
                <Ionicons name="leaf-outline" color={c.forest} size={18} />
              </View>
              <View style={{ paddingHorizontal: 14, gap: 10 }}>
                <Text style={{ color: c.text, fontSize: 14, lineHeight: 21 }}>
                  Fresh air. A familiar trail. A little further from the
                  everyday.
                </Text>
                <View style={{ overflow: "hidden", borderRadius: 10 }}>
                  <Image
                    accessibilityLabel="Original Himalayan landscape editorial artwork"
                    source={require("../../../assets/himalayan-editorial.jpg")}
                    resizeMode="cover"
                    style={{ width: "100%", height: wide ? 300 : 220 }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: 10,
                      left: 10,
                      backgroundColor: "rgba(15,28,32,.78)",
                      borderRadius: 5,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontSize: 9,
                        letterSpacing: 0.6,
                      }}
                    >
                      NEPAL INSPIRED · EDITORIAL IMAGE
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Discover routes"
                onPress={() => router.push("/explore")}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <Ionicons name="compass-outline" color={c.forest} size={18} />
                <Text
                  style={{
                    flex: 1,
                    color: c.forest,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Find your next adventure
                </Text>
                <Ionicons name="arrow-forward" color={c.muted} size={17} />
              </Pressable>
            </View>
          ) : null}
          {tab === "Clubs" ? (
            <View style={[card, { padding: 20, gap: 12 }]}>
              <Ionicons name="people-outline" color={c.forest} size={28} />
              <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>
                Find your people.
              </Text>
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
                Discover clubs and open challenges from your connected
                community.
              </Text>
              <Action
                label="Explore clubs & challenges"
                onPress={() => router.push("/community")}
              />
            </View>
          ) : (
            <>
              {feed.isLoading ? <Loading /> : null}
              {feed.error ? (
                <Text style={{ color: c.accent, fontSize: 13 }}>
                  {feed.error.message}
                </Text>
              ) : null}
              {feed.data?.slice(0, 3).map((post) => (
                <View key={post.id} style={[card, { padding: 16, gap: 8 }]}>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="fitness-outline"
                      color={c.forest}
                      size={20}
                    />
                    <Text style={{ color: c.muted, fontSize: 11 }}>
                      SHARED ACTIVITY ·{" "}
                      {new Date(post.started_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text
                    style={{ color: c.text, fontSize: 17, fontWeight: "700" }}
                  >
                    {post.title}
                  </Text>
                  <Text style={{ color: c.text, fontSize: 13 }}>
                    {post.sport} · {length(post.distance_m, p.units)} {p.units}
                  </Text>
                  <Action
                    label="Open athlete feed"
                    onPress={() => router.push("/social")}
                  />
                </View>
              ))}
              {tab === "Following" && !feed.data?.length ? (
                <View style={[card, { padding: 20, gap: 12 }]}>
                  <Text
                    style={{ color: c.text, fontSize: 17, fontWeight: "700" }}
                  >
                    Your people, your motivation.
                  </Text>
                  <Text
                    style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}
                  >
                    {session
                      ? "Activities from athletes you follow will appear here when available."
                      : "Sign in to follow athletes and see their shared activities. No sample athletes are shown."}
                  </Text>
                  <Action
                    label={session ? "Find athletes" : "Sign in to connect"}
                    onPress={() => router.push(session ? "/search" : "/auth")}
                  />
                </View>
              ) : null}
              {tab === "For you" ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{ color: c.text, fontSize: 16, fontWeight: "700" }}
                    >
                      Your activity
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="View all activities"
                      onPress={() => router.push("/activities")}
                      style={{ minHeight: 44, justifyContent: "center" }}
                    >
                      <Text style={{ color: c.muted, fontSize: 12 }}>
                        View all
                      </Text>
                    </Pressable>
                  </View>
                  {!ready ? (
                    <Loading />
                  ) : finished.length ? (
                    finished
                      .slice(0, 3)
                      .map((w) => <ActivityCard key={w.id} workout={w} />)
                  ) : (
                    <View style={[card, { padding: 17, gap: 10 }]}>
                      <Text
                        style={{
                          color: c.text,
                          fontWeight: "700",
                          fontSize: 17,
                        }}
                      >
                        Your story starts outside.
                      </Text>
                      <Text
                        style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}
                      >
                        Your first run, ride or hike belongs here. Record an
                        activity to start your personal journal.
                      </Text>
                      <Action label="Record an activity" onPress={goRecord} />
                    </View>
                  )}
                </>
              ) : null}
            </>
          )}
          {error ? (
            <Text style={{ color: c.accent, fontSize: 13 }}>{error}</Text>
          ) : null}
        </View>
        <View style={{ width: wide ? 310 : "100%", gap: 16 }}>
          <View style={[card, { padding: 17, gap: 15 }]}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: c.text, fontWeight: "700", fontSize: 15 }}>
                Your week
              </Text>
              <Text style={{ color: c.muted, fontSize: 11 }}>MON — SUN</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {[
                [length(meters, p.units), `Distance (${p.units})`],
                [String(week.length), "Activities"],
                [duration(moving), "Moving time"],
              ].map(([value, label]) => (
                <View key={label} style={{ flex: 1, gap: 5 }}>
                  <Text
                    style={{
                      color: c.text,
                      fontSize: label === "Moving time" ? 17 : 22,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {value}
                  </Text>
                  <SmallLabel>{label}</SmallLabel>
                </View>
              ))}
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Weekly distance goal"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(progress),
              }}
              style={{
                height: 5,
                borderRadius: 3,
                backgroundColor: c.raised,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 5,
                  width: `${progress}%`,
                  backgroundColor: c.forest,
                }}
              />
            </View>
            <SmallLabel>
              {length(meters, p.units)} of{" "}
              {length(p.weeklyGoalKm * 1000, p.units)} {p.units} weekly goal
            </SmallLabel>
            <Action
              label="Training insights"
              onPress={() => router.push("/analytics")}
              quiet
            />
          </View>
          {wide ? <TrainingWeek workouts={finished} units={p.units} /> : null}
          <View style={[card, { padding: 17, gap: 10 }]}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: "700" }}>
              More ways to move
            </Text>
            <Action
              label="Routes & trails"
              onPress={() => router.push("/routes")}
              quiet
            />
            <Action
              label="Nepal events · category preview"
              onPress={() => router.push("/events")}
              quiet
            />
            <Action
              label="Clubs & challenges"
              onPress={() => router.push("/community")}
              quiet
            />
          </View>
          <SmallLabel>StravaKinda · Made for Nepal’s outdoors</SmallLabel>
        </View>
      </View>
    </AthletePage>
  );
}
function Action({
  label,
  onPress,
  quiet = false,
}: {
  label: string;
  onPress: () => void;
  quiet?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        borderRadius: 8,
        paddingHorizontal: quiet ? 0 : 14,
        backgroundColor: quiet ? "transparent" : c.text,
        justifyContent: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: quiet ? c.forest : c.panel,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

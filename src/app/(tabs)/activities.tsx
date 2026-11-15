import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AthletePage,
  AthleteText as Text,
  IconButton,
} from "../../../components/athlete";
import {
  DiscoveryButton,
  DiscoverySearch,
  DiscoveryTitle,
  discoveryPhotos,
} from "../../../components/discovery-ui";
import {
  TrainingActivityCard,
  TrainingChart,
  sportIcons,
  TrainingStats,
  sportNames,
} from "../../../components/athlete-training";
import { Loading, useColors } from "../../../components/ui";
import { useApp } from "../../../store/app";
import { useSession } from "../../../hooks/useSession";
import { canAccessLocalWorkout } from "../../../features/auth/local-access";
import type { Sport } from "../../../types/activity";

export default function Activities() {
  const { workouts, ready, preferences, error } = useApp();
  const c = useColors();
  const userId = useSession()?.user.id;
  const { width } = useWindowDimensions();
  const wide = width >= 1100,
    roomy = width >= 1360;
  const [filter, setFilter] = useState<Sport | "all">("all");
  const [search, setSearch] = useState("");
  const [newest, setNewest] = useState(true);
  const [limit, setLimit] = useState(20);
  const [now, setNow] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );
  const finished = useMemo(
    () =>
      workouts
        .filter(
          (w) =>
            w.state === "finished" &&
            w.startedAt <= now &&
            canAccessLocalWorkout(w, userId),
        )
        .sort((a, b) => b.startedAt - a.startedAt),
    [workouts, now, userId],
  );
  const items = useMemo(() => {
    const matched = finished.filter(
      (w) =>
        (filter === "all" || w.sport === filter) &&
        `${w.title} ${w.description}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    );
    return newest ? matched : matched.reverse();
  }, [finished, filter, search, newest]);
  return (
    <AthletePage>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: c.text,
              fontSize: 25,
              fontWeight: "700",
              letterSpacing: -0.7,
            }}
          >
            Activity journal
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            Every outing. A little further.
          </Text>
        </View>
        <IconButton
          icon="stats-chart-outline"
          label="Training trends"
          onPress={() => router.push("/analytics")}
        />
      </View>
      {!ready ? (
        <Loading />
      ) : (
        <TrainingStats workouts={finished} units={preferences.units} readable />
      )}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.accent, fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}
      {!wide ? (
        <TrainingChart
          workouts={finished}
          units={preferences.units}
          readable
          goalKm={preferences.weeklyGoalKm}
        />
      ) : null}
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        <View
          style={{
            flex: wide ? 1 : undefined,
            width: wide ? undefined : "100%",
            minWidth: 0,
            gap: 15,
          }}
        >
          <DiscoveryTitle
            title="Your activities"
            detail={
              finished.length
                ? `${finished.length} completed on this device`
                : "Good days start outside."
            }
          />
          <View style={{ flexDirection: roomy ? "row" : "column", gap: 12 }}>
            <View style={{ flex: roomy ? 1 : undefined, minWidth: 0 }}>
              <DiscoverySearch
                label="Search your activities"
                placeholder="Search your adventures"
                value={search}
                onChangeText={(value) => {
                  setSearch(value);
                  setLimit(20);
                }}
              />
            </View>
            <View style={{ width: roomy ? 350 : undefined }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {(
                  ["all", "running", "walking", "cycling", "hiking"] as const
                ).map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    accessibilityLabel={
                      s === "all" ? "All sports" : sportNames[s]
                    }
                    aria-pressed={s === filter}
                    accessibilityState={{ selected: s === filter }}
                    onPress={() => {
                      setFilter(s);
                      setLimit(20);
                    }}
                    style={{
                      minHeight: 40,
                      borderRadius: 8,
                      paddingHorizontal: 11,
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: filter === s ? c.accent : c.border,
                      backgroundColor: filter === s ? c.accent : c.panel,
                    }}
                  >
                    <Text
                      style={{
                        color: filter === s ? c.onAccent : c.text,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {s === "all" ? "All" : sportNames[s]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {items.length} {items.length === 1 ? "activity" : "activities"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={newest ? "Newest first" : "Oldest first"}
              onPress={() => setNewest(!newest)}
              style={{
                minHeight: 38,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={13}
                color={c.muted}
              />
              <Text style={{ color: c.muted, fontSize: 11 }}>
                {newest ? "Newest first" : "Oldest first"}
              </Text>
            </Pressable>
          </View>
          {ready ? (
            items.length > 0 ? (
              items
                .slice(0, limit)
                .map((w) => (
                  <TrainingActivityCard
                    key={w.id}
                    readable
                    workout={w}
                    units={preferences.units}
                  />
                ))
            ) : (
              <ActivityEmptyState
                filter={filter}
                searching={!!search.trim()}
                hasHistory={finished.length > 0}
                wide={wide}
                onReset={() => {
                  setSearch("");
                  setFilter("all");
                }}
              />
            )
          ) : null}
          {items.length > limit ? (
            <DiscoveryButton
              secondary
              title="Show more activities"
              onPress={() => setLimit((value) => value + 20)}
            />
          ) : null}
        </View>
        <View style={{ width: wide ? 320 : "100%", minWidth: 0, gap: 15 }}>
          {wide ? (
            <TrainingChart
              workouts={finished}
              units={preferences.units}
              readable
              goalKm={preferences.weeklyGoalKm}
            />
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 3,
            }}
          >
            <Ionicons name="lock-closed-outline" size={13} color={c.muted} />
            <Text
              style={{ color: c.muted, fontSize: 10, lineHeight: 16, flex: 1 }}
            >
              Your finished workouts · your real progress.
            </Text>
          </View>
        </View>
      </View>
    </AthletePage>
  );
}

const emptySports: Record<Sport, { title: string; detail: string }> = {
  running: {
    title: "No runs recorded yet",
    detail:
      "Find your rhythm, one run at a time. Your saved runs will appear here.",
  },
  walking: {
    title: "No walks recorded yet",
    detail:
      "Make a little room for fresh air. Your saved walks will appear here.",
  },
  cycling: {
    title: "No rides recorded yet",
    detail:
      "Two wheels, a fresh perspective. Your saved cycling activities will appear here.",
  },
  hiking: {
    title: "No hikes recorded yet",
    detail: "Take the scenic way. Your saved hikes will appear here.",
  },
};

function ActivityEmptyState({
  filter,
  searching,
  hasHistory,
  wide,
  onReset,
}: {
  filter: Sport | "all";
  searching: boolean;
  hasHistory: boolean;
  wide: boolean;
  onReset: () => void;
}) {
  const c = useColors();
  const copy =
    filter === "all"
      ? {
          title: "No adventures recorded yet",
          detail:
            "A run through the valley. A ride by the lake. Save your first outing to start your journal.",
        }
      : emptySports[filter];
  const reset = searching || hasHistory;
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
      {!searching ? (
        <View style={{ height: wide ? 176 : 135 }}>
          <Image
            source={
              discoveryPhotos[filter === "cycling" ? "lake" : "mountains"]
            }
            resizeMode="cover"
            accessibilityLabel="Nepal-inspired landscape for your next adventure · editorial artwork"
            style={{ width: "100%", height: "100%" }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 12,
              left: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              borderRadius: 7,
              paddingHorizontal: 10,
              paddingVertical: 7,
              backgroundColor: "rgba(16,45,64,.86)",
            }}
          >
            <Ionicons
              name={
                filter === "all" ? "trail-sign-outline" : sportIcons[filter]
              }
              size={17}
              color="#FFFFFF"
            />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: "600",
                letterSpacing: 0.7,
              }}
            >
              A LITTLE FURTHER
            </Text>
          </View>
        </View>
      ) : null}
      <View style={{ padding: wide ? 24 : 19, gap: 15, alignItems: "center" }}>
        {searching ? (
          <Ionicons name="search-outline" size={27} color={c.forest} />
        ) : null}
        <Text
          style={{
            color: c.text,
            fontSize: 20,
            fontWeight: "700",
            letterSpacing: -0.3,
            textAlign: "center",
          }}
        >
          {searching ? "No matching activities" : copy.title}
        </Text>
        <Text
          style={{
            color: c.muted,
            fontSize: 13,
            lineHeight: 21,
            textAlign: "center",
            maxWidth: 440,
          }}
        >
          {searching
            ? filter === "all"
              ? "Try a different title or description, or reset your filters."
              : `No ${sportNames[filter].toLowerCase()} activities match your search. Try another title or reset your filters.`
            : copy.detail}
        </Text>
        <View style={{ width: "100%", maxWidth: wide ? 240 : undefined }}>
          <DiscoveryButton
            title={reset ? "Reset filters" : "Go to recording"}
            onPress={reset ? onReset : () => router.push("/record")}
          />
        </View>
      </View>
    </View>
  );
}

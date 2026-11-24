import { ProfileEditor } from "../../../components/profile-editor";
import ActivityCard from "../../../components/ActivityCard";
import { DashboardTabs } from "../../../components/dashboard-ui";
import { profileDetailsQuery } from "../../../services/profile-details-query";
import { useCurrentAthlete } from "../../../hooks/useCurrentAthlete";
import { signOutAccount } from "../../../services/auth";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  View,
  useWindowDimensions,
  Share,
  Platform,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AthletePage, AthleteText as Text } from "../../../components/athlete";
import {
  DiscoveryButton,
  DiscoveryTitle,
  discoveryPhotos,
} from "../../../components/discovery-ui";
import {
  AthleteRecords,
  TrainingChart,
  TrainingLink,
  TrainingPanel,
  TrainingStats,
  sportIcons,
  sportNames,
} from "../../../components/athlete-training";
import { Button, Copy, Loading, useColors } from "../../../components/ui";
import { useSession } from "../../../hooks/useSession";
import { useAction } from "../../../hooks/useAction";
import { backend } from "../../../services/supabase";
import { syncWorkouts } from "../../../services/sync";
import { logoutPurchases } from "../../../services/purchases";
import { getValue, setValue } from "../../../services/database";
import { useApp } from "../../../store/app";
import type { Sport } from "../../../types/activity";

const sports: Sport[] = ["running", "walking", "cycling", "hiking"];
export default function Profile() {
  const session = useSession();
  return <AthleteProfile key={session?.user.id ?? "local"} session={session} />;
}
function AthleteProfile({
  session,
}: {
  session: ReturnType<typeof useSession>;
}) {
  const a = useAction(),
    c = useColors();
  const { workouts, preferences, ready, error } = useApp();
  const wide = useWindowDimensions().width >= 1100;
  const identity = useCurrentAthlete();
  const { userId, profile } = identity;
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(Date.now);
  const { setMessage } = a;
  const [preferred, setPreferred] = useState<{ key: string; sports: Sport[] }>({
    key: "",
    sports: [],
  });
  const preferenceKey = `athlete-sports:${userId ?? "local"}`;
  const selectedSports =
    preferred.key === preferenceKey ? preferred.sports : [];
  const memberships = useQuery({
    queryKey: ["athlete-memberships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const result = await backend()
        .from("club_members")
        .select("club_id")
        .eq("user_id", userId!);
      if (result.error) throw result.error;
      const ids = (result.data ?? []).map((row) => row.club_id);
      if (!ids.length) return [];
      const clubs = await backend()
        .from("clubs")
        .select("id,name")
        .in("id", ids);
      if (clubs.error) throw clubs.error;
      return clubs.data ?? [];
    },
  });
  const { refetch: refreshProfile } = profile,
    { refetch: refreshMemberships } = memberships;
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setNow(Date.now());
      void getValue<Sport[]>(preferenceKey)
        .then((value) => {
          if (active)
            setPreferred({
              key: preferenceKey,
              sports: (value ?? []).filter((s) => sports.includes(s)),
            });
        })
        .catch((e) => {
          if (active) setMessage(String(e));
        });
      if (userId) {
        void refreshProfile();
        void refreshMemberships();
      }
      return () => {
        active = false;
      };
    }, [preferenceKey, userId, refreshProfile, refreshMemberships, setMessage]),
  );
  const data = identity.data;
  const displayName = userId ? identity.fullName : "Your adventure awaits";
  const metadataLocation = session?.user.user_metadata?.location;
  const location =
    typeof metadataLocation === "string" ? metadataLocation.trim() : "";
  const finished = useMemo(
    () =>
      workouts.filter(
        (w) =>
          w.state === "finished" &&
          w.startedAt <= now &&
          (!w.ownerId || w.ownerId === userId),
      ),
    [workouts, now, userId],
  );
  const edit = () => {
    if (data) {
      setMessage("");
      setEditing(true);
    }
  };
  const [section, setSection] = useState<"Progress" | "Activities" | "More">(
    "Progress",
  );
  const details = useQuery(profileDetailsQuery(userId));
  const follows = useQuery({
    queryKey: ["athlete-follow-counts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        backend()
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", userId!),
        backend()
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", userId!),
      ]);
      if (followers.error) throw followers.error;
      if (following.error) throw following.error;
      return { followers: followers.count, following: following.count };
    },
  });
  if (identity.isLoading)
    return (
      <AthletePage>
        <Loading />
      </AthletePage>
    );
  return (
    <AthletePage>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ gap: 5 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: c.text,
              fontSize: 25,
              fontWeight: "700",
              letterSpacing: -0.7,
            }}
          >
            Your space
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            Made of small adventures.
          </Text>
        </View>
      </View>
      <View
        style={{
          borderRadius: 15,
          overflow: "hidden",
          backgroundColor: c.panel,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <View style={{ height: wide ? 210 : 135, overflow: "hidden" }}>
          <Image
            source={discoveryPhotos.mountains}
            accessibilityLabel="Nepal-inspired Himalayan profile banner"
            resizeMode="cover"
            style={{
              width: "100%",
              aspectRatio: 1.5,
              marginTop: wide ? -85 : -10,
            }}
          />
          <View
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              borderRadius: 6,
              backgroundColor: "rgba(16,45,64,.8)",
              paddingHorizontal: 9,
              paddingVertical: 6,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Ionicons name="trail-sign-outline" color="#FFFFFF" size={12} />
            <Text style={{ color: "#FFFFFF", fontSize: 9, letterSpacing: 1 }}>
              MADE FOR NEPAL
            </Text>
          </View>
        </View>
        <View
          style={{
            alignItems: "center",
            paddingHorizontal: 20,
            paddingBottom: 20,
            gap: 9,
          }}
        >
          <View
            style={{
              width: 78,
              height: 78,
              marginTop: -39,
              borderRadius: 39,
              borderWidth: 4,
              borderColor: c.panel,
              backgroundColor: c.greenSoft,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {identity.avatarUrl ? (
              <Image
                key={identity.avatarUrl}
                source={{ uri: identity.avatarUrl }}
                accessibilityLabel="Your profile photo"
                style={{ width: 70, height: 70, borderRadius: 35 }}
                onError={identity.onAvatarError}
              />
            ) : (
              <Ionicons name="person-outline" color={c.forest} size={33} />
            )}
          </View>
          <Text
            style={{
              color: c.text,
              fontSize: 23,
              fontWeight: "700",
              letterSpacing: -0.5,
              textAlign: "center",
            }}
          >
            {displayName}
          </Text>
          {(details.data?.city || location) && userId ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons name="location-outline" color={c.muted} size={12} />
              <Text style={{ color: c.muted, fontSize: 11 }}>
                {[details.data?.city, details.data?.province]
                  .filter(Boolean)
                  .join(", ") || location}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons
              name={
                userId
                  ? data?.is_private
                    ? "lock-closed-outline"
                    : "person-circle-outline"
                  : "phone-portrait-outline"
              }
              size={12}
              color={c.forest}
            />
            <Text style={{ color: c.forest, fontSize: 10 }}>
              {userId
                ? data
                  ? data.is_private
                    ? "Private athlete profile"
                    : "Athlete profile"
                  : "Loading your profile"
                : "Local athlete · sign in to connect"}
            </Text>
          </View>
          {userId && data?.bio ? (
            <Text
              style={{
                color: c.muted,
                fontSize: 12,
                lineHeight: 19,
                textAlign: "center",
                maxWidth: 520,
              }}
            >
              {data.bio}
            </Text>
          ) : (
            <Text
              style={{
                color: c.muted,
                fontSize: 12,
                textAlign: "center",
                lineHeight: 19,
              }}
            >
              {userId
                ? "A little movement. Your own story."
                : "Track locally. Find your rhythm. Make it yours."}
            </Text>
          )}
          <View
            style={{
              flexDirection: "row",
              alignSelf: "stretch",
              justifyContent: "space-around",
              paddingVertical: 12,
            }}
          >
            {[
              [String(finished.length), "Total activities"],
              [
                userId ? (follows.data?.followers?.toString() ?? "?") : "?",
                "Followers",
              ],
              [
                userId ? (follows.data?.following?.toString() ?? "?") : "?",
                "Following",
              ],
            ].map(([value, label]) => (
              <View key={label} style={{ alignItems: "center", gap: 4 }}>
                <Text
                  style={{ color: c.text, fontWeight: "700", fontSize: 20 }}
                >
                  {value}
                </Text>
                <Text style={{ color: c.muted, fontSize: 11 }}>{label}</Text>
              </View>
            ))}
          </View>
          {follows.error ? (
            <Copy muted>Follow counts unavailable. Try again later.</Copy>
          ) : null}
          {userId ? (
            <DiscoveryButton
              secondary
              title="Share Profile"
              onPress={() =>
                void a.run(async () => {
                  const url =
                    Platform.OS === "web"
                      ? new URL(`/athlete/${userId}`, window.location.origin)
                          .href
                      : `stravakinda://athlete/${userId}`;
                  if (Platform.OS === "web") {
                    if (navigator.share)
                      await navigator.share({ title: identity.fullName, url });
                    else if (navigator.clipboard)
                      await navigator.clipboard.writeText(url);
                    else throw new Error(`Copy your profile link: ${url}`);
                  } else
                    await Share.share({
                      message: `${identity.fullName} on StravaKinda: ${url}`,
                    });
                }, "Profile link shared or copied.")
              }
            />
          ) : null}
          <View style={{ alignSelf: "stretch", marginTop: 6 }}>
            {userId && !data ? (
              <Text
                style={{ color: c.muted, fontSize: 12, textAlign: "center" }}
              >
                {profile.isPending
                  ? "Loading profile details…"
                  : "Profile details unavailable"}
              </Text>
            ) : (
              <DiscoveryButton
                secondary
                title={
                  userId
                    ? editing
                      ? "Editing profile"
                      : "Edit profile"
                    : "Sign in or create an account"
                }
                onPress={userId ? edit : () => router.push("/auth")}
              />
            )}
          </View>
        </View>
      </View>
      {profile.error && userId ? (
        <TrainingPanel>
          <Text
            accessibilityRole="alert"
            style={{ color: c.accent, fontSize: 12 }}
          >
            Could not load your profile. {profile.error.message}
          </Text>
          <DiscoveryButton
            secondary
            title="Retry profile"
            onPress={() => void profile.refetch()}
          />
        </TrainingPanel>
      ) : null}
      {a.message ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.text, fontSize: 12, lineHeight: 20 }}
        >
          {a.message}
        </Text>
      ) : null}
      {session && editing && data ? (
        <ProfileEditor
          key={userId}
          onClose={(saved) => {
            setEditing(false);
            if (saved) setMessage("Profile saved.");
          }}
        />
      ) : null}
      <DashboardTabs
        items={["Progress", "Activities", "More"] as const}
        value={section}
        onChange={setSection}
        label="Profile sections"
      />
      {section === "Activities" ? (
        <View style={{ gap: 16 }}>
          <DiscoveryTitle
            title="Your activity history"
            detail="The same recordings as your Activity journal"
          />
          {finished.length ? (
            [...finished]
              .sort((a, b) => b.startedAt - a.startedAt)
              .map((workout) => (
                <ActivityCard key={workout.id} workout={workout} />
              ))
          ) : (
            <TrainingPanel>
              <Copy>Record your first activity and start your story.</Copy>
              <DiscoveryButton
                title="Record your first activity"
                onPress={() => router.push("/record")}
              />
            </TrainingPanel>
          )}
        </View>
      ) : null}
      {section === "Progress" ? (
        !ready ? (
          <Loading />
        ) : (
          <TrainingStats workouts={finished} units={preferences.units} />
        )
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.accent, fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <View
          style={{
            display: section === "Progress" ? "flex" : "none",
            flex: wide ? 1.3 : undefined,
            minWidth: 0,
            gap: 18,
          }}
        >
          <TrainingPanel>
            <DiscoveryTitle
              title="Your sports"
              detail="Choose what moves you · saved on this device"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {sports.map((sport) => (
                <Pressable
                  key={sport}
                  accessibilityRole="checkbox"
                  aria-checked={selectedSports.includes(sport)}
                  accessibilityLabel={`Prefer ${sportNames[sport].toLowerCase()}`}
                  accessibilityState={{
                    checked: selectedSports.includes(sport),
                  }}
                  disabled={a.busy || preferred.key !== preferenceKey}
                  onPress={() =>
                    void a.run(async () => {
                      const next = selectedSports.includes(sport)
                        ? selectedSports.filter((s) => s !== sport)
                        : [...selectedSports, sport];
                      await setValue(preferenceKey, next);
                      setPreferred({ key: preferenceKey, sports: next });
                    })
                  }
                  style={{
                    flex: 1,
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: selectedSports.includes(sport)
                      ? c.greenSoft
                      : c.raised,
                    borderWidth: 1,
                    borderColor: selectedSports.includes(sport)
                      ? c.forest
                      : "transparent",
                  }}
                >
                  <Ionicons
                    name={sportIcons[sport]}
                    size={23}
                    color={selectedSports.includes(sport) ? c.forest : c.muted}
                  />
                  <Text style={{ color: c.text, fontSize: 10 }}>
                    {sportNames[sport]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </TrainingPanel>
          <TrainingChart
            workouts={finished}
            units={preferences.units}
            goalKm={preferences.weeklyGoalKm}
          />
          <AthleteRecords workouts={finished} units={preferences.units} />
          <TrainingPanel>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
            >
              <Ionicons
                name={finished.length ? "ribbon" : "ribbon-outline"}
                size={23}
                color={c.accent}
              />
              <Text
                accessibilityRole="header"
                style={{ color: c.text, fontSize: 16, fontWeight: "700" }}
              >
                Milestones
              </Text>
            </View>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>
              {finished.length
                ? "First adventure recorded"
                : "Your first milestone is ahead"}
            </Text>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
              {finished.length
                ? `${finished.length} completed ${finished.length === 1 ? "outing" : "outings"}. Every one counts.`
                : "Save your first completed activity to earn this milestone."}
            </Text>
            <DiscoveryButton
              secondary
              title="View training history"
              onPress={() => router.push("/activities")}
            />
          </TrainingPanel>
        </View>
        <View
          style={{
            display: section === "More" ? "flex" : "none",
            flex: wide ? 1 : undefined,
            minWidth: 0,
            gap: 18,
          }}
        >
          <TrainingPanel>
            <DiscoveryTitle
              title="Better together"
              detail="Your clubs & community"
            />
            {userId && memberships.isPending ? <Loading /> : null}
            {userId && memberships.error ? (
              <>
                <Text
                  accessibilityRole="alert"
                  style={{ color: c.accent, fontSize: 12 }}
                >
                  Could not load club memberships.
                </Text>
                <DiscoveryButton
                  secondary
                  title="Retry memberships"
                  onPress={() => void memberships.refetch()}
                />
              </>
            ) : userId && memberships.data?.length ? (
              memberships.data.map((club) => (
                <TrainingLink
                  key={club.id}
                  title={club.name}
                  detail="Your club · open community"
                  icon="people-outline"
                  onPress={() => router.push("/community")}
                />
              ))
            ) : (
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
                {userId
                  ? "Find a local club and share the journey."
                  : "Sign in to meet athletes and discover local clubs."}
              </Text>
            )}
            <TrainingLink
              title="Clubs & challenges"
              detail="Find your people in Nepal"
              icon="people-outline"
              onPress={() => router.push("/community")}
            />
            <TrainingLink
              title="Athlete community"
              detail="Connect with athletes"
              icon="chatbubbles-outline"
              onPress={() => router.push(userId ? "/social" : "/auth")}
            />
          </TrainingPanel>
          <TrainingPanel>
            <DiscoveryTitle title="Profile details" />
            <Copy>
              {[details.data?.city, details.data?.province]
                .filter(Boolean)
                .join(", ") || "Add your home city in Edit profile."}
            </Copy>
            <Copy>
              Primary sport:{" "}
              {details.data?.primary_sport
                ? sportNames[details.data.primary_sport]
                : "Not set"}
            </Copy>
            <Copy muted>
              Birthdate, gender and weight are private. Review them in Edit
              profile. Use the global header for Settings.
            </Copy>
            <DiscoveryTitle title="Your toolkit" />

            <TrainingLink
              title="Privacy zones"
              detail="Keep sensitive route locations private"
              icon="shield-checkmark-outline"
              onPress={() => router.push("/privacy-zones")}
            />
            <TrainingLink
              title="Training analytics"
              detail="Explore your distance and time"
              icon="stats-chart-outline"
              onPress={() => router.push("/analytics")}
            />
            <TrainingLink
              title="Premium"
              detail="Explore subscription options"
              icon="diamond-outline"
              onPress={() => router.push("/subscription")}
            />
          </TrainingPanel>
          {session ? (
            <TrainingPanel>
              <DiscoveryTitle title="Account & sync" />
              <Text style={{ color: c.muted, fontSize: 12 }}>
                {session.user.email}
              </Text>
              <Button
                title="Sync & restore workouts"
                disabled={a.busy}
                onPress={() =>
                  void a.run(
                    syncWorkouts,
                    "Linked workouts synced and missing cloud workouts restored. Sync will retry while the app is open. Unlinked local activities stay on this device.",
                  )
                }
              />
              <Copy muted>
                Automatic retries run while the app is open. Link older local
                activities individually before upload.
              </Copy>
              <Button
                secondary
                title="Sign out"
                disabled={a.busy}
                onPress={() =>
                  void a.run(async () => {
                    const result = await signOutAccount();
                    if (result.error) throw result.error;
                    await logoutPurchases().catch(() => undefined);
                  })
                }
              />
            </TrainingPanel>
          ) : (
            <TrainingPanel>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>
                Move first. Connect when ready.
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
                Recording works without an account. Sign in when you are ready
                to sync linked workouts and connect.
              </Text>
              <DiscoveryButton
                title="Connect your account"
                onPress={() => router.push("/auth")}
              />
            </TrainingPanel>
          )}
        </View>
      </View>
    </AthletePage>
  );
}

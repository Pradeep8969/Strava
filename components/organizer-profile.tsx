import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AthleteText as Text } from "./athlete";
import { TrainingPanel } from "./athlete-training";
import { DashboardNotice, DashboardTabs } from "./dashboard-ui";
import { CommunityAction } from "./community-ui";
import { discoveryPhotos, DiscoveryTitle } from "./discovery-ui";
import { Field, useColors } from "./ui";
import { organizerSports, type Banner } from "../features/organizer/drafts";
import {
  validateProfile,
  type OrganizerProfile,
} from "../features/organizer/workspace";
export function OrganizerProfileForm({
  initial,
  onSave,
}: {
  initial: OrganizerProfile;
  onSave: (profile: OrganizerProfile) => Promise<void>;
}) {
  const c = useColors();
  const [profile, setProfile] = useState(initial),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (key: keyof OrganizerProfile, value: string) => {
    setProfile((old) => ({ ...old, [key]: value }));
    setMessage("");
  };
  return (
    <TrainingPanel>
      <DashboardNotice
        title="Organizer profile preview"
        detail="Private device-local contact details. Not a verified organizer profile; nothing is published."
      />
      <Image
        source={discoveryPhotos[profile.banner]}
        accessibilityLabel="Organizer banner preview · Nepal-inspired editorial artwork"
        resizeMode="cover"
        style={{ width: "100%", height: 155, borderRadius: 10 }}
      />
      <View style={{ gap: 7 }}>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: "700" }}>
          {initial.name || "Your organizer space"}
        </Text>
        <Text style={{ color: c.accent, fontSize: 11 }}>
          Not a verified organizer profile
        </Text>
      </View>
      <Field
        label="Organizer name"
        value={profile.name}
        onChangeText={(v) => set("name", v)}
        maxLength={100}
      />
      <Field
        label="Contact email"
        value={profile.email}
        onChangeText={(v) => set("email", v)}
        keyboardType="email-address"
        autoCapitalize="none"
        maxLength={254}
      />
      <Field
        label="Contact phone (optional)"
        value={profile.phone}
        onChangeText={(v) => set("phone", v)}
        keyboardType="phone-pad"
        maxLength={30}
      />
      <Field
        label="Organizer location"
        value={profile.location}
        onChangeText={(v) => set("location", v)}
        maxLength={120}
      />
      <Field
        label="About the organizer"
        value={profile.about}
        onChangeText={(v) => set("about", v)}
        maxLength={2000}
        multiline
      />
      <Field
        label="Contact website (optional)"
        value={profile.website}
        onChangeText={(v) => set("website", v)}
        placeholder="https://…"
        autoCapitalize="none"
        maxLength={500}
      />
      <Field
        label="Social link (optional)"
        value={profile.social}
        onChangeText={(v) => set("social", v)}
        placeholder="https://…"
        autoCapitalize="none"
        maxLength={500}
      />
      <DiscoveryTitle
        title="Supported sports"
        detail="Tap a sport to include or remove"
      />
      <View style={{ gap: 8, flexDirection: "row", flexWrap: "wrap" }}>
        {organizerSports.map((sport) => (
          <Pressable
            key={sport}
            accessibilityRole="button"
            accessibilityLabel={`${profile.sports.includes(sport) ? "Remove" : "Add"} ${sport}`}
            accessibilityState={{ selected: profile.sports.includes(sport) }}
            style={{
              width: "47%",
              flexGrow: 1,
              minHeight: 44,
              padding: 11,
              borderRadius: 8,
              backgroundColor: profile.sports.includes(sport)
                ? c.greenSoft
                : c.raised,
              flexDirection: "row",
              gap: 7,
              alignItems: "center",
            }}
            onPress={() =>
              setProfile((old) => ({
                ...old,
                sports: old.sports.includes(sport)
                  ? old.sports.filter((s) => s !== sport)
                  : [...old.sports, sport],
              }))
            }
          >
            <Ionicons
              name={
                profile.sports.includes(sport)
                  ? "checkmark-circle"
                  : "ellipse-outline"
              }
              size={17}
              color={c.forest}
            />
            <Text style={{ color: c.text, fontSize: 12 }}>{sport}</Text>
          </Pressable>
        ))}
      </View>
      <DiscoveryTitle
        title="Organizer banner"
        detail="Existing approved editorial artwork"
      />
      <DashboardTabs
        items={["mountains", "lake", "ridge"] as Banner[]}
        value={profile.banner}
        onChange={(banner) => setProfile((old) => ({ ...old, banner }))}
        label="Organizer banner"
      />
      {message ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.accent, fontSize: 12, lineHeight: 20 }}
        >
          {message}
        </Text>
      ) : null}
      <CommunityAction
        title="Keep profile preview"
        disabled={busy}
        onPress={async () => {
          const next = {
            ...profile,
            name: profile.name.trim(),
            email: profile.email.trim(),
            phone: profile.phone.trim(),
            location: profile.location.trim(),
            website: profile.website.trim(),
            social: profile.social.trim(),
          };
          const error = validateProfile(next);
          if (error) {
            setMessage(error);
            return;
          }
          setBusy(true);
          try {
            await onSave(next);
            setMessage("Profile saved privately on this device.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </TrainingPanel>
  );
}

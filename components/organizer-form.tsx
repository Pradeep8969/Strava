import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { AthleteText as Text } from "./athlete";
import { discoveryPhotos, DiscoveryTitle } from "./discovery-ui";
import { TrainingPanel } from "./athlete-training";
import { CommunityAction } from "./community-ui";
import { DashboardTabs, DashboardNotice } from "./dashboard-ui";
import { Field, useColors } from "./ui";
import {
  organizerSports,
  validateEventDraft,
  type EventDraft,
  type Banner,
} from "../features/organizer/drafts";

export function EventDraftForm({
  initial,
  onSave,
  onCancel,
  tablet,
  busy = false,
}: {
  initial: EventDraft;
  onSave: (draft: EventDraft) => Promise<void>;
  onCancel: () => void;
  tablet: boolean;
  busy?: boolean;
}) {
  const c = useColors();
  const [draft, setDraft] = useState<EventDraft>({ ...initial }),
    [error, setError] = useState("");
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    setDraft((old) => ({ ...old, [key]: value }));
    setError("");
  };
  return (
    <View style={{ gap: 18 }}>
      <DashboardNotice
        title="Event form preview"
        detail="Save privately on this device, across restarts. Unpublished and not synchronized. No registrations or payments can be taken."
      />
      <TrainingPanel>
        <DiscoveryTitle
          title={initial.id ? "Edit preview event" : "Create preview event"}
          detail="Plan the details before a future launch."
        />
        {error ? (
          <Text
            accessibilityRole="alert"
            style={{ color: c.accent, fontSize: 12, lineHeight: 19 }}
          >
            {error}
          </Text>
        ) : null}
        <Field
          label="Event name"
          placeholder="Give your event a name"
          value={draft.title}
          onChangeText={(value) => set("title", value)}
          maxLength={120}
        />
        <View style={{ flexDirection: tablet ? "row" : "column", gap: 14 }}>
          <View style={{ flex: tablet ? 1 : undefined }}>
            <Field
              label="Proposed location"
              placeholder="City, region or venue"
              value={draft.location}
              onChangeText={(value) => set("location", value)}
              maxLength={120}
            />
          </View>
          <View style={{ flex: tablet ? 1 : undefined }}>
            <Field
              label="Proposed date"
              placeholder="YYYY-MM-DD"
              value={draft.date}
              onChangeText={(value) => set("date", value)}
              maxLength={10}
            />
          </View>
        </View>
        <Text style={{ color: c.muted, fontSize: 12 }}>Event sport</Text>
        <DashboardTabs
          items={organizerSports}
          value={draft.sport}
          onChange={(value) => set("sport", value)}
          label="Preview event sport"
        />
        <Field
          label="Description"
          placeholder="What would make this day special?"
          value={draft.description}
          onChangeText={(value) => set("description", value)}
          maxLength={2000}
          multiline
        />
        <Field
          label="Proposed participant capacity (optional)"
          placeholder="Planning target, not registrations"
          keyboardType="number-pad"
          value={draft.capacity}
          onChangeText={(value) => set("capacity", value)}
          maxLength={6}
        />
        <Field
          label="Event schedule (optional)"
          placeholder="06:00 · Welcome and briefing\n06:30 · Proposed start"
          value={draft.schedule ?? ""}
          onChangeText={(value) => set("schedule", value)}
          maxLength={2000}
          multiline
        />
        <DiscoveryTitle
          title="Event banner"
          detail="Existing Nepal-inspired editorial assets · preview only"
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(["mountains", "lake", "ridge"] as Banner[]).map((banner) => (
            <Pressable
              key={banner}
              accessibilityRole="radio"
              accessibilityLabel={`Use ${banner} banner`}
              aria-checked={draft.banner === banner}
              accessibilityState={{ checked: draft.banner === banner }}
              onPress={() => set("banner", banner)}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: draft.banner === banner ? c.forest : c.border,
                overflow: "hidden",
              }}
            >
              <Image
                source={discoveryPhotos[banner]}
                resizeMode="cover"
                accessibilityLabel={`${banner} preview banner choice`}
                style={{ width: "100%", height: 63 }}
              />
              <Text
                style={{
                  textAlign: "center",
                  color: c.text,
                  fontSize: 11,
                  paddingVertical: 9,
                }}
              >
                {banner[0].toUpperCase() + banner.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Image
          source={discoveryPhotos[draft.banner]}
          accessibilityLabel="Selected event banner preview"
          resizeMode="cover"
          style={{ width: "100%", height: 160, borderRadius: 10 }}
        />
        <View style={{ flexDirection: tablet ? "row" : "column", gap: 10 }}>
          <View style={{ flex: tablet ? 1 : undefined }}>
            <CommunityAction
              title="Save preview draft"
              disabled={busy}
              onPress={async () => {
                const message = validateEventDraft(draft);
                if (message) {
                  setError(message);
                  return;
                }
                try {
                  await onSave({
                    ...draft,
                    title: draft.title.trim(),
                    location: draft.location.trim(),
                    capacity: draft.capacity.trim(),
                  });
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            />
          </View>
          <View style={{ flex: tablet ? 1 : undefined }}>
            <CommunityAction
              secondary
              title="Cancel editing"
              disabled={busy}
              onPress={onCancel}
            />
          </View>
        </View>
        <CommunityAction
          title="Publish event · unavailable"
          disabled
          onPress={() => undefined}
        />
        <Text style={{ color: c.muted, fontSize: 11, lineHeight: 18 }}>
          Publishing, registration and payment services are not connected.
          Banner uploads are planned; the choices above are local preview
          assets.
        </Text>
      </TrainingPanel>
    </View>
  );
}

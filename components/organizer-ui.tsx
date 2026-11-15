import { type ComponentProps } from "react";
import { Image, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AthleteText as Text } from "./athlete";
import { discoveryPhotos, DiscoveryTitle } from "./discovery-ui";
import { TrainingPanel } from "./athlete-training";
import { DashboardTabs } from "./dashboard-ui";
import { useColors } from "./ui";
import { type EventDraft } from "../features/organizer/drafts";

export const organizerSections = [
  "Overview",
  "Events",
  "Participants",
  "Reports",
  "Organizer",
] as const;
export type OrganizerSection = (typeof organizerSections)[number];
const sectionIcons: Record<
  OrganizerSection,
  ComponentProps<typeof Ionicons>["name"]
> = {
  Overview: "grid-outline",
  Events: "calendar-outline",
  Participants: "people-outline",
  Reports: "stats-chart-outline",
  Organizer: "person-circle-outline",
};
export function OrganizerNavigation({
  section,
  onChange,
  desktop,
  name,
}: {
  section: OrganizerSection;
  onChange: (section: OrganizerSection) => void;
  desktop: boolean;
  name: string;
}) {
  if (!desktop)
    return (
      <DashboardTabs
        items={organizerSections}
        value={section}
        onChange={onChange}
        label="Organizer navigation"
      />
    );
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Organizer navigation"
      style={{
        width: 180,
        borderRadius: 13,
        backgroundColor: "#142431",
        padding: 13,
        gap: 7,
      }}
    >
      <View style={{ padding: 9, paddingBottom: 18, gap: 9 }}>
        <Ionicons name="trail-sign-outline" size={24} color="#8DDDBF" />
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
          StravaKinda.
        </Text>
        <Text style={{ color: "#B9CCD5", fontSize: 10, lineHeight: 17 }}>
          {name || "Organizer workspace"}
          {"\n"}Preview · not verified
        </Text>
      </View>
      {organizerSections.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="tab"
          accessibilityLabel={item}
          aria-selected={section === item}
          onPress={() => onChange(item)}
          style={{
            minHeight: 45,
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            padding: 10,
            borderRadius: 8,
            backgroundColor: section === item ? "#28453F" : "transparent",
          }}
        >
          <Ionicons
            name={sectionIcons[item]}
            size={17}
            color={section === item ? "#8DDDBF" : "#B9CCD5"}
          />
          <Text
            style={{
              color: section === item ? "#FFFFFF" : "#B9CCD5",
              fontSize: 12,
            }}
          >
            {item}
          </Text>
        </Pressable>
      ))}
      <View style={{ padding: 10, paddingTop: 20, gap: 7 }}>
        <Ionicons name="lock-closed-outline" color="#FF936E" size={17} />
        <Text style={{ color: "#B9CCD5", fontSize: 10, lineHeight: 17 }}>
          Publishing and payments are not connected.
        </Text>
      </View>
    </View>
  );
}
export function OrganizerEmptyTable({
  title,
  columns,
  detail,
  icon = "people-outline",
}: {
  title: string;
  columns: string[];
  detail: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
}) {
  const c = useColors();
  return (
    <TrainingPanel>
      <DiscoveryTitle title={title} />
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
            backgroundColor: c.raised,
            padding: 13,
            gap: 8,
          }}
        >
          {columns.map((column) => (
            <Text
              key={column}
              style={{ flex: 1, minWidth: 0, color: c.muted, fontSize: 10 }}
            >
              {column}
            </Text>
          ))}
        </View>
        <View style={{ alignItems: "center", padding: 24, gap: 12 }}>
          <Ionicons name={icon} size={27} color={c.forest} />
          <Text
            style={{
              color: c.muted,
              fontSize: 12,
              lineHeight: 20,
              textAlign: "center",
              maxWidth: 410,
            }}
          >
            {detail}
          </Text>
        </View>
      </View>
    </TrainingPanel>
  );
}
export function OrganizerDraftCard({
  draft,
  onEdit,
  desktop,
  onPreview,
  onDelete,
}: {
  draft: EventDraft;
  onEdit: () => void;
  desktop: boolean;
  onPreview?: () => void;
  onDelete?: () => void;
}) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        overflow: "hidden",
        flexDirection: desktop ? "row" : "column",
      }}
    >
      <View
        style={{
          width: desktop ? 125 : "100%",
          height: desktop ? undefined : 140,
          alignSelf: "stretch",
        }}
      >
        <Image
          source={discoveryPhotos[draft.banner]}
          accessibilityLabel={`${draft.title} preview banner · editorial artwork`}
          resizeMode="cover"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        />
      </View>
      <View
        style={{
          flex: desktop ? 1 : undefined,
          minWidth: 0,
          padding: 15,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{ color: c.text, fontSize: 16, fontWeight: "700", flex: 1 }}
          >
            {draft.title}
          </Text>
          <Text
            style={{
              color: c.accent,
              fontSize: 9,
              fontWeight: "700",
              backgroundColor: c.accentSoft,
              borderRadius: 4,
              padding: 5,
            }}
          >
            PREVIEW DRAFT
          </Text>
        </View>
        <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17 }}>
          {draft.date} · {draft.location} · {draft.sport}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(
            [
              { label: "Edit", icon: "create-outline", action: onEdit },
              { label: "Preview", icon: "eye-outline", action: onPreview },
              { label: "Delete", icon: "trash-outline", action: onDelete },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} ${draft.title}`}
              onPress={item.action}
              style={{
                minHeight: 44,
                flexDirection: "row",
                gap: 6,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 12,
                borderRadius: 7,
                backgroundColor: item.label === "Edit" ? c.greenSoft : c.raised,
              }}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={item.label === "Edit" ? c.forest : c.muted}
              />
              <Text style={{ fontSize: 12, color: c.text, fontWeight: "600" }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

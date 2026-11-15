import { Image, View } from "react-native";
import { AthleteText as Text } from "./athlete";
import { discoveryPhotos, DiscoveryTitle } from "./discovery-ui";
import { TrainingPanel } from "./athlete-training";
import { DashboardNotice } from "./dashboard-ui";
import { CommunityAction } from "./community-ui";
import { useColors } from "./ui";
import type { EventDraft } from "../features/organizer/drafts";
export function OrganizerDraftPreview({
  draft,
  onBack,
  onEdit,
  onDelete,
}: {
  draft: EventDraft;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 18 }}>
      <DashboardNotice
        title="Unpublished event preview"
        detail="Private local plan. This is not a confirmed event or a registration page."
      />
      <TrainingPanel>
        <Image
          source={discoveryPhotos[draft.banner]}
          accessibilityLabel={`${draft.title} detail banner · editorial artwork`}
          resizeMode="cover"
          style={{ width: "100%", height: 220, borderRadius: 10 }}
        />
        <DiscoveryTitle title={draft.title} detail={draft.sport} />
        <Text style={{ color: c.forest, fontSize: 14, fontWeight: "700" }}>
          {draft.date} · Proposed date
        </Text>
        <Text style={{ color: c.text, fontSize: 14, lineHeight: 22 }}>
          {draft.location}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 22 }}>
          {draft.description || "No description added yet."}
        </Text>
        <DiscoveryTitle
          title="Proposed schedule"
          detail="Local event planning"
        />
        <Text style={{ color: c.text, fontSize: 13, lineHeight: 23 }}>
          {draft.schedule || "No schedule added yet."}
        </Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>
          Planning capacity: {draft.capacity || "Not specified"} · No live
          registrations
        </Text>
        <CommunityAction title="Edit this draft" onPress={onEdit} />
        <CommunityAction
          title="Delete this draft"
          secondary
          onPress={onDelete}
        />
        <CommunityAction title="Back to drafts" secondary onPress={onBack} />
      </TrainingPanel>
    </View>
  );
}

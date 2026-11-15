import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { Image, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AthletePage, AthleteText as Text } from "../../components/athlete";
import { TrainingPanel } from "../../components/athlete-training";
import {
  discoveryPhotos,
  DiscoverySearch,
  DiscoveryTitle,
} from "../../components/discovery-ui";
import { CommunityAction } from "../../components/community-ui";
import {
  DashboardHeader,
  DashboardMetric,
  DashboardNotice,
  DashboardTabs,
  DataBarChart,
} from "../../components/dashboard-ui";
import {
  OrganizerDraftCard,
  OrganizerEmptyTable,
  OrganizerNavigation,
  type OrganizerSection,
} from "../../components/organizer-ui";
import { useColors } from "../../components/ui";
import { useSession } from "../../hooks/useSession";
import {
  emptyEventDraft,
  type EventDraft,
} from "../../features/organizer/drafts";

import { randomUUID } from "expo-crypto";
import {
  loadWorkspace,
  updateWorkspace,
  resetWorkspace,
} from "../../features/organizer/repository";
import {
  emptyWorkspace,
  planningSummary,
  selectDrafts,
  draftSorts,
  type OrganizerProfile,
  type Workspace,
} from "../../features/organizer/workspace";
import { OrganizerDraftPreview } from "../../components/organizer-preview";
const EventDraftForm = lazy(() =>
  import("../../components/organizer-form").then((m) => ({
    default: m.EventDraftForm,
  })),
);
const OrganizerProfileForm = lazy(() =>
  import("../../components/organizer-profile").then((m) => ({
    default: m.OrganizerProfileForm,
  })),
);
export default function Organizer() {
  const session = useSession();
  return (
    <OrganizerWorkspace key={session?.user.id ?? "guest"} session={session} />
  );
}
function OrganizerWorkspace({
  session,
}: {
  session: ReturnType<typeof useSession>;
}) {
  const c = useColors(),
    width = useWindowDimensions().width,
    desktop = width >= 1100,
    tablet = width >= 700;
  const [section, setSection] = useState<OrganizerSection>("Overview");
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editor, setEditor] = useState<EventDraft | null>(null);
  const [preview, setPreview] = useState<EventDraft | null>(null);
  const [deleting, setDeleting] = useState<EventDraft | null>(null);
  const [message, setMessage] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All drafts");
  const [sort, setSort] = useState<string>("Recently updated");
  const [reportRange, setReportRange] = useState("All dates");
  const [participantSearch, setParticipantSearch] = useState(""),
    [registrationStatus, setRegistrationStatus] = useState("All statuses");
  const ownerId = session?.user.id;
  const { drafts, profile } = workspace;
  const reload = () =>
    loadWorkspace(ownerId)
      .then((value) => {
        setWorkspace(value);
        setLoaded(true);
        setLoadError("");
      })
      .catch(() =>
        setLoadError(
          "Device storage is unavailable or damaged. Your existing plans have not been replaced. Enable device storage and retry.",
        ),
      );
  useEffect(() => {
    let active = true;
    loadWorkspace(ownerId)
      .then((value) => {
        if (active) {
          setWorkspace(value);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            "Device storage is unavailable or damaged. Your existing plans have not been replaced. Enable device storage and retry.",
          );
      });
    return () => {
      active = false;
    };
  }, [ownerId]);
  const persist = async (change: (value: Workspace) => Workspace) => {
    setBusy(true);
    try {
      setWorkspace(await updateWorkspace(ownerId, change));
    } catch {
      throw new Error(
        "Could not save to device storage. Your changes remain in this form. Check storage availability and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const localDate = new Date();
  const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
  const summary = useMemo(
    () => planningSummary(drafts, today),
    [drafts, today],
  );
  const reportDrafts = useMemo(
    () =>
      drafts.filter(
        (d) =>
          reportRange === "All dates" ||
          (reportRange === "Upcoming"
            ? d.date >= today
            : d.date.startsWith(today.slice(0, 7))),
      ),
    [drafts, reportRange, today],
  );
  const reportSummary = useMemo(
    () => planningSummary(reportDrafts, today),
    [reportDrafts, today],
  );
  const navigate = (value: OrganizerSection) => {
    if (busy) return;
    setEditor(null);
    setPreview(null);
    setDeleting(null);
    setSection(value);
    setMessage("");
  };
  const create = () => {
    if (busy) return;
    setDeleting(null);
    setPreview(null);
    setSection("Events");
    setMessage("");
    setEditor(emptyEventDraft());
  };
  const save = async (draft: EventDraft) => {
    const now = Date.now();
    const next = {
      ...draft,
      id: draft.id || randomUUID(),
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    };
    await persist((current) => ({
      ...current,
      drafts: current.drafts.some((d) => d.id === next.id)
        ? current.drafts.map((d) => (d.id === next.id ? next : d))
        : [next, ...current.drafts],
    }));
    setEditor(null);
    setSection("Events");
    setFilter("All drafts");
    setSearch("");
    setMessage(
      "Draft saved on this device. Unpublished; not synchronized or publicly visible.",
    );
  };
  const saveProfile = async (next: OrganizerProfile) => {
    await persist((current) => ({ ...current, profile: next }));
    setMessage(
      "Organizer profile saved privately on this device. Not verified or publicly visible.",
    );
  };
  const remove = async () => {
    if (!deleting) return;
    try {
      await persist((current) => ({
        ...current,
        drafts: current.drafts.filter((d) => d.id !== deleting.id),
      }));
      setDeleting(null);
      setPreview(null);
      setMessage("Draft deleted from this device.");
    } catch {
      setMessage(
        "Could not delete this draft. Your saved plan is unchanged. Check device storage and retry.",
      );
    }
  };
  const shown = useMemo(
    () =>
      section === "Events" ? selectDrafts(drafts, search, filter, sort) : [],
    [drafts, search, filter, sort, section],
  );
  const recent = useMemo(
    () =>
      selectDrafts(drafts, "", "All drafts", "Recently updated").slice(0, 3),
    [drafts],
  );
  if (!loaded)
    return (
      <AthletePage>
        <DashboardHeader
          title="Organizer studio"
          subtitle="Your local planning workspace"
        />
        <DashboardNotice
          title={
            loadError ? "Device storage unavailable" : "Opening your workspace"
          }
          detail={loadError || "Loading locally saved plans…"}
        />
        {loadError ? (
          <CommunityAction title="Retry local storage" onPress={reload} />
        ) : null}
        {loadError ? (
          <CommunityAction
            title="Reset local organizer workspace"
            secondary
            onPress={() => setResetting(true)}
          />
        ) : null}
        {resetting ? (
          <TrainingPanel>
            <DiscoveryTitle
              title="Erase local plans and profile?"
              detail="Only this organizer workspace is affected."
            />
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>
              This permanently deletes event drafts and organizer contact
              details saved for this workspace on this device.
            </Text>
            <CommunityAction
              title="Confirm erase organizer workspace"
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  setWorkspace(await resetWorkspace(ownerId));
                  setLoaded(true);
                  setLoadError("");
                  setResetting(false);
                } catch {
                  setLoadError(
                    "Could not reset device storage. Enable storage and retry.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />
            <CommunityAction
              title="Cancel reset"
              secondary
              disabled={busy}
              onPress={() => setResetting(false)}
            />
          </TrainingPanel>
        ) : null}
      </AthletePage>
    );
  const summaryCards = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {[
        [
          String(section === "Reports" ? reportDrafts.length : drafts.length),
          "Preview drafts",
          "Saved on this device",
          "document-text-outline",
        ],
        [
          String(
            (section === "Reports" ? reportSummary : summary).upcoming.length,
          ),
          "Proposed dates",
          "Today and ahead · unpublished",
          "calendar-outline",
        ],
        [
          String(
            (section === "Reports" ? reportSummary : summary).categories.filter(
              (item) => item.value > 0,
            ).length,
          ),
          "Sport categories",
          "Represented in your drafts",
          "fitness-outline",
        ],
        [
          String((section === "Reports" ? reportSummary : summary).scheduled),
          "With schedules",
          "Local plans with an agenda",
          "time-outline",
        ],
      ].map(([value, label, detail, icon], i) => (
        <View
          key={label}
          style={{
            width: tablet ? "22%" : "47%",
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          <DashboardMetric
            value={value}
            label={label}
            detail={detail}
            icon={icon as ComponentProps<typeof Ionicons>["name"]}
            testID={`organizer-metric-${i}`}
          />
        </View>
      ))}
    </View>
  );
  return (
    <AthletePage>
      <DashboardHeader
        title="Organizer studio"
        subtitle="Bring people to the starting line."
        action={{
          icon: "add-outline",
          label: "New preview event",
          onPress: create,
        }}
      />
      <DashboardNotice
        title="Organizer workspace preview"
        detail="Drafts and contact details are saved privately on this device. Unpublished and not synchronized. Live registrations, publishing and payments are unavailable."
      />
      <View
        style={{
          flexDirection: desktop ? "row" : "column",
          gap: 22,
          alignItems: "stretch",
        }}
      >
        <OrganizerNavigation
          section={section}
          onChange={navigate}
          desktop={desktop}
          name={profile.name}
        />
        <View style={{ flex: desktop ? 1 : undefined, minWidth: 0, gap: 18 }}>
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <DiscoveryTitle
              title={
                section === "Overview"
                  ? "Dashboard"
                  : section === "Organizer"
                    ? "Organizer profile"
                    : section
              }
              detail="Local planning workspace"
            />
            {!editor && section !== "Organizer" ? (
              <CommunityAction title="Create preview draft" onPress={create} />
            ) : null}
          </View>
          {message ? (
            <Text
              accessibilityRole="alert"
              style={{
                color: message.startsWith("Could not") ? c.accent : c.forest,
                fontSize: 12,
                lineHeight: 19,
              }}
            >
              {message}
            </Text>
          ) : null}
          {deleting ? (
            <TrainingPanel>
              <DiscoveryTitle
                title="Delete this draft?"
                detail={deleting.title}
              />
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
                This permanently removes the local event plan. Nothing has been
                published.
              </Text>
              <CommunityAction
                title="Confirm delete draft"
                disabled={busy}
                onPress={remove}
              />
              <CommunityAction
                title="Keep draft"
                secondary
                disabled={busy}
                onPress={() => setDeleting(null)}
              />
            </TrainingPanel>
          ) : null}
          {editor ? (
            <Suspense
              fallback={
                <Text style={{ color: c.muted }}>Opening event editor…</Text>
              }
            >
              <EventDraftForm
                key={editor.id || "new"}
                initial={editor}
                onSave={save}
                onCancel={() => setEditor(null)}
                tablet={tablet}
                busy={busy}
              />
            </Suspense>
          ) : preview ? (
            <OrganizerDraftPreview
              draft={preview}
              onBack={() => setPreview(null)}
              onEdit={() => {
                setEditor(preview);
                setPreview(null);
              }}
              onDelete={() => setDeleting(preview)}
            />
          ) : section === "Overview" ? (
            <>
              <View
                style={{
                  height: 142,
                  borderRadius: 13,
                  overflow: "hidden",
                  backgroundColor: c.navy,
                }}
              >
                <Image
                  source={discoveryPhotos.lake}
                  accessibilityLabel="Nepal-inspired organizer workspace editorial cover"
                  resizeMode="cover"
                  style={{ width: "100%", height: "100%" }}
                />
                <View
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(10,30,40,.4)",
                    justifyContent: "flex-end",
                    padding: 18,
                    gap: 7,
                  }}
                >
                  <Text
                    style={{
                      color: "#D5F2E4",
                      fontSize: 9,
                      fontWeight: "700",
                      letterSpacing: 1.5,
                    }}
                  >
                    MADE FOR NEPAL · PREVIEW
                  </Text>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 24,
                      fontWeight: "700",
                      letterSpacing: -0.5,
                    }}
                  >
                    Your next starting line.
                  </Text>
                  <Text style={{ color: "#FFFFFF", fontSize: 11 }}>
                    A thoughtful space to plan a shared adventure.
                  </Text>
                </View>
              </View>
              {summaryCards}
              <TrainingPanel>
                <DiscoveryTitle
                  title="Event management"
                  detail="Recent local drafts · never published listings"
                />
                {drafts.length ? (
                  recent.map((draft) => (
                    <OrganizerDraftCard
                      key={draft.id}
                      draft={draft}
                      onEdit={() => {
                        setSection("Events");
                        setEditor(draft);
                      }}
                      onPreview={() => {
                        setSection("Events");
                        setPreview(draft);
                      }}
                      onDelete={() => setDeleting(draft)}
                      desktop={tablet}
                    />
                  ))
                ) : (
                  <View style={{ alignItems: "center", padding: 18, gap: 12 }}>
                    <Ionicons
                      name="calendar-outline"
                      color={c.forest}
                      size={30}
                    />
                    <Text
                      style={{ color: c.text, fontSize: 16, fontWeight: "700" }}
                    >
                      A fresh page for your next event.
                    </Text>
                    <Text
                      style={{
                        color: c.muted,
                        fontSize: 12,
                        lineHeight: 20,
                        textAlign: "center",
                      }}
                    >
                      Start planning with a locally saved draft. Live event
                      inventory is unavailable.
                    </Text>
                    <CommunityAction
                      secondary
                      title="Plan a preview event"
                      onPress={create}
                    />
                  </View>
                )}
              </TrainingPanel>
              <TrainingPanel>
                <DiscoveryTitle
                  title="On the planning horizon"
                  detail="Proposed dates · not confirmed events"
                />
                {summary.upcoming.length ? (
                  summary.upcoming.slice(0, 3).map((d) => (
                    <View
                      key={d.id}
                      style={{
                        borderBottomWidth: 1,
                        borderColor: c.border,
                        paddingVertical: 10,
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: c.forest,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {d.date} · {d.sport}
                      </Text>
                      <Text style={{ color: c.text, fontSize: 15 }}>
                        {d.title}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}
                  >
                    No upcoming proposed dates. Add a date to your next local
                    event plan.
                  </Text>
                )}
                <Text style={{ color: c.muted, fontSize: 11 }}>
                  {summary.past} past proposed dates · All {drafts.length} plans
                  remain unpublished
                </Text>
              </TrainingPanel>
              <TrainingPanel>
                <DiscoveryTitle
                  title="Draft categories"
                  detail="Your actual locally saved plans"
                />
                <DataBarChart
                  data={summary.categories}
                  formatValue={String}
                  label="Local draft category distribution"
                  emptyMessage="Your draft categories will appear as you start planning."
                />
              </TrainingPanel>
              <OrganizerEmptyTable
                title="Recent registrations"
                columns={["Participant", "Category", "Status"]}
                detail="No registration service is connected. No participant records or counts are displayed."
              />
            </>
          ) : section === "Events" ? (
            <>
              <DiscoverySearch
                label="Search preview events"
                placeholder="Search event names, places or descriptions"
                value={search}
                onChangeText={setSearch}
              />
              <DashboardTabs
                items={[
                  "All drafts",
                  "Running",
                  "Cycling",
                  "Hiking",
                  "Walking",
                  "Trail running",
                ]}
                value={filter}
                onChange={setFilter}
                label="Preview event filter"
              />
              <DashboardTabs
                items={draftSorts}
                value={sort}
                onChange={setSort}
                label="Draft sort order"
              />
              <Text style={{ color: c.muted, fontSize: 12 }}>
                {shown.length} local drafts · Unpublished
              </Text>
              {shown.length ? (
                shown.map((draft) => (
                  <OrganizerDraftCard
                    key={draft.id}
                    draft={draft}
                    onEdit={() => setEditor(draft)}
                    onPreview={() => {
                      setSection("Events");
                      setPreview(draft);
                    }}
                    onDelete={() => setDeleting(draft)}
                    desktop={tablet}
                  />
                ))
              ) : (
                <OrganizerEmptyTable
                  title={
                    search || filter !== "All drafts"
                      ? "No matching preview drafts"
                      : "No preview drafts yet"
                  }
                  columns={["Event", "Proposed date", "Status"]}
                  icon="calendar-outline"
                  detail="Create a locally saved draft to start planning. Nothing here is a confirmed or published event."
                />
              )}
              <CommunityAction
                title="Publish event · unavailable"
                disabled
                onPress={() => undefined}
              />
            </>
          ) : section === "Participants" ? (
            <>
              {summaryCards}
              <DiscoverySearch
                label="Search participants"
                placeholder="Search when live registrations connect"
                value={participantSearch}
                onChangeText={setParticipantSearch}
              />
              <DashboardTabs
                items={["All statuses", "Pending", "Confirmed", "Cancelled"]}
                value={registrationStatus}
                onChange={setRegistrationStatus}
                label="Registration filter"
              />
              <OrganizerEmptyTable
                title="Participant overview"
                columns={["Participant", "Event", "Registration"]}
                detail={
                  participantSearch || registrationStatus !== "All statuses"
                    ? "No live records can be searched or filtered yet. Registration backend not connected."
                    : "Live registrations are unavailable. Participant names, payments and check-ins require a secure backend."
                }
              />
              <TrainingPanel>
                <DiscoveryTitle
                  title="Registration status"
                  detail="Status legend · presentation only"
                />
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
                >
                  {["Pending", "Confirmed", "Cancelled"].map((status) => (
                    <View
                      key={status}
                      style={{
                        backgroundColor: c.raised,
                        padding: 10,
                        borderRadius: 7,
                      }}
                    >
                      <Text style={{ color: c.muted, fontSize: 11 }}>
                        {status} · —
                      </Text>
                    </View>
                  ))}
                </View>
                <CommunityAction
                  title="Export participants · unavailable"
                  disabled
                  onPress={() => undefined}
                />
                <CommunityAction
                  title="Take registration payments · unavailable"
                  disabled
                  onPress={() => undefined}
                />
              </TrainingPanel>
            </>
          ) : section === "Reports" ? (
            <>
              <DashboardTabs
                items={["All dates", "Upcoming", "This month"]}
                value={reportRange}
                onChange={setReportRange}
                label="Planning report date filter"
              />
              <TrainingPanel>
                <DiscoveryTitle
                  title="Local planning summary"
                  detail="Filtered by proposed event date"
                />
                <Text style={{ color: c.text, fontSize: 14, lineHeight: 24 }}>
                  {reportDrafts.length} unpublished drafts ·{" "}
                  {reportSummary.scheduled} with schedules ·{" "}
                  {reportSummary.upcoming.length} upcoming proposed dates
                </Text>
              </TrainingPanel>
              {summaryCards}
              <TrainingPanel>
                <DiscoveryTitle
                  title="Registration trend"
                  detail="Unavailable · registration backend required"
                />
                <View
                  accessibilityLabel="Registration chart unavailable: no connected data"
                  style={{
                    height: 165,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {[25, 80, 135].map((top) => (
                    <View
                      key={top}
                      style={{
                        position: "absolute",
                        top,
                        left: 0,
                        right: 0,
                        height: 1,
                        backgroundColor: c.border,
                      }}
                    />
                  ))}
                  <View
                    style={{
                      padding: 12,
                      backgroundColor: c.panel,
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      color={c.muted}
                      size={21}
                    />
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                      Waiting for registration data
                    </Text>
                  </View>
                </View>
                <Text style={{ color: c.muted, fontSize: 11 }}>
                  Revenue and conversion reports require verified registration
                  and payment records.
                </Text>
              </TrainingPanel>
              <TrainingPanel>
                <DiscoveryTitle
                  title="Draft planning overview"
                  detail="Actual saved local drafts · not live event statistics"
                />
                <DataBarChart
                  data={reportSummary.categories}
                  formatValue={String}
                  label="Preview drafts by sport"
                  emptyMessage="No local drafts match this date range."
                />
                <CommunityAction
                  title="Export financial report · unavailable"
                  disabled
                  onPress={() => undefined}
                />
              </TrainingPanel>
            </>
          ) : (
            <Suspense
              fallback={
                <Text style={{ color: c.muted }}>
                  Opening organizer profile…
                </Text>
              }
            >
              <OrganizerProfileForm
                key={profile.name + profile.email}
                initial={profile}
                onSave={saveProfile}
              />
            </Suspense>
          )}
        </View>
      </View>
      <TrainingPanel>
        <DiscoveryTitle
          title="Explore the athlete experience"
          detail="Your existing app stays connected."
        />
        <View style={{ flexDirection: tablet ? "row" : "column", gap: 10 }}>
          <View style={{ flex: tablet ? 1 : undefined }}>
            <CommunityAction
              secondary
              title="View Nepal event demos"
              onPress={() => router.push("/events")}
            />
          </View>
          <View style={{ flex: tablet ? 1 : undefined }}>
            <CommunityAction
              secondary
              title="View training analytics"
              onPress={() => router.push("/analytics")}
            />
          </View>
        </View>
      </TrainingPanel>
    </AthletePage>
  );
}

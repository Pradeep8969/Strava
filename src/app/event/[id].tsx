import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AthletePage,
  AthleteText as Text,
  IconButton,
} from "../../../components/athlete";
import {
  DemoBadge,
  DiscoveryButton,
  DiscoveryTitle,
  Photo,
} from "../../../components/discovery-ui";
import { useColors } from "../../../components/ui";
import { demoEvents } from "../../../features/events/catalog";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    c = useColors();
  const event = demoEvents.find((item) => item.id === id),
    wide = useWindowDimensions().width >= 1100;
  const [tab, setTab] = useState<"Overview" | "Organizer">("Overview");
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/events");
  const panel = {
    backgroundColor: c.panel,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 13,
    padding: 18,
    gap: 13,
  } as const;
  if (!event)
    return (
      <AthletePage>
        <Stack.Screen options={{ headerShown: false }} />
        <DiscoveryTitle
          title="Event unavailable"
          detail="This demonstration could not be found."
        />
        <DiscoveryButton
          title="Back to events"
          onPress={() => router.replace("/events")}
        />
      </AthletePage>
    );
  return (
    <AthletePage>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton icon="chevron-back" label="Back to events" onPress={back} />
        <Text
          accessibilityRole="header"
          style={{ flex: 1, color: c.text, fontWeight: "700", fontSize: 18 }}
        >
          Event preview
        </Text>
        <DemoBadge />
      </View>
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: wide ? 1.6 : undefined, minWidth: 0, gap: 17 }}>
          <View style={{ borderRadius: 14, overflow: "hidden" }}>
            <Photo
              kind={event.photo}
              height={wide ? 380 : 240}
              label={`${event.title} · Nepal-inspired editorial artwork`}
            />
            <View style={{ position: "absolute", bottom: 12, left: 12 }}>
              <DemoBadge light label="VISUAL DEMONSTRATION" />
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: c.text,
                fontSize: 27,
                fontWeight: "700",
                lineHeight: 32,
                letterSpacing: -0.7,
              }}
            >
              {event.title}
            </Text>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              Not a confirmed event · all dates and formats are illustrative.
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View
              style={{
                flexGrow: 1,
                flexBasis: 150,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: c.panel,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 11,
                padding: 14,
              }}
            >
              <Ionicons name="calendar-outline" color={c.forest} size={21} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: c.muted, fontSize: 10 }}>
                  Sample date
                </Text>
                <Text
                  style={{ color: c.text, fontSize: 12, fontWeight: "600" }}
                >
                  {event.date}
                </Text>
              </View>
            </View>
            <View
              style={{
                flexGrow: 1,
                flexBasis: 150,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: c.panel,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 11,
                padding: 14,
              }}
            >
              <Ionicons name="location-outline" color={c.forest} size={21} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: c.muted, fontSize: 10 }}>
                  Concept location
                </Text>
                <Text
                  style={{ color: c.text, fontSize: 12, fontWeight: "600" }}
                >
                  {event.location}
                </Text>
              </View>
            </View>
          </View>
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            {(["Overview", "Organizer"] as const).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityLabel={item}
                accessibilityState={{ selected: tab === item }}
                onPress={() => setTab(item)}
                style={{
                  flex: 1,
                  minHeight: 45,
                  justifyContent: "center",
                  alignItems: "center",
                  borderBottomWidth: 2,
                  borderBottomColor: item === tab ? c.accent : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: item === tab ? c.text : c.muted,
                  }}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          {tab === "Overview" ? (
            <View style={panel}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
                A day outside, together.
              </Text>
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 22 }}>
                {event.description}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[event.category, `${event.format} · demo`].map((item) => (
                  <View
                    key={item}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderRadius: 6,
                      backgroundColor: c.greenSoft,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: c.forest,
                        fontWeight: "600",
                      }}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={panel}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: c.greenSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="people-outline" color={c.forest} size={23} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{ color: c.text, fontWeight: "700", fontSize: 15 }}
                  >
                    Demonstration organizer
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 11 }}>
                    Not a verified organization
                  </Text>
                </View>
              </View>
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>
                An organizer’s introduction, contact information and
                verification status will appear here when real event publishing
                is available.
              </Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>
                Contact details: unavailable for this demo.
              </Text>
            </View>
          )}
        </View>
        <View
          style={{
            width: wide ? 300 : "100%",
            gap: 16,
            alignSelf: "flex-start",
          }}
        >
          <View style={panel}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
              At a glance
            </Text>
            <Detail label="Sport" value={event.category} />
            <Detail label="Sample format" value={event.format} />
            <Detail label="Listing status" value="Visual demonstration" />
            <Detail label="Organizer" value="Not verified" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Registration unavailable"
              accessibilityState={{ disabled: true }}
              disabled
              style={{
                minHeight: 48,
                backgroundColor: c.raised,
                borderRadius: 9,
                flexDirection: "row",
                gap: 7,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="lock-closed-outline" color={c.muted} size={15} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: c.muted }}>
                Registration unavailable
              </Text>
            </Pressable>
            <Text style={{ color: c.muted, fontSize: 10, lineHeight: 16 }}>
              No tickets, payments or participant bookings are available.
            </Text>
          </View>
          <DiscoveryButton
            secondary
            title="Explore local communities"
            onPress={() => router.push("/community")}
          />
        </View>
      </View>
    </AthletePage>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: c.muted, fontSize: 10 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>
        {value}
      </Text>
    </View>
  );
}

import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AthletePage,
  AthleteText as Text,
  IconButton,
} from "../../../components/athlete";
import {
  DemoBadge,
  DiscoverySearch,
  DiscoveryTitle,
  Photo,
  SportFilters,
} from "../../../components/discovery-ui";
import { useColors } from "../../../components/ui";
import { filterEvents, type DemoEvent } from "../../../features/events/catalog";
import type { DiscoverySport } from "../../../features/discovery/catalog";

export default function Events() {
  const c = useColors(),
    wide = useWindowDimensions().width >= 1100;
  const [category, setCategory] = useState<DiscoverySport>("All"),
    [search, setSearch] = useState("");
  const shown = filterEvents(search, category),
    featured = shown[0];
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
        <View style={{ flex: 1, gap: 5 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: 25,
              fontWeight: "700",
              color: c.text,
              letterSpacing: -0.7,
            }}
          >
            Nepal events
          </Text>
          <Text style={{ fontSize: 12, color: c.muted }}>
            Find your next shared adventure.
          </Text>
        </View>
        <IconButton
          icon="people-outline"
          label="Explore local communities"
          onPress={() => router.push("/community")}
        />
      </View>
      <DiscoverySearch
        label="Search demonstration events"
        placeholder="Search events, sports or places"
        value={search}
        onChangeText={setSearch}
      />
      <SportFilters value={category} onChange={setCategory} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Ionicons
          name="information-circle-outline"
          color={c.accent}
          size={16}
        />
        <Text style={{ flex: 1, color: c.muted, fontSize: 11, lineHeight: 17 }}>
          Design preview · all events and dates below are demonstrations.
        </Text>
      </View>
      {featured ? (
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            gap: 24,
            alignItems: "stretch",
          }}
        >
          <View style={{ flex: wide ? 1.25 : undefined, minWidth: 0, gap: 13 }}>
            <DiscoveryTitle title="Featured events" />
            <EventCard event={featured} featured />
          </View>
          <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 13 }}>
            <DiscoveryTitle
              title={
                shown.length > 1 ? "More ways to move" : "Explore the event"
              }
              detail="Runs, rides and days outside"
            />
            {shown.slice(1).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
            {shown.length === 1 ? (
              <View
                style={{
                  padding: 18,
                  borderRadius: 13,
                  backgroundColor: c.panel,
                  borderWidth: 1,
                  borderColor: c.border,
                  gap: 9,
                }}
              >
                <Text
                  style={{ color: c.text, fontSize: 16, fontWeight: "700" }}
                >
                  A place for Nepal’s organizers.
                </Text>
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>
                  Verified listings and organizer submissions are planned. Open
                  the demo to explore the event page design.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <View
          style={{
            padding: 24,
            borderRadius: 13,
            backgroundColor: c.panel,
            gap: 8,
          }}
        >
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
            No matching demonstration events
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            Try another sport or clear your search.
          </Text>
        </View>
      )}
      <Text style={{ fontSize: 10, color: c.muted, lineHeight: 16 }}>
        Demonstration listings · registration unavailable. Nepal-inspired
        imagery.
      </Text>
    </AthletePage>
  );
}
function EventCard({
  event,
  featured = false,
}: {
  event: DemoEvent;
  featured?: boolean;
}) {
  const c = useColors();
  const wide = useWindowDimensions().width >= 1100;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View demo event ${event.title}`}
      onPress={() => router.push(`/event/${event.id}`)}
      style={({ pressed }) => ({
        backgroundColor: c.panel,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        overflow: "hidden",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View>
        <Photo
          kind={event.photo}
          height={featured ? (wide ? 340 : 230) : 160}
          label={`${event.title} · demonstration event editorial image`}
        />
        <View style={{ position: "absolute", top: 12, left: 12 }}>
          <DemoBadge light />
        </View>
        <View
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            borderRadius: 6,
            backgroundColor: "rgba(14,32,42,.86)",
            paddingHorizontal: 9,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "600" }}>
            {event.category}
          </Text>
        </View>
        {featured ? (
          <View
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              backgroundColor: "rgba(14,32,42,.86)",
              paddingHorizontal: 11,
              paddingVertical: 8,
              borderRadius: 7,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Ionicons name="sparkles-outline" size={12} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "600" }}>
              FEATURED CONCEPT
            </Text>
          </View>
        ) : null}
        <View
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            backgroundColor: c.panel,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            alignItems: "center",
            gap: 1,
          }}
        >
          <Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>
            {event.month}
          </Text>
          <Text style={{ color: c.text, fontSize: 23, fontWeight: "700" }}>
            {event.day}
          </Text>
          <Text style={{ color: c.muted, fontSize: 8 }}>SAMPLE DATE</Text>
        </View>
      </View>
      <View style={{ padding: 15, gap: 9 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              flex: 1,
              color: c.text,
              fontSize: featured ? 20 : 17,
              fontWeight: "700",
              lineHeight: featured ? 25 : 22,
            }}
          >
            {event.title}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={c.muted} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="location-outline" size={13} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 11 }}>{event.location}</Text>
        </View>
        <Text style={{ color: c.muted, fontSize: 11 }}>
          Sample date · {event.date}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            flexWrap: "wrap",
          }}
        >
          <View
            style={{
              backgroundColor: c.greenSoft,
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: 5,
            }}
          >
            <Text style={{ color: c.forest, fontSize: 10, fontWeight: "600" }}>
              {event.category}
            </Text>
          </View>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {event.format} · demo format
          </Text>
        </View>
        {featured ? (
          <View
            style={{
              marginTop: 3,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: c.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700" }}>
              Explore event preview
            </Text>
            <Ionicons name="arrow-forward-circle" size={25} color={c.accent} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

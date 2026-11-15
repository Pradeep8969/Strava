import { useCallback, useMemo, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
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
  DemoBadge,
  Photo,
  SportFilters,
} from "../../../components/discovery-ui";
import DiscoveryMap from "../../../components/DiscoveryMap";
import { useSession } from "../../../hooks/useSession";
import { canAccessLocalWorkout } from "../../../features/auth/local-access";
import type { MapRoute } from "../../../features/discovery/map-data";
import { useColors } from "../../../components/ui";
import { getValue } from "../../../services/database";
import { useApp } from "../../../store/app";
import { length } from "../../../utils/format";
import {
  filterIdeas,
  waypointDistance,
  waypointElevation,
  type Area,
  type DiscoverySport,
  type SavedRoute,
} from "../../../features/discovery/catalog";

export default function Explore() {
  const c = useColors(),
    wide = useWindowDimensions().width >= 1100;
  const units = useApp((state) => state.preferences.units);
  const workouts = useApp((state) => state.workouts);
  const userId = useSession()?.user.id;
  const [sport, setSport] = useState<DiscoverySport>("All"),
    [search, setSearch] = useState("");
  const [routes, setRoutes] = useState<SavedRoute[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [area, setArea] = useState<Area>("valley"),
    [error, setError] = useState("");
  const [destination, setDestination] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getValue<SavedRoute[]>("routes")
        .then((saved) => {
          if (active) {
            setRoutes(saved ?? []);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
      return () => {
        active = false;
      };
    }, []),
  );
  const ideas = filterIdeas(search, sport),
    chosen = routes.find((route) => route.id === selected);
  const mapRoutes = useMemo<MapRoute[]>(
    () => [
      ...routes
        .filter((r) =>
          r.title.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .map((r) => ({ ...r, kind: "plan" as const })),
      ...workouts
        .filter(
          (w) =>
            w.state === "finished" &&
            canAccessLocalWorkout(w, userId) &&
            (sport === "All" || w.sport === sport.toLowerCase()) &&
            w.title.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .map((w) => ({
          id: `workout:${w.id}`,
          title: w.title,
          points: w.points,
          kind: "recording" as const,
        })),
    ],
    [routes, workouts, userId, search, sport],
  );
  const saved = useMemo(
    () =>
      routes
        .filter((route) =>
          route.title.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .map((route) => ({
          ...route,
          meters: waypointDistance(route.points),
          elevation: waypointElevation(route.points),
        })),
    [routes, search],
  );
  const selectedMapRoute = mapRoutes.find((route) => route.id === selected);
  const panel = {
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 13,
  } as const;
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
            Discover routes
          </Text>
          <Text style={{ fontSize: 12, color: c.muted }}>
            Find a little more of Nepal.
          </Text>
        </View>
        <IconButton
          icon="add-outline"
          label="Open route builder"
          onPress={() => router.push("/routes")}
        />
      </View>
      <DiscoverySearch
        label="Search routes"
        placeholder="Search places, routes or saved plans"
        value={search}
        onChangeText={setSearch}
      />
      <SportFilters value={sport} onChange={setSport} />
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: wide ? 1.4 : undefined, minWidth: 0, gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: c.text, fontSize: 14, fontWeight: "700" }}>
              Explore the map
            </Text>
            <View style={{ flexDirection: "row", gap: 5 }}>
              {(["valley", "pokhara"] as const).map((region) => (
                <Pressable
                  key={region}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${region === "valley" ? "Kathmandu" : "Pokhara"} map`}
                  accessibilityState={{ selected: area === region && !chosen }}
                  onPress={() => {
                    setArea(region);
                    setSelected(null);
                    setDestination(null);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    minHeight: 40,
                    justifyContent: "center",
                    borderRadius: 8,
                    backgroundColor: area === region ? c.greenSoft : c.panel,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: area === region ? c.forest : c.muted,
                      fontWeight: "600",
                    }}
                  >
                    {region === "valley" ? "Kathmandu" : "Pokhara"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <DiscoveryMap
            area={area}
            routes={mapRoutes}
            selectedId={selected}
            onSelect={setSelected}
            height={wide ? 490 : 240}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons
              name={chosen ? "bookmark-outline" : "location-outline"}
              color={c.forest}
              size={16}
            />
            <Text
              style={{
                flex: 1,
                color: c.text,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {selectedMapRoute
                ? selectedMapRoute.title
                : area === "valley"
                  ? "Kathmandu Valley"
                  : "Pokhara · Gandaki"}
            </Text>
            {selectedMapRoute ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear selected route"
                onPress={() => setSelected(null)}
                style={{ minHeight: 40, justifyContent: "center" }}
              >
                <Text style={{ color: c.forest, fontSize: 12 }}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {wide ? (
            <View style={[panel, { padding: 17, gap: 10 }]}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>
                Make the route your own.
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
                Plan with waypoints in Route studio. Saved geometry stays on
                this device.
              </Text>
              <DiscoveryButton
                title="Open route studio"
                onPress={() => router.push("/routes")}
              />
            </View>
          ) : null}
        </View>
        <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 14 }}>
          <DiscoveryTitle
            title="Find your next adventure"
            detail="Nepal-inspired destinations · visual inspiration"
          />
          {ideas.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {ideas.map((idea) => (
                <Pressable
                  key={idea.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Explore ${idea.title}`}
                  onPress={() => {
                    setSelected(null);
                    setArea(idea.area);
                    setDestination(idea.id);
                  }}
                  style={({ pressed }) => [
                    panel,
                    {
                      flexBasis: "46%",
                      flexGrow: 1,
                      minWidth: 135,
                      overflow: "hidden",
                      opacity: pressed ? 0.8 : 1,
                      borderColor:
                        destination === idea.id ? c.accent : c.border,
                    },
                  ]}
                >
                  <View>
                    <Photo
                      kind={idea.photo}
                      height={wide ? 150 : 120}
                      label={`${idea.title} · Nepal-inspired editorial artwork`}
                    />
                    <View style={{ position: "absolute", left: 8, top: 8 }}>
                      <DemoBadge
                        light
                        label={
                          destination === idea.id
                            ? "SELECTED AREA"
                            : "INSPIRATION"
                        }
                      />
                    </View>
                  </View>
                  <View style={{ padding: 11, gap: 6 }}>
                    <Text
                      style={{
                        color: c.text,
                        fontSize: 14,
                        fontWeight: "700",
                        lineHeight: 19,
                      }}
                    >
                      {idea.title}
                    </Text>
                    <Text
                      style={{ color: c.muted, fontSize: 10, lineHeight: 15 }}
                    >
                      {idea.region}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 5,
                        alignItems: "center",
                      }}
                    >
                      <Ionicons
                        name={
                          idea.sport === "Cycling"
                            ? "bicycle-outline"
                            : idea.sport === "Hiking"
                              ? "trail-sign-outline"
                              : "walk-outline"
                        }
                        size={13}
                        color={c.forest}
                      />
                      <Text
                        style={{
                          color: c.forest,
                          fontSize: 10,
                          fontWeight: "600",
                        }}
                      >
                        {idea.sport}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={[panel, { padding: 18, gap: 6 }]}>
              <Text style={{ color: c.text, fontWeight: "700", fontSize: 15 }}>
                No matching destinations
              </Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>
                Try another place or sport.
              </Text>
            </View>
          )}
          <DiscoveryTitle
            title="Saved routes"
            detail="Your plans, ready when you are"
            action="Route studio"
            onPress={() => router.push("/routes")}
          />
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: c.accent, fontSize: 12 }}
            >
              {error}
            </Text>
          ) : null}
          {saved.length ? (
            saved.map((route) => (
              <Pressable
                key={route.id}
                accessibilityRole="button"
                accessibilityLabel={`Preview saved route ${route.title}`}
                onPress={() => setSelected(route.id)}
                style={[
                  panel,
                  {
                    padding: 14,
                    gap: 8,
                    borderColor: selected === route.id ? c.forest : c.border,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Ionicons name="bookmark" color={c.forest} size={20} />
                  <Text
                    style={{
                      flex: 1,
                      color: c.text,
                      fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    {route.title}
                  </Text>
                  <Ionicons name="chevron-forward" color={c.muted} size={16} />
                </View>
                <Text style={{ color: c.muted, fontSize: 11 }}>
                  {length(route.meters, units)} {units} · {route.points.length}{" "}
                  waypoints · Straight-line plan
                </Text>
                {route.elevation !== null ? (
                  <Text style={{ color: c.forest, fontSize: 11 }}>
                    {Math.round(route.elevation)} m elevation gain · measured
                    altitude
                  </Text>
                ) : null}
              </Pressable>
            ))
          ) : (
            <View style={[panel, { padding: 17, gap: 10 }]}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
              >
                <Ionicons name="bookmark-outline" size={21} color={c.forest} />
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: c.text }}
                >
                  {routes.length
                    ? "No matching saved routes"
                    : "Your next route starts here."}
                </Text>
              </View>
              <DiscoveryButton
                title="Create a route"
                secondary
                onPress={() => router.push("/routes")}
              />
            </View>
          )}
          <Text style={{ color: c.muted, fontSize: 10, lineHeight: 16 }}>
            Inspiration cards are not mapped trails. Route distances come only
            from your saved waypoints. Elevation requires measured altitude;
            road routing is not available.
          </Text>
        </View>
      </View>
    </AthletePage>
  );
}

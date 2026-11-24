import { useMemo, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AthletePage, AthleteText as Text } from "../../../components/athlete";
import {
  DiscoveryButton,
  DiscoverySearch,
  DiscoveryTitle,
  DemoBadge,
  Photo,
  SportFilters,
} from "../../../components/discovery-ui";
import DiscoveryMap from "../../../components/DiscoveryMap";
import { SavedRouteOpen } from "../../../components/SavedRouteOpen";
import { routeDistance } from "../../../features/discovery/map-data";
import { useSession } from "../../../hooks/useSession";
import { canAccessLocalWorkout } from "../../../features/auth/local-access";
import type { MapRoute } from "../../../features/discovery/map-data";
import { Button, Row, useColors } from "../../../components/ui";
import { useRouteLibrary, routeStatus } from "../../../hooks/useRouteLibrary";
import { retryRouteSync } from "../../../hooks/useRouteSync";
import { useApp } from "../../../store/app";
import { routeGuideParam } from "../../../features/routes/guide";
import { length } from "../../../utils/format";
import {
  filterIdeas,
  waypointDistance,
  waypointElevation,
  type Area,
  type DiscoverySport,
} from "../../../features/discovery/catalog";

export default function Explore() {
  const user = useSession()?.user.id;
  return <ExploreLibrary key={user ?? "local"} />;
}
function ExploreLibrary() {
  const c = useColors(),
    wide = useWindowDimensions().width >= 1100;
  const units = useApp((state) => state.preferences.units);
  const workouts = useApp((state) => state.workouts);
  const userId = useSession()?.user.id;
  const [sport, setSport] = useState<DiscoverySport>("All"),
    [search, setSearch] = useState("");
  const { plans: routes, warning: error, settled } = useRouteLibrary();
  const [selected, setSelected] = useState<string | null>(null),
    [area, setArea] = useState<Area>("valley");
  const [destination, setDestination] = useState<string | null>(null);
  const term = search.trim().toLowerCase();
  const ideas = filterIdeas(search, sport);
  const matchingPlans = useMemo(
    () => routes.filter(({ title }) => title.toLowerCase().includes(term)),
    [routes, term],
  );
  const mapRoutes = useMemo<MapRoute[]>(
    () => [
      ...matchingPlans.map((route) => ({
        ...route,
        id: routeGuideParam(route),
        kind: "plan" as const,
      })),
      ...workouts
        .filter(
          (w) =>
            w.state === "finished" &&
            canAccessLocalWorkout(w, userId) &&
            (sport === "All" || w.sport === sport.toLowerCase()) &&
            w.title.toLowerCase().includes(term),
        )
        .map((w) => ({
          id: `workout:${w.id}`,
          title: w.title,
          points: w.points,
          kind: "recording" as const,
        })),
    ],
    [matchingPlans, workouts, userId, term, sport],
  );
  const saved = useMemo(
    () =>
      matchingPlans.map((route) => ({
        ...route,
        meters: waypointDistance(route.points),
        elevation: waypointElevation(route.points),
      })),
    [matchingPlans],
  );
  const selectedMapRoute = mapRoutes.find((route) => route.id === selected);
  const selectedDistance = useMemo(
    () => (selectedMapRoute ? routeDistance(selectedMapRoute) : 0),
    [selectedMapRoute],
  );
  const panel = {
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 13,
  } as const;
  const savedSection = (
    <>
      <DiscoveryTitle
        title="Saved routes"
        detail="Your plans, ready when you are"
        action="View all"
        onPress={() => router.push("/saved-routes")}
      />
      {userId ? (
        <DiscoveryButton
          title="Retry Sync"
          secondary
          onPress={retryRouteSync}
        />
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.accent, fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}
      {!settled ? (
        <Text style={{ color: c.muted }}>Loading saved routes...</Text>
      ) : saved.length ? (
        saved.map((route) => (
          <View
            key={routeGuideParam(route)}
            style={[panel, { padding: 10, gap: 6 }]}
          >
            <SavedRouteOpen
              route={route}
              label={`Preview saved route ${route.title}`}
              onEdit={() =>
                router.push({
                  pathname: "/routes",
                  params: { edit: routeGuideParam(route) },
                })
              }
            />
            <Text style={{ color: c.muted, fontSize: 11 }}>
              {length(route.meters, units)} {units} · {route.points.length}{" "}
              waypoints · Straight-line plan
            </Text>
            <Text style={{ color: c.muted, fontSize: 11 }}>
              {routeStatus(route)}
            </Text>
            {route.elevation !== null ? (
              <Text style={{ color: c.forest, fontSize: 11 }}>
                {Math.round(route.elevation)} m elevation gain · measured
                altitude
              </Text>
            ) : null}
          </View>
        ))
      ) : (
        <View style={[panel, { padding: 17, gap: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Ionicons name="bookmark-outline" size={21} color={c.forest} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: c.text }}>
              {search.trim()
                ? "No matching saved routes"
                : "No saved routes yet."}
            </Text>
          </View>
          <DiscoveryButton
            title="Create a route"
            secondary
            onPress={() => router.push("/routes")}
          />
        </View>
      )}
    </>
  );
  const mapSection = (
    <View
      key="map"
      style={{ flex: wide ? 1.8 : undefined, minWidth: 0, gap: 14 }}
    >
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
              accessibilityState={{
                selected: area === region && !selectedMapRoute,
              }}
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
        height={wide ? 540 : 380}
        variant="explore"
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons
          name={
            selectedMapRoute?.kind === "plan"
              ? "bookmark-outline"
              : "location-outline"
          }
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
      {selectedMapRoute ? (
        <View style={[panel, { padding: 14, gap: 8 }]}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "700" }}>
            {selectedMapRoute.title}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            {selectedMapRoute.kind === "plan"
              ? "Approximate straight-line distance"
              : "Recorded GPS distance"}
            : {length(selectedDistance, units)} {units} ·{" "}
            {selectedMapRoute.points.length}{" "}
            {selectedMapRoute.kind === "plan" ? "waypoints" : "GPS fixes"}
          </Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>
            Roads, trails, terrain and access restrictions are not verified.
          </Text>
        </View>
      ) : null}
    </View>
  );
  const discoverySection = (
    <View
      key="discovery"
      style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 14 }}
    >
      {term ? savedSection : null}
      <DiscoveryTitle
        title="Route ideas"
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
                  borderColor: destination === idea.id ? c.accent : c.border,
                },
              ]}
            >
              <View>
                <Photo
                  kind={idea.photo}
                  height={wide ? 112 : 120}
                  label={`${idea.title} · Nepal-inspired editorial artwork`}
                />
                <View style={{ position: "absolute", left: 8, top: 8 }}>
                  <DemoBadge
                    light
                    label={
                      destination === idea.id ? "SELECTED AREA" : "INSPIRATION"
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
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
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
            No matching route ideas
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            Try a route name, region, or sport.
          </Text>
        </View>
      )}
      {!term ? savedSection : null}
      <Text style={{ color: c.muted, fontSize: 10, lineHeight: 16 }}>
        Inspiration cards are not mapped trails. Route distances come only from
        your saved waypoints. Elevation requires measured altitude; road routing
        is not available.
      </Text>
    </View>
  );
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
        </View>
      </View>
      <Row>
        <Button title="New route" onPress={() => router.push("/routes")} />
        <Button
          secondary
          title="My saved routes"
          onPress={() => router.push("/saved-routes")}
        />
      </Row>
      <DiscoverySearch
        label="Search routes"
        placeholder="Search routes"
        value={search}
        onChangeText={setSearch}
      />
      <SportFilters value={sport} onChange={setSport} />
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        {!wide && term ? (
          <>
            {discoverySection}
            {mapSection}
          </>
        ) : (
          <>
            {mapSection}
            {discoverySection}
          </>
        )}
      </View>
    </AthletePage>
  );
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import * as Location from "expo-location";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { IconButton } from "../athlete";
import { SavedRouteOpen } from "../SavedRouteOpen";
import { useColors } from "../ui";
import {
  useRouteLibrary,
  type LibraryRoute,
} from "../../hooks/useRouteLibrary";
import { useSession } from "../../hooks/useSession";
import { useApp } from "../../store/app";
import { length } from "../../utils/format";
import {
  areaPlaces,
  type RouteIdea,
  waypointElevation,
} from "../../features/discovery/catalog";
import {
  mapSegments,
  validCoordinate,
} from "../../features/discovery/map-data";
import {
  ideasOnMap,
  mapScopes,
  savedMapLayer,
  scheduleMapSearch,
  searchPlaces,
  searchSaved,
  type MapScope,
} from "../../features/maps/dedicated";
import type { MapPin } from "../../features/maps/dedicated-canvas";
import type { Coordinate, MapHandle } from "../../features/maps/native-types";
import { routeGuideParam } from "../../features/routes/guide";
import MapsCanvas from "./MapsCanvas";

const activities = ["All", "Walking", "Running", "Cycling"] as const;
const distances = ["Any", "Under 5 km", "5 km or more"] as const;
const elevations = ["Any", "Measured"] as const;
const cameraButton = { width: 48, height: 48, borderRadius: 15 };

export default function MapsScreen() {
  const account = useSession()?.user.id;
  return <MapsWorkspace key={account ?? "local"} />;
}

function MapsWorkspace() {
  const c = useColors();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const units = useApp((state) => state.preferences.units);
  const { plans, warning, settled } = useRouteLibrary();
  const map = useRef<MapHandle>(null);
  const readyRef = useRef(false);
  const pendingCamera = useRef<((handle: MapHandle) => void) | undefined>(
    undefined,
  );
  const cameraIntent = useRef(0);
  const [ready, setReady] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [pin, setPin] = useState<MapPin>();
  const [selectedId, setSelectedId] = useState<string>();
  const [openSearch, setOpenSearch] = useState(false);
  const [scope, setScope] = useState<MapScope>("Places");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [panel, setPanel] = useState<"Saved" | "Ideas">();
  const [activity, setActivity] = useState<(typeof activities)[number]>("All");
  const [distance, setDistance] = useState<(typeof distances)[number]>("Any");
  const [elevation, setElevation] =
    useState<(typeof elevations)[number]>("Any");
  const hasElevation = useMemo(
    () =>
      plans.some(
        (route) => !route.deleted && waypointElevation(route.points) !== null,
      ),
    [plans],
  );
  const selected = plans.find(
    (route) => !route.deleted && routeGuideParam(route) === selectedId,
  );
  const layer = useMemo(
    () => (selected ? savedMapLayer(selected) : undefined),
    [selected],
  );
  const routePoints = useMemo(
    () => (layer ? mapSegments(layer).flat() : []),
    [layer],
  );
  const waiting = query.trim() !== debounced;
  const visibleScope = openSearch ? (waiting ? undefined : scope) : panel;
  const places = useMemo(() => searchPlaces(debounced), [debounced]);
  const ideas = useMemo(
    () =>
      visibleScope === "Ideas"
        ? ideasOnMap(openSearch ? debounced : "", openSearch ? "All" : activity)
        : [],
    [visibleScope, openSearch, debounced, activity],
  );
  const saved = useMemo(
    () =>
      visibleScope === "Saved"
        ? searchSaved(
            plans,
            openSearch ? debounced : "",
            openSearch ? "Any" : distance,
            openSearch || !hasElevation ? "Any" : elevation,
          )
        : [],
    [
      visibleScope,
      plans,
      openSearch,
      debounced,
      distance,
      hasElevation,
      elevation,
    ],
  );

  useEffect(() => {
    if (openSearch) return scheduleMapSearch(query, setDebounced);
  }, [query, openSearch]);
  const cancelCamera = useCallback(() => {
    cameraIntent.current++;
    pendingCamera.current = undefined;
  }, []);
  useFocusEffect(useCallback(() => cancelCamera, [cancelCamera]));
  const onReady = useCallback(() => {
    readyRef.current = true;
    setReady(true);
    if (map.current) pendingCamera.current?.(map.current);
    pendingCamera.current = undefined;
  }, []);
  const command = (move: (handle: MapHandle) => void) => {
    cancelCamera();
    if (readyRef.current && map.current) move(map.current);
    else pendingCamera.current = move;
  };
  const fit = (points: Coordinate[]) => {
    if (points.length < 2) return;
    command((handle) =>
      handle.fitToCoordinates(points, {
        edgePadding: { top: insets.top + 75, bottom: 53, left: 30, right: 68 },
        animated: true,
      }),
    );
  };
  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setOpenSearch(false);
    setQuery("");
    setDebounced("");
  }, []);
  useFocusEffect(
    useCallback(() => {
      const back = BackHandler.addEventListener("hardwareBackPress", () => {
        if (openSearch) closeSearch();
        else if (panel) setPanel(undefined);
        else return false;
        return true;
      });
      return () => back.remove();
    }, [openSearch, panel, closeSearch]),
  );
  const selectPlace = (place: MapPin) => {
    closeSearch();
    setPanel(undefined);
    setSelectedId(undefined);
    setPin(place);
    command((handle) => handle.centerOn?.(place, 14));
  };
  const selectRoute = (route: LibraryRoute) => {
    closeSearch();
    setPanel(undefined);
    setPin(undefined);
    setSelectedId(routeGuideParam(route));
    fit(mapSegments(savedMapLayer(route)).flat());
  };
  const selectIdea = (idea: RouteIdea) => {
    const place = areaPlaces[idea.area].find(
      ({ name }) =>
        name === (idea.area === "pokhara" ? "Phewa Lake" : "Kathmandu"),
    );
    if (place)
      selectPlace({ ...place, label: `${idea.title} · destination idea` });
  };
  async function locate() {
    cancelCamera();
    const request = cameraIntent.current;
    setLocating(true);
    setLocationError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (request !== cameraIntent.current) return;
      if (!permission.granted) {
        setLocationError("Allow location access to center the map.");
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync();
      if (request !== cameraIntent.current) return;
      if (!validCoordinate(coords)) throw new Error("Invalid location");
      setPin({ ...coords, label: "My location" });
      map.current?.centerOn?.(coords, 16);
    } catch {
      if (request === cameraIntent.current)
        setLocationError(
          "Location unavailable. Check location services and try again.",
        );
    } finally {
      setLocating(false);
    }
  }

  const routeRows = (
    <>
      {warning ? <Message>{warning}</Message> : null}
      {!settled ? <Message>Loading saved routes…</Message> : null}
      {settled && !saved.length ? (
        <Message>
          {warning
            ? "No saved routes could be shown."
            : "No matching saved routes."}
        </Message>
      ) : null}
      {saved.map((route) => (
        <Result
          key={routeGuideParam(route)}
          title={route.title}
          icon="bookmark-outline"
          onPress={() => selectRoute(route)}
          detail={`${length(route.distanceMeters, units)} ${units} · Straight-line plan`}
        />
      ))}
    </>
  );
  const ideaRows = ideas.length ? (
    ideas.map((idea) => (
      <Result
        key={idea.id}
        icon="leaf-outline"
        title={idea.title}
        detail={`${idea.sport} · ${idea.region} · Destination idea`}
        onPress={() => selectIdea(idea)}
      />
    ))
  ) : (
    <Message>
      No matching route ideas. Try a different activity or search.
    </Message>
  );

  return (
    <KeyboardAvoidingView
      aria-hidden={!focused}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? "auto" : "no-hide-descendants"}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.workspace, { backgroundColor: c.greenSoft }]}
    >
      <View
        style={styles.mapFrame}
        onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}
      >
        <MapsCanvas
          mapRef={map}
          route={layer}
          pin={pin}
          onReady={onReady}
          onGesture={cancelCamera}
        />
        <View
          pointerEvents="box-none"
          style={[
            styles.top,
            {
              top: insets.top + 8,
              left: Math.max(12, insets.left),
              right: Math.max(12, insets.right),
            },
          ]}
        >
          {openSearch ? (
            <View
              style={[
                styles.searchPanel,
                { backgroundColor: c.panel, borderColor: c.border },
              ]}
            >
              <View style={styles.searchRow}>
                <Ionicons name="search-outline" color={c.muted} size={21} />
                <TextInput
                  accessibilityLabel="Search within Maps"
                  autoFocus
                  value={query}
                  onChangeText={setQuery}
                  placeholder={
                    scope === "Places"
                      ? "Landmark or coordinates"
                      : scope === "Saved"
                        ? "Saved route name"
                        : "Route idea or region"
                  }
                  placeholderTextColor={c.muted}
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={Keyboard.dismiss}
                  style={[styles.input, { color: c.text }]}
                />
                <IconButton
                  icon="close"
                  label="Close map search"
                  style={cameraButton}
                  onPress={closeSearch}
                />
              </View>
              <Choices
                choices={mapScopes}
                selected={scope}
                onSelect={setScope}
              />
              <ScrollView
                style={{
                  maxHeight: Math.min(
                    220,
                    Math.max(64, (mapHeight - insets.top) * 0.42),
                  ),
                }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.results}
                nestedScrollEnabled
              >
                {waiting ? (
                  <Message>Searching…</Message>
                ) : scope === "Saved" ? (
                  routeRows
                ) : scope === "Ideas" ? (
                  ideaRows
                ) : (
                  <>
                    <Message>
                      Offline Kathmandu Valley landmarks and latitude,
                      longitude. Street addresses aren’t indexed.
                    </Message>
                    {places.invalid ? (
                      <Message>
                        Enter a valid latitude and longitude, for example 27.71,
                        85.32.
                      </Message>
                    ) : null}
                    {!places.invalid && !places.places.length ? (
                      <Message>No matching landmarks. Try coordinates.</Message>
                    ) : null}
                    {places.places.map((place) => (
                      <Result
                        key={place.label}
                        icon="location-outline"
                        title={place.label}
                        onPress={() => selectPlace(place)}
                      />
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.searchRow} pointerEvents="box-none">
              <Action
                icon="search-outline"
                label="Search maps"
                onPress={() => {
                  setPanel(undefined);
                  setOpenSearch(true);
                }}
                grow
                heading
              />
              <IconButton
                icon="bookmark-outline"
                label="Open saved-route library"
                style={cameraButton}
                onPress={() => router.push("/saved-routes")}
              />
            </View>
          )}
        </View>
        {!openSearch ? (
          <View
            style={[
              styles.camera,
              { top: insets.top + 68, right: Math.max(12, insets.right) },
            ]}
            pointerEvents="box-none"
          >
            <IconButton
              icon="locate-outline"
              label={locating ? "Locating" : "My location"}
              style={cameraButton}
              disabled={!ready || locating}
              onPress={() => void locate()}
            />
            <IconButton
              icon="compass-outline"
              label="Reset map to north"
              style={cameraButton}
              disabled={!ready}
              onPress={() =>
                command((handle) => void handle.resetNorth?.().catch(() => {}))
              }
            />
            {routePoints.length > 1 ? (
              <IconButton
                icon="scan-outline"
                label="Fit map to route"
                style={cameraButton}
                disabled={!ready}
                onPress={() => fit(routePoints)}
              />
            ) : null}
          </View>
        ) : null}
        {!openSearch && locationError ? (
          <View
            style={[
              styles.locationError,
              { top: insets.top + 66, backgroundColor: c.panel },
            ]}
          >
            <Message>{locationError}</Message>
          </View>
        ) : null}
      </View>
      {!openSearch ? (
        <View
          style={[
            styles.dock,
            {
              backgroundColor: c.panel,
              borderColor: c.border,
              paddingLeft: Math.max(12, insets.left),
              paddingRight: Math.max(12, insets.right),
            },
          ]}
        >
          {selected && !panel ? (
            <View style={styles.selection}>
              <View style={styles.flex}>
                <SavedRouteOpen
                  route={selected}
                  label={`Preview saved route ${selected.title}`}
                  onEdit={(route) =>
                    router.push({
                      pathname: "/routes",
                      params: { edit: routeGuideParam(route) },
                    })
                  }
                />
                <Message>
                  {length(selected.distanceMeters, units)} {units} ·
                  Straight-line plan
                </Message>
              </View>
              <IconButton
                icon="close"
                label="Clear route selection"
                style={cameraButton}
                onPress={() => {
                  cancelCamera();
                  setSelectedId(undefined);
                }}
              />
            </View>
          ) : !panel && pin ? (
            <View style={styles.selection}>
              <Text style={[styles.flex, { color: c.text, fontWeight: "600" }]}>
                {pin.label}
              </Text>
              <IconButton
                icon="close"
                label="Clear map pin"
                style={cameraButton}
                onPress={() => {
                  cancelCamera();
                  setPin(undefined);
                }}
              />
            </View>
          ) : null}
          <View style={styles.actions}>
            <Action
              icon={panel === "Ideas" ? "chevron-down" : "layers-outline"}
              label="Route ideas"
              expanded={panel === "Ideas"}
              onPress={() => setPanel(panel === "Ideas" ? undefined : "Ideas")}
            />
            <Action
              icon={panel === "Saved" ? "chevron-down" : "bookmark-outline"}
              label="Saved"
              expanded={panel === "Saved"}
              onPress={() => setPanel(panel === "Saved" ? undefined : "Saved")}
            />
            <Action
              icon="add"
              label="Create route"
              primary
              onPress={() =>
                router.push({ pathname: "/routes", params: { from: "maps" } })
              }
            />
          </View>
          {panel ? (
            <ScrollView
              style={{ maxHeight: Math.min(250, height * 0.3) }}
              contentContainerStyle={styles.results}
              nestedScrollEnabled
            >
              {panel === "Ideas" ? (
                <>
                  <Choices
                    choices={activities}
                    selected={activity}
                    onSelect={setActivity}
                  />
                  <Message>
                    Editorial destinations. Route lines and distances are
                    unavailable.
                  </Message>
                  {ideaRows}
                  <Action
                    icon="compass-outline"
                    label="Open Explore"
                    onPress={() => router.push("/explore")}
                  />
                </>
              ) : (
                <>
                  <Message>Distance</Message>
                  <Choices
                    choices={distances}
                    selected={distance}
                    onSelect={setDistance}
                  />
                  {hasElevation ? (
                    <>
                      <Message>Elevation</Message>
                      <Choices
                        choices={elevations}
                        selected={elevation}
                        onSelect={setElevation}
                      />
                    </>
                  ) : null}
                  {routeRows}
                  <Action
                    icon="bookmark-outline"
                    label="Manage saved routes"
                    onPress={() => router.push("/saved-routes")}
                  />
                </>
              )}
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

type Icon = React.ComponentProps<typeof Ionicons>["name"];

function Message({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={{ color: c.muted, fontSize: 13, paddingVertical: 3 }}
    >
      {children}
    </Text>
  );
}

function Result({
  title,
  detail,
  icon,
  onPress,
}: {
  title: string;
  detail?: string;
  icon: Icon;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => [
        styles.result,
        { borderColor: c.border, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <Ionicons name={icon} color={c.forest} size={20} />
      <View style={styles.flex}>
        <Text style={{ color: c.text, fontWeight: "600" }}>{title}</Text>
        {detail ? (
          <Text style={{ color: c.muted, fontSize: 12 }}>{detail}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" color={c.muted} size={16} />
    </Pressable>
  );
}

function Action({
  icon,
  label,
  onPress,
  grow,
  primary,
  heading,
  expanded,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
  grow?: boolean;
  primary?: boolean;
  heading?: boolean;
  expanded?: boolean;
}) {
  const c = useColors();
  const color = primary ? "#fff" : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-expanded={expanded}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          flexGrow: grow ? 1 : undefined,
          backgroundColor: primary ? "#17695D" : c.panel,
          borderColor: expanded ? c.forest : c.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} color={color} size={18} />
      <Text
        style={{
          color,
          fontWeight: "600",
          fontSize: heading ? 15 : 13,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Choices<T extends string>({
  choices,
  selected,
  onSelect,
}: {
  choices: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.actions}>
      {choices.map((choice) => (
        <Pressable
          key={choice}
          accessibilityRole="radio"
          aria-checked={choice === selected}
          onPress={() => onSelect(choice)}
          style={[
            styles.choice,
            {
              backgroundColor: choice === selected ? c.greenSoft : c.panel,
              borderColor: choice === selected ? c.forest : c.border,
            },
          ]}
        >
          <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>
            {choice}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  workspace: { flex: 1 },
  mapFrame: { flex: 1, minHeight: 0 },
  top: { position: "absolute" },
  searchPanel: { padding: 10, borderRadius: 18, borderWidth: 1, gap: 6 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 4,
    fontSize: 16,
  },
  camera: { position: "absolute", gap: 8 },
  locationError: {
    position: "absolute",
    left: 12,
    right: 70,
    padding: 8,
    borderRadius: 10,
  },
  dock: { borderTopWidth: 1, paddingVertical: 8, gap: 6 },
  selection: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 15,
  },
  choice: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  results: { paddingVertical: 4, gap: 4 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 48,
    borderBottomWidth: 1,
    paddingVertical: 7,
  },
});

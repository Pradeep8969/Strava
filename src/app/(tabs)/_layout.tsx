import { SettingsButton } from "../../../components/settings-button";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../../../components/ui";
import { athleteFont } from "../../../components/athlete";
const icons = {
  index: "home-outline",
  explore: "compass-outline",
  maps: "map-outline",
  events: "calendar-outline",
  record: "add-circle-outline",
  activities: "stats-chart-outline",
  profile: "person-outline",
} as const;
export default function TabLayout() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const small = width < 420;
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitle: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Ionicons name="trail-sign" color={c.forest} size={24} />
            <View>
              <Text
                style={{
                  color: c.text,
                  fontWeight: "900",
                  fontFamily: athleteFont,
                  fontSize: small ? 15 : 18,
                  letterSpacing: -0.6,
                }}
              >
                StravaKinda<Text style={{ color: c.accent }}>.</Text>
              </Text>
              <Text style={{ color: c.muted, fontSize: 8, letterSpacing: 2 }}>
                MADE FOR NEPAL
              </Text>
            </View>
          </View>
        ),
        headerRight: () => <SettingsButton />,
        headerTitleStyle: {
          fontSize: small ? 11 : 13,
          fontWeight: "900",
          letterSpacing: small ? 1 : 2,
        },
        tabBarStyle: {
          backgroundColor: c.panel,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 65 + Math.max(insets.bottom, 10),
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 10),
        },
        // Keep the bar in the navigator's layout so it reserves space below
        // every screen's ScrollView instead of covering its final content.
        tabBarPosition: "bottom",
        tabBarLabelPosition: "below-icon",
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: { flex: 1, minWidth: 0, minHeight: 48 },
        tabBarActiveBackgroundColor: "transparent",
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: {
          fontSize: small ? 9 : 11,
          fontWeight: "600",
          fontFamily: athleteFont,
        },
        tabBarIcon: ({ focused, size }) => (
          <Ionicons
            name={icons[route.name as keyof typeof icons]}
            color={
              focused ? c.accent : route.name === "record" ? c.forest : c.muted
            }
            size={route.name === "record" ? size + 5 : size}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen
        name="maps"
        options={{
          title: "Maps",
          tabBarAccessibilityLabel: "Maps",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          // Keep /explore routable on SDK 58, which redirects href: null tabs.
          tabBarButton: () => null,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen name="record" options={{ title: "Record" }} />
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="activities" options={{ title: "Activities" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

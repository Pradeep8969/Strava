import { useEffect } from "react";
import { SessionProvider } from "../../hooks/useSession";
import { SettingsButton } from "../../components/settings-button";
import { NotificationCoordinator } from "../../components/notification-coordinator";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApp } from "../../store/app";
import { useColors } from "../../components/ui";
import { useSync } from "../../hooks/useSync";
import {
  installRecorderLifecycle,
  recoverRecording,
} from "../../services/recorder";
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});
export default function Layout() {
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>
        <AppLayout />
      </SessionProvider>
    </QueryClientProvider>
  );
}
function AppLayout() {
  useSync();
  const c = useColors(),
    theme = useApp((s) => s.preferences.theme);
  useEffect(() => {
    installRecorderLifecycle();
    void useApp
      .getState()
      .refresh()
      .then(recoverRecording)
      .catch((e) => useApp.setState({ error: String(e) }));
  }, []);
  return (
    <>
      <NotificationCoordinator />
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          contentStyle: { backgroundColor: c.bg },
          headerBackTitle: "Back",
          headerRight: () => <SettingsButton />,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="activity/[id]"
          options={{ title: "Your activity" }}
        />
        <Stack.Screen name="auth" options={{ title: "Your account" }} />
        <Stack.Screen
          name="settings"
          options={{ title: "Settings & privacy", headerRight: () => null }}
        />
        <Stack.Screen
          name="analytics"
          options={{ title: "Training insights" }}
        />
        <Stack.Screen
          name="community"
          options={{ title: "Clubs & challenges" }}
        />
        <Stack.Screen name="social" options={{ title: "Athlete feed" }} />
        <Stack.Screen name="search" options={{ title: "Find athletes" }} />
        <Stack.Screen name="routes" options={{ title: "Route studio" }} />
        <Stack.Screen
          name="privacy-zones"
          options={{ title: "Privacy zones" }}
        />
        <Stack.Screen name="coach" options={{ title: "Training coach" }} />
        <Stack.Screen
          name="subscription"
          options={{ title: "StravaKinda Plus" }}
        />
      </Stack>
    </>
  );
}

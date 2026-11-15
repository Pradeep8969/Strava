import { Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "./ui";

export function SettingsButton() {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      onPress={() => router.push("/settings")}
      style={{
        minWidth: 48,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
      }}
    >
      <Ionicons name="settings-outline" size={21} color={c.text} />
    </Pressable>
  );
}

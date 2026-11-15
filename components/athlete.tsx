import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text as NativeText,
  View,
  useWindowDimensions,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "./ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const athleteFont =
  Platform.OS === "web"
    ? "Arial, Helvetica, sans-serif"
    : Platform.OS === "android"
      ? "sans-serif"
      : "System";
export function AthleteText({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: athleteFont }, style]} />;
}
export function AthletePage({
  children,
  dark = false,
}: React.PropsWithChildren<{ dark?: boolean }>) {
  const c = useColors();
  const wide = useWindowDimensions().width >= 1100;
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: dark
          ? "#172127"
          : c.bg === "#F6F7F4"
            ? "#F6F7F9"
            : c.bg,
      }}
      contentContainerStyle={{
        alignItems: "center",
        flexGrow: 1,
        paddingBottom: dark ? 24 : 32,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          width: "100%",
          maxWidth: 1100,
          paddingHorizontal: wide ? 32 : 16,
          paddingTop: wide ? 30 : 18 + insets.top,
          gap: 18,
        }}
      >
        {children}
      </View>
    </ScrollView>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  dark = false,
  disabled = false,
  style,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  dark?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: dark ? "#29363E" : c.panel,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 1,
          borderColor: dark ? "#3B4950" : c.border,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} color={dark ? "white" : c.text} size={20} />
    </Pressable>
  );
}
export function SmallLabel({
  children,
  light = false,
}: React.PropsWithChildren<{ light?: boolean }>) {
  const c = useColors();
  return (
    <AthleteText
      style={{
        color: light ? "#AAB9C1" : c.muted,
        fontSize: 11,
        lineHeight: 16,
      }}
    >
      {children}
    </AthleteText>
  );
}

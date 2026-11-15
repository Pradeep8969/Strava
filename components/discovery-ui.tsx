import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AthleteText as Text, athleteFont } from "./athlete";
import { useColors } from "./ui";
import {
  discoverySports,
  type DiscoverySport,
} from "../features/discovery/catalog";

export const discoveryPhotos: Record<
  "mountains" | "lake" | "ridge",
  ImageSourcePropType
> = {
  mountains: require("../assets/himalayan-editorial.jpg"),
  lake: require("../assets/pokhara-editorial.jpg"),
  ridge: require("../assets/ridge-editorial.jpg"),
};
export function DiscoverySearch({
  label,
  placeholder,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        backgroundColor: c.panel,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: 11,
        paddingHorizontal: 13,
        minHeight: 46,
      }}
    >
      <Ionicons name="search-outline" size={18} color={c.muted} />
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        style={{
          flex: 1,
          minWidth: 0,
          color: c.text,
          fontSize: 13,
          fontFamily: athleteFont,
          paddingVertical: 12,
        }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label.toLowerCase()}`}
          onPress={() => onChangeText("")}
          hitSlop={10}
          style={{
            minWidth: 32,
            minHeight: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close-circle" size={17} color={c.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
export function SportFilters({
  value,
  onChange,
}: {
  value: DiscoverySport;
  onChange: (value: DiscoverySport) => void;
}) {
  const c = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 7, paddingVertical: 1 }}
    >
      {discoverySports.map((sport) => (
        <Pressable
          key={sport}
          accessibilityRole="button"
          accessibilityLabel={sport === "All" ? "All sports" : sport}
          accessibilityState={{ selected: sport === value }}
          onPress={() => onChange(sport)}
          style={{
            minHeight: 40,
            borderRadius: 9,
            paddingHorizontal: 11,
            justifyContent: "center",
            backgroundColor: sport === value ? c.accent : c.panel,
            borderWidth: 1,
            borderColor: sport === value ? c.accent : c.border,
          }}
        >
          <Text
            style={{
              color: sport === value ? "#FFFFFF" : c.text,
              fontSize: 11,
              fontWeight: "600",
            }}
          >
            {sport === "All" ? "All" : sport}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function DiscoveryTitle({
  title,
  detail,
  action,
  onPress,
}: {
  title: string;
  detail?: string;
  action?: string;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          accessibilityRole="header"
          style={{
            color: c.text,
            fontSize: 19,
            fontWeight: "700",
            letterSpacing: -0.4,
          }}
        >
          {title}
        </Text>
        {detail ? (
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      {action && onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={onPress}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: c.forest, fontWeight: "600", fontSize: 12 }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
export function DemoBadge({
  light = false,
  label = "DEMO EVENT",
}: {
  light?: boolean;
  label?: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 5,
        backgroundColor: light ? "rgba(14,32,42,.86)" : c.accentSoft,
      }}
    >
      <Text
        style={{
          color: light ? "#FFFFFF" : c.accent,
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
export function Photo({
  kind,
  height = 190,
  label,
}: {
  kind: "mountains" | "lake" | "ridge";
  height?: number;
  label: string;
}) {
  return (
    <Image
      source={discoveryPhotos[kind]}
      accessibilityLabel={label}
      resizeMode="cover"
      style={{ width: "100%", height }}
    />
  );
}
export function DiscoveryButton({
  title,
  onPress,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        paddingHorizontal: 15,
        borderRadius: 9,
        backgroundColor: secondary ? c.raised : c.text,
        flexDirection: "row",
        gap: 9,
        justifyContent: "center",
        alignItems: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: secondary ? c.text : c.panel,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>
      <Ionicons
        name="arrow-forward"
        size={15}
        color={secondary ? c.text : c.panel}
      />
    </Pressable>
  );
}

import React from "react";
import {
  ImageBackground,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "./ui";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function IconBubble({
  name,
  shade = "orange",
  size = 20,
}: {
  name: IconName;
  shade?: "orange" | "green" | "blue";
  size?: number;
}) {
  const c = useColors();
  const bg =
    shade === "green"
      ? c.greenSoft
      : shade === "blue"
        ? c.blueSoft
        : c.accentSoft;
  const color =
    shade === "green" ? c.forest : shade === "blue" ? c.blue : c.accent;
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
      }}
    >
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}
export function Chip({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={label}
      accessibilityState={onPress ? { selected: active } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? c.accent : c.border,
        backgroundColor: active ? c.accent : c.panel,
        paddingVertical: 10,
        paddingHorizontal: 14,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon ? (
        <Ionicons name={icon} size={15} color={active ? c.onAccent : c.muted} />
      ) : null}
      <Text
        style={{
          color: active ? c.onAccent : c.text,
          fontWeight: "700",
          fontSize: 12.5,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  action,
  onPress,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            color: c.accent,
            fontSize: 10.5,
            fontWeight: "800",
            letterSpacing: 1.7,
          }}
        >
          {eyebrow.toUpperCase()}
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            color: c.text,
            fontSize: 23,
            fontWeight: "800",
            letterSpacing: -0.6,
          }}
        >
          {title}
        </Text>
      </View>
      {onPress && action ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{
            minHeight: 44,
            flexShrink: 1,
            flexDirection: "row",
            gap: 4,
            paddingVertical: 5,
            alignItems: "center",
          }}
        >
          <Text style={{ color: c.forest, fontWeight: "800", fontSize: 12 }}>
            {action}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={c.forest} />
        </Pressable>
      ) : null}
    </View>
  );
}
export function FeatureTile({
  title,
  detail,
  icon,
  onPress,
  shade = "green",
}: {
  title: string;
  detail: string;
  icon: IconName;
  onPress: () => void;
  shade?: "orange" | "green" | "blue";
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: 185,
        minWidth: 155,
        maxWidth: 450,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 21,
        padding: 17,
        backgroundColor: c.panel,
        gap: 9,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <IconBubble name={icon} shade={shade} />
      <Text style={{ color: c.text, fontWeight: "800", fontSize: 15 }}>
        {title}
      </Text>
      <Text style={{ color: c.muted, fontSize: 12.5, lineHeight: 18 }}>
        {detail}
      </Text>
      <Ionicons
        name="arrow-forward-circle-outline"
        size={21}
        color={c.forest}
      />
    </Pressable>
  );
}
export function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: IconName;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 138,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.panel,
        padding: 17,
        gap: 7,
      }}
    >
      <Ionicons name={icon} size={20} color={c.forest} />
      <Text
        style={{
          color: c.text,
          fontWeight: "900",
          fontSize: 27,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text style={{ color: c.muted, fontWeight: "600", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}
export function MountainHero({
  tag,
  title,
  subtitle,
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel,
  art = "hero",
}: {
  tag: string;
  title: string;
  subtitle: string;
  onPrimary?: () => void;
  primaryLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  art?: "hero" | "trail";
}) {
  const { width } = useWindowDimensions();
  const compact = width < 620;
  return (
    <ImageBackground
      source={
        art === "hero"
          ? require("../assets/nepal-hero.png")
          : require("../assets/nepal-trails.png")
      }
      resizeMode="cover"
      imageStyle={{ borderRadius: 25 }}
      style={{
        minHeight: compact ? 300 : 295,
        borderRadius: 25,
        overflow: "hidden",
        backgroundColor: "#1F4B56",
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(7,29,40,0.55)",
          justifyContent: "center",
          padding: compact ? 23 : 35,
          gap: 13,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Ionicons name="location-sharp" size={14} color="#FFD7B0" />
          <Text
            style={{
              color: "#FFE1C0",
              fontWeight: "900",
              fontSize: 10.5,
              letterSpacing: 1.6,
            }}
          >
            {tag.toUpperCase()}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          style={{
            color: "#fff",
            maxWidth: 620,
            fontSize: compact ? 32 : 45,
            lineHeight: compact ? 38 : 50,
            letterSpacing: -1.4,
            fontWeight: "900",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: "#ECF1EF",
            maxWidth: 540,
            fontSize: compact ? 13 : 15,
            lineHeight: 22,
          }}
        >
          {subtitle}
        </Text>
        {onPrimary || onSecondary ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 9,
              marginTop: 9,
            }}
          >
            {onPrimary ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={primaryLabel ?? "Get started"}
                onPress={onPrimary}
                style={({ pressed }) => ({
                  minHeight: 47,
                  paddingVertical: 13,
                  paddingHorizontal: 17,
                  borderRadius: 12,
                  backgroundColor: "#CF421F",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{ color: "white", fontWeight: "800", fontSize: 13 }}
                >
                  {primaryLabel ?? "Get started"} ↗
                </Text>
              </Pressable>
            ) : null}
            {onSecondary ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSecondary}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 17,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#BDCFCA",
                  backgroundColor: "rgba(6,24,30,0.42)",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{ color: "white", fontWeight: "800", fontSize: 13 }}
                >
                  {secondaryLabel ?? "Explore"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </ImageBackground>
  );
}

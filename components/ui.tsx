import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from "react-native";
import { useApp } from "../store/app";

/** Shared presentation tokens. Existing store/theme API is intentionally unchanged. */
export function useColors() {
  const light = useApp((s) => s.preferences.theme === "light");
  return light
    ? {
        bg: "#F6F7F4",
        panel: "#FFFFFF",
        raised: "#EEF2F0",
        text: "#132A36",
        muted: "#617782",
        accent: "#CF421F",
        border: "#E2E9E7",
        forest: "#17695D",
        navy: "#102D40",
        blue: "#2C73B9",
        cream: "#FFF4E9",
        accentSoft: "#FDEDE6",
        greenSoft: "#E6F4ED",
        blueSoft: "#E7EFFA",
        onAccent: "#FFFFFF",
        shadow: "#163D42",
      }
    : {
        bg: "#10191E",
        panel: "#1A272D",
        raised: "#25343B",
        text: "#F3F8F6",
        muted: "#A9BCC4",
        accent: "#FF815C",
        border: "#31434B",
        forest: "#5DD6B0",
        navy: "#102D40",
        blue: "#81B9FF",
        cream: "#2D302C",
        accentSoft: "#3E2D2A",
        greenSoft: "#203E37",
        blueSoft: "#21364D",
        onAccent: "#10191E",
        shadow: "#000000",
      };
}

export function Screen({ children }: React.PropsWithChildren) {
  const c = useColors();
  const { width } = useWindowDimensions();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        alignItems: "center",
        flexGrow: 1,
        paddingBottom: 55,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          width: "100%",
          maxWidth: 1240,
          paddingHorizontal: width < 620 ? 16 : 32,
          paddingTop: width < 620 ? 22 : 30,
          gap: width < 620 ? 20 : 26,
        }}
      >
        {children}
      </View>
    </ScrollView>
  );
}
export function Heading({
  children,
  eyebrow,
}: React.PropsWithChildren<{ eyebrow?: string }>) {
  const c = useColors();
  const { width } = useWindowDimensions();
  return (
    <View style={{ gap: 7 }}>
      {eyebrow ? (
        <Text
          style={{
            color: c.accent,
            fontWeight: "800",
            fontSize: 11,
            letterSpacing: 2,
          }}
        >
          {eyebrow.toUpperCase()}
        </Text>
      ) : null}
      <Text
        accessibilityRole="header"
        style={{
          color: c.text,
          fontSize: width < 600 ? 28 : 35,
          fontWeight: "800",
          letterSpacing: -1.15,
          lineHeight: width < 600 ? 34 : 42,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
export function Copy({
  children,
  muted = false,
}: React.PropsWithChildren<{ muted?: boolean }>) {
  const c = useColors();
  return (
    <Text
      style={{ color: muted ? c.muted : c.text, fontSize: 14, lineHeight: 22 }}
    >
      {children}
    </Text>
  );
}
export function Card({ children }: React.PropsWithChildren) {
  const c = useColors();
  return (
    <View
      style={{
        padding: 19,
        borderRadius: 22,
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.border,
        gap: 13,
      }}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 47,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 13,
        backgroundColor: secondary ? c.raised : c.accent,
        opacity: disabled ? 0.45 : pressed ? 0.77 : 1,
      })}
    >
      <Text
        style={{
          color: secondary ? c.text : c.onAccent,
          fontWeight: "800",
          fontSize: 13.5,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Copy muted>{label}</Copy>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={{
          minHeight: 50,
          borderWidth: 1,
          borderColor: c.border,
          padding: 13,
          borderRadius: 12,
          color: c.text,
          backgroundColor: c.bg,
        }}
      />
    </View>
  );
}
export function Metric({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: 90, gap: 4 }}>
      <Text
        style={{
          color: c.text,
          fontSize: 26,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
export function Row({ children }: React.PropsWithChildren) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}
export function Loading() {
  const c = useColors();
  return (
    <Card>
      <ActivityIndicator color={c.accent} accessibilityLabel="Loading" />
      <Copy muted>Getting things ready…</Copy>
    </Card>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <Card>
      <Copy>{title}</Copy>
      <Copy muted>{detail}</Copy>
    </Card>
  );
}

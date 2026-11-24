import { useState, type ComponentProps } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { AthleteText as Text, IconButton } from "./athlete";
import { useColors } from "./ui";

export function DashboardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: {
    icon: ComponentProps<typeof Ionicons>["name"];
    label: string;
    onPress: () => void;
  };
}) {
  const c = useColors();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton
          icon="chevron-back"
          label="Back from dashboard"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: c.text,
              fontSize: 24,
              fontWeight: "700",
              letterSpacing: -0.7,
            }}
          >
            {title}
          </Text>
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>
            {subtitle}
          </Text>
        </View>
        {action ? <IconButton {...action} /> : null}
      </View>
    </>
  );
}
export function DashboardTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  wrap = false,
}: {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  wrap?: boolean;
}) {
  const c = useColors();
  const container = {
    gap: 4,
    padding: 4,
    backgroundColor: c.raised,
    borderRadius: 9,
  };
  const tabs = items.map((item) => (
    <Pressable
      key={item}
      accessibilityRole="tab"
      accessibilityLabel={item}
      aria-selected={item === value}
      accessibilityState={{ selected: item === value }}
      onPress={() => onChange(item)}
      style={{
        minHeight: wrap ? 44 : 36,
        maxWidth: wrap ? "100%" : undefined,
        paddingHorizontal: items.length > 4 ? 8 : 13,
        borderRadius: 7,
        justifyContent: "center",
        backgroundColor: item === value ? c.text : "transparent",
      }}
    >
      <Text
        style={{
          color: item === value ? c.panel : c.muted,
          fontSize: items.length > 4 ? 11 : 12,
          fontWeight: "600",
        }}
      >
        {item}
      </Text>
    </Pressable>
  ));
  return wrap ? (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[container, { flexDirection: "row", flexWrap: "wrap" }]}
    >
      {tabs}
    </View>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={container}
      accessibilityRole="tablist"
      accessibilityLabel={label}
    >
      {tabs}
    </ScrollView>
  );
}
export function DashboardMetric({
  value,
  label,
  detail,
  icon,
  testID,
}: {
  value: string;
  label: string;
  detail: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  testID?: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 13,
        padding: 16,
        gap: 10,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 6,
          alignItems: "center",
        }}
      >
        <Text style={{ color: c.muted, fontSize: 11, flex: 1 }}>{label}</Text>
        <Ionicons name={icon} color={c.forest} size={17} />
      </View>
      <Text
        testID={testID}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          color: c.text,
          fontSize: 26,
          fontWeight: "700",
          letterSpacing: -0.6,
        }}
      >
        {value}
      </Text>
      <Text style={{ color: c.muted, fontSize: 10, lineHeight: 16 }}>
        {detail}
      </Text>
    </View>
  );
}
export function DashboardNotice({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 14,
        backgroundColor: c.accentSoft,
        borderRadius: 10,
      }}
    >
      <Ionicons name="information-circle-outline" size={19} color={c.accent} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: c.text, fontSize: 12, fontWeight: "700" }}>
          {title}
        </Text>
        <Text style={{ color: c.muted, fontSize: 11, lineHeight: 18 }}>
          {detail}
        </Text>
      </View>
    </View>
  );
}
export function DataBarChart({
  data,
  formatValue,
  label,
  emptyMessage = "Your finished activities will build this chart.",
  highlightIndex = data.length - 1,
}: {
  data: { label: string; value: number }[];
  formatValue: (value: number) => string;
  label: string;
  emptyMessage?: string;
  highlightIndex?: number;
}) {
  const c = useColors();
  const maximum = Math.max(0, ...data.map((d) => d.value));
  return (
    <View style={{ gap: 12 }}>
      <View
        accessibilityLabel={label}
        style={{ height: 180, flexDirection: "row", gap: 10 }}
      >
        <View
          style={{
            width: 40,
            paddingTop: 12,
            paddingBottom: 25,
            justifyContent: "space-between",
          }}
        >
          {[maximum, maximum / 2, 0].map((v, i) => (
            <Text
              key={i}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: c.muted, fontSize: 9 }}
            >
              {formatValue(v)}
            </Text>
          ))}
        </View>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 5,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 20 + i * 60,
                height: 1,
                backgroundColor: c.border,
                opacity: 0.6,
              }}
            />
          ))}
          {data.map((d, i) => (
            <View
              key={`${d.label}-${i}`}
              accessible
              accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 7,
              }}
            >
              <View
                style={{
                  width: "100%",
                  alignItems: "center",
                  height: 140,
                  justifyContent: "flex-end",
                }}
              >
                <View
                  style={{
                    width: "72%",
                    maxWidth: 42,
                    height: maximum > 0 ? (d.value / maximum) * 125 : 0,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: i === highlightIndex ? c.accent : c.forest,
                  }}
                />
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: c.muted,
                  fontSize: data.length > 7 ? 9 : 10,
                  width: "100%",
                  textAlign: "center",
                  paddingBottom: 8,
                }}
              >
                {d.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {!maximum ? (
        <Text style={{ color: c.muted, fontSize: 11, lineHeight: 18 }}>
          {emptyMessage}
        </Text>
      ) : null}
    </View>
  );
}
export function DataLineChart({
  data,
  label,
}: {
  data: { label: string; value: number }[];
  label: string;
}) {
  const [width, setWidth] = useState(300);
  const max = Math.max(0, ...data.map((d) => d.value));
  const points = data.map((d, i) => ({
    x: 7 + (i / Math.max(1, data.length - 1)) * (width - 14),
    y: 98 - (d.value / Math.max(1, max)) * 80,
  }));
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 116, overflow: "hidden" }}
    >
      {[18, 58, 98].map((top) => (
        <View
          key={top}
          style={{
            position: "absolute",
            top,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: "#425363",
            opacity: 0.5,
          }}
        />
      ))}
      {max > 0
        ? points.slice(1).map((point, i) => {
            const before = points[i],
              dx = point.x - before.x,
              dy = point.y - before.y,
              distance = Math.hypot(dx, dy);
            return (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: (before.x + point.x) / 2 - distance / 2,
                  top: (before.y + point.y) / 2 - 1,
                  width: distance,
                  height: 2,
                  backgroundColor: "#8DDDBF",
                  transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                }}
              />
            );
          })
        : null}
      {data.length > 0 ? (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#B9CCD5", fontSize: 9 }}>{data[0].label}</Text>
          <Text style={{ color: "#B9CCD5", fontSize: 9 }}>
            {data.at(-1)!.label}
          </Text>
        </View>
      ) : null}
      {max > 0 ? (
        points.map((point, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: point.x - 3,
              top: point.y - 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: "#FF936E",
            }}
          />
        ))
      ) : (
        <Text
          style={{
            color: "#B9CCD5",
            fontSize: 12,
            textAlign: "center",
            paddingTop: 47,
          }}
        >
          No recorded distance in this period
        </Text>
      )}
    </View>
  );
}

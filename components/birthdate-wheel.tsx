import { useEffect, useRef, type ComponentRef } from "react";
import { ScrollView, Text, View } from "react-native";
export function BirthdateWheel({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  selected: number;
  onChange: (index: number) => void;
}) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrolling = useRef(false);
  useEffect(() => {
    if (!scrolling.current)
      ref.current?.scrollTo({ y: selected * 44, animated: false });
  }, [selected, values.length]);
  const settle = (offset: number) => {
    scrolling.current = false;
    const index = Math.max(
      0,
      Math.min(values.length - 1, Math.round(offset / 44)),
    );
    ref.current?.scrollTo({ y: index * 44, animated: true });
    onChange(index);
  };
  return (
    <View
      style={{ flex: label === "Month" ? 1.6 : 1, minWidth: 0 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 1,
        max: values.length,
        now: selected + 1,
        text: values[selected],
      }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) =>
        onChange(
          Math.max(
            0,
            Math.min(
              values.length - 1,
              selected +
                (event.nativeEvent.actionName === "increment" ? 1 : -1),
            ),
          ),
        )
      }
    >
      <ScrollView
        ref={ref}
        style={{ height: 220 }}
        contentContainerStyle={{ paddingVertical: 88 }}
        showsVerticalScrollIndicator={false}
        snapToInterval={44}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          scrolling.current = true;
        }}
        onScroll={(event) => {
          if (scrolling.current)
            onChange(
              Math.max(
                0,
                Math.min(
                  values.length - 1,
                  Math.round(event.nativeEvent.contentOffset.y / 44),
                ),
              ),
            );
        }}
        onScrollEndDrag={(event) => {
          if (!event.nativeEvent.velocity?.y)
            settle(event.nativeEvent.contentOffset.y);
        }}
        onMomentumScrollEnd={(event) =>
          settle(event.nativeEvent.contentOffset.y)
        }
      >
        {values.map((value, index) => (
          <Text
            key={value}
            onPress={() => onChange(index)}
            style={{
              height: 44,
              lineHeight: 44,
              textAlign: "center",
              color: index === selected ? "white" : "#8b929f",
              opacity: Math.abs(index - selected) > 1 ? 0.45 : 1,
              fontSize: index === selected ? 19 : 16,
              fontWeight: index === selected ? "700" : "400",
            }}
          >
            {value}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

import { useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BirthdateSelection } from "./birthdate-selection";
import { Button, Copy, useColors } from "./ui";
import {
  calendarString,
  displayBirthdate,
  initialBirthdate,
  localCalendar,
} from "../features/athlete/birthdate";

export function BirthdatePicker({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => initialBirthdate(value));
  const c = useColors();
  const insets = useSafeAreaInsets();
  const today = localCalendar();
  return (
    <View style={{ gap: 8 }}>
      <Copy>Date of Birth</Copy>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Date of Birth"
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setDraft(initialBirthdate(value));
          setOpen(true);
        }}
        style={{
          padding: 14,
          borderRadius: 10,
          backgroundColor: c.raised,
          borderColor: c.border,
          borderWidth: 1,
        }}
      >
        <Text style={{ color: c.text }}>{displayBirthdate(value)}</Text>
      </Pressable>
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear birthdate"
          disabled={disabled}
          onPress={() => onChange(null)}
        >
          <Copy muted>Clear birthdate</Copy>
        </Pressable>
      ) : null}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,.65)" }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: Math.max(16, insets.top),
            paddingBottom: Math.max(16, insets.bottom),
          }}
        >
          <View
            accessibilityViewIsModal
            role="dialog"
            aria-label="Choose Date of Birth"
            style={{
              width: "100%",
              maxWidth: 420,
              padding: 20,
              borderRadius: 22,
              backgroundColor: "#191d25",
              gap: 16,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ color: "white", fontSize: 21, fontWeight: "700" }}
            >
              Choose Date of Birth
            </Text>
            {open ? (
              <BirthdateSelection
                value={draft}
                today={today}
                onChange={setDraft}
              />
            ) : null}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Cancel"
                  secondary
                  onPress={() => setOpen(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="OK"
                  onPress={() => {
                    onChange(calendarString(draft));
                    setOpen(false);
                  }}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

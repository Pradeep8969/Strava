import { Text, View } from "react-native";
import { BirthdateWheel } from "./birthdate-wheel";
import {
  clampBirthdate,
  daysInMonth,
  months,
  type CalendarDate,
} from "../features/athlete/birthdate";
export function BirthdateSelection({
  value,
  today,
  onChange,
}: {
  value: CalendarDate;
  today: CalendarDate;
  onChange: (value: CalendarDate) => void;
}) {
  const years = Array.from({ length: 121 }, (_, i) => today.year - 120 + i);
  const monthCount = value.year === today.year ? today.month : 12;
  const dayCount = Math.min(
    daysInMonth(value.year, value.month),
    value.year === today.year && value.month === today.month ? today.day : 31,
  );
  const update = (patch: Partial<CalendarDate>) =>
    onChange(clampBirthdate({ ...value, ...patch }, today));
  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {["Day", "Month", "Year"].map((label) => (
          <Text
            key={label}
            style={{
              flex: label === "Month" ? 1.6 : 1,
              color: "#aab0bc",
              textAlign: "center",
            }}
          >
            {label}
          </Text>
        ))}
      </View>
      <View style={{ position: "relative", flexDirection: "row" }}>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 88,
            height: 44,
            left: 0,
            right: 0,
            backgroundColor: "#303642",
            borderRadius: 9,
          }}
        />
        <BirthdateWheel
          label="Day"
          values={Array.from({ length: dayCount }, (_, i) => String(i + 1))}
          selected={value.day - 1}
          onChange={(i) => update({ day: i + 1 })}
        />
        <BirthdateWheel
          label="Month"
          values={months.slice(0, monthCount)}
          selected={value.month - 1}
          onChange={(i) => update({ month: i + 1 })}
        />
        <BirthdateWheel
          label="Year"
          values={years.map(String)}
          selected={value.year - years[0]}
          onChange={(i) => update({ year: years[i] })}
        />
      </View>
    </View>
  );
}

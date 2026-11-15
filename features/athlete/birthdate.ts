// Birthdates are calendar strings, never UTC instants.
export const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export type CalendarDate = { year: number; month: number; day: number };
export function calendarString({ year, month, day }: CalendarDate) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function localCalendar(date = new Date()): CalendarDate {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}
export function parseCalendar(value: string): CalendarDate {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}
export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0, 12).getDate();
}
export function clampBirthdate(
  date: CalendarDate,
  today = localCalendar(),
): CalendarDate {
  const year = Math.max(today.year - 120, Math.min(date.year, today.year));
  const month = Math.max(
    1,
    Math.min(date.month, year === today.year ? today.month : 12),
  );
  const day = Math.max(
    1,
    Math.min(
      date.day,
      daysInMonth(year, month),
      year === today.year && month === today.month ? today.day : 31,
    ),
  );
  return { year, month, day };
}
export function initialBirthdate(
  value: string | null,
  today = localCalendar(),
) {
  return clampBirthdate(
    value ? parseCalendar(value) : { ...today, year: today.year - 18 },
    today,
  );
}
export function nativeDate(date: CalendarDate) {
  return new Date(date.year, date.month - 1, date.day, 12);
}
export function displayBirthdate(value: string | null) {
  if (!value) return "Not set";
  const date = parseCalendar(value);
  return `${date.day} ${months[date.month - 1]} ${date.year}`;
}

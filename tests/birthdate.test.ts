import { afterEach, expect, it } from "vitest";
import {
  calendarString,
  clampBirthdate,
  daysInMonth,
  displayBirthdate,
  initialBirthdate,
  localCalendar,
  nativeDate,
  parseCalendar,
} from "../features/athlete/birthdate";
const today = { year: 2026, month: 11, day: 15 };
const timezone = process.env.TZ;
afterEach(() => {
  if (timezone === undefined) delete process.env.TZ;
  else process.env.TZ = timezone;
});
it("initializes from a calendar value or a valid adult default without mutating the form", () => {
  expect(initialBirthdate("2004-11-18", today)).toEqual({
    year: 2004,
    month: 11,
    day: 18,
  });
  expect(initialBirthdate(null, today)).toEqual({
    year: 2008,
    month: 11,
    day: 15,
  });
  expect(displayBirthdate("2004-11-18")).toBe("18 November 2004");
  expect(displayBirthdate(null)).toBe("Not set");
});
it("clamps month lengths and Gregorian leap years", () => {
  expect(daysInMonth(2000, 2)).toBe(29);
  expect(daysInMonth(1900, 2)).toBe(28);
  expect(daysInMonth(2004, 2)).toBe(29);
  expect(clampBirthdate({ year: 2004, month: 2, day: 31 }, today).day).toBe(29);
  expect(clampBirthdate({ year: 2005, month: 2, day: 29 }, today).day).toBe(28);
  expect(clampBirthdate({ year: 2005, month: 4, day: 31 }, today).day).toBe(30);
});
it("never produces future dates and matches the existing 120 year range", () => {
  expect(clampBirthdate({ year: 2027, month: 12, day: 31 }, today)).toEqual(
    today,
  );
  expect(clampBirthdate({ year: 1800, month: 1, day: 1 }, today).year).toBe(
    1906,
  );
});
it("preserves date-only strings across western, Nepal and date-line timezones", () => {
  for (const zone of [
    "America/Los_Angeles",
    "Asia/Kathmandu",
    "Pacific/Kiritimati",
    "Pacific/Pago_Pago",
  ]) {
    process.env.TZ = zone;
    for (const value of ["2004-02-29", "2004-11-18", "2026-01-01"]) {
      expect(
        calendarString(localCalendar(nativeDate(parseCalendar(value)))),
      ).toBe(value);
      expect(calendarString(parseCalendar(value))).toBe(value);
    }
  }
});

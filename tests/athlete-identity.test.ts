import { expect, it } from "vitest";
import { athleteIdentity } from "../features/athlete/identity";

it.each([
  ["Pradeep Pandey", "Pradeep"],
  ["  Maya   Sherpa  ", "Maya"],
  ["Tenzing", "Tenzing"],
  ["पेम्बा शेर्पा", "पेम्बा"],
])("derives the greeting from profile name %s", (name, firstName) => {
  const identity = athleteIdentity(
    "user",
    { id: "user", name, username: null },
    false,
  );
  expect(identity.firstName).toBe(firstName);
  expect(identity.greeting).toBe(`Namaste, ${firstName}.`);
  expect(identity.fullName).toBe(name.trim());
});
it("does not show an athlete placeholder while authenticating or loading a profile", () => {
  expect(athleteIdentity(undefined, undefined, true)).toEqual({
    fullName: "",
    firstName: "",
    greeting: "Namaste.",
  });
  expect(athleteIdentity("user", undefined, true)).toEqual({
    fullName: "",
    firstName: "",
    greeting: "Namaste.",
  });
});
it("never exposes another account's cached identity or a signed-out identity", () => {
  const previous = { id: "previous", name: "Previous User", username: null };
  expect(athleteIdentity("next", previous, true).greeting).toBe("Namaste.");
  expect(athleteIdentity(undefined, previous, false)).toEqual({
    fullName: "",
    firstName: "",
    greeting: "Namaste, athlete.",
  });
});
it("uses safe fallbacks for genuinely missing profile names", () => {
  expect(athleteIdentity("user", undefined, false).fullName).toBe("Athlete");
  expect(
    athleteIdentity(
      "user",
      { id: "user", name: " ", username: "trail_runner" },
      false,
    ).greeting,
  ).toBe("Namaste, trail_runner.");
});

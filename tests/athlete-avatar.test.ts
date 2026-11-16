import { expect, it } from "vitest";
import { athleteAvatarSources } from "../features/athlete/avatar";

const google = "https://lh3.googleusercontent.com/example-photo";
const user = { id: "current", user_metadata: { picture: google } };

it("recovers Google metadata without a stored photo, including after refresh", () => {
  const profile = { id: user.id, avatar_path: null };
  expect(athleteAvatarSources(user, profile)).toEqual([google]);
  expect(
    athleteAvatarSources(JSON.parse(JSON.stringify(user)), profile),
  ).toEqual([google]);
  expect(profile.avatar_path).toBeNull();
});

it.each(["current/custom.jpg", "https://example.test/custom.jpg"])(
  "keeps saved photo %s ahead of Google",
  (avatar_path) => {
    expect(athleteAvatarSources(user, { id: user.id, avatar_path })).toEqual([
      avatar_path,
      google,
    ]);
  },
);

it("rejects malformed URLs and foreign storage paths", () => {
  for (const avatar_path of [
    "http://insecure.test/photo",
    "javascript:alert(1)",
    "other/private.jpg",
    "broken",
  ])
    expect(athleteAvatarSources(user, { id: user.id, avatar_path })).toEqual([
      google,
    ]);
});

it("does not borrow another account's cached photo or signed-out identity", () => {
  const previous = {
    id: "previous",
    avatar_path: "https://example.test/previous.jpg",
  };
  expect(athleteAvatarSources(user, previous)).toEqual([google]);
  expect(athleteAvatarSources(undefined, previous)).toEqual([]);
  expect(
    athleteAvatarSources({ id: "next", user_metadata: {} }, previous),
  ).toEqual([]);
});

it("uses linked Google identity data without borrowing Facebook metadata", () => {
  const linked = {
    ...user,
    user_metadata: { picture: "https://example.test/facebook.jpg" },
    identities: [
      {
        id: "facebook",
        user_id: user.id,
        identity_id: "facebook",
        provider: "facebook",
        identity_data: {},
      },
      {
        id: "google",
        user_id: user.id,
        identity_id: "google",
        provider: "google",
        identity_data: { avatar_url: google },
      },
    ],
  } as Parameters<typeof athleteAvatarSources>[0];
  expect(athleteAvatarSources(linked, undefined)).toEqual([google]);
});

it("returns no candidates for missing or invalid photos and deduplicates", () => {
  expect(
    athleteAvatarSources(
      { id: "current", user_metadata: { picture: "invalid" } },
      undefined,
    ),
  ).toEqual([]);
  expect(
    athleteAvatarSources(user, { id: user.id, avatar_path: google }),
  ).toEqual([google]);
});

import { loadAthleteProfile, saveAthleteProfile } from "../services/profile";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  avatarUrl,
  providerProfile,
  profileChanges,
} from "../features/athlete/profile";
const { client, query } = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
  };
  return {
    query,
    client: { from: vi.fn(), rpc: vi.fn(), auth: { getUser: vi.fn() } },
  };
});
it("uses Google identity metadata without mixing linked Facebook or user metadata", () => {
  const linked = {
    user_metadata: {
      name: "Facebook name",
      picture: "https://example.com/facebook",
    },
    identities: [
      {
        id: "fb",
        identity_id: "fb",
        user_id: row.id,
        provider: "facebook",
        identity_data: { name: "Facebook name" },
      },
      {
        provider: "google",
        id: "google",
        identity_id: "google",
        user_id: row.id,
        identity_data: {
          full_name: 42,
          name: "Google identity",
          avatar_url: "http://unsafe",
          picture: "https://example.com/google",
        },
      },
    ],
  } as Parameters<typeof providerProfile>[0];
  expect(providerProfile(linked, "google")).toEqual({
    name: "Google identity",
    avatar: "https://example.com/google",
  });
  expect(providerProfile(linked, "missing")).toEqual({
    name: "",
    avatar: null,
  });
});
vi.mock("../services/supabase", () => ({ backend: () => client }));
const row = {
  id: "auth-user",
  name: "Athlete",
  username: null,
  bio: "My bio",
  avatar_path: null,
  is_private: true,
};
const user = {
  user_metadata: {
    full_name: "Google Athlete",
    avatar_url: "https://example.com/photo",
  },
  identities: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  client.from.mockReturnValue(query);
  for (const method of [query.select, query.eq, query.is, query.update])
    method.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: row, error: null });
});
describe("provider profile metadata", () => {
  it("supports Google, Facebook picture objects and email without inferring usernames", () => {
    expect(providerProfile(user)).toEqual({
      name: "Google Athlete",
      avatar: "https://example.com/photo",
    });
    expect(
      providerProfile({
        user_metadata: {
          name: "Facebook Athlete",
          picture: { data: { url: "https://example.com/fb" } },
        },
      }),
    ).toEqual({ name: "Facebook Athlete", avatar: "https://example.com/fb" });
    expect(providerProfile({ user_metadata: {} })).toEqual({
      name: "",
      avatar: null,
    });
  });
  it("rejects unsafe avatar URLs and bounds metadata names", () => {
    for (const value of [
      "http://example.com/p",
      "javascript:alert(1)",
      "data:image/png,x",
      "https://user:pass@example.com",
    ])
      expect(avatarUrl(value)).toBeNull();
    expect(
      providerProfile({ user_metadata: { name: "a".repeat(100) } }).name,
    ).toHaveLength(80);
  });
});
it("allows optional usernames and preserves unchanged custom fields", () => {
  expect(profileChanges(row, { ...row, name: "New name" })).toEqual({
    name: "New name",
  });
  expect(profileChanges(row, row)).toEqual({});
  expect(() => profileChanges(row, { ...row, username: "INVALID" })).toThrow();
  expect(() =>
    profileChanges(row, { ...row, avatar_path: "http://unsafe.com" }),
  ).toThrow();
});
it("loads only the authenticated user's row without synchronizing existing values", async () => {
  expect(await loadAthleteProfile(row.id)).toEqual(row);
  expect(query.eq).toHaveBeenCalledWith("id", row.id);
  expect(client.rpc).not.toHaveBeenCalled();
  expect(query.update).not.toHaveBeenCalled();
});
it("repairs missing rows through an idempotent owner-scoped RPC", async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  client.rpc.mockResolvedValue({ error: null });
  expect(await loadAthleteProfile(row.id)).toEqual(row);
  expect(client.rpc).toHaveBeenCalledWith("ensure_athlete_profile");
});
it("reports RLS errors and rejects a mismatched profile", async () => {
  query.maybeSingle.mockResolvedValueOnce({
    data: null,
    error: new Error("RLS"),
  });
  await expect(loadAthleteProfile(row.id)).rejects.toThrow("RLS");
  await expect(loadAthleteProfile("someone-else")).rejects.toThrow(
    "does not match",
  );
});
it("saves only changed fields under the owner ID and compares the original value", async () => {
  await saveAthleteProfile(row.id, row, { ...row, name: "Custom name" });
  expect(query.update).toHaveBeenCalledWith({ name: "Custom name" });
  expect(query.eq).toHaveBeenCalledWith("id", row.id);
  expect(query.eq).toHaveBeenCalledWith("name", "Athlete");
  expect(await loadAthleteProfile(row.id)).toEqual(row);
});
it("does not silently succeed when RLS or a concurrent edit prevents a save", async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(
    saveAthleteProfile(row.id, row, { ...row, name: "New" }),
  ).rejects.toThrow("changed elsewhere");
});
it("repeated unchanged saves make no writes", async () => {
  await saveAthleteProfile(row.id, row, row);
  await saveAthleteProfile(row.id, row, row);
  expect(query.update).not.toHaveBeenCalled();
});
it("reloads saved values across fresh profile loads without replacing them from provider metadata", async () => {
  let persisted = { ...row };
  let patch: Partial<typeof row> = {};
  query.update.mockImplementation((changes) => {
    patch = changes;
    return query;
  });
  query.maybeSingle.mockImplementation(async () => {
    persisted = { ...persisted, ...patch };
    patch = {};
    return { data: { ...persisted }, error: null };
  });
  await saveAthleteProfile(row.id, row, {
    ...row,
    name: "My chosen name",
    bio: "My chosen bio",
    avatar_path: "https://example.com/custom.jpg",
  });
  for (let i = 0; i < 3; i++) {
    const loaded = await loadAthleteProfile(row.id);
    expect(loaded.name).toBe("My chosen name");
    expect(loaded.bio).toBe("My chosen bio");
    expect(loaded.avatar_path).toBe("https://example.com/custom.jpg");
  }
});

import { beforeEach, expect, it, vi } from "vitest";
import {
  scheduleGoogleProfileSync,
  resumeGoogleProfileSync,
  discardGoogleProfileSync,
} from "../services/google-profile-sync";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
const fake = vi.hoisted(() => ({
  stored: new Map<string, string>(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  row: null as Record<string, unknown> | null,
  filters: [] as [string, unknown][],
  patch: null as Record<string, unknown> | null,
  writes: [] as Record<string, unknown>[],
  fail: false,
}));
vi.mock("../services/supabase", () => ({
  backend: () => ({
    auth: { getUser: fake.getUser },
    from: fake.from,
    rpc: fake.rpc,
  }),
  storage: {
    getItem: async (key: string) => fake.stored.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      fake.stored.set(key, value);
    },
    removeItem: async (key: string) => {
      fake.stored.delete(key);
    },
  },
}));
const user = {
  id: "supabase-user",
  email: "runner@example.test",
  user_metadata: {
    name: "Wrong provider",
    picture: "https://example.test/wrong",
  },
  identities: [
    {
      provider: "facebook",
      id: "fb-subject",
      identity_data: { name: "Facebook name" },
    },
    {
      provider: "google",
      id: "google-subject",
      identity_data: {
        full_name: "Google Runner",
        picture: "https://example.test/google",
        email: "runner@example.test",
      },
    },
  ],
};
const original = {
  id: user.id,
  name: "Athlete",
  avatar_path: null,
  bio: "Keep my bio",
  username: "runner",
  is_private: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  fake.stored.clear();
  fake.row = { ...original };
  fake.writes = [];
  fake.fail = false;
  fake.getUser.mockResolvedValue({ data: { user }, error: null });
  fake.rpc.mockImplementation(async () => {
    fake.row ??= { ...original };
    return { error: null };
  });
  fake.from.mockImplementation((table) => {
    expect(table).toBe("profiles");
    fake.filters = [];
    fake.patch = null;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        fake.filters.push([key, value]);
        return query;
      },
      is: (key: string, value: unknown) => {
        fake.filters.push([key, value]);
        return query;
      },
      update: (patch: Record<string, unknown>) => {
        fake.patch = patch;
        return query;
      },
      maybeSingle: async () => {
        expect(fake.filters).toContainEqual(["id", user.id]);
        if (fake.patch) {
          if (fake.fail)
            return { data: null, error: new Error("Network error") };
          fake.writes.push(fake.patch);
          fake.row = { ...fake.row, ...fake.patch };
        }
        return { data: fake.row && { ...fake.row }, error: null };
      },
    };
    return query;
  });
});
it("preserves owner-uploaded custom avatars on every Google sign-in", async () => {
  fake.row = { ...original, avatar_path: `${user.id}/custom.jpg` };
  await scheduleGoogleProfileSync(user.id);
  expect(fake.row?.avatar_path).toBe(`${user.id}/custom.jpg`);
  expect(fake.writes).toEqual([{ name: "Google Runner" }]);
});
it("automatically replaces placeholders with Google identity data, preserving every unrelated field", async () => {
  await scheduleGoogleProfileSync(user.id);
  expect(fake.writes).toEqual([
    { name: "Google Runner", avatar_path: "https://example.test/google" },
  ]);
  expect(fake.row).toEqual({ ...original, ...fake.writes[0] });
  expect(fake.stored.size).toBe(0);
});
it("creates a missing profile through the existing idempotent repair RPC under the Supabase ID", async () => {
  fake.row = null;
  await scheduleGoogleProfileSync(user.id);
  expect(fake.rpc).toHaveBeenCalledWith("ensure_athlete_profile");
  expect(fake.row).toMatchObject({ id: user.id, name: "Google Runner" });
});
it("syncs again after another Google sign-in, overriding manual name/photo only; repeated syncs are idempotent", async () => {
  fake.row = { ...original, name: "Manual", avatar_path: "owner/custom.jpg" };
  await scheduleGoogleProfileSync(user.id);
  await scheduleGoogleProfileSync(user.id);
  await resumeGoogleProfileSync(user.id); // refresh after completed sync
  expect(fake.writes).toHaveLength(1);
  fake.row!.name = "Manual again";
  await scheduleGoogleProfileSync(user.id);
  expect(fake.row?.name).toBe("Google Runner");
  expect(fake.row?.bio).toBe(original.bio);
});
it("never erases valid values when Google metadata is missing or unsafe", async () => {
  fake.row = {
    ...original,
    name: "Valid name",
    avatar_path: "owner/custom.jpg",
  };
  fake.getUser.mockResolvedValue({
    data: {
      user: {
        ...user,
        identities: [
          user.identities[0],
          {
            provider: "google",
            id: "google-subject",
            identity_data: { name: " ", picture: "http://unsafe" },
          },
        ],
      },
    },
    error: null,
  });
  await scheduleGoogleProfileSync(user.id);
  expect(fake.writes).toEqual([]);
  expect(fake.row?.name).toBe("Valid name");
});
it("updates an available photo even with no Google name", async () => {
  fake.getUser.mockResolvedValue({
    data: {
      user: {
        ...user,
        identities: [
          user.identities[0],
          {
            provider: "google",
            id: "google-subject",
            identity_data: { picture: "https://example.test/photo-only" },
          },
        ],
      },
    },
    error: null,
  });
  await scheduleGoogleProfileSync(user.id);
  expect(fake.writes).toEqual([
    { avatar_path: "https://example.test/photo-only" },
  ]);
});
it("does not sync restored or non-Google sessions unless a Google callback scheduled it", async () => {
  await resumeGoogleProfileSync(user.id);
  expect(fake.getUser).not.toHaveBeenCalled();
  expect(fake.writes).toEqual([]);
});
it("retries failed syncs after refresh without exchanging the OAuth code again", async () => {
  fake.fail = true;
  await expect(scheduleGoogleProfileSync(user.id)).rejects.toThrow("Network");
  expect(fake.stored.size).toBe(1);
  fake.fail = false;
  await Promise.all([
    resumeGoogleProfileSync(user.id),
    resumeGoogleProfileSync(user.id),
  ]);
  expect(fake.writes).toHaveLength(1);
  expect(fake.stored.size).toBe(0);
});
it("rejects switched accounts and missing Google identities without writing", async () => {
  fake.getUser.mockResolvedValueOnce({
    data: { user: { ...user, id: "different" } },
    error: null,
  });
  await expect(scheduleGoogleProfileSync(user.id)).rejects.toThrow(
    "account changed",
  );
  fake.getUser.mockResolvedValueOnce({
    data: { user: { ...user, identities: [user.identities[0]] } },
    error: null,
  });
  await expect(resumeGoogleProfileSync(user.id)).rejects.toThrow(
    "No Google identity",
  );
  expect(fake.writes).toEqual([]);
  await discardGoogleProfileSync(user.id);
  await resumeGoogleProfileSync(user.id);
  expect(fake.stored.size).toBe(0);
});

import { beforeEach, expect, it, vi } from "vitest";
import { storage } from "../services/supabase";
const fixture = vi.hoisted(() => ({
  os: "ios",
  secure: new Map<string, string>(),
  web: new Map<string, string>(),
  from: vi.fn(),
}));
function validateKey(key: string) {
  if (!key || /[^A-Za-z0-9._-]/.test(key))
    throw new Error("Invalid key provided to SecureStore");
}
function secureAddress(key: string, options?: { keychainService?: string }) {
  validateKey(key);
  return options?.keychainService ? `${options.keychainService}/${key}` : key;
}
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return fixture.os;
    },
  },
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string, options?: { keychainService?: string }) =>
    fixture.secure.get(secureAddress(key, options)) ?? null,
  setItemAsync: async (
    key: string,
    value: string,
    options?: { keychainService?: string },
  ) => {
    fixture.secure.set(secureAddress(key, options), value);
  },
  deleteItemAsync: async (
    key: string,
    options?: { keychainService?: string },
  ) => {
    fixture.secure.delete(secureAddress(key, options));
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (
    _url: string,
    _key: string,
    options: {
      auth: { storage: typeof storage };
    },
  ) => ({
    auth: {
      getSession: async () => ({
        data: {
          session: JSON.parse(
            (await options.auth.storage.getItem("sb-example-auth-token")) ??
              "null",
          ),
        },
      }),
      getUser: async () => ({
        data: { user: null },
        error: new Error("Offline"),
      }),
    },
    from: fixture.from,
  }),
}));
vi.mock("react-native-url-polyfill/auto", () => ({}));
beforeEach(() => {
  fixture.os = "ios";
  fixture.secure.clear();
  fixture.web.clear();
  fixture.from.mockReset();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => fixture.web.get(k) ?? null,
      setItem: (k: string, v: string) => {
        fixture.web.set(k, v);
      },
      removeItem: (k: string) => {
        fixture.web.delete(k);
      },
    },
  });
});
it("restores a legacy Android Google session and PKCE key, then loads the signed-in profile", async () => {
  fixture.os = "android";
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    app_metadata: { provider: "google" },
  };
  const session = { access_token: "existing-token", user };
  fixture.secure.set("sb-example-auth-token.count", "1");
  fixture.secure.set("sb-example-auth-token.0", JSON.stringify(session));
  fixture.secure.set("sb-example-auth-token-code-verifier.count", "1");
  fixture.secure.set("sb-example-auth-token-code-verifier.0", "verifier");
  const row = { id: user.id, name: "Existing athlete" };
  fixture.from.mockReturnValue({
    select: () => ({
      eq: (column: string, id: string) => ({
        maybeSingle: async () => ({
          data: column === "id" && id === user.id ? row : null,
          error: null,
        }),
      }),
    }),
  });
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  vi.resetModules();
  try {
    const { supabase, storage: restoredStorage } =
      await import("../services/supabase");
    const { resumeGoogleProfileSync: resumeSync } =
      await import("../services/google-profile-sync");
    const { loadAthleteProfile: loadProfile } =
      await import("../services/profile");
    const { data } = await supabase!.auth.getSession();
    expect(data.session).toEqual(session);
    const id = data.session!.user.id;
    await resumeSync(id);
    expect(await loadProfile(id)).toEqual(row);
    expect(
      await restoredStorage.getItem("sb-example-auth-token-code-verifier"),
    ).toBe("verifier");
    expect(fixture.secure.size).toBe(4);
  } finally {
    vi.unstubAllEnvs();
  }
});

it("keeps pending Android markers scoped to the account that initiated Google sign-in", async () => {
  fixture.os = "android";
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  vi.resetModules();
  try {
    const sync = await import("../services/google-profile-sync");
    await expect(sync.scheduleGoogleProfileSync("account-a")).rejects.toThrow(
      "Offline",
    );
    expect(
      fixture.secure.get("stravakinda.google-profile-pending.account-a.0"),
    ).toBe("pending");
    await sync.resumeGoogleProfileSync("account-b");
    await sync.discardGoogleProfileSync("account-b");
    expect(
      fixture.secure.get("stravakinda.google-profile-pending.account-a.0"),
    ).toBe("pending");
    await sync.discardGoogleProfileSync("account-a");
    expect(fixture.secure.size).toBe(0);
  } finally {
    vi.unstubAllEnvs();
  }
});
it("persists long native sessions through SecureStore chunks and removes all token chunks", async () => {
  const value = "session-token".repeat(400);
  await storage.setItem("auth", value);
  expect(await storage.getItem("auth")).toBe(value);
  expect(fixture.secure.size).toBeGreaterThan(2);
  await storage.removeItem("auth");
  expect(await storage.getItem("auth")).toBeNull();
  expect(fixture.secure.size).toBe(0);
});
it("persists web PKCE/session values in browser storage without using SQLite", async () => {
  fixture.os = "web";
  await storage.setItem("verifier", "test-verifier");
  expect(fixture.web.get("verifier")).toBe("test-verifier");
  expect(await storage.getItem("verifier")).toBe("test-verifier");
  await storage.removeItem("verifier");
  expect(await storage.getItem("verifier")).toBeNull();
  expect(fixture.secure.size).toBe(0);
});

it("round-trips disallowed native keys without conflating accounts or changing legal keys", async () => {
  fixture.os = "android";
  const keys = [
    "",
    "stravakinda.google-profile-pending:owner",
    "owner/account",
    "owner:account",
    "owner@account",
    "owner account",
    "owner\n",
    "owner_生",
    "stravakinda.encoded.0061002f0062",
    "a/b",
  ];
  for (const key of keys) await storage.setItem(key, `value:${key}`);
  for (const key of keys)
    expect(await storage.getItem(key)).toBe(`value:${key}`);
  expect(fixture.secure.get("stravakinda.encoded.0061002f0062.0")).toBe(
    "value:stravakinda.encoded.0061002f0062",
  );
  await storage.removeItem("a/b");
  expect(await storage.getItem("a/b")).toBeNull();
  expect(await storage.getItem("stravakinda.encoded.0061002f0062")).toBe(
    "value:stravakinda.encoded.0061002f0062",
  );
  for (const key of keys) await storage.removeItem(key);
  expect(fixture.secure.size).toBe(0);
});

it("removes the Android session on logout and restores the next login without removing the previous account's marker", async () => {
  fixture.os = "android";
  const sessionKey = "sb-example-auth-token";
  const first = JSON.stringify({
    user: { id: "owner-one" },
    access_token: "first",
  });
  const second = JSON.stringify({
    user: { id: "owner-two" },
    access_token: "second",
  });
  const marker = "stravakinda.google-profile-pending.owner-one";
  await storage.setItem(sessionKey, first);
  await storage.setItem(marker, "pending");
  await storage.removeItem(sessionKey);
  expect(await storage.getItem(sessionKey)).toBeNull();
  await storage.setItem(sessionKey, second);
  expect(await storage.getItem(sessionKey)).toBe(second);
  expect(await storage.getItem(marker)).toBe("pending");
  expect(
    await storage.getItem("stravakinda.google-profile-pending.owner-two"),
  ).toBeNull();
});

it("continues reading existing browser markers under their original colon-delimited key", async () => {
  fixture.os = "web";
  const key = "stravakinda.google-profile-pending:owner";
  fixture.web.set(key, "pending");
  expect(await storage.getItem(key)).toBe("pending");
  await storage.setItem(key, "updated");
  expect(fixture.web.get(key)).toBe("updated");
  await storage.removeItem(key);
  expect(fixture.web.has(key)).toBe(false);
  expect(fixture.secure.size).toBe(0);
});

import { beforeEach, expect, it, vi } from "vitest";
import {
  callbackAddress,
  callbackParameters,
  credentialsError,
} from "../features/auth/validation";
import { canAccessLocalWorkout } from "../features/auth/local-access";
import {
  completeAuthCallback,
  emailAuthentication,
  requestPasswordReset,
  startOAuth,
  signOutAccount,
  cancelOAuth,
} from "../services/auth";
const fake = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    resend: vi.fn(),
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
  },
  open: vi.fn(),
  sync: vi.fn(),
  discardSync: vi.fn(),
  stored: new Map<string, string>(),
  listener: undefined as undefined | ((event: string) => void),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-linking", () => ({ openURL: fake.open }));
vi.mock("../services/supabase", () => ({
  backend: () => fake,
  storage: {
    getItem: async (k: string) => fake.stored.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      fake.stored.set(k, v);
    },
    removeItem: async (k: string) => {
      fake.stored.delete(k);
    },
  },
}));
vi.mock("../services/push", () => ({
  unregisterPushBeforeSignOut: async () => {},
}));
vi.mock("../services/google-profile-sync", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/google-profile-sync")>();
  return {
    ...actual,
    scheduleGoogleProfileSync: fake.sync,
    discardGoogleProfileSync: fake.discardSync,
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  fake.stored.clear();
  fake.sync.mockReset().mockResolvedValue(undefined);
  fake.auth.onAuthStateChange.mockImplementation((fn) => {
    fake.listener = fn;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});
it("waits for automatic Google sync after exchanging the session and uses the Supabase ID", async () => {
  fake.auth.signInWithOAuth.mockResolvedValue({
    data: { url: "https://auth.example.test/authorize" },
    error: null,
  });
  await startOAuth("google");
  fake.auth.exchangeCodeForSession.mockResolvedValue({
    data: { session: { user: { id: "supabase-id" } } },
    error: null,
  });
  let finish!: () => void;
  fake.sync.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  let completed = false;
  const callback = completeAuthCallback(
    "stravakinda://auth/callback?code=google-auto-wait",
  ).then(() => {
    completed = true;
  });
  await vi.waitFor(() => expect(fake.sync).toHaveBeenCalledWith("supabase-id"));
  expect(completed).toBe(false);
  finish();
  await callback;
  expect(completed).toBe(true);
});
it.each(["facebook", undefined])(
  "does not Google-sync a %s callback even with a linked Google identity",
  async (provider) => {
    if (provider)
      fake.stored.set(
        "stravakinda.oauth-attempt",
        JSON.stringify({ provider, at: Date.now() }),
      );
    fake.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "linked-user", identities: [{ provider: "google" }] },
        },
      },
      error: null,
    });
    await completeAuthCallback(
      `stravakinda://auth/callback?code=non-google-${provider}`,
    );
    expect(fake.sync).not.toHaveBeenCalled();
    expect(fake.discardSync).toHaveBeenCalledWith("linked-user");
  },
);
it("reports synchronization failures separately from authentication failures", async () => {
  fake.stored.set(
    "stravakinda.oauth-attempt",
    JSON.stringify({ provider: "google", at: Date.now() }),
  );
  fake.auth.exchangeCodeForSession.mockResolvedValue({
    data: { session: { user: { id: "google-user" } } },
    error: null,
  });
  fake.sync.mockRejectedValue(new Error("RLS denied"));
  await expect(
    completeAuthCallback("stravakinda://auth/callback?code=google-sync-error"),
  ).rejects.toMatchObject({ name: "GoogleProfileSyncError" });
});
it("preserves unlinked local access but hides account-bound workouts from guests and other accounts", () => {
  expect(canAccessLocalWorkout({ ownerId: undefined })).toBe(true);
  expect(canAccessLocalWorkout({ ownerId: "a" }, "a")).toBe(true);
  expect(canAccessLocalWorkout({ ownerId: "a" }, "b")).toBe(false);
  expect(canAccessLocalWorkout({ ownerId: "a" })).toBe(false);
});
it("uses the actual native scheme and same-origin HTTPS web callback, rejecting insecure production URLs", () => {
  expect(callbackAddress("ios")).toBe("stravakinda://auth/callback");
  expect(callbackAddress("web", "https://fitness.example.test/somewhere")).toBe(
    "https://fitness.example.test/auth/callback",
  );
  expect(callbackAddress("web", "http://127.0.0.1:4173")).toContain(
    "/auth/callback",
  );
  expect(() => callbackAddress("web", "http://example.test")).toThrow("HTTPS");
});
it("validates signup passwords while allowing existing shorter login passwords", () => {
  expect(credentialsError("bad", "long-password", true)).toContain("email");
  expect(credentialsError("a@example.test", "short", true)).toContain("10");
  expect(credentialsError("a@example.test", "older", false)).toBeNull();
});
it("rejects cancellation, missing codes and token fragments instead of accepting URL session tokens", () => {
  expect(() =>
    callbackParameters("stravakinda://auth/callback?error=access_denied"),
  ).toThrow("cancelled");
  expect(() => callbackParameters("stravakinda://auth/callback")).toThrow(
    "missing",
  );
  expect(() =>
    callbackParameters("stravakinda://auth/callback#access_token=fake"),
  ).toThrow("unsupported");
});
it("registers via Supabase and never creates a client welcome or links local data", async () => {
  fake.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  expect(
    await emailAuthentication(" a@example.test ", "safe-password", true),
  ).toBe(false);
  expect(fake.auth.signUp).toHaveBeenCalledWith({
    email: "a@example.test",
    password: "safe-password",
    options: { emailRedirectTo: "stravakinda://auth/callback" },
  });
});
it("preserves password login and surfaces real provider failures", async () => {
  fake.auth.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: "a" } } },
    error: null,
  });
  expect(await emailAuthentication("a@example.test", "older", false)).toBe(
    true,
  );
  fake.auth.signInWithOAuth.mockResolvedValue({
    data: {},
    error: new Error("Provider unavailable"),
  });
  await expect(startOAuth("google")).rejects.toThrow("Provider unavailable");
});
it.each(["google", "facebook"] as const)(
  "starts real %s PKCE OAuth through the system browser",
  async (provider) => {
    fake.auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://auth.example.test/authorize" },
      error: null,
    });
    await startOAuth(provider);
    expect(fake.open).toHaveBeenCalledWith(
      "https://auth.example.test/authorize",
    );
    expect(fake.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider,
      options: {
        redirectTo: "stravakinda://auth/callback",
        skipBrowserRedirect: true,
      },
    });
  },
);
it("coalesces repeated callbacks and detects recovery from the SDK auth event", async () => {
  fake.auth.exchangeCodeForSession.mockImplementation(async () => {
    fake.listener?.("PASSWORD_RECOVERY");
    return { data: { session: { user: { id: "a" } } }, error: null };
  });
  const url = "stravakinda://auth/callback?code=unit-recovery-unique";
  const [a, b] = await Promise.all([
    completeAuthCallback(url),
    completeAuthCallback(url),
  ]);
  expect(a.recovery).toBe(true);
  expect(b).toEqual(a);
  expect(fake.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
});
it("reports expired callbacks without synthesizing a session", async () => {
  fake.auth.exchangeCodeForSession.mockResolvedValue({
    data: { session: null },
    error: new Error("expired"),
  });
  await expect(
    completeAuthCallback(
      "stravakinda://auth/callback?code=expired-unit-unique",
    ),
  ).rejects.toThrow("expired");
});
it("rejects a browser callback after explicit cancellation before exchanging a code", async () => {
  await cancelOAuth();
  await expect(
    completeAuthCallback("stravakinda://auth/callback?code=cancelled-unit"),
  ).rejects.toThrow("cancelled");
  expect(fake.auth.exchangeCodeForSession).not.toHaveBeenCalled();
});
it("uses the same native redirect for recovery and signs out through existing auth", async () => {
  fake.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  await requestPasswordReset("a@example.test");
  expect(fake.auth.resetPasswordForEmail).toHaveBeenCalledWith(
    "a@example.test",
    { redirectTo: "stravakinda://auth/callback" },
  );
  fake.auth.signOut.mockResolvedValue({ error: null });
  await signOutAccount();
  expect(fake.auth.signOut).toHaveBeenCalledTimes(1);
});

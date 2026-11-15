import { beforeEach, expect, it, vi } from "vitest";
import { storage } from "../services/supabase";
const fixture = vi.hoisted(() => ({
  os: "ios",
  secure: new Map<string, string>(),
  web: new Map<string, string>(),
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return fixture.os;
    },
  },
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (k: string) => fixture.secure.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    fixture.secure.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    fixture.secure.delete(k);
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: {} }),
}));
vi.mock("react-native-url-polyfill/auto", () => ({}));
beforeEach(() => {
  fixture.os = "ios";
  fixture.secure.clear();
  fixture.web.clear();
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

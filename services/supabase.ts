import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

function secureStoreAddress(key: string) {
  if (key && !/[^A-Za-z0-9._-]/.test(key)) return { key };

  // Encode each code unit so punctuation, Unicode and empty keys stay distinct.
  // Use a separate service so even an existing literal encoded key keeps its value.
  let encoded = "stravakinda.encoded.";
  for (let i = 0; i < key.length; i++)
    encoded += key.charCodeAt(i).toString(16).padStart(4, "0");
  return {
    key: encoded,
    options: { keychainService: "stravakinda-encoded-storage-v1" },
  };
}

// Split long sessions to avoid platform SecureStore value limits. Tokens never enter SQLite.
export const storage = {
  async getItem(key: string) {
    if (Platform.OS === "web")
      return typeof window === "undefined"
        ? null
        : window.localStorage.getItem(key);
    const address = secureStoreAddress(key);
    const count = Number(
      (await SecureStore.getItemAsync(
        `${address.key}.count`,
        address.options,
      )) ?? 0,
    );
    if (!count) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${address.key}.${i}`, address.options),
      ),
    );
    return chunks.every((c) => c !== null) ? chunks.join("") : null;
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      window.localStorage.setItem(key, value);
      return;
    }
    const address = secureStoreAddress(key);
    await storage.removeItem(key);
    const chunks = value.match(/[\s\S]{1,1500}/g) ?? [];
    for (let i = 0; i < chunks.length; i++)
      await SecureStore.setItemAsync(
        `${address.key}.${i}`,
        chunks[i],
        address.options,
      );
    await SecureStore.setItemAsync(
      `${address.key}.count`,
      String(chunks.length),
      address.options,
    );
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      window.localStorage.removeItem(key);
      return;
    }
    const address = secureStoreAddress(key);
    const count = Number(
      (await SecureStore.getItemAsync(
        `${address.key}.count`,
        address.options,
      )) ?? 0,
    );
    await SecureStore.deleteItemAsync(`${address.key}.count`, address.options);
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(`${address.key}.${i}`, address.options),
      ),
    );
  },
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;
if (supabase)
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
export function backend() {
  if (!supabase)
    throw new Error(
      "Connect Supabase using .env to use your account and community features. Local recording works without it.",
    );
  return supabase;
}

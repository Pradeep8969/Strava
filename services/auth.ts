import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { backend, storage } from "./supabase";
import { unregisterPushBeforeSignOut } from "./push";
import {
  scheduleGoogleProfileSync,
  discardGoogleProfileSync,
  GoogleProfileSyncError,
} from "./google-profile-sync";
import {
  callbackAddress,
  callbackParameters,
  credentialsError,
} from "../features/auth/validation";
export async function signOutAccount() {
  await unregisterPushBeforeSignOut().catch(() => undefined);
  return backend().auth.signOut();
}

export const authRedirect = () =>
  callbackAddress(
    Platform.OS,
    Platform.OS === "web" ? window.location.origin : undefined,
  );
const attemptKey = "stravakinda.oauth-attempt";
export async function cancelOAuth() {
  await storage.setItem(
    attemptKey,
    JSON.stringify({ cancelled: true, at: Date.now() }),
  );
}
export async function emailAuthentication(
  email: string,
  password: string,
  signup: boolean,
) {
  const message = credentialsError(email, password, signup);
  if (message) throw new Error(message);
  const input = { email: email.trim(), password };
  await storage.removeItem(attemptKey);
  const result = signup
    ? await backend().auth.signUp({
        ...input,
        options: { emailRedirectTo: authRedirect() },
      })
    : await backend().auth.signInWithPassword(input);
  if (result.error) throw result.error;
  if (result.data.session)
    await discardGoogleProfileSync(result.data.session.user.id);
  return !!result.data.session;
}
export async function requestPasswordReset(email: string) {
  if (credentialsError(email, "placeholder", false))
    throw new Error("Enter your email address first.");
  await storage.removeItem(attemptKey);
  const result = await backend().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: authRedirect(),
  });
  if (result.error) throw result.error;
}
export async function resendConfirmation(email: string) {
  if (credentialsError(email, "placeholder", false))
    throw new Error("Enter your email address first.");
  await storage.removeItem(attemptKey);
  const result = await backend().auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: authRedirect() },
  });
  if (result.error) throw result.error;
}
export async function startOAuth(provider: "google" | "facebook") {
  await storage.setItem(
    attemptKey,
    JSON.stringify({ cancelled: false, at: Date.now(), provider }),
  );
  const { data, error } = await backend().auth.signInWithOAuth({
    provider,
    options: { redirectTo: authRedirect(), skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error("The provider did not return a sign-in link.");
  const url = new URL(data.url);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("The provider returned an insecure sign-in link.");
  if (Platform.OS === "web") window.location.assign(data.url);
  else await Linking.openURL(data.url);
}
const exchanges = new Map<string, Promise<{ recovery: boolean }>>();
export function completeAuthCallback(url: string) {
  let code: string;
  try {
    code = callbackParameters(url);
  } catch (error) {
    return Promise.reject(error);
  }
  if (exchanges.has(code)) return exchanges.get(code)!;
  const task = (async () => {
    const stored = await storage.getItem(attemptKey);
    let provider: string | undefined;
    if (stored) {
      const attempt = JSON.parse(stored);
      provider = attempt.provider;
      if (attempt.cancelled)
        throw new Error(
          "This browser sign-in was cancelled. Start a new sign-in.",
        );
      if (Date.now() - attempt.at > 15 * 60000)
        throw new Error("This browser sign-in expired. Start a new sign-in.");
    }
    const client = backend();
    let recovery = false;
    const listener = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") recovery = true;
    });
    let result: Awaited<ReturnType<typeof client.auth.exchangeCodeForSession>>;
    try {
      result = await client.auth.exchangeCodeForSession(code);
    } finally {
      listener.data.subscription.unsubscribe();
    }
    const { data, error } = result;
    if (error)
      throw new Error(
        "This sign-in link has expired or was already used. Request a new link on this device.",
      );
    if (!data.session)
      throw new Error(
        "No authenticated session was returned. Try signing in again.",
      );
    if (provider === "google" && !recovery) {
      try {
        await scheduleGoogleProfileSync(data.session.user.id);
      } catch {
        throw new GoogleProfileSyncError(data.session.user.id);
      }
    } else await discardGoogleProfileSync(data.session.user.id);
    await storage.removeItem(attemptKey);
    return { recovery };
  })().finally(() => exchanges.delete(code));
  if (exchanges.size >= 20) exchanges.delete(exchanges.keys().next().value!);
  exchanges.set(code, task);
  return task;
}

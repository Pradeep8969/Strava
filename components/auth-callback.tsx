import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Screen, Heading, Copy, Field, Button } from "./ui";
import { completeAuthCallback } from "../services/auth";
import { backend } from "../services/supabase";
import { useQueryClient } from "@tanstack/react-query";
import {
  GoogleProfileSyncError,
  scheduleGoogleProfileSync,
} from "../services/google-profile-sync";
export default function AuthCallback() {
  const queryClient = useQueryClient();
  const [syncUserId, setSyncUserId] = useState<string | null>(null);
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const [state, setState] = useState<
      "loading" | "ready" | "recovery" | "error" | "sync-error"
    >("loading"),
    [message, setMessage] = useState("Confirming your secure link…"),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  const code = typeof params.code === "string" ? params.code : "",
    error = typeof params.error === "string" ? params.error : "";
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    if (code) query.set("code", code);
    if (error) query.set("error", error);
    completeAuthCallback(`stravakinda://auth/callback?${query}`)
      .then(async (result) => {
        await queryClient.invalidateQueries({ queryKey: ["athlete-profile"] });
        await queryClient.invalidateQueries({ queryKey: ["athlete-avatar"] });
        if (active) {
          setState(result.recovery ? "recovery" : "ready");
          setMessage(
            result.recovery
              ? "Choose a new password for your account."
              : "Your account is confirmed. Welcome to your next adventure.",
          );
        }
      })
      .catch((e) => {
        if (active) {
          setState(
            e instanceof GoogleProfileSyncError ? "sync-error" : "error",
          );
          if (e instanceof GoogleProfileSyncError) setSyncUserId(e.userId);
          setMessage(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [code, error, queryClient]);
  return (
    <Screen>
      <Heading>
        {state === "recovery" ? "Reset your password." : "Account confirmation"}
      </Heading>
      <Copy>{message}</Copy>
      {state === "loading" ? (
        <Copy>Signing in and synchronizing your account profile…</Copy>
      ) : null}
      {state === "sync-error" ? (
        <Button
          title="Retry profile synchronization"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              const { data, error } = await backend().auth.getUser();
              if (error) throw error;
              if (!data.user || data.user.id !== syncUserId)
                throw new Error("Your account changed. Please sign in again.");
              await scheduleGoogleProfileSync(data.user.id);
              await queryClient.invalidateQueries({
                queryKey: ["athlete-profile"],
              });
              await queryClient.invalidateQueries({
                queryKey: ["athlete-avatar"],
              });
              setState("ready");
              setMessage("Your Google profile is synchronized.");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
      {state === "recovery" ? (
        <>
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            maxLength={256}
          />
          <Button
            title="Set password"
            disabled={busy}
            onPress={async () => {
              if (password.length < 10) {
                setMessage("Use at least 10 characters.");
                return;
              }
              setBusy(true);
              try {
                const result = await backend().auth.updateUser({ password });
                if (result.error) throw result.error;
                setPassword("");
                setState("ready");
                setMessage(
                  "Password updated. You can continue to your profile.",
                );
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      ) : null}
      {state === "ready" ? (
        <Button
          title="Continue to Profile"
          onPress={() => router.replace("/profile")}
        />
      ) : null}
      {state === "error" ? (
        <Button
          title="Return to sign in"
          onPress={() => router.replace("/auth")}
        />
      ) : null}
    </Screen>
  );
}

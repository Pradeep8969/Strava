import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Field, useColors } from "./ui";
import { AthleteText as Text, IconButton } from "./athlete";
import { discoveryPhotos } from "./discovery-ui";
import { CommunityAction } from "./community-ui";
import { DashboardTabs } from "./dashboard-ui";
import {
  emailAuthentication,
  requestPasswordReset,
  resendConfirmation,
  startOAuth,
  cancelOAuth,
} from "../services/auth";
import { supabase } from "../services/supabase";
import { useSession } from "../hooks/useSession";
export default function AuthScreen() {
  const c = useColors(),
    wide = useWindowDimensions().width >= 900,
    session = useSession();
  const [mode, setMode] = useState("Sign in"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [verify, setVerify] = useState(false),
    [oauth, setOAuth] = useState(false);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Account service is unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const signup = mode === "Create account";
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 19, fontWeight: "800", color: c.text }}>
          StravaKinda<Text style={{ color: c.accent }}>.</Text>
        </Text>
        <IconButton
          icon="close-outline"
          label="Close account screen"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
      </View>
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: wide ? 46 : 24,
          alignItems: "stretch",
        }}
      >
        <View
          style={{
            width: wide ? "47%" : "100%",
            height: wide ? 700 : 175,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: c.navy,
          }}
        >
          <Image
            source={discoveryPhotos.mountains}
            resizeMode="cover"
            accessibilityLabel="Himalayan trails · Nepal-inspired editorial artwork"
            style={{ width: "100%", height: "100%" }}
          />
          <View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(8,27,40,.4)",
              padding: wide ? 34 : 18,
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <Text
              style={{
                color: "#BCEBD9",
                fontSize: 10,
                letterSpacing: 2,
                fontWeight: "700",
              }}
            >
              MADE FOR NEPAL. MADE FOR YOU.
            </Text>
            <Text
              style={{
                color: "#fff",
                fontSize: wide ? 46 : 28,
                fontWeight: "800",
                lineHeight: wide ? 52 : 30,
                letterSpacing: -1,
              }}
            >
              A higher{wide ? "\n" : " "}kind of everyday.
            </Text>
            <Text
              style={{
                color: "#fff",
                fontSize: 13,
                lineHeight: 21,
                maxWidth: 330,
              }}
            >
              Track your journey. Discover Nepal. Find your people.
            </Text>
            {wide ? (
              <View style={{ flexDirection: "row", gap: 18, paddingTop: 8 }}>
                {(
                  [
                    "walk-outline",
                    "bicycle-outline",
                    "trail-sign-outline",
                  ] as const
                ).map((icon) => (
                  <Ionicons key={icon} name={icon} size={22} color="#fff" />
                ))}
              </View>
            ) : null}
          </View>
        </View>
        <View
          style={{
            flex: wide ? 1 : undefined,
            minWidth: 0,
            justifyContent: "center",
            gap: 14,
            paddingVertical: wide ? 20 : 0,
          }}
        >
          <View style={{ gap: 7 }}>
            <Text
              style={{
                color: c.forest,
                fontSize: 10,
                letterSpacing: 2,
                fontWeight: "700",
              }}
            >
              YOUR NEXT CHAPTER
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 32,
                fontWeight: "800",
                color: c.text,
                letterSpacing: -0.8,
              }}
            >
              {session
                ? "You’re connected."
                : signup
                  ? "Adventure starts here."
                  : "Welcome back."}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>
              {session
                ? "Your local activities and plans stay separate."
                : "Move first. Connect when you’re ready."}
            </Text>
          </View>
          {session ? (
            <>
              <Text style={{ color: c.text, fontSize: 13 }}>
                {session.user.email}
              </Text>
              <CommunityAction
                title="Continue to Profile"
                onPress={() => router.replace("/profile")}
              />
              <CommunityAction
                title="Open notifications"
                secondary
                onPress={() => router.push("/notifications")}
              />
            </>
          ) : (
            <>
              <DashboardTabs
                items={["Sign in", "Create account"]}
                value={mode}
                label="Account mode"
                onChange={(value) => {
                  if (busy) return;
                  setMode(value);
                  setError("");
                  setMessage("");
                  setVerify(false);
                  setPassword("");
                }}
              />
              <View style={{ gap: 10 }}>
                {(["google", "facebook"] as const).map((provider) => (
                  <Pressable
                    key={provider}
                    accessibilityRole="button"
                    accessibilityLabel={`Continue with ${provider === "google" ? "Google" : "Facebook"}`}
                    disabled={busy || oauth}
                    accessibilityState={{ disabled: busy || oauth }}
                    onPress={() =>
                      void run(async () => {
                        await startOAuth(provider);
                        setOAuth(true);
                        setMessage(
                          "Finish sign-in in your browser. If you cancelled, you can try again.",
                        );
                      })
                    }
                    style={{
                      minHeight: 48,
                      borderWidth: 1,
                      borderColor: c.border,
                      backgroundColor:
                        provider === "facebook" ? "#1877F2" : c.panel,
                      borderRadius: 10,
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: busy || oauth ? 0.5 : 1,
                    }}
                  >
                    <Ionicons
                      name={
                        provider === "google" ? "logo-google" : "logo-facebook"
                      }
                      size={20}
                      color={provider === "google" ? c.text : "#fff"}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: provider === "google" ? c.text : "#fff",
                      }}
                    >
                      Continue with{" "}
                      {provider === "google" ? "Google" : "Facebook"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {oauth ? (
                <CommunityAction
                  secondary
                  title="Cancel browser sign-in"
                  onPress={() =>
                    void run(async () => {
                      await cancelOAuth();
                      setOAuth(false);
                      setMessage(
                        "Sign-in cancelled. No local data was linked or changed.",
                      );
                    })
                  }
                />
              ) : null}
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{ flex: 1, height: 1, backgroundColor: c.border }}
                />
                <Text style={{ color: c.muted, fontSize: 11 }}>
                  or continue with email
                </Text>
                <View
                  style={{ flex: 1, height: 1, backgroundColor: c.border }}
                />
              </View>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                maxLength={254}
                editable={!busy}
              />
              <View
                style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}
              >
                <View style={{ flex: 1 }}>
                  <Field
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!visible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete={signup ? "new-password" : "current-password"}
                    maxLength={256}
                    editable={!busy}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    visible ? "Hide password" : "Show password"
                  }
                  onPress={() => setVisible(!visible)}
                  style={{
                    minHeight: 44,
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "center",
                    width: 44,
                    justifyContent: "center",
                    paddingBottom: 3,
                  }}
                >
                  <Ionicons
                    name={visible ? "eye-off-outline" : "eye-outline"}
                    size={19}
                    color={c.muted}
                  />
                </Pressable>
              </View>
              {signup ? (
                <Text style={{ color: c.muted, fontSize: 11, lineHeight: 18 }}>
                  Use at least 10 characters. Email verification may be
                  required.
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await requestPasswordReset(email);
                      setMessage(
                        "If an account exists, a reset link is on its way. Open it on this device.",
                      );
                    })
                  }
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    alignSelf: "flex-end",
                  }}
                >
                  <Text
                    style={{ color: c.forest, fontSize: 12, fontWeight: "700" }}
                  >
                    Forgot password?
                  </Text>
                </Pressable>
              )}
              <CommunityAction
                title={signup ? "Create account" : "Sign in"}
                disabled={busy || oauth}
                onPress={() =>
                  void run(async () => {
                    const active = await emailAuthentication(
                      email,
                      password,
                      signup,
                    );
                    setPassword("");
                    setVerify(signup && !active);
                    setMessage(
                      active
                        ? "Signed in. Your local data has not been automatically linked."
                        : "Check your inbox to verify your email. Open the link on this device.",
                    );
                  })
                }
              />
              {verify ? (
                <CommunityAction
                  title="Resend verification email"
                  secondary
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await resendConfirmation(email);
                      setMessage(
                        "If eligible, a verification email is on its way. Check your inbox.",
                      );
                    })
                  }
                />
              ) : null}
            </>
          )}
          {busy ? (
            <View
              accessibilityLabel="Account request in progress"
              style={{ flexDirection: "row", gap: 9, alignItems: "center" }}
            >
              <ActivityIndicator color={c.forest} />
              <Text style={{ color: c.muted, fontSize: 12 }}>
                Connecting securely…
              </Text>
            </View>
          ) : null}
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: c.accent, fontSize: 13, lineHeight: 21 }}
            >
              {error}
            </Text>
          ) : null}
          {message ? (
            <Text
              accessibilityRole="alert"
              style={{ color: c.forest, fontSize: 13, lineHeight: 21 }}
            >
              {message}
            </Text>
          ) : null}
          {!supabase ? (
            <Text style={{ color: c.muted, fontSize: 11, lineHeight: 18 }}>
              Account services need Supabase configuration. Local recording and
              drafts remain available.
            </Text>
          ) : null}
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 18 }}>
            Private routes stay private. Signing in does not publish workouts or
            organizer drafts.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

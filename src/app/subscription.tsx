import { useState } from "react";
import {
  Image,
  Linking,
  Platform,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { PurchasesPackage } from "react-native-purchases";
import { AthletePage, AthleteText as Text } from "../../components/athlete";
import { TrainingPanel } from "../../components/athlete-training";
import { discoveryPhotos, DiscoveryTitle } from "../../components/discovery-ui";
import { CommunityAction } from "../../components/community-ui";
import {
  DashboardHeader,
  DashboardNotice,
} from "../../components/dashboard-ui";
import { useColors } from "../../components/ui";
import { useSession } from "../../hooks/useSession";
import { useAction } from "../../hooks/useAction";
import {
  buy,
  packages,
  premiumStatus,
  restore,
} from "../../services/purchases";

export default function Subscription() {
  const session = useSession();
  return (
    <SubscriptionContent
      key={session?.user.id ?? "guest"}
      userId={session?.user.id}
    />
  );
}
function SubscriptionContent({ userId }: { userId?: string }) {
  const c = useColors(),
    a = useAction(),
    tablet = useWindowDimensions().width >= 700;
  const [items, setItems] = useState<PurchasesPackage[]>([]);
  const [access, setAccess] = useState<"unchecked" | "active" | "inactive">(
    "unchecked",
  );
  const native = Platform.OS === "ios" || Platform.OS === "android";
  const canUseStore = native && !!userId;
  const user = () => {
    if (!userId) throw new Error("Sign in before purchasing or restoring.");
    return userId;
  };
  return (
    <AthletePage>
      <DashboardHeader
        title="StravaKinda Plus"
        subtitle="A little more perspective."
      />
      <View
        style={{
          backgroundColor: "#142431",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <View style={{ height: tablet ? 195 : 165 }}>
          <Image
            source={discoveryPhotos.mountains}
            accessibilityLabel="Nepal-inspired StravaKinda Plus editorial cover"
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
          />
          <View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(10,30,40,.3)",
              padding: 18,
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{ flexDirection: "row", gap: 7, alignItems: "center" }}
            >
              <Ionicons name="diamond-outline" size={17} color="#FFD8B2" />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 1.7,
                }}
              >
                STRAVAKINDA PLUS · IN DEVELOPMENT
              </Text>
            </View>
          </View>
        </View>
        <View style={{ padding: 22, gap: 12 }}>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 29,
              fontWeight: "700",
              letterSpacing: -0.8,
            }}
          >
            More perspective.{"\n"}Same love of moving.
          </Text>
          <Text style={{ color: "#C5D8DE", fontSize: 12, lineHeight: 20 }}>
            Build a deeper understanding of your training, one honest insight at
            a time.
          </Text>
        </View>
      </View>
      <Text style={{ color: c.muted, fontSize: 12 }}>
        Free recording and your basic history remain free.
      </Text>
      <View style={{ flexDirection: tablet ? "row" : "column", gap: 20 }}>
        <View style={{ flex: tablet ? 1 : undefined, minWidth: 0 }}>
          <TrainingPanel>
            <DiscoveryTitle
              title="Your foundation"
              detail="AVAILABLE NOW · FREE"
            />
            {[
              "GPS recording & offline history",
              "Workout statistics & personal bests",
              "Local training charts & weekly goals",
            ].map((title) => (
              <View
                key={title}
                style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={c.forest}
                />
                <Text style={{ color: c.text, fontSize: 12, flex: 1 }}>
                  {title}
                </Text>
              </View>
            ))}
            <CommunityAction
              secondary
              title="View your training insights"
              onPress={() => router.push("/analytics")}
            />
          </TrainingPanel>
        </View>
        <View style={{ flex: tablet ? 1 : undefined, minWidth: 0 }}>
          <TrainingPanel>
            <DiscoveryTitle
              title="Plus roadmap"
              detail="PLANNED · NOT INCLUDED AS WORKING TOOLS"
            />
            {[
              ["Personal heatmaps", "Privacy-safe route analysis"],
              [
                "Advanced training insights",
                "Validated sensor metrics and comparisons",
              ],
              [
                "Structured training plans",
                "Workout planning and progress guidance",
              ],
            ].map(([title, detail]) => (
              <View
                key={title}
                style={{
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={c.muted}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{ color: c.text, fontSize: 12, fontWeight: "600" }}
                  >
                    {title}
                  </Text>
                  <Text
                    style={{ color: c.muted, fontSize: 11, lineHeight: 17 }}
                  >
                    {detail}
                  </Text>
                </View>
              </View>
            ))}
          </TrainingPanel>
        </View>
      </View>
      <TrainingPanel>
        <DiscoveryTitle title="AI coaching" detail="SERVICE SETUP REQUIRED" />
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>
          A coaching interface exists, but it requires a configured server,
          verified premium access and your consent to share workout summaries.
          No advice or fitness scores are generated here.
        </Text>
        <CommunityAction
          secondary
          title="Review coaching & privacy"
          onPress={() => router.push("/coach")}
        />
      </TrainingPanel>
      <TrainingPanel>
        <DiscoveryTitle
          title="Your subscription"
          detail={
            access === "active"
              ? "Active premium entitlement returned by the store"
              : access === "inactive"
                ? "No active premium entitlement returned"
                : "Premium access not checked"
          }
        />
        {!native ? (
          <DashboardNotice
            title="Store plans are available in the mobile app"
            detail="Use the iOS or Android app to load real pricing, purchase or restore. No checkout is enabled in this web preview."
          />
        ) : (
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>
            Plans and prices come directly from your app store. Advanced Plus
            tools are still in development; review the roadmap before
            purchasing.
          </Text>
        )}
        {!userId ? (
          <CommunityAction
            title="Sign in to manage subscriptions"
            onPress={() => router.push("/auth")}
          />
        ) : null}
        <CommunityAction
          title="Load store plans"
          disabled={!canUseStore || a.busy}
          onPress={() =>
            void a.run(async () => {
              const result = await packages(user());
              setItems(result);
              if (!result.length)
                throw new Error("No store plans are available yet.");
            })
          }
        />
        {items.map((item) => (
          <View
            key={item.identifier}
            style={{
              padding: 15,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              gap: 12,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ flex: 1, gap: 5 }}>
                <Text
                  style={{ color: c.text, fontWeight: "700", fontSize: 16 }}
                >
                  {item.product.title}
                </Text>
                <Text style={{ color: c.muted, fontSize: 11 }}>
                  Store-supplied plan and billing terms
                </Text>
              </View>
              <Text
                style={{ color: c.accent, fontWeight: "700", fontSize: 19 }}
              >
                {item.product.priceString}
              </Text>
            </View>
            <CommunityAction
              title={`Purchase ${item.product.title}`}
              disabled={!canUseStore || a.busy}
              onPress={() =>
                void a.run(async () => {
                  if (!(await buy(user(), item)))
                    throw new Error(
                      "Purchase returned no active premium entitlement. Contact support.",
                    );
                  setAccess("active");
                }, "Store purchase returned an active premium entitlement.")
              }
            />
          </View>
        ))}
        <View style={{ flexDirection: tablet ? "row" : "column", gap: 10 }}>
          <View style={{ flex: tablet ? 1 : undefined }}>
            <CommunityAction
              secondary
              title="Restore purchases"
              disabled={!canUseStore || a.busy}
              onPress={() =>
                void a.run(async () => {
                  const active = await restore(user());
                  setAccess(active ? "active" : "inactive");
                  if (!active)
                    throw new Error(
                      "No active premium entitlement found for this store account.",
                    );
                }, "Premium restored.")
              }
            />
          </View>
          <View style={{ flex: tablet ? 1 : undefined }}>
            <CommunityAction
              secondary
              title="Check premium access"
              disabled={!canUseStore || a.busy}
              onPress={() =>
                void a.run(async () =>
                  setAccess(
                    (await premiumStatus(user())) ? "active" : "inactive",
                  ),
                )
              }
            />
          </View>
        </View>
        {a.message ? (
          <Text
            accessibilityRole="alert"
            style={{ color: c.accent, fontSize: 12, lineHeight: 20 }}
          >
            {a.message}
          </Text>
        ) : null}
        <Text style={{ color: c.muted, fontSize: 10, lineHeight: 17 }}>
          Subscriptions renew under the store’s terms. Prices, periods and
          cancellation terms must be reviewed in the store. An entitlement does
          not make planned features available.
        </Text>
        {native ? (
          <CommunityAction
            secondary
            title="Manage or cancel in store"
            onPress={() =>
              void a.run(() =>
                Linking.openURL(
                  Platform.OS === "ios"
                    ? "https://apps.apple.com/account/subscriptions"
                    : "https://play.google.com/store/account/subscriptions",
                ),
              )
            }
          />
        ) : (
          <View style={{ flexDirection: tablet ? "row" : "column", gap: 10 }}>
            <View style={{ flex: tablet ? 1 : undefined }}>
              <CommunityAction
                secondary
                title="Apple subscription settings"
                onPress={() =>
                  void a.run(() =>
                    Linking.openURL(
                      "https://apps.apple.com/account/subscriptions",
                    ),
                  )
                }
              />
            </View>
            <View style={{ flex: tablet ? 1 : undefined }}>
              <CommunityAction
                secondary
                title="Google Play subscription settings"
                onPress={() =>
                  void a.run(() =>
                    Linking.openURL(
                      "https://play.google.com/store/account/subscriptions",
                    ),
                  )
                }
              />
            </View>
          </View>
        )}
      </TrainingPanel>
      <TrainingPanel>
        <DiscoveryTitle
          title="Bring your next event to life."
          detail="Organizer studio · preview only"
        />
        <CommunityAction
          secondary
          title="Open organizer preview"
          onPress={() => router.push("/organizer")}
        />
      </TrainingPanel>
    </AthletePage>
  );
}

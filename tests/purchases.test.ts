import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  platform: { OS: "ios" },
  sdk: {
    configure: vi.fn(),
    logIn: vi.fn(),
    getOfferings: vi.fn(),
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
    getCustomerInfo: vi.fn(),
    logOut: vi.fn(),
  },
}));
vi.mock("react-native", () => ({ Platform: state.platform }));
vi.mock("react-native-purchases", () => ({ default: state.sdk }));
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.platform.OS = "ios";
  vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_KEY", "test-sdk-key");
});
it("retains store-supplied packages and checks purchase entitlement rather than assuming success", async () => {
  const item = {
    identifier: "test-package",
    product: { title: "Test plan", priceString: "Test store price" },
  };
  state.sdk.getOfferings.mockResolvedValue({
    current: { availablePackages: [item] },
  });
  state.sdk.purchasePackage.mockResolvedValue({
    customerInfo: { entitlements: { active: {} } },
  });
  const purchases = await import("../services/purchases");
  expect(await purchases.packages("test-owner")).toEqual([item]);
  expect(state.sdk.configure).toHaveBeenCalledWith({
    apiKey: "test-sdk-key",
    appUserID: "test-owner",
  });
  expect(await purchases.buy("test-owner", item as never)).toBe(false);
});
it("retains verified restoration and rejects expired status", async () => {
  state.sdk.restorePurchases.mockResolvedValue({
    entitlements: {
      active: { premium: { isActive: true, expirationDate: null } },
    },
  });
  state.sdk.getCustomerInfo.mockResolvedValue({
    entitlements: {
      active: { premium: { isActive: true, expirationDate: "2020-01-01" } },
    },
  });
  const purchases = await import("../services/purchases");
  expect(await purchases.restore("test-owner")).toBe(true);
  expect(await purchases.premiumStatus("test-owner")).toBe(false);
});
it("never enables the native store client in a web preview", async () => {
  state.platform.OS = "web";
  const purchases = await import("../services/purchases");
  await expect(purchases.packages("test-owner")).rejects.toThrow(
    "Store products are not configured",
  );
  expect(state.sdk.configure).not.toHaveBeenCalled();
});

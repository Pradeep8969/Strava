import type { RouteGuideReference } from "../../types/activity";

export const guideSports = [
  { value: "walking", label: "Walking" },
  { value: "running", label: "Running" },
  { value: "cycling", label: "Cycling" },
] as const;
type GuideSport = (typeof guideSports)[number]["value"];

export function parseRouteGuide(
  value?: string | string[],
): RouteGuideReference | undefined {
  if (typeof value !== "string") return;
  const match = /^(local|account):([^\u0000-\u001f\u007f]{1,512})$/.exec(value);
  if (match)
    return {
      scope: match[1] === "account" ? "account" : "local",
      id: match[2],
    };
}

export function findRouteGuide<
  T extends { id: string; accountId?: string; deleted?: boolean },
>(
  routes: readonly T[],
  reference: RouteGuideReference | undefined,
  accountId?: string,
) {
  if (!reference) return;
  return routes.find(
    (route) =>
      !route.deleted &&
      route.id === reference.id &&
      (reference.scope === "local"
        ? !route.accountId
        : !!accountId && route.accountId === accountId),
  );
}

export function recorderGuideLocation(
  route: { id: string; accountId?: string },
  sport: GuideSport,
) {
  return {
    pathname: "/(tabs)/record" as const,
    params: {
      guide: routeGuideParam(route),
      sport,
    },
  };
}

export function routeGuideParam(route: { id: string; accountId?: string }) {
  return `${route.accountId ? "account" : "local"}:${route.id}`;
}

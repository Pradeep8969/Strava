import {
  createRouteRequestController,
  type RoutingErrorCode,
  type RoutingRequest,
  type RoutingState,
} from "./routing";

export const liveKathmanduTitle = "Live Kathmandu Routing (USB)";
const loopbackOrigin = "http://127.0.0.1:8002";

export function liveKathmanduEndpoint(
  development: boolean,
  platform: string,
  configuredOrigin: string | undefined,
) {
  return development &&
    platform === "android" &&
    configuredOrigin === loopbackOrigin
    ? loopbackOrigin
    : undefined;
}

export async function requestLiveKathmanduRoute(
  controller: ReturnType<typeof createRouteRequestController>,
  request: RoutingRequest,
  publish: (state: RoutingState) => void,
  options?: Parameters<typeof controller.request>[1],
) {
  const result = controller.request(request, options);
  const pending = controller.getState();
  publish(pending);
  await result;
  const latest = controller.getState();
  if (
    pending.status === "loading" &&
    latest.status !== "idle" &&
    latest.request === pending.request
  )
    publish(latest);
}

export function liveKathmanduError(code: RoutingErrorCode) {
  switch (code) {
    case "network":
    case "offline":
    case "unavailable":
      return "Could not reach the USB routing service. Check that the phone is connected, port 8002 is reversed, and the local API is running.";
    case "no-route":
      return "No route was found. Try placing the points closer to connected roads or paths.";
    case "invalid":
      return "The waypoints or routing response could not be used. Check the selected points or try again.";
    case "timeout":
      return "Routing timed out. Check the USB connection and local API, then try again.";
    case "cancelled":
      return "Route calculation cancelled.";
    default:
      return "The local routing service could not complete this request. Try again.";
  }
}

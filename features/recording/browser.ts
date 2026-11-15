import type { TrackPoint } from "../../types/activity";
import { validPoint } from "../../utils/tracking";
export function browserRecordingIssue() {
  if (typeof window === "undefined")
    return "Recording is available in a browser with location support.";
  if (!window.isSecureContext)
    return "Browser GPS requires HTTPS or localhost. Open the secure site to record.";
  if (!navigator.geolocation)
    return "This browser does not support location recording. Use a browser with Geolocation or the Android/iOS app.";
  if (typeof indexedDB === "undefined")
    return "Enable browser site storage before recording so your workout can be saved.";
  return null;
}
export function browserLocationError(
  error: Pick<GeolocationPositionError, "code">,
) {
  if (error.code === 1)
    return "Location permission was denied. Allow location for this site in your browser settings, then try again.";
  if (error.code === 3)
    return "GPS timed out. Move outdoors with a clear view of the sky, then try Start or Resume again.";
  return "Your location is unavailable. Check device location services and GPS reception, then try again.";
}
export function browserPoint(position: GeolocationPosition): TrackPoint {
  const coords = position.coords;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    timestamp: position.timestamp,
    accuracy: coords.accuracy,
    altitude:
      coords.altitude !== null && Number.isFinite(coords.altitude)
        ? coords.altitude
        : null,
    altitudeAccuracy:
      coords.altitudeAccuracy !== null &&
      Number.isFinite(coords.altitudeAccuracy) &&
      coords.altitudeAccuracy >= 0
        ? coords.altitudeAccuracy
        : null,
    segment: 0,
  };
}
export function freshBrowserPoint(point: TrackPoint, now = Date.now()) {
  return (
    validPoint(point) &&
    point.timestamp >= now - 15000 &&
    point.timestamp <= now + 1000
  );
}

import { mapConfiguration } from "../discovery/map-data";

export const mapTilerUserAgent = "StravaKinda-Android/com.stravakinda.app/1.0";
export const mapTilerRequestMatch = "^https://api\\.maptiler\\.com/";

export function androidMapConfiguration() {
  // A web key restricted by HTTP origin is not suitable for native HTTP requests.
  // No demo-tile fallback on a phone, and never silently use the browser key.
  return mapConfiguration(
    process.env.EXPO_PUBLIC_MAPTILER_ANDROID_KEY,
    false,
    "",
  );
}

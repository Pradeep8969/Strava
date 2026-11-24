import type { ExpoConfig } from "expo/config";
let imagePickerInstalled = false;
try {
  require.resolve("expo-image-picker/app.plugin.js");
  imagePickerInstalled = true;
} catch {
  /* Optional until dependency installation is available. */
}
const config: ExpoConfig = {
  name: "StravaKinda",
  slug: "stravakinda",
  version: "1.0.0",
  scheme: "stravakinda",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  web: { favicon: "./assets/favicon.png" },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.stravakinda.app",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "Take a photo for your StravaKinda profile.",
      NSPhotoLibraryUsageDescription:
        "Choose a picture for your StravaKinda profile.",
    },
  },
  android: {
    package: "com.stravakinda.app",
    permissions: [
      "android.permission.CAMERA",
      "android.permission.READ_MEDIA_IMAGES",
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundColor: "#101416",
    },
  },
  plugins: [
    ...(imagePickerInstalled
      ? [
          [
            "expo-image-picker",
            {
              photosPermission: "Choose a profile picture.",
              cameraPermission: "Take a profile picture.",
              microphonePermission: false,
            },
          ] as [string, Record<string, string | boolean>],
        ]
      : []),
    ...(process.env.EXPO_PUBLIC_PUSH_ENABLED === "true"
      ? ["expo-notifications"]
      : []),
    "expo-router",
    "expo-sqlite",
    "expo-secure-store",
    "expo-dev-client",
    "expo-font",
    [
      "@maplibre/maplibre-react-native",
      { android: { locationEngine: "default" } },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#101416",
        image: "./assets/splash-icon.png",
        imageWidth: 160,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "StravaKinda uses your location to measure workouts and save your route.",
        locationAlwaysAndWhenInUsePermission:
          "Allow background location to continue your workout while your screen is locked.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY
      ? ([
          [
            "react-native-maps",
            {
              androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY,
            },
          ],
        ] as [string, Record<string, string>][])
      : []),
  ],
  experiments: { typedRoutes: false },
  extra: {
    eas: {
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
        "e6ddc1e7-87f1-4b85-85c9-d7eea4fff615",
    },
  },
};
export default config;

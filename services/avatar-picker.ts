import { requireOptionalNativeModule } from "expo";
import type { ChosenPhoto } from "./avatar";
import {
  validateAvatar,
  MAX_AVATAR_BYTES,
} from "../features/athlete/edit-profile";
type PickerResult = {
  canceled: boolean;
  assets?: { base64?: string; uri: string }[];
};
type PickerModule = {
  getPendingResultAsync?(): Promise<PickerResult | null>;
  requestCameraPermissionsAsync(): Promise<{ granted: boolean }>;
  requestMediaLibraryPermissionsAsync(
    writeOnly: boolean,
  ): Promise<{ granted: boolean }>;
  launchCameraAsync(options: object): Promise<PickerResult>;
  launchImageLibraryAsync(options: object): Promise<PickerResult>;
};
function selectedPhoto(result: PickerResult | null): ChosenPhoto | null {
  if (!result || result.canceled) return null;
  const data = result.assets?.[0]?.base64;
  if (!data)
    throw new Error(
      "The selected photo could not be read. Please try a JPEG or PNG.",
    );
  if (data.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4)
    throw new Error("Choose a photo smaller than 5 MB.");
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const mime =
    bytes[0] === 137
      ? "image/png"
      : bytes[0] === 82
        ? "image/webp"
        : "image/jpeg";
  validateAvatar(bytes, mime);
  return { data, mime, uri: `data:${mime};base64,${data}` };
}
export async function recoverAvatarSelection(): Promise<ChosenPhoto | null> {
  const picker = requireOptionalNativeModule<PickerModule>(
    "ExponentImagePicker",
  );
  return selectedPhoto((await picker?.getPendingResultAsync?.()) ?? null);
}
// Optional binding keeps existing development builds usable until image-picker
// is installed/rebuilt. This is Expo ImagePicker's SDK 58 native module.
export async function chooseAvatar(
  camera: boolean,
): Promise<ChosenPhoto | null> {
  const picker = requireOptionalNativeModule<PickerModule>(
    "ExponentImagePicker",
  );
  if (!picker)
    throw new Error(
      "Photo selection needs expo-image-picker and a new development build. See docs/profile-upgrade.md.",
    );
  const permission = camera
    ? await picker.requestCameraPermissionsAsync()
    : await picker.requestMediaLibraryPermissionsAsync(false);
  if (!permission.granted)
    throw new Error(
      `Allow ${camera ? "camera" : "photo library"} access in device settings to continue.`,
    );
  const options = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
  };
  const result = camera
    ? await picker.launchCameraAsync(options)
    : await picker.launchImageLibraryAsync(options);
  return selectedPhoto(result);
}

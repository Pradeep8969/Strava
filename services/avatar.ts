import { randomUUID } from "expo-crypto";
import { backend } from "./supabase";
import {
  isCustomAvatar,
  validateAvatar,
} from "../features/athlete/edit-profile";
export type ChosenPhoto = { uri: string; data: string; mime: string };
export function photoBytes(photo: ChosenPhoto) {
  return Uint8Array.from(atob(photo.data), (c) => c.charCodeAt(0));
}
export async function uploadAvatar(userId: string, photo: ChosenPhoto) {
  const client = backend();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (data.user?.id !== userId)
    throw new Error("Your account changed. Reopen the editor.");
  const bytes = photoBytes(photo);
  validateAvatar(bytes, photo.mime);
  const extension =
    photo.mime === "image/png"
      ? "png"
      : photo.mime === "image/webp"
        ? "webp"
        : "jpg";
  const path = `${userId}/${randomUUID()}.${extension}`;
  const result = await client.storage
    .from("avatars")
    .upload(path, bytes.buffer, {
      contentType: photo.mime,
      upsert: false,
      cacheControl: "3600",
    });
  if (result.error) throw result.error;
  return path;
}
export async function removeOwnedAvatar(userId: string, path: string | null) {
  if (!isCustomAvatar(userId, path)) return;
  const result = await backend().storage.from("avatars").remove([path!]);
  if (result.error) throw result.error;
}

import { beforeEach, expect, it, vi } from "vitest";
import {
  validateDetails,
  validateAvatar,
  splitName,
  isCustomAvatar,
  type ProfileDraft,
} from "../features/athlete/edit-profile";
import { uploadAvatar, removeOwnedAvatar } from "../services/avatar";
import { saveProfileDetails } from "../services/profile-details";
import {
  chooseAvatar,
  recoverAvatarSelection,
} from "../services/avatar-picker";
const fake = vi.hoisted(() => ({
  getUser: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
  picker: vi.fn(),
}));
vi.mock("expo", () => ({ requireOptionalNativeModule: fake.picker }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "photo-id" }));
vi.mock("../services/supabase", () => ({
  backend: () => ({
    auth: { getUser: fake.getUser },
    rpc: fake.rpc,
    storage: { from: () => ({ upload: fake.upload, remove: fake.remove }) },
  }),
}));
const draft: ProfileDraft = {
  name: "Maya Sherpa",
  first_name: "Maya",
  last_name: "Sherpa",
  username: null,
  bio: "Mountains",
  is_private: true,
  avatar_path: null,
  city: "Kathmandu",
  province: "Bagmati",
  primary_sport: "running",
  birthdate: "1990-01-01",
  gender: null,
  weight_kg: 65.5,
};
beforeEach(() => {
  vi.resetAllMocks();
  fake.getUser.mockResolvedValue({
    data: { user: { id: "owner" } },
    error: null,
  });
  fake.upload.mockResolvedValue({ error: null });
  fake.remove.mockResolvedValue({ error: null });
  fake.rpc.mockResolvedValue({ error: null });
});
it("validates optional personal details, names, dates, sports and weight", () => {
  expect(splitName("  Maya   Sherpa ")).toEqual({
    first_name: "Maya",
    last_name: "Sherpa",
  });
  expect(() => validateDetails(draft)).not.toThrow();
  for (const patch of [
    { first_name: " " },
    { birthdate: "2025-02-30" },
    { birthdate: "2099-01-01" },
    { weight_kg: NaN },
    { weight_kg: 0 },
    { weight_kg: 501 },
    { city: "a".repeat(101) },
    { gender: "invalid" },
    { primary_sport: "invalid" },
  ])
    expect(() =>
      validateDetails({ ...draft, ...patch } as ProfileDraft),
    ).toThrow();
  expect(() =>
    validateDetails({ ...draft, birthdate: null, weight_kg: null }),
  ).not.toThrow();
});
it("validates photo bytes, MIME and size", () => {
  validateAvatar(
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    "image/png",
  );
  expect(() =>
    validateAvatar(new Uint8Array(6 * 1024 * 1024), "image/png"),
  ).toThrow("5 MB");
  expect(() =>
    validateAvatar(new Uint8Array([60, 115, 118, 103]), "image/png"),
  ).toThrow("valid JPEG");
  expect(() =>
    validateAvatar(new Uint8Array([255, 216, 255]), "image/svg+xml"),
  ).toThrow();
});
it("uploads immutable owner-prefixed bytes and removes only owned pictures", async () => {
  const path = await uploadAvatar("owner", {
    uri: "data:image/png;base64,iVBORw0KGgo=",
    data: "iVBORw0KGgo=",
    mime: "image/png",
  });
  expect(path).toBe("owner/photo-id.png");
  expect(fake.upload).toHaveBeenCalledWith(
    path,
    expect.any(ArrayBuffer),
    expect.objectContaining({ upsert: false, contentType: "image/png" }),
  );
  await removeOwnedAvatar("owner", "other/photo.png");
  await removeOwnedAvatar("owner", "https://google.test/avatar");
  expect(fake.remove).not.toHaveBeenCalled();
  await removeOwnedAvatar("owner", path);
  expect(fake.remove).toHaveBeenCalledWith([path]);
  expect(isCustomAvatar("owner", "owner/../other")).toBe(false);
});
it("rejects account switches and upload errors", async () => {
  fake.getUser.mockResolvedValueOnce({
    data: { user: { id: "other" } },
    error: null,
  });
  await expect(
    uploadAvatar("owner", { data: "iVBORw0KGgo=", uri: "", mime: "image/png" }),
  ).rejects.toThrow("account changed");
  fake.upload.mockResolvedValueOnce({ error: new Error("RLS denied") });
  await expect(
    uploadAvatar("owner", { data: "iVBORw0KGgo=", uri: "", mime: "image/png" }),
  ).rejects.toThrow("RLS denied");
});
it("saves public changes and owner-only personal details atomically with concurrency guards", async () => {
  await saveProfileDetails(
    "owner",
    draft,
    {
      ...draft,
      name: "Maya Rai",
      last_name: "Rai",
      avatar_path: "owner/photo-id.jpg",
    },
    3,
  );
  expect(fake.rpc).toHaveBeenCalledWith(
    "save_athlete_details",
    expect.objectContaining({
      patch: { name: "Maya Rai", avatar_path: "owner/photo-id.jpg" },
      details: expect.objectContaining({
        birthdate: "1990-01-01",
        weight_kg: 65.5,
      }),
      expected_revision: 3,
    }),
  );
  fake.rpc.mockResolvedValueOnce({ error: { message: "changed elsewhere" } });
  await expect(saveProfileDetails("owner", draft, draft, 3)).rejects.toThrow(
    "changed elsewhere",
  );
});
it("handles native picker cancellation, camera denial and missing native modules", async () => {
  fake.picker.mockReturnValue(null);
  await expect(chooseAvatar(true)).rejects.toThrow("development build");
  fake.picker.mockReturnValue({
    requestCameraPermissionsAsync: async () => ({ granted: false }),
  });
  await expect(chooseAvatar(true)).rejects.toThrow("Allow camera");
  fake.picker.mockReturnValue({
    requestMediaLibraryPermissionsAsync: async () => ({ granted: false }),
  });
  await expect(chooseAvatar(false)).rejects.toThrow("photo library");
  fake.picker.mockReturnValue({
    requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
    launchImageLibraryAsync: async () => ({ canceled: true }),
  });
  expect(await chooseAvatar(false)).toBeNull();
  fake.picker.mockReturnValue({
    getPendingResultAsync: async () => ({
      canceled: false,
      assets: [{ base64: "iVBORw0KGgo=", uri: "temporary" }],
    }),
  });
  expect(await recoverAvatarSelection()).toMatchObject({
    mime: "image/png",
    uri: "data:image/png;base64,iVBORw0KGgo=",
  });
});

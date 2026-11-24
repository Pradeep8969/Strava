import { useEffect, useRef, useState } from "react";
import { BirthdatePicker } from "./birthdate-picker";
import { Image, Modal, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Copy, Field, Row, useColors } from "./ui";
import { TrainingPanel } from "./athlete-training";
import { DiscoveryTitle } from "./discovery-ui";
import { DashboardTabs } from "./dashboard-ui";
import {
  chooseAvatar,
  recoverAvatarSelection,
} from "../services/avatar-picker";
import {
  uploadAvatar,
  removeOwnedAvatar,
  type ChosenPhoto,
} from "../services/avatar";
import { saveProfileDetails } from "../services/profile-details";
import { getValue, serial, setValue } from "../services/database";
import { useCurrentAthlete } from "../hooks/useCurrentAthlete";
import { useAction } from "../hooks/useAction";
import { providerProfile } from "../features/athlete/profile";
import type { ProfileDraft } from "../features/athlete/edit-profile";
import { profileDetailsQuery } from "../services/profile-details-query";
import {
  editorDraft,
  assessEditorDraft,
} from "../features/athlete/editor-state";
type DraftState = {
  original: ProfileDraft;
  draft: ProfileDraft;
  revision: number;
  photo: ChosenPhoto | null;
  weightText?: string;
};

export function ProfileEditor({
  onClose,
}: {
  onClose: (saved?: boolean) => void;
}) {
  const identity = useCurrentAthlete();
  const userId = identity.userId!;
  const c = useColors(),
    a = useAction(),
    cache = useQueryClient();
  const details = useQuery(profileDetailsQuery(userId));
  const [snapshot, setState] = useState<DraftState | null>(() =>
    identity.data && details.data !== undefined
      ? editorDraft(identity.data, details.data)
      : null,
  );
  const [restored, setRestored] = useState(false);
  const [recoveredPhoto, setRecoveredPhoto] = useState<ChosenPhoto | null>(
    null,
  );
  const photoRecoverySuperseded = useRef(false);
  const [restoreError, setRestoreError] = useState("");
  const [photoRestoreError, setPhotoRestoreError] = useState("");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(false),
    [confirm, setConfirm] = useState<"delete" | "cancel" | null>(null);
  const [failed, setFailed] = useState("");
  const [attempt, setAttempt] = useState(0);
  const key = `profile-editor-draft:${userId}`;
  useEffect(() => {
    let active = true;
    void serial(() => getValue<DraftState>(key))
      .then((saved) => {
        if (!active) return;
        if (saved) setState(saved);
        setRestored(true);
      })
      .catch((error) => {
        if (active)
          setRestoreError(
            `Could not load your local profile draft. ${String(error.message ?? error)}`,
          );
      });
    return () => {
      active = false;
    };
  }, [key, attempt]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void recoverAvatarSelection()
      .then((photo) => {
        if (active && !photoRecoverySuperseded.current)
          setRecoveredPhoto(photo);
      })
      .catch(() => {
        if (active)
          setPhotoRestoreError(
            "Could not recover the selected photo. Choose it again if you want to change your picture.",
          );
      });
    return () => {
      active = false;
    };
  }, [userId]);
  if (!snapshot && identity.data && details.data !== undefined) {
    setState(editorDraft(identity.data, details.data));
  }
  const ready = !!identity.userId && !!snapshot && restored;
  const loadError =
    restoreError ||
    (!snapshot && details.isError && !details.isFetching
      ? details.error.message
      : !snapshot && identity.profile?.isError && !identity.profile.isFetching
        ? identity.profile.error.message
        : "");
  // Keep all field and action positions stable during a cold request.
  const state =
    snapshot ??
    editorDraft(
      identity.data ?? {
        name: "",
        username: null,
        bio: "",
        is_private: true,
        avatar_path: null,
      },
      null,
    );
  const form = assessEditorDraft(state.original, state.draft, state.weightText);
  const selectedPhoto = recoveredPhoto ?? state.photo;
  const dirty = form.changed || !!selectedPhoto;
  const canSave = ready && !a.busy && dirty && !form.error;
  const update = (
    patch: Partial<ProfileDraft>,
    photo?: ChosenPhoto | null,
    weightText = state.weightText,
  ) => {
    if (!ready || a.busy) return;
    if (photo !== undefined) {
      photoRecoverySuperseded.current = true;
      setRecoveredPhoto(null);
    }
    const next = {
      ...state,
      draft: { ...state.draft, ...patch },
      photo: photo === undefined ? selectedPhoto : photo,
      weightText,
    };
    setState(next);
    void serial(() => setValue(key, next)).catch((error) =>
      a.setMessage(`Could not preserve draft: ${String(error)}`),
    );
  };
  const preview =
    selectedPhoto?.uri ??
    (state?.draft.avatar_path === identity.data?.avatar_path
      ? identity.avatarUrl
      : state?.draft.avatar_path);
  return (
    <TrainingPanel>
      <DiscoveryTitle
        title="Edit athlete profile"
        detail="Make your Nepal adventure your own"
      />

      <Copy muted>
        Google sign-in refreshes your display name. Uploaded profile pictures
        stay until you replace or delete them. Other profile details stay as you
        set them.
      </Copy>
      {photoRestoreError ? <Copy>{photoRestoreError}</Copy> : null}
      {loadError || !ready ? (
        <View>
          {loadError ? (
            <Text accessibilityRole="alert" style={{ color: c.text }}>
              {loadError}
            </Text>
          ) : !ready ? (
            <Copy muted>Loading profile details...</Copy>
          ) : null}
        </View>
      ) : null}
      {loadError ? (
        <Button
          title="Retry profile details"
          onPress={() => {
            if (restoreError) {
              setRestoreError("");
              setAttempt((n) => n + 1);
            }
            if (details.isError) void details.refetch();
            if (identity.profile?.isError) void identity.profile.refetch();
          }}
        />
      ) : null}
      <View
        pointerEvents={!ready || a.busy ? "none" : "auto"}
        accessibilityElementsHidden={!snapshot}
        importantForAccessibility={!snapshot ? "no-hide-descendants" : "auto"}
        style={{ gap: 14, opacity: !snapshot ? 0.15 : a.busy ? 0.6 : 1 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile picture"
          onPress={() => setSheet(true)}
          disabled={!ready || a.busy}
          style={{ alignSelf: "center", padding: 12 }}
        >
          {preview && failed !== preview ? (
            <Image
              source={{ uri: preview }}
              accessibilityLabel="Profile photo preview"
              style={{ width: 88, height: 88, borderRadius: 44 }}
              onError={() => {
                setFailed(preview);
                if (!selectedPhoto && preview === identity.avatarUrl)
                  identity.onAvatarError();
              }}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={88} color={c.forest} />
          )}
          <Copy>Change picture</Copy>
        </Pressable>
        {selectedPhoto ? (
          <Copy muted>
            Photo selected. Review the preview; it uploads only when you Save
            profile.
          </Copy>
        ) : null}
        <DiscoveryTitle title="About you" />
        <Field
          editable={ready ? !a.busy : false}
          label="First name"
          value={state.draft.first_name}
          onChangeText={(first_name) => update({ first_name })}
          maxLength={80}
        />
        <Field
          editable={ready ? !a.busy : false}
          label="Last name"
          value={state.draft.last_name}
          onChangeText={(last_name) => update({ last_name })}
          maxLength={80}
        />
        <Field
          editable={ready ? !a.busy : false}
          label="Username"
          value={state.draft.username ?? ""}
          onChangeText={(username) => update({ username: username || null })}
          autoCapitalize="none"
        />
        <Field
          editable={ready ? !a.busy : false}
          label="Bio"
          value={state.draft.bio}
          onChangeText={(bio) => update({ bio })}
          multiline
          maxLength={500}
        />
        <DiscoveryTitle title="Home & movement" />
        <Field
          editable={ready ? !a.busy : false}
          label="City"
          value={state.draft.city}
          onChangeText={(city) => update({ city })}
          maxLength={100}
        />
        <Field
          editable={ready ? !a.busy : false}
          label="Province"
          value={state.draft.province}
          onChangeText={(province) => update({ province })}
          maxLength={100}
        />
        <Copy>Primary sport</Copy>
        <DashboardTabs
          items={["none", "running", "walking", "cycling", "hiking"] as const}
          value={state.draft.primary_sport ?? "none"}
          label="Primary sport"
          onChange={(sport) =>
            update({ primary_sport: sport === "none" ? null : sport })
          }
        />
        <DiscoveryTitle
          title="Personal details"
          detail="Only you can read these details"
        />
        <BirthdatePicker
          disabled={!ready || a.busy}
          value={state.draft.birthdate}
          onChange={(birthdate) => update({ birthdate })}
        />
        <Copy>Gender (optional)</Copy>
        <DashboardTabs
          items={
            [
              "unset",
              "woman",
              "man",
              "nonbinary",
              "self-described",
              "prefer-not-to-say",
            ] as const
          }
          value={state.draft.gender ?? "unset"}
          label="Gender"
          onChange={(gender) =>
            update({ gender: gender === "unset" ? null : gender })
          }
        />
        <Field
          editable={ready ? !a.busy : false}
          label="Weight (kg)"
          value={
            state.weightText ??
            (state.draft.weight_kg === null
              ? ""
              : String(state.draft.weight_kg))
          }
          onChangeText={(weightText) => update({}, undefined, weightText)}
          keyboardType="decimal-pad"
        />
        <Row>
          <Copy>Private profile</Copy>
          <Switch
            accessibilityLabel="Private profile"
            disabled={!ready || a.busy}
            value={state.draft.is_private}
            onValueChange={(is_private) => update({ is_private })}
          />
        </Row>
        {ready && form.error ? (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {form.error.message}
          </Text>
        ) : null}
        {a.message ? (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {a.message}
          </Text>
        ) : null}
        <Button
          title={saving ? "Saving profile…" : "Save profile"}
          disabled={!canSave}
          onPress={() => {
            if (!canSave) return;
            return a.run(async () => {
              setSaving(true);
              try {
                const draft = { ...form.value };
                let uploaded: string | null = null;
                try {
                  if (selectedPhoto) {
                    uploaded = await uploadAvatar(userId, selectedPhoto);
                    draft.avatar_path = uploaded;
                  }
                  await saveProfileDetails(
                    userId,
                    state.original,
                    draft,
                    state.revision,
                  );
                } catch (error) {
                  if (uploaded)
                    await removeOwnedAvatar(userId, uploaded).catch(
                      () => undefined,
                    );
                  throw error;
                }
                await serial(() => setValue(key, null)).catch(() => undefined);
                await cache.invalidateQueries({
                  queryKey: ["athlete-profile", userId],
                });
                await cache.invalidateQueries({
                  queryKey: ["athlete-avatar", userId],
                });
                await cache.invalidateQueries({
                  queryKey: ["athlete-details", userId],
                });
                if (draft.avatar_path !== state.original.avatar_path)
                  await removeOwnedAvatar(
                    userId,
                    state.original.avatar_path,
                  ).catch(() => undefined);
                onClose(true);
              } finally {
                setSaving(false);
              }
            });
          }}
        />
      </View>
      <Button
        title="Cancel"
        secondary
        disabled={a.busy}
        onPress={() =>
          snapshot && restored ? setConfirm("cancel") : onClose()
        }
      />
      {__DEV__ ? (
        <Button
          secondary
          title={
            diagnosticsOpen
              ? "Hide developer diagnostics"
              : "Show developer diagnostics"
          }
          onPress={() => setDiagnosticsOpen(!diagnosticsOpen)}
        />
      ) : null}
      {__DEV__ && diagnosticsOpen ? (
        <Copy muted>
          {[
            `Profile loaded: ${identity.data ? "yes" : "no"}`,
            `Details loaded: ${details.data !== undefined ? "yes" : "no"}`,
            `Signed in: ${userId ? "yes" : "no"}`,
            `Draft restored: ${restored ? "yes" : "no"}`,
            `Form changed: ${ready && dirty ? "yes" : "no"}`,
            `Validation: ${ready ? (form.error ? `invalid (${form.error.field})` : "valid") : "pending"}`,
            `Save busy: ${a.busy ? "yes" : "no"}`,
            `Save enabled: ${canSave ? "yes" : "no"}`,
          ].join("\n")}
        </Copy>
      ) : null}
      <Modal
        visible={sheet || !!confirm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSheet(false);
          setConfirm(null);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(0,0,0,.5)",
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              padding: 24,
              gap: 14,
              backgroundColor: c.panel,
              borderRadius: 16,
              width: "100%",
              maxWidth: 460,
              alignSelf: "center",
            }}
          >
            <DiscoveryTitle
              title={
                confirm === "cancel"
                  ? "Discard profile changes?"
                  : confirm === "delete"
                    ? "Delete custom picture?"
                    : "Profile picture"
              }
            />
            {confirm ? (
              <>
                <Copy>
                  {confirm === "cancel"
                    ? "Your saved profile will stay unchanged."
                    : "The saved custom picture is removed when you Save. Your Google photo or default icon can be used instead."}
                </Copy>
                <Button
                  title={
                    confirm === "cancel" ? "Discard changes" : "Delete Picture"
                  }
                  onPress={() => {
                    if (confirm === "cancel")
                      void serial(() => setValue(key, null))
                        .then(() => onClose())
                        .catch((error) => a.setMessage(String(error)));
                    else {
                      update(
                        {
                          avatar_path: identity.session
                            ? providerProfile(identity.session.user, "google")
                                .avatar
                            : null,
                        },
                        null,
                      );
                      setConfirm(null);
                    }
                  }}
                />
                <Button
                  title="Keep editing"
                  secondary
                  onPress={() => setConfirm(null)}
                />
              </>
            ) : (
              <>
                <Button
                  title="Delete Picture"
                  onPress={() => {
                    setSheet(false);
                    setConfirm("delete");
                  }}
                />
                <Button
                  title="Take Picture"
                  onPress={() => {
                    setSheet(false);
                    void a.run(async () => {
                      const photo = await chooseAvatar(true);
                      if (photo) update({}, photo);
                    });
                  }}
                />
                <Button
                  title="Choose Existing"
                  onPress={() => {
                    setSheet(false);
                    void a.run(async () => {
                      const photo = await chooseAvatar(false);
                      if (photo) update({}, photo);
                    });
                  }}
                />
                <Button
                  title="Cancel"
                  secondary
                  onPress={() => setSheet(false)}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </TrainingPanel>
  );
}

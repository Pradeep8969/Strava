import { useEffect, useState } from "react";
import { BirthdatePicker } from "./birthdate-picker";
import { Image, Modal, Pressable, Switch, View } from "react-native";
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
import { getValue, setValue } from "../services/database";
import { useCurrentAthlete } from "../hooks/useCurrentAthlete";
import { useAction } from "../hooks/useAction";
import { providerProfile } from "../features/athlete/profile";
import {
  validateDetails,
  type ProfileDraft,
} from "../features/athlete/edit-profile";
import { profileDetailsQuery } from "../services/profile-details-query";
import {
  editorDraft,
  validEditorDraft,
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
  const [restoreError, setRestoreError] = useState("");
  const [sheet, setSheet] = useState(false),
    [confirm, setConfirm] = useState<"delete" | "cancel" | null>(null);
  const [failed, setFailed] = useState("");
  const [attempt, setAttempt] = useState(0);
  const key = `profile-editor-draft:${userId}`;
  useEffect(() => {
    let active = true;
    void Promise.all([getValue<DraftState>(key), recoverAvatarSelection()])
      .then(([saved, pendingPhoto]) => {
        if (!active) return;
        setRecoveredPhoto(pendingPhoto);
        setState((current) =>
          saved
            ? { ...saved, photo: pendingPhoto ?? saved.photo }
            : current
              ? { ...current, photo: pendingPhoto ?? current.photo }
              : null,
        );
        setRestored(true);
      })
      .catch((error) => {
        if (active) setRestoreError(String(error.message ?? error));
      });
    return () => {
      active = false;
    };
  }, [key, attempt]);
  if (!snapshot && identity.data && details.data !== undefined) {
    setState({
      ...editorDraft(identity.data, details.data),
      photo: recoveredPhoto,
    });
  }
  const ready = !!snapshot && restored;
  const loadError =
    restoreError ||
    (!snapshot && details.isError && !details.isFetching
      ? details.error.message
      : "");
  // Keep all field and action positions stable during a cold request.
  const state = snapshot ?? editorDraft(identity.data!, null);
  const update = (patch: Partial<ProfileDraft>, photo?: ChosenPhoto | null) => {
    if (!ready || a.busy) return;
    const next = {
      ...state,
      draft: { ...state.draft, ...patch },
      photo: photo === undefined ? state.photo : photo,
    };
    setState(next);
    void setValue(key, next).catch((error) =>
      a.setMessage(`Could not preserve draft: ${String(error)}`),
    );
  };
  const preview =
    state?.photo?.uri ??
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
      {a.message ? <Copy>{a.message}</Copy> : null}
      {a.busy ? <Copy muted>Working on your profile…</Copy> : null}
      <View style={{ minHeight: 24 }}>
        {loadError ? (
          <Copy>{loadError}</Copy>
        ) : !snapshot ? (
          <Copy muted>Loading profile details...</Copy>
        ) : null}
      </View>
      {loadError ? (
        <Button
          title="Retry profile details"
          onPress={() => {
            setRestoreError("");
            setAttempt((n) => n + 1);
            if (details.isError) void details.refetch();
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
                if (!state.photo && preview === identity.avatarUrl)
                  identity.onAvatarError();
              }}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={88} color={c.forest} />
          )}
          <Copy>Change picture</Copy>
        </Pressable>
        {state.photo ? (
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
          onChangeText={(weightText) => {
            if (a.busy) return;
            const next = {
              ...state,
              weightText,
              draft: {
                ...state.draft,
                weight_kg: weightText.trim() ? Number(weightText) : null,
              },
            };
            setState(next);
            void setValue(key, next).catch((error) =>
              a.setMessage(String(error)),
            );
          }}
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
        <Button
          title="Save profile"
          disabled={
            !ready || a.busy || !validEditorDraft(state.draft, state.weightText)
          }
          onPress={() =>
            void a.run(async () => {
              const draft = {
                ...state.draft,
                weight_kg:
                  state.weightText === undefined
                    ? state.draft.weight_kg
                    : state.weightText.trim()
                      ? Number(state.weightText)
                      : null,
                name: `${state.draft.first_name.trim()} ${state.draft.last_name.trim()}`.trim(),
                username: state.draft.username?.trim() || null,
              };
              validateDetails(draft);
              let uploaded: string | null = null;
              try {
                if (state.photo) {
                  uploaded = await uploadAvatar(userId, state.photo);
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
              await setValue(key, null);
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
            })
          }
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
                      void setValue(key, null)
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

import { beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { ProfileEditor } from "../components/profile-editor";
vi.mock("../components/birthdate-picker", () => ({
  BirthdatePicker: "BirthdatePicker",
}));
const h = vi.hoisted(() => ({
  slots: [] as any[],
  deps: [] as any[],
  effects: [] as (() => void)[],
  index: 0,
  query: {} as any,
  get: vi.fn(),
  recover: vi.fn(),
  refetch: vi.fn(),
  close: vi.fn(),
  save: vi.fn(),
  write: vi.fn(),
  invalidate: vi.fn(),
  user: "owner",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: any) => {
    const i = h.index++;
    if (!(i in h.slots))
      h.slots[i] = typeof initial === "function" ? initial() : initial;
    return [
      h.slots[i],
      (value: any) => {
        h.slots[i] = typeof value === "function" ? value(h.slots[i]) : value;
      },
    ];
  },
  useRef: (value: any) => {
    const i = h.index++;
    return (h.slots[i] ??= { current: value });
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void, deps: any[]) => {
    const i = h.index++;
    if (!h.deps[i] || deps.some((v, n) => v !== h.deps[i][n]))
      h.effects.push(effect);
    h.deps[i] = deps;
  },
}));
vi.mock("react-native", () => ({
  Image: "Image",
  Modal: "Modal",
  Pressable: "Pressable",
  Switch: "Switch",
  Text: "Text",
  View: "View",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => h.query,
  useQueryClient: () => ({ invalidateQueries: h.invalidate }),
  queryOptions: (v: any) => v,
}));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Copy: "Copy",
  Field: "Field",
  Row: "Row",
  useColors: () => ({}),
}));
vi.mock("../components/athlete-training", () => ({ TrainingPanel: "Panel" }));
vi.mock("../components/discovery-ui", () => ({ DiscoveryTitle: "Title" }));
vi.mock("../components/dashboard-ui", () => ({ DashboardTabs: "Tabs" }));
vi.mock("../services/avatar-picker", () => ({
  recoverAvatarSelection: () => h.recover(),
  chooseAvatar: vi.fn(),
}));
vi.mock("../services/avatar", () => ({
  uploadAvatar: vi.fn(),
  removeOwnedAvatar: vi.fn(),
}));
vi.mock("../services/profile-details", () => ({
  loadProfileDetails: vi.fn(),
  saveProfileDetails: h.save,
}));
vi.mock("../services/database", () => ({
  getValue: h.get,
  setValue: h.write,
  serial: (work: () => Promise<unknown>) => work(),
}));
vi.mock("../hooks/useCurrentAthlete", () => ({
  useCurrentAthlete: () => ({
    userId: h.user,
    data: {
      name: "Maya Sherpa",
      username: null,
      bio: "Mountains",
      avatar_path: "https://google.test/photo",
      is_private: true,
    },
    avatarUrl: "https://google.test/photo",
  }),
}));
function render() {
  h.index = 0;
  const tree = ProfileEditor({ onClose: h.close });
  const nodes: any[] = [];
  function visit(node: any) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    nodes.push(node);
    visit(node.props?.children);
  }
  visit(tree);
  h.effects.splice(0).forEach((effect) => effect());
  return {
    button: (title: string) =>
      nodes.find((n) => n.type === "Button" && n.props.title === title)?.props,
    field: (label: string) =>
      nodes.find((n) => n.type === "Field" && n.props.label === label)?.props,
    alerts: nodes
      .filter((n) => n.props?.accessibilityRole === "alert")
      .map((n) => n.props.children),
    copies: nodes.filter((n) => n.type === "Copy").map((n) => n.props.children),
    tree: tree as ReactElement,
  };
}
const details = {
  first_name: "Maya",
  last_name: "Sherpa",
  city: "Kathmandu",
  province: "Bagmati",
  primary_sport: "running",
  birthdate: null,
  gender: null,
  weight_kg: null,
  revision: 3,
};
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
beforeEach(() => {
  vi.stubGlobal("__DEV__", false);
  h.slots = [];
  h.deps = [];
  h.effects = [];
  h.index = 0;
  h.get.mockReset().mockResolvedValue(null);
  h.recover.mockReset().mockResolvedValue(null);
  h.refetch.mockReset();
  h.close.mockReset();
  h.save.mockReset().mockResolvedValue(undefined);
  h.write.mockReset().mockResolvedValue(undefined);
  h.invalidate.mockReset().mockResolvedValue(undefined);
  h.user = "owner";
  h.query = {
    data: undefined,
    isError: false,
    isFetching: true,
    refetch: h.refetch,
  };
});
it("distinguishes a delayed local draft from optional Android photo recovery", async () => {
  vi.stubGlobal("__DEV__", true);
  h.query.data = details;
  let completeDraft!: (value: null) => void;
  h.get.mockReturnValueOnce(
    new Promise((resolve) => {
      completeDraft = resolve;
    }),
  );
  h.recover.mockReturnValueOnce(new Promise(() => {}));
  const diagnostic = () =>
    render().copies.find(
      (copy) => typeof copy === "string" && copy.startsWith("Profile loaded:"),
    );
  expect(diagnostic()).toBeUndefined();
  render().button("Show developer diagnostics").onPress();
  expect(diagnostic()).toContain("Profile loaded: yes");
  expect(diagnostic()).toContain("Draft restored: no");
  expect(diagnostic()).toContain("Save enabled: no");
  expect(render().field("Bio").editable).toBe(false);
  completeDraft(null);
  await settle();
  expect(diagnostic()).toContain("Draft restored: yes");
  expect(diagnostic()).toContain("Form changed: no");
  expect(render().field("Bio").editable).toBe(true);
  render().field("Bio").onChangeText("Updated bio");
  expect(diagnostic()).toContain("Form changed: yes");
  expect(diagnostic()).toContain("Save enabled: yes");
  expect(diagnostic()).not.toContain("Updated bio");
  render().field("Weight (kg)").onChangeText("5");
  expect(diagnostic()).toContain("Form changed: yes");
  expect(diagnostic()).toContain("Validation: invalid (Weight (kg))");
  expect(diagnostic()).toContain("Save enabled: no");
  render().field("Weight (kg)").onChangeText("");
  render().field("Username").onChangeText("invalid username!");
  expect(diagnostic()).toContain("Validation: invalid (Username)");
  vi.stubGlobal("__DEV__", false);
  expect(diagnostic()).toBeUndefined();
  expect(render().button("Show developer diagnostics")).toBeUndefined();
  expect(render().button("Hide developer diagnostics")).toBeUndefined();
});

it("retries a local draft read failure without restarting photo recovery", async () => {
  h.query.data = details;
  h.get.mockRejectedValueOnce(new Error("Storage unavailable"));
  render();
  await settle();
  expect(render().alerts).toContain(
    "Could not load your local profile draft. Storage unavailable",
  );
  expect(render().button("Save profile").disabled).toBe(true);
  render().button("Retry profile details").onPress();
  render();
  await settle();
  render().field("City").onChangeText("Pokhara");
  expect(render().button("Save profile").disabled).toBe(false);
  expect(h.recover).toHaveBeenCalledOnce();
});
it("keeps the full form and Cancel mounted during loading without Retry or enabled Save", () => {
  const view = render();
  expect(view.button("Retry profile details")).toBeUndefined();
  expect(view.button("Save profile").disabled).toBe(true);
  expect(view.field("City").editable).toBe(false);
  view.button("Cancel").onPress();
  expect(h.close).toHaveBeenCalled();
});
it("uses cached details immediately and enables Save only for valid changes", async () => {
  h.query.data = details;
  expect(render().field("City").value).toBe("Kathmandu");
  await settle();
  expect(render().button("Save profile").disabled).toBe(true);
  render().button("Save profile").onPress();
  expect(h.save).not.toHaveBeenCalled();
  render().field("City").onChangeText("  Kathmandu ");
  expect(render().button("Save profile").disabled).toBe(true);
  render().field("City").onChangeText("Pokhara");
  expect(render().button("Save profile").disabled).toBe(false);
});
it("shows Retry only for failure and hides it while retrying", async () => {
  h.query = {
    ...h.query,
    isError: true,
    isFetching: false,
    error: new Error("offline"),
  };
  render().button("Retry profile details").onPress();
  expect(h.refetch).toHaveBeenCalledOnce();
  h.query.isFetching = true;
  expect(render().button("Retry profile details")).toBeUndefined();
  h.query = { ...h.query, data: details, isError: false, isFetching: false };
  render();
  await settle();
  expect(render().field("City").value).toBe("Kathmandu");
});
it("preserves unsaved edits and revision through background success and failure", async () => {
  h.query.data = details;
  render();
  await settle();
  render().field("City").onChangeText("Pokhara");
  h.query.data = { ...details, city: "Lalitpur", revision: 4 };
  h.query.isFetching = true;
  expect(render().field("City").value).toBe("Pokhara");
  h.query.isError = true;
  h.query.isFetching = false;
  h.query.error = new Error("offline");
  expect(render().field("City").value).toBe("Pokhara");
  expect(render().button("Retry profile details")).toBeUndefined();
  expect(h.write.mock.lastCall?.[1].revision).toBe(3);
});
it("disables Save for invalid edits", async () => {
  h.query.data = details;
  render();
  await settle();
  render().field("First name").onChangeText(" ");
  expect(render().button("Save profile").disabled).toBe(true);
  expect(render().alerts).toContain(
    "Enter a first name and a full name of up to 80 characters.",
  );
});
it("keeps text edits available when Android pending-photo recovery rejects", async () => {
  h.recover.mockRejectedValueOnce(
    new Error("Android picker result unavailable"),
  );
  h.query.data = details;
  render();
  await settle();
  expect(render().copies).toContain(
    "Could not recover the selected photo. Choose it again if you want to change your picture.",
  );
  expect(render().field("Bio").value).toBe("Mountains");
  render().field("Bio").onChangeText("Trail runner");
  expect(render().button("Save profile").disabled).toBe(false);
});

it("validates decimal weight text and submits the same normalized values to the profile mutation", async () => {
  h.query.data = details;
  render();
  await settle();
  render().field("Weight (kg)").onChangeText("70,5");
  render().field("First name").onChangeText(" Maya Devi ");
  render().field("Bio").onChangeText("Trail runner");
  render().field("Province").onChangeText(" Gandaki ");
  let finish!: () => void;
  h.save.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const saving = render().button("Save profile").onPress();
  expect(render().button("Saving profile…").disabled).toBe(true);
  expect(h.save).toHaveBeenCalledWith(
    "owner",
    expect.anything(),
    expect.objectContaining({
      name: "Maya Devi Sherpa",
      bio: "Trail runner",
      province: "Gandaki",
      weight_kg: 70.5,
      avatar_path: "https://google.test/photo",
    }),
    3,
  );
  finish();
  await saving;
  expect(h.close).toHaveBeenCalledWith(true);
  expect(h.write).toHaveBeenLastCalledWith("profile-editor-draft:owner", null);
  for (const query of ["athlete-profile", "athlete-avatar", "athlete-details"])
    expect(h.invalidate).toHaveBeenCalledWith({ queryKey: [query, "owner"] });
});

it("keeps a failed web-compatible text edit available for retry", async () => {
  h.query.data = details;
  render();
  await settle();
  render().field("Weight (kg)").onChangeText("abc");
  expect(render().button("Save profile").disabled).toBe(true);
  expect(render().alerts).toContain(
    "Weight must be between 20 and 500 kilograms, or blank.",
  );
  render().field("Weight (kg)").onChangeText("70.5");
  render().field("Bio").onChangeText("Trail runner");
  h.save.mockRejectedValueOnce(new Error("Could not save profile. Offline."));
  await render().button("Save profile").onPress();
  expect(render().alerts).toContain("Could not save profile. Offline.");
  expect(render().field("Bio").value).toBe("Trail runner");
  expect(h.close).not.toHaveBeenCalled();
  expect(render().button("Save profile").disabled).toBe(false);
  await render().button("Save profile").onPress();
  expect(h.close).toHaveBeenCalledWith(true);
});

it("loads restored account drafts under their owner key and does not carry edits to another account", async () => {
  h.query.data = details;
  render();
  await settle();
  render().field("City").onChangeText("Pokhara");
  const saved = h.write.mock.lastCall?.[1];
  h.get.mockImplementation(async (key) =>
    key === "profile-editor-draft:owner" ? saved : null,
  );
  // Profile keys its screen subtree by the restored session user ID.
  h.slots = [];
  h.deps = [];
  render();
  await settle();
  expect(render().field("City").value).toBe("Pokhara");
  h.slots = [];
  h.deps = [];
  h.user = "other";
  render();
  await settle();
  expect(h.get).toHaveBeenLastCalledWith("profile-editor-draft:other");
  expect(render().field("City").value).toBe("Kathmandu");
  expect(render().button("Save profile").disabled).toBe(true);
});
it("restores persisted edits even when the network has failed", async () => {
  h.query.data = details;
  render();
  await settle();
  render().field("City").onChangeText("Pokhara");
  const saved = h.write.mock.lastCall?.[1];
  h.slots = [];
  h.deps = [];
  h.get.mockResolvedValue(saved);
  h.query = {
    ...h.query,
    data: undefined,
    isError: true,
    isFetching: false,
    error: new Error("offline"),
  };
  render();
  await settle();
  expect(render().field("City").value).toBe("Pokhara");
  expect(render().button("Save profile").disabled).toBe(false);
});

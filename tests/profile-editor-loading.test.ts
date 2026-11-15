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
  View: "View",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => h.query,
  useQueryClient: () => ({}),
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
  saveProfileDetails: vi.fn(),
}));
vi.mock("../services/database", () => ({
  getValue: () => h.get(),
  setValue: vi.fn().mockResolvedValue(null),
}));
vi.mock("../hooks/useAction", () => ({
  useAction: () => ({ busy: false, message: "" }),
}));
vi.mock("../hooks/useCurrentAthlete", () => ({
  useCurrentAthlete: () => ({
    userId: "owner",
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
  h.slots = [];
  h.deps = [];
  h.effects = [];
  h.index = 0;
  h.get.mockReset().mockResolvedValue(null);
  h.recover.mockReset().mockResolvedValue(null);
  h.refetch.mockReset();
  h.close.mockReset();
  h.query = {
    data: undefined,
    isError: false,
    isFetching: true,
    refetch: h.refetch,
  };
});
it("keeps the full form and Cancel mounted during loading without Retry or enabled Save", () => {
  const view = render();
  expect(view.button("Retry profile details")).toBeUndefined();
  expect(view.button("Save profile").disabled).toBe(true);
  expect(view.field("City").editable).toBe(false);
  view.button("Cancel").onPress();
  expect(h.close).toHaveBeenCalled();
});
it("uses cached details immediately and enables Save after local recovery", async () => {
  h.query.data = details;
  expect(render().field("City").value).toBe("Kathmandu");
  await settle();
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
  expect(h.slots[0].revision).toBe(3);
});
it("disables Save for invalid edits", async () => {
  h.query.data = details;
  render();
  await settle();
  render().field("First name").onChangeText(" ");
  expect(render().button("Save profile").disabled).toBe(true);
});
it("restores persisted edits even when the network has failed", async () => {
  h.query.data = details;
  render();
  await settle();
  const saved = {
    ...h.slots[0],
    draft: { ...h.slots[0].draft, city: "Pokhara" },
  };
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

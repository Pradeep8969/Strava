import { beforeEach, expect, it, vi } from "vitest";
import { emptyEventDraft } from "../features/organizer/drafts";
import {
  loadWorkspace,
  updateWorkspace,
} from "../features/organizer/repository";
import {
  emptyWorkspace,
  parseWorkspace,
  planningSummary,
  selectDrafts,
  validateProfile,
  workspaceKey,
} from "../features/organizer/workspace";
const storage = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  fail: false,
}));
vi.mock("../services/organizer-storage", () => ({
  readOrganizerValue: async (key: string) =>
    structuredClone(storage.values.get(key) ?? null),
  writeOrganizerValue: async (key: string, value: unknown) => {
    if (storage.fail) throw new Error("Quota exceeded");
    storage.values.set(key, structuredClone(value));
  },
}));
const draft = (id = "test") => ({
  ...emptyEventDraft(),
  id,
  title: `Test ${id}`,
  location: "Test venue",
  date: "2027-04-10",
  createdAt: 1,
  updatedAt: 2,
});
beforeEach(() => {
  storage.values.clear();
  storage.fail = false;
});
it("creates, edits, rereads and deletes persisted drafts without any workout writes", async () => {
  await updateWorkspace(undefined, (w) => ({ ...w, drafts: [draft()] }));
  expect((await loadWorkspace()).drafts[0].title).toBe("Test test");
  await updateWorkspace(undefined, (w) => ({
    ...w,
    drafts: w.drafts.map((d) => ({ ...d, title: "Edited test" })),
  }));
  expect((await loadWorkspace()).drafts[0].title).toBe("Edited test");
  await updateWorkspace(undefined, (w) => ({
    ...w,
    drafts: w.drafts.filter((d) => d.id !== "test"),
  }));
  expect((await loadWorkspace()).drafts).toEqual([]);
  expect([...storage.values.keys()]).toEqual([workspaceKey()]);
});
it("isolates guest and account local workspaces and never auto-claims guest drafts", async () => {
  await updateWorkspace(undefined, (w) => ({ ...w, drafts: [draft("guest")] }));
  await updateWorkspace("account-a", (w) => ({
    ...w,
    drafts: [draft("account")],
  }));
  expect((await loadWorkspace("account-b")).drafts).toEqual([]);
  expect((await loadWorkspace()).drafts[0].id).toBe("guest");
  expect((await loadWorkspace("account-a")).drafts[0].id).toBe("account");
});
it("serializes same-runtime mutations and keeps profile edits alongside draft changes", async () => {
  await Promise.all([
    updateWorkspace(undefined, (w) => ({
      ...w,
      drafts: [draft("first"), ...w.drafts],
    })),
    updateWorkspace(undefined, (w) => ({
      ...w,
      drafts: [draft("second"), ...w.drafts],
    })),
    updateWorkspace(undefined, (w) => ({
      ...w,
      profile: {
        ...w.profile,
        name: "Test organizer",
        email: "test@example.test",
        sports: ["Running"],
        banner: "lake",
      },
    })),
  ]);
  const w = await loadWorkspace();
  expect(w.drafts).toHaveLength(2);
  expect(w.profile.banner).toBe("lake");
  expect(w.profile.name).toBe("Test organizer");
});
it("surfaces write failures without losing persisted values and can retry", async () => {
  await updateWorkspace(undefined, (w) => ({ ...w, drafts: [draft()] }));
  storage.fail = true;
  await expect(
    updateWorkspace(undefined, (w) => ({ ...w, drafts: [] })),
  ).rejects.toThrow("Quota");
  expect((await loadWorkspace()).drafts).toHaveLength(1);
  storage.fail = false;
  await updateWorkspace(undefined, (w) => ({ ...w, drafts: [] }));
  expect((await loadWorkspace()).drafts).toEqual([]);
});
it("rejects corruption and unknown versions without replacing existing storage", async () => {
  for (const bad of [
    { version: 2 },
    { ...emptyWorkspace(), drafts: [{ id: "broken" }] },
    { ...emptyWorkspace(), drafts: [draft(), draft()] },
  ])
    expect(() => parseWorkspace(bad)).toThrow();
  storage.values.set(workspaceKey(), { version: 99 });
  await expect(
    updateWorkspace(undefined, () => emptyWorkspace()),
  ).rejects.toThrow();
  expect(storage.values.get(workspaceKey())).toEqual({ version: 99 });
});
it("validates private profile contact fields, safe links, sport choices and description limits", () => {
  const p = { ...emptyWorkspace().profile, name: "Test organizer" };
  expect(validateProfile(p)).toBeNull();
  expect(validateProfile({ ...p, email: "bad" })).toContain("email");
  expect(validateProfile({ ...p, phone: "not a number" })).toContain("phone");
  for (const website of [
    "javascript:alert(1)",
    "http://example.test",
    "https://user:pass@example.test",
    "https://",
  ])
    expect(validateProfile({ ...p, website })).toContain("HTTPS");
  expect(
    validateProfile({
      ...p,
      website: "https://example.test/contact",
      social: "https://social.example.test/athlete",
    }),
  ).toBeNull();
  expect(validateProfile({ ...p, about: "x".repeat(2001) })).toContain("2,000");
});
it("filters and sorts actual drafts and computes only real planning categories and dates", () => {
  const a = {
    ...draft("a"),
    title: "Zebra",
    sport: "Hiking" as const,
    schedule: "06:00 briefing",
    updatedAt: 3,
  };
  const b = { ...draft("b"), title: "Alpha", date: "2025-01-01", updatedAt: 4 };
  expect(
    selectDrafts([a, b], " TEST venue ", "All drafts", "Event name").map(
      (d) => d.id,
    ),
  ).toEqual(["b", "a"]);
  expect(selectDrafts([a, b], "", "Hiking", "Recently updated")).toEqual([a]);
  expect(selectDrafts([a, b], "", "All drafts", "Proposed date")[0].id).toBe(
    "b",
  );
  const s = planningSummary([a, b], "2026-11-14");
  expect(s.upcoming).toEqual([a]);
  expect(s.past).toBe(1);
  expect(s.scheduled).toBe(1);
  expect(s.categories.reduce((n, c) => n + c.value, 0)).toBe(2);
  expect(planningSummary([], "2026-11-14").upcoming).toEqual([]);
});

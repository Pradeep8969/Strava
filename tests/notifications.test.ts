import { expect, it, vi } from "vitest";
import { fetchInbox, markNotificationRead } from "../services/notifications";
const fake = vi.hoisted(() => ({
  results: [] as unknown[],
  calls: [] as unknown[],
}));
vi.mock("../services/supabase", () => ({
  backend: () => ({
    from: (table: string) => {
      const calls: unknown[] = [table];
      fake.calls.push(calls);
      const chain = {
        select: (...args: unknown[]) => {
          calls.push(["select", ...args]);
          return chain;
        },
        eq: (...args: unknown[]) => {
          calls.push(["eq", ...args]);
          return chain;
        },
        is: (...args: unknown[]) => {
          calls.push(["is", ...args]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        update: (value: unknown) => {
          calls.push(["update", value]);
          return chain;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            fake.results.shift() ?? { data: [], error: null },
          ).then(resolve),
      };
      return chain;
    },
  }),
}));
it("merges saved unread and recent notifications, deduplicates IDs and excludes another account", async () => {
  fake.calls = [];
  const a = {
    id: "welcome-a",
    user_id: "a",
    kind: "welcome",
    title: "Welcome",
    body: "Test fixture",
    created_at: "2026-11-14",
    read_at: null,
  };
  fake.results = [
    { data: [a, { ...a, id: "other", user_id: "b" }], error: null },
    {
      data: [a, { ...a, id: "older", created_at: "2026-01-01" }],
      count: 2,
      error: null,
    },
  ];
  const result = await fetchInbox("a");
  expect(result.items.map((n) => n.id)).toEqual(["welcome-a", "older"]);
  expect(result.unreadCount).toBe(2);
  expect(
    fake.calls.every((c) => JSON.stringify(c).includes('["eq","user_id","a"]')),
  ).toBe(true);
});
it("marks only read_at and filters both notification id and authenticated owner", async () => {
  fake.calls = [];
  fake.results = [{ error: null }];
  await markNotificationRead("a", "notification");
  const call = JSON.stringify(fake.calls);
  expect(call).toContain("read_at");
  expect(call).toContain('["eq","user_id","a"]');
  expect(call).toContain('["eq","id","notification"]');
  expect(call).not.toContain("welcome");
});
it("reports fetch and mark failures rather than displaying fictional success", async () => {
  fake.results = [
    { data: null, error: { message: "offline" } },
    { data: null, error: null },
  ];
  await expect(fetchInbox("a")).rejects.toThrow("connection");
  fake.results = [{ error: { message: "denied" } }];
  await expect(markNotificationRead("a", "n")).rejects.toThrow("retry");
});

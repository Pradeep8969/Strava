import { beforeEach, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { useFeed } from "../hooks/useFeed";

const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("../services/supabase", () => ({ supabase: {}, backend: () => db }));
beforeEach(() => vi.clearAllMocks());
function options() {
  return vi.mocked(useQuery).mock.calls.at(-1)![0];
}
it("does not query anonymous feeds or invent followed athletes", async () => {
  useFeed(undefined, "following");
  expect(options().enabled).toBe(false);
  const follows = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  db.from.mockReturnValue(follows);
  useFeed("owner", "following");
  expect(await (options().queryFn as () => Promise<unknown>)()).toEqual([]);
  expect(db.from).toHaveBeenCalledTimes(1);
  expect(db.from).toHaveBeenCalledWith("follows");
});
it("restricts Following to existing follows and selects summaries without GPS", async () => {
  const rows = [
    {
      id: "activity",
      title: "Test fixture",
      sport: "hiking",
      distance_m: 100,
      started_at: "2026-11-14",
    },
  ];
  const follows = {
    select: vi.fn().mockReturnThis(),
    eq: vi
      .fn()
      .mockResolvedValue({ data: [{ following_id: "followed" }], error: null }),
  };
  const activities = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  db.from.mockImplementation((table) =>
    table === "follows" ? follows : activities,
  );
  useFeed("owner", "following");
  expect(await (options().queryFn as () => Promise<unknown>)()).toEqual(rows);
  expect(follows.eq).toHaveBeenCalledWith("follower_id", "owner");
  expect(activities.in).toHaveBeenCalledWith("user_id", ["followed"]);
  expect(activities.select).toHaveBeenCalledWith(
    "id,title,sport,distance_m,started_at",
  );
});
it("surfaces follow lookup errors instead of showing an unrelated public feed", async () => {
  const failure = new Error("Follow lookup failed");
  db.from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: failure }),
  });
  useFeed("owner", "following");
  await expect((options().queryFn as () => Promise<unknown>)()).rejects.toThrow(
    "Follow lookup failed",
  );
  expect(db.from).toHaveBeenCalledTimes(1);
});

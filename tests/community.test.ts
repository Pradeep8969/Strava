import { beforeEach, expect, it, vi } from "vitest";
import {
  addComment,
  changeMembership,
  loadCommunity,
  loadComments,
  loadSocialFeed,
  setKudos,
} from "../features/community/data";
import { challengeProgress } from "../features/community/progress";
import { trainingFixture } from "./fixtures/training";
import { stats } from "../utils/tracking";

const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../services/supabase", () => ({ backend: () => db }));
function result(data: unknown, error: unknown = null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    gt: vi.fn(),
    limit: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    insert: vi.fn(),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  };
  for (const method of [
    q.select,
    q.eq,
    q.in,
    q.order,
    q.gt,
    q.limit,
    q.delete,
    q.upsert,
    q.insert,
  ])
    method.mockReturnValue(q);
  return q;
}
beforeEach(() => vi.clearAllMocks());
it("reads only the viewer's memberships and entries without mistaking them for public totals", async () => {
  const clubs = result([]),
    challenges = result([]),
    memberships = result([{ club_id: "club", joined_at: "2026-11-01" }]),
    entries = result([]);
  const tables: Record<string, ReturnType<typeof result>> = {
    clubs,
    challenges,
    club_members: memberships,
    challenge_entries: entries,
  };
  db.from.mockImplementation((table) => tables[table]);
  expect((await loadCommunity("viewer")).memberships).toHaveLength(1);
  expect(memberships.eq).toHaveBeenCalledWith("user_id", "viewer");
  expect(entries.eq).toHaveBeenCalledWith("user_id", "viewer");
  expect(challenges.select).toHaveBeenCalledWith(
    "id,club_id,title,target_m,starts_at,ends_at",
  );
  expect(memberships.select).not.toHaveBeenCalledWith(
    expect.stringContaining("count"),
  );
});
it("never expands an empty Following feed to the entire community", async () => {
  db.from.mockReturnValue(result([]));
  expect(await loadSocialFeed("viewer", "following")).toEqual([]);
  expect(db.from).toHaveBeenCalledTimes(1);
  expect(db.from).toHaveBeenCalledWith("follows");
});
it("loads permitted social summaries, available profile names and real reaction state without GPS", async () => {
  const activities = result([
    {
      id: "activity",
      user_id: "friend",
      title: "Test fixture",
      distance_m: 1200,
      moving_seconds: 600,
      sport: "running",
    },
  ]);
  const follows = result([{ following_id: "friend" }]);
  const profiles = result([
    { id: "friend", name: "Test Athlete", username: "test" },
  ]);
  const likes = result([{ activity_id: "activity" }]);
  const tables: Record<string, ReturnType<typeof result>> = {
    activities,
    follows,
    profiles,
    activity_reactions: likes,
  };
  db.from.mockImplementation((table) => tables[table]);
  const posts = await loadSocialFeed("viewer", "following");
  expect(posts[0].athlete).toBe("Test Athlete");
  expect(posts[0].liked).toBe(true);
  expect(activities.in).toHaveBeenCalledWith("user_id", ["friend"]);
  expect(activities.select).toHaveBeenCalledWith(
    expect.stringContaining("moving_seconds"),
  );
  expect(db.from).not.toHaveBeenCalledWith("activity_points");
});
it("propagates permission failures instead of displaying made-up social or membership results", async () => {
  db.from.mockReturnValue(result(null, new Error("Permission denied")));
  await expect(loadCommunity("viewer")).rejects.toThrow("Permission denied");
  await expect(loadSocialFeed("viewer", "community")).rejects.toThrow(
    "Permission denied",
  );
  await expect(
    changeMembership("club_members", "club", "viewer", false),
  ).rejects.toThrow("Permission denied");
});
it("scopes leave/kudos deletes to the signed-in user and uses idempotent joins", async () => {
  const q = result(null);
  db.from.mockReturnValue(q);
  await changeMembership("club_members", "club", "viewer", true);
  expect(q.delete).toHaveBeenCalledTimes(1);
  expect(q.eq).toHaveBeenCalledWith("club_id", "club");
  expect(q.eq).toHaveBeenCalledWith("user_id", "viewer");
  await changeMembership("challenge_entries", "challenge", "viewer", false);
  expect(q.upsert).toHaveBeenCalledWith(
    { challenge_id: "challenge", user_id: "viewer" },
    { ignoreDuplicates: true },
  );
  await setKudos("activity", "viewer", true);
  expect(q.eq).toHaveBeenCalledWith("activity_id", "activity");
});
it("validates and trims comments, leaving empty comment reads at zero", async () => {
  const q = result([]);
  db.from.mockReturnValue(q);
  await expect(addComment("a", "viewer", "  ")).rejects.toThrow();
  expect(db.from).not.toHaveBeenCalled();
  await addComment("a", "viewer", "  Well done!  ");
  expect(q.insert).toHaveBeenCalledWith({
    activity_id: "a",
    user_id: "viewer",
    body: "Well done!",
  });
  expect(await loadComments("a")).toEqual([]);
});

const now = +new Date(2026, 10, 14, 12);
it("reads the latest comments and presents them chronologically, including new replies", async () => {
  const comments = result([
    { id: "latest", user_id: "viewer", body: "New reply" },
    { id: "earlier", user_id: "viewer", body: "Earlier reply" },
  ]);
  db.from.mockImplementation((table) =>
    table === "comments"
      ? comments
      : result([{ id: "viewer", name: "Test Athlete" }]),
  );
  expect((await loadComments("activity")).map((c) => c.id)).toEqual([
    "earlier",
    "latest",
  ]);
  expect(comments.order).toHaveBeenCalledWith("created_at", {
    ascending: false,
  });
  expect(comments.limit).toHaveBeenCalledWith(30);
});
const challenge = {
  id: "challenge",
  club_id: null,
  title: "Test goal",
  target_m: 100000,
  starts_at: new Date(now - 3 * 86400000).toISOString(),
  ends_at: new Date(now + 86400000).toISOString(),
};
const joined = new Date(now - 86400000).toISOString();
it("computes challenge distance only from completed eligible own/device workouts after joining", () => {
  const w = trainingFixture("eligible", "running", now - 3600000);
  const input = [
    w,
    { ...w, id: "other", ownerId: "someone-else" },
    { ...w, id: "paused", state: "paused" as const },
    { ...w, id: "early", startedAt: now - 2 * 86400000 },
    { ...w, id: "future", endedAt: now + 1000 },
    { ...w, id: "no-end", endedAt: null },
  ];
  const progress = challengeProgress(challenge, input, "viewer", joined, now)!;
  expect(progress.count).toBe(1);
  expect(progress.meters).toBeCloseTo(stats(w).meters);
  expect(progress.percent).toBeCloseTo(stats(w).meters / 1000);
});
it("keeps challenge empty progress honest and caps the bar without capping real distance", () => {
  expect(challengeProgress(challenge, [], "viewer", joined, now)?.meters).toBe(
    0,
  );
  const w = trainingFixture("eligible", "running", now - 3600000);
  const progress = challengeProgress(
    { ...challenge, target_m: 100 },
    [w],
    "viewer",
    joined,
    now,
  )!;
  expect(progress.percent).toBe(100);
  expect(progress.meters).toBeGreaterThan(100);
  expect(
    challengeProgress(
      { ...challenge, target_m: 0 },
      [w],
      "viewer",
      joined,
      now,
    ),
  ).toBeNull();
  expect(
    challengeProgress(challenge, [w], "viewer", "invalid", now),
  ).toBeNull();
});
it("does not credit a whole workout that extends beyond the challenge end", () => {
  const w = trainingFixture("cross-boundary", "running", now - 3600000);
  const ended = {
    ...challenge,
    ends_at: new Date(w.startedAt + 300000).toISOString(),
  };
  expect(challengeProgress(ended, [w], "viewer", joined, now)?.meters).toBe(0);
});

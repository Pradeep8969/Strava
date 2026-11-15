import { backend } from "../../services/supabase";
import type { Sport } from "../../types/activity";

export type Club = { id: string; name: string; description: string };
export type Challenge = {
  id: string;
  club_id: string | null;
  title: string;
  target_m: number;
  starts_at: string;
  ends_at: string;
};
export type Entry = { challenge_id: string; joined_at: string };
export type Membership = { club_id: string; joined_at: string };
export type CommunityData = {
  clubs: Club[];
  challenges: Challenge[];
  memberships: Membership[];
  entries: Entry[];
};
export const challengeFields = "id,club_id,title,target_m,starts_at,ends_at";
export async function loadCommunity(userId: string): Promise<CommunityData> {
  const [clubs, challenges, members, entries] = await Promise.all([
    backend()
      .from("clubs")
      .select("id,name,description")
      .order("name")
      .limit(30),
    backend()
      .from("challenges")
      .select(challengeFields)
      .gt("ends_at", new Date().toISOString())
      .order("ends_at")
      .limit(30),
    backend()
      .from("club_members")
      .select("club_id,joined_at")
      .eq("user_id", userId),
    backend()
      .from("challenge_entries")
      .select("challenge_id,joined_at")
      .eq("user_id", userId),
  ]);
  for (const result of [clubs, challenges, members, entries])
    if (result.error) throw result.error;
  return {
    clubs: clubs.data ?? [],
    challenges: challenges.data ?? [],
    memberships: members.data ?? [],
    entries: entries.data ?? [],
  };
}

/** Existing RLS is the authority; never broaden membership reads to count people. */
export async function changeMembership(
  table: "club_members" | "challenge_entries",
  targetId: string,
  userId: string,
  joined: boolean,
) {
  const key = table === "club_members" ? "club_id" : "challenge_id";
  const query = backend().from(table);
  const result = joined
    ? await query.delete().eq(key, targetId).eq("user_id", userId)
    : await query.upsert(
        { [key]: targetId, user_id: userId },
        { ignoreDuplicates: true },
      );
  if (result.error) throw result.error;
}

export type SocialPost = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  sport: Sport;
  distance_m: number;
  moving_seconds: number;
  started_at: string;
  visibility: "public" | "followers" | "private";
  activity_reactions: { count: number }[];
  comments: { count: number }[];
  athlete: string;
  liked: boolean;
};
type Person = { id: string; name: string; username: string | null };
export async function loadSocialFeed(
  userId: string,
  scope: "community" | "following",
): Promise<SocialPost[]> {
  let followed: string[] = [];
  if (scope === "following") {
    const result = await backend()
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    if (result.error) throw result.error;
    followed = (result.data ?? []).map((row) => row.following_id);
    if (!followed.length) return [];
  }
  // Summaries/counts only. activity_points is intentionally never queried here.
  let query = backend()
    .from("activities")
    .select(
      "id,user_id,title,description,sport,distance_m,moving_seconds,started_at,visibility,activity_reactions(count),comments(count)",
    );
  if (scope === "following") query = query.in("user_id", followed);
  const result = await query
    .order("started_at", { ascending: false })
    .limit(30);
  if (result.error) throw result.error;
  const posts = (result.data ?? []) as Omit<SocialPost, "athlete" | "liked">[];
  if (!posts.length) return [];
  const [profiles, likes] = await Promise.all([
    backend()
      .from("profiles")
      .select("id,name,username")
      .in("id", [...new Set(posts.map((post) => post.user_id))]),
    backend()
      .from("activity_reactions")
      .select("activity_id")
      .eq("user_id", userId)
      .in(
        "activity_id",
        posts.map((post) => post.id),
      ),
  ]);
  if (profiles.error) throw profiles.error;
  if (likes.error) throw likes.error;
  const people = (profiles.data ?? []) as Person[];
  return posts.map((post) => ({
    ...post,
    athlete:
      people.find((p) => p.id === post.user_id)?.name ||
      people.find((p) => p.id === post.user_id)?.username ||
      "Athlete",
    liked: (likes.data ?? []).some((like) => like.activity_id === post.id),
  }));
}
export type SocialComment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  athlete: string;
};
export async function loadComments(
  activityId: string,
): Promise<SocialComment[]> {
  const result = await backend()
    .from("comments")
    .select("id,user_id,body,created_at")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (result.error) throw result.error;
  if (!result.data?.length) return [];
  const profiles = await backend()
    .from("profiles")
    .select("id,name,username")
    .in("id", [...new Set(result.data.map((row) => row.user_id))]);
  if (profiles.error) throw profiles.error;
  const people = (profiles.data ?? []) as Person[];
  return [...result.data].reverse().map((row) => ({
    ...row,
    athlete:
      people.find((p) => p.id === row.user_id)?.name ||
      people.find((p) => p.id === row.user_id)?.username ||
      "Athlete",
  })) as SocialComment[];
}
export async function setKudos(
  activityId: string,
  userId: string,
  liked: boolean,
) {
  const result = liked
    ? await backend()
        .from("activity_reactions")
        .delete()
        .eq("activity_id", activityId)
        .eq("user_id", userId)
    : await backend()
        .from("activity_reactions")
        .upsert(
          { activity_id: activityId, user_id: userId },
          { ignoreDuplicates: true },
        );
  if (result.error) throw result.error;
}
export async function addComment(
  activityId: string,
  userId: string,
  body: string,
) {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 500)
    throw new Error("Write a comment of 1–500 characters.");
  const result = await backend()
    .from("comments")
    .insert({ activity_id: activityId, user_id: userId, body: trimmed });
  if (result.error) throw result.error;
}

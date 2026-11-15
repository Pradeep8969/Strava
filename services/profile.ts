import { backend } from "./supabase";
import { profileChanges } from "../features/athlete/profile";
export async function loadAthleteProfile(userId: string) {
  const client = backend();
  let result = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    const repair = await client.rpc("ensure_athlete_profile");
    if (repair.error)
      throw new Error(
        "Your profile is missing. Ask the administrator to review and apply the athlete profile migration.",
      );
    result = await client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
  }
  if (result.error) throw result.error;
  if (!result.data || result.data.id !== userId)
    throw new Error(
      "The athlete profile does not match the signed-in account.",
    );
  return result.data;
}
export async function saveAthleteProfile(
  userId: string,
  original: Parameters<typeof profileChanges>[0],
  draft: Parameters<typeof profileChanges>[1],
) {
  const changes = profileChanges(original, draft);
  if (!Object.keys(changes).length) return;
  // Compare changed fields so a stale editor cannot overwrite another session's edits.
  let query = backend().from("profiles").update(changes).eq("id", userId);
  for (const key of Object.keys(changes)) {
    const value = original[key as keyof typeof original];
    query = value === null ? query.is(key, null) : query.eq(key, value);
  }
  const result = await query.select("id").maybeSingle();
  if (result.error) throw result.error;
  if (result.data?.id !== userId)
    throw new Error(
      "Your profile changed elsewhere. Close the editor, refresh, and try again.",
    );
}

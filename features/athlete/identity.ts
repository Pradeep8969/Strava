export function athleteIdentity(
  userId: string | undefined,
  profile: { id: string; name: string; username: string | null } | undefined,
  loading: boolean,
) {
  const own = userId && profile?.id === userId ? profile : undefined;
  const fullName = own?.name.trim() || own?.username?.trim() || "";
  const firstName = fullName.split(/\s+/u)[0] || "";
  return {
    fullName: fullName || (loading ? "" : userId ? "Athlete" : ""),
    firstName,
    greeting: firstName
      ? `Namaste, ${firstName}.`
      : userId || loading
        ? "Namaste."
        : "Namaste, athlete.",
  };
}

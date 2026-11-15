export function credentialsError(
  email: string,
  password: string,
  signup: boolean,
): string | null {
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    email.trim().length > 254
  )
    return "Enter a valid email address.";
  if (!password) return "Enter your password.";
  if (signup && password.length < 10) return "Use at least 10 characters.";
  if (password.length > 256) return "Keep your password within 256 characters.";
  return null;
}
export function callbackAddress(platform: string, origin?: string) {
  if (platform !== "web") return "stravakinda://auth/callback";
  const url = new URL(origin ?? "");
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error(
      "Use HTTPS for account redirects. HTTP is supported only on localhost.",
    );
  return `${url.origin}/auth/callback`;
}
export function callbackParameters(value: string) {
  const url = new URL(value);
  // PKCE only: never accept session tokens from an arbitrary incoming URL.
  if (url.hash.includes("access_token="))
    throw new Error(
      "This link uses an unsupported sign-in flow. Request a new email link.",
    );
  const error = url.searchParams.get("error");
  if (error)
    throw new Error(
      error === "access_denied"
        ? "Sign-in was cancelled. You can try again."
        : "The sign-in link could not be completed. Request a new link or try again.",
    );
  const code = url.searchParams.get("code");
  if (!code || code.length > 4096)
    throw new Error(
      "This link is missing or expired. Request a new link on this device.",
    );
  return code;
}

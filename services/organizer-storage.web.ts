// Never persist browser workout fixtures or authentication tokens here.
export async function readOrganizerValue<T>(key: string): Promise<T | null> {
  const value = window.localStorage.getItem(key);
  return value === null ? null : (JSON.parse(value) as T);
}
export async function writeOrganizerValue(
  key: string,
  value: unknown,
): Promise<void> {
  window.localStorage.setItem(key, JSON.stringify(value));
}

import { backend } from "./supabase";
import { pushAdapter } from "./push-platform";
export const pushAvailable = !!pushAdapter;
export async function registerPush(owner: string, ask = false) {
  if (!pushAdapter)
    throw new Error(
      "Push needs the Expo Notifications adapter and a configured development build. In-app notifications work independently.",
    );
  if (!ask && !(await pushAdapter.consent(owner))) return;
  if (!(await pushAdapter.permission(ask)))
    throw new Error(
      "Push permission was not granted. Your account and in-app inbox still work.",
    );
  if (ask) await pushAdapter.consent(owner, true);
  const installation = await pushAdapter.installation(),
    device = await pushAdapter.token();
  const result = await backend().rpc("register_push_device", {
    installation,
    token: device.token,
    device_platform: device.platform,
    enable_consent: ask,
  });
  if (result.error)
    throw new Error(
      "Push registration could not finish. It will retry while you are signed in.",
    );
}
export async function disablePush(owner: string) {
  if (!pushAdapter) return;
  await pushAdapter.consent(owner, false);
  const result = await backend().rpc("disable_push_device", {
    installation: await pushAdapter.installation(),
  });
  if (result.error)
    throw new Error(
      "Server push preference could not be updated. Retry when connected.",
    );
}
export function listenPush(
  owner: string,
  onTap: () => void,
  onReceive: () => void,
) {
  return pushAdapter?.listen(owner, onTap, onReceive) ?? (() => {});
}
export async function unregisterPushBeforeSignOut() {
  if (!pushAdapter) return;
  const result = await backend().rpc("disable_push_device", {
    installation: await pushAdapter.installation(),
  });
  if (result.error) throw result.error;
}

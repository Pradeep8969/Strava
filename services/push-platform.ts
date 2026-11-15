export type PushAdapter = {
  permission: (ask: boolean) => Promise<boolean>;
  token: () => Promise<{ token: string; platform: "ios" | "android" }>;
  installation: () => Promise<string>;
  consent: (owner: string, value?: boolean) => Promise<boolean>;
  listen: (
    owner: string,
    onTap: () => void,
    onReceive: () => void,
  ) => () => void;
};
// Activate the native Expo adapter with scripts/activate-expo-push.mjs after SDK installation.
export const pushAdapter: PushAdapter | null = null;

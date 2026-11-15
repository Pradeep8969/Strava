import {
  readOrganizerValue,
  writeOrganizerValue,
} from "../../services/organizer-storage";
import {
  emptyWorkspace,
  parseWorkspace,
  workspaceKey,
  type Workspace,
} from "./workspace";

let pending: Promise<unknown> = Promise.resolve();
// Destructive recovery is only called after an explicit in-app confirmation.
export function resetWorkspace(ownerId?: string) {
  const next = pending.then(async () => {
    const value = emptyWorkspace();
    await writeOrganizerValue(workspaceKey(ownerId), value);
    return value;
  });
  pending = next.catch(() => undefined);
  return next;
}
export async function loadWorkspace(ownerId?: string) {
  return parseWorkspace(
    await readOrganizerValue<unknown>(workspaceKey(ownerId)),
  );
}
export function updateWorkspace(
  ownerId: string | undefined,
  change: (current: Workspace) => Workspace,
) {
  const next = pending.then(async () => {
    const current = await loadWorkspace(ownerId);
    const value = parseWorkspace(change(current));
    await writeOrganizerValue(workspaceKey(ownerId), value);
    return value;
  });
  pending = next.catch(() => undefined);
  return next;
}

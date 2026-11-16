import type { Workout } from "../types/activity";
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "Browser storage is unavailable. Enable site storage to save recordings.",
        ),
      );
      return;
    }
    const request = indexedDB.open("stravakinda", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("workouts", { keyPath: "id" });
      request.result.createObjectStore("kv");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Could not open browser storage. Check site storage permissions.",
        ),
      );
    request.onblocked = () =>
      reject(
        new Error(
          "Browser storage is blocked by another tab. Close other StravaKinda tabs and retry.",
        ),
      );
  }).catch((error) => {
    connection = undefined;
    throw error;
  }));
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () =>
      reject(
        new Error(
          "Recording could not be saved in browser storage. Check available space and site permissions.",
        ),
      );
    tx.onerror = () =>
      reject(
        new Error(
          "Browser storage failed. Your recording may not be saved; check available space.",
        ),
      );
  });
}
let pending: Promise<unknown> = Promise.resolve();
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = pending.then(fn);
  pending = next.catch(() => undefined);
  return next;
}
export async function readWorkouts(): Promise<Workout[]> {
  return (
    await transaction<Workout[]>("workouts", "readonly", (s) => s.getAll())
  ).sort((a, b) => b.startedAt - a.startedAt);
}
export async function writeWorkout(workout: Workout) {
  await transaction("workouts", "readwrite", (s) => s.put(workout));
}
export async function deleteWorkout(id: string) {
  await serial(() => transaction("workouts", "readwrite", (s) => s.delete(id)));
}
export async function getValue<T>(key: string): Promise<T | null> {
  return (
    (await transaction<T | undefined>("kv", "readonly", (s) => s.get(key))) ??
    null
  );
}
export async function setValue(key: string, value: unknown) {
  await transaction("kv", "readwrite", (s) => s.put(value, key));
}
/** The callback MUST be synchronous: get and put run in one live IDB transaction.
 * Overlapping readwrite transactions on kv serialize across tabs/connections. */
export async function updateValue<T>(
  key: string,
  update: (value: T | null) => T,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const unavailable = () =>
      new Error(
        "Atomic route storage failed. The route was not saved. Check storage permissions and space, then retry.",
      );
    let tx: IDBTransaction;
    try {
      tx = db.transaction("kv", "readwrite");
    } catch {
      reject(unavailable());
      return;
    }
    let next: T, failure: unknown;
    tx.oncomplete = () => resolve(next);
    tx.onabort = () => reject(failure ?? unavailable());
    tx.onerror = () => {
      /* The transaction abort handler reports failure, never success. */
    };
    try {
      const store = tx.objectStore("kv"),
        request = store.get(key);
      request.onsuccess = () => {
        try {
          next = update(request.result ?? null);
          if (next && typeof (next as { then?: unknown }).then === "function")
            throw new Error(
              "Atomic storage updates must be synchronous. The route was not saved.",
            );
        } catch (error) {
          failure = error;
          tx.abort();
          return;
        }
        try {
          store.put(next, key);
        } catch {
          failure = unavailable();
          tx.abort();
        }
      };
    } catch {
      failure = unavailable();
      tx.abort();
    }
  });
}
export async function pendingDeletionIds(): Promise<string[]> {
  const keys = await transaction<IDBValidKey[]>("kv", "readonly", (s) =>
    s.getAllKeys(),
  );
  const pending = await Promise.all(
    keys
      .filter((key) => typeof key === "string" && key.startsWith("deleted:"))
      .map(async (key) =>
        (await getValue(key as string)) === true ? String(key).slice(8) : null,
      ),
  );
  return pending.filter((id): id is string => id !== null);
}

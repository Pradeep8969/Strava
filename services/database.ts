import * as SQLite from "expo-sqlite";
import type { Workout } from "../types/activity";
let connection: Promise<SQLite.SQLiteDatabase> | undefined;
export function database() {
  return (connection ??= (async () => {
    const db = await SQLite.openDatabaseAsync("stravakinda.db");
    await db.execAsync(
      "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS workouts (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, body TEXT NOT NULL);",
    );
    return db;
  })());
}
let pending: Promise<unknown> = Promise.resolve();
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = pending.then(fn);
  pending = next.catch(() => undefined);
  return next;
}
export async function readWorkouts(): Promise<Workout[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ body: string }>(
    "SELECT body FROM workouts",
  );
  return rows
    .map((r) => JSON.parse(r.body) as Workout)
    .sort((a, b) => b.startedAt - a.startedAt);
}
export async function writeWorkout(w: Workout) {
  await (
    await database()
  ).runAsync(
    "INSERT OR REPLACE INTO workouts(id, body) VALUES (?, ?)",
    w.id,
    JSON.stringify(w),
  );
}
export async function deleteWorkout(id: string) {
  await serial(async () => {
    await (await database()).runAsync("DELETE FROM workouts WHERE id = ?", id);
  });
}
export async function getValue<T>(key: string): Promise<T | null> {
  const row = await (
    await database()
  ).getFirstAsync<{ body: string }>("SELECT body FROM kv WHERE key = ?", key);
  return row ? (JSON.parse(row.body) as T) : null;
}
export async function setValue(key: string, value: unknown) {
  await (
    await database()
  ).runAsync(
    "INSERT OR REPLACE INTO kv(key, body) VALUES (?, ?)",
    key,
    JSON.stringify(value),
  );
}
/** A dedicated SQLite transaction connection prevents unrelated recorder queries
 * joining the transaction. Acquire the write reservation before reading kv. */
export async function updateValue<T>(
  key: string,
  update: (value: T | null) => T,
): Promise<T> {
  return serial(async () => {
    let next!: T, callbackError: unknown;
    try {
      await (
        await database()
      ).withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync("UPDATE kv SET body = body WHERE key = ?", key);
        const row = await tx.getFirstAsync<{ body: string }>(
          "SELECT body FROM kv WHERE key = ?",
          key,
        );
        try {
          next = update(row ? (JSON.parse(row.body) as T) : null);
          if (next && typeof (next as { then?: unknown }).then === "function")
            throw new Error(
              "Atomic storage updates must be synchronous. The route was not saved.",
            );
        } catch (error) {
          callbackError = error;
          throw error;
        }
        await tx.runAsync(
          "INSERT OR REPLACE INTO kv(key, body) VALUES (?, ?)",
          key,
          JSON.stringify(next),
        );
      });
      return next;
    } catch {
      throw (
        callbackError ??
        new Error(
          "Atomic route storage failed. The route was not saved. Check storage permissions and space, then retry.",
        )
      );
    }
  });
}
export async function pendingDeletionIds(): Promise<string[]> {
  const rows = await (
    await database()
  ).getAllAsync<{ key: string }>(
    "SELECT key FROM kv WHERE key LIKE ? AND body = ?",
    "deleted:%",
    "true",
  );
  return rows.map((row) => row.key.slice("deleted:".length));
}

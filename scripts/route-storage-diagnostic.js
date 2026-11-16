/* Paste into DevTools on EACH original StravaKinda origin. Read-only by default.
 * No network, auth reads, coordinates in reports, storage writes, or imports.
 */
(async () => {
  const records = [];
  const report = { origin: location.origin, locations: [], errors: [] };
  const routeKey = (key) =>
    /route|plan/i.test(String(key)) && !/auth|token|session/i.test(String(key));
  const summarize = (location, value) => {
    const array = Array.isArray(value)
      ? value
      : value && typeof value === "object" && typeof value.title === "string"
        ? [value]
        : null;
    report.locations.push({
      location,
      count: array?.length ?? null,
      names:
        array?.map((r) =>
          typeof r?.title === "string" ? r.title : "Unreadable route name",
        ) ?? [],
      format: array ? "array" : "unrecognized; preserved",
    });
    records.push({ location, value });
  };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!routeKey(key)) continue;
      const value = localStorage.getItem(key);
      try {
        summarize(`localStorage:${key}`, JSON.parse(value));
      } catch {
        records.push({
          location: `localStorage:${key}`,
          value,
          encoding: "raw-json-text",
        });
        report.errors.push(
          `Malformed route JSON at localStorage:${key}; unchanged`,
        );
      }
    }
  } catch {
    report.errors.push("localStorage access denied");
  }
  try {
    if (!indexedDB.databases)
      throw new Error("Database enumeration unsupported");
    const databases = await indexedDB.databases();
    for (const { name } of databases) {
      if (name !== "stravakinda" && !routeKey(name)) continue;
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onupgradeneeded = () => {
          request.transaction.abort();
          reject(new Error("Database absent; creation aborted"));
        };
        request.onerror = () => reject(new Error("Database unavailable"));
        request.onblocked = () => reject(new Error("Database blocked"));
        request.onsuccess = () => resolve(request.result);
      });
      try {
        for (const store of db.objectStoreNames) {
          if (store !== "kv" && !routeKey(store)) continue;
          await new Promise((resolve, reject) => {
            const tx = db.transaction(store, "readonly");
            const request = tx.objectStore(store).openCursor();
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor) return;
              if (routeKey(store) || routeKey(cursor.key))
                summarize(
                  `IndexedDB:${name}/${store}/${String(cursor.key)}`,
                  cursor.value,
                );
              cursor.continue();
            };
            tx.oncomplete = resolve;
            tx.onabort = tx.onerror = () => reject(new Error("Read failed"));
          });
        }
      } finally {
        db.close();
      }
    }
  } catch {
    report.errors.push(
      "IndexedDB inventory unavailable; inspect browser Application > IndexedDB manually. No database was created.",
    );
  }
  // Explicit export contains private geometry. Never paste it into chat or logs.
  window.stravaRouteRecovery = {
    report,
    exportPrivateBackup() {
      const blob = new Blob(
        [
          JSON.stringify({
            format: "stravakinda-route-backup-v1",
            origin: location.origin,
            exportedAt: new Date().toISOString(),
            records,
          }),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stravakinda-private-routes-${Date.now()}-${crypto.randomUUID()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
  console.info("StravaKinda route storage report (no coordinates)", report);
  return report;
})();

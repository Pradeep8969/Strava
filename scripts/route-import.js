/* Manual browser transfer tool. Loading this script never writes app storage.
 * Only explicit commit("IMPORT ADDITIONS") may append validated routes.
 */
(() => {
  const locationKey = "IndexedDB:stravakinda/kv/routes";
  let source,
    baseline,
    preview,
    verified = false;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const signature = (r) =>
    JSON.stringify([r.title, r.points.map((p) => [p.longitude, p.latitude])]);
  function validate(value) {
    if (!Array.isArray(value))
      throw new Error("Route list is malformed. Nothing imported.");
    const ids = new Set();
    for (const r of value) {
      if (
        !r ||
        typeof r.id !== "string" ||
        !r.id.trim() ||
        ids.has(r.id) ||
        typeof r.title !== "string" ||
        !r.title.trim() ||
        !Array.isArray(r.points) ||
        r.points.length < 2 ||
        (r.planningMode != null && r.planningMode !== "straight-line") ||
        (r.kind != null && r.kind !== "plan") ||
        r.points.some(
          (p) =>
            !p ||
            !Number.isFinite(p.latitude) ||
            !Number.isFinite(p.longitude) ||
            Math.abs(p.latitude) > 90 ||
            Math.abs(p.longitude) > 180,
        ) ||
        (r.distanceMeters != null &&
          (!Number.isFinite(r.distanceMeters) || r.distanceMeters < 0)) ||
        (r.geometry != null &&
          (r.geometry.type !== "LineString" ||
            !same(
              r.geometry.coordinates,
              r.points.map((p) => [p.longitude, p.latitude]),
            )))
      )
        throw new Error(
          "A route is invalid, duplicated, or unsupported. Nothing imported.",
        );
      ids.add(r.id);
    }
    return value;
  }
  function bundle(text) {
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error("Invalid backup JSON.");
    }
    if (
      value?.format !== "stravakinda-route-backup-v1" ||
      typeof value.origin !== "string" ||
      !Array.isArray(value.records)
    )
      throw new Error("Unsupported backup format.");
    const matches = value.records.filter((r) => r?.location === locationKey);
    if (matches.length !== 1 || matches[0].encoding)
      throw new Error(
        "Backup must contain exactly one original IndexedDB routes record. Other legacy sources require separate review.",
      );
    validate(matches[0].value);
    return { origin: value.origin, routes: matches[0].value };
  }
  const hash = async (bytes) =>
    Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  function pick(accept, label) {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.setAttribute("aria-label", label);
      input.onchange = () =>
        input.files[0]
          ? resolve(input.files[0])
          : reject(new Error("No file selected."));
      input.oncancel = () => reject(new Error("File selection cancelled."));
      input.click();
    });
  }
  async function readVerified() {
    const file = await pick(".json", "Select verified private backup JSON");
    const checksum = await pick(".sha256", "Select matching SHA-256 sidecar");
    const bytes = await file.arrayBuffer();
    if ((await hash(bytes)) !== (await checksum.text()).trim().toLowerCase())
      throw new Error("Backup checksum mismatch. Nothing imported.");
    return bundle(new TextDecoder().decode(bytes));
  }
  async function database() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("stravakinda", 1);
      request.onupgradeneeded = () => {
        request.transaction.abort();
        reject(
          new Error(
            "Open Route Studio first. No database was created by this tool.",
          ),
        );
      };
      request.onerror = request.onblocked = () =>
        reject(new Error("Storage unavailable or blocked. Nothing imported."));
      request.onsuccess = () => {
        if (!request.result.objectStoreNames.contains("kv")) {
          request.result.close();
          reject(new Error("Unsupported storage layout."));
        } else resolve(request.result);
      };
    });
  }
  async function read() {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("kv", "readonly");
        const request = tx.objectStore("kv").get("routes");
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = tx.onerror = () =>
          reject(new Error("Could not read destination routes."));
      });
    } finally {
      db.close();
    }
  }
  function plan(current, incoming) {
    const existing = validate(current === undefined ? [] : current);
    validate(incoming);
    const ids = new Map(existing.map((r) => [r.id, r]));
    const signatures = new Set(existing.map(signature));
    const additions = [],
      conflicts = [];
    let duplicates = 0;
    for (const route of incoming) {
      if (ids.has(route.id)) {
        if (signature(ids.get(route.id)) !== signature(route))
          conflicts.push(route.title);
        else duplicates++;
      } else if (signatures.has(signature(route))) duplicates++;
      else {
        additions.push(route);
        ids.set(route.id, route);
        signatures.add(signature(route));
      }
    }
    return {
      additions,
      report: {
        origin: location.origin,
        existing: existing.length,
        incoming: incoming.length,
        additions: additions.length,
        duplicates,
        conflicts,
        names: additions.map((r) => r.title),
      },
    };
  }
  function download(value) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `stravakinda-private-destination-${Date.now()}-${crypto.randomUUID()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.stravaRouteImport = {
    async chooseSource() {
      source = undefined;
      preview = undefined;
      verified = false;
      source = await readVerified();
      return { sourceOrigin: source.origin, count: source.routes.length };
    },
    async preview() {
      verified = false;
      preview = undefined;
      if (!source)
        throw new Error("Choose and verify the source backup first.");
      baseline = await read();
      preview = plan(baseline, source.routes);
      return preview.report;
    },
    exportDestinationBackup() {
      if (!preview) throw new Error("Preview first.");
      download({
        format: "stravakinda-route-backup-v1",
        origin: location.origin,
        exportedAt: new Date().toISOString(),
        records: [{ location: locationKey, value: baseline ?? [] }],
        destinationKeyAbsent: baseline === undefined,
      });
      return "Downloaded private destination snapshot. Run route-backup.mjs, then verifyDestinationBackup().";
    },
    async verifyDestinationBackup() {
      verified = false;
      if (!preview) throw new Error("Preview first.");
      const backup = await readVerified();
      if (
        backup.origin !== location.origin ||
        !same(backup.routes, baseline ?? [])
      )
        throw new Error(
          "Backup is not this destination snapshot. Nothing imported.",
        );
      verified = true;
      return "Destination backup verified. No import performed.";
    },
    async commit(confirmation) {
      if (
        confirmation !== "IMPORT ADDITIONS" ||
        !verified ||
        !preview ||
        !source
      )
        throw new Error(
          "Explicit confirmation and verified source/destination backups are required.",
        );
      verified = false;
      if (preview.report.conflicts.length)
        throw new Error("Conflicting route IDs. Nothing imported.");
      if (!navigator.locks)
        throw new Error("Web Locks unavailable. Nothing imported.");
      const expected = baseline,
        incoming = source.routes;
      return navigator.locks.request("stravakinda:planned-routes", async () => {
        const db = await database();
        try {
          return await new Promise((resolve, reject) => {
            const tx = db.transaction("kv", "readwrite");
            const store = tx.objectStore("kv");
            const request = store.get("routes");
            let failure =
              "Storage commit failed; the transaction was rolled back. Nothing imported.";
            let result;
            request.onsuccess = () => {
              try {
                if (!same(request.result, expected))
                  throw new Error(
                    "Destination changed after preview. Preview and back up again; nothing imported.",
                  );
                result = plan(request.result, incoming);
                if (result.report.conflicts.length)
                  throw new Error("Conflicting route IDs. Nothing imported.");
                if (result.additions.length)
                  store.put(
                    [...(request.result ?? []), ...result.additions],
                    "routes",
                  );
              } catch (error) {
                failure = error.message;
                tx.abort();
              }
            };
            tx.oncomplete = () => {
              preview = undefined;
              resolve(result.report);
            };
            tx.onabort = () => reject(new Error(failure));
            tx.onerror = () => {}; // Abort handler reports failure; never suppress abort.
          });
        } finally {
          db.close();
        }
      });
    },
  };
  return "Route import tool ready. Nothing imported. Use chooseSource(), then preview().";
})();

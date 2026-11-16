import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Asset = {
  onload?: () => void;
  onerror?: () => void;
  remove: ReturnType<typeof vi.fn>;
};
let assets: Asset[];
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  assets = [];
  vi.stubGlobal("document", {
    createElement: () => ({ remove: vi.fn() }),
    head: { append: (...items: Asset[]) => assets.push(...items) },
  });
  vi.stubGlobal("window", { maplibregl: { Map: class {} } });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("loads the pinned library once and waits for both CSS and script", async () => {
  const { loadMapLibre } = await import("../features/discovery/maplibre.web");
  const pending = loadMapLibre();
  expect(loadMapLibre()).toBe(pending);
  expect(assets).toHaveLength(2);
  let resolved = false;
  void pending.then(() => {
    resolved = true;
  });
  assets[1].onload!();
  await Promise.resolve();
  expect(resolved).toBe(false);
  assets[0].onload!();
  await expect(pending).resolves.toHaveProperty("Map");
});
it("cleans failed assets and allows a retry", async () => {
  const { loadMapLibre } = await import("../features/discovery/maplibre.web");
  const pending = loadMapLibre();
  const rejected = expect(pending).rejects.toThrow("unavailable");
  assets[1].onerror!();
  await rejected;
  expect(assets.every((asset) => asset.remove.mock.calls.length === 1)).toBe(
    true,
  );
  const retried = loadMapLibre();
  expect(retried).not.toBe(pending);
  assets[2].onload!();
  assets[3].onload!();
  await expect(retried).resolves.toHaveProperty("Map");
});
it("times out instead of leaving initialization pending forever", async () => {
  const { loadMapLibre } = await import("../features/discovery/maplibre.web");
  const pending = loadMapLibre();
  const rejected = expect(pending).rejects.toThrow("unavailable");
  await vi.advanceTimersByTimeAsync(20000);
  await rejected;
});

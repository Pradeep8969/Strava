// Isolated browser review. Test coordinates/data never enter the application bundle.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const phase = process.argv[2] ?? "before";
const folder = `artifacts/phase1b5/${phase}`;
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
const results = [];
for (const width of [390, 768, 1440]) {
  const context = await browser.newContext({
    viewport: { width, height: 1080 },
  });
  await context.addInitScript(() => {
    const metrics = {
      maps: 0,
      removed: 0,
      markers: 0,
      markerRemovals: 0,
      sourceAdds: 0,
      layerAdds: 0,
      writes: 0,
      styles: 0,
      cameras: 0,
      resizes: 0,
      readyMs: null,
      styleEvents: [],
      longTasks: [],
    };
    window.__review = metrics;
    window.__reviewMaps = [];
    try {
      new PerformanceObserver((list) =>
        metrics.longTasks.push(
          ...list.getEntries().map((entry) => Math.round(entry.duration)),
        ),
      ).observe({ type: "longtask", buffered: true });
    } catch {
      /* Not supported by every browser. */
    }
    let library;
    Object.defineProperty(window, "maplibregl", {
      configurable: true,
      get: () => library,
      set: (lib) => {
        const Base = lib.Map,
          Marker = lib.Marker;
        const wrappedSources = new WeakSet();
        library = {
          ...lib,
          Map: class extends Base {
            constructor(options) {
              super(options);
              metrics.maps++;
              window.__reviewMaps.push(this);
              this.on("load", () => {
                metrics.readyMs ??= Math.round(performance.now());
              });
              for (const event of ["style.load", "styledata", "idle"])
                this.on(event, () => {
                  if (metrics.styleEvents.length < 100)
                    metrics.styleEvents.push(event);
                });
            }
            remove(...args) {
              metrics.removed++;
              return super.remove(...args);
            }
            resize(...args) {
              metrics.resizes++;
              return super.resize(...args);
            }
            setStyle(...args) {
              metrics.styles++;
              return super.setStyle(...args);
            }
            flyTo(...args) {
              metrics.cameras++;
              return super.flyTo(...args);
            }
            fitBounds(...args) {
              metrics.cameras++;
              return super.fitBounds(...args);
            }
            addSource(...args) {
              if (args[0] === "routes") metrics.sourceAdds++;
              return super.addSource(...args);
            }
            addLayer(...args) {
              if (args[0].id === "routes") metrics.layerAdds++;
              return super.addLayer(...args);
            }
            getSource(...args) {
              const source = super.getSource(...args);
              if (
                args[0] === "routes" &&
                source?.setData &&
                !wrappedSources.has(source)
              ) {
                wrappedSources.add(source);
                const setData = source.setData.bind(source);
                source.setData = (...values) => {
                  metrics.writes++;
                  return setData(...values);
                };
              }
              return source;
            }
          },
          Marker: class extends Marker {
            constructor(...args) {
              super(...args);
              metrics.markers++;
            }
            remove(...args) {
              metrics.markerRemovals++;
              return super.remove(...args);
            }
          },
        };
      },
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok) =>
          queueMicrotask(() =>
            ok({
              timestamp: Date.now(),
              coords: {
                latitude: 27.7,
                longitude: 85.3,
                accuracy: 80,
                altitude: null,
                altitudeAccuracy: null,
                speed: null,
                heading: null,
              },
            }),
          ),
        watchPosition: () => 1,
        clearWatch: () => {},
      },
    });
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/activities");
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const start = Date.now() - 600000;
        const points = Array.from({ length: 61 }, (_, i) => ({
          latitude: 27.71 + i * 0.0002,
          longitude: 85.32 + Math.sin(i / 10) * 0.0004,
          timestamp: start + i * 10000,
          accuracy: 3,
          altitude: null,
          altitudeAccuracy: null,
          segment: 0,
        }));
        const workout = {
          id: "polish-fixture",
          title: "Review activity",
          description: "Isolated browser fixture",
          sport: "running",
          visibility: "private",
          startedAt: start,
          endedAt: start + 600000,
          state: "finished",
          activeMs: 600000,
          resumedAt: null,
          segment: 0,
          points,
          rejected: 0,
        };
        const open = indexedDB.open("stravakinda", 1);
        open.onupgradeneeded = () => {
          open.result.createObjectStore("workouts", { keyPath: "id" });
          open.result.createObjectStore("kv");
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["workouts", "kv"], "readwrite");
          tx.objectStore("workouts").put(workout);
          tx.objectStore("kv").put(
            [
              {
                id: "review-plan",
                title: "Valley waypoint plan",
                points: points.slice(0, 3),
              },
            ],
            "routes",
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  for (const [screen, path] of [
    ["explore", "/explore"],
    ["record", "/record"],
    ["studio", "/routes"],
    ["activity", "/activity/polish-fixture"],
  ]) {
    await page.goto(`http://127.0.0.1:4173${path}`);
    if (screen === "record" && width < 1100)
      await page.getByRole("button", { name: "Show map", exact: true }).click();
    await page.waitForFunction(
      () =>
        window.__review?.readyMs !== null && window.__reviewMaps?.length > 0,
      { timeout: 30000 },
    );
    if (screen === "explore" || screen === "activity")
      await page.waitForFunction(
        () => {
          const map = window.__reviewMaps.at(-1);
          return (
            map.getLayer("routes") &&
            map.queryRenderedFeatures({ layers: ["routes"] }).length > 0
          );
        },
        { timeout: 30000 },
      );
    if (screen === "explore")
      await page
        .getByRole("button", {
          name: "Preview saved route Valley waypoint plan",
          exact: true,
        })
        .click();
    if (screen === "explore")
      await page
        .getByRole("heading", { name: "Discover routes", exact: true })
        .scrollIntoViewIfNeeded();
    if (screen === "explore" || screen === "activity")
      await page.waitForFunction(
        () => {
          const map = window.__reviewMaps.at(-1);
          return (
            map.loaded() && !map.isMoving() && map.isSourceLoaded("routes")
          );
        },
        undefined,
        { timeout: 30000 },
      );
    await page.screenshot({
      path: `${folder}/${screen}-${width}.png`,
      fullPage: true,
    });
    if (screen === "studio") {
      await page.evaluate(() => {
        const map = window.__reviewMaps.at(-1);
        [85.3, 85.31, 85.32].forEach((lng) =>
          map.fire("click", {
            lngLat: { lat: 27.7, lng },
            originalEvent: { target: map.getCanvas() },
          }),
        );
      });
      await page.getByLabel("Waypoint 3", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Fit map to route", exact: true })
        .click();
      await page.screenshot({
        path: `${folder}/studio-waypoints-${width}.png`,
        fullPage: true,
      });
      for (let i = 3; i < 20; i++) {
        await page.evaluate((i) => {
          const map = window.__reviewMaps.at(-1);
          map.fire("click", {
            lngLat: { lat: 27.7, lng: 85.3 + i * 0.001 },
            originalEvent: { target: map.getCanvas() },
          });
        }, i);
        await page.getByLabel(`Waypoint ${i + 1}`, { exact: true }).waitFor();
      }
    }
    const sample = await page.evaluate(() => ({
      ...window.__review,
      renderedRouteFeatures: window.__reviewMaps.at(-1).getLayer("routes")
        ? window.__reviewMaps
            .at(-1)
            .queryRenderedFeatures({ layers: ["routes"] }).length
        : 0,
      overflow: document.documentElement.scrollWidth > innerWidth,
      status: [...document.querySelectorAll('[role="status"]')].map(
        (node) => node.textContent,
      ),
      resources: performance
        .getEntriesByType("resource")
        .filter(
          (resource) =>
            resource.name.includes("style.json") ||
            resource.name.includes("maplibre-gl"),
        )
        .map((resource) => ({
          type: resource.name.includes("style.json") ? "style" : "library",
          ms: Math.round(resource.duration),
        })),
    }));
    if (screen === "studio") {
      const options = page.getByRole("button", {
        name: "Map options",
        exact: true,
      });
      if (await options.isVisible().catch(() => false)) await options.click();
      const outdoor = page.getByRole("button", {
        name: "Outdoor map",
        exact: true,
      });
      if (await outdoor.isVisible()) {
        await outdoor.click();
        await page.waitForTimeout(2500);
        sample.afterStyle = await page.evaluate(() => ({
          loaded: window.__reviewMaps.at(-1).isStyleLoaded(),
          status: [...document.querySelectorAll('[role="status"]')].map(
            (node) => node.textContent,
          ),
          events: window.__review.styleEvents,
          styles: window.__review.styles,
        }));
      }
    }
    results.push({ screen, width, ...sample });
    process.stdout.write(
      `${phase} ${screen} ${width}: ${sample.readyMs} ms, ${sample.maps} map(s), ${sample.markers} marker constructions\n`,
    );
  }
  await context.close();
}
await writeFile(
  `${folder}/measurements.json`,
  JSON.stringify(results, null, 2),
);
await browser.close();

import type { BrowserMap, BrowserMarker, MapLibre } from "./maplibre.web";

export type MapMarker = {
  id: string;
  longitude: number;
  latitude: number;
  label: string;
  text: string;
  kind: "waypoint" | "route" | "place" | "accepted";
  selected?: boolean;
  onClick?: () => void;
};
export type MarkerCache = Map<
  string,
  {
    marker: BrowserMarker;
    element: HTMLElement;
    longitude: number;
    latitude: number;
  }
>;

/** Reconcile DOM markers instead of removing N markers on every waypoint edit. */
export function syncMapMarkers(
  library: MapLibre,
  map: BrowserMap,
  cache: MarkerCache,
  items: MapMarker[],
) {
  const retained = new Set(items.map((item) => item.id));
  for (const [id, entry] of cache) {
    if (!retained.has(id)) {
      entry.marker.remove();
      cache.delete(id);
    }
  }
  for (const item of items) {
    let entry = cache.get(item.id);
    if (!entry) {
      const element = document.createElement(item.onClick ? "button" : "span");
      element.style.cssText =
        item.kind === "accepted"
          ? "display:block;width:18px;height:18px;border-radius:50%;background:#167F83;border:3px solid white;box-shadow:0 0 0 5px #167F8338"
          : item.kind === "waypoint"
            ? "background:#ED633E;color:white;border:2px solid white;border-radius:50%;width:32px;height:32px;display:grid;place-items:center;font-weight:700;pointer-events:none"
            : "background:#fff;color:#17695D;border:2px solid #17695D;border-radius:12px;min-width:36px;height:36px;cursor:pointer;font-size:16px";
      if (!item.onClick) element.setAttribute("role", "img");
      const marker = new library.Marker({ element })
        .setLngLat([item.longitude, item.latitude])
        .addTo(map);
      entry = {
        marker,
        element,
        longitude: item.longitude,
        latitude: item.latitude,
      };
      cache.set(item.id, entry);
    } else if (
      entry.longitude !== item.longitude ||
      entry.latitude !== item.latitude
    ) {
      entry.marker.setLngLat([item.longitude, item.latitude]);
      entry.longitude = item.longitude;
      entry.latitude = item.latitude;
    }
    entry.element.textContent = item.text;
    entry.element.title = item.label;
    entry.element.setAttribute("aria-label", item.label);
    entry.element.onclick = item.onClick ?? null;
    if (item.kind === "route") {
      entry.element.setAttribute("aria-pressed", String(!!item.selected));
      entry.element.style.background = item.selected ? "#167F83" : "#fff";
      entry.element.style.color = item.selected ? "#fff" : "#17695D";
    }
  }
}
export function clearMapMarkers(cache: MarkerCache) {
  for (const entry of cache.values()) entry.marker.remove();
  cache.clear();
}

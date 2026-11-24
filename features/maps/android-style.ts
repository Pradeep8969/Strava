import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { mapTilerUserAgent } from "./native-configuration";

export function prepareAndroidStyle(
  style: StyleSpecification,
): StyleSpecification {
  if (style?.version !== 8 || !style.sources || !Array.isArray(style.layers))
    throw new Error("MapTiler returned an invalid style.");

  const attribution = style.sources.maptiler_attribution;
  if (
    attribution?.type !== "vector" ||
    attribution.url ||
    attribution.tiles?.length
  )
    return style;

  // Streets v2 ships this attribution-only entry as a tileless vector source.
  const planet = style.sources.maptiler_planet;
  if (
    planet?.type !== "vector" ||
    (!planet.url && !planet.tiles?.length) ||
    style.layers.some(
      (layer) => "source" in layer && layer.source === "maptiler_attribution",
    )
  )
    throw new Error("MapTiler returned an invalid attribution source.");

  const sources = { ...style.sources };
  delete sources.maptiler_attribution;
  sources.maptiler_planet = {
    ...planet,
    attribution: [
      ...new Set([planet.attribution, attribution.attribution].filter(Boolean)),
    ].join(" | "),
  };
  return { ...style, sources };
}

let cached: { url: string; style: Promise<string> } | undefined;

export function loadAndroidStyle(url: string): Promise<string> {
  if (cached?.url === url) return cached.style;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const style = (async () => {
    const response = await fetch(url, {
      headers: { "User-Agent": mapTilerUserAgent },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("MapTiler style request failed.");
    // Serialize once so GPS-driven renders do not stringify the style again.
    return JSON.stringify(prepareAndroidStyle(await response.json()));
  })()
    .catch(() => {
      if (cached?.style === style) cached = undefined;
      // Network errors can include the request URL, which contains the key.
      throw new Error("Could not load the Android MapTiler style.");
    })
    .finally(() => clearTimeout(timeout));
  cached = { url, style };
  return style;
}

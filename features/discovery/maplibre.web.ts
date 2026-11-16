/** Pinned browser-only MapLibre loader. No native imports or network activity until mounted. */
export interface BrowserMap {
  on(
    event: "movestart",
    callback: (event: { originalEvent?: unknown }) => void,
  ): void;
  on(
    event: "click",
    callback: (event: { lngLat: { lat: number; lng: number } }) => void,
  ): void;
  on(event: string, callback: () => void): void;
  remove(): void;
  resize(): void;
  flyTo(options: object): void;
  fitBounds(bounds: number[][], options: object): void;
  setStyle(
    style: string,
    options?: {
      transformStyle?: (previous: unknown, next: unknown) => unknown;
    },
  ): void;
  isStyleLoaded(): boolean;
  getLayer(id: string): unknown;
  setPaintProperty(id: string, name: string, value: unknown): void;
  stop?(): void;
  addControl(control: unknown, position?: string): void;
  getCanvas(): HTMLCanvasElement;
  getSource(id: string): { setData(data: unknown): void } | undefined;
  addSource(id: string, source: object): void;
  addLayer(layer: object): void;
}
export interface BrowserMarker {
  setLngLat(point: number[]): BrowserMarker;
  addTo(map: BrowserMap): BrowserMarker;
  remove(): void;
}
export interface MapLibre {
  Map: new (options: object) => BrowserMap;
  Marker: new (options: object) => BrowserMarker;
  NavigationControl: new (options?: object) => unknown;
  AttributionControl: new (options?: object) => unknown;
}
let pending: Promise<MapLibre> | undefined;
export function loadMapLibre(): Promise<MapLibre> {
  return (pending ??= new Promise<MapLibre>((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css";
    const script = document.createElement("script");
    script.src = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js";
    script.crossOrigin = "anonymous";
    let cssLoaded = false;
    let scriptLoaded = false;
    const timer = setTimeout(fail, 20000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      css.remove();
      pending = undefined;
      reject(new Error("Map library unavailable"));
    }
    script.onerror = fail;
    css.onerror = fail;
    function finish() {
      if (!cssLoaded || !scriptLoaded) return;
      const library = (window as Window & { maplibregl?: MapLibre }).maplibregl;
      if (!library) {
        fail();
        return;
      }
      clearTimeout(timer);
      resolve(library);
    }
    css.onload = () => {
      cssLoaded = true;
      finish();
    };
    script.onload = () => {
      scriptLoaded = true;
      finish();
    };
    document.head.append(css, script);
  }));
}

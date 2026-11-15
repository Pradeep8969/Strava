// Isolated adapter double. Never bundled by Expo or presented as a real geographic map.
(() => {
  class MapDouble {
    constructor(options) {
      this.options = options; this.sources = {}; this.events = {}; this.zoom = options.zoom; this.center = options.center;
      this.canvas = document.createElement('canvas'); this.canvas.tabIndex = 0; this.canvas.style.cssText = 'width:100%;height:100%'; options.container.append(this.canvas);
      window.__mapAdapter = this; window.__mapConstructions = (window.__mapConstructions || 0) + 1;
      setTimeout(() => this.events.load?.forEach(fn => fn()), 5);
    }
    on(name, callback) { (this.events[name] ??= []).push(callback); }
    remove() { this.canvas.remove(); }
    resize() {}
    flyTo(options) { this.center = options.center; this.zoom = options.zoom; }
    fitBounds(bounds) { this.bounds = bounds; }
    setStyle(style) { this.style = style; this.sources = {}; this.events['style.load']?.forEach(fn => fn()); }
    isStyleLoaded() { return true; }
    addControl() {}
    getCanvas() { return this.canvas; }
    getSource(id) { return this.sources[id]; }
    addSource(id, source) { this.sources[id] = { data: source.data, setData(data) { this.data = data; } }; }
    addLayer(layer) { this.layer = layer; }
  }
  class MarkerDouble {
    constructor(options) { this.element = options.element || document.createElement('span'); }
    setLngLat(point) { this.point = point; return this; }
    addTo(map) { map.options.container.append(this.element); return this; }
    remove() { this.element.remove(); }
  }
  window.maplibregl = { Map: MapDouble, Marker: MarkerDouble, NavigationControl: class {}, AttributionControl: class {} };
})();

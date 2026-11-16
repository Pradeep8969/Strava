// Isolated adapter double. Never bundled by Expo or presented as a real geographic map.
(() => {
  class MapDouble {
    constructor(options) {
      this.options = options; this.sources = {}; this.events = {}; this.zoom = options.zoom; this.center = options.center; this.cameraCalls = []; this.markers = [];
      this.canvas = document.createElement('canvas'); this.canvas.tabIndex = 0; this.canvas.style.cssText = 'width:100%;height:100%'; options.container.append(this.canvas);
      window.__mapAdapter = this; window.__mapConstructions = (window.__mapConstructions || 0) + 1;
      this.styleReady = false;
      setTimeout(() => { this.styleReady = true; this.events['style.load']?.forEach(fn => fn()); this.events.load?.forEach(fn => fn()); }, 5);
    }
    on(name, callback) { (this.events[name] ??= []).push(callback); }
    remove() { this.canvas.remove(); window.__mapRemovals = (window.__mapRemovals || 0) + 1; }
    resize() {}
    flyTo(options) { this.center = options.center; this.zoom = options.zoom; this.cameraCalls.push({type: 'fly', ...options}); }
    fitBounds(bounds) { this.bounds = bounds; this.cameraCalls.push({type: 'fit', bounds}); }
    setStyle(style, options) { this.style = style; this.sources = {}; this.layer = undefined; this.styleReady = false; setTimeout(() => { options?.transformStyle?.({}, {}); this.styleReady = true; this.events.styledata?.forEach(fn => fn()); this.events.idle?.forEach(fn => fn()); }, 5); }
    isStyleLoaded() { return this.styleReady; }
    getLayer(id) { return this.layer?.id === id ? this.layer : undefined; }
    setPaintProperty(id, name, value) { if (this.layer?.id === id) this.layer.paint[name] = value; }
    stop() {}
    addControl() {}
    getCanvas() { return this.canvas; }
    getSource(id) { return this.sources[id]; }
    addSource(id, source) { this.sources[id] = { data: source.data, setData(data) { this.data = data; } }; }
    addLayer(layer) { this.layer = layer; }
  }
  class MarkerDouble {
    constructor(options) { this.element = options.element || document.createElement('span'); }
    setLngLat(point) { this.point = point; return this; }
    addTo(map) { map.options.container.append(this.element); map.markers.push(this); return this; }
    remove() { this.element.remove(); }
  }
  window.maplibregl = { Map: MapDouble, Marker: MarkerDouble, NavigationControl: class {}, AttributionControl: class {} };
})();

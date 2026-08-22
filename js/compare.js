/*
 * Chart source lab.
 *
 * The raster sea chart (sjokartraster) runs out of native resolution around
 * z15 and carries depths only as printed pixels, so it cannot answer "how
 * deep is it here". These are the freely available sources that can, layered
 * over it so their combination can be judged at real zoom levels:
 *
 *   - Kartverket "Sjøkart - Dybdedata" (WMS): the public, unclassified depth
 *     data - contours and depth points - also used on norgeskart.no. Being a
 *     WMS it renders at the requested pixel size, so it stays sharp, and its
 *     layers are queryable via GetFeatureInfo.
 *   - OpenSeaMap seamarks: buoys, beacons and lights as a transparent raster
 *     overlay, CC-BY-SA.
 *   - OpenSeaMap depth contours (WMS).
 *
 * Maintenance page, not part of the app. Safe to delete once decided.
 *
 * thought up by human, coded by ai
 */

const BERGEN = [60.39, 5.32];
const START_ZOOM = 14;
const NET_TIMEOUT_MS = 15000;

const WMTS_BASE = 'https://cache.kartverket.no/v1/service';
const DEPTH_WMS = 'https://wms.geonorge.no/skwms1/wms.dybdedata2';
const OSM_SEAMARK = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
const OSM_DEPTH_WMS = 'https://depth.openseamap.org/cgi-bin/mapserv.fcgi';

const logEl = document.getElementById('log');
const logLines = [];
function say(line, cls) {
  logLines.push(cls ? `<span class="${cls}">${line}</span>` : line);
  logEl.innerHTML = logLines.join('\n');
  logEl.scrollTop = logEl.scrollHeight;
}

// --- Map and layers -------------------------------------------------------

const map = L.map('map', { center: BERGEN, zoom: START_ZOOM });

const seaChart = L.tileLayer(
  WMTS_BASE + '?service=WMTS&request=GetTile&version=1.0.0' +
  '&layer=sjokartraster&style=default&format=image/png' +
  '&tilematrixset=webmercator&tilematrix={z}&tilerow={y}&tilecol={x}',
  { minZoom: 4, maxZoom: 18, attribution: '&copy; Kartverket' }
).addTo(map);

const seamarks = L.tileLayer(OSM_SEAMARK, {
  minZoom: 4, maxZoom: 18, opacity: 1,
  attribution: '&copy; OpenSeaMap (CC-BY-SA)',
});

const osmDepth = L.tileLayer.wms(OSM_DEPTH_WMS, {
  layers: 'contour,contour2',
  format: 'image/png',
  transparent: true,
  version: '1.1.1',
  attribution: '&copy; OpenSeaMap',
});

let depthLayer = null;
const layerControl = L.control.layers(
  { 'Sjøkartraster (Basis)': seaChart },
  { 'OpenSeaMap Seezeichen': seamarks, 'OpenSeaMap Tiefenlinien': osmDepth }
).addTo(map);

// --- Kartverket depth data ------------------------------------------------

let depthCaps = null;

function buildDepthLayer(layerName) {
  return L.tileLayer.wms(DEPTH_WMS, {
    layers: layerName,
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    // A WMS renders on demand, so a high-DPI screen gets genuinely more
    // pixels rather than an upsampled tile.
    detectRetina: true,
    maxZoom: 20,
    opacity: document.getElementById('opacity').value / 100,
    attribution: '&copy; Kartverket',
  });
}

function applyDepthLayer() {
  const name = document.getElementById('depth-layer').value;
  if (!name) return;
  if (depthLayer) { layerControl.removeLayer(depthLayer); map.removeLayer(depthLayer); }
  depthLayer = buildDepthLayer(name);

  let failed = 0;
  depthLayer.on('tileerror', () => {
    if (++failed === 1) say(`Tiefendaten "${name}": Kacheln laden nicht.`, 'bad');
  });
  depthLayer.on('load', () => { if (!failed) say(`Tiefendaten "${name}": geladen.`, 'ok'); });

  depthLayer.addTo(map);
  layerControl.addOverlay(depthLayer, `Tiefendaten: ${name}`);
}

async function loadDepthCapabilities() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  try {
    const res = await fetch(DEPTH_WMS + '?service=WMS&request=GetCapabilities&version=1.3.0',
      { signal: ctrl.signal });
    const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('XML nicht parsebar');

    // Only named layers can be requested; queryable ones answer GetFeatureInfo.
    const layers = [...xml.querySelectorAll('Layer')]
      .filter((l) => l.querySelector(':scope > Name'))
      .map((l) => ({
        name: l.querySelector(':scope > Name').textContent.trim(),
        title: l.querySelector(':scope > Title')?.textContent?.trim() || '',
        queryable: l.getAttribute('queryable') === '1',
      }));

    const infoFormats = [...xml.querySelectorAll('GetFeatureInfo > Format')]
      .map((n) => n.textContent.trim());
    const crs = [...new Set([...xml.querySelectorAll('CRS, SRS')].map((n) => n.textContent.trim()))];

    return { layers, infoFormats, crs };
  } finally {
    clearTimeout(timer);
  }
}

// --- Tap to query depth ---------------------------------------------------
//
// Leaflet has no GetFeatureInfo helper, so the request is assembled from the
// current view: the map's projected bounds as BBOX, its pixel size as
// WIDTH/HEIGHT, and the click position as I/J.

async function queryDepthAt(latlng, containerPoint) {
  if (!depthLayer) { say('Kein Tiefendaten-Layer aktiv.', 'bad'); return; }
  const name = document.getElementById('depth-layer').value;
  const size = map.getSize();
  const bounds = map.getBounds();
  const sw = L.CRS.EPSG3857.project(bounds.getSouthWest());
  const ne = L.CRS.EPSG3857.project(bounds.getNorthEast());
  const infoFormat = (depthCaps?.infoFormats || []).find((f) => /json/i.test(f))
    || (depthCaps?.infoFormats || []).find((f) => /html|plain/i.test(f))
    || 'text/html';

  const params = new URLSearchParams({
    service: 'WMS', request: 'GetFeatureInfo', version: '1.3.0',
    layers: name, query_layers: name,
    crs: 'EPSG:3857',
    bbox: `${sw.x},${sw.y},${ne.x},${ne.y}`,
    width: String(size.x), height: String(size.y),
    i: String(Math.round(containerPoint.x)), j: String(Math.round(containerPoint.y)),
    info_format: infoFormat,
    feature_count: '10',
  });

  say(`Abfrage bei ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)} (${infoFormat}) …`, 'hl');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  try {
    const res = await fetch(`${DEPTH_WMS}?${params}`, { signal: ctrl.signal });
    const text = await res.text();
    const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    say(`HTTP ${res.status}: ${stripped.slice(0, 600) || '(leere Antwort)'}`,
      res.ok && stripped ? 'ok' : 'bad');
  } catch (e) {
    say(`Abfrage fehlgeschlagen: ${ctrl.signal.aborted ? 'Timeout' : (e.message || e)}`, 'bad');
  } finally {
    clearTimeout(timer);
  }
}

map.on('click', (e) => queryDepthAt(e.latlng, e.containerPoint));

// --- Controls -------------------------------------------------------------

document.getElementById('depth-layer').addEventListener('change', applyDepthLayer);

document.getElementById('opacity').addEventListener('input', (e) => {
  if (depthLayer) depthLayer.setOpacity(e.target.value / 100);
});

document.getElementById('btn-locate').addEventListener('click', () => {
  if (!('geolocation' in navigator)) { say('Geolocation nicht verfügbar.', 'bad'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 16),
    () => say('Position nicht ermittelbar.', 'bad'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

function updateZoomInfo() {
  document.getElementById('zoominfo').textContent =
    `z${map.getZoom()} · DPR ${window.devicePixelRatio.toFixed(2)}`;
}
map.on('zoomend', updateZoomInfo);
updateZoomInfo();

// --- Boot -----------------------------------------------------------------

(async function init() {
  const select = document.getElementById('depth-layer');
  try {
    depthCaps = await loadDepthCapabilities();
    say(`Tiefendaten-WMS: ${depthCaps.layers.length} Layer, ` +
        `${depthCaps.layers.filter((l) => l.queryable).length} davon abfragbar`);
    say(`GetFeatureInfo-Formate: ${depthCaps.infoFormats.join(', ') || '(keine)'}`);
    if (!depthCaps.crs.some((c) => /3857|900913/.test(c))) {
      say('WARNUNG: EPSG:3857 fehlt in der CRS-Liste.', 'bad');
    }

    select.innerHTML = '';
    depthCaps.layers.forEach((l) => {
      const opt = document.createElement('option');
      opt.value = l.name;
      opt.textContent = `${l.name}${l.queryable ? ' [abfragbar]' : ''}` +
        (l.title && l.title !== l.name ? ` – ${l.title}` : '');
      select.appendChild(opt);
    });
    // Prefer a queryable layer - those are the ones that can answer a tap.
    const preferred = depthCaps.layers.find((l) => l.queryable) || depthCaps.layers[0];
    if (preferred) select.value = preferred.name;
    say(`Layer-Namen: ${depthCaps.layers.map((l) => l.name).join(', ')}`);
    applyDepthLayer();
  } catch (e) {
    say(`Tiefendaten-Capabilities fehlgeschlagen: ${e.message || e}`, 'bad');
    select.innerHTML = '<option value="all">all</option>';
    applyDepthLayer();
  }
})();

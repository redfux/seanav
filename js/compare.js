/*
 * Side-by-side comparison of the two candidate chart sources.
 *
 * Left:  the WMTS tile cache the app currently uses. It is capped by a
 *        pre-rendered tile pyramid, so above the chart's native resolution
 *        it can only upsample.
 * Right: the Geonorge WMS, which renders the requested bounding box at the
 *        requested pixel size and is therefore not bound to a pyramid.
 *
 * Purpose is to settle, visually and at real zoom levels, whether the WMS
 * actually carries more detail - and with which layer and format - before
 * any of it goes into the app.
 *
 * Maintenance page, not part of the app. Safe to delete once decided.
 *
 * thought up by human, coded by ai
 */

const BERGEN = [60.39, 5.32];
const START_ZOOM = 14;

const WMTS_BASE = 'https://cache.kartverket.no/v1/service';
const WMS_BASE = 'https://wms.geonorge.no/skwms1/wms.sjokartraster2';
const NET_TIMEOUT_MS = 15000;

const statusEl = document.getElementById('status');
const lines = [];
function say(line, cls) {
  lines.push(line);
  statusEl.innerHTML = lines
    .map((l) => (cls && l === line ? `<span class="${cls}">${l}</span>` : l))
    .join('\n');
  statusEl.scrollTop = statusEl.scrollHeight;
}

// --- Left map: the WMTS layer exactly as the app builds it ----------------

function wmtsLayer() {
  return L.tileLayer(
    WMTS_BASE + '?service=WMTS&request=GetTile&version=1.0.0' +
    '&layer=sjokartraster&style=default&format=image/png' +
    '&tilematrixset=webmercator&tilematrix={z}&tilerow={y}&tilecol={x}',
    { minZoom: 4, maxZoom: 18, tileSize: 256, detectRetina: true,
      attribution: '&copy; Kartverket' }
  );
}

// --- Right map: WMS -------------------------------------------------------

let wmsLayerInstance = null;

function buildWmsLayer(layerName, format) {
  return L.tileLayer.wms(WMS_BASE, {
    layers: layerName,
    format: format,
    transparent: false,
    version: '1.3.0',
    minZoom: 4,
    maxZoom: 20,
    // A WMS renders on demand, so asking for twice the pixels on a high-DPI
    // screen yields genuinely sharper output rather than an upsampled tile.
    detectRetina: true,
    attribution: '&copy; Kartverket',
  });
}

// --- Capabilities ---------------------------------------------------------

async function loadWmsCapabilities() {
  const url = WMS_BASE + '?service=WMS&request=GetCapabilities&version=1.3.0';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('XML nicht parsebar');

    const layers = [...xml.querySelectorAll('Layer > Name')]
      .map((n) => n.textContent.trim())
      .filter(Boolean);

    // WMS 1.3.0 uses CRS, 1.1.1 uses SRS.
    const crs = [...new Set([...xml.querySelectorAll('CRS, SRS')]
      .map((n) => n.textContent.trim()))];

    const formats = [...new Set(
      [...xml.querySelectorAll('GetMap > Format')].map((n) => n.textContent.trim())
    )];

    const maxW = xml.querySelector('MaxWidth')?.textContent?.trim();
    const maxH = xml.querySelector('MaxHeight')?.textContent?.trim();

    return { layers, crs, formats, maxW, maxH };
  } finally {
    clearTimeout(timer);
  }
}

// --- Wiring ---------------------------------------------------------------

const mapLeft = L.map('map-left', { center: BERGEN, zoom: START_ZOOM, zoomControl: true });
const mapRight = L.map('map-right', { center: BERGEN, zoom: START_ZOOM, zoomControl: false });
wmtsLayer().addTo(mapLeft);

// Keep both views locked together so any difference is purely the source.
let syncing = false;
function sync(from, to) {
  from.on('move zoom', () => {
    if (syncing) return;
    syncing = true;
    to.setView(from.getCenter(), from.getZoom(), { animate: false });
    syncing = false;
    document.getElementById('tag-left-z').textContent = `z${mapLeft.getZoom()}`;
    document.getElementById('tag-right-z').textContent = `z${mapRight.getZoom()}`;
    document.getElementById('zoominfo').textContent =
      `Zoom ${mapLeft.getZoom()} · DPR ${window.devicePixelRatio.toFixed(2)}`;
  });
}
sync(mapLeft, mapRight);
sync(mapRight, mapLeft);

const layerSelect = document.getElementById('wms-layer');
const formatSelect = document.getElementById('wms-format');

function applyWmsLayer() {
  if (wmsLayerInstance) mapRight.removeLayer(wmsLayerInstance);
  const name = layerSelect.value;
  const format = formatSelect.value || 'image/png';
  wmsLayerInstance = buildWmsLayer(name, format);

  let failed = 0;
  wmsLayerInstance.on('tileerror', () => {
    failed++;
    if (failed === 1) say(`Layer "${name}": Kacheln laden nicht (tileerror).`, 'bad');
  });
  wmsLayerInstance.on('load', () => {
    if (!failed) say(`Layer "${name}" (${format}): Kacheln geladen.`, 'ok');
  });

  wmsLayerInstance.addTo(mapRight);

  // getTileUrl expects a Leaflet Point carrying a z property - a plain object
  // has no scaleBy() and would throw inside _tileCoordsToNwSe.
  try {
    const coords = L.point(8563, 4351);
    coords.z = 14;
    say(`Beispiel-URL: ${wmsLayerInstance.getTileUrl(coords)}`);
  } catch (e) {
    say(`Beispiel-URL nicht ermittelbar: ${e.message || e}`);
  }
}

layerSelect.addEventListener('change', applyWmsLayer);
formatSelect.addEventListener('change', applyWmsLayer);

document.getElementById('btn-locate').addEventListener('click', () => {
  if (!('geolocation' in navigator)) { say('Geolocation nicht verfügbar.', 'bad'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => mapLeft.setView([pos.coords.latitude, pos.coords.longitude], 16),
    () => say('Position nicht ermittelbar.', 'bad'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

(async function init() {
  document.getElementById('tag-left-z').textContent = `z${START_ZOOM}`;
  document.getElementById('tag-right-z').textContent = `z${START_ZOOM}`;
  document.getElementById('zoominfo').textContent =
    `Zoom ${START_ZOOM} · DPR ${window.devicePixelRatio.toFixed(2)}`;
  try {
    const caps = await loadWmsCapabilities();
    say(`WMS-Layer (${caps.layers.length}): ${caps.layers.join(', ')}`);
    say(`CRS: ${caps.crs.join(', ') || '(keine gefunden)'}`);
    say(`Formate: ${caps.formats.join(', ') || '(keine gefunden)'}`);
    if (caps.maxW || caps.maxH) say(`MaxWidth/MaxHeight: ${caps.maxW} / ${caps.maxH}`);
    if (!caps.crs.some((c) => /3857|900913/.test(c))) {
      say('WARNUNG: EPSG:3857 nicht in der CRS-Liste – Leaflet kann den Dienst so ' +
          'evtl. nicht kacheln.', 'bad');
    }

    layerSelect.innerHTML = '';
    caps.layers.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      layerSelect.appendChild(opt);
    });
    // "all" composites whatever chart fits the scale - the sensible default.
    layerSelect.value = caps.layers.includes('all') ? 'all' : caps.layers[0];

    const preferred = caps.formats.find((f) => f === 'image/png') || caps.formats[0] || 'image/png';
    (caps.formats.length ? caps.formats : ['image/png']).forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      formatSelect.appendChild(opt);
    });
    formatSelect.value = preferred;

    applyWmsLayer();
  } catch (e) {
    say(`GetCapabilities fehlgeschlagen: ${e.message || e}`, 'bad');
    layerSelect.innerHTML = '<option value="all">all</option>';
    formatSelect.innerHTML = '<option value="image/png">image/png</option>';
    applyWmsLayer();
  }
})();

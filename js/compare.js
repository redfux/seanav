/*
 * Contour probe.
 *
 * The depth contours are missing inshore and three explanations have already
 * turned out wrong, so this page stops guessing and measures instead. For the
 * current view it fetches the tiles the app would fetch and reports what the
 * service actually returned: status, content type, byte size, and whether the
 * image contains any drawing at all.
 *
 * That separates the three possibilities that look identical on the map:
 *   - the service returns an empty, fully transparent tile: no data here;
 *   - it returns a tile with drawing that the app then renders invisibly;
 *   - it returns an error or nothing at all.
 *
 * Maintenance page, not part of the app.
 *
 * thought up by human, coded by ai
 */

const BERGEN = [60.39, 5.32];
const START_ZOOM = 14;
const NET_TIMEOUT_MS = 15000;

const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEPTH_WMS = 'https://wms.geonorge.no/skwms1/wms.dybdedata2';

// Probed side by side: the group the app uses, and the contour sub-layer.
const PROBE_LAYERS = ['Dybdedata2', 'Dybdekontur', 'Dybdelag', 'Dybdepunkt'];

const logEl = document.getElementById('log');
const lines = [];
function say(line, cls) {
  lines.push(cls ? `<span class="${cls}">${line}</span>` : line);
  logEl.innerHTML = lines.join('\n');
  logEl.scrollTop = logEl.scrollHeight;
}

// --- Map ------------------------------------------------------------------

const map = L.map('map', { center: BERGEN, zoom: START_ZOOM });
L.tileLayer(OSM, { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);

let previewLayer = null;

// Deliberately no blending and no filter here: this page has to show what the
// service sends, not what the app makes of it.
function showLayer(name) {
  if (previewLayer) map.removeLayer(previewLayer);
  previewLayer = L.tileLayer.wms(DEPTH_WMS, {
    layers: name, format: 'image/png', transparent: true, version: '1.3.0',
    maxZoom: 19, attribution: '&copy; Kartverket',
  }).addTo(map);
  say(`Vorschau: ${name} (ohne Blend, ohne Filter)`);
}

// --- Tile maths -----------------------------------------------------------

const WEB_MERCATOR_HALF = 20037508.342789244;

function tileBBox3857(z, x, y) {
  const span = (WEB_MERCATOR_HALF * 2) / Math.pow(2, z);
  const minX = -WEB_MERCATOR_HALF + x * span;
  const maxY = WEB_MERCATOR_HALF - y * span;
  return { minX, minY: maxY - span, maxX: minX + span, maxY };
}

function latLngToTile(latlng, z) {
  const n = Math.pow(2, z);
  const x = Math.floor(((latlng.lng + 180) / 360) * n);
  const latRad = (latlng.lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

// Same request the app makes, so the result carries over directly.
function depthTileUrl(layer, z, x, y) {
  const bbox = tileBBox3857(z, x, y);
  const params = new URLSearchParams({
    service: 'WMS', request: 'GetMap', version: '1.3.0',
    layers: layer, styles: '', format: 'image/png', transparent: 'true',
    crs: 'EPSG:3857',
    bbox: `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`,
    width: '512', height: '512', map_resolution: '144',
  });
  return `${DEPTH_WMS}?${params}`;
}

// --- Pixel analysis -------------------------------------------------------

/*
 * What is in the tile. "Gezeichnet" counts pixels that are not fully
 * transparent - that is the number which decides whether the service drew
 * anything. The darkest colour found says how much contrast the drawing has
 * to begin with, which is what decides whether it can survive multiply
 * blending over pale water.
 */
async function analyseTile(bitmap) {
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;

  let drawn = 0;
  let opaque = 0;
  let darkest = 255;
  const colours = new Set();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    drawn++;
    if (a === 255) opaque++;
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    if (lum < darkest) darkest = lum;
    if (colours.size <= 512) {
      colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
  }
  const total = c.width * c.height;
  return {
    size: `${c.width}x${c.height}`,
    gezeichnetPct: (drawn / total) * 100,
    deckendPct: (opaque / total) * 100,
    dunkelste: drawn ? Math.round(darkest) : null,
    farben: colours.size,
    canvas: c,
  };
}

async function probeLayer(layer, z, tile) {
  const url = depthTileUrl(layer, z, tile.x, tile.y);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const type = res.headers.get('content-type') || '(unbekannt)';
    if (!res.ok || !type.startsWith('image/')) {
      const body = (await res.text()).replace(/\s+/g, ' ').slice(0, 200);
      say(`${layer.padEnd(12)} HTTP ${res.status} ${type} — ${body}`, 'bad');
      return;
    }
    const blob = await res.blob();
    const stats = await analyseTile(await createImageBitmap(blob));

    const verdict = stats.gezeichnetPct === 0
      ? 'LEER – der Dienst zeichnet hier nichts'
      : `${stats.gezeichnetPct.toFixed(2)} % gezeichnet, dunkelste Helligkeit ${stats.dunkelste}/255`;
    say(`${layer.padEnd(12)} HTTP ${res.status} ${Math.round(blob.size / 1024)} kB ` +
        `${stats.size} — ${verdict}`, stats.gezeichnetPct === 0 ? 'warn' : 'ok');
    if (stats.gezeichnetPct > 0) {
      say(`${''.padEnd(12)} davon deckend: ${stats.deckendPct.toFixed(2)} %, ` +
          `${stats.farben > 512 ? '>512' : stats.farben} Farben`);
    }
    addPreview(layer, stats);
  } catch (e) {
    say(`${layer.padEnd(12)} ${ctrl.signal.aborted ? 'Timeout' : (e.message || e)}`, 'bad');
  } finally {
    clearTimeout(timer);
  }
}

// Shown over a checkerboard so transparent areas are recognisable as such.
function addPreview(layer, stats) {
  const box = document.getElementById('previews');
  const cell = document.createElement('figure');
  cell.className = 'preview';
  stats.canvas.className = 'tile';
  const cap = document.createElement('figcaption');
  cap.textContent = `${layer} · ${stats.gezeichnetPct.toFixed(2)} %`;
  cell.appendChild(stats.canvas);
  cell.appendChild(cap);
  box.appendChild(cell);
}

async function runProbe() {
  document.getElementById('previews').textContent = '';
  const z = map.getZoom();
  const tile = latLngToTile(map.getCenter(), z);
  say('');
  say(`--- Kachel z${z}/${tile.x}/${tile.y} bei ${map.getCenter().lat.toFixed(5)}, ` +
      `${map.getCenter().lng.toFixed(5)} ---`, 'hl');
  for (const layer of PROBE_LAYERS) {
    await probeLayer(layer, z, tile);
  }
  say('Fertig. "LEER" heißt: keine Daten an dieser Stelle. Eine niedrige');
  say('dunkelste Helligkeit heißt kontrastreiche Zeichnung, eine hohe blasse.');
}

// --- Controls -------------------------------------------------------------

document.getElementById('btn-probe').addEventListener('click', runProbe);

document.getElementById('layer-select').addEventListener('change', (e) => {
  showLayer(e.target.value);
});

document.getElementById('btn-locate').addEventListener('click', () => {
  if (!('geolocation' in navigator)) { say('Geolocation nicht verfügbar.', 'bad'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 15),
    () => say('Position nicht ermittelbar.', 'bad'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

map.on('zoomend', () => {
  document.getElementById('zoominfo').textContent = `z${map.getZoom()}`;
});

(function init() {
  const select = document.getElementById('layer-select');
  PROBE_LAYERS.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  select.value = 'Dybdekontur';
  showLayer('Dybdekontur');
  document.getElementById('zoominfo').textContent = `z${map.getZoom()}`;
  say('Zur fraglichen Stelle fahren, dann „Kacheln analysieren".');
})();

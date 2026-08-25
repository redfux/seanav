/*
 * Service probe.
 *
 * Before a chart service can be wired into the app, four questions have to be
 * answered, and none of them can be answered from documentation:
 *
 *   1. Does it answer at all, and does it answer to this browser? A service
 *      without CORS headers can still be displayed - the app falls back to a
 *      plain <img> - but its tiles can never be cached for offline use.
 *   2. What are its layers called? A WMS rejects a GetMap with an unknown
 *      layer name, and the names are nowhere but in its capabilities.
 *   3. Does it cover the water we are on? Declared bounding boxes say so
 *      without having to guess from a picture.
 *   4. Does it actually draw something there, and with what contrast? That is
 *      the question that took three wrong answers in Norwegian waters, so it
 *      is now measured per pixel rather than judged by eye.
 *
 * Maintenance page, not part of the app. Nothing here runs in the app itself.
 *
 * thought up by human, coded by ai
 */

const PROBE_PLACES = {
  bergen: { label: 'Bergen', center: [60.39, 5.32], zoom: 14 },
  kanaren: { label: 'Las Palmas', center: [28.13, -15.42], zoom: 14 },
  teneriffa: { label: 'Teneriffa Süd', center: [28.01, -16.57], zoom: 14 },
};

/*
 * The services under test. "layers" lists what to request when the service
 * names them itself; left empty, the probe takes the first drawable layers out
 * of the capabilities.
 */
const PROBE_SERVICES = [
  {
    id: 'kartverket',
    label: 'Kartverket Dybdedata (Norwegen)',
    url: 'https://wms.geonorge.no/skwms1/wms.dybdedata2',
    layers: ['Dybdedata2', 'Dybdekontur', 'Dybdelag', 'Dybdepunkt'],
    // Same oversampling the app uses, so the result carries over directly.
    extraParams: { map_resolution: '144' },
  },
  {
    id: 'ihm-p4',
    label: 'IHM Seekarte Zweck 4 (1:22k–1:90k)',
    url: 'https://ideihm.covam.es/wms/cartaENCp4',
    layers: [],
  },
  {
    id: 'ihm-p5',
    label: 'IHM Seekarte Zweck 5 (1:4k–1:22k)',
    url: 'https://ideihm.covam.es/wms/cartaENCp5',
    layers: [],
  },
  {
    id: 'grafcan',
    label: 'GRAFCAN Topobathymetrie (Kanaren)',
    url: 'https://idecan1.grafcan.es/ServicioWMS/Topobatimetrico',
    layers: [],
  },
  {
    id: 'emodnet',
    label: 'EMODnet Bathymetry (Europa)',
    url: 'https://ows.emodnet-bathymetry.eu/wms',
    layers: ['mean_multicolour', 'contours'],
  },
];

const NET_TIMEOUT_MS = 20000;
const MAX_AUTO_LAYERS = 3;   // when the layers have to be picked from capabilities
const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// --- Log ------------------------------------------------------------------

const logEl = document.getElementById('log');
const lines = [];
function say(line, cls) {
  lines.push(cls ? `<span class="${cls}">${escapeHtml(line)}</span>` : escapeHtml(line));
  logEl.innerHTML = lines.join('\n');
  logEl.scrollTop = logEl.scrollHeight;
}

// Everything logged below comes from a foreign server, so it is escaped rather
// than pasted into innerHTML.
function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// --- Map ------------------------------------------------------------------

const map = L.map('map', { center: PROBE_PLACES.bergen.center, zoom: PROBE_PLACES.bergen.zoom });
L.tileLayer(OSM, { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);

let previewLayer = null;

// Deliberately without blend mode and filter: this page has to show what the
// service sends, not what the app would make of it.
function showPreview(service, layerName) {
  if (previewLayer) map.removeLayer(previewLayer);
  previewLayer = L.tileLayer.wms(service.url, {
    layers: layerName, format: 'image/png', transparent: true, version: '1.3.0',
    maxZoom: 19, attribution: service.label,
  }).addTo(map);
  say(`Vorschau: ${service.label} / ${layerName}`);
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

function getMapUrl(service, layerName, z, tile) {
  const bbox = tileBBox3857(z, tile.x, tile.y);
  const params = new URLSearchParams({
    service: 'WMS', request: 'GetMap', version: '1.3.0',
    layers: layerName, styles: '', format: 'image/png', transparent: 'true',
    crs: 'EPSG:3857',
    bbox: `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`,
    width: '512', height: '512',
    ...(service.extraParams || {}),
  });
  return `${service.url}?${params}`;
}

// --- Capabilities ---------------------------------------------------------

function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/*
 * Reads the capabilities and pulls out what decides whether a service is
 * usable: its layer names, the coordinate systems it offers, and the area each
 * layer claims to cover. Namespace-agnostic on purpose - 1.1.1 and 1.3.0 put
 * the same information under different names, and both are still in the wild.
 */
async function readCapabilities(service) {
  const url = `${service.url}?service=WMS&request=GetCapabilities&version=1.3.0`;
  const res = await fetchWithTimeout(url);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Antwort ist kein gültiges XML');

  const all = Array.from(doc.getElementsByTagNameNS('*', 'Layer'));
  const layers = [];
  for (const node of all) {
    const name = childText(node, 'Name');
    if (!name) continue;   // group layers without a name cannot be requested
    layers.push({
      name,
      title: childText(node, 'Title') || '',
      crs: collectCrs(node),
      bbox: geographicBBox(node),
    });
  }
  const service_title = textOf(doc.getElementsByTagNameNS('*', 'Title')[0]);
  return { title: service_title, layers, version: doc.documentElement.getAttribute('version') };
}

function textOf(node) {
  return node ? node.textContent.trim() : '';
}

function childText(node, tag) {
  for (const child of Array.from(node.children)) {
    if (child.localName === tag) return child.textContent.trim();
  }
  return '';
}

// CRS entries are inherited from parent layers, so the ancestors count too.
function collectCrs(node) {
  const found = new Set();
  let current = node;
  while (current && current.localName === 'Layer') {
    for (const child of Array.from(current.children)) {
      if (child.localName === 'CRS' || child.localName === 'SRS') {
        found.add(child.textContent.trim());
      }
    }
    current = current.parentElement;
  }
  return Array.from(found);
}

// 1.3.0 calls it EX_GeographicBoundingBox, 1.1.1 LatLonBoundingBox.
function geographicBBox(node) {
  let current = node;
  while (current && current.localName === 'Layer') {
    for (const child of Array.from(current.children)) {
      if (child.localName === 'EX_GeographicBoundingBox') {
        return {
          west: Number(childText(child, 'westBoundLongitude')),
          east: Number(childText(child, 'eastBoundLongitude')),
          south: Number(childText(child, 'southBoundLatitude')),
          north: Number(childText(child, 'northBoundLatitude')),
        };
      }
      if (child.localName === 'LatLonBoundingBox') {
        return {
          west: Number(child.getAttribute('minx')),
          east: Number(child.getAttribute('maxx')),
          south: Number(child.getAttribute('miny')),
          north: Number(child.getAttribute('maxy')),
        };
      }
    }
    current = current.parentElement;
  }
  return null;
}

function covers(bbox, latlng) {
  if (!bbox) return null;
  return latlng.lng >= bbox.west && latlng.lng <= bbox.east &&
    latlng.lat >= bbox.south && latlng.lat <= bbox.north;
}

// --- Pixel analysis -------------------------------------------------------

/*
 * What is in the tile. "Gezeichnet" counts pixels that are not fully
 * transparent - that is the number which decides whether the service drew
 * anything at all. The darkest colour says how much contrast the drawing
 * brings, which decides whether it survives blending over pale water.
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

// Shown over a checkerboard so transparent areas are recognisable as such.
function addPreviewTile(caption, canvas, note) {
  const box = document.getElementById('previews');
  const cell = document.createElement('figure');
  cell.className = 'preview';
  canvas.className = 'tile';
  const cap = document.createElement('figcaption');
  cap.textContent = `${caption}${note ? ' · ' + note : ''}`;
  cell.appendChild(canvas);
  cell.appendChild(cap);
  box.appendChild(cell);
}

// --- Probing --------------------------------------------------------------

async function probeLayer(service, layerName, z, tile) {
  const url = getMapUrl(service, layerName, z, tile);
  const label = `  ${layerName}`;
  try {
    const res = await fetchWithTimeout(url);
    const type = res.headers.get('content-type') || '(unbekannt)';
    if (!res.ok || !type.startsWith('image/')) {
      const body = (await res.text()).replace(/\s+/g, ' ').slice(0, 220);
      say(`${label} HTTP ${res.status} ${type} — ${body}`, 'bad');
      return;
    }
    const blob = await res.blob();
    const stats = await analyseTile(await createImageBitmap(blob));
    const verdict = stats.gezeichnetPct === 0
      ? 'LEER – der Dienst zeichnet hier nichts'
      : `${stats.gezeichnetPct.toFixed(2)} % gezeichnet, dunkelste Helligkeit ${stats.dunkelste}/255`;
    say(`${label} HTTP ${res.status} · ${Math.round(blob.size / 1024)} kB · ${stats.size} — ${verdict}`,
        stats.gezeichnetPct === 0 ? 'warn' : 'ok');
    if (stats.gezeichnetPct > 0) {
      say(`${''.padEnd(label.length)} davon deckend: ${stats.deckendPct.toFixed(2)} %, ` +
          `${stats.farben > 512 ? '>512' : stats.farben} Farben`);
    }
    addPreviewTile(layerName, stats.canvas);
  } catch (e) {
    /*
     * fetch() also fails when a host sends no CORS headers, even though a
     * plain <img> would load fine. That difference decides whether the app can
     * cache this source for offline use, so it is worth telling apart.
     */
    const viaImg = await loadsAsImage(url);
    if (viaImg) {
      say(`${label} kein CORS – Anzeige möglich, Offline-Speicherung nicht`, 'warn');
    } else {
      say(`${label} nicht erreichbar: ${e.message || e}`, 'bad');
    }
  }
}

function loadsAsImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), NET_TIMEOUT_MS);
    img.addEventListener('load', () => { clearTimeout(timer); resolve(true); }, { once: true });
    img.addEventListener('error', () => { clearTimeout(timer); resolve(false); }, { once: true });
    img.src = url;
  });
}

async function probeService(service, z, tile, centre) {
  say('');
  say(`=== ${service.label} ===`, 'hl');
  say(`    ${service.url}`);

  let caps = null;
  try {
    caps = await readCapabilities(service);
    say(`  Capabilities: WMS ${caps.version || '?'}, ${caps.layers.length} benannte Ebenen` +
        (caps.title ? ` – ${caps.title}` : ''), 'ok');
  } catch (e) {
    const reachable = await loadsAsImage(
      `${service.url}?service=WMS&request=GetCapabilities&version=1.3.0`);
    say(`  Capabilities nicht lesbar: ${e.message || e}` +
        (reachable ? '' : ' (Host antwortet auch als Bild nicht)'), 'bad');
  }

  // Which layers to ask for: the configured ones, else the first few the
  // service names itself.
  let wanted = service.layers.slice();
  if (caps && caps.layers.length) {
    const known = new Map(caps.layers.map((l) => [l.name, l]));
    if (wanted.length === 0) {
      wanted = caps.layers.slice(0, MAX_AUTO_LAYERS).map((l) => l.name);
      say(`  Ebenen automatisch gewählt: ${wanted.join(', ') || '(keine)'}`);
    }
    // Coverage and projection are worth knowing before any tile is fetched.
    for (const name of wanted) {
      const layer = known.get(name);
      if (!layer) {
        say(`  ${name}: in den Capabilities nicht gefunden`, 'warn');
        continue;
      }
      const inside = covers(layer.bbox, centre);
      const mercator = layer.crs.some((c) => /3857|900913/.test(c));
      say(`  ${name}: ${layer.title || '(ohne Titel)'}`);
      say(`     Abdeckung hier: ${inside === null ? 'unbekannt' : inside ? 'ja' : 'NEIN'}` +
          ` · EPSG:3857: ${mercator ? 'ja' : 'NEIN'} · CRS: ${layer.crs.slice(0, 6).join(', ')}`,
          inside === false || !mercator ? 'warn' : '');
    }
  }

  for (const name of wanted) {
    await probeLayer(service, name, z, tile);
  }
}

async function runProbe() {
  document.getElementById('previews').textContent = '';
  const button = document.getElementById('btn-probe');
  button.disabled = true;
  const z = map.getZoom();
  const centre = map.getCenter();
  const tile = latLngToTile(centre, z);
  say('');
  say(`--- Kachel z${z}/${tile.x}/${tile.y} bei ${centre.lat.toFixed(5)}, ` +
      `${centre.lng.toFixed(5)} ---`, 'hl');
  for (const service of PROBE_SERVICES) {
    await probeService(service, z, tile, centre);
  }
  say('');
  say('Fertig. „LEER" heißt: Dienst antwortet, zeichnet hier aber nichts.');
  say('„kein CORS" heißt: anzeigbar, aber nicht offline speicherbar.');
  button.disabled = false;
}

// --- Controls -------------------------------------------------------------

document.getElementById('btn-probe').addEventListener('click', runProbe);

document.getElementById('place-select').addEventListener('change', (e) => {
  const place = PROBE_PLACES[e.target.value];
  if (place) map.setView(place.center, place.zoom);
});

document.getElementById('layer-select').addEventListener('change', (e) => {
  const [serviceId, layerName] = e.target.value.split('|');
  const service = PROBE_SERVICES.find((s) => s.id === serviceId);
  if (service && layerName) showPreview(service, layerName);
});

document.getElementById('btn-locate').addEventListener('click', () => {
  if (!('geolocation' in navigator)) { say('Geolocation nicht verfügbar.', 'bad'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 15),
    () => say('Position nicht ermittelbar.', 'bad'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

map.on('zoomend moveend', () => {
  document.getElementById('zoominfo').textContent =
    `z${map.getZoom()} · ${map.getCenter().lat.toFixed(4)}, ${map.getCenter().lng.toFixed(4)}`;
});

(function init() {
  const places = document.getElementById('place-select');
  Object.entries(PROBE_PLACES).forEach(([key, place]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = place.label;
    places.appendChild(opt);
  });

  // Only layers known up front can be offered as a preview; the ones taken
  // from capabilities appear in the log after a run.
  const select = document.getElementById('layer-select');
  PROBE_SERVICES.forEach((service) => {
    service.layers.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = `${service.id}|${name}`;
      opt.textContent = `${service.label} · ${name}`;
      select.appendChild(opt);
    });
  });

  document.getElementById('zoominfo').textContent =
    `z${map.getZoom()} · ${map.getCenter().lat.toFixed(4)}, ${map.getCenter().lng.toFixed(4)}`;
  say('Ort wählen oder zur eigenen Position, dann „Dienste prüfen".');
  say('Geprüft werden: Erreichbarkeit, CORS, Layernamen, Abdeckung, EPSG:3857');
  say('und was die Dienste an dieser Stelle tatsächlich zeichnen.');
})();

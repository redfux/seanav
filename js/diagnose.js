/*
 * Diagnostics for the Kartverket WMTS cache: probes what the service actually
 * returns, from the user's browser. Kept out of the app itself - index.html
 * does not load this. Safe to delete once the parametrization is settled.
 *
 * thought up by human, coded by ai
 */

// Diagnostic page: probes the Kartverket WMTS cache from the user's browser,
// since the development environment cannot reach the service directly.
// Not part of the app itself - safe to delete once the parametrization is settled.

const BASE = 'https://cache.kartverket.no/v1/service';
const CAPS_URL = 'https://cache.kartverket.no/v1/wmts/1.0.0/WMTSCapabilities.xml';
const BERGEN = { lat: 60.39, lng: 5.32 };
const ZOOMS = [10, 12, 14, 15, 16, 17, 18];

const NET_TIMEOUT_MS = 6000; // keeps a blocked or slow service from hanging the page

const report = [];
function log(line) { report.push(line); }

// Rejects with a readable reason instead of hanging forever.
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function latLngToTile(lat, lng, z) {
  const n = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

function tileUrl(layer, z, x, y, qualified) {
  const tm = qualified ? `webmercator:${z}` : `${z}`;
  return `${BASE}?service=WMTS&request=GetTile&version=1.0.0` +
         `&layer=${encodeURIComponent(layer)}&style=default&format=image/png` +
         `&tilematrixset=webmercator&tilematrix=${encodeURIComponent(tm)}&tilerow=${y}&tilecol=${x}`;
}

// Loads a tile as <img> (no CORS needed) and reports whether it decoded.
function probeImage(url) {
  const img = new Image();
  const load = new Promise((resolve) => {
    img.onload = () => resolve({ ok: true, w: img.naturalWidth, h: img.naturalHeight, img });
    img.onerror = () => resolve({ ok: false, reason: 'Ladefehler', img });
    img.src = url;
  });
  return withTimeout(load, NET_TIMEOUT_MS, { ok: false, reason: 'Timeout', img });
}

// Fetches the same URL to read status/content-type. May fail on CORS even when
// the <img> above loads fine - that is expected and not an error in itself.
async function probeFetch(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const ct = res.headers.get('content-type') || '(unbekannt)';
    let snippet = '';
    if (!ct.startsWith('image/')) snippet = (await res.text()).slice(0, 300);
    return { status: res.status, contentType: ct, snippet };
  } catch (e) {
    const reason = ctrl.signal.aborted ? `Timeout nach ${NET_TIMEOUT_MS / 1000}s` : String(e.message || e);
    return { status: 'nicht erreichbar', contentType: '', snippet: reason };
  } finally {
    clearTimeout(timer);
  }
}

// All zoom levels are probed concurrently: sequentially they would add up to
// one timeout per level whenever the service is unreachable.
async function runProbes(containerId, qualified, layer) {
  const box = document.getElementById(containerId);
  box.textContent = '';

  const probes = ZOOMS.map(async (z) => {
    const { x, y } = latLngToTile(BERGEN.lat, BERGEN.lng, z);
    const url = tileUrl(layer, z, x, y, qualified);
    const [imgRes, fetchRes] = await Promise.all([probeImage(url), probeFetch(url)]);
    return { z, imgRes, fetchRes };
  });

  const settled = await Promise.all(probes);

  return settled.map(({ z, imgRes, fetchRes }) => {
    const cell = document.createElement('div');
    cell.className = 'probe';
    const caption = document.createElement('div');
    caption.innerHTML = `<strong>z${z}</strong> ` +
      (imgRes.ok ? `<span class="ok">Bild ${imgRes.w}×${imgRes.h}</span>`
                 : `<span class="bad">kein Bild (${imgRes.reason || 'Fehler'})</span>`) +
      `<br>HTTP ${fetchRes.status}<br>${fetchRes.contentType}`;
    if (imgRes.ok) cell.appendChild(imgRes.img);
    cell.appendChild(caption);
    box.appendChild(cell);

    return { z, ok: imgRes.ok, size: imgRes.ok ? `${imgRes.w}x${imgRes.h}` : '-',
             status: fetchRes.status, ct: fetchRes.contentType, snippet: fetchRes.snippet };
  });
}

async function loadCaps() {
  const el = document.getElementById('caps');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  try {
    const res = await fetch(CAPS_URL, { signal: ctrl.signal });
    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('XML nicht parsebar');

    const layers = [...xml.querySelectorAll('Contents > Layer')].map((l) => {
      const id = l.querySelector('Identifier')?.textContent?.trim();
      const sets = [...l.querySelectorAll('TileMatrixSetLink > TileMatrixSet')]
        .map((s) => s.textContent.trim());
      return { id, sets };
    });

    const sets = [...xml.querySelectorAll('Contents > TileMatrixSet')].map((s) => {
      const id = s.querySelector('Identifier')?.textContent?.trim();
      const ms = [...s.querySelectorAll('TileMatrix > Identifier')].map((m) => m.textContent.trim());
      return { id, first: ms[0], last: ms[ms.length - 1], count: ms.length };
    });

    const seaLayer = layers.find((l) => /sjokart/i.test(l.id || ''));
    const wm = sets.find((s) => /webmercator/i.test(s.id || ''));

    const out = [
      `Layer gesamt: ${layers.length}`,
      `Seekarten-Layer: ${seaLayer ? seaLayer.id + '  (Sets: ' + seaLayer.sets.join(', ') + ')' : 'NICHT GEFUNDEN'}`,
      '',
      'TileMatrixSets:',
      ...sets.map((s) => `  ${s.id}: ${s.count} Stufen, "${s.first}" … "${s.last}"`),
      '',
      'Alle Layer-Identifier:',
      ...layers.map((l) => `  ${l.id}`),
    ].join('\n');

    el.textContent = out;
    log('--- GetCapabilities ---\n' + out);
    return { seaLayer, wm };
  } catch (e) {
    const why = ctrl.signal.aborted ? `Timeout nach ${NET_TIMEOUT_MS / 1000}s` : (e.message || e);
    const msg = `GetCapabilities nicht lesbar: ${why}\n` +
                `(haeufig CORS oder Dienst nicht erreichbar –\n` +
                ` dann bitte ${CAPS_URL} direkt im Browser oeffnen)`;
    el.textContent = msg;
    log('--- GetCapabilities ---\n' + msg);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- 6. Aufloesungsgrenze -------------------------------------------------
// A tile cache can serve every zoom level even when the underlying chart
// raster runs out of detail: above its native resolution the service simply
// upsamples. Comparing a tile against the doubled quadrant of the level below
// detects that objectively - a pure upscale differs by nothing.

async function fetchBitmap(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function toPixels(bitmap, size, srcX, srcY, srcSize, smooth) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = !!smooth;
  ctx.drawImage(bitmap, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

// Share of pixels that differ noticeably, plus mean absolute difference.
function comparePixels(a, b) {
  let differing = 0, sum = 0;
  const px = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    sum += d;
    if (d > 24) differing++;
  }
  return { differingPct: (differing / px) * 100, meanDiff: sum / px / 3 };
}

function distinctColours(pixels) {
  const set = new Set();
  for (let i = 0; i < pixels.length; i += 4) {
    set.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
    if (set.size > 4096) break;
  }
  return set.size;
}

async function measureResolution() {
  const el = document.getElementById('resolution');
  const lines = [];
  const levels = [];

  for (let z = 8; z <= 18; z++) {
    const { x, y } = latLngToTile(BERGEN.lat, BERGEN.lng, z);
    const bmp = await fetchBitmap(tileUrl('sjokartraster', z, x, y, false));
    levels.push({ z, x, y, bmp });
  }

  if (!levels.some((l) => l.bmp)) {
    const msg = 'Kacheln nicht als Bilddaten lesbar (CORS oder Dienst nicht erreichbar).';
    el.textContent = msg;
    log('\n--- Aufloesungsgrenze ---\n' + msg);
    return;
  }

  lines.push('Zoom | Farben | neu ggü. Stufe darunter | Bewertung');
  lines.push('-----+--------+-------------------------+----------');

  let lastRealDetail = null;
  for (let i = 0; i < levels.length; i++) {
    const cur = levels[i];
    if (!cur.bmp) { lines.push(`z${cur.z}  | – nicht ladbar`); continue; }

    const curPx = toPixels(cur.bmp, 256, 0, 0, cur.bmp.width, false);
    const colours = distinctColours(curPx);

    const prev = levels[i - 1];
    if (!prev || !prev.bmp) {
      lines.push(`z${String(cur.z).padStart(2)}   | ${String(colours).padStart(6)} | (keine Referenz)        | –`);
      continue;
    }

    // Which quadrant of the parent does this tile cover?
    const qx = (cur.x % 2) * (prev.bmp.width / 2);
    const qy = (cur.y % 2) * (prev.bmp.height / 2);
    const upscaled = toPixels(prev.bmp, 256, qx, qy, prev.bmp.width / 2, false);
    const { differingPct, meanDiff } = comparePixels(curPx, upscaled);

    const real = differingPct > 2;
    if (real) lastRealDetail = cur.z;
    lines.push(
      `z${String(cur.z).padStart(2)}   | ${String(colours).padStart(6)} | ` +
      `${differingPct.toFixed(1).padStart(5)}% abweichend (Ø ${meanDiff.toFixed(1)}) | ` +
      (real ? 'echtes Detail' : 'nur hochskaliert')
    );
  }

  lines.push('');
  lines.push(lastRealDetail !== null
    ? `=> Hoechste Stufe mit echtem Kartendetail: z${lastRealDetail}`
    : '=> Keine Stufe brachte messbar neues Detail.');

  const out = lines.join('\n');
  el.textContent = out;
  log('\n--- Aufloesungsgrenze ---\n' + out);
}

// --- 7. Alternative Endpunkte --------------------------------------------
// A WMS renders an arbitrary bbox at an arbitrary pixel size instead of
// serving fixed pre-rendered tiles, so it is not capped by a tile pyramid.

const WMS_CANDIDATES = [
  { name: 'geonorge sjokartraster2', url: 'https://wms.geonorge.no/skwms1/wms.sjokartraster2' },
  { name: 'geonorge sjokartraster', url: 'https://wms.geonorge.no/skwms1/wms.sjokartraster' },
  { name: 'statkart sjokartraster', url: 'https://openwms.statkart.no/skwms1/wms.sjokartraster' },
  { name: 'opencache WMTS (alt)', url: 'https://opencache.kartverket.no/gatekeeper/gk/gk.open_wmts' },
];

async function probeEndpoints() {
  const el = document.getElementById('endpoints');
  const lines = [];
  for (const cand of WMS_CANDIDATES) {
    const url = cand.url + '?service=WMS&request=GetCapabilities&version=1.3.0';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'application/xml');
      const names = [...xml.querySelectorAll('Layer > Name')].map((n) => n.textContent.trim());
      lines.push(`${cand.name}: HTTP ${res.status}` +
        (names.length ? `, Layer: ${names.slice(0, 8).join(', ')}${names.length > 8 ? ' …' : ''}`
                      : `, keine Layer gefunden`));
    } catch (e) {
      lines.push(`${cand.name}: ${ctrl.signal.aborted ? 'Timeout' : (e.message || e)}`);
    } finally {
      clearTimeout(timer);
    }
  }
  const out = lines.join('\n');
  el.textContent = out;
  log('\n--- Alternative Endpunkte ---\n' + out);
}

async function main() {
  const caps = await loadCaps();
  const layerName = 'sjokartraster';

  const plain = await runProbes('probe-plain', false, layerName);
  log('\n--- tilematrix={z} ---');
  plain.forEach((r) => log(`z${r.z}: Bild=${r.ok} ${r.size}  HTTP=${r.status}  ${r.ct}  ${r.snippet ? '| ' + r.snippet.replace(/\s+/g, ' ') : ''}`));

  const qualified = await runProbes('probe-qualified', true, layerName);
  log('\n--- tilematrix=webmercator:{z} ---');
  qualified.forEach((r) => log(`z${r.z}: Bild=${r.ok} ${r.size}  HTTP=${r.status}  ${r.ct}  ${r.snippet ? '| ' + r.snippet.replace(/\s+/g, ' ') : ''}`));

  // Layer comparison at one zoom, to spot the service silently serving a default.
  const box = document.getElementById('probe-layers');
  const z = 15;
  const { x, y } = latLngToTile(BERGEN.lat, BERGEN.lng, z);
  log('\n--- Layer-Vergleich bei z15 ---');
  const names = ['sjokartraster', 'topo', 'topograatone', 'norgeskart_bakgrunn', 'nonsense_layer_xyz'];
  const layerResults = await Promise.all(
    names.map((name) => probeImage(tileUrl(name, z, x, y, false)).then((r) => ({ name, r })))
  );
  for (const { name, r } of layerResults) {
    const cell = document.createElement('div');
    cell.className = 'probe';
    if (r.ok) cell.appendChild(r.img);
    const cap = document.createElement('div');
    cap.innerHTML = `<strong>${name}</strong><br>` +
      (r.ok ? `<span class="ok">geladen</span>` : `<span class="bad">Fehler</span>`);
    cell.appendChild(cap);
    box.appendChild(cell);
    log(`${name}: Bild=${r.ok}`);
  }

  await measureResolution();
  await probeEndpoints();

  // Summary
  const plainOk = plain.filter((r) => r.ok).map((r) => r.z);
  const qualOk = qualified.filter((r) => r.ok).map((r) => r.z);
  const lines = [];
  lines.push(`<strong>tilematrix={z}</strong> liefert Bilder bei: ${plainOk.length ? 'z' + plainOk.join(', z') : '<span class="bad">keine</span>'}`);
  lines.push(`<strong>tilematrix=webmercator:{z}</strong> liefert Bilder bei: ${qualOk.length ? 'z' + qualOk.join(', z') : '<span class="bad">keine</span>'}`);
  if (caps?.wm) lines.push(`TileMatrixSet <code>${caps.wm.id}</code>: Stufen "${caps.wm.first}" … "${caps.wm.last}" → maxNativeZoom-Kandidat: <strong>${caps.wm.last}</strong>`);
  if (caps && !caps.seaLayer) lines.push(`<span class="bad">Kein Layer mit "sjokart" im Namen gefunden – Layer-Name stimmt vermutlich nicht.</span>`);
  lines.push('<em>Bitte zusätzlich prüfen: sind auf den Kacheln oben Tiefenzahlen zu sehen?</em>');
  document.getElementById('summary').innerHTML = lines.join('<br>');
  log('\n--- Zusammenfassung ---');
  log(`tilematrix={z} ok bei: ${plainOk.join(', ') || 'keine'}`);
  log(`tilematrix=webmercator:{z} ok bei: ${qualOk.join(', ') || 'keine'}`);
  log(`UserAgent: ${navigator.userAgent}`);
  log(`devicePixelRatio: ${window.devicePixelRatio}`);
}

document.getElementById('btn-copy').addEventListener('click', async () => {
  const text = report.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    document.getElementById('btn-copy').textContent = 'kopiert ✓';
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.width = '100%';
    ta.rows = 20;
    document.querySelector('.diag').appendChild(ta);
    ta.select();
  }
});

main().catch((e) => {
  document.getElementById('summary').innerHTML =
    `<span class="bad">Diagnose abgebrochen: ${e.message || e}</span>`;
  log('Diagnose abgebrochen: ' + (e.message || e));
});

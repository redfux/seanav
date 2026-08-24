/*
 * SeeNavi Bergen - client-side offline sea navigation helper.
 * No server component: map tiles, position handling and route math
 * all run in the browser so the app keeps working without signal.
 *
 * APP_VERSION lives in js/version.js, which index.html loads first.
 *
 * thought up by human, coded by ai
 */

// --- Constants -------------------------------------------------------
const BERGEN_CENTER = [60.39, 5.32];
const EARTH_RADIUS_M = 6371000;
const COURSE_LINE_LOOKAHEAD_M = 800; // how far ahead the course line is drawn
const SPEED_SMOOTHING_SAMPLES = 6;   // moving average window for speed/heading
const STALE_FIX_MS = 8000;           // GPS fix older than this counts as lost

// --- State -------------------------------------------------------------
let map;
const chartLayers = new Map(); // source id -> Leaflet layer, for those switched on
let positionMarker;
let courseLine;
let targetMarker;
let targetLatLng = null;
let targetLine;

let lastFixes = [];      // recent {lat, lng, t} samples for smoothing
let currentSpeedMs = 0;  // smoothed speed in m/s
let currentHeadingDeg = null; // smoothed course over ground in degrees
let watchId = null;

// --- Geodesy helpers -----------------------------------------------------

function toRad(deg) { return (deg * Math.PI) / 180; }
function toDeg(rad) { return (rad * 180) / Math.PI; }

// Great-circle distance in meters.
function haversineDistance(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Initial bearing from a to b, in degrees (0 = north, clockwise).
function bearingBetween(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Destination point given start, bearing (deg) and distance (m).
function destinationPoint(start, bearingDeg, distanceM) {
  const brng = toRad(bearingDeg);
  const lat1 = toRad(start.lat);
  const lng1 = toRad(start.lng);
  const angDist = distanceM / EARTH_RADIUS_M;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

// --- Map setup -----------------------------------------------------------

function initMap() {
  map = L.map('map', {
    // Placed manually below: the default top-left corner is where the
    // readout cards sit.
    zoomControl: false,
    attributionControl: true,
    center: BERGEN_CENTER,
    zoom: 12,
    minZoom: 4,
    maxZoom: MAP_MAX_ZOOM,
  });

  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  CHART_SOURCES.forEach((source) => setLayerEnabled(source, layerPreference(source)));

  map.on('click', (e) => setTarget(e.latlng));
}

// --- Chart layers ---------------------------------------------------------

// Which layers are on is remembered per device. Without a stored choice the
// source's own default applies, and an unreadable store must never silently
// differ from a fresh install either.
function layerPreference(source) {
  try {
    const stored = localStorage.getItem(`seenavi.layer.${source.id}`);
    return stored === null ? source.defaultOn : stored === '1';
  } catch (e) {
    return source.defaultOn;
  }
}

function storeLayerPreference(id, on) {
  try {
    localStorage.setItem(`seenavi.layer.${id}`, on ? '1' : '0');
  } catch (e) {
    // Private mode or blocked storage: the choice just will not survive a reload.
  }
}

function setLayerEnabled(source, on) {
  const existing = chartLayers.get(source.id);
  if (on && !existing) {
    const layer = createChartLayer(source);
    layer.addTo(map);
    chartLayers.set(source.id, layer);
  } else if (!on && existing) {
    map.removeLayer(existing);
    chartLayers.delete(source.id);
  }
  storeLayerPreference(source.id, on);
}

function enabledSources() {
  return CHART_SOURCES.filter((s) => chartLayers.has(s.id));
}

// Builds the layer checkboxes from the registry, so adding a source needs no
// change here.
function wireLayerPanel() {
  const list = document.getElementById('layer-list');
  CHART_SOURCES.forEach((source) => {
    const id = `layer-toggle-${source.id}`;
    const row = document.createElement('label');
    row.className = 'layer-row';
    row.htmlFor = id;

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = id;
    box.checked = layerPreference(source);
    box.addEventListener('change', () => {
      setLayerEnabled(source, box.checked);
    });

    const text = document.createElement('span');
    text.textContent = source.label;

    row.appendChild(box);
    row.appendChild(text);
    list.appendChild(row);
  });

  document.getElementById('btn-toggle-layers').addEventListener('click', () => {
    togglePanel('layerpanel');
  });
}

// --- Position handling -----------------------------------------------------

function startTracking() {
  if (!('geolocation' in navigator)) {
    setGpsStatus('nicht verfügbar');
    return;
  }
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 10000,
  });
}

function onPositionError() {
  setGpsStatus('kein Fix');
}

function setGpsStatus(text) {
  document.getElementById('val-gps-status').textContent = text;
}

function onPosition(pos) {
  const { latitude, longitude, speed, heading } = pos.coords;
  const now = pos.timestamp || Date.now();
  const fix = { lat: latitude, lng: longitude, t: now };

  lastFixes.push(fix);
  if (lastFixes.length > SPEED_SMOOTHING_SAMPLES) lastFixes.shift();

  // Prefer the device's own speed/heading if it reports them (usually more
  // accurate at low speed than deriving from two nearby GPS points), else
  // fall back to computing from consecutive fixes.
  if (typeof speed === 'number' && speed !== null && !Number.isNaN(speed)) {
    currentSpeedMs = smooth(currentSpeedMs, speed);
  } else {
    currentSpeedMs = smooth(currentSpeedMs, derivedSpeed());
  }

  if (typeof heading === 'number' && heading !== null && !Number.isNaN(heading)) {
    currentHeadingDeg = heading;
  } else {
    const derived = derivedHeading();
    if (derived !== null) currentHeadingDeg = derived;
  }

  setGpsStatus('Fix ok');
  updatePositionMarker(fix);
  updateStatusBar();
  updateCourseLine(fix);
  updateNavPanel(fix);
  updateProjectionPanel();
}

function smooth(prev, value) {
  const alpha = 0.35; // exponential moving average factor
  if (!Number.isFinite(prev)) return value;
  return prev + alpha * (value - prev);
}

function derivedSpeed() {
  if (lastFixes.length < 2) return 0;
  const a = lastFixes[lastFixes.length - 2];
  const b = lastFixes[lastFixes.length - 1];
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0) return currentSpeedMs;
  const dist = haversineDistance(a, b);
  return dist / dt;
}

function derivedHeading() {
  if (lastFixes.length < 2) return null;
  const a = lastFixes[lastFixes.length - 2];
  const b = lastFixes[lastFixes.length - 1];
  if (haversineDistance(a, b) < 1) return null; // too little movement, keep old heading
  return bearingBetween(a, b);
}

// --- Map drawing -----------------------------------------------------------

function updatePositionMarker(fix) {
  const latlng = [fix.lat, fix.lng];
  if (!positionMarker) {
    positionMarker = L.circleMarker(latlng, {
      radius: 7,
      color: '#06d6a0',
      weight: 2,
      fillColor: '#2ec4b6',
      fillOpacity: 0.9,
    }).addTo(map);
    map.setView(latlng, 14);
  } else {
    positionMarker.setLatLng(latlng);
  }
}

function updateCourseLine(fix) {
  if (currentHeadingDeg === null) return;
  const ahead = destinationPoint(fix, currentHeadingDeg, COURSE_LINE_LOOKAHEAD_M);
  const points = [[fix.lat, fix.lng], [ahead.lat, ahead.lng]];
  if (!courseLine) {
    courseLine = L.polyline(points, { color: '#ffb703', weight: 3, dashArray: '2 8' }).addTo(map);
  } else {
    courseLine.setLatLngs(points);
  }
}

function setTarget(latlng) {
  targetLatLng = { lat: latlng.lat, lng: latlng.lng };
  if (!targetMarker) {
    targetMarker = L.marker(latlng, { title: 'Ziel' }).addTo(map);
  } else {
    targetMarker.setLatLng(latlng);
  }
  document.getElementById('navpanel').classList.remove('hidden');
  redrawTargetLine();
}

function redrawTargetLine() {
  if (!targetLatLng || !positionMarker) return;
  const start = positionMarker.getLatLng();
  const points = [[start.lat, start.lng], [targetLatLng.lat, targetLatLng.lng]];
  if (!targetLine) {
    targetLine = L.polyline(points, { color: '#2ec4b6', weight: 2, dashArray: '6 6' }).addTo(map);
  } else {
    targetLine.setLatLngs(points);
  }
}

function clearTarget() {
  targetLatLng = null;
  if (targetMarker) { map.removeLayer(targetMarker); targetMarker = null; }
  if (targetLine) { map.removeLayer(targetLine); targetLine = null; }
  document.getElementById('navpanel').classList.add('hidden');
}

// --- UI updates --------------------------------------------------------

function updateStatusBar() {
  document.getElementById('val-heading').textContent =
    currentHeadingDeg !== null ? `${Math.round(currentHeadingDeg)}°` : '–';
  document.getElementById('val-speed').textContent =
    `${(currentSpeedMs * 1.94384).toFixed(1)} kn`; // m/s -> knots
}

function updateNavPanel(fix) {
  if (!targetLatLng) return;
  redrawTargetLine();
  const dist = haversineDistance(fix, targetLatLng);
  const brg = bearingBetween(fix, targetLatLng);
  document.getElementById('val-distance').textContent = formatDistance(dist);
  document.getElementById('val-bearing').textContent = `${Math.round(brg)}°`;

  if (currentSpeedMs > 0.1) {
    const etaSec = dist / currentSpeedMs;
    document.getElementById('val-eta').textContent = formatDuration(etaSec);
  } else {
    document.getElementById('val-eta').textContent = '–';
  }
}

function updateProjectionPanel() {
  const panel = document.getElementById('projectionpanel');
  if (panel.classList.contains('force-hidden')) {
    panel.classList.add('hidden');
    return;
  }

  if (currentSpeedMs > 0.05) {
    panel.classList.remove('hidden');
    const distIn1Min = currentSpeedMs * 60;
    document.getElementById('val-proj-1min').textContent = formatDistance(distIn1Min);
    document.getElementById('val-proj-200m').textContent = formatDuration(200 / currentSpeedMs);
    document.getElementById('val-proj-500m').textContent = formatDuration(500 / currentSpeedMs);
  } else {
    panel.classList.add('hidden');
  }
}

function formatDistance(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '–';
  if (sec < 60) return `${Math.round(sec)} s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  if (min < 60) return `${min} min ${rem}s`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

// --- Destination card -----------------------------------------------------

const NAV_COLLAPSED_KEY = 'seenavi.nav.collapsed';

// Starts expanded so the bearing and ETA are visible the first time a target
// is set; once collapsed, the choice sticks.
function setNavCollapsed(collapsed) {
  document.getElementById('navpanel').classList.toggle('is-collapsed', collapsed);
  document.getElementById('btn-toggle-nav').setAttribute('aria-expanded', String(!collapsed));
  try {
    localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch (e) {
    // Blocked storage only costs the memory of the choice.
  }
}

function wireNavCollapse() {
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(NAV_COLLAPSED_KEY) === '1';
  } catch (e) {
    collapsed = false;
  }
  setNavCollapsed(collapsed);

  document.getElementById('btn-toggle-nav').addEventListener('click', () => {
    setNavCollapsed(!document.getElementById('navpanel').classList.contains('is-collapsed'));
  });
}

// --- Panels ---------------------------------------------------------------

// The layer and storage panels occupy the same spot, so showing one has to
// hide the other - otherwise the top one silently swallows taps meant for the
// panel underneath.
const EXCLUSIVE_PANELS = {
  layerpanel: 'btn-toggle-layers',
  storagepanel: 'btn-toggle-storage',
};

function togglePanel(id) {
  const panel = document.getElementById(id);
  const wasHidden = panel.classList.contains('hidden');

  Object.entries(EXCLUSIVE_PANELS).forEach(([panelId, buttonId]) => {
    document.getElementById(panelId).classList.add('hidden');
    document.getElementById(buttonId).classList.remove('is-active');
  });

  if (wasHidden) {
    panel.classList.remove('hidden');
    // Material keeps a toggle's state visible on the control itself, which
    // also makes it obvious which sheet a tap will close again.
    document.getElementById(EXCLUSIVE_PANELS[id]).classList.add('is-active');
  }
  return wasHidden;
}

// --- Tile storage panel ---------------------------------------------------

function wireStoragePanel() {
  document.getElementById('btn-clear-cache').addEventListener('click', async () => {
    const hint = document.getElementById('cache-size-hint');
    hint.textContent = 'Wird gelöscht…';
    try {
      await TileStore.clear();
      chartLayers.forEach((layer) => layer.redraw());
    } catch (e) {
      hint.textContent = 'Löschen fehlgeschlagen.';
      return;
    }
    refreshCacheStats();
  });

  refreshCacheStats();
}

async function refreshCacheStats() {
  const hint = document.getElementById('cache-size-hint');
  try {
    const stats = await TileStore.stats();
    const perSource = CHART_SOURCES
      .filter((s) => stats.bySource[s.id])
      .map((s) => `${s.label.replace(/ \(.*\)/, '')} ${stats.bySource[s.id].count}`)
      .join(', ');
    hint.textContent =
      `Gespeichert: ${stats.count} Kacheln (~${stats.mb.toFixed(1)} MB)` +
      (perSource ? ` · ${perSource}` : '');
  } catch (e) {
    hint.textContent = 'Kachelspeicher nicht lesbar.';
  }
}

/*
 * Housekeeping at startup, both aimed at the cache surviving as long as it
 * usefully can:
 *
 *  - drop tiles from sources that no longer exist, so a removed or replaced
 *    layer does not occupy space forever;
 *  - ask the browser to treat the storage as persistent. Without this,
 *    IndexedDB is "best effort" and can be evicted under storage pressure -
 *    quietly, and most likely exactly when there is no signal to refill it.
 */
async function maintainCache() {
  try {
    const removed = await TileStore.pruneRemovedSources(CHART_SOURCES.map((s) => s.id));
    if (removed > 0) chartLayers.forEach((layer) => layer.redraw());
  } catch (e) {
    // Housekeeping is not worth failing the app over.
  }
  try {
    if (navigator.storage && navigator.storage.persist) {
      await navigator.storage.persist();
    }
  } catch (e) {
    // Not supported everywhere; the cache then just is not protected.
  }
  refreshCacheStats();
}

// --- Toolbar wiring ------------------------------------------------------

function wireToolbar() {
  document.getElementById('btn-locate').addEventListener('click', () => {
    if (positionMarker) map.setView(positionMarker.getLatLng(), 15);
  });

  document.getElementById('btn-toggle-storage').addEventListener('click', () => {
    if (togglePanel('storagepanel')) refreshCacheStats();
  });

  document.getElementById('btn-toggle-proj').addEventListener('click', () => {
    const panel = document.getElementById('projectionpanel');
    const off = panel.classList.toggle('force-hidden');
    document.getElementById('btn-toggle-proj').classList.toggle('is-active', !off);
    updateProjectionPanel();
  });

  document.getElementById('btn-clear-target').addEventListener('click', clearTarget);

  wireNavCollapse();

  // The projection panel starts enabled, so its control starts active.
  document.getElementById('btn-toggle-proj').classList.add('is-active');
}

// --- Boot ----------------------------------------------------------------

function boot() {
  document.getElementById('app-version').textContent = APP_VERSION;
  initMap();
  maintainCache();
  wireLayerPanel();
  wireStoragePanel();
  wireToolbar();
  startTracking();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline app-shell caching is a nice-to-have; ignore failures (e.g. file://).
    });
  }
}

document.addEventListener('DOMContentLoaded', boot);

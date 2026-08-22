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
let seaChartLayer;
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
    zoomControl: true,
    attributionControl: true,
    center: BERGEN_CENTER,
    zoom: 12,
  });

  seaChartLayer = createSeaChartLayer();
  seaChartLayer.addTo(map);

  map.on('click', (e) => setTarget(e.latlng));
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

// --- Offline download panel wiring --------------------------------------

let activeDownload = null;

function wireOfflinePanel() {
  const zoomRange = document.getElementById('zoom-range');
  const zoomVal = document.getElementById('zoom-range-val');

  // The layer decides the usable maximum: with high-DPI rendering Leaflet
  // lowers the map's maxZoom by one, so a hardcoded slider bound would offer
  // a level that can never be displayed.
  zoomRange.max = String(map.getMaxZoom());
  if (parseInt(zoomRange.value, 10) > map.getMaxZoom()) {
    zoomRange.value = String(map.getMaxZoom());
  }
  zoomVal.textContent = zoomRange.value;
  zoomRange.addEventListener('input', () => { zoomVal.textContent = zoomRange.value; });

  document.getElementById('btn-download-area').addEventListener('click', () => {
    const maxZoom = parseInt(zoomRange.value, 10);
    // Guard against the current view already being zoomed in further than the
    // selected maximum - the range would be empty and the download a silent
    // no-op showing "0 / 0".
    const minZoom = Math.min(map.getZoom(), maxZoom);
    const progressBox = document.getElementById('download-progress');
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    const cancelBtn = document.getElementById('btn-cancel-download');

    progressBox.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');

    activeDownload = downloadAreaForOffline(map, minZoom, maxZoom, (done, total) => {
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      fill.style.width = `${pct}%`;
      text.textContent = total > 0
        ? `${done} / ${total} Kacheln`
        : 'Keine Kacheln für diesen Bereich';
    });

    activeDownload.promise.then(() => {
      cancelBtn.classList.add('hidden');
      refreshCacheStats();
    });
  });

  document.getElementById('btn-cancel-download').addEventListener('click', () => {
    if (activeDownload) activeDownload.cancel();
    document.getElementById('btn-cancel-download').classList.add('hidden');
  });

  refreshCacheStats();
}

async function refreshCacheStats() {
  const stats = await TileStore.stats();
  const dpiNote = HIGH_DPI
    ? ' · hochauflösendes Display: eine Zoomstufe tiefer, ca. 4× Kacheln'
    : '';
  document.getElementById('cache-size-hint').textContent =
    `Aktuell gespeichert: ${stats.count} Kacheln (~${stats.mb.toFixed(1)} MB)${dpiNote}`;
}

// --- Toolbar wiring ------------------------------------------------------

function wireToolbar() {
  document.getElementById('btn-locate').addEventListener('click', () => {
    if (positionMarker) map.setView(positionMarker.getLatLng(), 15);
  });

  document.getElementById('btn-toggle-offline').addEventListener('click', () => {
    document.getElementById('offlinepanel').classList.toggle('hidden');
  });

  document.getElementById('btn-toggle-proj').addEventListener('click', () => {
    const panel = document.getElementById('projectionpanel');
    panel.classList.toggle('force-hidden');
    updateProjectionPanel();
  });

  document.getElementById('btn-clear-target').addEventListener('click', clearTarget);
}

// --- Boot ----------------------------------------------------------------

function boot() {
  document.getElementById('app-version').textContent = APP_VERSION;
  initMap();
  wireOfflinePanel();
  wireToolbar();
  startTracking();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline app-shell caching is a nice-to-have; ignore failures (e.g. file://).
    });
  }
}

document.addEventListener('DOMContentLoaded', boot);

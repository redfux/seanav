/*
 * SeaGlimpse - client-side orientation aid for boat trips.
 * No server component: map tiles, position handling and route math
 * all run in the browser so the app keeps working without signal.
 *
 * Not a navigation system: it shows where the boat is and what the chart
 * services draw around it, and that is the whole claim. The permanent notice
 * in the footer says so on screen.
 *
 * APP_VERSION lives in js/version.js, which index.html loads first.
 *
 * thought up by human, coded by ai
 */

// --- Constants -------------------------------------------------------
const BERGEN_CENTER = [60.39, 5.32];
const EARTH_RADIUS_M = 6371000;
/*
 * Fixed distances marked along the course line. The distance is the constant;
 * what changes with speed is how long it takes to get there.
 *
 * Which of them are drawn depends on the view: marks off screen are dropped,
 * and so are marks that would crowd the one before them (MIN_MARK_SPACING_PX).
 * Zoomed in that leaves the near ones, zoomed out the far ones - one ladder
 * covers the whole range without any zoom-dependent bookkeeping.
 */
const PROJECTION_DISTANCES_M = [200, 500, 1000, 5000, 10000];

/*
 * Colours of the course line. Orange looked right on a desk and failed on the
 * water: against the blue of the sea areas it has too little contrast in full
 * sun. Black has the most contrast there is against a bright chart - and to
 * keep it from disappearing over dark ground in return, it is drawn on a light
 * casing, the way a chart draws a leading line.
 */
const COURSE_LINE_COLOUR = '#000000';
const COURSE_LINE_CASING = '#ffffff';

/*
 * The line to the destination follows the same reasoning as the course line
 * and for the same reason - turquoise on sea blue was barely there in the sun.
 * It cannot be black as well, though: two black lines from the same boat would
 * have to be told apart by their dash pattern alone. Magenta is what a chart
 * uses for a course laid out by hand, it is far from every colour the base map
 * uses for water and land, and it keeps its contrast on the same pale casing.
 */
const TARGET_LINE_COLOUR = '#d81b60';
const TARGET_LINE_CASING = '#ffffff';

// The line runs just past the furthest mark, so the outermost label does not
// sit on its end. Constant, so the line does not change length as marks come
// and go.
const COURSE_LINE_LOOKAHEAD_M = Math.max(...PROJECTION_DISTANCES_M) * 1.15;

/*
 * A mark is only drawn where it can actually be read:
 *
 *  - below MIN_PROJECTION_SPEED_MS there is no course to project along, and
 *    no meaningful travel time either;
 *  - a mark outside the current view cannot be read, so it is dropped. Zoomed
 *    in close that is usually the 500 m mark;
 *  - marks closer together on screen than MIN_MARK_SPACING_PX would have
 *    overlapping labels. Zoomed far out both distances land nearly on top of
 *    the boat, and what cannot be told apart is dropped.
 */
const MIN_PROJECTION_SPEED_MS = 0.15;
const MIN_MARK_SPACING_PX = 34;

/*
 * The two labels sit on opposite sides of the line: the travel time out to one
 * side in horizontal text, the distance to the other running along the line.
 * The time label is centred on its offset point, so the gap has to exceed half
 * its width or the text lands on the line.
 */
const MARK_TIME_OFFSET_PX = 34;
const MARK_DISTANCE_OFFSET_PX = 13;
/*
 * How many fixes are kept. The speed only ever looks at the last two, the
 * heading at as many as it needs to get a long enough baseline - at slow speed
 * that is most of them, which is why the history is longer than the six the
 * speed used to need.
 */
const FIX_HISTORY_SAMPLES = 15;
const STALE_FIX_MS = 8000;           // GPS fix older than this counts as lost

/*
 * Heading. A GPS fix scatters by a few metres even standing still, and a
 * course computed from two fixes a second apart divides that scatter by the
 * distance covered in between. At 5 kn that distance is 2,5 m - the same order
 * as the scatter itself - so the computed course swings wildly while the boat
 * runs dead straight. That is what makes the boat spin on screen.
 *
 * Three things against it, in the order they take effect:
 *
 *  - MIN_HEADING_SPEED_MS: below this there is no course worth computing at
 *    all, and the last one is kept rather than replaced by noise.
 *  - MIN_HEADING_BASELINE_M: the course is taken over the longest stretch in
 *    the sample window instead of between the last two fixes, and only once
 *    that stretch is clearly longer than the scatter. Over 12 m the same few
 *    metres of error tilt the line by a few degrees, not by fifty.
 *  - HEADING_SMOOTHING: a circular moving average over the result. Angles
 *    cannot be averaged as numbers - 359 and 1 degrees average to 180, the
 *    opposite direction - so the average runs over the unit vector and the
 *    angle is read back from it.
 *
 * The factor was measured, not guessed, over eight noise patterns per value.
 * Where the device reports a heading of its own - the normal case on a phone,
 * and the one without the baseline delay - a 90 degree turn settles to within
 * 10 degrees after 3 s at 0.45, against 4 s at 0.35 and 2 s at 0.55; straight
 * running costs 3.6, 3.2 and 4.1 degrees of mean deviation respectively.
 * Where the heading has to be derived from positions, the baseline sets the
 * pace and no factor beats 7 s; raising it only makes both figures worse.
 */
const MIN_HEADING_SPEED_MS = 0.5;    // ~1 kn
const MIN_HEADING_BASELINE_M = 12;
const MIN_HEADING_BASELINE_SLOW_M = 5;
const HEADING_SMOOTHING = 0.45;

/*
 * A destination that has stood untouched for this long is taken to be the one
 * that was meant and stops reacting to taps on the map. Underway the phone is
 * handled with wet hands on a moving boat, and a stray tap that silently moved
 * the destination somewhere else would be noticed late, if at all. Getting rid
 * of it then takes the "Ziel löschen" button, which nobody presses by accident.
 */
const TARGET_LOCK_MS = 60000;
const SNACK_MS = 3500;

// Zoom for the very first fix. Afterwards the zoom is the user's business and
// is never changed again by following or by the position button.
const INITIAL_FIX_ZOOM = 14;

const ORIENTATION_KEY = 'seenavi.map.orientation';
const SPEED_UNIT_KEY = 'seenavi.speed.unit';

// Knots is what a chart is drawn in, km/h what a road sign says - which one is
// wanted depends on the day, so both are a tap apart.
const SPEED_UNITS = {
  kn: { label: 'kn', perMs: 1.94384 },
  kmh: { label: 'km/h', perMs: 3.6 },
};

// --- State -------------------------------------------------------------
let map;
const chartLayers = new Map(); // source id -> Leaflet layer, for those switched on
let positionMarker;
let courseLine;
let courseLineCasing;         // pale line underneath, so black reads anywhere
let projectionLayer;          // holds the time marks, rebuilt on every fix
let projectionEnabled = true;
let targetMarker;
let targetLatLng = null;
let targetLine;
let targetLineCasing;         // pale line underneath, as on the course line
let followMode = true;        // map keeps the boat centred until the map is dragged
let mapZooming = false;       // true while a zoom animation is running
let speedUnit = 'kn';         // 'kn' | 'kmh', see SPEED_UNITS
let targetLocked = false;     // set after TARGET_LOCK_MS without a change
let targetLockTimer = null;
let snackTimer = null;

let lastFixes = [];      // recent {lat, lng, t} samples for smoothing
let currentSpeedMs = 0;  // smoothed speed in m/s
let currentHeadingDeg = null; // smoothed course over ground in degrees
let headingVector = null;     // unit vector of the smoothed heading, see updateHeading()
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
    // Both are rebuilt outside the map: the map container is oversized and
    // turns, so a control in its corner would be off screen and upside down.
    attributionControl: false,
    center: BERGEN_CENTER,
    zoom: 12,
    minZoom: 4,
    maxZoom: MAP_MAX_ZOOM,
  });

  MapOrientation.init(map);

  CHART_SOURCES.forEach((source) => setLayerEnabled(source, layerPreference(source)));
  refreshAttribution();

  map.on('click', (e) => requestTarget(e.latlng));

  // Dragging the map is the one gesture that means "I want to look somewhere
  // else". Zooming is not: it keeps the boat in view, so following survives it.
  map.on('dragstart', () => setFollow(false));

  // A fix arriving mid-zoom would re-centre at the zoom level the animation
  // has not reached yet, which cancels the zoom and drops back to where it
  // started. Following waits the animation out; the next fix is a second away.
  map.on('zoomstart', () => { mapZooming = true; });
  map.on('zoomend', () => { mapZooming = false; });

  // Which marks fit depends on the view, not only on the fix: zooming out can
  // crowd them together, panning can move one off screen.
  map.on('moveend zoomend', () => {
    const last = lastFixes[lastFixes.length - 1];
    if (last) updateCourseLine(last);
  });
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
  refreshAttribution();
  fitControlsAboveFooter();
}

function enabledSources() {
  return CHART_SOURCES.filter((s) => chartLayers.has(s.id));
}

/*
 * Map credits, rebuilt from the layers actually switched on. Every one of the
 * three services requires attribution, so this is a licence condition rather
 * than decoration - it used to be Leaflet's own control, which cannot stay
 * inside a map that turns.
 */
function refreshAttribution() {
  // Leaflet is not in this line: BSD-2 asks for the notice in the
  // distribution, not on screen, and it is in docs/THIRD_PARTY_LICENSES.md.
  // The chart services are here because their licences do require it.
  const credits = [];
  enabledSources().forEach((source) => {
    if (source.attribution && !credits.includes(source.attribution)) {
      credits.push(source.attribution);
    }
  });
  // Built entirely from constants in js/sources.js, never from input.
  document.getElementById('attribution').innerHTML = credits.join(' | ');
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

// --- The jump to a public AIS map -----------------------------------------

/*
 * Other ships cannot be drawn on this map: every worldwide AIS feed is behind
 * a key, a key needs a server to hold it, and this app has none - the reasons
 * and the sources examined are in docs/architecture.md. What works without
 * either is a link that hands the shown section over to a public AIS map.
 *
 * It is a link, not a fetch: nothing is loaded from there, so it needs no
 * entry in the CSP. What it does do is pass the map centre to a third party,
 * which the app otherwise never does - hence only ever on an explicit tap,
 * and with the referrer withheld.
 */
const AIS_MAP_BASE = 'https://www.vesselfinder.com/';
const AIS_MAP_MIN_ZOOM = 3;
const AIS_MAP_MAX_ZOOM = 18;

function aisMapUrl() {
  const centre = map.getCenter();
  // Their map stops outside this band and would answer with its default view.
  const zoom = Math.min(AIS_MAP_MAX_ZOOM, Math.max(AIS_MAP_MIN_ZOOM, Math.round(map.getZoom())));
  const params = new URLSearchParams({
    lat: centre.lat.toFixed(5),
    lon: centre.lng.toFixed(5),
    zoom: String(zoom),
  });
  return `${AIS_MAP_BASE}?${params.toString()}`;
}

function refreshAisLink() {
  const link = document.getElementById('link-ais');
  if (!link) return;
  const offline = navigator.onLine === false;
  link.classList.toggle('is-offline', offline);
  link.href = offline ? AIS_MAP_BASE : aisMapUrl();
  document.getElementById('ais-hint').textContent = offline
    ? 'Ohne Empfang nicht möglich – die Schiffskarte kommt aus dem Netz.'
    : 'Öffnet den gezeigten Ausschnitt bei VesselFinder. Kleine Sportboote senden meist kein AIS.';
}

function wireAisLink() {
  const link = document.getElementById('link-ais');
  if (!link) return;

  // Kept current from the map itself, so a long press offers the same address
  // the tap would open.
  map.on('moveend zoomend', refreshAisLink);
  window.addEventListener('online', refreshAisLink);
  window.addEventListener('offline', refreshAisLink);

  link.addEventListener('click', (e) => {
    if (navigator.onLine === false) {
      e.preventDefault();
      showSnack('Ohne Empfang nicht möglich');
    }
  });

  refreshAisLink();
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
  if (lastFixes.length > FIX_HISTORY_SAMPLES) lastFixes.shift();

  // Prefer the device's own speed/heading if it reports them (usually more
  // accurate at low speed than deriving from two nearby GPS points), else
  // fall back to computing from consecutive fixes.
  if (typeof speed === 'number' && speed !== null && !Number.isNaN(speed)) {
    currentSpeedMs = smooth(currentSpeedMs, speed);
  } else {
    currentSpeedMs = smooth(currentSpeedMs, derivedSpeed());
  }

  /*
   * The device's own heading gets the same treatment as a derived one: it is
   * computed from the same noisy positions and jitters just as much. Below
   * walking pace neither is worth anything, and the last known heading stays -
   * a boat lying still keeps pointing where it last pointed.
   */
  if (currentSpeedMs >= MIN_HEADING_SPEED_MS) {
    const reported = (typeof heading === 'number' && heading !== null &&
      !Number.isNaN(heading)) ? heading : null;
    updateHeading(reported !== null ? reported : derivedHeading());
  }

  setGpsStatus('Fix ok');
  // Turn the map first: the marks drawn below are placed against the rotation
  // that is in effect.
  MapOrientation.setHeading(currentHeadingDeg);
  updatePositionMarker(fix);
  updateStatusBar();
  updateCourseLine(fix);
  updateNavPanel(fix);
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

/*
 * Course over a stretch long enough to be movement rather than scatter. The
 * search walks back from the newest fix and stops at the first one far enough
 * away: that is the shortest sufficient baseline, and therefore the one that
 * lags least behind a turn.
 *
 * Slowly enough - a couple of knots - even the whole history does not add up
 * to twelve metres. Rather than freezing the heading there, the longest
 * stretch available is used as long as it clears a lower floor; the scatter
 * then bites harder, but the moving average behind this catches most of it,
 * and a wrong-ish heading at two knots costs less than one that stopped
 * updating an hour ago.
 */
function derivedHeading() {
  if (lastFixes.length < 2) return null;
  const to = lastFixes[lastFixes.length - 1];
  for (let i = lastFixes.length - 2; i >= 0; i--) {
    if (haversineDistance(lastFixes[i], to) >= MIN_HEADING_BASELINE_M) {
      return bearingBetween(lastFixes[i], to);
    }
  }
  const oldest = lastFixes[0];
  if (haversineDistance(oldest, to) >= MIN_HEADING_BASELINE_SLOW_M) {
    return bearingBetween(oldest, to);
  }
  return null;
}

/*
 * Circular moving average of the heading. Averaging degrees directly breaks at
 * the wrap - 359 and 1 average to 180, exactly the wrong way - so the average
 * is kept as a unit vector and the angle read back from it. That also damps by
 * itself: a single fix pointing the opposite way shortens the vector instead
 * of turning it.
 *
 * If the vector does collapse - the readings really are pointing every which
 * way - the direction it holds means nothing, and it starts over from the
 * current reading.
 */
function updateHeading(headingDeg) {
  if (headingDeg === null) return;
  const rad = toRad(headingDeg);
  const x = Math.sin(rad);
  const y = Math.cos(rad);

  if (!headingVector) {
    headingVector = { x, y };
  } else {
    headingVector = {
      x: headingVector.x + HEADING_SMOOTHING * (x - headingVector.x),
      y: headingVector.y + HEADING_SMOOTHING * (y - headingVector.y),
    };
    if (Math.hypot(headingVector.x, headingVector.y) < 0.05) {
      headingVector = { x, y };
    }
  }
  currentHeadingDeg = (toDeg(Math.atan2(headingVector.x, headingVector.y)) + 360) % 360;
}

// --- Map drawing -----------------------------------------------------------

/*
 * Own position as a hull: pointed bow, flat stern, turned into the course.
 * A dot says where the boat is, this says which way it is pointing - the
 * difference that matters when a channel has to be lined up.
 *
 * Not interactive, so a tap on the boat still reaches the map and can set a
 * destination, and drawn above everything else.
 */
function boatIcon() {
  return L.divIcon({
    className: 'boat-icon',
    html: '<svg viewBox="0 0 24 30" aria-hidden="true">' +
      '<path d="M12 1.2c4.8 5.8 8.6 12.3 8.6 17.3v9.1H3.4v-9.1c0-5 3.8-11.5 8.6-17.3z" ' +
      'fill="#2ec4b6" stroke="#06231f" stroke-width="1.7" stroke-linejoin="round"/>' +
      '<path d="M12 7v16" stroke="#06231f" stroke-width="1.5" opacity="0.45"/>' +
      '</svg>',
    iconSize: [34, 40],
    iconAnchor: [17, 20],
  });
}

function updatePositionMarker(fix) {
  const latlng = [fix.lat, fix.lng];
  if (!positionMarker) {
    positionMarker = L.marker(latlng, {
      icon: boatIcon(),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(map);
    // Only the first fix sets a zoom - from then on the zoom belongs to the
    // user and neither following nor the position button touches it.
    map.setView(latlng, INITIAL_FIX_ZOOM);
  } else {
    positionMarker.setLatLng(latlng);
    if (followMode && !mapZooming) map.setView(latlng, map.getZoom(), { animate: false });
  }
  updateBoatHeading();
}

// The heading is geographic in both modes: north-up the map stands still and
// the boat turns, course-up the map turns underneath and the boat ends up
// pointing at the top of the screen.
function updateBoatHeading() {
  const el = positionMarker && positionMarker.getElement();
  if (!el) return;
  const heading = currentHeadingDeg === null ? 0 : currentHeadingDeg;
  el.style.setProperty('--rot', `${heading.toFixed(1)}deg`);
}

// Following is on until the map is dragged, and back on at the touch of the
// map button. The button shows which of the two it is.
function setFollow(on) {
  followMode = on;
  refreshMapModeUi();
}

function updateCourseLine(fix) {
  // The button switches the whole projection off, line included: a course line
  // is a projection like the marks on it, and half of one is a thing nobody
  // asked for.
  if (!projectionEnabled || currentHeadingDeg === null) {
    removeCourseLine();
    if (projectionLayer) projectionLayer.clearLayers();
    return;
  }

  const marks = projectionMarks(fix);
  const ahead = destinationPoint(fix, currentHeadingDeg, COURSE_LINE_LOOKAHEAD_M);
  const points = [[fix.lat, fix.lng], [ahead.lat, ahead.lng]];
  if (!courseLine) {
    // Two lines, one under the other: the pale casing first, so the black line
    // reads against dark ground too.
    courseLineCasing = L.polyline(points, {
      color: COURSE_LINE_CASING, weight: 7, opacity: 0.75, interactive: false,
    }).addTo(map);
    courseLine = L.polyline(points, {
      color: COURSE_LINE_COLOUR, weight: 3, dashArray: '2 8', interactive: false,
    }).addTo(map);
  } else {
    courseLineCasing.setLatLngs(points);
    courseLine.setLatLngs(points);
  }

  drawProjectionMarks(marks);
}

function removeCourseLine() {
  if (courseLine) { map.removeLayer(courseLine); courseLine = null; }
  if (courseLineCasing) { map.removeLayer(courseLineCasing); courseLineCasing = null; }
}

// --- Course line time marks ------------------------------------------------

// Ground distance covered per screen pixel, for translating a pixel gap into
// the geographic offset a label needs.
function metresPerPixel() {
  const centre = map.getCenter();
  const point = map.latLngToContainerPoint(centre);
  const shifted = map.containerPointToLatLng([point.x + 64, point.y]);
  return map.distance(centre, shifted) / 64;
}

// Which marks are worth drawing right now, nearest first.
function projectionMarks(fix) {
  if (!projectionEnabled) return [];
  if (currentHeadingDeg === null || currentSpeedMs < MIN_PROJECTION_SPEED_MS) return [];

  const bounds = map.getBounds();
  const kept = [];
  let lastPoint = map.latLngToContainerPoint([fix.lat, fix.lng]);

  for (const distanceM of PROJECTION_DISTANCES_M) {
    const at = destinationPoint(fix, currentHeadingDeg, distanceM);
    const latlng = L.latLng(at.lat, at.lng);
    if (!bounds.contains(latlng)) continue;

    const point = map.latLngToContainerPoint(latlng);
    // Measured against the last mark actually kept, not the last one tried,
    // so skipping one does not let the next crowd it either.
    if (point.distanceTo(lastPoint) < MIN_MARK_SPACING_PX) continue;

    kept.push({ distanceM, latlng, seconds: distanceM / currentSpeedMs });
    lastPoint = point;
  }
  return kept;
}

// Travel time rounded to whole minutes. Under half a minute that rounds to
// zero, which says nothing - "<1 min" is both shorter and true.
function formatMarkMinutes(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '–';
  if (seconds < 30) return '<1 min';
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : formatQuarterHours(minutes);
}

/*
 * Beyond an hour, minutes stop being the unit anyone thinks in - "95 min" has
 * to be converted in the head, "1,5 h" does not. Rounded to the quarter hour,
 * because that is the accuracy such an estimate has: it comes from the current
 * speed, and that will not hold for the next hour and a half.
 */
function formatQuarterHours(minutes) {
  const hours = Math.round(minutes / 15) / 4;
  return `${String(hours).replace('.', ',')} h`;
}

/*
 * Rotation for text running along the course line. Heading 0 points up on a
 * north-up map, so the line's direction there is (sin h, -cos h).
 *
 * The label is a child of the map, so a turned map turns it as well: the angle
 * it is given is a local one, while whether it reads upside down depends on
 * where it ends up on screen. The flip is therefore decided on the screen
 * angle and the result converted back.
 */
function courseTextAngle() {
  const rad = toRad(currentHeadingDeg);
  const local = toDeg(Math.atan2(-Math.cos(rad), Math.sin(rad)));
  const mapRot = -MapOrientation.bearing;
  let screen = ((local + mapRot + 540) % 360) - 180;
  if (screen > 90) screen -= 180;
  if (screen < -90) screen += 180;
  return screen - mapRot;
}

function drawProjectionMarks(marks) {
  if (!projectionLayer) projectionLayer = L.layerGroup().addTo(map);
  projectionLayer.clearLayers();
  if (marks.length === 0) return;

  const metres = metresPerPixel();
  const timeBearing = (currentHeadingDeg + 90) % 360;
  const distanceBearing = (currentHeadingDeg + 270) % 360;
  const angle = courseTextAngle();

  marks.forEach((mark) => {
    L.circleMarker(mark.latlng, {
      // Black on a pale ring, for the same reason as the line itself.
      radius: 5,
      color: COURSE_LINE_CASING,
      weight: 2,
      fillColor: COURSE_LINE_COLOUR,
      fillOpacity: 1,
      interactive: false,
    }).addTo(projectionLayer);

    addMarkLabel(mark.latlng, timeBearing, MARK_TIME_OFFSET_PX * metres,
      'course-mark-label', formatMarkMinutes(mark.seconds), 0);
    addMarkLabel(mark.latlng, distanceBearing, MARK_DISTANCE_OFFSET_PX * metres,
      'course-mark-dist', formatMarkDistance(mark.distanceM), angle);
  });
}

// Places one label beside a mark, offset perpendicular to the course.
function addMarkLabel(latlng, bearing, offsetM, className, text, angle) {
  const at = destinationPoint({ lat: latlng.lat, lng: latlng.lng }, bearing, offsetM);
  L.marker([at.lat, at.lng], {
    // Not interactive: a tap here has to reach the map and set a target.
    interactive: false,
    keyboard: false,
    icon: L.divIcon({
      className,
      // Text is built from constants and computed numbers, never user input.
      // The rotation travels as a custom property so the centring transform
      // stays in the stylesheet.
      html: `<span style="--rot:${angle.toFixed(1)}deg">${text}</span>`,
      iconSize: [0, 0],
    }),
  }).addTo(projectionLayer);
}

// Every tap on the map goes through here, so the lock has exactly one place
// to take effect - and says so instead of quietly doing nothing.
function requestTarget(latlng) {
  if (targetLocked) {
    showSnack('Ziel ist fixiert – zum Ändern erst „Ziel löschen“');
    return;
  }
  setTarget(latlng);
}

// Own pin instead of Leaflet's image: only an element of our own can be kept
// upright while the map turns underneath it.
function targetIcon() {
  return L.divIcon({
    className: 'target-icon',
    html: '<svg viewBox="0 0 24 34" aria-hidden="true">' +
      '<path d="M12 1.6c5 0 9.1 4 9.1 8.9 0 6.4-9.1 21.9-9.1 21.9S2.9 16.9 2.9 10.5' +
      'c0-4.9 4.1-8.9 9.1-8.9z" fill="#4a9bff" stroke="#06131f" stroke-width="1.6"/>' +
      '<circle cx="12" cy="10.5" r="3.5" fill="#e6eaef"/>' +
      '</svg>',
    iconSize: [30, 42],
    iconAnchor: [15, 40],
  });
}

function setTarget(latlng) {
  targetLatLng = { lat: latlng.lat, lng: latlng.lng };
  if (!targetMarker) {
    targetMarker = L.marker(latlng, { title: 'Ziel', icon: targetIcon() }).addTo(map);
  } else {
    targetMarker.setLatLng(latlng);
  }
  document.getElementById('navpanel').classList.remove('hidden');
  redrawTargetLine();
  armTargetLock();
  // Fill the card straight away instead of waiting for the next GPS fix: a
  // freshly set destination showing nothing but dashes looks broken.
  const last = lastFixes[lastFixes.length - 1];
  if (last) updateNavPanel(last);
}

// Restarts the countdown: while the destination is still being adjusted, every
// change pushes the lock a minute further out.
function armTargetLock() {
  clearTimeout(targetLockTimer);
  targetLocked = false;
  updateTargetLockUi();
  targetLockTimer = setTimeout(lockTarget, TARGET_LOCK_MS);
}

function lockTarget() {
  if (!targetLatLng) return;
  targetLocked = true;
  updateTargetLockUi();
  showSnack('Ziel fixiert');
}

// The state has to be visible on the map itself, not only in the card: the
// card may be collapsed, and the marker is what the tap was aimed at.
function updateTargetLockUi() {
  document.getElementById('target-lock-hint').classList.toggle('hidden', !targetLocked);
  const el = targetMarker && targetMarker.getElement();
  if (el) el.classList.toggle('target-locked', targetLocked);
}

function redrawTargetLine() {
  if (!targetLatLng || !positionMarker) return;
  const start = positionMarker.getLatLng();
  const points = [[start.lat, start.lng], [targetLatLng.lat, targetLatLng.lng]];
  if (!targetLine) {
    targetLineCasing = L.polyline(points, {
      color: TARGET_LINE_CASING, weight: 6, opacity: 0.75, interactive: false,
    }).addTo(map);
    targetLine = L.polyline(points, {
      color: TARGET_LINE_COLOUR, weight: 3, dashArray: '9 6', interactive: false,
    }).addTo(map);
  } else {
    targetLineCasing.setLatLngs(points);
    targetLine.setLatLngs(points);
  }
}

function clearTarget() {
  clearTimeout(targetLockTimer);
  targetLocked = false;
  targetLatLng = null;
  if (targetMarker) { map.removeLayer(targetMarker); targetMarker = null; }
  if (targetLine) { map.removeLayer(targetLine); targetLine = null; }
  if (targetLineCasing) { map.removeLayer(targetLineCasing); targetLineCasing = null; }
  document.getElementById('navpanel').classList.add('hidden');
  document.getElementById('target-lock-hint').classList.add('hidden');
}

// One short message at a time; a second one replaces the first rather than
// queueing up behind it.
function showSnack(text) {
  const el = document.getElementById('snackbar');
  el.textContent = text;
  el.classList.add('is-visible');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => el.classList.remove('is-visible'), SNACK_MS);
}

// --- UI updates --------------------------------------------------------

function updateStatusBar() {
  const unit = SPEED_UNITS[speedUnit];
  document.getElementById('val-heading').textContent =
    currentHeadingDeg !== null ? `${Math.round(currentHeadingDeg)}°` : '–';
  document.getElementById('val-speed').textContent =
    (currentSpeedMs * unit.perMs).toFixed(1);
  document.getElementById('val-speed-unit').textContent = unit.label;
}

function storedSpeedUnit() {
  try {
    return localStorage.getItem(SPEED_UNIT_KEY) === 'kmh' ? 'kmh' : 'kn';
  } catch (e) {
    return 'kn';
  }
}

function setSpeedUnit(unit) {
  speedUnit = SPEED_UNITS[unit] ? unit : 'kn';
  try {
    localStorage.setItem(SPEED_UNIT_KEY, speedUnit);
  } catch (e) { /* the choice then just will not survive a reload */ }
  updateStatusBar();
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
    document.getElementById('val-eta').textContent = formatEta(etaSec);
  } else {
    document.getElementById('val-eta').textContent = '–';
  }
}

// Caption on a mark: metres up to a kilometre, then kilometres - "1000 m" is
// a number to decode, "1 km" is one to read.
function formatMarkDistance(m) {
  return m >= 1000 ? `${m / 1000} km` : `${m} m`;
}

function formatDistance(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

/*
 * Whole minutes, never seconds. An ETA computed from a smoothed GPS speed is
 * not accurate to the second, and a seconds digit that races is only noise on
 * a figure meant to be glanced at. Past an hour it goes over to quarter hours,
 * see formatQuarterHours().
 */
function formatEta(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '–';
  const min = Math.round(sec / 60);
  if (min < 1) return '< 1 min';
  if (min < 60) return `${min} min`;
  return formatQuarterHours(min);
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
  document.getElementById('btn-map-mode').addEventListener('click', onMapModeTap);

  document.getElementById('btn-speed-unit').addEventListener('click', () => {
    setSpeedUnit(speedUnit === 'kn' ? 'kmh' : 'kn');
  });

  document.getElementById('btn-zoom-in').addEventListener('click', () => map.zoomIn());
  document.getElementById('btn-zoom-out').addEventListener('click', () => map.zoomOut());

  // Turning the map with two fingers changes the mode from under us.
  document.addEventListener('seenavi:orientation', () => {
    refreshMapModeUi();
    const last = lastFixes[lastFixes.length - 1];
    if (last) updateCourseLine(last);
  });

  document.getElementById('btn-toggle-storage').addEventListener('click', () => {
    if (togglePanel('storagepanel')) refreshCacheStats();
  });

  document.getElementById('btn-toggle-proj').addEventListener('click', () => {
    projectionEnabled = !projectionEnabled;
    document.getElementById('btn-toggle-proj').classList.toggle('is-active', projectionEnabled);
    // Redraw straight away instead of waiting for the next GPS fix, which may
    // be seconds off - the button has to feel like it did something.
    const last = lastFixes[lastFixes.length - 1];
    if (last) {
      updateCourseLine(last);
    } else {
      removeCourseLine();
      if (projectionLayer) projectionLayer.clearLayers();
    }
  });

  document.getElementById('btn-clear-target').addEventListener('click', clearTarget);

  wireNavCollapse();

  // The marks start enabled, so their control starts active; following starts
  // on as well.
  document.getElementById('btn-toggle-proj').classList.add('is-active');
  setFollow(true);
  setOrientation(storedOrientation());
  setSpeedUnit(storedSpeedUnit());
}

/*
 * North-up or course-up. North-up is the chart-reading mode: it matches the
 * paper chart and the surroundings keep their places. Course-up is the
 * steering mode: what is drawn ahead is what lies ahead. Which one is wanted
 * is a matter of the moment, so it is a switch, and the choice is remembered.
 */
function storedOrientation() {
  try {
    return localStorage.getItem(ORIENTATION_KEY) === 'course' ? 'course' : 'north';
  } catch (e) {
    return 'north';
  }
}

function setOrientation(mode) {
  MapOrientation.setMode(mode);
  refreshMapModeUi();
  try {
    // A map turned by hand is a passing thing, not a setting: it leaves the
    // stored choice alone, so the next start comes up as chosen.
    if (mode !== 'manual') localStorage.setItem(ORIENTATION_KEY, mode);
  } catch (e) { /* the choice then just will not survive a reload */ }

  // Take up the current heading straight away instead of waiting for the next
  // fix, and redraw the marks: their angles are computed against the rotation.
  MapOrientation.setHeading(currentHeadingDeg);
  const last = lastFixes[lastFixes.length - 1];
  if (last) updateCourseLine(last);
}

/*
 * One button for position and orientation, the way a phone map does it: the
 * first tap fetches the boat back, every further tap switches between north-up
 * and course-up. Two buttons for two halves of the same question - "where am I
 * and which way round" - were one button too many on a screen that is mostly
 * chart.
 *
 * A map turned by hand counts as "away": the tap that brings the boat back
 * straightens it too, rather than leaving the chart at an angle nobody asked
 * for any more.
 */
function onMapModeTap() {
  if (!followMode || MapOrientation.mode === 'manual') {
    setFollow(true);
    if (MapOrientation.mode === 'manual') setOrientation('north');
    // Keeping the zoom is the point: the tap means "back to me", not "start
    // over at some zoom level I did not choose".
    if (positionMarker) map.setView(positionMarker.getLatLng(), map.getZoom());
    return;
  }
  setOrientation(MapOrientation.mode === 'course' ? 'north' : 'course');
}

function refreshMapModeUi() {
  const mode = MapOrientation.mode;
  const courseUp = mode === 'course';
  const button = document.getElementById('btn-map-mode');
  // Following is what the filled state means, and it decides the symbol: a
  // crosshair while the boat has to be fetched back, a compass once it is
  // centred and the tap changes the orientation instead.
  button.classList.toggle('is-active', followMode);
  button.classList.toggle('is-following', followMode);
  // The N belongs to a needle that stands upright; turned it would only lie on
  // its side.
  button.classList.toggle('is-turned', mode !== 'north');
  button.setAttribute('aria-pressed', followMode ? 'true' : 'false');
  if (!followMode) {
    button.title = 'Zur eigenen Position';
  } else if (courseUp) {
    button.title = 'Karte dreht sich in Fahrtrichtung – tippen für Nordung';
  } else if (mode === 'manual') {
    button.title = 'Karte von Hand gedreht – tippen richtet sie nach Norden aus';
  } else {
    button.title = 'Karte nach Norden – tippen für Fahrtrichtung';
  }
}

/*
 * Fullscreen.
 *
 * Android has no way to hide the bottom system bar by itself: the Fullscreen
 * API takes both bars or neither, and the selective immersive mode Android
 * apps use is not reachable from a web page. So the trade is made explicit -
 * normally the phone's bars stay visible, because clock and battery belong on
 * a boat, and one tap gives the whole screen instead.
 *
 * Only offered where the browser actually has fullscreen to give: iOS grants
 * it to video elements alone, and a button that cannot do anything is worse
 * than no button.
 */
function wireFullscreen() {
  const button = document.getElementById('btn-fullscreen');
  if (!document.fullscreenEnabled) return;
  button.classList.remove('hidden');

  button.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* already on the way out */ });
    } else {
      // Needs a user gesture, which a click is - a refusal is not worth a
      // message, the button simply stays as it was.
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.title = on ? 'Vollbild beenden' : 'Vollbild';
    document.getElementById('ic-fullscreen-use')
      .setAttribute('href', on ? '#ic-fullscreen-exit' : '#ic-fullscreen');
    // The safe areas change with the system bars, so the strip below the
    // buttons is a different height now.
    fitControlsAboveFooter();
    map.invalidateSize({ animate: false });
  });
}

/*
 * The buttons have to clear the footer strip, and how tall that is depends on
 * how its three lines wrap - which depends on the screen, the font size the
 * user has set, and how many chart layers are switched on. Measuring beats
 * guessing a constant that is wrong on somebody's phone.
 */
function fitControlsAboveFooter() {
  const footer = document.getElementById('footer');
  if (!footer) return;
  const height = Math.ceil(footer.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--controls-bottom', `${height + 10}px`);
}

// --- Boot ----------------------------------------------------------------

function boot() {
  document.getElementById('app-version').textContent = APP_VERSION;
  initMap();
  maintainCache();
  wireLayerPanel();
  wireAisLink();
  wireStoragePanel();
  wireToolbar();
  startTracking();
  wireFullscreen();
  fitControlsAboveFooter();
  window.addEventListener('resize', fitControlsAboveFooter);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline app-shell caching is a nice-to-have; ignore failures (e.g. file://).
    });
  }
}

document.addEventListener('DOMContentLoaded', boot);

/*
 * Chart sources.
 *
 * Each source owns exactly one function that turns a tile coordinate into a
 * URL. Display layer and offline downloader both go through it, so the two
 * can never disagree about what a given tile is - a mismatch would only
 * surface offline, which is the worst possible moment.
 *
 * thought up by human, coded by ai
 */

// --- Web Mercator tile maths ---------------------------------------------

const WEB_MERCATOR_HALF = 20037508.342789244;

// Bounding box of a slippy-map tile in EPSG:3857, as WMS GetMap needs it.
function tileBBox3857(z, x, y) {
  const span = (WEB_MERCATOR_HALF * 2) / Math.pow(2, z);
  const minX = -WEB_MERCATOR_HALF + x * span;
  const maxY = WEB_MERCATOR_HALF - y * span;
  return { minX, minY: maxY - span, maxX: minX + span, maxY };
}

// --- Kartverket raster sea chart (WMTS) ----------------------------------

const WMTS_BASE = 'https://cache.kartverket.no/v1/service';

// Measured against the live service: real chart detail stops at about z15,
// above that the cache only upsamples (see docs/bugs.md, B3). Capping here
// means Leaflet scales the z15 tile smoothly instead of the service handing
// back hard-edged blocks - and nothing is stored that carries no information.
const SEA_CHART_NATIVE_MAX_ZOOM = 15;

// Capabilities declare the tile matrix identifiers zero-padded, "00".."18".
function kartverketWmtsUrl(layerName) {
  return function (z, x, y) {
    return `${WMTS_BASE}?service=WMTS&request=GetTile&version=1.0.0` +
      `&layer=${layerName}&style=default&format=image/png` +
      `&tilematrixset=webmercator&tilematrix=${String(z).padStart(2, '0')}` +
      `&tilerow=${y}&tilecol=${x}`;
  };
}

/*
 * Land base. Deliberately not tile.openstreetmap.org: its usage policy
 * forbids bulk downloading, and "save this area for offline use" is exactly
 * what this app does - such clients get blocked without notice. Kartverket's
 * own topographic map is the open, reuse-friendly equivalent for Norway, and
 * "graatone" (grey tone) stays quiet under the depth contours and seamarks
 * instead of competing with them for attention.
 */
const landUrl = kartverketWmtsUrl('topograatone');
const seaChartUrl = kartverketWmtsUrl('sjokartraster');

// --- Kartverket depth data (WMS) -----------------------------------------

const DEPTH_WMS = 'https://wms.geonorge.no/skwms1/wms.dybdedata2';

/*
 * A WMS renders the requested box at the requested pixel size, so unlike the
 * tile cache it has no resolution ceiling. Two knobs matter together:
 *
 *   - asking for OVERSAMPLE times the pixels sharpens the image on a phone
 *     screen, which runs at devicePixelRatio 2-3;
 *   - on its own that also shrinks everything, because the server draws lines
 *     and labels at a fixed pixel size and we then display the larger image
 *     in the same CSS space.
 *
 * MAP_RESOLUTION is MapServer's scaling factor for symbology (default 72 dpi),
 * and this service is MapServer - its error responses name msShapefileOpen.
 * It is what decouples the two: the pixel count controls sharpness, the
 * resolution controls how large lines and labels are drawn.
 */
const DEPTH_OVERSAMPLE = 2;
const DEPTH_BASE_DPI = 72;

/*
 * How much larger than nominal the depth figures and contour lines should
 * draw. This is a separate knob from the oversampling on purpose: raising
 * MAP_RESOLUTION in step with the pixel count only keeps symbols at their
 * nominal size, and nominal is too small to read at a glance on a boat.
 * The two multiply, so 2x oversampling with 2x symbols means
 * MAP_RESOLUTION = 72 * 2 * 2 = 288 while the tile still carries 2x the
 * pixels - bigger and sharper, not one at the cost of the other.
 */
const DEPTH_SYMBOL_SCALE = 2;

function depthUrl(z, x, y) {
  const bbox = tileBBox3857(z, x, y);
  const px = 256 * DEPTH_OVERSAMPLE;
  const params = new URLSearchParams({
    service: 'WMS',
    request: 'GetMap',
    version: '1.3.0',
    layers: 'Dybdedata2',
    styles: '',
    format: 'image/png',
    transparent: 'true',
    crs: 'EPSG:3857',
    bbox: `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`,
    width: String(px),
    height: String(px),
    map_resolution: String(DEPTH_BASE_DPI * DEPTH_OVERSAMPLE * DEPTH_SYMBOL_SCALE),
  });
  return `${DEPTH_WMS}?${params}`;
}

// --- OpenSeaMap seamarks -------------------------------------------------

function seamarkUrl(z, x, y) {
  return `https://tiles.openseamap.org/seamark/${z}/${x}/${y}.png`;
}

// --- Registry ------------------------------------------------------------

/*
 * Order is draw order: land at the bottom, depth data above it because that
 * is the layer that stays sharp at every zoom, seamarks on top so buoys and
 * beacons are never hidden by anything.
 */
const CHART_SOURCES = [
  {
    id: 'land',
    label: 'Landkarte',
    url: landUrl,
    minZoom: 4,
    maxNativeZoom: 18,
    opaque: true,
    defaultOn: true,
    attribution: '&copy; Kartverket',
  },
  {
    id: 'seachart',
    label: 'Seekarte (Raster)',
    url: seaChartUrl,
    minZoom: 4,
    // Measured native limit, see docs/bugs.md B3.
    maxNativeZoom: SEA_CHART_NATIVE_MAX_ZOOM,
    opaque: true,
    // Off by default: too coarse to navigate by, but it still carries chart
    // symbology the other layers lack - traffic separation, restricted areas,
    // cables - so it stays available rather than being deleted.
    defaultOn: false,
    attribution: '&copy; Kartverket',
  },
  {
    id: 'depth',
    label: 'Tiefendaten',
    url: depthUrl,
    minZoom: 8,
    maxNativeZoom: 18,
    opaque: false,
    defaultOn: true,
    attribution: '&copy; Kartverket',
  },
  {
    id: 'seamarks',
    label: 'Seezeichen',
    url: seamarkUrl,
    minZoom: 9,
    maxNativeZoom: 18,
    opaque: false,
    defaultOn: true,
    attribution: '&copy; OpenSeaMap (CC-BY-SA)',
  },
];

// Highest zoom the map itself allows. Above a source's maxNativeZoom Leaflet
// scales its last real tile rather than requesting one that does not exist.
const MAP_MAX_ZOOM = 18;

function sourceById(id) {
  return CHART_SOURCES.find((s) => s.id === id) || null;
}

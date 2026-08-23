/*
 * Chart sources.
 *
 * Each source owns exactly one function that turns a tile coordinate into a
 * URL, and one stable id. The id is also the cache namespace, so changing
 * what a source actually serves means giving it a new id - otherwise tiles
 * cached from the old service would be handed out as if they came from the
 * new one.
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

// --- OpenStreetMap base --------------------------------------------------

/*
 * Global coverage, which is the point: the boat may be in Norway this year
 * and in the Mediterranean the next, and a national map would have to be
 * swapped every time.
 *
 * The usage policy of tile.openstreetmap.org forbids bulk downloading -
 * prefetching tiles nobody has looked at yet, which is what an "download this
 * area" button does. Keeping tiles the user actually viewed is explicitly the
 * permitted case, so the cache stays; the area downloader does not.
 */
function osmUrl(z, x, y) {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

// --- Kartverket depth data (WMS) -----------------------------------------

const DEPTH_WMS = 'https://wms.geonorge.no/skwms1/wms.dybdedata2';

/*
 * A WMS renders the requested box at the requested pixel size, so unlike a
 * tile cache it has no resolution ceiling. Two knobs matter, and they are
 * deliberately separate:
 *
 *   - OVERSAMPLE controls sharpness: asking for more pixels than the tile is
 *     displayed at compensates for phone screens running at devicePixelRatio
 *     2-3.
 *   - SYMBOL_SCALE controls size. Oversampling alone shrinks everything,
 *     because MapServer draws lines and labels at a fixed pixel size and the
 *     larger image is then shown in the same CSS space.
 *
 * MAP_RESOLUTION is MapServer's symbology scaling factor (default 72 dpi) -
 * that this service is MapServer is visible in its own error responses, which
 * name msShapefileOpen. The two multiply into it.
 */
const DEPTH_OVERSAMPLE = 2;
const DEPTH_BASE_DPI = 72;
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

// Highest zoom the map allows. Above a source's maxNativeZoom Leaflet scales
// its last real tile rather than requesting one that does not exist.
const MAP_MAX_ZOOM = 19;

/*
 * Order is draw order: base at the bottom, depth data above it, seamarks on
 * top so buoys and beacons are never hidden by anything.
 */
const CHART_SOURCES = [
  {
    id: 'osm',
    label: 'Grundkarte (OSM)',
    url: osmUrl,
    minZoom: 3,
    maxNativeZoom: 19,
    opaque: true,
    defaultOn: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: 'depth',
    // Kartverket covers Norwegian waters only. Outside them the layer simply
    // renders nothing, which costs nothing - so it stays available rather
    // than being dropped for the sake of portability.
    label: 'Tiefendaten (nur Norwegen)',
    url: depthUrl,
    minZoom: 8,
    // A WMS has no tile pyramid, so it can render every zoom the map offers.
    maxNativeZoom: MAP_MAX_ZOOM,
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

function sourceById(id) {
  return CHART_SOURCES.find((s) => s.id === id) || null;
}

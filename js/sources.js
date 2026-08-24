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
 * Sharpness. A WMS renders the requested box at the requested pixel size, so
 * unlike a tile cache it has no resolution ceiling: asking for OVERSAMPLE
 * times the pixels compensates for phone screens running at devicePixelRatio
 * 2-3.
 *
 * MAP_RESOLUTION must then rise by exactly the same factor, and no more.
 * MapServer uses it twice: it scales symbol sizes, line widths and labels -
 * which is what keeps them from shrinking when the image gets larger - but it
 * also enters the scale denominator the server computes for the request.
 * Doubling the pixel count halves that denominator, doubling the resolution
 * doubles it, and the two cancel. The server then renders exactly the detail
 * that belongs at this zoom, only with more pixels.
 *
 * Pushing MAP_RESOLUTION beyond that to enlarge the symbols breaks the
 * cancellation: the server believes the map is zoomed further out than it is
 * and drops scale-dependent layers. Concretely, at 72 * 2 * 2 = 288 the coarse
 * deep-water objects still drew but the fine shallow-water contours - the ones
 * that actually matter close inshore - silently disappeared.
 *
 * Larger symbols are therefore not available from this service without losing
 * detail, and detail wins. Zooming in one more step is the way to read them.
 */
const DEPTH_OVERSAMPLE = 2;
const DEPTH_BASE_DPI = 72;

/*
 * The service groups its sub-layers under "Dybdedata2". Requesting that group
 * draws soundings, shoals and skerries but no depth contours, so the contour
 * sub-layer is requested separately rather than as part of the group.
 *
 * Separately, and not merged into one request, on purpose: a WMS rejects the
 * whole GetMap when any one layer name is unknown. Kept apart, a wrong guess
 * costs only its own layer instead of blanking the depth data entirely.
 */
function depthLayerUrl(layerName) {
  return function (z, x, y) {
    return buildDepthUrl(layerName, z, x, y);
  };
}

function buildDepthUrl(layerName, z, x, y) {
  const bbox = tileBBox3857(z, x, y);
  const px = 256 * DEPTH_OVERSAMPLE;
  const params = new URLSearchParams({
    service: 'WMS',
    request: 'GetMap',
    version: '1.3.0',
    layers: layerName,
    styles: '',
    format: 'image/png',
    transparent: 'true',
    crs: 'EPSG:3857',
    bbox: `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`,
    width: String(px),
    height: String(px),
    map_resolution: String(DEPTH_BASE_DPI * DEPTH_OVERSAMPLE),
  });
  return `${DEPTH_WMS}?${params}`;
}

const depthUrl = depthLayerUrl('Dybdedata2');
const contourUrl = depthLayerUrl('Dybdekontur');

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
    /*
     * The service renders a complete nautical chart, water areas and coastline
     * included, and those fills are opaque - they blanked out whatever OSM had
     * drawn underneath, most visibly bridges and road shields.
     *
     * Multiply blending fixes that without having to guess at sub-layer names:
     * light fills let the base map through untouched, while the dark ink of
     * contours, soundings and symbols stays exactly as dark as before.
     */
    blend: 'multiply',
    defaultOn: true,
    attribution: '&copy; Kartverket',
  },
  {
    id: 'contours',
    label: 'Tiefenlinien (nur Norwegen)',
    url: contourUrl,
    minZoom: 8,
    maxNativeZoom: MAP_MAX_ZOOM,
    opaque: false,
    /*
     * No multiply here, unlike the group layer. Multiply exists to let opaque
     * area fills through, and a contour layer draws only lines on a
     * transparent ground - it has nothing to blend away. Worse, chart contours
     * are drawn in a pale blue, and pale blue multiplied with the pale blue of
     * OSM's water is very nearly no change at all. The soundings are almost
     * black and survived it; the lines did not.
     *
     * The filter darkens and saturates what the service draws, so a hairline
     * contour reads against the water instead of disappearing into it. Alpha
     * is untouched by both, so the transparent ground stays transparent.
     */
    filter: 'contours',
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

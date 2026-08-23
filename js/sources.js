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
function seaChartUrl(z, x, y) {
  return `${WMTS_BASE}?service=WMTS&request=GetTile&version=1.0.0` +
    '&layer=sjokartraster&style=default&format=image/png' +
    `&tilematrixset=webmercator&tilematrix=${String(z).padStart(2, '0')}` +
    `&tilerow=${y}&tilecol=${x}`;
}

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
 * Raising it in step with the pixel count keeps lines and labels at their
 * intended size while the detail gets sharper.
 */
const DEPTH_OVERSAMPLE = 2;
const DEPTH_BASE_DPI = 72;

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
    map_resolution: String(DEPTH_BASE_DPI * DEPTH_OVERSAMPLE),
  });
  return `${DEPTH_WMS}?${params}`;
}

// --- OpenSeaMap seamarks -------------------------------------------------

function seamarkUrl(z, x, y) {
  return `https://tiles.openseamap.org/seamark/${z}/${x}/${y}.png`;
}

// --- Registry ------------------------------------------------------------

/*
 * Order is draw order: the raster chart gives coastline and context, the
 * depth data goes on top because it is the layer that stays sharp, and the
 * seamarks sit above both so buoys and beacons are never hidden.
 */
const CHART_SOURCES = [
  {
    id: 'seachart',
    label: 'Seekarte',
    url: seaChartUrl,
    minZoom: 4,
    maxNativeZoom: SEA_CHART_NATIVE_MAX_ZOOM,
    opaque: true,
    attribution: '&copy; Kartverket',
  },
  {
    id: 'depth',
    label: 'Tiefendaten',
    url: depthUrl,
    minZoom: 8,
    maxNativeZoom: 18,
    opaque: false,
    attribution: '&copy; Kartverket',
  },
  {
    id: 'seamarks',
    label: 'Seezeichen',
    url: seamarkUrl,
    minZoom: 9,
    maxNativeZoom: 18,
    opaque: false,
    attribution: '&copy; OpenSeaMap (CC-BY-SA)',
  },
];

// Highest zoom the map itself allows. Above a source's maxNativeZoom Leaflet
// scales its last real tile rather than requesting one that does not exist.
const MAP_MAX_ZOOM = 18;

function sourceById(id) {
  return CHART_SOURCES.find((s) => s.id === id) || null;
}

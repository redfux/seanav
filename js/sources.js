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
 * and drops scale-dependent layers. At 72 * 2 * 2 = 288 the coarse deep-water
 * objects still drew while the fine inshore detail silently thinned out.
 *
 * Larger symbols are therefore not available from this service without losing
 * detail, and detail wins. Zooming in one more step is the way to read them.
 */
const DEPTH_OVERSAMPLE = 2;
const DEPTH_BASE_DPI = 72;

/*
 * The service groups its sub-layers under "Dybdedata2": depth-band areas
 * (Dybdelag), soundings (Dybdepunkt), depth contours (Dybdekontur) plus shoal
 * and skerry symbols. The group is requested as a whole - that name is the
 * only one certain to cover everything the service holds here, and a WMS
 * rejects the entire GetMap as soon as one layer name in it is unknown.
 *
 * The contour sub-layer was requested separately for a while, on the
 * assumption that the group omits it. Measured per pixel at 60.31821,
 * 4.97209: Dybdekontur answers HTTP 200 with an empty tile, while Dybdelag
 * covers 75 % of the very same tile. The contours are not missing from the
 * request, they are missing from the data - so the extra request only doubled
 * the traffic and its layer switch promised something the service cannot
 * deliver inshore.
 */
const DEPTH_LAYER = 'Dybdedata2';

function depthUrl(z, x, y) {
  const bbox = tileBBox3857(z, x, y);
  const px = 256 * DEPTH_OVERSAMPLE;
  const params = new URLSearchParams({
    service: 'WMS',
    request: 'GetMap',
    version: '1.3.0',
    layers: DEPTH_LAYER,
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

// --- EMODnet depth contours (WMS) ----------------------------------------

/*
 * Depth contours for all European waters, including the Canaries and the
 * Mediterranean - the one candidate that covers more than a single country.
 * Measured at 28.00902, -16.58136 (south of Tenerife), z13: 2,12 % of the tile
 * drawn, darkest pixel 0 of 255. Lines on transparent ground, in black ink -
 * so this layer needs neither blend mode nor filter.
 *
 * The colour-shaded siblings of this layer (mean_multicolour and friends) are
 * deliberately not here: they paint the whole sea and bury the base map for a
 * gain nobody asked for. Lines are what a chart reads by.
 *
 * Resolution of the source is about 115 m, so beyond maxNativeZoom there is no
 * more detail to fetch - Leaflet scales the last real tile instead, which is
 * honest about what the data can do.
 */
const EMODNET_WMS = 'https://ows.emodnet-bathymetry.eu/wms';

function emodnetContourUrl(z, x, y) {
  const bbox = tileBBox3857(z, x, y);
  const params = new URLSearchParams({
    service: 'WMS',
    request: 'GetMap',
    version: '1.3.0',
    layers: 'contours',
    styles: '',
    format: 'image/png',
    transparent: 'true',
    crs: 'EPSG:3857',
    bbox: `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`,
    // Native tile size: the line widths this service draws are meant for it.
    width: '256',
    height: '256',
  });
  return `${EMODNET_WMS}?${params}`;
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
    /*
     * Multiply alone is not enough for the depth bands. The service draws them
     * in very pale blue - measured at the position above, the darkest pixel of
     * the band sub-layer is 127 of 255 - and multiplied over the pale blue of
     * OSM's water the steps between the bands very nearly collapse into one
     * another.
     *
     * The filter pulls them apart before they are blended: saturation moves a
     * colour away from grey in proportion to the colour it already carries, so
     * a barely blue band shifts a lot while white deep water stays white and
     * the grey ink of contours, soundings and symbols is left alone. Alpha is
     * untouched, so the transparent ground stays transparent. The strength is
     * measured rather than guessed - see the table in style.css.
     */
    filter: 'depth',
    defaultOn: true,
    attribution: '&copy; Kartverket',
  },
  {
    id: 'emodnet-contours',
    label: 'Tiefenlinien (Europa)',
    url: emodnetContourUrl,
    // Below this the contours of a whole sea area collapse into a smudge.
    minZoom: 6,
    // The data is ~115 m; asking for more zoom levels would only be a bigger
    // picture of the same thing.
    maxNativeZoom: 15,
    opaque: false,
    defaultOn: true,
    attribution: '&copy; <a href="https://emodnet.ec.europa.eu/en/bathymetry">EMODnet Bathymetry</a> (CC-BY 4.0)',
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

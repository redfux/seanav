/*
 * Offline tile cache for Leaflet using IndexedDB.
 * Tiles are stored as Blobs keyed by "z/x/y" so the map keeps working
 * without a network connection once an area has been downloaded.
 *
 * thought up by human, coded by ai
 */

const TILE_DB_NAME = 'seenavi-tiles';
const TILE_DB_VERSION = 1;
const TILE_STORE = 'tiles';

// --- Kartverket WMTS ---------------------------------------------------
// Verified against the live GetCapabilities: the service offers layer
// "sjokartraster" on tile matrix set "webmercator" with 19 levels whose
// identifiers are zero-padded ("00" .. "18"). Passing an unpadded value works
// for two-digit zooms but is not what the capabilities declare, so pad it -
// otherwise zoom levels below 10 would send "4" instead of "04".
// The qualified form "webmercator:{z}" is NOT accepted (HTTP 500).
const TILE_URL_BASE = 'https://cache.kartverket.no/v1/service';
const SEA_CHART_LAYER = 'sjokartraster';
const SEA_CHART_MATRIX_SET = 'webmercator';
const SERVICE_MAX_ZOOM = 18;

/*
 * High-DPI handling. Phone screens run at devicePixelRatio 2-3, so a 256 px
 * tile drawn across 256 CSS px is stretched over ~2.6 device pixels each -
 * which turns the printed soundings and shoal symbols of the raster chart
 * into mush. Leaflet's detectRetina fetches one zoom level deeper and draws
 * it at half size, restoring roughly 1:1 pixel mapping.
 *
 * The offset must be known outside the layer too, because the offline
 * downloader has to store the same zoom levels the layer will ask for.
 * detectRetina applies exactly when L.Browser.retina is set and maxZoom > 0,
 * which is the condition mirrored here.
 */
const HIGH_DPI = L.Browser.retina;
const ZOOM_OFFSET = HIGH_DPI ? 1 : 0;

// Single place building tile URLs - display layer and offline downloader
// must never drift apart.
function seaTileUrl(z, x, y) {
  const matrix = String(z).padStart(2, '0');
  return `${TILE_URL_BASE}?service=WMTS&request=GetTile&version=1.0.0` +
    `&layer=${SEA_CHART_LAYER}&style=default&format=image/png` +
    `&tilematrixset=${SEA_CHART_MATRIX_SET}` +
    `&tilematrix=${matrix}&tilerow=${y}&tilecol=${x}`;
}

// Cache key. z is always the *service* zoom actually requested, not the map's
// zoom - with high-DPI the two differ by ZOOM_OFFSET.
function tileKey(z, x, y) {
  return `${z}/${x}/${y}`;
}

// Wraps IndexedDB access behind a small promise-based API.
const TileStore = {
  _dbPromise: null,

  open() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(TILE_DB_NAME, TILE_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TILE_STORE)) {
          db.createObjectStore(TILE_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._dbPromise;
  },

  async get(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILE_STORE, 'readonly');
      const req = tx.objectStore(TILE_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async put(key, blob) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILE_STORE, 'readwrite');
      tx.objectStore(TILE_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async has(key) {
    const val = await this.get(key);
    return val !== null;
  },

  // Rough estimate of cache size in MB, and tile count.
  async stats() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILE_STORE, 'readonly');
      const store = tx.objectStore(TILE_STORE);
      let count = 0;
      let bytes = 0;
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          count++;
          bytes += cursor.value.size || 0;
          cursor.continue();
        } else {
          resolve({ count, mb: bytes / (1024 * 1024) });
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  }
};

/*
 * Custom Leaflet tile layer that reads from IndexedDB first and only
 * falls back to the network (Kartverket WMTS) when a tile is missing.
 * Downloaded tiles are written back into the cache automatically, so
 * normal use while online gradually builds up an offline cache too.
 */
const OfflineWMTSLayer = L.TileLayer.extend({

  // Leaflet substitutes {z} itself; overridden so the zero-padded matrix
  // identifier and the cache key come from the same helper.
  getTileUrl: function (coords) {
    return seaTileUrl(this._getZoomForUrl(), coords.x, coords.y);
  },

  createTile: function (coords, done) {
    const img = document.createElement('img');
    img.setAttribute('role', 'presentation');
    // Service zoom, including the high-DPI offset. coords.z is the map's tile
    // zoom, which is one level lower whenever detectRetina is active.
    const z = this._getZoomForUrl();
    const key = tileKey(z, coords.x, coords.y);

    TileStore.get(key).then((blob) => {
      if (blob) {
        img.src = URL.createObjectURL(blob);
        done(null, img);
        return;
      }
      // Not cached: try the network. If offline, this rejects and we
      // show a placeholder instead of a broken image icon.
      const url = seaTileUrl(z, coords.x, coords.y);
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error('tile fetch failed: ' + res.status);
          return res.blob();
        })
        .then((fetchedBlob) => {
          TileStore.put(key, fetchedBlob).catch(() => { /* cache write is best-effort */ });
          img.src = URL.createObjectURL(fetchedBlob);
          done(null, img);
        })
        .catch(() => {
          img.src = this._placeholderDataUrl();
          img.classList.add('tile-missing');
          done(null, img);
        });
    });

    return img;
  },

  _placeholderDataUrl: function () {
    // 256x256 transparent-ish dark tile with subtle diagonal hatching,
    // so gaps in the offline cache are visible but not jarring.
    if (!this._placeholderCache) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0a141d';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(46,196,182,0.15)';
      ctx.lineWidth = 1;
      for (let i = -256; i < 256; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 256, 256);
        ctx.stroke();
      }
      this._placeholderCache = c.toDataURL();
    }
    return this._placeholderCache;
  }
});

/*
 * Builds an offline WMTS layer pointed at Kartverket's "sjokartraster"
 * nautical chart cache, using the standard webmercator tile matrix so
 * tile math matches normal XYZ/slippy conventions.
 */
function createSeaChartLayer() {
  return new OfflineWMTSLayer(TILE_URL_BASE, {
    minZoom: 4,
    // Highest level the service serves. With detectRetina active Leaflet
    // lowers the map's maxZoom by one and adds it back as zoomOffset, so the
    // requested service zoom still tops out at SERVICE_MAX_ZOOM.
    maxZoom: SERVICE_MAX_ZOOM,
    tileSize: 256,
    detectRetina: true,
    attribution: '&copy; Kartverket',
  });
}

/*
 * Downloads all tiles for the given map bounds across a zoom range and
 * stores them in IndexedDB. Reports progress via onProgress(done, total)
 * and can be aborted by calling the returned controller's cancel().
 *
 * minZoom/maxZoom are *map* zoom levels, i.e. what the user picks in the UI.
 * They are translated to service zoom levels via ZOOM_OFFSET so the stored
 * keys match exactly what the display layer will look up - otherwise the
 * download would silently fill the cache with tiles nobody ever requests.
 */
function downloadAreaForOffline(map, minZoom, maxZoom, onProgress) {
  let cancelled = false;
  const CONCURRENCY = 6;

  async function run() {
    // Collect every tile coordinate needed across all requested zoom levels.
    const bounds = map.getBounds();
    const jobs = [];
    for (let mapZoom = minZoom; mapZoom <= maxZoom; mapZoom++) {
      const z = Math.min(mapZoom + ZOOM_OFFSET, SERVICE_MAX_ZOOM);
      const nwPoint = latLngToTile(bounds.getNorthWest(), z);
      const sePoint = latLngToTile(bounds.getSouthEast(), z);
      for (let x = nwPoint.x; x <= sePoint.x; x++) {
        for (let y = nwPoint.y; y <= sePoint.y; y++) {
          jobs.push({ z, x, y });
        }
      }
    }

    // Clamping at SERVICE_MAX_ZOOM can map two map zooms onto one service
    // zoom; drop the duplicates so the progress total stays honest.
    const seen = new Set();
    const unique = jobs.filter((j) => {
      const k = tileKey(j.z, j.x, j.y);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    jobs.length = 0;
    jobs.push(...unique);

    const total = jobs.length;
    let done = 0;
    onProgress(done, total);

    let cursor = 0;
    async function worker() {
      while (cursor < jobs.length) {
        if (cancelled) return;
        const job = jobs[cursor++];
        const key = tileKey(job.z, job.x, job.y);
        const already = await TileStore.has(key);
        if (!already) {
          const url = seaTileUrl(job.z, job.x, job.y);
          try {
            const res = await fetch(url);
            if (res.ok) {
              const blob = await res.blob();
              await TileStore.put(key, blob);
            }
          } catch (e) {
            // Network hiccup on a single tile should not abort the whole batch.
          }
        }
        done++;
        onProgress(done, total);
      }
    }

    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
    await Promise.all(workers);
  }

  const promise = run();

  return {
    promise,
    cancel() { cancelled = true; }
  };
}

// Converts a LatLng to tile x/y at a given zoom (standard slippy-map math).
function latLngToTile(latlng, z) {
  const n = Math.pow(2, z);
  const x = Math.floor(((latlng.lng + 180) / 360) * n);
  const latRad = (latlng.lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

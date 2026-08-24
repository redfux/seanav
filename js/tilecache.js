/*
 * Tile cache for Leaflet using IndexedDB.
 *
 * Tiles are stored as Blobs keyed by "source/z/x/y" as they are viewed, so a
 * stretch already looked at keeps working when the signal drops. There is no
 * area pre-download: tile.openstreetmap.org forbids prefetching tiles nobody
 * has viewed yet, and keeping what was actually displayed is the permitted
 * case. See docs/architecture.md.
 *
 * thought up by human, coded by ai
 */

const TILE_DB_NAME = 'seenavi-tiles';
// v2 introduced the "source/z/x/y" key namespace. v1 keys were bare "z/x/y"
// and cannot be told apart from them, so that one upgrade had to clear the
// store. Since then stale entries are removed per source instead - see
// pruneRemovedSources() - which keeps everything still in use.
const TILE_DB_VERSION = 2;
const TILE_STORE = 'tiles';

function tileKey(sourceId, z, x, y) {
  return `${sourceId}/${z}/${x}/${y}`;
}

// Wraps IndexedDB access behind a small promise-based API.
const TileStore = {
  _dbPromise: null,

  open() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(TILE_DB_NAME, TILE_DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        if (event.oldVersion > 0 && db.objectStoreNames.contains(TILE_STORE)) {
          db.deleteObjectStore(TILE_STORE);
        }
        db.createObjectStore(TILE_STORE);
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

  async clear() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILE_STORE, 'readwrite');
      tx.objectStore(TILE_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // Deletes every tile belonging to sources that no longer exist. Keeping a
  // source's id stable is what makes this safe: a source that starts serving
  // something else gets a new id, so its old tiles land here and go, instead
  // of being handed out as if they came from the new service.
  async pruneRemovedSources(validIds) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILE_STORE, 'readwrite');
      const store = tx.objectStore(TILE_STORE);
      let removed = 0;
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const id = String(cursor.key).split('/')[0];
          if (!validIds.includes(id)) {
            cursor.delete();
            removed++;
          }
          cursor.continue();
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error);
    });
  },

  // Tile count and rough size in MB, overall and per source.
  async stats() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILE_STORE, 'readonly');
      const store = tx.objectStore(TILE_STORE);
      let count = 0;
      let bytes = 0;
      const bySource = {};
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const size = cursor.value.size || 0;
          count++;
          bytes += size;
          const id = String(cursor.key).split('/')[0];
          bySource[id] = bySource[id] || { count: 0, bytes: 0 };
          bySource[id].count++;
          bySource[id].bytes += size;
          cursor.continue();
        } else {
          resolve({ count, mb: bytes / (1024 * 1024), bySource });
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  },
};

/*
 * Tile layer that reads from IndexedDB first and only goes to the network
 * when a tile is missing. Fetched tiles are written back, so normal use while
 * online gradually builds the offline cache too.
 *
 * Works for any source in CHART_SOURCES: the URL always comes from the
 * source's own url() function, never from a Leaflet URL template, which is
 * what keeps display and offline download addressing tiles identically.
 */
const CachedTileLayer = L.TileLayer.extend({

  getTileUrl: function (coords) {
    return this.options.source.url(coords.z, coords.x, coords.y);
  },

  createTile: function (coords, done) {
    const source = this.options.source;
    const img = document.createElement('img');
    img.setAttribute('role', 'presentation');
    img.alt = '';
    // coords.z is already clamped to maxNativeZoom by Leaflet, so it is the
    // zoom actually requested - and therefore the right thing to key on.
    const key = tileKey(source.id, coords.z, coords.x, coords.y);
    const url = source.url(coords.z, coords.x, coords.y);

    TileStore.get(key).then((blob) => {
      if (blob) {
        img.src = URL.createObjectURL(blob);
        done(null, img);
        return;
      }
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
          // fetch() also fails when a host sends no CORS headers, even though
          // a plain <img> would load fine. Try that before giving up - such a
          // tile just cannot be cached for offline use.
          img.addEventListener('load', () => done(null, img), { once: true });
          img.addEventListener('error', () => {
            if (source.opaque) {
              img.src = this._placeholderDataUrl();
              img.classList.add('tile-missing');
            } else {
              img.src = TRANSPARENT_PIXEL;
            }
            done(null, img);
          }, { once: true });
          img.src = url;
        });
    });

    return img;
  },

  _placeholderDataUrl: function () {
    // 256x256 dark tile with subtle diagonal hatching, so gaps in the offline
    // cache are visible but not jarring. Only for the opaque base layer -
    // hatching every missing overlay tile would bury the chart.
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

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function createChartLayer(source) {
  return new CachedTileLayer('', {
    source: source,
    minZoom: source.minZoom,
    maxZoom: MAP_MAX_ZOOM,
    maxNativeZoom: source.maxNativeZoom,
    tileSize: 256,
    attribution: source.attribution,
    // Draw order must follow the registry, not the order layers happen to be
    // switched on: without this, a layer enabled last would sit on top of
    // everything, opaque fills included.
    zIndex: CHART_SOURCES.indexOf(source) + 1,
    // Blend mode and filter are properties of the source, applied to its tile
    // container.
    className: [
      source.blend ? `blend-${source.blend}` : '',
      source.filter ? `filter-${source.filter}` : '',
    ].filter(Boolean).join(' '),
  });
}

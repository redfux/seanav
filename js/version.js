/*
 * Single source of truth for the app version (SemVer, see docs/releases.md).
 * Loaded both by index.html (footer display) and by sw.js via importScripts,
 * so a release only ever needs this one line changed. The service worker
 * derives its shell cache name from it, which doubles as cache busting.
 *
 * thought up by human, coded by ai
 */

const APP_VERSION = '0.2.1';

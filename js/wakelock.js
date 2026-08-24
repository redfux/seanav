/*
 * Keeping the screen on.
 *
 * A navigation display that goes dark after 30 seconds is no navigation
 * display. While the app is in front, a screen wake lock keeps the phone
 * awake; the system releases it by itself as soon as the app moves to the
 * background, so nothing has to be given back manually and no battery is
 * burned on a phone in a pocket. Coming back to the foreground releases the
 * lock for good, hence the re-request on every visibility change.
 *
 * Some browsers only grant the lock after the user has touched the page. The
 * first refusal is therefore not reported but retried on the first tap; only
 * if that fails too does the app say so - a screen that may go dark is
 * something to know about before casting off, not after.
 *
 * thought up by human, coded by ai
 */

let wakeLock = null;
let wakeLockRetryArmed = false;
let wakeLockReported = false;

function wakeLockUnavailable(reason) {
  if (wakeLockReported) return;
  wakeLockReported = true;
  showSnack(reason === 'unsupported'
    ? 'Bildschirm kann abschalten – dieser Browser kennt keine Bildschirmsperre.'
    : 'Bildschirm kann abschalten – die Sperre wurde abgelehnt (Energiesparmodus?).');
}

async function requestWakeLock(afterGesture) {
  if (!('wakeLock' in navigator)) {
    wakeLockUnavailable('unsupported');
    return;
  }
  if (wakeLock || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) {
    // Denied without a user gesture, or the device is in battery saver mode.
    if (afterGesture) wakeLockUnavailable('denied');
    else armWakeLockRetry();
  }
}

function armWakeLockRetry() {
  if (wakeLockRetryArmed) return;
  wakeLockRetryArmed = true;
  document.addEventListener('pointerdown', () => requestWakeLock(true), { once: true });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestWakeLock(false);
});

document.addEventListener('DOMContentLoaded', () => requestWakeLock(false));

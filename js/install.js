/*
 * Installation hint.
 *
 * The app is only worth having on the home screen: installed it starts without
 * a browser bar, keeps its own storage, and opens without a signal. Browsers
 * offer that themselves, but hide it in a menu nobody opens while casting off,
 * so the app asks once - and only when the offer actually exists.
 *
 * Two paths, because the platforms differ:
 *   - Chromium fires "beforeinstallprompt". The event is kept and replayed
 *     when the button is pressed; the browser then shows its own dialog.
 *   - iOS has no such event at all. There the hint can only describe the
 *     manual route through the share sheet, so that is what it says.
 *
 * Nothing is shown when the app already runs installed, and a dismissal is
 * remembered - a hint that keeps coming back is an advert.
 *
 * thought up by human, coded by ai
 */

const INSTALL_DISMISSED_KEY = 'seenavi.install.dismissed';

// Kept from the browser's offer until the user presses the button. Chromium
// allows it to be replayed exactly once.
let deferredInstallPrompt = null;

function isInstalled() {
  // navigator.standalone is the iOS-only equivalent of the display-mode query.
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true;
}

function isIos() {
  // iPadOS reports itself as a Mac, and is told apart by the touch points.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function installDismissed() {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch (e) {
    return false; // private mode without storage: just show it
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
  } catch (e) { /* nothing to remember it with; the hint returns next time */ }
}

function hideInstallBanner() {
  document.getElementById('installbanner').classList.add('hidden');
}

function showInstallBanner(mode) {
  if (isInstalled() || installDismissed()) return;
  const banner = document.getElementById('installbanner');
  if (mode === 'ios') {
    document.getElementById('install-text').textContent =
      'Im Browsermenü „Teilen“ antippen, dann „Zum Home-Bildschirm“. Danach ' +
      'startet SeaGlimpse ohne Browserleiste und öffnet auch ohne Empfang.';
    // No programmatic installation on iOS - a button that cannot do anything
    // is worse than no button.
    document.getElementById('btn-install').classList.add('hidden');
  }
  banner.classList.remove('hidden');
}

window.addEventListener('beforeinstallprompt', (event) => {
  // Without this the browser shows its own bar at its own moment, which on a
  // full-screen map lands on top of the chart.
  event.preventDefault();
  deferredInstallPrompt = event;
  showInstallBanner('prompt');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  rememberDismissal();
  hideInstallBanner();
});

function wireInstallBanner() {
  document.getElementById('btn-install').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    // The event is spent either way; a declined installation can be started
    // again from the browser menu.
    deferredInstallPrompt = null;
    hideInstallBanner();
  });

  document.getElementById('btn-install-later').addEventListener('click', () => {
    rememberDismissal();
    hideInstallBanner();
  });

  // iOS never fires beforeinstallprompt, so the hint has to be offered on its
  // own - but only in Safari, which is the only browser there that can install.
  if (isIos() && !window.navigator.standalone &&
      /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)) {
    showInstallBanner('ios');
  }
}

document.addEventListener('DOMContentLoaded', wireInstallBanner);

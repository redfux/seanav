/*
 * Map orientation: north-up and course-up.
 *
 * Leaflet cannot turn a map, so the turning happens in CSS: the map container
 * is rotated about its centre. Two consequences have to be dealt with, and
 * they are the whole content of this file.
 *
 * 1. A rotated rectangle no longer covers the window - the corners run empty.
 *    The container is therefore made larger than the window, by the ratio of
 *    the window's diagonal to its shorter side, and the window clips the
 *    overhang. Leaflet loads tiles for the whole container, so the corners are
 *    covered at every angle.
 *
 * 2. Leaflet maps pointer positions and drags through the container's bounding
 *    rectangle, which for a rotated element is its axis-aligned box - so a tap
 *    would set a destination somewhere else entirely, and a drag would pan off
 *    at an angle. Both paths are patched here to turn screen coordinates back
 *    into container coordinates first.
 *
 * The alternative was the leaflet-rotate plugin, which does the same job more
 * thoroughly. It is GPL-3.0; this project is MIT, and bundling it would place
 * the whole app under copyleft. Not worth it for two coordinate transforms.
 *
 * thought up by human, coded by ai
 */

// Below this a new heading is ignored: GPS heading jitters by a degree or two
// even lying still, and a map that twitches is unusable.
const MAP_ROTATION_STEP_DEG = 2;

const MapOrientation = {
  mode: 'north',    // 'north' | 'course'
  bearing: 0,       // degrees the map is turned by; 0 in north-up

  _map: null,
  _viewport: null,

  init(map) {
    this._map = map;
    this._viewport = document.getElementById('mapviewport');
    window.addEventListener('resize', () => this._resizeContainer());
    this._resizeContainer();
  },

  isCourseUp() {
    return this.mode === 'course';
  },

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'north') this._applyBearing(0);
    // Inertia panning would coast off in the unrotated direction: the throw is
    // measured from raw screen positions, which this file does not correct.
    // Straight-line dragging is corrected and stays exact.
    this._map.options.inertia = (mode === 'north');
    this._resizeContainer();
  },

  // Called on every fix. Does nothing unless the map is course-up, and stays
  // put for small changes.
  setHeading(headingDeg) {
    if (!this.isCourseUp() || headingDeg === null) return;
    const delta = Math.abs(((headingDeg - this.bearing + 540) % 360) - 180);
    if (delta < MAP_ROTATION_STEP_DEG) return;
    this._applyBearing(headingDeg);
  },

  // Screen vector -> container vector. The map is turned by -bearing, so the
  // way back is a turn by +bearing.
  unrotate(dx, dy) {
    if (!this.bearing) return { x: dx, y: dy };
    const a = (this.bearing * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  },

  _applyBearing(deg) {
    this.bearing = ((deg % 360) + 360) % 360;
    const root = document.documentElement;
    // The map turns one way, everything that has to stay upright on screen -
    // the horizontal mark labels - turns back by the same amount.
    root.style.setProperty('--map-rot', `${(-this.bearing).toFixed(1)}deg`);
    root.style.setProperty('--map-counter-rot', `${this.bearing.toFixed(1)}deg`);
  },

  /*
   * Course-up needs a container big enough that no corner of the window is
   * ever left uncovered: the diagonal. North-up gets the window size, so the
   * usual case loads no more tiles than before.
   */
  _resizeContainer() {
    const root = document.documentElement;
    if (!this.isCourseUp()) {
      root.style.setProperty('--map-size-w', '100%');
      root.style.setProperty('--map-size-h', '100%');
    } else {
      const w = this._viewport.clientWidth;
      const h = this._viewport.clientHeight;
      const diagonal = Math.ceil(Math.hypot(w, h));
      root.style.setProperty('--map-size-w', `${diagonal}px`);
      root.style.setProperty('--map-size-h', `${diagonal}px`);
    }
    if (this._map) this._map.invalidateSize({ animate: false });
  },
};

/*
 * Pointer positions. Leaflet reads the container's bounding rectangle, which
 * for a turned element is the box around it - the mapping is then wrong
 * everywhere except at the centre. Rotation about the centre leaves the centre
 * where it is, so that is the fixed point to measure from.
 *
 * Patched on the map, not on L.DomEvent.getMousePosition: inside the bundled
 * Leaflet that helper is called through a module-internal name, so replacing
 * the exported one changes nothing. Everything that turns a pointer event into
 * coordinates - taps, double taps, pinch zoom - goes through this method.
 */
L.Map.prototype.mouseEventToContainerPoint = function (e) {
  const container = this._container;
  const rect = container.getBoundingClientRect();
  const v = MapOrientation.unrotate(
    e.clientX - (rect.left + rect.width / 2),
    e.clientY - (rect.top + rect.height / 2)
  );
  return new L.Point(v.x + container.offsetWidth / 2, v.y + container.offsetHeight / 2);
};

/*
 * Dragging. Leaflet moves the map pane by the raw screen offset since the drag
 * started; inside a turned container that offset points the wrong way, so a
 * drag towards the top of the screen pans south instead of ahead.
 *
 * The correction sits in _updatePosition, the one place that writes the pane
 * position - _onMove computes and applies in the same breath, so correcting
 * its result afterwards would come a step too late every time.
 *
 * Leaflet's own _startPos is not the position the pane started at: it is that
 * position minus the offset that got the drag over its threshold, so that the
 * pane follows the finger from where the drag was recognised. The real start
 * is therefore read off the element on the first update of each drag, and the
 * movement since is what gets turned.
 */
const _leafletUpdatePosition = L.Draggable.prototype._updatePosition;
L.Draggable.prototype._updatePosition = function () {
  if (MapOrientation.bearing && this._newPos && this._startPos &&
      this._newPos !== this._rotatedPos) {
    if (this._rotatedStart !== this._startPos) {
      this._rotatedStart = this._startPos;
      this._rotatedBase = L.DomUtil.getPosition(this._element);
    }
    // What Leaflet had already consumed before the drag counted as a drag.
    const consumed = this._rotatedBase.subtract(this._startPos);
    const moved = this._newPos.subtract(this._startPos).subtract(consumed);
    const v = MapOrientation.unrotate(moved.x, moved.y);
    this._newPos = this._rotatedBase.add(new L.Point(v.x, v.y));
    // Guards against a second run over an already turned position.
    this._rotatedPos = this._newPos;
  }
  _leafletUpdatePosition.call(this);
};

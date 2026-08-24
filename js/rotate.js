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

// Twist that has to be exceeded before two fingers count as turning rather
// than pinching - the two gestures share the same two fingers.
const TURN_GESTURE_START_DEG = 12;

// Released this close to north, the map goes to north exactly. Nobody wants a
// chart standing three degrees off true.
const TURN_SNAP_DEG = 8;

const MapOrientation = {
  // 'north'  - fixed to north
  // 'course' - follows the GPS heading
  // 'manual' - turned by hand and left there, like a paper chart on a table
  mode: 'north',
  bearing: 0,       // degrees the map is turned by; 0 in north-up

  _map: null,
  _viewport: null,
  _turnStartAngle: null,
  _turnStartBearing: 0,
  _turning: false,

  init(map) {
    this._map = map;
    this._viewport = document.getElementById('mapviewport');
    window.addEventListener('resize', () => this._resizeContainer());
    this._resizeContainer();
    this._wireTurnGesture(map.getContainer());
  },

  isCourseUp() {
    return this.mode === 'course';
  },

  // Any mode but north has the map standing at an angle, which is what decides
  // how big the container has to be and whether inertia can be trusted.
  isTurned() {
    return this.mode !== 'north';
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
    if (!this.isTurned()) {
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

  /*
   * Turning the map with two fingers.
   *
   * The same two fingers already pinch to zoom, and Leaflet reads their
   * distance for that. Their angle is the other half of the same gesture and
   * nobody is using it, so it is read here - both work at once, and a pinch
   * that happens to twist a little is kept from turning the chart by the
   * threshold above.
   *
   * Listeners are passive: Leaflet's own touch handling already suppresses the
   * browser's default for this gesture, and taking that decision twice would
   * only fight it.
   */
  _wireTurnGesture(container) {
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 2) return;
      this._turnStartAngle = this._touchAngle(e.touches);
      this._turnStartBearing = this.bearing;
      this._turning = false;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2 || this._turnStartAngle === null) return;
      const turned = this._angleDelta(this._touchAngle(e.touches), this._turnStartAngle);
      if (!this._turning) {
        if (Math.abs(turned) < TURN_GESTURE_START_DEG) return;
        this._beginTurn();
      }
      // Fingers turning clockwise turn the map clockwise, and the map is drawn
      // at minus the bearing - hence the sign.
      this._applyBearing(this._turnStartBearing - turned);
    }, { passive: true });

    const end = (e) => {
      if (e.touches.length >= 2 || this._turnStartAngle === null) return;
      this._turnStartAngle = null;
      if (!this._turning) return;
      this._turning = false;
      document.documentElement.classList.remove('is-turning');
      // Let go near north and it is north, exactly - and back to the
      // unmagnified container with it.
      const offNorth = Math.abs(((this.bearing + 180) % 360) - 180);
      this.setMode(offNorth <= TURN_SNAP_DEG ? 'north' : 'manual');
      this._resizeContainer();
      document.dispatchEvent(new CustomEvent('seenavi:orientation'));
    };
    container.addEventListener('touchend', end, { passive: true });
    container.addEventListener('touchcancel', end, { passive: true });
  },

  // The map leaves whatever mode it was in: from here on it stands where it
  // was put. Enlarging the container first keeps the corners covered.
  _beginTurn() {
    this._turning = true;
    document.documentElement.classList.add('is-turning');
    if (!this.isTurned()) {
      this.mode = 'manual';
      this._map.options.inertia = false;
      this._resizeContainer();
    } else {
      this.mode = 'manual';
    }
    document.dispatchEvent(new CustomEvent('seenavi:orientation'));
  },

  _touchAngle(touches) {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  },

  // Shortest way round, so passing 180 degrees does not spin the map about.
  _angleDelta(now, then) {
    return ((now - then + 540) % 360) - 180;
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

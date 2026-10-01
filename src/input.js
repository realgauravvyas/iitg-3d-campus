// Keyboard, mouse (pointer lock or drag-to-look) and touch controls.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.hits = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.locked = false;
    this.dragging = false;
    this.enabled = true;
    this.joy = { x: 0, y: 0, active: false };
    this.touchLook = null;
    this.remap = {};                 // physical key -> the key the game listens for (user rebinding)
    this.pad = { x: 0, y: 0, on: false, prev: [] };
    this.capture = null;             // waiting for a key to bind

    const typing = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '');
    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (this.capture) { e.preventDefault(); const f = this.capture; this.capture = null; f(e.code); return; }
      if (e.code === 'Tab') e.preventDefault();
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      const code = this.remap[e.code] || e.code;
      if (!this.keys.has(code)) this.hits.add(code);
      this.keys.add(code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(this.remap[e.code] || e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0 && this.locked) this.clicked = true;
      if (e.button === 0 && !this.locked && this.wantLock) {
        try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed */ }
      }
      this.dragging = true;
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || this.dragging) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheel += Math.sign(e.deltaY); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // touch: right half drags the camera
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) if (t.clientX > window.innerWidth * 0.4 && !this.touchLook) this.touchLook = { id: t.identifier, x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (this.touchLook && t.identifier === this.touchLook.id) {
        this.dx += (t.clientX - this.touchLook.x) * 1.6; this.dy += (t.clientY - this.touchLook.y) * 1.6;
        this.touchLook.x = t.clientX; this.touchLook.y = t.clientY;
      }
    }, { passive: true });
    const endTouch = (e) => { for (const t of e.changedTouches) if (this.touchLook && t.identifier === this.touchLook.id) this.touchLook = null; };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  /** Wire an on-screen joystick element + buttons with data-key attributes. */
  bindTouchUI(joyEl, knobEl, buttons) {
    const R = 50;
    let id = null, cx = 0, cy = 0;
    joyEl.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; id = t.identifier;
      const r = joyEl.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      this.joy.active = true; e.preventDefault();
    }, { passive: false });
    joyEl.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) {
        let x = t.clientX - cx, y = t.clientY - cy;
        const L = Math.hypot(x, y); if (L > R) { x *= R / L; y *= R / L; }
        this.joy.x = x / R; this.joy.y = -y / R;
        knobEl.style.transform = `translate(${x}px, ${y}px)`;
      }
      e.preventDefault();
    }, { passive: false });
    const end = () => { id = null; this.joy.x = this.joy.y = 0; this.joy.active = false; knobEl.style.transform = ''; };
    joyEl.addEventListener('touchend', end); joyEl.addEventListener('touchcancel', end);
    for (const b of buttons) {
      const code = b.dataset.key;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); this.hits.add(code); this.keys.add(code); }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.delete(code); }, { passive: false });
      b.addEventListener('click', () => { this.hits.add(code); setTimeout(() => this.keys.delete(code), 120); this.keys.add(code); });
    }
  }

  /** bind the physical key `phys` to the game key `logical` (the old key for it takes phys's job: a swap) */
  bind(logical, phys) {
    const cur = Object.keys(this.remap).find((k) => this.remap[k] === logical) || logical;
    const physWas = this.remap[phys] || phys;
    delete this.remap[cur]; delete this.remap[phys];
    if (phys !== logical) this.remap[phys] = logical;
    if (cur !== physWas) this.remap[cur] = physWas;
    for (const k of Object.keys(this.remap)) if (this.remap[k] === k) delete this.remap[k];
  }
  keyFor(logical) { return Object.keys(this.remap).find((k) => this.remap[k] === logical) || (this.remap[logical] ? null : logical); }

  /** gamepad: left stick moves, right stick looks; A interact, X jump, B bicycle, Y tour, RB drone,
   *  LB camera, LT sprint, RT photo, Back map, Start pause, D-pad: view / planner / journal / emote */
  pollPad() {
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    this.pad.on = !!gp;
    if (!gp) return;
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    this.pad.x = dz(gp.axes[0] || 0); this.pad.y = -dz(gp.axes[1] || 0);
    this.dx += dz(gp.axes[2] || 0) * 14; this.dy += dz(gp.axes[3] || 0) * 14;
    const MAP = ['KeyE', 'KeyB', 'Space', 'KeyT', 'KeyK', 'KeyG', 'ShiftLeft', 'Enter', 'KeyM', 'Escape', null, null, 'KeyV', 'KeyJ', 'Digit1', 'Tab'];
    gp.buttons.forEach((b, i) => {
      const code = MAP[i], was = this.pad.prev[i], now = b.pressed;
      if (!code) return;
      if (now && !was) { this.hits.add(code); if (code === 'Escape') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); }
      if (now) this.keys.add(code); else if (was) this.keys.delete(code);
      this.pad.prev[i] = now;
    });
  }

  down(...codes) { return this.enabled && codes.some((c) => this.keys.has(c)); }
  hit(...codes) { return this.enabled && codes.some((c) => this.hits.has(c)); }

  /** Movement axis: x = right, y = forward. */
  axis() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.down('KeyW', 'ArrowUp')) y += 1;
    if (this.down('KeyS', 'ArrowDown')) y -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.joy.active) { x += this.joy.x; y += this.joy.y; }
    if (this.pad.on) { x += this.pad.x; y += this.pad.y; }
    const L = Math.hypot(x, y);
    if (L > 1) { x /= L; y /= L; }
    return { x, y };
  }

  endFrame() { this.hits.clear(); this.dx = 0; this.dy = 0; this.wheel = 0; this.clicked = false; }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
}

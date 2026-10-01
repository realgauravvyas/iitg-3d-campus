// Interaction points: anything you can press E at (doors, shops, seats, bikes, jobs, NPCs).
// Static points live in a grid; providers add dynamic candidates each frame.
const CELL = 24;

export class Interactions {
  constructor(game) {
    this.g = game;
    this.grid = new Map();
    this.providers = [];
    this.current = null;
    this.local = [];        // points that only exist inside the current interior
  }

  key(x, z) { return Math.floor(x / CELL) * 100003 + Math.floor(z / CELL); }

  /** p: {x, z, y?, r=2.2, label: string|fn, ok?: () => true|string, run: fn, when?: fn, prio?} */
  add(p) {
    p.r ??= 2.2;
    const k = this.key(p.x, p.z);
    if (!this.grid.has(k)) this.grid.set(k, []);
    this.grid.get(k).push(p);
    return p;
  }
  remove(p) { const l = this.grid.get(this.key(p.x, p.z)); if (l) { const i = l.indexOf(p); if (i >= 0) l.splice(i, 1); } }
  provider(fn) { this.providers.push(fn); }
  setLocal(list) { this.local = list || []; }

  candidates(x, z) {
    const out = [];
    const gx = Math.floor(x / CELL), gz = Math.floor(z / CELL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const l = this.grid.get((gx + i) * 100003 + (gz + j));
      if (l) out.push(...l);
    }
    return out;
  }

  /** find the best point near the player; returns prompt html ('' if none). Runs it on E. */
  update(pos, facing, enabled = true) {
    this.current = null;
    if (!enabled) return '';
    const inside = this.g.interior?.active;
    let pool = inside ? this.local : this.candidates(pos.x, pos.z);
    for (const f of this.providers) { const c = f(pos, inside); if (c) pool = pool.concat(c); }
    let best = null, bs = Infinity;
    for (const p of pool) {
      if (p.when && !p.when()) continue;
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d > p.r) continue;
      if (p.y !== undefined && Math.abs(p.y - pos.y) > (p.dy ?? 2.5)) continue;
      // prefer what you are facing
      const ang = Math.atan2(p.x - pos.x, p.z - pos.z);
      let da = Math.abs(((ang - facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const s = d + (d > 0.8 ? da * 0.6 : 0) - (p.prio || 0);
      if (s < bs) { bs = s; best = p; }
    }
    if (!best) return '';
    this.current = best;
    const label = typeof best.label === 'function' ? best.label() : best.label;
    const ok = best.ok ? best.ok() : true;
    if (this.g.input.hit('KeyE')) {
      if (ok === true) { this.g.audio.click(); best.run(); this.current = null; return ''; }
      this.g.ui.toast(ok, 'warn');
      this.g.audio.tone(220, 0.15, { type: 'triangle', gain: 0.06 });
    }
    return ok === true ? `<kbd>E</kbd> ${label}` : `<kbd>E</kbd> ${label} <span class="dim">· ${ok}</span>`;
  }
}

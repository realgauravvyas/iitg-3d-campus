// Interior builder: a "plan" collects furniture boxes (merged into one mesh), textured
// panels (boards, screens, posters), colliders, stepped floors, seats, NPC spots and
// interaction points. Local coordinates: x across, z from the back wall (-D/2) to the
// front wall with the entrance (+D/2), y up from the floor.
import * as THREE from 'three';
import { canvasTexture, mergeColored, m4, mulberry32 } from '../util.js';
import { AN } from '../crowd/people.js';

const SEATED = new Set([AN.SIT, AN.EAT, AN.STUDY, AN.TYPE, AN.SITCHAT]);

export class Plan {
  constructor(name, W, D, H, { floor = 'tiles', wall = '#ece5d6', seed = 1 } = {}) {
    Object.assign(this, { name, W, D, H, floorKind: floor, wallColor: wall });
    this.rnd = mulberry32(seed);
    this.parts = []; this.panels = []; this.colliders = []; this.tiers = []; this.floorHole = null;
    this.seats = []; this.spots = []; this.acts = []; this.fans = []; this.windows = []; this.lamps = [];
    this.spawn = { x: 0, z: D / 2 - 1.6, yaw: Math.PI };
    this.exit = { x: 0, z: D / 2 - 0.4 };
    this.shell();
  }

  // ------------------------------------------------------------ primitives
  box(x, y, z, sx, sy, sz, color, { collide = true, rotY = 0, cast = true } = {}) {
    this.parts.push({ geometry: new THREE.BoxGeometry(sx, sy, sz), color, matrix: m4(x, y + sy / 2, z, 0, rotY, 0), cast });
    if (collide && y < 1.6) {
      const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
      const hx = (sx * c + sz * s) / 2, hz = (sx * s + sz * c) / 2;
      this.colliders.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, top: y + sy });
    }
  }
  cyl(x, y, z, r, h, color, { collide = false, seg = 12, r2 = r } = {}) {
    this.parts.push({ geometry: new THREE.CylinderGeometry(r, r2, h, seg), color, matrix: m4(x, y + h / 2, z) });
    if (collide) this.colliders.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, top: y + h });
  }
  geo(geometry, color, matrix) { this.parts.push({ geometry, color, matrix }); }
  /** textured vertical panel (board / screen / poster / sign); returns the panel record */
  panel(x, y, z, w, h, rotY, tex, { emissive = 0, key = null } = {}) {
    const p = { x, y, z, w, h, rotY, tex, emissive, key };
    this.panels.push(p);
    return p;
  }
  win(x, y, z, w, h, rotY) { this.windows.push({ x, y, z, w, h, rotY }); }
  /** something that moves or changes (a running tap...): fn(group) builds it when the room is built and returns { update(dt) } */
  dyn(fn) { (this.dyns ||= []).push(fn); }
  /** a step or raked row; with x0..x1 it covers only part of the width (a staircase) */
  tier(z0, z1, y, x0 = -Infinity, x1 = Infinity) { this.tiers.push({ z0: Math.min(z0, z1), z1: Math.max(z0, z1), x0, x1, y }); }
  seat(x, z, yaw, y = 0, extra = {}) { const s = { x, z, y, yaw, taken: null, ...extra }; this.seats.push(s); return s; }
  spot(x, z, yaw, anim, extra = {}) {
    // anyone sitting needs something to sit on: sit exactly on the chair that is already there, or put one under them
    if (SEATED.has(anim) && !extra.seat) {
      let near = null, nd = 0.6;
      for (const q of this.seats) { const d = Math.hypot(q.x - x, q.z - z); if (d < nd) { nd = d; near = q; } }
      if (near) { extra = { ...extra, seat: near, y: extra.y ?? near.y }; x = near.x; z = near.z; yaw = near.yaw; }
      else { const fx = Math.sin(yaw), fz = Math.cos(yaw), y0 = extra.y ?? this.floorAt(z, x); extra = { ...extra, seat: this.chair(x + fx * 0.1, z + fz * 0.1, yaw, '#2b3a55', y0), y: y0 }; }
    }
    const s = { x, z, y: extra.y ?? this.floorAt(z, x), yaw, anim, ...extra }; this.spots.push(s); return s;
  }
  act(x, z, label, run, extra = {}) { const a = { x, z, y: extra.y ?? this.floorAt(z, x), r: extra.r ?? 1.8, label, run, ...extra }; this.acts.push(a); return a; }
  /** floor height at z (and x: a staircase only covers its own width; without x only full-width rows count) */
  floorAt(z, x) { for (const t of this.tiers) if (z >= t.z0 && z <= t.z1 && (x === undefined ? t.x0 === -Infinity : x >= t.x0 && x <= t.x1)) return t.y; return 0; }

  // ------------------------------------------------------------ shell: walls with an entrance, windows
  shell() {
    const { W, D, H, wallColor } = this;
    const t = 0.25, door = 2.4;
    this.box(-W / 2 - t / 2, 0, 0, t, H, D + t * 2, wallColor);
    this.box(W / 2 + t / 2, 0, 0, t, H, D + t * 2, wallColor);
    this.box(0, 0, -D / 2 - t / 2, W, H, t, wallColor);
    const side = (W - door) / 2;
    this.box(-W / 2 + side / 2, 0, D / 2 + t / 2, side, H, t, wallColor);
    this.box(W / 2 - side / 2, 0, D / 2 + t / 2, side, H, t, wallColor);
    this.box(0, 2.6, D / 2 + t / 2, door, H - 2.6, t, wallColor, { collide: false });
    // skirting + a darker dado band (common in Indian institutional buildings)
    for (const [x, z, sx, sz] of [[-W / 2 + 0.03, 0, 0.06, D], [W / 2 - 0.03, 0, 0.06, D], [0, -D / 2 + 0.03, W, 0.06]]) this.box(x, 0, z, sx, 1.1, sz, shade(wallColor, 0.86), { collide: false, cast: false });
    // door leaves (open) and the way out
    this.box(-door / 2 - 0.45, 0, D / 2 - 0.45, 0.06, 2.4, 0.9, '#6b4a2f', { collide: false });
    this.box(door / 2 + 0.45, 0, D / 2 - 0.45, 0.06, 2.4, 0.9, '#6b4a2f', { collide: false });
    // windows along both long walls
    const n = Math.max(1, Math.floor(D / 5));
    for (let k = 0; k < n; k++) {
      const z = -D / 2 + (k + 0.5) * (D / n);
      this.win(-W / 2 + 0.02, 1.9, z, 2.2, 1.5, Math.PI / 2);
      this.win(W / 2 - 0.02, 1.9, z, 2.2, 1.5, -Math.PI / 2);
    }
  }

  // ------------------------------------------------------------ furniture
  table(x, z, w, d, color = '#8a6a4a', h = 0.76, rotY = 0) {
    this.box(x, h - 0.05, z, w, 0.05, d, color, { rotY });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lx = (a * (w / 2 - 0.08)), lz = (b * (d / 2 - 0.08));
      const c = Math.cos(rotY), s = Math.sin(rotY);
      this.box(x + lx * c + lz * s, 0, z - lx * s + lz * c, 0.06, h - 0.05, 0.06, shade(color, 0.7), { collide: false });
    }
    const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
    this.colliders.push({ x0: x - (w * c + d * s) / 2, x1: x + (w * c + d * s) / 2, z0: z - (w * s + d * c) / 2, z1: z + (w * s + d * c) / 2, top: h });
  }
  bench(x, z, len, rotY = 0, color = '#6b5a44', y = 0) {
    this.box(x, y + 0.42, z, len, 0.05, 0.36, color, { rotY, collide: false });
    this.box(x, y, z, len * 0.95, 0.42, 0.06, shade(color, 0.7), { rotY, collide: false });
  }
  chair(x, z, yaw, color = '#3f5f8a', y = 0, seatExtra = {}) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this.box(x, y + 0.44, z, 0.44, 0.05, 0.44, color, { rotY: yaw, collide: false });
    this.box(x - fx * 0.21, y + 0.44, z - fz * 0.21, 0.44, 0.46, 0.05, color, { rotY: yaw, collide: false });
    for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) this.box(x + a, y, z + b, 0.03, 0.44, 0.03, '#333', { collide: false, cast: false });
    return this.seat(x - fx * 0.1, z - fz * 0.1, yaw, y, seatExtra);
  }
  /** computer-centre workstation: a 24" monitor on a stand, keyboard, mouse, CPU; returns {seat, mon} */
  workstation(x, z, yaw, tex) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;
    this.table(x + fx * 0.35, z + fz * 0.35, 1.2, 0.7, '#c9c2b4', 0.75, yaw);
    const mx = x + fx * 0.6, mz = z + fz * 0.6;
    this.box(mx, 0.75, mz, 0.22, 0.02, 0.18, '#202225', { rotY: yaw, collide: false });           // stand foot
    this.box(mx + fx * 0.03, 0.77, mz + fz * 0.03, 0.05, 0.12, 0.04, '#202225', { rotY: yaw, collide: false });
    this.box(mx, 0.84, mz, 0.59, 0.36, 0.035, '#07080a', { rotY: yaw, collide: false });           // bezel
    this.panel(mx - fx * 0.02, 1.02, mz - fz * 0.02, 0.53, 0.3, yaw + Math.PI, tex, { emissive: 0.9 });
    this.box(x + fx * 0.28, 0.75, z + fz * 0.28, 0.44, 0.02, 0.15, '#2a2d31', { rotY: yaw, collide: false });   // keyboard
    this.box(x + fx * 0.28 + rx * 0.33, 0.75, z + fz * 0.28 + rz * 0.33, 0.06, 0.025, 0.1, '#2a2d31', { rotY: yaw, collide: false });   // mouse
    this.box(x + fx * 0.55 - rx * 0.45, 0, z + fz * 0.55 - rz * 0.45, 0.2, 0.42, 0.45, '#1d1f23', { rotY: yaw, collide: false });      // CPU
    const seat = this.chair(x - fx * 0.12, z - fz * 0.12, yaw, '#2b3a55');
    return { seat, mon: { x: mx - fx * 0.022, y: 1.02, z: mz - fz * 0.022, yaw: yaw + Math.PI, w: 0.53, h: 0.3 } };
  }
  desk(x, z, yaw, { pc = false, lamp = false, color = '#8a6a4a', w = 1.2 } = {}) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this.table(x + fx * 0.35, z + fz * 0.35, w, 0.6, color, 0.75, yaw);
    if (pc) {
      this.box(x + fx * 0.52, 0.75, z + fz * 0.52, 0.5, 0.34, 0.04, '#15171a', { rotY: yaw, collide: false });
      this.panel(x + fx * 0.5, 0.95, z + fz * 0.5, 0.46, 0.28, yaw + Math.PI, screenTex(this.rnd), { emissive: 0.9 });
      this.box(x + fx * 0.25, 0.75, z + fz * 0.25, 0.42, 0.02, 0.14, '#2a2d31', { rotY: yaw, collide: false });
    }
    if (lamp) {
      this.cyl(x + fx * 0.4 + fz * 0.4, 0.75, z + fz * 0.4 - fx * 0.4, 0.07, 0.02, '#333');
      this.cyl(x + fx * 0.4 + fz * 0.4, 0.77, z + fz * 0.4 - fx * 0.4, 0.012, 0.35, '#333');
      this.lamps.push({ x: x + fx * 0.4 + fz * 0.4, y: 1.1, z: z + fz * 0.4 - fx * 0.4 });
    }
    return this.chair(x - fx * 0.12, z - fz * 0.12, yaw, '#2b3a55');
  }
  shelf(x, z, w, rotY = 0, h = 2.2, books = true) {
    this.box(x, 0, z, w, h, 0.4, '#6b4a2f', { rotY });
    if (!books) return;
    const cols = ['#7d1f1f', '#1f3a5f', '#2e4a2a', '#c89b3c', '#5a4632', '#6b3d5e', '#e8e0cc'];
    const c = Math.cos(rotY), s = Math.sin(rotY);
    for (let r = 0; r < 4; r++) {
      let u = -w / 2 + 0.06;
      while (u < w / 2 - 0.1) {
        const bw = 0.04 + this.rnd() * 0.05, bh = 0.26 + this.rnd() * 0.12;
        const lx = u + bw / 2, lz = 0.18;
        this.parts.push({ geometry: new THREE.BoxGeometry(bw, bh, 0.22), color: cols[Math.floor(this.rnd() * cols.length)], matrix: m4(x + lx * c + lz * s, 0.12 + r * 0.52 + bh / 2, z - lx * s + lz * c, 0, rotY, 0), cast: false });
        u += bw + 0.005;
      }
    }
  }
  counter(x, z, w, d = 0.7, color = '#9a8a74', rotY = 0, h = 1.0) {
    this.box(x, 0, z, w, h, d, color, { rotY });
    this.box(x, h, z, w + 0.06, 0.04, d + 0.06, '#d9d4c7', { rotY, collide: false });
  }
  sofa(x, z, w, yaw, color = '#7d4b3a') {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this.box(x, 0, z, w, 0.42, 0.8, color, { rotY: yaw });
    this.box(x - fx * 0.35, 0.42, z - fz * 0.35, w, 0.45, 0.14, shade(color, 0.85), { rotY: yaw, collide: false });
    const out = [];
    const n = Math.max(1, Math.floor(w / 0.65));
    for (let k = 0; k < n; k++) {
      const u = -w / 2 + (k + 0.5) * (w / n);
      out.push(this.seat(x + fz * u - fx * 0.05, z - fx * u - fz * 0.05, yaw, 0, { soft: true }));
    }
    return out;
  }
  bed(x, z, yaw) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this.box(x, 0, z, 0.95, 0.42, 2.0, '#6b4a2f', { rotY: yaw });
    this.box(x, 0.42, z, 0.9, 0.14, 1.95, '#e8e4da', { rotY: yaw, collide: false });
    this.box(x - fx * 0.75, 0.56, z - fz * 0.75, 0.6, 0.1, 0.35, '#f2f0ea', { rotY: yaw, collide: false });
    this.box(x + fx * 0.3, 0.56, z + fz * 0.3, 0.92, 0.05, 1.1, ['#b3262f', '#2b3a55', '#5b7f3a'][Math.floor(this.rnd() * 3)], { rotY: yaw, collide: false });
  }
  fan(x, z) { this.fans.push({ x, z, y: this.H - 0.55 }); this.cyl(x, this.H - 0.5, z, 0.02, 0.5, '#e8e4da'); }
  tubeLight(x, z, rotY = 0) {
    this.box(x, this.H - 0.1, z, 1.25, 0.05, 0.1, '#f2f0ea', { rotY, collide: false, cast: false });
    this.panels.push({ x, y: this.H - 0.13, z, w: 1.2, h: 0.06, rotY, flat: true, light: true });
  }
  plant(x, z) {
    this.cyl(x, 0, z, 0.22, 0.4, '#8a4b22', { collide: true, r2: 0.17 });
    this.geo(new THREE.IcosahedronGeometry(0.42, 0), '#3f7a34', m4(x, 0.85, z, 0, 0, 0, 1, 1.3, 1));
  }
  steel(x, y, z, r = 0.28, h = 0.4) { this.cyl(x, y, z, r, h, '#c7ccd1'); }
  labBench(x, z, w, rotY = 0) {
    this.box(x, 0, z, w, 0.9, 0.9, '#e6e1d6', { rotY });
    this.box(x, 0.9, z, w + 0.04, 0.04, 0.94, '#2b2d30', { rotY, collide: false });
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const flask = ['#9ad0e6', '#e6b39a', '#b6e69a', '#e6e09a'];
    for (let k = 0; k < Math.floor(w / 0.5); k++) {
      const u = -w / 2 + 0.3 + k * 0.5;
      this.geo(new THREE.ConeGeometry(0.06, 0.16, 10), flask[k % 4], m4(x + u * c, 1.02, z - u * s));
      if (k % 3 === 0) this.cyl(x + u * c + s * 0.25, 0.94, z - u * s + c * 0.25, 0.012, 0.35, '#888');
    }
  }
  board(x, y, z, w, h, rotY, tex) {
    this.box(x - Math.sin(rotY) * 0.02, y - 0.06, z - Math.cos(rotY) * 0.02, w + 0.12, h + 0.12, 0.04, '#6b4a2f', { rotY, collide: false });
    return this.panel(x + Math.sin(rotY) * 0.005, y + h / 2 - 0.06 + 0.06, z + Math.cos(rotY) * 0.005, w, h, rotY, tex);
  }
  /** raked seating: rows rising towards the back; returns the seat list */
  rakedSeats(x0, x1, zFront, zBack, rows, rise, { color = '#8b1a1a', aisle = 1.2, desk = false, riser = '#a79f92' } = {}) {
    const out = [];
    const sign = zBack > zFront ? 1 : -1, dz = Math.abs(zBack - zFront) / rows;
    const yaw = sign > 0 ? Math.PI : 0;          // everyone faces the front (stage / board)
    for (let r = 0; r < rows; r++) {
      const zc = zFront + sign * (r + 0.5) * dz, y = r * rise;
      this.tier(zc - dz / 2, zc + dz / 2, y);
      if (y > 0) this.box((x0 + x1) / 2, 0, zc, x1 - x0, y, dz, riser, { collide: false, cast: false });
      for (let u = x0 + 0.35; u < x1 - 0.3; u += 0.6) {
        if (Math.abs(u - (x0 + x1) / 2) < aisle / 2) continue;
        if (desk) this.box(u, y + 0.72, zc - sign * 0.45, 0.58, 0.04, 0.32, '#6b4a2f', { collide: false });
        this.box(u, y + 0.42, zc, 0.5, 0.06, 0.45, color, { collide: false });
        this.box(u, y + 0.45, zc + sign * 0.25, 0.5, 0.5, 0.06, color, { collide: false, cast: false });
        out.push(this.seat(u, zc + sign * 0.05, yaw, y));
      }
    }
    // a landing behind the top row, level with the entrance (you come in at the top and leave by the
    // ground-level exits at the front)
    const top = (rows - 1) * rise, back = this.D / 2;
    if (sign > 0 && top > 0 && zBack < back) { this.tier(zBack, back + 0.6, top); this.box(0, 0, (zBack + back) / 2, this.W, top, back - zBack, riser, { collide: false, cast: false }); }
    return out;
  }

  /** Ground-level exit doors at the front of a raked hall, one in each side wall at depth z, with
   *  green EXIT signs; walking up and pressing E there takes you outside (no jumping off the tiers). */
  sideExits(z, leave) {
    const { W } = this;
    const exitTex = canvasTexture(256, 96, (g, w, h) => {
      g.fillStyle = '#0f7a3c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f4fff6'; g.font = 'bold 58px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', w / 2 + 22, h / 2 + 2);
      g.beginPath(); g.arc(46, 30, 9, 0, 7); g.fill(); g.fillRect(40, 40, 12, 26); g.fillRect(28, 46, 36, 6);
    }, { repeat: false });
    for (const sgn of [-1, 1]) {
      const x = sgn * (W / 2 - 0.02), rot = -sgn * Math.PI / 2;
      // double doors (dark wood) in a steel frame, push bar across
      this.box(x - sgn * 0.02, 0, z, 0.06, 2.3, 1.9, '#5a3a24', { collide: false });
      this.box(x - sgn * 0.05, 2.3, z, 0.08, 0.12, 2.1, '#8a9096', { collide: false });
      this.box(x - sgn * 0.08, 1.0, z, 0.05, 0.05, 1.7, '#c7ccd1', { collide: false });
      this.panel(x - sgn * 0.06, 2.72, z, 0.9, 0.34, rot, exitTex, { emissive: 1.2 });
      this.act(x - sgn * 1.0, z, 'Exit (side door, ground level)', () => leave(sgn), { y: 0, r: 2.2 });
    }
  }

  // ------------------------------------------------------------ build meshes at world origin O
  build(O) {
    const group = new THREE.Group();
    group.position.copy(O);
    const { W, D, H } = this;
    // floor + ceiling (ceiling casts no shadow so the "ceiling lights" reach the room)
    const floorPiece = (x0, x1, z0, z1) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2), new THREE.MeshStandardMaterial({ map: floorTex(this.floorKind, x1 - x0, z1 - z0), roughness: this.floorKind === 'wood' ? 0.45 : 0.6 }));
      m.receiveShadow = true;
      group.add(m);
    };
    const hole = this.floorHole;       // a stairwell by the front wall: the floor goes round it
    if (hole) { floorPiece(-W / 2, W / 2, -D / 2, hole.z0); floorPiece(-W / 2, hole.x0, hole.z0, D / 2); floorPiece(hole.x1, W / 2, hole.z0, D / 2); }
    else floorPiece(-W / 2, W / 2, -D / 2, D / 2);
    const ce = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.95 }));
    ce.position.y = H;
    group.add(ce);
    const cast = this.parts.filter((p) => p.cast !== false), nocast = this.parts.filter((p) => p.cast === false);
    for (const [list, sh] of [[cast, true], [nocast, false]]) {
      if (!list.length) continue;
      const m = new THREE.Mesh(mergeColored(list), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }));
      m.castShadow = sh; m.receiveShadow = true;
      group.add(m);
    }
    this.panelMeshes = {};
    const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.55) });
    for (const p of this.panels) {
      if (p.light) {
        const g = new THREE.PlaneGeometry(p.w, p.h * 2).rotateX(Math.PI / 2);
        const m = new THREE.Mesh(g, lightMat);
        m.position.set(p.x, p.y, p.z); m.rotation.y = p.rotY;
        group.add(m);
        continue;
      }
      const mat = new THREE.MeshStandardMaterial({ map: p.tex, roughness: 0.7, emissive: p.emissive ? 0xffffff : 0x000000, emissiveMap: p.emissive ? p.tex : null, emissiveIntensity: p.emissive || 0 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat);
      m.position.set(p.x, p.y, p.z); m.rotation.y = p.rotY;
      group.add(m);
      if (p.key) this.panelMeshes[p.key] = m;
    }
    this.winMat = new THREE.MeshBasicMaterial({ color: 0xcfe6ff });
    for (const w of this.windows) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h), this.winMat);
      m.position.set(w.x, w.y, w.z); m.rotation.y = w.rotY;
      group.add(m);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(w.w + 0.12, w.h + 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0xf4f1ea }));
      fr.position.copy(m.position); fr.rotation.y = w.rotY;
      fr.position.x += Math.sin(w.rotY) * -0.02; fr.position.z += Math.cos(w.rotY) * -0.02;
      group.add(fr);
      for (const s of [-1, 1]) { // grill bars
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, w.h, 0.02), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        bar.position.copy(m.position); bar.rotation.y = w.rotY;
        bar.position.x += Math.cos(w.rotY) * s * w.w / 4; bar.position.z -= Math.sin(w.rotY) * s * w.w / 4;
        group.add(bar);
      }
    }
    // ceiling fans (animated)
    const bladeGeo = new THREE.BoxGeometry(1.1, 0.02, 0.14).translate(0.6, 0, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 });
    this.fanObjs = this.fans.map((f) => {
      const g = new THREE.Group();
      g.position.set(f.x, f.y - 0.05, f.z);
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(bladeGeo, bladeMat); b.rotation.y = (k / 3) * Math.PI * 2; g.add(b); }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), bladeMat);
      g.add(hub);
      group.add(g);
      return g;
    });
    this.dynObjs = (this.dyns || []).map((fn) => fn(group));
    this.group = group;
    return group;
  }

  update(dt, dayColor) {
    for (const f of this.fanObjs || []) f.rotation.y += dt * 9;
    for (const d of this.dynObjs || []) d?.update?.(dt);
    if (this.winMat && dayColor) this.winMat.color.copy(dayColor);
  }
}

export function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

function floorTex(kind, W, D) {
  const t = canvasTexture(512, 512, (g, w, h) => {
    const rnd = mulberry32(kind.length * 7);
    if (kind === 'wood') {
      g.fillStyle = '#a4764a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -60 : 0; x < w; x += 128) {
        const v = 0.85 + rnd() * 0.25;
        g.fillStyle = `rgb(${164 * v | 0},${118 * v | 0},${74 * v | 0})`; g.fillRect(x + 1, y + 1, 126, 30);
      }
    } else if (kind === 'marble') {
      g.fillStyle = '#e6e2da'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(120,110,100,${0.05 + rnd() * 0.08})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.moveTo(rnd() * w, rnd() * h); g.bezierCurveTo(rnd() * w, rnd() * h, rnd() * w, rnd() * h, rnd() * w, rnd() * h); g.stroke(); }
      g.strokeStyle = 'rgba(80,70,60,0.25)'; for (let k = 0; k <= 4; k++) { g.strokeRect(0, k * 128, w, 1); g.strokeRect(k * 128, 0, 1, h); }
    } else if (kind === 'carpet') {
      g.fillStyle = '#6e1f2a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    } else {
      // mosaic / vitrified tiles
      const base = kind === 'hospital' ? [226, 230, 228] : kind === 'red' ? [150, 70, 60] : [196, 188, 170];
      g.fillStyle = '#8a857a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = 0.92 + rnd() * 0.12;
        g.fillStyle = `rgb(${base[0] * v | 0},${base[1] * v | 0},${base[2] * v | 0})`;
        g.fillRect(x * 64 + 1, y * 64 + 1, 62, 62);
        for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(90,80,70,${rnd() * 0.12})`; g.fillRect(x * 64 + rnd() * 60, y * 64 + rnd() * 60, 3, 3); }
      }
    }
  });
  t.repeat.set(W / 4, D / 4);
  return t;
}

export function textTex(lines, { w = 512, h = 256, bg = '#1f3b2c', fg = '#f2f0ea', font = '"Hind", "Segoe UI", sans-serif', size = 28, title = null, titleColor = '#f2c12e', align = 'left' } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    let y = 18;
    g.textBaseline = 'top';
    if (title) { g.fillStyle = titleColor; g.font = `bold ${size * 1.25}px ${font}`; g.textAlign = 'center'; g.fillText(title, w / 2, y); y += size * 1.7; }
    g.fillStyle = fg; g.font = `${size}px ${font}`; g.textAlign = align;
    for (const l of lines) { g.fillText(l, align === 'center' ? w / 2 : 22, y); y += size * 1.3; }
  }, { repeat: false });
}

function screenTex(rnd) {
  return canvasTexture(128, 80, (g, w, h) => {
    g.fillStyle = ['#0e2233', '#1b1b1b', '#0d2b1d'][Math.floor(rnd() * 3)]; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) { g.fillStyle = ['#7fd1ff', '#e6db74', '#a6e22e', '#f92672', '#ffffff'][Math.floor(rnd() * 5)]; g.fillRect(6 + (k % 2) * 10, 6 + k * 8, 20 + rnd() * 80, 4); }
  }, { repeat: false });
}

/** Axis-aligned collision + room bounds + stepped floors: the "world" for the player indoors. */
export class InteriorEnv {
  constructor(plan, O) { this.p = plan; this.O = O; }
  local(x, z) { return [x - this.O.x, z - this.O.z]; }
  heightAt(x, z) { const [lx, lz] = this.local(x, z); return this.O.y + this.p.floorAt(lz, lx); }
  groundAt(x, z) { return this.heightAt(x, z); }
  buildingAt() { return null; }
  waterAt() { return null; }
  insideCampus() { return true; }
  distToBoundary() { return 99; }
  collide(pos, r) {
    const [lx, lz] = this.local(pos.x, pos.z);
    let x = lx, z = lz, hit = false;
    const fl = this.p.floorAt(lz, lx), feet = pos.y - this.O.y - fl;
    for (const c of this.p.colliders) {
      if (c.top - fl < 0.35 + (feet > 0.3 ? feet : 0)) continue;   // low things you can step over
      const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        hit = true;
        if (d > 1e-4) { x = cx + (dx / d) * r; z = cz + (dz / d) * r; }
        else { // centre inside the box: push out along the shallowest axis
          const pen = [[x - c.x0, -1, 0], [c.x1 - x, 1, 0], [z - c.z0, 0, -1], [c.z1 - z, 0, 1]].sort((a, b) => a[0] - b[0])[0];
          x += pen[1] * (pen[0] + r); z += pen[2] * (pen[0] + r);
        }
      }
    }
    pos.x = x + this.O.x; pos.z = z + this.O.z;
    return hit;
  }
  clampToCampus(pos, m = 0.35) {
    const [lx, lz] = this.local(pos.x, pos.z);
    const mm = Math.min(0.45, Math.max(0.3, m));
    const W = this.p.W / 2 - mm, D = this.p.D / 2 - mm;
    const x = Math.max(-W, Math.min(W, lx)), z = Math.max(-D, Math.min(D, lz));
    pos.x = x + this.O.x; pos.z = z + this.O.z;
    return x !== lx || z !== lz;
  }
  cameraBlocked(x, y, z) {
    const [lx, lz] = this.local(x, z);
    const ly = y - this.O.y;
    return Math.abs(lx) > this.p.W / 2 - 0.2 || Math.abs(lz) > this.p.D / 2 - 0.2 || ly > this.p.H - 0.25 || ly < this.p.floorAt(lz, lx) + 0.2;
  }
}
export { AN };

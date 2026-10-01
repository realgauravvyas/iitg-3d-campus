// Campus model: decodes campus.json and answers spatial questions
// (ground height, buildings, lakes, campus limits). Map coords are metres
// with x = east, y = north; world coords are three.js with z = -north.
import { b64ToBytes, pointInRing, closestOnRing } from './util.js';

export const ELEV0 = 40; // metres subtracted from real elevation (campus is ~47-106 m ASL)

const GRID = 25;

const STEP = 0.75;                                       // the tallest kerb, step or bed you step up onto
const SPORTS = new Set(['tennis', 'basketball', 'volleyball', 'soccer', 'hockey', 'cricket', 'athletics']);
export class World {
  constructor(data) {
    this.data = data;
    const t = data.terrain;
    this.terrain = t;
    const bytes = b64ToBytes(t.data);
    const i16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    this.H = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) this.H[i] = i16[i] / 10 - ELEV0;

    this.boundary = flat(data.boundary);
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
    for (let i = 0; i < this.boundary.length; i += 2) {
      bx0 = Math.min(bx0, this.boundary[i]); bx1 = Math.max(bx1, this.boundary[i]);
      bz0 = Math.min(bz0, this.boundary[i + 1]); bz1 = Math.max(bz1, this.boundary[i + 1]);
    }
    this.bbox = { x0: bx0, x1: bx1, z0: bz0, z1: bz1 };

    // buildings (world coords) + spatial grid
    this.buildings = data.buildings.map((b, i) => {
      const rings = [flat(orient(b.p, true)), ...(b.holes || []).map((h) => flat(orient(h, false)))];
      const o = rings[0];
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 0; k < o.length; k += 2) {
        x0 = Math.min(x0, o[k]); x1 = Math.max(x1, o[k]);
        z0 = Math.min(z0, o[k + 1]); z1 = Math.max(z1, o[k + 1]);
      }
      const base = b.base - ELEV0;
      const roof = b.top - ELEV0 + b.hgt;
      return { i, rings, x0, x1, z0, z1, base, roof, floor0: b.top - ELEV0, name: b.name, kind: b.kind,
        lv: b.lv, hgt: b.hgt, roofColor: b.roof, src: b.src, area: ringArea(o) };
    });
    this.grid = new Map();
    this.buildings.forEach((b) => {
      for (let gx = Math.floor(b.x0 / GRID); gx <= Math.floor(b.x1 / GRID); gx++)
        for (let gz = Math.floor(b.z0 / GRID); gz <= Math.floor(b.z1 / GRID); gz++) {
          const k = gx * 100000 + gz;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(b);
        }
    });

    this.water = data.water.map((w) => {
      const rings = [flat(w.p), ...(w.holes || []).map(flat)];
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 0; k < rings[0].length; k += 2) {
        x0 = Math.min(x0, rings[0][k]); x1 = Math.max(x1, rings[0][k]);
        z0 = Math.min(z0, rings[0][k + 1]); z1 = Math.max(z1, rings[0][k + 1]);
      }
      return { rings, x0, x1, z0, z1, level: w.level - ELEV0, deck: w.deck != null ? w.deck - ELEV0 : null, kind: w.kind, name: w.name };
    });

    this.landmarks = data.landmarks.map((l) => ({ ...l, wx: l.x, wz: -l.y, wy: l.z - ELEV0 }));
    // show curated landmark names on the buildings they sit in (fixes raw OSM names/typos)
    for (const l of this.landmarks) { const b = this.buildingAt(l.wx, l.wz); if (b && !b.display) b.display = l.name; }
    this.pois = data.pois.map((p) => ({ ...p, wx: p.x, wz: -p.y }));
    this.gates = data.gates.map((g) => ({ ...g, wx: g.x, wz: -g.y }));
    // sites: buildings with an entrance, access path and forecourt (hostels, academic blocks...)
    this.plazas = (data.plazas || []).map((p) => ({ ...p, wx: p.x, wz: -p.y, ring: flat(p.p), yaw: Math.atan2(Math.cos(p.a), -Math.sin(p.a)) }));
    this.sites = (data.sites || []).filter((s) => s.entry).map((s) => {
      const nx = s.normal[0], nz = -s.normal[1];
      return { ...s, ex: s.entry[0], ez: -s.entry[1], nx, nz, yaw: Math.atan2(nx, nz), blocks: s.ids.map((i) => this.buildings[i]), plazaObj: s.plaza >= 0 ? this.plazas[s.plaza] : null };
    });
    for (const s of this.sites) for (const b of s.blocks) b.site = s;
    this.siteByLm = new Map(this.sites.filter((s) => s.lm).map((s) => [s.lm, s]));
    this.sitouts = (data.sitouts || []).map((s) => ({ ...s, wx: s.x, wz: -s.y, yaw: Math.atan2(Math.cos(s.a), -Math.sin(s.a)) }));
    this.fields = data.fields.map((f, i) => {
      const r = flat(f.p);
      let cx = 0, cz = 0;
      for (let k = 0; k < r.length; k += 2) { cx += r[k]; cz += r[k + 1]; }
      cx /= r.length / 2; cz /= r.length / 2;
      // long axis direction in world coords
      const ax = Math.cos(f.angle), az = -Math.sin(f.angle);
      return { ...f, i, ring: r, cx, cz, ax, az, y: this.heightAt(cx, cz) };
    });
    this._tmp = { d: 0, x: 0, z: 0 };
  }

  site(id) { return this.siteByLm.get(id) || null; }
  landmark(id) { return this.landmarks.find((l) => l.id === id) || null; }
  fieldsOf(kind) { return this.fields.filter((f) => f.kind === kind); }

  /** the sports ground (cricket, football, hockey, athletics, courts) that contains a point, or null: those are for people on foot */
  sportsAt(x, z) {
    for (const f of this.fields) {
      if (!SPORTS.has(f.kind)) continue;
      if (!f.bb) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let k = 0; k < f.ring.length; k += 2) { x0 = Math.min(x0, f.ring[k]); x1 = Math.max(x1, f.ring[k]); z0 = Math.min(z0, f.ring[k + 1]); z1 = Math.max(z1, f.ring[k + 1]); } f.bb = [x0, x1, z0, z1]; }
      if (x < f.bb[0] || x > f.bb[1] || z < f.bb[2] || z > f.bb[3]) continue;
      if (pointInRing(x, z, f.ring)) return f;
    }
    return null;
  }
  /** where no vehicle may go: the lakes and the sports grounds (only you, on foot, may visit a ground) */
  vehicleKeepOut(x, z) { const w = this.waterAt(x, z); return (w && w.kind !== 'pool') || !!this.sportsAt(x, z); }
  /** Point inside a field in its own frame: u along the long axis, v across (metres from centre). */
  fieldPoint(f, u, v) { return { x: f.cx + f.ax * u - f.az * v, z: f.cz + f.az * u + f.ax * v }; }

  /** Entrance of any building: its site entrance, or the point on its wall nearest to a road. */
  entranceOf(b, graph) {
    if (b.site) return { x: b.site.ex, z: b.site.ez, yaw: b.site.yaw, node: b.site.node };
    if (b._entr) return b._entr;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const n = graph.nearestOnNetwork(cx, cz);
    const c = closestOnRing(n ? n.x : cx, n ? n.z : cz, b.rings[0], { d: 0, x: 0, z: 0 });
    const dx = (n ? n.x : cx) - c.x, dz = (n ? n.z : cz) - c.z, L = Math.hypot(dx, dz) || 1;
    b._entr = { x: c.x + (dx / L) * 0.6, z: c.z + (dz / L) * 0.6, yaw: Math.atan2(dx / L, dz / L), node: n ? graph.nearestNode(n.x, n.z) : -1 };
    return b._entr;
  }

  /** Terrain elevation (world y) at world x,z, bilinear. */
  heightAt(x, z) {
    const t = this.terrain;
    const fx0 = (x - t.minx) / t.cell, fy0 = (-z - t.miny) / t.cell;
    const fx = Math.max(0, Math.min(t.nx - 1.001, fx0));
    const fy = Math.max(0, Math.min(t.ny - 1.001, fy0));
    const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j;
    const H = this.H, n = t.nx;
    const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
    // the same two triangles the terrain mesh is drawn with (scene/terrain.js: a-b-c and b-d-c), so what you stand on,
    // and what roads, kerbs and everything else are laid on, is exactly the ground you see
    const h = u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d);
    // beyond the surveyed terrain: the outside world (villages, fields, distant hills, the river)
    if (this.outside && (fx0 !== fx || fy0 !== fy)) {
      const d = Math.hypot((fx0 - fx) * t.cell, (fy0 - fy) * t.cell);
      return this.outside(x, z, h, d);
    }
    return h;
  }

  buildingsNear(x, z) {
    return this.grid.get(Math.floor(x / GRID) * 100000 + Math.floor(z / GRID)) || EMPTY;
  }

  /** Building whose solid footprint contains x,z (outside courtyards). */
  buildingAt(x, z) {
    for (const b of this.buildingsNear(x, z)) {
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      if (solidContains(b, x, z)) return b;
    }
    return null;
  }

  /** Walkable surface under a point at height y: terrain, or a roof if we are above it. */
  groundAt(x, z, y = Infinity) {
    let g = this.heightAt(x, z);
    if (this.water.length) {
      const w = this.waterAt(x, z);
      if (w && w.kind === 'pool') return w.level - 1.7;   // the pool basin is below the deck
    }
    const b = this.buildingAt(x, z);
    if (b && y >= b.roof - 0.9) g = Math.max(g, b.roof);
    // raised surfaces (steps, flower beds, traffic islands, plinths): you step up onto a low one and stand on it
    if (this.surfaces) { const t = this.surfaceTop(x, z); if (t != null && y >= t - STEP) g = Math.max(g, t); }
    return g;
  }

  // ------------------------------------------------------------------ raised surfaces and solid things
  /** a raised surface people walk on: { kind: 'disc', x, z, r } or { kind: 'box', x, z, hx, hz, yaw } (half sizes), with
   *  `top` (a flat top, world y) or `lift` (that much above the terrain wherever it is). Up to 0.75 m you step
   *  up onto it; anything higher is a wall you cannot walk through. */
  addSurface(s) {
    (this.surfaces ||= []).push(s);
    const x0 = Math.floor((s.x - (s.r ?? Math.hypot(s.hx, s.hz)) - 1) / 16), x1 = Math.floor((s.x + (s.r ?? Math.hypot(s.hx, s.hz)) + 1) / 16);
    const z0 = Math.floor((s.z - (s.r ?? Math.hypot(s.hx, s.hz)) - 1) / 16), z1 = Math.floor((s.z + (s.r ?? Math.hypot(s.hx, s.hz)) + 1) / 16);
    this._sg ??= new Map();
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 100000 + j; if (!this._sg.has(k)) this._sg.set(k, []); this._sg.get(k).push(s); }
    return s;
  }
  _inSurface(s, x, z, pad = 0) {
    if (s.kind === 'disc') return Math.hypot(x - s.x, z - s.z) < s.r + pad;
    const c = Math.cos(s.yaw || 0), sn = Math.sin(s.yaw || 0), dx = x - s.x, dz = z - s.z;
    return Math.abs(dx * c - dz * sn) < s.hx + pad && Math.abs(dx * sn + dz * c) < s.hz + pad;
  }
  /** the height of the highest raised surface at (x, z), or null */
  surfaceTop(x, z) {
    const list = this._sg?.get(Math.floor(x / 16) * 100000 + Math.floor(z / 16));
    if (!list) return null;
    let top = null;
    for (const s of list) if (this._inSurface(s, x, z)) { const t = s.top ?? this.heightAt(x, z) + s.lift; if (top === null || t > top) top = t; }
    return top;
  }
  /** register a solid thing (a stall, a kiosk, a post, a sign...): placement keeps clear of it; a `hard` one (a counter, a
   *  post, a booth) is also a wall for people and cycles, a soft one (a queue's room, a cycle, a bench) is not */
  addSolid(x, z, r, tag = '', hard = false) {
    const s = { x, z, r, tag, hard };
    this._so ??= new Map();
    const k = Math.floor(x / 8) * 100000 + Math.floor(z / 8);
    if (!this._so.has(k)) this._so.set(k, []);
    this._so.get(k).push(s);
    (this.solids ||= []).push(s);
    return s;
  }
  /** the solid nearest to (x, z) closer than r + its own radius, or null */
  solidAt(x, z, r = 0) {
    if (!this._so) return null;
    const gx = Math.floor(x / 8), gz = Math.floor(z / 8);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const c = this._so.get((gx + i) * 100000 + gz + j);
      if (c) for (const s of c) if (Math.hypot(x - s.x, z - s.z) < s.r + r) return s;
    }
    return null;
  }

  waterAt(x, z) {
    for (const w of this.water) {
      if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) continue;
      if (pointInRing(x, z, w.rings[0])) {
        let inHole = false;
        for (let k = 1; k < w.rings.length; k++) if (pointInRing(x, z, w.rings[k])) inHole = true;
        if (!inHole) return w;
      }
    }
    return null;
  }

  insideCampus(x, z) {
    return pointInRing(x, z, this.boundary);
  }

  distToBoundary(x, z) {
    return closestOnRing(x, z, this.boundary, this._tmp).d;
  }

  /** Where a road is split by an island (the Main Gate), each direction keeps to its own carriageway:
   *  the lateral offset (to the left of travel) a vehicle needs at (x, z); 0 elsewhere. */
  medianNeed(x, z) {
    let need = 0;
    for (const d of this.dividers || []) {
      const dx = x - d.x, dz = z - d.z;
      const u = dx * d.ax + dz * d.az, v = dx * d.bx + dz * d.bz;
      if (Math.abs(v) > d.span) continue;
      const out = u < d.u0 ? d.u0 - u : u > d.u1 ? u - d.u1 : 0;
      if (out >= d.ramp) continue;
      const k = 1 - out / d.ramp;
      need = Math.max(need, (d.lane ?? 5.9) * k * k * (3 - 2 * k));
    }
    return need;
  }

  /** register a fence segment {ax, az, bx, bz, top, bikeOnly?} for collisions (25 m grid cells) */
  indexFence(s) {
    this.fenceGrid ??= new Map();
    const x0 = Math.floor((Math.min(s.ax, s.bx) - 1) / 25), x1 = Math.floor((Math.max(s.ax, s.bx) + 1) / 25);
    const z0 = Math.floor((Math.min(s.az, s.bz) - 1) / 25), z1 = Math.floor((Math.max(s.az, s.bz) + 1) / 25);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 100000 + j; if (!this.fenceGrid.has(k)) this.fenceGrid.set(k, []); this.fenceGrid.get(k).push(s); }
  }

  /**
   * Push a circle (radius r) at pos out of building walls it overlaps below `top`.
   * Returns true if a collision happened.
   */
  collide(pos, r, feetY, who = 'walk') {
    let hit = false;
    const near = this.buildingsNear(pos.x, pos.z);
    for (const b of near) {
      if (pos.x < b.x0 - r || pos.x > b.x1 + r || pos.z < b.z0 - r || pos.z > b.z1 + r) continue;
      if (feetY >= b.roof - 0.9) continue; // standing on / above the roof
      const inside = solidContains(b, pos.x, pos.z);
      let best = null;
      for (const ring of b.rings) {
        const c = closestOnRing(pos.x, pos.z, ring, { d: 0, x: 0, z: 0 });
        if (!best || c.d < best.d) best = c;
      }
      if (inside) {
        const dx = best.x - pos.x, dz = best.z - pos.z, L = Math.hypot(dx, dz) || 1;
        pos.x = best.x + (dx / L) * r;
        pos.z = best.z + (dz / L) * r;
        hit = true;
      } else if (best.d < r) {
        const dx = pos.x - best.x, dz = pos.z - best.z, L = Math.hypot(dx, dz) || 1;
        pos.x = best.x + (dx / L) * r;
        pos.z = best.z + (dz / L) * r;
        hit = true;
      }
    }
    // raised surfaces too high to step onto are walls (bicycles and vehicles cannot climb even a kerb)
    if (this._sg) {
      const list = this._sg.get(Math.floor(pos.x / 16) * 100000 + Math.floor(pos.z / 16));
      const step = who === 'walk' ? STEP : 0.14;
      if (list) for (const s of list) {
        const t = s.top ?? this.heightAt(s.x, s.z) + s.lift;
        if (t - feetY <= step || !this._inSurface(s, pos.x, pos.z, r)) continue;
        if (s.kind === 'disc') {
          const dx = pos.x - s.x, dz = pos.z - s.z, L = Math.hypot(dx, dz) || 1;
          const inside = L < s.r; const want = inside ? s.r - r : s.r + r;
          // from outside: pushed back out; from inside a walled bed: kept inside
          pos.x = s.x + (dx / L) * want; pos.z = s.z + (dz / L) * want; hit = true;
        } else {
          const c = Math.cos(s.yaw || 0), sn = Math.sin(s.yaw || 0), dx = pos.x - s.x, dz = pos.z - s.z;
          let u = dx * c - dz * sn, v = dx * sn + dz * c;
          const ou = s.hx + r - Math.abs(u), ov = s.hz + r - Math.abs(v);
          if (ou < ov) u = Math.sign(u || 1) * (s.hx + r); else v = Math.sign(v || 1) * (s.hz + r);
          pos.x = s.x + u * c + v * sn; pos.z = s.z - u * sn + v * c; hit = true;
        }
      }
    }
    // hard solids: counters, booths, posts, signs, lamps, machines
    if (this._so) {
      const gx = Math.floor(pos.x / 8), gz = Math.floor(pos.z / 8);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const c = this._so.get((gx + i) * 100000 + gz + j);
        if (c) for (const s of c) {
          if (!s.hard) continue;
          const dx = pos.x - s.x, dz = pos.z - s.z, d = Math.hypot(dx, dz), want = s.r + r;
          if (d < want) { const L = d || 1; pos.x = s.x + ((d ? dx : 1) / L) * want; pos.z = s.z + ((d ? dz : 0) / L) * want; hit = true; }
        }
      }
    }
    // fences round the courts and grounds (pedestrian gates stop cycles only)
    const fl = this.fenceGrid?.get(Math.floor(pos.x / 25) * 100000 + Math.floor(pos.z / 25));
    if (fl) for (const s of fl) {
      if (feetY > s.top || (s.bikeOnly && who === 'walk') || (s.open && s.open(pos))) continue;
      const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((pos.x - s.ax) * ex + (pos.z - s.az) * ez) / L2));
      const qx = s.ax + ex * t, qz = s.az + ez * t, dx = pos.x - qx, dz = pos.z - qz, d = Math.hypot(dx, dz);
      if (d < r) { const k = (r - d) / (d || 1); pos.x += (d ? dx : -ez) * k; pos.z += (d ? dz : ex) * k; hit = true; }
    }
    return hit;
  }

  /**
   * The campus wall with its gates: moving from prev to pos may only cross the wall through an
   * open gate (who: 'walk' | 'bike' | 'car'). Outside, stay inside the modelled surroundings.
   * Returns true if the move was blocked.
   */
  wallStep(prev, pos, who = 'walk', hour = 12, margin = 0.6) {
    this.lastBlock = null;
    const o = this.outerBounds;
    if (o) { pos.x = Math.max(o.x0, Math.min(o.x1, pos.x)); pos.z = Math.max(o.z0, Math.min(o.z1, pos.z)); }
    const a = this.insideCampus(prev.x, prev.z), b = this.insideCampus(pos.x, pos.z);
    if (a !== b) {
      const g = this.gateAt ? this.gateAt((prev.x + pos.x) / 2, (prev.z + pos.z) / 2) : null;
      // on foot or on a cycle an automatic gate only lets you through after a OneStop scan (passCheck)
      if (!g || !this.gateOpen(g, hour, who) || (who !== 'car' && this.passCheck && !this.passCheck(g))) { pos.x = prev.x; pos.z = prev.z; this.lastBlock = g; return true; }
      return false;
    }
    // keep a little distance from the wall itself (except in a gateway)
    const c = closestOnRing(pos.x, pos.z, this.boundary, this._tmp);
    if (c.d < margin && !(this.gateAt && this.gateAt(pos.x, pos.z))) {
      const dx = pos.x - c.x, dz = pos.z - c.z, L = Math.hypot(dx, dz) || 1;
      pos.x = c.x + (dx / L) * margin; pos.z = c.z + (dz / L) * margin;
      return true;
    }
    return false;
  }

  /** gate hours and who may pass: the Main Gate is always open; KV and Khokha 6 am - 10 pm; Khokha is for students on foot or cycle */
  gateOpen(g, hour, who = 'walk') {
    if (g.closed) return false;
    if (g.main) return true;
    const day = hour >= 6 && hour < 22;
    if (/Khokha/.test(g.name || '')) return day && (who === 'walk' || who === 'bike');
    return day;
  }

  gateAt(x, z, r = 9) {
    for (const g of this.gates) if (!g.closed && Math.hypot(g.wx - x, g.wz - z) < (g.main ? 14 : r)) return g;
    return null;
  }

  /** Keep a point inside the campus wall (margin in metres, negative = allowed outside). */
  clampToCampus(pos, margin = 1.5) {
    const inside = this.insideCampus(pos.x, pos.z);
    const c = closestOnRing(pos.x, pos.z, this.boundary, this._tmp);
    const signed = inside ? c.d : -c.d; // + inside the wall, - outside
    if (signed < margin) {
      const dx = pos.x - c.x, dz = pos.z - c.z, L = Math.hypot(dx, dz) || 1;
      const inward = inside ? 1 : -1;
      pos.x = c.x + inward * (dx / L) * margin;
      pos.z = c.z + inward * (dz / L) * margin;
      return true;
    }
    return false;
  }

  nearestLandmark(x, z, maxD = Infinity) {
    let best = null, bd = maxD;
    for (const l of this.landmarks) {
      const d = Math.hypot(l.wx - x, l.wz - z);
      if (d < bd) { bd = d; best = l; }
    }
    return best ? { lm: best, d: bd } : null;
  }

  describeLocation(x, z) {
    const b = this.buildingAt(x, z);
    if (b && (b.display || b.name)) return b.display || b.name;
    const w = this.waterAt(x, z);
    if (w && w.name) return w.name;
    const n = this.nearestLandmark(x, z, 160);
    if (n) return (n.d < 45 ? '' : 'Near ') + n.lm.name;
    return 'IIT Guwahati campus';
  }
}

const EMPTY = [];

function flat(pts) {
  const a = new Float32Array(pts.length * 2);
  pts.forEach((p, i) => { a[i * 2] = p[0]; a[i * 2 + 1] = -p[1]; });
  return a;
}

function ringAreaMap(pts) {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return s / 2;
}

/** Outer rings CCW in map coords, holes CW (so "right of travel" is always outside the solid). */
export function orient(pts, outer) {
  const a = ringAreaMap(pts);
  if ((outer && a < 0) || (!outer && a > 0)) return pts.slice().reverse();
  return pts;
}

function ringArea(r) {
  let s = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) s += r[j] * r[i + 1] - r[i] * r[j + 1];
  return Math.abs(s / 2);
}

function solidContains(b, x, z) {
  if (!pointInRing(x, z, b.rings[0])) return false;
  for (let k = 1; k < b.rings.length; k++) if (pointInRing(x, z, b.rings[k])) return false;
  return true;
}

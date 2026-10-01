// Road graph routing on the real OSM campus road network.
import { inRing } from './scene/courts.js';
import { footprintBlocked } from './clearance.js';

const FOOT = new Set(['footway', 'path', 'steps', 'pedestrian', 'track', 'cycleway']);
const FOOT_HW = 1.1;                                   // a footpath is 2.2 m wide

// Who may use which road. `classify()` marks roads that pass through a building (thruB:
// arcades, portico driveways) and roads inside a walled compound of several blocks (inner:
// the academic complex spine, hostel courtyards) - those are for cycles and feet only.
export const FILTERS = {
  // through-roads only: the generated driveways and footpaths lead into single buildings
  car: (e) => e.main && !e.gen && !e.inner && !e.thruB && !e.motorBlocked && !e.gated && !(e.gate && /Khokha/.test(e.gate)),
  bus: (e) => e.main && !e.gen && !e.inner && !e.thruB && !e.motorBlocked && !e.busBlocked && !e.gated && !e.outside,
  drive: (e) => e.main && !e.thruB && !e.motorBlocked && !e.gated && !(e.gate && /Khokha/.test(e.gate)),
  bike: (e) => e.kind !== 'steps' && !e.thruB && !e.court && !e.gated && !e.hill,      // the View Point trail is for people on foot only
  walk: (e) => !e.fenced,
};

/** half width of the carriageway (0 for footpaths) */
export const HALF_W = { primary: 4.5, secondary: 4, tertiary: 3.7, unclassified: 3.5, residential: 3.2, service: 2.2, living_street: 2.5, track: 1.6 };
export const halfWidth = (e) => (e.foot ? 0 : HALF_W[e.kind] || 2.5);

/** India keeps left: centre of a vehicle of `width` metres, measured left of the centre line */
export function laneOffset(hw, width) {
  if (!hw) return 0;
  if (hw >= 5.4) return (0.8 + hw - 1.6) / 2;                 // a dual carriageway (scene/dualroads.js): the middle of the vehicle lane, between the median and the cycle lane
  return Math.max(0, Math.min(hw * 0.4, hw - width / 2 - 0.25, 1.8));
}

export class RoadGraph {
  constructor(g) {
    this.nodes = g.nodes.map(([x, y]) => [x, -y]);
    this.edges = g.edges.map((e, i) => ({ ...e, i, wpts: e.pts.map(([x, y]) => [x, -y]), foot: FOOT.has(e.kind) }));
    this.adj = this.nodes.map(() => []);
    for (const e of this.edges) {
      e.hw = halfWidth(e);
      e.cum = [0];
      for (let k = 1; k < e.wpts.length; k++) e.cum.push(e.cum[k - 1] + Math.hypot(e.wpts[k][0] - e.wpts[k - 1][0], e.wpts[k][1] - e.wpts[k - 1][1]));
      e.L = e.cum[e.cum.length - 1];
      this.adj[e.a].push({ e, to: e.b, fwd: true });
      this.adj[e.b].push({ e, to: e.a, fwd: false });
    }
  }

  /** Mark roads that no bus or cycle can use (through buildings / inside compounds). */
  /** Paths into fenced courts and grounds. Courts: nobody walks or cycles across them. Grounds:
   *  footpaths go through the pedestrian gates (no cycles); roads end at a closed gate. */
  markCourts(outlines) {
    let n = 0;
    for (const e of this.edges) {
      const P = e.wpts;
      let hit = null;
      for (let k = 0; k < P.length - 1 && !hit; k++) {
        const [ax, az] = P[k], [bx, bz] = P[k + 1], L = Math.hypot(bx - ax, bz - az) || 1e-6;
        for (let t = 0.5; t < L && !hit; t += 1) {
          const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L;
          hit = outlines.find((F) => inRing(F.ring, x, z)) || null;
        }
      }
      if (!hit) continue;
      n++;
      if (hit.court) { e.court = true; e.fenced = true; }
      else if (e.main && !e.foot) e.gated = true;
      else e.court = true;
    }
    this._comp = null; this._rc = null;
    return n;
  }

  classify(world) {
    this.world = world;
    const hulls = [];
    for (const s of world.sites) {
      if (s.blocks.length < 2) continue;
      const pts = [];
      for (const b of s.blocks) { const r = b.rings[0]; for (let k = 0; k < r.length; k += 2) pts.push([r[k], r[k + 1]]); }
      const H = convexHull(pts);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of H) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      hulls.push({ H, x0, x1, z0, z1, site: s });
    }
    let nB = 0, nI = 0;
    // how many roads meet at each node (a junction has three or more)
    const deg = new Map();
    for (const e of this.edges) if (e.main && !e.foot) { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
    for (const e of this.edges) {
      const P = e.wpts, side = e.foot ? [0] : [0, e.hw - 0.6, -(e.hw - 0.6)];
      let inside = 0, samples = 0, hitB = 0;
      for (let k = 0; k < P.length - 1; k++) {
        const [ax, az] = P[k], [bx, bz] = P[k + 1];
        const L = Math.hypot(bx - ax, bz - az) || 1e-6, tx = (bx - ax) / L, tz = (bz - az) / L;
        for (let t = 0.75; t < L; t += 1.5) {
          const x = ax + tx * t, z = az + tz * t;
          samples++;
          for (const o of side) if (world.buildingAt(x + tz * o, z - tx * o)) { hitB++; break; }
          for (const h of hulls) if (x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1 && inPoly(h.H, x, z)) { inside++; break; }
        }
      }
      // ignore a clipped corner at the very end (roads meet buildings at their doors)
      e.thruB = e.foot ? hitB >= 3 && !e.gen : hitB >= 1;
      e.inner = samples > 0 && e.main && (inside / samples > 0.35 || inside * 1.5 > 30);
      // Test both left-hand lanes with the entire body, including segment endpoints.
      e.motorBlocked = false; e.busBlocked = false;
      if (e.main && !e.thruB && !e.inner) {
        for (let k = 1; k < P.length; k++) {
          const [ax, az] = P[k - 1], [bx, bz] = P[k];
          const len = Math.hypot(bx - ax, bz - az);
          if (len < 0.001) continue;
          const tx = (bx - ax) / len, tz = (bz - az) / len, yaw = Math.atan2(tx, tz);
          const steps = Math.max(1, Math.ceil(len / 2));
          for (let j = 0; j <= steps; j++) for (const dir of [-1, 1]) {
            const x = ax + (bx - ax) * j / steps, z = az + (bz - az) * j / steps;
            for (const [key, hl, hw] of [['motorBlocked', 3.4, 1.2], ['busBlocked', 5.5, 1.4]]) {
              if (e[key]) continue;
              const off = laneOffset(e.hw, hw * 2) * dir;
              e[key] = footprintBlocked(world, x + tz * off, z - tx * off, yaw, hl + 1, hw + 0.3);
            }
          }
        }
      }
      if (e.main && !e.thruB && !e.inner) {
        // Turning bodies sweep wider than either straight lane at a junction (not at the bends along a road: the two
        // straight lanes either side of a bend already cover what a vehicle sweeps there)
        for (const [k, end] of [[0, e.a], [P.length - 1, e.b]]) {
          if ((deg.get(end) || 0) < 3) continue;
          const [x, z] = P[k];
          if (!e.busBlocked) e.busBlocked = footprintBlocked(world, x, z, 0, 7.4, 7.4);
          if (!e.motorBlocked) e.motorBlocked = footprintBlocked(world, x, z, 0, 5.0, 5.0);
        }
      }
      if (e.thruB) nB++;
      if (e.inner) nI++;
    }
    this._rc = null;
    this._comp = new Map();
    return { thruBuilding: nB, insideCompounds: nI };
  }

  /** Nearest carriageway (non-footpath edge) to a point: { d, hw, e, x, z, tx, tz } via a segment grid. */
  roadAt(x, z, maxD = 30, filter = (e) => !e.foot) {
    const G = 24;
    if (!this._rg) {
      this._rg = new Map();
      for (const e of this.edges) {
        const P = e.wpts;
        for (let k = 0; k < P.length - 1; k++) {
          const [ax, az] = P[k], [bx, bz] = P[k + 1];
          const gx0 = Math.floor(Math.min(ax, bx) / G) - 1, gx1 = Math.floor(Math.max(ax, bx) / G) + 1;
          const gz0 = Math.floor(Math.min(az, bz) / G) - 1, gz1 = Math.floor(Math.max(az, bz) / G) + 1;
          for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
            const key = gx * 65536 + gz;
            let c = this._rg.get(key);
            if (!c) this._rg.set(key, (c = []));
            c.push(e, k);
          }
        }
      }
    }
    let best = null, bd = maxD;
    const c = this._rg.get(Math.floor(x / G) * 65536 + Math.floor(z / G));
    if (!c) return null;
    for (let i = 0; i < c.length; i += 2) {
      const e = c[i], k = c[i + 1];
      if (!filter(e)) continue;
      const [ax, az] = e.wpts[k], [bx, bz] = e.wpts[k + 1];
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < bd) { const L = Math.sqrt(L2); bd = d; best = { d, hw: e.hw, e, x: px, z: pz, tx: dx / L, tz: dz / L }; }
    }
    return best;
  }

  /** true if (x,z) is on a carriageway (plus a margin) */
  onRoad(x, z, margin = 0.4) { const r = this.roadAt(x, z, 12); return !!r && r.d < r.hw + margin; }

  /** how far (x,z) is from the edge of the nearest way of ANY kind (carriageway, service lane, footpath, path);
   *  negative = on it. Footpaths are 2.2 m wide. `maxD` caps the search (returns maxD when nothing is near). */
  wayClearance(x, z, maxD = 14, footToo = true) {
    this.roadAt(x, z, 0);                                   // builds the segment grid once
    const c = this._rg.get(Math.floor(x / 24) * 65536 + Math.floor(z / 24));
    let best = maxD;
    if (!c) return best;
    for (let i = 0; i < c.length; i += 2) {
      const e = c[i], k = c[i + 1];
      if (e.foot && !footToo) continue;
      const [ax, az] = e.wpts[k], [bx, bz] = e.wpts[k + 1];
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t) - (e.foot ? FOOT_HW : Math.max(e.hw || 0, FOOT_HW));
      if (d < best) best = d;
    }
    return best;
  }
  /** true if a thing of radius `margin` at (x,z) would touch a road, a lane or a footpath */
  onWay(x, z, margin = 0.4) { return this.wayClearance(x, z, margin + 1) < margin; }

  /** connected components of the network a filter allows (cached per filter) */
  components(filter) {
    if (this._comp?.has(filter)) return this._comp.get(filter);
    const n = this.nodes.length, comp = new Int32Array(n).fill(-1), sizes = [];
    for (let i = 0; i < n; i++) {
      if (comp[i] >= 0 || !this.adj[i].some((l) => filter(l.e))) continue;
      const st = [i]; comp[i] = sizes.length; let c = 0;
      while (st.length) { const u = st.pop(); c++; for (const l of this.adj[u]) if (filter(l.e) && comp[l.to] < 0) { comp[l.to] = sizes.length; st.push(l.to); } }
      sizes.push(c);
    }
    let big = 0;
    sizes.forEach((s, i) => { if (s > sizes[big]) big = i; });
    const out = { comp, big };
    (this._comp ??= new Map()).set(filter, out);
    return out;
  }

  nearestNode(x, z, filter = FILTERS.walk, mainOnly = false, ok = null) {
    let best = -1, bd = Infinity;
    const C = mainOnly ? this.components(filter) : null;
    this.nodes.forEach(([nx, nz], i) => {
      if (C ? C.comp[i] !== C.big : !this.adj[i].some((l) => filter(l.e))) return;
      const d = (nx - x) ** 2 + (nz - z) ** 2;
      if (d < bd && (!ok || ok(i))) { bd = d; best = i; }
    });
    return best;
  }

  /** Can a vehicle `hl` m half-length and `hw` m half-width swing round on the spot at node `n` without touching a building?
   *  (A tour turns round at the end of a road that serves a stop.) */
  canTurn(n, hl, hw) {
    if (!this.world) return true;
    const k = `${n}:${hl}:${hw}`, C = (this._turn ??= new Map());
    if (!C.has(k)) { const [x, z] = this.nodes[n]; C.set(k, ![0, 0.8, 1.6, 2.4].some((yaw) => footprintBlocked(this.world, x, z, yaw, hl, hw))); }
    return C.get(k);
  }

  /** Closest point on any edge passing the filter. */
  nearestOnNetwork(x, z, filter = FILTERS.walk) {
    let best = null, bd = Infinity;
    for (const e of this.edges) {
      if (!filter(e)) continue;
      const P = e.wpts;
      let acc = 0;
      for (let k = 0; k < P.length - 1; k++) {
        const [ax, az] = P[k], [bx, bz] = P[k + 1];
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9, L = Math.sqrt(L2);
        let t = ((x - ax) * dx + (z - az) * dz) / L2;
        t = Math.max(0, Math.min(1, t));
        const px = ax + dx * t, pz = az + dz * t;
        const d = (px - x) ** 2 + (pz - z) ** 2;
        if (d < bd) { bd = d; best = { e, x: px, z: pz, s: acc + t * L, d: Math.sqrt(d) }; }
        acc += L;
      }
    }
    return best;
  }

  /** Dijkstra with a binary heap; stops early once `dst` is settled (if given). */
  dijkstra(src, filter, dst = -1) {
    const n = this.nodes.length;
    const dist = new Float64Array(n).fill(Infinity), prev = new Array(n).fill(null);
    dist[src] = 0;
    const done = new Uint8Array(n);
    const heap = [[0, src]];
    const push = (item) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [d, u] = pop();
      if (done[u]) continue;
      done[u] = 1;
      if (u === dst) break;
      for (const l of this.adj[u]) {
        if (!filter(l.e)) continue;
        const nd = d + l.e.len * (l.e.foot ? 1.15 : 1) * (l.e.outside ? 2.5 : 1);
        if (nd < dist[l.to]) { dist[l.to] = nd; prev[l.to] = { from: u, link: l }; push([nd, l.to]); }
      }
    }
    return { dist, prev };
  }

  /** Cached node-to-node walking/cycling route as a list of [x, z] points (or null). */
  route(src, dst, filter = FILTERS.walk, key = 'w') {
    const k = `${key}:${src}:${dst}`;
    this._rc ??= new Map();
    if (this._rc.has(k)) return this._rc.get(k);
    const D = this.dijkstra(src, filter, dst);
    let out = null;
    if (isFinite(D.dist[dst])) {
      const legs = [];
      for (let v = dst; v !== src; v = D.prev[v].from) legs.push(D.prev[v].link);
      legs.reverse();
      // third component: half width of the road leading to this point (0 = footpath)
      out = [this.nodes[src].slice()];
      for (const l of legs) {
        const P = l.fwd ? l.e.wpts : l.e.wpts.slice().reverse();
        for (let q = 1; q < P.length; q++) out.push([P[q][0], P[q][1], l.e.hw]);
      }
    }
    if (this._rc.size > 6000) this._rc.clear();
    this._rc.set(k, out);
    return out;
  }

  path(src, dst, filter = FILTERS.walk, cache) {
    const D = cache?.[src] || this.dijkstra(src, filter);
    if (cache) cache[src] = D;
    if (!isFinite(D.dist[dst])) return null;
    const legs = [];
    for (let v = dst; v !== src; v = D.prev[v].from) legs.push(D.prev[v].link);
    legs.reverse();
    const pts = [this.nodes[src].slice()];
    for (const l of legs) {
      const P = l.fwd ? l.e.wpts : l.e.wpts.slice().reverse();
      for (let k = 1; k < P.length; k++) pts.push([P[k][0], P[k][1], l.e.hw]);
    }
    return { legs, pts, len: D.dist[dst] };
  }

  /**
   * Order stops into a tour (nearest neighbour + 2-opt) and return the polyline
   * plus the distance along it where each stop is reached.
   */
  tour(stops, filter, { loop = true, start = 0, turn = null } = {}) {
    // only the connected part of the network; stops away from it are seen from the road
    const C = this.components(filter);
    // `turn` = [half length, half width] of a long vehicle: it turns round at the node it serves a stop from, so that node must have room
    const nodeOf = stops.map((s) => { const n = turn ? this.nearestNode(s.x, s.z, filter, true, (i) => this.canTurn(i, turn[0], turn[1])) : -1; return n >= 0 ? n : this.nearestNode(s.x, s.z, filter, true); });
    const inBig = (e) => filter(e) && C.comp[e.a] === C.big;
    for (const s of stops) { const n = this.nearestOnNetwork(s.x, s.z, inBig); s.roadD = n ? n.d : Infinity; s.roadPt = n ? { x: n.x, z: n.z } : null; }
    const cache = {};
    const n = stops.length;
    const D = Array.from({ length: n }, (_, i) => {
      const dj = cache[nodeOf[i]] || (cache[nodeOf[i]] = this.dijkstra(nodeOf[i], filter));
      return nodeOf.map((nd) => dj.dist[nd]);
    });
    const order = [start];
    const used = new Set(order);
    while (order.length < n) {
      const last = order[order.length - 1];
      let best = -1, bd = Infinity;
      for (let j = 0; j < n; j++) if (!used.has(j) && D[last][j] < bd) { bd = D[last][j]; best = j; }
      if (best < 0) break;
      order.push(best); used.add(best);
    }
    const cost = (o) => { let c = 0; for (let k = 0; k < o.length - 1; k++) c += D[o[k]][o[k + 1]]; if (loop) c += D[o[o.length - 1]][o[0]]; return c; };
    let improved = true, guard = 0;
    while (improved && guard++ < 60) {
      improved = false;
      for (let i = 1; i < order.length - 1; i++)
        for (let k = i + 1; k < order.length; k++) {
          const o2 = order.slice(0, i).concat(order.slice(i, k + 1).reverse(), order.slice(k + 1));
          if (cost(o2) + 1e-6 < cost(order)) { order.splice(0, order.length, ...o2); improved = true; }
        }
    }
    const seq = loop ? [...order, order[0]] : order;
    const pts = [];
    const stopAt = [];
    let acc = 0;
    for (let k = 0; k < seq.length - 1; k++) {
      const p = this.path(nodeOf[seq[k]], nodeOf[seq[k + 1]], filter, cache);
      if (!p) continue;
      if (k === 0) { pts.push(p.pts[0]); stopAt.push({ stop: stops[seq[0]], s: 0 }); }
      for (let q = 1; q < p.pts.length; q++) {
        const a = pts[pts.length - 1];
        acc += Math.hypot(p.pts[q][0] - a[0], p.pts[q][1] - a[1]);
        pts.push(p.pts[q]);
      }
      if (!(loop && k === seq.length - 2)) stopAt.push({ stop: stops[seq[k + 1]], s: acc });
    }
    return { order: order.map((i) => stops[i]), pts: dedupe(pts), stopAt, length: acc };
  }
}

export function convexHull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

export function inPoly(P, x, z) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

function dedupe(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1];
    if (Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]) > 0.3) out.push(pts[i]);
  }
  return out;
}

/** Arc-length parameterised polyline with a left-hand lane offset (a number, or a function
 *  of each road's half width - smoothed so the vehicle eases between lanes of different roads). */
export class PathFollower {
  constructor(pts, offset = 0) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.length = this.cum[this.cum.length - 1];
    this._k = 0;
    if (typeof offset === 'function') {
      const raw = pts.map((p, i) => offset(p[2] ?? pts[i + 1]?.[2] ?? 3));
      // moving average over ~12 m of road
      this.offs = raw.map((_, i) => {
        let s = 0, w = 0;
        for (let j = i; j >= 0 && this.cum[i] - this.cum[j] < 12; j--) { s += raw[j]; w++; }
        for (let j = i + 1; j < raw.length && this.cum[j] - this.cum[i] < 12; j++) { s += raw[j]; w++; }
        return s / w;
      });
      this.offset = 0;
    } else this.offset = offset;
  }

  seg(s) {
    s = Math.max(0, Math.min(this.length, s));
    let k = this._k;
    if (this.cum[k] > s) k = 0;
    while (k < this.cum.length - 2 && this.cum[k + 1] < s) k++;
    this._k = k;
    return k;
  }

  /** out: {x, z, dx, dz} at arc length s (dx,dz = unit tangent) */
  at(s, out = {}) {
    const k = this.seg(s);
    const a = this.pts[k], b = this.pts[k + 1] || a;
    const L = this.cum[k + 1] - this.cum[k] || 1;
    const t = Math.max(0, Math.min(1, (s - this.cum[k]) / L));
    let dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
    // smooth the tangent near corners
    const next = this.pts[k + 2];
    if (next && t > 0.6) {
      const L2 = Math.hypot(next[0] - b[0], next[1] - b[1]) || 1;
      const w = (t - 0.6) / 0.8;
      dx = dx * (1 - w) + ((next[0] - b[0]) / L2) * w;
      dz = dz * (1 - w) + ((next[1] - b[1]) / L2) * w;
      const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
    }
    const off = this.offs ? this.offs[k] + ((this.offs[k + 1] ?? this.offs[k]) - this.offs[k]) * t : this.offset;
    out.x = a[0] + (b[0] - a[0]) * t + dz * off;
    out.z = a[1] + (b[1] - a[1]) * t - dx * off;
    out.off = off;
    out.dx = dx; out.dz = dz;
    return out;
  }

  /** Signed turn (radians) over the next `ahead` metres - for slowing at corners. */
  curvature(s, ahead = 14) {
    const a = this.at(s, {}), b = this.at(Math.min(this.length, s + ahead), {});
    const c = a.dx * b.dz - a.dz * b.dx, d = a.dx * b.dx + a.dz * b.dz;
    return Math.atan2(c, d);
  }
}

// The Rhino Circle on the road in from the Main Gate: the road is split into a roundabout (a ring
// road round a grassy island) before the road graph and the road meshes are built, so every
// vehicle, bus, cyclist and walker goes round it. Map coordinates (x east, y north) as in campus.json.
// The master plan's other roundabouts are added the same way (planCircles), with plain traffic islands.
import * as THREE from 'three';
import { mergeColored, m4, mulberry32 } from '../util.js';

/** the point ~110 m in along the road from the Main Gate (where the rhino statue stands) */
export function rhinoSpot(data, along = 110) {
  const mg = data.gates.find((g) => g.main);
  if (!mg) return null;
  const road = data.roads.filter((r) => !r.gen).map((r) => ({ r, d: Math.min(Math.hypot(r.pts[0][0] - mg.x, r.pts[0][1] - mg.y), Math.hypot(r.pts[r.pts.length - 1][0] - mg.x, r.pts[r.pts.length - 1][1] - mg.y)) })).sort((a, b) => a.d - b.d)[0];
  if (!road) return null;
  let pts = road.r.pts;
  if (Math.hypot(pts[0][0] - mg.x, pts[0][1] - mg.y) > Math.hypot(pts[pts.length - 1][0] - mg.x, pts[pts.length - 1][1] - mg.y)) pts = pts.slice().reverse();
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + L >= along) { const t = (along - acc) / L; return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, w: road.r.w, kind: road.r.kind, ang: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) }; }
    acc += L;
  }
  return null;
}

/** the road junction nearest to the academic lake's shore, within 70 m of it (map coordinates): the circle by the lake,
 *  where the air-quality board, the guard and the bus stop stand. It becomes a roundabout with a flower island. */
export function lakeJunction(data) {
  const lake = data.water.find((q) => q.name === 'IITG lake');
  if (!lake) return null;
  const deg = new Map();
  for (const e of data.graph.edges) if (e.main && (e.len ?? 0) > 8) { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
  let best = null;
  data.graph.nodes.forEach(([x, y], i) => {
    if ((deg.get(i) || 0) < 3) return;
    let d = Infinity;
    for (const [px, py] of lake.p) d = Math.min(d, Math.hypot(px - x, py - y));
    if (d < 70 && (!best || d < best.d)) best = { x, y, d };
  });
  return best;
}

/** cut a polyline by the circle: the pieces outside it, each ending exactly on the circle */
function cut(pts, cx, cy, R) {
  const out = [];
  let cur = [];
  const inside = (p) => Math.hypot(p[0] - cx, p[1] - cy) < R;
  const cross = (a, b) => {                   // point on segment a-b at distance R from the centre
    const dx = b[0] - a[0], dy = b[1] - a[1], fx = a[0] - cx, fy = a[1] - cy;
    const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - R * R, disc = B * B - 4 * A * C;
    // no crossing when the line misses the circle (clamping the discriminant to 0 used to report the
    // closest point of every segment in the campus as a "crossing": it cut nearly every road in two and
    // joined the pieces to the ring with long invisible roads across lakes, fields and buildings)
    if (A < 1e-9 || disc < 0) return [];
    const D = Math.sqrt(disc);
    const ts = [(-B - D) / (2 * A), (-B + D) / (2 * A)].filter((t) => t >= 0 && t <= 1);
    return ts.map((t) => [a[0] + dx * t, a[1] + dy * t]);
  };
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], inP = inside(p);
    if (i > 0) {
      const q = pts[i - 1], inQ = inside(q), xs = cross(q, p);
      if (!inQ && inP) { cur.push(xs[0]); out.push(cur); cur = []; }
      else if (inQ && !inP) { cur = [xs[xs.length - 1]]; }
      else if (!inQ && !inP && xs.length === 2) { cur.push(xs[0]); out.push(cur); cur = [xs[1]]; }
    }
    if (!inP) cur.push(p);
  }
  if (cur.length > 1) out.push(cur);
  return out.filter((q) => q.length > 1 && q.reduce((s, p, k) => s + (k ? Math.hypot(p[0] - q[k - 1][0], p[1] - q[k - 1][1]) : 0), 0) > 1.5);
}

/** Split roads and the graph into a roundabout of centre-line radius R. Returns the island radius. */
export function addRoundabout(data, cx, cy, R, kind = 'secondary', w = 7, name = 'Roundabout') {
  const len = (q) => q.reduce((s, p, k) => s + (k ? Math.hypot(p[0] - q[k - 1][0], p[1] - q[k - 1][1]) : 0), 0);
  const ang = (p) => Math.atan2(p[1] - cy, p[0] - cx);
  // --- render roads
  const roads = [];
  for (const r of data.roads) {
    if (!r.pts.some((p) => Math.hypot(p[0] - cx, p[1] - cy) < R + 30)) { roads.push(r); continue; }
    for (const piece of cut(r.pts, cx, cy, R)) roads.push({ ...r, pts: piece });
  }
  const ring = [];
  for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; ring.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  roads.push({ pts: ring, w, kind, name, oneway: false, surface: 'asphalt' });
  data.roads = roads;
  // --- graph: cut edges, new nodes where they meet the ring, ring edges between them
  const G = data.graph, nodes = G.nodes, edges = [];
  const onRing = [];                               // [angle, nodeIndex]
  const nodeAt = (p) => { const i = nodes.length; nodes.push([Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]); onRing.push([ang(p), i]); return i; };
  const near = (p, i) => Math.hypot(nodes[i][0] - p[0], nodes[i][1] - p[1]) < 0.5;
  for (const e of G.edges) {
    if (!e.pts.some((p) => Math.hypot(p[0] - cx, p[1] - cy) < R + 1) && !cut(e.pts, cx, cy, R).some((q) => q.length !== e.pts.length)) { edges.push(e); continue; }
    const pieces = cut(e.pts, cx, cy, R);
    if (pieces.length === 1 && pieces[0].length === e.pts.length && Math.hypot(pieces[0][0][0] - e.pts[0][0], pieces[0][0][1] - e.pts[0][1]) < 0.01) { edges.push(e); continue; }
    for (const q of pieces) {
      const a = near(q[0], e.a) ? e.a : near(q[0], e.b) ? e.b : nodeAt(q[0]);
      const last = q[q.length - 1];
      const b = near(last, e.b) ? e.b : near(last, e.a) ? e.a : nodeAt(last);
      edges.push({ ...e, a, b, pts: q, len: Math.round(len(q) * 10) / 10 });
    }
  }
  // evenly spaced ring nodes too, so the ring follows the circle
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; if (!onRing.some(([b]) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.2)) nodeAt([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  onRing.sort((p, q) => p[0] - q[0]);
  for (let k = 0; k < onRing.length; k++) {
    const [a0, i] = onRing[k], [a1r, j] = onRing[(k + 1) % onRing.length];
    const a1 = a1r <= a0 ? a1r + Math.PI * 2 : a1r;
    const pts = [];
    const n = Math.max(2, Math.ceil(((a1 - a0) * R) / 3));
    for (let s = 0; s <= n; s++) { const t = a0 + ((a1 - a0) * s) / n; pts.push([cx + Math.cos(t) * R, cy + Math.sin(t) * R]); }
    pts[0] = nodes[i].slice(); pts[pts.length - 1] = nodes[j].slice();
    edges.push({ kind, car: true, main: true, a: i, b: j, pts, len: Math.round(len(pts) * 10) / 10, ring: true });
  }
  G.edges = edges;
  return R - w / 2 - 0.4;
}

const FOOT = new Set(['footway', 'path', 'steps', 'pedestrian', 'track', 'cycleway']);
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
function polyDist(poly, x, y) {
  let inside = false, d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    d = Math.min(d, segDist(x, y, xi, yi, xj, yj));
  }
  return inside ? 0 : d;
}

/** a disc of radius r laid on the terrain, `lift` above it, in world coordinates (for mergeColored) */
export function drapedDisc(W, x, z, r, lift = 0.3, rings = 6, seg = 40) {
  const pos = [], idx = [];
  pos.push(x, W.heightAt(x, z) + lift, z);
  for (let j = 1; j <= rings; j++) for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2, rr = (r * j) / rings, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    pos.push(px, W.heightAt(px, pz) + lift, pz);
  }
  for (let k = 0; k < seg; k++) idx.push(0, 1 + ((k + 1) % seg), 1 + k);
  for (let j = 1; j < rings; j++) for (let k = 0; k < seg; k++) {
    const a = 1 + (j - 1) * seg + k, b = 1 + (j - 1) * seg + ((k + 1) % seg), c = 1 + j * seg + k, d = 1 + j * seg + ((k + 1) % seg);
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The master plan's roundabouts, each moved onto the game's road junction it belongs to (a car
 *  junction within 18 m), sized to the widest road there; skipped where there is no room. */
export function planCircles(data, list) {
  const deg = new Map();
  for (const e of data.graph.edges) if (e.car) { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
  const mg = data.gates.find((g) => g.main);
  const out = [];
  for (const c of list) {
    let best = -1, bd = 18;
    data.graph.nodes.forEach(([x, y], i) => { if ((deg.get(i) || 0) < 3) return; const d = Math.hypot(x - c.x, y - c.y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) continue;
    const [x, y] = data.graph.nodes[best];
    let kind = 'unclassified', w = 6;
    for (const r of data.roads) {
      if (FOOT.has(r.kind) || r.kind === 'service') continue;
      let d = Infinity;
      for (let k = 0; k < r.pts.length - 1; k++) d = Math.min(d, segDist(x, y, r.pts[k][0], r.pts[k][1], r.pts[k + 1][0], r.pts[k + 1][1]));
      if (d < 4 && r.w >= w) { w = r.w; kind = r.kind; }
    }
    w = Math.min(8, w);
    const R = c.island + w / 2 + 0.4;
    const room = R + w / 2 + 1;
    if (!c.rhino && (data.buildings.some((b) => polyDist(b.p, x, y) < room) || data.water.some((q) => polyDist(q.p, x, y) < room))) continue;
    // for the statues: the direction of the road in from the Main Gate
    const ang = mg ? Math.atan2(y - mg.y, x - mg.x) : 0;
    out.push({ ...c, x, y, R, w, kind, ang });
  }
  return out;
}

/** Traffic islands for the plain roundabouts: painted kerb, lawn, a ring of clipped shrubs, a flower
 *  bed and a tall lamp post in the middle (the Rhino Circle has its own, in landmarks.js). */
export function buildIslands(game) {
  const W = game.world, group = new THREE.Group(), parts = [];
  group.name = 'islands';
  const r = mulberry32(5150);
  for (const I of game.islands || []) {
    if (I.rhino) continue;
    const { x, z, r: R } = I, y = W.heightAt(x, z);
    W.addSurface({ kind: 'disc', x, z, r: R - 0.1, lift: 0.3 });                     // walk on the island's lawn, not in it
    const n = Math.max(24, Math.round(R * 5));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, L = (2 * Math.PI * R) / n, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
      parts.push({ geometry: new THREE.BoxGeometry(L * 1.03, 0.6, 0.3), color: k % 2 ? '#1a1a1a' : '#f2f2ee', matrix: m4(px, W.heightAt(px, pz) - 0.05, pz, 0, -a + Math.PI / 2, 0) });
    }
    parts.push({ geometry: drapedDisc(W, x, z, R - 0.1, 0.3), color: '#5f9a3a', matrix: new THREE.Matrix4() });
    for (let k = 0; k < Math.round(R * 2.6); k++) {
      const a = (k / Math.round(R * 2.6)) * Math.PI * 2, rr = R * 0.72, sx = x + Math.cos(a) * rr, sz = z + Math.sin(a) * rr;
      parts.push({ geometry: new THREE.IcosahedronGeometry(0.4 + (k % 3) * 0.06, 1), color: k % 2 ? '#4f7f2a' : '#6f9a2e', matrix: m4(sx, W.heightAt(sx, sz) + 0.55, sz, 0, 0, 0, 1, 0.8, 1) });
    }
    if (I.flowers) {
      // the flower circle (the Lake Circle): bands of flowers in rings round a raised bed of tall canna lilies, marigold, rose and white
      const bands = [[0.3, '#d81b60', '#f6a6c4'], [0.43, '#f2c12e', '#f28c1c'], [0.56, '#f4f4ef', '#fbd0dc'], [0.69, '#c62828', '#ff7a1a']];
      for (const [f, ca, cb] of bands) for (const row of [0, 1]) {
        const rr = R * (f + row * 0.055), n = Math.round((2 * Math.PI * rr) / 0.34);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + row * 0.5 + (r() - 0.5) * 0.06, fx = x + Math.cos(a) * rr, fz = z + Math.sin(a) * rr, h = 0.26 + r() * 0.14, gy = W.heightAt(fx, fz) + 0.3;
          parts.push({ geometry: new THREE.CylinderGeometry(0.012, 0.014, h, 4), color: '#3f7a2f', matrix: m4(fx, gy + h / 2, fz) });
          parts.push({ geometry: new THREE.IcosahedronGeometry(0.1 + r() * 0.05, 0), color: k % 3 === 0 ? cb : ca, matrix: m4(fx, gy + h + 0.03, fz) });
          if (k % 3 === 0) parts.push({ geometry: new THREE.IcosahedronGeometry(0.12, 0).scale(1.5, 0.4, 1.5), color: '#4a8a34', matrix: m4(fx, gy + 0.05, fz) });
        }
      }
      const hub = R * 0.2;                                                             // the raised centre bed with a low stone rim
      parts.push({ geometry: new THREE.CylinderGeometry(hub, hub + 0.06, 0.5, 20), color: '#b9b3a6', matrix: m4(x, y + 0.5, z) });
      parts.push({ geometry: new THREE.CylinderGeometry(hub - 0.1, hub - 0.1, 0.5, 20), color: '#5a3a24', matrix: m4(x, y + 0.56, z) });
      for (let k = 0; k < 16; k++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * (hub - 0.2), fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d, h = 0.7 + r() * 0.5;
        parts.push({ geometry: new THREE.CylinderGeometry(0.015, 0.02, h, 4), color: '#3f7a2f', matrix: m4(fx, y + 0.8 + h / 2, fz) });
        parts.push({ geometry: new THREE.IcosahedronGeometry(0.13, 0), color: ['#e03131', '#f6b21c', '#ff7a1a'][k % 3], matrix: m4(fx, y + 0.8 + h, fz) });
      }
    }
    const pal = [['#f28c1c', '#f6b21c'], ['#c62828', '#f2c12e'], ['#d81b60', '#f4f4ef']][Math.floor(r() * 3)];
    for (let k = 0; k < (I.flowers ? 0 : 70); k++) { const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.42, fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d; parts.push({ geometry: new THREE.IcosahedronGeometry(0.15 + r() * 0.07, 0), color: pal[k % 2], matrix: m4(fx, W.heightAt(fx, fz) + 0.42, fz) }); }
    // the tall lamp post in the middle, with four lamps
    parts.push({ geometry: new THREE.CylinderGeometry(0.12, 0.2, 9, 10), color: '#8a8f96', matrix: m4(x, y + 4.5, z) });
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; parts.push({ geometry: new THREE.BoxGeometry(0.9, 0.08, 0.08), color: '#8a8f96', matrix: m4(x + Math.cos(a) * 0.45, y + 9, z + Math.sin(a) * 0.45, 0, -a, 0) }); parts.push({ geometry: new THREE.BoxGeometry(0.4, 0.18, 0.28), color: '#f4f1e2', matrix: m4(x + Math.cos(a) * 0.9, y + 8.9, z + Math.sin(a) * 0.9, 0, -a, 0) }); }
  }
  if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  // the kerb: cycles and cars go round, people may step onto the island
  for (const I of game.islands || []) {
    if (I.rhino) continue;
    const y = W.heightAt(I.x, I.z), n = 24;
    for (let k = 0; k < n; k++) { const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2; W.indexFence({ ax: I.x + Math.cos(a0) * (I.r - 0.3), az: I.z + Math.sin(a0) * (I.r - 0.3), bx: I.x + Math.cos(a1) * (I.r - 0.3), bz: I.z + Math.sin(a1) * (I.r - 0.3), top: y + 1.2, bikeOnly: true }); }
  }
  return { group };
}

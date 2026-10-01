import * as THREE from 'three';
import { canvasTexture, mulberry32 } from '../util.js';
import { wetPatch } from './shared.js';

const MAIN = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential']);
const FOOT = new Set(['footway', 'path', 'steps', 'pedestrian', 'track', 'cycleway']);

function asphalt(markings) {
  const rnd = mulberry32(markings ? 3 : 4);
  return canvasTexture(256, 512, (g, W, H) => {
    g.fillStyle = '#434547';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      const v = 52 + Math.floor(rnd() * 40);
      g.fillStyle = `rgba(${v},${v},${v + 2},0.5)`;
      g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    // patched / worn areas
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(${40 + rnd() * 20},${40 + rnd() * 20},${42 + rnd() * 20},0.08)`;
      g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 10 + rnd() * 40, 10 + rnd() * 60, rnd() * 3, 0, 7); g.fill();
    }
    // soft kerb edges
    const eg = g.createLinearGradient(0, 0, W, 0);
    eg.addColorStop(0, 'rgba(150,140,120,0.55)'); eg.addColorStop(0.06, 'rgba(0,0,0,0)');
    eg.addColorStop(0.94, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(150,140,120,0.55)');
    g.fillStyle = eg; g.fillRect(0, 0, W, H);
    if (markings) {
      g.fillStyle = 'rgba(235,232,220,0.85)';
      g.fillRect(W / 2 - 3, 0, 6, H * 0.35);            // dashed centre line
      g.fillStyle = 'rgba(235,232,220,0.55)';
      g.fillRect(12, 0, 4, H); g.fillRect(W - 16, 0, 4, H);   // edge lines
    }
  });
}

function dirt() {
  const rnd = mulberry32(21);
  return canvasTexture(128, 256, (g, W, H) => {
    g.fillStyle = '#7d6647'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 1800; k++) { const v = 80 + Math.floor(rnd() * 70); g.fillStyle = `rgba(${v + 30},${v + 10},${v - 18},0.5)`; g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 2 + rnd() * 3); }
    for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(${90 + rnd() * 50},${60 + rnd() * 30},30,${0.3 + rnd() * 0.3})`; g.fillRect(rnd() * W, rnd() * H, 5 + rnd() * 7, 2 + rnd() * 3); }
    const eg = g.createLinearGradient(0, 0, W, 0);
    eg.addColorStop(0, 'rgba(60,80,40,0.7)'); eg.addColorStop(0.16, 'rgba(0,0,0,0)'); eg.addColorStop(0.84, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(60,80,40,0.7)');
    g.fillStyle = eg; g.fillRect(0, 0, W, H);
  });
}

function paving() {
  const rnd = mulberry32(9);
  return canvasTexture(128, 256, (g, W, H) => {
    g.fillStyle = '#b3a58c'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 16)
      for (let x = (y / 16) % 2 ? -12 : 0; x < W; x += 24) {
        const v = 150 + Math.floor(rnd() * 40);
        g.fillStyle = `rgb(${v + 20},${v + 8},${v - 12})`;
        g.fillRect(x + 1, y + 1, 22, 14);
      }
  });
}

let MATS = null;
/** shared road materials (the outside roads use them too) */
export function roadMaterials() {
  if (MATS) return MATS;
  const mats = {
    main: new THREE.MeshStandardMaterial({ map: asphalt(true), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    plain: new THREE.MeshStandardMaterial({ map: asphalt(false), roughness: 0.94, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    foot: new THREE.MeshStandardMaterial({ map: paving(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    junction: new THREE.MeshStandardMaterial({ map: asphalt(false), roughness: 0.94, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    // the dual carriageways (dualroads.js): tarmac, the green cycle lanes, the white lines, the median's kerb and its bed
    dual: new THREE.MeshStandardMaterial({ map: asphalt(false), roughness: 0.94, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    lane: new THREE.MeshStandardMaterial({ color: 0x3e7d57, roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -3.5, polygonOffsetUnits: -3.5 }),
    line: new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3.8, polygonOffsetUnits: -3.8 }),
    kerb: new THREE.MeshStandardMaterial({ color: 0xd9d5c9, roughness: 0.9 }),
    bed: new THREE.MeshStandardMaterial({ color: 0x5b8a38, roughness: 1 }),
    trail: new THREE.MeshStandardMaterial({ map: dirt(), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),       // the View Point trail: packed earth and leaves
  };
  mats.dual.onBeforeCompile = (sh) => wetPatch(sh, { puddles: true, minRough: 0.2 });
  mats.lane.onBeforeCompile = (sh) => wetPatch(sh, { puddles: true, minRough: 0.25 });
  mats.main.onBeforeCompile = (sh) => wetPatch(sh, { puddles: true, minRough: 0.18 });
  mats.plain.onBeforeCompile = (sh) => wetPatch(sh, { puddles: true, minRough: 0.2 });
  mats.junction.onBeforeCompile = (sh) => wetPatch(sh, { puddles: true, minRough: 0.2 });
  mats.foot.onBeforeCompile = (sh) => wetPatch(sh, { minRough: 0.35 });
  MATS = mats;
  return mats;
}

/** Every road surface lies this far (m) above the ground, a few mm more per road so that roads laid over each other do not
 *  flicker. It is as thin as it can be: what you stand on is the ground, so a thick road would bury your feet. */
export const ROAD_LIFT = 0.028;
export const ROAD_TOP = 0.062;          // the highest a road, or a junction patch, gets: paint and decals sit just above this

export function buildRoads(world, graph = null) {
  const group = new THREE.Group();
  group.name = 'roads';
  const mats = roadMaterials();
  const buckets = { main: newB(), plain: newB(), foot: newB(), trail: newB() };

  world.data.roads.forEach((r, ri) => {
    const key = r.trail ? 'trail' : FOOT.has(r.kind) ? 'foot' : MAIN.has(r.kind) && r.w >= 6.5 ? 'main' : 'plain';
    const lift = ROAD_LIFT + (ri % 4) * 0.003 + (key === 'main' ? 0.006 : 0);
    ribbon(world, r.pts.map((p) => [p[0], -p[1]]), r.w, lift, buckets[key], key === 'foot' || key === 'trail' ? 3 : r.w);
  });
  for (const k of Object.keys(buckets)) {
    const m = new THREE.Mesh(toGeo(buckets[k]), mats[k]);
    m.receiveShadow = true;
    group.add(m);
  }

  // junction patches hide overlapping markings where roads meet
  const deg = new Map();
  const nhw = new Map();                                               // the widest road at each junction (a dual carriageway is wider)
  for (const e of (graph ? graph.edges : world.data.graph.edges)) {
    if (!e.car) continue;
    deg.set(e.a, (deg.get(e.a) || 0) + 1);
    deg.set(e.b, (deg.get(e.b) || 0) + 1);
    if (e.hw) { nhw.set(e.a, Math.max(nhw.get(e.a) || 0, e.hw)); nhw.set(e.b, Math.max(nhw.get(e.b) || 0, e.hw)); }
  }
  const jb = newB();
  for (const [n, d] of deg) {
    if (d < 3) continue;
    const nd = graph ? graph.nodes[n] : null;                          // (the graph's own nodes are already in world coordinates and include the roads outside the wall)
    if (!nd && !world.data.graph.nodes[n]) continue;
    const x = nd ? nd[0] : world.data.graph.nodes[n][0], z = nd ? nd[1] : -world.data.graph.nodes[n][1];
    // a disc of rings draped over the ground (a single fan from the middle cuts across every bump and swells above or sinks
    // below the terrain between its spokes, which is what made the junctions look like raised slabs)
    const R = Math.max(5.2, (nhw.get(n) || 0) + 0.5), seg = 24, rings = 4, top = ROAD_TOP - 0.004;
    const at = (a, rr) => { const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; return [px, world.heightAt(px, pz) + top, pz]; };
    const push = (p) => { jb.p.push(p[0], p[1], p[2]); jb.n.push(0, 1, 0); jb.u.push(p[0] / 8, p[2] / 8); };
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      push([x, world.heightAt(x, z) + top, z]); push(at(a1, R / rings)); push(at(a0, R / rings));
      for (let j = 1; j < rings; j++) {
        const r0 = (R * j) / rings, r1 = (R * (j + 1)) / rings;
        const A = at(a0, r0), B = at(a1, r0), C = at(a0, r1), D = at(a1, r1);
        push(A); push(B); push(C); push(B); push(D); push(C);
      }
    }
  }
  if (jb.p.length) {
    const jm = new THREE.Mesh(toGeo(jb), mats.junction);
    jm.receiveShadow = true;
    group.add(jm);
  }
  return { group };
}

export function newB() { return { p: [], n: [], u: [] }; }
export function toGeo(B) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
  g.computeVertexNormals();
  return g;
}

/** Terrain-draped ribbon along a polyline of [x,z] world points: sampled every 3 m along and every ~2 m across, each sample
 *  on the ground plus `lift`, so the road is the ground itself, only a skin above it. */
export function ribbon(world, pts, width, lift, B, vScale = 8, center = 0) {
  // densify so the ribbon follows the terrain
  const d = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    const m = Math.max(1, Math.ceil(L / 3));
    for (let s = 0; s < m; s++) d.push([ax + ((bx - ax) * s) / m, az + ((bz - az) * s) / m]);
  }
  d.push(pts[pts.length - 1]);
  if (d.length < 2) return;
  const hw = width / 2, K = Math.max(2, Math.ceil(width / 2.2) + 1);       // samples across (2 for a thin line)
  let cum = 0;
  const rows = [], V = [];
  for (let i = 0; i < d.length; i++) {
    const p = d[i], a = d[Math.max(0, i - 1)], b = d[Math.min(d.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;
    if (i > 0) cum += Math.hypot(p[0] - d[i - 1][0], p[1] - d[i - 1][1]);
    const row = [];
    for (let c = 0; c < K; c++) {
      const u = c / (K - 1), off = center + (2 * u - 1) * hw, x = p[0] + nx * off, z = p[1] + nz * off;
      row.push([x, world.heightAt(x, z) + lift, z, u]);
    }
    rows.push(row); V.push(cum / vScale);
  }
  // up-facing triangles (winding fixed by the cross product)
  const tri = (A, Bv, C, va, vb, vc) => {
    const ux = Bv[0] - A[0], uz = Bv[2] - A[2], vx = C[0] - A[0], vz = C[2] - A[2];
    const y = uz * vx - ux * vz;
    if (y < 0) { B.p.push(A[0], A[1], A[2], C[0], C[1], C[2], Bv[0], Bv[1], Bv[2]); B.u.push(A[3], va, C[3], vc, Bv[3], vb); }
    else { B.p.push(A[0], A[1], A[2], Bv[0], Bv[1], Bv[2], C[0], C[1], C[2]); B.u.push(A[3], va, Bv[3], vb, C[3], vc); }
    B.n.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  };
  for (let i = 0; i < d.length - 1; i++)
    for (let c = 0; c < K - 1; c++) {
      const a = rows[i][c], b = rows[i][c + 1], e = rows[i + 1][c], f = rows[i + 1][c + 1];
      tri(a, b, f, V[i], V[i], V[i + 1]);
      tri(a, f, e, V[i], V[i + 1], V[i + 1]);
    }
}

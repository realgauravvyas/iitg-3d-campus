// Two-lane roads with a divider. The campus's main through-roads where there is plenty of room (11 m clear each side of the
// centre line) become dual carriageways: a flowered median with small trees, and on each side a vehicle lane and a green cycle
// lane (a third of that carriageway) along the outer kerb. Left out, as they should be: the loop round the Serpentine Lake, the
// roads up to the View Point, the roads at the gates, roundabouts and anything squeezed between buildings.
//   planDualRoads(world, graph)  marks the roads (graph edges: e.dual, wider e.hw) before anything is placed on them
//   buildDualRoads(game)         the surfaces, kerbs, flowers and trees
import * as THREE from 'three';
import { mergeColored, m4, mulberry32 } from '../util.js';
import { ribbon, newB, toGeo, roadMaterials, ROAD_LIFT, ROAD_TOP } from './roads.js';

export const DUAL_HW = 5.6;              // half width of the whole road: 1.6 m cycle lane + 3.2 m lane + 0.8 m half the median, each side
export const DUAL_MED = 0.8;             // half width of the median
export const DUAL_CYCLE = 1.6;           // width of each cycle lane
const NEED = 11;                         // clearance wanted on each side of the centre line (m)
const EXCLUDE_VIEW = 520, EXCLUDE_SERP = 48, EXCLUDE_GATE = 45;

/** grid of polygon edges: distance to the nearest */
function clearanceField(W) {
  const CS = 32, G = new Map();
  const add = (ax, az, bx, bz) => {
    for (let i = Math.floor(Math.min(ax, bx) / CS) - 1; i <= Math.floor(Math.max(ax, bx) / CS) + 1; i++) for (let j = Math.floor(Math.min(az, bz) / CS) - 1; j <= Math.floor(Math.max(az, bz) / CS) + 1; j++) { const k = i * 100000 + j; let c = G.get(k); if (!c) G.set(k, (c = [])); c.push(ax, az, bx, bz); }
  };
  const ring = (r) => { for (let i = 0; i < r.length; i += 2) { const j = (i + 2) % r.length; add(r[i], r[i + 1], r[j], r[j + 1]); } };
  for (const b of W.buildings) for (const r of b.rings) ring(r);
  for (const w of W.water) if (w.kind !== 'pool') ring(w.rings[0]);
  for (const f of W.fields) if (f.kind !== 'park' && f.ring) ring(f.ring);
  return (x, z, R = 14) => {
    let m = R;
    for (let i = Math.floor((x - R) / CS); i <= Math.floor((x + R) / CS); i++) for (let j = Math.floor((z - R) / CS); j <= Math.floor((z + R) / CS); j++) {
      const c = G.get(i * 100000 + j); if (!c) continue;
      for (let q = 0; q < c.length; q += 4) {
        const dx = c[q + 2] - c[q], dz = c[q + 3] - c[q + 1], L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - c[q]) * dx + (z - c[q + 1]) * dz) / L2));
        m = Math.min(m, Math.hypot(x - c[q] - dx * t, z - c[q + 1] - dz * t));
      }
    }
    return m;
  };
}

export function planDualRoads(W, G) {
  const clear = clearanceField(W);
  const vp = W.landmark('viewpoint');
  const serp = W.water.find((w) => /serpentine/i.test(w.name || ''));
  const serpRing = serp ? serp.rings[0] : null;
  const nearSerp = (x, z) => { if (!serpRing) return false; for (let i = 0; i < serpRing.length; i += 2) if (Math.hypot(serpRing[i] - x, serpRing[i + 1] - z) < EXCLUDE_SERP + 12) { const j = (i + 2) % serpRing.length; return Math.hypot(serpRing[i] - x, serpRing[i + 1] - z) < EXCLUDE_SERP || Math.hypot(serpRing[j] - x, serpRing[j + 1] - z) < EXCLUDE_SERP; } return false; };
  const out = [];
  let m = 0;
  for (const e of G.edges) {
    if (!(e.car && e.main) || e.gen || e.ring || e.outside || e.inner || e.gated || e.foot || e.L < 70) continue;
    if (vp && e.wpts.some(([x, z]) => Math.hypot(x - vp.wx, z - vp.wz) < EXCLUDE_VIEW)) continue;
    if ((W.gates || []).some((g) => e.wpts.some(([x, z]) => Math.hypot(x - g.wx, z - g.wz) < EXCLUDE_GATE))) continue;
    // nothing within the width of the road + a verge along it: sampled every 6 m
    let n = 0, ok = 0, bad = false;
    for (let k = 0; k < e.wpts.length - 1 && !bad; k++) {
      const [ax, az] = e.wpts[k], [bx, bz] = e.wpts[k + 1], l = Math.hypot(bx - ax, bz - az) || 1e-6;
      for (let s = 0; s < l; s += 6) { const x = ax + ((bx - ax) * s) / l, z = az + ((bz - az) * s) / l; n++; if (clear(x, z, NEED + 1) >= NEED) ok++; if (nearSerp(x, z)) { bad = true; break; } }
    }
    if (bad || !n || ok / n < 0.97) continue;
    e.dual = true; e.hw = DUAL_HW; out.push(e); m += e.L;
  }
  return { edges: out, metres: Math.round(m) };
}

/** a strip of road surface between offsets o0 and o1 from the centre line (+ is left of travel), drawn with ribbon() */
function strip(world, pts, o0, o1, lift, B, vScale = 8) { ribbon(world, pts, o1 - o0, lift, B, vScale, (o0 + o1) / 2); }

/** the points of a polyline between s0 and s1 metres along it (for the part of a road without a median) */
function sub(w, cum, s0, s1) {
  const out = [];
  const at = (s) => { let k = 0; while (k < cum.length - 2 && cum[k + 1] < s) k++; const L = cum[k + 1] - cum[k] || 1, t = (s - cum[k]) / L; return [w[k][0] + (w[k + 1][0] - w[k][0]) * t, w[k][1] + (w[k + 1][1] - w[k][1]) * t]; };
  out.push(at(s0));
  for (let k = 1; k < cum.length - 1; k++) if (cum[k] > s0 && cum[k] < s1) out.push(w[k]);
  out.push(at(s1));
  return out;
}

export function buildDualRoads(game) {
  const W = game.world, G = game.graph, group = new THREE.Group();
  group.name = 'dual-roads';
  const edges = G.edges.filter((e) => e.dual);
  if (!edges.length) return { group, count: 0, metres: 0 };
  const mats = roadMaterials();
  const base = newB(), lane = newB(), line = newB(), kerb = newB(), soil = newB();
  const skirt = [];                                                   // vertical faces of the median kerb
  const TOPY = ROAD_TOP + 0.006, jn = new Set();                      // the dual tarmac's height, and the junctions it ends at
  const rnd = mulberry32(2718);
  const shrubs = [], blooms = [], treesAt = [];
  const COLS = ['#e0317a', '#f2c12e', '#ff7a1a', '#d92b2b', '#f4f1ea', '#b04bd6', '#ff5e9a'];
  let metres = 0;
  for (const e of edges) {
    const w = e.wpts, cum = e.cum, L = e.L;
    metres += L;
    // the full width of tarmac under everything: above every older ribbon AND above the junction patches (their tops are at 5.8 cm), so a
    // dual carriageway is never half covered by a round junction plate of another texture where other roads meet it
    ribbon(W, w, DUAL_HW * 2, TOPY, base, 10);
    // cycle lanes, leaving 7 m at each end for the junction; on both sides: the outer kerb side is +/- (DUAL_HW - DUAL_CYCLE .. DUAL_HW)
    const trim = Math.min(7, L * 0.2), core = sub(w, cum, trim, L - trim);
    for (const s of [1, -1]) {
      strip(W, core, s > 0 ? DUAL_HW - DUAL_CYCLE : -DUAL_HW, s > 0 ? DUAL_HW : -(DUAL_HW - DUAL_CYCLE), TOPY + 0.014, lane, 10);
      strip(W, core, s * (DUAL_HW - DUAL_CYCLE) - 0.06, s * (DUAL_HW - DUAL_CYCLE) + 0.06, TOPY + 0.02, line, 10);          // the white line between the lane and the cycle lane
    }
    jn.add(e.a); jn.add(e.b);
    // the median: two light kerb strips, the raised bed between them, its faces
    const medA = sub(w, cum, Math.min(9, L * 0.25), L - Math.min(9, L * 0.25));
    const H0 = 0.17;
    strip(W, medA, -DUAL_MED, -DUAL_MED + 0.22, H0 + 0.004, kerb, 4); strip(W, medA, DUAL_MED - 0.22, DUAL_MED, H0 + 0.004, kerb, 4);
    strip(W, medA, -DUAL_MED + 0.22, DUAL_MED - 0.22, H0, soil, 4);
    // the faces are found again from the points, with their normals
    const dens = [];
    for (let i = 0; i < medA.length - 1; i++) { const [ax, az] = medA[i], [bx, bz] = medA[i + 1], l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(l / 3)); for (let s = 0; s < n; s++) dens.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n]); }
    dens.push(medA[medA.length - 1]);
    for (let i = 0; i < dens.length - 1; i++) {
      const [ax, az] = dens[i], [bx, bz] = dens[i + 1], l = Math.hypot(bx - ax, bz - az) || 1, tx = (bx - ax) / l, tz = (bz - az) / l, nx = -tz, nz = tx;
      for (const s of [1, -1]) {
        const o = s * DUAL_MED, x0 = ax + nx * o, z0 = az + nz * o, x1 = bx + nx * o, z1 = bz + nz * o;
        skirt.push(x0, W.heightAt(x0, z0) + ROAD_LIFT, z0, x1, W.heightAt(x1, z1) + ROAD_LIFT, z1, x1, W.heightAt(x1, z1) + H0, z1, x0, W.heightAt(x0, z0) + ROAD_LIFT, z0, x1, W.heightAt(x1, z1) + H0, z1, x0, W.heightAt(x0, z0) + H0, z0);
      }
      // a place to step up onto: you can cross the road, the median is 17 cm high
      if (i % 2 === 0) W.addSurface({ kind: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hx: DUAL_MED - 0.05, hz: l + 0.2, yaw: Math.atan2(tx, tz), lift: H0 - ROAD_LIFT });
      // planting: a flowering shrub every ~2 m with two or three blooms on it, a small tree every ~10 m
      const cx = (ax + bx) / 2, cz = (az + bz) / 2, gy = W.heightAt(cx, cz) + H0;
      if (i % 3 === 1) treesAt.push([cx, gy, cz, 0.9 + rnd() * 0.3]);
      else {
        for (let q = 0; q < 2; q++) {
          const px = ax + (bx - ax) * (0.25 + q * 0.5) + nx * (rnd() - 0.5) * 0.4, pz = az + (bz - az) * (0.25 + q * 0.5) + nz * (rnd() - 0.5) * 0.4, py = W.heightAt(px, pz) + H0;
          shrubs.push([px, py, pz, 0.8 + rnd() * 0.5]);
          const col = new THREE.Color(COLS[Math.floor(rnd() * COLS.length)]);
          for (let f = 0; f < 3; f++) blooms.push([px + (rnd() - 0.5) * 0.45, py + 0.22 + rnd() * 0.22, pz + (rnd() - 0.5) * 0.45, 0.7 + rnd() * 0.5, col]);
        }
      }
    }
  }
  // a round patch of the same tarmac at every junction a dual road ends in: fills the corners the square ends of the ribbons leave
  for (const n of jn) {
    const nd = G.nodes[n]; if (!nd) continue;
    const [x, z] = nd, Rr = DUAL_HW + 0.35, seg = 28, rings = 3, at = (a, rr) => { const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; return [px, W.heightAt(px, pz) + TOPY, pz]; };
    const push = (p) => { base.p.push(p[0], p[1], p[2]); base.n.push(0, 1, 0); base.u.push(p[0] / 10, p[2] / 10); };
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      push([x, W.heightAt(x, z) + TOPY, z]); push(at(a1, Rr / rings)); push(at(a0, Rr / rings));
      for (let j = 1; j < rings; j++) { const r0 = (Rr * j) / rings, r1 = (Rr * (j + 1)) / rings, A = at(a0, r0), B = at(a1, r0), C = at(a0, r1), D = at(a1, r1); push(A); push(B); push(C); push(B); push(D); push(C); }
    }
  }
  const add = (B, mat, name, shadow = false) => { if (!B.p.length) return; const m = new THREE.Mesh(toGeo(B), mat); m.receiveShadow = true; m.castShadow = shadow; m.name = name; group.add(m); return m; };
  add(base, mats.dual, 'dual-tarmac'); add(lane, mats.lane, 'cycle-lanes'); add(line, mats.line, 'lane-lines');
  add(kerb, mats.kerb, 'median-kerb'); add(soil, mats.bed, 'median-bed');
  if (skirt.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(skirt, 3)); g.computeVertexNormals();
    const sm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc8c2b4, roughness: 0.9, side: THREE.DoubleSide })); sm.name = 'median-faces'; group.add(sm);
  }
  // instanced planting
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  if (shrubs.length) {
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.34, 0).scale(1, 0.62, 1).translate(0, 0.2, 0), new THREE.MeshStandardMaterial({ color: 0x3f7f2f, roughness: 0.85 }), shrubs.length);
    shrubs.forEach(([x, y, z, s], i) => { M.compose(P.set(x, y, z), Q.setFromAxisAngle(Y, rnd() * 6), S.set(s, s, s)); im.setMatrixAt(i, M); });
    im.receiveShadow = true; group.add(im);
  }
  if (blooms.length) {
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({ roughness: 0.6 }), blooms.length);
    blooms.forEach(([x, y, z, s, col], i) => { M.compose(P.set(x, y, z), Q.identity(), S.set(s, s, s)); im.setMatrixAt(i, M); im.setColorAt(i, col); });
    group.add(im);
  }
  if (treesAt.length) {
    // a small tree: a trunk and a rounded crown of two blobs (a bauhinia / a young neem)
    const tree = mergeColored([
      { geometry: new THREE.CylinderGeometry(0.06, 0.09, 1.7, 6), color: '#6b4a2f', matrix: m4(0, 0.85, 0) },
      { geometry: new THREE.IcosahedronGeometry(0.95, 1), color: '#3f8a34', matrix: m4(0, 2.2, 0) },
      { geometry: new THREE.IcosahedronGeometry(0.65, 0), color: '#58a043', matrix: m4(0.35, 2.75, 0.15) },
    ]);
    const im = new THREE.InstancedMesh(tree, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), treesAt.length);
    treesAt.forEach(([x, y, z, s], i) => { M.compose(P.set(x, y, z), Q.setFromAxisAngle(Y, rnd() * 6), S.set(s, s, s)); im.setMatrixAt(i, M); W.addSolid(x, z, 0.25, 'median-tree', true); });
    im.castShadow = true; im.receiveShadow = true; group.add(im);
  }
  return { group, count: edges.length, metres: Math.round(metres), trees: treesAt.length, shrubs: shrubs.length };
}

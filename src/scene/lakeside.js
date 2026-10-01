// The lakes' edges: lotus (lily pads with pink and white flowers) in every lake and pond, reeds and
// low shrubs where the water meets the land, and at the IITG Lake (by the Central Library and the
// academic core, the only lake with boats) a steel railing all the way round it, open only at the boat jetty and where a path
// comes down to the water, with benches you can sit on and a forest of trees behind it, no gaps (planLakeForest).
import * as THREE from 'three';
import { mergeColored, m4, mulberry32 } from '../util.js';
import { inArea } from './courts.js';
import { jettyPoint } from '../boat.js';

/** points round a ring (flat [x, z, ...]) every `step` metres, with the outward normal */
function walk(ring, step, inside) {
  const out = [];
  const n = ring.length / 2;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[((i + 1) % n) * 2], bz = ring[((i + 1) % n) * 2 + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-3) continue;
    let nx = -(bz - az) / L, nz = (bx - ax) / L;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (inside(mx + nx * 0.5, mz + nz * 0.5)) { nx = -nx; nz = -nz; }   // point away from the water
    for (let s = step - acc; s < L; s += step) out.push({ x: ax + ((bx - ax) * s) / L, z: az + ((bz - az) * s) / L, nx, nz });
    acc = (acc + L) % step;
  }
  return out;
}

export function buildLakeside(game) {
  const W = game.world, G = game.graph, r = mulberry32(8123);
  const group = new THREE.Group(); group.name = 'lakeside';
  const lakes = W.water.filter((w) => w.kind !== 'pool');
  const pads = [], flowers = [], reeds = [], parts = [];
  const free = (x, z, rad = 1) => !W.buildingAt(x, z) && !W.waterAt(x, z) && !G.onRoad(x, z, rad);
  for (const w of lakes) {
    const ring = w.rings[0], inW = (x, z) => W.waterAt(x, z) === w;
    const edge = walk(ring, 3.5, inW);
    // lotus: patches in the shallows, 2 - 14 m in from the edge
    for (const p of edge) {
      if (r() > 0.5) continue;
      const d = 2 + r() * 12, cx = p.x - p.nx * d, cz = p.z - p.nz * d;
      if (!inW(cx, cz)) continue;
      const n = 8 + Math.floor(r() * 12);
      for (let k = 0; k < n; k++) {
        const a = r() * 6.28, rr = r() * 2.6, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
        if (!inW(x, z)) continue;
        pads.push({ x, z, y: w.level + 0.02, s: 0.35 + r() * 0.45, a: r() * 6.28 });
        if (r() < 0.2) flowers.push({ x: x + 0.1, z, y: w.level + 0.1 + r() * 0.12, s: 0.8 + r() * 0.5, white: r() < 0.25, a: r() * 6.28 });
      }
    }
    // reeds and shrubs just outside the water line
    for (const p of edge) {
      if (r() > 0.32) continue;
      const d = 0.4 + r() * 1.2, x = p.x + p.nx * d, z = p.z + p.nz * d;
      if (!free(x, z, 0.8)) continue;
      reeds.push({ x, z, y: W.heightAt(x, z), s: 0.7 + r() * 0.7, shrub: r() < 0.35, a: r() * 6.28 });
    }
  }
  // ---- lily pads (a disc with a notch) and flowers (layered pink petals, a yellow heart)
  if (pads.length) {
    const g = new THREE.CircleGeometry(1, 14, 0.25, Math.PI * 2 - 0.5).rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x3f7d33, roughness: 0.55, side: THREE.DoubleSide }), pads.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    pads.forEach((q, i) => { M.compose(P.set(q.x, q.y, q.z), Q.setFromAxisAngle(Y, q.a), S.set(q.s, 1, q.s)); im.setMatrixAt(i, M); im.setColorAt(i, new THREE.Color().setHSL(0.27 + r() * 0.05, 0.45, 0.28 + r() * 0.08)); });
    im.receiveShadow = true; group.add(im);
  }
  if (flowers.length) {
    const petals = [];
    for (let ring2 = 0; ring2 < 2; ring2++) for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + ring2 * 0.45;
      const pg = new THREE.SphereGeometry(0.11, 5, 3).scale(0.55, 0.35, 1).translate(0, 0.02, 0.1).rotateX(-0.5 - ring2 * 0.5).rotateY(a);
      petals.push({ geometry: pg, color: ring2 ? '#f7a8c4' : '#e86f9c' });
    }
    petals.push({ geometry: new THREE.SphereGeometry(0.045, 8, 6).translate(0, 0.05, 0), color: '#f2c12e' });
    const geo = mergeColored(petals);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), flowers.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    flowers.forEach((q, i) => { M.compose(P.set(q.x, q.y, q.z), Q.setFromAxisAngle(Y, q.a), S.setScalar(q.s)); im.setMatrixAt(i, M); if (q.white) im.setColorAt(i, new THREE.Color(1.3, 1.3, 1.3)); else im.setColorAt(i, new THREE.Color(1, 1, 1)); });
    group.add(im);
  }
  if (reeds.length) {
    const blades = [];
    for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28; blades.push({ geometry: new THREE.ConeGeometry(0.03, 1.2 + (k % 3) * 0.25, 3).translate(Math.cos(a) * 0.12, 0.6, Math.sin(a) * 0.12).rotateZ((k % 2 ? 1 : -1) * 0.12), color: k % 2 ? '#6f8f3a' : '#8aa04a' }); }
    blades.push({ geometry: new THREE.CylinderGeometry(0.025, 0.025, 0.2, 5).translate(0.05, 1.45, 0), color: '#6b4a2a' });   // a bulrush head
    const reedGeo = mergeColored(blades), shrubGeo = mergeColored([{ geometry: new THREE.IcosahedronGeometry(0.5, 1).scale(1.2, 0.8, 1).translate(0, 0.35, 0), color: '#3f6b2f' }, { geometry: new THREE.IcosahedronGeometry(0.35, 1).translate(0.45, 0.3, 0.2), color: '#4f7d36' }]);
    for (const [geo, list] of [[reedGeo, reeds.filter((q) => !q.shrub)], [shrubGeo, reeds.filter((q) => q.shrub)]]) {
      const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), list.length);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
      list.forEach((q, i) => { M.compose(P.set(q.x, q.y, q.z), Q.setFromAxisAngle(Y, q.a), S.setScalar(q.s)); im.setMatrixAt(i, M); });
      im.castShadow = true; group.add(im);
    }
  }

  // ---- the IITG Lake: a railing on two sides, benches and trees
  const lake = lakes.find((w) => /IITG lake/i.test(w.name || '')) || null;
  const lib = W.site('library') || W.site('admin');
  const benches = [], seats = [];
  if (lake && lib) {
    const ring = lake.rings[0], inW = (x, z) => W.waterAt(x, z) === lake;
    let cx = 0, cz = 0; for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cz += ring[i + 1]; } cx /= ring.length / 2; cz /= ring.length / 2;
    // looking at the lake from the academic side: f = towards the lake, rt = your right hand
    let fx = cx - lib.ex, fz = cz - lib.ez; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const rtx = -fz, rtz = fx;
    const sideOf = (x, z) => { const dx = x - cx, dz = z - cz, u = dx * fx + dz * fz, v = dx * rtx + dz * rtz; return Math.abs(u) > Math.abs(v) ? (u < 0 ? 'near' : 'far') : (v > 0 ? 'right' : 'left'); };
    const pts = walk(ring, 2.4, inW);
    const jetties = [jettyPoint(W, G, lake)].filter(Boolean);
    let prev = null;
    const off = 2.2;
    for (const p of pts) {
      const x = p.x + p.nx * off, z = p.z + p.nz * off;
      const atJetty = jetties.some((j) => Math.hypot(j.x - p.x, j.z - p.z) < 7.5);                // the boats go from the jetty: the fence is open there
      const ok = !atJetty && free(x, z, 0.6);
      if (ok && prev && Math.hypot(prev.x - x, prev.z - z) < 4) {
        const ya = prev.y, yb = W.heightAt(x, z), L = Math.hypot(x - prev.x, z - prev.z), yaw = Math.atan2(-(z - prev.z), x - prev.x);
        const mx = (x + prev.x) / 2, mz = (z + prev.z) / 2, my = (ya + yb) / 2;
        for (const hh of [0.45, 0.95]) parts.push({ geometry: new THREE.CylinderGeometry(0.03, 0.03, L, 6).rotateZ(Math.PI / 2), color: hh > 0.5 ? '#2f5d45' : '#c9ced4', matrix: m4(mx, my + hh, mz, 0, yaw, 0) });
        W.indexFence?.({ ax: prev.x, az: prev.z, bx: x, bz: z, top: Math.max(ya, yb) + 1.0 });
      }
      if (ok) parts.push({ geometry: new THREE.CylinderGeometry(0.045, 0.05, 1.05, 8), color: '#2f5d45', matrix: m4(x, W.heightAt(x, z) + 0.5, z) });
      prev = ok ? { x, z, y: W.heightAt(x, z) } : null;
      // benches every ~12 m behind the railing (facing the water), trees behind them
      if (ok && r() < 0.34) {
        const bx = p.x + p.nx * (off + 1.4), bz = p.z + p.nz * (off + 1.4);
        if (free(bx, bz, 0.9) && !benches.some((q) => Math.hypot(q.x - bx, q.z - bz) < 7)) benches.push({ x: bx, z: bz, yaw: Math.atan2(-p.nx, -p.nz) });
      }
    }
    for (const b of benches) {
      bench(parts, b.x, W.heightAt(b.x, b.z), b.z, b.yaw);
      W.addSolid?.(b.x, b.z, 0.8, 'bench', false);
      for (const sd of [-0.45, 0.45]) seats.push({ x: b.x + Math.cos(b.yaw) * sd, z: b.z - Math.sin(b.yaw) * sd, yaw: b.yaw, seat: true, taken: null });      // you can sit on them
    }
  }
  // shade trees round the Serpentine and the other lakes too (a few where there is room)
  for (const w of lakes) {
    if (w === lake) continue;
    const ring = w.rings[0], inW = (x, z) => W.waterAt(x, z) === w;
    for (const p of walk(ring, 9, inW)) {
      if (r() > 0.35) continue;
      const d = 4 + r() * 5, x = p.x + p.nx * d, z = p.z + p.nz * d;
      if (free(x, z, 2)) tree(parts, x, W.heightAt(x, z), z, r);
    }
  }
  if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  game.scene.add(group);
  W.lakeBenches = benches;                    // couples sit here in the evening (life/campus.js)
  return { group, benches, seats, counts: { pads: pads.length, flowers: flowers.length, reeds: reeds.length, benches: benches.length } };
}

/** the forest round the IITG Lake: rows of trees behind the shore on every side, so there is no empty ground (before the trees are built).
 *  Clear: the boat jetty, the paths, the roads, the buildings, and the places that have a clearing of their own. */
export function planLakeForest(W, G, game) {
  const lake = W.water.find((w) => /IITG lake/i.test(w.name || ''));
  W.lakeTrees = [];
  if (!lake) return { trees: 0 };
  const r = mulberry32(8124), ring = lake.rings[0], inW = (x, z) => W.waterAt(x, z) === lake;
  const clear = W.clearings || [];
  const jet = [jettyPoint(W, G, lake)].filter(Boolean);
  const keep = [...(W.extraPosts || []).filter((q) => /LAKE/.test(q.label || '')), W.aqiStation, ...(game.busStandSpots || []).map((b) => ({ x: b.x, z: b.z }))].filter(Boolean);
  const SP = [0, 0, 4, 11, 8, 9, 0, 1, 4, 2];                                  // broadleaf, sal, neem, amaltas, jarul, areca, bamboo
  const out = [];
  for (const p of walk(ring, 2.8, inW)) {
    for (const d of [3.4, 6.6, 10.2, 14.0]) {
      const x = p.x + p.nx * (d + (r() - 0.5) * 2.2), z = p.z + p.nz * (d + (r() - 0.5) * 2.2) + (r() - 0.5) * 2;
      if (r() < (d > 11 ? 0.55 : 0.9)) {
        if (!W.insideCampus(x, z) || W.buildingAt(x, z) || W.waterAt(x, z)) continue;
        if (jet.some((j) => Math.hypot(j.x - x, j.z - z) < 11)) continue;
        if (keep.some((q) => Math.hypot(q.x - x, q.z - z) < 7)) continue;
        if (clear.some((c) => (c.area ? inArea(c.area, x, z, 1) : (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r))) continue;
        const rd = G.roadAt(x, z, 8, () => true);
        if (rd && rd.d < (rd.hw ? rd.hw + 1.6 : 1.8)) continue;                  // not on a road or a path
        out.push({ x, z, sp: SP[Math.floor(r() * SP.length)], sc: 0.9 + r() * 0.5 });
      }
    }
  }
  W.lakeTrees = out;
  return { trees: out.length };
}

function tree(parts, x, y, z, r) {
  const h = 3.2 + r() * 2.2, c = ['#2f5a2a', '#3b6b2f', '#46773a', '#2b5230'][Math.floor(r() * 4)];
  parts.push({ geometry: new THREE.CylinderGeometry(0.14, 0.22, h, 7), color: '#5a4332', matrix: m4(x, y + h / 2, z) });
  parts.push({ geometry: new THREE.IcosahedronGeometry(1.7 + r() * 0.8, 1), color: c, matrix: m4(x, y + h + 0.9, z) });
  parts.push({ geometry: new THREE.IcosahedronGeometry(1.2 + r() * 0.5, 1), color: c, matrix: m4(x + 0.8, y + h + 0.3, z - 0.5) });
}
function bench(parts, x, y, z, yaw) {
  const at = (u, v, w) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [x + u * c + v * s, y + w, z - u * s + v * c]; };
  const P = (gx, u, v, w, rot = 0) => { const [px, py, pz] = at(u, v, w); parts.push({ geometry: gx, color: '#8a5a36', matrix: m4(px, py, pz, rot, yaw, 0) }); };
  for (const v of [-0.12, 0.05, 0.22]) P(new THREE.BoxGeometry(1.7, 0.05, 0.14), 0, v, 0.45);
  for (const w of [0.65, 0.82]) P(new THREE.BoxGeometry(1.7, 0.12, 0.04), 0, -0.24, w, -0.15);
  for (const u of [-0.7, 0.7]) { const [px, py, pz] = at(u, 0, 0.22); parts.push({ geometry: new THREE.BoxGeometry(0.08, 0.45, 0.5), color: '#3a3f45', matrix: m4(px, py, pz, 0, yaw, 0) }); }
}

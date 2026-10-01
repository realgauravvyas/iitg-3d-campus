// The View Point trail. The View Point stands on the top of the highest hill and the only way up is a winding footpath,
// more than two kilometres long (the data pipeline turned the old service road into it: tools/process_data.py, step 4d),
// through a very dense forest. No cycles and no vehicles: the trail is a fenced corridor that only people can enter
// (walkers pass every fence), with a board at the foot of it, distance posts along it and, beside it, forest as close as
// the trees can stand.
//   planHillForest(world, graph)   the forest (world.hillTrees, planted by vegetation.js); before the trees are built
//   buildHillTrail(game)           the corridor fence, the boards and the posts
import * as THREE from 'three';
import { mergeColored, m4, mulberry32, canvasTexture } from '../util.js';
import { inArea } from './courts.js';

const CORRIDOR = 9;                 // half width of the fenced corridor round the trail (m)
const FOREST = 62;                  // the forest reaches this far from the trail (m)
const CAP = 12;                     // the corridor starts this far in from the road (m)

/** the trail's edges, in the order of the walk up (from the far end to the View Point), and the distance to the top at every node */
function trailOf(G, W) {
  const edges = G.edges.filter((e) => e.hill);
  if (!edges.length) return null;
  const vp = W.landmark('viewpoint');
  let top = -1, bd = 1e9;
  for (const e of edges) for (const n of [e.a, e.b]) { const [x, z] = G.nodes[n]; const d = vp ? Math.hypot(x - vp.wx, z - vp.wz) : 1e9; if (d < bd) { bd = d; top = n; } }
  const dist = new Map([[top, 0]]), q = [top];
  while (q.length) {                                       // a walk outwards from the top along the trail
    const n = q.shift();
    for (const l of G.adj[n]) if (l.e.hill && !dist.has(l.to)) { dist.set(l.to, dist.get(n) + l.e.L); q.push(l.to); }
  }
  return { edges, dist, top };
}

export function planHillForest(W, G) {
  const tr = trailOf(G, W);
  W.hillTrees = [];
  if (!tr) return { trees: 0 };
  const vp = W.landmark('viewpoint'), rnd = mulberry32(6061);
  // the trail as points every 3 m, bucketed
  const pts = [];
  for (const e of tr.edges) for (let k = 0; k < e.wpts.length - 1; k++) {
    const [ax, az] = e.wpts[k], [bx, bz] = e.wpts[k + 1], l = Math.hypot(bx - ax, bz - az) || 1;
    for (let s = 0; s < l; s += 3) pts.push([ax + ((bx - ax) * s) / l, az + ((bz - az) * s) / l]);
  }
  const CS = 24, grid = new Map();
  for (const p of pts) { const k = Math.floor(p[0] / CS) * 100000 + Math.floor(p[1] / CS); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(p); }
  const near = (x, z, R) => { let m = R; for (let i = Math.floor((x - R) / CS); i <= Math.floor((x + R) / CS); i++) for (let j = Math.floor((z - R) / CS); j <= Math.floor((z + R) / CS); j++) { const c = grid.get(i * 100000 + j); if (c) for (const p of c) m = Math.min(m, Math.hypot(p[0] - x, p[1] - z)); } return m; };
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  const STEP = 4.3, SP = [4, 4, 4, 0, 0, 0, 2, 2, 8, 9, 11, 4];       // tall sal, broadleaf, bamboo, amaltas, jarul, neem
  const out = [];
  for (let x = x0 - FOREST; x <= x1 + FOREST; x += STEP) for (let z = z0 - FOREST; z <= z1 + FOREST; z += STEP) {
    const px = x + (rnd() - 0.5) * STEP * 0.9, pz = z + (rnd() - 0.5) * STEP * 0.9;
    const dt = near(px, pz, FOREST + 1), dv = vp ? Math.hypot(px - vp.wx, pz - vp.wz) : 1e9;
    if (dt > FOREST && dv > 120) continue;
    if (dt < 2.4 || (vp && dv < 28)) continue;                                      // keep the path and the top clear
    if (!W.insideCampus(px, pz) || W.buildingAt(px, pz) || W.waterAt(px, pz)) continue;
    if ((W.clearings || []).some((c) => (c.area ? inArea(c.area, px, pz, 1) : (px - c.x) ** 2 + (pz - c.z) ** 2 < c.r * c.r))) continue;      // the places that keep clear (the bungalow's garden, lawns, gates)
    if (G.roadAt(px, pz, 14, () => true)?.d < 3.2 && !G.roadAt(px, pz, 14, (e) => e.hill)) continue;   // and the roads
    out.push({ x: px, z: pz, sp: SP[Math.floor(rnd() * SP.length)], sc: 0.95 + rnd() * 0.55 });
  }
  // at most ~9 000 (thin at random if the hill is bigger)
  const keep = Math.min(1, 9000 / Math.max(1, out.length));
  W.hillTrees = out.filter(() => rnd() < keep);
  return { trees: W.hillTrees.length, metres: Math.round(tr.edges.reduce((s, e) => s + e.L, 0)) };
}

export function buildHillTrail(game) {
  const W = game.world, G = game.graph, group = new THREE.Group();
  group.name = 'hill-trail';
  const tr = trailOf(G, W);
  if (!tr) return { group, metres: 0, start: null };
  const parts = [];
  const rnd = mulberry32(6062);
  const P = (geo, color, x, y, z, ry = 0) => parts.push({ geometry: geo, color, matrix: m4(x, y, z, 0, ry, 0) });
  // ---- the fenced corridor: nothing on wheels gets in (people pass every fence, see World.collide)
  const vehicleNodes = new Set();                      // nodes where the trail meets a road a vehicle can use
  for (const e of tr.edges) for (const n of [e.a, e.b]) if (G.adj[n].some((l) => !l.e.hill && !l.e.foot)) vehicleNodes.add(n);
  const fence = (ax, az, bx, bz) => W.indexFence({ ax, az, bx, bz, top: Math.max(W.heightAt(ax, az), W.heightAt(bx, bz)) + 1.4, bikeOnly: true });
  const at = (w, cum, s) => { let k = 0; while (k < cum.length - 2 && cum[k + 1] < s) k++; const L = cum[k + 1] - cum[k] || 1, t = (s - cum[k]) / L; const tx = (w[k + 1][0] - w[k][0]) / L, tz = (w[k + 1][1] - w[k][1]) / L; return { x: w[k][0] + (w[k + 1][0] - w[k][0]) * t, z: w[k][1] + (w[k + 1][1] - w[k][1]) * t, tx, tz }; };
  let starts = [];
  for (const e of tr.edges) {
    const w = e.wpts, cum = e.cum, L = e.L;
    const s0 = vehicleNodes.has(e.a) ? CAP : 0, s1 = L - (vehicleNodes.has(e.b) ? CAP : 0);
    if (s1 - s0 < 6) continue;
    let prevL = null, prevR = null;
    for (let s = s0; s <= s1 + 0.01; s += 4) {
      const c = at(w, cum, Math.min(s, s1)), nx = -c.tz, nz = c.tx;
      const l = [c.x + nx * CORRIDOR, c.z + nz * CORRIDOR], r = [c.x - nx * CORRIDOR, c.z - nz * CORRIDOR];
      if (prevL) { fence(prevL[0], prevL[1], l[0], l[1]); fence(prevR[0], prevR[1], r[0], r[1]); }
      prevL = l; prevR = r;
    }
    const capAt = (s, inward) => {                                  // a cross fence closing the corridor, with the board beside it
      const c = at(w, cum, s), nx = -c.tz, nz = c.tx;
      fence(c.x + nx * CORRIDOR, c.z + nz * CORRIDOR, c.x - nx * CORRIDOR, c.z - nz * CORRIDOR);
      // a barrier of two bars across the path, with the gap for people only
      for (const sd of [-1, 1]) for (let q = 0; q < 6; q++) { const o = sd * (1.4 + q * 1.15), px = c.x + nx * o, pz = c.z + nz * o; P(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 6), '#6b4a2f', px, W.heightAt(px, pz) + 0.55, pz); }
      starts.push({ x: c.x, z: c.z, tx: c.tx * inward, tz: c.tz * inward, nx, nz, d: tr.dist.get(inward > 0 ? e.a : e.b) ?? 0 });
    };
    if (vehicleNodes.has(e.a)) capAt(s0, 1);
    if (vehicleNodes.has(e.b)) capAt(s1, -1);
  }
  // ---- the board at each foot of the trail
  const total = Math.round(Math.max(...[...tr.dist.values()]));
  const boardMat = (total) => {
  const boardTex = canvasTexture(1024, 512, (c, w, h) => {
    c.fillStyle = '#1f4d2e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f2f0ea'; c.lineWidth = 12; c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 92px "Hind", "Segoe UI", sans-serif'; c.fillText('VIEW POINT TRAIL', w / 2, 100, w - 80);
    c.font = '700 60px "Hind", "Segoe UI", sans-serif'; c.fillStyle = '#ffd36a'; c.fillText('On foot only · about ' + (Math.round(total / 100) / 10).toFixed(1) + ' km uphill', w / 2, 200, w - 80);
    // a cycle and a car, each crossed out in red
    for (const [cx, kind] of [[w * 0.3, 'cycle'], [w * 0.7, 'car']]) {
      c.fillStyle = '#f7f4ea'; c.beginPath(); c.arc(cx, 340, 88, 0, 7); c.fill();
      c.strokeStyle = '#111'; c.lineWidth = 10; c.lineCap = 'round';
      if (kind === 'cycle') { for (const dx of [-44, 44]) { c.beginPath(); c.arc(cx + dx, 360, 26, 0, 7); c.stroke(); } c.beginPath(); c.moveTo(cx - 44, 360); c.lineTo(cx - 6, 318); c.lineTo(cx + 44, 360); c.moveTo(cx - 6, 318); c.lineTo(cx - 14, 296); c.stroke(); }
      else { c.fillStyle = '#111'; c.fillRect(cx - 56, 332, 112, 30); c.fillRect(cx - 34, 306, 68, 30); c.beginPath(); c.arc(cx - 34, 366, 14, 0, 7); c.arc(cx + 34, 366, 14, 0, 7); c.fill(); }
      c.strokeStyle = '#d21f1f'; c.lineWidth = 14; c.beginPath(); c.arc(cx, 340, 88, 0, 7); c.moveTo(cx - 62, 402); c.lineTo(cx + 62, 278); c.stroke();
    }
    c.fillStyle = '#e6e0cf'; c.font = '600 40px "Hind", "Segoe UI", sans-serif'; c.fillText('Keep to the path · dense forest · carry water', w / 2, 462, w - 80);
  }, { repeat: false });
    return new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6, side: THREE.DoubleSide });
  };

  for (const s of starts) {
    const bx = s.x - s.tx * 1.5 + s.nx * 3.6, bz = s.z - s.tz * 1.5 + s.nz * 3.6, by = W.heightAt(bx, bz), yaw = Math.atan2(s.tx, s.tz) + Math.PI;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), boardMat(s.d)); b.position.set(bx, by + 2.3, bz); b.rotation.y = yaw; group.add(b);
    for (const sd of [-1, 1]) P(new THREE.CylinderGeometry(0.06, 0.07, 2.6, 6), '#5a3d2b', bx + Math.cos(yaw) * sd * 1.3, by + 1.3, bz - Math.sin(yaw) * sd * 1.3);
    W.addSolid(bx, bz, 1.6, 'sign', true);
  }
  // ---- a distance post every 300 m of the climb: how far is left to the View Point
  const posts = [];
  for (const e of tr.edges) {
    const dA = tr.dist.get(e.a), dB = tr.dist.get(e.b);
    if (dA == null || dB == null) continue;
    const far = dA > dB ? 'a' : 'b', dFar = Math.max(dA, dB), dNear = Math.min(dA, dB);
    for (let m = Math.ceil(dNear / 300) * 300; m < dFar; m += 300) {
      if (m < 100) continue;
      const s = (far === 'a' ? (dFar - m) : (m - dNear));                      // along the edge, from its start
      const c = at(e.wpts, e.cum, Math.max(0, Math.min(e.L, s)));
      void s;
      posts.push({ x: c.x - c.tz * 2.0, z: c.z + c.tx * 2.0, yaw: Math.atan2(c.tx, c.tz), left: Math.round(m) });
    }
  }
  const pt = (n) => canvasTexture(256, 128, (c, w, h) => { c.fillStyle = '#6b4a2f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e6d6a8'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#f7f1e3'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 34px "Hind", "Segoe UI", sans-serif'; c.fillText('VIEW POINT', w / 2, 40); c.font = '800 52px "Hind", "Segoe UI", sans-serif'; c.fillText((n / 1000).toFixed(1) + ' km', w / 2, 92); }, { repeat: false });
  for (const p of posts) {
    const y = W.heightAt(p.x, p.z);
    P(new THREE.CylinderGeometry(0.07, 0.09, 1.5, 6), '#5a3d2b', p.x, y + 0.75, p.z);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshStandardMaterial({ map: pt(p.left), roughness: 0.7, side: THREE.DoubleSide }));
    m.position.set(p.x, y + 1.35, p.z); m.rotation.y = p.yaw + Math.PI / 2; group.add(m);
  }
  // a bench at each resting place: every ~450 m, a log bench beside the path
  for (const e of tr.edges) for (let s = 140; s < e.L - 60; s += 450) {
    const c = at(e.wpts, e.cum, s), bx = c.x + c.tz * 2.4, bz = c.z - c.tx * 2.4, y = W.heightAt(bx, bz), yaw = Math.atan2(-c.tz, c.tx);
    P(new THREE.BoxGeometry(1.5, 0.12, 0.42), '#6b4a2f', bx, y + 0.45, bz, yaw); P(new THREE.BoxGeometry(0.1, 0.45, 0.4), '#4a3220', bx - Math.cos(yaw) * 0.6, y + 0.22, bz + Math.sin(yaw) * 0.6, yaw); P(new THREE.BoxGeometry(0.1, 0.45, 0.4), '#4a3220', bx + Math.cos(yaw) * 0.6, y + 0.22, bz - Math.sin(yaw) * 0.6, yaw);
  }
  if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  void rnd;
  return { group, metres: total, start: starts[0] || null, posts: posts.length };
}

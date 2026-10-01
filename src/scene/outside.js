// Beyond the campus wall: rice fields, village houses and trees, the low hills of North
// Guwahati, the Brahmaputra to the south, a road round the campus joining the three gates, the
// road to Guwahati from the Main Gate with its market (tea stalls, a dhaba, medical store,
// general store, auto stand), and Khokha market outside Khokha Gate. The outside roads are
// added to the road network so traffic and people can come and go through the gates.
import * as THREE from 'three';
import { mulberry32, m4, mergeColored, canvasTexture } from '../util.js';
import { ribbon, newB, toGeo, roadMaterials, ROAD_LIFT } from './roads.js';

const R_OUT = 2400;                    // how far the outside world reaches beyond the survey
const noise2 = (x, z) => {
  const s = (a, b) => Math.sin(x * a + z * b);
  return s(0.0021, 0.0013) * 0.5 + s(-0.0013, 0.0027) * 0.3 + s(0.0047, -0.0031) * 0.2;
};

export function buildOutside(game) {
  const W = game.world, G = game.graph, r = mulberry32(1919);
  const t = W.terrain;
  const grid = { x0: t.minx, x1: t.minx + (t.nx - 1) * t.cell, z0: -(t.miny + (t.ny - 1) * t.cell), z1: -t.miny };
  const riverZ0 = W.bbox.z1 + 1150, riverZ1 = riverZ0 + 700;          // the Brahmaputra, south of the campus
  // heights outside the survey: flat near the wall (for the ring road), rolling hills further out,
  // a river trough in the south
  W.outside = (x, z, hEdge, d) => {
    const k = Math.min(1, Math.max(0, (d - 160) / 700));
    let h = hEdge + noise2(x, z) * 28 * k + k * 6;
    if (z > riverZ0 - 120) { const q = Math.min(1, (z - (riverZ0 - 120)) / 120); h = h * (1 - q) + (W.riverLevel ?? 38) * q; }
    return h;
  };
  W.riverLevel = Math.min(...[0, 0.25, 0.5, 0.75, 1].map((u) => W.heightAt(grid.x0 + (grid.x1 - grid.x0) * u, grid.z1))) - 4;
  W.outerBounds = { x0: grid.x0 - R_OUT + 50, x1: grid.x1 + R_OUT - 50, z0: grid.z0 - R_OUT + 50, z1: Math.min(grid.z1 + R_OUT - 50, riverZ0 - 60) };
  const group = new THREE.Group();
  group.name = 'outside';

  // ------------------------------------------------------------ ground skirt (four slabs round the survey)
  const skirt = new THREE.BufferGeometry();
  const pos = [], col = [], idx = [];
  const C = new THREE.Color();
  const slab = (x0, x1, z0, z1, nx, nz) => {
    const b = pos.length / 3;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx, z = z0 + ((z1 - z0) * j) / nz;
      pos.push(x, W.heightAt(x, z) - 0.05, z);
      // paddy fields, village groves, bare soil: patchwork from noise
      const f = Math.sin(x * 0.031) * Math.sin(z * 0.027) + noise2(x * 3.1, z * 2.7) * 0.8;
      if (f > 0.55) C.set('#556b2f'); else if (f > 0.1) C.set('#7d9b3f'); else if (f > -0.4) C.set('#9aae55'); else C.set('#a89a6a');
      C.offsetHSL(0, 0, (r() - 0.5) * 0.04);
      col.push(C.r, C.g, C.b);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = b + j * (nx + 1) + i;
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  };
  const E = R_OUT, S = 60;
  slab(grid.x0 - E, grid.x1 + E, grid.z0 - E, grid.z0, Math.round((grid.x1 - grid.x0 + 2 * E) / S), Math.round(E / S));   // north
  slab(grid.x0 - E, grid.x1 + E, grid.z1, grid.z1 + E, Math.round((grid.x1 - grid.x0 + 2 * E) / S), Math.round(E / S));   // south
  slab(grid.x0 - E, grid.x0, grid.z0, grid.z1, Math.round(E / S), Math.round((grid.z1 - grid.z0) / S));                   // west
  slab(grid.x1, grid.x1 + E, grid.z0, grid.z1, Math.round(E / S), Math.round((grid.z1 - grid.z0) / S));                   // east
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  skirt.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  skirt.setIndex(idx);
  skirt.computeVertexNormals();
  const ground = new THREE.Mesh(skirt, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.receiveShadow = true;
  group.add(ground);
  // the Brahmaputra
  const river = new THREE.Mesh(new THREE.PlaneGeometry(grid.x1 - grid.x0 + E * 2, riverZ1 - riverZ0 + 300).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x6f8a8a, roughness: 0.18, metalness: 0.1 }));
  river.position.set((grid.x0 + grid.x1) / 2, W.riverLevel + 0.6, (riverZ0 + riverZ1) / 2 + 150);
  group.add(river);

  // ------------------------------------------------------------ roads round the campus
  const bnd = W.boundary, N = bnd.length / 2;
  let cx = 0, cz = 0; for (let i = 0; i < N; i++) { cx += bnd[i * 2]; cz += bnd[i * 2 + 1]; } cx /= N; cz /= N;
  // offset the wall outwards by ~95 m, resample every 30 m and smooth
  const raw = [];
  for (let i = 0; i < N; i++) {
    const x = bnd[i * 2], z = bnd[i * 2 + 1], dx = x - cx, dz = z - cz, L = Math.hypot(dx, dz) || 1;
    raw.push([x + (dx / L) * 95, z + (dz / L) * 95]);
  }
  let ring = resample(raw, 30, true);
  for (let it = 0; it < 6; it++) ring = ring.map((p, i) => { const a = ring[(i - 1 + ring.length) % ring.length], b = ring[(i + 1) % ring.length]; return [(a[0] + p[0] * 2 + b[0]) / 4, (a[1] + p[1] * 2 + b[1]) / 4]; });
  // push the ring out of the campus where smoothing pulled it in
  ring = ring.map(([x, z]) => { for (let k = 0; k < 20 && (W.insideCampus(x, z) || W.distToBoundary(x, z) < 60); k++) { const dx = x - cx, dz = z - cz, L = Math.hypot(dx, dz) || 1; x += (dx / L) * 8; z += (dz / L) * 8; } return [x, z]; });
  const gates = W.gates.filter((g) => !g.closed);
  const links = [];
  for (const g of gates) {
    // straight out of the gate to the ring road
    const out = [Math.cos(g.angle), -Math.sin(g.angle)];
    if ((g.wx + out[0] * 10 - cx) ** 2 + (g.wz + out[1] * 10 - cz) ** 2 < (g.wx - cx) ** 2 + (g.wz - cz) ** 2) { out[0] = -out[0]; out[1] = -out[1]; }
    let best = 0, bd = Infinity;
    ring.forEach(([x, z], i) => { const d = Math.hypot(x - (g.wx + out[0] * 80), z - (g.wz + out[1] * 80)); if (d < bd) { bd = d; best = i; } });
    links.push({ g, out, ri: best });
  }
  // campus-side node at each gate
  for (const L of links) {
    let bn = -1, bd = Infinity;
    G.nodes.forEach(([x, z], i) => { const d = Math.hypot(x - L.g.wx, z - L.g.wz); if (d < bd && G.adj[i].length) { bd = d; bn = i; } });
    L.node = bd < 45 ? bn : -1;
  }
  const mats = roadMaterials();
  const B = { main: newB(), plain: newB() };
  const addNode = (x, z) => { G.nodes.push([x, z]); G.adj.push([]); return G.nodes.length - 1; };
  const addEdge = (a, b, pts, kind, props = {}) => {
    const e = { a, b, kind, main: true, car: true, gen: false, outside: true, pts: [], wpts: pts, i: G.edges.length, foot: false, ...props };
    e.hw = { secondary: 4, unclassified: 3.5, tertiary: 3.7 }[kind] || 3.2;
    e.cum = [0]; for (let k = 1; k < pts.length; k++) e.cum.push(e.cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    e.L = e.len = e.cum[e.cum.length - 1];
    G.edges.push(e); G.adj[a].push({ e, to: b, fwd: true }); G.adj[b].push({ e, to: a, fwd: false });
    return e;
  };
  // ring road split at the gate links
  const cuts = [...new Set(links.map((l) => l.ri))].sort((a, b) => a - b);
  const ringNodes = new Map();
  for (const i of cuts) ringNodes.set(i, addNode(ring[i][0], ring[i][1]));
  for (let k = 0; k < cuts.length; k++) {
    const i0 = cuts[k], i1 = cuts[(k + 1) % cuts.length];
    const pts = [];
    for (let i = i0; ; i = (i + 1) % ring.length) { pts.push(ring[i]); if (i === i1 && pts.length > 1) break; }
    if (pts.length < 2) continue;
    addEdge(ringNodes.get(i0), ringNodes.get(i1), pts, 'unclassified', { ring: true });
    ribbon(W, pts, 7, ROAD_LIFT + 0.004, B.plain, 7);
  }
  // gate roads (the edge through the gate carries the gate's name, for the gate rules)
  for (const L of links) {
    const rn = ringNodes.get(L.ri);
    const [rx, rz] = ring[L.ri];
    const inside = L.node >= 0 ? G.nodes[L.node] : [L.g.wx - L.out[0] * 6, L.g.wz - L.out[1] * 6];
    const pts = [[inside[0], inside[1]], [L.g.wx, L.g.wz], [L.g.wx + L.out[0] * 25, L.g.wz + L.out[1] * 25], [rx, rz]];
    const inNode = L.node >= 0 ? L.node : addNode(inside[0], inside[1]);
    L.edge = addEdge(inNode, rn, pts, L.g.main ? 'secondary' : 'unclassified', { gate: L.g.name || 'gate' });
    ribbon(W, pts.slice(1), L.g.main ? 8 : 6.5, ROAD_LIFT + 0.008, L.g.main ? B.main : B.plain, 7);
  }
  // the road to Guwahati: from the ring near the Main Gate, straight away from the campus
  const mainL = links.find((l) => l.g.main) || links[0];
  const far = [];
  if (mainL) {
    const [sx, sz] = ring[mainL.ri];
    let dx = sx - cx, dz = sz - cz; const Ld = Math.hypot(dx, dz) || 1; dx /= Ld; dz /= Ld;
    const pts = [[sx, sz]];
    for (let k = 1; k <= 30; k++) { const d = k * 70; const bend = Math.sin(k * 0.35) * 40; pts.push([sx + dx * d - dz * bend, sz + dz * d + dx * bend]); }
    const end = addNode(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    addEdge(ringNodes.get(mainL.ri), end, pts, 'secondary', { toCity: true });
    ribbon(W, pts, 9, ROAD_LIFT + 0.008, B.main, 9);
    far.push({ node: end, x: pts[pts.length - 1][0], z: pts[pts.length - 1][1], name: 'Guwahati' });
    // markets along the first stretch
    mainL.cityPts = pts;
  }
  // a village road off the far side of the ring (towards Amingaon)
  {
    const i = (cuts[Math.floor(cuts.length / 2)] + Math.floor(ring.length / cuts.length / 2)) % ring.length;
    let k0 = cuts.indexOf(i) >= 0 ? null : i;
    if (k0 != null) {
      // split an existing ring edge is complicated: just start a spur at the nearest ring node instead
    }
    const rn = [...ringNodes.entries()].find(([ri]) => ri !== mainL?.ri);
    if (rn) {
      const [sx, sz] = ring[rn[0]];
      let dx = sx - cx, dz = sz - cz; const Ld = Math.hypot(dx, dz) || 1; dx /= Ld; dz /= Ld;
      const pts = [[sx, sz]];
      for (let k = 1; k <= 18; k++) pts.push([sx + dx * k * 70 + Math.sin(k * 0.6) * 25 * dz, sz + dz * k * 70 - Math.sin(k * 0.6) * 25 * dx]);
      const end = addNode(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      addEdge(rn[1], end, pts, 'unclassified', { toCity: true });
      ribbon(W, pts, 7, ROAD_LIFT + 0.004, B.plain, 7);
      far.push({ node: end, x: pts[pts.length - 1][0], z: pts[pts.length - 1][1], name: 'Amingaon' });
    }
  }
  for (const k of ['main', 'plain']) { if (!B[k].p.length) continue; const m = new THREE.Mesh(toGeo(B[k]), mats[k]); m.receiveShadow = true; group.add(m); }
  G._rc = null; G._comp = new Map(); G._rg = null;

  // ------------------------------------------------------------ roadside life: markets, houses, trees
  const parts = [];
  const P = (geo, c, x, y, z, ry = 0) => parts.push({ geometry: geo, color: c, matrix: m4(x, y, z, 0, ry, 0) });
  const free = (x, z) => !W.insideCampus(x, z) && W.distToBoundary(x, z) > 6 && !G.onRoad(x, z, 1.5) && z < riverZ0 - 80;
  const signs = [];
  const shop = (x, z, yaw, name, colr) => {
    const y = W.heightAt(x, z);
    P(new THREE.BoxGeometry(4, 3.2, 4.2), colr, x, y + 1.6, z, yaw);
    P(new THREE.BoxGeometry(4.6, 0.12, 5.2), '#8a8f96', x + Math.sin(yaw) * 0.4, y + 3.3, z + Math.cos(yaw) * 0.4, yaw);     // tin roof
    P(new THREE.BoxGeometry(3.2, 2.4, 0.06), '#2a2a2a', x + Math.sin(yaw) * 2.12, y + 1.3, z + Math.cos(yaw) * 2.12, yaw);   // open shutter (dark inside)
    P(new THREE.BoxGeometry(4.4, 0.08, 1.2), colr, x + Math.sin(yaw) * 2.7, y + 2.6, z + Math.cos(yaw) * 2.7, yaw);          // awning
    signs.push({ x: x + Math.sin(yaw) * 2.2, y: y + 2.95, z: z + Math.cos(yaw) * 2.2, yaw, name });
  };
  const SHOPS = [['Maa Kamakhya General Store', '#e7c26a'], ['Assam Tea Stall', '#c86b3c'], ['Hotel Annapurna (Veg)', '#e38aa0'], ['Medicos & Pharmacy', '#8fd0c0'],
    ['Xerox · Stationery', '#8fb4d8'], ['Mobile Point · Recharge', '#b39ddb'], ['Laxmi Sweets', '#ffcc80'], ['Cycle & Bike Repair', '#a5d6a7'], ['Momo Corner', '#ef9a9a'],
    ['Fruits & Vegetables', '#c5e1a5'], ['Tailor & Laundry', '#b0bec5'], ['Dhaba · Open 24 hrs', '#ffab91']];
  const market = [];
  if (mainL && mainL.cityPts) {
    const pts = mainL.cityPts;
    let k = 0;
    for (let i = 1; i < 8 && k < SHOPS.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const L = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / L, tz = (bz - az) / L;
      for (let s = 8; s < L - 4 && k < SHOPS.length; s += 7) for (const sd of [1, -1]) {
        const x = ax + tx * s + tz * sd * 10.5, z = az + tz * s - tx * sd * 10.5;
        if (!free(x, z) || k >= SHOPS.length) continue;
        shop(x, z, Math.atan2(-tz * sd, tx * sd), ...SHOPS[k]); market.push({ x, z, name: SHOPS[k][0] }); k++;
      }
    }
  }
  // Khokha market: small stalls just outside Khokha Gate
  const kh = links.find((l) => /Khokha/.test(l.g.name || ''));
  const khokha = [];
  if (kh) {
    const KS = [['Khokha Tea & Noodles', '#c86b3c'], ['Momos & Rolls', '#ef9a9a'], ['Egg Roll Centre', '#ffcc80'], ['Paan & Stationery', '#a5d6a7'], ['Juice Corner', '#fff59d'], ['Night Canteen', '#b39ddb']];
    const bx = kh.g.wx + kh.out[0] * 32, bz = kh.g.wz + kh.out[1] * 32, tx = -kh.out[1], tz = kh.out[0];
    KS.forEach(([n, c], i) => {
      const sd = i % 2 ? 1 : -1, off = 7 + Math.floor(i / 2) * 5.5;
      const x = bx + tx * sd * off, z = bz + tz * sd * off;
      if (!free(x, z)) return;
      const yaw = Math.atan2(-tx * sd, -tz * sd);
      shop(x, z, yaw, n, c);
      khokha.push({ x: x + Math.sin(yaw) * 3.5, z: z + Math.cos(yaw) * 3.5, yaw: yaw + Math.PI, name: n });
    });
  }
  // village houses along the roads: Assam-type, coloured walls and tin roofs
  const HOUSE = ['#e8dcc4', '#cfe3d4', '#f2d7a0', '#d6c7e8', '#f4c7b6', '#c9d9e8'];
  let houses = 0;
  const along = (pts, every, off) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const L = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / L, tz = (bz - az) / L;
      for (let s = r() * every; s < L; s += every * (0.6 + r() * 0.8)) {
        const sd = r() < 0.5 ? 1 : -1, o = off + r() * 25;
        const x = ax + tx * s + tz * sd * o, z = az + tz * s - tx * sd * o;
        if (!free(x, z)) continue;
        const y = W.heightAt(x, z), yaw = Math.atan2(-tz * sd, tx * sd) + (r() - 0.5) * 0.3;
        const w = 6 + r() * 5, d = 5 + r() * 3;
        P(new THREE.BoxGeometry(w, 3, d), HOUSE[Math.floor(r() * HOUSE.length)], x, y + 1.5, z, yaw);
        const roof = new THREE.CylinderGeometry(0.01, (Math.max(w, d) / 2) * 1.12, 1.6, 4, 1).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d));
        P(roof, r() < 0.7 ? '#9aa0a6' : '#b3563c', x, y + 3.8, z, yaw);
        houses++;
      }
    }
  };
  along(ring, 55, 16);
  if (mainL?.cityPts) along(mainL.cityPts.slice(6), 40, 14);
  // outside trees: groves on the fields and the hills
  const treeGeo = mergeColored([
    { geometry: new THREE.CylinderGeometry(0.25, 0.35, 4, 5), color: '#5a4636', matrix: m4(0, 2, 0) },
    { geometry: new THREE.IcosahedronGeometry(3.2, 0), color: '#3f5f2a', matrix: m4(0, 6, 0, 0, 0, 0, 1, 0.85, 1) },
  ]);
  const TN = 5200;
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), TN);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S3 = new THREE.Vector3();
  let tn = 0;
  for (let t2 = 0; t2 < TN * 3 && tn < TN; t2++) {
    const x = grid.x0 - E + r() * (grid.x1 - grid.x0 + 2 * E), z = grid.z0 - E + r() * (grid.z1 - grid.z0 + 2 * E);
    if (x > grid.x0 && x < grid.x1 && z > grid.z0 && z < grid.z1) continue;
    if (!free(x, z)) continue;
    const grove = noise2(x * 2.3, z * 2.1) + (Math.hypot(x - cx, z - cz) > 1400 ? 0.4 : 0);
    if (grove < 0.1 && r() < 0.85) continue;
    const s = 0.8 + r() * 0.9;
    M4.compose(V.set(x, W.heightAt(x, z) - 0.2, z), Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), S3.set(s, s * (0.9 + r() * 0.4), s));
    trees.setMatrixAt(tn++, M4);
  }
  trees.count = tn;
  trees.castShadow = true; trees.receiveShadow = true;
  group.add(trees);
  if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  // shop signboards
  if (signs.length) {
    const rowH = 64, tex = canvasTexture(512, rowH * signs.length, (g) => {
      signs.forEach((s, i) => {
        const y0 = i * rowH, hue = (i * 47) % 360;
        g.fillStyle = `hsl(${hue}, 55%, 30%)`; g.fillRect(0, y0, 512, rowH);
        g.fillStyle = '#fff6d8'; g.font = '700 34px "Hind", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(s.name, 256, y0 + rowH / 2 + 2, 490);
      });
    }, { repeat: false });
    const pp = [], uv = [], ix = [];
    signs.forEach((s, i) => {
      const sx = Math.cos(s.yaw), sz = -Math.sin(s.yaw), b = pp.length / 3, fx = Math.sin(s.yaw) * 0.03, fz = Math.cos(s.yaw) * 0.03;
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pp.push(s.x + sx * 2 * u + fx, s.y + 0.32 * v, s.z + sz * 2 * u + fz);
      const v0 = 1 - (i + 1) / signs.length, v1 = 1 - i / signs.length;
      uv.push(0, v0, 1, v0, 1, v1, 0, v1); ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ix); geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0x222222 })));
  }
  return { group, far, links, market, khokha, ring, houses, riverZ0 };
}

function resample(pts, step, closed) {
  const out = [];
  const n = pts.length;
  let carry = 0;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = carry;
    while (s < L) { out.push([a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L]); s += step; }
    carry = s - L;
  }
  return out;
}

// The Director's Bungalow: a grand house in a walled garden. A low plastered wall with an iron fence on top runs round the
// compound, with one gate; two guards sit at the gate post, each on a chair, and the visitors' register is on the desk there.
// Visitors come by appointment only: ask the guard for one (Monday to Friday, 10 AM to 5:30 PM) and the gate opens for an
// hour; then the house door opens too (interiors/templates.js `bungalow`). Inside the wall: a lawn, a gravel drive that
// circles a tiered fountain, flower beds, clipped hedges, fruit trees, a gazebo, a swimming pool with loungers, lamps, urns and
// a black car under the portico. The house itself gets a columned portico, a balcony, two wings and a balustrade.
import * as THREE from 'three';
import { mergeColored, m4, canvasTexture, mulberry32 } from '../util.js';
import { AN } from '../crowd/people.js';
import { adultLook } from '../crowd/looks.js';
import { registerActivity } from '../register.js';
import { makeCar } from '../models.js';

export function buildBungalow(game) {
  const W = game.world, G = game.graph, g = game;
  const group = new THREE.Group();
  group.name = 'directors-bungalow';
  const near = W.buildings.filter((b) => b.area > 150 && Math.hypot((b.x0 + b.x1) / 2 + 160, (b.z0 + b.z1) / 2 + 318) < 30).sort((a, b) => b.area - a.area);
  const b = near[0];
  if (!b) return { group, guards: [], draw() {}, update() {} };
  b.display = "Director's Bungalow"; b.bungalow = true;
  for (const o of W.buildings) if (o !== b && o.area < 120 && Math.hypot((o.x0 + o.x1) / 2 - (b.x0 + b.x1) / 2, (o.z0 + o.z1) / 2 - (b.z0 + b.z1) / 2) < 22) { o.bungalow = true; o.display = "Director's Bungalow"; }
  const rnd = mulberry32(9091);
  const e = W.entranceOf(b, G);
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), tx = fz, tz = -fx;                 // f: out of the front door, t: along the front
  const P = (u, v) => ({ x: e.x + tx * u + fx * v, z: e.z + tz * u + fz * v });        // local (u along the front, v out from the door wall)
  // the house's extent in this frame
  let umin = 1e9, umax = -1e9, vmin = 1e9;
  const ring = b.rings[0];
  for (let i = 0; i < ring.length; i += 2) { const dx = ring[i] - e.x, dz = ring[i + 1] - e.z, u = dx * tx + dz * tz, v = dx * fx + dz * fz; umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); }
  const D = Math.max(8, -vmin), u0 = (umin + umax) / 2, Wd = Math.max(10, umax - umin);
  const y0 = (x, z) => W.heightAt(x, z);
  const clear = (x, z, m = 1) => !W.buildingAt(x, z) && !W.waterAt(x, z) && !G.onRoad(x, z, m) && W.insideCampus(x, z);
  const parts = [], gold = [], P3 = (geo, color, u, v, y, ry = 0) => { const q = P(u, v); parts.push({ geometry: geo, color, matrix: m4(q.x, y0(q.x, q.z) + y, q.z, 0, e.yaw + ry, 0) }); };
  const Ya = e.yaw;                                                                    // mesh frames: local +z = forward (out of the door)

  // ------------------------------------------------------------ the compound: front distance found so the gate is not in the road
  let front = 22;
  for (; front > 9; front -= 1.5) { const q = P(u0, front); if (clear(q.x, q.z, 3.2) && clear(P(u0 - 3, front + 3).x, P(u0 - 3, front + 3).z, 1.5)) break; }
  const U0 = umin - 15, U1 = umax + 15, V0 = -D - 13, V1 = front;                    // the compound's rectangle
  const corners = [[U0, V0], [U1, V0], [U1, V1], [U0, V1]];
  const GATE = 5.2;
  let passUntil = -1;
  const passValid = () => g.bungalowPass && g.clock.abs < g.bungalowPass.until;
  void passUntil;

  // ---- the wall: plaster, coping, iron fence on top, pillars, collision
  const wallSeg = (a, c, isFront) => {
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.round(L / 3));
    for (let k = 0; k < n; k++) {
      const s0 = k / n, s1 = (k + 1) / n, ua = a[0] + (c[0] - a[0]) * s0, va = a[1] + (c[1] - a[1]) * s0, ub = a[0] + (c[0] - a[0]) * s1, vb = a[1] + (c[1] - a[1]) * s1;
      const um = (ua + ub) / 2, vm = (va + vb) / 2;
      if (isFront && Math.abs(um - u0) < GATE / 2 + 0.2) continue;                      // the gate gap
      const A = P(ua, va), B = P(ub, vb), M = P(um, vm);
      if (W.buildingAt(M.x, M.z) || W.waterAt(M.x, M.z) || G.onRoad(M.x, M.z, 1.3) || !W.insideCampus(M.x, M.z)) continue;
      const ya = y0(A.x, A.z), yb = y0(B.x, B.z), base = Math.min(ya, yb) - 0.4, top = Math.max(ya, yb) + 1.0, len = Math.hypot(B.x - A.x, B.z - A.z), yaw = Math.atan2(-(B.z - A.z), B.x - A.x);
      parts.push({ geometry: new THREE.BoxGeometry(len + 0.04, top - base, 0.26), color: '#eee8d9', matrix: m4(M.x, (base + top) / 2, M.z, 0, yaw, 0) });
      parts.push({ geometry: new THREE.BoxGeometry(len + 0.1, 0.1, 0.38), color: '#c8bfa8', matrix: m4(M.x, top + 0.05, M.z, 0, yaw, 0) });
      parts.push({ geometry: new THREE.BoxGeometry(len + 0.05, 0.3, 0.3), color: '#a89f8a', matrix: m4(M.x, Math.min(ya, yb) + 0.15, M.z, 0, yaw, 0) });
      // the iron fence: a rail and bars with spear tops
      parts.push({ geometry: new THREE.BoxGeometry(len, 0.05, 0.05), color: '#202326', matrix: m4(M.x, top + 0.95, M.z, 0, yaw, 0) });
      parts.push({ geometry: new THREE.BoxGeometry(len, 0.04, 0.04), color: '#202326', matrix: m4(M.x, top + 0.25, M.z, 0, yaw, 0) });
      const nb = Math.max(2, Math.round(len / 0.24));
      for (let q = 0; q <= nb; q++) { const t = q / nb, bx = A.x + (B.x - A.x) * t, bz = A.z + (B.z - A.z) * t; parts.push({ geometry: new THREE.BoxGeometry(0.025, 0.95, 0.025), color: '#202326', matrix: m4(bx, top + 0.5 + (y0(bx, bz) - Math.max(ya, yb)), bz) }); parts.push({ geometry: new THREE.ConeGeometry(0.035, 0.12, 4), color: '#c9a227', matrix: m4(bx, top + 1.03 + (y0(bx, bz) - Math.max(ya, yb)), bz) }); }
      if (k % 2 === 0) { parts.push({ geometry: new THREE.BoxGeometry(0.5, top - base + 0.5, 0.5), color: '#e6dfcc', matrix: m4(A.x, (base + top) / 2 + 0.25, A.z, 0, yaw, 0) }); parts.push({ geometry: new THREE.SphereGeometry(0.17, 8, 6), color: '#fff2c4', matrix: m4(A.x, top + 0.78, A.z) }); }
      W.indexFence({ ax: A.x, az: A.z, bx: B.x, bz: B.z, top: top + 1.0 });
    }
  };
  corners.forEach((c, i) => wallSeg(c, corners[(i + 1) % 4], i === 2));

  // ---- the gate: pillars, two steel leaves that slide open for an appointment, a name arch, a locked fence line
  const gl = P(u0, front), gy = y0(gl.x, gl.z);
  for (const s of [-1, 1]) {
    const q = P(u0 + s * (GATE / 2 + 0.4), front);
    parts.push({ geometry: new THREE.BoxGeometry(1.0, 3.0, 1.0), color: '#efe9dc', matrix: m4(q.x, gy + 1.5, q.z, 0, Ya, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(1.2, 0.25, 1.2), color: '#8f2f2a', matrix: m4(q.x, gy + 3.12, q.z, 0, Ya, 0) });
    parts.push({ geometry: new THREE.SphereGeometry(0.28, 10, 8), color: '#fff2c4', matrix: m4(q.x, gy + 3.5, q.z) });
  }
  // the name arch: a board that fits BETWEEN the two pillars (the old one was wider than the gap, so the pillars hid the ends of the name)
  const AW = GATE - 0.3;                                              // the clear width between the pillars is GATE - 0.2
  const archTex = canvasTexture(1536, 256, (c, w, h) => {
    c.fillStyle = '#1c2f5c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d4b24a'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#f4efe6'; c.textAlign = 'center'; c.textBaseline = 'middle';
    let px = 104; c.font = '700 ' + px + 'px "Hind", "Segoe UI", sans-serif'; while (c.measureText("DIRECTOR'S RESIDENCE").width > w - 120 && px > 40) { px -= 4; c.font = '700 ' + px + 'px "Hind", "Segoe UI", sans-serif'; }
    c.fillText("DIRECTOR'S RESIDENCE", w / 2, h * 0.4);
    c.font = '600 54px "Hind", "Segoe UI", sans-serif'; c.fillStyle = '#d4b24a'; c.fillText('Visitors by appointment only', w / 2, h * 0.79, w - 120);
  }, { repeat: false });
  const AH = AW * 256 / 1536;
  parts.push({ geometry: new THREE.BoxGeometry(AW + 0.1, AH + 0.1, 0.4), color: '#1c2f5c', matrix: m4(gl.x, gy + 3.0, gl.z, 0, Ya, 0) });
  for (const sd of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(AW, AH), new THREE.MeshStandardMaterial({ map: archTex, roughness: 0.55 })); const q = P(u0, front + sd * 0.21); m.position.set(q.x, gy + 3.0, q.z); m.rotation.y = Ya + (sd > 0 ? 0 : Math.PI); group.add(m); }
  const leaves = [];
  for (const s of [-1, 1]) {
    const Q = [];
    const L = GATE / 2;
    Q.push({ geometry: new THREE.BoxGeometry(L, 0.1, 0.07), color: '#202326', matrix: m4(0, 0.2, 0) }, { geometry: new THREE.BoxGeometry(L, 0.1, 0.07), color: '#202326', matrix: m4(0, 2.0, 0) }, { geometry: new THREE.BoxGeometry(L, 0.07, 0.06), color: '#202326', matrix: m4(0, 1.1, 0) });
    for (let k = 0; k <= L / 0.2; k++) { Q.push({ geometry: new THREE.BoxGeometry(0.03, 1.8, 0.03), color: '#202326', matrix: m4(-L / 2 + k * 0.2, 1.1, 0) }); Q.push({ geometry: new THREE.ConeGeometry(0.04, 0.14, 4), color: '#c9a227', matrix: m4(-L / 2 + k * 0.2, 2.07, 0) }); }
    Q.push({ geometry: new THREE.TorusGeometry(0.34, 0.025, 6, 20), color: '#c9a227', matrix: m4(0, 1.15, 0) });
    const m = new THREE.Mesh(mergeColored(Q), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5 }));
    m.castShadow = true; group.add(m);
    leaves.push({ m, s, k: 0, u: u0 + s * GATE / 4 });
  }
  { const A = P(u0 - GATE / 2, front), B = P(u0 + GATE / 2, front); W.indexFence({ ax: A.x, az: A.z, bx: B.x, bz: B.z, top: gy + 2.4, open: () => !!passValid() }); }

  // ------------------------------------------------------------ the garden
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2.5, polygonOffsetUnits: -2.5, ...o });
  /** a flat piece laid on the ground in the house's frame (u0..u1 along the front, v0..v1 out from the door) */
  const laid = (ua, ub, va, vb, material, lift = 0.05) => {
    const nu = Math.max(2, Math.round((ub - ua) / 2)), nv = Math.max(2, Math.round((vb - va) / 2));
    const gm = new THREE.PlaneGeometry(ub - ua, vb - va, nu, nv).rotateX(-Math.PI / 2);
    const pa = gm.attributes.position, uc = (ua + ub) / 2, vc = (va + vb) / 2;
    for (let i = 0; i < pa.count; i++) { const q = P(uc + pa.getX(i), vc - pa.getZ(i)); pa.setXYZ(i, q.x, y0(q.x, q.z) + lift, q.z); }
    gm.computeVertexNormals();
    const m = new THREE.Mesh(gm, material); m.receiveShadow = true; group.add(m); return m;
  };
  /** a disc laid on the ground */
  const disc = (u, v, r, material, lift = 0.07) => {
    const gm = new THREE.CircleGeometry(r, 36, 0, Math.PI * 2).rotateX(-Math.PI / 2), pa = gm.attributes.position;
    for (let i = 0; i < pa.count; i++) { const q = P(u + pa.getX(i), v - pa.getZ(i)); pa.setXYZ(i, q.x, y0(q.x, q.z) + lift, q.z); }
    gm.computeVertexNormals(); const m = new THREE.Mesh(gm, material); m.receiveShadow = true; group.add(m); return m;
  };
  laid(U0 + 0.5, U1 - 0.5, V0 + 0.5, V1 - 0.3, mat(0x5fae3d, { roughness: 1 }), 0.035);                         // the mown lawn
  const gravel = canvasTexture(128, 128, (c, w, h) => { c.fillStyle = '#cdbf9f'; c.fillRect(0, 0, w, h); for (let k = 0; k < 1400; k++) { const v = 170 + Math.random() * 60; c.fillStyle = `rgba(${v},${v - 18},${v - 50},0.6)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping; gravel.repeat.set(4, 6);
  const drive = mat(0xffffff, { map: gravel });
  laid(u0 - 2.6, u0 + 2.6, 2.2, front, drive, 0.06);                                                           // the drive from the gate
  const FV = Math.min(front - 8, 11);                                                                          // the fountain court
  disc(u0, FV, 7.2, drive, 0.065);
  laid(Math.min(umin, u0 - 5) - 0.5, Math.max(umax, u0 + 5) + 0.5, 0.2, 2.6, mat(0xd8cdb0), 0.062);             // the paved terrace along the front of the house
  // the fountain: a stone basin, a water disc, a column, an upper bowl and a jet (moves)
  const fq = P(u0, FV), fy = y0(fq.x, fq.z);
  parts.push({ geometry: new THREE.CylinderGeometry(2.6, 2.8, 0.7, 28), color: '#cfc8b6', matrix: m4(fq.x, fy + 0.35, fq.z) });
  parts.push({ geometry: new THREE.CylinderGeometry(2.7, 2.7, 0.14, 28), color: '#a9a291', matrix: m4(fq.x, fy + 0.77, fq.z) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.4, 0.55, 1.9, 12), color: '#d8d1be', matrix: m4(fq.x, fy + 1.55, fq.z) });
  parts.push({ geometry: new THREE.CylinderGeometry(1.35, 0.5, 0.45, 20), color: '#cfc8b6', matrix: m4(fq.x, fy + 2.3, fq.z) });
  parts.push({ geometry: new THREE.SphereGeometry(0.3, 12, 8), color: '#c9a227', matrix: m4(fq.x, fy + 2.8, fq.z) });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x4aa3c8, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.78 });
  { const w1 = new THREE.Mesh(new THREE.CircleGeometry(2.5, 28).rotateX(-Math.PI / 2), waterMat); w1.position.set(fq.x, fy + 0.62, fq.z); group.add(w1);
    const w2 = new THREE.Mesh(new THREE.CircleGeometry(1.2, 22).rotateX(-Math.PI / 2), waterMat); w2.position.set(fq.x, fy + 2.5, fq.z); group.add(w2); }
  const jetMat = new THREE.MeshBasicMaterial({ color: 0xcfeefa, transparent: true, opacity: 0.55 });
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 2.2, 8, 1, true), jetMat); jet.position.set(fq.x, fy + 3.9, fq.z); group.add(jet);
  const sprays = [];
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.1, 5, 1, true), jetMat); s.position.set(fq.x + Math.cos(a) * 1.15, fy + 3.05, fq.z + Math.sin(a) * 1.15); s.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); group.add(s); sprays.push(s); }
  W.addSolid(fq.x, fq.z, 2.9, 'fountain', true);

  // ---- flower beds with brick borders, clipped hedges, urns, lamps
  const COLS = ['#e0317a', '#f2c12e', '#ff7a1a', '#d92b2b', '#f4f1ea', '#b04bd6', '#ff5e9a', '#ff9bb3'];
  const blooms = [];
  const bed = (ua, ub, va, vb) => {
    const uc = (ua + ub) / 2, vc = (va + vb) / 2, q = P(uc, vc);
    parts.push({ geometry: new THREE.BoxGeometry(ub - ua + 0.3, 0.3, vb - va + 0.3), color: '#b5784f', matrix: m4(q.x, y0(q.x, q.z) + 0.12, q.z, 0, Ya, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(ub - ua - 0.1, 0.12, vb - va - 0.1), color: '#4a3524', matrix: m4(q.x, y0(q.x, q.z) + 0.3, q.z, 0, Ya, 0) });
    const n = Math.round((ub - ua) * (vb - va) * 3.2);
    for (let k = 0; k < n; k++) { const u = ua + 0.2 + rnd() * (ub - ua - 0.4), v = va + 0.2 + rnd() * (vb - va - 0.4), p = P(u, v); blooms.push([p.x, y0(p.x, p.z) + 0.46 + rnd() * 0.2, p.z, 0.8 + rnd() * 0.7, new THREE.Color(COLS[Math.floor(rnd() * COLS.length)])]); }
    const hedge = (uu, vv, w, d) => { const hp = P(uu, vv); parts.push({ geometry: new THREE.BoxGeometry(w, 0.8, d), color: '#2f6b2a', matrix: m4(hp.x, y0(hp.x, hp.z) + 0.55, hp.z, 0, Ya, 0) }); };
    hedge(uc, va - 0.6, ub - ua + 0.4, 0.7); hedge(uc, vb + 0.6, ub - ua + 0.4, 0.7);
  };
  for (const s of [-1, 1]) { bed(u0 + s * 4.4 - 1.0, u0 + s * 4.4 + 1.0, 2.8, FV - 8); bed(u0 + s * 4.4 - 1.0, u0 + s * 4.4 + 1.0, FV + 8, front - 2.2); }
  bed(u0 - 9, u0 - 5, 0.9, 2.0); bed(u0 + 5, u0 + 9, 0.9, 2.0);
  // topiary and urns along the terrace, Victorian lamps along the drive
  for (let k = -3; k <= 3; k++) { if (k === 0) continue; const q = P(u0 + k * 3.0, 3.0); parts.push({ geometry: new THREE.CylinderGeometry(0.45, 0.32, 0.8, 10), color: '#c9b89a', matrix: m4(q.x, y0(q.x, q.z) + 0.4, q.z) }); parts.push({ geometry: k % 2 ? new THREE.ConeGeometry(0.5, 1.8, 8) : new THREE.SphereGeometry(0.6, 10, 8), color: '#2f6b2a', matrix: m4(q.x, y0(q.x, q.z) + 1.8, q.z) }); W.addSolid(q.x, q.z, 0.5, 'urn', true); }
  for (const s of [-1, 1]) for (let v = 5; v < front - 2; v += 6.5) { const q = P(u0 + s * 3.0, v); parts.push({ geometry: new THREE.CylinderGeometry(0.06, 0.1, 3.6, 8), color: '#1d2023', matrix: m4(q.x, y0(q.x, q.z) + 1.8, q.z) }); parts.push({ geometry: new THREE.BoxGeometry(0.4, 0.5, 0.4), color: '#fff2c4', matrix: m4(q.x, y0(q.x, q.z) + 3.8, q.z) }); parts.push({ geometry: new THREE.ConeGeometry(0.36, 0.3, 4), color: '#1d2023', matrix: m4(q.x, y0(q.x, q.z) + 4.2, q.z, 0, Math.PI / 4, 0) }); W.addSolid(q.x, q.z, 0.25, 'lamp', true); }

  // ---- fruit trees: mango, guava, lychee, orange, jackfruit; fruits instanced
  const fruits = [];
  const FRUIT = [['#e9b21e', 0.12], ['#9bcf4a', 0.07], ['#c8232c', 0.06], ['#f08a1c', 0.09], ['#7a9a3a', 0.2]];
  const treeSpots = [];
  for (let k = 0; k < 120 && treeSpots.length < 18; k++) {
    const u = U0 + 2 + rnd() * (U1 - U0 - 4), v = V0 + 2 + rnd() * (V1 - V0 - 6), q = P(u, v);
    const inHouse = u > umin - 9 && u < umax + 9 && v > -D - 4 && v < 3;
    const inDrive = Math.abs(u - u0) < 7.6 && v > 0 && v < front;
    if (inHouse || inDrive || !clear(q.x, q.z, 0.5) || treeSpots.some((p) => Math.hypot(p.x - q.x, p.z - q.z) < 6)) continue;
    treeSpots.push({ x: q.x, z: q.z, t: treeSpots.length % FRUIT.length });
  }
  for (const s of treeSpots) {
    const y = y0(s.x, s.z), h = 2.4 + rnd() * 0.8, f = FRUIT[s.t];
    parts.push({ geometry: new THREE.CylinderGeometry(0.13, 0.2, h, 7), color: '#5a4332', matrix: m4(s.x, y + h / 2, s.z) });
    parts.push({ geometry: new THREE.IcosahedronGeometry(1.9, 1), color: s.t === 4 ? '#2f6b2a' : '#3e8a34', matrix: m4(s.x, y + h + 0.8, s.z) });
    parts.push({ geometry: new THREE.IcosahedronGeometry(1.3, 1), color: '#4f9a3f', matrix: m4(s.x + 0.9, y + h + 0.2, s.z - 0.4) });
    for (let k = 0; k < 16; k++) { const a = rnd() * 6.28, r = 1.4 + rnd() * 0.5, yy = y + h + 0.3 + rnd() * 1.5; fruits.push([s.x + Math.cos(a) * r, yy, s.z + Math.sin(a) * r, f[1] * (0.8 + rnd() * 0.4), new THREE.Color(f[0])]); }
    W.addSolid(s.x, s.z, 0.5, 'tree', true);
  }

  // ---- the gazebo, the pool with loungers
  { const q = P(umax + 8, -D * 0.4), y = y0(q.x, q.z);
    parts.push({ geometry: new THREE.CylinderGeometry(2.7, 2.8, 0.3, 6), color: '#d8cdb0', matrix: m4(q.x, y + 0.15, q.z) });
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; parts.push({ geometry: new THREE.CylinderGeometry(0.1, 0.12, 3.0, 8), color: '#f0ebe0', matrix: m4(q.x + Math.cos(a) * 2.4, y + 1.7, q.z + Math.sin(a) * 2.4) }); }
    parts.push({ geometry: new THREE.ConeGeometry(3.3, 1.5, 6), color: '#7d1f1f', matrix: m4(q.x, y + 3.9, q.z) });
    parts.push({ geometry: new THREE.SphereGeometry(0.2, 8, 6), color: '#c9a227', matrix: m4(q.x, y + 4.8, q.z) });
    for (const dz of [-1.2, 1.2]) parts.push({ geometry: new THREE.BoxGeometry(2.2, 0.1, 0.5), color: '#6b4a2f', matrix: m4(q.x, y + 0.55, q.z + dz) });
    W.addSolid(q.x, q.z, 2.9, 'gazebo', true); }
  { const pu = umin - 9, pv = -D * 0.5, q = P(pu, pv), y = y0(q.x, q.z);
    parts.push({ geometry: new THREE.BoxGeometry(11.5, 0.2, 6.5), color: '#e6dfcc', matrix: m4(q.x, y + 0.1, q.z, 0, Ya, 0) });
    const pw = new THREE.Mesh(new THREE.PlaneGeometry(10, 5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x35b6d9, roughness: 0.1, metalness: 0.15, transparent: true, opacity: 0.85 }));
    pw.position.set(q.x, y + 0.24, q.z); pw.rotation.y = Ya; group.add(pw);
    for (const sd of [-1, 1]) { const l = P(pu + sd * 4.2, pv - 4); parts.push({ geometry: new THREE.BoxGeometry(0.7, 0.14, 1.9), color: '#f4f1ea', matrix: m4(l.x, y0(l.x, l.z) + 0.38, l.z, 0, Ya, 0) }); parts.push({ geometry: new THREE.BoxGeometry(0.7, 0.5, 0.1), color: '#f4f1ea', matrix: m4(l.x, y0(l.x, l.z) + 0.6, l.z - 0.0, -0.9, Ya, 0) }); }
    for (const sd of [-1, 1]) { const l = P(pu + sd * 4.2, pv + 4); parts.push({ geometry: new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), color: '#c9ced4', matrix: m4(l.x, y0(l.x, l.z) + 1.1, l.z) }); parts.push({ geometry: new THREE.ConeGeometry(1.1, 0.35, 10), color: '#d8402f', matrix: m4(l.x, y0(l.x, l.z) + 2.3, l.z) }); }
    W.addSolid(q.x, q.z, 4.2, 'pool', false); }

  // ------------------------------------------------------------ the house: portico, balcony, wings, balustrade, cupola
  const roofY = b.roof - 0.0;
  const hy = (u, v) => { const q = P(u, v); return y0(q.x, q.z); };
  const eu = 0;                                                                         // the front door is at u = 0 in this frame
  const base = Math.max(b.floor0 ?? b.base, hy(eu, 0.6));
  const colH = Math.max(4.2, Math.min(5.4, b.roof - base - 1.2));
  for (const cu of [-3.6, -1.2, 1.2, 3.6]) {
    const q = P(eu + cu, 3.8);
    parts.push({ geometry: new THREE.CylinderGeometry(0.36, 0.42, colH, 14), color: '#f6f2e8', matrix: m4(q.x, base + colH / 2, q.z) });
    parts.push({ geometry: new THREE.BoxGeometry(0.95, 0.22, 0.95), color: '#d8d0bd', matrix: m4(q.x, base + colH + 0.1, q.z, 0, Ya, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(0.95, 0.25, 0.95), color: '#d8d0bd', matrix: m4(q.x, base + 0.12, q.z, 0, Ya, 0) });
    W.addSolid(q.x, q.z, 0.45, 'column', true);
  }
  { const q = P(eu, 2.1);
    parts.push({ geometry: new THREE.BoxGeometry(9.6, 0.4, 4.6), color: '#efe9dc', matrix: m4(q.x, base + colH + 0.45, q.z, 0, Ya, 0) });                 // the portico roof / balcony slab
    parts.push({ geometry: new THREE.BoxGeometry(9.9, 0.18, 0.5), color: '#c8bfa8', matrix: m4(P(eu, 4.3).x, base + colH + 0.7, P(eu, 4.3).z, 0, Ya, 0) });
    for (let k = 0; k <= 22; k++) { const u = eu - 4.5 + k * (9 / 22), r = P(u, 4.3); parts.push({ geometry: new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), color: '#f6f2e8', matrix: m4(r.x, base + colH + 1.2, r.z) }); }   // the balcony balusters
    parts.push({ geometry: new THREE.BoxGeometry(9.5, 0.1, 0.16), color: '#f6f2e8', matrix: m4(P(eu, 4.3).x, base + colH + 1.7, P(eu, 4.3).z, 0, Ya, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(9.0, 0.18, 4.6), color: '#c8bfa8', matrix: m4(q.x, base + 0.06, q.z, 0, Ya, 0) });                       // the steps / platform
    parts.push({ geometry: new THREE.BoxGeometry(6.0, 0.18, 1.6), color: '#c0b79f', matrix: m4(P(eu, 5.6).x, base - 0.05, P(eu, 5.6).z, 0, Ya, 0) }); }
  // the gable over the portico
  { const sh = new THREE.Shape(); sh.moveTo(-4.8, 0); sh.lineTo(4.8, 0); sh.lineTo(0, 1.7); sh.lineTo(-4.8, 0);
    const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false }); const q = P(eu, 4.3); parts.push({ geometry: gg, color: '#f1ece0', matrix: m4(q.x, base + colH + 0.8, q.z, 0, Ya, 0) }); }
  // wings: single-storey, cream, with a balustrade, tall windows and a flat roof; only where there is room
  const wingH = 4.4;
  for (const s of [-1, 1]) {
    const wu = s < 0 ? umin - 5.4 : umax + 5.4, wv = -D * 0.38, ww = 10.4, wd = D * 0.75;
    const corner = [[wu - ww / 2, wv - wd / 2], [wu + ww / 2, wv - wd / 2], [wu + ww / 2, wv + wd / 2], [wu - ww / 2, wv + wd / 2]].map(([u, v]) => P(u, v));
    if (corner.some((c) => W.buildingAt(c.x, c.z) && !b.rings)) continue;
    const q = P(wu, wv), gyw = Math.min(...corner.map((c) => y0(c.x, c.z)));
    parts.push({ geometry: new THREE.BoxGeometry(ww, wingH + 0.5, wd), color: '#efe8d6', matrix: m4(q.x, gyw + (wingH - 0.5) / 2 + 0.25, q.z, 0, Ya, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(ww + 0.6, 0.3, wd + 0.6), color: '#d8d0bd', matrix: m4(q.x, gyw + wingH + 0.1, q.z, 0, Ya, 0) });
    for (let k = 0; k < 4; k++) { const wp = P(wu - ww / 2 + 1.4 + k * 2.5, wv + wd / 2 + 0.03); parts.push({ geometry: new THREE.BoxGeometry(1.5, 2.2, 0.08), color: '#26343f', matrix: m4(wp.x, gyw + 2.0, wp.z, 0, Ya, 0) }); parts.push({ geometry: new THREE.BoxGeometry(1.7, 0.18, 0.14), color: '#f6f2e8', matrix: m4(wp.x, gyw + 3.2, wp.z, 0, Ya, 0) }); }
    for (let k = 0; k <= 14; k++) { const bp = P(wu - ww / 2 + k * (ww / 14), wv + wd / 2 + 0.2); parts.push({ geometry: new THREE.CylinderGeometry(0.05, 0.07, 0.8, 6), color: '#f6f2e8', matrix: m4(bp.x, gyw + wingH + 0.65, bp.z) }); }
    for (const sd of [-1, 1]) for (let k = -1; k <= 1; k++) W.addSolid(...(() => { const c = P(wu + k * 3.4, wv + sd * wd / 2); return [c.x, c.z]; })(), 2.2, 'wing', true);
    W.addSolid(q.x, q.z, Math.min(ww, wd) / 2, 'wing', true);
  }
  // a balustrade and a small cupola on the main roof
  { const cr = P(u0, -D / 2);
    parts.push({ geometry: new THREE.CylinderGeometry(1.5, 1.7, 1.2, 8), color: '#efe8d6', matrix: m4(cr.x, roofY + 1.0, cr.z) });
    parts.push({ geometry: new THREE.SphereGeometry(1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), color: '#c9a227', matrix: m4(cr.x, roofY + 1.6, cr.z) });
    parts.push({ geometry: new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), color: '#c9a227', matrix: m4(cr.x, roofY + 3.6, cr.z) }); }
  // a black car under the portico (the Director's), nose out
  { const car = makeCar('#15171a'); const q = P(eu - 1.8, 3.0); car.group.position.set(q.x, y0(q.x, q.z), q.z); car.group.rotation.y = Ya; group.add(car.group); W.addSolid(q.x, q.z, 1.9, 'car', true); }

  // ------------------------------------------------------------ the gate post: a cream cabin, a desk with the register, two guards on chairs
  let side = 1, cab = P(u0 + 4.9, front + 1.5);
  if (!clear(cab.x, cab.z, 1.4)) { side = -1; cab = P(u0 - 4.9, front + 1.5); }
  const cy = y0(cab.x, cab.z);
  parts.push({ geometry: new THREE.BoxGeometry(2.2, 2.6, 2.2), color: '#ece4cf', matrix: m4(cab.x, cy + 1.3, cab.z, 0, Ya, 0) });
  parts.push({ geometry: new THREE.BoxGeometry(2.8, 0.18, 2.8), color: '#7d1f1f', matrix: m4(cab.x, cy + 2.7, cab.z, 0, Ya, 0) });
  { const w = P(u0 + side * 4.9, front + 2.62); parts.push({ geometry: new THREE.BoxGeometry(1.2, 0.9, 0.06), color: '#23282c', matrix: m4(w.x, cy + 1.5, w.z, 0, Ya, 0) }); }
  W.addSolid(cab.x, cab.z, 1.4, 'booth', true);
  const deskC = P(u0 + side * 4.9 - side * 2.7, front + 1.5), deskY = y0(deskC.x, deskC.z);
  parts.push({ geometry: new THREE.BoxGeometry(1.5, 0.08, 0.7), color: '#6b4a2f', matrix: m4(deskC.x, deskY + 0.85, deskC.z, 0, Ya + Math.PI / 2, 0) });
  for (const du of [-0.6, 0.6]) { const lp = P(u0 + side * 4.9 - side * 2.7, front + 1.5 + du); parts.push({ geometry: new THREE.BoxGeometry(0.06, 0.85, 0.06), color: '#3c3c3c', matrix: m4(lp.x, deskY + 0.42, lp.z) }); }
  parts.push({ geometry: new THREE.BoxGeometry(0.5, 0.03, 0.34), color: '#f2f0ea', matrix: m4(deskC.x, deskY + 0.91, deskC.z, 0, Ya, 0) });
  W.addSolid(deskC.x, deskC.z, 0.9, 'desk', true);
  // two chairs behind the desk (their side of the road), the guards sit on them
  const chairAt = (u, v) => { const c = P(u, v), cy2 = y0(c.x, c.z); parts.push({ geometry: new THREE.BoxGeometry(0.48, 0.05, 0.48), color: '#2f5fa8', matrix: m4(c.x, cy2 + 0.44, c.z, 0, Ya, 0) }); parts.push({ geometry: new THREE.BoxGeometry(0.48, 0.5, 0.05), color: '#2f5fa8', matrix: m4(c.x - fx * 0.22, cy2 + 0.7, c.z - fz * 0.22, -0.1, Ya, 0) }); for (const [a, bb] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) parts.push({ geometry: new THREE.BoxGeometry(0.04, 0.44, 0.04), color: '#333', matrix: m4(c.x + tx * a + fx * bb, cy2 + 0.22, c.z + tz * a + fz * bb) }); return c; };
  const gu = u0 + side * 4.9 - side * 3.9;
  const c1 = chairAt(gu, front + 0.9), c2 = chairAt(gu, front + 2.1);
  const look = () => adultLook(rnd, 'guard');
  const yawG = Ya + Math.PI / 2 * side;                                                // facing the desk, across the road
  const guards = [
    { x: c1.x, z: c1.z, y: y0(c1.x, c1.z) - 0.02, yaw: Math.atan2(-tx * side, -tz * side) + Math.PI, anim: AN.SIT, phase: 0, speed: 0, extra: 0, look: look() },
    { x: c2.x, z: c2.z, y: y0(c2.x, c2.z) - 0.02, yaw: Math.atan2(-tx * side, -tz * side) + Math.PI, anim: AN.SIT, phase: 1, speed: 0, extra: 0, look: look() },
  ];
  void yawG;
  // the register: ask for an appointment
  const standAt = P(u0 + side * 4.9 - side * 2.7 - side * 0.0, front + 1.5 + 1.6 * 0), standY = y0(standAt.x, standAt.z);
  const stand = { x: P(u0 + side * 4.9 - side * 2.7, front + 1.5).x - 0 + fx * 1.0, z: P(u0 + side * 4.9 - side * 2.7, front + 1.5).z + fz * 1.0 };
  void standAt; void standY;
  const slot = () => ({ ok: !g.clock.weekend && g.clock.hour >= 10 && g.clock.hour < 17.5, h: g.clock.hour });
  g.interact.add({ x: stand.x, z: stand.z, r: 2.8, prio: 0.6, when: () => g.mode === 'walk' && !g.interior?.active && !passValid(),
    label: 'Ask the guard for an appointment with the Director',
    run: () => g.activity.start(registerActivity({
      title: "DIRECTOR'S RESIDENCE · APPOINTMENT REGISTER", place: "Director's Bungalow", purpose: 'Appointment with the Director', guardName: 'Mr. Gogoi',
      desk: { x: stand.x, y: y0(stand.x, stand.z), z: stand.z, yaw: Math.atan2(deskC.x - stand.x, deskC.z - stand.z) }, look: { x: deskC.x, y: deskY + 0.93, z: deskC.z },
      okLine: 'One moment, I will call the office.',
      onDone: () => {
        const s = slot();
        if (s.ok) { g.bungalowPass = { until: g.clock.abs + 1.0 }; g.ui.toast('The Director\'s office has confirmed your appointment. The gate is open for an hour: go up to the house.', 'gold', 'Appointment'); g.audio.tone?.(660, 0.1, { type: 'triangle', gain: 0.05 }); }
        else g.ui.toast(g.clock.weekend ? 'The Director sees visitors on weekdays only. Please come back from Monday to Friday, between 10 AM and 5:30 PM.' : 'Appointments are from 10 AM to 5:30 PM, Monday to Friday. Please come in the day.', 'warn', 'Security');
      },
    })) });
  g.interact.add({ x: stand.x, z: stand.z, r: 2.8, prio: 0.5, when: () => g.mode === 'walk' && !g.interior?.active && !!passValid(), label: 'Show your appointment slip (you are expected)', run: () => g.ui.toast('"Please go in, sir/madam. The Director is waiting in the drawing room."', 'info', 'Security') });

  // ---- the garden's meshes
  const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Pv = new THREE.Vector3();
  if (blooms.length) { const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ roughness: 0.6 }), blooms.length); blooms.forEach(([x, y, z, s, col], i) => { M.compose(Pv.set(x, y, z), Q.identity(), S.set(s, s, s)); im.setMatrixAt(i, M); im.setColorAt(i, col); }); group.add(im); }
  if (fruits.length) { const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshStandardMaterial({ roughness: 0.5 }), fruits.length); fruits.forEach(([x, y, z, s, col], i) => { M.compose(Pv.set(x, y, z), Q.identity(), S.set(s, s, s)); im.setMatrixAt(i, M); im.setColorAt(i, col); }); group.add(im); }
  // the name board by the house (kept from before)
  // wall for people: the whole compound is closed except the gate; the lawn/flower beds are soft
  W.landmarks.push({ id: 'bungalow', name: "Director's Bungalow", kind: 'service', desc: "The Director's residence: a grand house in a walled garden with a fountain, fruit trees and a pool. Visitors come by appointment only: ask at the guard post.", x: (b.x0 + b.x1) / 2, y: -(b.z0 + b.z1) / 2, z: b.roof + 40, wx: (b.x0 + b.x1) / 2, wz: (b.z0 + b.z1) / 2, wy: b.roof });
  group.updateMatrixWorld(true);
  let t = 0;
  return {
    group, guards, building: b, gate: { x: gl.x, z: gl.z },
    update(dt) {
      t += dt;
      const open = passValid() ? 1 : 0;
      for (const L of leaves) {
        L.k += (open - L.k) * Math.min(1, dt * 1.2);
        const q = P(L.u + L.s * L.k * (GATE / 2 + 0.2), front - 0.0), qy = y0(q.x, q.z);
        L.m.position.set(q.x, qy, q.z); L.m.rotation.y = Ya;
      }
      jet.scale.y = 0.85 + Math.sin(t * 5) * 0.15; jet.material.opacity = 0.45 + Math.sin(t * 7) * 0.1;
      sprays.forEach((s, i) => { s.scale.y = 0.85 + Math.sin(t * 6 + i) * 0.18; });
      waterMat.opacity = 0.74 + Math.sin(t * 1.5) * 0.04;
    },
    draw(crowd) { if (g.interior?.active) return; const c = g.camera.position; if (Math.hypot(c.x - gl.x, c.z - gl.z) > 220) return; for (const p of guards) crowd.push(p); },
  };
}

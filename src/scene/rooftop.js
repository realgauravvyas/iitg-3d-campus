// What sits on a hostel roof (and over the cycle stands): rows of solar panels facing south, solar
// water heaters (evacuated tubes under a hot-water tank), AC outdoor units, TV dishes, lightning
// rods on the corners and a clothesline or two - plus the solar modules for the covered cycle stands.
import * as THREE from 'three';
import { canvasTexture, mergeColored, m4, pointInRing, closestOnRing } from '../util.js';

/** a solar module's face: 6 x 10 blue cells, silver busbars, an aluminium frame */
let panelMat = null;
export function solarMaterial() {
  if (panelMat) return panelMat;
  // landscape: 10 cells along the module's long side (local x), 6 across it
  const tex = canvasTexture(212, 128, (g, w, h) => {
    g.fillStyle = '#c9ced4'; g.fillRect(0, 0, w, h);                 // frame
    const m = 5, cw = (w - m * 2) / 10, ch = (h - m * 2) / 6;
    for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) {
      const x = m + i * cw, y = m + j * ch;
      const gr = g.createLinearGradient(x, y, x + cw, y + ch);
      gr.addColorStop(0, '#1d3a6b'); gr.addColorStop(1, '#10254a');
      g.fillStyle = gr; g.fillRect(x + 0.8, y + 0.8, cw - 1.6, ch - 1.6);
      g.fillStyle = 'rgba(200,210,225,0.55)';
      g.fillRect(x + 0.8, y + ch * 0.3, cw - 1.6, 0.9); g.fillRect(x + 0.8, y + ch * 0.68, cw - 1.6, 0.9);
    }
  }, { repeat: false });
  tex.anisotropy = 8;
  panelMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.22, metalness: 0.35 });
  return panelMat;
}
/** a module lying flat: its long side (1.7 m) along local x, 1.0 m along z, the cells on top */
export function solarModule(l = 1.7, w = 1.0) { return new THREE.BoxGeometry(l, 0.04, w); }

function solarWaterHeater() {
  const P = [];
  const push = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0) => P.push({ geometry: geo, color, matrix: m4(x, y, z, rx, ry, rz) });
  push(new THREE.CylinderGeometry(0.27, 0.27, 2.0, 16), '#e4e7ea', 0, 1.42, -0.62, 0, 0, Math.PI / 2);            // the tank
  for (const s of [-1, 1]) push(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 16), '#b9bec4', s * 1.0, 1.42, -0.62, 0, 0, Math.PI / 2);
  const tilt = Math.atan2(1.2, 1.0);
  // glass tubes, running from the tank at the back down to the rail at the front
  for (let i = 0; i < 15; i++) push(new THREE.CylinderGeometry(0.03, 0.03, 1.62, 6), i % 2 ? '#1c2a38' : '#243646', -0.88 + i * 0.126, 0.78, 0.06, -tilt, 0, 0);
  push(new THREE.BoxGeometry(2.0, 0.05, 0.06), '#9aa0a6', 0, 0.2, 0.62);                                           // bottom rail
  for (const s of [-1, 1]) {
    push(new THREE.BoxGeometry(0.05, 0.05, 1.6), '#9aa0a6', s * 0.98, 0.78, 0.06, Math.PI / 2 - tilt, 0, 0);      // side rails, along the tubes
    push(new THREE.BoxGeometry(0.05, 1.3, 0.05), '#9aa0a6', s * 0.98, 0.65, -0.62);                                 // back legs
  }
  push(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), '#d9d9d4', 0.9, 0.7, -0.9);                              // pipe down to the roof
  return mergeColored(P);
}
function acUnit() {
  const P = [];
  P.push({ geometry: new THREE.BoxGeometry(0.9, 0.62, 0.34), color: '#e9e9e4', matrix: m4(0, 0.43, 0) });
  P.push({ geometry: new THREE.CylinderGeometry(0.22, 0.22, 0.02, 18), color: '#3a3f44', matrix: m4(0.13, 0.44, 0.172, Math.PI / 2, 0, 0) });
  P.push({ geometry: new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), color: '#c9ccd0', matrix: m4(0.13, 0.44, 0.185, Math.PI / 2, 0, 0) });
  P.push({ geometry: new THREE.BoxGeometry(0.2, 0.5, 0.01), color: '#d4d4cf', matrix: m4(-0.3, 0.43, 0.172) });
  for (const s of [-1, 1]) P.push({ geometry: new THREE.BoxGeometry(0.08, 0.12, 0.4), color: '#6d7278', matrix: m4(s * 0.34, 0.06, 0) });
  P.push({ geometry: new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), color: '#b87333', matrix: m4(0.47, 0.3, -0.05, 0, 0, Math.PI / 2) });
  return mergeColored(P);
}
function dish() {
  const P = [];
  P.push({ geometry: new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), color: '#6d7278', matrix: m4(0, 0.55, 0) });
  // the bowl looks up to the south-east sky (the satellites): its hollow side towards +z and up
  P.push({ geometry: new THREE.SphereGeometry(0.42, 16, 6, 0, Math.PI * 2, 0, 0.55), color: '#dcdfe2', matrix: m4(0, 1.15, 0.05, -2.21, 0, 0, 1, 0.45, 1) });
  P.push({ geometry: new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), color: '#3a3a3a', matrix: m4(0, 1.3, 0.25, 0.93, 0, 0) });
  P.push({ geometry: new THREE.BoxGeometry(0.07, 0.07, 0.1), color: '#3a3a3a', matrix: m4(0, 1.45, 0.45) });
  return mergeColored(P);
}
function rod() {
  const P = [];
  P.push({ geometry: new THREE.CylinderGeometry(0.014, 0.02, 1.8, 6), color: '#8a8f96', matrix: m4(0, 0.9, 0) });
  P.push({ geometry: new THREE.ConeGeometry(0.03, 0.14, 6), color: '#b0b5ba', matrix: m4(0, 1.86, 0) });
  return mergeColored(P);
}
function clothesline() {
  const P = [];
  for (const s of [-2, 2]) P.push({ geometry: new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), color: '#8a8f96', matrix: m4(s, 0.95, 0) });
  P.push({ geometry: new THREE.CylinderGeometry(0.008, 0.008, 4.0, 4), color: '#d9d9d4', matrix: m4(0, 1.82, 0, 0, 0, Math.PI / 2) });
  return mergeColored(P);
}

/**
 * Plan a hostel roof. b: the building; yt: roof height; taken: [[x, z, r]] already on the roof (tanks,
 * stair rooms); out: the lists this adds to ({panels, heaters, acs, dishes, rods, lines, clothes}).
 */
export function planHostelRoof(b, yt, rnd, taken, out, parapet = 1.0) {
  const ring = b.rings[0];
  // the long edge sets the rows; the panels face whichever side of it looks south (+z)
  let best = 0, a = 0;
  for (let i = 0; i < ring.length; i += 2) { const j = (i + 2) % ring.length, dx = ring[j] - ring[i], dz = ring[j + 1] - ring[i + 1], L = dx * dx + dz * dz; if (L > best) { best = L; a = Math.atan2(dx, dz); } }
  const ex = Math.sin(a), ez = Math.cos(a);
  let fx = ez, fz = -ex;
  if (fz < 0) { fx = -fx; fz = -fz; }
  const face = Math.atan2(fx, fz);
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
  for (let i = 0; i < ring.length; i += 2) { const dx = ring[i] - cx, dz = ring[i + 1] - cz, s = dx * ex + dz * ez, t = dx * fx + dz * fz; s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
  const tmp = { d: 0, x: 0, z: 0 };
  const inside = (x, z, m) => {
    if (!pointInRing(x, z, ring)) return false;
    for (let k = 1; k < b.rings.length; k++) if (pointInRing(x, z, b.rings[k])) return false;
    for (const r of b.rings) if (closestOnRing(x, z, r, tmp).d < m) return false;
    return true;
  };
  const free = (x, z, r) => taken.every(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) > tr + r);
  const at = (s, t) => [cx + ex * s + fx * t, cz + ez * s + fz * t];
  // solar water heaters along the north edge (they would shade the panels anywhere else)
  const nH = Math.max(2, Math.min(8, Math.round(b.area / 260)));
  let placed = 0;
  for (let s = s0 + 1.8; s < s1 - 1.8 && placed < nH; s += 2.3) {
    const [x, z] = at(s, t0 + 1.9);
    if (inside(x, z, 1.3) && free(x, z, 1.2)) { out.heaters.push([x, yt, z, face]); taken.push([x, z, 1.25]); placed++; }
  }
  // AC outdoor units in a cluster at one end (the common room and the office below)
  const nA = 3 + Math.floor(rnd() * 5);
  placed = 0;
  for (let k = 0; k < 30 && placed < nA; k++) {
    const [x, z] = at(s1 - 1.6 - (k % 5) * 1.1, t1 - 1.4 - Math.floor(k / 5) * 1.0);
    if (inside(x, z, 0.9) && free(x, z, 0.55)) { out.acs.push([x, yt, z, face + Math.PI]); taken.push([x, z, 0.6]); placed++; }
  }
  // a couple of TV dishes and a clothesline
  for (let k = 0; k < 2 + Math.floor(rnd() * 2); k++) {
    const [x, z] = at(s0 + 2 + rnd() * (s1 - s0 - 4), t0 + 2 + rnd() * (t1 - t0 - 4));
    if (inside(x, z, 1.2) && free(x, z, 0.6)) { out.dishes.push([x, yt, z, face + (rnd() - 0.5) * 0.6]); taken.push([x, z, 0.7]); }
  }

  if (b.area > 400) {
    for (let k = 0; k < 16; k++) {
      const [x, z] = at(s0 + 3 + rnd() * Math.max(0, s1 - s0 - 6), t0 + 3 + rnd() * Math.max(0, t1 - t0 - 6));
      if (!(inside(x, z, 1.6) && free(x, z, 2.1) && inside(x + ex * 2.1, z + ez * 2.1, 0.8) && inside(x - ex * 2.1, z - ez * 2.1, 0.8))) continue;
      out.lines.push([x, yt, z, a - Math.PI / 2]);
      for (let c = 0; c < 6; c++) { const d = -1.6 + c * 0.62; out.clothes.push([x + ex * d, yt + 1.8, z + ez * d, face, Math.floor(rnd() * 8)]); }
      taken.push([x, z, 2.3]);
      break;
    }
  }  // rows of solar panels over the rest of the roof (every wing of a courtyard block), 2.4 m apart so
  // they do not shade each other; on the biggest roofs every other row, so the array is spread out
  const rows = [];
  for (let t = t0 + 1.7; t < t1 - 1.2; t += 2.4) {
    const row = [];
    for (let s = s0 + 1.4; s < s1 - 1.3; s += 1.78) { const [x, z] = at(s, t); if (inside(x, z, 1.25) && free(x, z, 0.85)) row.push([x, yt, z, face]); }
    if (row.length) rows.push(row);
  }
  const total = rows.reduce((n, r) => n + r.length, 0), cap = Math.min(260, Math.round(b.area / 14));
  const step = total > cap ? 2 : 1;
  rows.forEach((row, i) => { if (i % step === 0) out.panels.push(...row); });
  // lightning rods on the corners of the parapet
  for (let i = 0, k = 0; i < ring.length && k < 8; i += 2) {
    const x = ring[i], z = ring[i + 1], px = ring[(i - 2 + ring.length) % ring.length], pz = ring[(i - 1 + ring.length) % ring.length], nx2 = ring[(i + 2) % ring.length], nz2 = ring[(i + 3) % ring.length];
    const d1x = x - px, d1z = z - pz, d2x = nx2 - x, d2z = nz2 - z;
    const turn = Math.abs(Math.atan2(d1x * d2z - d1z * d2x, d1x * d2x + d1z * d2z));
    if (turn < 0.6) continue;
    const L = Math.hypot(cx - x, cz - z) || 1;
    out.rods.push([x + ((cx - x) / L) * 0.25, yt + parapet, z + ((cz - z) / L) * 0.25, 0]); k++;
  }
}

/** instanced meshes for everything planned on the roofs */
export function buildRoofKit(group, out) {
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const inst = (geo, mat, list, shadow = true, lift = 0) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z, yaw], i) => { M.compose(P.set(x, y + lift, z), Q.setFromAxisAngle(Y, yaw), S); im.setMatrixAt(i, M); });
    im.castShadow = shadow; im.receiveShadow = true;
    group.add(im);
  };
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
  // a module on a low tilted frame (22 degrees towards the facing side)
  const panel = solarModule(1.7, 1.0).rotateX(0.38).translate(0, 0.62, 0);
  inst(panel, solarMaterial(), out.panels);
  const frame = mergeColored([                           // the raised back legs (the front edge sits low)
    { geometry: new THREE.BoxGeometry(0.05, 0.75, 0.05), color: '#9aa0a6', matrix: m4(-0.8, 0.37, -0.38) },
    { geometry: new THREE.BoxGeometry(0.05, 0.75, 0.05), color: '#9aa0a6', matrix: m4(0.8, 0.37, -0.38) },
  ]);
  inst(frame, vc, out.panels, false);
  inst(solarWaterHeater(), vc, out.heaters);
  inst(acUnit(), vc, out.acs);
  inst(dish(), vc, out.dishes);
  inst(rod(), vc, out.rods, false);
  inst(clothesline(), vc, out.lines, false);
}

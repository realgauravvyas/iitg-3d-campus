// The campus lawns: in front of the big buildings (the Central Library, the lecture halls, the
// auditorium, the Conference Centre, the guest house, the hospital, the SAC, the Technology
// Incubation Centre and the flag lawn at the Administrative Building) the grass is short, mown and
// bright, with clipped round shrubs on the curve of the lawn, rows of slim Ashoka trees along its far
// edge, one big shade tree and a pine. The ground colour, the grass blades (short here) and the
// planting are all driven from the same list of lawns.
import * as THREE from 'three';
import { mulberry32, m4, mergeColored } from '../util.js';

// [landmark id, distance in front of the entrance, radius]
const SITES = [['library', 22, 25], ['lhc', 22, 24], ['auditorium', 24, 25], ['conference', 19, 21], ['guesthouse', 17, 19], ['hospital', 17, 19], ['tic', 17, 19], ['sac', 19, 21], ['newsac', 19, 21], ['gym', 17, 18]];
const FLAG = { x: -133.55, z: -68.9, r: 19 };           // the flag lawn at the Administrative Building

/** the lawn discs: { x, z, r, ax, az (away from the building), id } */
export function planLawns(world) {
  const out = [];
  for (const [id, d, r] of SITES) {
    const s = world.site(id);
    if (!s) continue;
    const x = s.ex + s.nx * d, z = s.ez + s.nz * d;
    if (!world.insideCampus(x, z) || world.waterAt(x, z)) continue;
    out.push({ id, x, z, r, ax: s.nx, az: s.nz });
  }
  const adm = world.site('admin');
  if (adm) out.push({ id: 'admin', x: FLAG.x, z: FLAG.z, r: FLAG.r, ax: -adm.nz, az: adm.nx });
  world.lawns = out;
  return out;
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** the lawns painted into the ground picture: greenish pixels turn a bright mown green, with faint mowing stripes */
export function paintLawns(img, bounds, lawns) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const [x0, y0, x1, y1] = bounds, ppm = c.width / (x1 - x0);
  for (const L of lawns) {
    const cx = ((L.x - x0) / (x1 - x0)) * c.width, cy = ((y1 + L.z) / (y1 - y0)) * c.height;   // map y (north) = -z
    const R = (L.r + 4) * ppm;
    const bx = Math.max(0, Math.floor(cx - R)), by = Math.max(0, Math.floor(cy - R)), bw = Math.min(c.width, Math.ceil(cx + R)) - bx, bh = Math.min(c.height, Math.ceil(cy + R)) - by;
    if (bw <= 0 || bh <= 0) continue;
    const im = g.getImageData(bx, by, bw, bh), d = im.data;
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const dist = Math.hypot((bx + i) - cx, (by + j) - cy) / ppm;
      if (dist > L.r + 4) continue;
      const k = (j * bw + i) * 4, r = d[k], gg = d[k + 1], b = d[k + 2];
      if (b > gg * 0.86 || gg < Math.max(r, b) * 0.98) continue;                 // paving, water or bare ground: leave it
      const w = (1 - smooth(L.r - 6, L.r + 4, dist)) * 0.72;
      // mowing stripes: bands 4.5 m wide across the lawn
      const u = ((bx + i) - cx) / ppm * L.az - ((by + j) - cy) / ppm * L.ax;      // distance across the lawn's long axis
      const band = Math.floor((u + 300) / 4.5) % 2 ? 1.05 : 0.95;
      d[k] = r + (118 * band - r) * w; d[k + 1] = gg + (182 * band - gg) * w; d[k + 2] = b + (62 * band - b) * w;
    }
    g.putImageData(im, bx, by);
  }
  return c;
}

/** where the trees and shrubs of the lawns stand (called before the trees are made: it clears the random trees off the lawns) */
export function designLawns(game) {
  const W = game.world, P = game.placer, rnd = mulberry32(2718);
  const trees = [], shrubs = [];
  const free = (x, z, r) => (P ? P.free(x, z, r, { sports: false }) : !W.buildingAt(x, z) && !W.waterAt(x, z));
  for (const L of W.lawns || []) {
    (W.clearings ||= []).push({ x: L.x, z: L.z, r: L.r - 1 });
    const base = Math.atan2(L.ax, L.az);                  // direction from the entrance out over the lawn (angle in the x-z plane)
    const at = (a, R) => [L.x + Math.sin(a) * R, L.z + Math.cos(a) * R];
    // slim Ashoka trees in a row along the lawn's far edge
    { const R = L.r * 0.9, span = 1.25, n = Math.max(4, Math.round((2 * span * R) / 5.2));
      for (let k = 0; k < n; k++) { const a = base + Math.PI + (-span + (2 * span * k) / (n - 1)) * 0.9; const [x, z] = at(a, R); if (free(x, z, 0.9)) { trees.push({ sp: 5, x, z, sc: 0.95 + rnd() * 0.2 }); P?.reserve(x, z, 0.4, 'tree', true); } } }
    // a big shade tree on one side, a pine on the other
    { const a = base + Math.PI / 2 + 0.25, [x, z] = at(a, L.r * 0.62); if (free(x, z, 2.2)) { trees.push({ sp: 0, x, z, sc: 1.4 }); P?.reserve(x, z, 0.6, 'tree', true); } }
    { const a = base - Math.PI / 2 - 0.2, [x, z] = at(a, L.r * 0.66); if (free(x, z, 1.8)) { trees.push({ sp: 7, x, z, sc: 1 }); P?.reserve(x, z, 0.5, 'tree', true); } }
    // clipped round shrubs on the curve of the lawn (two arcs), and a pair either side of the way in
    for (const [R, span, step] of [[L.r * 0.56, 0.95, 2.6], [L.r * 0.72, 1.1, 3.1]]) {
      const n = Math.max(3, Math.round((2 * span * R) / step));
      for (let k = 0; k < n; k++) { const a = base + Math.PI + (-span + (2 * span * k) / (n - 1)); const [x, z] = at(a, R); if (free(x, z, 0.85)) { shrubs.push({ x, z, r: 0.5 + rnd() * 0.16 }); P?.reserve(x, z, 0.62, 'shrub', true); } }
    }
    for (const side of [-1, 1]) { const x = L.x - L.ax * (L.r * 0.95) + L.az * side * 3.4, z = L.z - L.az * (L.r * 0.95) - L.ax * side * 3.4; if (free(x, z, 0.85)) { shrubs.push({ x, z, r: 0.62 }); P?.reserve(x, z, 0.66, 'shrub', true); } }
  }
  W.designedTrees = trees;
  game.lawnShrubs = shrubs;
  return { trees: trees.length, shrubs: shrubs.length };
}

/** the shrubs: clipped balls of dark, bright green */
export function buildLawnShrubs(game) {
  const W = game.world, list = game.lawnShrubs || [];
  const group = new THREE.Group();
  group.name = 'lawn-shrubs';
  if (!list.length) return { group };
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), list.length);
  const M = new THREE.Matrix4(), C = new THREE.Color(), rnd = mulberry32(31);
  list.forEach((s, i) => {
    const y = W.heightAt(s.x, s.z) + s.r * 0.72;
    M.compose(new THREE.Vector3(s.x, y, s.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28), new THREE.Vector3(s.r * 1.08, s.r * 0.9, s.r * 1.08));
    mesh.setMatrixAt(i, M);
    const v = 0.85 + rnd() * 0.3;
    mesh.setColorAt(i, C.setRGB(0.16 * v, 0.5 * v, 0.14 * v));
  });
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
  return { group };
}
void m4; void mergeColored;

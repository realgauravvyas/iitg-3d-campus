// The steel plate (thali) and what is served on it: rice, roti, katoris of dal, sabji, curd and sweet,
// salad, papad. Each item is its own small group so it can be served one by one and eaten away.
import * as THREE from 'three';
import { gravyColor } from './menu.js';

const STEEL = new THREE.MeshStandardMaterial({ color: 0xdadfe4, metalness: 0.42, roughness: 0.5 });
const STEEL_DK = new THREE.MeshStandardMaterial({ color: 0xb8bfc6, metalness: 0.4, roughness: 0.5 });
const mats = new Map();
const mat = (c) => { let m = mats.get(c); if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 }); mats.set(c, m); } return m; };
const geos = {
  plate: new THREE.CylinderGeometry(0.195, 0.16, 0.022, 28),
  rim: new THREE.TorusGeometry(0.185, 0.006, 6, 28),
  bowl: new THREE.CylinderGeometry(0.034, 0.026, 0.034, 14),
  fill: new THREE.CylinderGeometry(0.029, 0.029, 0.006, 14),
  mound: new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
  disc: new THREE.CylinderGeometry(1, 1, 1, 20),
  ball: new THREE.SphereGeometry(0.016, 8, 6),
  slice: new THREE.CylinderGeometry(0.02, 0.02, 0.005, 10),
  tri: new THREE.ConeGeometry(0.035, 0.03, 3),
};
const M = (geo, material, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); return m; };
const disc = (r, h, color, x, y, z, ry = 0, rz = 0, rx = 0) => M(geos.disc, mat(color), x, y, z, r, h, r, rx, ry, rz);

/** one katori (a small steel bowl) with something in it */
function katori(x, z, fillColor, extra = null) {
  const g = new THREE.Group();
  g.position.set(x, 0.011, z);
  g.add(M(geos.bowl, STEEL_DK, 0, 0.017, 0));
  g.add(M(geos.fill, mat(fillColor), 0, 0.0375, 0));
  if (extra) g.add(extra);
  return g;
}
function build(kind, name, slot) {
  const g = new THREE.Group();
  switch (kind) {
    case 'rice': {
      g.position.set(-0.055, 0.011, 0.04);
      g.add(M(geos.mound, mat(0xf7f3e6), 0, 0, 0, 1, 0.62, 1));
      for (let k = 0; k < 6; k++) g.add(M(geos.ball, mat(0xfffbef), Math.sin(k * 2.1) * 0.045, 0.02 + (k % 2) * 0.008, Math.cos(k * 2.1) * 0.04, 0.9, 0.5, 0.9));
      break;
    }
    case 'roti': {
      const th = /paratha|puri|bhature|kulche|dosa/i.test(name) ? 0.012 : 0.007, col = /paratha/i.test(name) ? 0xd9a955 : /puri|bhature/i.test(name) ? 0xd39a3f : 0xd8b26f;
      g.position.set(0.075, 0.011, 0.045);
      g.add(disc(0.064, th, col, 0, th / 2, 0));
      g.add(disc(0.062, th, col, 0.012, th * 1.5 + 0.001, 0.014, 0.4));
      g.add(disc(0.012, th * 0.4, 0xa87a3a, 0.02, th * 2.1, 0.02));
      break;
    }
    case 'dal': g.add(katori(slot.x, slot.z, /kadhi|sambar/i.test(name) ? 0xdcb741 : /salan/i.test(name) ? 0x8a5a2a : 0xd9a634)); break;
    case 'sabji': g.add(katori(slot.x, slot.z, gravyColor(name), M(geos.ball, mat(/paneer/i.test(name) ? 0xf1e4b8 : 0x5b7a2a), 0.006, 0.042, 0.004, 1.6, 1, 1.6))); break;
    case 'curd': g.add(katori(slot.x, slot.z, 0xf6f3ea)); break;
    case 'sweet': {
      const col = /gulab/i.test(name) ? 0x5b2410 : /kheer|custard/i.test(name) ? (/custard/i.test(name) ? 0xf0d36a : 0xefe6c6) : /ice/i.test(name) ? 0xf3dbe2 : /jalebi/i.test(name) ? 0xe58b1f : 0xe8b45a;
      const b = katori(slot.x, slot.z, col);
      if (/gulab/i.test(name)) { b.add(M(geos.ball, mat(0x4a1c0c), -0.008, 0.048, 0, 1.4, 1.2, 1.4)); b.add(M(geos.ball, mat(0x4a1c0c), 0.01, 0.048, 0.006, 1.3, 1.1, 1.3)); }
      g.add(b); break;
    }
    case 'salad': {
      g.position.set(0.135, 0.011, -0.03);
      g.add(M(geos.slice, mat(0x86b45a), 0, 0.004, 0, 1, 1, 1));
      g.add(M(geos.slice, mat(0xd8402f), 0.03, 0.006, 0.018, 0.9, 1, 0.9));
      g.add(M(geos.slice, mat(0xf1eadb), -0.012, 0.008, 0.035, 0.9, 1, 0.9));
      g.add(M(geos.slice, mat(0x86b45a), 0.026, 0.01, -0.028, 0.8, 1, 0.8));
      break;
    }
    case 'papad': g.add(disc(0.056, 0.004, 0xe8cc90, 0.01, 0.014, 0.125, 0.3, 0.06)); break;
    case 'pickle': g.add(M(geos.ball, mat(0x6a3a12), -0.13, 0.017, 0.085, 1.4, 0.8, 1.4)); break;
    case 'snack': for (let k = 0; k < 3; k++) g.add(M(geos.tri, mat(0xc98a3a), -0.04 + k * 0.05, 0.03, 0.02 + (k % 2) * 0.03, 1, 1, 1, 0, k * 0.8, 0)); break;
    default: break;
  }
  return g;
}

/** slots on the plate for the katoris, spread in an arc along its far edge */
const bowlSlot = (i, n) => { const a = n <= 1 ? 0 : -1.3 + (2.6 * i) / (n - 1); return { x: Math.sin(a) * 0.128, z: -Math.cos(a) * 0.128 }; };

/** a thali for a plate plan ([{kind, name}]): { group, items, reveal(n), eat(frac), count } */
export function makeThali(plan) {
  const group = new THREE.Group();
  group.add(M(geos.plate, STEEL, 0, 0.011, 0));
  group.add(M(geos.rim, STEEL, 0, 0.022, 0, 1, 1, 1, Math.PI / 2, 0, 0));
  const bowls = plan.filter((p) => ['dal', 'sabji', 'curd', 'sweet'].includes(p.kind)).slice(0, 5);
  const items = [];
  let bi = 0;
  for (const p of plan) {
    if (['dal', 'sabji', 'curd', 'sweet'].includes(p.kind) && !bowls.includes(p)) continue;
    const slot = bowls.includes(p) ? bowlSlot(bi++, bowls.length) : { x: 0, z: 0 };
    const g = build(p.kind, p.name, slot);
    g.visible = true;
    group.add(g);
    items.push({ ...p, group: g });
  }
  const api = {
    group, items, count: items.length,
    /** show the first n items (serving) */
    reveal(n) { items.forEach((it, i) => { it.group.visible = i < n; it.group.scale.setScalar(1); }); },
    /** eat away: frac 0 (full) .. 1 (empty), a few bites at a time; sweets go last */
    eat(frac) {
      const order = [...items.keys()].sort((a, b) => (items[a].kind === 'sweet') - (items[b].kind === 'sweet'));
      const n = items.length;
      order.forEach((idx, r) => { const k = Math.min(1, Math.max(0, frac * n - r)); const it = items[idx].group; it.scale.set(1 - k * 0.98, 1 - k * 0.85, 1 - k * 0.98); it.visible = k < 0.99; });
    },
    /** pop-in scale for the item served last (0..1) */
    pop(i, k) { const it = items[i]; if (it) { it.group.visible = true; it.group.scale.setScalar(Math.max(0.01, k)); } },
  };
  return api;
}

/** a stack of clean steel plates */
export function makeStack(n = 12) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) g.add(M(geos.plate, STEEL, 0, i * 0.014 + 0.011, 0));
  return g;
}
export { STEEL };

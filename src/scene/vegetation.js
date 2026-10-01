// Trees built from leaf cards (alpha-tested clusters on a procedural atlas) with
// spherical canopy normals, back-lit leaves and wind. Two levels of detail per chunk.
import * as THREE from 'three';
import { b64ToBytes, mulberry32 } from '../util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { inArea } from './courts.js';
import { U } from './shared.js';

// atlas: 4 x 4 cells of 256 px
const CELLS = { broad: [0, 0], palm: [1, 0], bamboo: [2, 0], flower: [3, 0], sal: [0, 1], bark: [1, 1], broad2: [2, 1], shrub: [3, 1],
  ashoka: [0, 2], coconut: [1, 2], pine: [2, 2], yellow: [3, 2], purple: [0, 3], banana: [1, 3], neem: [2, 3], pink: [3, 3] };

function leafAtlas() {
  const W = 1024, H = 1024, S = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rnd = mulberry32(77);
  const leaf = (x, y, len, wid, ang, col, vein = true) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(wid, len * 0.45, 0, len); g.quadraticCurveTo(-wid, len * 0.45, 0, 0); g.fill();
    if (vein) { g.strokeStyle = 'rgba(20,40,10,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len * 0.95); g.stroke(); }
    g.restore();
  };
  const green = (h0, s0, l0) => `hsl(${h0 + (rnd() - 0.5) * 16}, ${s0 + (rnd() - 0.5) * 18}%, ${l0 + (rnd() - 0.5) * 16}%)`;
  const cluster = ([cx, cy], n, lenR, widR, hue, sat, lig, round = 0.43) => {
    const ox = cx * S, oy = cy * S;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * S * round;
      const x = ox + S / 2 + Math.cos(a) * r, y = oy + S / 2 + Math.sin(a) * r * 0.92;
      const len = lenR[0] + rnd() * (lenR[1] - lenR[0]);
      leaf(x, y, len, len * (widR[0] + rnd() * (widR[1] - widR[0])), a + Math.PI / 2 + (rnd() - 0.5) * 1.2, green(hue, sat, lig - (r / (S * round)) * 6));
    }
  };
  cluster(CELLS.broad, 230, [14, 26], [0.3, 0.42], 100, 48, 30);
  cluster(CELLS.broad2, 210, [16, 30], [0.28, 0.38], 92, 44, 34);
  cluster(CELLS.sal, 170, [22, 38], [0.32, 0.45], 108, 40, 24);
  cluster(CELLS.shrub, 260, [10, 18], [0.35, 0.5], 96, 42, 32, 0.45);
  // gulmohar: fine green foliage with flame-red flower clusters
  cluster(CELLS.flower, 160, [8, 14], [0.4, 0.6], 95, 45, 32);
  {
    const [cx, cy] = CELLS.flower;
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * S * 0.4;
      const x = cx * S + S / 2 + Math.cos(a) * r, y = cy * S + S / 2 + Math.sin(a) * r;
      for (let k = 0; k < 5; k++) leaf(x, y, 7 + rnd() * 5, 5, (k / 5) * Math.PI * 2, `hsl(${8 + rnd() * 14}, 85%, ${45 + rnd() * 12}%)`, false);
    }
  }
  // areca palm frond: rachis with drooping leaflets (card is long and thin)
  {
    const ox = CELLS.palm[0] * S, oy = CELLS.palm[1] * S;
    g.strokeStyle = '#6f7d3a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(ox + S / 2, oy + 4); g.lineTo(ox + S / 2, oy + S - 4); g.stroke();
    for (let y = 10; y < S - 8; y += 5) {
      const t = y / S, len = 60 * Math.sin(t * Math.PI) + 18;
      for (const s of [1, -1]) leaf(ox + S / 2, oy + y, len, 4.5, s * (1.25 + rnd() * 0.25), green(88, 50, 32), false);
    }
  }
  // bamboo: long narrow leaves
  {
    const ox = CELLS.bamboo[0] * S, oy = CELLS.bamboo[1] * S;
    for (let i = 0; i < 160; i++) {
      const x = ox + 20 + rnd() * (S - 40), y = oy + 20 + rnd() * (S - 60);
      leaf(x, y, 30 + rnd() * 24, 4 + rnd() * 2, (rnd() - 0.5) * 1.6 + Math.PI * 0.1, green(78, 46, 40), false);
    }
  }
  // bark
  {
    const ox = CELLS.bark[0] * S, oy = CELLS.bark[1] * S;
    g.fillStyle = '#5a4838'; g.fillRect(ox, oy, S, S);
    for (let i = 0; i < 900; i++) {
      const v = 60 + rnd() * 50;
      g.fillStyle = `rgba(${v + 10},${v},${v - 12},0.5)`;
      g.fillRect(ox + rnd() * S, oy + rnd() * S, 1 + rnd() * 2, 6 + rnd() * 26);
    }
  }
  // false ashoka: long, narrow, wavy leaves hanging down
  {
    const [cx, cy] = CELLS.ashoka;
    for (let i = 0; i < 150; i++) {
      const x = cx * S + 20 + rnd() * (S - 40), y = cy * S + 10 + rnd() * (S - 70);
      leaf(x, y, 34 + rnd() * 26, 4 + rnd() * 2, (rnd() - 0.5) * 0.7, green(112, 48, 22), true);
    }
  }
  // coconut frond: long pale leaflets on a rachis
  {
    const ox = CELLS.coconut[0] * S, oy = CELLS.coconut[1] * S;
    g.strokeStyle = '#8a8a3a'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(ox + S / 2, oy + 2); g.lineTo(ox + S / 2, oy + S - 2); g.stroke();
    for (let y = 6; y < S - 6; y += 4) {
      const t = y / S, len = 84 * Math.sin(t * Math.PI * 0.9 + 0.2) + 14;
      for (const sd of [1, -1]) leaf(ox + S / 2, oy + y, len, 3.8, sd * (1.05 + rnd() * 0.3), green(72, 52, 38), false);
    }
  }
  // norfolk pine / araucaria: needle sprays
  {
    const ox = CELLS.pine[0] * S, oy = CELLS.pine[1] * S;
    for (let k = 0; k < 9; k++) {
      const y0 = oy + 20 + k * 26;
      g.strokeStyle = green(130, 40, 20); g.lineWidth = 2;
      g.beginPath(); g.moveTo(ox + 12, y0); g.lineTo(ox + S - 12, y0 + (rnd() - 0.5) * 8); g.stroke();
      for (let x = ox + 14; x < ox + S - 14; x += 3) for (const sd of [1, -1]) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x + 5, y0 + sd * (9 + rnd() * 5)); g.stroke(); }
    }
  }
  // amaltas (golden shower): green leaves with hanging yellow chains
  cluster(CELLS.yellow, 150, [12, 22], [0.32, 0.45], 96, 42, 32);
  {
    const [cx, cy] = CELLS.yellow;
    for (let i = 0; i < 28; i++) {
      const x = cx * S + 20 + rnd() * (S - 40), y = cy * S + 20 + rnd() * (S * 0.5);
      for (let k = 0; k < 14; k++) { g.fillStyle = `hsl(${48 + rnd() * 8}, 95%, ${55 + rnd() * 12}%)`; g.beginPath(); g.arc(x + Math.sin(k * 0.7) * 3, y + k * 7, 3.6 - k * 0.12, 0, 7); g.fill(); }
    }
  }
  // jarul (pride of India, purple) and kachnar (pink)
  for (const [cell, hue, sat, lig] of [[CELLS.purple, 285, 55, 58], [CELLS.pink, 330, 70, 72]]) {
    cluster(cell, 150, [12, 22], [0.32, 0.45], 98, 44, 31);
    const [cx, cy] = cell;
    for (let i = 0; i < 55; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * S * 0.4;
      const x = cx * S + S / 2 + Math.cos(a) * r, y = cy * S + S / 2 + Math.sin(a) * r;
      for (let k = 0; k < 7; k++) { g.fillStyle = `hsl(${hue + (rnd() - 0.5) * 14}, ${sat}%, ${lig + (rnd() - 0.5) * 12}%)`; g.beginPath(); g.arc(x + (rnd() - 0.5) * 12, y + (rnd() - 0.5) * 12, 3 + rnd() * 2.5, 0, 7); g.fill(); }
    }
  }
  // banana leaf: one big leaf, midrib and parallel veins, a few tears
  {
    const ox = CELLS.banana[0] * S, oy = CELLS.banana[1] * S;
    g.fillStyle = 'hsl(92, 52%, 36%)';
    g.beginPath(); g.moveTo(ox + S / 2, oy + 4);
    g.bezierCurveTo(ox + S - 18, oy + 50, ox + S - 18, oy + S - 50, ox + S / 2, oy + S - 4);
    g.bezierCurveTo(ox + 18, oy + S - 50, ox + 18, oy + 50, ox + S / 2, oy + 4); g.fill();
    g.strokeStyle = 'hsl(70, 45%, 55%)'; g.lineWidth = 4; g.beginPath(); g.moveTo(ox + S / 2, oy + 4); g.lineTo(ox + S / 2, oy + S - 4); g.stroke();
    g.strokeStyle = 'rgba(20,50,10,0.3)'; g.lineWidth = 1;
    for (let y = 14; y < S - 10; y += 6) for (const sd of [1, -1]) { g.beginPath(); g.moveTo(ox + S / 2, oy + y); g.lineTo(ox + S / 2 + sd * 100, oy + y + 22); g.stroke(); }
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 7; k++) { const y = oy + 30 + rnd() * (S - 60), sd = rnd() < 0.5 ? 1 : -1; g.fillRect(ox + S / 2 + sd * (40 + rnd() * 50) - (sd < 0 ? 60 : 0), y, 60, 2); }
    g.globalCompositeOperation = 'source-over';
  }
  // neem: many small serrated leaflets
  cluster(CELLS.neem, 420, [7, 12], [0.22, 0.3], 100, 50, 30, 0.45);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  return t;
}

const cellUV = ([cx, cy], u, v) => [(cx + u) / 4, 1 - (cy + 1 - v) / 4];

/** leaf card: plane with atlas uv, normals bent outwards from the canopy centre */
function card(center, crownC, size, cell, rnd, aspect = 1, bend = 0.8) {
  const g = new THREE.PlaneGeometry(size, size * aspect);
  const e = new THREE.Euler(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));
  g.translate(center.x, center.y, center.z);
  const uv = g.attributes.uv, pos = g.attributes.position, nor = g.attributes.normal;
  const n = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < uv.count; i++) {
    const [u, v] = cellUV(cell, uv.getX(i), uv.getY(i));
    uv.setXY(i, u, v);
    o.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(crownC).normalize();
    n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    n.lerp(o, bend).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return leafAttr(g, 1);
}
function leafAttr(g, v) {
  const a = new Float32Array(g.attributes.position.count).fill(v);
  g.setAttribute('aLeaf', new THREE.BufferAttribute(a, 1));
  if (g.index) g = g.toNonIndexed();
  return g;
}
function trunk(r0, r1, h, x = 0, z = 0, lean = [0, 0], seg = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 2, true);
  g.translate(0, h / 2, 0);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(lean[0], 0, lean[1])));
  g.translate(x, 0, z);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const [u, v] = cellUV(CELLS.bark, uv.getX(i), uv.getY(i) * 0.95); uv.setXY(i, u, v); }
  return leafAttr(g, 0);
}
function crown(center, radii, count, size, cells, rnd, aspect = 1) {
  const out = [];
  for (let i = 0; i < count; i++) {
    // points biased to the surface of the ellipsoid (leaves live on the outside)
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr = 0.55 + Math.sqrt(rnd()) * 0.45;
    const s = Math.sqrt(1 - u * u);
    const p = new THREE.Vector3(Math.cos(th) * s * radii[0] * rr, u * radii[1] * rr, Math.sin(th) * s * radii[2] * rr).add(center);
    out.push(card(p, center, size * (0.8 + rnd() * 0.45), cells[Math.floor(rnd() * cells.length)], rnd, aspect));
  }
  return out;
}

function species(lod) {
  const r = mulberry32(5 + lod);
  const k = lod ? 0.45 : 1;   // far LOD: fewer, bigger cards
  const sz = lod ? 1.45 : 1;
  const S = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // 0 broadleaf (mango / jackfruit / banyan-like)
  S.push(mergeGeometries([
    trunk(0.28, 0.18, 3.6), trunk(0.12, 0.07, 2.2, 0.2, 0, [0.2, -0.7]), trunk(0.12, 0.07, 2.2, -0.2, 0.1, [-0.3, 0.65]),
    ...crown(V(0, 4.8, 0), [2.9, 2.0, 2.9], Math.round(46 * k), 2.1 * sz, [CELLS.broad, CELLS.broad2], r),
    ...crown(V(1.3, 5.5, 0.6), [1.7, 1.3, 1.7], Math.round(14 * k), 1.8 * sz, [CELLS.broad], r),
  ]));
  // 1 areca (betel-nut) palm
  // (the crown sits on the top of the trunk as it is actually leaning: worked out with the same rotation the trunk gets)
  const palmLean = [0.02, 0.03], palmTop = V(0, 8.8, 0).applyEuler(new THREE.Euler(palmLean[0], 0, palmLean[1]));
  const palm = [trunk(0.13, 0.09, 8.8, 0, 0, palmLean, 5)];
  const nf = lod ? 7 : 11;
  for (let i = 0; i < nf; i++) {
    const g = new THREE.PlaneGeometry(0.9, 3.2, 1, 3);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) { const y = pos.getY(v) + 1.6; pos.setZ(v, -y * y * 0.09); }  // droop
    g.rotateX(-Math.PI / 2); g.translate(0, 0, 1.6);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.35 - r() * 0.4, (i / nf) * Math.PI * 2 + r() * 0.3, 0, 'YXZ')));
    g.translate(palmTop.x, palmTop.y + 0.2, palmTop.z);
    const uv = g.attributes.uv;
    for (let v = 0; v < uv.count; v++) { const [u, w] = cellUV(CELLS.palm, uv.getX(v), uv.getY(v)); uv.setXY(v, u, w); }
    g.computeVertexNormals();
    const n = g.attributes.normal;
    for (let v = 0; v < n.count; v++) n.setXYZ(v, n.getX(v) * 0.4, 0.9, n.getZ(v) * 0.4);
    palm.push(leafAttr(g, 1));
  }
  S.push(mergeGeometries(palm));
  // 2 bamboo clump
  const bam = [];
  for (let i = 0; i < (lod ? 4 : 7); i++) {
    const a = r() * Math.PI * 2, lean = 0.1 + r() * 0.18, h = 8 + r() * 3.5;
    bam.push(trunk(0.06, 0.045, h, Math.cos(a) * 0.4, Math.sin(a) * 0.4, [Math.sin(a) * lean, -Math.cos(a) * lean], 5));
    const top = V(Math.cos(a) * (0.4 + h * lean * 0.8), h * 0.8, Math.sin(a) * (0.4 + h * lean * 0.8));
    bam.push(...crown(top, [1.3, 2.4, 1.3], Math.round(9 * k) + 1, 1.9 * sz, [CELLS.bamboo], r, 1.3));
  }
  S.push(mergeGeometries(bam));
  // 3 flowering gulmohar / krishnachura (flame tree): wide umbrella crown
  S.push(mergeGeometries([
    trunk(0.26, 0.17, 3.2), trunk(0.1, 0.06, 2.4, 0.1, 0, [0, -0.9]), trunk(0.1, 0.06, 2.4, -0.1, 0, [0, 0.9]),
    ...crown(V(0, 4.6, 0), [3.8, 1.3, 3.8], Math.round(44 * k), 2.0 * sz, [CELLS.flower, CELLS.flower, CELLS.broad2], r),
  ]));
  // 4 tall sal / forest tree on the campus hills
  S.push(mergeGeometries([
    trunk(0.34, 0.2, 7.6),
    ...crown(V(0, 9.8, 0), [2.8, 3.6, 2.8], Math.round(40 * k), 2.3 * sz, [CELLS.sal, CELLS.broad], r),
    ...crown(V(0.8, 7.4, 0.5), [1.8, 1.4, 1.8], Math.round(10 * k), 1.8 * sz, [CELLS.sal], r),
  ]));
  // 5 false ashoka (Polyalthia): tall, slim, conical - the rows in front of the admin building
  S.push(mergeGeometries([
    trunk(0.16, 0.08, 10.5, 0, 0, [0, 0], 5),
    ...crown(V(0, 6.8, 0), [1.15, 4.6, 1.15], Math.round(40 * k), 1.6 * sz, [CELLS.ashoka], r, 1.4),
    ...crown(V(0, 10.4, 0), [0.6, 1.6, 0.6], Math.round(8 * k) + 1, 1.3 * sz, [CELLS.ashoka], r, 1.4),
  ]));
  // 6 coconut palm: tall curving trunk and long fronds
  const cocoLean = [0.12, 0.08];
  const coco = [trunk(0.18, 0.13, 11.5, 0, 0, cocoLean, 6)];
  const top6 = V(0, 11.5, 0).applyEuler(new THREE.Euler(cocoLean[0], 0, cocoLean[1]));   // where the leaning trunk really ends (the crown used to be put 3 m beside it)
  top6.y -= 0.1;
  for (let i = 0; i < (lod ? 8 : 13); i++) {
    const g = new THREE.PlaneGeometry(1.1, 4.6, 1, 4);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) { const y = pos.getY(v) + 2.3; pos.setZ(v, -y * y * 0.07); }
    g.rotateX(-Math.PI / 2); g.translate(0, 0, 2.3);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.15 - r() * 0.5, (i / 13) * Math.PI * 2 + r() * 0.3, 0, 'YXZ')));
    g.translate(top6.x, top6.y, top6.z);
    const uv = g.attributes.uv;
    for (let v = 0; v < uv.count; v++) { const [u, w] = cellUV(CELLS.coconut, uv.getX(v), uv.getY(v)); uv.setXY(v, u, w); }
    g.computeVertexNormals();
    const n = g.attributes.normal;
    for (let v = 0; v < n.count; v++) n.setXYZ(v, n.getX(v) * 0.4, 0.9, n.getZ(v) * 0.4);
    coco.push(leafAttr(g, 1));
  }
  S.push(mergeGeometries(coco));
  // 7 norfolk pine (araucaria): tiers of flat branches, a perfect cone
  const pine = [trunk(0.2, 0.08, 15, 0, 0, [0, 0], 6)];
  const tiers = lod ? 7 : 12;
  for (let t = 0; t < tiers; t++) {
    const f = t / tiers, y = 3 + f * 11.5, R = 2.8 * (1 - f) + 0.4;
    for (let j = 0; j < (lod ? 4 : 6); j++) {
      const g = new THREE.PlaneGeometry(R * 1.3, 0.9);
      g.translate(R * 0.6, 0, 0);
      g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2 + 0.25, (j / 6) * Math.PI * 2 + t * 0.5, -0.12, 'YXZ')));
      g.translate(0, y, 0);
      const uv = g.attributes.uv;
      for (let v = 0; v < uv.count; v++) { const [u, w] = cellUV(CELLS.pine, uv.getX(v), uv.getY(v)); uv.setXY(v, u, w); }
      g.computeVertexNormals();
      pine.push(leafAttr(g, 1));
    }
  }
  S.push(mergeGeometries(pine));
  // 8 amaltas (golden shower)
  S.push(mergeGeometries([
    trunk(0.22, 0.14, 3.4), trunk(0.09, 0.05, 2.2, 0.1, 0, [0.1, -0.7]),
    ...crown(V(0, 5.0, 0), [2.8, 2.1, 2.8], Math.round(40 * k), 2.0 * sz, [CELLS.yellow, CELLS.yellow, CELLS.broad2], r),
  ]));
  // 9 jarul (purple)
  S.push(mergeGeometries([
    trunk(0.22, 0.14, 3.0), trunk(0.09, 0.05, 2.0, -0.1, 0, [-0.1, 0.7]),
    ...crown(V(0, 4.5, 0), [2.6, 1.9, 2.6], Math.round(40 * k), 1.9 * sz, [CELLS.purple, CELLS.purple, CELLS.broad], r),
  ]));
  // 10 banana plant
  const ban = [trunk(0.16, 0.12, 2.1, 0, 0, [0, 0], 6)];
  for (let i = 0; i < (lod ? 5 : 8); i++) {
    const g = new THREE.PlaneGeometry(0.75, 2.4, 1, 4);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) { const y = pos.getY(v) + 1.2; pos.setZ(v, -y * y * 0.16); }
    g.rotateX(-Math.PI / 2 + 0.9); g.translate(0, 0.3, 0.4);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, (i / 8) * Math.PI * 2 + r() * 0.5, 0)));
    g.translate(0, 2.0, 0);
    const uv = g.attributes.uv;
    for (let v = 0; v < uv.count; v++) { const [u, w] = cellUV(CELLS.banana, uv.getX(v), uv.getY(v)); uv.setXY(v, u, w); }
    g.computeVertexNormals();
    ban.push(leafAttr(g, 1));
  }
  S.push(mergeGeometries(ban));
  // 11 neem: round, fine-leaved
  S.push(mergeGeometries([
    trunk(0.26, 0.16, 3.8), trunk(0.1, 0.06, 2.4, 0.15, 0, [0.15, -0.6]), trunk(0.1, 0.06, 2.4, -0.15, 0.1, [-0.2, 0.6]),
    ...crown(V(0, 5.4, 0), [3.2, 2.5, 3.2], Math.round(46 * k), 2.0 * sz, [CELLS.neem, CELLS.neem, CELLS.broad2], r),
  ]));
  // 12 kachnar (pink orchid tree)
  S.push(mergeGeometries([
    trunk(0.18, 0.12, 2.8),
    ...crown(V(0, 4.1, 0), [2.3, 1.7, 2.3], Math.round(36 * k), 1.8 * sz, [CELLS.pink, CELLS.pink, CELLS.broad2], r),
  ]));
  return S;
}

/** give the campus its variety: ornamental and flowering trees near buildings, palms by the houses */
function remap(sp, x, z, world) {
  let h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; h -= Math.floor(h);
  let near = null;
  for (const b of world.buildingsNear(x, z)) {
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1);
    if (dx * dx + dz * dz < 28 * 28) { near = b; break; }
  }
  if (sp === 0) {
    if (near) return h < 0.14 ? 11 : h < 0.24 ? 8 : h < 0.33 ? 9 : h < 0.4 ? 12 : h < 0.52 ? 5 : h < 0.57 ? 7 : 0;
    return h < 0.12 ? 11 : h < 0.16 ? 8 : h < 0.19 ? 9 : 0;
  }
  if (sp === 1) {
    if (near && near.kind === 'residential') return h < 0.32 ? 6 : h < 0.5 ? 10 : 1;
    return h < 0.18 ? 6 : 1;
  }
  if (sp === 4 && near) return h < 0.2 ? 11 : h < 0.3 ? 7 : 4;
  return sp;
}

function patchTree(sh, sunU) {
  sh.uniforms.uTime = U.uTime;
  sh.uniforms.uWind = U.uWind;
  if (sunU) { sh.uniforms.uSunDir = sunU.dir; sh.uniforms.uSunCol = sunU.col; }
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime, uWind;\nattribute float aLeaf;\nvarying float vLeaf;\nvarying vec3 vWP;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vLeaf = aLeaf;
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float amp = (0.35 + uWind * 1.6);
      float sway = max(transformed.y - 1.2, 0.0) * 0.012 * amp;
      float ph = uTime * (1.1 + uWind) + ip.x * 0.05 + ip.z * 0.03;
      transformed.x += sin(ph) * sway + sin(ph * 2.3) * sway * 0.3;
      transformed.z += cos(ph * 0.9) * sway;
      float fl = aLeaf * (0.02 + uWind * 0.06);
      transformed += fl * vec3(sin(uTime * 7.0 + position.y * 3.1 + position.x * 5.0), sin(uTime * 6.0 + position.z * 4.0), cos(uTime * 7.5 + position.x * 3.7));`)
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      #ifdef USE_INSTANCING
        vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
  if (!sunU) return;
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vLeaf;\nvarying vec3 vWP;\nuniform vec3 uSunDir, uSunCol;')
    .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', 'normal *= mix(faceDirection, 1.0, vLeaf);'))
    .replace('#include <opaque_fragment>', `
      vec3 Vd = normalize(vWP - cameraPosition);
      float bl = pow(max(dot(Vd, uSunDir), 0.0), 3.0);
      outgoingLight += diffuseColor.rgb * uSunCol * bl * 0.55 * vLeaf;
      #include <opaque_fragment>`);
}

export function buildVegetation(world, quality = 'medium', graph = null) {
  const group = new THREE.Group();
  group.name = 'trees';
  const bytes = b64ToBytes(world.data.trees);
  const a = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const atlas = leafAtlas();
  const near = species(0), far = species(1);
  const sunU = { dir: { value: new THREE.Vector3(0, 1, 0) }, col: { value: new THREE.Color(1, 0.95, 0.8) } };
  const mat = new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.42, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });   // (alpha to coverage: the leaf edges are anti-aliased instead of crawling as you move)
  mat.onBeforeCompile = (sh) => patchTree(sh, sunU);
  mat.customProgramCacheKey = () => 'tree-color';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.42 });
  depth.onBeforeCompile = (sh) => patchTree(sh, null);
  depth.customProgramCacheKey = () => 'tree-depth';

  const CH = 250;
  const chunks = new Map();
  const rnd = mulberry32(99);
  const positions = [];
  const clear = world.clearings || [];
  const dropped = { road: 0, water: 0 };
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i] / 4, z = -a[i + 1] / 4, sc = (a[i + 2] & 255) / 100;
    if (clear.some((c) => (c.area ? inArea(c.area, x, z, 2.5) : (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r))) continue;
    // no trunk on a road or a footpath (campus roads and the roads outside the wall), none in a lake
    if (graph) { const rd = graph.roadAt(x, z, 12, () => true); if (rd && rd.d < (rd.hw ? rd.hw + 1.4 : 1.6)) { dropped.road++; continue; } }
    if (world.waterAt(x, z)) { dropped.water++; continue; }
    { const h = world.heightAt(x, z); if (world.water.some((w) => x > w.x0 - 14 && x < w.x1 + 14 && z > w.z0 - 14 && z < w.z1 + 14 && h < w.level + 0.8)) { dropped.water++; continue; } }
    const sp = remap(a[i + 2] >> 8, x, z, world);
    const key = `${Math.floor(x / CH)},${Math.floor(z / CH)},${sp}`;
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push([x, z, sc]);
    positions.push(x, z);
  }
  // the designed planting (the lawns' Ashoka rows, shade trees and pines) and the dense forest on the View Point hill: a fixed species each
  for (const t of [...(world.designedTrees || []), ...(world.hillTrees || []), ...(world.lakeTrees || [])]) {
    const key = `${Math.floor(t.x / CH)},${Math.floor(t.z / CH)},${t.sp}`;
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push([t.x, t.z, t.sc]);
    positions.push(t.x, t.z);
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const C = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
  const lods = [];
  for (const [key, list] of chunks) {
    const sp = +key.split(',')[2];
    const pair = [];
    for (const geo of [near[sp], far[sp]]) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      im.customDepthMaterial = depth;
      pair.push(im);
    }
    list.forEach(([x, z, sc], i) => {
      const y = world.heightAt(x, z) - 0.2;
      const s = sp === 1 || sp === 6 ? 0.8 + sc * 0.3 : sp === 10 ? 0.7 + sc * 0.3 : sp === 5 || sp === 7 ? 0.85 + sc * 0.25 : sc;
      M.compose(P.set(x, y, z), Q.setFromAxisAngle(Y, rnd() * Math.PI * 2), S.set(s * (0.9 + rnd() * 0.2), s * (0.92 + rnd() * 0.16), s * (0.9 + rnd() * 0.2)));
      const v = 0.8 + rnd() * 0.32;
      C.setRGB(v * (0.93 + rnd() * 0.14), v, v * (0.82 + rnd() * 0.12));
      for (const im of pair) { im.setMatrixAt(i, M); im.setColorAt(i, C); }
    });
    for (const im of pair) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); group.add(im); }
    pair[1].castShadow = false;
    const [cx, cz] = key.split(',').map(Number);
    lods.push({ near: pair[0], far: pair[1], x: (cx + 0.5) * CH, z: (cz + 0.5) * CH, isNear: false });
  }
  const nearDist = quality === 'high' ? 320 : quality === 'low' ? 170 : 210;
  const shadowDist = quality === 'high' ? 170 : 120;                 // only the trees close to you cast shadows
  let lodT = 0;
  return {
    dropped,
    group,
    count: a.length / 3,
    positions,
    sunU,
    update(t, camera, sky) {
      if (sky) { sunU.dir.value.copy(sky.state.sunDir); sunU.col.value.copy(sky.sun.color).multiplyScalar(sky.sun.intensity * 0.35); }
      lodT -= 1;
      if (lodT > 0 || !camera) return;
      lodT = 15;
      const c = camera.position;
      for (const l of lods) {
        const d = Math.hypot(l.x - c.x, l.z - c.z) - CH * 0.7 + Math.max(0, c.y - 40) * 1.4;      // from the air everything is far
        // a chunk changes level only when it is clearly past the line (no flipping back and forth as the camera drifts)
        const n = l.isNear ? d < nearDist + 45 : d < nearDist - 45;
        l.isNear = n;
        l.near.visible = n; l.far.visible = !n;
        l.near.castShadow = d < shadowDist;
      }
    },
  };
}

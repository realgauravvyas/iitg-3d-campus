// The swimming pool complex: a boundary wall with a walk-in gate, a changing block (girls' and boys'
// changing rooms, ladies' and gents' toilets, a first-aid / lifeguard room, lockers under a canopy),
// rinse showers on the deck, starting blocks with lane numbers, backstroke flags, depth markings,
// rescue rings, a two-step stand for spectators, floodlights, a rules board and an electronic
// scoreboard for the inter-hostel aquatics meet (the heats themselves run in life/neighbourhood.js).
// You can change into swimwear in the changing rooms, use the toilets and take a shower.
import * as THREE from 'three';
import { mergeColored, m4, canvasTexture, fitText } from '../util.js';

const FONT = (w, px) => `${w} ${px}px "Hind", "Segoe UI", system-ui, sans-serif`;

/** the pool's frame: centre, long axis (u) and cross axis (v), water extents; at(u, v) -> world [x, z] */
export function poolFrame(W) {
  const w = W.water.find((q) => q.kind === 'pool');
  if (!w) return null;
  const ring = w.rings[0];
  let best = null;
  for (let i = 0; i < ring.length; i += 2) { const j = (i + 2) % ring.length, L = Math.hypot(ring[j] - ring[i], ring[j + 1] - ring[i + 1]); if (!best || L > best.L) best = { L, ax: (ring[j] - ring[i]) / L, az: (ring[j + 1] - ring[i + 1]) / L }; }
  let cx = 0, cz = 0; for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cz += ring[i + 1]; } cx /= ring.length / 2; cz /= ring.length / 2;
  const { ax, az } = best;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < ring.length; i += 2) { const dx = ring[i] - cx, dz = ring[i + 1] - cz, u = dx * ax + dz * az, v = -dx * az + dz * ax; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const at = (u, v) => [cx + ax * u - az * v, cz + az * u + ax * v];
  const lanes = Math.max(2, Math.min(8, Math.floor((v1 - v0) / 2.0)));
  const laneV = (k) => v0 + (k + 0.5) * ((v1 - v0) / lanes);
  return { w, cx, cz, ax, az, u0, u1, v0, v1, at, lanes, laneV, deckY: w.deck ?? w.level + 0.3, level: w.level, yawU: Math.atan2(ax, az) };
}

/** before the trees and the fences: the compound's wall outline and the paved ground inside it */
export function planPool(W) {
  const P = poolFrame(W);
  if (!P) return null;
  const { u0, u1, v0, v1, at } = P;
  // the changing block stands at the west end (the only level open ground), the stand on the south side
  const U0 = u0 - 22, U1 = u1 + 5, V0 = v0 - 6.5, V1 = v1 + 4.5;
  const ringUV = [[U0, V0], [U1, V0], [U1, V1], [u0 - 4, V1], [u0 - 4, v1 - 1.5], [U0, v1 - 1.5]];
  const ring = ringUV.map(([u, v]) => at(u, v));
  (W.fenceOutlines ||= []).push({ f: { kind: 'pool', cx: P.cx, cz: P.cz }, ring, h: 2.2, style: 'wall', pool: true });
  const mu = (U0 + U1) / 2, mv = (V0 + V1) / 2, [ccx, ccz] = at(mu, mv);
  (W.clearings ||= []).push({ x: ccx, z: ccz, r: 0, area: { cx: ccx, cz: ccz, ax: P.ax, az: P.az, hl: (U1 - U0) / 2 + 0.5, hw: (V1 - V0) / 2 + 0.5 } });
  const plan = { ...P, U0, U1, V0, V1, ringUV, ring,
    block: { u0: u0 - 20, u1: u0 - 10.5, v0: v0, v1: v1 - 4 },       // the changing block
    stand: { u0: u0 - 3, u1: u1 + 3, v0: v0 - 3.4, v1: V0 + 0.4 } };
  W.poolPlan = plan;
  return plan;
}

function label(text, { w = 512, h = 128, bg = '#1f4f8a', fg = '#ffffff', px = 64, sub = null } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = FONT(800, px); g.fillText(text, w / 2, sub ? h * 0.4 : h / 2 + 3, w - 30);
    if (sub) { g.font = FONT(600, px * 0.45); g.fillText(sub, w / 2, h * 0.76, w - 30); }
  }, { repeat: false });
}

export function buildPool(game) {
  const W = game.world, plan = W.poolPlan;
  const group = new THREE.Group();
  group.name = 'pool-complex';
  if (!plan) return { group, spots: null, setBoard() {}, update() {} };
  const { at, u0, u1, v0, v1, deckY, ax, az, yawU, lanes, laneV, block: B } = plan;
  const parts = [], planes = [];
  const Y = (x, z) => W.heightAt(x, z);
  // helpers in pool coordinates: boxes are sized (along u, height, along v); boards face +u unless turned
  const faceU = Math.atan2(ax, az), rotUV = Math.atan2(-az, ax);
  const put = (geo, color, u, v, y, rx = 0, ryExtra = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const [x, z] = at(u, v); parts.push({ geometry: geo, color, matrix: m4(x, y, z, rx, rotUV + ryExtra, rz, sx, sy, sz, 'YXZ') }); };
  const board = (tex, u, v, y, w, h, ryExtra = 0, lift = 0) => { const [x, z] = at(u, v); planes.push({ tex, x, y: y + lift, z, w, h, yaw: faceU + ryExtra }); };
  const fences = [];

  // ---------------------------------------------------------------- paving inside the wall (draped on the ground)
  {
    const nu = 100, nv = 48, pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = plan.U0 + ((plan.U1 - plan.U0) * i) / nu, v = plan.V0 + ((plan.V1 - plan.V0) * j) / nv, [x, z] = at(u, v);
      pos.push(x, Y(x, z) + 0.05, z); uv.push(u / 2, v / 2);
    }
    // (not over the pool and its deck)
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const cu = plan.U0 + ((plan.U1 - plan.U0) * (i + 0.5)) / nu, cv = plan.V0 + ((plan.V1 - plan.V0) * (j + 0.5)) / nv;
      if (cu > u0 - 3.4 && cu < u1 + 3.4 && cv > v0 - 3.4 && cv < v1 + 3.4) continue;
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const tex = canvasTexture(128, 128, (c, w, h) => { c.fillStyle = '#cfc8b8'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(90,80,60,0.25)'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2); for (let k = 0; k < 60; k++) { c.fillStyle = `rgba(80,70,50,${Math.random() * 0.08})`; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); } });
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    m.receiveShadow = true; group.add(m);
  }

  // ---------------------------------------------------------------- the changing block
  const bu0 = B.u0, bu1 = B.u1, bv0 = B.v0, bv1 = B.v1, [bcx, bcz] = at((bu0 + bu1) / 2, (bv0 + bv1) / 2);
  const by = Math.max(Y(bcx, bcz), Y(...at(bu1, bv0)), Y(...at(bu1, bv1)), Y(...at(bu0, bv0)), Y(...at(bu0, bv1)), deckY - 0.2);
  const BH = 3.6, bd = bu1 - bu0, bl = bv1 - bv0;
  put(new THREE.BoxGeometry(bd, BH + 1.2, bl), '#eee6d6', (bu0 + bu1) / 2, (bv0 + bv1) / 2, by + (BH - 1.2) / 2);          // walls (down into the slope)
  put(new THREE.BoxGeometry(bd + 0.5, 0.22, bl + 0.5), '#8f2f2a', (bu0 + bu1) / 2, (bv0 + bv1) / 2, by + BH + 0.11);         // roof slab
  put(new THREE.BoxGeometry(bd + 0.1, 0.3, bl + 0.1), '#2f7ab9', (bu0 + bu1) / 2, (bv0 + bv1) / 2, by + BH - 0.45);         // blue band
  // front canopy on columns, along the pool side
  put(new THREE.BoxGeometry(2.6, 0.14, bl), '#d9d2c2', bu1 + 1.3, (bv0 + bv1) / 2, by + 2.9);
  for (let v = bv0 + 0.3; v <= bv1 - 0.2; v += (bl - 0.5) / 6) put(new THREE.CylinderGeometry(0.1, 0.1, 2.9, 10), '#f2f0ea', bu1 + 2.4, v, by + 1.45);
  // rooms, doors and their signs (girls' side at low v, boys' side at high v)
  const rooms = [
    { name: "GIRLS' CHANGING ROOM", v: bv0 + 5, col: '#c2185b', kind: 'change', gender: 'female' },
    { name: 'LADIES TOILET', v: bv0 + 11.5, col: '#c2185b', kind: 'toilet', gender: 'female' },
    { name: 'FIRST AID · LIFEGUARD', v: (bv0 + bv1) / 2 + 0.2, col: '#2e7d32', kind: 'aid' },
    { name: 'GENTS TOILET', v: bv1 - 11.5, col: '#1f4f8a', kind: 'toilet', gender: 'male' },
    { name: "BOYS' CHANGING ROOM", v: bv1 - 5, col: '#1f4f8a', kind: 'change', gender: 'male' },
  ];
  const doorTex = canvasTexture(64, 128, (g, w, h) => { g.fillStyle = '#6b4a2f'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h / 2 - 8); g.strokeRect(6, h / 2 + 4, w - 12, h / 2 - 10); g.fillStyle = '#d9c28a'; g.fillRect(w - 16, h / 2, 6, 10); }, { repeat: false });
  for (const r of rooms) {
    board(doorTex, bu1 + 0.03, r.v, by + 1.1, 1.1, 2.2, Math.PI / 2 * 0 + 0, 0);
    board(label(r.name, { bg: r.col, px: r.name.length > 16 ? 44 : 56 }), bu1 + 0.04, r.v, by + 2.55, 2.6, 0.62);
    // a figure pictogram next to the sign
    if (r.gender) board(label(r.gender === 'female' ? '♀' : '♂', { w: 128, h: 128, bg: r.col, px: 96 }), bu1 + 0.04, r.v + 1.75, by + 2.55, 0.62, 0.62);
    if (r.kind === 'aid') board(label('+', { w: 128, h: 128, bg: '#ffffff', fg: '#c62828', px: 120 }), bu1 + 0.04, r.v + 1.2, by + 2.55, 0.6, 0.6);
    r.at = at(bu1 + 1.0, r.v); r.y = by;
  }
  // frosted high windows
  for (let v = bv0 + 1.5; v < bv1 - 1; v += 3.2) if (!rooms.some((r) => Math.abs(r.v - v) < 1.4)) put(new THREE.BoxGeometry(0.04, 0.45, 1.4), '#cfe3ea', bu1 + 0.02, v, by + 2.35);
  // lockers under the canopy between the doors
  for (const [va, vb] of [[bv0 + 6.2, bv0 + 10.3], [bv1 - 10.3, bv1 - 6.2]]) {
    for (let v = va; v < vb; v += 0.42) { put(new THREE.BoxGeometry(0.45, 1.8, 0.4), '#8a9aa8', bu1 + 0.24, v + 0.2, by + 0.9); put(new THREE.BoxGeometry(0.02, 0.05, 0.12), '#d9dde0', bu1 + 0.47, v + 0.2, by + 1.05); }
  }
  // benches under the canopy
  for (const v of [bv0 + 2.5, bv1 - 2.5, (bv0 + bv1) / 2 - 3, (bv0 + bv1) / 2 + 3.4]) { put(new THREE.BoxGeometry(0.45, 0.06, 1.8), '#8a5a36', bu1 + 1.8, v, by + 0.45); for (const s of [-0.7, 0.7]) put(new THREE.BoxGeometry(0.4, 0.45, 0.06), '#3a3a3a', bu1 + 1.8, v + s, by + 0.22); }
  // the meet's banner on the canopy
  board(label('INTER-HOSTEL AQUATICS MEET', { w: 1024, h: 128, bg: '#7a2630', px: 70, sub: 'IIT GUWAHATI · SWIMMING POOL' }), bu1 + 2.62, (bv0 + bv1) / 2, by + 3.45, 12, 1.5);
  fences.push(...[[bu0, bv0, bu1, bv0], [bu1, bv0, bu1, bv1], [bu1, bv1, bu0, bv1], [bu0, bv1, bu0, bv0]].map(([ua, va, ub, vb]) => { const [ax2, az2] = at(ua, va), [bx2, bz2] = at(ub, vb); return { ax: ax2, az: az2, bx: bx2, bz: bz2, top: by + BH + 0.3 }; }));

  // ---------------------------------------------------------------- rinse showers on the deck
  const showers = [];
  for (const v of [bv0 + 3.2, bv0 + 7, bv1 - 7, bv1 - 3.2]) {
    const u = u0 - 5.2, [x, z] = at(u, v), y = Math.max(Y(x, z), deckY) + 0.02;
    put(new THREE.BoxGeometry(1.1, 0.06, 1.1), '#e8f4f8', u, v, y + 0.03);
    put(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), '#c9cdd2', u - 0.45, v, y + 1.15);
    put(new THREE.BoxGeometry(0.5, 0.05, 0.05), '#c9cdd2', u - 0.22, v, y + 2.28);
    put(new THREE.CylinderGeometry(0.12, 0.06, 0.08, 12), '#b0b5ba', u, v, y + 2.2);
    put(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), '#c62828', u - 0.45, v, y + 1.2, 0, 0, Math.PI / 2);
    showers.push({ x, z, y, u, v });
  }
  board(label('SHOWER BEFORE YOU SWIM', { w: 768, h: 128, bg: '#1f6f8f', px: 60 }), u0 - 5.2, (bv0 + bv1) / 2, deckY + 2.1, 3.2, 0.52, 0, 0);
  { const [x, z] = at(u0 - 5.2, (bv0 + bv1) / 2); for (const s of [-1.5, 1.5]) parts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), color: '#8a8f96', matrix: m4(x - az * s, deckY + 1.15, z + ax * s) }); }

  // ---------------------------------------------------------------- starting blocks, lane numbers, flags, depth marks
  const blocks = [];
  const numTex = [];
  for (let k = 0; k < lanes; k++) {
    const v = laneV(k), u = u0 - 0.55;
    put(new THREE.BoxGeometry(0.55, 0.62, 0.6), '#f4f6f7', u, v, deckY + 0.31);
    put(new THREE.BoxGeometry(0.62, 0.05, 0.64), '#2f7ab9', u + 0.06, v, deckY + 0.66, 0, 0, -0.17);
    numTex.push([k, u + 0.28, v]);
    const [x, z] = at(u, v);
    blocks.push({ x, z, y: deckY + 0.68, lane: k, v });
  }
  for (const [k, u, v] of numTex) board(label(String(k + 1), { w: 128, h: 128, bg: '#1c1c1c', px: 96 }), u + 0.01, v, deckY + 0.32, 0.36, 0.36);
  // backstroke flags 5 m from each end: a line of pennants across the pool
  const penn = [];
  for (const u of [u0 + 5, u1 - 5]) {
    for (const s of [v0 - 1.4, v1 + 1.4]) put(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), '#c9cdd2', u, s, deckY + 1.15);
    put(new THREE.CylinderGeometry(0.008, 0.008, v1 - v0 + 2.8, 4), '#f2f0ea', u, (v0 + v1) / 2, deckY + 2.2, Math.PI / 2, 0, 0);
    for (let v = v0 - 0.9; v <= v1 + 0.9; v += 0.6) penn.push([u, v, penn.length % 3]);
  }
  const PC = ['#c62828', '#f2f0ea', '#1f4fa0'];
  for (const [u, v, c] of penn) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.14, 0, 0, 0.14, 0, -0.32, 0], 3)); g.computeVertexNormals();
    put(g, PC[c], u, v, deckY + 2.2);
  }
  // depth markings on the deck (deep end at the blocks)
  const mark = (t, sub) => label(t, { w: 256, h: 128, bg: '#e8f4f8', fg: '#12436b', px: 70, sub });
  for (const [u, t, sub] of [[u0 - 1.5, '2.0 m', 'DEEP END'], [u1 + 1.5, '1.2 m', 'NO DIVING']]) {
    for (const v of [v0 + 4, v1 - 4]) { const [x, z] = at(u, v); planes.push({ tex: mark(t, sub), x, y: deckY + 0.045, z, w: 1.4, h: 0.7, yaw: faceU + (u > 0 ? Math.PI : 0), flat: true }); }
  }
  // rescue rings on posts along both long sides
  for (const [u, v] of [[-12, v0 - 2.2], [12, v1 + 2.2], [26, v0 - 2.2]]) {
    put(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), '#8a8f96', u, v, deckY + 0.8);
    put(new THREE.TorusGeometry(0.32, 0.07, 8, 20), '#e53935', u, v + (v < 0 ? 0.08 : -0.08), deckY + 1.3);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; put(new THREE.TorusGeometry(0.32, 0.075, 6, 3, 0.35), '#f2f0ea', u, v + (v < 0 ? 0.08 : -0.08), deckY + 1.3, 0, 0, a); }
  }

  // ---------------------------------------------------------------- the stand for spectators (south side)
  const S = plan.stand, fans = [];
  for (const [dv, h] of [[0, 0.45], [1.15, 0.9], [2.3, 1.35]]) {
    const v = S.v0 - dv - 0.55;
    if (v - 0.55 < plan.V0 + 0.3) break;
    const [x, z] = at(0, v), gy = Math.min(Y(x, z), deckY);
    put(new THREE.BoxGeometry(S.u1 - S.u0, h + (deckY - gy) + 0.3, 1.1), '#bdb6a6', 0, v, gy - 0.3 + (h + (deckY - gy) + 0.3) / 2);
    put(new THREE.BoxGeometry(S.u1 - S.u0, 0.06, 0.4), dv === 0 ? '#2f7ab9' : dv > 1 ? '#c62828' : '#f2c12e', 0, v + 0.3, deckY + h + 0.03);
    for (let u = S.u0 + 1; u < S.u1 - 0.5; u += 0.9) { const [fx, fz] = at(u, v + 0.25); fans.push({ x: fx, z: fz, y: deckY + h + 0.05, yaw: Math.atan2(-az, ax) }); }   // facing the pool (+v)
  }
  fences.push(...[[S.u0, S.v0 - 0.1, S.u1, S.v0 - 0.1]].map(([ua, va, ub, vb]) => { const [ax2, az2] = at(ua, va), [bx2, bz2] = at(ub, vb); return { ax: ax2, az: az2, bx: bx2, bz: bz2, top: deckY + 0.5 }; }));

  // ---------------------------------------------------------------- floodlights, the officials' table, plants
  for (const [u, v] of [[plan.U0 + 1, plan.V0 + 1], [plan.U1 - 1, plan.V0 + 1], [plan.U1 - 1, plan.V1 - 1], [u0 - 5, plan.V1 - 1]]) {
    const [x, z] = at(u, v), y = Y(x, z);
    parts.push({ geometry: new THREE.CylinderGeometry(0.1, 0.16, 12, 8), color: '#8a8f96', matrix: m4(x, y + 6, z) });
    parts.push({ geometry: new THREE.BoxGeometry(1.4, 0.8, 0.3), color: '#3a3f44', matrix: m4(x, y + 12, z, -0.5, Math.atan2(plan.cx - x, plan.cz - z), 0, 1, 1, 1, 'YXZ') });
  }
  const tu = u0 - 2.4, tv = v1 + 0.5;
  put(new THREE.BoxGeometry(0.8, 0.05, 1.8), '#f2f0ea', tu, tv, deckY + 0.76);
  for (const s of [-0.8, 0.8]) put(new THREE.BoxGeometry(0.05, 0.75, 0.05), '#8a8f96', tu, tv + s, deckY + 0.38);
  put(new THREE.BoxGeometry(0.3, 0.2, 0.2), '#1c1c1c', tu, tv - 0.4, deckY + 0.88);      // the timing console
  for (const v of [bv0 - 1, bv1 + 1]) { put(new THREE.CylinderGeometry(0.3, 0.24, 0.5, 10), '#c86b3c', bu1 + 2.8, v, by + 0.25); put(new THREE.IcosahedronGeometry(0.42, 1), '#3f7f3a', bu1 + 2.8, v, by + 0.8); }

  // ---------------------------------------------------------------- rules board by the entrance and the scoreboard
  const rulesTex = canvasTexture(512, 640, (g, w, h) => {
    g.fillStyle = '#12436b'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#12436b'; g.fillRect(12, 12, w - 24, 96);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = FONT(800, 44); g.fillText('SWIMMING POOL', w / 2, 62); g.font = FONT(600, 22); g.fillText('IIT GUWAHATI · RULES', w / 2, 94);
    g.fillStyle = '#1c2a3a'; g.textAlign = 'left'; g.font = FONT(600, 25);
    ['Timings: 6 - 9 AM and 4 - 8 PM', 'Swimming costume and cap are a must', 'Shower before you enter the pool', 'Change only in the changing rooms', 'No running on the deck', 'No diving at the shallow end', 'Follow the lifeguard\'s whistle', 'No food or glass near the pool', 'Carry your IITG ID card'].forEach((t, i) => g.fillText(`• ${t}`, 34, 150 + i * 52));
  }, { repeat: false });
  const [rgx, rgz] = at(u0 - 8, plan.V1 - 1.2);
  planes.push({ tex: rulesTex, x: rgx, y: Y(rgx, rgz) + 1.6, z: rgz, w: 1.3, h: 1.62, yaw: Math.atan2(az, -ax) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), color: '#8a8f96', matrix: m4(rgx, Y(rgx, rgz) + 0.6, rgz) });
  const sb = document.createElement('canvas'); sb.width = 1024; sb.height = 560;
  const sbTex = new THREE.CanvasTexture(sb); sbTex.colorSpace = THREE.SRGBColorSpace;
  const drawBoard = (title, lines) => {
    const g = fitText(sb.getContext('2d'));
    g.fillStyle = '#05080c'; g.fillRect(0, 0, 1024, 560);
    g.fillStyle = '#ffcf33'; g.font = FONT(800, 46); g.textAlign = 'center'; g.fillText('IITG AQUATICS · INTER-HOSTEL MEET', 512, 62);
    g.fillStyle = '#59e0ff'; g.font = FONT(700, 34); g.fillText(title, 512, 110);
    g.textAlign = 'left'; g.font = '600 36px "Consolas", "Courier New", monospace';
    lines.forEach((l, i) => { g.fillStyle = i === 0 && /\d/.test(l) ? '#39ff7a' : '#ffffff'; g.fillText(l, 60, 170 + i * 46); });
    sbTex.needsUpdate = true;
  };
  drawBoard('WARM-UP · HEAT 1 AT 4:00 PM', ['LANE  HOSTEL        TIME', ...Array.from({ length: lanes }, (_, k) => `  ${k + 1}   ---`)]);
  { const [x, z] = at(u1 + 4.2, 0), y = Math.max(Y(x, z), deckY);
    for (const s of [-2.6, 2.6]) parts.push({ geometry: new THREE.CylinderGeometry(0.12, 0.12, 5.6, 8), color: '#5a5f64', matrix: m4(x - az * s + ax * 0.3, y + 2.8, z + ax * s + az * 0.3) });
    planes.push({ tex: sbTex, x, y: y + 4.2, z, w: 6.4, h: 3.5, yaw: faceU + Math.PI, basic: true });
    parts.push({ geometry: new THREE.BoxGeometry(0.3, 3.8, 6.8), color: '#1c1c1c', matrix: m4(x + ax * 0.18, y + 4.2, z + az * 0.18, 0, rotUV, 0) });
  }

  // ---------------------------------------------------------------- meshes
  if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  for (const p of planes) {
    const mat = p.basic ? new THREE.MeshBasicMaterial({ map: p.tex, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: p.tex, roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat);
    m.position.set(p.x, p.y, p.z);
    if (p.flat) { m.rotation.set(-Math.PI / 2, 0, 0); m.rotateZ(p.yaw); } else m.rotation.y = p.yaw;
    group.add(m);
  }
  for (const f of fences) W.indexFence?.(f);
  game.scene.add(group);

  // ---------------------------------------------------------------- what you can do here
  const g = game;
  const swimLookFor = (look) => {
    const female = look.body === 'female';
    const suit = female ? '#1f2a44' : '#12436b';
    return { ...look, top: 'tshirt', topColor: female ? suit : look.skin, topColor2: female ? suit : look.skin, bottom: 'shorts', bottomColor: suit, shoes: 'chappal', shoesColor: '#1c1c1c', glasses: 'sunglasses', glassesColor: '#1c1c1c', backpack: false, cap: false, watch: false, hoodie: false };
  };
  for (const r of rooms) {
    const [x, z] = r.at;
    if (r.kind === 'change') g.interact.add({ x, z, r: 2.4, prio: 1.2,
      label: () => (g.swimSaved ? `Change back into your clothes (${r.gender === 'female' ? "girls'" : "boys'"} changing room)` : `Change into swimwear (${r.gender === 'female' ? "girls'" : "boys'"} changing room)`),
      ok: () => ((g.player.avatar.look.body === 'female') === (r.gender === 'female') ? true : `this is the ${r.gender === 'female' ? "girls'" : "boys'"} changing room`),
      run: async () => {
        await g.ui.fade?.(1);
        if (g.swimSaved) { g.player.setLook(g.swimSaved); g.swimSaved = null; g.ui.toast('Back in your clothes. Your things were in the locker.', 'info', 'Changing room'); }
        else { g.swimSaved = { ...g.player.avatar.look }; g.player.setLook(swimLookFor(g.swimSaved)); g.ui.toast('Changed into your swimming costume. Shower first, then the pool is yours!', 'info', 'Changing room'); }
        await new Promise((res) => setTimeout(res, 500));
        await g.ui.fade?.(0);
      } });
    else if (r.kind === 'toilet') g.interact.add({ x, z, r: 2.2, prio: 1.2, label: 'Use the toilet',
      ok: () => ((g.player.avatar.look.body === 'female') === (r.gender === 'female') ? true : `this is the ${r.gender === 'female' ? 'ladies' : 'gents'} toilet`),
      run: async () => { await g.ui.fade?.(1); await new Promise((res) => setTimeout(res, 900)); await g.ui.fade?.(0); g.ui.toast('Washed your hands. All fresh.', 'info', 'Toilet'); } });
    else g.interact.add({ x, z, r: 2.2, prio: 1.0, label: 'First aid & lifeguard room', run: () => g.ui.toast('"Cramps, cuts or a sting? We have ice packs, bandages and a first-aid kit. The lifeguard is on the chair by the deep end."', 'info', 'First aid') });
  }
  const spray = [];
  for (const s of showers) g.interact.add({ x: s.x, z: s.z, r: 1.6, prio: 1.2, label: 'Take a quick shower', run: () => { s.on = 3.5; g.audio.tone?.(180, 0.3, { type: 'sawtooth', gain: 0.01 }); g.ui.toast(g.swimSaved ? 'Rinsed off. Now you can swim!' : 'Brr, cold! (Change into swimwear first if you want to swim.)', 'info', 'Shower'); } });
  // shower water: a few falling drops while a shower runs
  const dropGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.18, 3);
  const drops = new THREE.InstancedMesh(dropGeo, new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.6 }), 160);
  drops.count = 0; drops.frustumCulled = false; group.add(drops);
  const M = new THREE.Matrix4();

  return {
    group, plan, rooms, showers, blocks, fans,
    officials: [at(u0 - 2.0, v1 + 1.3), at(u0 - 2.0, v1 + 0.2)],
    starter: at(u0 - 2.2, v0 - 1.2),
    coach: at(u0 - 3.2, (v0 + v1) / 2),
    warm: Array.from({ length: lanes }, (_, k) => at(u0 - 3.6 - (k % 2) * 1.1, laneV(k))),
    setBoard: drawBoard,
    update(dt, t) {
      let n = 0;
      for (const s of showers) {
        if (!(s.on > 0)) continue;
        s.on -= dt;
        for (let k = 0; k < 40 && n < 160; k++, n++) {
          const ph = (t * 3 + k * 0.137) % 1, ang = k * 2.4, rr = 0.05 + (k % 5) * 0.03;
          M.makeTranslation(s.x + Math.cos(ang) * rr, s.y + 2.15 - ph * 2.1, s.z + Math.sin(ang) * rr);
          drops.setMatrixAt(n, M);
        }
      }
      drops.count = n; if (n) drops.instanceMatrix.needsUpdate = true;
    },
  };
}

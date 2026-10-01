// The front of the Academic Complex as it looks in the photographs: the ground floor stands on a podium, a broad flight of grey stone
// steps climbs to it between low stepped terraces of planters and clipped hedges, a deep concrete portico shelters the glass entrance
// bay (a curtain wall with white mullions), and a white fascia carries the institute's name over the doors. In front of the steps a
// curved raised bed of red brick is full of red flowers, with round hedges along the lawn. Built once, from the entrance of the site.
import * as THREE from 'three';
import { canvasTexture, mergeColored, m4, mulberry32, drawCampusCrest } from '../util.js';
import { facadeOf } from './facade.js';

const RISE = 0.17, TREAD = 0.42, SW = 3.3;                    // each step: 17 cm up, 42 cm deep; half width of the flight
const DEVA = '"Nirmala UI", "Mangal", "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif';

/** raise the ground floor of the main block to the podium level (before the buildings are built): returns the podium height above the
 *  ground in front of it */
export function raiseAcademicFloor(world) {
  const ac = world.site('academic');
  if (!ac) return 0;
  const b = ac.blocks.reduce((m, q) => (q.area > m.area ? q : m), ac.blocks[0]);
  const gF = Math.max(world.heightAt(ac.ex + ac.nx * 8, ac.ez + ac.nz * 8), world.heightAt(ac.ex + ac.nx * 14, ac.ez + ac.nz * 14));
  b.floor0 = Math.max(b.floor0, gF + 13 * RISE);
  ac.podium = b.floor0;
  return b.floor0 - gF;
}

export function buildAcademicFront(game) {
  const W = game.world, G = game.graph, ac = W.site('academic');
  if (!ac || ac.podium == null) return null;
  const group = new THREE.Group(); group.name = 'academic-front';
  const r = mulberry32(4242), parts = [];
  const f = facadeOf(ac, 20, { off: 0 });
  const cx = ac.ex - ac.nx * 0.0, cz = ac.ez - ac.nz * 0.0;
  const tx = f.tx, tz = f.tz, nx = f.nx, nz = f.nz, yaw = Math.atan2(nx, nz);
  // the wall point nearest the entrance is the origin: u runs along the wall, v out of it
  const o = { x: f.x - nx * 0.0, z: f.z - nz * 0.0 };
  const at = (u, v) => [o.x + tx * u + nx * v, o.z + tz * u + nz * v];
  const yT = ac.podium, yG = Math.min(W.heightAt(...at(0, 12)), W.heightAt(...at(0, 15)));
  const box = (u, v, w, d, y0, y1, color, ry = 0) => { const [x, z] = at(u, v); parts.push({ geometry: new THREE.BoxGeometry(w, y1 - y0, d), color, matrix: m4(x, (y0 + y1) / 2, z, 0, yaw + ry, 0) }); };
  const solid = (u, v, rr) => { const [x, z] = at(u, v); W.addSolid(x, z, rr, 'acfront', true); };
  const STONE = '#cbbfa6', STONE2 = '#b9ad94', CONC = '#d9d3c5', BRICK = '#a8472b', HEDGE = '#2f6a2a';
  const base = yG - 1.2;

  // ---- the podium in front of the wall: u -9..9, v -2..5.5, its top at the ground-floor level; a low parapet round it except at the steps
  box(0, 1.75, 12.8, 7.5, base, yT, STONE);
  { const [px, pz] = at(0, 1.75); W.addSurface({ kind: 'box', x: px, z: pz, hx: 6.5, hz: 3.75, yaw, top: yT }); }
  box(0, 5.5, 12.7, 0.08, yT, yT + 0.04, STONE2);
  for (const s of [-1, 1]) { box(s * 6.4, 1.75, 0.35, 7.5, yT, yT + 0.6, STONE2); for (const [a, b2] of [[SW + 0.6, 6.3]]) box(s * (a + b2) / 2, 5.45, b2 - a, 0.3, yT, yT + 0.6, STONE2); }
  // ---- the steps: 13 treads of grey stone, with a landing half way and cheek walls with a rail
  let v = 5.5, ytop = yT;
  const steps = [];
  for (let j = 1; j <= 13; j++) {
    if (j === 7) { ytop -= 0; v += 1.1; box(0, v - 0.55, SW * 2, 1.1, base, ytop - 0.0, STONE); const [lx, lz] = at(0, v - 0.55); W.addSurface({ kind: 'box', x: lx, z: lz, hx: SW, hz: 0.55, yaw, top: ytop }); }
    ytop -= RISE; v += TREAD;
    box(0, v - TREAD / 2, SW * 2, TREAD + 0.02, base, ytop, j % 2 ? '#c4c0b6' : '#b8b4aa');
    box(0, v - TREAD + 0.01, SW * 2, 0.04, ytop - 0.02, ytop, '#ddd9cf');                              // the lighter nosing
    const [sx, sz] = at(0, v - TREAD / 2); W.addSurface({ kind: 'box', x: sx, z: sz, hx: SW, hz: TREAD / 2 + 0.01, yaw, top: ytop });
    steps.push({ v, ytop });
    for (const s of [-1, 1]) box(s * (SW + 0.17), v - TREAD / 2, 0.34, TREAD + 0.02, base, ytop + 0.95, STONE2);          // the cheek walls
  }
  const vEnd = v;
  for (const s of [-1, 1]) { box(s * (SW + 0.17), 5.5 + (vEnd - 5.5) / 2, 0.42, vEnd - 5.5 + 0.2, yT + 0.95, yT + 1.05, STONE); for (let k = 0; k <= 6; k++) { const vv = 5.5 + k * (vEnd - 5.5) / 6; box(s * (SW + 0.17), vv, 0.08, 0.08, steps[Math.min(12, Math.round(k * 2))].ytop + 0.95, steps[Math.min(12, Math.round(k * 2))].ytop + 1.3, '#4a4f55'); } }
  // ---- stepped terraces of planters either side of the flight: a brick-edged bed on each level, clipped hedges and red and orange flowers
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const u0 = s * (SW + 0.4), v0 = 5.9 + k * 3.35, y1 = yT - 0.35 - k * 0.55;
      box(u0 + s * 1.65, v0 + 1.5, 3.5, 3.2, base, y1, STONE2);                                                     // the terrace wall
      box(u0 + s * 1.65, v0 + 1.5, 3.1, 2.8, y1, y1 + 0.18, '#4a2f1c');                                             // the soil
      solid(u0 + s * 1.65, v0 + 1.5, 1.9);
      for (let q = 0; q < 3; q++) { const [hx, hz] = at(u0 + s * (0.55 + q * 0.85), v0 + 0.3); parts.push({ geometry: new THREE.IcosahedronGeometry(0.42, 1), color: q % 2 ? '#2f6a2a' : '#3c7d30', matrix: m4(hx, y1 + 0.5, hz, 0, 0, 0, 1, 0.85, 1) }); }   // clipped round hedges
      for (let q = 0; q < 18; q++) { const [fx, fz] = at(u0 + s * (0.3 + r() * 2.7), v0 + 0.9 + r() * 2.3); parts.push({ geometry: new THREE.IcosahedronGeometry(0.1 + r() * 0.05, 0), color: ['#d6281f', '#e8452a', '#f08a1c', '#f4c21f'][Math.floor(r() * 4)], matrix: m4(fx, y1 + 0.34 + r() * 0.2, fz) }); }
    }
  }
  // ---- the portico: a deep concrete slab on two rows of square columns over the platform and the top of the steps
  box(0, 2.6, 12.8, 8.6, yT + 4.35, yT + 4.95, CONC);
  box(0, 6.85, 12.8, 0.3, yT + 3.9, yT + 4.95, '#cfc8b8');
  for (const u of [-5.8, -2.9, 0, 2.9, 5.8]) { box(u, 6.5, 0.7, 0.7, yT, yT + 4.35, CONC); solid(u, 6.5, 0.45); }
  for (const u of [-5.8, 5.8]) box(u, 0.6, 0.7, 0.7, yT, yT + 4.35, CONC);
  for (let k = 0; k < 7; k++) { const [lx, lz] = at(-5.4 + k * 1.8, 6.0); parts.push({ geometry: new THREE.CylinderGeometry(0.14, 0.14, 0.06, 10), color: '#fff2c4', matrix: m4(lx, yT + 4.32, lz) }); }   // downlights
  // ---- the curved brick flower bed in front of the steps, full of red flowers, and the round hedges
  {
    const cv = vEnd + 9, R = 11, a0 = -0.95, a1 = 0.95;                    // an arc of the circle round (0, cv + R) facing the steps
    let nb = 0;
    for (let k = 0; k < 40; k++) {
      const a = a0 + (a1 - a0) * (k / 39), u = Math.sin(a) * R, vv = cv + R - Math.cos(a) * R + 0.0;
      const [bx, bz] = at(u, vv), gy = W.heightAt(bx, bz);
      if (W.buildingAt(bx, bz) || W.waterAt(bx, bz) || G.onRoad(bx, bz, 1.2)) continue;
      parts.push({ geometry: new THREE.BoxGeometry(2.2 * R * (a1 - a0) / 39 + 0.2, 0.95, 0.48), color: BRICK, matrix: m4(bx, gy + 0.4, bz, 0, yaw + a, 0) });
      parts.push({ geometry: new THREE.BoxGeometry(2.2 * R * (a1 - a0) / 39 + 0.22, 0.08, 0.6), color: '#c9b49a', matrix: m4(bx, gy + 0.9, bz, 0, yaw + a, 0) });
      const [ix, iz] = at(u * 0.9, vv - 1.1 * Math.cos(a)), iy = W.heightAt(ix, iz);
      for (let q = 0; q < 9; q++) { const [fx, fz] = at(u * (0.86 + r() * 0.08) + (r() - 0.5) * 1.2, vv - (0.4 + r() * 2.6) * Math.cos(a)); const fy = W.heightAt(fx, fz); parts.push({ geometry: new THREE.IcosahedronGeometry(0.16 + r() * 0.1, 0), color: r() < 0.82 ? ['#d6281f', '#e03a2a', '#c4201a'][q % 3] : '#2f6a2a', matrix: m4(fx, fy + 0.85 + r() * 0.3, fz) }); nb++; }
      void iy;
    }
    for (let k = -4; k <= 4; k++) {                                         // round clipped hedges along the front of the lawn
      const [hx, hz] = at(k * 4.2, vEnd + 3.2), hy = W.heightAt(hx, hz);
      if (W.buildingAt(hx, hz) || G.onRoad(hx, hz, 1.2) || Math.abs(k) < 2) continue;
      parts.push({ geometry: new THREE.IcosahedronGeometry(0.62, 1), color: HEDGE, matrix: m4(hx, hy + 0.5, hz, 0, 0, 0, 1, 0.85, 1) });
    }
    void nb;
  }
  const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  // ---- the glass entrance bay (a curtain wall: dark glass, white mullions, the doors at the bottom) over the wall, under the portico
  const glass = canvasTexture(1024, 384, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2b4a58'); gr.addColorStop(0.5, '#41697a'); gr.addColorStop(1, '#27424f'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(w * 0.1, 0); g.lineTo(w * 0.3, 0); g.lineTo(w * 0.1, h); g.lineTo(-w * 0.1, h); g.fill(); g.beginPath(); g.moveTo(w * 0.6, 0); g.lineTo(w * 0.7, 0); g.lineTo(w * 0.5, h); g.lineTo(w * 0.4, h); g.fill();
    g.strokeStyle = '#f2f0ea'; g.lineWidth = 7;
    for (let k = 0; k <= 10; k++) { g.beginPath(); g.moveTo((k * w) / 10, 0); g.lineTo((k * w) / 10, h); g.stroke(); }
    for (const y of [0, h * 0.34, h * 0.67, h]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#1a2a32'; g.fillRect(w * 0.4, h * 0.67, w * 0.2, h * 0.33);                                      // the doors
    g.strokeStyle = '#f2f0ea'; g.lineWidth = 5; g.strokeRect(w * 0.4, h * 0.67, w * 0.2, h * 0.33); g.beginPath(); g.moveTo(w * 0.5, h * 0.67); g.lineTo(w * 0.5, h); g.stroke();
  }, { repeat: false });
  const gp = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 6.8), new THREE.MeshStandardMaterial({ map: glass, roughness: 0.25, metalness: 0.3, emissive: 0x0b1a22, emissiveMap: glass, emissiveIntensity: 0.25 }));
  { const [gx, gz] = at(0, 0.1); gp.position.set(gx, yT + 3.4, gz); gp.rotation.y = yaw; group.add(gp); }
  // ---- the fascia over the doors: white, the name in Hindi and English, the year and the crest
  const fascia = canvasTexture(1280, 256, (g, w, h) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8d3c6'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    drawCampusCrest(g, 92, h / 2, 70);                                                                               // an original crest, not the official logo
    g.fillStyle = '#4a1f1f'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 66px ' + DEVA; g.fillText('भारतीय प्रौद्योगिकी संस्थान गुवाहाटी', w / 2 + 80, 82, w - 250);
    g.font = '800 56px "Hind", "Segoe UI", sans-serif'; g.fillText('INDIAN INSTITUTE OF TECHNOLOGY GUWAHATI', w / 2 + 80, 152, w - 250);
    g.font = '600 26px "Hind", sans-serif'; g.fillText('ESTD. 1994', w / 2 + 80, 220);
  }, { repeat: false });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 1.92), new THREE.MeshStandardMaterial({ map: fascia, roughness: 0.6 }));
  { const [fx, fz] = at(0, 0.14); fp.position.set(fx, yT + 7.95, fz); fp.rotation.y = yaw; group.add(fp); }
  game.scene.add(group);
  return { group, yT, vEnd };
}

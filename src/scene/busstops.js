// The campus bus stands (8, where the master plan marks them): a shelter by the road with a bench,
// a timetable board and a "BUS STOP" sign; people wait there in the day, and the campus shuttles
// (traffic.js) pull up at them.
import * as THREE from 'three';
import { mergeColored, m4, mulberry32, canvasTexture } from '../util.js';
import { FILTERS } from '../route.js';
import { AN } from '../crowd/people.js';
import { studentLook, adultLook, OPT, bit } from '../crowd/looks.js';
import { PLAN } from '../plan_data.js';
import { lakeCircle } from './lakecircle.js';

/** where the stands go: by the nearest bus road, on the side the plan marks them (worked out before
 *  the trees are planted, so none grows through a shelter) */
export function planBusStands(W, G) {
  const out = [];
  const pts = PLAN.busStands.map(([mx, my]) => [mx, -my]);
  const lc = lakeCircle(W, G);                    // and a stand at the circle by the IITG Lake
  if (lc) pts.push([lc.x + lc.lx * 16 + lc.px * 7, lc.z + lc.lz * 16 + lc.pz * 7]);
  for (const [x0, z0] of pts) {
    // the nearest road the buses use (a full search: the stand can be 50 m from the road centre)
    let rd = G.roadAt(x0, z0, 60, FILTERS.car);
    if (!rd) { const n = G.nearestOnNetwork(x0, z0, FILTERS.car); if (n && n.d < 70) rd = G.roadAt(n.x, n.z, 5, FILTERS.car); }
    if (!rd) continue;
    let nx = -rd.tz, nz = rd.tx;
    if ((x0 - rd.x) * nx + (z0 - rd.z) * nz < 0) { nx = -nx; nz = -nz; }
    const off = rd.hw + 2.4;
    const ok = (x, z) => !W.buildingAt(x, z) && !W.waterAt(x, z) && W.insideCampus(x, z) && !G.onRoad(x, z, 0.8) && G.wayClearance(x, z, 2.2, true) > 1.4;
    let x = rd.x + nx * off, z = rd.z + nz * off;
    if (!ok(x, z)) { nx = -nx; nz = -nz; x = rd.x + nx * off; z = rd.z + nz * off; if (!ok(x, z)) continue; }
    out.push({ x, z, rx: rd.x, rz: rd.z, nx, nz, yaw: Math.atan2(-nx, -nz) });
  }
  return out;
}

export function buildBusStops(game, spots = planBusStands(game.world, game.graph)) {
  const W = game.world;
  const group = new THREE.Group();
  group.name = 'bus-stands';
  const parts = [], boards = [];
  const stops = [];
  const tour = game.busTour?.shelterPos || [];
  for (const sp of spots) {
    const { x, z, nx, nz } = sp;
    if (tour.some((s) => Math.hypot(s.x - x, s.z - z) < 25)) { stops.push({ ...sp, shared: true }); continue; }
    const yaw = Math.atan2(-nx, -nz);                      // the shelter faces the road
    const y = W.heightAt(x, z);
    W.placer?.reserveBox(x, z, yaw, 2.4, 1.4, 'busstop');
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const M = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const put = (geo, color, lx, ly, lz, rx = 0) => { const [px, py, pz] = M(lx, ly, lz); parts.push({ geometry: geo, color, matrix: m4(px, py, pz, rx, yaw, 0) }); };
    put(new THREE.BoxGeometry(4.6, 0.9, 2.2), '#b9b3a6', 0, -0.34, -0.3);                 // plinth (reaches into the slope)
    for (const q of [-2.1, 2.1]) { put(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 8), '#dfe3e6', q, 1.35, 0.55); put(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 8), '#dfe3e6', q, 1.35, -1.25); }
    put(new THREE.BoxGeometry(4.9, 0.08, 2.5), '#1f5f8f', 0, 2.72, -0.35, 0.08);           // roof, sloping back
    put(new THREE.BoxGeometry(4.3, 1.6, 0.05), '#cfe0ea', 0, 1.45, -1.28);                 // back glass
    put(new THREE.BoxGeometry(3.6, 0.06, 0.45), '#6b5a44', 0, 0.48, -0.9);                 // bench
    for (const q of [-1.5, 0, 1.5]) put(new THREE.BoxGeometry(0.06, 0.45, 0.4), '#3a3a3a', q, 0.24, -0.9);
    put(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6), '#8a8f96', 2.9, 1.4, 0.9);         // sign pole
    const [bx, by, bz] = M(-0.9, 1.45, -1.24);
    boards.push({ x: bx, y: by, z: bz, yaw, w: 1.2, h: 1.3, kind: 'timetable' });
    const [sx, sy, sz] = M(2.9, 2.75, 0.93);
    boards.push({ x: sx, y: sy, z: sz, yaw, w: 0.62, h: 0.62, kind: 'sign' });
    const [hx, hy, hz] = M(0, 2.45, 0.66);
    boards.push({ x: hx, y: hy, z: hz, yaw, w: 2.8, h: 0.34, kind: 'header' });
    stops.push({ ...sp });
  }
  if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  // signs and timetable (one small texture each kind)
  const tex = {
    header: canvasTexture(512, 64, (g, w, h) => { g.fillStyle = '#1f5f8f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '800 38px "Hind", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('IITG  BUS  STOP', w / 2, h / 2 + 2); }, { repeat: false }),
    sign: canvasTexture(128, 128, (g, w, h) => { g.fillStyle = '#1f5f8f'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fill(); g.fillStyle = '#1f5f8f'; g.font = '900 34px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BUS', 64, 66); }, { repeat: false }),
    timetable: canvasTexture(256, 280, (g, w, h) => {
      g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f5f8f'; g.fillRect(0, 0, w, 44);
      g.fillStyle = '#fff'; g.font = '800 24px "Hind", sans-serif'; g.textAlign = 'center'; g.fillText('CAMPUS BUS', w / 2, 30);
      g.fillStyle = '#222'; g.textAlign = 'left'; g.font = '600 17px "Hind", sans-serif';
      ['Every 20 minutes', '7:00 AM - 10:00 PM', '', 'Main Gate · Market', 'Academic Complex', 'Hostels · Food Court', 'Hospital · Guest House', '', 'Free for students'].forEach((t, i) => g.fillText(t, 16, 74 + i * 22));
    }, { repeat: false }),
  };
  const mats = Object.fromEntries(Object.entries(tex).map(([k, t]) => [k, new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, side: THREE.DoubleSide })]));
  for (const b of boards) { const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), mats[b.kind]); m.position.set(b.x, b.y, b.z); m.rotation.y = b.yaw; group.add(m); }
  // a few people waiting in the day
  const r = mulberry32(8080);
  // (the shelter stands on a plinth 11 cm above the ground, and its bench is 51 cm above the ground: a sitter's hips are 55 cm above
  // their feet in the seated pose, so sitters are lowered to put the hips on the seat; those standing stand ON the plinth)
  const PLINTH = 0.11, SEAT = 0.51 - 0.05 - 0.55 + 0.55;      // seat height 0.46 above the plinth floor... see below
  const waiting = stops.filter((s) => !s.shared).map((s, i) => Array.from({ length: 1 + (i % 3) }, (_, k) => {
    const sit = k === 0 || (k === 1 && i % 2 === 1);          // one or two sit on the bench, side by side; the rest stand in front of it
    const lx = sit ? -1.15 + k * 1.05 : -0.5 + k * 1.0, lz = sit ? -0.98 : 0.05, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    const x = s.x + lx * c + lz * sn, z = s.z - lx * sn + lz * c, g0 = W.heightAt(x, z);
    void SEAT;
    return { x, z, y: g0 + (sit ? 0.51 - 0.47 : PLINTH), yaw: s.yaw, anim: sit ? AN.SIT : k === 1 ? AN.PHONE : AN.STAND, phase: r() * 6, speed: 0, extra: 0, look: k === 2 ? adultLook(r, 'parent') : studentLook(r), th: r() };
  }));
  game.scene.add(group);
  return {
    group, stops,
    draw(crowd) {
      if (game.interior?.active) return;
      const h = game.clock.hour, busy = h > 7 && h < 21.5 ? (h > 8 && h < 10 || h > 16.5 && h < 19 ? 1 : 0.55) : 0;
      if (!busy || game.weather.state.rain > 0.5) return;
      const cam = game.camera.position;
      for (const grp of waiting) for (const p of grp) if (p.th < busy && Math.hypot(p.x - cam.x, p.z - cam.z) < 170) crowd.push(p.anim === AN.PHONE ? { ...p, opts: p.look.opts | bit(OPT.PHONE) } : p);
    },
  };
}

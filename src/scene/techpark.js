// Two places between the Technology Incubation Centre and the old east cricket ground:
//   the Technology Park: the cricket ground is gone, research buildings stand round a paved plaza with flower beds, a
//     steel sculpture, benches, lamps and a name wall (the buildings themselves come from the map data, tools/process_data.py)
//   the IITG Bus Stop: the terminus every campus bus starts from: a gantry over the stand road, a covered platform with
//     bays 1 - 4, buses standing in them, benches, a timetable, an enquiry counter, and people waiting
import * as THREE from 'three';
import { mergeColored, m4, mulberry32, canvasTexture } from '../util.js';
import { makeBus } from '../models.js';
import { AN } from '../crowd/people.js';
import { studentLook, adultLook, OPT, bit } from '../crowd/looks.js';

/** a flat mesh laid on the ground (a draped grid), `lift` above it */
function laid(W, cx, cz, w, d, yaw, lift, mat, n = 12) {
  const g = new THREE.PlaneGeometry(w, d, n, Math.max(2, Math.round((n * d) / w))).rotateX(-Math.PI / 2);
  const pa = g.attributes.position, c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < pa.count; i++) { const lx = pa.getX(i), lz = pa.getZ(i), x = cx + lx * c + lz * s, z = cz - lx * s + lz * c; pa.setXYZ(i, x, W.heightAt(x, z) + lift, z); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
const tile = (a, b) => { const t = canvasTexture(128, 128, (c, w, h) => { c.fillStyle = a; c.fillRect(0, 0, w, h); c.strokeStyle = b; c.lineWidth = 2; for (let k = 0; k <= 4; k++) { c.beginPath(); c.moveTo(0, k * 32); c.lineTo(w, k * 32); c.moveTo(k * 32, 0); c.lineTo(k * 32, h); c.stroke(); } for (let k = 0; k < 400; k++) { c.fillStyle = 'rgba(0,0,0,0.03)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

export function buildTechPark(game) {
  const W = game.world, group = new THREE.Group(); group.name = 'techpark';
  const site = W.landmark('techpark');
  if (!site) return { group };
  const parts = [], P = (geo, color, x, y, z, ry = 0) => parts.push({ geometry: geo, color, matrix: m4(x, y, z, 0, ry, 0) });
  // the plaza is between the main building (north side of the park) and the labs: centred on the gap
  const cx = site.wx, cz = site.wz - 26;                         // map y grows north, world z = -y: the plaza lies towards the labs
  const PW = 86, PD = 24;
  const t = tile('#d8d2c2', '#b9b2a0'); t.repeat.set(PW / 4, PD / 4);
  group.add(laid(W, cx, cz, PW, PD, 0, 0.05, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })));
  W.addSolid(cx, cz, 0.01, 'plaza', false);
  // flower beds along both long sides, in raised brick borders
  const cols = ['#e0317a', '#f2c12e', '#ff7a1a', '#f4f1ea', '#b04bd6'];
  for (const sd of [-1, 1]) for (let k = -3; k <= 3; k++) {
    const bx = cx + k * 11.5, bz = cz + sd * (PD / 2 - 2.2), y = W.heightAt(bx, bz);
    P(new THREE.BoxGeometry(8, 0.35, 2.2), '#b87e5a', bx, y + 0.17, bz);
    P(new THREE.BoxGeometry(7.4, 0.12, 1.7), '#4f3a26', bx, y + 0.4, bz);
    for (let f = 0; f < 14; f++) { const fx = bx + ((f * 7) % 13 - 6) * 0.55, fz = bz + ((f * 5) % 5 - 2) * 0.3; P(new THREE.IcosahedronGeometry(0.2, 0), cols[(f + k + 9) % cols.length], fx, y + 0.6, fz); }
    if (k % 2 === 0) { P(new THREE.CylinderGeometry(0.1, 0.14, 2.6, 6), '#6b4a2f', bx, y + 1.5, bz); P(new THREE.IcosahedronGeometry(1.2, 1), '#3f8a34', bx, y + 3.3, bz); }
    W.addSolid(bx, bz, 1.4, 'flowerbed', false);
  }
  // the sculpture at the middle: a spiral of steel rings on a round plinth, with a lit ring on top
  { const y = W.heightAt(cx, cz);
    P(new THREE.CylinderGeometry(2.6, 2.8, 0.5, 20), '#b9b2a0', cx, y + 0.25, cz);
    P(new THREE.CylinderGeometry(2.3, 2.3, 0.1, 20), '#3b6f8f', cx, y + 0.55, cz);
    for (let k = 0; k < 7; k++) parts.push({ geometry: new THREE.TorusGeometry(0.6 + k * 0.11, 0.06, 6, 20), color: k % 2 ? '#c9ced3' : '#8fb4c8', matrix: m4(cx + Math.sin(k * 0.9) * 0.3, y + 1.0 + k * 0.72, cz + Math.cos(k * 0.9) * 0.3, Math.PI / 2 + Math.sin(k) * 0.25, k * 0.5, 0) });
    P(new THREE.CylinderGeometry(0.05, 0.05, 6.0, 6), '#9aa3aa', cx, y + 3.3, cz);
    W.addSolid(cx, cz, 2.9, 'sculpture', true); }
  // benches (two rows), lamp posts
  for (let k = -3; k <= 3; k++) for (const sd of [-1, 1]) {
    if (Math.abs(k) < 1) continue;
    const bx = cx + k * 11.5 + 5.6, bz = cz + sd * 3.8, y = W.heightAt(bx, bz);
    P(new THREE.BoxGeometry(1.8, 0.1, 0.5), '#6b4a2f', bx, y + 0.45, bz); P(new THREE.BoxGeometry(1.8, 0.5, 0.08), '#6b4a2f', bx, y + 0.7, bz - sd * 0.22);
    for (const dx of [-0.75, 0.75]) P(new THREE.BoxGeometry(0.08, 0.45, 0.45), '#2b2f33', bx + dx, y + 0.22, bz);
    W.addSolid(bx, bz, 0.6, 'bench', false);
  }
  for (let k = -3; k <= 3; k++) { const lx = cx + k * 11.5 + 5.7, lz = cz, y = W.heightAt(lx, lz); P(new THREE.CylinderGeometry(0.06, 0.09, 4.4, 8), '#3a3f44', lx, y + 2.2, lz); P(new THREE.BoxGeometry(0.5, 0.12, 0.3), '#fff2c4', lx, y + 4.4, lz); W.addSolid(lx, lz, 0.2, 'lamp', true); }
  // the name wall at the plaza's south end, facing the bus stop
  { const wx = site.wx, wz = site.wz + 14.5, y = W.heightAt(wx, wz);                 // south of the main building, facing the bus stop
    P(new THREE.BoxGeometry(9, 2.2, 0.5), '#3b4a5a', wx, y + 1.1, wz); P(new THREE.BoxGeometry(9.4, 0.25, 0.7), '#c9ced3', wx, y + 2.3, wz);
    const tex = canvasTexture(1024, 256, (c, w, h) => { c.fillStyle = '#26333f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#6fb6d6'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff'; c.font = '800 96px "Hind", "Segoe UI", sans-serif'; c.fillText('TECHNOLOGY PARK', w / 2, h * 0.4, w - 60); c.fillStyle = '#9fd3ea'; c.font = '600 48px "Hind", "Segoe UI", sans-serif'; c.fillText('IIT Guwahati · start-ups · research · industry', w / 2, h * 0.78, w - 60); }, { repeat: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 }));
    m.position.set(wx, y + 1.15, wz + 0.27); m.rotation.y = 0; group.add(m);
    const m2 = m.clone(); m2.position.z = wz - 0.27; m2.rotation.y = Math.PI; group.add(m2);
    W.addSolid(wx, wz, 4.6, 'namewall', true); }
  const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15 }));
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  return { group, plaza: { x: cx, z: cz, w: PW, d: PD } };
}

export function buildBusTerminus(game) {
  const W = game.world, G = game.graph, group = new THREE.Group(); group.name = 'bus-terminus';
  const lm = W.landmark('busstop');
  if (!lm) return { group, buses: [], draw() {} };
  const r = mulberry32(9090);
  const parts = [], P = (geo, color, x, y, z, ry = 0) => parts.push({ geometry: geo, color, matrix: m4(x, y, z, 0, ry, 0) });
  const X0 = lm.wx, Z0 = lm.wz;                                     // the middle of the stand road, running east - west
  const gy = (x, z) => W.heightAt(x, z);
  // the stand road is the graph's own: find it so the platform sits beside it
  const rd = G.roadAt(X0, Z0, 12, (e) => !e.foot);
  const side = -1;                                                  // the platform on the north side (world -z), away from the ring road
  // the tarmac apron: two bays wide, laid on the ground
  const asph = new THREE.MeshStandardMaterial({ color: 0x3f4144, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3.2, polygonOffsetUnits: -3.2 });
  group.add(laid(W, X0, Z0 + side * 5.0, 86, 16, 0, 0.03, asph, 30));
  // ---- the covered platform: a steel frame, a blue roof with a light strip, four bay numbers
  const PZ = Z0 + side * 12.6, PX0 = X0 - 40, PX1 = X0 + 34, PLEN = PX1 - PX0;
  const tiles = tile('#c9c4b6', '#a9a393'); tiles.repeat.set(PLEN / 4, 2);
  group.add(laid(W, (PX0 + PX1) / 2, PZ, PLEN, 7, 0, 0.12, new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.9 }), 30));
  const pgy = (x) => gy(x, PZ);
  for (let k = 0; k <= 10; k++) { const x = PX0 + (PLEN * k) / 10; P(new THREE.CylinderGeometry(0.1, 0.1, 4.4, 8), '#d9dde0', x, pgy(x) + 2.3, PZ + 2.9); P(new THREE.CylinderGeometry(0.1, 0.1, 4.4, 8), '#d9dde0', x, pgy(x) + 2.3, PZ - 2.9); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(PLEN + 1.4, 0.16, 8.4), new THREE.MeshStandardMaterial({ color: 0x1f5f8f, roughness: 0.6, metalness: 0.2 }));
  roof.position.set((PX0 + PX1) / 2, pgy((PX0 + PX1) / 2) + 4.55, PZ); roof.rotation.x = -0.05 * side; roof.castShadow = true; group.add(roof);
  P(new THREE.BoxGeometry(PLEN + 1.4, 0.35, 0.12), '#f2c12e', (PX0 + PX1) / 2, pgy((PX0 + PX1) / 2) + 4.35, PZ - side * -4.25);
  for (let k = 0; k < 6; k++) P(new THREE.BoxGeometry(0.3, 0.05, 1.0), '#fff9e0', PX0 + 6 + k * 12.3, pgy(PX0 + 6 + k * 12.3) + 4.4, PZ);
  // rows of seats under the roof, a steel bin, a drinking-water cooler, a timetable wall at the back
  for (let k = 0; k < 7; k++) { const x = PX0 + 4 + k * 10; P(new THREE.BoxGeometry(3.2, 0.08, 0.55), '#3f78c4', x, pgy(x) + 0.5, PZ + side * 0.4); P(new THREE.BoxGeometry(3.2, 0.5, 0.08), '#3f78c4', x, pgy(x) + 0.78, PZ + side * 0.68); for (const dx of [-1.4, 0, 1.4]) P(new THREE.BoxGeometry(0.08, 0.45, 0.5), '#2b2f33', x + dx, pgy(x) + 0.25, PZ + side * 0.4); W.addSolid(x, PZ + side * 0.4, 1.0, 'bench', false); }
  // bay posts: a yellow pole with a number and the route of the bay
  const bays = [{ n: 1, route: 'Main Gate · Market', col: '#c62828' }, { n: 2, route: 'Hostels · Food Court', col: '#2e7d4f' }, { n: 3, route: 'Academic Complex · Library', col: '#1f5f8f' }, { n: 4, route: 'Hospital · Guest House', col: '#8a4a1f' }];
  const bayX = bays.map((_, i) => X0 - 32 + i * 18);
  const bayTex = (b) => canvasTexture(256, 320, (c, w, h) => { c.fillStyle = '#10232f'; c.fillRect(0, 0, w, h); c.fillStyle = b.col; c.beginPath(); c.arc(w / 2, 92, 66, 0, 7); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 100px "Hind", "Segoe UI", sans-serif'; c.fillText(String(b.n), w / 2, 98); c.font = '700 28px "Hind", "Segoe UI", sans-serif'; c.fillStyle = '#f2c12e'; c.fillText('BAY', w / 2, 184); c.fillStyle = '#e6e0cf'; c.font = '600 26px "Hind", "Segoe UI", sans-serif'; const words = b.route.split(' · '); words.forEach((t, i) => c.fillText(t, w / 2, 232 + i * 32, w - 20)); }, { repeat: false });
  bays.forEach((b, i) => {
    const x = bayX[i] + 7, z = PZ - side * 3.2, y = gy(x, z);
    P(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), '#f2c12e', x, y + 1.7, z);
    // two planes back to back: each reads the right way round from its own side (one double-sided plane shows mirrored writing from behind)
    const bm = new THREE.MeshStandardMaterial({ map: bayTex(b), roughness: 0.6 }), bp = new THREE.PlaneGeometry(0.9, 1.125);
    for (const sd2 of [1, -1]) { const m = new THREE.Mesh(bp, bm); m.position.set(x, y + 3.2, z + sd2 * 0.04); m.rotation.y = sd2 > 0 ? 0 : Math.PI; group.add(m); }
    P(new THREE.BoxGeometry(0.96, 1.2, 0.06), '#10232f', x, y + 3.2, z);
    // a yellow line across the platform edge
    P(new THREE.BoxGeometry(14, 0.02, 0.15), '#f2c12e', bayX[i], y + 0.14, PZ - side * 3.45);
  });
  // the enquiry counter at the west end: a small cream building with a green roof, ticket window and a clock
  { const ex = PX0 - 4.5, ez = PZ, y = gy(ex, ez);
    P(new THREE.BoxGeometry(4.2, 3.0, 5.0), '#ece6d6', ex, y + 1.5, ez);
    P(new THREE.BoxGeometry(5.0, 0.18, 5.8), '#2f6f4a', ex, y + 3.1, ez);
    P(new THREE.BoxGeometry(0.06, 1.0, 1.6), '#23282c', ex + 2.13, y + 1.6, ez);
    const tex = canvasTexture(512, 128, (c, w, h) => { c.fillStyle = '#1f5f8f'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 54px "Hind", "Segoe UI", sans-serif'; c.fillText('ENQUIRY · BUS PASS', w / 2, h / 2 + 2, w - 30); }, { repeat: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); m.position.set(ex + 2.14, y + 2.6, ez); m.rotation.y = Math.PI / 2; group.add(m);
    W.addSolid(ex, ez, 3.0, 'kiosk', true);
    W.addSolid(ex, ez, 3.0, 'busoffice', true); }
  // the gantry over the stand road at the west end, and the big timetable at the east end
  { const gx = X0 - 44, y = gy(gx, Z0);
    for (const sd of [-1, 1]) P(new THREE.CylinderGeometry(0.16, 0.2, 6.0, 10), '#3a4a5a', gx, y + 3.0, Z0 + sd * 4.6);
    P(new THREE.BoxGeometry(0.5, 1.6, 10.6), '#1f5f8f', gx, y + 5.6, Z0);
    const tex = canvasTexture(1024, 160, (c, w, h) => { c.fillStyle = '#1f5f8f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f2f0ea'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 88px "Hind", "Segoe UI", sans-serif'; c.fillText('IITG BUS STOP', w / 2, h * 0.52, w - 80); }, { repeat: false });
    for (const sd of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 1.45), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1 })); m.position.set(gx + sd * 0.27, y + 5.6, Z0); m.rotation.y = sd > 0 ? Math.PI / 2 : -Math.PI / 2; group.add(m); }
    W.addSolid(gx, Z0 - 4.6, 0.3, 'post', true); W.addSolid(gx, Z0 + 4.6, 0.3, 'post', true); }
  { const tx = X0 + 40, tz = PZ - side * 0.2, y = gy(tx, tz);
    const tex = canvasTexture(768, 512, (c, w, h) => { c.fillStyle = '#10232f'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f5f8f'; c.fillRect(0, 0, w, 78); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 50px "Hind", "Segoe UI", sans-serif'; c.fillText('CAMPUS BUS · ALL BUSES START HERE', w / 2, 40, w - 30); c.textAlign = 'left'; c.fillStyle = '#f2c12e'; c.font = '700 34px "Hind", "Segoe UI", sans-serif'; c.fillText('First bus 7:00 AM · last bus 10:00 PM', 34, 122); c.fillText('Every 20 minutes · free for students', 34, 166); c.fillStyle = '#e6e0cf'; c.font = '600 32px "Hind", "Segoe UI", sans-serif'; ['Bay 1  Main Gate · Market', 'Bay 2  Hostels · Food Court', 'Bay 3  Academic Complex · Library', 'Bay 4  Hospital · Guest House'].forEach((t, i) => c.fillText(t, 34, 232 + i * 46)); c.fillStyle = '#7fd19a'; c.fillText('Bus pass at the enquiry counter', 34, 452); }, { repeat: false });
    const tm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), tg = new THREE.PlaneGeometry(2.7, 1.8);
    for (const sd2 of [1, -1]) { const m = new THREE.Mesh(tg, tm); m.position.set(tx, y + 2.1, tz + sd2 * 0.05); m.rotation.y = sd2 > 0 ? 0 : Math.PI; group.add(m); }   // (a board with both faces readable)
    P(new THREE.BoxGeometry(2.78, 1.88, 0.08), '#10232f', tx, y + 2.1, tz);
    for (const dx of [-1.2, 1.2]) P(new THREE.CylinderGeometry(0.07, 0.07, 3.1, 6), '#5a5f64', tx + dx, y + 1.55, tz); W.addSolid(tx, tz, 1.5, 'board', true); }
  // ---- the buses standing in their bays (real ones: the same model you ride in), nose to the east
  const buses = [];
  bayX.forEach((bx, i) => {
    if (i === 3) return;                                            // bay 4 is empty: the next bus is due
    const b = makeBus();
    const bz = Z0 + side * 4.6, y = gy(bx, bz);
    b.group.position.set(bx, y, bz); b.group.rotation.y = Math.PI / 2;
    group.add(b.group); buses.push({ model: b, x: bx, z: bz });
    W.addSolid(bx, bz, 4.4, 'bus', true);
  });
  // a few lamp posts along the apron
  for (let k = 0; k < 6; k++) { const x = X0 - 36 + k * 15, z = Z0 + side * 8.2 + 0.0; P(new THREE.CylinderGeometry(0.06, 0.09, 5.2, 8), '#3a3f44', x, gy(x, z) + 2.6, z); P(new THREE.BoxGeometry(0.6, 0.12, 0.3), '#fff2c4', x, gy(x, z) + 5.2, z); }
  const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 }));
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  // the people waiting on the platform and at the bays (drawn with the crowd)
  // (sitters sit on the benches, two to a bench, hips on the seat; the others stand on the platform, facing the buses)
  const people = Array.from({ length: 14 }, (_, k) => {
    const sit = k % 3 === 0, j = (k * 3) % 7, yawF = side < 0 ? 0 : Math.PI;
    const x = sit ? PX0 + 4 + j * 10 + (k % 2 ? 0.7 : -0.7) : PX0 + 6 + r() * (PLEN - 12);
    const z = sit ? PZ + side * 0.4 - Math.sign(side) * 0.08 * -1 * 0 + (side < 0 ? -0.08 : 0.08) * -1 : PZ + side * (1.6 + r() * 1.6);
    const y = sit ? gy(x, z) + 0.07 : gy(x, z) + 0.12;
    return { x, z, y, yaw: yawF + (sit ? 0 : (r() - 0.5) * 1.2), anim: sit ? AN.SIT : k % 3 === 1 ? AN.PHONE : AN.STAND, phase: r() * 6, speed: 0, extra: 0, look: k % 5 === 4 ? adultLook(r, 'parent') : studentLook(r), th: r() };
  });
  return {
    group, buses, pos: { x: X0, z: Z0 }, bayX,
    draw(crowd) {
      if (game.interior?.active) return;
      const cam = game.camera.position;
      if (Math.hypot(X0 - cam.x, Z0 - cam.z) > 220) return;
      const h = game.clock.hour, busy = h > 6.8 && h < 22.2 ? (h > 8 && h < 10 || h > 16.5 && h < 19.5 ? 1 : 0.6) : 0.12;
      for (const p of people) if (p.th < busy) crowd.push(p.anim === AN.PHONE ? { ...p, opts: p.look.opts | bit(OPT.PHONE) } : p);
    },
  };
}

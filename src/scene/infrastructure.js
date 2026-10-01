// What a big residential campus needs to run: an
// electrical substation behind a fence, the post office, dhobi (laundry) lines with washing
// drying in the sun by the hostels, and name boards on the banks and other offices.
import * as THREE from 'three';
import { mulberry32, mergeColored, m4, canvasTexture } from '../util.js';
import { PLAN } from '../plan_data.js';
import { courtSurface } from './courts.js';

export function buildInfrastructure(game) {
  const W = game.world, G = game.graph, r = mulberry32(8181);
  const group = new THREE.Group();
  group.name = 'infrastructure';
  const parts = [];
  const P = (geo, col, x, y, z, ry = 0, rx = 0, rz = 0) => parts.push({ geometry: geo, color: col, matrix: m4(x, y, z, rx, ry, rz) });
  const clear = (x, z, R) => {
    if (!W.insideCampus(x, z) || W.waterAt(x, z) || G.onRoad(x, z, R) || (W.placer && !W.placer.free(x, z, Math.min(R, 3)))) return false;
    for (let a = 0; a < 6.28; a += 0.7) for (const d of [R * 0.5, R]) if (W.buildingAt(x + Math.cos(a) * d, z + Math.sin(a) * d) || W.waterAt(x + Math.cos(a) * d, z + Math.sin(a) * d)) return false;
    return true;
  };
  const findNear = (x, z, R, dMin = 20, dMax = 90) => {
    for (let t = 0; t < 60; t++) { const a = r() * 6.28, d = dMin + r() * (dMax - dMin), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (clear(px, pz, R)) return [px, pz]; }
    return null;
  };
  const boards = [];
  const done = { tanks: 0, substation: 0, post: 0, reservation: 0, wtp: false, stp: false, dhobi: 0, boards: 0 };

  // no overhead water towers: the hostels and houses have Sintex tanks on their roofs (scene/buildings.js)
  const hostels = W.sites.filter((s) => s.kind === 'hostel');
  const clusters = [];
  for (const c of clusters) {
    const q = findNear(c.x, c.z, 6, 40, 120);
    if (!q) continue;
    const [x, z] = q, y = W.heightAt(x, z), H = 17;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; P(new THREE.CylinderGeometry(0.28, 0.32, H, 8), '#cfc8b8', x + Math.cos(a) * 3.2, y + H / 2, z + Math.sin(a) * 3.2); }
    for (const hh of [H * 0.35, H * 0.7]) for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; P(new THREE.BoxGeometry(3.3, 0.3, 0.3), '#cfc8b8', x + Math.cos(a) * 2.78, y + hh, z + Math.sin(a) * 2.78, -a + Math.PI / 2); }
    P(new THREE.CylinderGeometry(4.6, 4.2, 5.2, 20), '#d9d1c1', x, y + H + 2.6, z);
    P(new THREE.CylinderGeometry(4.7, 4.7, 0.35, 20), '#b3563c', x, y + H + 5.3, z);
    P(new THREE.CylinderGeometry(0.25, 0.25, H + 3, 8), '#8a8f96', x + 1.2, y + (H + 3) / 2, z + 1.2);        // pipe
    boards.push({ x: x + Math.sin(0) * 4.75, y: y + H + 2.6, z: z + 4.75, yaw: 0, text: 'IITG WATER SUPPLY', col: '#1f4f8a', w: 5, h: 0.9 });
    done.tanks++;
  }

  // electrical substation: transformers inside a chain-link fence, warning boards
  {
    const ref = W.site('workshop') || W.site('admin') || W.sites[0];
    const q = findNear(ref.ex, ref.ez, 11, 50, 200);
    if (q) {
      const [x, z] = q, y = W.heightAt(x, z);
      P(new THREE.BoxGeometry(18, 0.15, 14), '#9a9a94', x, y + 0.08, z);
      for (const [sx, sz, L, rot] of [[0, 7, 18, 0], [0, -7, 18, 0], [9, 0, 14, 1], [-9, 0, 14, 1]]) {
        P(new THREE.BoxGeometry(rot ? 0.05 : L, 2.2, rot ? L : 0.05), '#8a9096', x + sx, y + 1.1, z + sz);
        for (let k = -L / 2; k <= L / 2; k += 3) P(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), '#5d6166', x + sx + (rot ? 0 : k), y + 1.2, z + sz + (rot ? k : 0));
      }
      for (let k = 0; k < 3; k++) {
        const tx = x - 5 + k * 5;
        P(new THREE.BoxGeometry(2.2, 2.4, 1.6), '#6b7d6a', tx, y + 1.35, z - 1);
        for (let f = 0; f < 5; f++) P(new THREE.BoxGeometry(0.06, 1.8, 1.4), '#5a6b58', tx - 1.2 - 0.02, y + 1.3, z - 1 + (f - 2) * 0.01);
        for (const bx of [-0.6, 0, 0.6]) { P(new THREE.CylinderGeometry(0.09, 0.14, 0.9, 8), '#c9c2b4', tx + bx, y + 3.0, z - 1); }
      }
      for (let k = 0; k < 4; k++) P(new THREE.CylinderGeometry(0.12, 0.16, 9, 8), '#8a8f96', x - 7 + k * 4.6, y + 4.5, z + 4);
      P(new THREE.BoxGeometry(15, 0.1, 0.1), '#3a3a3a', x, y + 8.6, z + 4);
      boards.push({ x, y: y + 1.6, z: z + 7.06, yaw: 0, text: 'DANGER · 11000 V · SUBSTATION', col: '#b3262f', w: 5.2, h: 0.8 });
      done.substation = 1;
    }
  }

  // the post office (its own building on the map) and the railway reservation counter next to it
  const board = (b, text, col, fg = '#ffffff') => {
    const e = W.entranceOf(b, G), fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), y = W.heightAt(e.x, e.z);
    boards.push({ x: e.x - fx * 0.55, y: Math.min(b.roof - 0.6, y + 3.0), z: e.z - fz * 0.55, yaw: e.yaw, text, col, fg, w: Math.min(6, 1.6 + text.length * 0.16), h: 0.8 });
    return { e, fx, fz, y };
  };
  const po = W.buildings.find((b) => b.postOffice);
  if (po) {
    const { e, fx, fz, y } = board(po, 'POST OFFICE · IIT GUWAHATI · 781039', '#b3262f');
    const lx = e.x + fx * 1.6 + fz * 2.2, lz = e.z + fz * 1.6 - fx * 2.2;           // the red letter box outside
    P(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 12), '#c62828', lx, y + 0.6, lz);
    P(new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#c62828', lx, y + 1.2, lz);
    done.post = 1;
  }
  const prs = W.buildings.find((b) => b.reservation);
  if (prs) { board(prs, 'RAILWAY RESERVATION COUNTER', '#1f3a6e'); done.reservation = 1; }
  // water treatment plant (where the master plan puts it): two round clarifiers, filter beds, a pump house
  const plant = (px, pz, R0, build) => { const q = clear(px, pz, R0) ? [px, pz] : findNear(px, pz, R0, 4, 70); if (q) { build(q[0], q[1], W.heightAt(q[0], q[1])); return true; } return false; };
  const fence = (x, z, y, hx, hz) => {
    for (const [sx, sz, L, rot] of [[0, hz, hx * 2, 0], [0, -hz, hx * 2, 0], [hx, 0, hz * 2, 1], [-hx, 0, hz * 2, 1]]) {
      P(new THREE.BoxGeometry(rot ? 0.05 : L, 1.8, rot ? L : 0.05), '#8a9096', x + sx, y + 0.9, z + sz);
    }
  };
  done.wtp = plant(PLAN.waterTreatment.x, -PLAN.waterTreatment.y, 13, (x, z, y) => {
    P(new THREE.BoxGeometry(30, 0.12, 22), '#a8a49a', x, y + 0.06, z);
    for (const dx of [-7, 7]) {
      P(new THREE.CylinderGeometry(5, 5, 2.4, 28), '#c9c4b8', x + dx, y + 1.2, z - 3);
      P(new THREE.CylinderGeometry(4.7, 4.7, 0.05, 28), '#5f7b62', x + dx, y + 2.3, z - 3);       // the water
      P(new THREE.BoxGeometry(9.6, 0.12, 0.8), '#8a8f96', x + dx, y + 2.6, z - 3);                 // walkway across
    }
    for (let k = 0; k < 4; k++) { P(new THREE.BoxGeometry(4, 1.4, 5), '#b9b3a6', x - 9 + k * 4.4, y + 0.7, z + 6); P(new THREE.BoxGeometry(3.6, 0.05, 4.6), '#6f7f6a', x - 9 + k * 4.4, y + 1.38, z + 6); }
    P(new THREE.BoxGeometry(6, 3.4, 5), '#e0d8c6', x + 9, y + 1.7, z + 6);                        // pump house
    P(new THREE.BoxGeometry(6.4, 0.2, 5.4), '#8f2f2a', x + 9, y + 3.5, z + 6);
    P(new THREE.CylinderGeometry(0.35, 0.35, 16, 10), '#8a8f96', x - 15, y + 1, z, 0, 0, Math.PI / 2);   // pipeline
    fence(x, z, y, 15.5, 11.5);
    boards.push({ x, y: y + 2.2, z: z + 11.52, yaw: 0, text: 'WATER TREATMENT PLANT · IITG', col: '#1f4f8a', w: 5.4, h: 0.8 });
  });
  // sewage treatment plant (east edge of the campus): long aeration tanks and a control room
  done.stp = plant(PLAN.sewageTreatment.x, -PLAN.sewageTreatment.y, 13, (x, z, y) => {
    P(new THREE.BoxGeometry(30, 0.12, 22), '#a8a49a', x, y + 0.06, z);
    for (const dz of [-6, 0, 6]) { P(new THREE.BoxGeometry(22, 1.6, 4.6), '#b9b3a6', x - 2, y + 0.8, z + dz); P(new THREE.BoxGeometry(21.4, 0.05, 4.0), '#6d6a4f', x - 2, y + 1.58, z + dz); }
    P(new THREE.BoxGeometry(5, 3.2, 6), '#e0d8c6', x + 12, y + 1.6, z);
    P(new THREE.BoxGeometry(5.4, 0.2, 6.4), '#8f2f2a', x + 12, y + 3.3, z);
    fence(x, z, y, 15.5, 11.5);
    boards.push({ x, y: y + 2.2, z: z + 11.52, yaw: 0, text: 'SEWAGE TREATMENT PLANT (STP)', col: '#2f5d3a', w: 5.4, h: 0.8 });
  });

  // (old) post office by the Market Complex: only if the map has none
  {
    const mk = !po && W.site('shopping');
    const q = mk && findNear(mk.ex, mk.ez, 6, 20, 90);
    if (q) {
      const [x, z] = q, y = W.heightAt(x, z);
      const yaw = Math.atan2(mk.ex - x, mk.ez - z);
      P(new THREE.BoxGeometry(8, 3.6, 6), '#e8dcc4', x, y + 1.8, z, yaw);
      P(new THREE.BoxGeometry(8.6, 0.3, 6.6), '#b3262f', x, y + 3.75, z, yaw);
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      P(new THREE.BoxGeometry(1.4, 2.2, 0.08), '#5a3a26', x + fx * 3.02, y + 1.1, z + fz * 3.02, yaw);
      // the red letter box outside
      P(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 12), '#c62828', x + fx * 4.2 + Math.cos(yaw) * 2.5, y + 0.6, z + fz * 4.2 - Math.sin(yaw) * 2.5);
      P(new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#c62828', x + fx * 4.2 + Math.cos(yaw) * 2.5, y + 1.2, z + fz * 4.2 - Math.sin(yaw) * 2.5);
      boards.push({ x: x + fx * 3.05, y: y + 3.0, z: z + fz * 3.05, yaw, text: 'INDIA POST · IIT GUWAHATI P.O. 781039', col: '#b3262f', w: 6.5, h: 0.8 });
      done.post = 1;
    }
  }

  // dhobi lines: clothes drying between poles near the hostels, and the ironing stall
  const CLOTH = ['#f2f0ea', '#2f5fa8', '#c62828', '#2e7d4f', '#f2c12e', '#1c1c1c', '#e38aa0', '#8fb4d8', '#6b3d5e'];
  for (const s of hostels) {
    if (r() < 0.35) continue;
    const q = findNear(s.ex, s.ez, 4, 25, 60);
    if (!q) continue;
    const [x, z] = q, y = W.heightAt(x, z), yaw = r() * Math.PI;
    const cx = Math.cos(yaw), sz = -Math.sin(yaw);
    for (const e of [-4, 4]) P(new THREE.CylinderGeometry(0.05, 0.05, 2, 6), '#6b4a33', x + cx * e, y + 1, z + sz * e);
    for (const off of [0, 0.9]) {
      P(new THREE.BoxGeometry(8, 0.015, 0.015), '#dddddd', x - Math.sin(yaw) * off, y + 1.85, z - Math.cos(yaw) * off, yaw);
      for (let k = 0; k < 9; k++) P(new THREE.BoxGeometry(0.55, 0.7 + r() * 0.3, 0.02), CLOTH[Math.floor(r() * CLOTH.length)], x + cx * (-3.5 + k * 0.85) - Math.sin(yaw) * off, y + 1.45, z + sz * (-3.5 + k * 0.85) - Math.cos(yaw) * off, yaw);
    }
    done.dhobi++;
  }

  // the wall court by Dihing Hostel: its basketball court has a concrete wall at one end (the backboard wall, painted with a board), a tall
  // chain-link fence all round (courts.js: fenceTall) and the washing hung out on two lines along its sides, as it is on every hostel court
  {
    const f = W.fields.find((q) => q.kind === 'basketball' && q.site === 'dihing') || W.fields.find((q) => q.kind === 'basketball' && q.gen);
    if (f) {
      f.fenceTall = true;
      const { hl, hw } = courtSurface(f), at = (u, v) => W.fieldPoint(f, u, v), yawU = Math.atan2(-f.az, f.ax);
      // the wall: 9 m wide, 3.4 m high, at the far end, outside the fence
      { const q = at(hl + 0.9, 0), y = W.heightAt(q.x, q.z), yaw = Math.atan2(f.ax, f.az) + Math.PI / 2;
        P(new THREE.BoxGeometry(0.35, 3.6, 9.4), '#d9d2c1', q.x, y + 1.7, q.z, yaw); P(new THREE.BoxGeometry(0.5, 0.15, 9.6), '#7d2b2b', q.x, y + 3.55, q.z, yaw);
        W.addSolid(q.x, q.z, 4.8, 'wallcourt', true);
        done.wallCourt = 1; }
      // the washing: two lines along the long sides, inside the fence
      for (const sd of [1, -1]) {
        const v = sd * (hw - 0.8);
        for (const e of [-1, 1]) { const q = at(e * (hl - 0.8), v), y = W.heightAt(q.x, q.z); P(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), '#6b4a33', q.x, y + 1.15, q.z); }
        const a = at(-(hl - 0.8), v), b = at(hl - 0.8, v), ya = W.heightAt(a.x, a.z), yb = W.heightAt(b.x, b.z);
        P(new THREE.BoxGeometry(2 * (hl - 0.8), 0.015, 0.015), '#dddddd', (a.x + b.x) / 2, (ya + yb) / 2 + 2.2, (a.z + b.z) / 2, yawU);
        const n = Math.floor((hl - 0.8) * 2 / 0.95);
        for (let k = 0; k < n; k++) { const u = -(hl - 1.2) + k * 0.95, q = at(u, v), y = W.heightAt(q.x, q.z), hh = 0.55 + r() * 0.5; P(new THREE.BoxGeometry(0.55, hh, 0.02), CLOTH[Math.floor(r() * CLOTH.length)], q.x, y + 2.2 - hh / 2 - 0.02, q.z, yawU); }
      }
    }
  }

  // name boards for banks and other offices (points of interest)
  for (const poi of W.pois) {
    const n = poi.name || '';
    if (!/Bank|SBI|Centre|Center|Computer|Guest|Post|ATM|Planning|Educational/i.test(n) || /Dept|School/.test(n)) continue;
    const b = W.buildingAt(poi.wx, poi.wz);
    if (!b) continue;
    const e = W.entranceOf(b, G);
    const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
    const y = W.heightAt(e.x, e.z);
    const bank = /Bank|SBI/.test(n);
    boards.push({ x: e.x - fx * 0.55, y: y + 3.1, z: e.z - fz * 0.55, yaw: e.yaw, text: n.toUpperCase(), col: bank ? (/SBI|State/.test(n) ? '#1f4f8a' : '#f2c12e') : '#2f5d5a', fg: bank && !/SBI|State/.test(n) ? '#1f3a6e' : '#ffffff', w: Math.min(6, 1.6 + n.length * 0.18), h: 0.8 });
    done.boards++;
  }

  if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  for (const bd of boards) {
    const tex = canvasTexture(512, 80, (g) => { g.fillStyle = bd.col; g.fillRect(0, 0, 512, 80); g.fillStyle = bd.fg || '#ffffff'; g.font = '800 34px "Hind", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(bd.text, 256, 42, 496); }, { repeat: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bd.w, bd.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    m.position.set(bd.x + Math.sin(bd.yaw) * 0.02, bd.y, bd.z + Math.cos(bd.yaw) * 0.02); m.rotation.y = bd.yaw;
    group.add(m);
  }
  game.scene.add(group);
  return { group, done };
}

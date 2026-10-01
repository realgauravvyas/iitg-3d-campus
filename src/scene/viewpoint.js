// The View Point: on the top of the hill at the end of a winding forest trail that is for people on foot only (scene/hilltrail.js). A railing round the top with walk-in gates only (cycles stay outside, in a stand by
// the entry). At the ENTRY gate a guard in a booth has you sign the register - time, name, roll
// number, hostel, room - before the gate lets you in; the EXIT gate only opens outwards (sign out as
// you leave). Only a handful of people are up there at a time (life/venues.js keeps 14 view seats).
//
// The Director's Bungalow: the white house on the hill road below the View Point, with a guard booth,
// two security guards and a name board at its gate. It is a private residence (no entry).
import * as THREE from 'three';
import { mergeColored, m4, canvasTexture, mulberry32 } from '../util.js';
import { AN } from '../crowd/people.js';
import { adultLook } from '../crowd/looks.js';
import { registerActivity } from '../register.js';
import { inRing } from './courts.js';

export function buildViewpoint(game) {
  const W = game.world, g = game;
  const F = (W.fenceOutlines || []).find((q) => q.vp);
  const vp = W.landmark('viewpoint');
  const group = new THREE.Group();
  group.name = 'viewpoint';
  const guards = [];
  if (!F || !vp || !F.gatesOut?.length) return { group, guards, update() {}, draw() {} };
  const parts = [];
  const inside = (p) => inRing(F.ring, p.x, p.z);
  const r = mulberry32(4242);
  // entry: the gate nearest the rest of the campus; exit: the next one (or a second lane beside it)
  const cx = (W.bbox.x0 + W.bbox.x1) / 2, cz = (W.bbox.z0 + W.bbox.z1) / 2;
  const gates = F.gatesOut.slice().sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
  const entry = gates[0], exits = gates.slice(1);
  const out = (q) => { const nx = q.x - vp.wx, nz = q.z - vp.wz, L = Math.hypot(nx, nz) || 1; return [nx / L, nz / L]; };
  const sign = (text, bg) => canvasTexture(512, 128, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 54px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2); }, { repeat: false });
  const board = (q, text, bg) => {
    const [nx, nz] = out(q);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: sign(text, bg), side: THREE.DoubleSide, roughness: 0.6 }));
    m.position.set(q.x + q.tx * (q.w / 2 + 0.4) + nx * 0.3, q.y + 1.9, q.z + q.tz * (q.w / 2 + 0.4) + nz * 0.3);
    m.rotation.y = Math.atan2(nx, nz);
    group.add(m);
    parts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 1.9, 6), color: '#6b7075', matrix: m4(m.position.x, q.y + 0.95, m.position.z) });
  };
  // entry: a turnstile that opens once you have signed in (from inside it always lets you out)
  g.vpSigned = false;
  const lock = (q, open) => W.indexFence({ ax: q.x - q.tx * q.w / 2, az: q.z - q.tz * q.w / 2, bx: q.x + q.tx * q.w / 2, bz: q.z + q.tz * q.w / 2, top: q.y + 2, open });
  lock(entry, (p) => g.vpSigned || inside(p));
  for (const q of exits) lock(q, (p) => inside(p));
  board(entry, exits.length ? 'ENTRY · sign in' : 'ENTRY / EXIT', '#1f6f43');
  for (const q of exits) board(q, 'EXIT', '#8a2626');
  // the guard booth outside the entry, with a window onto the register desk
  const [enx, enz] = out(entry);
  const bx = entry.x + enx * 3.2 + entry.tx * (entry.w / 2 + 2.2), bz = entry.z + enz * 3.2 + entry.tz * (entry.w / 2 + 2.2), by = W.heightAt(bx, bz);
  const byaw = Math.atan2(entry.tx, entry.tz);
  parts.push({ geometry: new THREE.BoxGeometry(2.4, 2.5, 2.2), color: '#e9e1cf', matrix: m4(bx, by + 1.25, bz, 0, byaw, 0) });
  parts.push({ geometry: new THREE.BoxGeometry(2.8, 0.18, 2.6), color: '#8f2f2a', matrix: m4(bx, by + 2.6, bz, 0, byaw, 0) });
  const deskX = bx - entry.tx * 1.25, deskZ = bz - entry.tz * 1.25;
  parts.push({ geometry: new THREE.BoxGeometry(1.2, 0.08, 0.5), color: '#6b4a2f', matrix: m4(deskX, by + 1.0, deskZ, 0, byaw + Math.PI / 2, 0) });
  const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  mesh.castShadow = true;
  group.add(mesh);
  // the booth guard sits on a chair (a plastic chair behind the desk), facing the window
  { const gx = deskX + entry.tx * 0.5, gz = deskZ + entry.tz * 0.5, gyaw = Math.atan2(-entry.tx, -entry.tz), cfx = Math.sin(gyaw), cfz = Math.cos(gyaw);
    parts.push({ geometry: new THREE.BoxGeometry(0.48, 0.05, 0.48), color: '#2f5fa8', matrix: m4(gx, by + 0.44, gz, 0, gyaw, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(0.48, 0.5, 0.05), color: '#2f5fa8', matrix: m4(gx - cfx * 0.23, by + 0.7, gz - cfz * 0.23, -0.1, gyaw, 0) });
    for (const [da, db] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) parts.push({ geometry: new THREE.BoxGeometry(0.04, 0.44, 0.04), color: '#333', matrix: m4(gx + cfz * da + cfx * db, by + 0.22, gz - cfx * da + cfz * db) }); }
  guards.push({ x: deskX + entry.tx * 0.5, z: deskZ + entry.tz * 0.5, y: by, yaw: Math.atan2(-entry.tx, -entry.tz), anim: AN.SIT, phase: 0, speed: 0, extra: 0, look: adultLook(r, 'guard') });
  guards.push({ x: entry.x + enx * 1.2 - entry.tx * (entry.w / 2 + 0.6), z: entry.z + enz * 1.2 - entry.tz * (entry.w / 2 + 0.6), y: entry.y, yaw: Math.atan2(enx, enz), anim: AN.STAND, phase: 1, speed: 0, extra: 0, look: adultLook(r, 'guard') });
  // sign in at the booth window
  const rx = deskX - entry.tx * 0.95, rz = deskZ - entry.tz * 0.95;
  g.interact.add({ x: rx, z: rz, r: 2.6, prio: 0.6, when: () => !g.vpSigned && g.mode === 'walk', label: 'Sign the View Point register to enter', run: () => {
    g.activity.start(registerActivity({
      title: 'VIEW POINT · ENTRY REGISTER', place: 'View Point gate', purpose: 'View Point', guardName: 'Mr. Deka',
      desk: { x: rx, y: W.heightAt(rx, rz), z: rz, yaw: Math.atan2(entry.tx, entry.tz) }, look: { x: deskX, y: by + 1.05, z: deskZ },
      okLine: 'Enjoy the view. No cycles or littering up there, and sign out at the exit.',
      onDone: () => { g.vpSigned = true; g.ui.toast('The entry gate is open for you. Enjoy the view!', 'gold', 'View Point'); g.audio.tone?.(660, 0.1, { type: 'triangle', gain: 0.05 }); },
    }));
  } });
  // OneStop machines: scanning at the entry opens the turnstile (instead of the paper register), at the exit it signs you out
  { const [ex, ez] = out(entry);
    g.onestop?.addKiosk({ id: 'vp-entry', name: 'View Point · Entry', x: entry.x + ex * 1.6 + entry.tx * (entry.w / 2 + 1.5), z: entry.z + ez * 1.6 + entry.tz * (entry.w / 2 + 1.5), yaw: Math.atan2(ex, ez), kind: 'view', dir: 'in',
      onScan: () => { g.vpSigned = true; return 'The entry gate is open for you. Enjoy the view!'; } });
    for (const q of exits.length ? exits : [entry]) { const [nx, nz] = out(q);
      g.onestop?.addKiosk({ dir: 'out', id: `vp-exit-${q === entry ? 0 : exits.indexOf(q) + 1}`, name: 'View Point · Exit', x: q.x - nx * 1.7 - q.tx * (q.w / 2 + 1.3), z: q.z - nz * 1.7 - q.tz * (q.w / 2 + 1.3), yaw: Math.atan2(-nx, -nz), kind: 'view',
        onScan: () => { g.vpSigned = false; return `Signed out at ${g.clock.label().split(' ').slice(1).join(' ')}. Come again!`; } }); } }
  for (const q of exits.length ? exits : [entry]) {
    const [nx, nz] = out(q);
    g.interact.add({ x: q.x - nx * 1.4, z: q.z - nz * 1.4, r: 2.4, prio: 0.4, when: () => g.vpSigned, label: 'Sign out at the exit (time out)', run: () => { g.vpSigned = false; g.ui.toast(`Signed out at ${g.clock.label().split(' ').slice(1).join(' ')}. Come again!`, 'info', 'View Point'); } });
  }
  return {
    group, guards, entry, exits,
    update() { if (g.vpSigned && Math.hypot(g.player.pos.x - vp.wx, g.player.pos.z - vp.wz) > 90) g.vpSigned = false; },
    draw(crowd) { if (g.interior?.active) return; const c = g.camera.position; if (Math.hypot(c.x - vp.wx, c.z - vp.wz) > 250) return; for (const p of guards) crowd.push(p); },
  };
}

export function buildBungalow(game) {
  const W = game.world, g = game;
  const group = new THREE.Group();
  group.name = 'directors-bungalow';
  // the white house on the hill road below the View Point (identified from the user's screenshot)
  const near = W.buildings.filter((b) => b.area > 150 && Math.hypot((b.x0 + b.x1) / 2 + 160, (b.z0 + b.z1) / 2 + 318) < 30).sort((a, b) => b.area - a.area);
  const b = near[0];
  if (!b) return { group, guards: [], draw() {} };
  b.display = "Director's Bungalow"; b.bungalow = true;
  for (const o of W.buildings) if (o !== b && o.area < 120 && Math.hypot((o.x0 + o.x1) / 2 - (b.x0 + b.x1) / 2, (o.z0 + o.z1) / 2 - (b.z0 + b.z1) / 2) < 22) { o.bungalow = true; o.display = "Director's Bungalow"; }
  W.landmarks.push({ id: 'bungalow', name: "Director's Bungalow", kind: 'service', desc: "The Director's residence on the hill road below the View Point. Private: security at the gate.", x: (b.x0 + b.x1) / 2, y: -(b.z0 + b.z1) / 2, z: b.roof + 40, wx: (b.x0 + b.x1) / 2, wz: (b.z0 + b.z1) / 2, wy: b.roof });
  const e = W.entranceOf(b, g.graph);
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), tx = fz, tz = -fx;
  const gx = e.x + fx * 6, gz = e.z + fz * 6, gy = W.heightAt(gx, gz);
  const parts = [];
  // gate: two pillars, a sliding gate, a guard booth and a name board
  for (const s of [-1, 1]) {
    parts.push({ geometry: new THREE.BoxGeometry(0.7, 2.2, 0.7), color: '#efe9dc', matrix: m4(gx + tx * s * 2.6, gy + 1.1, gz + tz * s * 2.6) });
    parts.push({ geometry: new THREE.BoxGeometry(0.85, 0.2, 0.85), color: '#8f2f2a', matrix: m4(gx + tx * s * 2.6, gy + 2.3, gz + tz * s * 2.6) });
  }
  parts.push({ geometry: new THREE.BoxGeometry(4.4, 1.5, 0.06), color: '#2a2d31', matrix: m4(gx - tx * 1.2, gy + 0.8, gz - tz * 1.2, 0, Math.atan2(tx, tz) + Math.PI / 2, 0) });
  const kx = gx + tx * 4.4 + fx * 0.6, kz = gz + tz * 4.4 + fz * 0.6, ky = W.heightAt(kx, kz);
  parts.push({ geometry: new THREE.BoxGeometry(1.8, 2.4, 1.8), color: '#e9e1cf', matrix: m4(kx, ky + 1.2, kz, 0, e.yaw, 0) });
  parts.push({ geometry: new THREE.BoxGeometry(2.2, 0.16, 2.2), color: '#8f2f2a', matrix: m4(kx, ky + 2.48, kz, 0, e.yaw, 0) });
  const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  mesh.castShadow = true;
  group.add(mesh);
  const nt = canvasTexture(512, 160, (c, w, h) => { c.fillStyle = '#23407a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d4b24a'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#f4efe6'; c.textAlign = 'center'; c.font = 'bold 44px "Segoe UI", sans-serif'; c.fillText("DIRECTOR'S BUNGALOW", w / 2, 70); c.font = '26px "Segoe UI", sans-serif'; c.fillText('IIT Guwahati · Private residence', w / 2, 118); }, { repeat: false });
  const nb = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshStandardMaterial({ map: nt, side: THREE.DoubleSide, roughness: 0.6 }));
  nb.position.set(gx + tx * 2.6 + fx * 0.4, gy + 1.5, gz + tz * 2.6 + fz * 0.4); nb.rotation.y = e.yaw;
  group.add(nb);
  const r = mulberry32(9090);
  const guards = [
    { x: gx - tx * 3.6 + fx * 0.8, z: gz - tz * 3.6 + fz * 0.8, y: gy, yaw: e.yaw, anim: AN.STAND, phase: 0, speed: 0, extra: 0, look: adultLook(r, 'guard') },
    { x: kx + fx * 1.3, z: kz + fz * 1.3, y: ky, yaw: e.yaw, anim: AN.SIT, phase: 1, speed: 0, extra: 0, look: adultLook(r, 'guard') },
  ];
  return {
    group, guards, building: b,
    draw(crowd) { if (g.interior?.active) return; const c = g.camera.position; if (Math.hypot(c.x - gx, c.z - gz) > 220) return; for (const p of guards) crowd.push(p); },
  };
}

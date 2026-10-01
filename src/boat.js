// Boating on the academic lake (the IITG Lake, and only there): a jetty with rowing boats and a speedboat
// moored to it, a boating board, people rowing about on a fine day, and you in either a
// rowing boat (W/S row, A/D turn) or the speedboat (W throttle, A/D steer, a foaming wake).
import * as THREE from 'three';
import { pointInRing, closestOnRing, damp, wrapAngle, mergeColored, m4, canvasTexture, mulberry32 } from './util.js';
import { orbitCamera } from './player.js';
import { AN } from './crowd/people.js';
import { studentLook } from './crowd/looks.js';

const WOOD = ['#7a4a26', '#2f5fa8', '#c62828', '#2e7d4f', '#e0a526'];

function makeRowBoat(color = '#7a4a26') {
  const g = new THREE.Group();
  const hull = new THREE.Shape();
  hull.moveTo(0, 1.9); hull.quadraticCurveTo(0.75, 1.0, 0.72, -1.4); hull.lineTo(-0.72, -1.4); hull.quadraticCurveTo(-0.75, 1.0, 0, 1.9);
  const geo = new THREE.ExtrudeGeometry(hull, { depth: 0.55, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); geo.translate(0, 0.45, 0);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.75 });
  const m = new THREE.Mesh(geo, paint); m.castShadow = true; g.add(m);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 2.6), new THREE.MeshStandardMaterial({ color: 0x9a6a3a })); inner.position.set(0, 0.12, 0.1); g.add(inner);
  for (const z of [-0.6, 0.5]) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 0.3), wood); s.position.set(0, 0.35, z); g.add(s); }
  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0xc89b3c })); rim.position.set(0, 0.46, -1.35); g.add(rim);
  const oars = [];
  for (const s of [-1, 1]) {
    const o = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6).rotateZ(Math.PI / 2), wood); shaft.position.x = s * 1.0; o.add(shaft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.16), wood); blade.position.x = s * 2.1; o.add(blade);
    o.position.set(s * 0.55, 0.5, 0.05);
    g.add(o); oars.push(o);
  }
  return { group: g, oars, kind: 'row' };
}

function makeSpeedBoat() {
  const g = new THREE.Group();
  const hull = new THREE.Shape();
  hull.moveTo(0, 2.6); hull.quadraticCurveTo(0.95, 1.4, 0.95, -1.8); hull.lineTo(-0.95, -1.8); hull.quadraticCurveTo(-0.95, 1.4, 0, 2.6);
  const geo = new THREE.ExtrudeGeometry(hull, { depth: 0.7, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  geo.rotateX(Math.PI / 2); geo.translate(0, 0.62, 0);
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.25, metalness: 0.1 });
  const m = new THREE.Mesh(geo, white); m.castShadow = true; g.add(m);
  const parts = mergeColored([
    { geometry: new THREE.BoxGeometry(1.95, 0.12, 4.3), color: '#c62828', matrix: m4(0, 0.2, 0.35) },            // red stripe
    { geometry: new THREE.BoxGeometry(1.6, 0.06, 3.2), color: '#d9cfbd', matrix: m4(0, 0.5, -0.1) },             // deck
    { geometry: new THREE.BoxGeometry(1.3, 0.45, 0.05), color: '#8fb4d8', matrix: m4(0, 0.95, 0.8, -0.5) },       // windshield
    { geometry: new THREE.BoxGeometry(0.6, 0.35, 0.5), color: '#2a2a2a', matrix: m4(-0.35, 0.72, 0.2) },          // console
    { geometry: new THREE.BoxGeometry(1.2, 0.3, 0.5), color: '#1f4f8a', matrix: m4(0, 0.7, -1.0) },               // seat
    { geometry: new THREE.BoxGeometry(0.4, 0.65, 0.45), color: '#1c1c1c', matrix: m4(0, 0.85, -2.05) },           // outboard motor
    { geometry: new THREE.BoxGeometry(0.12, 0.7, 0.2), color: '#3a3a3a', matrix: m4(0, 0.25, -2.1) },
  ]);
  const pm = new THREE.Mesh(parts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }));
  pm.castShadow = true; g.add(pm);
  return { group: g, oars: [], kind: 'speed' };
}

/** where the jetty of a lake goes: the shore point closest to a road (not at a building). Also used to leave the fence open there. */
export function jettyPoint(W, G, w) {
  const ring = w.rings[0];
  let best = null;
  for (let i = 0; i < ring.length; i += 8) {
    const n = G.nearestOnNetwork(ring[i], ring[i + 1]);
    if (n && (!best || n.d < best.d) && !W.buildingAt(ring[i], ring[i + 1])) best = { x: ring[i], z: ring[i + 1], d: n.d };
  }
  return best;
}

export class Boats {
  constructor(game) {
    this.g = game;
    this.active = false;
    const W = game.world, r = mulberry32(3131);
    this.jetties = [];
    this.npc = [];
    const parts = [];
    for (const w of W.water) {
      if (w.kind === 'pool' || w.name !== 'IITG lake') continue;       // boats only on the academic lake; the other lakes have none
      // the jetty goes where the lake shore is closest to a road
      const ring = w.rings[0];
      const best = jettyPoint(W, game.graph, w);
      if (!best) continue;
      let cx = 0, cz = 0; for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cz += ring[i + 1]; } cx /= ring.length / 2; cz /= ring.length / 2;
      const dx = cx - best.x, dz = cz - best.z, L = Math.hypot(dx, dz) || 1;
      const yaw = Math.atan2(dx / L, dz / L);
      const y = w.level;
      for (let k = 0; k < 7; k++) {
        const x = best.x + (dx / L) * (k * 1.2 - 1.5), z = best.z + (dz / L) * (k * 1.2 - 1.5);
        parts.push({ geometry: new THREE.BoxGeometry(2.2, 0.1, 1.15), color: '#8a5a36', matrix: m4(x, y + 0.45, z, 0, yaw, 0) });
        for (const s of [-1, 1]) parts.push({ geometry: new THREE.CylinderGeometry(0.07, 0.07, 1.8, 6), color: '#5a3d2b', matrix: m4(x + Math.cos(yaw) * s * 1.0, y - 0.3, z - Math.sin(yaw) * s * 1.0) });
      }
      // a boating board at the land end
      const bx = best.x - (dx / L) * 2.5 + Math.cos(yaw) * 2.2, bz = best.z - (dz / L) * 2.5 - Math.sin(yaw) * 2.2;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ map: canvasTexture(360, 220, (g2) => {
        g2.fillStyle = '#1f4f8a'; g2.fillRect(0, 0, 360, 220); g2.fillStyle = '#fff'; g2.textAlign = 'center';
        g2.font = '800 40px "Hind", sans-serif'; g2.fillText('BOATING', 180, 55);
        g2.font = '600 24px "Hind", sans-serif'; g2.fillText('Rowing boat · ₹20', 180, 100); g2.fillText('Speedboat · ₹60', 180, 136); g2.fillText('6:00 AM – 6:30 PM · Life jackets', 180, 176);
      }, { repeat: false }), roughness: 0.6 }));
      board.position.set(bx, W.heightAt(bx, bz) + 1.6, bz); board.rotation.y = yaw + Math.PI;
      game.scene.add(board);
      parts.push({ geometry: new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), color: '#555', matrix: m4(bx, W.heightAt(bx, bz) + 0.8, bz) });
      const tip = { x: best.x + (dx / L) * 6.5, z: best.z + (dz / L) * 6.5 };
      // moored along the jetty: rowing boats on one side, the speedboat on the other
      const boats = [];
      const moor = (mdl, side, along) => {
        const x = best.x + (dx / L) * along + Math.cos(yaw) * side, z = best.z + (dz / L) * along - Math.sin(yaw) * side;
        mdl.group.position.set(x, y, z); mdl.group.rotation.y = yaw;
        game.scene.add(mdl.group);
        boats.push({ mdl, home: mdl.group.position.clone(), yaw, busy: false });
      };
      for (let k = 0; k < 3; k++) moor(makeRowBoat(WOOD[(k + this.jetties.length) % WOOD.length]), 1.7, 1.2 + k * 2.1);
      moor(makeSpeedBoat(), -2.1, 3.5);
      const j = { w, x: best.x, z: best.z, tip, yaw, boats };
      this.jetties.push(j);
      const at = { x: best.x + (dx / L) * 3, z: best.z + (dz / L) * 3 };
      game.interact.add({ x: at.x, z: at.z, r: 5, label: `Take a rowing boat out on ${w.name} · ₹20`, ok: () => (game.mode === 'walk' ? true : 'get off first'), run: () => this.start(j, 'row') });
      game.interact.add({ x: at.x - Math.cos(yaw) * 2.5, z: at.z + Math.sin(yaw) * 2.5, r: 3.5, label: `Take the speedboat · ₹60`, ok: () => (game.mode === 'walk' ? true : 'get off first'), run: () => this.start(j, 'speed'), prio: 0.3 });
      // people rowing about on the bigger lakes
      const area = Math.abs(ringArea(ring));
      const n = area > 20000 ? 3 : area > 6000 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const mdl = makeRowBoat(WOOD[(k * 2 + 1) % WOOD.length]);
        game.scene.add(mdl.group);
        const b = { w, mdl, x: cx + (r() - 0.5) * 20, z: cz + (r() - 0.5) * 20, yaw: r() * 6.28, v: 0.8 + r() * 0.5, turn: 0, stroke: r() * 6, pair: r() < 0.5, looks: [studentLook(r), studentLook(r)] };
        if (!pointInRing(b.x, b.z, ring)) { b.x = tip.x + (dx / L) * 6; b.z = tip.z + (dz / L) * 6; }
        this.npc.push(b);
      }
    }
    if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); m.castShadow = true; m.receiveShadow = true; game.scene.add(m); }
  }

  start(j, kind = 'row') {
    const g = this.g;
    const fare = kind === 'speed' ? 60 : 20;
    const bt = j.boats.find((b) => b.mdl.kind === kind && !b.busy);
    if (!bt) { g.ui.toast('All the boats are out. Try again in a bit.', 'warn'); return; }
    if (!g.progress.spend(fare, kind === 'speed' ? 'speedboat ride' : 'rowing boat', () => this.start(j, kind))) return;
    this.j = j; this.bt = bt; bt.busy = true; this.kind = kind; this.active = true;
    this.pos = bt.mdl.group.position.clone(); this.yaw = j.yaw; this.v = 0; this.w = 0; this.dist = 0; this.stroke = 0;
    bt.mdl.group.add(g.player.avatar.root);
    if (kind === 'speed') { g.player.avatar.root.position.set(-0.35, 0.55, -0.4); g.player.avatar.root.rotation.set(0, 0, 0); }
    else { g.player.avatar.root.position.set(0, 0.1, 0.1); g.player.avatar.root.rotation.set(0, Math.PI, 0); }
    this.exitAt = null;
    g.setMode('boat');
    g.ui.toast(kind === 'speed' ? 'W throttle, S reverse, A / D steer. Press E near the jetty or any shore to get out.' : 'W / S row, A / D turn. Press E near the jetty or any shore to get out.', 'info', `${j.w.name}`);
  }

  stop() {
    const g = this.g, j = this.j, bt = this.bt;
    if (!this.active) return;
    this.active = false;
    bt.mdl.group.remove(g.player.avatar.root);
    g.scene.add(g.player.avatar.root);
    bt.mdl.group.position.copy(bt.home); bt.mdl.group.rotation.set(0, bt.yaw, 0);
    bt.busy = false;
    // the jetty's land end, or the shore you chose (never in the water)
    const at = this.exitAt || { x: j.x - Math.sin(j.yaw) * 1, z: j.z - Math.cos(j.yaw) * 1, yaw: j.yaw + Math.PI };
    this.exitAt = null;
    g.player.spawn(at.x, at.z, at.yaw);
  }

  /** a dry, walkable spot on the shore nearest the boat (a little inland), facing away from the water; null if there is none */
  shoreExit(maxD = 14) {
    const W = this.g.world, ring = this.j.w.rings[0], P = this.pos;
    const dry = (x, z) => W.insideCampus(x, z) && !W.waterAt(x, z) && !W.buildingAt(x, z) && !W.vehicleKeepOut?.(x, z);
    let best = null;
    for (let i = 0; i < ring.length; i += 2) {
      const d = Math.hypot(ring[i] - P.x, ring[i + 1] - P.z);
      if (d > maxD || (best && d >= best.d)) continue;
      const j2 = (i + 2) % ring.length, tx = ring[j2] - ring[i], tz = ring[j2 + 1] - ring[i + 1], L = Math.hypot(tx, tz) || 1;
      // the inland side: away from the lake's middle
      let nx = -tz / L, nz = tx / L; const cx = ring[i] + nx * 1.2, cz = ring[i + 1] + nz * 1.2;
      if (pointInRing(cx, cz, ring)) { nx = -nx; nz = -nz; }
      for (const k of [1.6, 2.4, 3.4, 5]) { const x = ring[i] + nx * k, z = ring[i + 1] + nz * k; if (dry(x, z)) { best = { d, x, z, yaw: Math.atan2(nx, nz) }; break; } }
    }
    return best;
  }

  update(dt) {
    const g = this.g, i = g.input, j = this.j, w = j.w, mdl = this.bt.mdl;
    const ax = i.axis();
    const speed = this.kind === 'speed';
    if (speed) {
      const target = ax.y > 0 ? 12 * (i.down('ShiftLeft', 'ShiftRight') ? 1.25 : 1) : ax.y < 0 ? -3 : 0;
      this.v = damp(this.v, target, ax.y ? 1.2 : 0.6, dt);
      this.w = damp(this.w, -ax.x * (0.5 + Math.min(1, Math.abs(this.v) / 6) * 0.7), 3, dt);
    } else {
      this.stroke += dt * (Math.abs(ax.y) > 0.1 ? 2.6 : 0);
      const pull = ax.y * Math.max(0, Math.sin(this.stroke)) * 3.2;
      this.v = damp(this.v, this.v + pull * dt * 4, 1, dt) * (1 - 0.35 * dt);
      this.v = Math.max(-1.5, Math.min(3.2, this.v));
      this.w = damp(this.w, -ax.x * 0.8, 2, dt);
    }
    this.yaw = wrapAngle(this.yaw + this.w * dt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const nx = this.pos.x + fx * this.v * dt, nz = this.pos.z + fz * this.v * dt;
    // stay on the water: near the shore you may only move away from it
    const shore = (x, z) => (pointInRing(x, z, w.rings[0]) ? closestOnRing(x, z, w.rings[0], { d: 0, x: 0, z: 0 }).d : -1);
    const dNow = shore(this.pos.x, this.pos.z), dNew = shore(nx, nz), need = speed ? 2.4 : 1.6;
    if (dNew > need || (dNew > 0.3 && dNew >= dNow)) { this.pos.x = nx; this.pos.z = nz; this.dist += Math.abs(this.v * dt); }
    else { this.v *= -0.3; g.audio.bump(); }
    const bob = Math.sin(g.time * 1.6) * 0.04;
    const lift = speed ? Math.min(0.25, Math.abs(this.v) * 0.02) : 0;
    mdl.group.position.set(this.pos.x, w.level + bob + lift, this.pos.z);
    mdl.group.rotation.set(Math.sin(g.time * 1.1) * 0.02 - (speed ? Math.min(0.12, Math.abs(this.v) * 0.012) : 0), this.yaw, Math.sin(g.time * 1.3) * 0.025 - this.w * (speed ? 0.12 : 0));
    if (speed) {
      // a foaming wake behind the motor
      this.wakeT = (this.wakeT || 0) - dt;
      if (Math.abs(this.v) > 1.5 && this.wakeT <= 0) {
        this.wakeT = 0.08;
        const bx = this.pos.x - fx * 2.2, bz = this.pos.z - fz * 2.2;
        g.splash?.burst(bx, w.level, bz, 4, 0.8 + Math.abs(this.v) * 0.06);
        g.splash?.ripple(bx, w.level, bz, 0.7 + Math.abs(this.v) * 0.05);
      }
      this.engT = (this.engT || 0) - dt;
      if (this.engT <= 0) { this.engT = 0.12; g.audio.noise?.(0.14, { f: 140 + Math.abs(this.v) * 25, q: 2, gain: 0.05 + Math.abs(this.v) * 0.006 }); }
      g.player.avatar.animate({ type: 'scooterRide' }, dt);
    } else {
      const k = Math.sin(this.stroke);
      for (const [s, o] of mdl.oars.entries()) { o.rotation.y = (s ? -1 : 1) * k * 0.5; o.rotation.z = (s ? 1 : -1) * (0.15 + Math.cos(this.stroke) * 0.12); }
      g.player.avatar.animate({ type: 'row' }, dt);
      if (Math.abs(this.v) > 0.5 && Math.random() < dt * 2) g.splash?.ripple(this.pos.x, w.level, this.pos.z, 0.8);
    }
    g.player.pos.set(this.pos.x, w.level + 0.2, this.pos.z);
    g.player.look(i, -0.3, 1.2);
    if (this.dist > 150) g.progress.unlock('boat');
    const dj = Math.hypot(this.pos.x - j.tip.x, this.pos.z - j.tip.z);
    if (dj < 7) g.ui.prompt('<kbd>E</kbd> Get out at the jetty');
    else {
      const sx = this.shoreExit();
      g.ui.prompt(sx && sx.d < 7 ? '<kbd>E</kbd> Get out on the shore' : '<kbd>E</kbd> Swim ashore <span class="dim">(or row to the jetty or a shore first)</span>');
    }
    if (i.hit('KeyE')) this.getOut();
  }

  /** E or the Get out button: at the jetty or on a shore within reach, else you dive in and swim to the nearest dry ground
   *  (the boat goes back to its mooring by itself). There is always a way out. */
  getOut() {
    const g = this.g, j = this.j;
    if (!this.active) { g.setMode('walk'); return; }
    if (Math.hypot(this.pos.x - j.tip.x, this.pos.z - j.tip.z) < 7) { g.setMode('walk'); return; }
    const near = this.shoreExit();
    if (near && near.d < 7) this.exitAt = near;
    else {
      const far = this.shoreExit(1e6);
      if (far) { this.exitAt = far; g.ui.toast('You dive in and swim ashore. The boat goes back to its jetty.', 'info', 'Boat'); }
    }
    g.setMode('walk');
  }

  /** people out rowing on the lakes (6 am - 6:30 pm), drawn with the crowd */
  updateNpc(dt, crowd) {
    const g = this.g, h = g.clock.hour, out = h > 6 && h < 18.5 && g.weather.state.rain < 0.3;
    const cam = g.camera.position;
    for (const b of this.npc) {
      b.mdl.group.visible = out;
      if (!out) continue;
      const ring = b.w.rings[0];
      b.stroke += dt * 2.2;
      if (Math.random() < dt * 0.15) b.turn = (Math.random() - 0.5) * 0.6;
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
      const nx = b.x + fx * b.v * dt, nz = b.z + fz * b.v * dt;
      if (pointInRing(nx, nz, ring) && closestOnRing(nx, nz, ring, { d: 0, x: 0, z: 0 }).d > 5) { b.x = nx; b.z = nz; } else b.turn = 1.2;
      b.yaw = wrapAngle(b.yaw + b.turn * dt);
      const y = b.w.level + Math.sin(g.time * 1.6 + b.stroke) * 0.04;
      b.mdl.group.position.set(b.x, y, b.z); b.mdl.group.rotation.set(0, b.yaw, Math.sin(g.time * 1.3) * 0.025);
      const k = Math.sin(b.stroke);
      b.mdl.oars.forEach((o, s) => { o.rotation.y = (s ? -1 : 1) * k * 0.5; o.rotation.z = (s ? 1 : -1) * (0.15 + Math.cos(b.stroke) * 0.12); });
      if (crowd && (b.x - cam.x) ** 2 + (b.z - cam.z) ** 2 < 200 * 200) {
        crowd.push({ x: b.x - fx * 0.1, y: y + 0.1, z: b.z - fz * 0.1, yaw: b.yaw + Math.PI, anim: AN.ROW, phase: b.stroke, speed: 0, extra: 0, look: b.looks[0], opts: b.looks[0].opts });
        if (b.pair) crowd.push({ x: b.x + fx * 1.1, y: y + 0.12, z: b.z + fz * 1.1, yaw: b.yaw + Math.PI, anim: AN.SIT, phase: 0, speed: 0, extra: 0, look: b.looks[1], opts: b.looks[1].opts });
      }
      if (Math.random() < dt * 1.2 && (b.x - cam.x) ** 2 + (b.z - cam.z) ** 2 < 120 * 120) g.splash?.ripple(b.x, b.w.level, b.z, 0.8);
    }
  }

  updateCamera(cam, dt) {
    const g = this.g;
    const t = new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z);
    orbitCamera(g.world, cam, t, this.yaw + g.player.camYaw, Math.max(0.12, g.player.camPitch * 0.7 + 0.1), this.kind === 'speed' ? 9 : 7.5, dt);
  }
}

function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += (r[j] * r[i + 1] - r[i] * r[j + 1]); return a / 2; }

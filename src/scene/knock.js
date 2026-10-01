// Small things you can knock over: dustbins, traffic cones, flower pots at the doors, A-frame boards,
// and footballs you can kick. Ride or drive into one (or run into it) and it tips over, slides, rolls a
// little and settles on its side (a ball rolls away); a minute later a sweeper has put it back.
import * as THREE from 'three';
import { mergeColored, m4 } from '../util.js';

export class Knockables {
  constructor(game) {
    this.g = game;
    this.items = [];
    this.kinds = {};
    const bin = (col) => mergeColored([
      { geometry: new THREE.CylinderGeometry(0.23, 0.2, 0.75, 10), color: col, matrix: m4(0, 0.38, 0) },
      { geometry: new THREE.CylinderGeometry(0.25, 0.25, 0.05, 10), color: '#e8e4da', matrix: m4(0, 0.77, 0) },
    ]);
    const cone = mergeColored([
      { geometry: new THREE.ConeGeometry(0.2, 0.7, 12), color: '#f06a1c', matrix: m4(0, 0.38, 0) },
      { geometry: new THREE.CylinderGeometry(0.135, 0.165, 0.1, 12), color: '#f4f4ef', matrix: m4(0, 0.36, 0) },
      { geometry: new THREE.BoxGeometry(0.46, 0.04, 0.46), color: '#1c1c1c', matrix: m4(0, 0.02, 0) },
    ]);
    // a terracotta flower pot with a green bush
    const pot = mergeColored([
      { geometry: new THREE.CylinderGeometry(0.22, 0.15, 0.34, 10), color: '#b4562e', matrix: m4(0, 0.17, 0) },
      { geometry: new THREE.CylinderGeometry(0.24, 0.22, 0.05, 10), color: '#a04a26', matrix: m4(0, 0.35, 0) },
      { geometry: new THREE.SphereGeometry(0.25, 8, 6), color: '#3f8f3a', matrix: m4(0, 0.5, 0, 0, 0, 0, 1, 0.85, 1) },
    ]);
    // a yellow A-frame board (wet floor / menu) on two legs
    const board = mergeColored([
      { geometry: new THREE.BoxGeometry(0.42, 0.62, 0.03), color: '#f2c12e', matrix: m4(0, 0.36, 0.09, -0.22) },
      { geometry: new THREE.BoxGeometry(0.42, 0.62, 0.03), color: '#e4b21f', matrix: m4(0, 0.36, -0.09, 0.22) },
      { geometry: new THREE.BoxGeometry(0.28, 0.08, 0.02), color: '#1c1c1c', matrix: m4(0, 0.42, 0.115, -0.22) },
    ]);
    // a football
    const ball = mergeColored([
      { geometry: new THREE.SphereGeometry(0.11, 10, 8), color: '#f4f4ef', matrix: m4(0, 0.11, 0) },
      { geometry: new THREE.SphereGeometry(0.113, 6, 4, 0, 2.2, 0.5, 1.1), color: '#23262b', matrix: m4(0, 0.11, 0) },
    ]);
    this.geo = { binG: bin('#2e7d4f'), binB: bin('#2f5fa8'), cone, pot, board, ball };
    this.size = { binG: [0.25, 0.4, 6], binB: [0.25, 0.4, 6], cone: [0.23, 0.36, 3], pot: [0.24, 0.3, 4], board: [0.28, 0.36, 2.5], ball: [0.12, 0.12, 0.4] };   // radius, centre height, mass-ish
  }

  add(kind, x, z, yaw = 0) {
    // nothing on the roundabout islands
    if ((this.g.islands || []).some((I) => Math.hypot(x - I.x, z - I.z) < I.r + 1.2)) return;
    // and nothing on a road: bins, cones, pots and boards stand beside it
    if (this.g.graph?.onRoad?.(x, z, 0.6)) return;
    this.items.push({ kind, x, z, yaw, hx: x, hz: z, hyaw: yaw, tilt: 0, tdir: 0, vx: 0, vz: 0, roll: 0, down: 0 });
  }

  build() {
    const g = this.g, M = new THREE.Matrix4();
    for (const kind of Object.keys(this.geo)) {
      const list = this.items.filter((it) => it.kind === kind);
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(this.geo[kind], new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), list.length);
      im.castShadow = true; im.receiveShadow = true;
      list.forEach((it, i) => { it.im = im; it.i = i; });
      this.kinds[kind] = { im, list };
      g.scene.add(im);
    }
    for (const it of this.items) this.place(it, M);
    this.grid = new Map();
    for (const it of this.items) { const k = Math.floor(it.hx / 20) * 65536 + Math.floor(it.hz / 20); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(it); }
  }

  place(it, M = new THREE.Matrix4()) {
    const W = this.g.world, y = W.heightAt(it.x, it.z);
    // tip over around the base edge in direction tdir
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, it.tdir, 0))
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(it.tilt, 0, 0)))
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, it.roll - it.tdir + it.yaw, 0)));
    const r = this.size[it.kind][0];
    const lift = Math.sin(it.tilt) * r;            // lying on its side, the centre is one radius up
    M.compose(new THREE.Vector3(it.x, y + lift * 0.9, it.z), q, new THREE.Vector3(1, 1, 1));
    it.im.setMatrixAt(it.i, M);
    it.im.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    const g = this.g, m = g.mode;
    // what could hit something: you on foot / cycle / in a vehicle, and the campus traffic
    const hitters = [];
    const P = g.player.pos;
    if (m === 'walk' && !g.interior?.active) hitters.push({ x: P.x, z: P.z, r: 0.35, vx: g.player.vel.x, vz: g.player.vel.z, who: 'you' });
    if (m === 'bike') hitters.push({ x: g.bike.pos.x, z: g.bike.pos.z, r: 0.55, vx: Math.sin(g.bike.heading) * g.bike.speed, vz: Math.cos(g.bike.heading) * g.bike.speed, who: 'you' });
    if (m === 'drive' && g.drive.active) hitters.push({ x: g.drive.pos.x, z: g.drive.pos.z, r: g.drive.spec?.two ? 0.6 : 1.3, vx: Math.sin(g.drive.yaw) * g.drive.speed, vz: Math.cos(g.drive.yaw) * g.drive.speed, who: 'you' });
    for (const h of hitters) {
      const sp = Math.hypot(h.vx, h.vz);
      if (sp < 1.2) continue;
      const k = Math.floor(h.x / 20) * 65536 + Math.floor(h.z / 20);
      for (const it of this.grid.get(k) || []) {
        if (it.down > 0 && it.tilt > 1) continue;
        const d = Math.hypot(it.x - h.x, it.z - h.z);
        if (d > h.r + this.size[it.kind][0]) continue;
        // knocked: flies a little in the direction of the hit
        const push = it.kind === 'ball' ? Math.min(11, sp * 1.7) : Math.min(5, sp * (it.kind === 'cone' ? 0.9 : 0.55));
        it.vx = h.vx / sp * push + (it.x - h.x) * 0.5; it.vz = h.vz / sp * push + (it.z - h.z) * 0.5;
        it.tdir = Math.atan2(it.vx, it.vz); it.falling = true; it.down = 60;
        g.audio.noise?.(0.12, { f: it.kind === 'cone' ? 900 : 300, q: 0.8, gain: 0.14 });
        if (it.kind === 'ball') g.audio.tone?.(170, 0.07, { type: 'sine', gain: 0.12, slideTo: 90 });
        else if (it.kind === 'binG' || it.kind === 'binB') g.audio.clang?.();
        else if (it.kind !== 'cone') g.audio.tone?.(110, 0.12, { type: 'triangle', gain: 0.1 });
        // the "Oops" note only the first time you knock one over (the clatter still plays every time)
        if (h.who === 'you') { g.progress.count?.('knocked'); if ((it.kind === 'binG' || it.kind === 'binB') && !this.oopsShown) { this.oopsShown = true; g.ui.floatText?.('Oops! Mind the dustbins', 'xp'); } }
      }
    }
    for (const it of this.items) {
      if (!it.falling && it.down <= 0) continue;
      if (it.falling) {
        it.tilt = Math.min(Math.PI / 2, it.tilt + dt * (it.kind === 'ball' ? 30 : 6));
        it.x += it.vx * dt; it.z += it.vz * dt;
        const f = Math.exp(-(it.kind === 'ball' ? 0.9 : 3.2) * dt); it.vx *= f; it.vz *= f;
        it.roll += Math.hypot(it.vx, it.vz) * dt * 2;
        if (this.g.world.buildingAt(it.x, it.z)) { it.vx *= -0.3; it.vz *= -0.3; }
        if (it.tilt >= Math.PI / 2 && Math.hypot(it.vx, it.vz) < 0.05) it.falling = false;
        if (it.kind === 'ball' && it.tilt >= Math.PI / 2) it.tilt = 0.0001;     // a ball just rolls: it never lies down
        this.place(it);
      } else {
        it.down -= dt;
        if (it.down <= 0) { it.x = it.hx; it.z = it.hz; it.tilt = 0; it.roll = 0; it.yaw = it.hyaw; this.place(it); }   // put back by a sweeper
      }
    }
  }
}

/** flower pots at the doors, boards at the busy entrances, footballs on the grounds and by the hostels */
export function seedKnockables(game) {
  const W = game.world, P = game.placer, K = game.knock;
  const ok = (x, z, r = 0.45) => (P ? P.free(x, z, r) : !W.buildingAt(x, z)) && W.insideCampus(x, z);
  for (const s of W.sites) {
    const lx = Math.cos(s.yaw), lz = -Math.sin(s.yaw);                                     // along the front of the building
    for (const side of [-1, 1]) {
      const x = s.ex + s.nx * 2.2 + lx * side * 2.6, z = s.ez + s.nz * 2.2 + lz * side * 2.6;
      if (ok(x, z)) K.add('pot', x, z);
    }
    if (['library', 'lhc', 'sac', 'newsac', 'hospital', 'foodcourt', 'shopping', 'gym', 'guesthouse'].includes(s.lm)) {
      const x = s.ex + s.nx * 3.4 + lx * 1.3, z = s.ez + s.nz * 3.4 + lz * 1.3;
      if (ok(x, z)) K.add('board', x, z, s.yaw);
    }
  }
  // footballs: two on each football field, near the middle
  for (const f of W.fields.filter((q) => q.kind === 'soccer' || q.kind === 'hockey')) {
    for (const [a, b] of [[-0.15, 0.1], [0.12, -0.08]]) { const x = f.cx + f.ax * (f.len || 60) * a - f.az * (f.wid || 40) * b, z = f.cz + f.az * (f.len || 60) * a + f.ax * (f.wid || 40) * b; if (W.sportsAt(x, z)) K.add('ball', x, z); }
  }
  // and one by each hostel's sit-out
  for (const s of W.sites.filter((q) => q.kind === 'hostel')) { const x = s.ex + s.nx * 12 + Math.cos(s.yaw) * 5, z = s.ez + s.nz * 12 - Math.sin(s.yaw) * 5; if (ok(x, z, 0.4) && !W.sportsAt(x, z)) K.add('ball', x, z); }
}

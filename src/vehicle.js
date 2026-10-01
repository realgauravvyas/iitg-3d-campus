// Drivable vehicles (ambulance, pizza delivery scooter): arcade physics on the terrain,
// collisions with buildings and the campus wall, lakes stop you, chase camera.
import { sweepBlocked, footprintBlocked } from './clearance.js';
import * as THREE from 'three';
import { makeScooter, makeCar, makeMotorbike } from './models.js';
import { canvasTexture, clamp, damp, angleDamp, wrapAngle } from './util.js';
import { orbitCamera } from './player.js';
import { exitSpot } from './exitspot.js';

export function makeAmbulance() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.45, metalness: 0.2 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x223844, roughness: 0.1, metalness: 0.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.9, 4.9), white); body.position.set(0, 1.35, -0.2); body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.1, 1.3), white); cab.position.set(0, 0.95, 2.6); cab.castShadow = true; g.add(cab);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.05), glass); ws.position.set(0, 1.55, 2.28); ws.rotation.x = -0.25; g.add(ws);
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 4.8), red); stripe.position.set(s * 1.005, 1.1, -0.2); g.add(stripe);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.9), glass); win.position.set(s * 1.0, 1.6, 2.0); g.add(win);
  }
  const txt = canvasTexture(512, 128, (c, w, h) => { c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, w, h); c.fillStyle = '#c62828'; c.font = 'bold 76px "Hind", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('AMBULANCE', w / 2, h / 2); }, { repeat: false });
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.62), new THREE.MeshStandardMaterial({ map: txt, roughness: 0.5 })); m.position.set(s * 1.012, 1.75, -0.4); m.rotation.y = s * Math.PI / 2; g.add(m); }
  const cross = canvasTexture(128, 128, (c) => { c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#c62828'; c.fillRect(44, 12, 40, 104); c.fillRect(12, 44, 104, 40); }, { repeat: false });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ map: cross })); back.position.set(0, 1.6, -2.66); back.rotation.y = Math.PI; g.add(back);
  // light bar
  const lr = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0 });
  const lb = new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x0030ff, emissiveIntensity: 0 });
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), lr); l1.position.set(-0.4, 2.4, 1.6); g.add(l1);
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), lb); l2.position.set(0.4, 2.4, 1.6); g.add(l2);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.9], [0.95, 1.9], [-0.95, -1.7], [0.95, -1.7]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16).rotateZ(Math.PI / 2), tyre); w.position.set(x, 0.4, z); g.add(w); wheels.push(w); }
  let t = 0;
  return {
    group: g, wheels,
    spin(d) { for (const w of wheels) w.rotation.x += d / 0.4; },
    lights(on, dt) { t += dt; const a = Math.sin(t * 14) > 0; lr.emissiveIntensity = on && a ? 3 : 0; lb.emissiveIntensity = on && !a ? 3 : 0; },
  };
}

function pizzaScooter() {
  const s = makeScooter('#2b2b2b');
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a3b1c, roughness: 0.6 }));
  box.position.set(0, 1.05, -0.62);
  s.group.add(box);
  return s;
}

const SPEC = {
  scooty: { make: () => makeScooter('#e38aa0'), top: 12, acc: 4.5, r: 0.6, wheelbase: 1.25, cam: 5.5, seat: [0, 0, -0.15], two: true },
  rider: { make: () => makeScooter('#8fb4d8'), top: 14, acc: 5, r: 0.6, wheelbase: 1.3, cam: 5.5, seat: [0, 0, -0.15], two: true },
  motorbike: { make: () => makeMotorbike('#1c1c1c'), top: 19, acc: 6.5, r: 0.65, wheelbase: 1.35, cam: 6, seat: [0, 0.02, -0.1], two: true },
  ambulance: { make: makeAmbulance, top: 17, acc: 5.5, r: 1.3, wheelbase: 3.4, cam: 11, seat: null },
  scooter: { make: pizzaScooter, top: 13, acc: 5, r: 0.6, wheelbase: 1.3, cam: 5.5, seat: [0, 0, -0.15] },
  car: { make: () => makeCar('#e8e8e8'), top: 15, acc: 4.5, r: 1.1, wheelbase: 2.6, cam: 9, seat: null },
};

export class Drive {
  constructor(game) { this.g = game; this.active = false; this.v = null; }

  start(kind, x, z, yaw) {
    const g = this.g;
    const spec = SPEC[kind];
    const two = spec.two || kind === 'scooter';
    const hl = two ? 1.1 : kind === 'ambulance' ? 3.3 : 2.3, hw = two ? 0.5 : 1.05;
    if (footprintBlocked(g.world, x, z, yaw, hl + 0.4, hw + 0.4)) {
      let clear = null;
      for (let radius = 2; radius <= 20 && !clear; radius += 2) for (let k = 0; k < 16 && !clear; k++) {
        const a = k * Math.PI / 8, px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius;
        if (!g.world.waterAt(px, pz) && !footprintBlocked(g.world, px, pz, yaw, hl + 0.4, hw + 0.4)) clear = { x: px, z: pz };
      }
      if (!clear) { g.ui.toast('There is no clear space to take out this vehicle here.', 'info'); return false; }
      x = clear.x; z = clear.z;
    }
    this.kind = kind; this.spec = spec;
    this.model = spec.make();
    g.scene.add(this.model.group);
    this.pos = new THREE.Vector3(x, g.world.heightAt(x, z), z);
    this._prev = this.pos.clone();
    this.yaw = yaw; this.speed = 0; this.steer = 0; this.siren = kind === 'ambulance';
    this.exiting = false;
    this.active = true;
    this.view = 'chase';
    if (spec.seat) { this.model.group.add(g.player.avatar.root); g.player.avatar.root.position.set(...spec.seat); g.player.avatar.root.rotation.set(0, 0, 0); }
    else g.player.avatar.root.visible = false;
    g.player.camYaw = 0; g.player.camPitch = 0.3;
    this.place(0);
    g.audio.door?.();
  }

  stop() {
    const g = this.g;
    if (!this.active) return;
    this.active = false;
    g.audio.siren?.(false);
    if (this.spec.seat) { this.model.group.remove(g.player.avatar.root); g.scene.add(g.player.avatar.root); }
    g.player.avatar.root.visible = true;
    this.exiting = false;
    const at = exitSpot(g.world, { x: this.pos.x, z: this.pos.z, yaw: this.yaw }, { side: -1, others: g.transport?.boxes?.() || [] });
    g.player.spawn(at.x, at.z, this.yaw);
    g.scene.remove(this.model.group);
    const cb = this.onStop; this.onStop = null; cb?.();
  }

  place(dt) {
    const g = this.g, W = g.world, s = this.spec;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const hf = W.heightAt(this.pos.x + fx * s.wheelbase / 2, this.pos.z + fz * s.wheelbase / 2);
    const hr = W.heightAt(this.pos.x - fx * s.wheelbase / 2, this.pos.z - fz * s.wheelbase / 2);
    this.pos.y = (hf + hr) / 2;
    const m = this.model.group;
    m.position.copy(this.pos);
    const pitch = Math.atan2(hr - hf, s.wheelbase);
    m.rotation.set(dt ? damp(m.rotation.x, pitch, 8, dt) : pitch, this.yaw, this.kind === 'scooter' || s.two ? -this.steer * clamp(this.speed / 10, 0, 1) * 0.35 : 0, 'YXZ');
  }

  update(dt) {
    const g = this.g, i = g.input, W = g.world, s = this.spec;
    const prev = { x: this.pos.x, z: this.pos.z, yaw: this.yaw };
    if (this._groundWarn) this._groundWarn = Math.max(0, this._groundWarn - dt);
    const ax = i.axis();
    if (this.exiting) ax.y = 0;                    // you asked to get out: the throttle is ignored and the brakes are on
    const brake = i.down('Space') || this.exiting;
    const target = ax.y > 0 ? s.top * (i.down('ShiftLeft', 'ShiftRight') ? 1.15 : 1) : ax.y < 0 ? (this.speed > 0.5 ? 0 : -4) : 0;
    const rate = ax.y < 0 && this.speed > 0.5 ? 9 : ax.y ? s.acc : 1.8;
    this.speed = damp(this.speed, brake ? 0 : target, brake ? 5 : rate / Math.max(1, Math.abs(target - this.speed)) * 1.4, dt);
    this.steer = damp(this.steer, -ax.x, 5, dt);
    const turn = (this.speed / s.wheelbase) * Math.tan(this.steer * 0.5) * dt;
    this.yaw = wrapAngle(this.yaw + turn);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const nx = this.pos.x + fx * this.speed * dt, nz = this.pos.z + fz * this.speed * dt;
    if (W.vehicleKeepOut(nx, nz) || W.vehicleKeepOut(nx + fx * 2, nz + fz * 2) || W.vehicleKeepOut(nx - fx * 1.5, nz - fz * 1.5)) { this.speed *= -0.2; g.audio.bump(); if (!this._groundWarn) { this._groundWarn = 3; g.ui.toast('Vehicles cannot go on the grounds or into the lakes. Walk in.', 'info', 'Grounds'); } }
    else { this.pos.x = nx; this.pos.z = nz; }
    const two = s.two || this.kind === 'scooter';
    if (sweepBlocked(W, prev, { x: this.pos.x, z: this.pos.z, yaw: this.yaw }, two ? 1.1 : this.kind === 'ambulance' ? 3.3 : 2.3, two ? 0.5 : 1.05)) {
      if (Math.abs(this.speed) > 3) { g.audio.bump(); g.progress.tire(0.5); }
      this.pos.x = prev.x; this.pos.z = prev.z; this.yaw = prev.yaw; this.speed = 0;
    }
    // fences round the courts and grounds (and the cycle barriers at their gates)
    { const t = { x: this.pos.x, z: this.pos.z }; if (W.collide(t, two ? 0.5 : 1.0, this.pos.y, 'bike')) { this.pos.x = prev.x; this.pos.z = prev.z; this.yaw = prev.yaw; this.speed = 0; } }
    if (W.wallStep(this._prev || this.pos, this.pos, 'car', g.clock.hour, 2)) this.speed *= 0.5;
    (this._prev ||= this.pos.clone()).copy(this.pos);

    this.model.spin?.(this.speed * dt);
    this.model.lights?.(this.siren, dt);
    if (i.hit('KeyQ') && this.kind === 'ambulance') { this.siren = !this.siren; }
    if (i.hit('KeyR')) g.audio.horn(0, 0.9);
    if (i.hit('KeyV')) this.view = this.view === 'chase' ? 'first' : 'chase';
    g.audio.siren?.(this.siren && this.kind === 'ambulance');
    this.place(dt);
    g.player.pos.copy(this.pos);
    if (this.spec.seat) g.player.avatar.animate({ type: 'scooterRide' }, dt);
    g.player.look(i, -0.3, 1.2);
  }

  updateCamera(cam, dt) {
    const g = this.g;
    if (this.view === 'first') {
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const e = new THREE.Vector3(this.pos.x + fx * (this.kind === 'ambulance' ? 2.2 : 0.1), this.pos.y + (this.kind === 'ambulance' ? 1.8 : 1.55), this.pos.z + fz * (this.kind === 'ambulance' ? 2.2 : 0.1));
      cam.position.copy(e);
      const yaw = this.yaw + g.player.camYaw * 0.5;
      cam.lookAt(e.x + Math.sin(yaw) * 10, e.y - 0.8, e.z + Math.cos(yaw) * 10);
      return;
    }
    const t = new THREE.Vector3(this.pos.x, this.pos.y + (this.kind === 'ambulance' ? 2.2 : 1.4), this.pos.z);
    orbitCamera(g.world, cam, t, this.yaw + g.player.camYaw, Math.max(0.08, g.player.camPitch * 0.7), this.spec.cam, dt);
  }
}

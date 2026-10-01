import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { clamp, damp, angleDamp, wrapAngle } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);

/** On-foot player: walk / sprint / jump / fly / swim, with 1st and 3rd person cameras. */
export class Player {
  constructor(game, look) {
    this.g = game;
    this.avatar = new Avatar(look);
    game.scene.add(this.avatar.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.camYaw = 0; this.camPitch = 0.28; this.camDist = 6.5;
    this.view = 'third';
    this.flying = false; this.onGround = true; this.swimming = false;
    this.stepAcc = 0; this.airTime = 0; this.speed = 0;
    this.surface = 'grass';
    this.roofTime = 0;
  }

  get scale() { return this.avatar.root.scale.x; }

  spawn(x, z, yaw = 0) {
    const W = this.g.world;
    // never spawn inside a building: spiral outwards to the nearest free spot
    if (W.buildingAt(x, z) || W.waterAt(x, z)) {
      search: for (let r = 2; r < 80; r += 2)
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
          if (!W.buildingAt(px, pz) && !W.waterAt(px, pz) && W.insideCampus(px, pz)) { x = px; z = pz; break search; }
        }
    }
    this.pos.set(x, W.heightAt(x, z) + 0.05, z);
    this.vel.set(0, 0, 0);
    this.heading = yaw; this.camYaw = yaw;
    this.flying = false;
    this.avatar.root.position.copy(this.pos);
  }

  setLook(look) { this.avatar.setLook(look); }

  /** Mouse look shared by all modes. */
  look(input, pitchMin = -0.55, pitchMax = 1.45) {
    this.camYaw = wrapAngle(this.camYaw - input.dx * 0.0024);
    this.camPitch = clamp(this.camPitch + input.dy * 0.0022, pitchMin, pitchMax);
    if (input.wheel) this.camDist = clamp(this.camDist * Math.pow(1.13, input.wheel), 1.8, this.flying ? 90 : 40);
  }

  update(dt) {
    const { input, audio } = this.g;
    const world = this.g.env || this.g.world;
    const first = this.view === 'first';
    this.look(input, first ? -1.35 : -0.55, first ? 1.35 : 1.45);
    if (input.hit('KeyF') && !this.g.interior?.active) {
      this.flying = !this.flying;
      audio.whoosh();
      this.g.ui.toast(this.flying ? 'Flying: Space to rise, C to descend, Shift for speed' : 'Walking', 'info');
      if (this.flying) this.vel.y = 4;
    }
    const ax = input.axis();
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const rx = -fz, rz = fx;
    let wx = fx * ax.y + rx * ax.x, wz = fz * ax.y + rz * ax.x;
    const moving = Math.hypot(wx, wz) > 0.05;
    const sprint = input.down('ShiftLeft', 'ShiftRight');
    const water = world.waterAt(this.pos.x, this.pos.z);
    const terrain = world.heightAt(this.pos.x, this.pos.z);
    const deep = water && (water.kind === 'pool' || water.level - terrain > 1.0) && !this.flying && this.pos.y < water.level + 0.3;
    if (deep && !this.swimming) { audio.splash(); this.g.progress.unlock('swim'); this.g.splash?.burst(this.pos.x, water.level, this.pos.z, 40, 3.2); this.g.splash?.ripple(this.pos.x, water.level, this.pos.z, 1.6); }
    this.swimming = !!deep;

    let maxV = this.flying ? (sprint ? 65 : 18) : this.swimming ? 2.2 : sprint ? 7.8 : 3.4;
    const accel = this.flying ? 4 : this.onGround || this.swimming ? 14 : 3;
    this.vel.x = damp(this.vel.x, wx * maxV, accel, dt);
    this.vel.z = damp(this.vel.z, wz * maxV, accel, dt);

    if (this.flying) {
      let vy = 0;
      if (input.down('Space')) vy += 1;
      if (input.down('KeyC', 'ControlLeft')) vy -= 1;
      this.vel.y = damp(this.vel.y, vy * (sprint ? 30 : 9), 4, dt);
    } else if (this.swimming) {
      // float at the surface: swimming flat when moving, treading water (head up) when still
      this.vel.y = 0;
      const hsw = Math.hypot(this.vel.x, this.vel.z);
      this.pos.y = damp(this.pos.y, water.level - (hsw > 0.35 ? 0.3 : 1.52) * this.scale + Math.sin(this.g.time * 2.2) * 0.03, 5, dt);
      this.waterLevel = water.level; this.crawling = hsw > 0.35;
    } else {
      this.vel.y -= 24 * dt;
      if (this.onGround && input.hit('Space')) { this.vel.y = 7.4; this.onGround = false; audio.jump(); }
    }

    const prevY = this.pos.y, prevX = this.pos.x, prevZ = this.pos.z;
    this.pos.addScaledVector(this.vel, dt);
    // collisions with buildings and the campus wall (on foot you can only leave through an open gate)
    if (world.collide(this.pos, 0.34, this.pos.y) && this.flying) this.vel.multiplyScalar(0.6);
    if (this.flying || !world.wallStep) world.clampToCampus(this.pos, this.flying ? -40 : 1.1);
    else if (world.wallStep({ x: prevX, z: prevZ }, this.pos, 'walk', this.g.clock.hour)) this.g.onestop?.blockedAt(world.lastBlock);
    if (this.flying && this.pos.y > 700) this.pos.y = 700;

    const g = world.groundAt(this.pos.x, this.pos.z, Math.max(prevY, this.pos.y));
    if (!this.swimming) {
      if (this.pos.y <= g) {
        if (!this.onGround && this.vel.y < -9) audio.land();
        // a step, a kerb or a bed: climb it quickly instead of popping up (a roof or a landing snaps at once)
        const rise = g - this.pos.y;
        this.pos.y = this.onGround && rise > 0.04 && rise <= 0.8 ? this.pos.y + Math.min(rise, 7 * dt) : g;
        if (this.vel.y < 0) this.vel.y = 0;
        this.onGround = true;
      } else if (!this.flying) {
        this.onGround = this.pos.y - g < 0.25 && this.vel.y <= 0;
        if (this.onGround) this.pos.y = damp(this.pos.y, g, 20, dt);
      } else this.onGround = false;
    }
    const onRoof = world.buildingAt(this.pos.x, this.pos.z) && this.onGround;
    if (onRoof) { this.roofTime += dt; if (this.roofTime > 1) this.g.progress.unlock('roof'); } else this.roofTime = 0;

    // facing
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.speed = hs;
    if (first) this.heading = this.camYaw;
    else if (hs > 0.3) this.heading = angleDamp(this.heading, Math.atan2(this.vel.x, this.vel.z), 10, dt);

    // footsteps
    if (this.onGround && hs > 0.5 && !this.flying) {
      this.stepAcc += hs * dt;
      const stride = sprint ? 1.15 : 0.78;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        // what is underfoot: roofs, indoor tiles, tarmac, paving, gravel paths, the jetty, grass
        const rd = !this.g.interior?.active && this.g.graph.roadAt ? this.g.graph.roadAt(this.pos.x, this.pos.z, 6, () => true) : null;
        this.surface = onRoof ? 'roof' : this.g.interior?.active ? 'tile'
          : rd && rd.d < (rd.hw || 1.2) + 0.3 ? (rd.e.kind === 'track' || rd.e.kind === 'path' ? 'gravel' : 'road')
          : this.g.boats?.jetties.some((j) => Math.hypot(j.x - this.pos.x, j.z - this.pos.z) < 7) ? 'wood' : 'grass';
        audio.footstep(this.swimming ? 'water' : this.surface);
      }
    }
    if (this.swimming) {
      // a splash each time a hand enters the water, ripples around the swimmer
      const ph = this.avatar.strokePhase ?? 0, k = Math.floor(ph / Math.PI);
      const wl = water.level;
      if (moving && k !== this._strokeK) {
        this._strokeK = k;
        const side = k % 2 ? 1 : -1, fx = Math.sin(this.heading), fz = Math.cos(this.heading);
        const hx = this.pos.x + fx * 1.1 + fz * side * 0.3, hz = this.pos.z + fz * 1.1 - fx * side * 0.3;
        this.g.splash?.burst(hx, wl, hz, 10, 1.4);
        audio.noise(0.22, { f: 1400 + Math.random() * 500, q: 0.7, gain: 0.07 });
      }
      this.rippleT = (this.rippleT || 0) - dt;
      if (this.rippleT <= 0) { this.rippleT = moving ? 0.35 : 0.9; this.g.splash?.ripple(this.pos.x, wl, this.pos.z, moving ? 0.9 : 0.6); }
    }

    const type = this.swimming ? (hs > 0.35 ? 'swim' : 'tread') : this.flying ? 'fly' : !this.onGround ? 'jump' : hs > 5 ? 'run' : hs > 0.3 ? 'walk' : this.emote || 'idle';
    if (hs > 0.3) this.emote = null;
    this.avatar.root.position.copy(this.pos);
    this.avatar.root.rotation.set(0, this.heading, 0);
    this.avatar.animate({ type, speed: this.flying ? Math.hypot(hs, this.vel.y) : hs, carry: this.carry }, dt);
  }

  /** Third / first person camera around the on-foot player. */
  updateCamera(camera, dt) {
    const s = this.scale;
    const J = this.avatar.J;
    if (this.view === 'first') {
      J.head.visible = false;
      const eye = new THREE.Vector3(this.pos.x, this.pos.y + 1.64 * s, this.pos.z);
      if (this.swimming) eye.y = (this.waterLevel ?? this.pos.y + 1.4 * s) + (this.crawling ? 0.26 : 0.13) * s;   // just above the water
      eye.x += Math.sin(this.heading) * 0.14; eye.z += Math.cos(this.heading) * 0.14;
      camera.position.copy(eye);
      const p = -this.camPitch;
      camera.lookAt(eye.x + Math.sin(this.camYaw) * Math.cos(p), eye.y + Math.sin(p), eye.z + Math.cos(this.camYaw) * Math.cos(p));
      return;
    }
    J.head.visible = true;
    const target = new THREE.Vector3(this.pos.x, this.pos.y + 1.5 * s, this.pos.z);
    orbitCamera(this.g.env || this.g.world, camera, target, this.camYaw, this.camPitch, this.camDist, dt);
  }
}

const _dir = new THREE.Vector3();
/** Orbit camera with building/terrain avoidance. Returns the camera position. */
export function orbitCamera(world, camera, target, yaw, pitch, dist, dt, smooth = true) {
  _dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  let d = dist;
  // march out from the target; stop before walls and hills
  for (let t = 0.6; t <= dist; t += 0.5) {
    const x = target.x + _dir.x * t, y = target.y + _dir.y * t, z = target.z + _dir.z * t;
    let blocked;
    if (world.cameraBlocked) blocked = world.cameraBlocked(x, y, z);
    else { const b = world.buildingAt(x, z); blocked = (b && y < b.roof + 0.3 && y > b.base) || y < world.heightAt(x, z) + 0.35; }
    if (blocked) { d = Math.max(0.6, t - 0.5); break; }
  }
  const want = new THREE.Vector3().copy(target).addScaledVector(_dir, d);
  const minY = world.heightAt(want.x, want.z) + 0.4;
  if (want.y < minY) want.y = minY;
  if (world.cameraBlocked) { if (want.y < minY) want.y = minY; }
  if (smooth && camera.userData.orbitInit) camera.position.lerp(want, 1 - Math.exp(-18 * dt));
  else camera.position.copy(want);
  camera.userData.orbitInit = true;
  camera.lookAt(target);
  return camera.position;
}
export { UP };

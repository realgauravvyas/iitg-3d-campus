import * as THREE from 'three';
import { makeBicycle } from './models.js';
import { clamp, damp, wrapAngle } from './util.js';
import { orbitCamera } from './player.js';

const WB = 1.05;

/** The player's own bicycle: ride it, park it, remount it. */
export class BikeRide {
  constructor(game) {
    this.g = game;
    this.bike = null;
    this.pos = new THREE.Vector3();
    this.heading = 0; this.speed = 0; this.steer = 0; this.lean = 0; this.pitch = 0;
    this.riding = false;
    this.tickAcc = 0; this.bumpCool = 0; this.idleLook = 0;
    this.camYawOff = 0; this.view = 'third';
    this.dist = 0;
  }

  ensureBike() {
    const L = this.g.player.avatar.look;
    const color = this.borrowed ? this.borrowed.color : L.bikeColor, style = this.borrowed ? this.borrowed.style : L.bikeStyle;
    if (this.bike && this.bike.color === color && this.bike.style === style) return;
    if (this.bike) this.g.scene.remove(this.bike.group);
    this.bike = makeBicycle(color, style);
    this.g.scene.add(this.bike.group);
    this.bike.group.visible = false;
  }

  /** take a bicycle from a cycle stand (it stays yours until you borrow another) */
  borrow(pb) {
    const g = this.g;
    if (this.borrowed && this.borrowed !== pb) g.props.setParked(this.borrowed, true);   // return the previous one to its stand
    this.borrowed = pb;
    g.props.setParked(pb, false);
    this.ensureBike();
    this.pos.set(pb.x, g.world.heightAt(pb.x, pb.z), pb.z);
    this.heading = pb.a + Math.PI;
    this.placeParked();
    g.setMode('bike');
    g.ui.toast('Borrowed from the stand. Park it anywhere when you are done.', 'info', 'Bicycle');
  }

  /** Put the bike next to the player (B key). */
  summon() {
    this.ensureBike();
    const p = this.g.player;
    const side = p.heading + Math.PI / 2;
    this.pos.set(p.pos.x + Math.sin(side) * 1.1, 0, p.pos.z + Math.cos(side) * 1.1);
    this.g.world.collide(this.pos, 0.5, -1e9);
    this.heading = p.heading;
    this.speed = 0;
    this.placeParked();
  }

  placeParked() {
    const w = this.g.world;
    this.pos.y = w.heightAt(this.pos.x, this.pos.z);
    this.bike.group.visible = true;
    this.bike.group.position.copy(this.pos);
    this.bike.group.rotation.set(0, this.heading, 0.13, 'YXZ'); // leaning on the kick-stand
    this.bike.setSteer(0.3);
  }

  nearPlayer() {
    return this.bike && this.bike.group.visible && !this.riding && this.bike.group.position.distanceTo(this.g.player.pos) < 2.6;
  }

  mount() {
    this.ensureBike();
    if (!this.bike.group.visible) this.summon();
    const p = this.g.player;
    this.riding = true;
    this.speed = 0;
    this.camYawOff = 0;
    p.flying = false;
    this.bike.group.add(p.avatar.root);
    p.avatar.root.position.set(0, 0, 0);
    p.avatar.root.rotation.set(0, 0, 0);
    this.g.audio.bell(0, 0.4);
    this.g.progress.unlock('first_ride');
  }

  dismount() {
    const p = this.g.player;
    this.riding = false;
    this.bike.group.remove(p.avatar.root);
    this.g.scene.add(p.avatar.root);
    const side = this.heading - Math.PI / 2;
    p.spawn(this.pos.x + Math.sin(side) * 0.9, this.pos.z + Math.cos(side) * 0.9, this.heading);
    p.camYaw = this.heading + this.camYawOff;
    this.speed = 0;
    this.placeParked();
  }

  update(dt) {
    const { input, world, audio, player } = this.g;
    const ax = input.axis();
    const sprint = input.down('ShiftLeft', 'ShiftRight');
    // mouse orbit, drifting back behind the rider when idle
    if (Math.abs(input.dx) + Math.abs(input.dy) > 0) this.idleLook = 1.6;
    this.idleLook -= dt;
    this.camYawOff = wrapAngle(this.camYawOff - input.dx * 0.0024);
    player.camPitch = clamp(player.camPitch + input.dy * 0.0022, -0.4, 1.3);
    if (input.wheel) player.camDist = clamp(player.camDist * Math.pow(1.13, input.wheel), 2.5, 30);
    if (this.idleLook < 0 && this.view === 'third') this.camYawOff = damp(this.camYawOff, 0, 2.5, dt);
    if (input.hit('KeyR')) { audio.bell(); this.g.progress.count('bells'); }

    const vmax = sprint ? 11 : 7.2;
    const throttle = Math.max(0, ax.y);
    const brake = ax.y < 0 ? -ax.y : 0;
    if (throttle > 0) this.speed += (throttle * (sprint ? 3.4 : 2.4) * (1 - this.speed / vmax)) * dt;
    if (brake > 0) this.speed -= (this.speed > 0.2 ? 6 : 1.2) * brake * dt;
    this.speed -= (0.05 + this.speed * 0.02) * dt * (throttle ? 0 : 1);
    // slope: harder uphill, free speed downhill
    const hF = world.heightAt(this.pos.x + Math.sin(this.heading) * 0.55, this.pos.z + Math.cos(this.heading) * 0.55);
    const hR = world.heightAt(this.pos.x - Math.sin(this.heading) * 0.5, this.pos.z - Math.cos(this.heading) * 0.5);
    const slope = (hF - hR) / WB;
    this.speed -= slope * 9.81 * 0.55 * dt;
    this.speed = clamp(this.speed, -1.5, 16);
    if (Math.abs(this.speed) < 0.02 && !throttle) this.speed = 0;

    const maxSteer = clamp(0.55 - Math.abs(this.speed) * 0.035, 0.18, 0.55);
    this.steer = damp(this.steer, -ax.x * maxSteer, 7, dt);
    const yawRate = (this.speed * Math.tan(this.steer)) / WB;
    this.heading = wrapAngle(this.heading + yawRate * dt);

    const prev = this.pos.clone();
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    this.bumpCool -= dt;
    const hitB = world.collide(this.pos, 0.55, this.pos.y, 'bike');
    const w = world.waterAt(this.pos.x, this.pos.z);
    const onGround = !!world.sportsAt?.(this.pos.x, this.pos.z);            // the sports grounds are for people on foot
    const hitW = (w && w.level - world.heightAt(this.pos.x, this.pos.z) > 0.5) || onGround;
    if (hitW) this.pos.copy(prev);
    if (onGround) { this.groundT = (this.groundT || 0) - dt; if (this.groundT <= 0) { this.groundT = 5; this.g.ui.toast('Cycles cannot go on the grounds. Park it and walk in.', 'info', 'Grounds'); } }
    const hitWall = world.wallStep ? world.wallStep(prev, this.pos, 'bike', this.g.clock.hour, 1.2) : world.clampToCampus(this.pos, 1.2);
    if (hitWall && world.wallStep) this.g.onestop?.blockedAt(world.lastBlock);
    if ((hitB || hitW || hitWall) && Math.abs(this.speed) > 1.5) {
      this.speed *= 0.25;
      if (this.bumpCool < 0) { audio.bump(); this.bumpCool = 0.6; }
    }
    const moved = Math.hypot(this.pos.x - prev.x, this.pos.z - prev.z);
    this.dist += moved;
    this.g.progress.addStat('bikeDist', moved);
    this.pos.y = world.heightAt(this.pos.x, this.pos.z);
    this.pitch = damp(this.pitch, Math.atan2(hR - hF, WB), 8, dt);
    this.lean = damp(this.lean, clamp(-Math.atan((this.speed * yawRate) / 9.81) * 0.9, -0.55, 0.55), 6, dt);

    const b = this.bike;
    b.group.position.copy(this.pos);
    b.group.rotation.set(this.pitch, this.heading, this.lean, 'YXZ');
    b.setSteer(this.steer * 1.4);
    b.spin(this.speed * dt);
    if (throttle > 0 && this.speed > 0) {
      b.setCrank(b.crankAngle + (this.speed / b.R) * dt / 2.3 + throttle * dt * 1.2);
    } else if (Math.abs(this.speed) > 0.4) {
      // coasting: the rear hub ticks
      this.tickAcc += Math.abs(this.speed) * dt * 9;
      if (this.tickAcc > 1) { this.tickAcc = 0; audio.freewheelTick(); }
    }
    player.pos.copy(this.pos);
    player.heading = this.heading;
    player.avatar.animate({ type: 'bike', bike: b, speed: this.speed }, dt);
  }

  updateCamera(camera, dt) {
    const p = this.g.player;
    const J = p.avatar.J;
    if (this.view === 'first') {
      J.head.visible = false;
      const head = new THREE.Vector3();
      J.head.getWorldPosition(head);
      head.addScaledVector(new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)), 0.1);
      camera.position.copy(head);
      const yaw = this.heading + this.camYawOff, pitch = -p.camPitch * 0.6 - 0.12;
      camera.lookAt(head.x + Math.sin(yaw) * Math.cos(pitch), head.y + Math.sin(pitch), head.z + Math.cos(yaw) * Math.cos(pitch));
      camera.rotateZ(-this.lean * 0.5);
      return;
    }
    J.head.visible = true;
    const target = new THREE.Vector3(this.pos.x, this.pos.y + 1.45, this.pos.z);
    orbitCamera(this.g.world, camera, target, this.heading + this.camYawOff, Math.max(0.12, p.camPitch * 0.8), Math.max(3.8, p.camDist * 0.85), dt);
  }
}

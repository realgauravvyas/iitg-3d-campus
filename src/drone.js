import * as THREE from 'three';
import { makeDrone } from './models.js';
import { clamp, damp, wrapAngle } from './util.js';
import { ELEV0 } from './world.js';

const GEOFENCE = 60;       // metres beyond the campus wall
const MAX_AGL = 400;       // metres above ground
const FLIGHT_TIME = 12 * 60;

/** Quadcopter you pilot in first person (FPV) or third person. */
export class DroneMode {
  constructor(game) {
    this.g = game;
    this.drone = makeDrone();
    this.drone.group.visible = false;
    game.scene.add(this.drone.group);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.roll = 0; this.gimbal = -0.15;
    this.active = false;
    this.view = 'fpv';
    this.battery = 1;
    this.rth = false;
    this.home = new THREE.Vector3();
    this.thrust = 0;
    this.warnCool = 0;
    this.leaving = false;
  }

  start() {
    const p = this.g.player;
    this.active = true; this.leaving = false; this.rth = false;
    this.battery = 1;
    // the pilot stands on the ground with the controller while the drone flies
    p.flying = false; p.swimming = false;
    p.vel?.set(0, 0, 0);
    p.pos.y = this.g.world.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.5);
    p.avatar.root.position.copy(p.pos);
    this.yaw = p.heading;
    this.pos.set(p.pos.x + Math.sin(p.heading) * 1.8, p.pos.y + 0.4, p.pos.z + Math.cos(p.heading) * 1.8);
    this.home.copy(this.pos);
    this.vel.set(0, 2.5, 0);
    this.drone.group.visible = true;
    this.g.ui.droneHud(true, this);
    this.g.ui.toast(`Drone ${this.view === 'fpv' ? 'FPV' : 'third-person'} view. V switches camera, X returns home, G lands.`, 'info');
    this.g.audio.whoosh();
  }

  finish() {
    this.active = false;
    this.drone.group.visible = false;
    this.g.ui.droneHud(false);
  }

  land() { this.leaving = true; this.rth = true; }

  latLon() {
    const [lon0, lat0] = this.g.world.data.meta.origin;
    const phi = lat0 * Math.PI / 180;
    const ky = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
    const kx = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
    return [lat0 + -this.pos.z / ky, lon0 + this.pos.x / kx];
  }

  update(dt) {
    const { input, world, ui, audio, player, progress } = this.g;
    if (input.hit('KeyV')) { this.view = this.view === 'fpv' ? 'third' : 'fpv'; ui.toast(this.view === 'fpv' ? 'FPV camera' : 'Third-person camera', 'info'); }
    if (input.hit('KeyX')) { this.rth = !this.rth; ui.toast(this.rth ? 'Returning to home point' : 'Return to home cancelled', 'info'); }
    this.battery -= dt / FLIGHT_TIME * (0.8 + this.thrust * 0.4);
    if (this.battery < 0.2 && !this.lowWarned) { this.lowWarned = true; ui.toast('Drone battery low: returning home soon', 'warn'); audio.tone(880, 0.2, { gain: 0.1, type: 'square' }); }
    if (this.battery < 0.06 && !this.rth) { this.rth = true; ui.toast('Critical battery: auto return-to-home', 'warn'); }

    const sport = input.down('ShiftLeft', 'ShiftRight');
    const ax = input.axis();
    let up = 0;
    if (input.down('Space')) up += 1;
    if (input.down('KeyC', 'ControlLeft')) up -= 1;
    let yawIn = 0;
    if (input.down('KeyQ')) yawIn += 1;
    if (input.down('KeyE')) yawIn -= 1;
    this.yaw = wrapAngle(this.yaw - input.dx * 0.0022 + yawIn * 1.6 * dt);
    this.gimbal = clamp(this.gimbal - input.dy * 0.002, -1.45, 0.35);

    const vmax = sport ? 28 : 14;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    let want = new THREE.Vector3().addScaledVector(fwd, ax.y * vmax).addScaledVector(right, ax.x * vmax);
    let wantY = up * (sport ? 9 : 5);
    if (this.rth) {
      const target = this.leaving ? player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)) : this.home;
      const flat = new THREE.Vector3(target.x - this.pos.x, 0, target.z - this.pos.z);
      const d = flat.length();
      const cruiseAlt = world.groundAt(this.pos.x, this.pos.z) + 30;
      if (d > 4) {
        want = flat.normalize().multiplyScalar(Math.min(vmax * (this.leaving ? 1.6 : 1), d * 0.8));
        wantY = clamp((Math.max(cruiseAlt, target.y) - this.pos.y) * 0.8, -6, 6);
        this.yaw = wrapAngle(this.yaw + wrapAngle(Math.atan2(want.x, want.z) - this.yaw) * Math.min(1, dt * 2));
      } else {
        want.set(0, 0, 0);
        wantY = clamp((target.y - this.pos.y) * 1.2, -4, 2);
        if (Math.abs(target.y - this.pos.y) < 0.6) {
          if (this.leaving) { this.finish(); this.g.setMode('walk'); return; }
          this.rth = false; ui.toast('Landed at home point', 'info');
        }
      }
    }
    const accel = new THREE.Vector3(want.x - this.vel.x, 0, want.z - this.vel.z).multiplyScalar(2.2);
    this.vel.x += accel.x * dt; this.vel.z += accel.z * dt;
    this.vel.y = damp(this.vel.y, wantY, 3, dt);
    // light wind gusts over the Brahmaputra valley
    const t = performance.now() / 1000;
    this.vel.x += Math.sin(t * 0.3) * 0.15 * dt; this.vel.z += Math.cos(t * 0.23) * 0.12 * dt;
    this.pos.addScaledVector(this.vel, dt);

    // obstacles
    const g = world.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y < g + 0.35) { this.pos.y = g + 0.35; if (this.vel.y < 0) this.vel.y = 0; }
    if (world.collide(this.pos, 0.5, this.pos.y - 0.3)) { this.vel.multiplyScalar(0.3); }
    if (this.pos.y - g > MAX_AGL) { this.pos.y = g + MAX_AGL; this.vel.y = Math.min(0, this.vel.y); this.warn(`Max altitude ${MAX_AGL} m`); }
    if (world.clampToCampus(this.pos, -GEOFENCE)) { this.vel.multiplyScalar(0.2); this.warn('Geofence: this drone only flies over IIT Guwahati'); }
    this.warnCool -= dt;

    const agl = this.pos.y - world.heightAt(this.pos.x, this.pos.z);
    if (agl > 150) progress.unlock('drone_high');
    const w = world.waterAt(this.pos.x, this.pos.z);
    if (w && w.name === 'Serpentine') progress.unlock('serpentine');
    this.thrust = clamp(0.35 + Math.abs(this.vel.y) * 0.06 + accel.length() * 0.02, 0, 1);

    // attitude follows acceleration
    const af = accel.dot(fwd), ar = accel.dot(right);
    this.pitch = damp(this.pitch, clamp(af * 0.035, -0.45, 0.45), 6, dt);
    this.roll = damp(this.roll, clamp(ar * 0.035, -0.45, 0.45), 6, dt);
    const d = this.drone.group;
    d.position.copy(this.pos);
    d.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.drone.update(dt, this.thrust);
    progress.discoverNear(this.pos.x, this.pos.z, 30);
    progress.collectNear(this.pos, 3.5);

    // pilot stands still holding the controller, looking at the drone
    const dx = this.pos.x - player.pos.x, dz = this.pos.z - player.pos.z;
    player.heading = damp(player.heading, player.heading + wrapAngle(Math.atan2(dx, dz) - player.heading), 3, dt);
    player.avatar.root.rotation.set(0, player.heading, 0);
    player.pos.y = world.groundAt(player.pos.x, player.pos.z, player.pos.y + 0.5);
    player.avatar.root.position.copy(player.pos);
    const dist = Math.hypot(dx, dz);
    player.avatar.animate({ type: 'drone', look: clamp(-Math.atan2(this.pos.y - player.pos.y - 1.5, dist), -0.8, 0.4) }, dt);
    ui.droneTick(this, agl, dist);
  }

  warn(msg) {
    if (this.warnCool > 0) return;
    this.warnCool = 3;
    this.g.ui.toast(msg, 'warn');
    this.g.audio.tone(660, 0.15, { gain: 0.08, type: 'square' });
  }

  updateCamera(camera, dt) {
    if (this.view === 'fpv') {
      const c = new THREE.Vector3(0, -0.12, 0.34).applyEuler(new THREE.Euler(0, this.yaw, 0)).add(this.pos);
      camera.position.copy(c);
      camera.rotation.set(this.gimbal, this.yaw + Math.PI, 0, 'YXZ');
      camera.rotation.z = 0;
      // FPV feel: a little of the drone's roll leaks into the image
      if (!this.g.progress.settings.calm) camera.rotateZ(this.roll * 0.35);
      return;
    }
    const back = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const want = this.pos.clone().addScaledVector(back, 4.2).add(new THREE.Vector3(0, 1.4 - this.gimbal * 2, 0));
    const gh = this.g.world.heightAt(want.x, want.z) + 0.4;
    if (want.y < gh) want.y = gh;
    camera.position.lerp(want, 1 - Math.exp(-8 * dt));
    camera.lookAt(this.pos.x, this.pos.y + 0.2, this.pos.z);
  }
}
export { ELEV0 };

// The campus tour you can take on foot, by bicycle or by drone (the bus has its own driver in
// bus.js). Same stops and the same commentary as the bus, but walkers and cyclists go right in
// where buses cannot (the academic complex, hostel courtyards), and the drone flies straight
// over the roofs and circles each place. Speeds go from a stroll up to a time-lapse.
import * as THREE from 'three';
import { makeStops } from './bus.js';
import { FILTERS, PathFollower } from './route.js';
import { clamp, damp, wrapAngle, angleDamp, fmtDist } from './util.js';
import { orbitCamera } from './player.js';

const SPEEDS = {
  walk: [[1.4, 'Stroll'], [2.4, 'Brisk walk'], [4.5, 'Jog'], [9, 'Very fast'], [18, 'Super fast'], [36, 'Time-lapse']],
  bike: [[4.5, 'Easy ride'], [7, 'Cruise'], [11, 'Fast'], [18, 'Very fast'], [32, 'Time-lapse']],
  drone: [[9, 'Gentle'], [15, 'Cruise'], [26, 'Fast'], [45, 'Very fast']],
};
const START_SPEED = { walk: 3, bike: 1, drone: 1 };
const VIEWS = { walk: ['follow', 'side', 'first', 'top'], bike: ['follow', 'side', 'first', 'top'], drone: ['chase', 'fpv', 'top'] };
const VIEW_NAMES = { follow: 'Follow camera', side: 'Side tracking', first: 'First person', top: 'Overhead', chase: 'Chase camera', fpv: 'Drone FPV' };
const TITLES = { walk: 'Walking tour', bike: 'Cycle tour', drone: 'Drone tour' };

export class CampusTour {
  constructor(game) {
    this.g = game;
    this.kind = 'walk';
    this.active = false;
    this.speedIx = { ...START_SPEED };
    this.view = 'follow';
    this.plans = {};
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.v = 0; this.s = 0;
    this.paused = false;
  }

  /** plan (once per kind) the route through all the stops, starting nearest to you */
  plan(kind) {
    const { world, graph, player } = this.g;
    const stops = makeStops(world);
    let start = 0, bd = Infinity;
    stops.forEach((s, i) => { const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z); if (d < bd) { bd = d; start = i; } });
    const filter = kind === 'walk' ? FILTERS.walk : FILTERS.bike;
    const r = graph.tour(stops, filter, { loop: true, start });
    if (kind === 'drone') return this.planDrone(r.order, start);
    // walkers keep to the verge, cyclists to the left edge of the road
    const path = new PathFollower(r.pts, kind === 'walk' ? (hw) => (hw ? hw + 0.45 : 0) : (hw) => (hw ? hw - 0.45 : 0));
    const list = r.stopAt.map(({ stop, s }) => ({ ...stop, s: Math.max(0, s - 3) }));
    return { path, stops: list, loop: true };
  }

  /** straight lines between the stops, high enough to clear every roof, easing over the hills */
  planDrone(order) {
    const W = this.g.world;
    const pts = [];
    const stopIx = [];
    for (let k = 0; k <= order.length; k++) {
      const a = order[k % order.length];
      if (k > 0) {
        const b = order[k - 1];
        const L = Math.hypot(a.x - b.x, a.z - b.z), n = Math.max(1, Math.ceil(L / 6));
        for (let i = 1; i <= n; i++) pts.push([b.x + (a.x - b.x) * (i / n), b.z + (a.z - b.z) * (i / n)]);
      } else pts.push([a.x, a.z]);
      if (k < order.length) stopIx.push(pts.length - 1);
    }
    // clearance: 38 m over the ground, 14 m over any roof within 25 m
    const raw = pts.map(([x, z]) => {
      let y = W.heightAt(x, z) + 38;
      for (let a = 0; a < 6.28; a += 1.05) for (const r of [0, 12, 25]) { const b = W.buildingAt(x + Math.cos(a) * r, z + Math.sin(a) * r); if (b) y = Math.max(y, b.roof + 14); }
      return y;
    });
    const alt = raw.map((_, i) => { let m = 0; for (let j = Math.max(0, i - 8); j <= Math.min(raw.length - 1, i + 8); j++) m = Math.max(m, raw[j]); return m; });
    const sm = alt.map((_, i) => { let s = 0, w = 0; for (let j = Math.max(0, i - 6); j <= Math.min(alt.length - 1, i + 6); j++) { s += alt[j]; w++; } return s / w; });
    const path = new PathFollower(pts, 0);
    path.alt = sm;
    const stops = order.map((st, i) => ({ ...st, s: path.cum[stopIx[i]] }));
    return { path, stops, loop: true };
  }

  altAt(s) {
    const P = this.cur.path, k = P.seg(s), a = P.alt[k], b = P.alt[Math.min(k + 1, P.alt.length - 1)];
    const L = P.cum[k + 1] - P.cum[k] || 1;
    return a + (b - a) * clamp((s - P.cum[k]) / L, 0, 1);
  }

  prepare(kind) { this.kind = kind; }

  start() {
    const g = this.g, { player, ui, audio } = g;
    const kind = this.kind;
    this.cur = this.plan(kind);
    const { path, stops } = this.cur;
    // begin at the stop nearest to you
    let k = 0, bd = Infinity;
    stops.forEach((st, i) => { const d = Math.hypot(st.x - player.pos.x, st.z - player.pos.z); if (d < bd) { bd = d; k = i; } });
    this.stopIdx = (k - 1 + stops.length) % stops.length;      // heading for stop k
    this.s = Math.max(0, stops[k].s - 60);
    if (k === 0) this.s = 0;
    this.v = 0; this.visited = 0; this.state = 'go'; this.dwell = 0; this.paused = false;
    this.view = VIEWS[kind][0];
    this.active = true;
    this.home = player.pos.clone();
    player.flying = false;
    if (kind === 'bike') { g.bike.mount(); }
    if (kind === 'drone') { g.drone.start(); g.ui.droneHud(false); player.pos.y = g.world.groundAt(player.pos.x, player.pos.z, player.pos.y + 0.5); player.avatar.root.position.copy(player.pos); }
    const a = path.at(this.s, {});
    this.pos.set(a.x, kind === 'drone' ? this.altAt(this.s) : g.world.heightAt(a.x, a.z), a.z);
    this.yaw = Math.atan2(a.dx, a.dz);
    this.camYawOff = 0;
    this.baseFov = g.camera.fov;
    ui.autoTourPanel(true, this);
    const sp = SPEEDS[kind][this.speedIx[kind]];
    ui.toast(`${TITLES[kind]}: ${stops.length} stops, ${fmtDist(path.length)}. [ and ] change speed (now ${sp[1]}), X skips ahead, Space pauses.`, 'info');
    audio.speak(`Welcome to the ${TITLES[kind].toLowerCase()} of I I T Guwahati. First stop: ${stops[k].name}.`);
    g.camera.userData.orbitInit = false;
  }

  stop() {
    if (!this.active) return;
    const g = this.g, { player, ui, audio } = g;
    this.active = false;
    audio.stopSpeech();
    ui.autoTourPanel(false);
    ui.hideCard();
    g.camera.fov = this.baseFov; g.camera.updateProjectionMatrix();
    document.body.classList.remove('warp');
    if (this.kind === 'bike') {
      g.bike.pos.copy(this.pos); g.bike.heading = this.yaw; g.bike.speed = 0;
      g.bike.dismount();
    } else if (this.kind === 'walk') {
      player.spawn(this.pos.x, this.pos.z, this.yaw);
      player.camYaw = this.yaw;
    } else {
      g.drone.finish();
    }
    g.camera.userData.orbitInit = false;
  }

  get speedInfo() { return SPEEDS[this.kind][this.speedIx[this.kind]]; }
  faster(d) {
    const n = SPEEDS[this.kind].length;
    this.speedIx[this.kind] = clamp(this.speedIx[this.kind] + d, 0, n - 1);
    this.g.ui.toast(`${this.speedInfo[1]} · ${Math.round(this.speedInfo[0] * 3.6)} km/h`, 'info', TITLES[this.kind]);
  }
  nextView() {
    const V = VIEWS[this.kind];
    this.view = V[(V.indexOf(this.view) + 1) % V.length];
    this.side = null;
    this.g.ui.toast(VIEW_NAMES[this.view], 'info');
    this.g.camera.userData.orbitInit = false;
  }
  skip() {
    if (this.state === 'dwell') { this.dwell = -99; return; }
    const next = this.nextStop();
    const L = this.cur.path.length;
    let target = next.s; if (target < this.s - 1) target += L;
    if (target - this.s > 40) { this.s = target - 40; this.g.audio.whoosh(); }
  }
  togglePause() { this.paused = !this.paused; this.g.ui.toast(this.paused ? 'Tour paused (Space to continue)' : 'Tour continues', 'info'); }

  nextStop() { const S = this.cur.stops; return S[(this.stopIdx + 1) % S.length]; }

  update(dt) {
    if (!this.active) return;
    const g = this.g, { input, player, world, progress, audio, ui } = g;
    if (input.hit('BracketRight', 'Equal', 'NumpadAdd')) this.faster(1);
    if (input.hit('BracketLeft', 'Minus', 'NumpadSubtract')) this.faster(-1);
    if (input.hit('KeyV')) this.nextView();
    if (input.hit('KeyX', 'Enter')) this.skip();
    if (input.hit('Space')) this.togglePause();
    if (input.hit('KeyR') && this.kind === 'bike') audio.bell();
    if (input.hit('KeyC') && this.kind === 'drone') g.capture.snap('drone');
    this.camYawOff = wrapAngle(this.camYawOff - input.dx * 0.0024);
    player.camPitch = clamp(player.camPitch + input.dy * 0.0022, -0.5, 1.3);
    if (input.wheel) player.camDist = clamp(player.camDist * Math.pow(1.13, input.wheel), 2.5, 40);
    if (Math.abs(input.dx) < 0.5) this.camYawOff = damp(this.camYawOff, 0, 0.6, dt);

    const P = this.cur.path, L = P.length;
    const next = this.nextStop();
    const vSel = this.speedInfo[0];
    if (this.state === 'dwell') {
      this.v = damp(this.v, 0, 6, dt);
      if (!this.paused) this.dwell -= dt;
      if (this.dwell <= 0 && (!speechBusy() || this.dwell < -20)) { this.state = 'go'; ui.hideCard(); }
    } else {
      let target = next.s;
      if (target < this.s - 1) target += L;
      const remain = target - this.s;
      const decel = Math.max(1.6, vSel * 0.55);
      let vt = this.paused ? 0 : Math.min(vSel, Math.sqrt(2 * decel * Math.max(0, remain)) + 0.6);
      // slow a little on sharp bends when riding
      if (this.kind !== 'drone') vt = Math.min(vt, Math.max(2.2, vSel - Math.abs(P.curvature(((this.s % L) + L) % L, 10)) * vSel * 0.8));
      this.v = damp(this.v, vt, vt < this.v ? 5 : Math.max(1.4, vSel * 0.25), dt);
      this.s += this.v * dt;
      if (!this.announced && remain < Math.max(60, vSel * 8)) { this.announced = true; ui.autoTourNext(this, next); }
      if (remain < 0.8) {
        this.s = target % L;
        this.stopIdx = (this.stopIdx + 1) % this.cur.stops.length;
        this.arrive(next);
      }
    }
    // place the traveller on the path
    const sw = ((this.s % L) + L) % L;
    const a = P.at(sw, {});
    const yawT = Math.atan2(a.dx, a.dz);
    this.yaw = angleDamp(this.yaw, yawT, this.kind === 'drone' ? 2.5 : 7, dt);
    if (this.kind === 'drone') {
      this.pos.set(a.x, damp(this.pos.y, this.altAt(sw), 3, dt), a.z);
      const d = g.drone;
      d.pos.copy(this.pos); d.yaw = this.yaw;
      d.pitch = damp(d.pitch, clamp((this.v - (this._pv || 0)) * 0.6 + this.v * 0.006, -0.3, 0.35), 4, dt);
      d.vel.set(Math.sin(this.yaw) * this.v, 0, Math.cos(this.yaw) * this.v);
      d.drone.group.position.copy(this.pos);
      d.drone.group.rotation.set(d.pitch, this.yaw, 0, 'YXZ');
      d.drone.update(dt, 0.45 + this.v * 0.01);
      d.thrust = 0.45;
      progress.discoverNear(this.pos.x, this.pos.z, 30);
      // pilot at home, holding the controller
      const dx = this.pos.x - player.pos.x, dz = this.pos.z - player.pos.z;
      player.heading = angleDamp(player.heading, Math.atan2(dx, dz), 3, dt);
      player.avatar.root.rotation.set(0, player.heading, 0);
      player.avatar.animate({ type: 'drone', look: -0.4 }, dt);
    } else {
      this.pos.set(a.x, world.heightAt(a.x, a.z), a.z);
      if (this.kind === 'walk') {
        player.pos.copy(this.pos); player.heading = this.yaw; player.speed = this.v;
        player.avatar.root.position.copy(this.pos);
        player.avatar.root.rotation.set(0, this.yaw, 0);
        const anim = this.v > 2.6 ? 'run' : this.v > 0.25 ? 'walk' : 'idle';
        const as = this.v > 9 ? 9 + (this.v - 9) * 0.25 : this.v;
        player.avatar.animate({ type: anim, speed: as }, dt);
        this.stepAcc = (this.stepAcc || 0) + this.v * dt;
        if (this.stepAcc > (this.v > 2.6 ? 1.15 : 0.78) && this.v < 10) { this.stepAcc = 0; audio.footstep(g.onRoadCached(this.pos) ? 'road' : 'grass'); }
      } else {
        const B = g.bike, b = B.bike;
        const turn = wrapAngle(yawT - B.heading);
        B.pos.copy(this.pos); B.speed = this.v;
        B.lean = damp(B.lean, clamp(-turn * this.v * 0.35, -0.45, 0.45), 5, dt);
        B.heading = this.yaw;
        b.group.position.copy(this.pos);
        b.group.rotation.set(0, this.yaw, B.lean, 'YXZ');
        b.setSteer(clamp(turn * 2, -0.4, 0.4));
        b.spin(this.v * dt);
        b.setCrank(b.crankAngle + (Math.min(this.v, 12) / b.R) * dt / 2.3);
        player.pos.copy(this.pos); player.heading = this.yaw;
        player.avatar.animate({ type: 'bike', bike: b, speed: this.v }, dt);
        progress.addStat('bikeDist', this.v * dt);
      }
      this.discT = (this.discT || 0) - dt;
      if (this.discT < 0) { this.discT = 0.4; progress.discoverNear(this.pos.x, this.pos.z); }
    }
    this._pv = this.v;
    // a sense of speed: wider field of view and a light vignette when going very fast
    const fast = g.progress.settings.calm ? 0 : clamp((this.v - 6) / 20, 0, 1);
    const fov = this.baseFov + fast * 14;
    if (Math.abs(g.camera.fov - fov) > 0.05) { g.camera.fov = damp(g.camera.fov, fov, 3, dt); g.camera.updateProjectionMatrix(); }
    document.body.classList.toggle('warp', this.kind !== 'drone' && this.v > 12);
    ui.autoTourTick(this, next);
  }

  arrive(stop) {
    const { ui, audio, progress } = this.g;
    this.state = 'dwell';
    this.announced = false;
    this.visited++;
    this.dwell = 7;
    audio.stopChime();
    for (const l of stop.lms) progress.discover(l, true);
    const lm = stop.lms[0];
    const n = this.cur.stops.length;
    const inside = this.kind !== 'drone' && ['hostel', 'academic', 'admin', 'culture', 'food', 'sports'].includes(lm.kind) ? ' Press E to stop the tour here and go inside.' : '';
    ui.card(stop.name, stop.lms.map((l) => l.desc).join(' ') + inside, lm.kind, `Stop ${this.visited} of ${n}`);
    audio.speak(`${this.kind === 'drone' ? 'Below us: ' : 'This is '}${stop.name}. ${stop.lms.map((l) => l.desc).join(' ')}`);
    progress.addXP?.(5, 'Tour stop');
    if (this.visited >= n) {
      progress.unlock(this.kind === 'drone' ? 'drone_tour' : this.kind === 'bike' ? 'bike_tour' : 'walk_tour');
      ui.toast(`${TITLES[this.kind]} complete - you have seen the whole campus!`, 'gold');
    }
  }

  focus() { return this.pos; }

  /** upcoming stretch of the route for the minimap */
  routeAhead() {
    if (!this.active) return null;
    const P = this.cur.path, L = P.length, out = [], tmp = {};
    for (let d = 0; d < 700; d += 12) { P.at(((this.s + d) % L + L) % L, tmp); out.push([tmp.x, tmp.z]); }
    return out;
  }

  updateCamera(camera, dt) {
    const g = this.g, p = g.player, J = p.avatar.J;
    const st = this.cur.stops[this.stopIdx];
    const dwellLook = this.state === 'dwell' && st;
    J.head.visible = !(this.view === 'first');
    if (this.kind === 'drone') {
      if (dwellLook) {
        // circle the place being described
        this.orbitA = (this.orbitA ?? Math.atan2(camera.position.x - st.x, camera.position.z - st.z)) + dt * 0.22;
        const gy = g.world.heightAt(st.x, st.z);
        const want = new THREE.Vector3(st.x + Math.sin(this.orbitA) * 70, Math.max(this.pos.y, gy + 45), st.z + Math.cos(this.orbitA) * 70);
        camera.position.lerp(want, 1 - Math.exp(-1.5 * dt));
        camera.lookAt(st.x, gy + 8, st.z);
        return;
      }
      this.orbitA = null;
      if (this.view === 'fpv') {
        camera.position.copy(this.pos).add(new THREE.Vector3(0, -0.15, 0));
        camera.rotation.set(-0.35 - p.camPitch * 0.4, this.yaw + Math.PI + this.camYawOff, 0, 'YXZ');
        return;
      }
      if (this.view === 'top') {
        camera.position.lerp(new THREE.Vector3(this.pos.x - Math.sin(this.yaw) * 30, this.pos.y + 90, this.pos.z - Math.cos(this.yaw) * 30), 1 - Math.exp(-3 * dt));
        camera.lookAt(this.pos);
        return;
      }
      const yaw = this.yaw + this.camYawOff;
      const want = this.pos.clone().add(new THREE.Vector3(-Math.sin(yaw) * 9, 3.2 + p.camPitch * 4, -Math.cos(yaw) * 9));
      camera.position.lerp(want, 1 - Math.exp(-5 * dt));
      camera.lookAt(this.pos.x + Math.sin(this.yaw) * 20, this.pos.y - 6, this.pos.z + Math.cos(this.yaw) * 20);
      return;
    }
    const h = this.kind === 'bike' ? 1.45 : 1.5;
    const target = new THREE.Vector3(this.pos.x, this.pos.y + h, this.pos.z);
    if (this.view === 'first') {
      const eye = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * 0.15, this.pos.y + (this.kind === 'bike' ? 1.62 : 1.64), this.pos.z + Math.cos(this.yaw) * 0.15);
      camera.position.copy(eye);
      let yaw = this.yaw + this.camYawOff;
      if (dwellLook) yaw = Math.atan2(st.x - eye.x, st.z - eye.z) + this.camYawOff;
      this.fpYaw = this.fpYaw == null ? yaw : this.fpYaw + wrapAngle(yaw - this.fpYaw) * (1 - Math.exp(-3 * dt));
      const pitch = -p.camPitch * 0.6;
      camera.lookAt(eye.x + Math.sin(this.fpYaw) * Math.cos(pitch), eye.y + Math.sin(pitch), eye.z + Math.cos(this.fpYaw) * Math.cos(pitch));
      return;
    }
    if (this.view === 'top') {
      camera.position.lerp(new THREE.Vector3(this.pos.x - Math.sin(this.yaw) * 25, this.pos.y + 70, this.pos.z - Math.cos(this.yaw) * 25), 1 - Math.exp(-3 * dt));
      camera.lookAt(target);
      return;
    }
    if (this.view === 'side') {
      // tracking shot from the side, like a film crew on a buggy
      const sd = this.side ?? (this.side = 1);
      const want = new THREE.Vector3(this.pos.x + Math.cos(this.yaw) * 6 * sd + Math.sin(this.yaw) * 2, this.pos.y + 1.7, this.pos.z - Math.sin(this.yaw) * 6 * sd + Math.cos(this.yaw) * 2);
      const b = g.world.buildingAt(want.x, want.z);
      if (b) { this.side = -sd; }
      want.y = Math.max(want.y, g.world.heightAt(want.x, want.z) + 0.6);
      camera.position.lerp(want, 1 - Math.exp(-6 * dt));
      camera.lookAt(target);
      return;
    }
    let yaw = this.yaw + this.camYawOff;
    if (dwellLook) yaw = Math.atan2(st.x - this.pos.x, st.z - this.pos.z) + this.camYawOff;
    this.camYawS = this.camYawS == null ? yaw : this.camYawS + wrapAngle(yaw - this.camYawS) * (1 - Math.exp(-2.5 * dt));
    orbitCamera(g.world, camera, target, this.camYawS, Math.max(0.1, p.camPitch * 0.8), Math.max(3.8, p.camDist * (this.kind === 'bike' ? 0.95 : 1)), dt);
  }
}

function speechBusy() {
  try { return 'speechSynthesis' in window && speechSynthesis.speaking; } catch { return false; }
}

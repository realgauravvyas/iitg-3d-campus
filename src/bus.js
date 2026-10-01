import { sweepBlocked } from './clearance.js';
import * as THREE from 'three';
import { makeBus } from './models.js';
import { PathFollower, FILTERS, laneOffset } from './route.js';
import { clamp, damp, wrapAngle, mergeColored, m4, mulberry32 } from './util.js';
import { AN } from './crowd/people.js';
import { studentLook, adultLook, OPT, bit } from './crowd/looks.js';
import { orbitCamera } from './player.js';

const CRUISE = 8.5;      // m/s (~30 km/h campus limit)
const VIEWS = ['chase', 'window', 'cinematic', 'top'];
const VIEW_NAMES = { chase: 'Chase camera', window: 'Window seat', cinematic: 'Cinematic', top: 'Overhead' };

/** Groups nearby landmarks into bus stops. */
export function makeStops(world, ids = null) {
  const lms = world.landmarks.filter((l) => !ids || ids.includes(l.id));
  const stops = [];
  for (const l of lms) {
    const s = l.id === 'busstop' ? null : stops.find((st) => !st.terminus && Math.hypot(st.x - l.wx, st.z - l.wz) < 100);   // the terminus is always a stop of its own
    if (s) { s.lms.push(l); s.x = (s.x * (s.lms.length - 1) + l.wx) / s.lms.length; s.z = (s.z * (s.lms.length - 1) + l.wz) / s.lms.length; }
    else stops.push({ x: l.wx, z: l.wz, lms: [l], terminus: l.id === 'busstop' });
  }
  for (const s of stops) s.name = s.lms.length === 1 ? s.lms[0].name : s.lms.slice(0, 2).map((l) => l.name).join(' & ') + (s.lms.length > 2 ? ` +${s.lms.length - 2}` : '');
  return stops;
}

export class BusTour {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.route = null;
    this.view = 'chase';
    this.speedMul = 1;
  }

  plan() {
    if (this.route) return;
    const { world, graph } = this.g;
    const stops = makeStops(world);
    // every bus starts from the IITG Bus Stop (the terminus); with none, from the stop closest to a campus gate
    const gate = world.gates[0] || { wx: 0, wz: 0 };
    let start = stops.findIndex((s) => s.terminus), bd = Infinity;
    if (start < 0) { start = 0; stops.forEach((s, i) => { const d = Math.hypot(s.x - gate.wx, s.z - gate.wz); if (d < bd) { bd = d; start = i; } }); }
    // buses keep to the through-roads: never inside the academic complex, hostel courtyards
    // or through a building; places a bus cannot reach are shown from the nearest road.
    // The bus turns round at the end of a stop's road, so a stop is served from a node with room to swing round.
    this.route = graph.tour(stops, FILTERS.bus, { loop: true, start, turn: [5.9, 1.7] });
    this.path = new PathFollower(this.route.pts, (hw) => laneOffset(hw, 2.5));
    // snap each stop to the path, then build shelters
    this.stops = this.route.stopAt.map(({ stop, s }) => ({ ...stop, s: Math.max(0, s - 6), far: stop.roadD > 90 }));
    this.clearPath();
    this.buildShelters();
  }

  /** nothing may stand where the bus drives: move parked bicycles off its swept path */
  clearPath() {
    const props = this.g.props, tmp = {};
    if (!props?.parked) return;
    const L = this.path.length;
    const grid = new Map();
    for (let s = 0; s < L; s += 2) { this.path.at(s, tmp); const k = Math.floor(tmp.x / 6) * 65536 + Math.floor(tmp.z / 6); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(tmp.x, tmp.z, tmp.dx, tmp.dz); }
    let n = 0;
    for (const pb of props.parked) {
      const gx = Math.floor(pb.x / 6), gz = Math.floor(pb.z / 6);
      let hit = false;
      for (let i = -1; i <= 1 && !hit; i++) for (let j = -1; j <= 1 && !hit; j++) {
        const c = grid.get((gx + i) * 65536 + gz + j);
        if (c) for (let q = 0; q < c.length; q += 4) if (Math.hypot(pb.x - c[q], pb.z - c[q + 1]) < 2.6) { hit = true; break; }
      }
      if (hit) { props.setParked(pb, false); pb.gone = true; n++; }
    }
    this.cleared = n;
  }

  /** driver, passengers and people waiting at the shelters (GPU crowd) */
  drawPeople(crowd) {
    const r = mulberry32(55);
    if (!this.waiting) {
      this.waiting = this.shelterPos.map((s, i) => Array.from({ length: 2 + (i % 3) }, (_, k) => ({ x: s.x - Math.sin(s.yaw) * (0.2 + k * 0.1) + Math.cos(s.yaw) * (k - 1) * 0.8, z: s.z - Math.cos(s.yaw) * (0.2 + k * 0.1) - Math.sin(s.yaw) * (k - 1) * 0.8, y: this.g.world.heightAt(s.x, s.z), yaw: s.yaw + Math.PI / 2 * 0 + (k % 2 ? 0.4 : -0.3), anim: k % 3 === 0 ? AN.SIT : k % 3 === 1 ? AN.PHONE : AN.STAND, phase: r() * 6, speed: 0, extra: 0, look: k % 4 === 3 ? adultLook(r, 'parent') : studentLook(r) })));
      this.crew = [{ lx: -0.75, lz: 10.6 / 2 - 1.05, look: adultLook(r, 'staff') }];
      for (let k = 0; k < 12; k++) { const row = Math.floor(r() * 8), col = [-0.85, -0.42, 0.42][Math.floor(r() * 3)]; this.crew.push({ lx: col, lz: -10.6 / 2 + 1.05 + row * 1.05, look: studentLook(r), phone: r() < 0.4 }); }
    }
    const cam = this.g.camera.position;
    this.waiting.forEach((grp, i) => {
      const s = this.shelterPos[i];
      if (Math.hypot(s.x - cam.x, s.z - cam.z) > 160) return;
      const boarding = this.active && this.stopIdx === i && this.state !== 'drive';
      grp.forEach((p, k) => { if (!(boarding && k > 0)) crowd.push(p); });
    });
    if (!this.active || !this.bus) return;
    const g = this.bus.group, v = new THREE.Vector3();
    g.updateMatrixWorld();
    for (const c of this.crew) {
      v.set(c.lx, this.bus.floorY + 0.02, c.lz).applyMatrix4(g.matrixWorld);
      crowd.push({ x: v.x, y: v.y, z: v.z, yaw: g.rotation.y, anim: AN.SIT, phase: 0, speed: 0, extra: 0, look: c.look, opts: c.phone ? c.look.opts | bit(OPT.PHONE) : c.look.opts });
    }
  }

  buildShelters() {
    const parts = [];
    const tmp = {};
    this.shelterPos = [];
    const W = this.g.world, G = this.g.graph;
    // junction patches (round, wider than the road) count as road too
    const junc = [];
    G.nodes.forEach(([jx, jz], i) => { const adj = G.adj[i]; if (!adj || adj.length < 3) return; let hw = 0; for (const l of adj) hw = Math.max(hw, l.e.hw || 3); junc.push([jx, jz, Math.max(5.2, hw + 0.5) + 1.2]); });
    const nearJunction = (px, pz) => junc.some(([jx, jz, r]) => Math.abs(jx - px) < r && Math.abs(jz - pz) < r && Math.hypot(jx - px, jz - pz) < r);
    for (const st of this.stops) {
      // the shelter stands BESIDE the road, never on it (nor on a junction): from the lane outwards, to the side of travel that has room (further
      // out on a wide or two-lane road), until its whole footprint (roof, bench, glass, the sign pole) is off the carriageway, the junction
      // patches, buildings and water; if there is no room there, a little further along the road
      const clear = (cx, cz, ox, oz) => {
        const tx = -oz, tz = ox;                                           // along the shelter (its z axis)
        for (const lx of [-0.8, 0.3, 1.3]) for (const lz of [-2.0, 0, 2.0]) {
          const px = cx + ox * lx + tx * lz, pz = cz + oz * lx + tz * lz;
          if (G.onRoad(px, pz, 0.5) || nearJunction(px, pz) || W.buildingAt(px, pz) || W.waterAt(px, pz)) return false;
        }
        return true;
      };
      let best = null;
      for (const ds of [3, 0, 6, -3, 9, -6, 12, 15, -9, 18]) {
        this.path.at(Math.max(0, st.s + ds), tmp);
        for (const side of [1, -1]) {
          const ox = side * tmp.dz, oz = -side * tmp.dx;                   // outward normal of this side
          for (let off = 3.3; off <= 13 && !best; off += 0.5) { const cx = tmp.x + ox * off, cz = tmp.z + oz * off; if (clear(cx, cz, ox, oz)) best = { x: cx, z: cz, ox, oz, off }; }
          if (best) break;
        }
        if (best) break;
      }
      if (!best) { this.path.at(st.s + 3, tmp); const ox = tmp.dz, oz = -tmp.dx; best = { x: tmp.x + ox * 3.3, z: tmp.z + oz * 3.3, ox, oz, off: 3.3 }; }
      const { x, z, ox: nx, oz: nz } = best;
      const y = W.heightAt(x, z);
      const yaw = Math.atan2(-nz, nx);                                       // the shelter's local +x axis points away from the road
      this.shelterPos.push({ x: x - nx * 0.9, z: z - nz * 0.9, yaw: Math.atan2(-nx, -nz) });
      const M = (lx, ly, lz) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [x + lx * c + lz * s, y + ly, z - lx * s + lz * c]; };
      const put = (geo, color, lx, ly, lz) => { const [px, py, pz] = M(lx, ly, lz); parts.push({ geometry: geo, color, matrix: m4(px, py, pz, 0, yaw, 0) }); };
      put(new THREE.BoxGeometry(1.8, 0.08, 3.6), '#b3262f', 0.3, 2.5, 0);
      for (const q of [-1.6, 1.6]) put(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), '#c9c9c9', 0.9, 1.25, q);
      put(new THREE.BoxGeometry(0.06, 1.6, 3.4), '#e8e4da', 1.1, 1.4, 0);
      put(new THREE.BoxGeometry(0.4, 0.06, 2.8), '#6b5a44', 0.8, 0.45, 0);
      put(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 5), '#555', -0.4, 1.3, 1.9);
      put(new THREE.BoxGeometry(0.05, 0.45, 0.45), '#c89b3c', -0.4, 2.6, 1.9);
    }
    const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.shelters = mesh;
    this.g.scene.add(mesh);
  }

  start(fromNearest = true) {
    this.plan();
    const { player, ui, audio } = this.g;
    if (!this.bus) {
      this.bus = makeBus();
      this.g.scene.add(this.bus.group);
    }
    this.bus.group.visible = true;
    // start at the stop nearest to the player
    let k = 0, bd = Infinity;
    if (fromNearest) this.stops.forEach((st, i) => { const d = Math.hypot(st.x - player.pos.x, st.z - player.pos.z); if (d < bd) { bd = d; k = i; } });
    this.stopIdx = k;
    this.s = this.stops[k].s;
    this.v = 0;
    this.dwell = 3;
    this.state = 'boarding';
    this.announcedNext = false;
    this.visited = 0;
    this.active = true;
    this.cine = null;
    // seat the player inside
    player.flying = false;
    player.camYaw = 0; player.camPitch = 0.3; this._ly = 0;
    this.bus.group.add(player.avatar.root);
    player.avatar.root.position.set(0.85, this.bus.floorY + 0.02, 1.2);
    player.avatar.root.rotation.set(0, 0, 0);
    this.place(0);
    audio.door();
    ui.busPanel(true, this);
    ui.toast('Welcome aboard the campus tour bus', 'info');
    audio.speak(`Welcome aboard the I I T Guwahati campus tour. We will visit ${this.stops.length} stops. First, ${this.stops[k].name}.`);
  }

  stop() {
    const { player, ui, audio } = this.g;
    if (!this.active) return;
    this.active = false;
    audio.stopSpeech();
    this.bus.group.remove(player.avatar.root);
    this.g.scene.add(player.avatar.root);
    const tmp = this.path.at(this.s, {});
    const nx = tmp.dz, nz = -tmp.dx;
    player.spawn(tmp.x + nx * 3.2, tmp.z + nz * 3.2, Math.atan2(tmp.dx, tmp.dz));
    this.bus.group.visible = false;
    ui.busPanel(false);
    ui.hideCard();
    audio.door();
  }

  nextView() {
    this.view = VIEWS[(VIEWS.indexOf(this.view) + 1) % VIEWS.length];
    this.cine = null;
    this.g.ui.toast(VIEW_NAMES[this.view], 'info');
  }

  skip() {
    if (this.state === 'dwell' || this.state === 'boarding') { this.dwell = 0; return; }
    const next = this.stops[(this.stopIdx + 1) % this.stops.length];
    this.s = next.s - 30 > this.s ? next.s - 30 : this.s;
  }

  place(dt) {
    const L = this.path.length;
    const sw = ((this.s % L) + L) % L;
    const a = this.path.at(sw, {});
    const f = this.path.at(Math.min(L, sw + 4), {}), r = this.path.at(Math.max(0, sw - 4), {});
    const w = this.g.world;
    const hf = w.heightAt(f.x, f.z), hr = w.heightAt(r.x, r.z);
    const yaw = Math.atan2(f.x - r.x, f.z - r.z);
    const g = this.bus.group;
    const nextYaw = dt ? g.rotation.y + wrapAngle(yaw - g.rotation.y) * (1 - Math.exp(-8 * dt)) : yaw;
    const pose = { x: a.x, z: a.z, yaw: nextYaw, s: this.s };
    if (sweepBlocked(w, dt ? this.safePose : null, pose, 5.5, 1.4)) {
      if (this.safePose) this.s = this.safePose.s;
      this.v = 0;
      return;
    }
    this.safePose = pose;
    g.position.set(a.x, (hf + hr) / 2 + 0.05, a.z);
    const pitch = Math.atan2(hr - hf, 8);
    if (dt === 0) { g.rotation.set(pitch, yaw, 0, 'YXZ'); return; }
    const cur = g.rotation.y;
    g.rotation.set(damp(g.rotation.x, pitch, 6, dt), cur + wrapAngle(yaw - cur) * (1 - Math.exp(-8 * dt)), 0, 'YXZ');
  }

  update(dt) {
    if (!this.active) return;
    const { input, ui, audio, progress, player } = this.g;
    if (input.hit('KeyV')) this.nextView();
    if (input.hit('KeyX', 'Enter')) this.skip();
    if (input.hit('BracketRight')) { this.speedMul = this.speedMul >= 4 ? 1 : this.speedMul * 2; ui.toast(`Bus speed ×${this.speedMul}`, 'info'); }
    if (input.hit('KeyR', 'KeyH')) audio.horn();
    player.look(input, -0.6, 1.4);
    const L = this.path.length;
    const dts = dt * this.speedMul;
    const cur = this.stops[this.stopIdx];
    const nextIdx = (this.stopIdx + 1) % this.stops.length;
    const next = this.stops[nextIdx];

    if (this.state === 'boarding' || this.state === 'dwell') {
      this.v = 0;
      this.dwell -= dts;
      if (this.dwell <= 0 && (!speechBusy() || this.dwell < -20)) {
        this.state = 'drive';
        this.announcedNext = false;
        audio.door();
        ui.hideCard();
      }
    } else {
      let target = next.s;
      if (target <= this.s - 1) target += L; // wrap around the loop
      const remain = target - this.s;
      const curv = Math.abs(this.path.curvature(((this.s % L) + L) % L, 18));
      let vt = Math.min(CRUISE, Math.max(3.2, CRUISE - curv * 9));
      vt = Math.min(vt, Math.sqrt(Math.max(0, 2 * 1.3 * remain)) + 0.3);
      // stop for people crossing and for traffic ahead
      const bp = this.bus.group.position, by = this.bus.group.rotation.y;
      vt = Math.min(vt, this.g.avoid.brake(bp.x, bp.z, by, 5.3, 1.3, vt) / Math.max(1, this.speedMul * 0.5));
      const fx = Math.sin(by), fz = Math.cos(by);
      for (const v of this.g.traffic.agents) {
        if (!v.veh) continue;
        const dx = v.group.position.x - bp.x, dz = v.group.position.z - bp.z, ahead = dx * fx + dz * fz;
        if (ahead > 0 && ahead < 16 && Math.abs(dx * fz - dz * fx) < 2.2 && Math.cos(v.heading - by) > 0.3) vt = Math.min(vt, v.v + Math.max(0, ahead - 9) * 0.5);
      }
      if (!this.announcedNext && remain < 120) {
        this.announcedNext = true;
        audio.speak(`Next stop: ${next.name}.`);
        ui.busNext(next.name, this.visited, this.stops.length);
      }
      this.v = damp(this.v, vt, vt < this.v ? 3 : 1.2, dts);
      this.s += this.v * dts;
      if (remain < 0.6) {
        this.s = target % L;
        this.stopIdx = nextIdx;
        this.arrive(next);
      }
    }
    this.bus.spin(this.v * dts);
    this.place(dt);
    player.avatar.animate({ type: 'sit' }, dt);
    this.g.progress.addStat('busDist', this.v * dts);
    ui.busTick(this, next);
  }

  arrive(stop) {
    const { ui, audio, progress } = this.g;
    this.state = 'dwell';
    this.visited++;
    this.dwell = 8;
    audio.brakeHiss();
    setTimeout(() => { audio.stopChime(); audio.door(); }, 500);
    for (const l of stop.lms) progress.discover(l, true);
    const lm = stop.lms[0];
    const side = this.sideOf(stop);
    const far = stop.far ? ` Buses can't drive in there - it is about ${Math.round(stop.roadD / 10) * 10} metres ${side ? `to your ${side}` : 'away'}. Press E to hop off and walk in, or take the walking or cycle tour.` : '';
    ui.card(stop.name, stop.lms.map((l) => l.desc).join(' ') + (stop.far ? ` (Seen from the road - about ${Math.round(stop.roadD / 10) * 10} m ${side ? `to your ${side}` : 'away'}; buses can't enter.)` : ''), lm.kind, `Stop ${this.visited} of ${this.stops.length}${stop.far ? ' · view from the road' : ''}`);
    audio.speak(`${stop.far ? `On your ${side || 'side'}, ` : 'This is '}${stop.name}. ${stop.lms.map((l) => l.desc).join(' ')}${far}`);
    if (this.visited >= this.stops.length) {
      progress.unlock('bus_tour');
      ui.toast('Tour complete! You have seen the whole campus.', 'gold');
    }
  }

  /** 'left' / 'right' of the bus for a stop's landmark */
  sideOf(stop) {
    const g = this.bus.group, yaw = g.rotation.y;
    const dx = stop.x - g.position.x, dz = stop.z - g.position.z;
    const l = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    return Math.hypot(dx, dz) < 8 ? '' : l > 0 ? 'left' : 'right';
  }

  updateCamera(camera, dt) {
    const g = this.bus.group;
    const p = this.g.player;
    const J = p.avatar.J;
    J.head.visible = this.view !== 'window';
    const yaw = g.rotation.y;
    if (this.view === 'window') {
      const head = new THREE.Vector3();
      J.head.getWorldPosition(head);
      camera.position.copy(head);
      const ly = yaw + this.lookYaw(), pitch = -p.camPitch * 0.8;
      camera.lookAt(head.x + Math.sin(ly) * Math.cos(pitch), head.y + Math.sin(pitch), head.z + Math.cos(ly) * Math.cos(pitch));
      return;
    }
    if (this.view === 'top') {
      const t = new THREE.Vector3(g.position.x, g.position.y, g.position.z);
      camera.position.lerp(new THREE.Vector3(t.x - Math.sin(yaw) * 40, t.y + 85, t.z - Math.cos(yaw) * 40), 1 - Math.exp(-3 * dt));
      camera.lookAt(t);
      return;
    }
    if (this.view === 'cinematic') {
      const tmp = {};
      if (!this.cine || this.cine.t <= 0 || camera.position.distanceTo(g.position) > 90) {
        const L = this.path.length;
        const ahead = this.path.at((this.s + 45 + Math.random() * 30) % L, tmp);
        const side = Math.random() < 0.5 ? 1 : -1;
        const x = ahead.x + ahead.dz * 9 * side, z = ahead.z - ahead.dx * 9 * side;
        this.cine = { pos: new THREE.Vector3(x, this.g.world.heightAt(x, z) + 1.6 + Math.random() * 5, z), t: 9 };
      }
      this.cine.t -= dt;
      camera.position.copy(this.cine.pos);
      camera.lookAt(g.position.x, g.position.y + 1.8, g.position.z);
      return;
    }
    const target = new THREE.Vector3(g.position.x, g.position.y + 2.2, g.position.z);
    // while stopped, swing round so the place being described is in view
    const st = this.stops[this.stopIdx];
    let want = yaw + p.camYaw;
    if (this.state === 'dwell' && st && Math.hypot(st.x - g.position.x, st.z - g.position.z) > 10) want = Math.atan2(st.x - g.position.x, st.z - g.position.z) + p.camYaw;
    this.camYawS = this.camYawS == null ? want : this.camYawS + wrapAngle(want - this.camYawS) * (1 - Math.exp(-2.2 * dt));
    orbitCamera(this.g.world, camera, target, this.camYawS, Math.max(0.1, p.camPitch * 0.7 + 0.1), 17, dt);
  }

  lookYaw() {
    // the mouse turns your head inside the bus (0 = looking forward)
    this._ly = (this._ly ?? 0) + (this.g.input.dx * -0.0024);
    this._ly = clamp(this._ly, -2.4, 2.4);
    return this._ly;
  }
}

function speechBusy() {
  try { return 'speechSynthesis' in window && speechSynthesis.speaking; } catch { return false; }
}

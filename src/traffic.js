import { sweepBlocked, footprintBlocked } from './clearance.js';
import * as THREE from 'three';
import { Avatar, randomLook } from './avatar.js';
import { makeBicycle, makeScooter, makeCar, makeBus } from './models.js';
import { mulberry32, damp, wrapAngle, clamp } from './util.js';
import { makeAmbulance } from './vehicle.js';
import { AN } from './crowd/people.js';
import { FILTERS, laneOffset } from './route.js';
import { adultLook, studentLook, OPT, bit } from './crowd/looks.js';

// Campus mix: mostly bicycles, a handful of scooters and cars, the campus shuttle, and people walking.
// walkers and cyclists are part of campus life (GPU crowd); this handles motor vehicles
const MIX = { scooter: 7, car: 5, shuttle: 2, ambulance: 1 };
const GATE_MAIN = { car: 9, scooter: 8, shuttle: 1 };      // extra traffic that stays round the Main Gate
const GATE_KV = { car: 2, scooter: 3 };                  // and a thinner stream at the KV Gate
const SPEED = { cyclist: [3.6, 6.2], walker: [1.1, 1.6], scooter: [7, 10], car: [7, 9.5], shuttle: [6.5, 8], ambulance: [8.5, 10] };
const BIKE_COLORS = ['#1e1e1e', '#1e1e1e', '#1e1e1e', '#c62f2f', '#2f5fa8', '#2e7d4f', '#d7d7d7', '#e0a526', '#6b3d5e'];
const CAR_COLORS = ['#f2f2f0', '#c0c3c6', '#9b1c1c', '#1c1c1c', '#2b4c7e', '#e8e8e8'];
const SCOOTER_COLORS = ['#2f5fa8', '#1c1c1c', '#9b1c1c', '#f2f2f0', '#5b7f3a', '#8a8f96'];

export class Traffic {
  constructor(game) {
    this.g = game;
    this.agents = [];
    this.rnd = mulberry32(777);
    const { graph } = game;
    // precompute arc lengths for each edge
    for (const e of graph.edges) {
      e.cum = [0];
      for (let i = 1; i < e.wpts.length; i++) e.cum.push(e.cum[i - 1] + Math.hypot(e.wpts[i][0] - e.wpts[i - 1][0], e.wpts[i][1] - e.wpts[i - 1][1]));
      e.L = e.cum[e.cum.length - 1];
    }
    for (const [kind, n] of Object.entries(MIX)) for (let i = 0; i < n; i++) this.spawn(kind);
    // the gates: a busy Main Gate (visitors, taxis, delivery, staff) and a quieter KV Gate; these vehicles keep coming back to their gate
    const gates = game.world.gates || [];
    const main = gates.find((q) => q.main), kv = gates.find((q) => q.name === 'KV Gate');
    for (const [gt, mix, R] of [[main, GATE_MAIN, 320], [kv, GATE_KV, 220]]) {
      if (!gt) continue;
      for (const [kind, n] of Object.entries(mix)) for (let i = 0; i < n; i++) this.spawn(kind, { x: gt.wx, z: gt.wz, R });
    }
  }

  allowed(kind, e) {
    if (e.L < 1) return false;
    if (kind === 'walker') return true;
    if (kind === 'cyclist') return (e.main && !e.gen) || e.kind === 'cycleway' || e.kind === 'path' || (e.kind === 'footway' && !e.gen);
    return aBus(kind) ? FILTERS.bus(e) : FILTERS.car(e);
  }

  spawn(kind, home = null) {
    const { graph, scene } = this.g;
    const r = this.rnd;
    const near = (e) => { if (!home) return true; const m = e.wpts[Math.floor(e.wpts.length / 2)]; return Math.hypot(m[0] - home.x, m[1] - home.z) < home.R; };
    const edges = graph.edges.filter((e) => this.allowed(kind, e) && near(e) && (kind === 'walker' || home || e.kind !== 'service' || r() < 0.3));
    const e = edges[Math.floor(r() * edges.length)];
    if (!e) return;
    const a = { kind, e, fwd: r() < 0.5, s: r() * e.L, v: 0, heading: 0, bellCool: r() * 5, phase: r() * 6, home };
    a.vDes = SPEED[kind][0] + r() * (SPEED[kind][1] - SPEED[kind][0]);
    const g = new THREE.Group();
    if (kind === 'cyclist') {
      a.bike = makeBicycle(BIKE_COLORS[Math.floor(r() * BIKE_COLORS.length)], r() < 0.45 ? 'roadster' : 'mtb');
      a.rider = new Avatar(randomLook(r), { npc: true });
      a.bike.group.add(a.rider.root);
      g.add(a.bike.group);
      a.lane = 0.35 + r() * 0.3;
    } else if (kind === 'walker') {
      a.rider = new Avatar(randomLook(r), { npc: true });
      g.add(a.rider.root);
      a.lane = 1.0 + r() * 0.4;
      a.pauseT = 0;
    } else if (kind === 'scooter') {
      a.veh = makeScooter(SCOOTER_COLORS[Math.floor(r() * SCOOTER_COLORS.length)]);
      a.rider = new Avatar({ ...randomLook(r), backpack: false }, { npc: true });
      a.rider.root.position.set(0, 0, -0.15);
      a.veh.group.add(a.rider.root);
      g.add(a.veh.group);
      a.lane = 0.45;
    } else if (kind === 'car') {
      a.veh = makeCar(CAR_COLORS[Math.floor(r() * CAR_COLORS.length)]);
      g.add(a.veh.group);
      a.lane = 0.25;
    } else if (kind === 'ambulance') {
      a.veh = makeAmbulance();
      g.add(a.veh.group);
      a.lane = 0.25;
      a.vDes = 9;
    } else {
      a.veh = makeBus();
      g.add(a.veh.group);
      a.lane = 0.2;
    }
    // people inside (drawn by the GPU crowd): driver + passengers
    a.crew = [];
    if (kind === 'car' || kind === 'ambulance') a.crew.push({ lx: kind === 'car' ? -0.38 : -0.45, ly: 0.2, lz: kind === 'car' ? 0.05 : 2.25, look: adultLook(r, kind === 'ambulance' ? 'staff' : 'faculty') });
    if (kind === 'shuttle') {
      a.crew.push({ lx: -0.75, ly: 0.85, lz: 10.6 / 2 - 1.05, look: adultLook(r, 'staff') });
      for (let k = 0; k < 11; k++) { const row = Math.floor(r() * 8), col = [-0.85, -0.42, 0.42, 0.85][Math.floor(r() * 4)]; a.crew.push({ lx: col, ly: 0.85, lz: -10.6 / 2 + 1.05 + row * 1.05, look: studentLook(r), phone: r() < 0.4 }); }
    }
    a.group = g;
    const initial = this.sample(e, a.s, a.fwd, {});
    const offset = laneOffset(e.hw, WIDTH[kind]);
    a.heading = Math.atan2(initial.tx, initial.tz);
    const x = initial.x + initial.tz * offset, z = initial.z - initial.tx * offset;
    if (footprintBlocked(this.g.world, x, z, a.heading, LEN[kind] / 2 + 0.3, WIDTH[kind] / 2 + 0.3)) return;
    g.position.set(x, this.g.world.heightAt(x, z) + 0.08, z);
    g.rotation.y = a.heading;
    scene.add(g);
    this.agents.push(a);
  }

  /** point + tangent on an edge at arc length s in the agent's direction */
  sample(e, s, fwd, out) {
    const d = fwd ? s : e.L - s;
    let k = 0;
    while (k < e.cum.length - 2 && e.cum[k + 1] < d) k++;
    const p = e.wpts[k], q = e.wpts[k + 1];
    const L = e.cum[k + 1] - e.cum[k] || 1;
    const t = clamp((d - e.cum[k]) / L, 0, 1);
    let tx = (q[0] - p[0]) / L, tz = (q[1] - p[1]) / L;
    if (!fwd) { tx = -tx; tz = -tz; }
    out.x = p[0] + (q[0] - p[0]) * t; out.z = p[1] + (q[1] - p[1]) * t; out.tx = tx; out.tz = tz;
    return out;
  }

  nextEdge(a) {
    const { graph } = this.g;
    const node = a.fwd ? a.e.b : a.e.a;
    let opts = graph.adj[node].filter((l) => l.e !== a.e && this.allowed(a.kind, l.e));
    if (a.kind !== 'walker') {
      const nonService = opts.filter((l) => l.e.kind !== 'service');
      if (nonService.length && this.rnd() < 0.8) opts = nonService;
    }
    if (!opts.length) { a.fwd = !a.fwd; a.s = 0; return; }
    let l = opts[Math.floor(this.rnd() * opts.length)];
    if (a.home) {           // a gate vehicle: out past its range, it heads back towards its gate
      const d = (x) => { const p = graph.nodes[x.fwd ? x.e.b : x.e.a]; return Math.hypot(p[0] - a.home.x, p[1] - a.home.z); };
      if (d({ e: a.e, fwd: a.fwd }) > a.home.R * 0.7 && this.rnd() < 0.85) l = opts.slice().sort((p, q) => d(p) - d(q))[0];
    }
    a.e = l.e; a.fwd = l.fwd; a.s = 0;
  }

  update(dt, cam, obstacles) {
    const { world, audio } = this.g;
    const tmp = {};
    let nearest = null;
    for (const a of this.agents) {
      // who is ahead of me? slow down for agents and for the player / tour bus
      const fx = Math.sin(a.heading), fz = Math.cos(a.heading);
      let limit = a.vDes;
      const gp = a.group.position;
      for (const o of obstacles) {
        const dx = o.x - gp.x, dz = o.z - gp.z;
        const ahead = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < (a.kind === 'walker' ? 2.5 : 9) && lat < (o.r || 1.5) + 0.8) {
          limit = Math.min(limit, Math.max(0, (ahead - 2.5) * 0.8));
          if (o.player && a.bellCool <= 0 && a.kind !== 'walker' && ahead < 8) {
            a.bellCool = 7;
            const pan = this.panFor(gp, cam);
            if (a.kind === 'cyclist') audio.bell(pan, 0.6); else audio.horn(pan, 0.7);
          }
        }
      }
      // the campus shuttles pull up at the bus stands for a few seconds
      if (a.kind === 'shuttle' && this.g.busStops) {
        a.stopCool = (a.stopCool || 0) - dt;
        if (a.dwell > 0) { a.dwell -= dt; limit = 0; if (a.dwell <= 0) a.stopCool = 30; }
        else if (a.stopCool <= 0) for (const s of this.g.busStops.stops) {
          const dx = s.rx - gp.x, dz = s.rz - gp.z, ahead = dx * fx + dz * fz;
          if (ahead > -2 && ahead < 18 && Math.abs(dx * fz - dz * fx) < 7) {
            limit = Math.min(limit, Math.max(0.8, ahead * 0.6));
            if (ahead < 1.5) { a.dwell = 6 + this.rnd() * 5; a.v = Math.min(a.v, 1); }
            break;
          }
        }
      }
      const free = limit;
      if (a.kind !== 'walker' && !(a.ghost > 0)) {
        for (const b of this.agents) {
          if (b === a || b.kind === 'walker' || Math.cos(b.heading - a.heading) < 0.3) continue;
          const dx = b.group.position.x - gp.x, dz = b.group.position.z - gp.z;
          const ahead = dx * fx + dz * fz;
          if (ahead > 0 && ahead < 9 && Math.abs(dx * fz - dz * fx) < 1.4) limit = Math.min(limit, b.v * 0.95 + Math.max(0, ahead - 5) * 0.5);
        }
        // and stop for people in the lane ahead
        const dim = WIDTH[a.kind] || 1.8;
        limit = Math.min(limit, this.g.avoid.brake(gp.x, gp.z, a.heading, LEN[a.kind] / 2, dim / 2, limit));
      } else if (a.kind === 'walker') { if (a.pauseT > 0) { a.pauseT -= dt; limit = 0; } else if (this.rnd() < dt * 0.01) a.pauseT = 2 + this.rnd() * 4; }
      // gridlock breaker: held up by others for a while -> ease through for a few seconds
      if (a.kind !== 'walker') {
        a.ghost = Math.max(0, (a.ghost || 0) - dt);
        if (free > 1 && limit < 0.3 && a.v < 0.3) { a.stall = (a.stall || 0) + dt; if (a.stall > 6) { a.stall = 0; a.ghost = 3.5; } } else a.stall = 0;
        if (a.ghost > 0) limit = Math.max(limit, Math.min(free, 2.2));
      }
      a.bellCool -= dt;
      a.v = damp(a.v, limit, limit < a.v ? 4 : 1.2, dt);
      const prev = { e: a.e, fwd: a.fwd, s: a.s, off: a.off, yaw: a.heading, x: gp.x, z: gp.z };
      a.s += a.v * dt;
      let guard = 0;
      while (a.s > a.e.L && guard++ < 4) { const over = a.s - a.e.L; this.nextEdge(a); a.s = over; }
      this.sample(a.e, a.s, a.fwd, tmp);
      const half = a.e.foot ? 0.6 : laneHalf(a.e.kind);
      let want = a.kind === 'walker' ? half + a.lane * (a.e.foot ? 0.2 : 0.8) : laneOffset(a.e.hw || half, WIDTH[a.kind] || 1.8);
      // round the Main Gate island each direction keeps to its own carriageway (look a little ahead)
      if (a.kind !== 'walker' && world.dividers) want = Math.max(want, world.medianNeed(tmp.x, tmp.z), world.medianNeed(tmp.x + tmp.tx * 9, tmp.z + tmp.tz * 9));
      // ease between the lanes of wider and narrower roads (quicker when moving out of the way)
      a.off = a.off == null ? want : a.off + (want - a.off) * (1 - Math.exp(-(want > a.off + 0.3 ? 4 : 1.5) * dt));
      const off = a.off;
      // keep left (India): left normal = (tz, -tx)
      const x = tmp.x + tmp.tz * off, z = tmp.z - tmp.tx * off;
      const hd = Math.atan2(tmp.tx, tmp.tz);
      a.heading = a.heading + wrapAngle(hd - a.heading) * (1 - Math.exp(-6 * dt));
      let px = x, pz = z;
      if (sweepBlocked(world, prev, { x, z, yaw: a.heading }, LEN[a.kind] / 2, WIDTH[a.kind] / 2)) {
        // squeeze towards the middle of the road instead of freezing against the wall
        const alt = [off * 0.4, 0, -off * 0.4].find((o) => !sweepBlocked(world, prev, { x: tmp.x + tmp.tz * o, z: tmp.z - tmp.tx * o, yaw: hd }, LEN[a.kind] / 2, WIDTH[a.kind] / 2));
        if (alt !== undefined) { a.off = alt; px = tmp.x + tmp.tz * alt; pz = tmp.z - tmp.tx * alt; a.heading = hd; }
      }
      const y = world.heightAt(px, pz) + 0.08;
      gp.set(px, y, pz);
      a.group.rotation.y = a.heading;
      const d2 = cam.position.distanceToSquared(gp);
      a.group.visible = d2 < 420 * 420;
      const near = d2 < 160 * 160;
      if (a.kind === 'cyclist') {
        a.bike.spin(a.v * dt);
        if (near) {
          a.bike.setCrank(a.bike.crankAngle + (a.v / a.bike.R) * dt / 2.3);
          a.rider.animate({ type: 'bike', bike: a.bike, speed: a.v }, dt);
        }
      } else if (a.kind === 'walker') {
        if (near) a.rider.animate({ type: a.v > 0.2 ? 'walk' : 'idle', speed: a.v }, dt);
      } else {
        a.veh.spin(a.v * dt);
        a.veh.lights?.(true, dt);
        if (a.rider && near) a.rider.animate({ type: 'scooterRide' }, dt);
        if (!nearest || d2 < nearest.d2) nearest = { d2, a };
        a.near = d2 < 70 * 70;
        if (a.kind === 'ambulance') this.ambD2 = d2;
      }
    }
    if (nearest) {
      return { d: Math.sqrt(nearest.d2), kind: nearest.a.kind === 'shuttle' ? 'bus' : nearest.a.kind, speed: nearest.a.v, pan: this.panFor(nearest.a.group.position, cam) };
    }
    return null;
  }

  panFor(p, cam) {
    const v = new THREE.Vector3().subVectors(p, cam.position);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    return clamp(v.normalize().dot(right), -1, 1);
  }

  /** Agents as obstacles for the player's collision (bicycles etc.). */
  positions() { return this.agents; }

  /** drivers and passengers, transformed with their vehicle */
  draw(crowd) {
    const v = new THREE.Vector3();
    for (const a of this.agents) {
      if (!a.crew?.length || !a.near || !a.group.visible) continue;
      a.group.updateMatrixWorld();
      for (const c of a.crew) {
        v.set(c.lx, c.ly, c.lz).applyMatrix4(a.veh.group.matrixWorld);
        crowd.push({ x: v.x, y: v.y, z: v.z, yaw: a.heading, anim: AN.SIT, phase: 0, speed: 0, extra: 0, look: c.look, opts: c.phone ? c.look.opts | bit(OPT.PHONE) : c.look.opts });
      }
    }
  }
}

const WIDTH = { car: 1.8, shuttle: 2.5, ambulance: 2.0, scooter: 0.8, cyclist: 0.6, walker: 0.5 };
const LEN = { car: 4.4, shuttle: 10.6, ambulance: 6.6, scooter: 1.9, cyclist: 1.8, walker: 0.5 };

function aBus(kind) { return kind === 'shuttle'; }

function laneHalf(kind) {
  return { primary: 4.5, secondary: 4, tertiary: 3.7, unclassified: 3.5, residential: 3.2, service: 2.2, living_street: 2.5 }[kind] || 2.5;
}

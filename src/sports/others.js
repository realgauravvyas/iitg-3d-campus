// Courts and track: basketball (ambient + shootout), volleyball and tennis rallies,
// joggers and the 100 m sprint on the athletics track, and casual life on the grounds
// (frisbee, groups on the grass, joggers round the boundary).
import * as THREE from 'three';
import { Ball } from './ball.js';
import { AN } from '../crowd/people.js';
import { kit, studentLook, pal, C, OPT, bit } from '../crowd/looks.js';
import { hoopU, courtSurface, trackDims } from '../scene/courts.js';
import { mulberry32, clamp, angleDamp } from '../util.js';

/** Throw a ball from a to b along a parabola (apex h above the higher end); returns the velocity. */
function lob(from, to, h) {
  const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
  const top = Math.max(from.y, to.y) + h;
  const vy = Math.sqrt(2 * 9.81 * (top - from.y));
  const tUp = vy / 9.81, tDown = Math.sqrt(Math.max(0.01, (2 * (top - to.y)) / 9.81));
  const T = tUp + tDown;
  void dy;
  return new THREE.Vector3(dx / T, vy, dz / T);
}

export class BasketballCourt {
  constructor(g, f) {
    this.g = g; this.f = f;
    const r = mulberry32(f.i * 17 + 1);
    this.rnd = r;
    this.hoopU = hoopU(f);
    this.players = [];
    const n = 4 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const a = -1 + r() * 2, d = 2.5 + r() * 4;
      this.players.push({ u: this.hoopU - Math.cos(a) * d, v: Math.sin(a) * d, x: 0, y: 0, z: 0, yaw: 0, anim: AN.STAND, phase: r() * 6, speed: 0, extra: 0, look: kit(r, [C.white, C.black, pal('#1f4fa0'), C.red][k % 4]), tu: 0, tv: 0 });
    }
    this.ball = new Ball(g.scene, 'basketball');
    this.t = 1; this.state = 'hold'; this.holder = this.players[0];
  }
  P(u, v) { return this.g.world.fieldPoint(this.f, u, v); }
  hoop() { const p = this.P(this.hoopU, 0); return new THREE.Vector3(p.x, this.g.world.heightAt(p.x, p.z) + 3.05, p.z); }
  update(dt) {
    const W = this.g.world, b = this.ball;
    this.t -= dt;
    for (const p of this.players) {
      if (this.rnd() < dt * 0.5) { const a = -1.2 + this.rnd() * 2.4, d = 2 + this.rnd() * 5; p.tu = this.hoopU - Math.cos(a) * d; p.tv = Math.sin(a) * d; }
      const du = p.tu - p.u, dv = p.tv - p.v, L = Math.hypot(du, dv);
      const sp = L > 0.2 ? 3.2 : 0;
      if (L > 0.2) { p.u += (du / L) * sp * dt; p.v += (dv / L) * sp * dt; }
      const w = this.P(p.u, p.v);
      p.x = w.x; p.z = w.z; p.y = W.heightAt(w.x, w.z);
      const h = this.hoop();
      const f = this.f;
      p.yaw = angleDamp(p.yaw, sp ? Math.atan2(f.ax * du - f.az * dv, f.az * du + f.ax * dv) : Math.atan2(h.x - p.x, h.z - p.z), 8, dt);
      p.speed = sp; p.phase += sp * dt * 3;
      p.anim = p.shootT > 0 ? AN.SHOOT : sp ? AN.RUN : AN.STAND;
      if (p.shootT > 0) { p.shootT -= dt; p.extra = 1 - p.shootT / 0.6; }
    }
    if (this.state === 'hold') {
      const hp = this.holder;
      b.held = true;
      b.pos.set(hp.x + Math.sin(hp.yaw) * 0.35, hp.y + 1.1 + (hp.shootT > 0 ? 0.9 : Math.abs(Math.sin(this.g.time * 6)) * -0.7), hp.z + Math.cos(hp.yaw) * 0.35);
      b.mesh.position.copy(b.pos);
      if (this.t <= 0) { hp.shootT = 0.6; this.state = 'aim'; this.t = 0.45; }
    } else if (this.state === 'aim') {
      if (this.t <= 0) {
        b.held = false;
        const h = this.hoop();
        this.make = this.rnd() < 0.55;
        const tgt = this.make ? h : h.clone().add(new THREE.Vector3((this.rnd() - 0.5) * 0.8, 0.1, (this.rnd() - 0.5) * 0.8));
        b.vel.copy(lob(b.pos, tgt, 1.6)); b.resting = false;
        this.state = 'fly'; this.t = 4;
      }
    } else if (this.state === 'fly') {
      const ev = b.update(dt, W, {});
      const h = this.hoop();
      if (b.vel.y < 0 && Math.abs(b.pos.y - h.y) < 0.15 && Math.hypot(b.pos.x - h.x, b.pos.z - h.z) < 0.35) {
        if (this.make) { b.vel.x *= 0.1; b.vel.z *= 0.1; if (this.near) this.g.audio.tone(900, 0.05, { gain: 0.03 }); }
        else { b.vel.y = 2; b.vel.x = (this.rnd() - 0.5) * 3; b.vel.z = (this.rnd() - 0.5) * 3; this.make = true; }
      }
      if (ev === 'bounce' && this.near) this.g.audio.bounce?.();
      if (b.resting || b.bounces > 3 || this.t < 0) { this.holder = this.players[Math.floor(this.rnd() * this.players.length)]; this.state = 'hold'; this.t = 1.5 + this.rnd() * 2.5; }
      this.t -= dt;
    }
  }
  draw(crowd) { for (const p of this.players) crowd.push(p); }
  dispose() { this.ball.dispose(this.g.scene); }
}

export class VolleyCourt {
  constructor(g, f, kind = 'volleyball') {
    this.g = g; this.f = f; this.kind = kind;
    const r = mulberry32(f.i * 23 + 7); this.rnd = r;
    const n = kind === 'tennis' ? 1 : 3;
    this.players = [];
    for (const side of [-1, 1]) for (let k = 0; k < n; k++) {
      const u = side * (kind === 'tennis' ? f.len / 2 - 1.5 : 2.5 + (k % 2) * 3), v = kind === 'tennis' ? 0 : (k - 1) * 2.6;
      const p = g.world.fieldPoint(f, u, v);
      this.players.push({ side, x: p.x, z: p.z, y: g.world.heightAt(p.x, p.z), yaw: Math.atan2(f.ax * -side, f.az * -side), anim: AN.STAND, phase: r() * 6, speed: 0, extra: 0, look: kit(r, side > 0 ? C.white : pal('#f2c12e'), { female: r() < 0.3 }), hitT: 0 });
    }
    this.ball = new Ball(g.scene, kind);
    this.from = this.players[0]; this.t = 0;
    this.serve();
  }
  serve() {
    const opp = this.players.filter((p) => p.side !== this.from.side);
    const to = opp[Math.floor(this.rnd() * opp.length)];
    const a = new THREE.Vector3(this.from.x, this.from.y + 2.1, this.from.z), b = new THREE.Vector3(to.x, to.y + 2.0, to.z);
    this.ball.set(a.x, a.y, a.z);
    this.ball.vel.copy(lob(a, b, this.kind === 'tennis' ? 0.6 : 2.2));
    this.from.hitT = 0.4;
    this.to = to; this.t = 0;
  }
  update(dt) {
    if (this.manual) return;              // you are playing: the rally activity runs the ball
    const b = this.ball;
    b.update(dt, this.g.world, { drag: 0.002 });
    this.t += dt;
    const d = Math.hypot(b.pos.x - this.to.x, b.pos.z - this.to.z);
    if ((d < 0.7 && b.pos.y < this.to.y + 2.4) || this.t > 4) { this.from = this.to; if (this.rnd() < 0.12) { b.vel.set(0, 0, 0); this.t = -1.5; } this.serve(); if (this.near && this.kind === 'tennis') this.g.audio.tone(700, 0.03, { gain: 0.04 }); }
    for (const p of this.players) { p.hitT -= dt; p.anim = p.hitT > 0 ? (this.kind === 'tennis' ? AN.THROW : AN.SHOOT) : AN.FIELD; p.extra = p.hitT > 0 ? 1 - p.hitT / 0.4 : 0.3; }
  }
  draw(crowd) {
    for (const p of this.players) {
      if (!p.bench) { crowd.push(p); continue; }
      // swapped out: sits on the side of the court and cheers you on
      const s = this.g.world.fieldPoint(this.f, 0, (this.f.wid || 10) / 2 + 1.6);
      crowd.push({ ...p, x: s.x, z: s.z, y: this.g.world.heightAt(s.x, s.z), yaw: Math.atan2(this.f.cx - s.x, this.f.cz - s.z), anim: AN.SITG, extra: 0 });
    }
  }
  dispose() { this.ball.dispose(this.g.scene); }
}

/** Athletics track: an oval inside the field; joggers loop it. */
export class Track {
  constructor(g, f) {
    this.g = g; this.f = f;
    const T = trackDims(f);                    // same oval as the painted track (scene/courts.js)
    this.R = T.R + T.lw / 2;                   // lane 1's running line
    this.straight = T.S;
    this.L = 4 * this.straight + 2 * Math.PI * this.R;
    this.joggers = [];
    const r = mulberry32(f.i * 3 + 9); this.rnd = r;
    for (let k = 0; k < 16; k++) this.joggers.push({ s: r() * this.L, lane: k < 3 ? k % 2 : 3 + Math.floor(r() * 5), v: k < 3 ? 5.2 + r() * 1.2 : 2.4 + r() * 1.4, x: 0, y: 0, z: 0, yaw: 0, anim: AN.RUN, phase: r() * 6, speed: 3, extra: 0, look: kit(r, [C.white, C.black, pal('#3f6fb0'), C.red, pal('#5b7f3a')][k % 5], { female: r() < 0.35 }) });
    this.active = 0;
  }
  /** point on the oval (anticlockwise), lane offset in metres */
  at(s, lane) {
    s = ((s % this.L) + this.L) % this.L;
    const S = this.straight, R = this.R + lane * 1.22;
    let u, v, tu, tv;
    if (s < 2 * S) { u = -S + s; v = -R; tu = 1; tv = 0; }
    else if (s < 2 * S + Math.PI * this.R) { const a = (s - 2 * S) / this.R - Math.PI / 2; u = S + Math.cos(a) * R; v = Math.sin(a) * R; tu = -Math.sin(a); tv = Math.cos(a); }
    else if (s < 4 * S + Math.PI * this.R) { u = S - (s - 2 * S - Math.PI * this.R); v = R; tu = -1; tv = 0; }
    else { const a = (s - 4 * S - Math.PI * this.R) / this.R + Math.PI / 2; u = -S + Math.cos(a) * R; v = Math.sin(a) * R; tu = -Math.sin(a); tv = Math.cos(a); }
    return { u, v, tu, tv };
  }
  update(dt, count) {
    this.active = count;
    const W = this.g.world, f = this.f;
    for (let k = 0; k < count; k++) {
      const j = this.joggers[k];
      j.s += j.v * dt;
      const q = this.at(j.s, j.lane), p = W.fieldPoint(f, q.u, q.v);
      j.x = p.x; j.z = p.z; j.y = W.heightAt(p.x, p.z);
      j.yaw = Math.atan2(f.ax * q.tu - f.az * q.tv, f.az * q.tu + f.ax * q.tv);
      j.phase += (j.v * dt / 2.1) * Math.PI * 2; j.speed = j.v;
    }
  }
  draw(crowd) { for (let k = 0; k < this.active; k++) crowd.push(this.joggers[k]); }
}

/** Casual life on a big ground: frisbee pairs, groups on the grass, boundary joggers. */
export class GroundLife {
  constructor(g, f) {
    this.g = g; this.f = f;
    const r = mulberry32(f.i * 41 + 2); this.rnd = r;
    const R = Math.min(f.len, f.wid) / 2;
    this.pairs = [];
    for (let k = 0; k < 5; k++) {
      const u = (r() - 0.5) * R * 1.3, v = (k % 2 ? 1 : -1) * R * (0.35 + r() * 0.3);
      const A = { u, v: v - 8, look: studentLook(r) }, B = { u: u + 3, v: v + 8, look: studentLook(r) };
      for (const p of [A, B]) { const w = g.world.fieldPoint(f, p.u, p.v); Object.assign(p, { x: w.x, z: w.z, y: g.world.heightAt(w.x, w.z), yaw: 0, anim: AN.STAND, phase: 0, speed: 0, extra: 0 }); }
      A.yaw = Math.atan2(B.x - A.x, B.z - A.z); B.yaw = A.yaw + Math.PI;
      const disc = new Ball(g.scene, k % 2 ? 'cricket' : k === 4 ? 'football' : 'disc');
      this.pairs.push({ A, B, disc, from: A, t: 0 });
      this.throw(this.pairs[k]);
    }
    this.sitters = [];
    for (let k = 0; k < 5; k++) {
      const cu = (r() - 0.5) * R * 1.4, cv = (r() - 0.5) * R * 1.4, n = 3 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, w = g.world.fieldPoint(f, cu + Math.cos(a), cv + Math.sin(a));
        const c = g.world.fieldPoint(f, cu, cv);
        this.sitters.push({ x: w.x, z: w.z, y: g.world.heightAt(w.x, w.z), yaw: Math.atan2(c.x - w.x, c.z - w.z), anim: r() < 0.2 ? AN.LIE : AN.SITG, phase: r() * 6, speed: 0, extra: 0, look: studentLook(r) });
      }
    }
  }
  throw(pr) {
    const to = pr.from === pr.A ? pr.B : pr.A;
    const a = new THREE.Vector3(pr.from.x, pr.from.y + 1.2, pr.from.z), b = new THREE.Vector3(to.x, to.y + 1.3, to.z);
    pr.disc.set(a.x, a.y, a.z);
    const d = b.clone().sub(a), L = Math.hypot(d.x, d.z);
    pr.disc.vel.set((d.x / L) * 9, 1.2, (d.z / L) * 9);
    pr.to = to; pr.t = 0;
    pr.from.anim = AN.THROW; pr.from.extra = 0; pr.from.throwT = 0.4;
  }
  update(dt) {
    for (const pr of this.pairs) {
      pr.disc.update(dt, this.g.world, { drag: 0.004 });
      pr.disc.mesh.rotation.y += dt * 20;
      pr.t += dt;
      for (const p of [pr.A, pr.B]) { if (p.throwT > 0) { p.throwT -= dt; p.extra = 1 - p.throwT / 0.4; } else p.anim = AN.FIELD; }
      const d = Math.hypot(pr.disc.pos.x - pr.to.x, pr.disc.pos.z - pr.to.z);
      if (d < 1.0 || pr.t > 3.5 || pr.disc.resting) { pr.from = pr.to; this.throw(pr); }
    }
  }
  draw(crowd) { for (const pr of this.pairs) { crowd.push(pr.A); crowd.push(pr.B); } for (const s of this.sitters) crowd.push(s); }
  setVisible(v) { for (const pr of this.pairs) pr.disc.mesh.visible = v; }
  dispose() { for (const pr of this.pairs) pr.disc.dispose(this.g.scene); }
}

// ---------------------------------------------------------------- player activities
export function shootoutActivity(court) {
  return {
    name: 'hoops', hud: 'Shootout: hold Space and release in the green zone',
    start() {
      this.shot = 0; this.made = 0; this.charge = -1; this.state = 'ready';
      this.ball = court.ball; this.ball.held = true;
      this.place();
    },
    place() {
      const g = this.g, a = -1.1 + (this.shot / 9) * 2.2, d = 4.5 + (this.shot % 3) * 1.1;
      const p = court.P(court.hoopU - Math.cos(a) * d, Math.sin(a) * d);
      g.player.pos.set(p.x, g.world.heightAt(p.x, p.z), p.z);
      const h = court.hoop();
      g.player.heading = Math.atan2(h.x - p.x, h.z - p.z);
      this.dist = d; this.ideal = 0.45 + (d - 4.5) * 0.12; this.tol = 0.11 - (d - 4.5) * 0.02;
      this.state = 'ready';
      this.render();
    },
    render(extra = '') {
      const w = this.charge >= 0 ? this.charge : 0;
      this.g.ui.actPanel({ title: `Shootout · shot ${Math.min(10, this.shot + 1)} of 10`, html: `<p class="big-num">${this.made} / ${this.shot}</p><div class="power"><i style="left:${(this.ideal - this.tol) * 100}%;width:${this.tol * 200}%"></i><b style="left:${w * 100}%"></b></div><p class="dim">${this.dist.toFixed(1)} m from the hoop ${extra}</p>`, buttons: [] });
    },
    update(dt) {
      const g = this.g, i = g.input, b = this.ball, P = g.player;
      P.avatar.root.position.copy(P.pos); P.avatar.root.rotation.set(0, P.heading, 0);
      if (this.state === 'ready') {
        b.pos.set(P.pos.x + Math.sin(P.heading) * 0.35, P.pos.y + 1.15, P.pos.z + Math.cos(P.heading) * 0.35); b.mesh.position.copy(b.pos);
        if (i.down('Space')) { this.charge = this.charge < 0 ? 0 : this.charge; this.cT = (this.cT || 0) + dt; this.charge = 0.5 - 0.5 * Math.cos(this.cT * 2.6); this.render(); }
        else if (this.charge >= 0) {
          const q = 1 - Math.abs(this.charge - this.ideal) / this.tol;
          this.make = q > 0.35 || (q > 0 && Math.random() < 0.5);
          const h = court.hoop();
          const tgt = this.make ? h : h.clone().add(new THREE.Vector3((this.charge - this.ideal) * 2, 0.15, (Math.random() - 0.5) * 0.6));
          b.held = false; b.pos.y += 0.5;
          b.vel.copy(lob(b.pos, tgt, 1.4 + this.dist * 0.12)); b.resting = false;
          this.state = 'fly'; this.ft = 0; this.charge = -1; this.cT = 0; this.shotAnim = 0.6;
        }
        P.avatar.animate({ type: 'shoot', shot: this.charge > 0 ? 0.1 : 0 }, dt);
      } else {
        this.ft += dt;
        this.shotAnim -= dt;
        P.avatar.animate({ type: 'shoot', shot: Math.max(0, Math.min(1, 1 - this.shotAnim / 0.6)) }, dt);
        b.update(dt, g.world, {});
        const h = court.hoop();
        if (!this.scored && b.vel.y < 0 && Math.abs(b.pos.y - h.y) < 0.2 && Math.hypot(b.pos.x - h.x, b.pos.z - h.z) < 0.3) {
          if (this.make) { this.scored = true; this.made++; g.audio.tone(1000, 0.05, { gain: 0.05 }); g.ui.floatText('Swish!', 'coin'); b.vel.x *= 0.1; b.vel.z *= 0.1; }
          else { b.vel.y = 2.5; b.vel.x = (Math.random() - 0.5) * 3; b.vel.z = (Math.random() - 0.5) * 3; g.audio.tone(300, 0.08, { type: 'square', gain: 0.04 }); }
        }
        if (this.ft > 2.6) {
          this.shot++; this.scored = false;
          if (this.shot >= 10) {
            g.progress.addXP(10 + this.made * 5, 'basketball');
            if (this.made >= 5) g.progress.unlock('hoops');
            g.ui.toast(`${this.made} of 10 baskets`, this.made >= 5 ? 'gold' : 'info', 'Shootout');
            b.held = false;
            return false;
          }
          b.held = true; this.place();
        }
      }
    },
    camera(cam, dt) {
      const P = this.g.player, h = court.hoop();
      const dx = h.x - P.pos.x, dz = h.z - P.pos.z, L = Math.hypot(dx, dz);
      const want = new THREE.Vector3(P.pos.x - (dx / L) * 3.4 + (dz / L) * 0.8, P.pos.y + 2.1, P.pos.z - (dz / L) * 3.4 - (dx / L) * 0.8);
      cam.position.lerp(want, 1 - Math.exp(-6 * dt));
      cam.lookAt(h.x, h.y - 0.6, h.z);
      return true;
    },
    end() { court.ball.held = false; court.state = 'hold'; },
  };
}

/**
 * Swap in on a volleyball or tennis court: one of the players steps off to the side and you take
 * their place. The ball comes over the net; move (A/D, W/S) under it and press Space as it reaches
 * you to hit it back. Tennis: first to 5 points against the player opposite; volleyball: first to 7,
 * your team-mates set it up and you hit it over.
 */
/** Tennis / volleyball with you on the near side (+u). The ball flies on known arcs (tennis:
 *  one bounce on your side), a ring shows where it will land, and you have a generous window:
 *  be roughly under it and press Space as it arrives (A/D held while hitting aims the return). */
export function rallyActivity(court) {
  const tennis = court.kind === 'tennis';
  const W = court.g.world, f = court.f;
  const lL = tennis ? Math.min(23.77, f.len) : Math.min(18, f.len), lW = tennis ? Math.min(10.97, f.wid) : Math.min(9, f.wid);
  const BL = lL / 2, SW = lW / 2;                      // baseline u, half width of the court (doubles)
  const G = 9.81, y0 = W.heightAt(f.cx, f.cz);
  const arc = (a, b, T, t) => {                        // point on the parabola a -> b in time T
    const k = t / T;
    return { u: a.u + (b.u - a.u) * k, v: a.v + (b.v - a.v) * k, h: a.h + (b.h - a.h) * k + 0.5 * G * t * (T - t) };
  };
  const yourServe = (n) => tennis && Math.floor(n / 2) % 2 === 1;
  return {
    name: tennis ? 'tennis' : 'volleyball', keepMoving: false,
    hud: tennis ? 'Tennis: WASD move · Space hit as the ball reaches you (hold A / D to aim)' : 'Volleyball: WASD move · Space bump / hit as the ball reaches you',
    start() {
      const g = this.g;
      court.manual = true;
      this.out = court.players.filter((p) => p.side > 0).sort((a, b) => Math.abs(a.v ?? 0) - Math.abs(b.v ?? 0))[0];
      if (this.out) this.out.bench = true;
      this.opp = court.players.filter((p) => p.side < 0);
      this.oppPos = this.opp.map((p, k) => ({ u: -(tennis ? BL + 0.6 : 3 + (k % 2) * 2.5), v: tennis ? 0 : (k - 1) * 2.6 }));
      this.u = tennis ? BL + 0.8 : 3.5; this.v = 0;
      this.score = [0, 0]; this.target = tennis ? 7 : 11;
      this.serveN = 0; this.state = 'wait'; this.wait = 1.6; this.swing = 0; this.buffer = 0; this.rally = 0;
      // landing ring + ball shadow
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe04a, transparent: true, opacity: 0.85, depthWrite: false }));
      this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
      g.scene.add(this.ring, this.shadow);
      this.ring.visible = this.shadow.visible = false;
      // a racket in your hand
      if (tennis) {
        const r = new THREE.Group();
        const dark = new THREE.MeshStandardMaterial({ color: 0x1d2a3a, roughness: 0.5 }), grip = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.8 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.26, 8), grip); handle.position.y = -0.34; r.add(handle);
        const head = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 20), dark); head.scale.set(1, 1.3, 1); head.position.y = -0.63; r.add(head);
        const strings = new THREE.Mesh(new THREE.CircleGeometry(0.125, 18), new THREE.MeshStandardMaterial({ color: 0xe8f0c0, transparent: true, opacity: 0.45, side: THREE.DoubleSide })); strings.scale.set(1, 1.3, 1); strings.position.y = -0.63; r.add(strings);
        g.player.avatar.J.elbowR.add(r);
        this.racket = r;
      }
      this.place();
      g.audio.whistle?.();
    },
    world(u, v, h = 0) { const p = W.fieldPoint(f, u, v); return new THREE.Vector3(p.x, y0 + h, p.z); },
    place() {
      const P = this.g.player, p = this.world(this.u, this.v);
      P.pos.copy(p);
      P.heading = Math.atan2(-f.ax, -f.az);
      P.avatar.root.position.copy(P.pos); P.avatar.root.rotation.set(0, P.heading, 0);
    },
    /** new ball flight: segments [{a, b, T}] in court coords (u, v, h above the court) */
    fly(segs, incoming) { this.segs = segs; this.si = 0; this.st = 0; this.incoming = incoming; this.state = 'fly'; },
    incomingShot() {
      // from the other side to a bounce point on yours, then up to about waist height
      const k = Math.floor(Math.random() * this.oppPos.length), o = this.oppPos[k];
      const from = { u: o.u, v: o.v, h: tennis ? 1.0 : 2.3 };
      const lv = (Math.random() - 0.5) * 2 * (SW - 0.9);
      if (tennis) {
        const bu = 4 + Math.random() * (BL - 5.5);
        const land = { u: bu, v: lv, h: 0.04 };
        const reach = { u: Math.min(BL + 2.4, bu + 4.2 + Math.random() * 1.4), v: lv + (lv - from.v) * 0.25, h: 0.95 };
        this.fly([{ a: from, b: land, T: 1.3 - Math.min(0.35, this.rally * 0.03) }, { a: land, b: reach, T: 0.6 }], true);
        this.mark = land;
      } else {
        const land = { u: 1.8 + Math.random() * (BL - 2.6), v: lv, h: 1.9 };
        this.fly([{ a: from, b: land, T: 1.55 }], true);
        this.mark = { ...land, h: 0.02 };
      }
      if (this.opp[k]) this.opp[k].hitT = 0.4;
      this.g.audio.tone(tennis ? 700 : 400, 0.05, { gain: 0.05 });
    },
    returnShot(quality, aim) {
      const tv = aim ? clamp(aim * (SW - 1.1), -(SW - 0.6), SW - 0.6) : (Math.random() - 0.5) * (SW - 1);
      const from = { u: this.u - 0.4, v: this.v, h: tennis ? 1.0 : 2.1 };
      const deep = tennis ? -(3 + Math.random() * (BL - 4.5)) : -(1.5 + Math.random() * (BL - 2.2));
      const land = { u: deep, v: tv, h: tennis ? 0.04 : 1.9 };
      const segs = tennis ? [{ a: from, b: land, T: 1.15 - quality * 0.2 }, { a: land, b: { u: deep - 4.5, v: tv, h: 0.9 }, T: 0.55 }] : [{ a: from, b: land, T: 1.45 }];
      this.fly(segs, false);
      this.mark = { ...land, h: 0.02 };
      // can the other side get to it? corners and clean contact make it harder, long rallies tire them
      const o = this.oppPos.reduce((a, c) => (Math.abs(c.v - tv) + Math.abs(c.u - deep) * 0.3 < Math.abs(a.v - tv) + Math.abs(a.u - deep) * 0.3 ? c : a), this.oppPos[0]);
      const run = Math.abs(o.v - tv) / (SW * 2);
      this.oppGets = Math.random() < clamp(0.9 - run * 0.5 - quality * 0.25 - this.rally * 0.03, 0.25, 0.9);
      this.chaser = o;
    },
    point(me, msg) {
      const g = this.g;
      this.score[me ? 0 : 1]++;
      g.audio.tone(me ? 880 : 330, 0.12, { gain: 0.05, type: 'triangle' });
      g.ui.floatText(msg || (me ? 'Point!' : 'Missed'), me ? 'coin' : 'xp');
      if (me) g.audio.cheer?.(0.25);
      this.state = 'wait'; this.wait = 1.5; this.rally = 0; this.hinted = false;
      this.ring.visible = this.shadow.visible = false;
      this.serveN++;
    },
    update(dt) {
      const g = this.g, i = g.input, b = court.ball;
      const ax = i.axis();
      const hw = SW + (tennis ? 1.8 : 1.2), uMin = tennis ? 1.2 : 0.6, uMax = BL + (tennis ? 3.2 : 1.5);
      let mv = -ax.x * 5.6 * dt, mu = -ax.y * 4.8 * dt;
      // a little help: drift towards where the ball is going when you are close
      if (this.state === 'fly' && this.incoming) {
        const last = this.segs[this.segs.length - 1].b;
        const dv = last.v - this.v, du = last.u - this.u;
        if (Math.abs(dv) < 3.5 && !ax.x) mv += clamp(dv, -1, 1) * 2.4 * dt;
        if (Math.abs(du) < 3 && !ax.y) mu += clamp(du, -1, 1) * 1.6 * dt;
      }
      this.v = clamp(this.v + mv, -hw, hw);
      this.u = clamp(this.u + mu, uMin, uMax);
      this.place();
      this.swing = Math.max(0, this.swing - dt);
      this.buffer = Math.max(0, this.buffer - dt);
      if (i.hit('Space')) { this.buffer = 0.22; if (this.swing <= 0) this.swing = 0.5; }
      g.player.avatar.animate(tennis ? { type: 'bat', swing: this.swing > 0 ? 1 - this.swing / 0.5 : 0 } : { type: 'shoot', shot: this.swing > 0 ? 1 - this.swing / 0.5 : 0 }, dt);
      // the other side shuffles towards the ball
      const chasing = this.state === 'fly' && !this.incoming && this.oppGets ? this.chaser : null;
      const endB = this.segs ? this.segs[this.segs.length - 1].b : null;
      this.oppPos.forEach((o, k) => {
        const want = chasing === o ? { u: endB.u, v: endB.v } : { u: -(tennis ? BL + 0.6 : 3 + (k % 2) * 2.5), v: tennis ? this.v * 0.4 : (k - 1) * 2.6 };
        const du = want.u - o.u, dv = want.v - o.v, L = Math.hypot(du, dv), m = Math.min(L, 5.2 * dt);
        if (L > 0.05) { o.u += (du / L) * m; o.v += (dv / L) * m; }
        const p = this.opp[k], w = this.world(o.u, o.v);
        p.x = w.x; p.z = w.z; p.y = y0; p.speed = L > 0.2 ? 4 : 0;
        p.hitT -= dt; p.anim = p.hitT > 0 ? (tennis ? AN.THROW : AN.SHOOT) : L > 0.3 ? AN.RUN : AN.FIELD; p.extra = p.hitT > 0 ? 1 - p.hitT / 0.4 : 0.3;
        p.phase += dt * 6;
      });
      if (this.state === 'wait') {
        this.wait -= dt;
        const yours = yourServe(this.serveN);
        const hold = yours ? this.world(this.u - 0.3, this.v + 0.2, 1.3 + Math.abs(Math.sin(this.t * 3)) * 0.4) : this.world(this.oppPos[0].u, this.oppPos[0].v, 1.2);
        b.pos.copy(hold); b.mesh.position.copy(hold); b.resting = true;
        if (yours) {
          if (this.wait <= 0 && this.buffer > 0) { this.buffer = 0; g.audio.tone(760, 0.05, { gain: 0.06 }); this.returnShot(0.6, ax.x ? -ax.x : 0); }
          else if (this.wait <= 0 && !this.hinted) { this.hinted = true; g.ui.floatText('Your serve: press Space', 'xp'); }
        } else if (this.wait <= 0) this.incomingShot();
      } else if (this.state === 'fly') {
        this.st += dt;
        let seg = this.segs[this.si];
        while (this.st > seg.T && this.si < this.segs.length - 1) { this.st -= seg.T; this.si++; seg = this.segs[this.si]; if (tennis) g.audio.tone(240, 0.04, { gain: 0.05 }); }
        const q = arc(seg.a, seg.b, seg.T, this.st);
        const wp = this.world(q.u, q.v, Math.max(0.035, q.h));
        b.pos.copy(wp); b.mesh.position.copy(wp);
        this.shadow.position.set(wp.x, y0 + 0.08, wp.z); this.shadow.visible = true;
        this.ring.visible = true; this.ring.position.copy(this.world(this.mark.u, this.mark.v, 0.08));
        this.ring.material.color.set(this.incoming ? 0xffe04a : 0x9ad0ff);
        const last = this.si === this.segs.length - 1;
        if (this.incoming) {
          // hit: the ball is within reach of your racket (generous) and you pressed Space just now
          const me = this.world(this.u - 0.2, this.v - (tennis ? 0.45 : 0), tennis ? 1.0 : 1.9);
          const d = wp.distanceTo(me);
          const inPlay = !tennis || this.si > 0 || this.u < BL * 0.45;   // tennis: after the bounce, or a volley at the net
          if (this.buffer > 0 && d < (tennis ? 1.9 : 1.8) && inPlay) {
            this.buffer = 0; this.rally++;
            const quality = clamp(1 - d / 1.9, 0, 1);
            g.audio.tone(tennis ? 760 : 420, 0.06, { gain: 0.07 });
            g.ui.floatText(quality > 0.6 ? 'Perfect!' : quality > 0.3 ? 'Good' : 'Just made it', 'coin');
            this.returnShot(quality, ax.x ? -ax.x : 0);
          } else if (last && this.st > seg.T + (tennis ? 0.25 : 0.05)) this.point(false, d < 3 ? 'Too late' : 'Missed');
        } else if (last && !this.oppGets && this.st > seg.T * 0.35) this.point(true, 'Winner!');
        else if (last && this.oppGets && this.st > seg.T * 0.55) this.incomingShot();
      }
      this.rT = (this.rT || 0) - dt;
      if (this.rT <= 0) {
        this.rT = 0.25;
        const yours = yourServe(this.serveN);
        g.ui.actPanel({ title: tennis ? 'Tennis · tiebreak to 7' : 'Volleyball · rally to 11', html: `<p class="big-num">${this.score[0]} : ${this.score[1]}</p><p class="dim">${yours ? 'Your serve: press Space.' : 'The yellow ring shows where the ball lands.'} Get under it and press Space as it reaches you. Hold A or D while hitting to aim.</p>`, buttons: [{ label: '<kbd>Esc</kbd> Stop playing', key: 'Escape', onClick: () => (this.done = true) }] });
      }
      if (this.score[0] >= this.target || this.score[1] >= this.target) {
        const won = this.score[0] > this.score[1];
        g.progress.addXP(15 + this.score[0] * 3, tennis ? 'tennis' : 'volleyball');
        if (won) { g.progress.earn(40, tennis ? 'tennis win' : 'volleyball win'); g.audio.reward?.(true); }
        g.ui.toast(`${won ? 'You won' : 'You lost'} ${this.score[0]} - ${this.score[1]}`, won ? 'gold' : 'info', tennis ? 'Tennis' : 'Volleyball');
        return false;
      }
      if (this.done) return false;
    },
    camera(cam, dt) {
      const P = this.g.player;
      // behind you (but inside the fence), high enough to see the whole court
      const back = Math.max(1.5, Math.min(6.2, courtSurface(f).hl - 0.7 - this.u));
      const want = new THREE.Vector3(P.pos.x + f.ax * back, P.pos.y + (tennis ? 4.4 : 3.6), P.pos.z + f.az * back);
      cam.position.lerp(want, 1 - Math.exp(-5 * dt));
      cam.lookAt(this.world(-BL * 0.55, this.v * 0.35, 0.6));
      return true;
    },
    end() {
      const g = this.g;
      if (this.out) this.out.bench = false;
      court.manual = false; court.serve();
      for (const m of [this.ring, this.shadow]) { if (!m) continue; g.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
      if (this.racket) { this.racket.parent?.remove(this.racket); this.racket.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
      // everyone back to their places
      court.players.filter((p) => p.side < 0).forEach((p, k) => { const w = W.fieldPoint(f, -(tennis ? f.len / 2 - 1.5 : 2.5 + (k % 2) * 3), tennis ? 0 : (k - 1) * 2.6); p.x = w.x; p.z = w.z; });
    },
  };
}

export function sprintActivity(track, onFinish) {
  return {
    name: 'sprint', hud: 'Sprint: alternate A and D (← →) as fast as you can · wait for GO',
    start() {
      const r = Math.random;
      this.lane = 3;
      this.runners = [];
      for (let k = 0; k < 6; k++) {
        if (k === this.lane) continue;
        this.runners.push({ lane: k, x: 0, y: 0, z: 0, yaw: 0, anim: AN.FIELD, phase: 0, speed: 0, extra: 0, look: kit(mulberry32(k * 9 + 1), [C.red, pal('#1f4fa0'), C.green, pal('#f2c12e'), C.black, C.white][k]), top: 8.2 + r() * 1.5, acc: 3.2 + r() * 1.2, d: 0, v: 0, fin: 0 });
      }
      this.d = 0; this.v = 0; this.phase = 'marks'; this.st = 0; this.next = 'A'; this.fin = 0;
      this.place();
      this.g.audio.speak?.('On your marks.');
    },
    lanePos(lane, d) {
      // the 100 m finishes on the painted line at the end of the home straight (u = S), each in their own lane
      const tr = track, u = tr.straight - 100 + d, v = -(tr.R + lane * 1.22);
      return tr.g.world.fieldPoint(tr.f, u, v);
    },
    place() {
      const g = this.g;
      for (const rn of this.runners) { const p = this.lanePos(rn.lane, rn.d); rn.x = p.x; rn.z = p.z; rn.y = g.world.heightAt(p.x, p.z); rn.yaw = Math.atan2(track.f.ax, track.f.az); }
      const p = this.lanePos(this.lane, this.d);
      g.player.pos.set(p.x, g.world.heightAt(p.x, p.z), p.z);
      g.player.heading = Math.atan2(track.f.ax, track.f.az);
    },
    update(dt) {
      const g = this.g, i = g.input;
      this.st += dt;
      if (this.phase === 'marks' && this.st > 1.6) { this.phase = 'set'; this.st = 0; g.audio.speak?.('Set.'); }
      if (this.phase === 'set' && this.st > 1.2 + Math.random() * 0.02) { this.phase = 'go'; this.st = 0; this.t0 = this.t; g.audio.whistle?.(); g.ui.floatText('GO!', 'coin'); }
      const a = i.hit('KeyA', 'ArrowLeft'), d = i.hit('KeyD', 'ArrowRight');
      if (this.phase !== 'go' && (a || d) && this.phase !== 'done') { g.ui.toast('False start! Wait for GO.', 'warn'); this.st = 0; this.phase = 'marks'; }
      if (this.phase === 'go') {
        if ((this.next === 'A' && a) || (this.next === 'D' && d)) { this.v = Math.min(10.4, this.v + 0.62); this.next = this.next === 'A' ? 'D' : 'A'; }
        this.v = Math.max(0, this.v - dt * 2.2);
        this.d += this.v * dt;
        for (const rn of this.runners) { rn.v = Math.min(rn.top, rn.v + rn.acc * dt); rn.d += rn.v * dt; if (!rn.fin && rn.d >= 100) rn.fin = this.t - this.t0; rn.phase += (rn.v * dt / 2.3) * Math.PI * 2; rn.anim = rn.v > 1 ? AN.SPRINT : AN.FIELD; }
        if (!this.fin && this.d >= 100) this.fin = this.t - this.t0;
      }
      this.place();
      g.player.avatar.root.position.copy(g.player.pos); g.player.avatar.root.rotation.set(0, g.player.heading, 0);
      g.player.avatar.animate({ type: this.v > 1 ? 'run' : 'idle', speed: this.v * 1.1 }, dt);
      g.ui.actPanel({ title: '100 m · athletics track', html: `<p class="big-num">${this.phase === 'go' ? (this.fin || this.t - this.t0).toFixed(2) + ' s' : this.phase === 'set' ? 'SET' : 'ON YOUR MARKS'}</p><p>${Math.min(100, this.d).toFixed(0)} m · ${(this.v * 3.6).toFixed(0)} km/h</p>`, buttons: [] });
      if (this.fin && this.runners.every((r) => r.fin || r.d > 100)) {
        const place = 1 + this.runners.filter((r) => r.fin && r.fin < this.fin).length;
        g.progress.addXP(15 + (7 - place) * 6, 'sprint');
        if (place === 1) { g.progress.unlock('sprint'); g.progress.earn(50, 'first place'); }
        g.ui.toast(`You finished ${['1st', '2nd', '3rd', '4th', '5th', '6th'][place - 1]} in ${this.fin.toFixed(2)} s`, place === 1 ? 'gold' : 'info', '100 m');
        onFinish?.(place, this.fin);
        return false;
      }
    },
    camera(cam, dt) {
      const P = this.g.player, f = track.f;
      const want = new THREE.Vector3(P.pos.x - f.az * 7 - f.ax * 3, P.pos.y + 2.4, P.pos.z + f.ax * 7 - f.az * 3);
      cam.position.lerp(want, 1 - Math.exp(-5 * dt));
      cam.lookAt(P.pos.x + f.ax * 4, P.pos.y + 1, P.pos.z + f.az * 4);
      return true;
    },
    draw(crowd) { for (const r of this.runners) crowd.push(r); },
  };
}
export { OPT, bit };

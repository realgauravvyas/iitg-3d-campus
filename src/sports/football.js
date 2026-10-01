// Football kickabout (7-a-side) with simple team AI; the player can join a team.
import * as THREE from 'three';
import { Ball } from './ball.js';
import { AN } from '../crowd/people.js';
import { kit, pal, studentLook } from '../crowd/looks.js';
import { mulberry32, clamp, angleDamp } from '../util.js';

const FORM = [[-0.92, 0], [-0.55, -0.35], [-0.55, 0.35], [-0.15, -0.5], [-0.15, 0.5], [0.25, -0.2], [0.3, 0.25]];
// full pitch: 11-a-side, 4-3-3
const FORM11 = [[-0.92, 0], [-0.62, -0.62], [-0.64, -0.22], [-0.64, 0.22], [-0.62, 0.62], [-0.25, -0.45], [-0.28, 0], [-0.25, 0.45], [0.2, -0.6], [0.26, 0], [0.2, 0.6]];

export class FootballGame {
  constructor(g, field, { n = field.len > 90 ? 11 : 7 } = {}) {
    this.g = g; this.f = field;
    const r = mulberry32(field.i * 7 + 3);
    this.rnd = r;
    this.hl = field.len / 2 - 3; this.hw = field.wid / 2 - 3;
    this.cols = [pal('#1f4fa0'), pal('#c62828')];
    this.players = [];
    for (let t = 0; t < 2; t++) for (let k = 0; k < n; k++) {
      const [fu, fv] = (n === 11 ? FORM11 : FORM)[k];
      const side = t === 0 ? 1 : -1;
      const L = kit(r, this.cols[t]);
      if (k === 0) { L.col0[1] = pal(t ? '#2e7d32' : '#f2c12e'); }
      this.players.push({ team: t, role: k === 0 ? 'keeper' : 'field', fu: fu * side, fv, u: fu * side * this.hl, v: fv * this.hw, yaw: 0, x: 0, y: 0, z: 0, anim: AN.STAND, phase: r() * 6, speed: 0, extra: 0, look: L, kickT: 0 });
    }
    this.ball = new Ball(g.scene, 'football');
    this.resetBall();
    this.score = [0, 0];
    this.spect = [];
    for (let i = 0; i < 18; i++) {
      const s = r() < 0.5 ? 1 : -1, u = (r() - 0.5) * this.hl * 1.6, v = s * (this.hw + 4 + r() * 3);
      const p = g.world.fieldPoint(field, u, v);
      this.spect.push({ x: p.x, z: p.z, y: g.world.heightAt(p.x, p.z), yaw: Math.atan2(field.cx - p.x, field.cz - p.z), anim: r() < 0.6 ? AN.SITG : AN.STAND, phase: r() * 6, speed: 0, extra: 0, look: studentLook(r) });
    }
    this.you = null;
  }
  P(u, v) { return this.g.world.fieldPoint(this.f, u, v); }
  UV(x, z) { const dx = x - this.f.cx, dz = z - this.f.cz; return [dx * this.f.ax + dz * this.f.az, -dx * this.f.az + dz * this.f.ax]; }
  resetBall() { const p = this.P(0, 0); this.ball.set(p.x, this.g.world.heightAt(p.x, p.z) + 0.3, p.z); this.lastTouch = -1; }

  kick(from, tu, tv, power) {
    const b = this.ball;
    const t = this.P(tu, tv);
    const dx = t.x - b.pos.x, dz = t.z - b.pos.z, L = Math.hypot(dx, dz) || 1;
    const sp = 8 + power * 16;
    b.vel.set((dx / L) * sp, 1.5 + power * 4.5 * (L > 25 ? 1 : 0.4), (dz / L) * sp);
    b.resting = false;
    this.lastTouch = from ? from.team : 0;
    if (from) from.kickT = 0.35;
    this.g.audio.kick?.();
  }

  update(dt) {
    const g = this.g, W = g.world, b = this.ball;
    b.update(dt, W, { drag: 0.01, friction: 2.2 });
    let [bu, bv] = this.UV(b.pos.x, b.pos.z);
    // goals: the ball crosses a goal line between the posts
    if (Math.abs(bu) > this.hl + 1.5 && Math.abs(bv) < 3.66 && b.pos.y - W.heightAt(b.pos.x, b.pos.z) < 2.44) {
      const team = bu > 0 ? 0 : 1;               // team 0 attacks +u
      this.score[team]++;
      g.audio.cheer?.(0.8); g.audio.whistle?.();
      if (this.you && team === this.you.team && this.lastTouch === 'you') { g.progress.unlock('goal'); g.ui.floatText('GOAL!', 'coin'); g.progress.addXP(30, 'goal'); }
      else if (this.you) g.ui.floatText(team === this.you.team ? 'Your team scores!' : 'They scored!', 'xp');
      this.resetBall();
      return;
    }
    if (Math.abs(bu) > this.hl + 4 || Math.abs(bv) > this.hw + 4) { this.ball.set(...this.clampBall(bu, bv)); [bu, bv] = this.UV(b.pos.x, b.pos.z); }
    // AI: closest outfield player of each team chases; others hold shape shifted with the ball
    const chase = [null, null];
    for (let t = 0; t < 2; t++) {
      let best = null, bd = Infinity;
      for (const p of this.players) { if (p.team !== t || p.role === 'keeper' || p.you) continue; const d = Math.hypot(p.u - bu, p.v - bv); if (d < bd) { bd = d; best = p; } }
      chase[t] = best;
    }
    for (const p of this.players) {
      if (p.you) continue;
      const side = p.team === 0 ? 1 : -1;
      let tu, tv, sp = 5.2;
      if (p.role === 'keeper') { tu = -side * (this.hl - 0.8); tv = clamp(bv * 0.4, -3, 3); sp = 4; }
      else if (p === chase[p.team]) { tu = bu - side * 0.5; tv = bv; sp = 6.2; }
      else { tu = clamp(p.fu * this.hl + bu * 0.45, -this.hl, this.hl); tv = clamp(p.fv * this.hw + bv * 0.3, -this.hw, this.hw); sp = 4.2; }
      const du = tu - p.u, dv = tv - p.v, L = Math.hypot(du, dv);
      const mv = Math.min(L, sp * dt);
      if (L > 0.05) { p.u += (du / L) * mv; p.v += (dv / L) * mv; }
      p.speed = L > 0.3 ? sp : 0;
      // kick when close
      p.kickT -= dt;
      const db = Math.hypot(p.u - bu, p.v - bv);
      if (db < 0.9 && p.kickT <= -0.4 && b.pos.y - W.heightAt(b.pos.x, b.pos.z) < 0.6) {
        const goalU = side * (this.hl + 2);
        const shoot = Math.abs(goalU - bu) < 30;
        if (p.role === 'keeper') this.kick(p, 0, (this.rnd() - 0.5) * this.hw, 0.9);
        else if (shoot) this.kick(p, goalU, (this.rnd() - 0.5) * 5, 0.7 + this.rnd() * 0.3);
        else { const mate = this.players.find((q) => q.team === p.team && q !== p && side * (q.u - p.u) > 4); if (mate) this.kick(p, mate.u, mate.v, 0.45); else this.kick(p, bu + side * 12, bv + (this.rnd() - 0.5) * 8, 0.4); }
      }
      const w = this.P(p.u, p.v);
      const target = p.speed > 0.1 ? Math.atan2(w.x - p.x, w.z - p.z) : Math.atan2(b.pos.x - w.x, b.pos.z - w.z);
      p.x = w.x; p.z = w.z; p.y = W.heightAt(p.x, p.z);
      p.yaw = angleDamp(p.yaw, target, 8, dt);
      p.anim = p.kickT > 0 ? AN.KICK : p.speed > 4.8 ? AN.RUN : p.speed > 0.1 ? AN.WALK : p.role === 'keeper' ? AN.KEEPER : AN.STAND;
      p.extra = p.kickT > 0 ? 1 - p.kickT / 0.35 : 0;
      p.phase += (p.speed * dt / 2.2) * Math.PI * 2;
    }
  }
  clampBall(u, v) { const p = this.P(clamp(u, -this.hl, this.hl) * 0.9, clamp(v, -this.hw, this.hw) * 0.9); return [p.x, this.g.world.heightAt(p.x, p.z) + 0.3, p.z]; }

  draw(crowd) { for (const p of this.players) if (!p.you) crowd.push(p); for (const s of this.spect) crowd.push(s); }
  dispose() { this.ball.dispose(this.g.scene); }
}

/** Join a football match: you play for team 0 (blue). */
export function footballActivity(game) {
  return {
    name: 'football', hud: 'Football: WASD run · Shift sprint · Space kick where you face (hold = power) · run into the ball to dribble', keepMoving: true,
    start() {
      const g = this.g;
      // kick-off: you take it from the centre spot, the others in their halves
      const me = game.players.filter((p) => p.team === 0 && p.role === 'field').sort((a, b) => b.fu - a.fu)[0];
      me.you = true;
      this.me = me;
      game.you = { team: 0 };
      game.score = [0, 0];
      for (const p of game.players) { p.u = p.fu * game.hl; p.v = p.fv * game.hw; if (Math.sign(p.u) === (p.team === 0 ? 1 : -1)) p.u *= 0.2; }   // everyone in their own half
      game.resetBall();
      const p = game.P(-1.2, 0);
      g.player.spawn(p.x, p.z, Math.atan2(game.f.ax, game.f.az));
      this.len = 240; this.charge = 0;
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe04a, transparent: true, opacity: 0.8, depthWrite: false }));
      g.scene.add(this.ring);
      g.audio.whistle?.();
      g.ui.floatText('Kick-off! Blue attacks this way', 'xp');
    },
    update(dt) {
      const g = this.g, P = g.player, b = game.ball;
      const [u, v] = game.UV(P.pos.x, P.pos.z);
      this.me.u = u; this.me.v = v;
      this.ring.position.set(b.pos.x, g.world.heightAt(b.pos.x, b.pos.z) + 0.06, b.pos.z);
      // dribble: the ball stays just ahead of your feet
      const dx = b.pos.x - P.pos.x, dz = b.pos.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d < 1.2 && b.pos.y - g.world.heightAt(b.pos.x, b.pos.z) < 0.5 && P.speed > 0.5 && !g.input.down('Space')) {
        const fx = Math.sin(P.heading), fz = Math.cos(P.heading);
        b.pos.x += (P.pos.x + fx * 0.75 - b.pos.x) * Math.min(1, dt * 10);
        b.pos.z += (P.pos.z + fz * 0.75 - b.pos.z) * Math.min(1, dt * 10);
        b.vel.set(P.vel.x, 0, P.vel.z); b.resting = false;
        game.lastTouch = 'you';
      }
      if (g.input.down('Space')) this.charge = Math.min(1, this.charge + dt * 1.4);
      else if (this.charge > 0) {
        if (d < 1.8) {
          // the ball goes where you are facing (works with or without the mouse)
          const fx = Math.sin(P.heading), fz = Math.cos(P.heading);
          const sp = 9 + this.charge * 18;
          b.vel.set(fx * sp, 1 + this.charge * 5, fz * sp);
          b.resting = false;
          game.lastTouch = 'you';
          g.audio.kick?.();
          P.kickT = 0.35;
        } else g.ui.floatText('Get closer to the ball', 'xp');
        this.charge = 0;
      }
      this.rT = (this.rT || 0) - dt;
      if (this.rT <= 0) {
        this.rT = 0.3;
        const left = Math.max(0, this.len - this.t);
        const far = d > 12 ? ` · ball ${Math.round(d)} m away (yellow ring)` : '';
        g.ui.actPanel({ title: 'Football · Blue vs Red', html: `<p class="big-num">${game.score[0]} : ${game.score[1]}</p><p>${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} left${this.charge > 0 ? ` · power ${Math.round(this.charge * 100)}%` : ''}${far}</p><p class="dim">You are in blue. Run into the ball to dribble it, face the goal and hold Space to shoot.</p>`, buttons: [{ label: '<kbd>Esc</kbd> Leave the match', key: 'Escape', onClick: () => (this.done = true) }] });
      }
      if (this.done) return false;
      if (this.t > this.len) {
        const [a, bb] = game.score;
        g.audio.whistle?.();
        g.progress.addXP(25 + a * 10, 'football');
        if (a > bb) g.progress.earn(60, 'match won');
        g.ui.toast(`Full time: Blue ${a} - ${bb} Red`, a > bb ? 'gold' : 'info', 'Football');
        return false;
      }
    },
    end() { this.me.you = false; game.you = null; if (this.ring) { this.g.scene.remove(this.ring); this.ring.geometry.dispose(); this.ring.material.dispose(); } },
  };
}

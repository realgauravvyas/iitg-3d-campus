// Cricket on the campus grounds: an ambient inter-hostel match (bowler, batsmen, keeper,
// fielders, umpires, spectators, scoreboard) and a batting mini-game for the player.
import * as THREE from 'three';
import { Ball } from './ball.js';
import { AN } from '../crowd/people.js';
import { kit, studentLook, adultLook, OPT, bit, C, pal, withProp } from '../crowd/looks.js';
import { mulberry32, clamp, canvasTexture, fitText } from '../util.js';

const FIELD_POS = [[-14.5, -2.2], [-9, -24], [2, -30], [15, -20], [15, 20], [2, 31], [-10, 27], [-30, 16], [-30, -20]];

export class CricketGame {
  constructor(g, field, { teams = ['Brahmaputra', 'Lohit'], big = false } = {}) {
    this.g = g; this.f = field; this.big = big;
    const W = g.world, r = mulberry32(field.i * 13 + 5);
    this.rnd = r;
    this.teams = teams;
    this.R = Math.max(26, Math.min(field.len, field.wid) / 2 - 4);   // boundary radius
    this.fwd = Math.atan2(field.ax, field.az);                       // yaw facing +u (towards the bowler's end)
    const colA = pal('#1f4fa0'), colB = pal('#b3262f');
    const mk = (L, u, v, yaw, anim, extra = 0) => { const p = W.fieldPoint(field, u, v); return { x: p.x, z: p.z, y: W.heightAt(p.x, p.z), yaw, anim, phase: r() * 6, speed: 0, extra, look: L, u, v, hu: u, hv: v }; };
    this.batA = mk(withProp(kit(r, C.white, { shorts: false }), OPT.BAT, OPT.CAP), -10.6, 0.35, this.fwd, AN.BAT);
    this.batB = mk(withProp(kit(r, C.white, { shorts: false }), OPT.BAT), 11.2, 1.1, this.fwd + Math.PI, AN.STAND);
    this.bowler = mk(kit(r, colB, { shorts: false }), 26, 0.4, this.fwd + Math.PI, AN.BOWL, -1);
    this.keeper = mk(kit(r, colB, { shorts: false }), -13.2, 0, this.fwd, AN.KEEPER, 1);
    this.fielders = FIELD_POS.map(([u, v]) => { const s = Math.min(1, (this.R - 4) / Math.hypot(u, v)); return mk(kit(r, colB, { shorts: false }), u * s, v * s, this.fwd + Math.PI, AN.FIELD, 1); });
    this.umps = [mk(adultLook(r, 'faculty'), 12.4, 0.2, this.fwd + Math.PI, AN.STAND), mk(adultLook(r, 'faculty'), -10, 24, this.fwd - Math.PI / 2, AN.STAND)];
    this.umps.forEach((u) => { u.look.col0[1] = C.white; u.look.opts |= bit(OPT.CAP); });
    this.crowd = [];
    const nSpec = big ? 190 : 34;
    for (let i = 0; i < nSpec; i++) {
      const a = r() * Math.PI * 2;
      if (!big && Math.cos(a) < -0.3) continue;
      const d = this.R + 3 + r() * (big ? 9 : 4);
      const u = Math.cos(a) * d, v = Math.sin(a) * d;
      const p = W.fieldPoint(field, u, v);
      if (W.buildingAt(p.x, p.z) || W.waterAt(p.x, p.z)) continue;
      const L = studentLook(r);
      if (big && r() < 0.3) { L.opts |= bit(OPT.FLAG); }
      const face = Math.atan2(field.cx - p.x, field.cz - p.z);
      this.crowd.push({ x: p.x, z: p.z, y: W.heightAt(p.x, p.z), yaw: face, anim: r() < 0.55 ? AN.SITG : AN.STAND, phase: r() * 6, speed: 0, extra: 0, look: L, propColor: r() < 0.5 ? colA : colB });
    }
    this.everyone = [this.batA, this.batB, this.bowler, this.keeper, ...this.fielders, ...this.umps];
    this.ball = new Ball(g.scene, 'cricket');
    this.ball.mesh.visible = false;
    this.state = 'runup'; this.st = 0;
    this.runs = Math.floor(r() * 90) + 20; this.wk = Math.floor(r() * 4); this.balls = Math.floor(r() * 60) + 30;
    this.board = this.makeBoard();
    this.player = null;    // set while the player bats
    this.chasers = [];
  }

  makeBoard() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 192;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4 }));
    const p = this.g.world.fieldPoint(this.f, 0, -(this.R + 7));
    m.position.set(p.x, this.g.world.heightAt(p.x, p.z) + 3.6, p.z);
    m.rotation.y = Math.atan2(this.f.cx - p.x, this.f.cz - p.z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x444444 }));
    post.position.set(p.x, this.g.world.heightAt(p.x, p.z) + 1.8, p.z);
    this.g.scene.add(m, post);
    this.boardObj = [m, post];
    return { c, g: fitText(c.getContext('2d')), tex };
  }
  drawBoard() {
    const { g, tex } = this.board;
    g.fillStyle = '#0b1a1c'; g.fillRect(0, 0, 512, 192);
    g.fillStyle = '#c89b3c'; g.font = 'bold 30px "Teko", "Hind", sans-serif'; g.textAlign = 'center';
    g.fillText(`${this.teams[0].toUpperCase()} vs ${this.teams[1].toUpperCase()}`, 256, 40);
    g.fillStyle = '#f3ead7'; g.font = 'bold 64px "Teko", "Hind", sans-serif';
    g.fillText(`${this.runs}/${this.wk}`, 256, 112);
    g.font = '28px "Hind", sans-serif';
    g.fillText(`Overs ${Math.floor(this.balls / 6)}.${this.balls % 6}   ${this.last || ''}`, 256, 160);
    tex.needsUpdate = true;
  }

  P(u, v) { return this.g.world.fieldPoint(this.f, u, v); }
  toUV(x, z) { const dx = x - this.f.cx, dz = z - this.f.cz; return [dx * this.f.ax + dz * this.f.az, -dx * this.f.az + dz * this.f.ax]; }

  /** release a delivery from the bowler's hand towards the striker */
  deliver() {
    const r = this.rnd;
    const speed = 24 + r() * 12;                   // 86 .. 130 km/h
    const length = 2.5 + r() * 5.5;                // metres in front of the batsman
    const line = (r() - 0.5) * 0.5;
    const R = this.P(9.9, 0.35), B = this.P(-10.4 + length, line);
    const y0 = this.g.world.heightAt(R.x, R.z) + 2.1;
    const dx = B.x - R.x, dz = B.z - R.z, D = Math.hypot(dx, dz);
    const t1 = D / speed;
    const yb = this.g.world.heightAt(B.x, B.z) + this.ball.r;
    const vy = (yb - y0 + 0.5 * 9.81 * t1 * t1) / t1;
    this.ball.set(R.x, y0, R.z, (dx / D) * speed, vy, (dz / D) * speed);
    this.ball.mesh.visible = true;
    this.ball.line = line;
    this.ball.crossed = false;
    this.speedKmh = Math.round(speed * 3.6);
  }

  /** AI or player outcome when the ball reaches the striker */
  strike(q, dir, loft) {
    const g = this.g, r = this.rnd, b = this.ball;
    if (q <= 0) {
      const onStumps = Math.abs(b.line) < 0.14 && b.pos.y - g.world.heightAt(b.pos.x, b.pos.z) < 0.8;
      if (onStumps && (this.player || r() < 0.3)) return this.out('Bowled!', true);
      return; // beaten, the keeper takes it
    }
    if (q < 0.3 && r() < (this.player ? 0.35 : 0.2)) { b.set(b.pos.x, b.pos.y, b.pos.z, 0, 0, 0); return this.out('Edged and caught behind!'); }
    const ang = this.fwd + Math.PI + dir * (0.4 + r() * 0.9) + (r() - 0.5) * 0.4;
    const sp = 12 + q * 24, vy = loft ? 7 + q * 10 : 1.5 + q * 2.5;
    b.vel.set(Math.sin(ang) * sp, vy, Math.cos(ang) * sp);
    b.hit = true; b.bounced = false; b.pos.y += 0.05;
    g.audio.batHit?.(0.5 + q * 0.5);
    this.state = 'play'; this.st = 0;
    // nearest fielders chase the ball
    const land = this.predictLanding();
    this.chasers = [...this.fielders].sort((a, b2) => Math.hypot(a.x - land.x, a.z - land.z) - Math.hypot(b2.x - land.x, b2.z - land.z)).slice(0, 2);
    this.catchChance = loft && q < 0.75 ? Math.max(0, 0.7 - Math.hypot(this.chasers[0].x - land.x, this.chasers[0].z - land.z) / 14) : 0;
  }
  predictLanding() {
    const b = this.ball, p = b.pos.clone(), v = b.vel.clone();
    for (let i = 0; i < 400; i++) { v.y -= 9.81 * 0.02; p.addScaledVector(v, 0.02); if (p.y <= this.g.world.heightAt(p.x, p.z) && v.y < 0) break; }
    return p;
  }
  out(msg, bowled = false) {
    this.wk++; this.last = 'WICKET';
    this.g.audio.cheer?.(this.big ? 1.2 : 0.6);
    this.comment(msg);
    if (this.player) this.player.wk++;
    this.state = 'reset'; this.st = bowled ? -0.5 : 0;
    this.ball.mesh.visible = false;
  }
  comment(t) { this.lastComment = t; if (this.player || this.near) this.g.ui.floatText(t, 'xp'); }
  addRuns(n, label) {
    this.runs += n; this.last = label || (n ? `${n} run${n > 1 ? 's' : ''}` : 'dot');
    if (this.player) { this.player.runs += n; if (n === 6) this.g.progress.unlock('six'); }
    if (n >= 4) { this.g.audio.cheer?.(this.big ? 1.3 : 0.7); this.crowd.forEach((c) => (c.cheerT = 3)); }
  }

  update(dt) {
    const g = this.g, W = g.world, b = this.ball, r = this.rnd;
    this.st += dt;
    const bowl = this.bowler;
    if (this.state === 'runup') {
      const k = Math.min(1, this.st / 2.3);
      const u = 26 - k * 15.4, p = this.P(u, 0.4);
      bowl.x = p.x; bowl.z = p.z; bowl.anim = AN.BOWL; bowl.extra = -1; bowl.phase += dt * 11;
      if (k >= 1) { this.state = 'deliver'; this.st = 0; }
    } else if (this.state === 'deliver') {
      bowl.extra = Math.min(1, this.st / 0.45);
      if (this.st > 0.26 && !b.mesh.visible) this.deliver();
      if (b.mesh.visible) this.flight(dt);
    } else if (this.state === 'play') {
      b.update(dt, W, { drag: 0.004 });
      if (!b.bounced && b.onGround) b.bounced = true;
      const [u, v] = this.toUV(b.pos.x, b.pos.z);
      const d = Math.hypot(u, v);
      if (d > this.R) { this.addRuns(b.bounced ? 4 : 6, b.bounced ? 'FOUR' : 'SIX'); this.comment(b.bounced ? 'FOUR! Races away to the rope.' : 'SIX! Out of the ground!'); this.state = 'reset'; this.st = 0; b.mesh.visible = false; }
      // fielders run to the ball; a catch if a fielder gets under a lofted shot
      for (const [i, c] of this.chasers.entries()) {
        const dx = b.pos.x - c.x, dz = b.pos.z - c.z, L = Math.hypot(dx, dz);
        const sp = 6.2 - i;
        if (L > 0.6) { c.x += (dx / L) * sp * dt; c.z += (dz / L) * sp * dt; c.yaw = Math.atan2(dx, dz); c.anim = AN.RUN; c.phase += dt * 9; c.y = W.heightAt(c.x, c.z); }
        if (i === 0 && L < 1.3 && !b.onGround && b.pos.y - W.heightAt(b.pos.x, b.pos.z) < 2.2 && this.catchChance > 0) {
          if (r() < this.catchChance * 1.4) { this.out('Caught in the deep!'); return; }
          this.catchChance = 0;
        }
        if (i === 0 && L < 1.0 && (b.onGround || b.pos.y - W.heightAt(b.pos.x, b.pos.z) < 0.5)) {
          const runs = this.st > 4.5 ? 2 : this.st > 1.8 ? 1 : 0;
          this.addRuns(runs); this.comment(runs ? `${runs} run${runs > 1 ? 's' : ''} taken.` : 'Straight to the fielder.');
          c.anim = AN.THROW; c.extra = 0;
          this.state = 'reset'; this.st = 0; b.mesh.visible = false;
          if (runs % 2) { const t = this.batA; this.batA = this.batB; this.batB = t; }
          return;
        }
      }
      if (this.st > 9) { this.addRuns(1); this.state = 'reset'; this.st = 0; b.mesh.visible = false; }
    } else if (this.state === 'reset') {
      if (this.st > 2.2) this.nextBall();
    }
    // batsmen running during play
    if (this.state === 'play' && this.st > 0.4) {
      const k = (this.st * 0.55) % 2, t = k < 1 ? k : 2 - k;
      const pa = this.P(-10.6 + t * 21.8, 0.35), pb = this.P(11.2 - t * 21.8, 1.1);
      if (!this.player) { this.batA.x = pa.x; this.batA.z = pa.z; this.batA.anim = AN.RUN; this.batA.phase += dt * 9; }
      this.batB.x = pb.x; this.batB.z = pb.z; this.batB.anim = AN.RUN; this.batB.phase += dt * 9;
    }
    for (const c of this.crowd) { if (c.cheerT > 0) { c.cheerT -= dt; c._anim ??= c.anim; c.anim = AN.CHEER; } else if (c._anim !== undefined) { c.anim = c._anim; } }
    this.drawT = (this.drawT || 0) - dt;
    if (this.drawT <= 0) { this.drawT = 1; this.drawBoard(); }
  }

  flight(dt) {
    const g = this.g, b = this.ball;
    b.update(dt, g.world, { drag: 0 });
    const [u] = this.toUV(b.pos.x, b.pos.z);
    const bat = this.player ? null : this.batA;
    if (!b.crossed && u < -9.9) {
      b.crossed = true;
      if (this.player) this.player.onArrive(this);
      else {
        const r = this.rnd();
        const q = r < 0.34 ? 0 : 0.2 + this.rnd() * 0.8;
        bat.extra = 0.5;
        const loft = this.rnd() < 0.25;
        if (q > 0) this.strike(q, this.rnd() < 0.5 ? -1 : 1, loft);
        else { if (this.rnd() < 0.08) { this.strike(0, 0, false); if (this.state === 'reset') return; } this.addRuns(0); this.state = 'reset'; this.st = 0; }
      }
    }
    if (this.state === 'deliver' && u < -14) { b.mesh.visible = false; this.state = 'reset'; this.st = 0; }
  }

  nextBall() {
    this.balls++;
    if (this.balls % 6 === 0) this.last = 'over';
    if (this.wk >= 10 || this.balls >= 120) { this.runs = Math.floor(this.rnd() * 20); this.wk = 0; this.balls = 0; this.teams.reverse(); }
    this.state = 'runup'; this.st = 0;
    this.ball.mesh.visible = false;
    for (const f of this.fielders) { const p = this.P(f.hu, f.hv); f.x = p.x; f.z = p.z; f.anim = AN.FIELD; f.yaw = this.fwd + Math.PI; f.y = this.g.world.heightAt(f.x, f.z); }
    const pa = this.P(-10.6, 0.35), pb = this.P(11.2, 1.1);
    if (!this.player) { this.batA.x = pa.x; this.batA.z = pa.z; this.batA.anim = AN.BAT; this.batA.extra = 0; this.batA.yaw = this.fwd; this.batA.look.opts |= bit(OPT.BAT); }
    this.batB.x = pb.x; this.batB.z = pb.z; this.batB.anim = AN.STAND; this.batB.look.opts |= bit(OPT.BAT);
    this.batA.y = this.g.world.heightAt(this.batA.x, this.batA.z); this.batB.y = this.g.world.heightAt(this.batB.x, this.batB.z);
  }

  draw(crowd) {
    for (const p of this.everyone) { if (this.player && p === this.batA) continue; crowd.push(p); }
    for (const p of this.crowd) crowd.push(p);
    if (this.batA.extra > 0 && !this.player) this.batA.extra = Math.min(1, this.batA.extra + 0.03);
  }

  dispose() { this.ball.dispose(this.g.scene); for (const o of this.boardObj) this.g.scene.remove(o); }
}

/** Batting mini-game: chase a target in 2 overs. */
export function battingActivity(game, sports) {
  return {
    name: 'cricket', hud: 'Batting: Space = swing, A/D = off/leg side, hold Shift = loft',
    cancelable: true,
    start() {
      const g = this.g;
      this.cg = game;
      this.target = 12 + Math.floor(Math.random() * 12);
      this.state = { runs: 0, wk: 0, balls: 0 };
      game.player = { runs: 0, wk: 0, onArrive: (cg) => this.arrive(cg) };
      this.swing = -1; this.swingT = 0;
      game.nextBall();
      const s = game.P(-10.6, 0.35);
      const P = g.player;
      P.pos.set(s.x, g.world.heightAt(s.x, s.z), s.z); P.heading = game.fwd; P.flying = false;
      this.bat = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.6, 0.04), new THREE.MeshStandardMaterial({ color: 0xe0c992, roughness: 0.6 }));
      this.bat.position.set(0, -0.62, 0.02);
      P.avatar.J.elbowR.add(this.bat);
      this.render();
      g.audio.speak?.(`You need ${this.target} runs from 12 balls. Good luck!`);
    },
    render() {
      const pl = game.player;
      const need = this.target - pl.runs, left = 12 - this.balls();
      this.g.ui.actPanel({ title: `Chase ${this.target} · ${game.teams[0]} vs ${game.teams[1]}`, html: `<p class="big-num">${pl.runs}/${pl.wk}</p><p>${need > 0 ? `Need <b>${need}</b> from <b>${left}</b> balls` : 'Target reached!'} · ${game.speedKmh ? game.speedKmh + ' km/h' : ''}</p><p class="dim">${game.lastComment || 'Watch the bowler run in…'}</p>`, buttons: [] });
    },
    balls() { return this.ballsFaced || 0; },
    arrive(cg) {
      const b = cg.ball;
      this.ballsFaced = (this.ballsFaced || 0) + 1;
      const i = this.g.input;
      const ph = this.swing >= 0 ? this.swingT / 0.45 : -1;
      let q = ph < 0 ? 0 : clamp(1 - Math.abs(ph - 0.5) / 0.22, 0, 1);
      const dir = i.down('KeyA', 'ArrowLeft') ? -1 : i.down('KeyD', 'ArrowRight') ? 1 : (ph < 0.5 ? 1 : -1) * 0.4;
      const loft = i.down('ShiftLeft', 'ShiftRight');
      if (q > 0) cg.strike(q, dir, loft);
      else {
        cg.strike(0, 0, false);
        if (cg.state !== 'reset') { cg.addRuns(0); cg.comment(ph < 0 ? 'Left alone. Dot ball.' : 'Swing and a miss!'); cg.state = 'reset'; cg.st = 0; }
      }
      void b;
    },
    update(dt) {
      const g = this.g, cg = game;
      if (g.input.hit('Space') && this.swing < 0) { this.swing = 0; this.swingT = 0; }
      if (this.swing >= 0) { this.swingT += dt; if (this.swingT > 0.9) { this.swing = -1; this.swingT = 0; } }
      g.player.avatar.animate({ type: 'bat', swing: this.swing >= 0 ? Math.min(1, this.swingT / 0.55) : 0 }, dt);
      g.player.avatar.root.position.copy(g.player.pos);
      g.player.avatar.root.rotation.set(0, cg.fwd, 0);
      this.rT = (this.rT || 0) - dt;
      if (this.rT <= 0) { this.rT = 0.25; this.render(); }
      const pl = cg.player;
      if (pl.runs >= this.target || pl.wk >= 2 || (this.ballsFaced >= 12 && cg.state === 'runup')) {
        const won = pl.runs >= this.target;
        g.progress.addXP(20 + pl.runs * 2, 'cricket');
        if (won) g.progress.earn(80, 'won the chase');
        g.ui.toast(won ? `You chased it down: ${pl.runs}/${pl.wk}!` : `Fell short: ${pl.runs}/${pl.wk} (target ${this.target}).`, won ? 'gold' : 'info', 'Cricket');
        return false;
      }
    },
    camera(cam, dt) {
      const cg = game, P = this.g.player;
      const back = cg.P(-17.5, 1.2);
      const want = new THREE.Vector3(back.x, P.pos.y + 2.4, back.z);
      cam.position.lerp(want, 1 - Math.exp(-5 * dt));
      const b = cg.ball.mesh.visible && cg.state === 'play' ? cg.ball.pos : null;
      if (b) cam.lookAt(b.x, Math.max(P.pos.y + 1, b.y), b.z);
      else { const t = cg.P(8, 0.2); cam.lookAt(t.x, P.pos.y + 1.2, t.z); }
      return true;
    },
    end() { const P = this.g.player; if (this.bat) P.avatar.J.elbowR.remove(this.bat); game.player = null; game.nextBall(); },
  };
}

/** A hostel's own cricket pitch: three students at the nets in the evening, a batter, a bowler who runs in and a fielder who watches. */
export class NetPractice {
  constructor(g, field) {
    this.g = g; this.f = field;
    const W = g.world, r = mulberry32(field.i * 29 + 3);
    this.fwd = Math.atan2(field.ax, field.az);
    const mk = (L, u, v, yaw, anim, extra = 0) => { const p = W.fieldPoint(field, u, v); return { x: p.x, z: p.z, y: W.heightAt(p.x, p.z), yaw, anim, phase: r() * 6, speed: 0, extra, look: L, u, v }; };
    this.bat = mk(withProp(kit(r, C.white, { shorts: false }), OPT.BAT, OPT.CAP), -9.6, 0.2, this.fwd, AN.BAT);
    this.bowl = mk(kit(r, pal('#b3262f'), { shorts: false }), 11, 0.3, this.fwd + Math.PI, AN.BOWL, -1);
    this.field = mk(kit(r, pal('#b3262f'), { shorts: false }), 6, 7.5, this.fwd + Math.PI, AN.FIELD, 1);
    this.t = r() * 6;
    this.near = false;
  }
  update(dt) {
    this.t += dt;
    const c = this.t % 6.5, W = this.g.world;
    // 0 - 2.6 s: the bowler runs in from the far end; 2.6 - 3.2 delivers; the batter swings at 3.0; then they walk back
    const place = (p, u) => { const q = W.fieldPoint(this.f, u, p.v); p.x = q.x; p.z = q.z; p.y = W.heightAt(q.x, q.z); };
    if (c < 2.6) { this.bowl.anim = AN.BOWL; this.bowl.extra = -1; this.bowl.phase += dt * 10; place(this.bowl, 17 - (c / 2.6) * 6); this.bat.extra = 0; }
    else if (c < 3.4) { this.bowl.anim = AN.BOWL; this.bowl.extra = (c - 2.6) / 0.8; place(this.bowl, 11); this.bat.extra = c > 3.0 ? Math.min(1, (c - 3.0) / 0.4) : 0; }
    else { this.bowl.anim = AN.STAND; this.bowl.extra = 0; place(this.bowl, 11 + Math.min(6, (c - 3.4) * 2)); this.bat.extra = Math.max(0, 1 - (c - 3.4) * 0.8); }
    this.bat.anim = AN.BAT;
  }
  draw(crowd) { crowd.push(this.bat, this.bowl, this.field); }
  setVisible() {}
  dispose() {}
}

// Everyday campus activities: sitting, meals, shopping, lectures, exams, study, labs,
// gym, club practice, TV, sleep, the doctor... Mostly shown in the activity panel while
// your character does the matching animation in the 3D scene.
import * as THREE from 'three';
import { lectureFor, examPaper, shuffleQ, COURSES, TRIVIA } from './content.js';
import { fmtHour } from '../life/clock.js';
import { rupees, CREDIT_LIMIT } from '../progress.js';

// ---------------------------------------------------------------- helpers
/** Seat the player (avatar pose) at an interior seat; returns world position. */
export function seatPlayer(g, seat, interior, pose = 'sit') {
  const O = interior ? interior.O : new THREE.Vector3();
  const P = g.player;
  P.pos.set(O.x + seat.x, O.y + (seat.y || 0), O.z + seat.z);
  P.heading = seat.yaw;
  P.vel.set(0, 0, 0);
  P.avatar.root.position.copy(P.pos);
  P.avatar.root.rotation.set(0, seat.yaw, 0);
  P.pose = pose;
}
/** Over-the-shoulder camera looking where the seated player looks. */
export function seatCam(g, cam, dt, { back = 1.6, up = 1.25, side = 0.55, look = 3 } = {}) {
  const P = g.player, h = P.heading;
  const fx = Math.sin(h), fz = Math.cos(h), rx = fz, rz = -fx;
  const want = new THREE.Vector3(P.pos.x - fx * back + rx * side, P.pos.y + up, P.pos.z - fz * back + rz * side);
  cam.position.lerp(want, 1 - Math.exp(-6 * dt));
  cam.lookAt(P.pos.x + fx * look, P.pos.y + 0.95, P.pos.z + fz * look);
  return true;
}
function panel(g, title, html, buttons = []) { g.ui.actPanel({ title, html, buttons }); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Multiple-choice runner used by lectures, exams, study and orientation. */
class Quiz {
  constructor(g, qs, { title, time = 0, onDone }) { Object.assign(this, { g, qs, title, time, onDone }); this.i = 0; this.score = 0; this.left = time; this.show(); }
  show() {
    const q = this.qs[this.i];
    if (!q) { this.finish(); return; }
    this.locked = false;
    const opts = q.opts.map((o, k) => ({ label: `<kbd>${k + 1}</kbd> ${esc(o)}`, key: `Digit${k + 1}`, onClick: () => this.answer(k) }));
    panel(this.g, this.title, `<p class="q-count">Question ${this.i + 1} of ${this.qs.length}${this.time ? ` · <span id="q-time">${Math.ceil(this.left)} s</span>` : ''}${q.course ? ` · ${q.course}` : ''}</p><p class="q-text">${esc(q.text)}</p>`, opts);
  }
  answer(k) {
    if (this.locked) return;
    this.locked = true;
    const q = this.qs[this.i];
    const ok = k === q.ans;
    if (ok) this.score++;
    this.g.audio[ok ? 'collect' : 'bump']();
    this.g.ui.flashAnswer(k, q.ans);
    setTimeout(() => { this.i++; this.show(); }, 650);
  }
  update(dt) {
    if (!this.time || this.finished) return;
    this.left -= dt;
    const el = document.getElementById('q-time');
    if (el) el.textContent = `${Math.max(0, Math.ceil(this.left))} s`;
    if (this.left <= 0) { this.i = this.qs.length; this.finish(); }
  }
  finish() { if (this.finished) return; this.finished = true; this.onDone(this.score, this.qs.length); }
}

// ---------------------------------------------------------------- activities
export const ACTS = {
  /** sit on any seat; move or press E to get up */
  sit: (p) => ({
    name: 'sit', hud: p.ground ? 'Sitting with friends · move or press E to get up' : 'Sitting · move or press E to stand up',
    start() { seatPlayer(this.g, p.seat, p.interior); },
    update() { const i = this.g.input; if (this.t > 0.4 && (i.hit('KeyE') || Math.hypot(i.axis().x, i.axis().y) > 0.3)) return false; this.g.player.avatar.animate({ type: p.ground ? 'sitg' : 'sit' }, 1 / 60); if (this.t > 20 && !this.rested) { this.rested = true; this.g.progress.eat?.(3, 'a little rest'); } },
    end() { if (p.spot && p.spot.taken === 'player') p.spot.taken = null; },
    camera(cam, dt) { return seatCam(this.g, cam, dt, { back: 2.2, up: 1.5 }); },
  }),

  /** crouch and hand out biscuits */
  feed: (p) => ({
    name: 'feed', hud: 'Feeding · wait a moment', cancelable: true,
    start() { const P = this.g.player; P.heading = Math.atan2(p.animal.x - P.pos.x, p.animal.z - P.pos.z); P.avatar.root.rotation.set(0, P.heading, 0); },
    update(dt) { this.g.player.avatar.animate({ type: 'feed' }, dt); if (this.t > 4) return false; },
  }),

  /** buy from a stall / shop / outlet menu */
  shop: (p) => ({
    name: 'shop', hud: p.name, cancelable: true,
    start() { this.render(); },
    render() {
      const g = this.g;
      if (p.menu.length === 0 && p.name === 'ATM') {
        const P = g.progress, due = P.pocketMoneyDue(g.clock);
        const btn = [];
        if (due) btn.push({ label: `<kbd>1</kbd> Pocket money from home has arrived: ${rupees(3000)}`, key: 'Digit1', onClick: () => { P.collectPocket(g.clock); this.render(); } });
        const owed = CREDIT_LIMIT - P.bank;
        if (owed > 0 && P.coins > 0) btn.push({ label: `<kbd>7</kbd> Pay the credit card bill: ${rupees(Math.min(owed, P.coins))}`, key: 'Digit7', onClick: () => { P.payCard(); g.audio.coins?.(); this.render(); } });
        for (const [k, amt] of [[2, 500], [3, 2000], [4, 5000]]) if (P.bank >= amt) btn.push({ label: `<kbd>${k}</kbd> Withdraw ${rupees(amt)} cash on the credit card`, key: `Digit${k}`, onClick: () => { P.withdraw(amt); g.audio.coins?.(); this.render(); } });
        if (P.debt > 0) btn.push({ label: `<kbd>5</kbd> Pay back ${P.lender} ${rupees(P.debt)}`, key: 'Digit5', onClick: () => { if (!P.repay()) g.ui.toast('Not enough money to pay it all back yet.', 'warn'); this.render(); } });
        btn.push({ label: `<kbd>6</kbd> Pay with: <b>${P.payPref === 'card' ? 'credit card' : 'cash'}</b> (switch)`, key: 'Digit6', onClick: () => { P.payPref = P.payPref === 'card' ? 'cash' : 'card'; P.save(); this.render(); } });
        btn.push({ label: '<kbd>Esc</kbd> Done', key: 'Escape', onClick: () => (this.done = true) });
        panel(g, 'ATM', `<p>Cash in wallet: <b>${rupees(P.coins)}</b><br>Credit card: <b>${rupees(P.bank)}</b> of your ${rupees(CREDIT_LIMIT)} limit left${P.debt ? `<br>You owe ${esc(P.lender)}: <b>${rupees(P.debt)}</b>` : ''}</p><p class="dim">${due ? 'Your weekly pocket money from home is in your account.' : 'Pocket money from home arrives in your bank account every week. Earn more with campus jobs: pizza delivery (Market Complex) or ambulance duty (IITG Hospital).'}</p>`, btn);
        return;
      }
      const items = p.menu.map(([n, price, energy, tag], k) => ({ label: `<kbd>${k + 1}</kbd> ${esc(n)} <span class="price">${rupees(price)}</span>`, key: `Digit${k + 1}`, onClick: () => this.buy(n, price, energy, tag) }));
      items.push({ label: '<kbd>Esc</kbd> Done', key: 'Escape', onClick: () => (this.done = true) });
      items.push({ label: `<kbd>C</kbd> Pay with: <b>${g.progress.payPref === 'card' ? 'credit card' : 'cash'}</b> (switch)`, key: 'KeyC', onClick: () => { const P = g.progress; P.payPref = P.payPref === 'card' ? 'cash' : 'card'; P.save(); this.render(); } });
      panel(g, p.name, `<p class="dim">Cash ${rupees(g.progress.coins)} · credit limit ${rupees(g.progress.bank)} · energy ${Math.round(g.progress.energy)}%</p>`, items);
    },
    buy(n, price, energy, tag) {
      const g = this.g;
      if (!g.progress.spend(price, n, () => this.buy(n, price, energy, tag))) { g.audio.bump(); return; }
      g.audio.coins?.();
      if (energy) g.progress.eat(energy, n);
      if (tag === 'umbrella') { g.progress.inv.add('umbrella'); g.ui.toast('Umbrella bought: it opens by itself when it rains.', 'gold'); }
      if (tag === 'focus') { g.progress.inv.add('focus'); g.ui.toast('Caffeine focus: +20 s in your next study session or exam.', 'info'); }
      if (tag === 'notes') { g.progress.inv.add('notes'); g.ui.toast('Printed notes: the next exam will be a little easier.', 'info'); }
      if (tag === 'haircut') { this.done = true; setTimeout(() => { g.ui.toast('Pick a new style in the character creator.', 'info', 'Hair salon'); g.setMode('custom'); }, 50); return; }
      if (n.includes('Momos') || n.includes('momos')) g.progress.count('momos');
      g.progress.count('purchases');
      if (p.kind === 'shop' || p.kind === 'pizzeria' || p.kind === 'cart') g.progress.unlock('shopper');
      g.progress.addXP(3);
      this.render();
    },
    update() { if (this.done) return false; this.g.player.avatar.animate({ type: 'idle' }, 1 / 60); },
  }),

  tv: (p) => ({
    name: 'tv', hud: 'Watching cricket highlights · Esc to get up',
    start() { seatPlayer(this.g, p.seat, p.interior); },
    update(dt) { this.g.player.avatar.animate({ type: 'sit' }, dt); if (this.t > 25) { this.g.progress.eat(4, 'relaxing'); return false; } },
    camera(cam, dt) { return seatCam(this.g, cam, dt, { back: 1.8, up: 1.4, side: 0.3, look: 5 }); },
  }),

  sleep: () => ({
    name: 'sleep', hud: 'Rest',
    start() {
      const g = this.g;
      panel(g, 'Rest in your room', `<p>It is ${fmtHour(g.clock.hour)}. How long do you want to rest?</p>`, [
        { label: '<kbd>1</kbd> Power nap (1 hour)', key: 'Digit1', onClick: () => this.rest(1) },
        { label: '<kbd>2</kbd> Sleep until 7:00 AM', key: 'Digit2', onClick: () => this.rest('morning') },
        { label: '<kbd>Esc</kbd> Not now', key: 'Escape', onClick: () => (this.done = true) },
      ]);
    },
    async rest(h) {
      const g = this.g;
      await g.ui.fade(1);
      const hours = h === 'morning' ? ((7 - g.clock.hour + 24) % 24 || 24) : h;
      g.clock.advance(hours);
      g.progress.energy = h === 'morning' ? 100 : Math.min(100, g.progress.energy + 30);
      g.progress.unlock('sleep');
      g.ui.toast(`You wake up at ${fmtHour(g.clock.hour)}, ${g.clock.dayName}.`, 'info', 'Good morning' + (h === 'morning' ? '' : '!'));
      this.done = true;
      await g.ui.fade(0);
    },
    update() { if (this.done) return false; },
  }),

  rest: (p) => ({
    name: 'rest', hud: 'Visiting a campus family · Esc to leave',
    start() {
      seatPlayer(this.g, p.seat, p.interior);
      const lines = ['“Have some tea, beta. How are your classes going?”', '“Come for Bihu, we make pitha every year.”', '“Our son also studied here. Work hard, but go to the lake in the evening!”'];
      panel(this.g, 'Tea with a campus family', `<p>${lines[Math.floor(Math.random() * lines.length)]}</p>`, [{ label: '<kbd>Esc</kbd> Thank them and leave', key: 'Escape', onClick: () => (this.done = true) }]);
      this.g.progress.eat(12, 'tea and biscuits');
    },
    update(dt) { this.g.player.avatar.animate({ type: 'sit' }, dt); if (this.done) return false; },
    camera(cam, dt) { return seatCam(this.g, cam, dt, { back: 2, up: 1.4 }); },
  }),

  checkup: () => ({
    name: 'checkup', hud: 'IITG Hospital',
    start() {
      const g = this.g;
      const e = Math.round(g.progress.energy);
      const msg = e < 30 ? 'You look exhausted. Eat properly at the mess and sleep on time!' : e < 70 ? 'All fine. Drink water — it is humid in Guwahati.' : 'Fit as a fiddle. Keep cycling!';
      panel(g, 'Doctor\'s check-up', `<p>“${msg}”</p><p class="dim">Consultation is free for students. Energy restored to at least 70%.</p>`, [{ label: '<kbd>Esc</kbd> Thank you, doctor', key: 'Escape', onClick: () => (this.done = true) }]);
      g.progress.energy = Math.max(70, g.progress.energy);
      g.progress.addXP(5);
    },
    update() { if (this.done) return false; },
  }),

  enquiry: () => ({
    name: 'enquiry', hud: 'Enquiry',
    start() {
      const g = this.g;
      panel(g, 'Enquiry desk', `<p>“Scholarship forms are in room 104. For pocket money, the ATM is at the Market Complex. Want to earn some money? the Pizza Corner at the Market Complex needs delivery riders, and the hospital needs ambulance volunteers.”</p>`, [{ label: '<kbd>Esc</kbd> OK', key: 'Escape', onClick: () => (this.done = true) }]);
    },
    update() { if (this.done) return false; },
  }),

  lecture: (p) => {
    let quiz = null;
    return {
      name: 'lecture', hud: 'Lecture · Space to skip ahead',
      start() {
        const g = this.g;
        seatPlayer(g, p.seat, p.interior);
        this.L = lectureFor(g.clock.weekday, g.clock.hour, p.interior.site?.lm);
        this.lines = this.L.slide;
        panel(g, this.L.title, '<ul class="slide" id="slide"></ul>');
        g.audio.speak?.(`Good ${g.clock.hour < 12 ? 'morning' : 'afternoon'} everyone. Today, ${this.L.title.split(': ')[1]}.`);
      },
      update(dt) {
        const g = this.g;
        g.player.avatar.animate({ type: quiz ? 'study' : 'sit' }, dt);
        if (quiz) { quiz.update(dt); return quiz.finished ? false : undefined; }
        const shown = Math.min(this.lines.length, Math.floor(this.t / 3.5) + 1);
        const ul = document.getElementById('slide');
        if (ul && ul.children.length < shown) ul.insertAdjacentHTML('beforeend', `<li>${esc(this.lines[ul.children.length])}</li>`);
        if (g.input.hit('Space')) this.t += 3.5;
        if (this.t > this.lines.length * 3.5 + 2) {
          const qs = this.L.qs.map((q) => shuffleQ(q)).sort(() => Math.random() - 0.5).slice(0, 3);
          quiz = new Quiz(g, qs, { title: `${this.L.code} · in-class quiz`, onDone: (s, n) => {
            g.progress.grade(this.L.code, (s / n) * 100);
            g.progress.addXP(20 + s * 10, 'lecture');
            g.progress.count('lectures');
            g.ui.toast(`Quiz: ${s}/${n}. CPI ${g.progress.cpi ?? '-'}`, s === n ? 'gold' : 'info', 'Lecture over');
          } });
        }
      },
      camera(cam, dt) { return seatCam(this.g, cam, dt, { back: 1.4, up: 1.3, side: 0.4, look: 8 }); },
    };
  },

  exam: (p) => {
    let quiz = null;
    return {
      name: 'exam', hud: 'End-semester examination',
      start() {
        const g = this.g;
        seatPlayer(g, p.seat, p.interior);
        const bonus = g.progress.inv.has('focus') ? 20 : 0;
        g.progress.inv.delete('focus');
        const notes = g.progress.inv.has('notes');
        g.progress.inv.delete('notes');
        let qs = examPaper(8);
        if (notes) qs = qs.map((q) => ({ ...q, opts: q.opts.filter((o, i) => i === q.ans || i !== (q.ans + 1) % q.opts.length), ans: q.opts.filter((o, i) => i === q.ans || i !== (q.ans + 1) % q.opts.length).indexOf(q.opts[q.ans]) }));
        quiz = new Quiz(g, qs, { title: 'End-sem · all courses', time: 100 + bonus, onDone: (s, n) => {
          const pct = (s / n) * 100;
          g.progress.grade('End-sem', pct);
          g.progress.addXP(30 + s * 15, 'exam');
          g.progress.unlock('exam');
          if (pct >= 90) g.progress.unlock('topper');
          const gr = pct >= 90 ? 'AA' : pct >= 80 ? 'AB' : pct >= 70 ? 'BB' : pct >= 60 ? 'BC' : pct >= 50 ? 'CC' : pct >= 40 ? 'CD' : 'FF';
          g.ui.toast(`You scored ${s}/${n} — grade ${gr}. CPI now ${g.progress.cpi}.`, pct >= 60 ? 'gold' : 'warn', 'Results');
          if (pct >= 80) g.progress.earn(100, 'merit scholarship');
        } });
      },
      update(dt) { this.g.player.avatar.animate({ type: 'study' }, dt); quiz.update(dt); if (quiz.finished) return false; },
      camera(cam, dt) { return seatCam(this.g, cam, dt, { back: 1.2, up: 1.1, side: 0.5, look: 1.5 }); },
    };
  },

  study: (p) => {
    let quiz = null;
    return {
      name: 'study', hud: p.place === 'library' ? 'Studying in the Central Library' : 'Studying',
      start() {
        const g = this.g;
        if (p.plan) {
          const free = p.plan.seats.filter((s) => !s.npc).sort((a, b) => Math.hypot(a.x - 4, a.z + 3) - Math.hypot(b.x - 4, b.z + 3))[0];
          if (free) seatPlayer(g, free, p.interior);
        }
        const bonus = g.progress.inv.has('focus') ? 20 : 0;
        g.progress.inv.delete('focus');
        const c = COURSES[Math.floor(Math.random() * COURSES.length)];
        const qs = [...c.qs.map((q) => shuffleQ(q)), shuffleQ(TRIVIA[Math.floor(Math.random() * TRIVIA.length)])].sort(() => Math.random() - 0.5).slice(0, 5);
        quiz = new Quiz(g, qs, { title: `Revising ${c.code} ${c.title}`, time: 60 + bonus, onDone: (s, n) => {
          g.progress.addXP(15 + s * 8, 'study');
          g.progress.grade(`${c.code} practice`, (s / n) * 100);
          if (p.place === 'library') g.progress.count('study');
          g.progress.tire(6);
          g.ui.toast(`${s}/${n} correct. Keep going!`, 'info', 'Study session');
        } });
      },
      update(dt) { this.g.player.avatar.animate({ type: 'study' }, dt); quiz.update(dt); if (quiz.finished) return false; },
      camera(cam, dt) { return seatCam(this.g, cam, dt, { back: 1.2, up: 1.2, side: 0.5, look: 1.4 }); },
    };
  },

  movie: (p) => ({
    name: 'movie', hud: 'Film Club screening · Space to skip to the end',
    start() {
      const g = this.g, I = p.interior;
      seatPlayer(g, p.seat, I);
      this.mesh = I.plan.panelMeshes.screen;
      // the real film is playing on the screen (YouTube): just sit back and watch it
      this.live = !!g.screens?.cur?.playing;
      if (this.live) { this.len = 90; g.screens.unmute(); g.ui.actBar(`Watching "${g.screens.cur.video.title}" · Esc to get up`, true); return; }
      this.cam = new THREE.PerspectiveCamera(48, 768 / 320, 1, 9000);
      if (this.mesh) { this.mesh.material.map = I.screenRT.texture; this.mesh.material.emissiveMap = I.screenRT.texture; this.mesh.material.needsUpdate = true; }
      this.len = 48;
      g.audio.speak?.('Welcome to the Film Club screening. Please switch off your phones.');
    },
    update(dt) {
      const g = this.g, I = p.interior;
      g.player.avatar.animate({ type: 'sit' }, dt);
      if (g.input.hit('Space')) this.t = this.len;
      if (this.live) { if (this.t >= this.len && !this.rewarded) { this.rewarded = true; g.progress.unlock('movie'); g.progress.addXP(25, 'film'); } return; }
      // offline: a slow aerial journey over the campus, rendered live onto the screen
      const c = g.center, a = 0.4 + this.t * 0.045, R = 520 - this.t * 4;
      this.cam.position.set(c.x + Math.cos(a) * R, 140 + Math.sin(this.t * 0.2) * 40, c.z + Math.sin(a) * R);
      this.cam.lookAt(c.x + Math.cos(a + 1.3) * 90, 20, c.z + Math.sin(a + 1.3) * 90);
      if (Math.floor(this.t * 30) % 2 === 0) {
        const r = g.renderer, st = g.sky.state;
        st.inside = false; g.sky.refresh();
        const prev = r.getRenderTarget();
        r.setRenderTarget(I.screenRT); r.render(g.scene, this.cam); r.setRenderTarget(prev);
        st.inside = true; g.sky.refresh();
      }
      if (this.t >= this.len) {
        g.progress.unlock('movie'); g.progress.addXP(25, 'film night'); g.progress.eat(6, 'popcorn');
        return false;
      }
    },
    camera(cam, dt) { return seatCam(this.g, cam, dt, { back: 1.2, up: 1.4, side: 0.3, look: 12 }); },
    end() { const I = p.interior; if (this.mesh && I.active && !this.live) { this.mesh.material.map = I.idleScreen; this.mesh.material.emissiveMap = I.idleScreen; this.mesh.material.needsUpdate = true; } },
  }),

  gym: () => ({
    name: 'gym', hud: 'Reps challenge: alternate A and D (or ← →) as fast as you can',
    start() { this.reps = 0; this.next = 'A'; this.len = 15; this.g.player.pose = 'lift'; panel(this.g, 'Gym · reps challenge', '<p class="big-num" id="reps">0</p><div class="bar big"><i id="act-bar"></i></div>'); },
    update(dt) {
      const g = this.g, i = g.input;
      g.player.avatar.animate({ type: 'lift', speed: this.reps }, dt);
      const a = i.hit('KeyA', 'ArrowLeft'), d = i.hit('KeyD', 'ArrowRight');
      if ((this.next === 'A' && a) || (this.next === 'D' && d)) { this.reps += 0.5; this.next = this.next === 'A' ? 'D' : 'A'; if (this.reps % 1 === 0) g.audio.tone(300 + this.reps * 10, 0.05, { type: 'square', gain: 0.04 }); }
      const el = document.getElementById('reps'); if (el) el.textContent = Math.floor(this.reps);
      const b = document.getElementById('act-bar'); if (b) b.style.width = `${(this.t / this.len) * 100}%`;
      if (this.t > this.len) {
        const r = Math.floor(this.reps);
        g.progress.tire(12); g.progress.addXP(10 + r, 'workout');
        if (r >= 20) g.progress.unlock('gym');
        g.ui.toast(`${r} reps! ${r >= 20 ? 'Beast mode.' : 'Come back tomorrow.'}`, r >= 20 ? 'gold' : 'info', 'Workout done');
        return false;
      }
    },
    camera(cam, dt) { return seatCam(this.g, cam, dt, { back: -2.6, up: 1.5, side: 0.2, look: -3 }); },
  }),

  tt: () => ({
    name: 'tt', hud: 'Table tennis: press Space when the ball reaches your bat',
    start() { this.me = 0; this.op = 0; this.x = 0; this.dir = 1; this.sp = 1.1; panel(this.g, 'Table tennis · first to 5', '<canvas id="tt" width="420" height="120" class="mini"></canvas><p class="big-num" id="tt-score">0 : 0</p>'); },
    update(dt) {
      const g = this.g;
      g.player.avatar.animate({ type: 'idle' }, dt);
      this.x += this.dir * this.sp * dt;
      if (this.dir > 0 && g.input.hit('Space')) {
        if (this.x > 0.78 && this.x < 1.05) { this.dir = -1; this.sp *= 1.06; g.audio.tone(900, 0.04, { type: 'square', gain: 0.06 }); }
      }
      if (this.dir < 0 && this.x < 0) { this.dir = 1; g.audio.tone(700, 0.04, { type: 'square', gain: 0.05 }); if (Math.random() < 0.12 + this.sp * 0.05) { this.me++; this.reset(); } }
      if (this.x > 1.1) { this.op++; this.reset(); }
      const c = document.getElementById('tt');
      if (c) {
        const x = c.getContext('2d');
        x.fillStyle = '#1f5a3d'; x.fillRect(0, 0, 420, 120); x.fillStyle = '#fff'; x.fillRect(209, 10, 2, 100);
        x.fillStyle = '#c62828'; x.fillRect(395, 40, 10, 40); x.fillStyle = '#1f4fa0'; x.fillRect(15, 40, 10, 40);
        x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(0.78 * 400 + 10, 0, (1.05 - 0.78) * 400, 120);
        x.fillStyle = '#ffb000'; x.beginPath(); x.arc(20 + this.x * 380, 60 - Math.abs(Math.sin(this.x * 6)) * 30, 6, 0, 7); x.fill();
      }
      const s = document.getElementById('tt-score'); if (s) s.textContent = `${this.me} : ${this.op}`;
      if (this.me >= 5 || this.op >= 5) { g.progress.addXP(this.me >= 5 ? 25 : 8, 'table tennis'); g.ui.toast(this.me >= 5 ? 'You won the rally!' : 'Lost this time.', this.me >= 5 ? 'gold' : 'info', `Table tennis ${this.me}:${this.op}`); return false; }
    },
    reset() { this.x = 0; this.dir = 1; this.sp = 1.1; },
  }),

  typing: () => {
    const SNIPS = ['def mean(xs): return sum(xs) / len(xs)', 'for i in range(n): total += a[i] * b[i]', 'model.fit(X_train, y_train, epochs=10)', 'import numpy as np; w = np.zeros(d)', 'if left < right: mid = (left + right) // 2'];
    return {
      name: 'typing', hud: 'Coding practice: type the line exactly · Esc to stop',
      start() { this.snip = SNIPS[Math.floor(Math.random() * SNIPS.length)]; this.typed = ''; this.errors = 0; this.g.input.typing = true; this.render(); this.onKey = (e) => this.key(e); window.addEventListener('keydown', this.onKey); },
      key(e) {
        if (e.key === 'Escape') return;
        if (e.key.length !== 1) return;
        e.preventDefault();
        const want = this.snip[this.typed.length];
        if (e.key === want) this.typed += e.key; else { this.errors++; this.g.audio.tone(180, 0.05, { type: 'square', gain: 0.04 }); }
        this.render();
      },
      render() { panel(this.g, 'Computer lab · coding practice', `<pre class="code"><span class="ok">${esc(this.typed)}</span><span class="cur">${esc(this.snip[this.typed.length] || '')}</span>${esc(this.snip.slice(this.typed.length + 1))}</pre><p class="dim">Errors: ${this.errors}</p>`); },
      update(dt) {
        this.g.player.avatar.animate({ type: 'type' }, dt);
        if (this.typed.length >= this.snip.length) {
          const wpm = Math.round((this.snip.length / 5) / (this.t / 60));
          const acc = Math.round((this.snip.length / (this.snip.length + this.errors)) * 100);
          this.g.progress.addXP(10 + Math.round(wpm / 3), 'coding');
          this.g.ui.toast(`${wpm} WPM, ${acc}% accuracy`, acc > 90 ? 'gold' : 'info', 'Snippet done');
          return false;
        }
      },
      end() { window.removeEventListener('keydown', this.onKey); this.g.input.typing = false; },
    };
  },

  titration: () => ({
    name: 'titration', hud: 'Titration: hold Space to add NaOH, press Enter at the first permanent pink',
    start() { this.v = 0; this.end = 18 + Math.random() * 6; this.len = 0; this.g.player.pose = 'lab'; this.draw(); },
    draw() {
      const pinkK = Math.max(0, Math.min(1, (this.v - this.end + 0.3) / 0.8));
      const col = `rgb(${240 - pinkK * 20},${240 - pinkK * 150},${245 - pinkK * 60})`;
      panel(this.g, 'Acid–base titration (HCl vs 0.1 M NaOH)', `<div class="lab"><div class="burette"><i style="height:${100 - (this.v / 50) * 100}%"></i></div><div class="flask" style="background:${col}"></div></div>
        <p>Volume added: <b>${this.v.toFixed(2)} mL</b> · 20.0 mL HCl in the flask, phenolphthalein indicator</p>`,
        [{ label: '<kbd>Enter</kbd> Record end point', key: 'Enter', onClick: () => this.record() }]);
    },
    record() {
      const g = this.g;
      const err = Math.abs(this.v - this.end);
      const m = (0.1 * this.v) / 20;
      const score = Math.max(0, 100 - err * 60);
      g.progress.grade('CH 101 lab', score);
      g.progress.addXP(15 + Math.round(score / 5), 'lab');
      g.progress.unlock('lab');
      g.ui.toast(`End point ${this.v.toFixed(2)} mL (true ${this.end.toFixed(2)}). Molarity of HCl = ${m.toFixed(3)} M. Lab score ${Math.round(score)}%.`, score > 70 ? 'gold' : 'info', 'Experiment recorded');
      this.done = true;
    },
    update(dt) {
      const g = this.g;
      g.player.avatar.animate({ type: 'lab' }, dt);
      if (g.input.down('Space')) { this.v += dt * (this.v > this.end - 2 ? 0.35 : 2.2); if (Math.random() < 0.3) g.audio.tone(1300, 0.02, { gain: 0.02 }); }
      this.len -= dt;
      if (this.len <= 0) { this.len = 0.08; this.draw(); }
      if (this.done) return false;
      if (this.v > 50) { g.ui.toast('Overshot the burette! Try again.', 'warn'); return false; }
    },
    camera(cam, dt) { return seatCam(this.g, cam, dt, { back: 1.4, up: 1.6, side: 0.5, look: 1 }); },
  }),

  pendulum: () => ({
    name: 'pendulum', hud: 'Pendulum: press Space each time the bob passes the centre (10 swings)',
    start() { this.L = 1.0; this.T = 2 * Math.PI * Math.sqrt(this.L / 9.81); this.marks = []; this.g.player.pose = 'lab'; panel(this.g, 'Simple pendulum · measure g (L = 1.00 m)', '<canvas id="pend" width="240" height="200" class="mini"></canvas><p id="pend-info">Swings timed: 0 / 10</p>'); },
    update(dt) {
      const g = this.g;
      g.player.avatar.animate({ type: 'lab' }, dt);
      const th = 0.35 * Math.cos((2 * Math.PI * this.t) / this.T);
      const c = document.getElementById('pend');
      if (c) { const x = c.getContext('2d'); x.clearRect(0, 0, 240, 200); x.strokeStyle = '#ddd'; x.beginPath(); x.moveTo(120, 10); const bx = 120 + Math.sin(th) * 160, by = 10 + Math.cos(th) * 160; x.lineTo(bx, by); x.stroke(); x.fillStyle = '#c89b3c'; x.beginPath(); x.arc(bx, by, 12, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.3)'; x.beginPath(); x.moveTo(120, 170); x.lineTo(120, 195); x.stroke(); }
      if (g.input.hit('Space')) { this.marks.push(this.t); g.audio.tone(800, 0.04, { gain: 0.05 }); }
      const n = Math.max(0, this.marks.length - 1);
      const info = document.getElementById('pend-info'); if (info) info.textContent = `Half-swings timed: ${n} / 20`;
      if (n >= 20) {
        const Tm = ((this.marks[this.marks.length - 1] - this.marks[0]) / n) * 2;
        const gm = (4 * Math.PI * Math.PI * this.L) / (Tm * Tm);
        const err = Math.abs(gm - 9.81) / 9.81 * 100;
        const score = Math.max(0, 100 - err * 5);
        g.progress.grade('PH 101 lab', score);
        g.progress.addXP(15 + Math.round(score / 5), 'lab');
        g.progress.unlock('lab');
        g.ui.toast(`Measured T = ${Tm.toFixed(3)} s, g = ${gm.toFixed(2)} m/s² (${err.toFixed(1)}% error).`, err < 5 ? 'gold' : 'info', 'Experiment done');
        return false;
      }
    },
    camera(cam, dt) { return seatCam(this.g, cam, dt, { back: 1.6, up: 1.6, side: 0.5, look: 1 }); },
  }),
};
export { Quiz };

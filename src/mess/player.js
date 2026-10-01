// Your side of the mess: pay at the counter (or show the mess card), take a steel plate, hand in the
// coupon at the serving counter and watch the plate fill, carry it to a table, eat, ask for seconds,
// return the plate. The other diners' side is in mess/flow.js.
import * as THREE from 'three';
import { seatPlayer, seatCam } from '../activities/basic.js';
import { MEALS, mealNow, nextMeal, menuItems, platePlan, priceOf, mealName, isSpecial, messMenu } from './menu.js';
import { makeThali } from './food.js';
import { LAY } from './flow.js';
import { rupees } from '../progress.js';
import { fmtHour } from '../life/clock.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ENERGY = { breakfast: 38, lunch: 55, dinner: 55 };

export class MessPlayer {
  constructor(game) {
    this.g = game;
    this.carrying = null;            // { thali, meal, weekday, phase: 'empty' | 'served' | 'eaten', more }
    this.f = new THREE.Vector3();
    const g = game;
    g.acts.register('messPay', (p) => this.payActivity(p));
    g.acts.register('messServe', (p) => this.serveActivity(p));
    g.acts.register('messEat', (p) => this.eatActivity(p));
  }

  /** the meal being served at this interior right now (or null) */
  meal() { return mealNow(this.g.clock.hour); }
  hostelOf(I) { return I?.site?.lm || null; }
  isOwn(I) { return this.hostelOf(I) === this.g.progress.profile.hostel; }
  coupon(I) { const m = this.meal(); return m ? this.g.progress.couponFor(this.hostelOf(I), m.id) : null; }
  closedMsg() { const n = nextMeal(this.g.clock.hour); return `the mess is closed: ${n.name.toLowerCase()} at ${fmtHour(n.from)}`; }

  // ------------------------------------------------------------------ the plate in your hands
  hold(rec) {
    this.drop(true);
    this.carrying = rec;
    this.g.scene.add(rec.thali.group);
    this.g.player.carry = true;
  }
  /** put the plate away (leaving the room, returning it) */
  drop(silent = false) {
    const c = this.carrying;
    if (!c) return;
    this.g.scene.remove(c.thali.group);
    this.carrying = null;
    this.g.player.carry = false;
    if (!silent) this.g.audio.tone?.(2400, 0.05, { type: 'triangle', gain: 0.05 });
  }
  clear() { this.drop(true); }
  update() {
    const c = this.carrying, g = this.g;
    if (!c) return;
    if (!g.interior.active || g.activity.is('messEat')) return;
    const P = g.player, h = P.heading, s = Math.sin(h), co = Math.cos(h);
    const av = P.avatar;
    if (av?.J?.elbowL && av?.J?.elbowR) {          // in both hands: midway between them, whatever the pose is doing
      av.root.updateMatrixWorld(true);
      const a = (this._hl ||= new THREE.Vector3()), b = (this._hr ||= new THREE.Vector3());
      av.J.elbowL.localToWorld(a.set(0, -0.3, 0.02)); av.J.elbowR.localToWorld(b.set(0, -0.3, 0.02));
      c.thali.group.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.03, (a.z + b.z) / 2);
    } else c.thali.group.position.set(P.pos.x + s * 0.44, P.pos.y + 1.15, P.pos.z + co * 0.44);
    c.thali.group.rotation.set(0.05, h, 0);
    c.thali.group.scale.setScalar(1.0);
  }

  // ------------------------------------------------------------------ 1. the counter: mess card or payment
  payActivity(p) {
    const self = this;
    return {
      name: 'messPay', hud: 'Mess counter', cancelable: true,
      start() {
        const g = this.g, I = p.interior, m = self.meal();
        if (!m) { g.ui.toast(`Sorry: ${self.closedMsg()}.`, 'info', 'Mess'); this.done = true; return; }
        this.I = I; this.m = m;
        this.render();
      },
      render() {
        const g = this.g, I = this.I, m = this.m, wd = g.clock.weekday, P = g.progress;
        const hostel = self.hostelOf(I), own = self.isOwn(I), price = priceOf(m.id, wd), name = mealName(m.id, wd);
        const have = P.couponFor(hostel, m.id);
        const menu = esc(messMenu(m.id, wd));
        const btns = [];
        let body;
        if (have) {
          body = `<p class="menu-line">${esc(name)} · ${esc(I.plan.name)}</p><p>You already have your coupon${have.price ? ` (paid ${rupees(have.price)} by ${have.method === 'cash' ? 'cash' : 'UPI'})` : ' (your mess card)'}. Take a plate, join the queue and hand it in at the serving counter.</p>`;
          btns.push({ label: '<kbd>Esc</kbd> OK', key: 'Escape', onClick: () => (this.done = true) });
        } else if (own) {
          body = `<p class="menu-line">${esc(name)} · your mess</p><p class="dim">${menu}</p><p>Your mess dues are paid: just show your mess card.</p>`;
          btns.push({ label: '<kbd>1</kbd> Show your mess card · free', key: 'Digit1', onClick: () => this.issue(0, 'card') });
          btns.push({ label: '<kbd>Esc</kbd> Not now', key: 'Escape', onClick: () => (this.done = true) });
        } else {
          body = `<p class="menu-line">${esc(name)} · ${esc(I.plan.name)}</p><p class="dim">${menu}</p><p>You are a guest here: a guest coupon is <b>${rupees(price)}</b>${isSpecial(m.id, wd) ? ' (Sunday special thali)' : ''}. Pay at the counter, or buy the coupon in the OneStop app <kbd>O</kbd> and hand it in.</p><p class="dim">Cash ${rupees(P.coins)} · UPI account ${rupees(P.bank)}</p>`;
          btns.push({ label: `<kbd>1</kbd> Pay ${rupees(price)} in cash`, key: 'Digit1', onClick: () => this.issue(price, 'cash') });
          btns.push({ label: `<kbd>2</kbd> Pay ${rupees(price)} by UPI (scan the counter's QR)`, key: 'Digit2', onClick: () => this.issue(price, 'upi') });
          btns.push({ label: '<kbd>Esc</kbd> Not now', key: 'Escape', onClick: () => (this.done = true) });
        }
        g.ui.actPanel({ title: 'Mess counter', html: body, buttons: btns });
      },
      issue(price, method) {
        const g = this.g, m = this.m;
        if (price && !g.progress.payWith(method, price, `${m.name} coupon`)) {
          g.ui.toast(method === 'cash' ? `You only have ${rupees(g.progress.coins)} in cash. Try UPI, or the ATM at the Market Complex.` : 'The UPI payment failed: not enough balance in the account behind your card.', 'warn', 'Payment');
          g.audio.bump?.();
          return;
        }
        g.progress.addCoupon({ meal: m.id, hostel: self.hostelOf(this.I), price, method, name: mealName(m.id, g.clock.weekday) });
        g.audio.coins?.();
        g.ui.toast(price ? `Paid ${rupees(price)}. The clerk hands you a coupon: take a plate, join the queue and hand it in.` : 'Mess card checked. The clerk hands you a token: take a plate, join the queue and hand it in.', 'gold', 'Mess');
        this.done = true;
      },
      update(dt) { this.g.player.avatar.animate({ type: 'idle' }, dt); if (this.done) return false; },
    };
  }

  // ------------------------------------------------------------------ 2. the stack of plates
  takePlate(I) {
    const g = this.g, m = this.meal();
    if (this.carrying) { g.ui.toast('You already have a plate.', 'info', 'Mess'); return; }
    if (!m) { g.ui.toast(`Sorry: ${this.closedMsg()}.`, 'info', 'Mess'); return; }
    if (!this.coupon(I)) { g.ui.toast('Get your coupon at the mess counter first (show your mess card, or pay).', 'info', 'Mess'); return; }
    const items = menuItems(m.id, g.clock.weekday);
    const thali = makeThali(platePlan(items, m.id));
    thali.reveal(0);
    this.hold({ thali, meal: m, weekday: g.clock.weekday, phase: 'empty', more: false, hostel: this.hostelOf(I) });
    g.audio.plate?.();
    g.ui.toast('A clean steel plate. Now the serving counter: hand in your coupon.', 'info', 'Mess');
  }

  // ------------------------------------------------------------------ 3. the serving counter
  serveLabel() {
    const c = this.carrying;
    if (!c) return 'Serving counter (take a plate first)';
    if (c.phase === 'empty') return 'Hand in your coupon and get served';
    if (c.phase === 'eaten' && !c.more) return 'Ask for seconds (rice, dal, sabji · free)';
    return 'Serving counter';
  }
  serveOk(I) {
    const c = this.carrying, m = this.meal();
    if (!m) return this.closedMsg();
    if (!c) return this.coupon(I) ? 'take a steel plate from the stack first' : 'get your coupon at the mess counter, then take a plate';
    if (c.phase === 'served') return 'sit down and eat first (walk to any seat and press E)';
    if (c.phase === 'eaten' && c.more) return 'you have had seconds already: return your plate at the rack';
    return true;
  }
  serveActivity(p) {
    const self = this;
    return {
      name: 'messServe', hud: 'Being served', cancelable: false,
      start() {
        const g = this.g, c = self.carrying, I = p.interior, m = self.meal();
        if (!c || !m) { this.done = true; return; }
        this.seconds = c.phase === 'eaten';
        if (!this.seconds) {
          const cp = g.progress.couponFor(c.hostel, m.id);
          if (!cp) { g.ui.toast('You need a coupon: get it at the mess counter.', 'warn', 'Mess'); this.done = true; return; }
          cp.used = true; g.progress.save();
        }
        // stand at the counter, facing it
        const O = I.O, P = g.player;
        const x = Math.max(-15.8, Math.min(-10, P.pos.x - O.x));
        P.pos.set(O.x + x, O.y, O.z + LAY.serveQ(0).z);
        P.heading = Math.PI; P.vel.set(0, 0, 0);
        P.avatar.root.position.copy(P.pos); P.avatar.root.rotation.set(0, Math.PI, 0);
        g.camera.userData.orbitInit = false;
        this.want = this.seconds ? c.thali.items.map((it, i) => i).filter((i) => ['rice', 'dal', 'sabji'].includes(c.thali.items[i].kind)) : c.thali.items.map((it, i) => i);
        if (this.seconds) c.thali.reveal(0);
        this.k = 0; this.gap = 0.55;
        const body = `<p class="menu-line">${esc(mealName(m.id, g.clock.weekday))}</p><p class="dim">${esc(messMenu(m.id, g.clock.weekday))}</p><p>${this.seconds ? '“Rice, dal and sabji? Of course, beta.”' : '“Coupon? Thank you. One plate coming up.”'}</p>`;
        g.ui.actPanel({ title: 'Serving counter', html: body, buttons: [] });
        g.audio.tone?.(1500, 0.06, { type: 'triangle', gain: 0.05 });
      },
      update(dt) {
        const g = this.g, c = self.carrying;
        if (!c) return false;
        g.player.avatar.animate({ type: 'idle', carry: true }, dt);
        self.update();
        this.gap -= dt;
        if (this.gap <= 0 && this.k < this.want.length) {
          c.thali.pop(this.want[this.k], 1);
          g.audio.ladle?.();
          this.k++; this.gap = 0.62;
        }
        if (this.k >= this.want.length && this.gap <= -0.5) {
          c.phase = 'served'; c.more = c.more || this.seconds;
          g.ui.toast('Enjoy your meal! Find a seat: any bench in the hall.', 'info', 'Mess');
          return false;
        }
      },
    };
  }

  // ------------------------------------------------------------------ 4. sit and eat
  seatLabel() { const c = this.carrying; return c && c.phase === 'served' ? 'Sit here and eat' : 'Sit down'; }
  eatActivity(p) {
    const self = this;
    return {
      name: 'messEat', hud: 'Eating', cancelable: true,
      start() {
        const g = this.g, I = p.interior, c = self.carrying, seat = p.seat;
        if (!c || c.phase !== 'served') { this.done = true; return; }
        this.seat = seat; this.I = I;
        seat.taken = 'player';
        g.audio.chair?.();
        seatPlayer(g, seat, I);
        const O = I.O;
        c.thali.group.position.set(O.x + seat.x + Math.sin(seat.yaw) * 0.42, O.y + 0.77, O.z + seat.z + Math.cos(seat.yaw) * 0.42);
        c.thali.group.rotation.set(0, seat.yaw, 0);
        c.thali.group.scale.setScalar(1.35);
        this.bite = 0; this.fast = 0;
        this.total = 24 + c.thali.count * 1.5;
        const m = c.meal;
        g.ui.actPanel({ title: `${mealName(m.id, c.weekday)} · ${I.plan.name}`, html: `<p class="menu-line">${esc(messMenu(m.id, c.weekday))}</p><div class="bar big"><i id="act-bar"></i></div>`, buttons: [{ label: '<kbd>Space</kbd> Eat faster', key: 'Space', onClick: () => (this.fast += 1.6) }] });
        g.audio.clatter?.();
      },
      update(dt) {
        const g = this.g, c = self.carrying;
        if (!c) return false;
        this.bite += dt + this.fast * dt * 0.6; this.fast = Math.max(0, this.fast - dt * 0.5);
        const k = Math.min(1, this.bite / this.total);
        const el = document.getElementById('act-bar'); if (el) el.style.width = `${k * 100}%`;
        g.player.avatar.animate({ type: 'eat' }, dt);
        c.thali.eat(k);
        if (k >= 1) {
          const m = c.meal;
          g.progress.eat(ENERGY[m.id] + (isSpecial(m.id, c.weekday) ? 10 : 0) * 1, mealName(m.id, c.weekday).toLowerCase());
          g.progress.addXP(15, 'mess meal');
          g.progress.count('meals');
          (g.progress.flags ||= {})[`ate:${g.clock.day}:${m.id}`] = true;
          c.phase = 'eaten';
          g.ui.toast('Return your plate at the rack by the west wall, or ask for seconds at the serving counter.', 'info', 'Finished');
          return false;
        }
      },
      camera(cam, dt) { return seatCam(this.g, cam, dt, { back: 0.5, up: 1.5, side: -1.05, look: 0.55 }); },
      end() {
        if (this.seat && this.seat.taken === 'player') this.seat.taken = null;
        const c = self.carrying;
        if (c) { c.thali.group.scale.setScalar(1.0); }
      },
    };
  }

  // ------------------------------------------------------------------ 5. return the plate
  returnLabel() { return this.carrying ? 'Return your plate' : 'Plate-return rack'; }
  returnOk() { return this.carrying ? (this.carrying.phase === 'served' ? 'eat first: sit at any seat and press E' : true) : 'you have no plate'; }
  returnPlate() {
    const g = this.g, c = this.carrying;
    if (!c) return;
    g.progress.addXP(2, 'plate returned');
    g.ui.toast('Plate returned. “Thank you, beta.”', 'info', 'Mess');
    g.audio.plate?.();
    this.drop(true);
  }
}
export { MEALS };

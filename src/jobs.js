// Campus jobs that pay (in rupees): pizza delivery for the Pizza Corner and ambulance duty.
import * as THREE from 'three';
import { AN } from './crowd/people.js';
import { studentLook, adultLook, withProp, OPT, C } from './crowd/looks.js';
import { fmtDist } from './util.js';

export class Jobs {
  constructor(game) {
    this.g = game;
    this.job = null;
    const W = game.world;
    // the Pizza Corner at the Market Complex
    const dom = (game.stallsObj?.shops || []).find((s) => s.kind === 'pizzeria');
    if (dom) {
      this.pizzeria = dom;
      game.interact.add({ x: dom.x, z: dom.z, r: 3, prio: 0.6, label: () => (this.job ? 'Delivery shift in progress' : 'Work a pizza delivery shift (earn money)'), ok: () => (this.job ? 'finish the current job first' : game.mode === 'walk' ? true : 'get off first'), run: () => this.startPizza() });
      game.interact.add({ x: dom.x + 0.5, z: dom.z + 0.5, r: 2.4, label: 'Order at the Pizza Corner', run: () => game.acts.run('shop', { name: 'Pizza Corner', menu: dom.menu, kind: 'pizzeria' }) });
    }
    for (const st of game.stallsObj?.stalls || []) {
      if (st.kind === 'pizzeria') continue;
      game.interact.add({ x: st.x, z: st.z, r: st.kind === 'shop' ? 2.6 : 3.2, label: st.name === 'ATM' ? 'Use the ATM' : `Buy at ${st.name}`, run: () => game.acts.run('shop', { name: st.name, menu: st.menu, kind: st.kind }) });
    }
    // hospital ambulance bay (outside)
    const hs = W.site('hospital');
    if (hs) {
      this.hospital = hs;
      const x = hs.ex + hs.nx * 6 + hs.nz * 6, z = hs.ez + hs.nz * 6 - hs.nx * 6;
      this.bay = { x, z, yaw: hs.yaw };
      game.interact.add({ x, z, r: 4, prio: 0.6, label: () => (this.job ? 'Job in progress' : 'Volunteer for ambulance duty (paid)'), ok: () => (this.job ? 'finish the current job first' : game.mode === 'walk' ? true : 'get off first'), run: () => this.startAmbulance() });
      game.acts.register('ambulanceJob', () => ({ start() { game.interiors.exit().then(() => this.g.jobs.startAmbulance()); }, update() { return false; } }));
    }
    this.people = [];
  }

  // ------------------------------------------------------------------ pizza delivery
  startPizza() {
    const g = this.g, d = this.pizzeria;
    g.drive.start('scooter', d.x + Math.sin(d.yaw) * 3, d.z + Math.cos(d.yaw) * 3, d.yaw + Math.PI);
    g.setMode('drive');
    this.job = { kind: 'pizza', orders: 3, done: 0, earned: 0 };
    g.ui.toast('Three orders are waiting. Follow the arrows and deliver them hot!', 'gold', 'Pizza delivery shift');
    g.audio.speak?.('Your first order is ready. Deliver it hot!');
    this.nextOrder();
  }
  nextOrder() {
    const g = this.g, j = this.job, W = g.world;
    const places = W.sites.filter((s) => s.kind === 'hostel' || s.kind === 'residential' || s.kind === 'service');
    const from = g.drive.pos;
    let dest;
    for (let t = 0; t < 10; t++) { dest = places[Math.floor(Math.random() * places.length)]; if (Math.hypot(dest.ex - from.x, dest.ez - from.z) > 250) break; }
    const dist = Math.hypot(dest.ex - from.x, dest.ez - from.z);
    j.dest = dest; j.limit = Math.round(dist / 7.5 + 35); j.t = j.limit;
    g.guide.set(dest.ex + dest.nx * 4, dest.ez + dest.nz * 4, dest.name);
    j.customer = null;
    g.ui.toast(`Order #${j.done + 1}: ${['Paneer tikka pizza', 'Margherita + garlic bread', 'Corn & cheese pizza + cold drink', 'Veg supreme pizza'][j.done % 4]} to ${dest.name} (${fmtDist(dist)}).`, 'info', 'Pizza Corner');
  }

  // ------------------------------------------------------------------ ambulance duty
  startAmbulance() {
    const g = this.g, b = this.bay;
    if (!b) return;
    g.drive.start('ambulance', b.x, b.z, b.yaw);
    g.setMode('drive');
    this.job = { kind: 'ambulance', calls: 2, done: 0, earned: 0 };
    g.ui.toast('Emergency calls will come in. Q toggles the siren. Drive carefully!', 'gold', 'Ambulance duty');
    this.nextCall();
  }
  nextCall() {
    const g = this.g, j = this.job, W = g.world;
    const spots = [];
    for (const f of W.fields) if (f.kind !== 'park') spots.push({ x: f.cx, z: f.cz, what: 'A player is injured on the ' + (f.kind === 'cricket' ? 'cricket ground' : f.kind + ' court'), where: f });
    const lib = W.site('library'); if (lib) spots.push({ x: lib.ex + lib.nx * 5, z: lib.ez + lib.nz * 5, what: 'A student fainted outside the Central Library' });
    for (const h of W.sites.filter((s) => s.kind === 'hostel')) spots.push({ x: h.ex + h.nx * 5, z: h.ez + h.nz * 5, what: `A student at ${h.name} has a high fever` });
    for (const e of g.graph.edges.filter((e) => e.main && e.len > 60).slice(0, 40)) { const p = e.wpts[Math.floor(e.wpts.length / 2)]; spots.push({ x: p[0], z: p[1], what: 'Cycling accident on the road', bike: true }); }
    const from = g.drive.pos;
    let s;
    for (let t = 0; t < 15; t++) { s = spots[Math.floor(Math.random() * spots.length)]; if (Math.hypot(s.x - from.x, s.z - from.z) > 280) break; }
    j.call = s; j.stage = 'to-patient';
    const dist = Math.hypot(s.x - from.x, s.z - from.z);
    j.limit = Math.round(dist / 9 + 40); j.t = j.limit;
    g.guide.set(s.x, s.z, 'Patient');
    // the scene: patient lying down, friends around
    this.clearPeople();
    const r = Math.random;
    const snap = g.graph.nearestOnNetwork(s.x, s.z);
    const px = snap && snap.d < 20 ? snap.x + 2.5 : s.x, pz = snap && snap.d < 20 ? snap.z + 2.5 : s.z;
    j.px = px; j.pz = pz;
    const L = studentLook(r);
    this.people.push({ x: px, z: pz, y: W.heightAt(px, pz), yaw: r() * 6, anim: AN.LIE, phase: 0, speed: 0, extra: 0, look: L, patient: true });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * 6.28; this.people.push({ x: px + Math.cos(a) * 1.4, z: pz + Math.sin(a) * 1.4, y: W.heightAt(px, pz), yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), anim: k ? AN.PHONE : AN.WAVE, phase: 0, speed: 0, extra: 0, look: withProp(studentLook(r), k ? OPT.PHONE : 0) }); }
    g.ui.toast(`${s.what}. Reach them in ${j.limit} s!`, 'warn', 'Emergency call');
    g.audio.speak?.('Emergency. ' + s.what + '.');
  }

  clearPeople() { this.people = []; }

  update(dt) {
    const g = this.g, j = this.job;
    if (!j) return;
    if (g.mode !== 'drive' && !this.loading) { this.end('You left the vehicle. Shift ended.'); return; }
    const pos = g.drive.pos;
    j.t -= dt;
    if (j.kind === 'pizza') {
      const d = Math.hypot(j.dest.ex - pos.x, j.dest.ez - pos.z);
      g.ui.jobPanel(`Delivery ${j.done + 1} of ${j.orders}`, j.dest.name, `${fmtDist(d)} · ${Math.max(0, Math.ceil(j.t))} s`, j.t < 10);
      if (d < 16 && Math.abs(g.drive.speed) < 2) {
        if (!j.customer) {
          j.customer = { x: j.dest.ex + j.dest.nx * 1.5, z: j.dest.ez + j.dest.nz * 1.5, y: g.world.heightAt(j.dest.ex, j.dest.ez), yaw: j.dest.yaw, anim: AN.WAVE, phase: 0, speed: 0, extra: 0, look: studentLook(Math.random) };
          this.people = [j.customer];
        }
        g.ui.prompt('<kbd>E</kbd> Hand over the pizza');
        if (g.input.hit('KeyE')) {
          const onTime = j.t > 0;
          const pay = 60 + (onTime ? Math.round(j.t * 1.2) : 0);
          j.earned += pay; j.done++;
          g.progress.earn(pay, onTime ? 'delivery + tip' : 'late delivery, no tip');
          g.progress.addXP(15, 'delivery');
          if (onTime) g.progress.unlock('delivery');
          g.audio.coins?.();
          this.people = [];
          if (j.done >= j.orders) this.end(`Shift complete: ${j.done} deliveries, ₹${j.earned} earned.`);
          else this.nextOrder();
        }
      }
    } else {
      const target = j.stage === 'to-patient' ? { x: j.px, z: j.pz } : { x: this.hospital.ex, z: this.hospital.ez };
      const d = Math.hypot(target.x - pos.x, target.z - pos.z);
      g.ui.jobPanel(j.stage === 'to-patient' ? 'Reach the patient' : 'Rush to IITG Hospital', j.stage === 'to-patient' ? j.call.what : 'Patient on board', `${fmtDist(d)} · ${Math.max(0, Math.ceil(j.t))} s`, j.t < 10);
      if (j.stage === 'to-patient' && d < 14 && Math.abs(g.drive.speed) < 1.5) {
        g.ui.prompt('<kbd>E</kbd> Load the patient onto the stretcher');
        if (g.input.hit('KeyE')) {
          j.stage = 'loading'; this.loadT = 0;
          const W = g.world;
          const back = { x: pos.x - Math.sin(g.drive.yaw) * 3, z: pos.z - Math.cos(g.drive.yaw) * 3 };
          this.medics = [0, 1].map((k) => ({ x: back.x + k, z: back.z, y: W.heightAt(back.x, back.z), yaw: 0, anim: AN.CARRY, phase: 0, speed: 1.2, extra: 0, look: (() => { const L = adultLook(Math.random, 'faculty'); L.col0[1] = C.white; return L; })() }));
          this.people.push(...this.medics);
        }
      }
      if (j.stage === 'loading') {
        this.loadT += dt;
        const pat = this.people.find((p) => p.patient);
        const back = { x: pos.x - Math.sin(g.drive.yaw) * 3, z: pos.z - Math.cos(g.drive.yaw) * 3 };
        const k = Math.min(1, this.loadT / 4);
        const phase1 = Math.min(1, k * 2), phase2 = Math.max(0, k * 2 - 1);
        this.medics.forEach((m, i) => {
          const tx = phase2 > 0 ? back.x : pat.x + (i ? 0.9 : -0.9), tz = phase2 > 0 ? back.z : pat.z;
          m.x += (tx - m.x) * Math.min(1, dt * 3); m.z += (tz - m.z) * Math.min(1, dt * 3);
          m.yaw = Math.atan2(tx - m.x, tz - m.z); m.phase += dt * 6; m.anim = AN.CARRY;
        });
        if (phase2 > 0) { pat.x += (back.x - pat.x) * Math.min(1, dt * 3); pat.z += (back.z - pat.z) * Math.min(1, dt * 3); pat.y = g.world.heightAt(pat.x, pat.z) + 0.8; }
        void phase1;
        if (k >= 1) {
          this.people = [];
          j.stage = 'to-hospital';
          const dist = Math.hypot(this.hospital.ex - pos.x, this.hospital.ez - pos.z);
          j.t = Math.round(dist / 9 + 35);
          g.guide.set(this.hospital.ex + this.hospital.nx * 6, this.hospital.ez + this.hospital.nz * 6, 'IITG Hospital');
          g.ui.toast('Patient on board. Get to the hospital!', 'warn');
        }
      }
      if (j.stage === 'to-hospital' && d < 18 && Math.abs(g.drive.speed) < 2) {
        const pay = 150 + Math.max(0, Math.round(j.t * 2));
        j.earned += pay; j.done++;
        g.progress.earn(pay, 'patient delivered');
        g.progress.addXP(40, 'rescue');
        g.progress.unlock('rescue');
        g.audio.speak?.('Well done. The patient is in safe hands.');
        if (j.done >= j.calls) this.end(`Duty complete: ${j.done} patients, ₹${j.earned} earned.`);
        else this.nextCall();
      }
    }
  }

  end(msg) {
    const g = this.g;
    this.job = null;
    this.people = [];
    g.guide.clear();
    g.ui.jobPanel(null);
    if (msg) g.ui.toast(msg, 'gold', 'Job');
    if (g.mode === 'drive') g.setMode('walk');
  }

  draw(crowd) { for (const p of this.people) crowd.push(p); }
}
export { THREE };

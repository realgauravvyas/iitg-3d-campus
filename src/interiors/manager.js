// Walk into any building: builds its interior (by type) far below the campus, moves you
// inside, switches to indoor lighting and fills the rooms with people according to the
// time of day (and how many students the campus simulation says are inside).
import * as THREE from 'three';
import { GIRLS_HOSTELS } from '../life/venues.js';
import { TEMPLATES, templateFor, MEAL_OCC } from './templates.js';
import { MessFlow } from '../mess/flow.js';
import { mealNow } from '../mess/menu.js';
import { InteriorEnv } from './room.js';
import { studentLook, adultLook, OPT, bit, C } from '../crowd/looks.js';
import { AN } from '../crowd/people.js';
import { mulberry32, closestOnRing, canvasTexture, fitText } from '../util.js';
import { lectureFor } from '../activities/content.js';
import { VIDEOS } from '../screens.js';
import { registerActivity } from '../register.js';
import { makeBoardsTwoSided } from '../scene/bidir.js';

/** hostel canteens (2nd floor): 6 PM - 2 AM */
export const canteenOpen = (h) => h >= 18 || h < 2;
/** visiting the other gender's hostel (common areas and the canteen, never the rooms): any time but 2 - 6 AM */
export const visitOpen = (h) => !(h >= 2 && h < 6);

const O = new THREE.Vector3(0, -900, 0);
const NAME = { hostel: 'Hostel', academic: 'Academic block', residential: 'Staff quarters', institutional: 'Institute building', commercial: 'Shops', guest: 'Guest house', hospital: 'Hospital', sports: 'Sports building', admin: 'Office', auditorium: 'Auditorium' };

export class Interiors {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.O = O;
    this.plan = null;
    this.looks = [];
    this.tv = this.makeTV();
    this.screenRT = null;
    // "Enter" at every building wall you walk up to
    game.interact.provider((pos, inside) => {
      if (inside || game.mode !== 'walk' || game.player.flying || game.player.swimming) return null;
      const W = game.world;
      const tmp = { d: 0, x: 0, z: 0 };
      let best = null, bd = 2.6;
      for (const b of W.buildingsNear(pos.x, pos.z)) {
        if (b.area < 10 || b.graffitiHouse || pos.y > b.base + 3 + (b.floor0 - b.base)) continue;
        const c = closestOnRing(pos.x, pos.z, b.rings[0], tmp);
        if (c.d < bd) { bd = c.d; best = { b, x: c.x, z: c.z }; }
      }
      if (!best) return null;
      const b = best.b;
      return [{ x: best.x, z: best.z, r: 2.7, prio: 0.4, label: `Enter ${this.nameOf(b)}`, run: () => this.enter(b) }];
    });
  }

  nameOf(b) { return b.display || b.site?.name || b.name || NAME[b.kind] || 'building'; }

  makeTV() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 144;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return { c, g: c.getContext('2d'), tex, t: 0, runs: 142, wk: 3, balls: 0 };
  }
  drawTV(dt) {
    const T = this.tv; T.t += dt;
    const g = T.g;
    g.fillStyle = '#3e8a3a'; g.fillRect(0, 0, 256, 144);
    g.fillStyle = '#c9b27a'; g.fillRect(118, 30, 20, 84);
    const ph = (T.t % 4) / 4;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(128 + Math.sin(ph * 6.28) * 60 * ph, 110 - ph * 80, 3, 0, 7); g.fill();
    g.fillStyle = '#111'; g.fillRect(118, 26, 3, 8); g.fillRect(135, 110, 3, 8);
    if (T.t > 4) { T.t = 0; T.balls++; const r = [0, 1, 1, 2, 4, 6, 0, 1][Math.floor(Math.random() * 8)]; T.runs += r; if (T.balls % 6 === 0) T.wk += Math.random() < 0.15 ? 1 : 0; }
    g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(0, 118, 256, 26);
    g.fillStyle = '#fff'; g.font = 'bold 15px sans-serif';
    g.fillText(`IITG XI  ${T.runs}/${T.wk}  (${17 + Math.floor(T.balls / 6)}.${T.balls % 6})`, 8, 136);
    g.fillStyle = '#f2c12e'; g.fillText('LIVE', 210, 136);
    T.tex.needsUpdate = true;
  }

  async enter(b, opts = {}) {
    if (this.active || this.busy) return;
    const g = this.g;
    if (b.bungalow && !(g.bungalowPass && g.clock.abs < g.bungalowPass.until)) { g.ui.toast('"This is the Director\'s residence. Visitors by appointment only, please: ask for one at the guard post by the gate."', 'warn', 'Security'); g.audio.tone?.(330, 0.15, { type: 'triangle', gain: 0.05 }); return; }
    // hostel rules: in a BOYS' hostel a visitor (a girl, or a boy from another hostel) goes in with a OneStop QR scan at the door;
    // in a GIRLS' hostel everyone who does not live there (to the mess or the canteen) has to write their name in the visitors' register
    // at the security desk, QR does not work there. Visitors may use the common areas and the canteen, never the rooms, at any time
    // except 2 - 6 AM.
    const st = b.site;
    const female = g.player.avatar.look.body === 'female';
    let visitor = opts.visitor || null;
    const hostelDoor = !opts.template && st?.kind === 'hostel' && st.lm !== g.progress.profile.hostel && st.lm !== 'msh';
    const girlsHostel = hostelDoor && GIRLS_HOSTELS.has(st.lm);                      // register only
    if (hostelDoor && (girlsHostel || GIRLS_HOSTELS.has(st.lm) !== female)) {         // the other gender, or any visitor to a girls' hostel
      if (!visitOpen(g.clock.hour)) {
        g.ui.toast(`"No visitors between 2 AM and 6 AM. ${this.nameOf(b)} opens to visitors again at 6 AM."`, 'warn', 'Hostel guard');
        g.audio.tone?.(330, 0.15, { type: 'triangle', gain: 0.05 });
        return;
      }
      visitor = visitor || { signed: false };
    }
    // OneStop: boys' hostels and the Computer Centre have a machine at the door. Not in yet? A quick scan first (a visitor to a girls'
    // hostel signs the register at the desk instead: no scan there)
    const key = opts.onestop || (!opts.template && st?.kind === 'hostel' ? st.lm : !opts.template && st?.lm === 'library' ? 'place-library' : null);
    if (key && g.onestop && !opts.noScan && !girlsHostel) {
      if (!g.onestop.isIn(key)) { g.onestop.quickScan(key, 'in', () => this.enter(b, { ...opts, noScan: true, visitor: visitor ? { ...visitor, signed: true } : null }), { kind: st?.kind === 'hostel' ? 'hostel' : 'place', name: opts.name || this.nameOf(b) }); return; }
      if (visitor) visitor.signed = true;
      g.onestop.openDoor(key);
    }
    this.busy = true;
    if (!opts.noFade) await g.ui.fade(1);
    const site = b.site || null;
    const tname = opts.template || templateFor(b, site);
    const hour = g.clock.hour;
    const ctx = {
      g, b, site, name: opts.name || this.nameOf(b), seed: b.i + 7, hour, weekday: g.clock.weekday, dayName: g.clock.dayName,
      yours: site?.lm === g.progress.profile.hostel, tvTex: this.tv.tex, screenTex: this.screenTexture(),
      noRooms: !!visitor,
      lecture: lectureFor(g.clock.weekday, hour, site?.lm), dept: null,
      shops: (g.stallsObj?.shops || []).map((s) => ({ name: s.name, menu: s.menu })),
      go: (id, params) => g.acts.run(id, { ...params, interior: this, plan: this.plan }),
      leave: (side) => this.exit(side),
      from: opts.from || null,
      visitor,
      canteenOpen: () => canteenOpen(g.clock.hour),
      upstairs: () => this.switchTo('canteen'),
      wing: () => this.switchTo('hostelwing'),
      downstairs: () => this.switchTo('hostel'),
      video: VIDEOS[tname] || null,
      ...(g.events?.interiorCtx?.(site, tname) || {}),
    };
    const plan = (TEMPLATES[tname] || TEMPLATES.generic)(ctx);
    this.plan = plan; this.ctx = ctx; this.b = b; this.site = site; this.kind = tname;
    if (key) this.key = key; else if (!opts.template) this.key = null;
    this.group = plan.build(O);
    // the mess at meal time: students walk in, pay, queue, eat and leave
    this.flow = null;
    if (tname === 'hostel') {
      const girls = GIRLS_HOSTELS.has(site?.lm), mixed = site?.lm === 'msh';
      const rnd = mulberry32(b.i * 17 + Math.floor(g.clock.abs));
      this.flow = new MessFlow({ plan, rnd, lookFor: (i) => studentLook(mulberry32(b.i * 211 + i * 13 + 5), { female: girls || (mixed && i % 3 === 0) }) });
      this.flowWarm = true;
      this.buildFlowPlates();
    }
    makeBoardsTwoSided(this.group);
    g.scene.add(this.group);
    // the screen: a live YouTube screening (auditorium / Conference Centre)
    const sp = plan.panels.find((q) => q.key === 'screen');
    if (ctx.video && sp && plan.panelMeshes?.screen) g.screens?.attach(plan.panelMeshes.screen, ctx.video, sp.w, sp.h);
    // the projector's beam through the dark hall
    for (const bm of plan.beams || []) this.group.add(beamMesh(bm));
    this.env = new InteriorEnv(plan, O);
    const e = g.world.entranceOf(b, g.graph);
    this.outside = opts.outside || { x: e.x + Math.sin(e.yaw) * 1.2, z: e.z + Math.cos(e.yaw) * 1.2, yaw: e.yaw };
    this.visitor = visitor;
    this.active = true;
    g.env = this.env;
    // player inside the door
    const P = g.player;
    P.flying = false;
    P.pos.set(O.x + plan.spawn.x, O.y + plan.floorAt(plan.spawn.z, plan.spawn.x), O.z + plan.spawn.z);
    P.heading = plan.spawn.yaw; P.camYaw = plan.spawn.yaw; P.vel.set(0, 0, 0);
    this.savedDist = P.camDist; P.camDist = Math.min(P.camDist, 3.2);
    g.camera.userData.orbitInit = false;
    g.sky.state.inside = true;
    g.weather.inside = true;
    this.sampleT = 0;
    this.refreshPeople(true);
    this.setLocal();
    if (g.progress.count(`visit_${tname}`) === 1) g.progress.addXP(20, `first visit: ${plan.name}`);
    g.ui.toast(this.hint(tname), 'info', plan.name);
    this.busy = false;
    await g.ui.fade(0);
    // sign the visitors' register at the security desk first
    if (visitor && visitor.signed && tname === 'hostel' && !visitor.greeted) {
      // you scanned the OneStop machine at this hostel's door: the guard has your details already
      visitor.greeted = true;
      g.ui.toast(`"Signed in with OneStop. Common areas${canteenOpen(g.clock.hour) ? ' and the canteen (2nd floor)' : ''} only, no rooms. Please be out by 2 AM."`, 'gold', 'Hostel guard');
    } else if (visitor && !visitor.signed && tname === 'hostel') {
      const O = this.O, desk = plan.securityDesk;
      g.activity.start(registerActivity({
        title: "VISITORS' REGISTER", place: `${plan.name} · security desk`, purpose: 'Canteen visit', guardName: 'Mr. Bora',
        desk: { x: O.x + desk.x, y: O.y, z: O.z + desk.z + 1.15, yaw: Math.PI }, look: { x: O.x + desk.x, y: O.y + 1.02, z: O.z + desk.z },
        okLine: `Common areas${canteenOpen(g.clock.hour) ? ' and the canteen (2nd floor)' : ''} only, no rooms. Please be out by 2 AM.`,
        onDone: (e) => { visitor.signed = true; visitor.entry = e; g.onestop?.signed?.(site?.lm, e, this.nameOf(b)); },
        onCancel: () => this.exit(),
      }));
    }
  }

  /** go to another floor of the same building (hostel lobby <-> the canteen upstairs) */
  async switchTo(tname) {
    if (!this.active || this.busy) return;
    const g = this.g, b = this.b, outside = this.outside, visitor = this.visitor, from = this.kind;
    if (tname === 'canteen' && !canteenOpen(g.clock.hour)) { g.ui.toast('The canteen opens at 6 PM (till 2 AM).', 'info', 'Canteen'); return; }
    g.acts.stop(true);
    await g.ui.fade(1);
    g.audio.tone?.(180, 0.2, { type: 'triangle', gain: 0.03 });
    this.teardown();
    await this.enter(b, { template: tname, noFade: true, outside, visitor, from });
  }

  /** remove the current interior (no fade, player not moved) */
  teardown() {
    const g = this.g;
    g.screens?.detach();
    g.scene.remove(this.group);
    this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => { if (x.map && x.map !== this.tv.tex && x.map !== this.idleScreen && x.map !== this.screenRT?.texture) x.map.dispose(); x.dispose(); }); } });
    this.active = false;
    this.plan = null; this.plates = null; this.flow = null; this.flowPlates = null;
    g.mess?.clear();
    g.interact.setLocal([]);
  }

  hint(t) {
    return {
      hostel: 'Mess hall on the left, common room on the right, rooms at the back.',
      lecture: 'Take a seat to attend the lecture, or write an exam.',
      academic: 'Chemistry and physics labs on the left, computer lab on the right.',
      library: 'Find a reading table to study. Please keep silence.',
      auditorium: 'Find a seat for the show. Exit doors at the front, beside the stage.',
      conference: 'The Conference Centre hall: the projector is on. Exit doors at the front.',
      computer: 'Find a free PC (the ones with a login screen) and sit down to browse the web.',
      canteen: 'The hostel canteen: open 6 PM - 2 AM. Order at the counter.',
      hostelwing: 'The facilities wing: the library, the gym, the music room and the TV room. Walk to a door.',
      hospital: 'See the doctor, or volunteer at the ambulance bay.',
      gym: 'Try the reps challenge.', sac: 'Dance practice and music jams happen in the evenings.',
      foodcourt: 'Order at any counter.', shop: 'Buy what you need.', home: 'A campus family lives here.',
    }[t] || 'Walk back to the door to leave.';
  }

  setLocal() {
    const g = this.g, plan = this.plan;
    const pts = plan.acts.map((a) => ({ ...a, x: a.x + O.x, z: a.z + O.z, y: O.y + (a.y ?? 0), dy: a.dy ?? 3, prio: 0.3 }));
    pts.push({ x: O.x + plan.exit.x, z: O.z + plan.exit.z, y: O.y + plan.floorAt(plan.exit.z, plan.exit.x), dy: plan.exitR ? 1.3 : 5, r: plan.exitR ?? 2.2, label: () => (this.key && g.onestop?.isIn(this.key) ? 'Scan out with OneStop and go outside' : 'Go outside'), run: () => this.exit(), prio: 0.5 });
    for (const s of plan.seats) {
      pts.push({ x: s.x + O.x, z: s.z + O.z, y: O.y + s.y, r: 0.9, dy: 1.5, when: () => !s.npc && !(s.taken && s.taken !== 'player'), label: s.mess ? () => g.mess.seatLabel() : 'Sit down',
        run: () => (s.mess && g.mess?.carrying?.phase === 'served' ? g.acts.run('messEat', { seat: s, interior: this }) : g.acts.run('sit', { seat: s, interior: this })), prio: -0.4 });
    }
    g.interact.setLocal(pts);
  }

  /** choose which NPC spots are occupied right now (stable within a half-hour) */
  refreshPeople(first = false) {
    const g = this.g, plan = this.plan, h = g.clock.hour;
    const inside = this.site ? g.life.insideOf(this.site).size : 0;
    const busy = this.site && this.kind !== 'auditorium' ? Math.min(1.3, 0.35 + inside / 45) : 1;
    const bucket = Math.floor(g.clock.abs * 2);
    const rnd = mulberry32(this.b.i * 31 + bucket);
    for (const s of plan.seats) s.npc = !!s.flowOwner;
    this.crowdK = busy;
    this.people = [];
    plan.spots.forEach((s, i) => {
      const p = (s.when ? s.when(h) : 0.5) * (s.role === 'student' ? busy : 1);
      if (rnd() > p) return;
      if (!this.looks[i] || first) this.looks[i] = this.lookFor(s.role, i);
      if (s.seat) s.seat.npc = true;
      let opts = 0;
      for (const o of s.opts || []) opts |= bit(o);
      this.people.push({ x: s.x + O.x, y: O.y + (s.y ?? plan.floorAt(s.z)), z: s.z + O.z, yaw: s.yaw, anim: s.anim, phase: rnd() * 6, speed: 0, extra: s.extra ?? (s.clap ? 1 : 0), look: this.looks[i], opts: this.looks[i].opts | opts, spot: s });
    });
    // thalis on the tables in front of diners
    if (this.plates) { this.group.remove(this.plates); this.plates.geometry.dispose(); }
    const diners = this.people.filter((p) => p.spot.plate);
    if (diners.length) {
      const geo = new THREE.CylinderGeometry(0.16, 0.15, 0.02, 16);
      const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xc7ccd1, metalness: 0.7, roughness: 0.3 }), diners.length);
      const M = new THREE.Matrix4();
      diners.forEach((p, i) => { M.makeTranslation(p.x - O.x + Math.sin(p.yaw) * 0.42, 0.78, p.z - O.z + Math.cos(p.yaw) * 0.42); im.setMatrixAt(i, M); });
      this.plates = im;
      this.group.add(im);
    }
    this.setLocal();
  }

  /** the plates on the tables in front of the diners the mess flow has seated */
  buildFlowPlates() {
    const steel = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.15, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0xc7ccd1, metalness: 0.7, roughness: 0.3 }), 64);
    const food = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.115, 0.115, 0.014, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 64);
    steel.count = food.count = 0;
    steel.frustumCulled = food.frustumCulled = false;
    this.flowPlates = { steel, food, M: new THREE.Matrix4(), C: new THREE.Color() };
    this.group.add(steel, food);
  }
  updateFlowPlates() {
    const F = this.flowPlates;
    if (!F || !this.flow) return;
    const list = this.flow.platesOnTables(), cols = [0xe0c47a, 0xf1ead6, 0xc9a24a, 0xd9b36a, 0xe9dcae];
    F.steel.count = F.food.count = Math.min(64, list.length);
    for (let i = 0; i < F.steel.count; i++) {
      const p = list[i], x = p.x + Math.sin(p.yaw) * 0.42, z = p.z + Math.cos(p.yaw) * 0.42;
      F.M.makeTranslation(x, 0.77, z); F.steel.setMatrixAt(i, F.M);
      F.M.makeTranslation(x, 0.79, z); F.food.setMatrixAt(i, F.M);
      F.food.setColorAt(i, F.C.setHex(cols[p.k % cols.length]));
    }
    F.steel.instanceMatrix.needsUpdate = F.food.instanceMatrix.needsUpdate = true;
    if (F.food.instanceColor) F.food.instanceColor.needsUpdate = true;
  }

  lookFor(role, i) {
    const r = mulberry32(this.b.i * 131 + i * 7);
    if (role === 'student') return studentLook(r);
    if (role === 'kid') { const L = studentLook(r); L.scale = 0.58; L.opts &= ~bit(OPT.BEARD); return L; }
    if (role === 'mess') return adultLook(r, 'mess');
    if (role === 'guard') return adultLook(r, 'guard');
    if (role === 'doctor' || role === 'nurse') { const L = adultLook(r, 'faculty'); L.col0[1] = C.white; L.flags |= 2; return L; }
    return adultLook(r, role === 'faculty' ? 'faculty' : role === 'staff' ? 'staff' : role === 'guest' ? 'guest' : 'parent');
  }

  screenTexture() {
    if (!this.screenRT) {
      this.screenRT = new THREE.WebGLRenderTarget(768, 320);
      this.screenRT.texture.colorSpace = THREE.SRGBColorSpace;
      const c = document.createElement('canvas'); c.width = 768; c.height = 320;
      const x = fitText(c.getContext('2d'));
      x.fillStyle = '#0b0b10'; x.fillRect(0, 0, 768, 320);
      x.fillStyle = '#c89b3c'; x.font = 'bold 54px "Teko", "Hind", sans-serif'; x.textAlign = 'center';
      x.fillText('IITG FILM CLUB PRESENTS', 384, 150);
      x.fillStyle = '#f3ead7'; x.font = '30px "Hind", sans-serif'; x.fillText('Tonight: "A Year on the Brahmaputra Campus"', 384, 210);
      this.idleScreen = new THREE.CanvasTexture(c);
      this.idleScreen.colorSpace = THREE.SRGBColorSpace;
    }
    return this.idleScreen;
  }

  async exit(side = 0, opts = {}) {
    if (!this.active || this.busy) return;
    const key = this.key, os = this.g.onestop;
    if (key && os?.isIn(key) && !opts.noScan) {
      if (opts.quiet) os.record({ kind: 'hostel', site: key, name: this.plan?.name || key, place: this.plan?.name || key, x: this.outside.x, z: this.outside.z }, 'out', 'guard');
      else { os.quickScan(key, 'out', () => this.exit(side, { noScan: true })); return; }
    }
    this.busy = true;
    const g = this.g;
    g.acts.stop(true);
    g.screens?.detach();
    // a side exit comes out on that side of the building (not back at the main entrance)
    if (side) {
      const e = this.outside, b = this.b, r = b.rings[0];
      const tx = Math.cos(e.yaw) * side, tz = -Math.sin(e.yaw) * side;
      let best = null, bd = -Infinity;
      for (let k = 0; k < r.length; k += 2) { const d = (r[k] - e.x) * tx + (r[k + 1] - e.z) * tz - Math.abs((r[k] - e.x) * Math.sin(e.yaw) + (r[k + 1] - e.z) * Math.cos(e.yaw)) * 0.3; if (d > bd) { bd = d; best = [r[k], r[k + 1]]; } }
      if (best) {
        let x = best[0] + tx * 2, z = best[1] + tz * 2;
        for (let k = 0; k < 8 && g.world.buildingAt(x, z); k++) { x += tx * 1.5; z += tz * 1.5; }
        this.outside = { x, z, yaw: Math.atan2(tx, tz) };
      }
    }
    await g.ui.fade(1);
    g.scene.remove(this.group);
    this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => { if (x.map && x.map !== this.tv.tex && x.map !== this.idleScreen && x.map !== this.screenRT?.texture) x.map.dispose(); x.dispose(); }); } });
    this.active = false;
    this.plan = null; this.plates = null; this.flow = null; this.flowPlates = null;
    g.mess?.clear();
    g.env = g.world;
    g.interact.setLocal([]);
    const P = g.player;
    P.spawn(this.outside.x, this.outside.z, this.outside.yaw);
    P.camDist = this.savedDist || 6.5;
    g.camera.userData.orbitInit = false;
    g.sky.state.inside = false;
    g.sky.state.lastEnv = '';
    g.weather.inside = false;
    this.busy = false;
    await g.ui.fade(0);
  }

  update(dt) {
    if (!this.active) return;
    const g = this.g;
    if (this.visitor && !visitOpen(g.clock.hour) && !this.busy && !this.evicting) {
      this.evicting = true;
      g.ui.toast('"It is 2 AM: visitors must leave now, please."', 'warn', 'Hostel guard');
      setTimeout(() => { this.evicting = false; this.exit(0, { quiet: true }); }, 2500);
    }
    const day = g.sky.state.day;
    const col = new THREE.Color().setRGB(0.55 + day * 0.9, 0.62 + day * 0.9, 0.8 + day * 0.85).multiplyScalar(day > 0.1 ? 1 : 0.18);
    this.plan.update(dt, col);
    this.sampleT -= dt;
    if (this.sampleT <= 0) { this.sampleT = 8; this.refreshPeople(); }
    if (this.flow) {
      const h = g.clock.hour, meal = mealNow(h), occ = meal ? MEAL_OCC(h) : 0, target = this.flow.target(occ, this.crowdK || 1);
      const P = g.player.pos, me = this.active ? { x: P.x - O.x, z: P.z - O.z } : null;
      if (this.flowWarm) { this.flowWarm = false; if (meal) this.flow.warm({ target, meal: true }); }
      this.flow.update(dt, { target, meal: !!meal, player: me });
      this.updateFlowPlates();
      // the clink of plates, now and then, while people are eating
      this.plateT = (this.plateT ?? 2) - dt;
      if (this.plateT <= 0) { this.plateT = 1.2 + Math.random() * 3; if (this.flow.agents.some((a) => a.state === 'eat' || a.state === 'serveq')) g.audio.plate?.(); }
    }
    g.mess?.update();
    this.tvT = (this.tvT || 0) - dt;
    if (this.tvT <= 0 && (this.kind === 'hostel' || this.kind === 'home')) { this.tvT = 0.1; this.drawTV(0.1); }
  }

  drawPeople(crowd) {
    if (!this.active) return;
    for (const p of this.people) {
      if (p.hidden) continue;
      crowd.push(p, true);
    }
    if (this.flow) for (const o of this.flow.people(O)) crowd.push(o, true);
  }
  count() { return this.active ? this.people.length + (this.flow ? this.flow.agents.length : 0) : 0; }
}

/** a soft, dusty light cone from a projector lens to the four corners of its screen */
function beamMesh({ from, to, w, h }) {
  const [fx, fy, fz] = from, [tx, ty, tz] = to;
  const c = [[tx - w / 2, ty - h / 2, tz], [tx + w / 2, ty - h / 2, tz], [tx + w / 2, ty + h / 2, tz], [tx - w / 2, ty + h / 2, tz]];
  const pos = [];
  for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; pos.push(fx, fy, fz, ...a, ...b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.018, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 3;
  return m;
}

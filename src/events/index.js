// Campus events calendar (repeats weekly) with set pieces, crowds and ways to take part.
import * as THREE from 'three';
import { SetBuilder, bannerTex, ledScreen } from './sets.js';
import { AN } from '../crowd/people.js';
import { studentLook, adultLook, kit, withProp, OPT, bit, C, pal, HOSTEL_COLORS } from '../crowd/looks.js';
import { mulberry32 } from '../util.js';
import { rhythmActivity } from '../activities/rhythm.js';
import { sprintActivity } from '../sports/others.js';
import { seatCam } from '../activities/basic.js';
import { shuffleQ, TRIVIA, COURSES } from '../activities/content.js';
import { fmtHour, DAYS } from '../life/clock.js';
import { buildConcertStage, concertSpot, STAGE } from '../scene/concertstage.js';

const CLUBS = [['Coding Club', 'Hack nights · CP', '#1f4fa0'], ['Robotics Club', 'Build · compete', '#5b2d7a'], ['Aeromodelling', 'Drones · RC planes', '#0097a7'], ['Dance Club', 'Auditions today', '#b3262f'],
  ['Music Club', 'Jam sessions', '#e2702f'], ['Photography', 'Photo walks', '#2e7d4f'], ['Astronomy Club', 'Star parties', '#1f2a44'], ['Drama Club', 'Street plays', '#8a5a36'], ['Quiz Club', 'Weekly quizzes', '#6b3d5e'], ['Literary Club', 'Debates · poetry', '#46505c']];
const AI_BOOTHS = [['Computer Vision', 'See like a machine', '#1f4fa0'], ['Language Models', 'Chat with an LLM', '#5b2d7a'], ['Robotics Lab', 'Meet the robot', '#c62828'], ['Drones for Assam', 'Flood mapping', '#0097a7'], ['AI in Healthcare', 'Early diagnosis', '#2e7d4f'], ['Agri-AI', 'Tea garden analytics', '#8a5a36']];

export class EventManager {
  constructor(game) {
    this.g = game;
    const W = game.world;
    const cricket = W.fieldsOf('cricket').sort((a, b) => b.len * b.wid - a.len * a.wid);
    this.mainGround = cricket.find((f) => f.name && !f.practice) || cricket.find((f) => !f.practice) || cricket[0];
    this.soccer = W.fieldsOf('soccer')[0] || W.fieldsOf('hockey')[0];
    this.stage = buildConcertStage(game, this.mainGround);       // the open-air concert stage with its lighting truss: there all year, lit up for the Pronites
    this.ath = W.fieldsOf('athletics')[0];
    const site = (id) => W.site(id);
    const fr = (f, u = 0, v = 0) => ({ ...W.fieldPoint(f, u, v), yaw: Math.atan2(f.ax, f.az) });
    const sp = (s, d = 12) => ({ x: s.ex + s.nx * d, z: s.ez + s.nz * d, yaw: s.yaw + Math.PI });
    const memo = (f) => { let v = null; return () => (v ||= f()); };
    /** a stage set stands where all of it (booths, tents, banner, queue) is clear of buildings, lakes, roads and paths:
     *  the wanted spot if it fits, else the nearest one that does (ext: the set's own extent [x0, x1, z0, z1] in metres) */
    const clearSet = (p, ext) => {
      const PL = W.placer;
      if (!PL) return p;
      const hx = (ext[1] - ext[0]) / 2, hz = (ext[3] - ext[2]) / 2, cx = (ext[0] + ext[1]) / 2, cz = (ext[2] + ext[3]) / 2;
      const fits = (x, z, yaw) => PL.footprint(x + cx * Math.cos(yaw) + cz * Math.sin(yaw), z - cx * Math.sin(yaw) + cz * Math.cos(yaw), yaw, hx, hz, 0.8);
      if (fits(p.x, p.z, p.yaw)) return p;
      for (let R = 3; R <= 70; R += 3) {
        for (const dy of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2, x = p.x + Math.cos(a) * R, z = p.z + Math.sin(a) * R;
          if (fits(x, z, p.yaw + dy)) { W.placer.reserveBox(x + cx * Math.cos(p.yaw + dy) + cz * Math.sin(p.yaw + dy), z - cx * Math.sin(p.yaw + dy) + cz * Math.cos(p.yaw + dy), p.yaw + dy, hx * 0.9, hz * 0.9, 'event'); return { x, z, yaw: p.yaw + dy }; }
        }
      }
      return p;
    };
    this.defs = [
      { id: 'orientation', name: "Freshers' Orientation", day: 0, from: 9.5, to: 12.5, where: 'Dr. Bhupen Hazarika Auditorium', place: memo(() => clearSet(sp(site('auditorium'), 14), [-9.5, 9.5, -1.6, 9.2])), build: (e) => this.buildOrientation(e), join: { label: 'Collect your orientation kit', act: 'orientationKit' } },
      { id: 'clubfair', name: 'Club Fair', day: 1, from: 16, to: 19.5, where: 'Student Activity Centre', place: memo(() => clearSet(sp(site('sac'), 18), [-15, 15, -11.5, 3.5])), build: (e) => this.buildClubFair(e), join: { label: 'Sign up for a club', act: 'clubSignup' } },
      { id: 'cricketfinal', name: 'Inter-hostel Cricket Final', day: 2, from: 15.5, to: 18.6, where: 'Cricket Ground', place: () => fr(this.mainGround), build: (e) => this.buildCricketFinal(e) },
      { id: 'aiconf', name: 'AI Confluence', day: 3, from: 10, to: 17, where: 'Conference Centre', place: memo(() => clearSet(sp(site('conference'), 16), [-12.6, 12.6, -3.6, 5.2])), build: (e) => this.buildAI(e), join: { label: 'Try the demos (quiz)', act: 'aiDemo' } },
      { id: 'techniche', name: 'Techniche Pronite', day: 4, from: 19, to: 22.5, where: 'Cricket Ground', place: () => fr(this.mainGround), build: (e) => this.buildConcert(e, 'TECHNICHE', 'Pronite · EDM night', 'edm'), join: { label: 'Join the crowd and dance', act: 'concertDance' } },
      { id: 'sportsday', name: 'Spirit Sports Day', day: 5, from: 7.5, to: 12, where: 'Athletics Track', place: () => fr(this.ath), build: (e) => this.buildSportsDay(e), join: { label: 'Enter the 100 m race', act: 'sportsDayRace' } },
      { id: 'convocation', name: 'Convocation', day: 6, from: 9.5, to: 12.5, where: 'Football Ground', place: () => fr(this.soccer), build: (e) => this.buildConvocation(e), join: { label: 'Attend the convocation', act: 'convocation' } },
      { id: 'alcheringa', name: 'Alcheringa Pronite', day: 6, from: 18.5, to: 22.5, where: 'Cricket Ground', place: () => fr(this.mainGround), build: (e) => this.buildConcert(e, 'ALCHERINGA', 'Pronite · live band', 'band'), join: { label: 'Join the crowd and dance', act: 'concertDance' } },
    ].filter((d) => { try { return !!d.place(); } catch { return false; } });
    this.live = new Map();
    this.announced = new Set();
    this.t = 0;
    this.registerActs();
  }

  // ------------------------------------------------------------------ schedule
  isOn(d, h = this.g.clock.hour, wd = this.g.clock.weekday) { return wd === d.day && h >= d.from && h < d.to; }
  isNear(d, h = this.g.clock.hour, wd = this.g.clock.weekday) { return wd === d.day && h >= d.from - 1.25 && h < d.to + 0.4; }
  today() { return this.defs.filter((d) => d.day === this.g.clock.weekday); }
  next() {
    const c = this.g.clock;
    let best = null, bd = Infinity;
    for (const d of this.defs) {
      let dd = (d.day - c.weekday + 7) % 7;
      let hrs = dd * 24 + d.from - c.hour;
      if (hrs < -(d.to - d.from)) hrs += 7 * 24;
      if (hrs < bd && !(this.isOn(d))) { bd = hrs; best = d; }
    }
    return best ? { d: best, inHours: bd } : null;
  }
  current() { return this.defs.find((d) => this.isOn(d)) || null; }
  sportsState() {
    const s = {};
    for (const d of this.defs) {
      if (d.id === 'cricketfinal' && this.isOn(d)) s.cricket = this.mainGround;
      if (d.id === 'sportsday' && this.isOn(d)) s.sportsDay = true;
    }
    s.concertOn = (f) => f === this.mainGround && this.defs.some((d) => (d.id === 'techniche' || d.id === 'alcheringa') && this.isNear(d));
    return s;
  }
  cricketFinal(f) { return f === this.mainGround && this.defs.some((d) => d.id === 'cricketfinal' && this.isOn(d)); }

  /** extra context for interiors: the auditorium hosts the orientation, the Conference Centre the
   *  AI Confluence (it is held there) */
  interiorCtx(site, tname) {
    const on = (id) => this.defs.some((d) => d.id === id && this.isOn(d));
    if (tname === 'auditorium' && on('orientation')) return { audOcc: () => 0.95, eventAct: { id: 'orientation', label: "Attend the freshers' orientation" } };
    if (tname === 'conference' && on('aiconf')) return { confOcc: () => 0.95, eventAct: { id: 'keynote', label: 'Attend the AI Confluence keynote' } };
    return {};
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const g = this.g, h = g.clock.hour;
    this.t += dt;
    // the graffiti wall follows the event: the one running now, or the one about to start (within 3 hours)
    if (g.world.eventWall) { const cur = this.current?.(), nx = cur ? null : this.next?.(); g.world.eventWall.paint(cur ? cur.id : nx && nx.inHours < 3 ? nx.d.id : null); }
    if (this.stage) {
      const conc = this.defs.filter((d) => d.id === 'techniche' || d.id === 'alcheringa');
      let beat = 0; for (const e of this.live.values()) if (e.style) beat = Math.max(beat, e.beat || 0);
      this.stage.update(dt, conc.some((d) => this.isOn(d)), conc.some((d) => this.isNear(d)), beat, g.sky?.state?.night ?? 0);
    }
    const cam = g.camera.position;
    let bias = null;
    for (const d of this.defs) {
      const near = this.isNear(d);
      let e = this.live.get(d);
      if (near && !e) {
        const p = d.place();
        if (Math.hypot(p.x - cam.x, p.z - cam.z) < 900 || this.isOn(d)) { e = { d, p, agents: [], sets: [], t: 0, rnd: mulberry32(d.day * 99 + 7) }; this.live.set(d, e); d.build(e); this.addJoin(e); }
      }
      if (!near && e) this.teardown(e);
      if (e) { e.t += dt; e.update?.(dt, this.isOn(d)); for (const s of e.sets) s.update(this.t, g.sky.state.night); }
      if (this.isOn(d)) { const p = d.place(); bias = { x: p.x, z: p.z, from: d.from, to: d.to, weight: d.id === 'convocation' ? 0.2 : 0.35 }; }
      // announcements 30 minutes before
      const key = `${g.clock.day}:${d.id}`;
      if (g.clock.weekday === d.day && h > d.from - 0.5 && h < d.from && !this.announced.has(key)) {
        this.announced.add(key);
        g.ui.toast(`${d.name} starts at ${fmtHour(d.from)} · ${d.where}. Press Tab to open the planner.`, 'gold', 'Coming up');
      }
    }
    g.life.eventBias = bias;
  }

  teardown(e) {
    const g = this.g;
    for (const s of e.sets) { g.scene.remove(s.group); s.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); }); } }); }
    if (e.joinPt) g.interact.remove(e.joinPt);
    e.dispose?.();
    this.live.delete(e.d);
  }

  addJoin(e) {
    const d = e.d;
    if (!d.join) return;
    const p = e.joinAt || e.p;
    e.joinPt = this.g.interact.add({ x: p.x, z: p.z, r: e.joinR || 9, label: d.join.label, ok: () => (this.isOn(d) ? true : `starts at ${fmtHour(d.from)}`), run: () => this.g.acts.run(d.join.act, { ev: e }) });
  }

  draw(crowd) {
    if (this.g.interior?.active) return;
    const on = (e) => this.isOn(e.d);
    for (const e of this.live.values()) {
      const k = on(e) ? 1 : 0.25;
      e.agents.forEach((a, i) => { if (i % 4 < 4 * k || a.staff) crowd.push(a); });
    }
  }

  // ------------------------------------------------------------------ builders
  person(e, look, x, z, yaw, anim, extra = {}) {
    const a = { x, z, y: this.g.world.heightAt(x, z), yaw, anim, phase: e.rnd() * 6, speed: 0, extra: extra.extra ?? e.rnd(), look, ...extra };
    e.agents.push(a);
    return a;
  }
  newSet(e, x, z, yaw) { const s = new SetBuilder(this.g.world, x, z, yaw); e.sets.push(s); return s; }
  place(s) { this.g.scene.add(s.finish()); }
  free(x, z) { const W = this.g.world; return !W.buildingAt(x, z) && !W.waterAt(x, z) && W.insideCampus(x, z); }

  buildOrientation(e) {
    const { x, z, yaw } = e.p, r = e.rnd;
    const s = this.newSet(e, x, z, yaw);
    s.box(-7, 0, 0, 0.3, 4.5, 0.3, '#c89b3c'); s.box(7, 0, 0, 0.3, 4.5, 0.3, '#c89b3c');
    s.plane(0, 4.1, 0, 14, 1.8, 0, bannerTex('WELCOME FRESHERS 2026', 'Indian Institute of Technology Guwahati'));
    s.tent(-6, 6, 5, 3.5); s.tent(6, 6, 5, 3.5);
    s.table(-6, 6.5, 3.5, 0.8, '#1f4fa0'); s.table(6, 6.5, 3.5, 0.8, '#1f4fa0');
    s.plane(-6, 2.2, 4.3, 4, 0.6, 0, bannerTex('REGISTRATION A–M', '', { bg: '#1f4fa0', h: 128, w: 512 }));
    s.plane(6, 2.2, 4.3, 4, 0.6, 0, bannerTex('REGISTRATION N–Z', '', { bg: '#1f4fa0', h: 128, w: 512 }));
    this.place(s);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) { const p = s.at(side * 6 + (k - 0.5) * 1.4, 7.1); this.person(e, withProp(studentLook(r), OPT.LANYARD), p.x, p.z, yaw + Math.PI, AN.TALK, { staff: true }); }
      for (let k = 0; k < 9; k++) {
        const p = s.at(side * 6 + (r() - 0.5) * 0.4, 5.2 - k * 0.8);
        if (!this.free(p.x, p.z)) continue;
        const parent = k % 3 === 2;
        this.person(e, parent ? adultLook(r, 'parent') : withProp(studentLook(r), OPT.BACKPACK), p.x, p.z, yaw, parent ? AN.STAND : k % 2 ? AN.PHONE : AN.STAND);
      }
    }
    e.joinAt = s.at(0, 4);
  }

  buildClubFair(e) {
    const { x, z, yaw } = e.p, r = e.rnd;
    const s = this.newSet(e, x, z, yaw);
    CLUBS.forEach(([t, sub, col], i) => {
      const a = (i / (CLUBS.length - 1) - 0.5) * 2.4, R = 14;
      const bx = Math.sin(a) * R, bz = -Math.cos(a) * R + 6;
      s.booth(bx, bz, t, sub, col, 0);
      const p = s.at(bx, bz + 0.2);
      this.person(e, withProp(studentLook(r), OPT.LANYARD), p.x, p.z, yaw, AN.TALK, { staff: true });
    });
    s.plane(0, 5.4, -10, 12, 1.6, 0, bannerTex('CLUB FAIR', 'Find your people · Student Activity Centre'));
    s.stage(0, -2, 8, 4, { beams: 0, h: 0.6 });
    this.place(s);
    for (let k = 0; k < 6; k++) { const p = s.at(-3 + k * 1.2, -2); this.person(e, withProp(studentLook(r), OPT.LANYARD), p.x, p.z, yaw, AN.DANCE, { y: this.g.world.heightAt(p.x, p.z) + 0.6, extra: 0.1, staff: true }); }
    for (let k = 0; k < 70; k++) {
      const p = s.at((r() - 0.5) * 26, (r() - 0.3) * 18);
      if (!this.free(p.x, p.z)) continue;
      const L = studentLook(r);
      this.person(e, r() < 0.2 ? withProp(L, OPT.PHONE) : L, p.x, p.z, yaw + (r() - 0.5) * 3, [AN.TALK, AN.STAND, AN.CLAP, AN.PHONE][Math.floor(r() * 4)]);
    }
    e.update = (dt) => { if (Math.floor(e.t) % 2 === 0 && e.near) this.g.audio.beat?.(Math.floor(e.t * 2) % 4, 'dhol'); };
    e.joinAt = s.at(0, 4);
  }

  buildCricketFinal(e) {
    const f = this.mainGround, W = this.g.world;
    const R = Math.max(26, Math.min(f.len, f.wid) / 2 - 4);
    const p = W.fieldPoint(f, 0, R + 10);
    const s = this.newSet(e, p.x, p.z, Math.atan2(f.cx - p.x, f.cz - p.z) + Math.PI);
    const seats = s.bleachers(0, 0, 30, 5);
    s.plane(0, 5.2, -0.3, 22, 1.8, Math.PI, bannerTex('INTER-HOSTEL CRICKET FINAL', 'Spirit · IIT Guwahati'));
    this.place(s);
    const r = e.rnd;
    const hostels = Object.keys(HOSTEL_COLORS);
    seats.forEach((st, i) => {
      if (r() > 0.75) return;
      const q = s.at(st.lx, st.lz);
      const L = studentLook(r);
      const h = hostels[i % 2 ? 0 : 1];
      if (r() < 0.25) L.opts |= bit(OPT.FLAG);
      this.person(e, L, q.x, q.z, s.yaw + Math.PI, r() < 0.4 ? AN.CHEER : AN.SIT, { y: W.heightAt(q.x, q.z) + st.ly - 0.45, propColor: pal(HOSTEL_COLORS[h]) });
    });
    e.update = (dt, on) => {
      e.cm = (e.cm || 0) - dt;
      if (on && e.cm <= 0 && Math.hypot(this.g.camera.position.x - f.cx, this.g.camera.position.z - f.cz) < 200) {
        e.cm = 25 + r() * 20;
        const lines = ['What a delivery! Right on the top of off stump.', 'The crowd is on its feet here at the IITG Cricket Ground!', 'Brahmaputra need a big over now.', 'Lovely timing, that races away.'];
        this.g.audio.speak?.(lines[Math.floor(r() * lines.length)]);
      }
    };
  }

  buildAI(e) {
    const { x, z, yaw } = e.p, r = e.rnd;
    const s = this.newSet(e, x, z, yaw);
    AI_BOOTHS.forEach(([t, sub, col], i) => {
      const bx = (i - 2.5) * 4.2, bz = 3;
      s.booth(bx, bz, t, sub, col);
      const p = s.at(bx, bz + 0.1);
      this.person(e, withProp(adultLook(r, 'faculty'), OPT.LANYARD), p.x, p.z, yaw, AN.TALK, { staff: true });
    });
    s.box(-7, 0, -3, 0.3, 4.5, 0.3, '#1f4fa0'); s.box(7, 0, -3, 0.3, 4.5, 0.3, '#1f4fa0');
    s.plane(0, 4.1, -3, 14, 1.8, 0, bannerTex('AI CONFLUENCE 2026', 'Artificial Intelligence for the Northeast · IIT Guwahati', { bg: '#0b2e5c', accent: '#4fc3f7' }));
    // a friendly robot that trundles around
    const bot = new THREE.Group();
    const bm = new THREE.MeshStandardMaterial({ color: 0xe8ecef, metalness: 0.5, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.9, 16), bm); body.position.y = 0.6; bot.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), bm); head.position.y = 1.25; bot.add(head);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), new THREE.MeshBasicMaterial({ color: 0x4fc3f7 })); eye.position.set(0, 1.28, 0.26); bot.add(eye);
    s.group.add(bot);
    this.place(s);
    e.update = (dt) => { const t = e.t * 0.3; bot.position.set(Math.sin(t) * 5, 0, 7 + Math.cos(t * 1.3) * 2); bot.rotation.y = Math.cos(t) * 1.2; head.rotation.y = Math.sin(e.t * 1.7) * 0.6; };
    for (let k = 0; k < 60; k++) {
      const p = s.at((r() - 0.5) * 26, 5 + r() * 10);
      if (!this.free(p.x, p.z)) continue;
      this.person(e, r() < 0.3 ? withProp(studentLook(r), OPT.LANYARD) : studentLook(r), p.x, p.z, yaw + Math.PI + (r() - 0.5) * 1.5, [AN.TALK, AN.PHONE, AN.STAND, AN.CAMERA][Math.floor(r() * 4)], r() < 0.2 ? { opts: bit(OPT.CAMERA) } : {});
    }
    e.joinAt = s.at(0, 6);
  }

  buildConcert(e, title, sub, style) {
    const f = this.mainGround, W = this.g.world, r = e.rnd;
    const { x: px, z: pz, yaw, R } = concertSpot(W, f), p = { x: px, z: pz };   // the stage is at the +u end, facing -u (towards the centre)
    const s = this.newSet(e, p.x, p.z, yaw);
    const scr = ledScreen(title, sub);
    this.stage?.setScreen(scr.tex);                // the LED wall of the permanent stage shows the show
    this.place(s);
    e.scr = scr;
    // band and dancers on the stage
    const stageY = W.heightAt(p.x, p.z) + STAGE.h + 0.06;
    const band = style === 'band'
      ? [[-4, -1.5, AN.GUITAR, OPT.GUITAR], [4, -1.5, AN.GUITAR, OPT.GUITAR], [0, -3, AN.DRUM, OPT.DHOL], [0, 1.5, AN.TALK, 0]]
      : [[0, -1, AN.DANCE, 0], [-3, 0, AN.DANCE, 0], [3, 0, AN.DANCE, 0]];
    for (const [lx, lz, an, op] of band) { const q = s.at(lx, lz); this.person(e, op ? withProp(studentLook(r), op) : studentLook(r), q.x, q.z, yaw, an, { y: stageY, staff: true, extra: r() }); }
    // the crowd
    for (let k = 0; k < 320; k++) {
      const u = 9 + Math.sqrt(r()) * (R * 1.1), v = (r() - 0.5) * Math.min(f.wid, 60) * (0.4 + u / (R * 2.2));
      const q = W.fieldPoint(f, -R + 8 + u, v);
      if (!this.free(q.x, q.z)) continue;
      const L = studentLook(r);
      const anim = r() < 0.55 ? AN.DANCE : r() < 0.6 ? AN.CHEER : AN.CLAP;
      this.person(e, r() < 0.15 ? withProp(L, OPT.PHONE) : L, q.x, q.z, yaw + Math.PI + (r() - 0.5) * 0.4, anim, { extra: r() });
    }
    e.beatT = 0;
    e.update = (dt, on) => {
      scr.update(dt, e.beat || 0);
      e.beat = Math.max(0, (e.beat || 0) - dt * 3);
      const d = Math.hypot(this.g.camera.position.x - p.x, this.g.camera.position.z - p.z);
      e.near = d < 220;
      if (on && e.near && this.g.activity.cur?.name !== 'concert') {
        e.beatT -= dt;
        if (e.beatT <= 0) { e.beatT = 60 / 124; e.bi = ((e.bi || 0) + 1) % 4; this.g.audio.beat?.(e.bi, style === 'band' ? 'band' : 'band'); e.beat = 1; }
        e.cheerT = (e.cheerT || 0) - dt;
        if (e.cheerT <= 0) { e.cheerT = 8 + r() * 10; this.g.audio.cheer?.(Math.max(0.2, 1 - d / 220)); }
      }
    };
    e.joinAt = W.fieldPoint(f, -R + 22, 0);
    e.joinR = 14;
    e.style = style;
  }

  buildSportsDay(e) {
    const f = this.ath, W = this.g.world, r = e.rnd;
    const Rt = Math.min(36.5, f.wid / 2 - 9);
    const p = W.fieldPoint(f, 0, -(Rt + 14));
    const s = this.newSet(e, p.x, p.z, Math.atan2(f.cx - p.x, f.cz - p.z) + Math.PI);
    const seats = s.bleachers(0, 0, 40, 6, '#6f7378');
    s.plane(0, 5.8, -0.3, 26, 2, Math.PI, bannerTex('SPIRIT · SPORTS DAY', 'Inter-hostel athletics meet'));
    s.podium(24, 3);
    this.place(s);
    const hostels = Object.keys(HOSTEL_COLORS);
    seats.forEach((st, i) => {
      if (r() > 0.8) return;
      const q = s.at(st.lx, st.lz);
      const L = studentLook(r);
      if (r() < 0.3) L.opts |= bit(OPT.FLAG);
      this.person(e, L, q.x, q.z, s.yaw + Math.PI, r() < 0.35 ? AN.CHEER : AN.SIT, { y: W.heightAt(q.x, q.z) + st.ly - 0.45, propColor: pal(HOSTEL_COLORS[hostels[i % hostels.length]]) });
    });
    // six athletes run a 100 m heat every so often
    const lanes = [];
    for (let k = 0; k < 6; k++) lanes.push(this.person(e, kit(r, pal(Object.values(HOSTEL_COLORS)[k])), 0, 0, 0, AN.FIELD, { staff: true, lane: k, d: 0, v: 0, top: 8.5 + r() * 1.4 }));
    const starter = this.person(e, adultLook(r, 'faculty'), 0, 0, 0, AN.STAND, { staff: true });
    const at = (lane, d) => W.fieldPoint(f, -50 + d, -(Rt + 0.3 + lane * 1.22) + 0.6);
    e.heat = { t: -4, n: 1 };
    e.update = (dt, on) => {
      const h = e.heat;
      if (!on) return;
      h.t += dt;
      const fwd = Math.atan2(f.ax, f.az);
      const sp = at(-1.5, -3); starter.x = sp.x; starter.z = sp.z; starter.y = W.heightAt(sp.x, sp.z); starter.yaw = fwd + Math.PI / 2;
      for (const a of lanes) {
        if (h.t < 0) { a.d = 0; a.v = 0; a.anim = AN.FIELD; }
        else { a.v = Math.min(a.top, a.v + 3.8 * dt); a.d = Math.min(104, a.d + a.v * dt); a.anim = a.d < 104 ? AN.SPRINT : AN.STAND; a.phase += (a.v * dt / 2.3) * Math.PI * 2; }
        const q = at(a.lane, a.d); a.x = q.x; a.z = q.z; a.y = W.heightAt(q.x, q.z); a.yaw = fwd;
      }
      if (h.t > 0 && h.t - dt <= 0) { if (e.near) this.g.audio.whistle?.(); }
      if (h.t > 16) {
        h.t = -14; h.n++;
        if (e.near) { this.g.audio.speak?.(`Heat ${h.n}. Athletes, please take your marks.`); this.g.audio.cheer?.(0.8); }
        for (const a of lanes) a.top = 8.3 + r() * 1.6;
      }
      e.near = Math.hypot(this.g.camera.position.x - f.cx, this.g.camera.position.z - f.cz) < 200;
    };
    e.joinAt = W.fieldPoint(f, -50, -(Rt + 3));
    e.joinR = 10;
  }

  buildConvocation(e) {
    const f = this.soccer, W = this.g.world, r = e.rnd;
    const yaw = Math.atan2(f.ax, f.az);
    const c = W.fieldPoint(f, 0, 0);
    const s = this.newSet(e, c.x, c.z, yaw);
    s.pandal(0, 0, 30, 24);
    s.box(0, 0, -10, 14, 1.0, 3.5, '#6b2d2d');
    s.plane(0, 3.4, -11.6, 13, 1.8, 0, bannerTex('CONVOCATION 2026', 'Indian Institute of Technology Guwahati', { bg: '#1f2a44' }));
    const grads = s.chairsRows(-11, -4.5, 20, 5, 1.15, 1.1, '#f2f0ea', Math.PI);
    const guests = s.chairsRows(-11, 2.5, 20, 7, 1.15, 1.1, '#b3262f', Math.PI);
    this.place(s);
    const stageY = W.heightAt(c.x, c.z) + 1.0;
    for (let k = 0; k < 5; k++) { const q = s.at(-4 + k * 2, -10.8); const L = withProp(adultLook(r, 'faculty'), OPT.GOWN); this.person(e, L, q.x, q.z, yaw + Math.PI, k === 2 ? AN.LECTURE : AN.SIT, { y: stageY, staff: true }); }
    const gradP = [];
    for (const st of grads) { const q = s.at(st.lx, st.lz); gradP.push(this.person(e, withProp(studentLook(r), OPT.GOWN, OPT.MORTAR), q.x, q.z, yaw + Math.PI, AN.SIT, { staff: true, home: q, seatY: W.heightAt(q.x, q.z) })); }
    for (const st of guests) { if (r() > 0.8) continue; const q = s.at(st.lx, st.lz); this.person(e, adultLook(r, 'parent'), q.x, q.z, yaw + Math.PI, r() < 0.2 ? AN.CAMERA : AN.SIT, r() < 0.2 ? { opts: bit(OPT.CAMERA) } : {}); }
    // graduates walk across the stage one after another
    e.walk = { i: 0, t: 0 };
    e.update = (dt, on) => {
      if (!on) return;
      const w = e.walk; w.t += dt;
      const gp = gradP[w.i % gradP.length];
      const a = s.at(-7, -9.4), b = s.at(7, -9.4);
      const k = Math.min(1, w.t / 7);
      if (k < 1) { gp.x = a.x + (b.x - a.x) * k; gp.z = a.z + (b.z - a.z) * k; gp.y = stageY; gp.anim = Math.abs(k - 0.5) < 0.06 ? AN.STAND : AN.WALK; gp.yaw = Math.atan2(b.x - a.x, b.z - a.z); gp.phase += dt * 6; }
      else { gp.x = gp.home.x; gp.z = gp.home.z; gp.y = gp.seatY; gp.anim = AN.SIT; gp.yaw = yaw + Math.PI; w.i++; w.t = 0; if (e.near) this.g.audio.cheer?.(0.35); }
      e.near = Math.hypot(this.g.camera.position.x - c.x, this.g.camera.position.z - c.z) < 120;
    };
    e.joinAt = s.at(0, 10);
    e.joinR = 12;
  }

  // ------------------------------------------------------------------ activities for events
  registerActs() {
    const g = this.g;
    const talk = (title, slides, qs, onDone) => {
      let quiz = null;
      return {
        name: 'talk', hud: `${title} · Space to skip ahead`,
        start() {
          const I = g.interior;
          const seats = I?.active ? I.plan.seats.filter((s) => !s.npc) : [];
          const seat = seats[Math.floor(seats.length * 0.35)];
          if (seat) { const O = I.O; g.player.pos.set(O.x + seat.x, O.y + seat.y, O.z + seat.z); g.player.heading = seat.yaw; }
          g.ui.actPanel({ title, html: '<ul class="slide" id="slide"></ul>' });
          g.audio.speak?.(slides[0]);
        },
        update(dt) {
          g.player.avatar.root.position.copy(g.player.pos); g.player.avatar.root.rotation.set(0, g.player.heading, 0);
          g.player.avatar.animate({ type: quiz ? 'study' : 'sit' }, dt);
          if (quiz) { quiz.update(dt); return quiz.finished ? false : undefined; }
          const n = Math.min(slides.length, Math.floor(this.t / 4.5) + 1);
          const ul = document.getElementById('slide');
          if (ul && ul.children.length < n) { const line = slides[ul.children.length]; ul.insertAdjacentHTML('beforeend', `<li>${line}</li>`); if (ul.children.length > 1) g.audio.speak?.(line); }
          if (g.input.hit('Space')) this.t += 4.5;
          if (this.t > slides.length * 4.5 + 1.5) {
            quiz = new QuizLite(g, qs, title, onDone);
          }
        },
        camera(cam, dt) { return seatCam(g, cam, dt, { back: 1.4, up: 1.4, side: 0.3, look: 12 }); },
      };
    };
    g.acts.register('orientation', () => talk("Freshers' orientation", [
      'Welcome to IIT Guwahati, on the north bank of the Brahmaputra!',
      'Your hostel is your home: meet your mess committee and your seniors.',
      'Ragging is strictly prohibited. Anti-ragging helpline numbers are on every notice board.',
      'Classes are in the Lecture Hall Complex and the Academic Complex; the Central Library is open late.',
      'Join clubs at the Student Activity Centre. Alcheringa, Techniche and Spirit are our festivals.',
      'The campus is home to lakes, hills and a lot of wildlife. Please cycle carefully!',
    ], TRIVIA.slice(0, 6), (s) => { g.progress.unlock('orientation'); g.progress.addXP(40 + s * 5, 'orientation'); }));
    g.acts.register('keynote', () => talk('AI Confluence keynote', [
      'Artificial intelligence is changing how we study floods, farms and forests in the Northeast.',
      'Modern models learn from data: gradient descent, generalisation and careful evaluation.',
      'Large language models can read and write, but they must be used responsibly.',
      'Computer vision on drones maps flood plains of the Brahmaputra in hours, not weeks.',
      'Your ideas can become start-ups at the Technology Incubation Centre.',
    ], COURSES[0].qs.map((q) => q), (s) => { g.progress.addXP(35 + s * 8, 'AI Confluence'); g.progress.earn(40, 'quiz prize'); }));
    g.acts.register('orientationKit', () => ({
      name: 'kit', hud: 'Orientation desk',
      start() {
        const first = !g.progress.inv.has('kit');
        g.progress.inv.add('kit');
        g.ui.actPanel({ title: 'Orientation kit', html: first ? '<p>Here is your welcome kit: an IITG notebook, a campus map and a mess card. There is also a <b>₹200</b> welcome gift in the envelope!</p><p class="dim">Now head into the auditorium for the welcome talk.</p>' : '<p>You already collected your kit. The talk is in the auditorium!</p>', buttons: [{ label: '<kbd>Esc</kbd> Thanks!', key: 'Escape', onClick: () => (this.done = true) }] });
        if (first) { g.progress.earn(200, 'welcome kit'); g.progress.addXP(20, 'registered'); }
      },
      update() { if (this.done) return false; },
    }));
    g.acts.register('clubSignup', () => ({
      name: 'clubs', hud: 'Club Fair',
      start() {
        const btns = [
          { label: '<kbd>1</kbd> Dance Club · audition (rhythm)', key: 'Digit1', onClick: () => { this.done = true; setTimeout(() => g.acts.run('dance'), 30); } },
          { label: '<kbd>2</kbd> Music Club · jam (rhythm)', key: 'Digit2', onClick: () => { this.done = true; setTimeout(() => g.acts.run('music'), 30); } },
          { label: '<kbd>3</kbd> Coding Club · typing sprint', key: 'Digit3', onClick: () => { this.done = true; setTimeout(() => g.acts.run('typing'), 30); } },
          { label: '<kbd>4</kbd> Quiz Club · campus trivia', key: 'Digit4', onClick: () => { this.done = true; setTimeout(() => g.acts.run('trivia'), 30); } },
          { label: '<kbd>5</kbd> Photography Club · photo walk (press K)', key: 'Digit5', onClick: () => { this.done = true; g.progress.unlock('club'); g.ui.toast('Take 3 photos of campus landmarks with K.', 'info', 'Photography Club'); } },
          { label: '<kbd>Esc</kbd> Just looking', key: 'Escape', onClick: () => (this.done = true) },
        ];
        g.ui.actPanel({ title: 'Club Fair · sign up', html: '<p>Ten clubs are recruiting. Try out:</p>', buttons: btns });
      },
      update() { if (this.done) return false; },
    }));
    g.acts.register('trivia', () => {
      let quiz = null;
      return { name: 'trivia', hud: 'Quiz Club', start() { quiz = new QuizLite(g, TRIVIA, 'Quiz Club · campus trivia', (s) => { g.progress.unlock('club'); g.progress.addXP(15 + s * 6, 'quiz'); }); }, update(dt) { quiz.update(dt); if (quiz.finished) return false; } };
    });
    g.acts.register('aiDemo', () => {
      let quiz = null;
      return { name: 'ai', hud: 'AI Confluence demos', start() { quiz = new QuizLite(g, [...COURSES[0].qs, ...COURSES[1].qs], 'AI demo booth · can you beat the model?', (s) => { g.progress.addXP(20 + s * 6, 'AI demos'); if (s >= 4) g.progress.earn(60, 'demo prize'); }); }, update(dt) { quiz.update(dt); if (quiz.finished) return false; } };
    });
    g.acts.register('concertDance', (p) => rhythmActivity({
      name: 'concert', title: p.ev?.d.name || 'Pronite', style: 'band', len: 40,
      onStart: () => {
        const e = p.ev, f = this.mainGround;
        const q = g.world.fieldPoint(f, -Math.max(26, Math.min(f.len, f.wid) / 2 - 6) + 20, (Math.random() - 0.5) * 6);
        g.player.pos.set(q.x, g.world.heightAt(q.x, q.z), q.z);
        g.player.heading = Math.atan2(-f.ax, -f.az);
        g.player.avatar.root.position.copy(g.player.pos); g.player.avatar.root.rotation.set(0, g.player.heading, 0);
        void e;
      },
      onEnd: (gg, pct) => { gg.progress.unlock('concert'); gg.progress.eat(-5); if (pct > 80) gg.progress.addXP(20, 'crowd favourite'); },
    }));
    g.acts.register('sportsDayRace', () => (g.sports?.track ? sprintActivity(g.sports.track) : { update: () => false }));
    g.acts.register('convocation', (p) => ({
      name: 'convocation', hud: 'Convocation · Space when you hear your name', cancelable: true,
      start() {
        const e = p.ev;
        const q = e.joinAt;
        g.player.pos.set(q.x, g.world.heightAt(q.x, q.z), q.z);
        g.ui.actPanel({ title: 'Convocation 2026', html: '<p>“…and now, the graduating class of 2026. Graduates, please come up as your names are called.”</p><p class="dim">Watch the ceremony. At the end, caps go in the air!</p>' });
        g.audio.speak?.('Welcome to the convocation of the Indian Institute of Technology Guwahati.');
      },
      update(dt) {
        g.player.avatar.animate({ type: this.t > 22 ? 'cheer' : 'clap' }, dt);
        if (this.t > 26) { g.progress.unlock('graduate'); g.progress.addXP(40, 'convocation'); g.audio.cheer?.(1.2); return false; }
      },
      camera(cam, dt) { const e = p.ev, c = e.sets[0].at(0, -9); cam.position.lerp(new THREE.Vector3(e.joinAt.x, g.world.heightAt(e.joinAt.x, e.joinAt.z) + 2.6, e.joinAt.z), 1 - Math.exp(-3 * dt)); cam.lookAt(c.x, g.world.heightAt(c.x, c.z) + 1.5, c.z); return true; },
    }));
  }

  /** planner rows for the week */
  week() {
    const c = this.g.clock;
    return this.defs.map((d) => ({ d, dayName: DAYS[d.day], on: this.isOn(d), today: d.day === c.weekday })).sort((a, b) => ((a.d.day - c.weekday + 7) % 7) - ((b.d.day - c.weekday + 7) % 7) || a.d.from - b.d.from);
  }

  /** skip to an event and travel there */
  goTo(d) {
    const c = this.g.clock;
    if (!this.isOn(d)) c.skipTo(d.from + 0.02, d.day);
    const p = d.place();
    const W = this.g.world;
    let x = p.x, z = p.z;
    if (d.join) { const e = this.live.get(d); if (e?.joinAt) { x = e.joinAt.x; z = e.joinAt.z; } }
    void W;
    this.g.fastTravel(x, z, true);
  }
}

/** small quiz wrapper (multiple choice) */
class QuizLite {
  constructor(g, bank, title, onDone) {
    this.g = g; this.title = title; this.onDone = onDone;
    this.qs = bank.map((q) => shuffleQ(q)).sort(() => Math.random() - 0.5).slice(0, 4);
    this.i = 0; this.score = 0; this.show();
  }
  show() {
    const q = this.qs[this.i];
    if (!q) { this.finished = true; this.onDone(this.score, this.qs.length); this.g.ui.toast(`${this.score}/${this.qs.length} correct`, this.score >= 3 ? 'gold' : 'info', this.title); return; }
    this.lock = false;
    this.g.ui.actPanel({ title: this.title, html: `<p class="q-count">Question ${this.i + 1} of ${this.qs.length}</p><p class="q-text">${q.text}</p>`, buttons: q.opts.map((o, k) => ({ label: `<kbd>${k + 1}</kbd> ${o}`, key: `Digit${k + 1}`, onClick: () => this.answer(k) })) });
  }
  answer(k) {
    if (this.lock) return; this.lock = true;
    const q = this.qs[this.i];
    if (k === q.ans) this.score++;
    this.g.audio[k === q.ans ? 'collect' : 'bump']();
    this.g.ui.flashAnswer(k, q.ans);
    setTimeout(() => { this.i++; this.show(); }, 650);
  }
  update() {}
}

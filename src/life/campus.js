// Campus life: every student lives in a hostel and follows a daily routine (mess,
// classes, labs, library, sports, clubs, chai, shopping, strolls), shaped by the day of
// the week and the weather. People you can see are walking or cycling between places or
// hanging out at outdoor spots; the rest are inside buildings (interiors ask us who).
import { AN } from '../crowd/people.js';
import { studentLook, adultLook, staffLook, OPT, bit, C, pal } from '../crowd/looks.js';
import { mulberry32, clamp } from '../util.js';
import { FILTERS } from '../route.js';
import { GIRLS_HOSTELS } from './venues.js';

const BIKE_COLS = ['#1e1e1e', '#1e1e1e', '#1e1e1e', '#c62f2f', '#2f5fa8', '#2e7d4f', '#d7d7d7', '#e0a526', '#6b3d5e', '#7cb342', '#e2702f', '#d81b60', '#00897b', '#9aa3aa', '#4f93c9', '#5b2d7a'].map(pal);

// activity mix by hour (weekday); each entry: [activity, weight]
function weekdayMix(h) {
  if (h < 5) return [['sleep', 0.93], ['library', 0.03], ['hangout', 0.03], ['chai', 0.01]];
  if (h < 6) return [['sleep', 0.82], ['jog', 0.08], ['stroll', 0.1]];
  if (h < 7.5) return [['sleep', 0.42], ['jog', 0.12], ['stroll', 0.08], ['mess', 0.34], ['chai', 0.04], ['view', 0.015]];
  if (h < 8.65) return [['mess', 0.55], ['sleep', 0.18], ['class', 0.17], ['chai', 0.1]];
  if (h < 9.0) return [['class', 0.82], ['lab', 0.08], ['mess', 0.1]];
  if (h < 12.9) return [['class', 0.56], ['lab', 0.14], ['library', 0.1], ['hangout', 0.06], ['chai', 0.06], ['sleep', 0.05], ['shop', 0.03]];
  if (h < 14) return [['mess', 0.58], ['food', 0.14], ['chai', 0.1], ['hangout', 0.12], ['library', 0.06]];
  if (h < 17) return [['lab', 0.33], ['class', 0.24], ['library', 0.14], ['hangout', 0.1], ['sleep', 0.1], ['chai', 0.05], ['shop', 0.04]];
  if (h < 19) return [['sports', 0.34], ['club', 0.12], ['stroll', 0.1], ['chai', 0.12], ['hangout', 0.12], ['shop', 0.07], ['gym', 0.06], ['bench', 0.04], ['view', 0.03]];
  if (h < 19.75) return [['hangout', 0.24], ['chai', 0.18], ['club', 0.16], ['shop', 0.1], ['stroll', 0.1], ['library', 0.1], ['food', 0.12]];
  if (h < 21.75) return [['mess', 0.6], ['hangout', 0.1], ['library', 0.1], ['food', 0.1], ['chai', 0.06], ['circle', 0.06]];
  // late evening: most go back to their rooms; a few at the library, night canteens and chai
  return h < 23 ? [['library', 0.16], ['hangout', 0.16], ['sleep', 0.5], ['chai', 0.08], ['stroll', 0.04], ['circle', 0.06]] : [['library', 0.1], ['hangout', 0.12], ['sleep', 0.7], ['chai', 0.05], ['stroll', 0.01], ['circle', 0.02]];
}
function weekendMix(h) {
  if (h < 7) return [['sleep', 0.9], ['jog', 0.05], ['stroll', 0.05]];
  if (h < 10) return [['sleep', 0.45], ['mess', 0.35], ['sports', 0.1], ['stroll', 0.1]];
  if (h < 13) return [['sports', 0.22], ['shop', 0.14], ['hangout', 0.2], ['food', 0.12], ['stroll', 0.1], ['sleep', 0.14], ['bench', 0.08], ['view', 0.03]];
  if (h < 14.5) return [['mess', 0.5], ['food', 0.25], ['chai', 0.1], ['hangout', 0.15]];
  if (h < 17) return [['sleep', 0.25], ['hangout', 0.2], ['shop', 0.15], ['stroll', 0.12], ['food', 0.1], ['library', 0.08], ['bench', 0.1], ['view', 0.04]];
  if (h < 19.5) return [['sports', 0.3], ['stroll', 0.14], ['chai', 0.14], ['hangout', 0.14], ['shop', 0.1], ['bench', 0.08], ['view', 0.05], ['club', 0.05]];
  if (h < 22) return [['mess', 0.42], ['food', 0.2], ['hangout', 0.18], ['chai', 0.08], ['stroll', 0.04], ['circle', 0.08]];
  return h < 23 ? [['sleep', 0.58], ['hangout', 0.18], ['library', 0.08], ['chai', 0.08], ['circle', 0.08]] : [['sleep', 0.74], ['hangout', 0.14], ['library', 0.05], ['chai', 0.05], ['circle', 0.02]];
}
const OUTDOOR = new Set(['sports', 'stroll', 'jog', 'bench', 'view', 'chai', 'nightwalk', 'ride', 'circle']);
const COUPLE_ACTS = ['stroll', 'bench', 'chai', 'view', 'food', 'shop', 'hangout', 'nightwalk', 'ride'];
// wholesome evenings together: a walk holding hands, a ride, a quiet bench by the lake
const COUPLE_NIGHT = [['nightwalk', 0.3], ['bench', 0.28], ['ride', 0.22], ['view', 0.08], ['chai', 0.12]];
const isNight = (h) => h >= 19.4 || h < 0.8;

export class CampusLife {
  constructor(game, count) {
    this.g = game;
    const { venues } = game;
    this.v = venues;
    this.rnd = mulberry32(2718);
    this.people = [];
    this.travelers = new Set();
    this.inside = new Map();       // site -> Set(person)
    this.scan = 0;
    this.eventBias = null;         // events can pull people to a place
    const r = this.rnd;
    const hostels = venues.hostels.filter((h) => h.lm !== 'msh');     // Married Scholars: families (neighbourhood.js)
    const girls = hostels.filter((h) => GIRLS_HOSTELS.has(h.lm));
    const boys = hostels.filter((h) => !girls.includes(h));
    for (let i = 0; i < count; i++) {
      const female = r() < 0.34;
      const pool = female && girls.length ? girls : boys.length ? boys : hostels;
      const home = pool[Math.floor(r() * pool.length)];
      this.add({ look: studentLook(r, { female }), female, home, role: 'student', bike: r() < 0.68 ? BIKE_COLS[Math.floor(r() * BIKE_COLS.length)] : null, umbrella: r() < 0.72, jitter: (r() - 0.5) * 0.5 });
    }
    // couples: pairs of students who spend their free time together
    const studs = this.people.filter((p) => p.role === 'student');
    for (let k = 0; k < Math.floor(count * 0.035); k++) {
      const a = studs[Math.floor(r() * studs.length)], b = studs[Math.floor(r() * studs.length)];
      if (a === b || a.partner || b.partner || a.female === b.female) continue;
      a.partner = b; b.partner = a; a.lead = true;
    }
    // faculty and campus residents, guards, sweepers
    const homes = game.world.buildings.filter((b) => b.kind === 'residential' && b.area > 90 && !b.site);
    for (let i = 0; i < Math.floor(count * 0.06); i++) {
      const hb = homes[Math.floor(r() * homes.length)];
      if (hb) this.add({ look: adultLook(r, 'faculty'), role: 'faculty', homeB: hb, bike: r() < 0.3 ? C.black : null, umbrella: true, jitter: (r() - 0.5) * 0.4 });
    }
    for (let i = 0; i < Math.floor(count * 0.03); i++) {
      const hb = homes[Math.floor(r() * homes.length)];
      if (hb) this.add({ look: adultLook(r, r() < 0.6 ? 'parent' : 'guest'), role: 'resident', homeB: hb, umbrella: true, jitter: (r() - 0.5) * 0.6 });
    }
    for (let i = 0; i < Math.floor(count * 0.025); i++) {
      const hb = homes[Math.floor(r() * homes.length)];
      if (hb) { const L = studentLook(r); L.scale = 0.55 + r() * 0.12; L.opts &= ~(bit(OPT.BEARD) | bit(OPT.GLASSES)); this.add({ look: L, role: 'kid', homeB: hb, umbrella: false, jitter: 0 }); }
    }
    // who runs the place: the Director and Deans at the admin building, heads of department in the
    // academic blocks, mess workers in every hostel, office staff, lab technicians, librarians, doctors
    // and nurses, shopkeepers, sweepers and gardeners. Some live in the staff quarters, the rest come
    // in through the gates every morning.
    const W = game.world, k8 = count / 8000;
    const site = (id) => W.site(id);
    const facs = this.people.filter((p) => p.role === 'faculty');
    const admin = site('admin');
    const TITLES = ['Director', 'Dean of Academic Affairs', "Dean of Students' Affairs", 'Dean of Research and Development', 'Dean of Faculty Affairs', 'Dean of Infrastructure', 'Dean of Alumni Affairs'];
    if (admin) facs.slice(0, 7).forEach((f, i) => { f.title = TITLES[i]; f.work = admin; f.look = staffLook(r, i === 0 ? 'director' : 'dean'); });
    const depts = ['academic', 'core5', 'workshop', 'lhc', 'tic', 'conference'].map(site).filter(Boolean);
    facs.slice(7, 7 + depts.length * 2).forEach((f, i) => { f.title = 'Head of Department'; f.work = depts[i % depts.length]; f.look = staffLook(r, 'hod'); });
    const gatesIn = W.gates.filter((g) => !g.closed);
    const JOBS = [
      ['mess', 4, venues.hostels], ['office', 120, ['admin', 'academic', 'lhc', 'library', 'sac', 'newsac', 'hospital', 'guesthouse'].map(site)],
      ['lab', 80, ['academic', 'core5', 'workshop', 'tic'].map(site)], ['library', 20, [site('library')]], ['medical', 30, [site('hospital')]],
      ['shop', 40, ['shopping', 'foodcourt'].map(site)], ['sweeper', 100, W.sites], ['gardener', 40, W.sites],
    ];
    for (const [job, n, sites] of JOBS) {
      const list = sites.filter(Boolean);
      if (!list.length) continue;
      const total = job === 'mess' ? list.length * n : Math.round(n * k8);
      for (let i = 0; i < total; i++) {
        const work = job === 'mess' ? list[i % list.length] : list[Math.floor(r() * list.length)];
        const hb = r() < 0.55 ? homes[Math.floor(r() * homes.length)] : null;
        const gate = gatesIn[Math.floor(r() * gatesIn.length)];
        this.add({ look: staffLook(r, job), role: 'staff', job, work, homeB: hb, gate: hb ? null : gate, bike: r() < 0.35 ? C.black : null, umbrella: true, jitter: (r() - 0.5) * 0.4 });
      }
    }
    for (const s of venues.gates) this.add({ look: adultLook(r, 'guard'), role: 'guard', post: s, umbrella: false, jitter: 0 });
    for (const st of game.props.stalls || []) if (st.vendor) this.add({ look: adultLook(r, 'staff'), role: 'vendor', post: st.vendor, umbrella: false, jitter: 0 });
    for (const p of this.people) this.place(p, true);
  }

  /** how many people may be walking or cycling somewhere at once: busy by day, few late at night */
  tripCap() {
    const h = this.g.clock.hour;
    const byHour = h < 5 ? 8 : h < 6.5 ? 30 : h < 21.5 ? 120 : h < 22.5 ? 70 : h < 23.5 ? 35 : 18;
    return Math.round(byHour * Math.max(0.25, this.g.progress.settings.crowd ?? 1));
  }

  add(o) {
    const p = { id: this.people.length, x: 0, y: 0, z: 0, yaw: 0, anim: AN.STAND, phase: this.rnd() * 6, state: 'inside', until: 0, act: 'sleep', ...o };
    this.people.push(p);
    return p;
  }

  homeSite(p) { return p.home || (p.homeB ? { ex: 0, ez: 0 } : null); }

  // ------------------------------------------------------------ scheduling
  mix(p) {
    const clock = this.g.clock, h = clock.hour;
    if (p.role === 'faculty') {
      if (clock.weekend) return h > 7 && h < 19 ? [['stroll', 0.2], ['shop', 0.2], ['home', 0.6]] : [['home', 1]];
      return h > 8.8 && h < 17.3 ? [['work', 0.85], ['library', 0.05], ['chai', 0.1]] : h > 17.3 && h < 19 ? [['stroll', 0.3], ['home', 0.7]] : [['home', 1]];
    }
    if (p.role === 'staff') {
      const j = p.job, wk = clock.weekend;
      const on = j === 'mess' ? h > 5.3 && h < 22.3 && !(h > 15 && h < 16.4) : j === 'medical' ? h > 7.5 && h < 20.5 : j === 'shop' ? h > 8.5 && h < 21.5
        : j === 'sweeper' ? h > 6 && h < 14 : j === 'gardener' ? h > 7 && h < 16 && !wk : !wk && h > 8.8 && h < 17.4;
      if (!on) return [['home', 1]];
      return h > 12.9 && h < 13.6 && j !== 'mess' ? [['work', 0.55], ['chai', 0.3], ['food', 0.15]] : [['work', 1]];
    }
    if (p.role === 'resident') return (h > 6 && h < 8) || (h > 16.5 && h < 19) ? [['stroll', 0.55], ['bench', 0.15], ['shop', 0.1], ['home', 0.2]] : h > 10 && h < 13 ? [['shop', 0.3], ['home', 0.7]] : [['home', 1]];
    if (p.role === 'kid') return h > 16 && h < 18.5 ? [['park', 0.8], ['home', 0.2]] : [['home', 1]];
    if (p.partner && p.lead && isNight(h) && this.rnd() < 0.8) return COUPLE_NIGHT;
    const m = (clock.weekend ? weekendMix : weekdayMix)(h).slice();
    const ev = this.eventBias;
    if (ev && h >= ev.from && h < ev.to) m.push(['event', ev.weight]);
    return m;
  }

  choose(p) {
    let m = this.mix(p);
    const rain = this.g.weather.state.rain;
    if (rain > 0.3) m = m.map(([a, w]) => [a, OUTDOOR.has(a) ? w * 0.15 : w]);
    if (p.partner && !p.lead) return null;     // followers copy their partner
    if (p.partner && p.lead) {
      const free = m.filter(([a]) => COUPLE_ACTS.includes(a));
      const fw = free.reduce((s, [, w]) => s + w, 0);
      if (fw > 0.35 && this.rnd() < 0.8) m = free;
    }
    let s = m.reduce((a, [, w]) => a + w, 0), u = this.rnd() * s;
    for (const [a, w] of m) { u -= w; if (u <= 0) return a; }
    return m[0][0];
  }

  /** decide the next thing to do and send the person there */
  plan(p, first = false) {
    const clock = this.g.clock, now = clock.abs, rnd = this.rnd;
    if (p.role === 'guard' || p.role === 'vendor') {
      this.setAt(p, p.post, now + 6);
      return;
    }
    if (p.partner && !p.lead) return; // planned by the leader
    const act = this.choose(p);
    const slot = this.slotEnd(clock.hour);
    const dur = { chai: 0.3, stroll: 0.6, bench: 0.6, view: 0.8, shop: 0.6, gym: 1, food: 0.7, park: 1.2, hangout: 0.8, nightwalk: 0.7, ride: 0.6, circle: 1.1 }[act];
    let until = now + Math.max(0.2, Math.min(dur ?? slot, slot) + p.jitter * 0.3 + rnd() * 0.25);
    const dest = this.destination(p, act);
    p.act = act;
    p.until = until;
    if (!first && p.partner && p.lead && isNight(clock.hour) && this.pickup(p, dest, until)) return;
    this.go(p, dest, first);
    if (p.partner && p.lead) {
      const q = p.partner;
      q.act = act; q.until = until;
      // same building: go separately; outdoors: walk together and take the paired seat
      if (dest.kind === 'inside' || dest.kind === 'insideB' || dest.kind === 'join') this.go(q, dest, first);
      else if (!first && p.state === 'travel' && p.path) this.go(q, dest, first, true);
    }
  }

  /** he walks to her hostel gate, waits on his phone; she comes out, a quick hug, and off they go */
  pickup(p, dest, until) {
    const girl = p.female ? p : p.partner, boy = girl === p ? p.partner : p;
    const s = girl.home;
    if (!s || !GIRLS_HOSTELS.has(s.lm) || girl.state !== 'inside' || girl.site !== s || boy.home === s) return false;
    if (dest.kind !== 'loop' && dest.kind !== 'spot') return false;
    const tx = -s.nz, tz = s.nx, side = this.rnd() < 0.5 ? 1 : -1;
    const x = s.ex + s.nx * 9 + tx * 4 * side, z = s.ez + s.nz * 9 + tz * 4 * side;
    if (this.g.world.buildingAt(x, z) || this.g.world.waterAt(x, z)) return false;
    boy.pick = { girl, dest, until, x, z, yaw: Math.atan2(s.ex - x, s.ez - z) };
    boy.act = girl.act = p.act; boy.until = girl.until = until;
    if (dest.kind === 'spot') dest.spot.taken = null;     // taken again when they set off
    this.go(boy, { kind: 'wait', x, z });
    return true;
  }

  slotEnd(h) {
    const ends = [5, 6, 7.5, 8.65, 9, 12.9, 14, 17, 19, 19.75, 21.75, 24];
    for (const e of ends) if (h < e - 0.02) return e - h;
    return 24 - h + 5;
  }

  pickSite(list) { return list.length ? list[Math.floor(this.rnd() * list.length)] : null; }
  weighted(w) {
    let u = this.rnd() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const [id, k] of Object.entries(w)) { u -= k; if (u <= 0) return this.g.world.site(id) || this.pickSite(this.v.academic); }
    return this.pickSite(this.v.academic);
  }

  /** join a circle where friends are already sitting, or start a new one */
  groupSpot(list) {
    if (!list.length) return null;
    const busy = new Set();
    for (const s of list) if (s.taken) busy.add(s.group);
    const open = list.filter((s) => !s.taken && busy.has(s.group));
    if (open.length && this.rnd() < 0.8) return { spot: open[Math.floor(this.rnd() * open.length)] };
    return this.freeSpot(list);
  }

  freeSpot(list, pairs = false) {
    if (!list || !list.length) return null;
    for (let t = 0; t < 12; t++) {
      const s = list[Math.floor(this.rnd() * list.length)];
      if (s.taken) continue;
      if (pairs) {
        const mate = list.find((o) => o !== s && o.pair && o.pair === s.pair && !o.taken);
        if (!mate) continue;
        return { spot: s, pairSpot: mate };
      }
      return { spot: s };
    }
    return null;
  }

  destination(p, act) {
    const V = this.v, r = this.rnd, home = p.home;
    const couple = !!p.partner;
    const inside = (site) => (site ? { kind: 'inside', site } : null);
    let d = null;
    switch (act) {
      case 'sleep': case 'mess': d = inside(home); if (act === 'mess' && home && r() < 0.35) { const f = this.freeSpot(V.queue.get(home)); if (f) d = { kind: 'spot', spot: f.spot, then: { kind: 'inside', site: home } }; } break;
      case 'class': d = inside(this.weighted({ lhc: 0.42, academic: 0.4, core5: 0.12, conference: 0.03, tic: 0.03 })); break;
      case 'lab': d = inside(this.weighted({ academic: 0.45, core5: 0.2, workshop: 0.25, tic: 0.1 })); break;
      case 'work': d = inside(p.work || this.pickSite([...V.academic, V.library].filter(Boolean))); break;
      case 'library': d = inside(V.library); break;
      case 'club': { const s = this.pickSite(V.clubs); const f = s && r() < 0.35 ? this.freeSpot(V.plaza.get(s)) : null; d = f ? { kind: 'spot', spot: f.spot } : inside(s); break; }
      case 'food': d = inside(this.pickSite(V.food)); if (r() < 0.4) { const f = this.freeSpot(V.chai, couple); if (f) d = { kind: 'spot', ...f }; } break;
      case 'shop': d = inside(this.g.world.site('shopping') || this.pickSite(V.food)); break;
      case 'gym': d = inside(V.gym); break;
      case 'chai': { const f = this.freeSpot(V.chai, couple); if (f) d = { kind: 'spot', ...f }; break; }
      case 'bench': {
        // couples out at night like the quiet, unlit benches by the lake
        const night = couple && isNight(this.g.clock.hour);
        const f = (night && this.freeSpot(V.benches.filter((b) => b.lake && b.dim), true)) || this.freeSpot(V.benches.filter((b) => b.lake), true) || this.freeSpot(V.benches);
        if (f) d = { kind: 'spot', ...f };
        break;
      }
      case 'view': { const f = this.freeSpot(V.view.length ? V.view : V.benches, true); if (f) d = { kind: 'spot', ...f }; break; }
      case 'hangout': {
        if (couple) { const f = this.freeSpot(V.benches, true); if (f) { d = { kind: 'spot', ...f }; break; } }
        const lawn = home && V.lawn.get(home), plaza = home && V.plaza.get(home);
        const f = this.freeSpot(r() < 0.5 && lawn ? lawn : plaza) || this.freeSpot(plaza);
        d = f ? { kind: 'spot', spot: f.spot } : inside(home);
        break;
      }
      case 'stroll': case 'jog': {
        // most walks are along the roads (to the market, a canteen, a friend's hostel); a few by the lake
        const loop = r() < (act === 'jog' ? 0.5 : 0.25) ? V.lakeLoops[Math.floor(r() * V.lakeLoops.length)] : null;
        if (loop) d = { kind: 'loop', loop, run: act === 'jog' };
        else d = inside(this.weighted({ shopping: 0.3, foodcourt: 0.25, sac: 0.15, library: 0.1, [p.home?.lm || 'sac']: 0.2 }));
        break;
      }
      case 'sports': {
        const f = this.g.sports?.joinPoint(p, r);
        d = f ? { kind: 'join', x: f.x, z: f.z, field: f.field } : inside(home);
        break;
      }
      case 'event': { const e = this.eventBias; d = e ? { kind: 'join', x: e.x, z: e.z } : inside(home); break; }
      case 'home': d = p.homeB ? { kind: 'insideB', b: p.homeB } : p.gate ? { kind: 'away', x: p.gate.wx, z: p.gate.wz } : null; break;
      case 'nightwalk': case 'ride': {
        const loop = V.lakeLoops[Math.floor(r() * V.lakeLoops.length)];
        if (loop) d = { kind: 'loop', loop, ride: act === 'ride' ? (couple ? (r() < 0.4 ? 'pillion' : 'pair') : 'solo') : null };
        break;
      }
      case 'circle': { const f = this.groupSpot(V.circles || []); if (f) d = { kind: 'spot', ...f }; break; }
      case 'park': { const pk = this.g.world.landmark('childpark'); d = pk ? { kind: 'join', x: pk.wx, z: pk.wz, park: true } : { kind: 'insideB', b: p.homeB }; break; }
    }
    return d || (home ? inside(home) : p.homeB ? { kind: 'insideB', b: p.homeB } : p.gate ? { kind: 'away', x: p.gate.wx, z: p.gate.wz } : inside(p.work));
  }

  // ------------------------------------------------------------ movement
  setInside(p, site) {
    this.leaveSpot(p);
    p.state = 'inside';
    p.site = site;
    if (site) { if (!this.inside.has(site)) this.inside.set(site, new Set()); this.inside.get(site).add(p); }
    this.travelers.delete(p);
  }
  leaveInside(p) { if (p.state === 'inside' && p.site && this.inside.has(p.site)) this.inside.get(p.site).delete(p); }
  leaveSpot(p) { if (p.spot) { p.spot.taken = null; p.spot = null; } }
  setAt(p, spot, until) {
    this.leaveInside(p);
    p.state = 'at'; p.spot = spot; spot.taken = p;
    p.x = spot.x; p.z = spot.z; p.yaw = spot.yaw; p.anim = spot.anim;
    p.y = this.g.world.heightAt(p.x, p.z);
    if (until) p.until = Math.max(p.until, until);
    this.travelers.delete(p);
  }

  /** where a person physically is right now (for starting a trip) */
  origin(p) {
    if (p.state === 'inside' && p.site) return { x: p.site.ex, z: p.site.ez, node: p.site.node };
    if (p.state === 'inside' && p.homeB) { const e = this.g.world.entranceOf(p.homeB, this.g.graph); return { x: e.x, z: e.z, node: e.node }; }
    return { x: p.x, z: p.z };
  }

  go(p, dest, first = false, follow = false, midway = false) {
    const W = this.g.world, graph = this.g.graph;
    if (dest.kind === 'inside' && p.state === 'inside' && p.site === dest.site) return;
    if (dest.kind === 'insideB' && p.state === 'inside' && p.homeIn) return;
    if (dest.kind === 'away' && p.state === 'inside' && p.away) return;
    if (dest.kind !== 'away') p.away = false;
    // first placement: put people straight where they should be; a small share are caught mid-trip
    if (first) {
      const trip = (dest.kind === 'inside' && dest.site !== p.home && p.home) || dest.kind === 'spot';
      if (trip && p.home && this.rnd() < 0.12 && !follow) {
        p.state = 'inside'; p.site = p.home;
        this.go(p, dest, false, false, true);
        return;
      }
      this.arrive(p, dest, true);
      return;
    }
    // Keep the full resident population, but stagger departures instead of putting
    // thousands on the same footpaths at each timetable change.
    const tripBudget = this.tripCap();
    if (!follow && p.state !== 'travel' && this.travelers.size >= tripBudget) {
      p.until = this.g.clock.abs + 0.025 + this.rnd() * 0.06;
      return;
    }
    const from = this.origin(p);
    let to;
    if (dest.kind === 'inside') to = { x: dest.site.ex, z: dest.site.ez, node: dest.site.node };
    else if (dest.kind === 'insideB') { const e = W.entranceOf(dest.b, graph); to = { x: e.x, z: e.z, node: e.node }; }
    else if (dest.kind === 'spot') { to = { x: dest.spot.x, z: dest.spot.z }; if (!follow) dest.spot.taken = p; }
    else if (dest.kind === 'loop') { const q = dest.loop.pts[Math.floor(this.rnd() * dest.loop.pts.length)]; to = { x: q[0], z: q[1] }; }
    else to = { x: dest.x, z: dest.z };
    const a = from.node ?? graph.nearestNode(from.x, from.z), b = to.node ?? graph.nearestNode(to.x, to.z);
    const route = a >= 0 && b >= 0 ? graph.route(a, b) : null;
    const mk = (rt) => { const pts = [[from.x, from.z]]; if (rt) for (const q of rt) pts.push(q); pts.push([to.x, to.z]); return compact(pts); };
    let path = mk(route);
    const rain = this.g.weather.state.rain;
    let bike = !follow && p.bike != null && path.len > 380 && dest.kind !== 'loop' && rain < 0.5 && p.role !== 'kid';
    // cycles keep off steps and arcades
    if (bike) { const rb = graph.route(a, b, FILTERS.bike, 'b'); if (rb) path = mk(rb); else bike = false; }
    const L = path.len;
    const brisk = this.g.clock.k >= 20 ? 1.35 : 1;
    const speed = brisk * (bike ? 3.8 + this.rnd() * 1.8 : (dest.run ? 2.6 : (rain > 0.4 && !p.umbrella ? 2.4 : 1.15 + this.rnd() * 0.35)) * (p.role === 'kid' ? 0.9 : 1));
    this.leaveInside(p);
    this.leaveSpot(p);
    p.homeIn = false;
    if (dest.kind === 'spot' && !follow) dest.spot.taken = p;
    p.state = 'travel'; p.dest = dest; p.path = path; p.mode = bike ? 'bike' : 'walk'; p.speed = speed; p.follow = follow;
    // squeeze long trips into accelerated campus time: start part-way along the route
    const k = this.g.clock.k || 1;
    // people may arrive a little late: trips stay visible for up to 4 real minutes
    const availReal = clamp(((p.until - this.g.clock.abs) * 3600) / k, 70, 240);
    let s0 = Math.max(0, L - speed * availReal * 0.8);
    if (midway) s0 = Math.max(s0, this.rnd() * L * 0.9);
    else if (s0 > 0) s0 = this.hideSpawn(path, s0);
    p.s = s0;
    p.wheel = 0;
    p.lane = (p.lane ?? (this.rnd() - 0.5));
    p.offC = null;
    this.travelers.add(p);
    if (follow && p.partner) { p.path = p.partner.path; p.s = p.partner.s; p.speed = p.partner.speed; p.mode = p.partner.mode; }
  }

  /** sideways offset (left of the path) for this person on this stretch of road */
  laneOff(p, tmp) {
    const hw = tmp.hw || 0, u = (p.lane ?? 0) + 0.5;
    if (p.mode === 'bike') return hw >= 2.8 ? hw - 0.38 - u * 0.3 : hw > 0 ? hw - 0.32 - u * 0.2 : (u - 0.5) * 0.6;
    if (!hw) return (u - 0.5) * 0.9;
    const off = hw + 0.55 + u * 0.8;
    const W = this.g.world, x = tmp.x + tmp.tz * off, z = tmp.z - tmp.tx * off;
    return W.buildingAt(x, z) || W.waterAt(x, z) ? hw - 0.35 : off;
  }

  /** avoid people popping into existence right in front of the camera */
  hideSpawn(path, s0) {
    const cam = this.g.camera.position;
    const tmp = {};
    for (let t = 0; t < 6; t++) {
      sampleAt(path, s0, tmp);
      if (Math.hypot(tmp.x - cam.x, tmp.z - cam.z) > 70) return s0;
      s0 = Math.min(path.len - 1, s0 + 30);
    }
    return s0;
  }

  arrive(p, dest, first = false) {
    const W = this.g.world;
    this.travelers.delete(p);
    switch (dest.kind) {
      case 'inside': this.setInside(p, dest.site); break;
      case 'insideB': this.leaveSpot(p); this.leaveInside(p); p.state = 'inside'; p.site = null; p.homeIn = true; break;
      case 'spot':
        if (first && dest.spot.taken && dest.spot.taken !== p) { this.setInside(p, p.home); break; }
        this.setAt(p, dest.spot);
        if (dest.then) { p.then = dest.then; p.until = Math.min(p.until, this.g.clock.abs + 0.12 + this.rnd() * 0.2); }
        if (dest.pairSpot && p.partner) {
          const q = p.partner;
          if (q.state === 'travel' && q.follow) this.setAt(q, dest.pairSpot); else if (first) this.setAt(q, dest.pairSpot);
          // at night, a hug before they sit down
          if (!first && isNight(this.g.clock.hour) && q.spot === dest.pairSpot && this.rnd() < 0.4) {
            const a = dest.spot, b = dest.pairSpot, mx = (a.x + b.x) / 2 + Math.sin(a.yaw) * 0.8, mz = (a.z + b.z) / 2 + Math.cos(a.yaw) * 0.8;
            const yaw = Math.atan2(b.x - a.x, b.z - a.z), T = this.g.time + 4 + this.rnd() * 3;
            p.hugAt = { x: mx - Math.sin(yaw) * 0.2, z: mz - Math.cos(yaw) * 0.2, yaw }; q.hugAt = { x: mx + Math.sin(yaw) * 0.2, z: mz + Math.cos(yaw) * 0.2, yaw: yaw + Math.PI };
            p.hugUntil = q.hugUntil = T;
          }
        }
        break;
      case 'loop': {
        if (this.travelers.size >= this.tripCap()) {
          this.setInside(p, p.home);
          p.until = this.g.clock.abs + 0.04 + this.rnd() * 0.06;
          break;
        }
        // keep walking around the lake until the activity ends
        const pts = dest.loop.pts;
        let i = 0, bd = Infinity;
        pts.forEach((q, k) => { const d = Math.hypot(q[0] - p.x, q[1] - p.z); if (d < bd) { bd = d; i = k; } });
        const dir = this.rnd() < 0.5 ? 1 : -1;
        const seq = [];
        for (let k = 0; k < pts.length; k++) seq.push(pts[(i + k * dir + pts.length * 2) % pts.length]);
        seq.push(seq[0]);
        const ride = dest.ride && (p.bike != null || (p.partner && p.partner.bike != null));
        if (ride && p.bike == null) p.bike = p.partner.bike;
        p.state = 'travel'; p.dest = { kind: 'loopWalk', run: dest.run }; p.path = compact(seq); p.s = first ? this.rnd() * p.path.len : 0;
        p.speed = ride ? 3.0 + this.rnd() * 0.8 : dest.run ? 2.5 + this.rnd() * 0.6 : 1.1 + this.rnd() * 0.3; p.mode = ride ? 'bike' : 'walk';
        this.travelers.add(p);
        if (p.partner && p.lead) {
          const q = p.partner;
          q.state = 'travel'; q.dest = p.dest; q.path = p.path; q.s = p.s; q.speed = p.speed; q.mode = p.mode; q.follow = true; this.travelers.add(q);
          q.pillion = ride && dest.ride === 'pillion';
          if (ride && !q.pillion && q.bike == null) q.bike = BIKE_COLS[(p.id + 3) % BIKE_COLS.length];
        }
        break;
      }
      case 'join': this.leaveSpot(p); this.leaveInside(p); p.state = 'joined'; p.x = dest.x; p.z = dest.z; this.travelers.delete(p); break;
      case 'away': this.leaveSpot(p); this.leaveInside(p); p.state = 'inside'; p.site = null; p.away = true; p.x = dest.x; p.z = dest.z; this.travelers.delete(p); break;
      case 'wait': {
        // waiting at her hostel gate; she comes out to meet him
        this.leaveSpot(p); p.state = 'at'; p.x = dest.x; p.z = dest.z; p.y = W.heightAt(p.x, p.z);
        const pk = p.pick;
        if (!pk) break;
        p.yaw = pk.yaw; p.anim = AN.PHONE;
        p.until = this.g.clock.abs + 0.25;
        this.go(pk.girl, { kind: 'meet', x: dest.x + Math.sin(pk.yaw) * 0.9, z: dest.z + Math.cos(pk.yaw) * 0.9, boy: p });
        break;
      }
      case 'meet': {
        const boy = dest.boy, pk = boy?.pick;
        if (!pk || boy.state !== 'at') { this.setInside(p, p.home); break; }
        boy.pick = null;
        // a quick hug, then they set off together
        const hugT = this.rnd() < 0.6 ? 3.5 + this.rnd() * 2 : 0;
        const mx = (boy.x + p.x) / 2, mz = (boy.z + p.z) / 2, yaw = Math.atan2(p.x - boy.x, p.z - boy.z);
        boy.hugAt = { x: mx - Math.sin(yaw) * 0.2, z: mz - Math.cos(yaw) * 0.2, yaw };
        p.hugAt = { x: mx + Math.sin(yaw) * 0.2, z: mz + Math.cos(yaw) * 0.2, yaw: yaw + Math.PI };
        boy.hugUntil = p.hugUntil = this.g.time + hugT;
        const lead = boy.lead ? boy : p, other = lead === boy ? p : boy;
        lead.until = other.until = pk.until;
        this.travelers.delete(p); p.state = 'at'; p.x = p.hugAt.x; p.z = p.hugAt.z;
        this.go(lead, pk.dest);
        this.go(other, pk.dest, false, true);
        lead.pauseT = other.pauseT = hugT + 0.3;
        break;
      }
      default: this.setInside(p, p.home);
    }
    if (first && dest.kind !== 'spot' && dest.kind !== 'loop' && p.state !== 'inside' && p.state !== 'joined') this.setInside(p, p.home);
  }

  place(p, first) {
    this.plan(p, first);
  }

  /** time jumped: put everybody where they should be right now */
  reset() {
    this.travelers.clear();
    this.inside.clear();
    for (const p of this.people) { if (p.spot) p.spot.taken = null; p.spot = null; p.state = 'inside'; p.site = null; p.until = 0; p.then = null; }
    for (const p of this.people) if (!p.partner || p.lead) this.place(p, true);
    for (const p of this.people) if (p.partner && !p.lead && p.until === 0) { p.until = p.partner.until; if (p.state === 'inside' && !p.site) this.setInside(p, p.home); }
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const clock = this.g.clock, now = clock.abs;
    const tmp = {}, dd = {}, avoid = this.g.avoid;
    // travellers move every frame
    for (const p of this.travelers) {
      if (p.pauseT > 0) { p.pauseT -= dt; continue; }
      if (p.follow && p.partner && p.partner.state === 'travel' && p.partner.path === p.path) {
        p.s = p.partner.s; p.speed = p.partner.speed; p.mode = p.partner.mode;
      } else p.s += p.speed * dt;
      const path = p.path;
      if (p.s >= path.len) {
        if (p.dest.kind === 'loopWalk') {
          if (now >= p.until && !p.follow) { this.travelers.delete(p); this.plan(p); } else p.s -= path.len;
          continue;
        }
        if (!p.follow) this.arrive(p, p.dest);
        else if (p.partner.state !== 'travel') { const d = p.partner.state === 'inside' ? { kind: 'inside', site: p.partner.site || p.home } : { kind: 'join', x: p.partner.x, z: p.partner.z }; this.arrive(p, d); }
        continue;
      }
      sampleAt(path, p.s, tmp);
      // keep left: cyclists ride along the left edge of the road, walkers use the verge
      // beside it (or the middle of a footpath); vehicles get the lane (see avoid.js)
      const off = this.laneOff(p, tmp);
      p.offC = p.offC == null ? off : moveTo(p.offC, off, (p.mode === 'bike' ? 1.8 : 1.1) * dt);
      let o = p.offC;
      if (p.partner && p.partner.state === 'travel' && p.partner.path === path) o += (p.lead ? 1 : -1) * (p.mode === 'bike' ? (p.pillion || p.partner.pillion ? 0 : 0.62) : 0.28);
      const r = p.mode === 'bike' ? 0.4 : 0.3;
      avoid.dodge(p, tmp.x + tmp.tz * o, tmp.z - tmp.tx * o, r, dt, dd);
      p.x = dd.x; p.z = dd.z;
      avoid.mark(p.x, p.z);
      p.yaw = Math.atan2(tmp.tx, tmp.tz);
      p.y = this.g.world.heightAt(p.x, p.z);
      if (p.mode === 'bike' && p.pillion && p.follow) { p.anim = AN.PILLION; p.x = p.partner.x; p.z = p.partner.z; p.yaw = p.partner.yaw; p.y = p.partner.y; }
      else if (p.mode === 'bike') { p.wheel += (p.speed * dt) / 0.34; p.anim = AN.BIKE; p.phase = p.wheel / 2.3; }
      else {
        p.phase += (p.speed * dt / (p.speed > 2 ? 2.3 : 1.35)) * Math.PI * 2;
        p.anim = p.partner && p.partner.path === path && p.partner.state === 'travel' && p.mode === 'walk' ? AN.HOLD : p.speed > 2 ? AN.RUN : AN.WALK;
      }
    }
    // everyone else is checked a slice at a time
    const n = this.people.length, per = Math.max(20, Math.ceil(n / 20));
    for (let k = 0; k < per; k++) {
      const p = this.people[this.scan];
      this.scan = (this.scan + 1) % n;
      if (p.state === 'travel') continue;
      if (now >= p.until) {
        if (p.then) { const t = p.then; p.then = null; p.until = now + Math.max(0.3, this.slotEnd(clock.hour)); this.go(p, t); continue; }
        if (p.partner && !p.lead && p.partner.state === 'travel') continue;
        this.plan(p);
      }
    }
  }

  /** push visible people (and their bicycles) to the renderers */
  draw(crowd, bikes) {
    const rain = this.g.weather.state.rain > 0.2 && !this.g.weather.inside;
    const now = this.g.time;
    for (const p of this.people) {
      if (p.state !== 'travel' && p.state !== 'at') continue;
      let opts = p.look.opts;
      if (rain && p.umbrella && p.anim !== AN.BIKE && !(p.spot && p.spot.seat)) opts |= bit(OPT.UMBRELLA);
      if (p.spot && p.spot.cup) opts |= bit(OPT.CUP);
      if (p.spot && p.spot.group && p.anim === AN.PHONE) opts |= bit(OPT.PHONE);
      if (p.role === 'guard' && this.g.sky.state.night > 0.5) opts |= 0;
      const e = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, anim: p.anim, phase: p.phase, speed: p.speed || 0, extra: p.anim === AN.HOLD ? (p.lead ? 1 : -1) : p.anim === AN.SIT && p.spot && p.spot.clap ? 1 : 0, look: p.look, opts };
      if (p.talkT > 0) { e.anim = AN.TALK; e.yaw = p.talkYaw; }
      if (p.hugUntil > now && p.hugAt) { e.x = p.hugAt.x; e.z = p.hugAt.z; e.yaw = p.hugAt.yaw; e.anim = AN.HUG; e.extra = p.female ? -1 : 1; e.opts &= ~bit(OPT.UMBRELLA); }
      else if (p.state === 'at' && p.spot) {
        // on a bench next to someone: turn to them and chat; in a circle: someone has a guitar
        if (p.anim === AN.SIT && p.spot.mate && p.spot.mate.taken) { const m = p.spot.mate; e.anim = AN.SITCHAT; e.extra = ((m.x - p.x) * Math.cos(p.yaw) - (m.z - p.z) * Math.sin(p.yaw)) > 0 ? 0.8 : -0.8; }
        if (p.spot.guitar) { e.anim = AN.GUITAR; e.opts |= bit(OPT.GUITAR); }
      }
      if (crowd.push(e) && p.anim === AN.BIKE && p.state === 'travel' && e.anim === AN.BIKE) {
        bikes.push({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, wheel: p.wheel, crank: p.phase, lean: 0, color: p.bike });
      }
    }
  }

  nearestPerson(x, z, r = 2.5) {
    let best = null, bd = r;
    for (const p of this.people) {
      if (p.state !== 'travel' && p.state !== 'at') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  insideOf(site) { return this.inside.get(site) || new Set(); }
  stats() {
    let out = 0, trav = 0, ins = 0;
    for (const p of this.people) { if (p.state === 'at') out++; else if (p.state === 'travel') trav++; else ins++; }
    return { out, trav, ins, total: this.people.length };
  }
}

// ------------------------------------------------------------ path helpers
export function compact(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const a = out[out.length - 1]; if (Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]) > 0.4) out.push(pts[i]); }
  // drop a first road point that doubles back
  if (out.length > 3) {
    const [x0, z0] = out[0], [x1, z1] = out[1], [x2, z2] = out[2];
    if ((x1 - x0) * (x2 - x1) + (z1 - z0) * (z2 - z1) < 0) out.splice(1, 1);
  }
  const cum = [0];
  for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { pts: out, cum, len: cum[cum.length - 1] || 0.001, k: 0 };
}

export function sampleAt(path, s, out) {
  const { pts, cum } = path;
  let k = path.k;
  if (cum[k] > s) k = 0;
  while (k < cum.length - 2 && cum[k + 1] < s) k++;
  path.k = k;
  const a = pts[k], b = pts[Math.min(k + 1, pts.length - 1)];
  const L = cum[k + 1] - cum[k] || 1;
  const t = clamp((s - cum[k]) / L, 0, 1);
  out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t;
  out.tx = (b[0] - a[0]) / L; out.tz = (b[1] - a[1]) / L;
  out.hw = b[2] || 0;
  return out;
}

const moveTo = (a, b, step) => (Math.abs(b - a) <= step ? b : a + Math.sign(b - a) * step);
export { FILTERS };

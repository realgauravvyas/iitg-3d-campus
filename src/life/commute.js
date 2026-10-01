// Rush hours: people with somewhere to be. Friends from the same hostel head to class
// together at 8:30, stream back for lunch, go to the grounds at five, to the food court after
// dinner; security guards walk between the gates and their posts at the shift change (6, 2
// and 10 o'clock); workers come in through the main gate in the morning and leave in the
// evening. Groups walk side by side; cyclists ride in single file.
import { AN } from '../crowd/people.js';
import { studentLook, intlLook, adultLook, withProp, OPT, bit, pal } from '../crowd/looks.js';
import { mulberry32, clamp, angleDamp } from '../util.js';
import { FILTERS } from '../route.js';
import { compact, sampleAt } from './campus.js';

import { GIRLS_HOSTELS as GIRLS } from './venues.js';
const BIKES = ['#1e1e1e', '#1e1e1e', '#c62f2f', '#2f5fa8', '#2e7d4f', '#d7d7d7', '#e0a526', '#6b3d5e', '#7cb342', '#e2702f', '#d81b60', '#00897b', '#9aa3aa', '#4f93c9'].map(pal);

export class Commuters {
  constructor(game, n) {
    this.g = game;
    const W = game.world, G = game.graph;
    const r = (this.rnd = mulberry32(31337));
    const place = (x, z, kind, id) => ({ x, z, kind, id, node: G.nearestNode(x, z, FILTERS.walk, true) });
    const siteP = (s, kind) => place(s.ex + s.nx * 2, s.ez + s.nz * 2, kind, s.lm);
    this.P = {
      hostel: W.sites.filter((s) => s.kind === 'hostel' && s.lm !== 'msh').map((s) => siteP(s, 'hostel')),
      academic: ['lhc', 'lhc', 'academic', 'academic', 'core5', 'workshop', 'conference', 'tic'].map((id) => W.site(id)).filter(Boolean).map((s) => siteP(s, 'academic')),
      library: [W.site('library')].filter(Boolean).map((s) => siteP(s, 'library')),
      sports: [...['newsac', 'sac', 'gym', 'pool'].map((id) => W.site(id)).filter(Boolean).map((s) => siteP(s, 'sports')),
        ...W.fields.filter((f) => f.kind === 'cricket' || f.kind === 'athletics' || f.kind === 'soccer').map((f) => place(f.cx, f.cz, 'sports'))],
      food: [...['foodcourt', 'shopping'].map((id) => W.site(id)).filter(Boolean).map((s) => siteP(s, 'food')), ...(game.props.stalls || []).filter((s) => s.kind === 'food' || s.kind === 'cart').slice(0, 10).map((s) => place(s.x, s.z, 'food'))],
      gate: W.gates.filter((g) => !g.closed).map((g) => place(g.wx, g.wz, 'gate', g.name)),
      lake: W.water.filter((w) => w.kind !== 'pool').map((w) => { const rg = w.rings[0]; return place(rg[0], rg[1], 'lake'); }),
    };
    for (const k in this.P) this.P[k] = this.P[k].filter((p) => p.node >= 0);
    const mainGate = this.P.gate.find((p) => /Main/.test(p.id || '')) || this.P.gate[0];
    const posts = game.hood?.posts || [];
    this.people = [];
    this.leaders = [];
    const add = (o) => { const p = { x: 0, y: 0, z: 0, yaw: 0, anim: AN.WALK, phase: r() * 6, speed: 1.3, seed: r(), lane: r(), hidden: true, dwell: 15 + r() * 120, ...o }; this.people.push(p); return p; };
    let i = 0;
    while (this.people.length < n) {
      const u = r();
      if (u < 0.08 && mainGate) {            // workers
        const L = withProp(adultLook(r, 'staff'), OPT.CAP);
        L.col0[1] = pal(['#8a6a4a', '#6b7d8f', '#9b8f6a', '#5a6b4a'][Math.floor(r() * 4)]);
        const p = add({ role: 'worker', look: L, home: mainGate, at: mainGate, work: this.pick(r() < 0.5 ? 'academic' : 'hostel') });
        this.leaders.push(p);
        continue;
      }
      if (u < 0.14 && posts.length) {         // guards changing shift
        const post = posts[Math.floor(r() * posts.length)];
        const gate = this.nearest('gate', post.x, post.z);
        // most guards cycle to their post at the change of shift (the rest walk; some come on motorbikes, see transport.js)
        const p = add({ role: 'guard', look: adultLook(r, 'guard'), home: gate, at: gate, work: place(post.x, post.z, 'post'), bike: r() < 0.65 ? BIKES[Math.floor(r() * BIKES.length)] : null });
        this.leaders.push(p);
        continue;
      }
      // a group of friends from one hostel
      const home = this.P.hostel[Math.floor(r() * this.P.hostel.length)];
      if (!home) break;
      const girls = GIRLS.has(home.id);
      const size = r() < 0.38 ? 1 : r() < 0.55 ? 2 : r() < 0.7 ? 3 : 4;
      const bike = r() < 0.45;
      const intl = r() < 0.06;
      const lead = add({ role: 'student', look: intl ? intlLook(r, { female: girls }) : studentLook(r, { female: girls }), home, at: home, bike: bike ? BIKES[Math.floor(r() * BIKES.length)] : null, followers: [] });
      this.leaders.push(lead);
      for (let k = 1; k < size && this.people.length < n; k++) {
        const mixed = !girls && r() < 0.12;   // a friend from a girls' hostel walking along
        const f = add({ role: 'student', look: (intl && r() < 0.5) ? intlLook(r, { female: girls || mixed }) : studentLook(r, { female: girls || mixed }), home, lead, slot: k, bike: bike ? BIKES[Math.floor(r() * BIKES.length)] : null });
        lead.followers.push(f);
      }
      i++;
    }
    this.visible = 0;
  }

  pick(kind) { const L = this.P[kind]; return L && L.length ? L[Math.floor(this.rnd() * L.length)] : null; }
  nearest(kind, x, z) { let best = null, bd = Infinity; for (const p of this.P[kind] || []) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } } return best; }

  /** how strongly people are on the move now (0..1) and where students are heading from `at` */
  flow(p, h, wk) {
    const at = p.at?.kind;
    if (p.role === 'guard') return (h > 5.5 && h < 6.5) || (h > 13.5 && h < 14.5) || (h > 21.5 && h < 22.5) ? [1, at === 'post' ? p.home : p.work] : [0, null];
    if (p.role === 'worker') {
      if (h > 7.3 && h < 8.9) return [1, at === 'gate' ? p.work : null];
      if (h > 16.8 && h < 18.4) return [1, at !== 'gate' ? p.home : null];
      return [0.05, null];
    }
    const home = p.home, H = () => home;
    const P = (k) => this.pick(k);
    const study = () => (this.rnd() < 0.8 ? P('academic') : P('library'));
    if (wk) {
      if (h < 7 || h > 23.5) return [0.03, at === 'hostel' ? null : H()];
      const outings = ['food', 'food', 'sports', 'lake', 'library', 'gate'];
      if (at === 'hostel') return [h > 17 && h < 21 ? 0.8 : 0.45, P(outings[Math.floor(this.rnd() * outings.length)])];
      return [0.5, H()];
    }
    if (h < 6.2) return [0.02, at === 'hostel' ? null : H()];
    if (h < 8.15) return [0.25, at === 'hostel' ? (this.rnd() < 0.5 ? P('lake') : null) : H()];
    if (h < 9.1) return [1, at === 'academic' ? P('academic') : study()];
    // hourly class change: the ten minutes around the hour are busy
    const m = (h % 1) * 60, change = m > 50 || m < 6;
    if (h < 12.8) return [change ? 0.85 : 0.2, at === 'academic' || at === 'library' ? study() : study()];
    if (h < 13.7) return [1, at === 'hostel' ? null : H()];
    if (h < 14.3) return [0.7, at === 'hostel' ? study() : H()];
    if (h < 17) return [change ? 0.7 : 0.25, study()];
    if (h < 17.5) return [0.9, at === 'hostel' ? null : H()];
    if (h < 18.7) return [0.85, at === 'hostel' ? P('sports') : at === 'sports' ? null : H()];
    if (h < 19.7) return [0.7, at === 'hostel' ? null : H()];
    if (h < 21.3) return [0.65, at === 'hostel' ? (this.rnd() < 0.7 ? P('food') : P('library')) : null];
    if (h < 22.8) return [0.6, at === 'hostel' ? null : H()];
    return [0.18, at === 'hostel' ? (this.rnd() < 0.5 ? P('library') : P('food')) : H()];
  }

  startTrip(p, dest) {
    const G = this.g.graph;
    const a = p.at?.node ?? G.nearestNode(p.x, p.z), b = dest.node;
    if (a == null || a < 0 || b < 0 || a === b) return false;
    const bike = p.bike != null && this.g.weather.state.rain < 0.5;
    const rt = G.route(a, b, bike ? FILTERS.bike : FILTERS.walk, bike ? 'b' : 'w');
    if (!rt) return false;
    const pts = [[p.at.x, p.at.z], ...rt, [dest.x, dest.z]];
    const path = compact(pts);
    const brisk = this.g.clock.k >= 20 ? 1.35 : 1;
    p.speed = brisk * (bike ? 3.8 + this.rnd() * 1.6 : p.role === 'guard' ? 1.2 : 1.25 + this.rnd() * 0.3);
    p.mode = bike ? 'bike' : 'walk';
    p.path = path; p.dest = dest;
    // long walks are squeezed: begin part-way, out of sight of the camera
    let s0 = Math.max(0, path.len - p.speed * 160);
    const cam = this.g.camera.position, tmp = {};
    for (let t = 0; t < 6 && s0 > 0; t++) { sampleAt(path, s0, tmp); if (Math.hypot(tmp.x - cam.x, tmp.z - cam.z) > 70) break; s0 = Math.min(path.len - 1, s0 + 30); }
    p.s = s0; p.hidden = false; p.offC = null;
    for (const f of p.followers || []) { f.hidden = false; f.offC = null; f.mode = p.mode; f.speed = p.speed; }
    return true;
  }

  update(dt) {
    const g = this.g, h = g.clock.hour, wk = g.clock.weekend, W = g.world, avoid = g.avoid;
    const tmp = {}, dd = {};
    const rain = g.weather.state.rain > 0.5;
    this.visible = 0;
    for (const p of this.leaders) {
      if (p.hidden) {
        p.dwell -= dt;
        if (p.dwell > 0) continue;
        const [k, dest] = this.flow(p, h, wk);
        const want = k * (rain && p.role === 'student' ? 0.35 : 1);
        if (!dest || this.rnd() > want || !this.startTrip(p, dest)) { p.dwell = 8 + (1 - want) * 90 * this.rnd(); continue; }
      }
      p.s += p.speed * dt;
      if (p.s >= p.path.len) {
        p.at = p.dest; p.hidden = true;
        for (const f of p.followers || []) f.hidden = true;
        const [k] = this.flow(p, h, wk);
        p.dwell = 35 + this.rnd() * 90 + (1 - k) * 120;
        continue;
      }
      this.visible += 1 + (p.followers?.length || 0);
      this.place(p, p.s, 0, dt, tmp, dd, W, avoid);
      for (const f of p.followers || []) {
        const back = p.mode === 'bike' ? f.slot * 2.3 : (f.slot % 2 === 0 ? 0.9 : 0);
        this.place(f, Math.max(0, p.s - back), p.mode === 'bike' ? 0 : (f.slot % 2 ? 1 : -1) * Math.ceil(f.slot / 2) * 0.62, dt, tmp, dd, W, avoid, p);
      }
    }
  }

  place(p, s, side, dt, tmp, dd, W, avoid, lead = null) {
    const path = (lead || p).path;
    sampleAt(path, s, tmp);
    const hw = tmp.hw || 0, u = p.lane;
    const bike = (lead || p).mode === 'bike';
    let off = bike ? (hw >= 2.8 ? hw - 0.38 - u * 0.3 : hw > 0 ? hw - 0.32 - u * 0.2 : (u - 0.5) * 0.5) : !hw ? (u - 0.5) * 0.5 : hw + 0.7 + u * 0.4;
    if (!bike && hw) { const vx = tmp.x + tmp.tz * off, vz = tmp.z - tmp.tx * off; if (W.buildingAt(vx, vz) || W.waterAt(vx, vz)) off = hw - 0.4; }
    off += side;
    p.offC = p.offC == null ? off : p.offC + clamp(off - p.offC, -1.4 * dt, 1.4 * dt);
    avoid.dodge(p, tmp.x + tmp.tz * p.offC, tmp.z - tmp.tx * p.offC, bike ? 0.4 : 0.3, dt, dd);
    const px = p.x, pz = p.z;
    p.x = dd.x; p.z = dd.z; p.y = W.heightAt(p.x, p.z);
    avoid.mark(p.x, p.z);
    p.yaw = angleDamp(p.yaw, Math.atan2(tmp.tx, tmp.tz), 8, dt);
    const sp = lead ? lead.speed : p.speed;
    if (bike) { p.wheel = (p.wheel || 0) + (sp * dt) / 0.34; p.anim = AN.BIKE; p.phase = p.wheel / 2.3; }
    else {
      p.phase += (sp * dt / 1.35) * Math.PI * 2;
      // friends chat as they walk: the leader turns to talk now and then
      p.anim = AN.WALK;
    }
    void px; void pz;
    p.speedNow = sp;
  }

  draw(crowd, bikes) {
    if (this.g.interior?.active) return;
    const rain = this.g.weather.state.rain > 0.2, night = this.g.sky.state.night > 0.5;
    for (const p of this.people) {
      if (p.hidden) continue;
      let opts = p.look.opts;
      if (rain && p.mode !== 'bike' && p.seed < 0.75) opts |= bit(OPT.UMBRELLA);
      if (night && p.role === 'guard') opts |= bit(OPT.PHONE);
      const e = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, anim: p.anim, phase: p.phase, speed: p.speedNow || p.speed, extra: 0, look: p.look, opts };
      if (crowd.push(e) && p.anim === AN.BIKE) bikes.push({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, wheel: p.wheel, crank: p.phase, lean: 0, color: p.bike });
    }
  }
}

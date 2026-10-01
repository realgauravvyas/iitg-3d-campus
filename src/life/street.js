// Street life: people who fill the roads and paths all day - students walking and cycling
// between places, professors, security guards on patrol (watchmen with torches at night),
// sweepers in the morning, gardeners on the lawns, delivery riders, visitors taking photos,
// and a construction crew. How many are out depends on the hour. Like the pedestrians of an
// open-world game they live around you: anyone who drifts far away reappears out of sight
// within a couple of hundred metres, and at rush hour they drift towards class, the mess,
// the grounds or the food court. Friends walk in little groups.
import * as THREE from 'three';
import { AN } from '../crowd/people.js';
import { studentLook, adultLook, intlLook, withProp, OPT, bit, C, pal } from '../crowd/looks.js';
import { mulberry32, clamp, angleDamp, mergeColored, m4 } from '../util.js';

// share of each group that is out and about, by hour
function presence(role, h) {
  const at = (pts) => { for (const [a, b, v] of pts) if (h >= a && h < b) return v; return 0; };
  switch (role) {
    case 'student': return at([[0, 1, 0.06], [1, 5, 0.01], [5, 7, 0.25], [7, 8.5, 0.7], [8.5, 9.2, 1], [9.2, 12.8, 0.45], [12.8, 14.2, 0.85], [14.2, 16.5, 0.5], [16.5, 19.5, 1], [19.5, 21.5, 0.55], [21.5, 22.5, 0.25], [22.5, 24, 0.1]]);
    case 'professor': return at([[8.3, 10, 0.9], [10, 13, 0.4], [13, 14, 0.6], [14, 17.5, 0.45], [17.5, 19, 0.8]]);
    case 'guard': return 1;
    case 'sweeper': return at([[5.5, 10, 1], [15, 17, 0.4]]);
    case 'gardener': return at([[7, 12, 1], [14, 17, 0.8]]);
    case 'delivery': return at([[11, 15, 0.8], [18.5, 23.5, 1]]);
    case 'visitor': return at([[9, 18, 1]]);
    case 'worker': return at([[8, 12.5, 1], [13.5, 17.5, 1]]);
    default: return 0.5;
  }
}

export class StreetLife {
  constructor(game, n) {
    this.g = game;
    const r = mulberry32(99173);
    this.rnd = r;
    const G = game.graph;
    for (const e of G.edges) if (!e.cum) { e.cum = [0]; for (let i = 1; i < e.wpts.length; i++) e.cum.push(e.cum[i - 1] + Math.hypot(e.wpts[i][0] - e.wpts[i - 1][0], e.wpts[i][1] - e.wpts[i - 1][1])); e.L = e.cum[e.cum.length - 1]; }
    this.edgesWalk = G.edges.filter((e) => e.L > 3 && !e.thruB && !e.fenced && !(e.gen && e.kind === 'footway' && e.L < 12));
    this.edgesRoad = G.edges.filter((e) => e.main && !e.thruB && !e.gated && !e.court && e.L > 5);
    this.people = [];
    const roles = [['student', 0.58], ['intl', 0.03], ['professor', 0.09], ['guard', 0.06], ['sweeper', 0.05], ['gardener', 0.05], ['delivery', 0.05], ['visitor', 0.06], ['worker', 0.03]];
    const pick = () => { let u = r(); for (const [k, w] of roles) { u -= w; if (u <= 0) return k; } return 'student'; };
    const BIKES = ['#1e1e1e', '#1e1e1e', '#c62f2f', '#2f5fa8', '#2e7d4f', '#d7d7d7', '#e0a526', '#7cb342', '#e2702f', '#d81b60', '#00897b', '#9aa3aa', '#4f93c9'].map(pal);
    for (let i = 0; i < n; i++) {
      const role = pick();
      const p = { role, id: i, seed: r(), x: 0, y: 0, z: 0, yaw: 0, anim: AN.WALK, phase: r() * 6, speed: 1.3, extra: 0, stopT: 0, work: 0 };
      if (role === 'student') { p.look = studentLook(r); p.bike = r() < 0.5 ? BIKES[Math.floor(r() * BIKES.length)] : null; }
      if (role === 'intl') { p.look = intlLook(r); p.bike = r() < 0.4 ? BIKES[Math.floor(r() * BIKES.length)] : null; }
      if (role === 'professor') { p.look = withProp(adultLook(r, 'faculty'), r() < 0.5 ? OPT.BOOK : OPT.BACKPACK); p.bike = r() < 0.25 ? pal('#1e1e1e') : null; }
      if (role === 'guard') { p.look = adultLook(r, 'guard'); p.look.col1[2] = C.guard; }
      if (role === 'sweeper') { p.look = adultLook(r, 'staff'); p.look.flags |= 1024;   // FLAG.BROOM
        if (r() < 0.5) { p.look.flags |= 1; p.look.opts |= bit(OPT.SKIRT) | bit(OPT.DUPATTA) | bit(OPT.BUN); p.look.opts &= ~(bit(OPT.SHORTHAIR) | bit(OPT.BEARD)); p.look.col0[1] = pal(['#c2185b', '#2e7d4f', '#e2702f', '#5b2d7a'][Math.floor(r() * 4)]); p.look.col0[3] = p.look.col0[1]; } }
      if (role === 'gardener') { p.look = withProp(adultLook(r, 'staff'), OPT.CAP); p.look.flags |= 2048;   // FLAG.RAKE
        p.look.col0[1] = pal('#6b7d4a'); p.look.col1[2] = pal('#c9b27a'); }
      if (role === 'delivery') { p.look = withProp(studentLook(r), OPT.BACKPACK, OPT.CAP); const c = r() < 0.5 ? pal('#e2702f') : pal('#c62828'); p.look.col1[2] = c; p.look.col0[1] = c; p.bike = pal('#1e1e1e'); }
      if (role === 'visitor') { p.look = r() < 0.3 ? intlLook(r) : withProp(adultLook(r, r() < 0.5 ? 'parent' : 'guest'), OPT.CAMERA); }
      if (role === 'worker') { p.look = withProp(adultLook(r, 'staff'), OPT.CAP); p.look.col1[2] = pal('#f2c12e'); p.look.col0[1] = pal(['#8a6a4a', '#6b7d8f', '#9b8f6a'][Math.floor(r() * 3)]); p.look.flags &= ~2; }
      this.place(p);
      this.people.push(p);
    }
    // friends walk together: a quarter of the students have one to three companions
    const studs = this.people.filter((p) => (p.role === 'student' || p.role === 'intl') && !p.lead);
    for (const a of studs) {
      if (a.lead || a.friends || r() > 0.3) continue;
      const n = 1 + Math.floor(r() * 3);
      a.friends = [];
      for (let k = 0; k < n; k++) {
        const b = studs[Math.floor(r() * studs.length)];
        if (b === a || b.lead || b.friends) continue;
        b.lead = a; b.slot = a.friends.length + 1; b.bike = a.bike != null ? BIKES[Math.floor(r() * BIKES.length)] : null; b.seed = a.seed;
        a.friends.push(b);
      }
    }
    // edges by 60 m cell, for respawning near the camera
    this.cells = new Map();
    for (const e of this.edgesWalk) {
      const m = e.wpts[Math.floor(e.wpts.length / 2)];
      const k = Math.floor(m[0] / 60) * 65536 + Math.floor(m[1] / 60);
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(e);
    }
    this.buildSite();
    this.visible = 0;
  }

  /** a building under construction (bamboo scaffolding, green net) with its crew */
  buildSite() {
    const W = this.g.world, r = this.rnd;
    const acad = W.site('academic') || W.sites[0];
    let spot = null;
    for (let t = 0; t < 200 && !spot; t++) {
      const a = r() * 6.28, d = 60 + r() * 120;
      const x = acad.ex + Math.cos(a) * d, z = acad.ez + Math.sin(a) * d;
      let ok = W.insideCampus(x, z) && !W.waterAt(x, z);
      for (let k = 0; k < 9 && ok; k++) { const px = x + ((k % 3) - 1) * 10, pz = z + (Math.floor(k / 3) - 1) * 10; if (W.buildingAt(px, pz) || W.waterAt(px, pz)) ok = false; }
      const n = this.g.graph.nearestOnNetwork(x, z);
      if (ok && n && n.d > 14 && n.d < 40) spot = { x, z };
    }
    if (!spot) return;
    const y = W.heightAt(spot.x, spot.z);
    const parts = [];
    const P = (geo, col, mat) => parts.push({ geometry: geo, color: col, matrix: mat });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) P(new THREE.BoxGeometry(0.4, 7, 0.4), '#9a9a94', m4(spot.x - 6 + i * 4, y + 3.5, spot.z - 4 + j * 4));
    for (const fy of [3.4, 6.8]) P(new THREE.BoxGeometry(12.6, 0.3, 8.6), '#a8a8a2', m4(spot.x, y + fy, spot.z));
    for (let i = 0; i < 8; i++) P(new THREE.CylinderGeometry(0.05, 0.05, 8, 5), '#b48a4a', m4(spot.x - 7 + i * 2, y + 4, spot.z + 4.8));
    for (let k = 0; k < 4; k++) P(new THREE.CylinderGeometry(0.04, 0.04, 14, 5).rotateZ(Math.PI / 2), '#b48a4a', m4(spot.x, y + 1 + k * 2, spot.z + 4.8));
    P(new THREE.BoxGeometry(14.2, 7.5, 0.05), '#3f7a3a', m4(spot.x, y + 3.9, spot.z + 5.0));
    P(new THREE.ConeGeometry(1.6, 1.2, 8), '#b5a58a', m4(spot.x + 8, y + 0.6, spot.z - 2));       // sand heap
    for (let k = 0; k < 10; k++) P(new THREE.BoxGeometry(0.4, 0.2, 0.2), '#b5533c', m4(spot.x + 8 + (k % 3) * 0.42, y + 0.1 + Math.floor(k / 3) * 0.2, spot.z + 2));   // bricks
    P(new THREE.BoxGeometry(2.2, 1.4, 1.2), '#e8e2d4', m4(spot.x - 9, y + 0.7, spot.z - 3));        // site office
    const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.g.scene.add(mesh);
    this.site = spot;
    const crew = this.people.filter((p) => p.role === 'worker');
    crew.forEach((p, i) => { p.siteWork = { x: spot.x - 5 + (i % 5) * 2.5, z: spot.z - 6 + Math.floor(i / 5) * 1.5, anim: [AN.CARRY, AN.SWEEP, AN.LIFT, AN.LAB][i % 4] }; });
  }

  place(p) {
    const r = this.rnd;
    const list = p.bike != null ? this.edgesRoad : this.edgesWalk;
    const e = list[Math.floor(r() * list.length)];
    p.e = e; p.fwd = r() < 0.5; p.s = r() * e.L; p.lane = r();
    p.speed = p.bike != null ? 3.6 + r() * 1.8 : p.role === 'guard' ? 0.9 + r() * 0.3 : p.role === 'professor' ? 1.0 + r() * 0.3 : 1.15 + r() * 0.4;
  }

  sample(e, s, fwd, out) {
    const d = fwd ? s : e.L - s;
    let k = 0;
    while (k < e.cum.length - 2 && e.cum[k + 1] < d) k++;
    const p = e.wpts[k], q = e.wpts[k + 1];
    const L = e.cum[k + 1] - e.cum[k] || 1;
    const t = clamp((d - e.cum[k]) / L, 0, 1);
    let tx = (q[0] - p[0]) / L, tz = (q[1] - p[1]) / L;
    if (!fwd) { tx = -tx; tz = -tz; }
    out.x = p[0] + (q[0] - p[0]) * t; out.z = p[1] + (q[1] - p[1]) * t; out.tx = tx; out.tz = tz;
  }

  next(p) {
    const G = this.g.graph, r = this.rnd;
    const node = p.fwd ? p.e.b : p.e.a;
    const ok = (e) => e !== p.e && !e.thruB && !e.fenced && e.L > 3 && (p.bike != null ? e.main && !e.gated && !e.court : true);
    let opts = G.adj[node].filter((l) => ok(l.e));
    // prefer through-routes over the little footpaths to single houses
    const good = opts.filter((l) => !(l.e.gen && l.e.kind === 'footway'));
    if (good.length && r() < 0.85) opts = good;
    if (!opts.length) { p.fwd = !p.fwd; p.s = 0; return; }
    let l = opts[Math.floor(r() * opts.length)];
    // rush hour: most students drift towards where everybody is going
    const T = this.flowTarget;
    if (T && (p.role === 'student' || p.role === 'intl') && p.seed < T.k && opts.length > 1) {
      const [nx, nz] = G.nodes[node];
      let best = -Infinity;
      for (const o of opts) {
        const P = o.e.wpts, q = o.fwd ? P[Math.min(P.length - 1, 3)] : P[Math.max(0, P.length - 4)];
        const dx = q[0] - nx, dz = q[1] - nz, L = Math.hypot(dx, dz) || 1;
        const tx = T.x - nx, tz = T.z - nz, TL = Math.hypot(tx, tz) || 1;
        const sc = (dx * tx + dz * tz) / (L * TL) + r() * 0.35;
        if (sc > best) { best = sc; l = o; }
      }
    }
    p.e = l.e; p.fwd = l.fwd; p.s = 0;
  }

  /** where the crowd is heading at this hour (weekday rush hours) */
  target(h, wk) {
    const C = this.g.commute?.P;
    if (!C) return null;
    const cen = (L) => { if (!L || !L.length) return null; let x = 0, z = 0; for (const p of L) { x += p.x; z += p.z; } return { x: x / L.length, z: z / L.length }; };
    this._cen ??= { academic: cen(C.academic), hostel: cen(C.hostel), sports: cen(C.sports), food: cen(C.food) };
    const c = this._cen;
    if (wk) return h > 17 && h < 21 ? { ...c.food, k: 0.4 } : null;
    const T = h > 8.1 && h < 9.1 ? ['academic', 0.75] : h > 12.8 && h < 13.7 ? ['hostel', 0.7] : h > 13.7 && h < 14.3 ? ['academic', 0.6] : h > 17 && h < 17.5 ? ['hostel', 0.6]
      : h > 17.5 && h < 18.7 ? ['sports', 0.65] : h > 18.7 && h < 19.6 ? ['hostel', 0.55] : h > 19.6 && h < 21.3 ? ['food', 0.5] : h > 21.3 && h < 22.8 ? ['hostel', 0.55] : null;
    return T && c[T[0]] ? { ...c[T[0]], k: T[1] } : null;
  }

  /** put someone back on a path near the camera, preferably where you are not looking */
  respawn(p) {
    const r = this.rnd, cam = this.g.camera, cp = cam.position;
    const fw = cam.getWorldDirection(this._fw || (this._fw = new THREE.Vector3()));
    for (let t = 0; t < 10; t++) {
      const a = r() * Math.PI * 2, d = 70 + r() * 110;
      const x = cp.x + Math.cos(a) * d, z = cp.z + Math.sin(a) * d;
      const list = this.cells.get(Math.floor(x / 60) * 65536 + Math.floor(z / 60));
      if (!list) continue;
      const e = list[Math.floor(r() * list.length)];
      if (e.fenced || (p.bike != null && (!e.main || e.gated || e.court))) continue;
      const s = r() * e.L, q = e.wpts[Math.min(e.wpts.length - 1, Math.floor((s / e.L) * (e.wpts.length - 1)))];
      const vx = q[0] - cp.x, vz = q[1] - cp.z, vd = Math.hypot(vx, vz) || 1;
      const inView = (vx * fw.x + vz * fw.z) / (vd * (Math.hypot(fw.x, fw.z) || 1)) > 0.45;
      if (inView && vd < 180) continue;
      const spot = {}; this.sample(e, s, true, spot);
      if (this.people.some(other => other !== p && other.out && Math.hypot(other.x - spot.x, other.z - spot.z) < 5)) continue;
      p.e = e; p.s = s; p.fwd = r() < 0.5; p.offC = null; p.ax = p.az = 0;
      p.x = q[0]; p.z = q[1];
      return true;
    }
    return false;
  }

  update(dt) {
    const g = this.g, W = g.world, h = g.clock.hour, r = this.rnd;
    const night = h > 19.5 || h < 5.5;
    const rain = g.weather.state.rain;
    const tmp = {}, dd = {}, avoid = g.avoid;
    const k = g.clock.k >= 20 ? 1.35 : 1;          // a brisker pace when time is accelerated
    const P = g.player.pos;
    this.visible = 0;
    const cam = g.camera.position;
    this.flowT = (this.flowT || 0) - dt;
    if (this.flowT <= 0) { this.flowT = 2; this.flowTarget = this.target(h, g.clock.weekend); }
    const inside = g.interior?.active;
    for (const p of this.people) {
      const want = presence(p.role === 'intl' ? 'student' : p.role, h) * (rain > 0.4 && p.role !== 'guard' ? 0.35 : 1);
      p.out = p.seed < want;
      if (!p.out) continue;
      this.visible++;
      // keep the street life around you
      if (!p.siteWork && !inside && (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2 > 235 * 235 && !p.lead) {
        this.respawn(p);
        for (const f of p.friends || []) { f.e = p.e; f.s = p.s; f.fwd = p.fwd; f.offC = null; f.x = p.x; f.z = p.z; }
      }
      if (p.lead) { this.follow(p, dt, tmp, dd, avoid, W, k); continue; }
      if (p.pauseT > 0) { p.pauseT -= dt; continue; }
      if (p.siteWork && this.site) {   // construction crew at work
        p.x = p.siteWork.x; p.z = p.siteWork.z; p.y = W.heightAt(p.x, p.z); p.anim = p.siteWork.anim; p.yaw = p.seed * 6; p.speed = 0.6;
        p.phase += dt * 4;
        continue;
      }
      if (p.stopT > 0 && W.buildingAt(p.x, p.z)) p.stopT = 0;                  // never stand still inside a wall (the end of a footpath to a door): walk on
      // a gardener works on grass, never on a road or a path; a photographer does not stand in the road either: walk on to the verge
      if (p.stopT > 0 && (p.role === 'gardener' || p.role === 'visitor') && g.graph.wayClearance(p.x, p.z, 3) < 0.3) p.stopT = 0;
      if (p.stopT > 0) { p.stopT -= dt; if (p.role === 'sweeper' || p.role === 'gardener') p.anim = AN.SWEEP; else if (p.role === 'visitor') p.anim = AN.CAMERA; else p.anim = AN.TALK; continue; }
      if ((p.role === 'sweeper' || p.role === 'gardener' || p.role === 'visitor') && r() < dt * 0.05 && !W.buildingAt(p.x, p.z)
        && (p.role === 'sweeper' || g.graph.wayClearance(p.x, p.z, 3) > 0.6)) p.stopT = 12 + r() * 25;
      // make way for the player
      const dp = Math.hypot(p.x - P.x, p.z - P.z);
      const slow = dp < 2.2 ? 0.25 : 1;
      p.s += p.speed * k * slow * dt;
      let guard = 0;
      while (p.s > p.e.L && guard++ < 4) { const over = p.s - p.e.L; this.next(p); p.s = over; }
      this.sample(p.e, p.s, p.fwd, tmp);
      // keep left: cycles on the road edge, people on the verge or the footpath
      const hw = p.e.hw || 0;
      let off = p.bike != null ? (hw >= 2.8 ? hw - 0.38 - p.lane * 0.3 : hw > 0 ? hw - 0.32 - p.lane * 0.2 : (p.lane - 0.5) * 0.6)
        : !hw ? (p.lane - 0.5) * 0.8 : hw + 0.55 + p.lane * 1.0;
      if (p.bike == null && hw) { const vx = tmp.x + tmp.tz * off, vz = tmp.z - tmp.tx * off; if (W.buildingAt(vx, vz) || W.waterAt(vx, vz)) off = hw - 0.35; }
      p.offC = p.offC == null ? off : moveTo(p.offC, off, (p.bike != null ? 1.8 : 1.1) * dt);
      avoid.dodge(p, tmp.x + tmp.tz * p.offC, tmp.z - tmp.tx * p.offC, p.bike != null ? 0.4 : 0.3, dt, dd);
      p.x = dd.x; p.z = dd.z; p.y = W.heightAt(p.x, p.z);
      avoid.mark(p.x, p.z);
      p.yaw = angleDamp(p.yaw, Math.atan2(tmp.tx, tmp.tz), 6, dt);
      if (p.bike != null) { p.wheel = (p.wheel || 0) + (p.speed * k * slow * dt) / 0.34; p.anim = AN.BIKE; p.phase = p.wheel / 2.3; }
      else { p.anim = AN.WALK; p.phase += (p.speed * k * slow * dt / 1.35) * Math.PI * 2; }
      // watchmen carry a torch (phone prop, lit) at night
      p.torch = night && p.role === 'guard';
    }
  }

  /** a friend walking beside (or cycling behind) the one they are with */
  follow(p, dt, tmp, dd, avoid, W, k) {
    const L = p.lead;
    if (!L.out) { p.out = false; return; }
    p.e = L.e; p.fwd = L.fwd;
    const bike = L.bike != null;
    const s = bike ? Math.max(0, L.s - p.slot * 2.3) : Math.max(0, L.s - (p.slot === 2 ? 0.9 : 0));
    this.sample(L.e, Math.min(s, L.e.L), L.fwd, tmp);
    const side = bike ? 0 : (p.slot % 2 ? -1 : 1) * Math.ceil(p.slot / 2) * 0.62;
    const o = (L.offC ?? 0) + side;
    p.offC = p.offC == null ? o : moveTo(p.offC, o, 1.4 * dt);
    avoid.dodge(p, tmp.x + tmp.tz * p.offC, tmp.z - tmp.tx * p.offC, bike ? 0.4 : 0.3, dt, dd);
    p.x = dd.x; p.z = dd.z; p.y = W.heightAt(p.x, p.z);
    avoid.mark(p.x, p.z);
    p.yaw = angleDamp(p.yaw, Math.atan2(tmp.tx, tmp.tz), 6, dt);
    p.speed = L.speed;
    if (bike) { p.wheel = (p.wheel || 0) + (L.speed * k * dt) / 0.34; p.anim = AN.BIKE; p.phase = p.wheel / 2.3; }
    else { p.anim = L.stopT > 0 ? AN.TALK : AN.WALK; p.phase += (L.speed * k * dt / 1.35) * Math.PI * 2; }
  }

  draw(crowd, bikes) {
    if (this.g.interior?.active) return;
    const rain = this.g.weather.state.rain > 0.2;
    for (const p of this.people) {
      if (!p.out) continue;
      let opts = p.look.opts;
      if (rain && p.bike == null && p.seed < 0.7) opts |= bit(OPT.UMBRELLA);
      if (p.torch) opts |= bit(OPT.PHONE);
      const e = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, anim: p.anim, phase: p.phase, speed: p.speed, extra: 0, look: p.look, opts };
      if (crowd.push(e) && p.bike != null && p.anim === AN.BIKE) bikes.push({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, wheel: p.wheel, crank: p.phase, lean: 0, color: p.bike });
    }
  }
}

const moveTo = (a, b, step) => (Math.abs(b - a) <= step ? b : a + Math.sign(b - a) * step);

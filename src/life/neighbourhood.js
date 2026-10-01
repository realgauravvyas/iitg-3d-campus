// The people who are always "there": security guards in their cabins at every gate, at the
// hostel doors and compound gates, at the big buildings and the traffic circles; students
// hanging out in front of their hostels (boys outside boys' hostels, girls outside girls'
// hostels, friends visiting each other); Kendriya Vidyalaya with its pupils, teachers and
// gate guard; and families at the staff quarters in the evening.
import * as THREE from 'three';
import { AN } from '../crowd/people.js';
import { studentLook, adultLook, kidLook, familyLook, scholarLook, OPT, bit, C, pal, HOSTEL_COLORS, swimLook } from '../crowd/looks.js';
import { mulberry32, mergeColored, m4, clamp, canvasTexture, angleDamp, drawIndianFlag, pointInRing } from '../util.js';
import { FILTERS } from '../route.js';
import { PLAN } from '../plan_data.js';
import { makeErick } from '../transport.js';

import { GIRLS_HOSTELS as GIRLS } from './venues.js';

/** the OneStop mark (a gate arch with a dot, on a green tile) painted on a canvas */
function drawLogoMark(c, x, y, s) {
  const k = s / 32;
  c.save(); c.translate(x, y); c.scale(k, k);
  c.fillStyle = '#1aa65a'; c.beginPath(); c.roundRect?.(1, 1, 30, 30, 9); c.fill();
  c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineWidth = 2.7;
  c.beginPath(); c.moveTo(9.6, 24.2); c.lineTo(9.6, 14.6); c.arc(16, 14.6, 6.4, Math.PI, 0); c.lineTo(22.4, 24.2); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(16, 16.4, 2.5, 0, 7); c.fill();
  c.lineWidth = 2.3; c.beginPath(); c.moveTo(6.8, 24.6); c.lineTo(25.2, 24.6); c.stroke();
  c.restore();
}
const KEY_SITES = ['library', 'gym', 'newsac', 'sac', 'hospital', 'admin', 'academic', 'lhc', 'auditorium', 'core5', 'pool', 'guesthouse', 'shopping', 'foodcourt', 'conference', 'tic', 'transit', 'workshop'];
const BOOTH_SITES = new Set(['admin', 'hospital', 'guesthouse', 'library', 'newsac', 'transit']);

/** Choose the Kendriya Vidyalaya building and its playground (before trees are planted). */
export function planSchool(world, graph) {
  const gate = world.gates.find((g) => g.name === 'KV Gate') || world.gates[0];
  if (!gate) return null;
  const cands = world.buildings.filter((b) => !b.site && (b.kind === 'institutional' || b.kind === 'academic') && b.area > 450)
    .map((b) => ({ b, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 }))
    .map((c) => ({ ...c, d: Math.hypot(c.cx - gate.wx, c.cz - gate.wz) }))
    .filter((c) => c.d < 650).sort((a, b) => a.d - b.d);
  // the school on the map (OpenStreetMap), which is where the master plan puts the KV too: its
  // biggest building comes first
  const kx = PLAN.kv.x, kz = -PLAN.kv.y;
  const kv = world.buildings.filter((b) => !b.site && b.area > 150 && Math.max(0, b.x0 - kx, kx - b.x1, b.z0 - kz, kz - b.z1) < 40).sort((a, b) => b.area - a.area)[0];
  if (kv) { const i = cands.findIndex((c) => c.b === kv); if (i >= 0) cands.splice(i, 1); cands.unshift({ b: kv, cx: (kv.x0 + kv.x1) / 2, cz: (kv.z0 + kv.z1) / 2, d: 0, osm: true }); }
  const ok = (x, z) => world.insideCampus(x, z) && !world.buildingAt(x, z) && !world.waterAt(x, z) && !graph.onRoad(x, z, 1.5);
  // try every playground size at the real school first, then the other buildings
  const order = [];
  for (const c of cands.filter((q) => q.osm)) for (const size of [[46, 30], [36, 24], [28, 18], [22, 15]]) order.push([size, c]);
  for (const size of [[46, 30], [36, 24], [28, 18]]) for (const c of cands.filter((q) => !q.osm)) order.push([size, c]);
  for (const [size, c] of order) {
    {
      const rad = Math.max(c.b.x1 - c.b.x0, c.b.z1 - c.b.z0) / 2;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = c.cx + Math.cos(a) * (rad + size[1] / 2 + 6), z = c.cz + Math.sin(a) * (rad + size[1] / 2 + 6);
        const yaw = Math.atan2(c.cx - x, c.cz - z);     // long side faces the school
        const ca = Math.cos(yaw), sa = Math.sin(yaw);
        let good = true, hmin = Infinity, hmax = -Infinity;
        for (let i = -3; i <= 3 && good; i++) for (let j = -2; j <= 2 && good; j++) {
          const u = (i / 3) * size[0] / 2, v = (j / 2) * size[1] / 2;
          const px = x + u * ca + v * sa, pz = z - u * sa + v * ca;
          if (!ok(px, pz)) good = false;
          const h = world.heightAt(px, pz); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
        }
        if (good && hmax - hmin < 3) {
          c.b.display = 'Kendriya Vidyalaya IIT Guwahati';
          c.b.school = true;
          const ground = { x, z, yaw, w: size[0], d: size[1], y: (hmin + hmax) / 2 };
          world.clearings = world.clearings || [];
          world.clearings.push({ x, z, r: Math.hypot(size[0], size[1]) / 2 + 3 });
          if (!world.landmark('kv')) world.landmarks.push({ id: 'kv', name: 'Kendriya Vidyalaya', kind: 'academic', wx: c.cx, wz: c.cz, wy: world.heightAt(c.cx, c.cz),
            desc: 'The Kendriya Vidyalaya on campus, where the children of the faculty and staff study. Morning assembly at 7:45, recess at 10:30 and home time at 1:30.' });
          return { b: c.b, ground, gate, cx: c.cx, cz: c.cz };
        }
      }
    }
  }
  return null;
}

export class Neighbourhood {
  constructor(game, school) {
    this.g = game;
    const W = game.world, G = game.graph;
    const r = (this.rnd = mulberry32(8080));
    this.people = [];
    this.parts = [];
    this.signs = [];
    this.school = school;
    const PL = W.placer;
    const free = (x, z, m = 0.6) => (PL ? PL.free(x, z, Math.min(m, 0.9)) : W.insideCampus(x, z) && !W.buildingAt(x, z) && !W.waterAt(x, z) && !G.onRoad(x, z, m));
    this.free = free;

    // ------------------------------------------------------------ guard posts
    const guard = (x, z, yaw, o = {}) => this.add({ x, z, yaw, look: adultLook(r, 'guard'), kind: 'guard', anim: AN.STAND, ...o });
    const post = (x, z, yaw, { booth = true, n = 1, label = 'SECURITY', sitChair = true } = {}) => {
      // booth faces yaw; the guard stands in front, a chair beside it
      const fx = Math.sin(yaw), fz = Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
      if (booth) { this.booth(x, z, yaw, label); W.addSolid(x, z, 1.05, 'booth', true); }
      const gx = x + fx * 1.7 + sx * 0.6, gz = z + fz * 1.7 + sz * 0.6;
      const chx = x + fx * 0.9 - sx * 1.5, chz = z + fz * 0.9 - sz * 1.5;
      if (sitChair) this.chair(chx, chz, yaw, '#2f5fa8');
      for (let k = 0; k < n; k++) {
        // one guard: stands, sits now and then; two: one on the chair, one on his feet
        const sitter = sitChair && k === 1;
        guard(sitter ? chx : gx, sitter ? chz : gz, yaw, { sitSpot: sitChair && n === 1 ? { x: chx, z: chz } : null, anim: sitter ? AN.SIT : AN.STAND, post: true });
      }
      this.posts.push({ x, z, yaw, label });
    };
    this.posts = [];
    const clear = (x, z, rad) => {
      if (!W.insideCampus(x, z) || W.waterAt(x, z)) return false;
      if (PL && !PL.free(x, z, Math.min(rad, 1.5))) return false;                  // not on a road, a lane or a footpath, nor on something else
      for (let a = 0; a < 6.28; a += 1.05) if (W.buildingAt(x + Math.cos(a) * rad, z + Math.sin(a) * rad)) return false;
      const rd = G.roadAt(x, z, 20);
      return !rd || rd.d > rd.hw + rad + 0.3;
    };
    this.clear = clear;
    const place = (x, z, yaw, tries, fn) => {
      // the wanted spot, else the nearest clear spot on growing rings around it
      if (clear(x, z, 1.6)) { fn(x, z); return true; }
      for (let R = 1.5; R <= 4 + tries * 1.5; R += 1.5) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2 + R;
          const px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
          if (clear(px, pz, 1.6)) { fn(px, pz); return true; }
        }
      }
      return false;
    };
    // campus gates: the main gate has its own guard room (gates.js); the others get cabins
    for (const g of W.gates) {
      const ax = Math.cos(g.angle), az = -Math.sin(g.angle);     // along the wall
      // inward normal: towards the campus centre
      let nx = -az, nz = ax;
      const cx = (W.bbox.x0 + W.bbox.x1) / 2, cz = (W.bbox.z0 + W.bbox.z1) / 2;
      if ((cx - g.wx) * nx + (cz - g.wz) * nz < 0) { nx = -nx; nz = -nz; }
      const yaw = Math.atan2(-nx, -nz);   // cabins face the gate road
      // OneStop at each open campus gate: a pedestrian lane with an automatic gate and a two-sided machine
      if (!g.closed && g.name) this.gateKit(g);
      if (g.main) {
        if (W.mainPost) {                                         // the guard on duty outside the brick post, on a chair, facing the road
          const mp = W.mainPost;
          this.chair(mp.x, mp.z, mp.yaw, '#2f5fa8');
          guard(mp.x, mp.z, mp.yaw, { sitSpot: { x: mp.x, z: mp.z }, anim: AN.SIT, post: true });
          this.posts.push({ x: mp.post.x, z: mp.post.z, yaw: mp.yaw, label: 'MAIN GATE SECURITY' });
        }
        for (const s of [-1, 1]) guard(g.wx + nx * 3 + ax * s * 5.2, g.wz + nz * 3 + az * s * 5.2, yaw, { wave: s > 0, post: true });
        guard(g.wx + nx * 8 + ax * 9.5, g.wz + nz * 8 + az * 9.5, yaw + Math.PI, { anim: AN.PHONE, post: true });
        continue;
      }
      // the 3D-printed guard post at the KV Gate: two guards sit behind it, each on a chair with a register
      for (const PP of W.printedPosts || []) if (PP.gate === g) {
        const ox = Math.cos(g.angle), oz = -Math.sin(g.angle), yawOut = Math.atan2(ox, oz);
        for (const s of [-1, 1]) {
          const lx = PP.lx, lz = PP.lz + s * PP.dz, x = g.wx + ox * lx - oz * lz, z = g.wz + oz * lx + ox * lz;
          this.chair(x, z, yawOut, '#2f5fa8');
          guard(x, z, yawOut, { sitSpot: { x, z }, anim: AN.SIT, post: true });
        }
      }
      const side = g.closed ? 5 : 7.5;
      place(g.wx + nx * 5 + ax * side, g.wz + nz * 5 + az * side, yaw, 6, (x, z) => post(x, z, Math.atan2(-ax, -az), { n: g.closed ? 1 : 2, label: g.name ? g.name.toUpperCase() : 'SECURITY' }));
      if (!g.closed) guard(g.wx + nx * 4 - ax * 3.5, g.wz + nz * 4 - az * 3.5, yaw, { wave: true, post: true });
    }

    // hostels: a guard at the door and a cabin at the compound gate where the driveway meets the road
    for (const s of W.sites.filter((s) => s.kind === 'hostel')) {
      const tx = -s.nz, tz = s.nx;
      place(s.ex + s.nx * 3.2 + tx * 3.4, s.ez + s.nz * 3.2 + tz * 3.4, Math.atan2(-tx, -tz), 5, (x, z) => post(x, z, Math.atan2(-tx, -tz), { n: 1, label: 'HOSTEL SECURITY' }));
      // the hostel door's OneStop machine, opposite the guard, and automatic glass doors in the entrance
      game.onestop?.addKiosk({ id: `hostel-${s.lm}`, name: `${(s.name || '').replace(' Hostel', '')} Hostel · Main door`, x: s.ex + s.nx * 2.6 - tx * 3.6, z: s.ez + s.nz * 2.6 - tz * 3.6, yaw: Math.atan2(s.nx, s.nz), kind: 'hostel', site: s.lm });
      this.hostelDoor(s);
      const jn = this.compoundGate(s);
      if (jn) {
        const dx = s.ex - jn.x, dz = s.ez - jn.z, L = Math.hypot(dx, dz) || 1;
        const ux = dx / L, uz = dz / L;             // into the compound
        const pxs = -uz, pzs = ux;                  // sideways
        place(jn.x + ux * 6 + pxs * 4.5, jn.z + uz * 6 + pzs * 4.5, Math.atan2(-pxs, -pzs), 6, (x, z) => { post(x, z, Math.atan2(-pxs, -pzs), { n: 1, label: `${(s.name || '').replace(' Hostel', '').toUpperCase()} GATE` }); this.barrier(jn.x + ux * 5, jn.z + uz * 5, Math.atan2(ux, uz)); });
        game.onestop?.addKiosk({ id: `hostelgate-${s.lm}`, name: `${(s.name || '').replace(' Hostel', '')} Hostel · Gate`, x: jn.x + ux * 6 - pxs * 4.5, z: jn.z + uz * 6 - pzs * 4.5, yaw: Math.atan2(-ux, -uz), kind: 'hostel', site: s.lm });
      }
    }
    // the important buildings: guards at the entrance (cabins at a few)
    for (const id of KEY_SITES) {
      const s = W.site(id);
      if (!s) continue;
      const tx = -s.nz, tz = s.nx;
      if (BOOTH_SITES.has(id)) place(s.ex + s.nx * 4 + tx * 4.2, s.ez + s.nz * 4 + tz * 4.2, Math.atan2(-tx, -tz), 5, (x, z) => post(x, z, Math.atan2(-tx, -tz), { n: 1 }));
      else if (free(s.ex + s.nx * 1.8 + tx * 2.2, s.ez + s.nz * 1.8 + tz * 2.2)) {
        const x = s.ex + s.nx * 1.8 + tx * 2.2, z = s.ez + s.nz * 1.8 + tz * 2.2;
        this.chair(x + tx * 0.9, z + tz * 0.9, s.yaw, '#8a5a36');
        guard(x, z, s.yaw, { sitSpot: { x: x + tx * 0.9, z: z + tz * 0.9 }, post: true });
      }
    }
    // the Central Library keeps a OneStop QR machine by its door (like the Computer Centre): scan in to go in, scan out on the way out
    { const lib = W.site('library');
      if (lib) { const tx = -lib.nz, tz = lib.nx; game.onestop?.addKiosk({ id: 'place-library', name: 'Central Library · Entry', x: lib.ex + lib.nx * 2.6 - tx * 3.6, z: lib.ez + lib.nz * 2.6 - tz * 3.6, yaw: Math.atan2(lib.nx, lib.nz), kind: 'place', place: 'Central Library' }); } }
    // the Computer Centre and the pool gate: a booth and a guard by the entrance arch
    for (const q of W.extraPosts || []) place(q.x, q.z, q.yaw, 4, (x, z) => post(x, z, q.yaw, { n: 1, label: q.label }));
    for (const F of W.fenceOutlines || []) if (F.pool) for (const gq of F.gatesOut || []) {
      const nx = -gq.tz, nz = gq.tx;
      place(gq.x + nx * 2.4 + gq.tx * 3.6, gq.z + nz * 2.4 + gq.tz * 3.6, Math.atan2(-gq.tx, -gq.tz), 5, (x, z) => post(x, z, Math.atan2(-gq.tx, -gq.tz), { n: 1, label: 'POOL SECURITY' }));
      // OneStop machines on both sides of the pool gate, and the gate itself slides open after a scan
      const inside = pointInRing(gq.x + nx * 2, gq.z + nz * 2, F.ring.flat()) ? 1 : -1;           // +n leads into the compound?
      game.onestop?.addKiosk({ id: 'pool-gate', name: 'Swimming Pool · Gate', x: gq.x - nx * inside * 1.9 - gq.tx * 2.6, z: gq.z - nz * inside * 1.9 - gq.tz * 2.6, yaw: Math.atan2(-nx * inside, -nz * inside), kind: 'pool' });
      game.onestop?.addKiosk({ id: 'pool-gate-in', name: 'Swimming Pool · Exit', x: gq.x + nx * inside * 1.9 - gq.tx * 2.6, z: gq.z + nz * inside * 1.9 - gq.tz * 2.6, yaw: Math.atan2(nx * inside, nz * inside), kind: 'pool' });
      game.onestop?.addGate({ id: 'pool', site: 'pool', x: gq.x + nx * inside * 0.18, z: gq.z + nz * inside * 0.18, y: gq.y, tx: gq.tx, tz: gq.tz, w: gq.w - 0.1, h: 1.9 });
    }
    // traffic circles and big junctions: a guard waving the traffic through
    this.circles = this.findCircles();
    for (const c of this.circles) guard(c.x, c.z, c.yaw, { wave: true, post: true, circle: true });
    // staff quarters: a chowkidar at each colony
    this.colonies = this.findColonies();
    for (const c of this.colonies) place(c.x, c.z, c.yaw, 6, (x, z) => post(x, z, c.yaw, { n: 1, label: 'SECURITY' }));

    // ------------------------------------------------------------ hostel fronts
    for (const s of W.sites.filter((s) => s.kind === 'hostel')) this.hostelFront(s);
    // ------------------------------------------------------------ Kendriya Vidyalaya
    if (school) this.buildSchool(school);
    // ------------------------------------------------------------ families at the quarters
    this.families();
    this.buildPark();
    if (game.outside) this.outsideLife(game.outside);
    this.poolLife();

    this.mesh = new THREE.Mesh(mergeColored(this.parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    game.scene.add(this.mesh);
    this.buildSigns();
    this.buildGlows(game);
    this.buildGateSigns(game);
    this.parts = null;
    this.visT = 0;
    this.shown = 0;
  }

  add(o) {
    const r = this.rnd;
    const p = { y: 0, phase: r() * 6, speed: 0, seed: r(), extra: 0, visible: true, ...o };
    p.hx = p.x; p.hz = p.z; p.hyaw = p.yaw;
    p.y = this.g.world.heightAt(p.x, p.z);
    this.people.push(p);
    return p;
  }

  /** where a hostel's own driveway meets a through-road */
  compoundGate(s) {
    const G = this.g.graph;
    if (s.node == null || s.node < 0) return null;
    const seen = new Set([s.node]);
    let q = [s.node];
    for (let depth = 0; depth < 6 && q.length; depth++) {
      const nq = [];
      for (const u of q) {
        for (const l of G.adj[u]) {
          if (FILTERS.car(l.e)) { const [x, z] = G.nodes[u]; return Math.hypot(x - s.ex, z - s.ez) > 12 ? { x, z } : null; }
          if (!seen.has(l.to)) { seen.add(l.to); nq.push(l.to); }
        }
      }
      q = nq;
    }
    return null;
  }

  findCircles() {
    const G = this.g.graph, W = this.g.world, out = [];
    const cand = [];
    // the roundabouts first: a traffic guard stands on the island, just inside the kerb
    for (const I of this.g.islands || []) if (!I.flowers) cand.push({ x: I.x, z: I.z, score: 99, ring: I.r - 2.5 });       // (the flower circle by the lake has its own guard booth)
    G.nodes.forEach(([x, z], i) => {
      const n = G.adj[i].filter((l) => FILTERS.car(l.e) && l.e.hw >= 3).length;
      if (n >= 4 || (n === 3 && G.adj[i].some((l) => l.e.hw >= 3.5))) cand.push({ x, z, score: n, ring: 0 });
    });
    cand.sort((a, b) => b.score - a.score);
    for (const c of cand) {
      if (out.length >= 9) break;
      if (out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 220)) continue;
      if (W.gates.some((g) => Math.hypot(g.wx - c.x, g.wz - c.z) < 80)) continue;
      // stand on a corner, off the carriageway
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.4, d = (c.ring || 6.5) + 1.5;
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        if (this.free(x, z, 0.6)) { out.push({ x, z, yaw: Math.atan2(c.x - x, c.z - z), cx: c.x, cz: c.z }); break; }
      }
    }
    return out;
  }

  findColonies() {
    const W = this.g.world, G = this.g.graph;
    const cells = new Map();
    for (const b of W.buildings) {
      if (b.kind !== 'residential' || b.site || b.area < 60 || b.area > 700) continue;
      const k = Math.floor((b.x0 + b.x1) / 300) * 1000 + Math.floor((b.z0 + b.z1) / 300);
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(b);
    }
    const out = [];
    for (const list of cells.values()) {
      if (list.length < 10) continue;
      let cx = 0, cz = 0;
      for (const b of list) { cx += (b.x0 + b.x1) / 2; cz += (b.z0 + b.z1) / 2; }
      cx /= list.length; cz /= list.length;
      const rd = G.roadAt(cx, cz, 120, FILTERS.car);
      if (!rd) continue;
      const nx = cx - rd.x, nz = cz - rd.z, L = Math.hypot(nx, nz) || 1;
      out.push({ x: rd.x + (nx / L) * (rd.hw + 3.2), z: rd.z + (nz / L) * (rd.hw + 3.2), yaw: Math.atan2(-nx / L, -nz / L) + Math.PI / 2 });
      this.colonyHouses = (this.colonyHouses || []).concat(list);
    }
    return out.slice(0, 12);
  }

  // ------------------------------------------------------------ hostel fronts
  /** the "pedestrians: scan with OneStop" boards over the gate lanes (both faces) */
  buildGateSigns(game) {
    if (!this.gateSigns?.length) return;
    const tex = canvasTexture(512, 160, (c, w, h) => {
      c.fillStyle = '#141619'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1aa65a'; c.fillRect(0, h - 18, w, 18);
      drawLogoMark(c, 22, 28, 88);
      c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.font = '800 50px "Hind", "Segoe UI", sans-serif'; c.fillText('GATE ENTRY', 130, 58);
      c.font = '600 32px "Hind", "Segoe UI", sans-serif'; c.fillStyle = '#9fe0b8'; c.fillText('Scan your QR here · in / out', 132, 108);
    }, { repeat: false });
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false });
    for (const q of this.gateSigns) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(q.w, q.w * 0.3125), mat);
      m.position.set(q.x, q.y, q.z); m.rotation.y = q.yaw;
      game.scene.add(m);
    }
  }

  /** a campus gate's OneStop desk, in the gate's own frame (as in gates.js: +x out of the campus, z along the wall): a guard's
   *  desk just inside the gate, beside the lane people walk along, with the OneStop QR machine on a post at its end and a sign
   *  over it. You scan in or out there and it makes your entry (GateLog); it does not open anything: the gates are ordinary
   *  gates, shut at night and opened in the morning by the guards (the Main Gate never closes). */
  gateKit(g) {
    const W = this.g.world, os = this.g.onestop;
    if (!os) return;
    const ox = Math.cos(g.angle), oz = -Math.sin(g.angle);                 // out of the campus
    const P = (lx, lz) => ({ x: g.wx + ox * lx - oz * lz, z: g.wz + oz * lx + ox * lz });
    const tx = -oz, tz = ox;                                                 // +z (along the wall)
    const R = Math.atan2(-oz, ox);                                           // the gate frame's rotation about y
    const dz = g.main ? -12.4 : -6.9;                                         // the desk stands BEHIND the road, on the verge beside the carriageway: the roads stay free
    const put = (geo, color, lx, ly, lz, ry = 0) => { const q = P(lx, lz); this.parts.push({ geometry: geo, color, matrix: m4(q.x, W.heightAt(q.x, q.z) + ly, q.z, 0, R + ry, 0) }); };
    // the desk: a wooden top on a steel frame with a front panel, a register and a cup of pens on it, a chair behind
    put(new THREE.BoxGeometry(1.9, 0.06, 0.72), '#8a5a36', -2.7, 0.9, dz);
    put(new THREE.BoxGeometry(1.8, 0.86, 0.05), '#3d5a80', -2.7, 0.43, dz + 0.33);
    for (const sx of [-0.85, 0.85]) put(new THREE.BoxGeometry(0.06, 0.88, 0.06), '#4a4f54', -2.7 + sx, 0.44, dz - 0.3);
    put(new THREE.BoxGeometry(0.42, 0.04, 0.3), '#f2f0ea', -2.35, 0.95, dz + 0.05);                      // the visitors' register
    put(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 8), '#c62828', -3.1, 0.98, dz - 0.05);
    put(new THREE.BoxGeometry(0.5, 0.05, 0.5), '#2d2d2d', -2.7, 0.46, dz - 0.72); put(new THREE.BoxGeometry(0.5, 0.5, 0.06), '#2d2d2d', -2.7, 0.72, dz - 0.97);
    for (const [sx, sz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) put(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 5), '#4a4f54', -2.7 + sx, 0.22, dz - 0.72 + sz);
    // the machine (double-sided, both screens along the lane) at the desk's end, and a small sign over the desk
    const k = P(-3.85, dz + 0.1);
    os.addKiosk({ id: `gate-${g.name}`, name: g.name, x: k.x, z: k.z, yaw: Math.atan2(tx, tz), kind: 'campus', gate: g, exact: true, double: true });
    const S = P(-2.7, dz + 0.36), y = W.heightAt(S.x, S.z);
    for (const sx of [-0.9, 0.9]) put(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6), '#5a5f64', -2.7 + sx, 1.0, dz + 0.36);
    (this.gateSigns ||= []).push({ x: S.x, z: S.z, y: y + 1.85, yaw: Math.atan2(tx, tz), w: 1.8, text: 'SCAN HERE · GATE ENTRY' });
  }

  /** automatic sliding glass doors in a hostel's entrance (they open as you scan in or out with OneStop) */
  hostelDoor(s) {
    const W = this.g.world, os = this.g.onestop;
    if (!os || !s.blocks?.length) return;
    let best = null;
    for (const b of s.blocks) {
      const r = b.rings[0];
      for (let i = 0; i < r.length; i += 2) {
        const j = (i + 2) % r.length, ax = r[i], az = r[i + 1], bx = r[j], bz = r[j + 1], L = Math.hypot(bx - ax, bz - az);
        if (L < 3.2) continue;
        const t = Math.max(1.4 / L, Math.min(1 - 1.4 / L, ((s.ex - ax) * (bx - ax) + (s.ez - az) * (bz - az)) / (L * L)));
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t, d = Math.hypot(s.ex - x, s.ez - z);
        if (!best || d < best.d) best = { d, x, z, b, nx: -(bz - az) / L, nz: (bx - ax) / L };
      }
    }
    if (!best || best.d > 8) return;
    let { nx, nz } = best;
    if (W.buildingAt(best.x + nx * 0.6, best.z + nz * 0.6) === best.b) { nx = -nx; nz = -nz; }   // the normal must point out of the building
    const y = Math.max(best.b.floor0 ?? best.b.base, W.heightAt(best.x + nx * 1.2, best.z + nz * 1.2));
    os.addDoor({ site: s.lm, x: best.x, z: best.z, y, nx, nz, w: 2.4, h: 2.55 });
  }

  hostelFront(s) {
    const r = this.rnd, W = this.g.world;
    // every hostel has its own colour: a flag at the entrance and a painted band across the front
    const col = HOSTEL_COLORS[s.lm] || '#8a8f96';
    {
      const tx = -s.nz, tz = s.nx;
      const fx = s.ex + s.nx * 5 - tx * 5.5, fz = s.ez + s.nz * 5 - tz * 5.5;
      if (this.free(fx, fz, 0.3)) {
        const y = W.heightAt(fx, fz);
        this.parts.push({ geometry: new THREE.CylinderGeometry(0.05, 0.07, 7, 8), color: '#e8e8e2', matrix: m4(fx, y + 3.5, fz) });
        this.parts.push({ geometry: new THREE.BoxGeometry(1.8, 1.1, 0.03), color: col, matrix: m4(fx + tx * 0.95, y + 6.3, fz + tz * 0.95, 0, Math.atan2(tx, tz) + Math.PI / 2, 0) });
      }
      const b = s.blocks[0];
      if (b) {
        const ring = b.rings[0];
        let best = null;
        for (let i = 0; i < ring.length; i += 2) {
          const j = (i + 2) % ring.length, mx = (ring[i] + ring[j]) / 2, mz = (ring[i + 1] + ring[j + 1]) / 2, L = Math.hypot(ring[j] - ring[i], ring[j + 1] - ring[i + 1]);
          const d = Math.hypot(mx - s.ex, mz - s.ez);
          if (L > 8 && (!best || d < best.d)) best = { d, i, j, L, mx, mz };
        }
        if (best) {
          const ax = ring[best.i], az = ring[best.i + 1], bx = ring[best.j], bz = ring[best.j + 1];
          const yaw = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
          let nx = Math.sin(yaw), nz = Math.cos(yaw);
          if ((best.mx + nx - (b.x0 + b.x1) / 2) ** 2 + (best.mz + nz - (b.z0 + b.z1) / 2) ** 2 < (best.mx - (b.x0 + b.x1) / 2) ** 2 + (best.mz - (b.z0 + b.z1) / 2) ** 2) { nx = -nx; nz = -nz; }
          const y = Math.max(W.heightAt(best.mx + nx, best.mz + nz), b.base);
          // paint, not a beam: a flat stripe right on the wall (1 - 3 cm), so a mural (5 cm off the wall) covers it: the stripe
          // never cuts across a graffiti wall
          this.parts.push({ geometry: new THREE.BoxGeometry(best.L * 0.98, 0.6, 0.02), color: col, matrix: m4(best.mx + nx * 0.02, y + 3.4, best.mz + nz * 0.02, 0, Math.atan2(bx - ax, bz - az) + Math.PI / 2, 0) });
        }
      }
    }
    const girls = GIRLS.has(s.lm), married = s.lm === 'msh';
    const tx = -s.nz, tz = s.nx;
    const spots = [];
    for (let t = 0; t < 80 && spots.length < 4; t++) {
      const d = 6 + r() * 20, side = (r() - 0.5) * 36;
      const x = s.ex + s.nx * d + tx * side, z = s.ez + s.nz * d + tz * side;
      if (!this.free(x, z, 0.8) || spots.some((q) => Math.hypot(q[0] - x, q[1] - z) < 4.5)) continue;
      let ok = true;
      for (let a = 0; a < 6.28 && ok; a += 1.57) if (!this.free(x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6, 0.4)) ok = false;
      if (ok) spots.push([x, z]);
    }
    spots.forEach(([cx, cz], gi) => {
      const n = 2 + Math.floor(r() * 3), R = 0.7 + n * 0.1, a0 = r() * 6.28;
      const mixed = r() < 0.28;                 // friends from other hostels come by
      const guitar = gi === 0 && !married;
      const sitting = gi % 3 === 2;
      const th = 0.12 + r() * 0.85;             // how busy it must be before this group shows up
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * Math.PI * 2;
        const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
        const fem = married ? k % 2 === 0 : mixed && k === n - 1 ? !girls : girls;
        let look = married ? (k === n - 1 ? kidLook(r, { uniform: false }) : scholarLook(r, fem)) : studentLook(r, { female: fem });
        let anim = sitting ? AN.SITG : r() < 0.55 ? AN.TALK : r() < 0.6 ? AN.PHONE : AN.STAND;
        if (guitar && k === 0) { look = { ...look, opts: look.opts | bit(OPT.GUITAR) }; anim = AN.GUITAR; }
        this.add({ x, z, yaw: Math.atan2(cx - x, cz - z), look, anim, kind: 'hostel', th, cup: r() < 0.25, eveningOnly: guitar && k === 0 });
      }
    });
    // a couple of students on the steps, and a cycle being fixed
    for (let k = 0; k < 3; k++) {
      const x = s.ex + s.nx * 1.4 + tx * (k - 1) * 1.2, z = s.ez + s.nz * 1.4 + tz * (k - 1) * 1.2;
      if (this.free(x, z, 0.3)) this.add({ x, z, yaw: s.yaw, look: married ? scholarLook(r, k === 1) : studentLook(r, { female: girls }), anim: k === 1 ? AN.PHONE : AN.SIT, kind: 'hostel', th: 0.3 + k * 0.2 });
    }
  }

  density(p, h, weekend) {
    if (p.kind === 'hostel') {
      const d = h < 0.5 ? 0.12 : h < 6.3 ? 0.02 : h < 8.6 ? 0.3 : h < 12.6 ? (weekend ? 0.45 : 0.12) : h < 14.2 ? 0.45 : h < 16.8 ? (weekend ? 0.5 : 0.22) : h < 21.5 ? 0.8 : h < 22 ? 0.4 : h < 23 ? 0.22 : 0.1;
      if (p.eveningOnly && !(h > 18 && h < 23.5)) return 0;
      return d * (this.g.weather.state.rain > 0.4 ? 0.35 : 0.8);
    }
    return 1;
  }

  // ------------------------------------------------------------ Kendriya Vidyalaya
  buildSchool(S) {
    const r = this.rnd, W = this.g.world;
    const { ground: gd } = S;
    const ca = Math.cos(gd.yaw), sa = Math.sin(gd.yaw);
    const at = (u, v) => [gd.x + u * ca + v * sa, gd.z - u * sa + v * ca];
    this.schoolAt = at;
    const y = W.heightAt(gd.x, gd.z);
    // playground: packed earth, white border lines, a small stage, flag and fence
    const P = (geo, col, x, yy, z, ry = gd.yaw) => this.parts.push({ geometry: geo, color: col, matrix: m4(x, yy, z, 0, ry, 0) });
    P(new THREE.BoxGeometry(gd.w, 0.12, gd.d), '#b8a47e', gd.x, y + 0.02, gd.z);
    for (const [u, v, w, d] of [[0, gd.d / 2 - 1, gd.w - 2, 0.12], [0, -gd.d / 2 + 1, gd.w - 2, 0.12], [gd.w / 2 - 1, 0, 0.12, gd.d - 2], [-gd.w / 2 + 1, 0, 0.12, gd.d - 2]]) {
      const [x, z] = at(u, v); P(new THREE.BoxGeometry(w, 0.02, d), '#f2f0ea', x, y + 0.09, z);
    }
    // fence around three sides
    // (in 2.5 m panels, left open wherever a footpath or road crosses the line, so nobody walks through it)
    const G = this.g.graph;
    const openAt = (x, z) => { const rd = G.roadAt(x, z, 4); return (rd && rd.d < (rd.hw || 0) + 1.5) || W.buildingAt(x, z) || W.waterAt(x, z); };
    for (const v of [gd.d / 2 + 0.5, -gd.d / 2 - 0.5]) for (let u = -gd.w / 2; u < gd.w / 2 - 0.1; u += 2.5) {
      const u1 = Math.min(gd.w / 2, u + 2.5), [ax, az] = at(u, v), [bx, bz] = at(u1, v), [mx, mz] = at((u + u1) / 2, v);
      if (openAt(mx, mz) || openAt(ax, az) || openAt(bx, bz)) continue;
      for (const [x, z] of [[ax, az], [bx, bz]]) P(new THREE.BoxGeometry(0.08, 1.4, 0.08), '#3f6f4a', x, W.heightAt(x, z) + 0.7, z);
      P(new THREE.BoxGeometry(u1 - u, 0.06, 0.05), '#3f6f4a', mx, W.heightAt(mx, mz) + 1.3, mz);
      W.indexFence({ ax, az, bx, bz, top: W.heightAt(mx, mz) + 1.4 });
    }
    // assembly stage + flag pole at the school end
    const [sx, sz] = at(0, -gd.d / 2 + 3);
    P(new THREE.BoxGeometry(6, 0.7, 3), '#c9b59a', sx, y + 0.35, sz);
    const [fx, fz] = at(4.5, -gd.d / 2 + 3);
    P(new THREE.CylinderGeometry(0.05, 0.07, 8, 8), '#e8e8e8', fx, y + 4, fz);
    // the tricolour (with its Ashoka Chakra), flying from the top of the pole
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.9), new THREE.MeshStandardMaterial({ map: canvasTexture(192, 128, (g, w, h) => drawIndianFlag(g, w, h), { repeat: false }), side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.set(fx + ca * 0.7, y + 7.25, fz - sa * 0.7); flag.rotation.y = gd.yaw;
    flag.name = 'kv-indian-flag';
    this.g.scene.add(flag);
    // swings and a slide in one corner
    const [px, pz] = at(gd.w / 2 - 5, gd.d / 2 - 4);
    for (const s of [-1, 1]) P(new THREE.BoxGeometry(0.1, 2.4, 0.1), '#c62f2f', px + ca * s * 1.4, y + 1.2, pz - sa * s * 1.4);
    P(new THREE.BoxGeometry(3, 0.1, 0.1), '#c62f2f', px, y + 2.4, pz);
    const [lx, lz] = at(gd.w / 2 - 10, gd.d / 2 - 4);
    P(new THREE.BoxGeometry(0.8, 0.08, 3.4), '#f2c12e', lx, y + 1.0, lz, gd.yaw);
    this.parts[this.parts.length - 1].matrix = m4(lx, y + 1.0, lz, 0.45, gd.yaw, 0);
    // board at the gate
    this.signs.push({ x: gd.x + (S.cx - gd.x) * 0.0 + ca * (gd.w / 2 + 2), z: gd.z - sa * (gd.w / 2 + 2), yaw: gd.yaw + Math.PI / 2, text: ['केन्द्रीय विद्यालय', 'KENDRIYA VIDYALAYA', 'IIT GUWAHATI'], color: '#1f3a6e', w: 4.2, h: 1.6 });
    // school gate guard
    const [gx, gz] = at(gd.w / 2 + 1.5, gd.d / 2 - 1);
    if (this.free(gx, gz, 0.4)) { this.booth(gx, gz, gd.yaw - Math.PI / 2, 'KV SECURITY'); this.add({ x: gx + Math.sin(gd.yaw - Math.PI / 2) * 1.6, z: gz + Math.cos(gd.yaw - Math.PI / 2) * 1.6, yaw: gd.yaw - Math.PI / 2, look: adultLook(r, 'guard'), kind: 'guard', anim: AN.STAND, post: true }); }
    // pupils and teachers
    this.kids = [];
    for (let i = 0; i < 90; i++) {
      const row = i % 9, col = Math.floor(i / 9);
      const u = (row - 4) * 1.6, v = -gd.d / 2 + 7 + col * 1.1;
      const [x, z] = at(u, v);
      const k = this.add({ x, z, yaw: gd.yaw + Math.PI, look: kidLook(r), anim: AN.STAND, kind: 'kid', ax: x, az: z, gu: u, gv: v });
      this.kids.push(k);
    }
    for (let i = 0; i < 8; i++) {
      const [x, z] = at((i - 3.5) * 5, -gd.d / 2 + 5.2);
      this.add({ x, z, yaw: gd.yaw + Math.PI, look: adultLook(r, 'faculty'), anim: i === 3 ? AN.LECTURE : AN.STAND, kind: 'teacher' });
    }
    this.schoolLm = { id: 'kv', name: 'Kendriya Vidyalaya', kind: 'academic', wx: gd.x, wz: gd.z, desc: 'The Kendriya Vidyalaya on campus, where the children of the staff and faculty study. Morning assembly at 7:45, recess at 10:30, home time at 1:30.' };
  }

  // ------------------------------------------------------------ families at the quarters
  families() {
    const r = this.rnd, W = this.g.world, G = this.g.graph;
    const houses = W.buildings.filter((b) => b.kind === 'residential' && !b.site && b.area > 70 && b.area < 450);
    this.fam = [];
    for (let t = 0; t < houses.length && this.fam.length < 140; t++) {
      const b = houses[Math.floor(r() * houses.length)];
      if (b._fam) continue;
      b._fam = true;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const rd = G.roadAt(cx, cz, 60);
      if (!rd) continue;
      const nx = rd.x - cx, nz = rd.z - cz, L = Math.hypot(nx, nz) || 1;
      const ux = nx / L, uz = nz / L;
      // walk from the house centre towards the road until we are outside the wall
      let x = cx, z = cz, out = false;
      for (let d = 0; d < 40; d += 0.5) { x = cx + ux * d; z = cz + uz * d; if (!W.buildingAt(x, z)) { out = true; break; } }
      if (!out) continue;
      x += ux * 2.6; z += uz * 2.6;
      if (!this.free(x, z, 1.2) || !this.free(x + ux * 1.5, z + uz * 1.5, 1.2)) continue;
      const yaw = Math.atan2(ux, uz), sx = Math.cos(yaw), sz = -Math.sin(yaw);
      // two chairs and a little table on the porch
      this.chair(x - sx * 0.7, z - sz * 0.7, yaw + 0.35, '#e8e4da');
      this.chair(x + sx * 0.7, z + sz * 0.7, yaw - 0.35, '#e8e4da');
      this.parts.push({ geometry: new THREE.CylinderGeometry(0.3, 0.3, 0.05, 10), color: '#e8e4da', matrix: m4(x + ux * 0.6, W.heightAt(x, z) + 0.5, z + uz * 0.6) });
      this.parts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5), color: '#bbbbbb', matrix: m4(x + ux * 0.6, W.heightAt(x, z) + 0.25, z + uz * 0.6) });
      const th = r();
      const f = { x, z, yaw, th };
      this.add({ x: x - sx * 0.7, z: z - sz * 0.7, yaw: yaw + 0.35, look: familyLook(r, 'father'), anim: AN.SIT, kind: 'family', th, cup: true });
      this.add({ x: x + sx * 0.7, z: z + sz * 0.7, yaw: yaw - 0.35, look: familyLook(r, 'mother'), anim: r() < 0.5 ? AN.SIT : AN.TALK, kind: 'family', th, cup: r() < 0.6 });
      const nk = 1 + Math.floor(r() * 2);
      for (let k = 0; k < nk; k++) this.add({ x: x + ux * 3, z: z + uz * 3, yaw, look: familyLook(r, 'kid'), anim: AN.RUN, kind: 'famkid', th, cx: x + ux * 3.2 + sx * (k - 0.5) * 2, cz: z + uz * 3.2 + sz * (k - 0.5) * 2, rad: 1.2 + r() * 1.3, w: (r() < 0.5 ? -1 : 1) * (1.1 + r() * 0.8) });
      if (r() < 0.35) this.add({ x: x + ux * 1.6 - sx * 1.8, z: z + uz * 1.6 - sz * 1.8, yaw: yaw + 2.6, look: familyLook(r, 'grand'), anim: AN.STAND, kind: 'family', th });
      this.fam.push(f);
    }
  }

  // ------------------------------------------------------------ Children's Park
  /** swings, a slide, a see-saw and a merry-go-round that move, with the children using them */
  buildPark() {
    const g = this.g, W = g.world, r = this.rnd;
    const f = W.fields.find((q) => q.kind === 'park' && /Children/i.test(q.name || ''));
    if (!f) return;
    const grp = new THREE.Group();
    g.scene.add(grp);
    const yawA = Math.atan2(f.ax, f.az);                    // along the park
    const pt = (u, v) => W.fieldPoint(f, u, v);
    const L = Math.min(30, (f.len || 40) / 2 - 6);
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.25 });
    const M = { red: mat('#d23b2f'), yellow: mat('#f2c12e'), blue: mat('#2f6fb0'), green: mat('#2e8f4f'), steel: mat('#9aa3aa'), wood: mat('#8a5a36'), sand: new THREE.MeshStandardMaterial({ color: '#d8c49a', roughness: 1 }) };
    const place = (obj, u, v, yaw = yawA) => { const p = pt(u, v); obj.position.set(p.x, W.heightAt(p.x, p.z), p.z); obj.rotation.y = yaw; grp.add(obj); return obj; };
    const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
    const cyl = (a, b, h, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(a, b, h, 10), m); o.position.set(x, y, z); o.castShadow = true; return o; };
    this.park = { swings: [], kids: [], f };
    // sandpit under everything
    const sand = place(new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 0.06, 32), M.sand), 0, 0); sand.position.y += 0.03; sand.scale.set(Math.min(1.6, L / 12), 1, 0.8);
    // swings: an A-frame with three seats
    const sw = place(new THREE.Group(), -L * 0.6, 0);
    for (const sx of [-1.9, 1.9]) for (const sz of [-0.8, 0.8]) { const leg = cyl(0.05, 0.05, 2.7, M.red, sx, 1.3, sz * 0.5); leg.rotation.x = sz > 0 ? -0.3 : 0.3; sw.add(leg); }
    sw.add(cyl(0.05, 0.05, 3.9, M.red, 0, 2.55, 0)); sw.children[sw.children.length - 1].rotation.z = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const piv = new THREE.Group(); piv.position.set(-1.2 + i * 1.2, 2.5, 0); sw.add(piv);
      for (const sx of [-0.2, 0.2]) piv.add(box(0.02, 1.95, 0.02, M.steel, sx, -0.98, 0));
      piv.add(box(0.46, 0.04, 0.2, M.yellow, 0, -1.95, 0));
      this.park.swings.push({ piv, ph: r() * 6, amp: 0.35 + r() * 0.35, w: 2.2 + r() * 0.2 });
    }
    // slide: ladder, platform and a chute
    const sl = place(new THREE.Group(), -L * 0.15, 3);
    for (const sx of [-0.35, 0.35]) sl.add(cyl(0.04, 0.04, 1.8, M.blue, sx, 0.9, -0.9));
    for (let k = 1; k < 6; k++) sl.add(box(0.7, 0.03, 0.05, M.steel, 0, k * 0.3, -0.9));
    sl.add(box(0.9, 0.08, 0.9, M.blue, 0, 1.65, -0.5));
    const chute = box(0.6, 0.05, 3.2, M.yellow, 0, 0.9, 1.25); chute.rotation.x = 0.5; sl.add(chute);
    for (const sx of [-0.32, 0.32]) { const rail = box(0.04, 0.18, 3.2, M.yellow, sx, 1.0, 1.25); rail.rotation.x = 0.5; sl.add(rail); }
    // see-saw
    const ss = place(new THREE.Group(), L * 0.2, -3);
    ss.add(box(0.3, 0.5, 0.3, M.green, 0, 0.25, 0));
    const plank = new THREE.Group(); plank.position.y = 0.55; ss.add(plank);
    plank.add(box(3.6, 0.07, 0.3, M.red));
    for (const sx of [-1.6, 1.6]) plank.add(box(0.06, 0.25, 0.3, M.steel, sx - Math.sign(sx) * 0.25, 0.15, 0));
    this.park.plank = plank;
    // merry-go-round
    const mg = place(new THREE.Group(), L * 0.62, 1);
    mg.add(cyl(0.12, 0.2, 0.3, M.steel, 0, 0.15, 0));
    const disc = new THREE.Group(); disc.position.y = 0.32; mg.add(disc);
    disc.add(cyl(1.6, 1.6, 0.08, M.blue));
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; disc.add(cyl(0.03, 0.03, 0.8, M.yellow, Math.cos(a) * 1.3, 0.42, Math.sin(a) * 1.3)); }
    disc.add(cyl(1.3, 1.3, 0.04, M.yellow, 0, 0.82, 0)).scale.set(1, 1, 1);
    this.park.disc = disc;
    // benches for the parents and the park board
    for (const u of [-L * 0.35, L * 0.4]) {
      const b = place(new THREE.Group(), u, (f.wid || 30) / 2 - 3, yawA + Math.PI / 2);
      b.add(box(1.8, 0.06, 0.45, M.wood, 0, 0.45, 0)); b.add(box(1.8, 0.4, 0.06, M.wood, 0, 0.72, -0.22));
      for (const sx of [-0.8, 0.8]) b.add(box(0.08, 0.45, 0.4, M.steel, sx, 0.22, 0));
    }
    const bp = pt(-L - 2, -(f.wid || 30) / 2 + 2);
    this.signs.push({ x: bp.x, z: bp.z, yaw: yawA, text: ["CHILDREN'S PARK", 'IIT GUWAHATI'], color: '#2e7d4f', w: 3.2, h: 1.1 });
    grp.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    this.parkGroup = grp;
    // children: three on the swings, two on the see-saw, three on the merry-go-round, one on the slide, runners
    const kid = (o) => this.add({ look: kidLook(r, { uniform: false }), kind: 'park', anim: AN.SIT, x: 0, z: 0, yaw: yawA, ...o });
    this.park.swings.forEach((s, i) => kid({ ride: 'swing', i }));
    for (const sd of [-1, 1]) kid({ ride: 'seesaw', sd });
    for (let k = 0; k < 3; k++) kid({ ride: 'mgr', a: (k / 3) * Math.PI * 2 });
    kid({ ride: 'mgrPush' });
    kid({ ride: 'slide' });
    for (let k = 0; k < 5; k++) { const c = pt((r() - 0.5) * L, (r() - 0.5) * 10); kid({ ride: 'run', cx: c.x, cz: c.z, rad: 2 + r() * 3, w: (r() < 0.5 ? -1 : 1) * (2 + r()) }); }
    for (let k = 0; k < 5; k++) {
      const c = pt((r() - 0.5) * L * 1.6, ((f.wid || 30) / 2 - 4.5) * (k % 2 ? 1 : -1));
      this.add({ look: k % 2 ? familyLook(r, 'mother') : familyLook(r, 'father'), kind: 'park', ride: 'parent', x: c.x, z: c.z, yaw: Math.atan2(f.cx - c.x, f.cz - c.z), anim: k === 2 ? AN.PHONE : k === 4 ? AN.TALK : AN.STAND });
    }
    this.parkLm = { pt, yawA, L, sw, sl, ss, mg };
  }

  parkStep(t, dt) {
    const P = this.park, W = this.g.world;
    if (!P) return;
    const { sw, sl, ss, mg, yawA } = this.parkLm;
    const busy = this.parkBusy;
    // the rides move whether or not anyone is watching closely
    for (const s of P.swings) { const a = busy ? Math.sin(t * s.w + s.ph) * s.amp : s.piv.rotation.x * (1 - dt * 0.5); s.piv.rotation.x = a; }
    if (P.plank) P.plank.rotation.z = busy ? Math.sin(t * 1.4) * 0.3 : 0;
    if (P.disc) P.disc.rotation.y += (busy ? 1.4 : 0.1) * dt;
    const v = new THREE.Vector3();
    for (const p of this.people) {
      if (p.kind !== 'park' || !p.visible || p.ride === 'parent') continue;
      if (p.ride === 'swing') {
        const s = P.swings[p.i];
        v.set(0, -1.9, 0.05).applyAxisAngle(new THREE.Vector3(1, 0, 0), s.piv.rotation.x).add(s.piv.position);
        sw.localToWorld(v);
        p.x = v.x; p.z = v.z; p.y = v.y - 0.55 * p.look.scale; p.anim = AN.SIT;
        p.yaw = sw.rotation.y; continue;
      }
      if (p.ride === 'seesaw') {
        v.set(p.sd * 1.45, 0.55 + Math.sin(P.plank.rotation.z) * p.sd * 1.45 + 0.05, 0);
        ss.localToWorld(v);
        p.x = v.x; p.z = v.z; p.y = v.y - 0.55 * p.look.scale; p.yaw = ss.rotation.y - p.sd * Math.PI / 2; p.anim = AN.SIT; continue;
      }
      if (p.ride === 'mgr' || p.ride === 'mgrPush') {
        const a = p.ride === 'mgr' ? p.a + P.disc.rotation.y : P.disc.rotation.y + 0.5;
        const R = p.ride === 'mgr' ? 1.1 : 1.95;
        v.set(Math.cos(a) * R, p.ride === 'mgr' ? 0.36 : 0, -Math.sin(a) * R);
        mg.localToWorld(v);
        p.x = v.x; p.z = v.z;
        p.y = p.ride === 'mgr' ? v.y - 0.55 * p.look.scale + 0.06 : W.heightAt(v.x, v.z);
        p.yaw = mg.rotation.y + a + (p.ride === 'mgr' ? Math.PI : Math.PI);
        p.anim = p.ride === 'mgr' ? AN.SIT : AN.RUN; p.speed = 2.2; p.phase += dt * 6;
        continue;
      }
      if (p.ride === 'slide') {
        // up the ladder, down the chute, run round to the ladder again (8 s loop)
        const k = (t * 0.125 + p.seed) % 1;
        if (k < 0.3) { v.set(0, (k / 0.3) * 1.6, -1.2); p.anim = AN.WALK; p.yaw = sl.rotation.y; }
        else if (k < 0.45) { const q = (k - 0.3) / 0.15; v.set(0, 1.7 - q * 1.5 + 0.05, -0.3 + q * 2.9); p.anim = AN.SIT; p.yaw = sl.rotation.y; }
        else { const q = (k - 0.45) / 0.55; const ang = q * Math.PI * 2; v.set(Math.sin(ang) * 1.6, 0, 1.1 - q * 2.2 + Math.cos(ang) * 0.3); p.anim = AN.RUN; p.yaw = sl.rotation.y + Math.PI + ang; }
        sl.localToWorld(v);
        p.x = v.x; p.z = v.z; p.y = p.anim === AN.SIT ? v.y - 0.55 * p.look.scale + 0.05 : p.anim === AN.WALK ? v.y : W.heightAt(v.x, v.z);
        p.speed = 2; p.phase += dt * 7;
        continue;
      }
      if (p.ride === 'run') {
        p.ang = (p.ang ?? p.seed * 6) + p.w * dt / p.rad;
        const nx = p.cx + Math.cos(p.ang) * p.rad, nz = p.cz + Math.sin(p.ang) * p.rad;
        p.yaw = Math.atan2(nx - p.x, nz - p.z); p.x = nx; p.z = nz; p.y = W.heightAt(nx, nz);
        p.anim = AN.RUN; p.speed = Math.abs(p.w); p.phase += dt * p.speed / 2.2 * 6.28;
      }
    }
  }

  // ------------------------------------------------------------ the swimming pool
  /** swimmers doing lengths in the lanes (mornings and evenings), a lifeguard on a high chair */
  poolLife() {
    const W = this.g.world, r = this.rnd;
    const w = W.water.find((q) => q.kind === 'pool');
    if (!w) return;
    const ring = w.rings[0];
    // the pool's long axis: its longest edge
    let best = null;
    for (let i = 0; i < ring.length; i += 2) { const j = (i + 2) % ring.length, L = Math.hypot(ring[j] - ring[i], ring[j + 1] - ring[i + 1]); if (!best || L > best.L) best = { L, ax: (ring[j] - ring[i]) / L, az: (ring[j + 1] - ring[i + 1]) / L }; }
    let cx = 0, cz = 0; for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cz += ring[i + 1]; } cx /= ring.length / 2; cz /= ring.length / 2;
    const { ax, az } = best;
    // extent along and across the axis
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < ring.length; i += 2) { const dx = ring[i] - cx, dz = ring[i + 1] - cz, u = dx * ax + dz * az, v = -dx * az + dz * ax; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    this.pool = { w, cx, cz, ax, az, u0: u0 + 1.2, u1: u1 - 1.2 };
    const lanes = Math.max(2, Math.min(8, Math.floor((v1 - v0) / 2.0)));
    for (let k = 0; k < lanes * 2; k++) {
      const lane = k % lanes, v = v0 + (lane + 0.5) * ((v1 - v0) / lanes);
      this.add({ x: cx, z: cz, yaw: 0, look: swimLook(r), anim: AN.SWIM, kind: 'swim', lane: v, s: r(), dir: r() < 0.5 ? 1 : -1, sp: 0.8 + r() * 0.6, th: r() });
    }
    // two resting at the shallow end, arms on the edge, chatting
    for (const side of [-0.6, 0.6]) {
      const u = u0 + 0.55, v = (v0 + v1) / 2 + side * ((v1 - v0) / 3), x = cx + ax * u - az * v, z = cz + az * u + ax * v;
      const p = this.add({ x, z, yaw: Math.atan2(-ax, -az), look: swimLook(r), anim: AN.POOLREST, kind: 'poolrest' });
      p.y = w.level - 1.2;
    }
    // lifeguard on the deck
    const lx = cx + ax * (u1 + 1.5) - az * (v1 + 1.2), lz = cz + az * (u1 + 1.5) + ax * (v1 + 1.2);
    this.chair(lx, lz, Math.atan2(cx - lx, cz - lz), '#f2c12e');
    const L = adultLook(r, 'staff'); L.col0[1] = pal('#c62828');
    this.add({ x: lx, z: lz, yaw: Math.atan2(cx - lx, cz - lz), look: L, anim: AN.SIT, kind: 'lifeguard' });
    this.meetPeople();
  }

  // ------------------------------------------------------------ the inter-hostel aquatics meet (4 - 7 PM)
  /** eight swimmers in their hostels' caps on the blocks, the next heat warming up, a starter with a
   *  whistle, timekeepers at the table, a coach and a crowd on the stand. The heats run in meetStep. */
  meetPeople() {
    const PO = this.g.poolObj, r = this.rnd;
    if (!PO?.blocks?.length) return;
    const P = PO.plan, yawU = Math.atan2(P.ax, P.az);
    const HOST = Object.keys(HOSTEL_COLORS).filter((k) => k !== 'msh');
    const racers = PO.blocks.map((b) => {
      const L = swimLook(r, { female: false });
      const hostel = HOST[(b.lane * 5 + 3) % HOST.length];
      L.col1[0] = pal(HOSTEL_COLORS[hostel]);                       // the cap in the hostel's colour
      const p = this.add({ x: b.x, z: b.z, yaw: yawU, look: L, anim: AN.STAND, kind: 'meet', role: 'racer', block: b, lane: b.lane, hostel });
      p.y = P.deckY;
      return p;
    });
    for (const [x, z] of PO.warm) { const p = this.add({ x, z, yaw: yawU, look: swimLook(r, { female: false }), anim: AN.STRETCH, kind: 'meet', role: 'warmup' }); p.y = P.deckY; }
    const coach = adultLook(r, 'staff'); coach.col0[1] = pal('#12436b'); coach.col0[3] = pal('#12436b'); coach.opts |= bit(OPT.CAP); coach.col1[3] = C.white;
    { const [x, z] = PO.coach; const p = this.add({ x, z, yaw: yawU + Math.PI, look: coach, anim: AN.TALK, kind: 'meet', role: 'staff' }); p.y = P.deckY; }
    const starter = adultLook(r, 'staff'); starter.col0[1] = C.white; starter.opts |= bit(OPT.CAP); starter.col1[3] = C.red;
    { const [x, z] = PO.starter; const p = this.add({ x, z, yaw: Math.atan2(-P.az, P.ax), look: starter, anim: AN.STAND, kind: 'meet', role: 'starter' }); p.y = P.deckY; this.starter = p; }
    for (const [x, z] of PO.officials) { const o = adultLook(r, 'staff'); o.col0[1] = C.white; o.opts |= bit(OPT.BOOK); const p = this.add({ x, z, yaw: yawU, look: o, anim: AN.SIT, kind: 'meet', role: 'staff' }); p.y = P.deckY; }
    const fans = [];
    PO.fans.forEach((f, i) => { if (i % 3 === 1) return; const p = this.add({ x: f.x, z: f.z, yaw: f.yaw, look: studentLook(r), anim: AN.SIT, kind: 'meet', role: 'fan' }); p.y = f.y; fans.push(p); });
    this.meet = { racers, fans, heat: 1, state: 'marshal', t: 0, P, yawU, len: P.u1 - P.u0 - 0.4 };
  }

  meetOn(h) { return !!this.meet && h >= 16 && h < 19 && !(this.g.weather.state.rain > 0.6); }

  meetStep(dt) {
    const M = this.meet, P = M.P, g = this.g;
    M.t += dt;
    const go = (s) => { M.state = s; M.t = 0; };
    const level = P.level;
    if (M.state === 'marshal') {
      for (const p of M.racers) { const b = p.block; p.x = b.x - P.ax * 0.9; p.z = b.z - P.az * 0.9; p.y = P.deckY; p.yaw = M.yawU; p.anim = AN.STRETCH; }
      if (M.t > 9) { go('set'); g.ui && Math.hypot(g.player.pos.x - P.cx, g.player.pos.z - P.cz) < 60 && g.ui.floatText?.(`Heat ${M.heat}: take your marks`, 'xp'); }
    } else if (M.state === 'set') {
      for (const p of M.racers) { const b = p.block; p.x = b.x; p.z = b.z; p.y = b.y; p.yaw = M.yawU; p.anim = M.t > 1.2 ? AN.MARKS : AN.STAND; }   // "take your marks": the grab start
      if (this.starter) this.starter.anim = AN.WAVE;
      if (M.t > 3) {
        go('dive');
        const near = Math.hypot(g.player.pos.x - P.cx, g.player.pos.z - P.cz) < 90;
        if (near) { g.audio.tone?.(2900, 0.35, { type: 'square', gain: 0.05 }); g.audio.tone?.(3100, 0.35, { type: 'square', gain: 0.03 }); }
        for (const p of M.racers) { p.dist = 0; p.sp = 1.5 + this.rnd() * 0.45; p.done = 0; }
        M.start = performance.now();
      }
    } else if (M.state === 'dive') {
      const k = Math.min(1, M.t / 0.8);
      for (const p of M.racers) { const b = p.block; p.x = b.x + P.ax * k * 3; p.z = b.z + P.az * k * 3; p.y = b.y + (level - 0.24 - b.y) * k + Math.sin(k * Math.PI) * 0.7; p.anim = AN.SWIM; p.extra = 1; p.dist = k * 3; }
      if (this.starter) this.starter.anim = AN.STAND;
      if (k >= 1) go('race');
    } else if (M.state === 'race') {
      let finished = 0;
      for (const p of M.racers) {
        const b = p.block;
        if (!p.done) {
          p.dist += (p.sp + Math.sin(M.t * 1.3 + p.lane * 2) * 0.08) * dt;
          if (p.dist >= M.len) { p.dist = M.len; p.done = M.t + 0.8; }
          p.anim = AN.SWIM; p.extra = p.dist < 5 ? 1 : 0; p.y = level - 0.24; p.speed = p.sp; p.phase += dt * 2.9 * p.sp;
          if (Math.random() < dt * 2 && g.splash) g.splash.ripple(p.x, level, p.z, 0.6);
        } else { finished++; p.anim = AN.POOLREST; p.extra = 0; p.y = level - 1.2; }
        p.x = b.x + P.ax * (p.dist + 0.55); p.z = b.z + P.az * (p.dist + 0.55); p.yaw = M.yawU;
      }
      for (const f of M.fans) f.anim = AN.CHEER;
      if (finished === M.racers.length || M.t > 80) {
        const res = M.racers.slice().sort((a, b) => (a.done || 99) - (b.done || 99));
        const fmt = (s) => `00:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`;
        g.poolObj.setBoard(`HEAT ${M.heat} · FREESTYLE · ONE LENGTH · RESULT`, ['POS LANE HOSTEL        TIME', ...res.map((p, i) => `${i + 1}   ${p.lane + 1}    ${p.hostel.toUpperCase().padEnd(12)} ${fmt(p.done)}`)]);
        if (Math.hypot(g.player.pos.x - P.cx, g.player.pos.z - P.cz) < 80) g.ui.toast(`Heat ${M.heat}: ${res[0].hostel[0].toUpperCase() + res[0].hostel.slice(1)} wins in ${fmt(res[0].done)}!`, 'gold', 'Aquatics meet');
        go('results');
      }
    } else if (M.state === 'results') {
      for (const f of M.fans) f.anim = M.t < 4 ? AN.CLAP : AN.SIT;
      if (M.t > 10) {
        M.heat++;
        // the next heat: new hostels in the lanes
        const HOST = Object.keys(HOSTEL_COLORS).filter((k) => k !== 'msh');
        for (const p of M.racers) { p.hostel = HOST[(p.lane * 5 + 3 + M.heat * 3) % HOST.length]; p.look.col1[0] = pal(HOSTEL_COLORS[p.hostel]); }
        g.poolObj.setBoard(`HEAT ${M.heat} · FREESTYLE · ONE LENGTH`, ['LANE  HOSTEL        TIME', ...M.racers.map((p) => `  ${p.lane + 1}   ${p.hostel.toUpperCase().padEnd(12)} --:--.--`)]);
        go('marshal');
      }
    }
  }

  swimStep(p, dt) {
    const P = this.pool;
    const len = P.u1 - P.u0;
    p.s += (p.dir * p.sp * dt) / len;
    if (p.s > 1) { p.s = 1; p.dir = -1; } else if (p.s < 0) { p.s = 0; p.dir = 1; }
    const u = P.u0 + p.s * len;
    p.x = P.cx + P.ax * u - P.az * p.lane; p.z = P.cz + P.az * u + P.ax * p.lane;
    p.y = P.w.level - 0.24;                  // lying flat: the back just at the surface, the head and the recovering arm out
    p.yaw = Math.atan2(P.ax * p.dir, P.az * p.dir);
    p.phase += dt * 2.6 * p.sp; p.speed = p.sp;
    if (Math.random() < dt * 1.5 && this.g.splash) this.g.splash.ripple(p.x, P.w.level, p.z, 0.5);
  }

  // ------------------------------------------------------------ outside the gates
  /** shopkeepers and customers at the Main Gate market and Khokha market, auto drivers at the stand */
  outsideLife(O) {
    const r = this.rnd, W = this.g.world;
    const around = (x, z, yaw, n, look, when, anims) => {
      for (let k = 0; k < n; k++) {
        const a = yaw + (r() - 0.5) * 2.4, d = 1.6 + r() * 2.2;
        const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
        if (W.buildingAt(px, pz) || this.g.graph.onRoad(px, pz, 0.3)) continue;
        this.add({ x: px, z: pz, yaw: Math.atan2(x - px, z - pz) + (r() - 0.5), look: look(), anim: anims[Math.floor(r() * anims.length)], kind: 'outside', when, th: r(), cup: r() < 0.4 });
      }
    };
    // Khokha market: students in the evening (it is just outside Khokha Gate), vendors all day
    for (const s of O.khokha) {
      this.add({ x: s.x, z: s.z, yaw: s.yaw, look: adultLook(r, 'staff'), anim: AN.SERVE, kind: 'outside', when: (h) => h > 7 && h < 22.5 ? 1 : 0, th: 0 });
      const fx = s.x + Math.sin(s.yaw) * 2.2, fz = s.z + Math.cos(s.yaw) * 2.2;
      around(fx, fz, s.yaw, 5, () => studentLook(r), (h) => (h > 16.5 && h < 22 ? 0.95 : h > 7 && h < 16.5 ? 0.35 : 0), [AN.TALK, AN.TALK, AN.PHONE, AN.STAND]);
    }
    // Main Gate market: shopkeepers and people from the neighbourhood
    for (const s of O.market) {
      const q = this.g.graph.roadAt(s.x, s.z, 30);
      const yaw = q ? Math.atan2(q.x - s.x, q.z - s.z) : 0;
      const fx = s.x + Math.sin(yaw) * 2.6, fz = s.z + Math.cos(yaw) * 2.6;
      this.add({ x: fx, z: fz, yaw: yaw, look: adultLook(r, 'staff'), anim: r() < 0.5 ? AN.SERVE : AN.STAND, kind: 'outside', when: (h) => (h > 6.5 && h < 22 ? 1 : /24/.test(s.name) ? 1 : 0), th: 0 });
      around(fx + Math.sin(yaw) * 1.5, fz + Math.cos(yaw) * 1.5, yaw + Math.PI, 2, () => adultLook(r, r() < 0.5 ? 'parent' : 'staff'), (h) => (h > 7 && h < 21 ? 0.8 : 0.1), [AN.TALK, AN.STAND, AN.PHONE]);
    }
    // auto stand just outside the Main Gate: parked autos, drivers chatting
    const mg = O.links.find((l) => l.g.main);
    if (mg) {
      const bx = mg.g.wx + mg.out[0] * 40, bz = mg.g.wz + mg.out[1] * 40, tx = -mg.out[1], tz = mg.out[0];
      for (let k = 0; k < 4; k++) {
        const x = bx + tx * (9 + k * 2.2), z = bz + tz * (9 + k * 2.2);
        if (this.g.graph.onRoad(x, z, 0.5) || W.buildingAt(x, z)) continue;
        const a = makeErick(k % 2 ? 'auto' : 'erick');
        a.group.position.set(x, W.heightAt(x, z), z); a.group.rotation.y = Math.atan2(mg.out[0], mg.out[1]);
        this.g.scene.add(a.group);
        this.add({ x: x + mg.out[0] * 2.2, z: z + mg.out[1] * 2.2, yaw: Math.atan2(-tx, -tz), look: adultLook(r, 'staff'), anim: k % 2 ? AN.TALK : AN.PHONE, kind: 'outside', when: (h) => (h > 6 && h < 23 ? 1 : 0.3), th: 0 });
      }
    }
  }

  /** warm light at night: a bulb over every guard cabin, pools of light at hostel doors, stalls and shops */
  buildGlows(game) {
    const W = game.world, pts = [];
    for (const p of this.posts) pts.push([p.x + Math.sin(p.yaw) * 1.6, p.z + Math.cos(p.yaw) * 1.6, 1, true]);
    for (const s of W.sites) pts.push([s.ex + s.nx * 2.5, s.ez + s.nz * 2.5, s.kind === 'hostel' ? 1.2 : 0.9, false]);
    for (const st of game.props.stalls || []) pts.push([st.x + Math.sin(st.yaw) * 1.8, st.z + Math.cos(st.yaw) * 1.8, 0.8, false]);
    for (const m of game.outside?.market || []) pts.push([m.x, m.z, 0.9, false]);
    for (const k of game.outside?.khokha || []) pts.push([k.x, k.z, 0.9, false]);
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,205,130,0.85)'); gr.addColorStop(0.45, 'rgba(255,180,100,0.25)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    this.glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), this.glowMat, pts.length);
    this.bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc070, emissiveIntensity: 0 });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), this.bulbMat, pts.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3();
    let nb = 0;
    pts.forEach(([x, z, s, bulb], i) => {
      const y = W.heightAt(x, z);
      M.compose(V.set(x, y + 0.26, z), Q.identity(), S.set(s, 1, s)); pools.setMatrixAt(i, M);
      M.compose(V.set(x, y + (bulb ? 2.5 : 3.2), z), Q.identity(), S.set(1, 1, 1)); bulbs.setMatrixAt(nb++, M);
    });
    bulbs.count = nb;
    game.scene.add(pools, bulbs);
  }

  // ------------------------------------------------------------ props
  booth(x, z, yaw, label) {
    const W = this.g.world, y = W.heightAt(x, z);
    const sx = Math.cos(yaw), sz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
    const P = (geo, col, lx, ly, lz) => this.parts.push({ geometry: geo, color: col, matrix: m4(x + sx * lx + fx * lz, y + ly, z + sz * lx + fz * lz, 0, yaw, 0) });
    P(new THREE.BoxGeometry(1.9, 0.2, 1.9), '#9a9a94', 0, 0.1, 0);
    P(new THREE.BoxGeometry(1.6, 1.0, 1.6), '#3a5f8a', 0, 0.7, 0);          // blue lower half
    P(new THREE.BoxGeometry(1.6, 1.0, 1.6), '#e8e4da', 0, 1.7, 0);          // cream upper half
    for (const [lx, lz, w, d] of [[0, 0.81, 1.2, 0.02], [0.81, 0, 0.02, 1.1], [-0.81, 0, 0.02, 1.1]]) P(new THREE.BoxGeometry(w, 0.7, d), '#2a3a44', lx, 1.7, lz);   // windows
    P(new THREE.BoxGeometry(2.2, 0.12, 2.2), '#b3262f', 0, 2.26, 0);
    P(new THREE.BoxGeometry(1.8, 0.1, 1.8), '#b3262f', 0, 2.36, 0);
    P(new THREE.BoxGeometry(0.02, 1.8, 0.7), '#6b4a33', -0.81, 1.1, -0.35);   // door on the side
    this.signs.push({ x: x + fx * 0.83, z: z + fz * 0.83, y: y + 2.02, yaw, text: [label], color: '#1f2a44', w: 1.4, h: 0.28, small: true });
  }

  chair(x, z, yaw, col) {
    const y = this.g.world.heightAt(x, z);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    (this.seatsOut ||= []).push({ x: x - fx * 0.1, z: z - fz * 0.1, yaw, seat: true, chair: true, taken: null });     // you can sit on it
    this.parts.push({ geometry: new THREE.BoxGeometry(0.45, 0.05, 0.45), color: col, matrix: m4(x, y + 0.44, z, 0, yaw, 0) });
    this.parts.push({ geometry: new THREE.BoxGeometry(0.45, 0.45, 0.05), color: col, matrix: m4(x - fx * 0.22, y + 0.68, z - fz * 0.22, -0.12, yaw, 0) });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.parts.push({ geometry: new THREE.BoxGeometry(0.04, 0.44, 0.04), color: col, matrix: m4(x + Math.cos(yaw) * a * 0.19 + fx * b * 0.19, y + 0.22, z - Math.sin(yaw) * a * 0.19 + fz * b * 0.19, 0, yaw, 0) });
  }

  barrier(x, z, yaw) {
    const y = this.g.world.heightAt(x, z);
    const sx = Math.cos(yaw), sz = -Math.sin(yaw);
    this.parts.push({ geometry: new THREE.BoxGeometry(0.3, 1.0, 0.3), color: '#e8e4da', matrix: m4(x + sx * 2.6, y + 0.5, z + sz * 2.6) });
    // raised boom, striped red / white
    for (let k = 0; k < 5; k++) {
      const t = 0.3 + k * 0.5;
      this.parts.push({ geometry: new THREE.BoxGeometry(0.5, 0.09, 0.09), color: k % 2 ? '#f2f0ea' : '#c62828', matrix: m4(x + sx * (2.6 - Math.cos(1.2) * t), y + 1.0 + Math.sin(1.2) * t, z + sz * (2.6 - Math.cos(1.2) * t), 0, yaw, 1.2) });
    }
  }

  buildSigns() {
    // every board shares one canvas atlas: one row per sign
    const list = this.signs;
    if (!list.length) return;
    // every row has the proportions of its own board (a 4.2 x 1.6 m board is not a 4 : 1 strip: squeezing one into the other
    // stretched the letters), with a margin inside the frame, and the lines spaced evenly in what is left
    const RW = 768, RHs = list.map((s) => Math.max(96, Math.round(RW * s.h / s.w))), y0s = [];
    let rows = 0; for (const h of RHs) { y0s.push(rows); rows += h; }
    const tex = canvasTexture(RW, rows, (g) => {
      list.forEach((s, i) => {
        const y0 = y0s[i], RH = RHs[i], pad = Math.round(RH * 0.17);
        g.fillStyle = s.color; g.fillRect(0, y0, RW, RH);
        g.strokeStyle = '#f2f0ea'; g.lineWidth = Math.max(5, Math.round(RH * 0.045)); g.strokeRect(g.lineWidth, y0 + g.lineWidth, RW - g.lineWidth * 2, RH - g.lineWidth * 2);
        g.fillStyle = '#f7f1e3'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const n = s.text.length, pitch = (RH - pad * 2) / n, fs = Math.min(pitch * 0.74, n === 1 ? RH * 0.5 : RH * 0.3);
        g.font = `700 ${Math.round(fs)}px "Hind", "Segoe UI", system-ui, sans-serif`;
        s.text.forEach((t, k) => g.fillText(t, RW / 2, y0 + pad + pitch * (k + 0.5), RW - pad * 2));
      });
    }, { repeat: false });
    const pos = [], uv = [], idx = [];
    const W = this.g.world;
    list.forEach((s, i) => {
      const y = s.y ?? W.heightAt(s.x, s.z) + 1.3 + s.h / 2;
      const sx = Math.cos(s.yaw), sz = -Math.sin(s.yaw), fx = Math.sin(s.yaw) * 0.03, fz = Math.cos(s.yaw) * 0.03;
      const hw = s.w / 2, hh = s.h / 2, b = pos.length / 3;
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pos.push(s.x + sx * hw * u + fx, y + hh * v, s.z + sz * hw * u + fz);
      const v0 = 1 - (y0s[i] + RHs[i]) / rows, v1 = 1 - y0s[i] / rows;
      uv.push(0, v0, 1, v0, 1, v1, 0, v1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      if (!s.small && s.y == null) {
        // two posts under a free-standing board
        const gy = W.heightAt(s.x, s.z), ph = y - hh - gy + 0.1;
        for (const u of [-0.8, 0.8]) {
          const m = new THREE.Mesh(POST, POSTMAT);
          m.position.set(s.x + sx * hw * u - fx * 3, gy + ph / 2, s.z + sz * hw * u - fz * 3);
          m.scale.y = ph;
          this.g.scene.add(m);
        }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
    this.g.scene.add(m);
    this.signMesh = m;
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.g, h = g.clock.hour, wk = g.clock.weekend, night = h > 19 || h < 5.8;
    if (this.glowMat) { const k = g.sky.state.night; this.glowMat.opacity = k * 0.75; this.bulbMat.emissiveIntensity = k * 2.6; }
    const cam = g.camera.position, t = g.time;
    this.visT -= dt;
    const recheck = this.visT <= 0;
    if (recheck) this.visT = 0.8;
    const rain = g.weather.state.rain > 0.4;
    if (recheck) this.parkBusy = !rain && ((h > 16 && h < 18.9) || (wk && h > 8 && h < 11.5) || (h > 6.2 && h < 7.2));
    if (this.park) { const f = this.park.f; if (Math.hypot(f.cx - cam.x, f.cz - cam.z) < 300) this.parkStep(t, dt); }
    if (this.meet && this.meetOn(h) && Math.hypot(this.meet.P.cx - cam.x, this.meet.P.cz - cam.z) < 320) this.meetStep(dt);
    for (const p of this.people) {
      if (recheck) {
        const d2 = (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2;
        p.near = d2 < 320 * 320;
        if (p.kind === 'hostel') p.visible = p.th < this.density(p, h, wk) * (rain ? 0.2 : 1);
        else if (p.kind === 'family' || p.kind === 'famkid') p.visible = !rain && ((h > 16.6 && h < 19.4 && p.th < 0.7) || (wk && h > 8 && h < 11 && p.th < 0.45) || (p.kind === 'family' && h > 6 && h < 7 && p.th < 0.15));
        else if (p.kind === 'kid' || p.kind === 'teacher') p.visible = this.schoolVisible(p, h, wk);
        else if (p.kind === 'park') p.visible = this.parkBusy;
        else if (p.kind === 'outside') p.visible = p.th < p.when(h) && !(rain && p.th > 0.2);
        else if (p.kind === 'swim') p.visible = (h > 6 && h < 9 ? p.th < 0.9 : h > 16 && h < 20 ? p.th < 1 : h > 9 && h < 16 ? p.th < 0.25 : false) && !(this.g.weather.state.rain > 0.6) && !this.meetOn(h);
        else if (p.kind === 'meet') p.visible = this.meetOn(h);
        else if (p.kind === 'poolrest') p.visible = h > 6 && h < 20 && !this.meetOn(h);
        else if (p.kind === 'lifeguard') p.visible = h > 6 && h < 20;
        else p.visible = true;
      }
      if (!p.visible || !p.near) continue;
      if (p.kind === 'guard') {
        // guards: sit for a while, stand for a while; torches at night; waving the traffic through
        if (p.sitSpot) {
          const sit = Math.sin(t * 0.013 + p.seed * 40) > 0.35 || (h > 1 && h < 5);
          p.x = sit ? p.sitSpot.x : p.hx; p.z = sit ? p.sitSpot.z : p.hz;
          p.anim = sit ? AN.SIT : AN.STAND;
        } else if (p.wave) p.anim = Math.sin(t * 0.4 + p.seed * 20) > 0.3 && !(h > 23 || h < 5.5) ? AN.WAVE : AN.STAND;
        p.torch = night;
        p.y = g.world.heightAt(p.x, p.z);
      } else if (p.kind === 'famkid') {
        p.ang = (p.ang ?? p.seed * 6) + p.w * dt / p.rad;
        const nx = p.cx + Math.cos(p.ang) * p.rad, nz = p.cz + Math.sin(p.ang) * p.rad;
        p.yaw = Math.atan2(nx - p.x, nz - p.z); p.x = nx; p.z = nz;
        p.speed = Math.abs(p.w); p.phase += dt * p.speed / 2.2 * 6.28;
        p.y = g.world.heightAt(p.x, p.z);
      } else if (p.kind === 'kid') this.kidStep(p, h, dt);
      else if (p.kind === 'swim') this.swimStep(p, dt);
    }
  }

  schoolVisible(p, h, wk) {
    if (!this.school || wk) return false;
    return (h > 7.3 && h < 8.4) || (h > 10.45 && h < 10.95) || (h > 11.6 && h < 12.3 && p.kind === 'kid' && p.seed < 0.35) || (h > 11.6 && h < 12.3 && p.kind === 'teacher' && p.seed < 0.2) || (h > 13.4 && h < 13.9);
  }

  kidStep(p, h, dt) {
    const W = this.g.world, at = this.schoolAt, gd = this.school.ground;
    let tx, tz, run = false;
    if (h < 7.8 || (h > 13.4)) {             // arriving / going home: walk between the gate and the door
      const home = h > 13.4;
      const [gx, gz] = at(gd.w / 2 + 1, gd.d / 2 - 2 - p.seed * 4), [dx, dz] = at(-4 + p.seed * 8, -gd.d / 2 - 1);
      const f = home ? (h - 13.4) / 0.5 : (h - 7.3) / 0.5;
      const k = clamp(f * 1.4 - p.seed * 0.4, 0, 1);
      const a = home ? [dx, dz] : [gx, gz], b = home ? [gx, gz] : [dx, dz];
      tx = a[0] + (b[0] - a[0]) * k; tz = a[1] + (b[1] - a[1]) * k;
      p.anim = k > 0 && k < 1 ? AN.WALK : AN.STAND;
      p.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      p.x = tx; p.z = tz; p.speed = 1.1; p.phase += dt * 5;
    } else if (h < 8.4) {                    // assembly in rows, clapping at the end
      p.x = p.ax; p.z = p.az; p.yaw = gd.yaw + Math.PI;
      p.anim = h > 8.25 ? AN.CLAP : AN.STAND;
    } else {                                  // recess / games: running about
      if (!p.tgt || Math.hypot(p.tgt[0] - p.x, p.tgt[1] - p.z) < 0.6) {
        const r = this.rnd;
        p.tgt = at((r() - 0.5) * (gd.w - 4), (r() - 0.5) * (gd.d - 4));
        p.run = r() < 0.7;
      }
      const dx = p.tgt[0] - p.x, dz = p.tgt[1] - p.z, L = Math.hypot(dx, dz) || 1;
      const sp = p.run ? 2.6 : 1.1;
      p.x += (dx / L) * sp * dt; p.z += (dz / L) * sp * dt;
      p.yaw = angleDamp(p.yaw, Math.atan2(dx, dz), 8, dt);
      p.anim = p.run ? AN.RUN : AN.WALK; p.speed = sp; p.phase += dt * sp / (p.run ? 2.2 : 1.3) * 6.28;
      run = true;
    }
    void run;
    p.y = W.heightAt(p.x, p.z);
  }

  draw(crowd) {
    if (this.g.interior?.active) return;
    const rain = this.g.weather.state.rain > 0.2;
    for (const p of this.people) {
      if (!p.visible || !p.near) continue;
      let opts = p.look.opts;
      if (p.torch) opts |= bit(OPT.PHONE);
      if (p.cup) opts |= bit(OPT.CUP);
      if (rain && p.kind === 'guard' && p.anim !== AN.SIT) opts |= bit(OPT.UMBRELLA);
      crowd.push({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, anim: p.anim, phase: p.phase, speed: p.speed || 0, extra: 0, look: p.look, opts });
    }
  }

  /** guard nearest to a point (for dialogue) */
  nearestGuard(x, z, r = 3) {
    let best = null, bd = r;
    for (const p of this.people) { if (p.kind !== 'guard' || !p.visible) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  nearest(x, z, r = 2.5) {
    let best = null, bd = r;
    for (const p of this.people) { if (!p.visible || !p.near) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
}

const POST = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
const POSTMAT = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.5, metalness: 0.5 });
void C; void pal;

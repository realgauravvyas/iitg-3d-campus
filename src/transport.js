// Everything that comes and goes through the gates, and the campus's own rides:
//  - taxis dropping and picking up students, private cars of visitors and staff
//  - food, tiffin, pizza and grocery delivery riders to the hostel gates
//  - supply trucks for the messes (vegetables, gas cylinders) and a water tanker
//  - autos from the Guwahati road (they may only come in as far as the Market Complex)
//  - electric rickshaws and electric buggies running between the hostels, the academic area,
//    the market and the hospital, stopping for passengers
// Vehicles stop at the gate for the guard's check. The Main Gate is open day and night, the KV
// Gate from 6 am to 10 pm; nothing with an engine uses Khokha Gate (students only, on foot or cycle).
// You can ask for a lift in anything that has a free seat.
import { sweepBlocked } from './clearance.js';
import { exitSpot } from './exitspot.js';
import * as THREE from 'three';
import { makeCar, makeScooter, makeMotorbike } from './models.js';
import { FILTERS } from './route.js';
import { compact, sampleAt } from './life/campus.js';
import { mulberry32, mergeColored, m4, clamp, damp, wrapAngle, canvasTexture } from './util.js';
import { AN } from './crowd/people.js';
import { adultLook, studentLook, OPT, bit, pal } from './crowd/looks.js';

/** fares in rupees: e-rickshaw ₹10 on campus, auto ₹30, taxi ₹150 on campus or ₹650 into Guwahati */
export const rideFare = (v) => (v.kind === 'erick' ? 10 : v.kind === 'auto' ? 30 : v.kind === 'taxi' ? (v.state === 'out' ? 650 : 150) : 0);

// delivery services (generic, no real companies): name for the order, tag on the rider's box
const BRANDS = [
  { name: 'Food delivery', tag: 'FOOD', box: '#b83b2e', text: '#ffffff' }, { name: 'Tiffin service', tag: 'TIFFIN', box: '#2f6f8f', text: '#ffffff' },
  { name: 'Pizza Corner', tag: 'PIZZA', box: '#8a3b1c', text: '#fff3d6' }, { name: 'Grocery delivery', tag: 'GROCERY', box: '#3f7f3a', text: '#ffffff' },
];
// [half length, half width] for road manners
export const TDIMS = { guardbike: [0.95, 0.4], taxi: [2.2, 0.9], car: [2.2, 0.9], delivery: [0.95, 0.4], truck: [2.8, 1.0], gas: [2.8, 1.0], tanker: [3.2, 1.1], erick: [1.45, 0.62], buggy: [1.6, 0.7], auto: [1.35, 0.7] };
const SPEEDS = { guardbike: 9, taxi: 9, car: 9, delivery: 10, truck: 7, gas: 7, tanker: 6.5, erick: 5.2, buggy: 5.5, auto: 8 };

function labelTex(text, bg, fg, w = 256, h = 96, font = 42) {
  return canvasTexture(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = `800 ${font}px "Hind", "Segoe UI", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2, w - 12); }, { repeat: false });
}

// ------------------------------------------------------------------ models
function wheelsOf(g, list, r, mat) {
  const wg = new THREE.CylinderGeometry(r, r, 0.16, 12).rotateZ(Math.PI / 2);
  return list.map(([x, z]) => { const w = new THREE.Mesh(wg, mat); w.position.set(x, r, z); g.add(w); return w; });
}
const TYRE = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });

function makeTaxi() {
  const c = makeCar('#f2c12e');
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3), new THREE.MeshStandardMaterial({ map: labelTex('TAXI', '#1c1c1c', '#f2c12e', 128, 48, 34), emissive: 0x332200 }));
  sign.position.set(0, 1.66, -0.3); c.group.add(sign);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 3.82), new THREE.MeshStandardMaterial({ color: 0x1c1c1c }));
  band.position.set(0, 0.8, 0); c.group.add(band);
  return c;
}
function makeDelivery(brand) {
  const s = makeScooter('#1c1c1c');
  const tex = labelTex(brand.tag || brand.name, brand.box, brand.text, 256, 256, 54);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.46), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  box.position.set(0, 1.1, -0.62); s.group.add(box);
  return s;
}
function makeTruck(kind) {
  const g = new THREE.Group();
  const cabCol = kind === 'gas' ? '#c62828' : kind === 'tanker' ? '#1f4f8a' : '#e8e8e8';
  const parts = [
    { geometry: new THREE.BoxGeometry(1.8, 1.6, 1.5), color: cabCol, matrix: m4(0, 1.3, 2.0) },
    { geometry: new THREE.BoxGeometry(1.7, 0.7, 0.06), color: '#2b3640', matrix: m4(0, 1.6, 2.76) },
    { geometry: new THREE.BoxGeometry(1.9, 0.25, 4.0), color: '#3a3a3a', matrix: m4(0, 0.62, -0.7) },
  ];
  if (kind === 'tanker') parts.push({ geometry: new THREE.CylinderGeometry(0.9, 0.9, 3.8, 14).rotateX(Math.PI / 2), color: '#2f6fb0', matrix: m4(0, 1.65, -0.8) });
  else {
    parts.push({ geometry: new THREE.BoxGeometry(1.9, 0.7, 0.06), color: '#6b4a33', matrix: m4(0, 1.1, -2.7) });
    for (const sx of [-0.95, 0.95]) parts.push({ geometry: new THREE.BoxGeometry(0.06, 0.7, 4.0), color: '#6b4a33', matrix: m4(sx, 1.1, -0.7) });
    for (let i = 0; i < (kind === 'gas' ? 14 : 12); i++) {
      const x = -0.6 + (i % 3) * 0.6, z = -2.3 + Math.floor(i / 3) * 0.75;
      if (kind === 'gas') parts.push({ geometry: new THREE.CylinderGeometry(0.17, 0.17, 0.75, 10), color: '#c62828', matrix: m4(x, 1.12, z) });
      else parts.push({ geometry: new THREE.SphereGeometry(0.34, 8, 6), color: i % 4 === 0 ? '#e8d9a0' : '#c9b27a', matrix: m4(x, 1.05, z, 0, 0, 0, 1, 0.75, 1.1) });
    }
  }
  const b = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  b.castShadow = true; g.add(b);
  const wheels = wheelsOf(g, [[0.85, 2.0], [-0.85, 2.0], [0.85, -1.6], [-0.85, -1.6]], 0.42, TYRE);
  return { group: g, spin(d) { for (const w of wheels) w.rotation.x += d / 0.42; } };
}
export function makeErick(kind) {
  // e-rickshaw (green canopy, open sides, bench seats) / auto (yellow-green, CNG) / electric buggy (white golf cart)
  const g = new THREE.Group();
  const buggy = kind === 'buggy', auto = kind === 'auto';
  const body = buggy ? '#f2f0ea' : auto ? '#2e7d4f' : '#3f8a4f', roof = buggy ? '#f2f0ea' : auto ? '#f2c12e' : '#2e6b3f';
  const L = buggy ? 3.1 : 2.8;
  const parts = [
    { geometry: new THREE.BoxGeometry(1.2, 0.25, L), color: '#3a3a3a', matrix: m4(0, 0.45, 0) },
    { geometry: new THREE.BoxGeometry(1.15, 0.55, 0.9), color: body, matrix: m4(0, 0.85, L / 2 - 0.5) },              // nose
    { geometry: new THREE.BoxGeometry(1.25, 0.08, L - 0.2), color: roof, matrix: m4(0, 2.0, -0.05) },                // canopy
    { geometry: new THREE.BoxGeometry(1.1, 0.6, 0.05), color: '#2b3640', matrix: m4(0, 1.35, L / 2 - 0.1) },         // windscreen
  ];
  for (const sx of [-0.58, 0.58]) for (const sz of [L / 2 - 0.15, -L / 2 + 0.15]) parts.push({ geometry: new THREE.CylinderGeometry(0.025, 0.025, 1.5, 5), color: '#444', matrix: m4(sx, 1.25, sz) });
  const rows = buggy ? [0.55, -0.35, -1.2] : [0.45, -0.75];
  for (const z of rows) { parts.push({ geometry: new THREE.BoxGeometry(1.0, 0.12, 0.5), color: buggy ? '#2f5fa8' : '#8a5a36', matrix: m4(0, 0.78, z) }); parts.push({ geometry: new THREE.BoxGeometry(1.0, 0.45, 0.08), color: buggy ? '#2f5fa8' : '#8a5a36', matrix: m4(0, 1.05, z - 0.25) }); }
  if (auto) parts.push({ geometry: new THREE.BoxGeometry(1.2, 0.9, 0.06), color: '#f2c12e', matrix: m4(0, 1.3, -L / 2 + 0.05) });
  const b = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
  b.castShadow = true; g.add(b);
  const wheels = buggy ? wheelsOf(g, [[0.55, 1.0], [-0.55, 1.0], [0.55, -1.0], [-0.55, -1.0]], 0.25, TYRE) : wheelsOf(g, [[0, L / 2 - 0.25], [0.55, -0.9], [-0.55, -0.9]], 0.26, TYRE);
  return { group: g, spin(d) { for (const w of wheels) w.rotation.x += d / 0.26; }, seats: rows };
}

// ------------------------------------------------------------------ system
export class Transport {
  constructor(game) {
    this.g = game;
    const W = game.world, G = game.graph, r = (this.rnd = mulberry32(4711));
    this.list = [];
    this.pool = {};
    const O = game.outside;
    this.far = (O?.far || []).filter((f) => f.node >= 0);
    this.gateLinks = (O?.links || []).filter((l) => l.edge);
    const nodeAt = (x, z) => G.nearestNode(x, z, FILTERS.car, true);
    const siteNode = (s) => ({ id: s.lm, x: s.ex + s.nx * 3, z: s.ez + s.nz * 3, node: nodeAt(s.ex + s.nx * 3, s.ez + s.nz * 3), name: W.landmark(s.lm)?.name || s.name });
    this.hostels = W.sites.filter((s) => s.kind === 'hostel').map(siteNode);
    this.places = ['academic', 'lhc', 'admin', 'library', 'hospital', 'guesthouse', 'shopping', 'foodcourt', 'newsac', 'transit'].map((id) => W.site(id)).filter(Boolean).map(siteNode);
    this.market = W.site('shopping') ? siteNode(W.site('shopping')) : this.places[0];
    this.messes = this.hostels;
    // campus rides: loops through the busy places
    const loopIds = [['brahmaputra', 'dihing', 'lohit', 'siang', 'library', 'academic', 'lhc', 'admin', 'foodcourt', 'hospital', 'subansiri', 'shopping'],
      ['kameng', 'barak', 'umiam', 'gaurang', 'newsac', 'foodcourt', 'dhansiri', 'hospital', 'guesthouse', 'admin', 'library', 'kapili', 'dibang', 'disang']];
    const campusRoad = e => FILTERS.car(e) && !e.outside;
    this.loops = loopIds.map(ids => ids.map(id => W.site(id)).filter(Boolean).map(s => ({ ...siteNode(s), node: G.nearestNode(s.ex, s.ez, campusRoad, true) })).filter(s => s.node >= 0));
    // campus rides start straight away
    for (let i = 0; i < 6; i++) this.spawnCampus('erick', i % this.loops.length, r() * 0.9);
    for (let i = 0; i < 4; i++) this.spawnCampus('buggy', (i + 1) % this.loops.length, r() * 0.9);
    this.spawnT = 0;
    this.stats = {};
  }

  /** how many trip vehicles should be around at this hour */
  target(h) {
    const day = h > 7 && h < 21;
    // security guards ride in (and the last shift rides home) around 6 am, 2 pm and 10 pm
    const shift = (h > 5.4 && h < 6.6) || (h > 13.4 && h < 14.6) || (h > 21.4 && h < 22.6);
    return { taxi: day ? 3 : 1, car: day ? 4 : 1, delivery: (h > 11.5 && h < 14.5) || (h > 18.5 && h < 23.8) ? 6 : h > 9 && h < 18 ? 3 : 1, truck: h > 5.5 && h < 10 ? 2 : 0, gas: h > 9 && h < 13 ? 1 : 0, tanker: h > 8 && h < 17 ? 1 : 0, auto: day ? 2 : 0, guardbike: shift ? 5 : 0 };
  }

  filterFor(kind, h) {
    // KV Gate only in the day; Khokha never for engines (FILTERS.car already excludes it); autos stop at the market
    const kv = h >= 6 && h < 22;
    const f = (e) => FILTERS.car(e) && (!e.gate || /Main/.test(e.gate) || (kv && /KV/.test(e.gate)));
    f.id = kv ? 'd' : 'n';
    return f;
  }

  getModel(kind, brand) {
    const key = kind === 'delivery' ? `delivery:${brand.name}` : kind;
    const P = (this.pool[key] ||= []);
    const m = P.pop() || (kind === 'guardbike' ? makeMotorbike(['#1c1c1c', '#2b4c7e', '#8a1c1c', '#5a5f64'][Math.floor(this.rnd() * 4)]) : kind === 'taxi' ? makeTaxi() : kind === 'car' ? makeCar(['#f2f0ea', '#c0c3c6', '#9b1c1c', '#1c1c1c', '#2b4c7e'][Math.floor(this.rnd() * 5)]) : kind === 'delivery' ? makeDelivery(brand)
      : kind === 'truck' || kind === 'gas' || kind === 'tanker' ? makeTruck(kind) : makeErick(kind));
    m.key = key;
    this.g.scene.add(m.group);
    m.group.visible = true;
    return m;
  }
  release(m) { this.g.scene.remove(m.group); (this.pool[m.key] ||= []).push(m); }

  route(from, to, filter) {
    const rt = this.g.graph.route(from, to, filter, 'tr' + (filter.id || ''));
    return rt && rt.length > 1 ? compact(rt) : null;
  }

  /** order food / essentials on your phone: a rider brings it to your hostel gate */
  order(brandName, item, price, energy) {
    const g = this.g;
    if (this.myOrder) { g.ui.toast('You already have an order on the way.', 'warn'); return false; }
    if (!g.progress.spend(price, `${brandName} order`, () => this.order(brandName, item, price, energy))) return false;
    const brand = BRANDS.find((b) => b.name === brandName) || BRANDS[0];
    const home = this.hostels.find((h) => h.id === g.progress.profile.hostel) || this.hostels[0];
    const v = this.spawnTrip('delivery', { brand, dest: home, near: false });
    if (!v) { g.progress.earn(price, 'refund'); g.ui.toast('No rider available right now. Refunded.', 'warn'); return false; }
    v.order = { item, price, energy, brand: brand.name };
    this.myOrder = v;
    const eta = Math.max(1, Math.round((v.path.len - v.s) / SPEEDS.delivery / 60 * (g.clock.k || 20)));
    g.ui.toast(`${brand.name}: ${item} ordered · the rider will be at the ${home.name} gate in about ${eta} min (campus time).`, 'info', 'Order placed');
    g.guide?.set(home.x, home.z, `${home.name} gate`);
    return true;
  }

  /** a trip from outside (or a gate) to a place on campus and back out */
  spawnTrip(kind, force = null) {
    const g = this.g, r = this.rnd, h = g.clock.hour;
    if (!this.far.length && !this.gateLinks.length) return null;
    const filter = this.filterFor(kind, h);
    const brand = force?.brand || (kind === 'delivery' ? BRANDS[Math.floor(r() * BRANDS.length)] : null);
    let dest = force?.dest;
    if (dest) { /* ordered */ }
    else if (kind === 'delivery' || kind === 'taxi') dest = this.hostels[Math.floor(r() * this.hostels.length)];
    else if (kind === 'truck' || kind === 'gas') dest = this.messes[Math.floor(r() * this.messes.length)];
    else if (kind === 'auto') dest = this.market;
    else if (kind === 'guardbike') { const posts = g.hood?.posts || []; const q = posts[Math.floor(r() * posts.length)]; if (q) dest = { x: q.x, z: q.z, name: 'guard post', node: g.graph.nearestNode(q.x, q.z, filter, true) }; }
    else dest = this.places[Math.floor(r() * this.places.length)];
    if (!dest || dest.node < 0) return null;
    // enter from the far end of an outside road, or (usually) already near a gate
    const src = this.far[Math.floor(r() * this.far.length)];
    if (!src) return null;
    const path = this.route(src.node, dest.node, filter);
    if (!path) return null;
    const v = { kind, brand, dest, state: 'in', path, s: 0, v: 0, yaw: 0, wait: 0, filter, gateStops: this.gateStops(path), home: src };
    // start near the gate most of the time so there is always something coming in
    const gs = v.gateStops[0];
    if (gs && (force ? true : r() < 0.7)) v.s = Math.max(0, gs.s - (force ? 30 : 60 + r() * 120));
    v.model = this.getModel(kind, brand);
    v.crew = this.crewFor(kind, brand);
    this.list.push(v);
    return v;
  }

  /** collect your order from the rider at your hostel gate */
  collect(v) {
    const g = this.g, o = v.order;
    if (!o) return;
    g.progress.eat(o.energy, o.item);
    g.progress.count?.('orders');
    g.progress.unlock?.('foodie');
    g.audio.reward?.();
    g.ui.toast(`${o.item} from ${o.brand}. "Please rate 5 stars!"`, 'gold', 'Order delivered');
    v.order = null; this.myOrder = null; v.wait = Math.min(v.wait, 1.5);
    g.guide?.clear();
  }

  /** a campus e-rickshaw / buggy running its loop */
  spawnCampus(kind, li, frac = 0) {
    const loop = this.loops[li];
    if (!loop || loop.length < 3) return;
    const filter = (e) => FILTERS.car(e) && !e.outside;
    const pts = [];
    const stopS = [];
    let acc = 0;
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k], b = loop[(k + 1) % loop.length];
      const rt = this.g.graph.route(a.node, b.node, filter, 'lp');
      if (!rt) return; // Never connect disconnected legs with a straight line.
      for (let q = pts.length ? 1 : 0; q < rt.length; q++) { if (pts.length) acc += Math.hypot(rt[q][0] - pts[pts.length - 1][0], rt[q][1] - pts[pts.length - 1][1]); pts.push(rt[q]); }
      stopS.push({ s: acc, name: b.name });
    }
    if (pts.length < 2) return;
    const path = compact(pts);
    const v = { kind, loop: true, state: 'loop', path, s: frac * path.len, v: 0, yaw: 0, wait: 0, stops: stopS, gateStops: [], filter };
    v.model = this.getModel(kind);
    v.crew = this.crewFor(kind);
    this.list.push(v);
  }

  gateStops(path) {
    const out = [];
    for (const L of this.gateLinks) {
      let best = -1, bd = 20;
      for (let i = 0; i < path.pts.length; i++) { const d = Math.hypot(path.pts[i][0] - L.g.wx, path.pts[i][1] - L.g.wz); if (d < bd) { bd = d; best = i; } }
      if (best >= 0) out.push({ s: path.cum[best], gate: L.g, done: false });
    }
    return out.sort((a, b) => a.s - b.s);
  }

  crewFor(kind, brand) {
    const r = this.rnd, crew = [];
    const driver = adultLook(r, 'staff');
    if (kind === 'guardbike') crew.push({ lx: 0, ly: 0, lz: -0.15, look: adultLook(r, 'guard'), anim: AN.SCOOTER });
    else if (kind === 'delivery') {
      const L = studentLook(r, { female: false }); L.opts |= bit(OPT.CAP); L.col0[1] = pal(brand.box); L.col1[2] = pal(brand.box); L.flags &= 63;
      crew.push({ lx: 0, ly: 0, lz: -0.15, look: L, anim: AN.SCOOTER });
    } else if (kind === 'erick' || kind === 'buggy' || kind === 'auto') {
      crew.push({ lx: 0, ly: 0.35, lz: kind === 'buggy' ? 0.55 : 0.75, look: driver, anim: AN.SIT });
      const n = kind === 'buggy' ? 5 : 3;
      for (let k = 0; k < n; k++) crew.push({ lx: (k % 2 ? 0.26 : -0.26), ly: 0.35, lz: kind === 'buggy' ? -0.35 - Math.floor(k / 2) * 0.85 : -0.75, look: studentLook(r), anim: AN.SIT, pax: true, on: r() < 0.6 });
    } else {
      crew.push({ lx: kind === 'taxi' || kind === 'car' ? -0.38 : -0.45, ly: kind === 'taxi' || kind === 'car' ? 0.2 : 0.75, lz: kind === 'taxi' || kind === 'car' ? 0.05 : 2.0, look: driver, anim: AN.SIT });
      if (kind === 'taxi') crew.push({ lx: 0.38, ly: 0.2, lz: -0.9, look: studentLook(r), anim: AN.SIT, pax: true, on: true });
    }
    return crew;
  }

  update(dt) {
    const g = this.g, h = g.clock.hour, r = this.rnd;
    // keep the gates busy
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1.5;
      const want = this.target(h), have = {};
      for (const v of this.list) if (!v.loop) have[v.kind] = (have[v.kind] || 0) + 1;
      for (const [k, n] of Object.entries(want)) if ((have[k] || 0) < n && r() < 0.5) { this.spawnTrip(k); break; }
    }
    const tmp = {};
    const avoid = g.avoid;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      let P = v.path;
      // speed: cruise, slow at bends, stop at the gate check, at the destination and for people ahead
      const top = SPEEDS[v.kind] * (h > 22 || h < 5.5 ? 0.9 : 1);
      let vt = top;
      const curv = Math.abs(curvature(P, v.s));
      vt = Math.min(vt, Math.max(2.5, top - curv * 12));
      const gs = v.gateStops.find((q) => !q.done && q.s > v.s - 1);
      if (gs) { const d = gs.s - v.s; vt = Math.min(vt, Math.sqrt(Math.max(0, 2 * 2.5 * (d - 3))) + (d < 3 ? 0 : 0.3)); if (d < 3.5 && v.v < 0.3) { v.wait = 3 + r() * 2; gs.done = true; } }
      let stop = null;
      if (v.loop) { stop = v.stops.find((q) => !q.passed && q.s > v.s - 0.5 && q.s - v.s < 60); }
      else if (v.state === 'in') stop = { s: P.len - 4 };
      if (stop) { const d = stop.s - v.s; vt = Math.min(vt, Math.sqrt(Math.max(0, 2 * 2.2 * d)) + 0.2); if (d < 0.8 && v.wait <= 0 && !v.atStop) { v.atStop = true; v.currentStop = stop; v.wait = v.loop ? 6 + r() * 5 : v.kind === 'truck' || v.kind === 'gas' ? 30 : v.kind === 'tanker' ? 40 : 12 + r() * 10; this.arrive(v); } }
      if (v.wait > 0) { v.wait -= dt; vt = 0; if (v.wait <= 0 && v.atStop) this.depart(v); }
      P = v.path; // depart() may have replaced the inbound path this frame.
      sampleAt(P, Math.min(v.s, P.len - 0.01), tmp);
      const pos = v.model.group.position;
      const free = vt;
      if (!(v.ghost > 0)) {
        vt = Math.min(vt, avoid.brake(pos.x, pos.z, v.yaw, TDIMS[v.kind][0], TDIMS[v.kind][1], vt));
        // don't drive into the vehicle in front (same direction only)
        for (const o of this.list) {
          if (o === v || Math.cos(o.yaw - v.yaw) < 0.3) continue;
          const op = o.model.group.position, dx = op.x - pos.x, dz = op.z - pos.z;
          const ahead = dx * Math.sin(v.yaw) + dz * Math.cos(v.yaw);
          if (ahead > 0 && ahead < 9 && Math.abs(dx * Math.cos(v.yaw) - dz * Math.sin(v.yaw)) < 1.6) vt = Math.min(vt, o.v * 0.9 + Math.max(0, ahead - 5.5) * 0.5);
        }
      }
      // gridlock breaker: held up by others for a while (not at a stop) -> ease through for a few seconds
      v.ghost = Math.max(0, (v.ghost || 0) - dt);
      if (free > 1 && vt < 0.3 && v.v < 0.3 && v.wait <= 0) { v.stall = (v.stall || 0) + dt; if (v.stall > 6) { v.stall = 0; v.ghost = 3.5; } } else v.stall = 0;
      if (v.ghost > 0) vt = Math.max(vt, Math.min(free, 2.2));
      v.v = damp(v.v, vt, vt < v.v ? 4 : 1.2, dt);
      const prev = { s: v.s, off: v.off, yaw: v.yaw, x: pos.x, z: pos.z };
      v.s += v.v * dt;
      if (v.loop && v.s >= P.len) { v.s -= P.len; for (const q of v.stops) q.passed = false; }
      if (!v.loop && v.s >= P.len - 0.02 && v.state === 'out') { this.release(v.model); this.list.splice(i, 1); if (this.ride?.v === v) this.endRide(); continue; }
      v.s = Math.min(v.s, P.len - 0.01);
      sampleAt(P, v.s, tmp);
      // keep left, in the lane for its width
      const hw = tmp.hw || 3, half = TDIMS[v.kind][1];
      let off = Math.max(0, Math.min(hw * 0.42, hw - half - 0.3, 1.8));
      // round the Main Gate island each direction keeps to its own carriageway (look a little ahead)
      if (g.world.dividers) off = Math.max(off, g.world.medianNeed(tmp.x, tmp.z), g.world.medianNeed(tmp.x + tmp.tx * 9, tmp.z + tmp.tz * 9));
      v.off = v.off == null ? off : v.off + (off - v.off) * (1 - Math.exp(-(off > v.off + 0.3 ? 4 : 1.5) * dt));
      const x = tmp.x + tmp.tz * v.off, z = tmp.z - tmp.tx * v.off;
      const hd = Math.atan2(tmp.tx, tmp.tz);
      v.yaw = v.yaw + wrapAngle(hd - v.yaw) * (1 - Math.exp(-6 * dt));
      let px = x, pz = z;
      if (sweepBlocked(g.world, v.placed ? prev : null, { x, z, yaw: v.yaw }, ...TDIMS[v.kind])) {
        if (!v.placed) { v.s = prev.s; v.off = prev.off; v.yaw = prev.yaw; v.v = 0; v.model.group.visible = false; continue; }
        // a wall close to the lane: move towards the middle of the road rather than stopping for good
        // (stopping here used to leave vehicles stuck forever, e.g. beside the Food Court)
        const alt = [v.off * 0.4, 0, -v.off * 0.4].find((o) => !sweepBlocked(g.world, prev, { x: tmp.x + tmp.tz * o, z: tmp.z - tmp.tx * o, yaw: hd }, ...TDIMS[v.kind]));
        if (alt !== undefined) { v.off = alt; px = tmp.x + tmp.tz * alt; pz = tmp.z - tmp.tx * alt; v.yaw = hd; }
      }
      v.placed = true;
      const y = g.world.heightAt(px, pz) + 0.05;
      pos.set(px, y, pz);
      v.model.group.rotation.y = v.yaw;
      v.model.spin?.(v.v * dt);
      const cam = g.camera.position;
      v.model.group.visible = (x - cam.x) ** 2 + (z - cam.z) ** 2 < 330 * 330;                  // (a vehicle 330 m away is a few pixels)
    }
    if (this.ride) this.updateRide(dt);
  }

  arrive(v) {
    if (v.loop) { for (const c of v.crew) if (c.pax) c.on = this.rnd() < 0.55; return; }
    if (v.kind === 'taxi') for (const c of v.crew) if (c.pax) c.on = this.rnd() < 0.5;   // drop off / pick up
    if (v.kind === 'delivery') {
      v.handoff = this.g.time + 8;
      // your order: the rider waits at the gate (up to two minutes) and calls you
      if (v.order) { v.wait = 120; v.handoff = this.g.time + 120; this.g.ui.toast(`Your ${v.order.brand} rider is at the ${v.dest.name} gate.`, 'info', 'Phone ringing'); this.g.audio.tone?.(1320, 0.12, { gain: 0.05 }); }
    }
    if (v.kind === 'truck' || v.kind === 'gas') v.unload = this.g.time + 28;
  }

  depart(v) {
    v.atStop = false;
    if (v.currentStop) v.currentStop.passed = true;
    v.currentStop = null;
    // you never came down: the guard signs for it and keeps it for you
    if (v.order) { const o = v.order; v.order = null; this.myOrder = null; this.g.progress.eat(Math.round(o.energy * 0.8), `${o.item} (kept by the guard)`); this.g.ui.toast(`The hostel guard signed for your ${o.item}. You picked it up later.`, 'info'); this.g.guide?.clear(); }
    if (v.loop) return;
    // head back out through a gate that is open now
    const h = this.g.clock.hour;
    const filter = this.filterFor(v.kind, h);
    const home = this.far[Math.floor(this.rnd() * this.far.length)];
    const P = home ? this.route(v.dest.node, home.node, filter) : null;
    if (!P) { v.state = 'out'; v.s = v.path.len; return; }
    v.path = P; v.s = 0; v.state = 'out'; v.gateStops = this.gateStops(P);
  }

  /** people in and around the vehicles, drawn by the crowd renderer */
  draw(crowd) {
    const V3 = new THREE.Vector3();
    const cam = this.g.camera.position, t = this.g.time;
    for (const v of this.list) {
      const gp = v.model.group.position;
      if ((gp.x - cam.x) ** 2 + (gp.z - cam.z) ** 2 > 160 * 160) continue;
      v.model.group.updateMatrixWorld();
      for (const c of v.crew) {
        if (c.pax && !c.on) continue;
        if (this.ride?.v === v && c === this.ride.seat) continue;
        V3.set(c.lx, c.ly, c.lz).applyMatrix4(v.model.group.matrixWorld);
        crowd.push({ x: V3.x, y: V3.y, z: V3.z, yaw: v.yaw, anim: c.anim, phase: 0, speed: 0, extra: 0, look: c.look, opts: c.look.opts });
      }
      // the rider hands over the order at the hostel gate; the loaders carry sacks to the mess
      if (v.handoff > t && v.crew[0]) { const s = v.dest; crowd.push({ x: s.x + 1.2, y: this.g.world.heightAt(s.x, s.z), z: s.z, yaw: v.yaw + Math.PI, anim: AN.WAVE, phase: 0, speed: 0, extra: 0, look: v.crew[0].look, opts: v.crew[0].look.opts | bit(OPT.PLATE) }); }
      if (v.unload > t) {
        for (let k = 0; k < 2; k++) {
          const u = ((t * 0.25 + k * 0.5) % 1), to = v.dest;
          const back = u < 0.5, q = back ? u * 2 : (1 - u) * 2;
          const x = gp.x + (to.x - gp.x) * q, z = gp.z + (to.z - gp.z) * q;
          crowd.push({ x, y: this.g.world.heightAt(x, z), z, yaw: Math.atan2((back ? to.x - gp.x : gp.x - to.x), (back ? to.z - gp.z : gp.z - to.z)), anim: back ? AN.CARRY : AN.WALK, phase: t * 7 + k, speed: 1.2, extra: 0, look: v.crew[0].look, opts: v.crew[0].look.opts });
        }
      }
    }
  }

  /** vehicles as boxes for people to step around */
  boxes() { return this.list.filter(v => v.placed).map((v) => ({ x: v.model.group.position.x, z: v.model.group.position.z, yaw: v.yaw, hl: TDIMS[v.kind][0], hw: TDIMS[v.kind][1], v: v.v })); }

  // ------------------------------------------------------------------ lifts
  /** a vehicle with a free seat near (x,z) that is slow enough to hop in */
  liftNear(x, z) {
    let best = null, bd = 4.5;
    for (const v of this.list) {
      if (v.v > 1.6 || !['erick', 'buggy', 'taxi', 'auto'].includes(v.kind) || v.noHop > this.g.time) continue;       // (not the one you have just got off)
      const p = v.model.group.position, d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  startRide(v) {
    const g = this.g;
    const fare = rideFare(v);
    if (fare && !g.progress.spend(fare, v.kind === 'erick' ? 'e-rickshaw fare' : v.kind === 'taxi' ? 'taxi fare' : 'auto fare', () => this.startRide(v))) return false;
    const seat = v.crew.find((c) => c.pax && !c.on) || v.crew.find((c) => c.pax);
    if (!seat) return false;
    seat.on = false;
    this.ride = { v, seat };
    g.player.avatar.root.visible = false;
    g.setMode('ride');
    g.ui.toast(`${{ erick: 'E-rickshaw', buggy: 'Campus buggy', taxi: 'Taxi', auto: 'Auto' }[v.kind]}${fare ? ` · ₹${fare}` : ' · free'}. E to get off.`, 'info', 'Got a lift');
    return true;
  }

  updateRide(dt) {
    const R = this.ride, g = this.g;
    if (!R) return;
    const v = R.v;
    const V3 = new THREE.Vector3(R.seat.lx, R.seat.ly, R.seat.lz).applyMatrix4(v.model.group.matrixWorld);
    g.player.pos.set(V3.x, V3.y, V3.z);
    g.player.heading = v.yaw;
    // leaving the campus in a taxi: a trip home
    if (v.kind === 'taxi' && v.state === 'out' && !g.world.insideCampus(V3.x, V3.z) && g.world.distToBoundary(V3.x, V3.z) > 150) { this.endRide(true); }
  }

  endRide(home = false) {
    const R = this.ride, g = this.g;
    if (!R) return;
    this.ride = null;
    g.player.avatar.root.visible = true;
    const v = R.v, p = v.model.group.position, yaw = v.yaw;
    if (g.mode === 'ride') g.setMode('walk');
    if (home) { g.goHome?.(); return; }
    // down on the kerb side, clear of walls, water and other vehicles; the one you left is not offered to you again for a few seconds
    // (you stand right beside it, and a second press of E would have hopped you straight back in)
    const at = exitSpot(g.world, { x: p.x, z: p.z, yaw }, { side: 1, others: this.boxes().filter((b) => Math.hypot(b.x - p.x, b.z - p.z) > 0.5) });
    v.noHop = g.time + 4;
    g.player.spawn(at.x, at.z, yaw);
    g.ui.toast('You got off.', 'info');
  }

  rideCamera(camera, dt) {
    const R = this.ride;
    if (!R) return;
    const p = R.v.model.group.position, yaw = R.v.yaw + (this.g.player.camYaw || 0) * 0;
    const want = new THREE.Vector3(p.x - Math.sin(yaw) * 8, p.y + 3.6, p.z - Math.cos(yaw) * 8);
    camera.position.lerp(want, 1 - Math.exp(-4 * dt));
    camera.lookAt(p.x + Math.sin(yaw) * 6, p.y + 1.2, p.z + Math.cos(yaw) * 6);
  }
}

function curvature(P, s) {
  const a = {}, b = {};
  sampleAt(P, s, a); sampleAt(P, Math.min(P.len - 0.01, s + 14), b);
  P.k = 0;
  return Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz);
}

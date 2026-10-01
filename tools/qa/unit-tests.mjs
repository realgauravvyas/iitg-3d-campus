// The logic tests: vehicle clearance geometry, and the road network and bus tour built from the real campus data.
// Bundled and run by unit.mjs (they import the game's own modules), so this file needs no browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from '../../src/world.js';
import { RoadGraph, FILTERS, PathFollower, laneOffset } from '../../src/route.js';
import { footprintBlocked, sweepBlocked } from '../../src/clearance.js';
import { makeStops } from '../../src/bus.js';
import { planDualRoads, DUAL_HW } from '../../src/scene/dualroads.js';
import { CATEGORIES, TOPICS, STATUS } from '../../src/guide/data.js';
import { isRoll, cleanRoll } from '../../src/roll.js';
import { LINES, SHARED, Talker } from '../../src/dialogue.js';
import { render as renderFeatures } from '../../tools/gen-features.mjs';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ', name); };

// ---- clearance geometry on a toy building
const box = (x0, z0, x1, z1, holes = []) => ({ x0, z0, x1, z1, rings: [[x0, z0, x1, z0, x1, z1, x0, z1], ...holes] });
let b = box(0, 0, 10, 10);
const w = { buildingsNear: () => [b] };
test('a vehicle inside a building is blocked', () => assert(footprintBlocked(w, 5, 5, 0, 1, 1)));
test('a vehicle well outside is not', () => assert(!footprintBlocked(w, -5, 5, 0, 1, 1)));
test('a long body whose nose enters the wall is blocked', () => { assert(footprintBlocked(w, -1, 5, 0, 2, 1.1)); assert(footprintBlocked(w, -2, 5, Math.PI / 2, 3, 0.5)); });
test('a sweep through a wall is blocked, a sweep beside it is not', () => { assert(sweepBlocked(w, { x: -5, z: 5, yaw: 0 }, { x: 15, z: 5, yaw: 0 }, 1, 0.5)); assert(!sweepBlocked(w, { x: -5, z: -5, yaw: 0 }, { x: 15, z: -5, yaw: 0 }, 1, 0.5)); });
test('a courtyard (a hole in the footprint) is open, its walls are not', () => { b = box(0, 0, 10, 10, [[2, 2, 8, 2, 8, 8, 2, 8]]); assert(!footprintBlocked(w, 5, 5, 0, 1, 1)); assert(footprintBlocked(w, 2.2, 5, 0, 1, 0.5)); });
test('a thin wall cannot be skipped between two frames', () => { b = box(-0.02, -5, 0.02, 5); assert(sweepBlocked(w, { x: -4, z: 0, yaw: 0 }, { x: 4, z: 0, yaw: 0 }, 0.2, 0.2)); });
test('turning on the spot beside a post is caught', () => { b = box(2, -0.1, 2.2, 0.1); assert(sweepBlocked(w, { x: 0, z: 0, yaw: 0 }, { x: 0, z: 0, yaw: Math.PI }, 2.5, 0.4)); });

// ---- what people say: every kind of person has more than a hundred things to say, none twice, none with a company name in it
test('every role has at least 100 things to say, all different, and no brand names', () => {
  const ROLES = ['guard', 'student', 'faculty', 'hod', 'dean', 'director', 'mess', 'vendor', 'shop', 'sweeper', 'gardener', 'lab', 'library', 'medical', 'kid', 'intl', 'delivery', 'visitor', 'worker', 'auto', 'family', 'scholar'];
  const BRAND = /maggi|zomato|swiggy|coca|pepsi|google|amazon|whatsapp|instagram|facebook|youtube|netflix|starbucks|mcdonald|kfc|dominos|flipkart|paytm|phonepe|gpay/i;
  for (const r of ROLES) {
    const own = LINES[r];
    assert(Array.isArray(own), r + ' has no lines');
    assert.equal(new Set(own).size, own.length, r + ' repeats a line');
    assert(Talker.count(r) >= 100, r + ' has only ' + Talker.count(r));
    for (const l of own) { assert(l.length > 8 && l.length < 260, r + ': a line is too short or too long: ' + l); assert(!BRAND.test(l), r + ': a brand name in: ' + l); }
  }
  assert(SHARED.length >= 40);
});

// ---- roll numbers: 9 digits for most students, 11 for BSc students
test('roll numbers: 9 digits and 11 digits are valid, nothing else', () => {
  for (const ok of ['214101001', '23015004512']) assert(isRoll(ok), ok + ' should be valid');
  for (const bad of ['', '2141010', '2141010010', '2301500451', '230150045123', 'abc123456', '21410100a', ' 214101001']) assert(!isRoll(bad), JSON.stringify(bad) + ' should be refused');
  assert.equal(cleanRoll('21-41 01001x'), '214101001');
  assert.equal(cleanRoll('230150045123456'), '23015004512');
});

// ---- the Game Guide catalogue (src/guide/data.js) and FEATURES.md, which is generated from it
test('the guide catalogue is consistent', () => {
  const ids = new Set(), cats = new Set(CATEGORIES.map((c) => c.id));
  for (const t of TOPICS) {
    assert(!ids.has(t.id), `two guide entries are called ${t.id}`);
    ids.add(t.id);
    assert(cats.has(t.cat), `${t.id}: unknown category ${t.cat}`);
    assert(t.name && t.blurb, `${t.id}: needs a name and a blurb`);
    for (const f of t.feats || []) {
      assert(STATUS[f[0]], `${t.id}: a feature has the status ${f[0]}`);
      assert(typeof f[1] === 'string' && f[1].length > 3, `${t.id}: a feature has no text`);
    }
  }
  for (const t of TOPICS) for (const s of t.see || []) assert(ids.has(s), `${t.id} links to ${s}, which does not exist`);
});
test('every guide entry that is not automatic lists what you can do', () => {
  for (const t of TOPICS.filter((q) => !q.auto)) assert((t.feats || []).length > 0, `${t.id} has no features listed`);
});
test('FEATURES.md is up to date (run: npm run features)', () => {
  const onDisk = fs.readFileSync(new URL('../../FEATURES.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert(onDisk === renderFeatures(), 'FEATURES.md does not match src/guide/data.js');
});

// ---- the real campus
const data = JSON.parse(fs.readFileSync(new URL('../../data/campus.json', import.meta.url), 'utf8'));
const W = new World(data), G = new RoadGraph(data.graph);
G.classify(W);

test('the road network is built', () => { assert(G.edges.length > 400); assert(G.edges.filter(FILTERS.car).length > 150); assert(G.edges.filter(FILTERS.bus).length > 100); });
test('the View Point trail is for people on foot only and is more than 2 km long', () => {
  const h = G.edges.filter((e) => e.hill);
  assert(h.length >= 6, 'trail edges: ' + h.length);
  assert(h.reduce((n, e) => n + e.L, 0) > 2000);
  assert(h.every((e) => !FILTERS.car(e) && !FILTERS.bus(e) && !FILTERS.drive(e) && !FILTERS.bike(e) && FILTERS.walk(e)), 'a vehicle or cycle could use the trail');
  // from every node a vehicle can reach, the walk to the top is long
  const vp = W.landmark('viewpoint'), top = G.nearestNode(vp.wx, vp.wz, FILTERS.walk);
  const D = G.dijkstra(top, FILTERS.walk);
  const starts = [...new Set(h.flatMap((e) => [e.a, e.b]))].filter((n) => G.adj[n].some((l) => !l.e.hill && FILTERS.car(l.e)));
  assert(starts.length >= 1);
  for (const n of starts) assert(D.dist[n] > 1900, 'the trail from node ' + n + ' is only ' + Math.round(D.dist[n]) + ' m');
});
test('the main roads with room are two-lane roads, the loop round the Serpentine Lake and the hill roads are not', () => {
  const r = planDualRoads(W, G);
  assert(r.edges.length >= 15 && r.metres > 3000, 'only ' + r.edges.length + ' two-lane roads');
  assert(r.edges.every((e) => e.hw === DUAL_HW && !e.hill && !e.gen));
  assert(laneOffset(DUAL_HW, 1.8) > 2 && laneOffset(DUAL_HW, 1.8) < DUAL_HW - 1.6);       // vehicles keep to the lane between the median and the cycle lane
  const vp = W.landmark('viewpoint');
  assert(r.edges.every((e) => e.wpts.every(([x, z]) => Math.hypot(x - vp.wx, z - vp.wz) > 500)), 'a two-lane road near the View Point');
});
test('the Main Gate is on the one connected road network for cars and buses', () => {
  const main = W.gates.find((g) => g.main);
  assert(main, 'there is no Main Gate');
  for (const F of [FILTERS.car, FILTERS.bus]) {
    const C = G.components(F), n = G.nearestNode(main.wx, main.wz, F, false);
    assert(n >= 0 && C.comp[n] === C.big, 'the Main Gate is cut off from the campus roads');
  }
});
test('every gate is reachable on foot from the Main Gate', () => {
  const C = G.components(FILTERS.walk), main = W.gates.find((g) => g.main), m = G.nearestNode(main.wx, main.wz, FILTERS.walk, false);
  for (const gate of W.gates) {
    const n = G.nearestNode(gate.wx, gate.wz, FILTERS.walk, false);
    assert(n >= 0 && C.comp[n] === C.comp[m], `the ${gate.name || 'a'} gate cannot be walked to`);
  }
});

test('the swimming pool is a standard 25 m x 12.5 m pool (the map outlines the whole pool area, as big as a hostel)', () => {
  const pool = W.water.find((q) => q.kind === 'pool');
  assert(pool, 'there is no pool');
  const r = pool.rings[0]; let a = 0; for (let i = 0; i < r.length; i += 2) { const j = (i + 2) % r.length; a += r[i] * r[j + 1] - r[j] * r[i + 1]; }
  assert(Math.abs(Math.abs(a / 2) - 25 * 12.5) < 8, 'the pool is ' + Math.round(Math.abs(a / 2)) + ' square metres');
});
test('the KV (Lothia Baghicha) Gate is where the road from the circle meets the wall, with the old road gate kept closed', () => {
  const kv = W.gates.filter((g) => g.name === 'KV Gate');
  assert(kv.length === 1 && !kv[0].closed, 'one open KV Gate');
  assert(Math.hypot(kv[0].wx - 179, kv[0].wz - 681) < 15, 'the KV Gate is not where the road from the circle meets the PWD Road');
  const n = G.nearestNode(kv[0].wx, kv[0].wz, FILTERS.walk, false);
  assert(n >= 0 && Math.hypot(G.nodes[n][0] - kv[0].wx, G.nodes[n][1] - kv[0].wz) < 12, 'no footpath reaches the KV Gate');
  const nc = G.nearestNode(kv[0].wx, kv[0].wz, FILTERS.car, false);
  assert(nc >= 0 && Math.hypot(G.nodes[nc][0] - kv[0].wx, G.nodes[nc][1] - kv[0].wz) < 6, 'no road reaches the KV Gate');
  assert(W.gates.filter((g) => !g.name).every((g) => g.closed), 'a service gate is open');
});
test('every hostel has a volleyball court, a basketball court and a cricket practice pitch', () => {
  const hs = W.sites.filter((q) => q.kind === 'hostel');
  assert(hs.length === 15);
  for (const h of hs) for (const k of ['volleyball', 'basketball', 'cricket']) assert(W.fields.some((f) => f.kind === k && f.gen && f.site === h.lm), h.lm + ' has no ' + k);
});

const stops = makeStops(W);
const route = G.tour(stops, FILTERS.bus, { loop: true, start: 0, turn: [5.9, 1.7] });
test('the bus tour visits more than 30 stops', () => { assert(route.pts.length > 1); assert(route.stopAt.length > 30); });
test('the bus route clears every building footprint', () => {
  const P = new PathFollower(route.pts, (hw) => laneOffset(hw, 2.5));
  const hits = [];
  for (let s = 0; s < P.length; s += 0.5) {
    const a = P.at(s, {}), f = P.at(Math.min(P.length, s + 4), {}), r = P.at(Math.max(0, s - 4), {});
    if (footprintBlocked(W, a.x, a.z, Math.atan2(f.x - r.x, f.z - r.z), 5.62, 1.52)) hits.push([Math.round(s), Math.round(a.x), Math.round(a.z)]);
  }
  assert.equal(hits.length, 0, `the bus clips a building at ${JSON.stringify(hits.slice(0, 4))}`);
});
test('the bus turns round only where it has room', () => {
  for (const { stop } of route.stopAt) {
    const n = G.nearestNode(stop.x, stop.z, FILTERS.bus, true, (i) => G.canTurn(i, 5.9, 1.7));
    assert(n >= 0, `no turning room near ${stop.name}`);
  }
});

console.log(`\nall ${passed} passed  (${G.edges.length} road segments, ${route.stopAt.length} bus stops, tour ${Math.round(route.length)} m)`);

// Campus wildlife: plenty of free-roaming dogs (packs near hostels, the market and the
// gates), cats, palm squirrels near trees, a few mongooses, jackals and the odd
// snake at night; crows, mynas and egrets, black kites soaring, geese and ducks on the
// lakes, bats at dusk, fireflies on humid nights and butterflies by day.
import * as THREE from 'three';
import { GAIT } from '../crowd/animals.js';
import { lakeCircle } from '../scene/lakecircle.js';
import { mulberry32, clamp, angleDamp, wrapAngle, pointInRing, closestOnRing } from '../util.js';

const COLS = {
  dog: ['#b98a55', '#c9a06a', '#2a2522', '#1f1c1a', '#8a6242', '#d8c7a8', '#6b4a33', '#a9744a'],
  cat: ['#8f8577', '#c77b3a', '#2b2826', '#d9d2c6', '#6f675e'],
  jackal: ['#8a7658', '#7d6b52'],
  mongoose: ['#7b7466', '#8a8272'], squirrel: ['#7d6e5c', '#8a7a66'],
};
const NAMES = { duck: 'Ducks', kingfisher: 'White-throated kingfisher', myna: 'Common myna', pigeon: 'Rock pigeon', parakeet: 'Rose-ringed parakeets', dog: 'Campus dog', cat: 'Cat', jackal: 'Golden jackal', mongoose: 'Indian grey mongoose', squirrel: 'Indian palm squirrel', snake: 'Rat snake', kite: 'Black kite', egret: 'Cattle egret', goose: 'Domestic geese', crow: 'House crow', firefly: 'Fireflies', bat: 'Fruit bats' };

export class Wildlife {
  constructor(game, renderer) {
    this.g = game; this.R = renderer;
    const W = game.world, r = mulberry32(4242);
    this.rnd = r;
    this.list = [];
    const c = (hex) => new THREE.Color(hex);
    const add = (kind, x, z, o = {}) => {
      const cols = COLS[kind] || ['#777777'];
      const a = { kind, x, z, y: W.heightAt(x, z), yaw: r() * 6.28, gait: GAIT.STAND, phase: r() * 6, scale: 0.85 + r() * 0.3, seed: r(), col: c(cols[Math.floor(r() * cols.length)]), pattern: kind === 'squirrel' ? 2 : kind === 'dog' && r() < 0.25 ? 1 : kind === 'cat' && r() < 0.55 ? 4 : 0, hx: x, hz: z, range: 50, state: 'rest', t: r() * 20, ...o };
      this.list.push(a);
      return a;
    };
    const free = (x, z) => W.insideCampus(x, z) && !W.buildingAt(x, z) && !W.waterAt(x, z);
    const around = (x, z, R) => { for (let k = 0; k < 20; k++) { const a = r() * 6.28, d = r() * R; const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (free(px, pz)) return [px, pz]; } return [x, z]; };
    // dogs: packs at hostels, the market, food places and gates, plus loners anywhere
    const homes = [...W.sites.filter((s) => s.kind === 'hostel' || s.kind === 'food'), ...W.gates.filter((g) => !g.closed).map((g) => ({ ex: g.wx - Math.cos(g.angle) * 20, ez: g.wz + Math.sin(g.angle) * 20 }))];
    for (const h of homes) {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) { const [x, z] = around(h.ex, h.ez, 25); add('dog', x, z, { range: 70, pack: h }); }
    }
    for (let k = 0; k < 14; k++) { const e = game.graph.edges[Math.floor(r() * game.graph.edges.length)]; const p = e.wpts[Math.floor(e.wpts.length / 2)]; const [x, z] = around(p[0], p[1], 6); add('dog', x, z, { range: 160, roamer: true }); }
    // cats near hostels and houses
    for (let k = 0; k < 16; k++) { const s = W.sites[Math.floor(r() * W.sites.length)]; const [x, z] = around(s.ex, s.ez, 30); add('cat', x, z, { range: 30 }); }
    // squirrels near trees (sample tree positions)
    const T = game.veg.positions;
    for (let k = 0; k < 34; k++) { const i = Math.floor(r() * (T.length / 2)) * 2; add('squirrel', T[i] + 1.5, T[i + 1], { range: 12, tree: [T[i], T[i + 1]] }); }
    // animals that live around wherever you are (moved near you when you go elsewhere): the campus
    // really is full of dogs, cats and squirrels; jackals come out of the jungle at night
    for (let k = 0; k < 26; k++) add('dog', 0, 0, { range: 60, local: 'free', state: 'walk', t: 0 });
    for (let k = 0; k < 20; k++) add('cat', 0, 0, { range: 25, local: 'free' });
    for (let k = 0; k < 30; k++) add('squirrel', 0, 0, { range: 10, local: 'tree' });
    for (let k = 0; k < 6; k++) add('mongoose', 0, 0, { range: 30, local: 'tree' });
    for (let k = 0; k < 10; k++) add('jackal', 0, 0, { range: 90, local: 'forest', night: true });
    this.localT = 0;
    // jackals (night) and mongooses near the forested hills
    const forest = [];
    for (let k = 0; k < T.length && forest.length < 400; k += 2 * 37) forest.push([T[k], T[k + 1]]);
    for (let k = 0; k < 8; k++) { const f = forest[Math.floor(r() * forest.length)]; add('jackal', f[0], f[1], { range: 140, night: true }); }
    for (let k = 0; k < 4; k++) { const f = forest[Math.floor(r() * forest.length)]; add('mongoose', f[0], f[1], { range: 40 }); }
    for (let k = 0; k < 3; k++) { const e = game.graph.edges.filter((e) => e.foot)[Math.floor(r() * 50)]; if (e) { const p = e.wpts[0]; add('snake', p[0], p[1], { range: 20, night: true, monsoon: true }); } }
    // birds
    this.birds = [];
    const lakes = W.water.filter((w) => w.kind !== 'pool');
    const iitgLake = lakes.find((w) => w.name === 'IITG lake') || lakes[0];
    for (const w of lakes) {
      const ring = w.rings[0];
      for (let k = 0; k < 6; k++) {   // egrets standing on the shore
        const i = Math.floor(r() * (ring.length / 2)) * 2;
        this.birds.push({ kind: 'egret', x: ring[i], z: ring[i + 1], y: w.level + 0.05, yaw: r() * 6.28, gait: 0, phase: 0, scale: 2.4, seed: r(), col: c('#f4f4ef'), mode: 'shore' });
      }
    }
    if (iitgLake) {
      const ring = iitgLake.rings[0];
      for (let k = 0; k < 9; k++) {   // geese at the academic lake (from the photos): white and grey
        const i = Math.floor(r() * (ring.length / 2)) * 2;
        const onWater = k % 3 === 0;
        let cx = 0, cz = 0; for (let q = 0; q < ring.length; q += 2) { cx += ring[q]; cz += ring[q + 1]; } cx /= ring.length / 2; cz /= ring.length / 2;
        const dx = ring[i] - cx, dz = ring[i + 1] - cz, L = Math.hypot(dx, dz) || 1;
        const off = onWater ? -4 : 2.5;
        this.birds.push({ kind: 'goose', x: ring[i] + (dx / L) * off, z: ring[i + 1] + (dz / L) * off, y: iitgLake.level + (onWater ? 0 : 0.05), yaw: r() * 6.28, gait: onWater ? 2 : 3, phase: 0, scale: 3.4, seed: r(), col: c(k % 4 === 3 ? '#8a8378' : '#f4f2ea'), mode: onWater ? 'swim' : 'shore', lake: iitgLake });
      }
    }
    for (let k = 0; k < 5; k++) this.birds.push({ kind: 'kite', cx: (r() - 0.5) * 900, cz: (r() - 0.5) * 900, R: 40 + r() * 60, h: 60 + r() * 50, w: 0.15 + r() * 0.1, a: r() * 6.28, x: 0, y: 0, z: 0, yaw: 0, gait: 2, phase: 0, scale: 5, seed: r(), col: c('#3a2e25'), mode: 'soar' });
    this.flocks = [];
    for (let k = 0; k < 4; k++) {
      const col = k % 2 ? c('#1c1c1e') : c('#6b4a33');
      const f = { cx: (r() - 0.5) * 800, cz: (r() - 0.5) * 900, tx: 0, tz: 0, h: 18 + r() * 25, birds: [], t: 0 };
      for (let i = 0; i < 12; i++) f.birds.push({ kind: 'crow', ox: (r() - 0.5) * 14, oz: (r() - 0.5) * 14, oy: (r() - 0.5) * 4, x: 0, y: 0, z: 0, yaw: 0, gait: 1, phase: r() * 6, scale: 1.1, seed: r(), col });
      this.flocks.push(f);
    }
    // ducks: a duck house on the shore of the IITG lake; out in pairs at sunrise, home at sunset
    this.ducks = [];
    if (iitgLake) this.buildDucks(game, iitgLake, r, c);
    // flocks flying home across the sky at dusk (and out at dawn)
    this.homeFlocks = [];
    this.flockT = 0;
    // mynas and pigeons pecking about near you; they flutter off when you come close
    this.ground = [];
    for (let k = 0; k < 36; k++) this.ground.push({ kind: k % 3 === 0 ? 'pigeon' : 'myna', x: 0, y: 0, z: 0, yaw: r() * 6.28, gait: 3, phase: r() * 6, scale: k % 3 === 0 ? 1.5 : 1.2, seed: r(), col: c(k % 3 === 0 ? '#8a8f9a' : '#4a3a2e'), state: 'peck', t: r() * 5, vy: 0, placed: false });
    // a kingfisher over each lake
    this.kings = lakes.slice(0, 3).map((w) => ({ kind: 'kingfisher', w, x: w.rings[0][0], z: w.rings[0][1], y: w.level + 3, yaw: 0, gait: 1, phase: 0, scale: 1.1, seed: r(), col: c('#1e88e5'), t: 0, cx: 0, cz: 0 }));
    // (no peacocks: there are none on the IIT Guwahati campus)
    // fireflies & butterflies (points / sprites around the player)
    this.fx = this.makeParticles(game.scene);
    this.spottedT = 0;
  }

  // ------------------------------------------------------------------ ducks
  buildDucks(game, lake, r, c) {
    const W = game.world, ring = lake.rings[0];
    let cx = 0, cz = 0; for (let q = 0; q < ring.length; q += 2) { cx += ring[q]; cz += ring[q + 1]; } cx /= ring.length / 2; cz /= ring.length / 2;
    // house: on the lake side of the circle by the lake (the fingerposts, the benches), 8 m back from the water, clear of the
    // path, the air-quality station, the guard's booth and the bus stop; with no circle, a quiet shore away from the jetty and the roads
    const lc = lakeCircle(W, game.graph);
    const DS = W.lakeSpots?.duck;                                                // directly behind the air-quality board (lakecircle.js)
    const avoid = [...(game.busStandSpots || []), ...(W.extraPosts || []), W.aqiStation].filter(Boolean);
    let best = DS ? { hx: DS.x, hz: DS.z, wx: DS.sx, wz: DS.sz, yaw: DS.yaw } : null;
    for (let i = 0; i < ring.length && !DS; i += 6) {
      const x = ring[i], z = ring[i + 1], dx = x - cx, dz = z - cz, L = Math.hypot(dx, dz) || 1;
      const hx = x + (dx / L) * 8, hz = z + (dz / L) * 8;
      if (W.buildingAt(hx, hz) || W.waterAt(hx, hz) || game.graph.onRoad(hx, hz, 2)) continue;
      let sc;
      if (lc) {
        if (avoid.some((q) => Math.hypot(q.x - hx, q.z - hz) < 10) || game.graph.onRoad(hx, hz, 4.5)) continue;
        sc = -Math.hypot(hx - (lc.x + lc.lx * 26), hz - (lc.z + lc.lz * 26));                  // the nearest of these to the circle's lakefront
      } else {
        const jd = Math.min(...(game.boats?.jetties || []).map((j) => Math.hypot(j.x - hx, j.z - hz)), 1e9);
        sc = jd + (game.graph.roadAt(hx, hz, 40)?.d ?? 40) * 2;
      }
      if (!best || sc > best.sc) best = { hx, hz, wx: x, wz: z, sc, yaw: Math.atan2(-dx, -dz) };
    }
    if (!best) return;
    const y = W.heightAt(best.hx, best.hz);
    const house = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.8 }), roof = new THREE.MeshStandardMaterial({ color: 0xb3563c, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 2.2), wood); body.position.y = 0.95; body.castShadow = true; house.add(body);
    for (const s of [-1, 1]) { const rf = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.45), roof); rf.position.set(0, 1.9, s * 0.55); rf.rotation.x = s * 0.55; house.add(rf); }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.05), new THREE.MeshStandardMaterial({ color: 0x1c1410 })); door.position.set(0, 0.6, 1.11); house.add(door);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 1.2), wood); ramp.position.set(0, 0.3, 1.6); ramp.rotation.x = 0.4; house.add(ramp);
    for (const [sx, sz] of [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 5), wood); leg.position.set(sx, 0.25, sz); house.add(leg); }
    house.position.set(best.hx, y, best.hz); house.rotation.y = best.yaw;
    game.scene.add(house);
    const door0 = { x: best.hx + Math.sin(best.yaw) * 2.2, z: best.hz + Math.cos(best.yaw) * 2.2 };
    this.duckHome = { ...door0, lake, cx, cz, shore: { x: best.wx, z: best.wz } };
    for (let k = 0; k < 36; k++) {
      const white = k % 3 !== 2;
      this.ducks.push({ kind: 'duck', i: k, pair: Math.floor(k / 2), x: door0.x, z: door0.z, y, yaw: best.yaw, gait: 0, phase: r() * 6, scale: 2.1, seed: r(), col: c(white ? '#f4f2ea' : '#7a5a3a'), mode: 'home', sx: cx + (r() - 0.5) * 30, sz: cz + (r() - 0.5) * 30, t: 0 });
    }
  }

  duckStep(dt, h) {
    const H = this.duckHome, W = this.g.world;
    if (!H) return;
    const ring = H.lake.rings[0];
    // morning: 5:30-6:40 out in pairs; evening: 17:00-18:20 back in pairs
    const out = h >= 5.5 && h < 17.0, back = h >= 17.0 && h < 18.35;
    // after a jump in time put every duck where it should be
    if (this._duckH != null && Math.abs(h - this._duckH) > 0.25) {
      for (const d of this.ducks) {
        const inWater = h >= 5.5 + d.pair * 0.035 + 0.3 && h < 17.0 + d.pair * 0.04;
        d.mode = inWater ? 'swim' : 'home';
        if (inWater) { d.x = H.cx + (Math.random() - 0.5) * 20; d.z = H.cz + (Math.random() - 0.5) * 20; } else { d.x = H.x; d.z = H.z; }
      }
    }
    this._duckH = h;
    for (const d of this.ducks) {
      const lagOut = 5.5 + d.pair * 0.035, lagBack = 17.0 + d.pair * 0.04;
      let tx, tz, speed = 0.5, onWater = false;
      if (out && h >= lagOut) {
        // walk in a line to the water, then paddle about in little groups
        if (d.mode === 'home' || d.mode === 'walkOut') { d.mode = 'walkOut'; tx = H.shore.x; tz = H.shore.z; speed = 0.55; if (Math.hypot(tx - d.x, tz - d.z) < 1) d.mode = 'swim'; }
        if (d.mode === 'swim' || d.mode === 'back') {
          d.mode = 'swim'; onWater = true;
          d.t -= dt;
          if (d.t <= 0) { d.t = 6 + Math.random() * 10; const a = Math.random() * 6.28, R = 6 + Math.random() * 25; d.sx = H.cx + Math.cos(a) * R + (d.pair % 5) * 3; d.sz = H.cz + Math.sin(a) * R; }
          tx = d.sx; tz = d.sz; speed = 0.35;
        }
      } else if (back && h >= lagBack) {
        if (d.mode === 'swim') { onWater = true; tx = H.shore.x; tz = H.shore.z; speed = 0.45; if (Math.hypot(tx - d.x, tz - d.z) < 1.2) d.mode = 'walkIn'; }
        else if (d.mode === 'walkIn' || d.mode === 'walkOut') { d.mode = 'walkIn'; tx = H.x; tz = H.z; speed = 0.5; if (Math.hypot(tx - d.x, tz - d.z) < 0.5) d.mode = 'home'; }
      } else if (!out) { if (d.mode !== 'home') { d.mode = 'home'; d.x = H.x; d.z = H.z; } }
      else if (d.mode === 'swim') { onWater = true; tx = d.sx; tz = d.sz; speed = 0.3; }
      d.hidden = d.mode === 'home';
      if (d.hidden || tx === undefined) continue;
      // pairs keep together: the second of each pair follows the first
      const lead = d.i % 2 ? this.ducks[d.i - 1] : null;
      if (lead && !lead.hidden) { tx = lead.x - Math.sin(lead.yaw) * 0.6 + Math.cos(lead.yaw) * 0.25; tz = lead.z - Math.cos(lead.yaw) * 0.6 - Math.sin(lead.yaw) * 0.25; }
      const dx = tx - d.x, dz = tz - d.z, L = Math.hypot(dx, dz);
      if (L > 0.2) {
        const st = Math.min(L, speed * dt * (L > 3 ? 1.3 : 1));
        const nx = d.x + (dx / L) * st, nz = d.z + (dz / L) * st;
        if (!onWater || pointInRing(nx, nz, ring)) { d.x = nx; d.z = nz; }
        d.yaw = angleDamp(d.yaw, Math.atan2(dx, dz), 5, dt);
        d.phase += dt * (onWater ? 3 : 9);
      }
      d.gait = onWater ? 2 : L > 0.2 ? 4 : 0;
      d.y = onWater ? H.lake.level - 0.02 : W.heightAt(d.x, d.z);
      if (onWater && L > 0.3 && Math.random() < dt * 0.4) this.g.splash?.ripple(d.x, H.lake.level, d.z, 0.35);
    }
  }

  // ------------------------------------------------------------------ animals around you
  /** move far-away 'local' animals to somewhere near the camera, out of sight */
  localize() {
    const g = this.g, W = g.world, cam = g.camera, cp = cam.position, r = this.rnd;
    const fw = cam.getWorldDirection(this._fw || (this._fw = new THREE.Vector3()));
    const T = g.veg.positions, h = g.clock.hour, night = h > 19.5 || h < 5.2;
    for (const a of this.list) {
      if (!a.local) continue;
      if ((a.x - cp.x) ** 2 + (a.z - cp.z) ** 2 < 240 * 240 && a.placed) continue;
      if (a.local === 'forest' && !night) continue;
      for (let t = 0; t < 12; t++) {
        let x, z;
        if (a.local === 'free') { const an = r() * 6.28, d = 45 + r() * 130; x = cp.x + Math.cos(an) * d; z = cp.z + Math.sin(an) * d; }
        else {
          // near a tree: sample the tree list for one in range (forest: one with neighbours)
          const i = Math.floor(r() * (T.length / 2)) * 2;
          x = T[i] + (r() - 0.5) * 3; z = T[i + 1] + (r() - 0.5) * 3;
          const d = Math.hypot(x - cp.x, z - cp.z);
          if (d < 40 || d > 190) { if (t < 11) continue; const an = r() * 6.28, dd = 60 + r() * 100; x = cp.x + Math.cos(an) * dd; z = cp.z + Math.sin(an) * dd; }
        }
        if (!W.insideCampus(x, z) || W.buildingAt(x, z) || W.waterAt(x, z)) continue;
        const vx = x - cp.x, vz = z - cp.z, vd = Math.hypot(vx, vz) || 1;
        if ((vx * fw.x + vz * fw.z) / (vd * (Math.hypot(fw.x, fw.z) || 1)) > 0.5 && vd < 110) continue;
        a.x = a.hx = x; a.z = a.hz = z; a.y = W.heightAt(x, z); a.placed = true; a.state = 'rest'; a.t = r() * 6;
        if (a.local === 'tree') a.tree = [x, z];
        break;
      }
    }
  }

  groundStep(dt) {
    const g = this.g, W = g.world, cp = g.camera.position, P = g.player.pos, r = this.rnd, h = g.clock.hour;
    const day = h > 6 && h < 18.3 && g.weather.state.rain < 0.3;
    for (const b of this.ground) {
      b.hidden = !day;
      if (!day) { b.placed = false; continue; }
      if (!b.placed || (b.x - cp.x) ** 2 + (b.z - cp.z) ** 2 > 150 * 150) {
        const an = r() * 6.28, d = 20 + r() * 90, x = cp.x + Math.cos(an) * d, z = cp.z + Math.sin(an) * d;
        if (W.insideCampus(x, z) && !W.buildingAt(x, z) && !W.waterAt(x, z)) { b.x = x; b.z = z; b.y = W.heightAt(x, z); b.placed = true; b.state = 'peck'; b.vy = 0; }
        continue;
      }
      const dp = Math.hypot(b.x - P.x, b.z - P.z);
      if (b.state === 'peck') {
        b.t -= dt;
        if (b.t <= 0) { b.t = 1 + r() * 3; b.yaw += (r() - 0.5) * 2; b.hop = 0.35; }
        if (b.hop > 0) { b.hop -= dt; b.x += Math.sin(b.yaw) * dt * 0.6; b.z += Math.cos(b.yaw) * dt * 0.6; }
        b.gait = b.hop > 0 ? 0 : 3; b.phase += dt;
        b.y = W.heightAt(b.x, b.z);
        if (dp < 4) { b.state = 'fly'; b.vy = 3.5; b.yaw = Math.atan2(b.x - P.x, b.z - P.z) + (r() - 0.5); b.t = 2.5 + r(); g.audio.tone?.(1500 + r() * 800, 0.05, { gain: 0.02 }); }
      } else {
        b.t -= dt; b.vy = Math.max(-1, b.vy - dt * 2);
        b.x += Math.sin(b.yaw) * 5 * dt; b.z += Math.cos(b.yaw) * 5 * dt; b.y += b.vy * dt;
        b.gait = 1; b.phase += dt * 18;
        const gh = W.heightAt(b.x, b.z);
        if (b.t <= 0 && b.y <= gh + 0.1) { b.state = 'peck'; b.y = gh; b.t = 2; }
        if (b.y < gh) b.y = gh;
      }
    }
    for (const k of this.kings) {
      // hover, dive, fly low over the water
      k.t += dt;
      const ring = k.w.rings[0];
      if (!k.cx) { let cx = 0, cz = 0; for (let q = 0; q < ring.length; q += 2) { cx += ring[q]; cz += ring[q + 1]; } k.cx = cx / (ring.length / 2); k.cz = cz / (ring.length / 2); }
      const a = k.t * 0.12 + k.seed * 6, R = 10 + Math.sin(k.t * 0.3) * 6;
      k.x = k.cx + Math.cos(a) * R; k.z = k.cz + Math.sin(a) * R;
      const dive = Math.max(0, Math.sin(k.t * 0.7) - 0.93) * 40;
      k.y = k.w.level + 2.5 - dive * 2.4;
      k.yaw = a + Math.PI / 2; k.gait = day ? 1 : -1; k.phase += dt * 30;
      if (dive > 1.5 && Math.random() < dt * 4) this.g.splash?.burst(k.x, k.w.level, k.z, 5, 0.8);
      if (Math.hypot(k.x - P.x, k.z - P.z) < 30) this.spot('kingfisher');
    }
  }

  /** dusk: long lines of egrets, crows and parakeets heading for the hills; dawn: the other way */
  flockStep(dt) {
    const g = this.g, h = g.clock.hour, cp = g.camera.position, W = g.world, r = this.rnd;
    const dusk = h > 16.9 && h < 18.4, dawn = h > 5.1 && h < 6.4;
    this.flockT -= dt;
    if ((dusk || dawn) && this.flockT <= 0 && this.homeFlocks.length < 4) {
      this.flockT = 9 + r() * 10;
      const kind = r() < 0.45 ? 'egret' : r() < 0.6 ? 'crow' : 'parakeet';
      const col = new THREE.Color(kind === 'egret' ? '#f4f4ef' : kind === 'crow' ? '#1c1c1e' : '#3fa34d');
      const dir = (dusk ? 0.6 : 0.6 + Math.PI) + (r() - 0.5) * 0.6;           // towards the hills in the evening
      const n = kind === 'egret' ? 14 + Math.floor(r() * 16) : 18 + Math.floor(r() * 22);
      const side = (r() - 0.5) * 240;
      const sx = cp.x - Math.sin(dir) * 420 + Math.cos(dir) * side, sz = cp.z - Math.cos(dir) * 420 - Math.sin(dir) * side;
      const birds = [];
      for (let i = 0; i < n; i++) {
        // a V: alternate arms behind the leader
        const arm = i === 0 ? 0 : (i % 2 ? 1 : -1), rank = Math.ceil(i / 2);
        birds.push({ kind, ox: arm * rank * 2.6 + (r() - 0.5), oz: -rank * 2.2 + (r() - 0.5), oy: (r() - 0.5) * 2, x: 0, y: 0, z: 0, yaw: dir, gait: 1, phase: r() * 6, scale: kind === 'egret' ? 2.6 : kind === 'crow' ? 1.6 : 1.2, seed: r(), col });
      }
      this.homeFlocks.push({ x: sx, z: sz, dir, h: 55 + r() * 45, v: kind === 'egret' ? 11 : 13, birds, t: 0 });
      if (this.homeFlocks.length === 1) this.spot(kind === 'egret' ? 'egret' : kind === 'crow' ? 'crow' : 'parakeet');
    }
    for (let i = this.homeFlocks.length - 1; i >= 0; i--) {
      const f = this.homeFlocks[i];
      f.t += dt;
      f.x += Math.sin(f.dir) * f.v * dt; f.z += Math.cos(f.dir) * f.v * dt;
      const gh = W.heightAt(f.x, f.z);
      const s = Math.sin(f.dir), c2 = Math.cos(f.dir);
      f.birds.forEach((b, k) => {
        const wob = Math.sin(g.time * 0.8 + k) * 0.6;
        b.x = f.x + b.ox * c2 + b.oz * s + wob; b.z = f.z - b.ox * s + b.oz * c2; b.y = gh + f.h + b.oy + Math.sin(g.time + k) * 0.8;
        b.yaw = f.dir; b.phase += dt * (b.kind === 'egret' ? 9 : 16); b.gait = (Math.sin(g.time * 0.9 + k) > 0.6 && b.kind === 'egret') ? 2 : 1;
      });
      if (f.t > 90) this.homeFlocks.splice(i, 1);
    }
  }

  /** feed a dog or cat that is near you (biscuits from your pocket) */
  feedable(x, z) {
    let best = null, bd = 2.6;
    for (const a of this.list) { if ((a.kind !== 'dog' && a.kind !== 'cat') || !a.visible || a.far) continue; const d = Math.hypot(a.x - x, a.z - z); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  feed(a) {
    const g = this.g;
    if (!g.progress.spend(10, 'biscuits', () => this.feed(a))) return;
    a.state = 'eat'; a.t = 6; a.tx = g.player.pos.x; a.tz = g.player.pos.z; a.fed = (a.fed || 0) + 1; a.friend = g.time + 90;
    g.acts.run('feed', { animal: a });
    if (a.kind === 'dog') g.audio.bark?.(0, 0.4); else g.audio.meow?.(0);
    g.progress.count?.('fed');
    g.progress.unlock?.('animal_friend');
    g.ui.toast(a.kind === 'dog' ? 'The dog wolfs down the biscuits and wags its tail. It will follow you for a while.' : 'The cat eats daintily, then rubs against your leg.', 'info', 'Fed');
  }

  makeParticles(scene) {
    const N = 160;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    const tex = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return c; })());
    const mat = new THREE.PointsMaterial({ size: 0.35, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    const seeds = Array.from({ length: N }, () => [Math.random() * 60 - 30, Math.random() * 60 - 30, Math.random() * 2 + 0.4, Math.random() * 6.28]);
    return { pts, g, mat, seeds, N };
  }

  // ------------------------------------------------------------------ behaviour
  update(dt) {
    const g = this.g, W = g.world, h = g.clock.hour, r = this.rnd;
    const night = h > 19.5 || h < 5.2;
    const cam = g.camera.position;
    const P = g.player.pos;
    const hot = h > 12 && h < 15.5;
    this.localT -= dt;
    if (this.localT <= 0 && !g.interior?.active) { this.localT = 1.2; this.localize(); }
    this.duckStep(dt, h);
    this.flockStep(dt);
    this.groundStep(dt);
    for (const a of this.list) {
      const d = Math.hypot(a.x - cam.x, a.z - cam.z);
      a.visible = !((a.night && !night) || (a.monsoon && g.weather.state.rain < 0.1 && !(g.clock.month >= 5 && g.clock.month <= 8)));
      if (!a.visible) continue;
      if (d > 260) { a.far = true; continue; }
      a.far = false;
      a.t -= dt;
      const dp = Math.hypot(a.x - P.x, a.z - P.z);
      // shy animals keep their distance from you; dogs sometimes come to say hello
      if ((a.kind === 'jackal' || a.kind === 'squirrel' || a.kind === 'mongoose' || a.kind === 'snake' || a.kind === 'cat') && dp < (a.kind === 'squirrel' ? 4 : 9) && a.state !== 'flee') {
        a.state = 'flee'; a.t = 2.5; a.tx = a.x + (a.x - P.x) * 3; a.tz = a.z + (a.z - P.z) * 3;
      }
      if (a.kind === 'dog' && dp < 6 && a.state === 'rest' && r() < dt * 0.3) { a.state = 'greet'; a.t = 6; }
      // a dog you fed trots along with you for a while
      if (a.friend > g.time && a.state !== 'eat' && dp > 3) { a.state = 'greet'; a.t = 2; }
      if (a.state === 'eat') { a.t -= dt; a.gait = GAIT.SNIFF; a.phase += dt * 4; a.y = W.heightAt(a.x, a.z); if (a.t <= 0) { a.state = 'rest'; a.t = 3; } continue; }
      if (a.t <= 0) {
        if (a.state === 'walk' || a.state === 'flee' || a.state === 'greet') { a.state = 'rest'; a.t = (hot && a.kind === 'dog' ? 40 : 8) + r() * 25; a.restGait = a.kind === 'dog' ? (hot || r() < 0.4 ? GAIT.LIE : r() < 0.5 ? GAIT.SIT : GAIT.STAND) : a.kind === 'squirrel' ? GAIT.UPRIGHT : a.kind === 'cat' ? (r() < 0.5 ? GAIT.SIT : GAIT.LIE) : GAIT.STAND; }
        else {
          a.state = 'walk'; a.t = 6 + r() * 14;
          let tx, tz;
          for (let k = 0; k < 8; k++) { const an = r() * 6.28, dd = 5 + r() * a.range; tx = a.hx + Math.cos(an) * dd; tz = a.hz + Math.sin(an) * dd; if (W.insideCampus(tx, tz) && !W.buildingAt(tx, tz) && !W.waterAt(tx, tz)) break; }
          a.tx = tx; a.tz = tz;
          if (a.roamer && r() < 0.3) { a.hx = tx; a.hz = tz; }
        }
      }
      let speed = 0;
      if (a.state === 'walk' || a.state === 'flee' || a.state === 'greet') {
        if (a.state === 'greet') { a.tx = P.x + Math.sin(a.seed * 9) * 1.4; a.tz = P.z + Math.cos(a.seed * 9) * 1.4; }
        const dx = a.tx - a.x, dz = a.tz - a.z, L = Math.hypot(dx, dz);
        const base = { dog: 1.2, cat: 0.8, jackal: 1.6, mongoose: 1.4, squirrel: 1.2, snake: 0.35 }[a.kind] || 1;
        speed = a.state === 'flee' ? base * 3.2 : a.state === 'greet' ? base * 1.6 : base;
        if (L < 0.8) { if (a.state !== 'greet') a.t = 0; speed = 0; }
        else {
          const nx = a.x + (dx / L) * speed * dt, nz = a.z + (dz / L) * speed * dt;
          if (!W.buildingAt(nx, nz) && !W.waterAt(nx, nz) && W.insideCampus(nx, nz)) { a.x = nx; a.z = nz; } else a.t = 0;
          a.yaw = angleDamp(a.yaw, Math.atan2(dx, dz), 6, dt);
        }
      }
      a.y = W.heightAt(a.x, a.z);
      a.gait = speed === 0 ? (a.state === 'greet' ? GAIT.SIT : a.restGait ?? GAIT.STAND) : speed > 2.5 ? GAIT.RUN : speed > 1.4 ? GAIT.TROT : GAIT.WALK;
      if (a.kind === 'snake') a.gait = GAIT.WALK;
      a.phase += speed * dt * (a.kind === 'squirrel' ? 18 : a.kind === 'cat' ? 7 : 5);
      if (a.kind === 'snake') a.phase += dt * 6;
      // night barking / howling
      if (night && d < 120 && r() < dt * (a.kind === 'dog' ? 0.02 : a.kind === 'jackal' ? 0.012 : 0)) {
        if (a.kind === 'dog') { a.gait = GAIT.BARK; g.audio.bark?.(this.pan(a), Math.max(0.2, 1 - d / 120)); } else g.audio.howl?.(this.pan(a));
      }
      if (dp < 14) this.spot(a.kind);
    }
    // birds
    const t = g.time;
    for (const b of this.birds) {
      if (b.mode === 'soar') { b.a += b.w * dt; b.x = b.cx + Math.cos(b.a) * b.R; b.z = b.cz + Math.sin(b.a) * b.R; b.y = W.heightAt(b.x, b.z) + b.h; b.yaw = b.a + Math.PI; b.phase = Math.sin(t * 0.4) * 0.3; b.gait = night ? -1 : 2; }
      else if (b.mode === 'swim') { b.x += Math.sin(b.yaw) * 0.25 * dt; b.z += Math.cos(b.yaw) * 0.25 * dt; if (!b.lake || !pointInRing(b.x, b.z, b.lake.rings[0]) || closestOnRing(b.x, b.z, b.lake.rings[0], { d: 0, x: 0, z: 0 }).d < 2) b.yaw += Math.PI * 0.8; if (r() < dt * 0.1) b.yaw += (r() - 0.5); b.phase += dt * 3; }
      else { if (r() < dt * 0.15) b.yaw += (r() - 0.5) * 2; b.phase += dt; b.gait = r() < 0.5 ? 0 : 3; }
      if (Math.hypot(b.x - P.x, b.z - P.z) < 18 && b.mode !== 'soar') this.spot(b.kind);
      if (b.mode === 'soar' && Math.hypot(b.x - P.x, b.z - P.z) < 80) this.spot('kite');
    }
    for (const f of this.flocks) {
      f.t -= dt;
      if (f.t <= 0) { f.t = 20 + r() * 30; f.tx = (r() - 0.5) * 1200; f.tz = (r() - 0.5) * 1400; }
      const dx = f.tx - f.cx, dz = f.tz - f.cz, L = Math.hypot(dx, dz) || 1;
      f.cx += (dx / L) * 9 * dt; f.cz += (dz / L) * 9 * dt;
      const yaw = Math.atan2(dx, dz), gh = W.heightAt(f.cx, f.cz);
      f.birds.forEach((b, i) => { b.x = f.cx + b.ox + Math.sin(t * 0.7 + i) * 2; b.z = f.cz + b.oz + Math.cos(t * 0.6 + i) * 2; b.y = gh + f.h + b.oy + Math.sin(t + i) * 1.5; b.yaw = yaw; b.phase += dt * 16; b.gait = 1; });
      f.hidden = night;
    }
    // fireflies on humid nights near vegetation, butterflies by day
    const m = g.clock.month, fx = this.fx;
    const flies = night && m >= 3 && m <= 9 && g.weather.state.rain < 0.2 && !g.interior?.active;
    const butter = !night && h > 8 && h < 17 && g.weather.state.rain < 0.1 && !g.interior?.active && P.y - W.heightAt(P.x, P.z) < 5;
    fx.pts.visible = flies || butter;
    if (fx.pts.visible) {
      const pos = fx.g.attributes.position.array, col = fx.g.attributes.color.array;
      fx.mat.size = flies ? 0.35 : 0.22;
      fx.mat.blending = flies ? THREE.AdditiveBlending : THREE.NormalBlending;
      const n = flies ? fx.N : 40;
      for (let i = 0; i < fx.N; i++) {
        const [ox, oz, oy, ph] = fx.seeds[i];
        const x = P.x + ox + Math.sin(t * 0.3 + ph) * 3, z = P.z + oz + Math.cos(t * 0.27 + ph) * 3;
        const y = i < n ? W.heightAt(x, z) + oy + Math.sin(t * 1.3 + ph) * 0.4 : -9999;
        pos.set([x, y, z], i * 3);
        if (flies) { const k = Math.max(0, Math.sin(t * 2.2 + ph * 5)) ** 3; col.set([0.75 * k, 1.0 * k, 0.25 * k], i * 3); }
        else { const cc = [[1, 0.6, 0.1], [1, 0.95, 0.3], [0.95, 0.95, 0.95], [0.3, 0.5, 1]][i % 4]; col.set(cc, i * 3); }
      }
      fx.g.attributes.position.needsUpdate = true; fx.g.attributes.color.needsUpdate = true;
      if (flies && this.g.time % 5 < dt) this.spot('firefly');
    }
  }

  pan(a) { const v = new THREE.Vector3(a.x - this.g.camera.position.x, 0, a.z - this.g.camera.position.z).normalize(); const rt = new THREE.Vector3(1, 0, 0).applyQuaternion(this.g.camera.quaternion); return clamp(v.dot(rt), -1, 1); }

  spot(kind) {
    if (this.g.progress.spot(kind)) this.g.ui.toast(NAMES[kind] || kind, 'info', 'Spotted');
  }

  draw() {
    const R = this.R, g = this.g;
    R.begin(g.time);
    if (!g.interior?.active) {
      const cam = g.camera.position;
      for (const a of this.list) { if (!a.visible || a.far) continue; R.push(a.kind, a); }
      for (const b of this.birds) { if (b.gait < 0) continue; if (Math.hypot(b.x - cam.x, b.z - cam.z) > 400) continue; R.push('bird', b); }
      for (const f of this.flocks) { if (f.hidden) continue; for (const b of f.birds) R.push('bird', b); }
      for (const d of this.ducks) if (!d.hidden && (d.x - cam.x) ** 2 + (d.z - cam.z) ** 2 < 250 * 250) R.push('bird', d);
      for (const f of this.homeFlocks) for (const b of f.birds) R.push('bird', b);
      for (const b of this.ground) if (!b.hidden && b.placed) R.push('bird', b);
      for (const k of this.kings) if (k.gait >= 0 && (k.x - cam.x) ** 2 + (k.z - cam.z) ** 2 < 250 * 250) R.push('bird', k);
    }
    R.end();
  }
}

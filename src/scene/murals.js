// Murals on the campus walls: spray-can graffiti with each hostel's name, big hand-painted scenes
// of Assam on the hostels (mural_art.js), themed walls at the SAC, New SAC, Gym, Food Court, Market,
// Guest House and Hospital, a children's wall at the KV, and small folk-art panels on some staff
// quarters.
//
// planMurals() runs BEFORE the buildings are built: it picks each wall and cuts a window-free,
// plastered patch into it (b.blanks, used by buildings.js), aligned to whole window bays and whole
// floors so no window is ever half covered. buildMurals() paints the murals onto a few shared
// canvases and lays them on those patches.
import * as THREE from 'three';
import { mulberry32, fitText } from '../util.js';
import { SCENES } from './mural_art.js';
import { PLAN } from '../plan_data.js';
import { FILTERS } from '../route.js';

const BAY = 3.2, FLOOR = 3.3;                 // as the facades in buildings.js
const SLOGANS = ['CHAK DE', 'NEVER GIVE UP', 'CODE · EAT · SLEEP · REPEAT', 'HOME AWAY FROM HOME', 'SEE YOU AT THE TAPRI', 'LIVE · LAUGH · LAB', 'ONE CAMPUS ONE FAMILY', 'MIDNIGHT NOODLES CLUB', 'FROM THE BRAHMAPUTRA WITH LOVE', 'SPIRIT OF IITG'];
const PALS = [['#ff4f7a', '#ffd23f', '#3bceac', '#0ead69'], ['#7b2cbf', '#ff9e00', '#00bbf9', '#f15bb5'], ['#ef476f', '#ffd166', '#06d6a0', '#118ab2'], ['#fb5607', '#ffbe0b', '#3a86ff', '#8338ec']];
const HOSTEL_SCENES = ['sunsetRiver', 'kaziranga', 'teaGarden', 'hornbillForest', 'bridgeDusk', 'nightCampus', 'bihu'];
const HOUSE_ART = ['japiWall', 'kopouWall', 'lotusPond', 'sunsetRiver', 'kaziranga', 'teaGarden'];
const SITE_ART = { sac: 'musicWall', newsac: 'bihu', gym: 'sportsWall', foodcourt: 'foodWall', shopping: 'teaGarden', guesthouse: 'sunsetRiver', hospital: 'lotusPond' };
const GRAFFITI_SITES = new Set(['sac', 'newsac', 'foodcourt']);
// (no hostel's name is written on another hostel's wall: the street art uses these words, and a hostel's own wall uses its own name and Assam only)
const WORDS = ['IITG', 'SPIRIT', 'CHAI', 'CODE', 'BIHU', 'TECHNICHE', 'ALCHERINGA', 'RHINO', 'LAKE', 'GAMOSA', 'JAPI', 'MUGA', 'XORAI', 'KAZIRANGA', 'MAJULI', 'AXOM', 'HORNBILL', 'DHOL', 'SATTRIYA', 'TEA'];
const ASSAM_WORDS = ['BIHU', 'GAMOSA', 'JAPI', 'MUGA', 'XORAI', 'KAZIRANGA', 'MAJULI', 'AXOM', 'HORNBILL', 'DHOL', 'SATTRIYA', 'RHINO', 'TEA', 'HUSORI', 'ASSAM'];
const ASSAM_SLOGANS = ['JOI AAI AXOM', 'LAND OF THE RED RIVER AND BLUE HILLS', 'BIHU IN OUR BLOOD', 'GAMOSA PRIDE', 'KAZIRANGA CALLING', 'MUGA SILK · GOLDEN DREAMS', 'ONE HORN · ONE HOME', 'WHERE THE BRAHMAPUTRA FLOWS', 'TEA GARDENS AND BIHU NIGHTS', 'DHOL · PEPA · HUSORI'];
const STREET = ['graffiti', 'streetRhino', 'graffiti', 'circuitArt', 'graffiti', 'robotArt', 'skylineArt', 'graffiti'];       // the street art put on more walls

/** the walls of a building's outline with the facade's running length, laid out as buildings.js does */
function walls(b) {
  const ring = b.rings[0], n = ring.length, out = [];
  let cum = 0;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n, ax = ring[i], az = ring[i + 1], bx = ring[j], bz = ring[j + 1];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    if (L < 0.05) continue;
    out.push({ b, i, ax, az, bx, bz, L, tx: dx / L, tz: dz / L, nx: -dz / L, nz: dx / L, cum });
    cum += L;
  }
  return out;
}

export function planMurals(W, G) {
  const r = mulberry32(1729);
  const murals = [];
  const usedWall = new Set();
  const open = (x, z) => W.insideCampus(x, z) && !W.buildingAt(x, z) && !W.waterAt(x, z);
  const nearRoad = (x, z, nx, nz) => { for (let d = 3; d <= 26; d += 2.5) if (G.onRoad(x + nx * d, z + nz * d, 1)) return d; return 0; };
  // the green roadside name board of each landmark (props.js puts it 5.5 m off the road, towards the
  // landmark): no mural right behind one
  const boards = [];
  const boardFor = (x, z) => { const nr = G.nearestOnNetwork(x, z, FILTERS.car); if (!nr || nr.d > 90) return; const dx = x - nr.x, dz = z - nr.z, L = Math.hypot(dx, dz) || 1; boards.push({ x: nr.x + (dx / L) * 5.5, z: nr.z + (dz / L) * 5.5 }); };
  for (const l of W.landmarks) boardFor(l.wx, l.wz);

  /** a mural of `bays` window bays by `floors` floors (0: the whole wall height) on wall wl, or null */
  function fit(wl, bays, floors, avoid = [], minAspect = 0.2, maxAspect = 0.95) {
    const b = wl.b;
    const k0 = Math.ceil(wl.cum / BAY - 1e-6), k1 = Math.floor((wl.cum + wl.L) / BAY + 1e-6);
    if (k1 - k0 < bays) return null;
    const mid = (k0 + k1 - bays) / 2;
    const starts = [];
    for (let ks = k0; ks <= k1 - bays; ks++) starts.push(ks);
    starts.sort((a, c) => Math.abs(a - mid) - Math.abs(c - mid));
    for (const ks of starts) {
      const s0 = ks * BAY - wl.cum, s1 = s0 + bays * BAY, sm = (s0 + s1) / 2;
      const cx = wl.ax + wl.tx * sm, cz = wl.az + wl.tz * sm;
      if (avoid.some((p) => Math.hypot(p.x - cx, p.z - cz) < bays * BAY / 2 + (p.r ?? 4))) continue;
      if (boards.some((p) => { const du = (p.x - cx) * wl.tx + (p.z - cz) * wl.tz, dv = (p.x - cx) * wl.nx + (p.z - cz) * wl.nz; return dv > 0 && dv < 16 && Math.abs(du) < (s1 - s0) / 2 + 1.5; })) continue;
      // the ground in front of the patch: not too steep along it
      let gmax = -Infinity, gmin = Infinity;
      for (let k = 0; k <= 4; k++) { const s = s0 + 0.4 + (k / 4) * (s1 - s0 - 0.8), x = wl.ax + wl.tx * s + wl.nx * 1.0, z = wl.az + wl.tz * s + wl.nz * 1.0, y = W.heightAt(x, z); gmax = Math.max(gmax, y); gmin = Math.min(gmin, y); }
      if (gmax - gmin > 1.6) continue;
      // open ground in front of it (no building, lake or campus wall right there)
      let ok = true;
      for (const d of [1.5, 4, 8]) for (const f of [0.15, 0.5, 0.85]) { const s = s0 + f * (s1 - s0); if (!open(wl.ax + wl.tx * s + wl.nx * d, wl.az + wl.tz * s + wl.nz * d)) ok = false; }
      if (!ok) continue;
      const bottom = Math.max(gmax, b.base) + 0.45;
      let y1 = floors ? b.floor0 + floors * FLOOR : b.roof;
      if (y1 > b.roof - 0.6) y1 = b.roof;
      const mw = bays * BAY - 0.8, mh = y1 - (y1 === b.roof ? 0.5 : 0.35) - bottom;
      if (mh < 1.8 || mh / mw < minAspect || mh / mw > maxAspect) continue;
      return { b, i: wl.i, s0, s1, y1, cx, cz, nx: wl.nx, nz: wl.nz, tx: wl.tx, tz: wl.tz, yaw: Math.atan2(wl.nx, wl.nz), mw, mh, bottom, key: `${b.i}:${wl.i}` };
    }
    return null;
  }
  function claim(spec, art, opts = {}, size = 'scene') {
    const b = spec.b;
    (b.blanks ||= []).push({ i: spec.i, s0: spec.s0, s1: spec.s1, y1: spec.y1 });
    usedWall.add(spec.key);
    murals.push({ ...spec, art, opts, size, seed: Math.floor(r() * 1e9) });
    // keep trees from growing in front of it (the grass stays)
    (W.clearings ||= []).push({ x: spec.cx, z: spec.cz, r: 0, keepGrass: true, area: { cx: spec.cx + spec.nx * 3.4, cz: spec.cz + spec.nz * 3.4, ax: spec.tx, az: spec.tz, hl: spec.mw / 2 + 1.2, hw: 3.2 } });
  }
  /** the walls of these buildings worth painting, best first */
  function candidates(blocks, entrance, minL = 7) {
    const list = [];
    for (const b of blocks) for (const wl of walls(b)) {
      if (wl.L < minL || usedWall.has(`${b.i}:${wl.i}`)) continue;
      const mx = wl.ax + wl.tx * wl.L / 2, mz = wl.az + wl.tz * wl.L / 2;
      if (!open(mx + wl.nx * 2.5, mz + wl.nz * 2.5)) continue;
      const seen = nearRoad(mx, mz, wl.nx, wl.nz);
      const ent = entrance && Math.hypot(mx - entrance.x, mz - entrance.z) < 6 ? -40 : 0;
      list.push({ wl, mx, mz, score: Math.min(wl.L, 40) + (seen ? 25 - seen * 0.5 : 0) + ent + r() * 6 });
    }
    return list.sort((a, c) => c.score - a.score);
  }
  const place = (cands, tries, avoid, art, opts, size, far = []) => {
    for (const c of cands) {
      if (far.some((p) => Math.hypot(p.cx - c.mx, p.cz - c.mz) < 16 || (p.nx * c.wl.nx + p.nz * c.wl.nz > 0.9 && Math.hypot(p.cx - c.mx, p.cz - c.mz) < 30))) continue;
      for (const [bays, floors, lo, hi] of tries) { const s = fit(c.wl, bays, floors, avoid, lo, hi); if (s) { claim(s, art, opts, size); return s; } }
    }
    return null;
  };

  // hostels (and the SAC, New SAC, Food Court): the graffiti with the name, then a painted scene
  let n = 0, sceneK = 0;
  for (const s of W.sites) {
    const hostel = s.kind === 'hostel', lm = s.lm;
    if (!hostel && !GRAFFITI_SITES.has(lm) && !SITE_ART[lm]) continue;
    const ent = { x: s.ex, z: s.ez, r: 7 };
    const cands = candidates(s.blocks, ent);
    const done = [];
    if (hostel || GRAFFITI_SITES.has(lm)) {
      const name = (W.landmark(lm)?.name || s.name || '').replace(' Hostel', '').replace('Student Activity Centre', 'SAC').replace('Married Scholars', 'MSH').toUpperCase();
      const pal = PALS[(n + name.length) % PALS.length], slogan = hostel ? ASSAM_SLOGANS[(n * 3 + name.length) % ASSAM_SLOGANS.length] : SLOGANS[(n * 3 + name.length) % SLOGANS.length];
      const g = place(cands, [[4, 2, 0.3, 0.62], [3, 2, 0.3, 0.72], [4, 1, 0.18, 0.62], [3, 1, 0.22, 0.72], [3, 0, 0.2, 0.8]], [ent], 'graffiti', { name, slogan, pal, culture: hostel }, 'graffiti');
      if (g) { done.push(g); n++; }
      // a second name wall on the bigger hostels (several blocks)
      if (hostel && s.blocks.length > 1) { const g2 = place(cands, [[4, 2, 0.3, 0.62], [3, 2, 0.3, 0.72]], [ent], 'graffiti', { name: ASSAM_WORDS[(n * 5 + name.length) % ASSAM_WORDS.length], slogan: ASSAM_SLOGANS[(n * 7 + 3) % ASSAM_SLOGANS.length], pal: PALS[(n + 1) % PALS.length], culture: true }, 'graffiti', done); if (g2) { done.push(g2); n++; } }
    }
    const art = hostel ? HOSTEL_SCENES[sceneK++ % HOSTEL_SCENES.length] : SITE_ART[lm];
    if (art) {
      const tall = [[4, 3, 0.55, 0.95], [4, 2, 0.4, 0.8], [3, 3, 0.6, 1.1], [3, 2, 0.5, 0.95], [4, 0, 0.35, 0.9], [3, 0, 0.4, 1.0], [5, 0, 0.3, 0.8], [3, 0, 0.26, 1.0], [4, 0, 0.22, 0.9], [2, 0, 0.3, 1.1]];
      place(cands, tall, [ent], art, {}, 'scene', done);
    }
  }
  // the children's wall at the Kendriya Vidyalaya
  {
    const kx = PLAN.kv.x, kz = -PLAN.kv.y;
    const kv = W.buildings.filter((b) => !b.site && b.kind !== 'residential' && b.area > 150 && Math.max(0, b.x0 - kx, kx - b.x1, b.z0 - kz, kz - b.z1) < 40).sort((a, c) => c.area - a.area)[0];
    if (kv) { boardFor((kv.x0 + kv.x1) / 2, (kv.z0 + kv.z1) / 2); const e = W.entranceOf(kv, G); place(candidates([kv], e), [[4, 2, 0.4, 0.8], [3, 2, 0.5, 0.95], [3, 0, 0.4, 1.0], [2, 0, 0.5, 1.1]], [{ x: e.x, z: e.z, r: 6 }], 'kidsWall', {}, 'scene'); }
  }
  // small folk-art panels on some staff quarters, spread over the campus, on walls the road can see
  {
    const houses = W.buildings.filter((b) => b.qtype && !b.site && b.lv <= 2 && b.area > 60 && b.area < 500 && Math.hypot((b.x0 + b.x1) / 2 + 160, (b.z0 + b.z1) / 2 + 318) > 50);
    for (let i = houses.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [houses[i], houses[j]] = [houses[j], houses[i]]; }
    const got = [];
    let k = 0;
    for (const b of houses) {
      if (got.length >= 14) break;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      if (got.some((q) => Math.hypot(q.x - cx, q.z - cz) < 90)) continue;
      const e = W.entranceOf(b, G);
      const cands = candidates([b], e, 6.5).filter((c) => nearRoad(c.mx, c.mz, c.wl.nx, c.wl.nz));
      const s = place(cands, [[2, 1, 0.3, 0.6], [2, 0, 0.3, 0.75]], [{ x: e.x, z: e.z, r: 3 }], HOUSE_ART[k % HOUSE_ART.length], {}, 'small');
      if (s) { got.push({ x: cx, z: cz }); k++; }
    }
  }
  // street art on more walls: the academic blocks, the sports and market buildings, the workshop and more of the hostels, in every style
  {
    const pool = W.buildings.filter((b) => !b.bungalow && ['academic', 'institutional', 'commercial', 'sports', 'hostel', 'guest'].includes(b.kind) && b.area > 120 && b.lv <= 6);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const got = [];
    let n2 = 0;
    for (const b of pool) {
      if (n2 >= 40) break;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      if (got.some((q) => Math.hypot(q.x - cx, q.z - cz) < 50)) continue;
      const e = W.entranceOf(b, G);
      const cands = candidates([b], e, 7).filter((c) => nearRoad(c.mx, c.mz, c.wl.nx, c.wl.nz));
      const art = STREET[n2 % STREET.length];
      const tries = art === 'graffiti' ? [[4, 2, 0.3, 0.7], [3, 2, 0.3, 0.8], [4, 1, 0.2, 0.7], [3, 1, 0.22, 0.8]] : [[4, 2, 0.35, 0.9], [3, 2, 0.4, 1.0], [4, 1, 0.3, 0.9], [3, 0, 0.4, 1.0]];
      const own = b.kind === 'hostel' ? (b.site?.name || b.name || '').replace(' Hostel', '').toUpperCase() : '';
      const opts = art === 'graffiti'
        ? (b.kind === 'hostel'
          ? { name: own && (n2 + b.i) % 2 === 0 ? own : ASSAM_WORDS[(n2 * 7 + b.i) % ASSAM_WORDS.length], slogan: ASSAM_SLOGANS[(n2 * 3 + b.i) % ASSAM_SLOGANS.length], pal: PALS[(n2 + 2) % PALS.length], culture: true }
          : { name: WORDS[(n2 * 7 + b.i) % WORDS.length], slogan: SLOGANS[(n2 * 3 + b.i) % SLOGANS.length], pal: PALS[(n2 + 2) % PALS.length] })
        : {};
      const s = place(cands, tries, [{ x: e.x, z: e.z, r: 5 }], art, opts, art === 'graffiti' ? 'graffiti' : 'scene');
      if (s) { got.push({ x: cx, z: cz }); n2++; }
    }
  }
  // the graffiti house: the house beside the Alcheringa mural board is one big graffiti wall (every wall, no door, no windows)
  // whose art follows what is running: Alcheringa, Techniche, the AI Confluence, the cricket final, sports day, convocation...
  {
    const hb = W.buildings.filter((b) => b.kind === 'residential' && !b.site && !b.bungalow && Math.hypot((b.x0 + b.x1) / 2 - 137, (b.z0 + b.z1) / 2 + 260) < 18).sort((a, c) => c.area - a.area)[0];
    if (hb) {
      hb.graffitiHouse = true; hb.display = 'Graffiti Wall';
      for (const wl of walls(hb)) {
        if (wl.L < 3.2) continue;
        const bays = Math.max(1, Math.min(8, Math.floor(wl.L / BAY)));
        const s = fit(wl, bays, 0, [], 0.05, 3);
        if (s) claim(s, 'eventWall', {}, 'scene');
      }
    }
  }
  W.murals = murals;
  return murals;
}

/** paint the planned murals onto shared canvases and lay them on their walls */
export function buildMurals(game) {
  const W = game.world, list = W.murals || [];
  const group = new THREE.Group();
  group.name = 'murals';
  if (!list.length) return { group, spots: [], count: 0 };
  const q = game.quality || 'medium';
  // widths that pack whole rows into a 2048 page (2 or 3 scenes, 3 or 4 name walls a row)
  const cap = { high: { scene: 1016, graffiti: 672, small: 504 }, medium: { scene: 672, graffiti: 504, small: 400 }, low: { scene: 504, graffiti: 400, small: 256 } }[q] || { scene: 672, graffiti: 504, small: 400 };
  const PAGE = 2048, GUT = 4;
  // shelf-pack every mural (tallest first) into 2048-wide pages
  const dyn = list.filter((m) => m.art === 'eventWall');                 // the walls that repaint with the event are drawn on their own canvases below
  const items = list.filter((m) => m.art !== 'eventWall').map((m) => { const pw = Math.min(cap[m.size], Math.round(m.mw * 90)); return { m, pw, ph: Math.max(16, Math.round((pw * m.mh) / m.mw)) }; }).sort((a, c) => c.ph - a.ph);
  const pages = [];
  for (const it of items) {
    const w = it.pw + GUT * 2, h = it.ph + GUT * 2;
    let shelf = null, page = null;
    for (const p of pages) { shelf = p.shelves.find((sh) => sh.x + w <= PAGE && h <= sh.h); if (shelf) { page = p; break; } }
    if (!shelf) {
      page = pages.find((p) => p.used + h <= PAGE);
      if (!page) { page = { shelves: [], used: 0, items: [] }; pages.push(page); }
      shelf = { y: page.used, h, x: 0 }; page.shelves.push(shelf); page.used += h;
    }
    it.px = shelf.x + GUT; it.py = shelf.y + GUT; shelf.x += w; page.items.push(it);
  }
  const spots = [];
  for (const p of pages) {
    const H = Math.min(PAGE, Math.ceil(p.used / 64) * 64);
    const c = document.createElement('canvas'); c.width = PAGE; c.height = H;
    const g = fitText(c.getContext('2d'));
    const pos = [], uv = [], idx = [];
    for (const it of p.items) {
      const m = it.m;
      fitText(g, [it.px, it.px + it.pw]);
      g.save(); g.translate(it.px, it.py); g.beginPath(); g.rect(0, 0, it.pw, it.ph); g.clip();
      const k = it.pw / 1024; g.scale(k, k);
      SCENES[m.art](g, 1024, it.ph / k, mulberry32(m.seed), m.opts);
      g.restore();
      // copy the edges into the gutter so the mipmaps do not bleed the neighbours in
      g.drawImage(c, it.px, it.py, 1, it.ph, it.px - GUT, it.py, GUT, it.ph);
      g.drawImage(c, it.px + it.pw - 1, it.py, 1, it.ph, it.px + it.pw, it.py, GUT, it.ph);
      g.drawImage(c, it.px - GUT, it.py, it.pw + GUT * 2, 1, it.px - GUT, it.py - GUT, it.pw + GUT * 2, GUT);
      g.drawImage(c, it.px - GUT, it.py + it.ph - 1, it.pw + GUT * 2, 1, it.px - GUT, it.py + it.ph, it.pw + GUT * 2, GUT);
      // the quad on the wall
      const sx = Math.cos(m.yaw), sz = -Math.sin(m.yaw), hw = m.mw / 2, hh = m.mh / 2;
      const x = m.cx + m.nx * 0.05, z = m.cz + m.nz * 0.05, y = m.bottom + hh, b = pos.length / 3;
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pos.push(x + sx * hw * u, y + hh * v, z + sz * hw * u);
      const u0 = it.px / PAGE, u1 = (it.px + it.pw) / PAGE, v1 = 1 - it.py / H, v0 = 1 - (it.py + it.ph) / H;
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      spots.push({ x: m.cx, z: m.cz, yaw: m.yaw, art: m.art, w: m.mw, h: m.mh });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // the event walls: one canvas each, repainted when the event changes (W.eventWall.paint(id), called by events/index.js)
  const walls2 = [];
  for (const m of dyn) {
    const cw = 1024, ch = Math.max(64, Math.round((cw * m.mh) / m.mw));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const hw = m.mw / 2, hh = m.mh / 2, sx = Math.cos(m.yaw), sz = -Math.sin(m.yaw);
    const x = m.cx + m.nx * 0.05, z = m.cz + m.nz * 0.05, y = m.bottom + hh;
    const pos = [], uv = [0, 0, 1, 0, 1, 1, 0, 1];
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pos.push(x + sx * hw * u, y + hh * v, z + sz * hw * u);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    mesh.receiveShadow = true; group.add(mesh);
    walls2.push({ c, tex, w: cw, h: ch, seed: m.seed });
    spots.push({ x: m.cx, z: m.cz, yaw: m.yaw, art: m.art, w: m.mw, h: m.mh });
  }
  const eventWall = { items: walls2, event: undefined,
    paint(id) {
      if (id === this.event) return;
      this.event = id;
      for (const it of this.items) { const g2 = fitText(it.c.getContext('2d')); g2.clearRect(0, 0, it.w, it.h); SCENES.eventWall(g2, it.w, it.h, mulberry32(it.seed), { event: id }); it.tex.needsUpdate = true; }
    } };
  eventWall.paint(null);
  W.eventWall = eventWall;
  return { group, spots, count: list.length, pages: pages.length };
}

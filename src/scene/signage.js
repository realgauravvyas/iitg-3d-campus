// Finding your way and reading the campus: green fingerposts at the junctions ("Manas Hostel
// 350 m ->"), "You are here" map boards at the gates and big junctions, road signs (speed limit
// 30, no horn near the hospital and library, school ahead), zebra crossings outside hostels and
// academic blocks, notice boards (mess timings, anti-ragging, library
// hours, club posters), the murals (murals.js), and dustbins along the roads.
import * as THREE from 'three';
import { mulberry32, m4, mergeColored, fitText } from '../util.js';
import { FILTERS } from '../route.js';
import { MEALS } from '../interiors/templates.js';
import { buildMurals } from './murals.js';
import { drawCampusMap, hereLabelCanvas } from './mapart.js';
import { ROAD_TOP } from './roads.js';

const fmtH = (h) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh >= 12 && hh < 24 ? 'PM' : 'AM'}`; };
const fmtD = (m) => (m < 950 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(1)} km`);
const FONT = (w, px) => `${w} ${px}px "Hind", "Segoe UI", system-ui, sans-serif`;

/** Many boards share a few canvases: each board is a row (or a double row) in an atlas. */
class Atlas {
  constructor(w, rowH, rows) { this.w = w; this.rowH = rowH; this.rows = rows; this.pages = []; this.quads = []; }
  /** reserve n rows; draw(g, x0, y0, w, h) fills them. Returns {page, v0, v1} */
  add(n, draw) {
    let pg = this.pages[this.pages.length - 1];
    if (!pg || pg.used + n > this.rows) {
      const c = document.createElement('canvas');
      c.width = this.w; c.height = this.rowH * this.rows;
      pg = { c, g: fitText(c.getContext('2d')), used: 0 };
      this.pages.push(pg);
    }
    const y0 = pg.used * this.rowH, h = n * this.rowH;
    pg.g.save(); pg.g.beginPath(); pg.g.rect(0, y0, this.w, h); pg.g.clip();
    draw(pg.g, 0, y0, this.w, h);
    pg.g.restore();
    pg.used += n;
    const H = this.rowH * this.rows;
    return { page: this.pages.length - 1, v0: 1 - (y0 + h) / H, v1: 1 - y0 / H };
  }
  /** quad centred at (x,y,z), facing yaw (normal = +z rotated), size w x h, uv rectangle */
  quad(slot, x, y, z, yaw, w, h, u0 = 0, u1 = 1, tilt = 0) {
    this.quads.push({ slot, x, y, z, yaw, w, h, u0, u1, tilt });
  }
  build(group, { emissive = 0, side = THREE.FrontSide, transparent = false } = {}) {
    const byPage = this.pages.map(() => ({ p: [], uv: [], idx: [] }));
    for (const q of this.quads) {
      const B = byPage[q.slot.page];
      const sx = Math.cos(q.yaw), sz = -Math.sin(q.yaw);
      const hw = q.w / 2, hh = q.h / 2, b = B.p.length / 3;
      const ty = Math.cos(q.tilt), tz = Math.sin(q.tilt);
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const up = hh * v;
        B.p.push(q.x + sx * hw * u + Math.sin(q.yaw) * up * tz, q.y + up * ty, q.z + sz * hw * u + Math.cos(q.yaw) * up * tz);
      }
      B.uv.push(q.u0, q.slot.v0, q.u1, q.slot.v0, q.u1, q.slot.v1, q.u0, q.slot.v1);
      B.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    byPage.forEach((B, i) => {
      if (!B.p.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      geo.setIndex(B.idx);
      geo.computeVertexNormals();
      const tex = new THREE.CanvasTexture(this.pages[i].c);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side, transparent, alphaTest: transparent ? 0.3 : 0, polygonOffset: transparent, polygonOffsetFactor: -4 });
      if (emissive) { mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = tex; mat.emissiveIntensity = 0; }
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      group.add(m);
      this.mats = this.mats || []; this.mats.push(mat);
    });
  }
}

export function buildSignage(game) {
  const W = game.world, G = game.graph, r = mulberry32(5150);
  const group = new THREE.Group();
  group.name = 'signage';
  const parts = [];                                   // posts, frames, bins, humps (vertex coloured)
  const P = (geo, col, x, y, z, rx = 0, ry = 0, rz = 0) => parts.push({ geometry: geo, color: col, matrix: m4(x, y, z, rx, ry, rz) });
  const post = (x, z, h, col = '#8a9096', rad = 0.05) => { W.addSolid(x, z, Math.max(0.25, rad + 0.15), 'sign', true); return P(new THREE.CylinderGeometry(rad, rad, h, 6), col, x, W.heightAt(x, z) + h / 2, z); };
  const clear = (x, z, m = 0.6) => (W.placer ? W.placer.free(x, z, Math.min(Math.max(m, 0.45), 1.3)) : W.insideCampus(x, z) && !W.buildingAt(x, z) && !W.waterAt(x, z) && !G.onRoad(x, z, m));

  const boards = new Atlas(1024, 128, 64);     // fingers, notices, info
  const road = new Atlas(1024, 256, 4);        // road-sign icons (4 per row)
  const decals = new Atlas(256, 256, 2);       // zebra stripes

  // ------------------------------------------------------------ destinations for the fingerposts
  const DEST = [];
  for (const l of W.landmarks) {
    if (!['hostel', 'academic', 'admin', 'sports', 'food', 'culture', 'service', 'nature'].includes(l.kind)) continue;
    if (['lake', 'foodstalls', 'iitg_letters', 'rhino'].includes(l.id)) continue;
    DEST.push({ name: l.name.replace(' & Conference Centre', '').replace('Dr. Bhupen Hazarika ', ''), x: l.wx, z: l.wz, kind: l.kind });
  }
  for (const g of W.gates) if (g.name && !g.closed) DEST.push({ name: g.name, x: g.wx, z: g.wz, kind: 'gate' });
  const comp = G.components(FILTERS.bike);
  const inBig = (n) => comp.comp[n] === comp.big;
  for (const d of DEST) d.node = G.nearestNode(d.x, d.z, FILTERS.bike, true);

  // junctions worth a signpost
  const cand = [];
  G.nodes.forEach(([x, z], i) => {
    if (!inBig(i)) return;
    const links = G.adj[i].filter((l) => FILTERS.car(l.e) && l.e.L > 8);
    if (links.length < 3) return;
    cand.push({ i, x, z, links, score: links.length + links.reduce((a, l) => a + l.e.hw, 0) * 0.2 });
  });
  cand.sort((a, b) => b.score - a.score);
  const junctions = [];
  for (const c of cand) {
    if (junctions.length >= 48) break;
    if (junctions.some((j) => Math.hypot(j.x - c.x, j.z - c.z) < 110)) continue;
    junctions.push(c);
  }
  const FING = { hostel: '#1f5f3a', academic: '#1f4f8a', admin: '#1f4f8a', sports: '#6a2f7a', food: '#8a4a1f', culture: '#6a2f7a', service: '#1f6f6a', nature: '#2f6f4f', gate: '#5a5a5a' };
  let fingerCount = 0;
  for (const J of junctions) {
    const D = G.dijkstra(J.i, FILTERS.bike);
    const groups = new Map();
    for (const d of DEST) {
      if (d.node < 0 || !isFinite(D.dist[d.node]) || D.dist[d.node] < 25) continue;
      let v = d.node, first = null;
      for (let guard = 0; v !== J.i && guard < 2000; guard++) { const pr = D.prev[v]; if (!pr) break; if (pr.from === J.i) first = pr.link; v = pr.from; }
      if (!first) continue;
      const key = first.e.i;
      if (!groups.has(key)) groups.set(key, { link: first, list: [] });
      groups.get(key).list.push({ ...d, dist: D.dist[d.node] });
    }
    if (groups.size < 2) continue;
    // stand on a corner, out of the traffic
    const dirs = [...groups.values()].map((gr) => {
      const P2 = gr.link.fwd ? gr.link.e.wpts : gr.link.e.wpts.slice().reverse();
      let q = P2[1], acc = 0;
      for (let k = 1; k < P2.length; k++) { acc += Math.hypot(P2[k][0] - P2[k - 1][0], P2[k][1] - P2[k - 1][1]); q = P2[k]; if (acc > 10) break; }
      return { ...gr, yaw: Math.atan2(q[0] - J.x, q[1] - J.z) };
    });
    const hwMax = Math.max(...J.links.map((l) => l.e.hw));
    let spot = null;
    for (let t = 0; t < 16 && !spot; t++) {
      const a = (t / 16) * Math.PI * 2 + 0.2, R = hwMax + 2.2 + (t > 8 ? 2 : 0);
      const x = J.x + Math.sin(a) * R, z = J.z + Math.cos(a) * R;
      if (clear(x, z, 0.8)) spot = { x, z };
    }
    if (!spot) continue;
    const gy = W.heightAt(spot.x, spot.z);
    const arms = dirs.slice(0, 5);
    post(spot.x, spot.z, 2.6 + arms.length * 0.42, '#6f7479', 0.06);
    arms.forEach((d, k) => {
      const list = d.list.sort((a, b) => a.dist - b.dist).slice(0, 2);
      const col = FING[list[0].kind] || '#1f5f3a';
      // one row per direction, drawn twice: arrow to the right (front) and to the left (back)
      const slot = boards.add(1, (g, x0, y0, w, h) => {
        for (const [ox, flip] of [[0, false], [w / 2, true]]) {
          const bw = w / 2;
          g.fillStyle = col;
          g.beginPath();
          if (!flip) { g.moveTo(ox + 4, y0 + 8); g.lineTo(ox + bw - 46, y0 + 8); g.lineTo(ox + bw - 4, y0 + h / 2); g.lineTo(ox + bw - 46, y0 + h - 8); g.lineTo(ox + 4, y0 + h - 8); }
          else { g.moveTo(ox + bw - 4, y0 + 8); g.lineTo(ox + 46, y0 + 8); g.lineTo(ox + 4, y0 + h / 2); g.lineTo(ox + 46, y0 + h - 8); g.lineTo(ox + bw - 4, y0 + h - 8); }
          g.closePath(); g.fill();
          g.strokeStyle = '#f2f0ea'; g.lineWidth = 4; g.stroke();
          g.fillStyle = '#f7f4ea'; g.textBaseline = 'middle';
          const tx0 = flip ? ox + 54 : ox + 16, tx1 = flip ? ox + bw - 14 : ox + bw - 54;
          list.forEach((d2, i) => {
            const y = y0 + h * (list.length === 1 ? 0.5 : 0.3 + i * 0.4);
            g.font = FONT(700, list.length === 1 ? 34 : 27); g.textAlign = 'left';
            g.fillText(d2.name, tx0, y, (tx1 - tx0) - 92);
            g.font = FONT(500, 24); g.textAlign = 'right';
            g.fillText(fmtD(d2.dist), tx1, y);
          });
        }
      });
      const y = gy + 2.35 + k * 0.42, L = 1.9;
      const cx = spot.x + Math.sin(d.yaw) * (L / 2 + 0.065), cz = spot.z + Math.cos(d.yaw) * (L / 2 + 0.065);
      // board long axis along the direction: its face normal is perpendicular to it
      const face = d.yaw - Math.PI / 2;
      boards.quad(slot, cx + Math.sin(face) * 0.012, y, cz + Math.cos(face) * 0.012, face, L, 0.36, 0, 0.5);
      boards.quad(slot, cx - Math.sin(face) * 0.012, y, cz - Math.cos(face) * 0.012, face + Math.PI, L, 0.36, 0.5, 1);
      fingerCount++;
    });
    J.post = spot;
  }

  // ------------------------------------------------------------ "You are here" campus maps
  // the map (drawn once, in the style of the printed campus map) is shared by every board; each board adds its own red marker
  const mapArt = drawCampusMap(game);
  const mapTex = { tex: new THREE.CanvasTexture(mapArt.canvas), uv: mapArt.uv };
  mapTex.tex.colorSpace = THREE.SRGBColorSpace; mapTex.tex.anisotropy = 8;
  const BW = 3.6, BH = (BW * mapArt.size[1]) / mapArt.size[0];
  const mapBoards = [];
  const mapSpots = [
    ...W.gates.filter((g) => !g.closed).map((g) => ({ x: g.wx, z: g.wz, inward: true, gate: g })),
    ...junctions.filter((j) => j.post).slice(0, 6).map((j) => ({ x: j.x, z: j.z })),
  ];
  const cxm = (W.bbox.x0 + W.bbox.x1) / 2, czm = (W.bbox.z0 + W.bbox.z1) / 2;
  for (const ms of mapSpots) {
    let spot = null, yaw = 0;
    // the KV Gate's map board stands right beside the 3D-printed guard post, just outside the gate, facing the road outside
    const pp = ms.gate && (W.printedPosts || []).find((p) => p.gate === ms.gate);
    if (pp) {
      const ox = Math.cos(ms.gate.angle), oz = -Math.sin(ms.gate.angle);          // out of the campus
      const at = (lx, lz) => [ms.x + ox * lx - oz * lz, ms.z + oz * lx + ox * lz];
      // (outside the wall the campus placer knows nothing: only buildings, water and the road itself are checked)
      const okOut = (x, z) => !W.buildingAt(x, z) && !W.waterAt(x, z) && !G.onRoad(x, z, 0.8);
      for (const [lx, lz] of [[3.4, -6.4], [3.4, -7.2], [4.2, -6.4], [4.2, -7.4], [3.0, -8.2], [5.0, -6.8], [3.4, 6.4], [4.2, 7.0]]) {
        const [x, z] = at(lx, lz), [x1, z1] = at(lx, lz - 1.9), [x2, z2] = at(lx, lz + 1.9);
        if (okOut(x, z) && okOut(x1, z1) && okOut(x2, z2)) { spot = { x, z }; yaw = Math.atan2(ox, oz); break; }
      }
    }
    const toC = Math.atan2(cxm - ms.x, czm - ms.z);
    for (let t = 0; t < 24 && !spot; t++) {
      const a = toC + (t / 24) * Math.PI * 2, R = (ms.inward ? 16 : 9) + (t % 3) * 3;
      const x = ms.x + Math.sin(a) * R, z = ms.z + Math.cos(a) * R;
      if (clear(x, z, 1.2) && clear(x + Math.cos(a) * 1.9, z - Math.sin(a) * 1.9, 1.0) && clear(x - Math.cos(a) * 1.9, z + Math.sin(a) * 1.9, 1.0)) { spot = { x, z }; yaw = Math.atan2(ms.x - x, ms.z - z); }
    }
    if (!spot) continue;
    const gy = W.heightAt(spot.x, spot.z), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    for (const u of [-1.85, 1.85]) post(spot.x + sx * u - Math.sin(yaw) * 0.19, spot.z + sz * u - Math.cos(yaw) * 0.19, 3.7, '#3a3f44', 0.07);   // the posts are behind the board
    P(new THREE.BoxGeometry(3.9, 2.7, 0.1), '#1f2a44', spot.x - Math.sin(yaw) * 0.06, gy + 2.2, spot.z - Math.cos(yaw) * 0.06, 0, yaw, 0);
    P(new THREE.BoxGeometry(4.1, 0.14, 0.32), '#b3262f', spot.x, gy + 3.68, spot.z, 0, yaw, 0);
    W.placer?.reserveBox(spot.x, spot.z, yaw, 1.95, 0.2, 'sign', true);          // nobody walks through the board
    mapBoards.push({ x: spot.x + Math.sin(yaw) * 0.005, y: gy + 2.2, z: spot.z + Math.cos(yaw) * 0.005, yaw, here: ms });
  }

  // ------------------------------------------------------------ road-sign icons + zebra texture
  const icon = (draw) => road.add(1, (g, x0, y0, w, h) => draw(g, x0, y0, h));
  const ICONS = {};
  {
    // four icons per row: speed 30 | no horn | school | (unused)   (then row 2: silence | zebra | cycle | stop)
    const circle = (g, cx, cy, R, ring = '#c62828', fill = '#ffffff') => { g.fillStyle = fill; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill(); g.lineWidth = R * 0.18; g.strokeStyle = ring; g.stroke(); };
    const tri = (g, cx, cy, R) => { g.fillStyle = '#ffffff'; g.strokeStyle = '#c62828'; g.lineWidth = R * 0.16; g.beginPath(); g.moveTo(cx, cy - R); g.lineTo(cx + R * 0.95, cy + R * 0.72); g.lineTo(cx - R * 0.95, cy + R * 0.72); g.closePath(); g.fill(); g.stroke(); };
    const s1 = road.add(1, (g, x0, y0, w, h) => {
      const c = (i) => x0 + h * i + h / 2, cy = y0 + h / 2, R = h * 0.42;
      circle(g, c(0), cy, R); g.fillStyle = '#111'; g.font = FONT(800, 96); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('30', c(0), cy + 6);
      circle(g, c(1), cy, R); g.fillStyle = '#111'; g.beginPath(); g.moveTo(c(1) - 40, cy - 20); g.lineTo(c(1) - 10, cy - 20); g.lineTo(c(1) + 30, cy - 50); g.lineTo(c(1) + 30, cy + 50); g.lineTo(c(1) - 10, cy + 20); g.lineTo(c(1) - 40, cy + 20); g.closePath(); g.fill();
      g.strokeStyle = '#c62828'; g.lineWidth = 16; g.beginPath(); g.moveTo(c(1) - R * 0.7, cy - R * 0.7); g.lineTo(c(1) + R * 0.7, cy + R * 0.7); g.stroke();
      tri(g, c(2), cy + 8, R); g.fillStyle = '#111';
      for (const [dx, s] of [[-18, 1], [18, 0.8]]) { g.beginPath(); g.arc(c(2) + dx, cy - 6, 9 * s, 0, 7); g.fill(); g.fillRect(c(2) + dx - 7 * s, cy + 4, 14 * s, 30 * s); }
      tri(g, c(3), cy + 8, R); g.fillStyle = '#111'; g.beginPath(); g.ellipse(c(3), cy + 34, 44, 16, 0, Math.PI, 0); g.fill();
    });
    const s2 = road.add(1, (g, x0, y0, w, h) => {
      const c = (i) => x0 + h * i + h / 2, cy = y0 + h / 2, R = h * 0.42;
      circle(g, c(0), cy, R, '#1f4f8a'); g.fillStyle = '#1f4f8a'; g.font = FONT(800, 34); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SILENCE', c(0), cy - 14); g.font = FONT(700, 26); g.fillText('ZONE', c(0), cy + 22);
      g.fillStyle = '#1f4f8a'; g.fillRect(c(1) - R, cy - R, R * 2, R * 2); g.fillStyle = '#fff';
      for (let k = 0; k < 5; k++) g.fillRect(c(1) - R * 0.8 + k * R * 0.36, cy + 20, R * 0.2, 36);
      g.beginPath(); g.arc(c(1), cy - 44, 12, 0, 7); g.fill(); g.fillRect(c(1) - 6, cy - 32, 12, 40);
      circle(g, c(2), cy, R, '#1f4f8a', '#1f4f8a'); g.strokeStyle = '#fff'; g.lineWidth = 7;
      for (const dx of [-30, 30]) { g.beginPath(); g.arc(c(2) + dx, cy + 18, 22, 0, 7); g.stroke(); }
      g.beginPath(); g.moveTo(c(2) - 30, cy + 18); g.lineTo(c(2) - 5, cy - 16); g.lineTo(c(2) + 20, cy - 16); g.lineTo(c(2) + 30, cy + 18); g.moveTo(c(2) - 5, cy - 16); g.lineTo(c(2), cy + 18); g.stroke();
      g.fillStyle = '#c62828'; g.beginPath(); for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k / 8) * Math.PI * 2; g.lineTo(c(3) + Math.cos(a) * R, cy + Math.sin(a) * R); } g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.font = FONT(800, 60); g.fillText('STOP', c(3), cy + 4);
    });
    ICONS.row1 = s1; ICONS.row2 = s2;
  }
  const iconUV = (row, k) => ({ slot: row, u0: k / 4, u1: (k + 1) / 4 });
  const SIGN = { speed: iconUV(ICONS.row1, 0), horn: iconUV(ICONS.row1, 1), school: iconUV(ICONS.row1, 2), hump: iconUV(ICONS.row1, 3), silence: iconUV(ICONS.row2, 0), zebra: iconUV(ICONS.row2, 1), cycle: iconUV(ICONS.row2, 2), stop: iconUV(ICONS.row2, 3) };
  let roadSigns = 0;
  const signSpots = [];
  // the plate's own shape (round, triangle, octagon, square) for its steel back, so the sign is cut out cleanly
  const plateShape = (kind) => {
    const sh = new THREE.Shape(), R0 = 0.31;
    if (kind === 'school' || kind === 'hump') { sh.moveTo(0, R0 * 1.02); sh.lineTo(R0 * 1.0, -R0 * 0.77); sh.lineTo(-R0 * 1.0, -R0 * 0.77); sh.closePath(); }
    else if (kind === 'stop') { for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k / 8) * Math.PI * 2; (k ? sh.lineTo : sh.moveTo).call(sh, Math.cos(a) * R0, Math.sin(a) * R0); } sh.closePath(); }
    else if (kind === 'zebra') { sh.moveTo(-R0, -R0); sh.lineTo(R0, -R0); sh.lineTo(R0, R0); sh.lineTo(-R0, R0); sh.closePath(); }
    else sh.absarc(0, 0, R0, 0, Math.PI * 2, false);
    return sh;
  };
  const roadSign = (kind, x, z, yaw) => {
    if (!clear(x, z, 0.3)) return false;
    const gy = W.heightAt(x, z), s = SIGN[kind], sn = Math.sin(yaw), cs = Math.cos(yaw);
    // the post stands BEHIND the plate (never through it): the plate hangs 6 cm in front of the post's axis, on a steel back
    // that is turned to face the same way as the sign
    post(x, z, 2.42, '#9aa3aa', 0.035);
    const back = new THREE.ExtrudeGeometry(plateShape(kind), { depth: 0.02, bevelEnabled: false });
    parts.push({ geometry: back, color: '#b0b6bb', matrix: m4(x + sn * 0.045, gy + 2.15, z + cs * 0.045, 0, yaw, 0) });
    road.quad(s.slot, x + sn * 0.069, gy + 2.15, z + cs * 0.069, yaw, 0.62, 0.62, s.u0, s.u1);
    // two clamps holding the plate to the post
    for (const dy of [-0.16, 0.16]) P(new THREE.BoxGeometry(0.05, 0.03, 0.05), '#6f757a', x + sn * 0.03, gy + 2.15 + dy, z + cs * 0.03, 0, yaw, 0);
    roadSigns++; signSpots.push({ x, z, yaw, kind });
    return true;
  };
  /** a sign on the left verge of a road, facing traffic coming along it (dir = travel direction) */
  const signAlong = (kind, e, s, fwd) => {
    const P2 = e.wpts, cum = e.cum;
    const d = fwd ? s : e.L - s;
    let k = 0; while (k < cum.length - 2 && cum[k + 1] < d) k++;
    const a = P2[k], b = P2[k + 1], L = cum[k + 1] - cum[k] || 1, t = (d - cum[k]) / L;
    let tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
    if (!fwd) { tx = -tx; tz = -tz; }
    const x = a[0] + (b[0] - a[0]) * t + tz * (e.hw + 1.1), z = a[1] + (b[1] - a[1]) * t - tx * (e.hw + 1.1);
    return roadSign(kind, x, z, Math.atan2(-tx, -tz));
  };
  // speed limit 30 on the through-roads, every ~450 m in each direction; stop signs where driveways join
  let acc = 0;
  for (const e of G.edges) {
    if (!FILTERS.car(e) || e.L < 60) continue;
    acc += e.L;
    if (acc < 450) continue;
    acc = 0;
    signAlong('speed', e, Math.min(30, e.L * 0.3), true);
    signAlong(r() < 0.5 ? 'speed' : 'cycle', e, Math.min(30, e.L * 0.3), false);
  }
  // quiet zones and the school
  const near = (x, z, R) => G.edges.filter((e) => FILTERS.car(e) && e.wpts.some(([px, pz]) => Math.hypot(px - x, pz - z) < R));
  for (const [id, kind] of [['hospital', 'silence'], ['library', 'silence'], ['hospital', 'horn'], ['library', 'horn'], ['kv', 'school'], ['kv', 'horn']]) {
    const l = W.landmark(id);
    if (!l) continue;
    for (const e of near(l.wx, l.wz, 140).slice(0, 2)) { if (e.L > 30) { signAlong(kind, e, 12, true); signAlong(kind, e, 12, false); } }
  }

  // ------------------------------------------------------------ zebra crossings at hostels, academic blocks, library, LHC (no speed breakers on the campus roads)
  const zebraSlot = decals.add(1, (g, x0, y0, w, h) => { g.clearRect(x0, y0, w, h); g.fillStyle = 'rgba(245,244,238,0.95)'; for (let k = 0; k < 8; k++) g.fillRect(x0 + 8 + k * 31, y0 + 6, 18, h - 12); });
  let crossings = 0;
  const crossSites = W.sites.filter((s) => ['hostel', 'academic', 'admin', 'food', 'sports', 'culture'].includes(s.kind));
  for (const s of crossSites) {
    const rd = G.roadAt(s.ex, s.ez, 60, FILTERS.car);
    if (!rd || rd.hw < 2.8) continue;
    const yawR = Math.atan2(rd.tx, rd.tz);        // along the road
    const gy = W.heightAt(rd.x, rd.z);
    // painted stripes across the carriageway (decal quad lying on the road)
    decals.quad(zebraSlot, rd.x, gy + ROAD_TOP + 0.014, rd.z, yawR, rd.hw * 2 - 0.4, 3.2, 0, 1, -Math.PI / 2);
    // a zebra-crossing sign on each side
    roadSign('zebra', rd.x + rd.tz * (rd.hw + 1.2) - rd.tx * 2, rd.z - rd.tx * (rd.hw + 1.2) - rd.tz * 2, yawR + Math.PI);
    roadSign('zebra', rd.x - rd.tz * (rd.hw + 1.2) + rd.tx * 2, rd.z + rd.tx * (rd.hw + 1.2) + rd.tz * 2, yawR);
    crossings++;
  }

  // ------------------------------------------------------------ notice / info boards
  const infoBoard = (x, z, yaw, lines, { color = '#1f3a6e', w = 1.6, h = 1.1, posters = false, head = '#f2c12e' } = {}) => {
    if (!clear(x, z, 0.4)) return false;
    const rows = 2;
    const slot = boards.add(rows, (g, x0, y0, bw, bh) => {
      g.fillStyle = color; g.fillRect(x0, y0, bw, bh);
      g.strokeStyle = '#e8e4da'; g.lineWidth = 10; g.strokeRect(x0 + 6, y0 + 6, bw - 12, bh - 12);
      if (posters) {
        // a cork notice board with club posters pinned up
        g.fillStyle = '#b08a5a'; g.fillRect(x0 + 16, y0 + 58, bw - 32, bh - 74);
        const cols = ['#f2c12e', '#e38aa0', '#8fb4d8', '#f2f0ea', '#9ccc65', '#ffb74d'];
        const text = ['DANCE CLUB AUDITIONS', 'CODING CLUB · HACKATHON', 'LOST: BLUE CYCLE KEY', 'QUIZ NITE @ SAC', 'ALCHERINGA VOLUNTEERS', 'PHOTOGRAPHY WALK SUN 6AM', 'DEBATE SOCIETY', 'BLOOD DONATION CAMP'];
        for (let k = 0; k < 7; k++) {
          const px = x0 + 26 + (k % 4) * (bw - 52) / 4 + (r() - 0.5) * 10, py = y0 + 66 + Math.floor(k / 4) * 88;
          g.save(); g.translate(px + 100, py + 40); g.rotate((r() - 0.5) * 0.12);
          g.fillStyle = cols[k % cols.length]; g.fillRect(-100, -38, 200, 80);
          g.fillStyle = '#222'; g.font = FONT(700, 17); g.textAlign = 'center'; g.fillText(text[(k + Math.floor(r() * 8)) % 8], 0, 0, 190);
          g.fillStyle = '#c62828'; g.beginPath(); g.arc(0, -32, 4, 0, 7); g.fill();
          g.restore();
        }
        g.fillStyle = head; g.font = FONT(800, 38); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lines[0], x0 + bw / 2, y0 + 32);
        return;
      }
      g.fillStyle = head; g.font = FONT(800, 44); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(lines[0], x0 + bw / 2, y0 + 44, bw - 40);
      g.fillStyle = '#f7f4ea'; g.font = FONT(600, 30);
      lines.slice(1).forEach((t, i) => g.fillText(t, x0 + bw / 2, y0 + 96 + i * 36, bw - 40));
    });
    const gy = W.heightAt(x, z);
    for (const u of [-w / 2 + 0.08, w / 2 - 0.08]) post(x + Math.cos(yaw) * u - Math.sin(yaw) * 0.075, z - Math.sin(yaw) * u - Math.cos(yaw) * 0.075, 1.2 + h, '#6f7479', 0.04);   // behind the board, not through it
    boards.quad(slot, x + Math.sin(yaw) * 0.03, gy + 1.15 + h / 2, z + Math.cos(yaw) * 0.03, yaw, w, h);
    P(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.05), '#3a3f44', x, gy + 1.15 + h / 2, z, 0, yaw, 0);
    return true;
  };
  const meals = MEALS.map((m) => `${m.name}: ${fmtH(m.from)} – ${fmtH(m.to)}`);
  let infos = 0;
  const beside = (s, d, side) => ({ x: s.ex + s.nx * d - s.nz * side, z: s.ez + s.nz * d + s.nx * side });
  for (const s of W.sites) {
    const tries = (fn) => { for (const [d, sd] of [[4, 4.5], [4, -4.5], [6, 6], [6, -6], [8, 3], [8, -3]]) { const q = beside(s, d, sd); if (fn(q)) { infos++; return; } } };
    const name = (W.landmark(s.lm)?.name || s.name || '').toUpperCase();
    if (s.kind === 'hostel') {
      tries((q) => infoBoard(q.x, q.z, s.yaw, ['MESS TIMINGS', ...meals], { color: '#1f5f3a' }));
      tries((q) => infoBoard(q.x, q.z, s.yaw, ['NOTICE BOARD'], { posters: true, w: 2.2, h: 1.1, color: '#5a3a26' }));
      tries((q) => infoBoard(q.x, q.z, s.yaw, ['RAGGING IS A CRIME', 'Punishable under law and', 'institute rules. Report it:', 'Anti-ragging helpline 1800-180-5522'], { color: '#8a1f1f', head: '#ffffff' }));
    } else if (s.lm === 'library') {
      tries((q) => infoBoard(q.x, q.z, s.yaw, ['CENTRAL LIBRARY', 'Open 8:00 AM – 2:00 AM', 'Reading room open all night in exams', 'Silence please'], { color: '#1f3a6e' }));
    } else if (s.lm === 'hospital') {
      tries((q) => infoBoard(q.x, q.z, s.yaw, ['IITG HOSPITAL', 'Emergency & ambulance: 24 x 7', 'OPD 9:00 AM – 5:00 PM', 'Pharmacy open till 9:00 PM'], { color: '#1f6f6a' }));
    } else if (s.lm === 'gym' || s.lm === 'newsac' || s.lm === 'sac' || s.lm === 'pool') {
      tries((q) => infoBoard(q.x, q.z, s.yaw, [name, s.lm === 'pool' ? 'Swimming 6–9 AM · 4–8 PM' : 'Open 6:00 AM – 10:00 PM', 'Carry your ID card', 'Clubs · Courts · Events'], { color: '#6a2f7a' }));
    } else if (['academic', 'admin'].includes(s.kind)) {
      tries((q) => infoBoard(q.x, q.z, s.yaw, [name, 'Office hours 9:00 AM – 5:30 PM', 'Visitors please report at reception'], { color: '#1f3a6e' }));
    } else if (s.kind === 'food') {
      tries((q) => infoBoard(q.x, q.z, s.yaw, [name, 'Open 8:00 AM – 1:00 AM', 'Pay by UPI, card or cash'], { color: '#8a4a1f' }));
    }
  }
  // department plaques by the academic blocks
  for (const poi of W.pois) {
    if (!/Dept|School|Centre|Center/.test(poi.name || '')) continue;
    const b = W.buildingAt(poi.wx, poi.wz);
    const e = b ? W.entranceOf(b, G) : { x: poi.wx, z: poi.wz, yaw: 0 };
    const x = e.x + Math.sin(e.yaw) * 2.5, z = e.z + Math.cos(e.yaw) * 2.5;
    if (infoBoard(x, z, e.yaw, [poi.name.replace('Dept.', 'Department'), 'IIT Guwahati'], { color: '#1f3a6e', w: 2.2, h: 0.8 })) infos++;
  }

  // ------------------------------------------------------------ murals and graffiti (murals.js)
  const mur = buildMurals(game);
  group.add(mur.group);

  // ------------------------------------------------------------ dustbins (green: wet, blue: dry)
  let bins = 0;
  const bin = (x, z) => {
    if (!clear(x, z, 0.3)) return;
    if (G.onRoad(x, z, 2.4)) return;                                              // never on a road, nor right at its edge
    if ((W.gates || []).some((q) => Math.hypot(q.wx - x, q.wz - z) < 48)) return;   // none at the gates, where the roads widen
    const gy = W.heightAt(x, z);
    void gy;
    // knockable (see knock.js): green for wet waste, blue for dry
    game.knock.add('binG', x - 0.3, z); game.knock.add('binB', x + 0.3, z);
    bins++;
  };
  acc = 0;
  for (const e of G.edges) {
    if (!(e.main && !e.gen) || e.L < 40) continue;
    acc += e.L;
    if (acc < 130) continue;
    acc = 0;
    const m = e.wpts[Math.floor(e.wpts.length / 2)], n = e.wpts[Math.min(e.wpts.length - 1, Math.floor(e.wpts.length / 2) + 1)];
    const L = Math.hypot(n[0] - m[0], n[1] - m[1]) || 1, tx = (n[0] - m[0]) / L, tz = (n[1] - m[1]) / L;
    bin(m[0] + tz * (e.hw + 1.6), m[1] - tx * (e.hw + 1.6));
  }
  for (const st of game.props.stalls || []) bin(st.x + Math.sin(st.yaw + 1.2) * 3, st.z + Math.cos(st.yaw + 1.2) * 3);
  for (const s of W.sites) { const q = beside(s, 3, 7); bin(q.x, q.z); }

  // ------------------------------------------------------------ build the meshes
  boards.build(group);
  road.build(group, { transparent: true });
  decals.build(group, { transparent: true });
  if (parts.length) {
    const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 }));
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  // campus maps with a red "you are here" dot
  // (at night the board is lit: three gooseneck lamps over it, a warm pool of light on its upper half, and the map itself glows a little)
  const mapMat = new THREE.MeshStandardMaterial({ map: mapTex.tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: mapTex.tex, emissiveIntensity: 0.03 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, emissive: 0xfff0c0, emissiveIntensity: 0, roughness: 0.4 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.5, metalness: 0.4 });
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,238,190,1)'); gr.addColorStop(0.55, 'rgba(255,230,170,0.35)'); gr.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xe53935 }), ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hereTex = new THREE.CanvasTexture(hereLabelCanvas()); hereTex.colorSpace = THREE.SRGBColorSpace;
  const hereMat = new THREE.MeshBasicMaterial({ map: hereTex, transparent: true, toneMapped: false });
  for (const mb of mapBoards) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), mapMat);
    m.position.set(mb.x + Math.sin(mb.yaw) * 0.01, mb.y, mb.z + Math.cos(mb.yaw) * 0.01);
    m.rotation.y = mb.yaw;
    group.add(m);
    // the red "You are here" marker, with its label on the side of it that stays on the board
    const [u, v] = mapTex.uv(mb.x, mb.z), px = (u - 0.5) * BW, py = (v - 0.5) * BH;
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.105, 20), ringMat); ring.position.set(px, py, 0.008); m.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.072, 20), dotMat); dot.position.set(px, py, 0.012); m.add(dot);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), hereMat);
    lab.position.set(Math.max(-BW / 2 + 0.55, Math.min(BW / 2 - 0.55, px)), py + (v > 0.8 ? -0.22 : 0.22), 0.016); m.add(lab);
    // the lamps: a curved steel arm from the top bar and a lamp head that points down at the map
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH * 0.62), poolMat); pool.position.set(0, BH * 0.19, 0.02); pool.renderOrder = 3; m.add(pool);
    for (const lx of [-1.2, 0, 1.2]) {
      const lamp = new THREE.Group();
      lamp.position.set(lx, BH / 2 + 0.12, 0.0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.56), steelMat); arm.position.set(0, 0.1, 0.26); lamp.add(arm);
      const rise = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.035), steelMat); rise.position.set(0, 0.0, 0.02); lamp.add(rise);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.13), lampMat); head.position.set(0, 0.07, 0.56); head.rotation.x = 0.4; lamp.add(head);
      m.add(lamp);
    }
  }
  const setNight = (night) => { mapMat.emissiveIntensity = 0.03 + night * 0.55; lampMat.emissiveIntensity = night * 2.4; poolMat.opacity = night * 0.3; };
  return { group, setNight, spots: { posts: junctions.filter((j) => j.post).map((j) => ({ ...j.post, yaw: 0 })), maps: mapBoards, murals: mur.spots, roadSigns: signSpots }, counts: { fingers: fingerCount, junctions: junctions.filter((j) => j.post).length, maps: mapBoards.length, roadSigns, crossings, infos, murals: mur.count, muralPages: mur.pages, bins } };
}

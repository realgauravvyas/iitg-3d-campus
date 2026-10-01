// Sports surfaces that look (and play) like the real thing: hard courts for tennis, basketball
// and volleyball with crisp painted lines, proper nets, chain-link fences round the tennis
// courts and floodlights for evening games; line markings and goal nets on the football and
// hockey grounds; a rolled strip on the cricket grounds. sportsAreas() is called before the
// trees and grass are planted so no tree grows through a court and the pitches are not
// hidden under knee-high grass.
import * as THREE from 'three';
import { canvasTexture, mergeColored, m4, mulberry32 } from '../util.js';
import { AN } from '../crowd/people.js';
import { studentLook } from '../crowd/looks.js';

// standard line sizes (m), run-off around the lines, colours
const SPEC = {
  tennis: { L: 23.77, W: 10.97, mu: 6.4, mv: 3.66, out: '#2f6a4c', inn: '#2b5f8e', line: '#f4f4ef', fence: 3.6, lights: true },
  basketball: { L: 28, W: 15, mu: 2.0, mv: 2.0, out: '#9a4a2c', inn: '#b8633a', line: '#f4f4ef', fence: 0, lights: true },
  volleyball: { L: 18, W: 9, mu: 3.0, mv: 3.0, out: '#3c6f9c', inn: '#c7743f', line: '#f4f4ef', fence: 0, lights: false },
};
const PITCH = { soccer: true, hockey: true };

/** where the basketball rim hangs (u along the court), matching the painted key */
export const hoopU = (f) => Math.min(SPEC.basketball.L, f.len) / 2 - 1.575;

/** The 400 m track inside the athletics ground (shared with the joggers in sports/others.js):
 *  R = radius of lane 1's inside edge, S = half the straight; 8 lanes of 1.22 m. */
export function trackDims(f) {
  const R = Math.min(36.5, f.wid / 2 - 9);
  const S = Math.max(10, Math.min(42.2, f.len / 2 - R - 4));
  return { R, S, lanes: 8, lw: 1.22 };
}
/** point on the stadium outline at radius r, parameter t in [0, 1) round the track (anticlockwise) */
function stadium(S, r, t) {
  const L = 4 * S + 2 * Math.PI * r;
  let s = (((t % 1) + 1) % 1) * L;
  if (s < 2 * S) return [-S + s, -r];
  s -= 2 * S;
  if (s < Math.PI * r) { const a = s / r - Math.PI / 2; return [S + Math.cos(a) * r, Math.sin(a) * r]; }
  s -= Math.PI * r;
  if (s < 2 * S) return [S - s, r];
  s -= 2 * S;
  const a = s / r + Math.PI / 2; return [-S + Math.cos(a) * r, Math.sin(a) * r];
}

function trackTexture() {
  // across the track (u: 0 inside -> 1 outside), repeating along it
  return canvasTexture(1024, 32, (g, w, h) => {
    g.fillStyle = '#b4513a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,220,200' : '60,20,10'},0.08)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    const total = 8 * 1.22 + 0.8, px = w / total;
    g.fillStyle = '#f6f3ea';
    for (let k = 0; k <= 8; k++) g.fillRect((0.4 + k * 1.22) * px - 2.5, 0, 5, h);
  }, { repeat: true, aniso: 16 });
}

/** court geometry in the field's own frame: lines size and the paved surface around it */
function dims(f) {
  const s = SPEC[f.kind];
  const lL = Math.min(s.L, f.len), lW = Math.min(s.W, f.wid);
  return { s, lL, lW, hl: Math.max(f.len, lL + 2 * s.mu) / 2, hw: Math.max(f.wid, lW + 2 * s.mv) / 2 };
}

/** Two courts of each kind are enough (the map data plus generated hostel courts had 39): keep
 *  the two real (mapped) courts of each sport that stand closest together, drop the rest. */
export function pruneCourts(fields, perKind = 2) {
  // (the courts and practice pitches that belong to a hostel all stay: every hostel has its own volleyball court, basketball court and cricket pitch)
  const cen = (f) => { let x = 0, y = 0; for (const [a, b] of f.p) { x += a; y += b; } return [x / f.p.length, y / f.p.length]; };
  const drop = new Set();
  for (const kind of Object.keys(SPEC)) {
    const all = fields.filter((f) => f.kind === kind && !(f.gen && f.site));
    const real = all.filter((f) => !f.gen);
    const pool = real.length >= perKind ? real : all;
    let best = pool.slice(0, perKind), bd = Infinity;
    if (perKind === 2) for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
      const [ax, ay] = cen(pool[i]), [bx, by] = cen(pool[j]), d = Math.hypot(ax - bx, ay - by);
      if (d < bd) { bd = d; best = [pool[i], pool[j]]; }
    }
    for (const f of all) if (!best.includes(f)) drop.add(f);
  }
  return { fields: fields.filter((f) => !drop.has(f)), removed: [...drop] };
}

/** Small "staff quarters" that the map data puts on or right beside the playgrounds (there are
 *  none there): residential blocks under 300 m² within 15 m of a real court or ground. Removes them
 *  from the data (keeping the building indices of the sites consistent); returns how many. */
export function dropQuartersOnGrounds(data) {
  const KINDS = new Set(['tennis', 'basketball', 'volleyball', 'soccer', 'hockey', 'cricket', 'athletics']);
  const fields = data.fields.filter((f) => KINDS.has(f.kind) && !f.gen);
  const area = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };
  const inside = (p, x, y) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const segD = (px, py, ax, ay, bx, by) => { const ex = bx - ax, ey = by - ay, L = ex * ex + ey * ey || 1, t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / L)); return Math.hypot(px - ax - ex * t, py - ay - ey * t); };
  const polyD = (A, B) => {
    if (A.some(([x, y]) => inside(B, x, y)) || B.some(([x, y]) => inside(A, x, y))) return 0;
    let d = Infinity;
    for (const [x, y] of A) for (let i = 0; i < B.length; i++) d = Math.min(d, segD(x, y, ...B[i], ...B[(i + 1) % B.length]));
    for (const [x, y] of B) for (let i = 0; i < A.length; i++) d = Math.min(d, segD(x, y, ...A[i], ...A[(i + 1) % A.length]));
    return d;
  };
  const drop = new Set();
  data.buildings.forEach((b, i) => { if (b.kind === 'residential' && area(b.p) < 300 && fields.some((f) => polyD(b.p, f.p) < 15)) drop.add(i); });
  if (!drop.size) return 0;
  const map = []; let k = 0;
  data.buildings = data.buildings.filter((b, i) => { map[i] = drop.has(i) ? -1 : k++; return !drop.has(i); });
  for (const s of data.sites || []) s.ids = s.ids.map((i) => map[i]).filter((i) => i >= 0);
  return drop.size;
}

/** Staff quarters do not belong everywhere: none right by the KV Gate or round the auditorium
 *  (map points [x, y, radius]). Returns how many went. */
export function dropQuartersNear(data, spots) {
  const c = (p) => { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; };
  const drop = new Set();
  data.buildings.forEach((b, i) => { if (b.kind !== 'residential') return; const [x, y] = c(b.p); if (spots.some(([sx, sy, r]) => Math.hypot(x - sx, y - sy) < r)) drop.add(i); });
  if (!drop.size) return 0;
  const map = []; let k = 0;
  data.buildings = data.buildings.filter((b, i) => { map[i] = drop.has(i) ? -1 : k++; return !drop.has(i); });
  for (const s of data.sites || []) s.ids = s.ids.map((i) => map[i]).filter((i) => i >= 0);
  return drop.size;
}

/** The ground texture has the courts painted in: grass over the ones that were removed, in the
 *  colour of the ground just around each (so the patch blends in). Returns a canvas. */
export function paintOverCourts(img, bounds, removed) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const [x0, y0, x1, y1] = bounds;
  const X = (x) => ((x - x0) / (x1 - x0)) * c.width, Y = (y) => ((y1 - y) / (y1 - y0)) * c.height;
  const ppm = c.width / (x1 - x0);
  for (const f of removed) {
    let cx = 0, cy = 0; for (const [a, b] of f.p) { cx += a; cy += b; } cx /= f.p.length; cy /= f.p.length;
    const grow = 1 + 3 / Math.max(8, Math.min(f.len || 20, f.wid || 12));
    const pts = f.p.map(([a, b]) => [X(cx + (a - cx) * grow), Y(cy + (b - cy) * grow)]);
    const bx0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])) - 6 * ppm)), by0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) - 6 * ppm));
    const bx1 = Math.min(c.width, Math.ceil(Math.max(...pts.map((p) => p[0])) + 6 * ppm)), by1 = Math.min(c.height, Math.ceil(Math.max(...pts.map((p) => p[1])) + 6 * ppm));
    if (bx1 <= bx0 || by1 <= by0) continue;
    // average colour of a frame just outside the court
    const d = g.getImageData(bx0, by0, bx1 - bx0, by1 - by0).data, w = bx1 - bx0, h = by1 - by0;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (i > 2 * ppm && i < w - 2 * ppm && j > 2 * ppm && j < h - 2 * ppm) continue;
      const k = (j * w + i) * 4; r += d[k]; gg += d[k + 1]; b += d[k + 2]; n++;
    }
    if (!n) continue;
    r /= n; gg /= n; b /= n;
    g.save();
    g.beginPath(); pts.forEach(([a, bb], i) => (i ? g.lineTo(a, bb) : g.moveTo(a, bb))); g.closePath();
    g.clip();
    g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; g.fillRect(bx0, by0, w, h);
    for (let k = 0; k < w * h * 0.25; k++) { const t = Math.random() - 0.5; g.fillStyle = `rgba(${t > 0 ? '255,255,230' : '20,40,10'},${Math.abs(t) * 0.12})`; g.fillRect(bx0 + Math.random() * w, by0 + Math.random() * h, 1, 1); }
    g.restore();
  }
  return c;
}

/** half length / width of a court's paved surface (inside the fence) */
export function courtSurface(f) { const d = SPEC[f.kind] ? dims(f) : { hl: f.len / 2, hw: f.wid / 2 }; return { hl: d.hl, hw: d.hw }; }

/** Fences round every court and ground: [{ring: [[x, z]...], h, style, gates, f}]. Courts get a
 *  chain-link or mesh fence with one gate; grounds (cricket, football, hockey, athletics) a
 *  green pipe railing with a pedestrian gate wherever a footpath meets it. */
export function fenceOutlines(world) {
  const out = [];
  const rect = (f, hl, hw) => [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => { const q = P(f, u, v); return [q.x, q.z]; });
  const grow = (f, d) => {
    // the field outline pushed out by d metres (away from its centre)
    const r = f.ring, pts = [];
    for (let k = 0; k < r.length; k += 2) { const dx = r[k] - f.cx, dz = r[k + 1] - f.cz, L = Math.hypot(dx, dz) || 1; pts.push([r[k] + (dx / L) * d, r[k + 1] + (dz / L) * d]); }
    return pts;
  };
  for (const f of world.fields) {
    if (SPEC[f.kind]) {
      const { hl, hw } = dims(f);
      const tall = f.kind === 'tennis' || f.fenceTall || (f.kind === 'basketball' && f.site === 'dihing');                          // (a wall court has the tall chain-link fence too)
      out.push({ f, ring: rect(f, hl + 0.3, hw + 0.3), h: tall ? 3.6 : 1.3, style: tall ? 'chain' : 'mesh', court: true });
    } else if (PITCH[f.kind]) out.push({ f, ring: rect(f, f.len / 2 + 3.5, f.wid / 2 + 3.5), h: 1.05, style: 'rail' });
    else if (f.kind === 'cricket' || f.kind === 'athletics') out.push({ f, ring: grow(f, f.kind === 'cricket' ? 3 : 2.5), h: 1.05, style: 'rail' });
  }
  return out;
}
export function inRing(ring, x, z) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function segX(ax, az, bx, bz, cx, cz, dx, dz) {
  const r = bx - ax, s2 = bz - az, t = dx - cx, u = dz - cz, den = r * u - s2 * t;
  if (Math.abs(den) < 1e-9) return null;
  const a = ((cx - ax) * u - (cz - az) * t) / den, b = ((cx - ax) * s2 - (cz - az) * r) / den;
  return a >= 0 && a <= 1 && b >= 0 && b <= 1 ? a : null;
}

/** Playing areas (oriented rectangles), for keeping grass, trees and props off them. */
export function sportsAreas(world) {
  const out = [];
  for (const f of world.fields) {
    if (SPEC[f.kind]) { const d = dims(f); out.push({ f, cx: f.cx, cz: f.cz, ax: f.ax, az: f.az, hl: d.hl + 0.6, hw: d.hw + 0.6, court: true }); }
    else if (PITCH[f.kind]) out.push({ f, cx: f.cx, cz: f.cz, ax: f.ax, az: f.az, hl: f.len / 2 + 1, hw: f.wid / 2 + 1, pitch: true });
    else if (f.kind === 'cricket') out.push({ f, cx: f.cx, cz: f.cz, ax: f.ax, az: f.az, hl: 16, hw: 4, strip: true });
  }
  return out;
}
export function inArea(a, x, z, pad = 0) {
  const dx = x - a.cx, dz = z - a.cz;
  const u = dx * a.ax + dz * a.az, v = -dx * a.az + dz * a.ax;
  return Math.abs(u) <= a.hl + pad && Math.abs(v) <= a.hw + pad;
}

// ------------------------------------------------------------------ textures
function courtTexture(kind) {
  const s = SPEC[kind];
  const SL = s.L + 2 * s.mu, SW = s.W + 2 * s.mv;
  const w = 2048, h = Math.round((2048 * SW) / SL / 4) * 4;
  const k = w / SL;                                   // pixels per metre
  const X = (m) => (m + SL / 2) * k, Y = (m) => (m + SW / 2) * k;
  const tex = canvasTexture(w, h, (g) => {
    g.fillStyle = s.out; g.fillRect(0, 0, w, h);
    // subtle acrylic grain so the surface is not flat plastic
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.035)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = s.inn;
    g.fillRect(X(-s.L / 2), Y(-s.W / 2), s.L * k, s.W * k);
    g.strokeStyle = s.line; g.fillStyle = s.line;
    const lw = Math.max(2.5, 0.05 * k);
    g.lineWidth = lw;
    const rect = (x0, y0, x1, y1) => g.strokeRect(X(x0), Y(y0), (x1 - x0) * k, (y1 - y0) * k);
    const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); };
    const arc = (x, y, r, a0 = 0, a1 = Math.PI * 2) => { g.beginPath(); g.arc(X(x), Y(y), r * k, a0, a1); g.stroke(); };
    const L = s.L / 2, W = s.W / 2;
    if (kind === 'tennis') {
      rect(-L, -W, L, W);                                           // doubles court
      line(-L, -W + 1.37, L, -W + 1.37); line(-L, W - 1.37, L, W - 1.37);   // singles sidelines
      line(-6.4, -W + 1.37, -6.4, W - 1.37); line(6.4, -W + 1.37, 6.4, W - 1.37);  // service lines
      line(-6.4, 0, 6.4, 0);                                        // centre service line
      line(-L, 0, -L + 0.12, 0); line(L, 0, L - 0.12, 0);           // centre marks
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.font = `bold ${Math.round(1.1 * k)}px "Teko", "Hind", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(X(-L - 3.2), Y(0)); g.rotate(-Math.PI / 2); g.fillText('IIT GUWAHATI', 0, 0); g.restore();
    } else if (kind === 'basketball') {
      rect(-L, -W, L, W); line(0, -W, 0, W); arc(0, 0, 1.8);
      for (const sd of [-1, 1]) {
        const bx = sd * L;
        g.fillStyle = 'rgba(31,63,120,0.85)';
        g.fillRect(X(sd > 0 ? L - 5.8 : -L), Y(-2.45), 5.8 * k, 4.9 * k);        // painted key
        rect(sd > 0 ? L - 5.8 : -L, -2.45, sd > 0 ? L : -L + 5.8, 2.45);
        arc(bx - sd * 5.8, 0, 1.8);
        // three-point line: straight parts 0.9 m in from the sidelines, arc of 6.75 m from the hoop
        const hx = bx - sd * 1.575;
        const a = Math.acos(Math.min(1, (W - 0.9) / 6.75));
        const x3 = hx - sd * Math.sqrt(6.75 * 6.75 - (W - 0.9) * (W - 0.9));
        line(bx, -(W - 0.9), x3, -(W - 0.9)); line(bx, W - 0.9, x3, W - 0.9);
        g.beginPath();
        if (sd > 0) g.arc(X(hx), Y(0), 6.75 * k, Math.PI / 2 + a, Math.PI * 1.5 - a);
        else g.arc(X(hx), Y(0), 6.75 * k, -Math.PI / 2 + a, Math.PI / 2 - a);
        g.stroke();
      }
    } else if (kind === 'volleyball') {
      rect(-L, -W, L, W); line(0, -W - 0.4, 0, W + 0.4);
      line(-3, -W, -3, W); line(3, -W, 3, W);                      // attack lines
    }
  }, { repeat: false, aniso: 16 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return { tex, SL, SW };
}

function pitchTexture() {
  // lines only (the grass is the ground below), for a 105 x 68 pitch stretched to the real one
  const L = 105, W = 68, w = 2048, h = 1324, k = w / (L + 4);
  const X = (m) => (m + L / 2 + 2) * k, Y = (m) => (m + W / 2 + 2) * k;
  const tex = canvasTexture(w, h, (g) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(248,248,242,0.92)'; g.fillStyle = 'rgba(248,248,242,0.92)';
    g.lineWidth = Math.max(3, 0.12 * k);
    const rect = (x0, y0, x1, y1) => g.strokeRect(X(x0), Y(y0), (x1 - x0) * k, (y1 - y0) * k);
    const l = L / 2, wv = W / 2;
    rect(-l, -wv, l, wv);
    g.beginPath(); g.moveTo(X(0), Y(-wv)); g.lineTo(X(0), Y(wv)); g.stroke();
    g.beginPath(); g.arc(X(0), Y(0), 9.15 * k, 0, 7); g.stroke();
    g.beginPath(); g.arc(X(0), Y(0), 0.25 * k, 0, 7); g.fill();
    for (const sd of [-1, 1]) {
      const gx = sd * l;
      rect(Math.min(gx, gx - sd * 16.5), -20.16, Math.max(gx, gx - sd * 16.5), 20.16);
      rect(Math.min(gx, gx - sd * 5.5), -9.16, Math.max(gx, gx - sd * 5.5), 9.16);
      g.beginPath(); g.arc(X(gx - sd * 11), Y(0), 0.22 * k, 0, 7); g.fill();
      const a = Math.acos(5.5 / 9.15);
      g.beginPath();
      if (sd > 0) g.arc(X(gx - sd * 11), Y(0), 9.15 * k, Math.PI - a, Math.PI + a); else g.arc(X(gx - sd * 11), Y(0), 9.15 * k, -a, a);
      g.stroke();
      for (const sv of [-1, 1]) { g.beginPath(); g.arc(X(gx), Y(sv * wv), 1 * k, 0, 7); g.stroke(); }
    }
  }, { repeat: false, aniso: 16 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return { tex, L, W, k, pad: 2 };
}

function stripTexture() {
  return canvasTexture(128, 512, (g, w, h) => {
    g.fillStyle = '#c4ad7c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '90,70,40' : '240,225,190'},0.12)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
    g.fillStyle = '#f4f2ea';
    const Y = (m) => (m / 22 + 0.5) * h;
    for (const sd of [-1, 1]) { g.fillRect(0, Y(sd * 8.84) - 2, w, 4); g.fillRect(0, Y(sd * 10.06) - 2, w, 4); g.fillRect(w * 0.12, Y(sd * 10.06) - 2, 4, sd * -1.22 / 22 * h); g.fillRect(w * 0.88, Y(sd * 10.06) - 2, 4, sd * -1.22 / 22 * h); }
  }, { repeat: false });
}

function netTexture(kind) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = kind === 'goal' ? 'rgba(245,245,245,0.9)' : 'rgba(20,20,20,0.85)';
    g.lineWidth = 1.5;
    const step = kind === 'goal' ? 16 : 8;
    for (let x = 0; x <= w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    if (kind === 'tennis' || kind === 'volleyball') { g.fillStyle = '#f4f4ef'; g.fillRect(0, 0, w, kind === 'tennis' ? 7 : 6); if (kind === 'tennis') g.fillRect(w / 2 - 3, 0, 6, h); }
  }, { repeat: true });
}

function meshTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(52,84,64,0.95)'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, { repeat: true });
}

function chainTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,92,78,0.95)'; g.lineWidth = 1.6;
    for (let i = -h; i < w + h; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
  }, { repeat: true });
}

// ------------------------------------------------------------------ geometry helpers
/** a grid laid on the terrain over the field's rectangle, uv from a mapping function */
function drape(world, f, hl, hw, lift, uvOf, seg = 2) {
  const nu = Math.max(2, Math.ceil((2 * hl) / seg)), nv = Math.max(2, Math.ceil((2 * hw) / seg));
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = -hl + (2 * hl * i) / nu, v = -hw + (2 * hw * j) / nv;
    const x = f.cx + f.ax * u - f.az * v, z = f.cz + f.az * u + f.ax * v;
    pos.push(x, world.heightAt(x, z) + lift, z);
    const [a, b] = uvOf(u, v); uv.push(a, b);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const P = (f, u, v) => ({ x: f.cx + f.ax * u - f.az * v, z: f.cz + f.az * u + f.ax * v });

/** a vertical quad from field point (u0,v0) to (u1,v1), y from bottom to top, texture repeats per metre */
function wall(world, f, u0, v0, u1, v1, bottom, top, rep = 1, yFixed = null) {
  const a = P(f, u0, v0), b = P(f, u1, v1);
  const ya = yFixed ?? world.heightAt(a.x, a.z), yb = yFixed ?? world.heightAt(b.x, b.z);
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a.x, ya + bottom, a.z, b.x, yb + bottom, b.z, b.x, yb + top, b.z, a.x, ya + top, a.z], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, len * rep, 0, len * rep, (top - bottom) * rep, 0, (top - bottom) * rep], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

export function buildCourts(game) {
  const world = game.world;
  const group = new THREE.Group();
  group.name = 'sports-courts';
  const tex = {}, surfaces = [], heads = [];
  const solid = [];
  const fences = (world.fences ||= []);
  const netMats = {};
  const netMat = (kind) => (netMats[kind] ||= new THREE.MeshStandardMaterial({ map: netTexture(kind), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8 }));
  const chainMat = new THREE.MeshStandardMaterial({ map: chainTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.3 });
  const nets = [], chains = [];

  for (const f of world.fields) {
    if (SPEC[f.kind]) {
      const { s, lL, lW, hl, hw } = dims(f);
      const T = (tex[f.kind] ||= courtTexture(f.kind));
      // texture's line rectangle -> this court's line rectangle
      const uvOf = (u, v) => [0.5 + (u * (s.L / lL)) / T.SL, 0.5 - (v * (s.W / lW)) / T.SW];
      const geo = drape(world, f, hl, hw, 0.06, uvOf, 2.5);
      const mat = new THREE.MeshStandardMaterial({ map: T.tex, roughness: 0.78, metalness: 0, emissive: 0xffffff, emissiveMap: T.tex, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      m.name = `${f.kind}-court`;
      group.add(m);
      surfaces.push({ m, f, lit: s.lights });
      const y0 = world.heightAt(f.cx, f.cz);
      // nets and posts
      if (f.kind === 'tennis' || f.kind === 'volleyball') {
        const tennis = f.kind === 'tennis';
        const half = lW / 2 + (tennis ? 0.914 : 0.5);
        const top = tennis ? 1.07 : 2.43, bottom = tennis ? 0.02 : 1.43;
        nets.push({ g: wall(world, f, 0, -half, 0, half, bottom, top, tennis ? 1.2 : 1, y0), mat: netMat(f.kind) });
        for (const sv of [-1, 1]) { const q = P(f, 0, sv * half); solid.push({ geometry: new THREE.CylinderGeometry(0.045, 0.05, top + 0.08, 8), color: '#2d3a33', matrix: m4(q.x, y0 + (top + 0.08) / 2, q.z) }); }
      }
      if (f.kind === 'tennis') {
        // a bench and a scoreboard stand beside the court
        const bq = P(f, 0, hw - 0.9);
        solid.push({ geometry: new THREE.BoxGeometry(2.2, 0.08, 0.45), color: '#6b4a2f', matrix: m4(bq.x, y0 + 0.45, bq.z, 0, Math.atan2(f.ax, f.az), 0) });
        for (const su of [-0.9, 0.9]) { const q = P(f, su, hw - 0.9); solid.push({ geometry: new THREE.BoxGeometry(0.08, 0.45, 0.4), color: '#3a3a3a', matrix: m4(q.x, y0 + 0.22, q.z, 0, Math.atan2(f.ax, f.az), 0) }); }
      }
      // floodlights at the corners (lit in the evening)
      if (s.lights && !f.gen) {
        for (const [su, sv] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          const q = P(f, su * (hl + 0.4), sv * (hw + 0.4));
          const y = world.heightAt(q.x, q.z);
          solid.push({ geometry: new THREE.CylinderGeometry(0.07, 0.12, 9, 8), color: '#5d6468', matrix: m4(q.x, y + 4.5, q.z) });
          heads.push({ x: q.x, y: y + 9.1, z: q.z, yaw: Math.atan2(f.cx - q.x, f.cz - q.z) });
        }
      }
    } else if (PITCH[f.kind]) {
      const T = (tex.pitch ||= pitchTexture());
      // FootballGame plays inside 3 m of the field edge: line rectangle = (len - 6) x (wid - 6)
      const lL = f.len - 6, lW = f.wid - 6, hl = f.len / 2, hw = f.wid / 2;
      const SL = T.L + 2 * T.pad, SW = T.W + 2 * T.pad;
      const uvOf = (u, v) => [0.5 + (u * (T.L / lL)) / SL, 0.5 - (v * (T.W / lW)) / SW];
      const geo = drape(world, f, hl, hw, 0.05, uvOf, 4);
      const mat = new THREE.MeshStandardMaterial({ map: T.tex, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true; m.renderOrder = 1; m.name = `${f.kind}-lines`;
      group.add(m);
      // goal nets behind the posts (the posts and crossbar come from props.js at len/2 - 3)
      const half = f.len / 2 - 3, gw = f.kind === 'hockey' ? 3.66 : 7.3, gh = f.kind === 'hockey' ? 2.1 : 2.44, depth = f.kind === 'hockey' ? 1.2 : 1.8;
      for (const sd of [-1, 1]) {
        const gq = P(f, sd * half, 0), gy = world.heightAt(gq.x, gq.z);
        const back = sd * (half + depth);
        nets.push({ g: wall(world, f, back, -gw / 2, back, gw / 2, 0, gh * 0.75, 1, gy), mat: netMat('goal') });
        for (const sv of [-1, 1]) nets.push({ g: wall(world, f, sd * half, sv * gw / 2, back, sv * gw / 2, 0, gh, 1, gy), mat: netMat('goal') });
        // roof of the net, sloping to the back bar
        const a = P(f, sd * half, -gw / 2), b = P(f, sd * half, gw / 2), c = P(f, back, gw / 2), d = P(f, back, -gw / 2);
        const rg = new THREE.BufferGeometry();
        rg.setAttribute('position', new THREE.Float32BufferAttribute([a.x, gy + gh, a.z, b.x, gy + gh, b.z, c.x, gy + gh * 0.75, c.z, d.x, gy + gh * 0.75, d.z], 3));
        rg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, gw, 0, gw, depth, 0, depth], 2));
        rg.setIndex([0, 1, 2, 0, 2, 3]); rg.computeVertexNormals();
        nets.push({ g: rg, mat: netMat('goal') });
      }
      // corner flags
      for (const [su, sv] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const q = P(f, su * lL / 2, sv * lW / 2), y = world.heightAt(q.x, q.z);
        solid.push({ geometry: new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), color: '#f4f4ef', matrix: m4(q.x, y + 0.75, q.z) });
        solid.push({ geometry: new THREE.BoxGeometry(0.02, 0.3, 0.4), color: su > 0 ? '#e0452f' : '#f2c12e', matrix: m4(q.x, y + 1.35, q.z + 0.2) });
      }
    } else if (f.kind === 'cricket') {
      const T = (tex.strip ||= stripTexture());
      const g = drape(world, f, 11, 1.6, 0.05, (u, v) => [0.5 + v / 3.2, 0.5 + u / 22], 1);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: T, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.receiveShadow = true; m.name = 'cricket-strip';
      group.add(m);
    }
  }
  // ---------------------------------------------------------------- athletics: 8-lane track + infield pitch
  for (const f of world.fields.filter((q) => q.kind === 'athletics')) {
    const { R, S, lanes, lw } = trackDims(f);
    // (the strip used to have only two vertices across its 10 m: the ground between them, in 6 m cells, rose through it in dark patches. It now has
    // a row of vertices in every lane and one every ~1.3 m along, each lifted above the highest ground within a metre of it)
    const r0 = R - 0.4, r1 = R + lanes * lw + 0.4, N = 360, M = lanes + 1;
    const pos = [], uv = [], idx = [];
    const L0 = 4 * S + 2 * Math.PI * R;
    const top = (x, z) => { let h = world.heightAt(x, z); for (const [dx, dz] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) h = Math.max(h, world.heightAt(x + dx, z + dz)); return h; };
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      for (let j = 0; j <= M; j++) {
        const u = j / M, r = r0 + (r1 - r0) * u;
        const [a, b] = stadium(S, r, t), q = P(f, a, b);
        pos.push(q.x, top(q.x, q.z) + 0.07, q.z);
        uv.push(u, (t * L0) / 4);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: trackTexture(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide }));
    m.receiveShadow = true; m.name = 'athletics-track';
    group.add(m);
    // start / finish line across all lanes at the end of the home straight
    const fa = P(f, S, -r0), fb = P(f, S, -r1);
    const fl = new THREE.BufferGeometry();
    const nx = f.ax * 0.06, nz = f.az * 0.06;
    fl.setAttribute('position', new THREE.Float32BufferAttribute([fa.x - nx, world.heightAt(fa.x, fa.z) + 0.09, fa.z - nz, fa.x + nx, world.heightAt(fa.x, fa.z) + 0.09, fa.z + nz, fb.x + nx, world.heightAt(fb.x, fb.z) + 0.09, fb.z + nz, fb.x - nx, world.heightAt(fb.x, fb.z) + 0.09, fb.z - nz], 3));
    fl.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]); fl.computeVertexNormals();
    group.add(new THREE.Mesh(fl, new THREE.MeshBasicMaterial({ color: 0xf6f3ea })));
    // the football pitch inside the track (goals from props.js at len/2 - 22)
    const T = (tex.pitch ||= pitchTexture());
    const lL = f.len - 44, lW = Math.min(68, 2 * R - 6), SL = T.L + 2 * T.pad, SW = T.W + 2 * T.pad;
    const pg = drape(world, f, lL / 2 + 1, lW / 2 + 1, 0.05, (u, v) => [0.5 + (u * (T.L / lL)) / SL, 0.5 - (v * (T.W / lW)) / SW], 4);
    const pm = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: T.tex, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    pm.receiveShadow = true; pm.renderOrder = 1; group.add(pm);
  }

  // ---------------------------------------------------------------- spectator stands (concrete sitting steps)
  const stands = [];
  const graph0 = game.graph;
  const standFor = (f, len, off, rows = 6) => {
    // try the +v side, then the -v side; the stand must not sit on a building, road, water or court
    for (const side of [1, -1]) {
      const v0 = side * off, tread = 0.85, rise = 0.42, depth = rows * tread;
      let ok = true;
      for (let u = -len / 2; u <= len / 2 && ok; u += 4) for (const dv of [0, depth / 2, depth]) {
        const q = P(f, u, v0 + side * dv);
        if (world.buildingAt(q.x, q.z) || world.waterAt(q.x, q.z) || !world.insideCampus(q.x, q.z) || graph0.onRoad(q.x, q.z, 0.8) || (world.sportsAreas || []).some((a) => a.f !== f && inArea(a, q.x, q.z, 1))) ok = false;
      }
      if (!ok) continue;
      // the stand is built in bays of ~5 m, each standing on the ground under it (a long stand on a slope used to be one slab at one height:
      // buried at one end, floating at the other, with ragged ends); concrete cheek walls at both ends, a back wall, and a stair at each end
      const c = P(f, 0, v0 + side * depth / 2), yaw = Math.atan2(f.ax, f.az), seats = [];
      const BAY = 5, nb = Math.max(1, Math.round(len / BAY)), bl = len / nb;
      const gnd = (u, v) => { const q = P(f, u, v); return world.heightAt(q.x, q.z); };
      let yAll = Infinity, yMax = -Infinity;
      for (let i = 0; i < nb; i++) {
        const u0 = -len / 2 + i * bl, uc = u0 + bl / 2;
        let y = Infinity; for (const uu of [u0, uc, u0 + bl]) for (const dv of [0, depth / 2, depth]) y = Math.min(y, gnd(uu, v0 + side * dv));
        yAll = Math.min(yAll, y); yMax = Math.max(yMax, y);
        for (let k = 0; k < rows; k++) {
          const vv = v0 + side * (tread * (k + 0.5)), q = P(f, uc, vv), h = rise * (k + 1);
          solid.push({ geometry: new THREE.BoxGeometry(bl + 0.02, h + 0.35, tread + 0.02), color: k % 2 ? '#bdb8ad' : '#c9c4b8', matrix: m4(q.x, y + h / 2 - 0.175, q.z, 0, yaw + Math.PI / 2, 0) });
          const e = P(f, uc, vv - side * (tread / 2 - 0.03));
          solid.push({ geometry: new THREE.BoxGeometry(bl + 0.02, 0.03, 0.06), color: '#e0d6b8', matrix: m4(e.x, y + h - 0.035, e.z, 0, yaw + Math.PI / 2, 0) });        // a painted edge on every step
          world.addSurface?.({ kind: 'box', x: q.x, z: q.z, hx: bl / 2, hz: tread / 2, yaw: yaw + Math.PI / 2, top: y + h });
          for (let u = u0 + 0.4; u < u0 + bl - 0.2; u += 0.75) { const sp = P(f, u, vv - side * 0.05); seats.push({ x: sp.x, z: sp.z, y: y + h - 0.44, yaw: 0, row: k }); }   // sitting on the step edge, feet on the one below
        }
      }
      for (const su of [-1, 1]) {                                   // the cheek walls: from the lowest ground to just above the top tier
        const uEnd = su * (len / 2 + 0.15), q = P(f, uEnd, v0 + side * depth / 2), top = yAll + rise * rows + 0.5, bot = yAll - 0.6 - (yMax - yAll);
        solid.push({ geometry: new THREE.BoxGeometry(0.3, top - bot, depth + 0.2), color: '#a9a49a', matrix: m4(q.x, (top + bot) / 2, q.z, 0, yaw + Math.PI / 2, 0) });
      }
      { const q = P(f, 0, v0 + side * (depth + 0.15)), top = yAll + rise * rows + 0.9, bot = yAll - 0.6 - (yMax - yAll);     // the back wall, with a rail on it
        solid.push({ geometry: new THREE.BoxGeometry(len + 0.6, top - bot, 0.3), color: '#a9a49a', matrix: m4(q.x, (top + bot) / 2, q.z, 0, yaw + Math.PI / 2, 0) });
        solid.push({ geometry: new THREE.BoxGeometry(len + 0.6, 0.06, 0.08), color: '#5a5f64', matrix: m4(q.x, top + 0.5, q.z, 0, yaw + Math.PI / 2, 0) });
        for (let u = -len / 2; u <= len / 2 + 0.01; u += 2.5) { const p = P(f, u, v0 + side * (depth + 0.15)); solid.push({ geometry: new THREE.BoxGeometry(0.05, 0.55, 0.05), color: '#5a5f64', matrix: m4(p.x, top + 0.25, p.z) }); } }
      // a stair at each end of the stand, in front of the cheek wall: as many steps as tiers, each a little narrower than the one above
      for (const su of [-1, 1]) {
        const uc = su * (len / 2 + 1.0), yS = Math.min(yAll, gnd(uc, v0 + side * depth * 0.5));
        for (let k = 0; k < rows; k++) { const vv = v0 + side * (tread * (k + 0.5)), q = P(f, uc, vv), h = rise * (k + 1); solid.push({ geometry: new THREE.BoxGeometry(1.6, h + 0.3, tread + 0.02), color: '#cfcac0', matrix: m4(q.x, yS + h / 2 - 0.15, q.z, 0, yaw + Math.PI / 2, 0) }); }
        const sq = P(f, uc, v0 + side * depth / 2);
        for (let k = 0; k < rows; k++) world.addSurface?.({ kind: 'box', x: P(f, uc, v0 + side * (tread * (k + 0.5))).x, z: P(f, uc, v0 + side * (tread * (k + 0.5))).z, hx: 0.8, hz: tread / 2 + 0.01, yaw: yaw + Math.PI / 2, top: yS + rise * (k + 1) });
        void sq;
      }
      const y = yAll;
      // collision: the cheek walls and the back wall only (the tiers are steps you can walk up: each is a surface 42 cm above the one below)
      const edge = [[[-len / 2 - 0.15, v0], [-len / 2 - 0.15, v0 + side * (depth + 0.3)]], [[len / 2 + 0.15, v0], [len / 2 + 0.15, v0 + side * (depth + 0.3)]], [[-len / 2 - 0.15, v0 + side * (depth + 0.15)], [len / 2 + 0.15, v0 + side * (depth + 0.15)]]];
      for (const [p0, p1] of edge) { const a = P(f, p0[0], p0[1]), b = P(f, p1[0], p1[1]); fences.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, top: y + rise * rows + 0.9 }); }
      stands.push({ f, seats, cx: c.x, cz: c.z, y, facing: Math.atan2(f.cx - c.x, f.cz - c.z) });
      return;
    }
  };
  for (const f of world.fields) {
    if (f.kind === 'soccer' || f.kind === 'hockey') standFor(f, Math.min(60, f.len * 0.55), f.wid / 2 + 4.5, 6);
    else if (f.kind === 'athletics') standFor(f, 70, f.wid / 2 + 3.4, 7);
  }
  // seated spectators (fix: face the field)
  for (const st of stands) for (const s of st.seats) s.yaw = Math.atan2(st.f.cx - s.x, st.f.cz - s.z);

  // ---------------------------------------------------------------- fences + walk-only gates
  const graph = game.graph;
  const meshMat = new THREE.MeshStandardMaterial({ map: meshTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.3 });
  const meshes = [];
  const gateSigns = [], poolArch = [];
  let nGates = 0;
  for (const F of world.fenceOutlines || fenceOutlines(world)) {
    const ring = F.ring, n = ring.length;
    // gates: where a footpath crosses the fence (grounds), else one gate on the side nearest a path (courts)
    const gates = [];
    let perim = 0;
    const sides = [];
    for (let k = 0; k < n; k++) { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n]; const L = Math.hypot(bx - ax, bz - az); sides.push({ ax, az, bx, bz, L, s0: perim }); perim += L; }
    if (!F.court) {
      for (const e of graph.edges) {
        const pts = e.wpts;
        for (let q = 0; q < pts.length - 1; q++) for (const sd of sides) {
          const t = segX(sd.ax, sd.az, sd.bx, sd.bz, pts[q][0], pts[q][1], pts[q + 1][0], pts[q + 1][1]);
          if (t === null) continue;
          const at = sd.s0 + t * sd.L;
          if (gates.every((gq) => Math.abs(gq.s - at) > 6)) gates.push(F.vp ? { s: at, w: 1.8 } : F.pool ? { s: at, w: 3.0 } : { s: at, w: e.main && !e.foot ? Math.max(2.4, (e.hw || 2) * 2 + 0.6) : 1.6, road: e.main && !e.foot });
        }
      }
    }
    if (!gates.some((gq) => !gq.road)) {
      // at least one way in: the point of the fence nearest to a footpath
      let best = null, bd = Infinity;
      for (const sd of sides) for (let t = 0.1; t <= 0.9; t += 0.1) {
        const x = sd.ax + (sd.bx - sd.ax) * t, z = sd.az + (sd.bz - sd.az) * t;
        if (world.buildingAt(x, z) || world.waterAt(x, z) || !world.insideCampus(x, z) || (!F.vp && graph.onRoad(x, z, 0.4))) continue;      // a gate needs open ground on the fence line
        const nn = graph.nearestOnNetwork(x, z, (e) => !e.fenced);
        if (nn && nn.d < bd) { bd = nn.d; best = sd.s0 + t * sd.L; }
      }
      gates.push({ s: best ?? sides[0].L * 0.5, w: F.pool ? 3.0 : 1.6 });
    }
    const inGate = (s) => gates.find((gq) => Math.abs(gq.s - s) < gq.w / 2 || Math.abs(gq.s - s + perim) < gq.w / 2 || Math.abs(gq.s - s - perim) < gq.w / 2);
    // (the View Point railing closes the road too: only the pedestrian gates lead in)
    const blocked = (x, z) => world.buildingAt(x, z) || world.waterAt(x, z) || !world.insideCampus(x, z) || (!F.vp && graph.onRoad(x, z, 0.4));
    const step = F.style === 'chain' ? 3 : 2.5;
    const col = F.style === 'rail' ? '#2f6b3f' : '#2f4a3a';
    for (const sd of sides) {
      const cnt = Math.max(1, Math.round(sd.L / step));
      for (let k = 0; k < cnt; k++) {
        const s0 = sd.s0 + (sd.L * k) / cnt, s1 = sd.s0 + (sd.L * (k + 1)) / cnt;
        const ta = k / cnt, tb = (k + 1) / cnt;
        let ax = sd.ax + (sd.bx - sd.ax) * ta, az = sd.az + (sd.bz - sd.az) * ta, bx = sd.ax + (sd.bx - sd.ax) * tb, bz = sd.az + (sd.bz - sd.az) * tb;
        if (inGate((s0 + s1) / 2)) continue;
        if (blocked((ax + bx) / 2, (az + bz) / 2)) continue;
        const ya = world.heightAt(ax, az), yb = world.heightAt(bx, bz);
        fences.push({ ax, az, bx, bz, top: Math.max(ya, yb) + F.h });
        const L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax);
        if (F.style === 'wall') {
          // a plastered wall with a coping and a plinth band, stepping with the slope; a pilaster at each joint
          const base = Math.min(ya, yb) - 0.4, top = Math.max(ya, yb) + F.h, wx = (ax + bx) / 2, wz = (az + bz) / 2;
          solid.push({ geometry: new THREE.BoxGeometry(L + 0.04, top - base, 0.24), color: '#e8dfcc', matrix: m4(wx, (base + top) / 2, wz, 0, yaw, 0) });
          solid.push({ geometry: new THREE.BoxGeometry(L + 0.12, 0.08, 0.34), color: '#b9ad97', matrix: m4(wx, top + 0.04, wz, 0, yaw, 0) });
          solid.push({ geometry: new THREE.BoxGeometry(L + 0.05, 0.32, 0.27), color: '#9e8f76', matrix: m4(wx, Math.min(ya, yb) + 0.16, wz, 0, yaw, 0) });
          solid.push({ geometry: new THREE.BoxGeometry(0.44, top - base + 0.14, 0.44), color: '#d8ccb2', matrix: m4(ax, (base + top) / 2 + 0.07, az) });
          continue;
        }
        solid.push({ geometry: new THREE.CylinderGeometry(0.035, 0.04, F.h + 0.05, 6), color: col, matrix: m4(ax, ya + F.h / 2, az) });
        const mx = (ax + bx) / 2, mz = (az + bz) / 2, my = (ya + yb) / 2;
        const tilt = Math.atan2(yb - ya, L);
        if (F.style === 'rail') {
          for (const hh of [0.45, 1.0]) solid.push({ geometry: new THREE.CylinderGeometry(0.03, 0.03, L, 6).rotateZ(Math.PI / 2), color: col, matrix: m4(mx, my + hh, mz, 0, yaw, tilt, 1, 1, 1, 'YZX') });
        } else {
          solid.push({ geometry: new THREE.CylinderGeometry(0.028, 0.028, L, 6).rotateZ(Math.PI / 2), color: col, matrix: m4(mx, my + F.h, mz, 0, yaw, tilt, 1, 1, 1, 'YZX') });
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute([ax, ya + 0.04, az, bx, yb + 0.04, bz, bx, yb + F.h, bz, ax, ya + F.h, az], 3));
          g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, L * 2.4, 0, L * 2.4, F.h * 2.4, 0, F.h * 2.4], 2));
          g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
          (F.style === 'chain' ? chains : meshes).push(g);
        }
      }
    }
    // each gate: two posts, a staggered cycle barrier (people weave through, cycles cannot) and a sign
    for (const gq of gates) {
      let sd = sides.find((q) => gq.s >= q.s0 && gq.s <= q.s0 + q.L) || sides[0];
      const t = (gq.s - sd.s0) / (sd.L || 1);
      const x = sd.ax + (sd.bx - sd.ax) * t, z = sd.az + (sd.bz - sd.az) * t;
      if (blocked(x, z) && !gq.road) continue;
      const tx = (sd.bx - sd.ax) / (sd.L || 1), tz = (sd.bz - sd.az) / (sd.L || 1);
      const y = world.heightAt(x, z), hw2 = gq.w / 2;
      (F.gatesOut ||= []).push({ x, z, y, tx, tz, w: gq.w });
      if (gq.road) {
        // a service road into the ground: closed double gate (opened only for events)
        for (const sgn of [-1, 1]) {
          solid.push({ geometry: new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), color: '#f2f0ea', matrix: m4(x + tx * sgn * hw2, y + 0.8, z + tz * sgn * hw2) });
          const gx = x + tx * sgn * hw2 / 2, gz = z + tz * sgn * hw2 / 2;
          solid.push({ geometry: new THREE.BoxGeometry(hw2 - 0.1, 1.1, 0.05), color: '#2f6b3f', matrix: m4(gx, y + 0.7, gz, 0, Math.atan2(-tz, tx), 0) });
        }
        fences.push({ ax: x - tx * hw2, az: z - tz * hw2, bx: x + tx * hw2, bz: z + tz * hw2, top: y + 1.3 });
        continue;
      }
      if (F.pool) {
        // the pool's entrance: two pillars, an arch with the name, the steel gates folded back against the wall
        const nx = -tz, nz = tx, yaw = Math.atan2(-tz, tx);
        for (const sgn of [-1, 1]) {
          solid.push({ geometry: new THREE.BoxGeometry(0.62, 3.1, 0.62), color: '#d8ccb2', matrix: m4(x + tx * sgn * (hw2 + 0.31), y + 1.55, z + tz * sgn * (hw2 + 0.31)) });
        }
        solid.push({ geometry: new THREE.BoxGeometry(gq.w + 1.3, 0.55, 0.42), color: '#12436b', matrix: m4(x, y + 3.35, z, 0, yaw, 0) });
        poolArch.push({ x, z, y: y + 3.35, yaw: Math.atan2(nx, nz), w: gq.w + 1.1, nx, nz });
        // the automatic gate (onestop.js) is shut until you scan
        fences.push({ ax: x - tx * hw2, az: z - tz * hw2, bx: x + tx * hw2, bz: z + tz * hw2, top: y + 1.2, open: () => !world.poolGateOpen || world.poolGateOpen() });
        nGates++;
        continue;
      }
      for (const sgn of [-1, 1]) solid.push({ geometry: new THREE.CylinderGeometry(0.06, 0.06, F.h + 0.35, 8), color: '#f2f0ea', matrix: m4(x + tx * sgn * hw2, y + (F.h + 0.35) / 2, z + tz * sgn * hw2) });
      // A-frame chicane: two short rails, one set inside and one outside the fence line, overlapping
      const nx = -tz, nz = tx, yaw = Math.atan2(-tz, tx);
      for (const [off, sh] of [[0.55, -0.35], [-0.55, 0.35]]) {
        const cx = x + nx * off + tx * sh * hw2, cz = z + nz * off + tz * sh * hw2, cy = world.heightAt(cx, cz);
        const len = gq.w * 0.72;
        solid.push({ geometry: new THREE.BoxGeometry(len, 0.06, 0.06), color: '#d8c24a', matrix: m4(cx, cy + 0.95, cz, 0, yaw, 0) });
        solid.push({ geometry: new THREE.BoxGeometry(len, 0.06, 0.06), color: '#3a3a3a', matrix: m4(cx, cy + 0.55, cz, 0, yaw, 0) });
        for (const e2 of [-0.5, 0.5]) solid.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), color: '#3a3a3a', matrix: m4(cx + tx * e2 * len, cy + 0.5, cz + tz * e2 * len) });
      }
      // cycles cannot pass (people can)
      fences.push({ ax: x - tx * hw2, az: z - tz * hw2, bx: x + tx * hw2, bz: z + tz * hw2, top: y + 1.2, bikeOnly: true });
      gateSigns.push({ x: x + tx * (hw2 + 0.35), z: z + tz * (hw2 + 0.35), y, yaw: Math.atan2(nx, nz) });
      nGates++;
    }
  }
  if (meshes.length) { const m = new THREE.Mesh(mergeGeos(meshes), meshMat); m.name = 'court-mesh-fences'; group.add(m); }
  if (poolArch.length) {
    const tex = canvasTexture(1024, 160, (g, w, h) => { g.fillStyle = '#12436b'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 92px "Hind", "Segoe UI", sans-serif'; g.fillText('SWIMMING POOL', w / 2, h / 2 + 4, w - 40); }, { repeat: false });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
    for (const a of poolArch) for (const sgn of [1, -1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(a.w, a.w * 0.156), mat);
      m.position.set(a.x + a.nx * 0.22 * sgn, a.y, a.z + a.nz * 0.22 * sgn); m.rotation.y = a.yaw + (sgn < 0 ? Math.PI : 0);
      group.add(m);
    }
  }
  if (gateSigns.length) {
    const signTex = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
      g.strokeStyle = '#c62828'; g.lineWidth = 12; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
      g.strokeStyle = '#1c1c1c'; g.lineWidth = 5;
      g.beginPath(); g.arc(42, 76, 14, 0, 7); g.stroke(); g.beginPath(); g.arc(86, 76, 14, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(42, 76); g.lineTo(58, 52); g.lineTo(80, 52); g.lineTo(86, 76); g.moveTo(58, 52); g.lineTo(64, 76); g.lineTo(42, 76); g.stroke();
      g.strokeStyle = '#c62828'; g.lineWidth = 10; g.beginPath(); g.moveTo(26, 26); g.lineTo(102, 102); g.stroke();
    }, { repeat: false });
    const sm = new THREE.InstancedMesh(new THREE.CircleGeometry(0.22, 20), new THREE.MeshStandardMaterial({ map: signTex, side: THREE.DoubleSide, roughness: 0.6 }), gateSigns.length);
    gateSigns.forEach((q, k) => { sm.setMatrixAt(k, m4(q.x, q.y + 1.55, q.z, 0, q.yaw, 0)); solid.push({ geometry: new THREE.CylinderGeometry(0.03, 0.03, 1.35, 6), color: '#8a8f94', matrix: m4(q.x, q.y + 0.67, q.z) }); });
    group.add(sm);
  }
  for (const n of nets) { const m = new THREE.Mesh(n.g, n.mat); m.castShadow = false; group.add(m); }
  if (chains.length) {
    const m = new THREE.Mesh(mergeGeos(chains), chainMat);
    m.name = 'court-fences';
    group.add(m);
  }
  if (solid.length) {
    const m = new THREE.Mesh(mergeColored(solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 }));
    m.castShadow = true;
    group.add(m);
  }
  // floodlight heads: emissive panels that glow in the evening
  const headGeo = new THREE.BoxGeometry(0.9, 0.5, 0.25);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x2b2f33, emissive: 0xfff4dc, emissiveIntensity: 0, roughness: 0.5 });
  const headMesh = new THREE.InstancedMesh(headGeo, headMat, Math.max(1, heads.length));
  heads.forEach((h, i) => headMesh.setMatrixAt(i, m4(h.x, h.y, h.z, -0.5, h.yaw, 0, 1, 1, 1, 'YXZ')));
  headMesh.count = heads.length;
  group.add(headMesh);

  // fence collisions (player, bicycle)
  for (const f of fences) world.indexFence(f);

  return {
    group, surfaces, stands,
    /** people on the stands: busy for evening games and events, a few otherwise */
    draw(crowd, g) {
      if (g.interior?.active || !stands.length) return;
      const h = g.clock.hour, cam = g.camera.position;
      const ev = g.events?.current?.();
      const evening = h > 16.3 && h < 19 ? 0.07 : h > 7 && h < 16.3 ? 0.015 : h > 19 && h < 21 ? 0.01 : 0;
      const rain = g.weather.state.rain > 0.3;
      for (const st of stands) {
        if (Math.hypot(st.cx - cam.x, st.cz - cam.z) > 260) continue;
        const busy = rain ? 0 : ev && Math.hypot(ev.place().x - st.cx, ev.place().z - st.cz) < 200 ? 0.35 : evening;
        if (!st.people) {
          const r = mulberry32(Math.round(st.cx * 7 + st.cz));
          st.people = st.seats.map((s) => ({ ...s, th: r(), anim: r() < 0.8 ? AN.SIT : AN.CLAP, phase: r() * 6, speed: 0, extra: 1, look: studentLook(r) }));
        }
        for (const p of st.people) if (p.th < busy) crowd.push(p);
      }
    },
    counts: { tennis: world.fields.filter((f) => f.kind === 'tennis').length, courts: surfaces.length, lights: heads.length, fences: fences.length, gates: nGates },
    /** floodlights on from dusk until 10:30 pm; lit courts glow a little so night games are visible */
    setNight(night, hour) {
      const on = night > 0.25 && hour > 17 && hour < 22.5 ? 1 : 0;
      headMat.emissiveIntensity = on * 2.2;
      for (const s of surfaces) s.m.material.emissiveIntensity = s.lit && !s.f.gen ? on * 0.32 : on * 0.08;
    },
  };
}

function mergeGeos(list) {
  let n = 0, ni = 0;
  for (const g of list) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    for (const i of g.index.array) idx.push(i + o);
    o += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

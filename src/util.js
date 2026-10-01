import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function angleDamp(a, b, lambda, dt) {
  return a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
}

export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Point in polygon for a flat ring [x0,z0,x1,z1,...]. */
export function pointInRing(x, z, r) {
  let inside = false;
  const n = r.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Closest point on a flat ring's edges. Returns {d, x, z, nx, nz}. */
export function closestOnRing(x, z, r, out) {
  let best = Infinity;
  const n = r.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const ax = r[j], az = r[j + 1], bx = r[i], bz = r[i + 1];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz || 1e-9;
    let t = ((x - ax) * dx + (z - az) * dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t, pz = az + dz * t;
    const d = (x - px) ** 2 + (z - pz) ** 2;
    if (d < best) {
      best = d;
      out.x = px; out.z = pz;
    }
  }
  out.d = Math.sqrt(best);
  return out;
}

/** Text drawn on a board never runs off its texture: a line wider than the room it has is drawn smaller
 *  (down to 60%) and, if that is still not enough, a little narrower, so every word can be read. Boards
 *  built from a texture atlas can pass `cell` ([x0, x1]) to fit within their own cell. */
export function fitText(g, cell = null) {
  if (g.__fit) { if (cell) g.__cell = cell; return g; }
  g.__fit = true; g.__cell = cell;
  const room = (x) => {
    const W = g.canvas.width, c = g.__cell, lo = c ? c[0] : 0, hi = c ? c[1] : W, pad = Math.max(3, (hi - lo) * 0.02), a = g.textAlign;
    return a === 'center' ? 2 * Math.min(x - lo, hi - x) - 2 * pad : a === 'right' || a === 'end' ? x - lo - pad : hi - x - pad;
  };
  const wrap = (raw) => function (text, x, y, maxW) {
    text = String(text);
    const T = this.getTransform();
    if (Math.abs(T.b) > 1e-3 || Math.abs(T.c) > 1e-3) return raw.call(this, text, x, y, maxW);      // rotated text: leave it
    const sx = Math.abs(T.a) || 1;
    let avail = room(T.a * x + T.e);
    if (maxW) avail = Math.min(avail, maxW * sx);
    const w = this.measureText(text).width * sx;
    if (avail <= 8 || w <= avail + 0.5) return raw.call(this, text, x, y, maxW);
    const k = avail / w, m = /(\d+(?:\.\d+)?)px/.exec(this.font);
    if (typeof window !== 'undefined' && window.__fitLog) window.__fitLog.push({ text: text.slice(0, 70), k: +k.toFixed(2), W: this.canvas.width, H: this.canvas.height, font: this.font });
    if (!m) return raw.call(this, text, x, y, avail / sx);
    const f = this.font;
    this.font = f.replace(m[0], `${(+m[1] * Math.max(k, 0.6)).toFixed(1)}px`);
    raw.call(this, text, x, y, avail / sx);
    this.font = f;
  };
  g.fillText = wrap(g.fillText);
  g.strokeText = wrap(g.strokeText);
  return g;
}

export function canvasTexture(w, h, draw, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = fitText(c.getContext('2d'));
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Merge a list of {geometry, color} parts into one non-indexed geometry with vertex colours. */
export function mergeColored(parts) {
  let count = 0;
  const geos = parts.map(({ geometry, color, matrix }) => {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    count += g.attributes.position.count;
    return { g, color: new THREE.Color(color) };
  });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const { g, color } of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array, nn = g.attributes.normal.array;
    pos.set(p, o * 3);
    nor.set(nn, o * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      col[(o + i) * 3] = color.r; col[(o + i) * 3 + 1] = color.g; col[(o + i) * 3 + 2] = color.b;
    }
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

export function m4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, order = 'XYZ') {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, order)), new THREE.Vector3(sx, sy, sz));
  return m;
}

/** Cylinder between two points (for frames, poles). */
export function tube(a, b, r, seg = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

export function fmtDist(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/**
 * Offer a file to the player: inside the claude.ai viewer through its `downloads` capability
 * (the viewer confirms the save), otherwise (the game opened as a local file) a normal download.
 */
export async function saveFile(filename, data) {
  const c = typeof window !== 'undefined' ? window.claude : null;
  if (c && typeof c.use === 'function') {
    const dl = await c.use('downloads').catch(() => null);
    if (dl) {
      try { await dl.save({ filename, data }); return 'saved'; } catch (e) { return e && e.code === 'declined' ? 'declined' : 'unavailable'; }
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'saved';
}

/** The Indian national flag (3:2) on a canvas context: saffron, white, green, and the navy blue
 *  Ashoka Chakra (24 spokes, diameter 3/4 of the white band) in the centre. */
export function drawIndianFlag(g, w, h) {
  g.fillStyle = '#ff9933'; g.fillRect(0, 0, w, h / 3 + 0.5);
  g.fillStyle = '#ffffff'; g.fillRect(0, h / 3, w, h / 3 + 0.5);
  g.fillStyle = '#138808'; g.fillRect(0, (2 * h) / 3, w, h / 3);
  const cx = w / 2, cy = h / 2, r = (h / 3) * 0.375;
  g.strokeStyle = '#000080'; g.fillStyle = '#000080';
  g.lineWidth = Math.max(1, r * 0.1);
  g.beginPath(); g.arc(cx, cy, r - g.lineWidth / 2, 0, Math.PI * 2); g.stroke();
  g.lineWidth = Math.max(0.6, r * 0.045);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.18, cy + Math.sin(a) * r * 0.18); g.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); g.stroke();
    const b = a + Math.PI / 24;                                   // the small dots on the rim between spokes
    g.beginPath(); g.arc(cx + Math.cos(b) * r * 0.9, cy + Math.sin(b) * r * 0.9, Math.max(0.5, r * 0.035), 0, Math.PI * 2); g.fill();
  }
  g.beginPath(); g.arc(cx, cy, r * 0.18, 0, Math.PI * 2); g.fill();
}

/** An original campus crest (deliberately NOT the institute's official logo, which is copyrighted):
 *  a navy ring round a cream disc with a rising sun over Brahmaputra waves and an open book. */
export function drawCampusCrest(g, cx, cy, r) {
  g.save();
  g.fillStyle = '#f4efe6'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.lineWidth = r * 0.1; g.strokeStyle = '#23407a'; g.beginPath(); g.arc(cx, cy, r * 0.95, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(cx, cy, r * 0.8, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#e9a23b'; g.beginPath(); g.arc(cx, cy + r * 0.12, r * 0.36, Math.PI, 0); g.fill();              // rising sun
  g.strokeStyle = '#e9a23b'; g.lineWidth = r * 0.05;
  for (let k = 0; k < 7; k++) { const a = Math.PI + (k + 0.5) * (Math.PI / 7); g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.44, cy + r * 0.12 + Math.sin(a) * r * 0.44); g.lineTo(cx + Math.cos(a) * r * 0.6, cy + r * 0.12 + Math.sin(a) * r * 0.6); g.stroke(); }
  g.strokeStyle = '#2f6fb0'; g.lineWidth = r * 0.07;                                                            // the river
  for (const dy of [0.2, 0.34]) { g.beginPath(); for (let x = -1; x <= 1.001; x += 0.05) { const px = cx + x * r * 0.8, py = cy + r * dy + Math.sin(x * 9) * r * 0.035; if (x === -1) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke(); }
  g.fillStyle = '#7a2630';                                                                                      // open book
  g.beginPath(); g.moveTo(cx, cy + r * 0.5); g.quadraticCurveTo(cx - r * 0.25, cy + r * 0.4, cx - r * 0.5, cy + r * 0.48); g.lineTo(cx - r * 0.5, cy + r * 0.72); g.quadraticCurveTo(cx - r * 0.25, cy + r * 0.64, cx, cy + r * 0.74); g.quadraticCurveTo(cx + r * 0.25, cy + r * 0.64, cx + r * 0.5, cy + r * 0.72); g.lineTo(cx + r * 0.5, cy + r * 0.48); g.quadraticCurveTo(cx + r * 0.25, cy + r * 0.4, cx, cy + r * 0.5); g.fill();
  g.restore();
}


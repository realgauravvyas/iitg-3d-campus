// The paintings on the campus walls. Every painter draws into a w x h box (w is 1024 design units)
// with its own seeded random, so no two copies of a scene come out the same:
//  - spray-can graffiti (a hostel's name and a slogan)
//  - hand-painted scenes of Assam: the Brahmaputra at dusk with a country boat, Kaziranga's
//    one-horned rhinos, a tea garden with pickers, Bihu dancers with dhol and pepa, the great hornbill
//    among kopou orchids, the Saraighat bridge at dusk, a starry night over the hostels
//  - for the houses: a japi with gamosa borders, kopou orchids, a lotus pond
//  - themed walls: music (SAC), sport (New SAC), food (Food Court), a children's wall (KV)
// All of it is drawn here (no photos, logos or other people's artwork).

const TAU = Math.PI * 2;
const DISPLAY = (px) => `600 ${px}px "Teko", "Hind", "Segoe UI", sans-serif`;
const FONT = (w, px) => `${w} ${px}px "Hind", "Segoe UI", system-ui, sans-serif`;
const ASM = (px) => `700 ${px}px "Nirmala UI", "Vrinda", "Shonar Bangla", "Noto Sans Bengali", sans-serif`;

// ------------------------------------------------------------------ helpers
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}
function vgrad(g, y0, y1, stops) { const gr = g.createLinearGradient(0, y0, 0, y1); for (const [t, c] of stops) gr.addColorStop(t, c); return gr; }
function fillSky(g, w, y1, stops) { g.fillStyle = vgrad(g, 0, y1, stops); g.fillRect(0, 0, w, y1 + 2); }
/** a smooth ridge line (sum of sines): x -> height above the base line */
function ridgeFn(w, amp, r, freq = 1) {
  const p = [r() * TAU, r() * TAU, r() * TAU];
  return (x) => { const t = (x / w) * Math.PI * freq; return amp * (Math.sin(t * 1.3 + p[0]) * 0.55 + Math.sin(t * 2.9 + p[1]) * 0.3 + Math.sin(t * 6.1 + p[2]) * 0.15); };
}
function fillRidge(g, w, y, fn, fill, bottom) {
  g.fillStyle = fill; g.beginPath(); g.moveTo(-4, bottom);
  for (let x = -4; x <= w + 8; x += 4) g.lineTo(x, y - fn(x));
  g.lineTo(w + 8, bottom); g.closePath(); g.fill();
}
function sun(g, x, y, R, core, glow) {
  const gr = g.createRadialGradient(x, y, R * 0.3, x, y, R * 4.5);
  gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(x - R * 4.5, y - R * 4.5, R * 9, R * 9);
  g.fillStyle = core; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
}
function cloud(g, x, y, s, col, r) {
  g.fillStyle = col; g.beginPath();
  for (let k = 0; k < 5; k++) { const dx = (k - 2) * s * 0.32, dy = -Math.abs(k - 2) * -s * 0.06 - (k % 2) * s * 0.12; g.moveTo(x + dx + s * 0.3, y + dy); g.ellipse(x + dx, y + dy, s * (0.28 + r() * 0.1), s * (0.16 + r() * 0.06), 0, 0, TAU); }
  g.fill();
}
function birds(g, r, n, x0, y0, x1, y1, col, s = 1) {
  g.strokeStyle = col; g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), sz = (7 + r() * 9) * s;
    g.lineWidth = Math.max(1.5, sz * 0.2);
    g.beginPath(); g.moveTo(x - sz, y - sz * 0.2); g.quadraticCurveTo(x - sz * 0.45, y - sz * 0.62, x, y); g.quadraticCurveTo(x + sz * 0.45, y - sz * 0.62, x + sz, y - sz * 0.2); g.stroke();
  }
}
function blades(g, r, n, x0, x1, yb, h0, h1, cols, lw = 2.5) {
  g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const x = x0 + r() * (x1 - x0), hh = h0 + r() * (h1 - h0), bend = (r() - 0.5) * hh * 0.6;
    g.strokeStyle = cols[k % cols.length]; g.lineWidth = lw * (0.6 + r() * 0.8);
    g.beginPath(); g.moveTo(x, yb); g.quadraticCurveTo(x + bend * 0.2, yb - hh * 0.6, x + bend, yb - hh); g.stroke();
  }
}
/** trees: 'flat' (silk cotton on the horizon), 'shade' (tea-garden shade tree), 'areca' palm, 'round' */
function tree(g, x, yb, H, col, r, type) {
  g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
  if (type === 'areca') {
    g.lineWidth = H * 0.025; g.beginPath(); g.moveTo(x, yb); g.quadraticCurveTo(x + H * 0.05, yb - H * 0.5, x + H * 0.02, yb - H); g.stroke();
    g.lineWidth = H * 0.018;
    for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k / 8 - 0.5) * 2.6, L = H * (0.22 + r() * 0.08); g.beginPath(); g.moveTo(x + H * 0.02, yb - H); g.quadraticCurveTo(x + H * 0.02 + Math.cos(a) * L * 0.6, yb - H + Math.sin(a) * L * 0.6 - L * 0.15, x + H * 0.02 + Math.cos(a) * L, yb - H + Math.sin(a) * L + L * 0.25); g.stroke(); }
    return;
  }
  const tw = type === 'round' ? H * 0.08 : H * 0.035;
  g.lineWidth = tw; g.beginPath(); g.moveTo(x, yb); g.lineTo(x, yb - H * (type === 'round' ? 0.45 : 0.7)); g.stroke();
  if (type === 'round') { g.beginPath(); g.arc(x, yb - H * 0.66, H * 0.3, 0, TAU); g.fill(); return; }
  if (type === 'shade') {
    g.lineWidth = tw * 0.6;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, yb - H * 0.6); g.lineTo(x + s * H * 0.18, yb - H * 0.86); g.stroke(); }
    for (const [dx, dy, rx] of [[0, -1.0, 0.3], [-0.2, -0.88, 0.2], [0.2, -0.88, 0.22]]) { g.beginPath(); g.ellipse(x + dx * H, yb + dy * H, rx * H, rx * H * 0.24, 0, 0, TAU); g.fill(); }
    return;
  }
  for (const [dx, dy, rx] of [[0, -0.8, 0.22], [-0.16, -0.72, 0.14], [0.16, -0.74, 0.15]]) { g.beginPath(); g.ellipse(x + dx * H, yb + dy * H, rx * H, rx * H * 0.45, 0, 0, TAU); g.fill(); }
}
/** a hand-painted finish: brush texture, a soft vignette and a painted frame */
function finish(g, w, h, r, frame = '#2a2320', ft = 12) {
  g.save();
  g.globalAlpha = 0.045;
  for (let k = 0; k < 1100; k++) { g.fillStyle = r() < 0.5 ? '#ffffff' : '#000000'; g.fillRect(r() * w, r() * h, 6 + r() * 30, 1.5 + r() * 2.5); }
  g.restore();
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.2)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  g.lineWidth = ft; g.strokeStyle = frame; g.strokeRect(ft / 2, ft / 2, w - ft, h - ft);
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.25)'; g.strokeRect(ft + 2, ft + 2, w - ft * 2 - 4, h - ft * 2 - 4);
}
function caption(g, text, x, y, px, col, { align = 'right', font = DISPLAY, shadow = 'rgba(0,0,0,0.4)' } = {}) {
  g.font = font(px); g.textAlign = align; g.textBaseline = 'alphabetic';
  if (shadow) { g.fillStyle = shadow; g.fillText(text, x + px * 0.04, y + px * 0.04); }
  g.fillStyle = col; g.fillText(text, x, y);
}
/** a band of gamosa: white hand-woven cotton with red stripes and woven red motifs */
function gamosa(g, x, y, w, hb) {
  g.fillStyle = '#f6f1e6'; g.fillRect(x, y, w, hb);
  g.fillStyle = '#c0182a';
  g.fillRect(x, y + hb * 0.07, w, hb * 0.07); g.fillRect(x, y + hb * 0.86, w, hb * 0.07);
  g.fillRect(x, y + hb * 0.2, w, hb * 0.025); g.fillRect(x, y + hb * 0.775, w, hb * 0.025);
  const m = hb * 0.5, n = Math.max(3, Math.floor(w / (m * 1.7))), step = w / n;
  for (let k = 0; k < n; k++) {
    const cx = x + (k + 0.5) * step, cy = y + hb * 0.49;
    g.fillStyle = '#c0182a';
    g.beginPath(); g.moveTo(cx, cy - m * 0.46); g.lineTo(cx + m * 0.46, cy); g.lineTo(cx, cy + m * 0.46); g.lineTo(cx - m * 0.46, cy); g.closePath(); g.fill();
    g.fillStyle = '#f6f1e6';
    g.beginPath(); g.moveTo(cx, cy - m * 0.26); g.lineTo(cx + m * 0.26, cy); g.lineTo(cx, cy + m * 0.26); g.lineTo(cx - m * 0.26, cy); g.closePath(); g.fill();
    g.fillStyle = '#c0182a'; g.fillRect(cx - m * 0.07, cy - m * 0.07, m * 0.14, m * 0.14);
    for (const s of [-1, 1]) { g.fillRect(cx + s * step * 0.5 - m * 0.04, cy - m * 0.3, m * 0.08, m * 0.6); g.fillRect(cx + s * step * 0.5 - m * 0.16, cy - m * 0.04, m * 0.32, m * 0.08); }
  }
}
/** a japi (the Assamese sun hat) seen from the front: bamboo, red rim, woven black-and-green triangles */
function japi(g, x, y, R) {
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + R * 0.06, y + R * 0.08, R, R, 0, 0, TAU); g.fill();
  g.fillStyle = '#b3202a'; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
  g.fillStyle = '#e9c77d'; g.beginPath(); g.arc(x, y, R * 0.88, 0, TAU); g.fill();
  const n = 18;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU, am = (a0 + a1) / 2;
    g.fillStyle = k % 2 ? '#1b1b1b' : '#2f7a3a';
    g.beginPath(); g.moveTo(x + Math.cos(a0) * R * 0.86, y + Math.sin(a0) * R * 0.86); g.lineTo(x + Math.cos(a1) * R * 0.86, y + Math.sin(a1) * R * 0.86); g.lineTo(x + Math.cos(am) * R * 0.66, y + Math.sin(am) * R * 0.66); g.closePath(); g.fill();
  }
  g.strokeStyle = '#8a5a2a'; g.lineWidth = R * 0.012;
  for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(x, y, R * (0.12 + k * 0.1), 0, TAU); g.stroke(); }
  g.fillStyle = '#b3202a';
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a - 0.12) * R * 0.5, y + Math.sin(a - 0.12) * R * 0.5); g.lineTo(x + Math.cos(a) * R * 0.58, y + Math.sin(a) * R * 0.58); g.lineTo(x + Math.cos(a + 0.12) * R * 0.5, y + Math.sin(a + 0.12) * R * 0.5); g.closePath(); g.fill(); }
  g.fillStyle = '#f2c230'; g.beginPath(); g.arc(x, y, R * 0.12, 0, TAU); g.fill();
  g.fillStyle = '#b3202a'; g.beginPath(); g.arc(x, y, R * 0.05, 0, TAU); g.fill();
}
/** a hanging spray of kopou (foxtail orchid), Assam's Bihu flower */
function kopou(g, x, y, len, r, lean = 0.2) {
  const pts = [];
  for (let k = 0; k <= 30; k++) { const t = k / 30; pts.push([x + Math.sin(t * 1.6) * len * lean, y + t * len]); }
  g.strokeStyle = '#4c7a3a'; g.lineWidth = 3; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
  for (let k = 0; k < 70; k++) {
    const t = r() ** 0.8, [px, py] = pts[Math.min(30, Math.floor(t * 30))], rad = (1 - t * 0.6) * len * 0.035 + 2;
    const ox = (r() - 0.5) * len * 0.1 * (1 - t * 0.5);
    g.fillStyle = ['#e88fc4', '#c95fa6', '#f4c3df', '#d874b4'][k % 4];
    g.beginPath(); g.arc(px + ox, py + (r() - 0.5) * 6, rad, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(px + ox - rad * 0.2, py - rad * 0.2, rad * 0.3, 0, TAU); g.fill();
  }
}
function butterfly(g, x, y, s, col, r) {
  const a = r() * 0.8 - 0.4;
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = col;
  for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * s * 0.45, -s * 0.2, s * 0.5, s * 0.36, sd * 0.5, 0, TAU); g.fill(); g.beginPath(); g.ellipse(sd * s * 0.35, s * 0.3, s * 0.3, s * 0.24, -sd * 0.4, 0, TAU); g.fill(); }
  g.fillStyle = '#1a1a1a'; g.fillRect(-s * 0.05, -s * 0.45, s * 0.1, s * 0.9);
  for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * s * 0.55, -s * 0.28, s * 0.08, 0, TAU); g.fill(); }
  g.restore();
}

// ------------------------------------------------------------------ people (folk-art style)
function limb(g, pts, lw, col) { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); }
/** a Bihu dancer in mekhela-chador, kopou flowers in her hair. pose 0: both arms up, 1: one arm up */
function dancerW(g, x, yb, H, pose, tilt = 0) {
  const u = H, skin = '#8a5236';
  g.save(); g.translate(x, yb); g.rotate(tilt);
  // arms (behind the body)
  const up = [[-0.075, -0.8], [-0.19, -0.9], [-0.13, -1.03]], up2 = [[0.075, -0.8], [0.19, -0.9], [0.13, -1.03]], hip = [[0.075, -0.8], [0.15, -0.68], [0.06, -0.6]];
  limb(g, up.map(([a, b]) => [a * u, b * u]), u * 0.034, skin);
  limb(g, (pose ? hip : up2).map(([a, b]) => [a * u, b * u]), u * 0.034, skin);
  // mekhela: flared, cream silk with a red border
  g.fillStyle = '#f1dea9';
  g.beginPath(); g.moveTo(-0.065 * u, -0.58 * u); g.lineTo(0.065 * u, -0.58 * u); g.lineTo(0.14 * u, -0.03 * u); g.quadraticCurveTo(0, -0.01 * u, -0.14 * u, -0.03 * u); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(150,110,50,0.35)'; g.lineWidth = u * 0.006;
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 0.022 * u, -0.56 * u); g.lineTo(k * 0.05 * u, -0.05 * u); g.stroke(); }
  g.fillStyle = '#b3202a'; g.fillRect(-0.135 * u, -0.12 * u, 0.27 * u, 0.035 * u);
  g.fillStyle = '#b3202a';
  for (let k = -3; k <= 3; k++) { const cx = k * 0.036 * u, cy = -0.06 * u, m = 0.012 * u; g.beginPath(); g.moveTo(cx, cy - m); g.lineTo(cx + m, cy); g.lineTo(cx, cy + m); g.lineTo(cx - m, cy); g.closePath(); g.fill(); }
  // feet
  g.fillStyle = skin; g.beginPath(); g.ellipse(-0.05 * u, -0.012 * u, 0.035 * u, 0.014 * u, 0, 0, TAU); g.ellipse(0.06 * u, -0.012 * u, 0.035 * u, 0.014 * u, 0, 0, TAU); g.fill();
  // blouse and the chador across it
  g.fillStyle = '#b3202a';
  g.beginPath(); g.moveTo(-0.08 * u, -0.83 * u); g.lineTo(0.08 * u, -0.83 * u); g.lineTo(0.062 * u, -0.57 * u); g.lineTo(-0.062 * u, -0.57 * u); g.closePath(); g.fill();
  g.fillStyle = '#f6ebc8';
  g.beginPath(); g.moveTo(-0.085 * u, -0.84 * u); g.lineTo(-0.02 * u, -0.84 * u); g.lineTo(0.075 * u, -0.6 * u); g.lineTo(0.07 * u, -0.5 * u); g.lineTo(0.0, -0.57 * u); g.closePath(); g.fill();
  g.strokeStyle = '#b3202a'; g.lineWidth = u * 0.008; g.stroke();
  // neck, head, hair with a bun and kopou flowers, earrings
  g.fillStyle = skin; g.fillRect(-0.018 * u, -0.87 * u, 0.036 * u, 0.05 * u);
  g.beginPath(); g.arc(0, -0.915 * u, 0.055 * u, 0, TAU); g.fill();
  g.fillStyle = '#1a1210'; g.beginPath(); g.arc(0.008 * u, -0.935 * u, 0.056 * u, Math.PI * 0.95, Math.PI * 2.1); g.fill();
  g.beginPath(); g.arc(0.065 * u, -0.93 * u, 0.035 * u, 0, TAU); g.fill();
  for (const [dx, dy] of [[0.085, -0.965], [0.1, -0.93], [0.09, -0.9]]) { g.fillStyle = '#e88fc4'; g.beginPath(); g.arc(dx * u, dy * u, 0.014 * u, 0, TAU); g.fill(); }
  g.fillStyle = '#f2c230'; g.beginPath(); g.arc(-0.05 * u, -0.89 * u, 0.008 * u, 0, TAU); g.fill();
  g.fillStyle = '#b3202a'; g.beginPath(); g.arc(-0.012 * u, -0.935 * u, 0.006 * u, 0, TAU); g.fill();
  // hands
  g.fillStyle = skin;
  g.beginPath(); g.arc(-0.13 * u, -1.03 * u, 0.02 * u, 0, TAU); g.fill();
  if (!pose) { g.beginPath(); g.arc(0.13 * u, -1.03 * u, 0.02 * u, 0, TAU); g.fill(); }
  g.restore();
}
/** a dhuliya: a man in a white dhoti with a gamosa turban, playing the dhol slung at his waist */
function drummer(g, x, yb, H, tilt = 0) {
  const u = H, skin = '#7a452c';
  g.save(); g.translate(x, yb); g.rotate(tilt);
  // legs in a wide dancing stance
  limb(g, [[-0.04 * u, -0.5 * u], [-0.13 * u, -0.28 * u], [-0.11 * u, -0.02 * u]], u * 0.045, skin);
  limb(g, [[0.04 * u, -0.5 * u], [0.13 * u, -0.28 * u], [0.12 * u, -0.02 * u]], u * 0.045, skin);
  // dhoti
  g.fillStyle = '#f7f4ec';
  g.beginPath(); g.moveTo(-0.08 * u, -0.56 * u); g.lineTo(0.08 * u, -0.56 * u); g.lineTo(0.16 * u, -0.3 * u); g.lineTo(0.05 * u, -0.25 * u); g.lineTo(0, -0.36 * u); g.lineTo(-0.05 * u, -0.25 * u); g.lineTo(-0.16 * u, -0.3 * u); g.closePath(); g.fill();
  g.fillStyle = '#b3202a'; g.fillRect(-0.08 * u, -0.57 * u, 0.16 * u, 0.02 * u);
  // body (a white vest) and head with a red-and-white gamosa tied round it
  g.fillStyle = '#efe9da'; g.beginPath(); g.moveTo(-0.085 * u, -0.84 * u); g.lineTo(0.085 * u, -0.84 * u); g.lineTo(0.075 * u, -0.55 * u); g.lineTo(-0.075 * u, -0.55 * u); g.closePath(); g.fill();
  g.fillStyle = skin; g.fillRect(-0.02 * u, -0.88 * u, 0.04 * u, 0.05 * u);
  g.beginPath(); g.arc(0, -0.93 * u, 0.058 * u, 0, TAU); g.fill();
  g.fillStyle = '#f6f1e6'; g.fillRect(-0.062 * u, -0.99 * u, 0.124 * u, 0.035 * u);
  g.fillStyle = '#c0182a'; g.fillRect(-0.062 * u, -0.978 * u, 0.124 * u, 0.01 * u);
  g.beginPath(); g.moveTo(0.055 * u, -0.98 * u); g.lineTo(0.1 * u, -1.0 * u); g.lineTo(0.09 * u, -0.96 * u); g.closePath(); g.fill();
  // the dhol: a barrel drum across the waist, rope tension in a zigzag
  const dy = -0.6 * u;
  g.fillStyle = '#8a4b22'; g.beginPath(); g.ellipse(0, dy, 0.17 * u, 0.075 * u, 0, 0, TAU); g.fill();
  g.fillStyle = '#6b3818'; g.fillRect(-0.15 * u, dy - 0.075 * u, 0.3 * u, 0.15 * u);
  g.strokeStyle = '#f2e6c8'; g.lineWidth = u * 0.008; g.beginPath();
  for (let k = 0; k <= 10; k++) { const px = -0.15 * u + (k / 10) * 0.3 * u, py = dy + (k % 2 ? 0.07 : -0.07) * u; k ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke();
  for (const s of [-1, 1]) { g.fillStyle = '#e8d9b0'; g.beginPath(); g.ellipse(s * 0.155 * u, dy, 0.025 * u, 0.078 * u, 0, 0, TAU); g.fill(); g.strokeStyle = '#b3202a'; g.lineWidth = u * 0.01; g.stroke(); }
  // arms: one hand on the skin, the other swinging the stick
  limb(g, [[-0.08 * u, -0.8 * u], [-0.16 * u, -0.7 * u], [-0.17 * u, -0.61 * u]], u * 0.036, skin);
  limb(g, [[0.08 * u, -0.8 * u], [0.2 * u, -0.78 * u], [0.24 * u, -0.9 * u]], u * 0.036, skin);
  limb(g, [[0.24 * u, -0.9 * u], [0.18 * u, -0.68 * u]], u * 0.012, '#4a2a12');
  g.restore();
}
/** a pepa player: a man leaning back, blowing the buffalo-horn pipe */
function piper(g, x, yb, H, tilt = -0.06) {
  const u = H, skin = '#7a452c';
  g.save(); g.translate(x, yb); g.rotate(tilt);
  limb(g, [[-0.03 * u, -0.5 * u], [-0.09 * u, -0.26 * u], [-0.12 * u, -0.02 * u]], u * 0.045, skin);
  limb(g, [[0.04 * u, -0.5 * u], [0.1 * u, -0.3 * u], [0.06 * u, -0.02 * u]], u * 0.045, skin);
  g.fillStyle = '#f7f4ec';
  g.beginPath(); g.moveTo(-0.08 * u, -0.56 * u); g.lineTo(0.08 * u, -0.56 * u); g.lineTo(0.13 * u, -0.3 * u); g.lineTo(0.02 * u, -0.27 * u); g.lineTo(-0.12 * u, -0.28 * u); g.closePath(); g.fill();
  g.fillStyle = '#c0182a'; g.fillRect(-0.08 * u, -0.57 * u, 0.16 * u, 0.02 * u);
  g.fillStyle = '#e6c46a'; g.beginPath(); g.moveTo(-0.085 * u, -0.84 * u); g.lineTo(0.085 * u, -0.84 * u); g.lineTo(0.075 * u, -0.55 * u); g.lineTo(-0.075 * u, -0.55 * u); g.closePath(); g.fill();
  // gamosa round the neck
  g.fillStyle = '#f6f1e6'; g.beginPath(); g.moveTo(-0.07 * u, -0.85 * u); g.lineTo(0.07 * u, -0.85 * u); g.lineTo(0.03 * u, -0.66 * u); g.lineTo(-0.01 * u, -0.66 * u); g.closePath(); g.fill();
  g.fillStyle = '#c0182a'; g.fillRect(-0.012 * u, -0.7 * u, 0.045 * u, 0.012 * u);
  g.fillStyle = skin; g.fillRect(-0.02 * u, -0.88 * u, 0.04 * u, 0.05 * u);
  g.beginPath(); g.arc(0, -0.93 * u, 0.058 * u, 0, TAU); g.fill();
  g.fillStyle = '#1a1210'; g.beginPath(); g.arc(0, -0.95 * u, 0.058 * u, Math.PI, Math.PI * 2); g.fill();
  // the pepa (a curved horn) raised to the lips
  g.fillStyle = '#3a2618';
  g.beginPath(); g.moveTo(-0.045 * u, -0.925 * u); g.quadraticCurveTo(-0.15 * u, -0.98 * u, -0.22 * u, -1.1 * u); g.lineTo(-0.27 * u, -1.08 * u); g.quadraticCurveTo(-0.17 * u, -0.95 * u, -0.045 * u, -0.9 * u); g.closePath(); g.fill();
  g.fillStyle = '#d9c29a'; g.beginPath(); g.ellipse(-0.245 * u, -1.09 * u, 0.028 * u, 0.012 * u, -0.4, 0, TAU); g.fill();
  limb(g, [[-0.07 * u, -0.8 * u], [-0.13 * u, -0.86 * u], [-0.12 * u, -0.96 * u]], u * 0.034, skin);
  limb(g, [[0.07 * u, -0.8 * u], [-0.02 * u, -0.86 * u], [-0.08 * u, -0.93 * u]], u * 0.034, skin);
  g.restore();
}
/** a tea picker with the conical basket on her back */
function picker(g, x, yb, H, col, flip = 1) {
  const u = H, skin = '#7a452c';
  g.save(); g.translate(x, yb); g.scale(flip, 1);
  g.fillStyle = col;                                                           // saree
  g.beginPath(); g.moveTo(-0.07 * u, -0.8 * u); g.lineTo(0.07 * u, -0.8 * u); g.lineTo(0.12 * u, 0); g.lineTo(-0.12 * u, 0); g.closePath(); g.fill();
  g.fillStyle = shade(col, -0.25); g.beginPath(); g.moveTo(-0.07 * u, -0.8 * u); g.lineTo(0.0, -0.8 * u); g.lineTo(0.1 * u, -0.25 * u); g.lineTo(0.05 * u, -0.2 * u); g.closePath(); g.fill();
  g.fillStyle = '#8a6a3a';                                                     // the basket (strap over the head)
  g.beginPath(); g.moveTo(-0.07 * u, -0.95 * u); g.lineTo(-0.3 * u, -1.0 * u); g.lineTo(-0.2 * u, -0.45 * u); g.lineTo(-0.1 * u, -0.45 * u); g.closePath(); g.fill();
  g.strokeStyle = '#5e4524'; g.lineWidth = u * 0.008;
  for (let k = 1; k < 6; k++) { const t = k / 6; g.beginPath(); g.moveTo(-0.07 * u - t * 0.03 * u, -0.95 * u + t * 0.5 * u); g.lineTo(-0.3 * u + t * 0.1 * u, -1.0 * u + t * 0.55 * u); g.stroke(); }
  g.fillStyle = skin; g.beginPath(); g.arc(0.01 * u, -0.88 * u, 0.06 * u, 0, TAU); g.fill();
  g.fillStyle = shade(col, 0.2); g.beginPath(); g.arc(0.0, -0.9 * u, 0.064 * u, Math.PI * 1.05, Math.PI * 2.05); g.fill();   // the head covered
  limb(g, [[0.05 * u, -0.72 * u], [0.16 * u, -0.6 * u], [0.24 * u, -0.56 * u]], u * 0.035, skin);
  g.restore();
}

// ------------------------------------------------------------------ animals
/** the one-horned rhino, facing left, feet at yb, body length L; flip: face right */
function rhino(g, x, yb, L, flip = false, horn = true) {
  g.save(); g.translate(x, yb - 0.62 * L); g.scale(flip ? -L : L, L);
  if (flip) g.translate(-1, 0);
  const path = () => {
    g.beginPath();
    g.moveTo(0.29, 0.13);
    g.bezierCurveTo(0.36, 0.03, 0.5, 0.0, 0.6, 0.04);
    g.bezierCurveTo(0.74, 0.02, 0.9, 0.05, 0.955, 0.2);
    g.bezierCurveTo(0.985, 0.3, 0.965, 0.4, 0.925, 0.45);
    g.lineTo(0.915, 0.6); g.quadraticCurveTo(0.885, 0.625, 0.845, 0.61); g.lineTo(0.835, 0.5);
    g.lineTo(0.8, 0.5); g.lineTo(0.795, 0.6); g.quadraticCurveTo(0.765, 0.625, 0.725, 0.61); g.lineTo(0.715, 0.48);
    g.bezierCurveTo(0.62, 0.52, 0.52, 0.52, 0.45, 0.48);
    g.lineTo(0.445, 0.6); g.quadraticCurveTo(0.415, 0.625, 0.375, 0.61); g.lineTo(0.37, 0.49);
    g.lineTo(0.345, 0.485); g.lineTo(0.335, 0.6); g.quadraticCurveTo(0.305, 0.625, 0.265, 0.61); g.lineTo(0.262, 0.44);
    g.bezierCurveTo(0.22, 0.43, 0.17, 0.44, 0.12, 0.43);
    g.bezierCurveTo(0.07, 0.425, 0.035, 0.41, 0.03, 0.37);
    g.bezierCurveTo(0.025, 0.34, 0.03, 0.32, 0.045, 0.31);
    if (horn) { g.bezierCurveTo(0.04, 0.26, 0.05, 0.21, 0.075, 0.185); g.bezierCurveTo(0.08, 0.23, 0.09, 0.27, 0.105, 0.285); }
    else g.lineTo(0.07, 0.29);
    g.bezierCurveTo(0.16, 0.24, 0.22, 0.18, 0.29, 0.13);
    g.closePath();
  };
  // shadow on the ground
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(0.58, 0.62, 0.42, 0.035, 0, 0, TAU); g.fill();
  path();
  g.fillStyle = vgrad(g, 0, 0.62, [[0, '#8c9194'], [0.55, '#6d7276'], [1, '#4f5357']]); g.fill();
  g.save(); g.clip();
  // the armour folds and the knobbly skin
  g.strokeStyle = 'rgba(40,42,46,0.75)'; g.lineWidth = 0.009; g.lineCap = 'round';
  for (const pts of [[[0.3, 0.13], [0.33, 0.28], [0.29, 0.43]], [[0.45, 0.02], [0.49, 0.25], [0.45, 0.48]], [[0.72, 0.03], [0.68, 0.25], [0.72, 0.48]], [[0.45, 0.34], [0.58, 0.37], [0.72, 0.34]], [[0.72, 0.3], [0.85, 0.33], [0.95, 0.3]]]) {
    g.beginPath(); g.moveTo(...pts[0]); g.quadraticCurveTo(...pts[1], ...pts[2]); g.stroke();
  }
  g.fillStyle = 'rgba(190,195,198,0.35)';
  for (let k = 0; k < 60; k++) { const px = 0.5 + ((k * 37) % 23) / 23 * 0.45, py = 0.05 + ((k * 53) % 31) / 31 * 0.4; g.beginPath(); g.arc(px, py, 0.006, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.13)'; g.beginPath(); g.ellipse(0.62, 0.08, 0.3, 0.05, 0, 0, TAU); g.fill();
  g.restore();
  // ears, eye, tail
  g.fillStyle = '#6d7276';
  g.beginPath(); g.ellipse(0.26, 0.1, 0.018, 0.045, -0.3, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0.29, 0.1, 0.016, 0.04, 0.2, 0, TAU); g.fill();
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(0.15, 0.275, 0.009, 0, TAU); g.fill();
  g.strokeStyle = '#4f5357'; g.lineWidth = 0.012; g.beginPath(); g.moveTo(0.955, 0.2); g.quadraticCurveTo(0.99, 0.28, 0.975, 0.36); g.stroke();
  g.restore();
}
function egret(g, x, y, s) {
  g.fillStyle = '#fbfbf7';
  g.beginPath(); g.ellipse(x, y, s * 0.5, s * 0.22, -0.2, 0, TAU); g.fill();
  g.strokeStyle = '#fbfbf7'; g.lineWidth = s * 0.1; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - s * 0.35, y - s * 0.05); g.quadraticCurveTo(x - s * 0.6, y - s * 0.3, x - s * 0.42, y - s * 0.55); g.stroke();
  g.fillStyle = '#fbfbf7'; g.beginPath(); g.arc(x - s * 0.42, y - s * 0.58, s * 0.09, 0, TAU); g.fill();
  g.strokeStyle = '#f2c230'; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(x - s * 0.48, y - s * 0.58); g.lineTo(x - s * 0.72, y - s * 0.52); g.stroke();
  g.strokeStyle = '#222'; g.lineWidth = s * 0.04; g.beginPath(); g.moveTo(x, y + s * 0.18); g.lineTo(x - s * 0.02, y + s * 0.4); g.moveTo(x + s * 0.1, y + s * 0.16); g.lineTo(x + s * 0.12, y + s * 0.4); g.stroke();
}
/** the great hornbill perched: feet at (x, y), body about s long, facing left */
function hornbill(g, x, y, s) {
  g.save(); g.translate(x, y);
  // tail: long, white with a black band
  g.save(); g.translate(0.12 * s, -0.12 * s); g.rotate(-0.75);
  g.fillStyle = '#f4f1e6'; g.beginPath(); g.moveTo(-0.08 * s, 0); g.lineTo(0.08 * s, 0); g.lineTo(0.09 * s, 0.52 * s); g.lineTo(-0.09 * s, 0.52 * s); g.closePath(); g.fill();
  g.fillStyle = '#141414'; g.fillRect(-0.085 * s, 0.22 * s, 0.17 * s, 0.11 * s);
  g.restore();
  // body and wing
  g.fillStyle = '#161616'; g.beginPath(); g.ellipse(-0.02 * s, -0.25 * s, 0.3 * s, 0.19 * s, -0.5, 0, TAU); g.fill();
  g.fillStyle = '#f0ead2'; g.beginPath(); g.ellipse(0.06 * s, -0.12 * s, 0.14 * s, 0.07 * s, -0.4, 0, TAU); g.fill();
  g.fillStyle = '#1f1f1f'; g.beginPath(); g.ellipse(0.04 * s, -0.3 * s, 0.26 * s, 0.13 * s, -0.55, 0, TAU); g.fill();
  g.fillStyle = '#efe6c2'; g.beginPath(); g.ellipse(0.02 * s, -0.3 * s, 0.2 * s, 0.035 * s, -0.55, 0, TAU); g.fill();
  // neck (yellowish white) and head
  g.fillStyle = '#efe3a8'; g.beginPath(); g.moveTo(-0.2 * s, -0.36 * s); g.quadraticCurveTo(-0.34 * s, -0.46 * s, -0.3 * s, -0.62 * s); g.lineTo(-0.18 * s, -0.6 * s); g.quadraticCurveTo(-0.2 * s, -0.46 * s, -0.08 * s, -0.4 * s); g.closePath(); g.fill();
  g.fillStyle = '#161616'; g.beginPath(); g.arc(-0.26 * s, -0.64 * s, 0.075 * s, 0, TAU); g.fill();
  g.fillStyle = '#d23a1e'; g.beginPath(); g.arc(-0.28 * s, -0.655 * s, 0.014 * s, 0, TAU); g.fill();
  // the huge bill and the casque on top of it
  g.fillStyle = '#f2bf2a';
  g.beginPath(); g.moveTo(-0.31 * s, -0.68 * s); g.quadraticCurveTo(-0.52 * s, -0.66 * s, -0.7 * s, -0.5 * s); g.quadraticCurveTo(-0.52 * s, -0.6 * s, -0.31 * s, -0.6 * s); g.closePath(); g.fill();
  g.fillStyle = '#e8692a'; g.beginPath(); g.moveTo(-0.62 * s, -0.56 * s); g.quadraticCurveTo(-0.66 * s, -0.54 * s, -0.7 * s, -0.5 * s); g.quadraticCurveTo(-0.64 * s, -0.55 * s, -0.6 * s, -0.555 * s); g.closePath(); g.fill();
  g.fillStyle = '#f6cf3a';
  g.beginPath(); g.moveTo(-0.3 * s, -0.69 * s); g.quadraticCurveTo(-0.34 * s, -0.78 * s, -0.46 * s, -0.77 * s); g.lineTo(-0.56 * s, -0.7 * s); g.quadraticCurveTo(-0.44 * s, -0.69 * s, -0.31 * s, -0.66 * s); g.closePath(); g.fill();
  g.strokeStyle = '#161616'; g.lineWidth = 0.012 * s; g.beginPath(); g.moveTo(-0.46 * s, -0.77 * s); g.lineTo(-0.56 * s, -0.7 * s); g.stroke();
  // feet on the branch
  limb(g, [[-0.04 * s, -0.08 * s], [-0.05 * s, 0]], 0.03 * s, '#3a3a3a');
  limb(g, [[0.04 * s, -0.08 * s], [0.04 * s, 0]], 0.03 * s, '#3a3a3a');
  g.restore();
}

// ------------------------------------------------------------------ the scenes
export function sunsetRiver(g, w, h, r) {
  const hz = h * 0.6;
  fillSky(g, w, hz, [[0, '#241a4d'], [0.35, '#6a2c6b'], [0.62, '#d8545a'], [0.84, '#f39a4c'], [1, '#fcd476']]);
  g.globalAlpha = 0.35;
  for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f6a36b' : '#b34d73'; g.beginPath(); g.ellipse(r() * w, hz * (0.2 + r() * 0.5), 90 + r() * 170, 6 + r() * 9, 0, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  const sx = w * (0.55 + r() * 0.2), sy = hz - h * 0.075;
  sun(g, sx, sy, h * 0.07, '#fff1b8', 'rgba(255,214,120,0.9)');
  fillRidge(g, w, hz - h * 0.015, ridgeFn(w, h * 0.06, r, 1.4), '#8a3f6e', hz + 2);
  fillRidge(g, w, hz + 1, ridgeFn(w, h * 0.025, r, 3), '#5d2a58', hz + 4);
  // areca palms and a village on the far bank
  for (let k = 0; k < 9; k++) tree(g, w * (0.02 + r() * 0.3), hz + 3, h * (0.08 + r() * 0.06), '#4a1f47', r, 'areca');
  g.fillStyle = vgrad(g, hz, h, [[0, '#f09a5a'], [0.25, '#c65a62'], [0.7, '#5a2a57'], [1, '#2a1838']]); g.fillRect(0, hz + 3, w, h - hz);
  for (let k = 0; k < 46; k++) {
    const t = k / 46, y = hz + 6 + t * t * (h - hz) * 0.95, len = (16 + r() * 60) * (1 + t * 2.5), off = (r() - 0.5) * (26 + t * 170);
    g.fillStyle = `rgba(255,${205 + Math.floor(r() * 45)},${120 + Math.floor(r() * 70)},${0.75 - t * 0.45})`;
    g.fillRect(sx + off - len / 2, y, len, 2 + t * 5);
  }
  g.strokeStyle = 'rgba(255,190,140,0.16)'; g.lineWidth = 2;
  for (let k = 0; k < 40; k++) { const y = hz + 12 + r() * (h - hz - 12), x = r() * w, L = 20 + r() * 70; g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y); g.stroke(); }
  // a country boat, a boatman poling it, and its reflection
  const bx = w * (0.22 + r() * 0.12), by = hz + (h - hz) * 0.45, L = w * 0.26;
  g.save(); g.translate(0, by * 2); g.scale(1, -1); g.globalAlpha = 0.22; boat(g, bx, by, L, '#1a0f22'); g.restore();
  boat(g, bx, by, L, '#1a0f22');
  birds(g, r, 9, w * 0.08, hz * 0.2, w * 0.5, hz * 0.55, 'rgba(35,18,45,0.85)');
  blades(g, r, 70, -10, w * 0.14, h + 4, h * 0.08, h * 0.26, ['#1d1022', '#2a1530', '#351a3a'], 3);
  blades(g, r, 50, w * 0.9, w + 10, h + 4, h * 0.06, h * 0.2, ['#1d1022', '#2a1530'], 3);
  caption(g, 'BRAHMAPUTRA', w - 34, h - 34, h * 0.075, '#ffe2a6');
  caption(g, 'ব্ৰহ্মপুত্ৰ', w - 36, h - 34 - h * 0.08, h * 0.05, '#ffd48a', { font: ASM });
  finish(g, w, h, r, '#2a1530');
}
function boat(g, x, y, L, col) {
  g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - L / 2, y - L * 0.07);
  g.quadraticCurveTo(x, y + L * 0.09, x + L / 2, y - L * 0.08);
  g.quadraticCurveTo(x, y + L * 0.025, x - L / 2, y - L * 0.07); g.fill();
  g.beginPath(); g.moveTo(x - L * 0.17, y); g.quadraticCurveTo(x - L * 0.03, y - L * 0.17, x + L * 0.14, y + L * 0.005); g.closePath(); g.fill();
  const px = x + L * 0.32, py = y - L * 0.035;
  g.beginPath(); g.arc(px, py - L * 0.165, L * 0.022, 0, TAU); g.fill();
  g.lineWidth = L * 0.03; g.beginPath(); g.moveTo(px, py - L * 0.14); g.lineTo(px - L * 0.008, py - L * 0.055); g.stroke();
  g.lineWidth = L * 0.017; g.beginPath(); g.moveTo(px - L * 0.008, py - L * 0.055); g.lineTo(px - L * 0.03, py); g.moveTo(px - L * 0.008, py - L * 0.055); g.lineTo(px + L * 0.02, py); g.stroke();
  g.beginPath(); g.moveTo(px, py - L * 0.125); g.lineTo(px - L * 0.055, py - L * 0.09); g.stroke();
  g.lineWidth = L * 0.007; g.beginPath(); g.moveTo(px - L * 0.13, py - L * 0.28); g.lineTo(px + L * 0.03, py + L * 0.14); g.stroke();
}

export function kaziranga(g, w, h, r) {
  const hz = h * 0.47;
  fillSky(g, w, hz + 10, [[0, '#8ac6e4'], [0.7, '#d6ebee'], [1, '#f3ecd0']]);
  for (let k = 0; k < 6; k++) cloud(g, r() * w, hz * (0.15 + r() * 0.4), 70 + r() * 90, 'rgba(255,255,255,0.85)', r);
  fillRidge(g, w, hz - h * 0.04, ridgeFn(w, h * 0.07, r, 1.2), '#90abc4', hz + 5);
  fillRidge(g, w, hz, ridgeFn(w, h * 0.03, r, 2.2), '#7c9d8e', hz + 8);
  for (let k = 0; k < 8; k++) tree(g, r() * w, hz + 5, h * (0.07 + r() * 0.07), '#4a6a4c', r, 'flat');
  const bands = [['#c8c67a', hz + 3], ['#b3b862', hz + h * 0.09], ['#99a94f', hz + h * 0.19], ['#809744', hz + h * 0.31], ['#6c8639', hz + h * 0.43]];
  for (const [c, y] of bands) { fillRidge(g, w, y, ridgeFn(w, h * 0.012, r, 4), c, h + 4); blades(g, r, 150, 0, w, y + 8, h * 0.02, h * 0.055, [shade(c, -0.15), shade(c, 0.12)], 2); }
  // a beel (wetland) catching the sky
  g.fillStyle = vgrad(g, h * 0.74, h * 0.9, [[0, '#a9d4e6'], [1, '#6fa9c4']]);
  g.beginPath(); g.ellipse(w * 0.2, h * 0.82, w * 0.2, h * 0.055, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  for (let k = 0; k < 10; k++) { const y = h * (0.79 + r() * 0.06), x = w * (0.06 + r() * 0.26); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + r() * 40, y); g.stroke(); }
  // mother and calf
  const L = w * 0.4, fx = w * (0.4 + r() * 0.08), fy = h * 0.86;
  rhino(g, fx + L * 0.75, fy - h * 0.06, L * 0.42, false, false);
  rhino(g, fx, fy, L, false, true);
  egret(g, fx + L * 0.62, fy - L * 0.62, L * 0.09);
  blades(g, r, 120, fx - L * 0.1, fx + L * 1.1, fy + 6, h * 0.02, h * 0.07, ['#6c8639', '#89a54a', '#5c7a30'], 2.5);
  blades(g, r, 70, 0, w, h + 4, h * 0.05, h * 0.13, ['#4f6f2a', '#6c8639'], 3);
  birds(g, r, 6, w * 0.5, hz * 0.2, w * 0.9, hz * 0.5, 'rgba(40,50,60,0.7)');
  caption(g, 'KAZIRANGA', w - 34, h * 0.14, h * 0.08, '#2f4a2a', { shadow: 'rgba(255,255,255,0.5)' });
  caption(g, 'কাজিৰঙা', w - 36, h * 0.14 + h * 0.065, h * 0.05, '#2f4a2a', { font: ASM, shadow: null });
  finish(g, w, h, r, '#3a4a2a');
}

export function teaGarden(g, w, h, r) {
  fillSky(g, w, h * 0.45, [[0, '#bcdcec'], [0.65, '#e8f0e0'], [1, '#f7efd8']]);
  sun(g, w * 0.82, h * 0.12, h * 0.045, '#fffbe8', 'rgba(255,245,200,0.7)');
  fillRidge(g, w, h * 0.3, ridgeFn(w, h * 0.06, r, 1.3), '#a8c0b8', h * 0.5);
  fillRidge(g, w, h * 0.36, ridgeFn(w, h * 0.05, r, 1.8), '#8faf9d', h * 0.55);
  g.fillStyle = vgrad(g, h * 0.3, h * 0.46, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.55)']]); g.fillRect(0, h * 0.3, w, h * 0.16);
  const slopes = [
    { y: h * 0.46, amp: h * 0.05, base: '#5b9142', row: '#73ab50', gap: '#3f6c30', n: 7 },
    { y: h * 0.62, amp: h * 0.045, base: '#4f8a3a', row: '#6aa648', gap: '#35602a', n: 7 },
    { y: h * 0.79, amp: h * 0.04, base: '#447e32', row: '#5f9c40', gap: '#2d5424', n: 6 },
  ];
  const pickers = [];
  slopes.forEach((s, si) => {
    const fn = ridgeFn(w, s.amp, r, 1.1);
    fillRidge(g, w, s.y, fn, s.base, h + 4);
    const gap = (h * 0.022) * (1 + si * 0.35);
    for (let k = 0; k < s.n * 2; k++) {
      const yy = s.y + gap * 0.7 + k * gap;
      if (yy > h + gap) break;
      const rad = gap * 0.62;
      g.fillStyle = s.gap; g.fillRect(0, yy - fn(w / 2) * 0 - 1, 0, 0);
      for (let x = -rad; x < w + rad; x += rad * 1.35) {
        const yv = yy - fn(x) * (1 - k * 0.04);
        g.fillStyle = s.gap; g.beginPath(); g.ellipse(x, yv + rad * 0.35, rad * 0.8, rad * 0.45, 0, 0, TAU); g.fill();
        g.fillStyle = (Math.floor(x / rad) + k) % 3 ? s.row : shade(s.row, 0.1);
        g.beginPath(); g.ellipse(x, yv, rad * 0.78, rad * 0.55, 0, Math.PI, TAU); g.fill();
      }
    }
    if (si === 0) for (let k = 0; k < 6; k++) { const x = r() * w; tree(g, x, s.y - fn(x) + h * 0.02, h * (0.2 + r() * 0.06), '#35592f', r, 'shade'); }
    if (si === 1) for (let k = 0; k < 3; k++) pickers.push([w * (0.15 + k * 0.22 + r() * 0.08), s.y - fn(w * (0.15 + k * 0.22)) + h * 0.09, h * 0.2]);
  });
  const sarees = ['#d8325a', '#f2b12e', '#7b3fb0', '#e8672a'];
  pickers.forEach(([x, y, H], k) => picker(g, x, y, H, sarees[k % 4], k % 2 ? -1 : 1));
  birds(g, r, 5, w * 0.1, h * 0.05, w * 0.5, h * 0.2, 'rgba(60,70,80,0.6)');
  caption(g, 'TEA GARDENS OF ASSAM', w - 34, h - 30, h * 0.07, '#fff7d6', { shadow: 'rgba(0,0,0,0.5)' });
  caption(g, 'চাহ বাগান', w - 36, h - 30 - h * 0.075, h * 0.05, '#fff7d6', { font: ASM, shadow: 'rgba(0,0,0,0.45)' });
  finish(g, w, h, r, '#2d4a25');
}

export function bihu(g, w, h, r) {
  const cx = w / 2, cy = h * 0.58;
  const bg = g.createRadialGradient(cx, cy, 10, cx, cy, Math.hypot(w, h) * 0.6);
  bg.addColorStop(0, '#ffe08a'); bg.addColorStop(0.35, '#f6a23c'); bg.addColorStop(0.75, '#d0442a'); bg.addColorStop(1, '#8e1f22');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,240,200,0.14)';
  for (let k = 0; k < 28; k += 2) { const a0 = (k / 28) * TAU, a1 = ((k + 1) / 28) * TAU, R = Math.hypot(w, h); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); g.closePath(); g.fill(); }
  const hb = h * 0.1;
  gamosa(g, 0, 0, w, hb); gamosa(g, 0, h - hb, w, hb);
  // a stage of beaten earth and the dancers on it
  g.fillStyle = 'rgba(90,30,20,0.35)'; g.beginPath(); g.ellipse(cx, h - hb - 4, w * 0.46, h * 0.05, 0, 0, TAU); g.fill();
  const H = h * 0.6, yb = h - hb - h * 0.02;
  dancerW(g, w * 0.125, yb, H * 0.95, 0, -0.08);
  drummer(g, w * 0.29, yb, H, 0.03);
  dancerW(g, w * 0.71, yb, H * 0.95, 1, 0.07);
  piper(g, w * 0.88, yb, H * 0.98, -0.05);
  japi(g, cx, h * 0.66, h * 0.15);
  g.font = DISPLAY(h * 0.2); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.lineWidth = h * 0.018; g.strokeStyle = '#6e1518'; g.strokeText('BIHU', cx, hb + h * 0.23);
  g.fillStyle = '#fff4d6'; g.fillText('BIHU', cx, hb + h * 0.23);
  caption(g, 'ৰঙালী বিহু', cx, hb + h * 0.31, h * 0.06, '#fff4d6', { align: 'center', font: ASM, shadow: 'rgba(110,21,24,0.6)' });
  finish(g, w, h, r, '#6e1518');
}

export function hornbillForest(g, w, h, r) {
  fillSky(g, w, h, [[0, '#0e3b2c'], [0.5, '#1d6448'], [1, '#12402f']]);
  g.save(); g.globalAlpha = 0.1; g.fillStyle = '#fff6c8';
  for (let k = 0; k < 4; k++) { const x = w * (0.1 + k * 0.25 + r() * 0.1); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w * 0.08, 0); g.lineTo(x + w * 0.2, h); g.lineTo(x + w * 0.06, h); g.closePath(); g.fill(); }
  g.restore();
  // layers of leaves, dark behind, bright in front
  const leaf = (x, y, s, a, col) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.5, -s * 0.28, s, 0); g.quadraticCurveTo(s * 0.5, s * 0.28, 0, 0); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.95, 0); g.stroke(); g.restore(); };
  for (const [n, s, cols] of [[140, 60, ['#174d38', '#1b5a41', '#133f2e']], [90, 80, ['#2a7a4f', '#2f8a58', '#246b45']], [40, 100, ['#3f9a5c', '#4cab66']]]) {
    for (let k = 0; k < n; k++) { const edge = r() < 0.5; const x = edge ? (r() < 0.5 ? r() * w * 0.25 : w - r() * w * 0.25) : r() * w, y = edge ? r() * h : (r() < 0.5 ? r() * h * 0.2 : h - r() * h * 0.18); leaf(x, y, s * (0.6 + r() * 0.6), r() * TAU, cols[k % cols.length]); }
  }
  // the branch, the orchids hanging from it, the bird
  g.strokeStyle = '#5a3b22'; g.lineWidth = h * 0.045; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-10, h * 0.66); g.bezierCurveTo(w * 0.3, h * 0.58, w * 0.6, h * 0.7, w + 10, h * 0.6); g.stroke();
  g.strokeStyle = 'rgba(255,220,170,0.25)'; g.lineWidth = h * 0.01; g.beginPath(); g.moveTo(-10, h * 0.645); g.bezierCurveTo(w * 0.3, h * 0.565, w * 0.6, h * 0.685, w + 10, h * 0.585); g.stroke();
  for (let k = 0; k < 5; k++) { const t = 0.22 + k * 0.16 + r() * 0.04, x = w * t, y = h * (0.64 - Math.sin(t * Math.PI) * 0.05) + 8; kopou(g, x, y, h * (0.2 + r() * 0.1), r, (r() - 0.5) * 0.5); }
  hornbill(g, w * 0.55, h * 0.625, h * 0.55);
  butterfly(g, w * 0.2, h * 0.3, h * 0.04, '#f2a03a', r); butterfly(g, w * 0.8, h * 0.25, h * 0.035, '#6fc3e8', r);
  caption(g, 'GREAT HORNBILL', 34, h - 34, h * 0.07, '#f6e7b0', { align: 'left' });
  caption(g, 'ৰাজ ধনেশ', 36, h - 34 - h * 0.075, h * 0.05, '#f6e7b0', { align: 'left', font: ASM });
  finish(g, w, h, r, '#0c2a1f');
}

export function bridgeDusk(g, w, h, r) {
  const hz = h * 0.56;
  fillSky(g, w, hz, [[0, '#1d2250'], [0.45, '#5b3a7a'], [0.75, '#d9677a'], [1, '#f6b06a']]);
  for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`; g.fillRect(r() * w, r() * hz * 0.4, 2, 2); }
  sun(g, w * 0.78, hz - h * 0.02, h * 0.05, '#ffe2a0', 'rgba(255,180,110,0.8)');
  fillRidge(g, w, hz - h * 0.03, ridgeFn(w, h * 0.05, r, 1.5), '#3f2a55', hz + 2);
  // city lights on the far bank
  for (let k = 0; k < 90; k++) { g.fillStyle = r() < 0.7 ? 'rgba(255,214,140,0.9)' : 'rgba(255,255,255,0.8)'; g.fillRect(r() * w, hz - h * 0.02 + r() * h * 0.025, 2.5, 2.5); }
  g.fillStyle = vgrad(g, hz, h, [[0, '#e09a7a'], [0.3, '#7a4a7a'], [1, '#1c1838']]); g.fillRect(0, hz, w, h - hz);
  for (let k = 0; k < 60; k++) { const y = hz + 4 + r() * (h - hz), x = r() * w; g.fillStyle = `rgba(255,200,150,${0.1 + r() * 0.25})`; g.fillRect(x, y, 20 + r() * 60, 2); }
  // the rail-and-road bridge: truss spans on tall piers, a train crossing
  const deck = hz + h * 0.1, top = deck - h * 0.11, spans = 5, sw = w / spans, ink = '#1a1426';
  g.strokeStyle = ink; g.fillStyle = ink;
  for (let k = 0; k <= spans; k++) { const x = k * sw; g.fillRect(x - w * 0.012, deck, w * 0.024, h - deck); }
  g.fillRect(0, deck - h * 0.012, w, h * 0.024);
  g.lineWidth = h * 0.008;
  for (let k = 0; k < spans; k++) {
    const x0 = k * sw + w * 0.01, x1 = (k + 1) * sw - w * 0.01, n = 8, d = (x1 - x0) / n;
    g.beginPath(); g.moveTo(x0, deck); g.lineTo(x0 + d, top); g.lineTo(x1 - d, top); g.lineTo(x1, deck); g.stroke();
    g.beginPath(); for (let i = 1; i < n; i++) { const xa = x0 + i * d; g.moveTo(xa, deck); g.lineTo(xa, top); g.moveTo(xa, top); g.lineTo(xa + (i < n / 2 ? d : -d), deck); } g.stroke();
  }
  // the train (lit windows) inside the truss
  const tx = w * (0.18 + r() * 0.2);
  for (let k = 0; k < 7; k++) { const x = tx + k * w * 0.075; g.fillStyle = ink; g.fillRect(x, deck - h * 0.07, w * 0.07, h * 0.055); g.fillStyle = 'rgba(255,215,130,0.95)'; for (let j = 0; j < 5; j++) g.fillRect(x + w * 0.006 + j * w * 0.013, deck - h * 0.06, w * 0.008, h * 0.018); }
  // the reflection of the bridge
  g.save(); g.globalAlpha = 0.25; g.fillStyle = ink; g.fillRect(0, deck + h * 0.015, w, h * 0.01); g.restore();
  birds(g, r, 7, w * 0.1, hz * 0.25, w * 0.6, hz * 0.6, 'rgba(20,15,35,0.8)');
  caption(g, 'SARAIGHAT', 34, h - 30, h * 0.08, '#ffd9a8', { align: 'left' });
  caption(g, 'শৰাইঘাট', 36, h - 30 - h * 0.085, h * 0.05, '#ffd9a8', { align: 'left', font: ASM });
  finish(g, w, h, r, '#1a1426');
}

export function nightCampus(g, w, h, r) {
  const hz = h * 0.6;
  fillSky(g, w, hz, [[0, '#070d24'], [0.6, '#162550'], [1, '#2e3f78']]);
  // the milky way
  g.save(); g.translate(w * 0.5, hz * 0.5); g.rotate(-0.5);
  const mw = g.createLinearGradient(0, -hz * 0.25, 0, hz * 0.25); mw.addColorStop(0, 'rgba(180,190,255,0)'); mw.addColorStop(0.5, 'rgba(200,210,255,0.16)'); mw.addColorStop(1, 'rgba(180,190,255,0)');
  g.fillStyle = mw; g.fillRect(-w, -hz * 0.25, w * 2, hz * 0.5);
  for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(255,255,255,${r() * 0.5})`; g.fillRect((r() - 0.5) * w * 1.6, (r() + r() + r() - 1.5) * hz * 0.14, 1.5, 1.5); }
  g.restore();
  for (let k = 0; k < 260; k++) { const s = r() < 0.06 ? 3 : 1.6; g.fillStyle = `rgba(255,255,${220 + Math.floor(r() * 35)},${0.4 + r() * 0.6})`; g.beginPath(); g.arc(r() * w, r() * hz * 0.95, s, 0, TAU); g.fill(); }
  // crescent moon
  const mx = w * 0.8, my = hz * 0.25, mr = h * 0.06;
  g.fillStyle = 'rgba(255,248,220,0.25)'; g.beginPath(); g.arc(mx, my, mr * 1.8, 0, TAU); g.fill();
  g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
  g.fillStyle = '#122049'; g.beginPath(); g.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.9, 0, TAU); g.fill();
  fillRidge(g, w, hz - h * 0.05, ridgeFn(w, h * 0.07, r, 1.2), '#0f1733', hz + 4);
  // the hostels on the hill, windows lit
  const blocks = [];
  for (let k = 0; k < 7; k++) blocks.push([w * (0.08 + k * 0.13 + r() * 0.03), w * (0.07 + r() * 0.04), h * (0.08 + r() * 0.07)]);
  for (const [x, bw, bh] of blocks) {
    const y = hz + h * 0.01;
    g.fillStyle = '#141c3c'; g.fillRect(x, y - bh, bw, bh);
    for (let fy = 0; fy < 4; fy++) for (let fx = 0; fx < 6; fx++) if (r() < 0.55) { g.fillStyle = r() < 0.8 ? '#ffd27a' : '#cfe4ff'; g.fillRect(x + bw * (0.07 + fx * 0.155), y - bh + bh * (0.12 + fy * 0.22), bw * 0.08, bh * 0.1); }
  }
  // the lake with the lights in it
  g.fillStyle = vgrad(g, hz, h, [[0, '#1b2a55'], [1, '#070c20']]); g.fillRect(0, hz + h * 0.01, w, h - hz);
  for (const [x, bw] of blocks) for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(255,210,122,${0.15 + r() * 0.3})`; g.fillRect(x + r() * bw, hz + h * 0.03 + r() * h * 0.15, 3, 10 + r() * 30); }
  g.fillStyle = 'rgba(255,246,216,0.3)'; for (let k = 0; k < 8; k++) g.fillRect(mx - 30 + r() * 60, hz + h * 0.05 + k * h * 0.03, 30 + r() * 30, 2);
  for (let k = 0; k < 40; k++) { const x = r() * w, y = hz + h * 0.15 + r() * h * 0.22; const fg = g.createRadialGradient(x, y, 0, x, y, 10); fg.addColorStop(0, 'rgba(230,255,140,0.9)'); fg.addColorStop(1, 'rgba(230,255,140,0)'); g.fillStyle = fg; g.fillRect(x - 10, y - 10, 20, 20); }
  blades(g, r, 60, 0, w, h + 4, h * 0.04, h * 0.12, ['#060a18', '#0b1226'], 3);
  caption(g, 'NIGHTS AT IITG', w / 2, h * 0.14, h * 0.09, '#ffe7a8', { align: 'center', shadow: 'rgba(0,0,0,0.6)' });
  finish(g, w, h, r, '#070d24');
}

export function kidsWall(g, w, h, r) {
  fillSky(g, w, h, [[0, '#6ec3f2'], [0.7, '#bfe6fb'], [1, '#e8f7ff']]);
  // rainbow
  const cols = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#5e35b1'];
  cols.forEach((c, k) => { g.strokeStyle = c; g.lineWidth = h * 0.035; g.beginPath(); g.arc(w * 0.5, h * 0.85, h * (0.62 - k * 0.035), Math.PI, TAU); g.stroke(); });
  // the smiling sun
  const sx = w * 0.12, sy = h * 0.2, sr = h * 0.09;
  g.strokeStyle = '#fbc02d'; g.lineWidth = h * 0.015; g.lineCap = 'round';
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.beginPath(); g.moveTo(sx + Math.cos(a) * sr * 1.25, sy + Math.sin(a) * sr * 1.25); g.lineTo(sx + Math.cos(a) * sr * 1.7, sy + Math.sin(a) * sr * 1.7); g.stroke(); }
  g.fillStyle = '#fdd835'; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
  g.fillStyle = '#5d4037'; g.beginPath(); g.arc(sx - sr * 0.35, sy - sr * 0.15, sr * 0.1, 0, TAU); g.arc(sx + sr * 0.35, sy - sr * 0.15, sr * 0.1, 0, TAU); g.fill();
  g.strokeStyle = '#5d4037'; g.lineWidth = h * 0.008; g.beginPath(); g.arc(sx, sy + sr * 0.05, sr * 0.45, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  for (let k = 0; k < 4; k++) cloud(g, w * (0.3 + r() * 0.65), h * (0.1 + r() * 0.2), 60 + r() * 50, '#ffffff', r);
  // green hills, the school, trees
  fillRidge(g, w, h * 0.72, ridgeFn(w, h * 0.06, r, 1.4), '#7cc466', h + 4);
  fillRidge(g, w, h * 0.82, ridgeFn(w, h * 0.04, r, 2), '#5cad4c', h + 4);
  const hx = w * 0.62, hy = h * 0.8, hw = w * 0.16, hh = h * 0.16;
  g.fillStyle = '#fff3e0'; g.fillRect(hx, hy - hh, hw, hh);
  g.fillStyle = '#e53935'; g.beginPath(); g.moveTo(hx - hw * 0.08, hy - hh); g.lineTo(hx + hw / 2, hy - hh * 1.75); g.lineTo(hx + hw * 1.08, hy - hh); g.closePath(); g.fill();
  g.fillStyle = '#6d4c41'; g.fillRect(hx + hw * 0.42, hy - hh * 0.55, hw * 0.16, hh * 0.55);
  g.fillStyle = '#4fc3f7'; g.fillRect(hx + hw * 0.1, hy - hh * 0.75, hw * 0.2, hh * 0.25); g.fillRect(hx + hw * 0.7, hy - hh * 0.75, hw * 0.2, hh * 0.25);
  for (const x of [0.08, 0.3, 0.9]) tree(g, w * x, h * 0.86, h * 0.3, '#2e7d32', r, 'round');
  // children flying kites
  const kid = (x, y, s, shirt) => {
    g.fillStyle = '#8d5a3b'; g.beginPath(); g.arc(x, y - s * 0.85, s * 0.12, 0, TAU); g.fill();
    g.fillStyle = shirt; g.fillRect(x - s * 0.12, y - s * 0.72, s * 0.24, s * 0.36);
    limb(g, [[x - s * 0.06, y - s * 0.36], [x - s * 0.1, y]], s * 0.08, '#37474f'); limb(g, [[x + s * 0.06, y - s * 0.36], [x + s * 0.1, y]], s * 0.08, '#37474f');
    limb(g, [[x + s * 0.1, y - s * 0.66], [x + s * 0.28, y - s * 0.9]], s * 0.07, '#8d5a3b');
    return [x + s * 0.28, y - s * 0.9];
  };
  for (const [x, c, kc] of [[0.4, '#fb8c00', '#e53935'], [0.52, '#1e88e5', '#fdd835']]) {
    const [hx2, hy2] = kid(w * x, h * 0.92, h * 0.22, c);
    const kx = hx2 + w * 0.08 + r() * w * 0.06, ky = h * (0.2 + r() * 0.1);
    g.strokeStyle = 'rgba(60,60,60,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx2, hy2); g.quadraticCurveTo(hx2 + (kx - hx2) * 0.3, hy2 - (hy2 - ky) * 0.2, kx, ky); g.stroke();
    g.fillStyle = kc; g.beginPath(); g.moveTo(kx, ky - h * 0.05); g.lineTo(kx + h * 0.035, ky); g.lineTo(kx, ky + h * 0.05); g.lineTo(kx - h * 0.035, ky); g.closePath(); g.fill();
  }
  for (let k = 0; k < 26; k++) { const x = r() * w, y = h * (0.9 + r() * 0.08); g.fillStyle = ['#e53935', '#fdd835', '#ab47bc', '#ffffff'][k % 4]; for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 0, TAU); g.fill(); } g.fillStyle = '#fbc02d'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
  // playful title
  const t = 'READ · PLAY · GROW';
  g.font = DISPLAY(h * 0.12); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  let x = w / 2 - g.measureText(t).width / 2;
  for (const [i, ch] of [...t].entries()) { g.fillStyle = cols[i % cols.length]; g.strokeStyle = '#ffffff'; g.lineWidth = h * 0.012; g.strokeText(ch, x, h * 0.46); g.fillText(ch, x, h * 0.46); x += g.measureText(ch).width; }
  finish(g, w, h, r, '#1e88e5');
}

export function japiWall(g, w, h, r) {
  g.fillStyle = '#f3e7cc'; g.fillRect(0, 0, w, h);
  const hb = h * 0.14;
  gamosa(g, 0, 0, w, hb); gamosa(g, 0, h - hb, w, hb);
  const R = (h - hb * 2) * 0.4;
  japi(g, w / 2, h / 2, R);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) kopou(g, w / 2 + s * (R + w * (0.07 + k * 0.1)), hb + 4, (h - hb * 2) * (0.72 - k * 0.12), r, 0.12);
    butterfly(g, w / 2 + s * (R + w * 0.33), h * 0.38 + r() * h * 0.2, h * 0.05, s > 0 ? '#e8672a' : '#2f7ab9', r);
  }
  finish(g, w, h, r, '#8a2a20', 8);
}

export function kopouWall(g, w, h, r) {
  fillSky(g, w, h, [[0, '#1f5f5b'], [1, '#2f8f7a']]);
  g.strokeStyle = '#4a3a22'; g.lineWidth = h * 0.05; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-10, h * 0.12); g.bezierCurveTo(w * 0.3, h * 0.2, w * 0.6, h * 0.05, w + 10, h * 0.15); g.stroke();
  for (let k = 0; k < 14; k++) { const x = w * (0.04 + r() * 0.92); g.save(); g.translate(x, h * 0.14); g.rotate(r() * 1.2 - 0.6); g.fillStyle = k % 2 ? '#3c8a4a' : '#4fa35a'; g.beginPath(); g.ellipse(0, h * 0.14, h * 0.04, h * 0.16, 0, 0, TAU); g.fill(); g.restore(); }
  for (let k = 0; k < 7; k++) kopou(g, w * (0.07 + k * 0.14 + r() * 0.04), h * 0.16, h * (0.5 + r() * 0.25), r, (r() - 0.5) * 0.5);
  for (let k = 0; k < 4; k++) butterfly(g, r() * w, h * (0.4 + r() * 0.5), h * 0.06, ['#f2a03a', '#f4e04d', '#ffffff', '#e86a9a'][k], r);
  finish(g, w, h, r, '#123f3b', 8);
}

export function lotusPond(g, w, h, r) {
  fillSky(g, w, h, [[0, '#4ea0c4'], [1, '#1f5f86']]);
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2;
  for (let k = 0; k < 16; k++) { const x = r() * w, y = r() * h, R = 20 + r() * 60; g.beginPath(); g.ellipse(x, y, R, R * 0.35, 0, 0, TAU); g.stroke(); }
  for (let k = 0; k < 5; k++) { const x = r() * w, y = r() * h, s = h * 0.06; g.fillStyle = '#f08a2e'; g.beginPath(); g.ellipse(x, y, s, s * 0.4, 0.3, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x - s * 0.9, y - s * 0.3); g.lineTo(x - s * 1.4, y - s * 0.6); g.lineTo(x - s * 1.4, y + s * 0.2); g.closePath(); g.fill(); }
  for (let k = 0; k < 14; k++) { const x = r() * w, y = h * (0.3 + r() * 0.7), R = h * (0.07 + r() * 0.07), a = r() * TAU; g.fillStyle = k % 2 ? '#3f8f45' : '#57a84f'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, R, a + 0.25, a + TAU - 0.25); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,60,20,0.35)'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 8; i++) { const b = a + 0.25 + (i / 8) * (TAU - 0.5); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * R * 0.9, y + Math.sin(b) * R * 0.9); } g.stroke(); }
  for (let k = 0; k < 6; k++) {
    const x = w * (0.08 + k * 0.17 + r() * 0.05), y = h * (0.35 + r() * 0.45), s = h * (0.1 + r() * 0.05);
    for (let p = 0; p < 7; p++) { const a = -Math.PI / 2 + (p - 3) * 0.38; g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.fillStyle = p % 2 ? '#f48fb1' : '#f06292'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.38, -s * 0.6, 0, -s * 1.05); g.quadraticCurveTo(-s * 0.38, -s * 0.6, 0, 0); g.fill(); g.restore(); }
    g.fillStyle = '#fdd835'; g.beginPath(); g.arc(x, y - s * 0.12, s * 0.12, 0, TAU); g.fill();
  }
  finish(g, w, h, r, '#12405c', 8);
}

export function musicWall(g, w, h, r) {
  fillSky(g, w, h, [[0, '#1a0b33'], [1, '#3a0f4f']]);
  // equaliser bars and neon sound waves
  for (let k = 0; k < 40; k++) { const bh = h * (0.1 + r() * 0.45), x = (k / 40) * w; g.fillStyle = `hsla(${280 + k * 3}, 90%, 60%, 0.35)`; g.fillRect(x + 3, h - bh, w / 40 - 6, bh); }
  for (const [c, a, f] of [['#ff4fd8', 0.08, 3], ['#4fe3ff', 0.06, 5], ['#ffe14f', 0.05, 7]]) { g.strokeStyle = c; g.lineWidth = 4; g.shadowColor = c; g.shadowBlur = 12; g.beginPath(); for (let x = 0; x <= w; x += 6) { const y = h * 0.5 + Math.sin((x / w) * TAU * f) * h * a * (1 + Math.sin(x / 90)); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  g.shadowBlur = 0;
  // a guitar
  g.save(); g.translate(w * 0.22, h * 0.55); g.rotate(-0.6);
  const s = h * 0.5;
  g.fillStyle = '#f08a2e'; g.beginPath(); g.ellipse(0, s * 0.25, s * 0.28, s * 0.3, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(0, -s * 0.12, s * 0.21, s * 0.22, 0, 0, TAU); g.fill();
  g.fillStyle = '#1a0b33'; g.beginPath(); g.arc(0, s * 0.05, s * 0.08, 0, TAU); g.fill();
  g.fillStyle = '#5a3218'; g.fillRect(-s * 0.035, -s * 0.9, s * 0.07, s * 0.85); g.fillRect(-s * 0.06, -s * 1.02, s * 0.12, s * 0.14);
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * s * 0.012, -s * 0.95); g.lineTo(k * s * 0.012, s * 0.35); g.stroke(); }
  g.restore();
  // notes and dancers
  g.fillStyle = '#ffe14f';
  for (let k = 0; k < 9; k++) { const x = w * (0.35 + r() * 0.6), y = h * (0.12 + r() * 0.3), s2 = h * 0.03; g.beginPath(); g.ellipse(x, y, s2, s2 * 0.7, -0.4, 0, TAU); g.fill(); g.fillRect(x + s2 * 0.75, y - s2 * 3, s2 * 0.22, s2 * 3); }
  dancerW(g, w * 0.55, h * 0.95, h * 0.55, 0, -0.1);
  drummer(g, w * 0.72, h * 0.95, h * 0.58, 0.04);
  dancerW(g, w * 0.88, h * 0.95, h * 0.55, 1, 0.08);
  caption(g, 'MUSIC · DANCE · DRAMA', w * 0.62, h * 0.18, h * 0.1, '#ffffff', { align: 'center', shadow: 'rgba(255,79,216,0.7)' });
  finish(g, w, h, r, '#12071f');
}

export function sportsWall(g, w, h, r) {
  g.fillStyle = '#12355b'; g.fillRect(0, 0, w, h);
  const stripes = ['#1f5f9f', '#f2b12e', '#e8492f', '#2fa06a'];
  stripes.forEach((c, k) => { g.fillStyle = c; g.beginPath(); const x = w * (0.1 + k * 0.22); g.moveTo(x, h); g.lineTo(x + w * 0.12, h); g.lineTo(x + w * 0.35, 0); g.lineTo(x + w * 0.23, 0); g.closePath(); g.fill(); });
  const ink = '#0c1a2a', athlete = (x, y, s, pose) => {
    g.save(); g.translate(x, y);
    g.fillStyle = ink; g.beginPath(); g.arc(pose.head[0] * s, pose.head[1] * s, s * 0.09, 0, TAU); g.fill();
    for (const L of pose.limbs) limb(g, L.map(([a, b]) => [a * s, b * s]), s * 0.08, ink);
    if (pose.ball) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(pose.ball[0] * s, pose.ball[1] * s, s * 0.07, 0, TAU); g.fill(); }
    if (pose.bat) limb(g, pose.bat.map(([a, b]) => [a * s, b * s]), s * 0.05, '#e8d9b0');
    g.restore();
  };
  const s = h * 0.55, y = h * 0.95;
  athlete(w * 0.14, y, s, { head: [0.1, -0.92], limbs: [[[0.05, -0.8], [0, -0.5]], [[0, -0.5], [0.2, -0.3], [0.1, 0]], [[0, -0.5], [-0.2, -0.3], [-0.35, -0.35]], [[0.04, -0.75], [0.22, -0.62], [0.3, -0.75]], [[0.04, -0.75], [-0.15, -0.65], [-0.25, -0.5]]] });
  athlete(w * 0.38, y, s, { head: [0, -0.93], limbs: [[[0, -0.8], [0, -0.5]], [[0, -0.5], [-0.05, -0.25], [0, 0]], [[0, -0.5], [0.2, -0.35], [0.35, -0.42]], [[0, -0.75], [-0.2, -0.7], [-0.3, -0.8]], [[0, -0.75], [0.18, -0.7], [0.25, -0.6]]], ball: [0.45, -0.4] });
  athlete(w * 0.62, y, s, { head: [-0.02, -0.92], limbs: [[[0, -0.8], [0.02, -0.5]], [[0.02, -0.5], [-0.12, -0.25], [-0.15, 0]], [[0.02, -0.5], [0.15, -0.25], [0.2, 0]], [[0, -0.74], [0.12, -0.62], [0.05, -0.55]], [[0, -0.74], [0.1, -0.66], [0.02, -0.56]]], bat: [[0.04, -0.56], [-0.3, -0.95]] });
  athlete(w * 0.85, y, s, { head: [0, -0.95], limbs: [[[0, -0.82], [0, -0.5]], [[0, -0.5], [-0.12, -0.2], [-0.1, 0]], [[0, -0.5], [0.12, -0.25], [0.25, -0.1]], [[0, -0.77], [0.15, -0.9], [0.2, -1.1]], [[0, -0.77], [-0.18, -0.7], [-0.25, -0.55]]], ball: [0.24, -1.2] });
  caption(g, 'PLAY · SWEAT · WIN', w / 2, h * 0.2, h * 0.14, '#ffffff', { align: 'center', shadow: 'rgba(0,0,0,0.55)' });
  finish(g, w, h, r, '#0c1a2a');
}

export function foodWall(g, w, h, r) {
  fillSky(g, w, h, [[0, '#ffcf5a'], [1, '#f39a2e']]);
  g.fillStyle = 'rgba(255,255,255,0.14)'; for (let k = 0; k < 30; k++) { g.beginPath(); g.arc(r() * w, r() * h, 8 + r() * 30, 0, TAU); g.fill(); }
  // a glass of chai with steam
  const cx = w * 0.18, cy = h * 0.72, s = h * 0.38;
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6; g.lineCap = 'round';
  for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(cx + k * s * 0.12, cy - s * 0.62); g.bezierCurveTo(cx + k * s * 0.12 - s * 0.1, cy - s * 0.8, cx + k * s * 0.12 + s * 0.1, cy - s * 0.95, cx + k * s * 0.12, cy - s * 1.12); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(cx - s * 0.25, cy - s * 0.55); g.lineTo(cx + s * 0.25, cy - s * 0.55); g.lineTo(cx + s * 0.19, cy + s * 0.2); g.lineTo(cx - s * 0.19, cy + s * 0.2); g.closePath(); g.fill();
  g.fillStyle = '#b86a2e'; g.beginPath(); g.moveTo(cx - s * 0.23, cy - s * 0.42); g.lineTo(cx + s * 0.23, cy - s * 0.42); g.lineTo(cx + s * 0.18, cy + s * 0.17); g.lineTo(cx - s * 0.18, cy + s * 0.17); g.closePath(); g.fill();
  // a bowl of noodles
  const bx = w * 0.5, by = h * 0.8, bs = h * 0.3;
  g.strokeStyle = '#f7d774'; g.lineWidth = 5;
  for (let k = 0; k < 9; k++) { g.beginPath(); for (let x = -bs * 0.8; x <= bs * 0.8; x += 8) { const y = by - bs * 0.2 - k * 3 + Math.sin(x / 9 + k) * 6; x > -bs * 0.8 ? g.lineTo(bx + x, y) : g.moveTo(bx + x, y); } g.stroke(); }
  g.fillStyle = '#d6392f'; g.beginPath(); g.moveTo(bx - bs, by - bs * 0.2); g.quadraticCurveTo(bx, by + bs * 0.9, bx + bs, by - bs * 0.2); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.fillRect(bx - bs * 0.6, by + bs * 0.05, bs * 1.2, bs * 0.06);
  // momos on a plate
  const mx = w * 0.8, my = h * 0.8, ms = h * 0.09;
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(mx, my + ms * 0.4, ms * 3, ms * 0.8, 0, 0, TAU); g.fill();
  for (const [dx, dy] of [[-1.3, 0], [0, 0.1], [1.3, 0], [-0.65, -0.8], [0.65, -0.8]]) {
    const x = mx + dx * ms, y = my + dy * ms;
    g.fillStyle = '#fbf3e4'; g.beginPath(); g.moveTo(x - ms * 0.75, y + ms * 0.3); g.quadraticCurveTo(x - ms * 0.7, y - ms * 0.6, x, y - ms * 0.75); g.quadraticCurveTo(x + ms * 0.7, y - ms * 0.6, x + ms * 0.75, y + ms * 0.3); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(160,130,90,0.6)'; g.lineWidth = 2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * ms * 0.12, y - ms * 0.7); g.lineTo(x + k * ms * 0.3, y); g.stroke(); }
  }
  caption(g, 'CHAI · NOODLES · MOMOS', w / 2, h * 0.24, h * 0.14, '#7a2a12', { align: 'center', shadow: 'rgba(255,255,255,0.5)' });
  finish(g, w, h, r, '#7a2a12');
}

// ------------------------------------------------------------------ street art (new): graffiti in several styles, a stencil rhino,
// circuit and robot walls, a skyline, and the walls whose art follows the event that is running
const SPRAY = ['#ff2e88', '#ffd400', '#00e0c6', '#7c4dff', '#ff7a00', '#2bd96b', '#18a8ff', '#ff4136'];
const BLACK = '#15151a';

/** plaster with grain, or a brick wall */
function wallBase(g, w, h, r, kind = 'plaster', col = '#e9e2d2') {
  g.fillStyle = col; g.fillRect(0, 0, w, h);
  if (kind === 'brick') {
    const bh = h / 22, bw = bh * 2.6;
    for (let y = 0, row = 0; y < h; y += bh, row++) for (let x = -((row % 2) * bw) / 2; x < w; x += bw) { g.fillStyle = shade(col, (r() - 0.5) * 0.18); g.fillRect(x + 1, y + 1, bw - 2, bh - 2); }
  } else {
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '90,80,60'},${0.03 + r() * 0.05})`; g.fillRect(r() * w, r() * h, 2 + r() * 14, 1 + r() * 3); }
  }
}
function splat(g, x, y, R, col, r) {
  g.fillStyle = col; g.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, rr = R * (0.65 + r() * 0.55); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  for (let k = 0; k < 10; k++) { const a = r() * TAU, d = R * (1.1 + r() * 1.3); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.04 + r() * 0.1), 0, TAU); g.fill(); }
}
function drip(g, x, y, len, wd, col) { g.fillStyle = col; g.fillRect(x - wd / 2, y, wd, len); g.beginPath(); g.arc(x, y + len, wd * 0.8, 0, TAU); g.fill(); }
function star4(g, x, y, R, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, rr = i % 2 ? R * 0.28 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
function crownArt(g, x, y, s, col, edge = BLACK) {
  g.fillStyle = col; g.strokeStyle = edge; g.lineWidth = s * 0.07; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * 0.95, y - s * 0.8); g.lineTo(x - s * 0.5, y - s * 0.35); g.lineTo(x, y - s); g.lineTo(x + s * 0.5, y - s * 0.35); g.lineTo(x + s * 0.95, y - s * 0.8); g.lineTo(x + s, y); g.closePath(); g.fill(); g.stroke();
  for (const dx of [-0.95, 0, 0.95]) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + dx * s, y - s * (dx ? 0.8 : 1), s * 0.1, 0, TAU); g.fill(); }
}
/** a word with an outline, a stacked 3D edge and a shadow (a "piece") */
function piece(g, text, cx, cy, fs, fill, { edge = BLACK, depth = 0.07, depthCol = '#222', lw = 0.1, shine = true, maxW = 1e9, rot = 0, font = DISPLAY } = {}) {
  g.save(); g.translate(cx, cy); g.rotate(rot); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font(fs);
  let s = fs; while (g.measureText(text).width > maxW && s > 20) { s -= 4; g.font = font(s); } fs = s;
  g.lineJoin = 'round';
  const D = Math.max(3, Math.round(fs * depth * 2));
  for (let d = D; d >= 1; d--) { g.fillStyle = depthCol; g.strokeStyle = depthCol; g.lineWidth = fs * lw; g.strokeText(text, d * 0.8, d * 0.8); g.fillText(text, d * 0.8, d * 0.8); }
  g.strokeStyle = edge; g.lineWidth = fs * lw; g.strokeText(text, 0, 0);
  g.fillStyle = fill; g.fillText(text, 0, 0);
  if (shine) { g.save(); g.globalCompositeOperation = 'source-atop'; g.restore(); g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = Math.max(2, fs * 0.022); g.strokeText(text, -fs * 0.012, -fs * 0.012); }
  g.restore();
}
function banner(g, text, cx, cy, wd, hh, col, ink = '#fff') {
  g.fillStyle = BLACK; g.beginPath(); g.moveTo(cx - wd / 2 + 4, cy - hh / 2 + 5); g.lineTo(cx + wd / 2 + 4, cy - hh / 2 + 5); g.lineTo(cx + wd / 2 + 4, cy + hh / 2 + 5); g.lineTo(cx - wd / 2 + 4, cy + hh / 2 + 5); g.fill();
  g.fillStyle = col; g.fillRect(cx - wd / 2, cy - hh / 2, wd, hh); g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = hh * 0.62; g.font = FONT(800, fs); while (g.measureText(text).width > wd - 30 && fs > 12) { fs -= 2; g.font = FONT(800, fs); } g.fillText(text, cx, cy + 2);
}
function halftone(g, w, h, col, a = 0.5, step = 22) { g.fillStyle = col; for (let y = 0; y < h; y += step) for (let x = ((y / step) % 2) * step / 2; x < w; x += step) { const s = (1 - y / h) * step * 0.45 * a + 1.5; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); } }

/** spray-painted graffiti in four styles: a bubble piece, a neon wildstyle on brick, a stencil on halftone, a wall of tags */
export function graffiti(g, w, h, r, { name = 'IITG', slogan = '', pal = SPRAY.slice(0, 4), style = null, culture = false } = {}) {
  graffitiBody(g, w, h, r, { name, slogan, pal, style });
  // the walls of a hostel carry Assam: a band of gamosa along the top and the bottom, a japi in each upper corner, a little Assamese script
  if (culture) {
    const hb = Math.max(16, h * 0.075);
    gamosa(g, 0, 0, w, hb); gamosa(g, 0, h - hb, w, hb);
    japi(g, w * 0.075, hb + h * 0.115, h * 0.1); japi(g, w * 0.925, hb + h * 0.115, h * 0.1);
    g.save(); g.fillStyle = '#c0182a'; g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(3, h * 0.012); g.font = ASM(Math.round(h * 0.13)); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText('অসম', w * 0.5, h * 0.2); g.fillText('অসম', w * 0.5, h * 0.2); g.restore();
  }
}
function graffitiBody(g, w, h, r, { name, slogan, pal, style }) {
  const st = style ?? Math.floor(r() * 4), k0 = h / 384;
  const P = [...pal, ...SPRAY.slice(0, 4)];
  if (st === 0) {
    // ---- a bubble piece on plaster: colour splashes, a fat outlined name with a highlight, a crown, stars, a banner, drips
    wallBase(g, w, h, r, 'plaster', '#efe9da');
    for (let k = 0; k < 14; k++) splat(g, r() * w, r() * h, (40 + r() * 70) * k0, P[k % P.length] + 'bb', r);
    halftone(g, w, h * 0.5, 'rgba(0,0,0,0.10)');
    for (let k = 0; k < 8; k++) star4(g, r() * w, r() * h * 0.5, (10 + r() * 22) * k0, '#ffffff');
    crownArt(g, w / 2, h * 0.2, 46 * k0, '#ffd400');
    piece(g, name, w / 2, h * 0.47, Math.min(210 * k0, ((w - 80) / Math.max(4, name.length)) * 2.0), P[1], { depthCol: '#2a2a35', lw: 0.12, maxW: w - 70, rot: -0.04 });
    if (slogan) banner(g, slogan, w / 2, h * 0.84, Math.min(w - 90, 560 * k0 + 160), 54 * k0, P[0]);
    for (let k = 0; k < 9; k++) drip(g, w * (0.12 + r() * 0.76), h * 0.62, (20 + r() * 70) * k0, (4 + r() * 3) * k0, P[k % P.length]);
  } else if (st === 1) {
    // ---- neon wildstyle on a dark brick wall: a glowing 3D name, arrows, sparks, a spray can
    wallBase(g, w, h, r, 'brick', '#3a3a44');
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 80; k++) { g.fillStyle = P[k % P.length] + '66'; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 3 * k0, 0, TAU); g.fill(); }
    g.save(); g.shadowColor = P[2]; g.shadowBlur = 38 * k0;
    piece(g, name, w / 2, h * 0.46, Math.min(200 * k0, ((w - 90) / Math.max(4, name.length)) * 1.9), '#ffffff', { edge: P[2], depthCol: P[0], depth: 0.09, lw: 0.07, maxW: w - 80, rot: 0.03 });
    g.restore();
    g.strokeStyle = P[1]; g.lineWidth = 7 * k0; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w * 0.1, h * 0.72); g.bezierCurveTo(w * 0.35, h * 0.8, w * 0.6, h * 0.66, w * 0.9, h * 0.74); g.stroke();
    g.beginPath(); g.moveTo(w * 0.9, h * 0.74); g.lineTo(w * 0.86, h * 0.68); g.moveTo(w * 0.9, h * 0.74); g.lineTo(w * 0.85, h * 0.8); g.stroke();
    star4(g, w * 0.1, h * 0.2, 26 * k0, P[1]); star4(g, w * 0.9, h * 0.22, 20 * k0, P[0]); star4(g, w * 0.82, h * 0.88, 18 * k0, P[2]);
    if (slogan) { g.fillStyle = P[1]; g.font = FONT(800, 40 * k0); g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = P[1]; g.shadowBlur = 14; g.fillText(slogan, w / 2, h * 0.88, w - 80); g.shadowBlur = 0; }
  } else if (st === 2) {
    // ---- a stencil: a halftone gradient, bold stripes, the name cut in a stencil face, a circle sun
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, P[0]); gr.addColorStop(0.55, P[1]); gr.addColorStop(1, P[2]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    halftone(g, w, h, 'rgba(255,255,255,0.35)', 0.9, 20);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < 6; k++) g.fillRect(0, h * (0.1 + k * 0.17), w, h * 0.04);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w * 0.82, h * 0.26, h * 0.17, 0, TAU); g.fill();
    g.fillStyle = BLACK; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = Math.min(215 * k0, ((w - 90) / Math.max(4, name.length)) * 2.0); g.font = `800 ${fs}px "Teko", "Hind", "Segoe UI", sans-serif`; while (g.measureText(name).width > w - 80 && fs > 30) { fs -= 4; g.font = `800 ${fs}px "Teko", "Hind", "Segoe UI", sans-serif`; }
    g.fillText(name, w / 2, h * 0.5);
    g.fillStyle = gr; for (let k = 0; k < 7; k++) g.fillRect(0, h * 0.5 - fs * 0.45 + k * fs * 0.16 + fs * 0.07, w, fs * 0.03);       // the stencil bridges: the backdrop painted back across the letters
    // (the stencil bars knock holes in everything: paint the base back under them)
    if (slogan) { g.fillStyle = BLACK; g.font = FONT(900, 38 * k0); g.fillText(slogan, w / 2, h * 0.86, w - 80); }
    for (let k = 0; k < 12; k++) drip(g, w * (0.08 + r() * 0.84), h * 0.7, (10 + r() * 40) * k0, 3 * k0, BLACK);
  } else {
    // ---- a wall of tags: overlapping signatures in many colours with one big piece in a chequered frame
    wallBase(g, w, h, r, 'plaster', '#dcd6c6');
    const tagFonts = ['Brush Script MT', 'Segoe Script', 'Comic Sans MS', 'Impact'];
    for (let k = 0; k < 16; k++) { g.save(); g.translate(r() * w, r() * h); g.rotate((r() - 0.5) * 0.9); g.fillStyle = P[k % P.length] + 'cc'; g.font = `${Math.round((40 + r() * 70) * k0)}px "${tagFonts[k % 4]}", cursive, "Hind", sans-serif`; g.textAlign = 'center'; g.fillText(['IITG', 'chai', 'cse', 'ECE', 'Q', 'Manas', 'xoxo', 'ME', 'Lohit', 'rhino', 'Dihing', 'lab', 'CL', 'bihu', 'HSS', 'EEE'][k], 0, 0); g.restore(); }
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(w * 0.1, h * 0.2, w * 0.8, h * 0.52);
    const sq = 18 * k0; for (let x = w * 0.1; x < w * 0.9; x += sq) for (const y of [h * 0.2, h * 0.72 - sq]) { g.fillStyle = (Math.round((x - w * 0.1) / sq) % 2) ? BLACK : '#ffffff'; g.fillRect(x, y, sq, sq); }
    piece(g, name, w / 2, h * 0.46, Math.min(190 * k0, ((w - 160) / Math.max(4, name.length)) * 1.9), P[0], { depthCol: P[3], depth: 0.07, maxW: w * 0.74 });
    if (slogan) { g.fillStyle = BLACK; g.font = FONT(800, 34 * k0); g.textAlign = 'center'; g.fillText(slogan, w / 2, h * 0.84, w - 90); }
  }
}

/** a low-poly rhino in flat colours over a spray backdrop */
export function streetRhino(g, w, h, r, { pal = SPRAY } = {}) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1b2a41'); gr.addColorStop(1, '#324a5f'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 9; k++) splat(g, r() * w, r() * h, (50 + r() * 90) * (h / 384), pal[k % pal.length] + '88', r);
  halftone(g, w, h, 'rgba(255,255,255,0.08)', 0.8);
  const S = Math.min(w, h * 1.7) / 130, ox = w / 2 - 56 * S, oy = h * 0.14;
  const poly = (pts, fill, edge = true) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(ox + x * S, oy + y * S) : g.moveTo(ox + x * S, oy + y * S))); g.closePath(); g.fill(); if (edge) { g.strokeStyle = 'rgba(10,10,15,0.8)'; g.lineWidth = S * 0.9; g.lineJoin = 'round'; g.stroke(); } };
  const C = [pal[0], pal[1], pal[2], pal[4], pal[6]];
  poly([[10, 22], [36, 8], [70, 10], [88, 24], [90, 46], [80, 52], [76, 40], [56, 42], [46, 52], [34, 52], [30, 40], [16, 40], [10, 32]], C[0]);
  poly([[36, 8], [70, 10], [56, 28]], C[1]); poly([[10, 22], [36, 8], [30, 30]], C[3]); poly([[56, 28], [70, 10], [88, 24], [76, 40]], C[2]); poly([[16, 40], [30, 30], [46, 52], [30, 40]], C[4]);
  poly([[88, 24], [106, 28], [114, 42], [100, 50], [90, 46]], C[1]);                        // the head
  poly([[104, 28], [110, 8], [113, 31]], '#f4f1ea');                                         // the horn
  poly([[93, 21], [96, 11], [100, 23]], C[3]);                                               // an ear
  for (const [x, y] of [[36, 50], [48, 50], [72, 50], [82, 50]]) poly([[x, y], [x + 9, y], [x + 9, y + 20], [x, y + 20]], C[(x / 12 | 0) % 5]);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ox + 102 * S, oy + 38 * S, S * 1.6, 0, TAU); g.fill(); g.fillStyle = BLACK; g.beginPath(); g.arc(ox + 102.4 * S, oy + 38 * S, S * 0.8, 0, TAU); g.fill();
  piece(g, 'RHINO', w * 0.5, h * 0.86, 90 * (h / 384), '#ffd400', { depthCol: '#7c4dff', maxW: w * 0.6 });
  for (let k = 0; k < 8; k++) drip(g, w * (0.2 + r() * 0.6), h * 0.9, (10 + r() * 40) * (h / 384), 4, pal[k % pal.length]);
}

/** neon circuit board lines on a dark wall, a chip and the word CODE */
export function circuitArt(g, w, h, r) {
  g.fillStyle = '#071a22'; g.fillRect(0, 0, w, h);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let k = 0; k < 26; k++) {
    let x = r() * w, y = r() * h; const col = ['#18e0c0', '#3a9bff', '#b06bff', '#ffd400'][k % 4];
    g.strokeStyle = col; g.lineWidth = 3 + r() * 3; g.shadowColor = col; g.shadowBlur = 10; g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { if (r() < 0.5) x += (r() - 0.5) * w * 0.3; else y += (r() - 0.5) * h * 0.4; g.lineTo(x, y); }
    g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill();
  }
  g.shadowBlur = 0;
  const cw = h * 0.46; g.fillStyle = '#10222b'; g.strokeStyle = '#18e0c0'; g.lineWidth = 5; g.fillRect(w / 2 - cw / 2, h * 0.25, cw, cw); g.strokeRect(w / 2 - cw / 2, h * 0.25, cw, cw);
  for (let k = 0; k < 9; k++) for (const s of [0, 1]) { g.fillStyle = '#c9ced4'; g.fillRect(w / 2 - cw / 2 + 12 + k * (cw - 24) / 8 - 4, h * 0.25 - 14 + s * (cw + 14), 8, 14); g.fillRect(w / 2 - cw / 2 - 14 + s * (cw + 14), h * 0.25 + 12 + k * (cw - 24) / 8 - 4, 14, 8); }
  piece(g, 'CODE', w / 2, h * 0.25 + cw / 2, cw * 0.38, '#18e0c0', { edge: '#071a22', depthCol: '#0a6a5c', maxW: cw * 0.85 });
  g.fillStyle = '#9fb8c6'; g.font = FONT(600, h * 0.06); g.textAlign = 'center'; g.fillText('while (alive) { eat(); sleep(); repeat(); }', w / 2, h * 0.94);
}

/** a friendly robot head, in panels of colour */
export function robotArt(g, w, h, r) {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ffe29a'); gr.addColorStop(1, '#ffa07a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  halftone(g, w, h, 'rgba(255,255,255,0.35)', 0.8, 18);
  const cx = w / 2, cy = h * 0.5, R = Math.min(w, h) * 0.34;
  g.strokeStyle = BLACK; g.lineWidth = R * 0.05; g.lineJoin = 'round';
  g.fillStyle = '#5ac8fa'; g.fillRect(cx - R, cy - R * 0.9, R * 2, R * 1.7); g.strokeRect(cx - R, cy - R * 0.9, R * 2, R * 1.7);
  g.fillStyle = '#ffffff'; g.fillRect(cx - R * 0.8, cy - R * 0.55, R * 1.6, R * 0.8); g.strokeRect(cx - R * 0.8, cy - R * 0.55, R * 1.6, R * 0.8);
  for (const s of [-1, 1]) { g.fillStyle = BLACK; g.beginPath(); g.arc(cx + s * R * 0.36, cy - R * 0.15, R * 0.2, 0, TAU); g.fill(); g.fillStyle = '#ffd400'; g.beginPath(); g.arc(cx + s * R * 0.4, cy - R * 0.2, R * 0.07, 0, TAU); g.fill(); }
  g.strokeStyle = BLACK; g.lineWidth = R * 0.07; g.beginPath(); g.moveTo(cx - R * 0.4, cy + R * 0.12); g.quadraticCurveTo(cx, cy + R * 0.42, cx + R * 0.4, cy + R * 0.12); g.stroke();
  g.lineWidth = R * 0.05; g.beginPath(); g.moveTo(cx, cy - R * 0.9); g.lineTo(cx, cy - R * 1.25); g.stroke(); g.fillStyle = '#ff2e88'; g.beginPath(); g.arc(cx, cy - R * 1.3, R * 0.1, 0, TAU); g.fill();
  for (const s of [-1, 1]) { g.fillStyle = '#ffd400'; g.fillRect(cx + s * R * 1.0 - (s > 0 ? 0 : R * 0.2), cy - R * 0.2, R * 0.2, R * 0.5); g.strokeRect(cx + s * R * 1.0 - (s > 0 ? 0 : R * 0.2), cy - R * 0.2, R * 0.2, R * 0.5); }
  g.fillStyle = '#ff7a00'; g.fillRect(cx - R * 0.9, cy + R * 0.8, R * 1.8, R * 0.5); g.strokeRect(cx - R * 0.9, cy + R * 0.8, R * 1.8, R * 0.5);
  piece(g, 'HELLO WORLD', cx, h * 0.9, h * 0.1, '#ffffff', { depthCol: '#7c4dff', maxW: w * 0.7 });
  for (let k = 0; k < 7; k++) star4(g, r() * w, r() * h * 0.4, (8 + r() * 14) * (h / 384), '#ffffff');
}

/** the campus skyline at sunset over the lake: hostels, the auditorium roof, trees, a reflection */
export function skylineArt(g, w, h, r) {
  fillSky(g, w, h * 0.62, [[0, '#2b1055'], [0.5, '#d1477a'], [1, '#ffb347']]);
  sun(g, w * 0.7, h * 0.5, h * 0.09, '#fff1c1', 'rgba(255,200,140,0.9)');
  g.fillStyle = '#1b1030';
  const bl = (x, bw, bh) => { g.fillRect(x, h * 0.62 - bh, bw, bh); g.fillStyle = '#ffe9a8'; for (let y = h * 0.62 - bh + 8; y < h * 0.6; y += 16) for (let xx = x + 6; xx < x + bw - 6; xx += 14) if (r() < 0.5) g.fillRect(xx, y, 5, 7); g.fillStyle = '#1b1030'; };
  let x = 0; while (x < w) { const bw = 46 + r() * 70, bh = 50 + r() * (h * 0.24); bl(x, bw, bh); x += bw + 4 + r() * 8; }
  g.beginPath(); g.moveTo(w * 0.3, h * 0.62); g.lineTo(w * 0.36, h * 0.5); g.lineTo(w * 0.46, h * 0.5); g.lineTo(w * 0.52, h * 0.62); g.fill();     // a sloping red-roofed hall
  g.fillStyle = '#1e5a6e'; g.fillRect(0, h * 0.62, w, h * 0.38);
  for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(255,200,160,${0.1 + r() * 0.3})`; g.fillRect(r() * w, h * (0.64 + r() * 0.34), 20 + r() * 80, 2 + r() * 2); }
  for (let k = 0; k < 9; k++) { const tx = w * (0.04 + k * 0.11 + r() * 0.04); g.fillStyle = '#0f2a1c'; g.beginPath(); g.arc(tx, h * 0.6, 30 + r() * 28, 0, TAU); g.fill(); }
  piece(g, 'IIT GUWAHATI', w / 2, h * 0.17, h * 0.13, '#ffffff', { edge: '#2b1055', depthCol: '#d1477a', maxW: w * 0.78 });
}

/** the wall that follows the event: Alcheringa, Techniche, AI Confluence, the cricket final, sports day, convocation, orientation, the club fair */
export function eventWall(g, w, h, r, { event = null } = {}) {
  const k0 = h / 384;
  const T = {
    alcheringa: { bg: ['#6a0dad', '#e8416f', '#ff9a3c'], word: 'ALCHERINGA', sub: 'THE CULTURAL FEST', fill: '#ffe14d', dep: '#7a1f6a' },
    techniche: { bg: ['#050b20', '#101a52', '#1f2b8a'], word: 'TECHNICHE', sub: 'THE TECHNOLOGY FEST', fill: '#8fe9ff', dep: '#2a4bff' },
    aiconf: { bg: ['#02130f', '#052e25', '#08463a'], word: 'AI CONFLUENCE', sub: 'TALKS · DEMOS · POSTERS', fill: '#9fffd0', dep: '#0c7a5a' },
    cricketfinal: { bg: ['#1c5a2c', '#2f8a3f', '#4caf50'], word: 'CRICKET FINAL', sub: 'INTER-HOSTEL · COME AND CHEER', fill: '#ffffff', dep: '#0e3d1a' },
    sportsday: { bg: ['#b23a12', '#e8681f', '#ffb347'], word: 'SPIRIT', sub: 'SPORTS DAY', fill: '#ffffff', dep: '#7a2a08' },
    convocation: { bg: ['#0b1f4a', '#14346e', '#1f4a94'], word: 'CONGRATULATIONS', sub: 'THE CLASS OF THE YEAR', fill: '#ffd966', dep: '#5a3a08' },
    orientation: { bg: ['#1b8ae0', '#4fc3f7', '#b3e5fc'], word: 'WELCOME FRESHERS', sub: 'HOME AWAY FROM HOME', fill: '#ffffff', dep: '#0b5a99' },
    clubfair: { bg: ['#e91e63', '#ff9800', '#ffeb3b'], word: 'JOIN A CLUB', sub: 'MUSIC · DANCE · CODE · ART · SPORT', fill: '#ffffff', dep: '#8a1040' },
  }[event];
  if (!T) { graffiti(g, w, h, r, { name: 'IITG', slogan: 'ONE CAMPUS ONE FAMILY', style: 1, pal: SPRAY.slice(0, 4) }); return; }
  const gr = g.createLinearGradient(0, 0, w, h); T.bg.forEach((c, i) => gr.addColorStop(i / 2, c)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  halftone(g, w, h, 'rgba(255,255,255,0.12)', 0.8, 20);
  // art of the event
  if (event === 'alcheringa') { for (let k = 0; k < 7; k++) { const x = w * (0.08 + k * 0.14), y = h * (0.12 + r() * 0.1); g.fillStyle = ['#ffe14d', '#ff4f7a', '#00e0c6', '#ffffff'][k % 4]; g.beginPath(); g.ellipse(x, y, 20 * k0, 26 * k0, 0, 0, TAU); g.fill(); g.fillStyle = BLACK; g.beginPath(); g.arc(x - 7 * k0, y - 4 * k0, 3 * k0, 0, TAU); g.arc(x + 7 * k0, y - 4 * k0, 3 * k0, 0, TAU); g.fill(); } for (let k = 0; k < 10; k++) { g.fillStyle = '#ffffff'; g.font = FONT(900, 36 * k0); g.fillText(['♪', '♫'][k % 2], w * r(), h * (0.55 + r() * 0.35)); } }
  if (event === 'techniche' || event === 'aiconf') { g.strokeStyle = event === 'aiconf' ? '#2bd99b' : '#4aa3ff'; g.lineWidth = 2.5; const nodes = Array.from({ length: 26 }, () => [r() * w, r() * h]); for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]) < w * 0.22) { g.globalAlpha = 0.5; g.beginPath(); g.moveTo(...nodes[i]); g.lineTo(...nodes[j]); g.stroke(); } g.globalAlpha = 1; for (const [x, y] of nodes) { g.fillStyle = event === 'aiconf' ? '#9fffd0' : '#8fe9ff'; g.beginPath(); g.arc(x, y, 6 * k0, 0, TAU); g.fill(); } }
  if (event === 'cricketfinal') { for (let k = 0; k < 12; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; g.fillRect(k * w / 12, 0, w / 12, h); } g.fillStyle = '#d32f2f'; g.beginPath(); g.arc(w * 0.88, h * 0.2, 34 * k0, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(w * 0.88, h * 0.2, 34 * k0, 0.4, 2.7); g.stroke(); g.fillStyle = '#c9a66b'; g.save(); g.translate(w * 0.1, h * 0.2); g.rotate(-0.5); g.fillRect(-10 * k0, -50 * k0, 20 * k0, 110 * k0); g.fillStyle = '#8a6a3a'; g.fillRect(-5 * k0, 60 * k0, 10 * k0, 40 * k0); g.restore(); }
  if (event === 'sportsday') { g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 5; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(w * 0.5, h * 1.05, w * (0.5 + k * 0.08), h * (0.5 + k * 0.1), 0, Math.PI, TAU); g.stroke(); } }
  if (event === 'convocation') { g.fillStyle = BLACK; g.beginPath(); g.moveTo(w * 0.5, h * 0.08); g.lineTo(w * 0.62, h * 0.15); g.lineTo(w * 0.5, h * 0.22); g.lineTo(w * 0.38, h * 0.15); g.closePath(); g.fill(); g.fillStyle = '#ffd966'; g.fillRect(w * 0.6, h * 0.15, 5, h * 0.1); }
  if (event === 'orientation' || event === 'clubfair') { for (let k = 0; k < 40; k++) { g.fillStyle = SPRAY[k % SPRAY.length]; g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 6); g.fillRect(-5 * k0, -2 * k0, 11 * k0, 4 * k0); g.restore(); } }
  piece(g, T.word, w / 2, h * 0.47, Math.min(200 * k0, ((w - 80) / Math.max(4, T.word.length)) * 2.1), T.fill, { depthCol: T.dep, lw: 0.1, maxW: w - 60, rot: -0.03 });
  banner(g, T.sub, w / 2, h * 0.82, Math.min(w - 80, 640 * k0 + 160), 50 * k0, 'rgba(10,10,20,0.85)', T.fill);
}

export const SCENES = { sunsetRiver, kaziranga, teaGarden, bihu, hornbillForest, bridgeDusk, nightCampus, kidsWall, japiWall, kopouWall, lotusPond, musicWall, sportsWall, foodWall, graffiti, streetRhino, circuitArt, robotArt, skylineArt, eventWall };

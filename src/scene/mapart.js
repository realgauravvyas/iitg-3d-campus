// The campus map for the "You are here" boards, drawn from the game's own world in the style of the
// institute's printed campus map: a light grey ground, dark grey roads, buildings coloured by kind
// (academic yellow, hostels lavender, residences peach, main buildings olive, the hospital red, the SAC
// tan), green hills, blue lakes and the Brahmaputra along the bottom, red gate names, the title, a north
// arrow and an INDEX. The map itself is drawn from data, not copied from any picture.
import { fitText, drawCampusCrest } from '../util.js';

const FONT = (w, px) => `${w} ${px}px "Hind", "Segoe UI", system-ui, Arial, sans-serif`;
const W_ = 2048, H_ = 1400;
const MAP = { x: 28, y: 158, w: 1350, h: 1214 };            // the map panel
const COL = { academic: '#f4b820', main: '#c5cb3f', hospital: '#d92b25', residence: '#f2a68e', hostel: '#b7a8e4', sac: '#c4b085', other: '#f29a2a', school: '#f7c948' };
const HOSTELS = new Set(['brahmaputra', 'lohit', 'dihing', 'manas', 'umiam', 'barak', 'kameng', 'gaurang', 'siang', 'kapili', 'dibang', 'disang', 'subansiri', 'dhansiri', 'msh']);

/** which colour a building gets */
function category(b) {
  const lm = b.site?.lm, k = b.kind;
  if (b.bungalow) return 'main';
  if (b.school) return 'school';
  if (lm) {
    if (HOSTELS.has(lm)) return 'hostel';
    if (['admin', 'library', 'auditorium', 'conference', 'guesthouse', 'lhc'].includes(lm)) return 'main';
    if (lm === 'hospital') return 'hospital';
    if (['sac', 'newsac', 'gym', 'pool', 'athletics', 'foodcourt'].includes(lm)) return 'sac';
    if (['academic', 'core5', 'workshop', 'tic'].includes(lm)) return 'academic';
    if (['shopping', 'transit'].includes(lm)) return 'other';
  }
  switch (k) {
    case 'hostel': return 'hostel';
    case 'academic': return 'academic';
    case 'residential': return 'residence';
    case 'hospital': return 'hospital';
    case 'guest': case 'admin': case 'auditorium': return 'main';
    case 'sports': return 'sac';
    default: return 'other';
  }
}

/** draw the map; returns { tex canvas, uv(x, z) -> [u, v] (0..1, v up) } */
export function drawCampusMap(game) {
  const W = game.world, G = game.graph;
  const c = document.createElement('canvas'); c.width = W_; c.height = H_;
  const g = fitText(c.getContext('2d'));
  const { x0, x1, z0, z1 } = W.bbox;
  const riverH = 90, pad = 34;
  const s = Math.min((MAP.w - pad * 2) / (x1 - x0), (MAP.h - riverH - pad * 2) / (z1 - z0));
  const ox = MAP.x + (MAP.w - (x1 - x0) * s) / 2, oz = MAP.y + pad + (MAP.h - riverH - pad * 2 - (z1 - z0) * s) / 2;
  const X = (x) => ox + (x - x0) * s, Z = (z) => oz + (z - z0) * s;
  const ring = (rg) => { g.beginPath(); for (let i = 0; i < rg.length; i += 2) g.lineTo(X(rg[i]), Z(rg[i + 1])); g.closePath(); };

  // ---- the sheet
  g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, W_, H_);
  g.strokeStyle = '#c9c9c4'; g.lineWidth = 3; g.strokeRect(6, 6, W_ - 12, H_ - 12);
  // header: crest, title, institute
  drawCampusCrest(g, 108, 84, 56);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#111';
  g.font = FONT(800, 86); g.fillText('CAMPUS MAP', 190, 96, 760);
  g.font = FONT(600, 34); g.fillStyle = '#333'; g.fillText('INDIAN INSTITUTE OF TECHNOLOGY GUWAHATI', 194, 138, 1160);
  // the map panel: the river along the bottom, the campus ground on grey
  g.save(); g.beginPath(); g.rect(MAP.x, MAP.y, MAP.w, MAP.h); g.clip();
  g.fillStyle = '#e4e5e6'; g.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
  const river = g.createLinearGradient(0, MAP.y + MAP.h - riverH, 0, MAP.y + MAP.h);
  river.addColorStop(0, '#8ecfe6'); river.addColorStop(1, '#5fb4d6');
  g.fillStyle = river; g.fillRect(MAP.x, MAP.y + MAP.h - riverH, MAP.w, riverH);
  g.fillStyle = '#12405c'; g.font = FONT(800, 38); g.textAlign = 'center'; g.fillText('BRAHMAPUTRA RIVER', MAP.x + MAP.w / 2, MAP.y + MAP.h - 30, MAP.w - 80);
  // the campus
  ring(W.boundary); g.fillStyle = '#efefec'; g.fill(); g.strokeStyle = '#b3b3ad'; g.lineWidth = 3; g.stroke();
  // hills and forest: green where the trees are dense
  {
    const cell = 18, nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell), grid = new Uint16Array(nx * nz), P = game.veg?.positions || [];
    for (let i = 0; i < P.length; i += 2) { const gx = Math.floor((P[i] - x0) / cell), gz = Math.floor((P[i + 1] - z0) / cell); if (gx >= 0 && gz >= 0 && gx < nx && gz < nz) grid[gz * nx + gx]++; }
    const layer = document.createElement('canvas'); layer.width = W_; layer.height = H_;
    const lg = layer.getContext('2d'); lg.fillStyle = '#4c9138';
    for (let gz = 0; gz < nz; gz++) for (let gx = 0; gx < nx; gx++) if (grid[gz * nx + gx] >= 12) { const x = x0 + (gx + 0.5) * cell, z = z0 + (gz + 0.5) * cell; if (W.waterAt(x, z)) continue; lg.beginPath(); lg.arc(X(x), Z(z), cell * s * 1.15 + 3, 0, 7); lg.fill(); }
    g.save(); ring(W.boundary); g.clip(); g.filter = 'blur(5px)'; g.globalAlpha = 0.82; g.drawImage(layer, 0, 0); g.filter = 'none'; g.restore();
  }
  // lakes
  g.fillStyle = '#8fd0e6'; g.strokeStyle = '#6cb3cf'; g.lineWidth = 2;
  for (const w of W.water) { if (w.kind === 'pool') continue; ring(w.rings[0]); g.fill(); g.stroke(); }
  // sports grounds
  for (const f of W.fields) { if (f.kind === 'park') continue; ring(f.ring); g.fillStyle = f.kind === 'athletics' || f.kind === 'cricket' || f.kind === 'soccer' ? '#d5c9a5' : '#dcdccf'; g.fill(); }
  // roads: dark grey, wider for the main ones
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const e of G.edges) {
    if (e.foot || !e.wpts?.length) continue;
    g.strokeStyle = '#66666a'; g.lineWidth = Math.max(4, e.hw * 2 * s * 1.9);
    g.beginPath(); for (const [x, z] of e.wpts) g.lineTo(X(x), Z(z)); g.stroke();
  }
  // buildings (the ones a landmark sits in take that landmark's colour)
  g.lineWidth = 1;
  const LM_CAT = { hospital: 'hospital', admin: 'main', library: 'main', auditorium: 'main', conference: 'main', guesthouse: 'main', lhc: 'main', sac: 'sac', newsac: 'sac', gym: 'sac', pool: 'sac', foodcourt: 'sac', academic: 'academic', workshop: 'academic', tic: 'academic', shopping: 'other', transit: 'other' };
  for (const l of W.landmarks) { const b = W.buildingAt(l.wx, l.wz); if (b && LM_CAT[l.id] && !b.mapCat) b.mapCat = LM_CAT[l.id]; }
  for (const b of W.buildings) {
    if (b.area < 25) continue;
    g.fillStyle = COL[b.mapCat || category(b)]; g.strokeStyle = 'rgba(60,60,60,0.35)';
    ring(b.rings[0]); g.fill(); g.stroke();
  }
  // the hospital's white cross
  { const h = W.landmark('hospital'); if (h) { const x = X(h.wx), y = Z(h.wz); g.fillStyle = '#fff'; g.fillRect(x - 3, y - 11, 6, 22); g.fillRect(x - 11, y - 3, 22, 6); } }
  // bus stops: a dark square with a white bus
  for (const b of game.busStandSpots || []) {
    const x = X(b.x), y = Z(b.z);
    g.fillStyle = '#222'; g.fillRect(x - 9, y - 9, 18, 18); g.fillStyle = '#fff'; g.fillRect(x - 6, y - 5, 12, 8); g.fillStyle = '#222'; g.fillRect(x - 5, y - 3, 10, 3); g.fillRect(x - 6, y + 4, 3, 2); g.fillRect(x + 3, y + 4, 3, 2);
  }
  g.restore();

  // ---- labels (each placed only where it does not cover another; never past the panel's edge)
  const placed = [];
  const label = (text, x, y, { size = 24, weight = 800, color = '#1a1a1a', halo = true, dy = 0 } = {}) => {
    g.font = FONT(weight, size); g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width, h = size + 4;
    let lx = Math.max(MAP.x + 8 + w / 2, Math.min(MAP.x + MAP.w - 8 - w / 2, x)), ly = Math.max(MAP.y + 8 + h / 2, Math.min(MAP.y + MAP.h - riverH - 8 - h / 2, y + dy));
    const r = [lx - w / 2, ly - h / 2, lx + w / 2, ly + h / 2];
    if (placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) return false;
    placed.push(r);
    if (halo) { g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineJoin = 'round'; g.strokeText(text, lx, ly); }
    g.fillStyle = color; g.fillText(text, lx, ly);
    return true;
  };
  const ORDER = ['auditorium', 'admin', 'library', 'lhc', 'academic', 'conference', 'hospital', 'guesthouse', 'sac', 'newsac', 'gym', 'pool', 'athletics', 'cricket', 'shopping', 'foodcourt', 'workshop', 'tic', 'viewpoint', 'lake', 'serpentine', 'transit', 'msh', 'childpark'];
  const short = (n) => n.replace(' Hostel', '').replace('Dr. Bhupen Hazarika ', '').replace(' & Conference Centre', '').replace('Administrative Building', 'Admin Building').replace('Student Activity Centre', 'SAC').replace('Technology Incubation Centre', 'Incubation Centre').replace('Lecture Hall Complex', 'Lecture Halls').replace('Athletics Track & Football Ground', 'Athletics & Football').replace('Married Scholars', 'Married Scholars');
  const lms = W.landmarks.filter((l) => !['iitg_letters', 'rhino'].includes(l.id));
  for (const id of ORDER) { const l = lms.find((q) => q.id === id); if (l) label(short(l.name), X(l.wx), Z(l.wz), { size: 25, dy: id === 'lake' || id === 'serpentine' ? 0 : -16 }); }
  for (const l of lms.filter((q) => q.kind === 'hostel' && q.id !== 'msh')) label(short(l.name), X(l.wx), Z(l.wz), { size: 23, color: '#3a2f7a', dy: -14 });
  for (const w of W.water) { if (!w.name || w.kind === 'pool') continue; let cx = 0, cz = 0; const rg = w.rings[0]; for (let i = 0; i < rg.length; i += 2) { cx += rg[i]; cz += rg[i + 1]; } cx /= rg.length / 2; cz /= rg.length / 2; label(w.name.replace(/^Lake opposite guest house$/i, 'Guest House Lake'), X(cx), Z(cz), { size: 22, weight: 700, color: '#0f4a68' }); }
  // gates, in red
  const GATE = { 'Main Gate': 'MAIN GATE', 'KV Gate': 'LOTHIA BAGHICHA GATE (KV)', 'Khokha Gate': 'KHOKHA GATE' };
  for (const gt of W.gates) {
    const name = GATE[gt.name] || (gt.closed && gt.wx > 300 && gt.wz < 0 ? 'A.S.E.B GATE' : null);
    const x = X(gt.wx), y = Z(gt.wz);
    g.fillStyle = gt.closed && !name ? '#8a8a8a' : '#c62828'; g.beginPath(); g.arc(x, y, gt.closed && !name ? 6 : 9, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
    if (name) label(name, x, y, { size: 23, color: '#c62828', dy: gt.wz > (z0 + z1) / 2 ? -26 : 28 });
  }
  // north arrow
  { const x = MAP.x + 70, y = MAP.y + MAP.h - riverH - 120; g.fillStyle = '#111'; g.font = FONT(800, 46); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', x, y - 46); g.fillRect(x - 3, y - 26, 6, 66); g.fillRect(x - 24, y, 48, 6); g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x - 11, y - 8); g.lineTo(x + 11, y - 8); g.closePath(); g.fill(); }
  // scale bar
  { const m = 200, len = m * s, x = MAP.x + MAP.w - len - 40, y = MAP.y + MAP.h - riverH - 30; g.fillStyle = '#333'; g.fillRect(x, y, len, 5); g.fillRect(x, y - 8, 3, 16); g.fillRect(x + len - 3, y - 8, 3, 16); g.font = FONT(700, 22); g.textAlign = 'center'; g.fillText(`${m} m`, x + len / 2, y - 18); }

  // ---- the INDEX (right column)
  const RX = 1408, RW = W_ - RX - 28;
  g.fillStyle = '#eeeeec'; g.fillRect(RX, MAP.y, RW, MAP.h); g.strokeStyle = '#c9c9c4'; g.lineWidth = 2; g.strokeRect(RX, MAP.y, RW, MAP.h);
  g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#111'; g.font = FONT(800, 66); g.fillText('INDEX', RX + 34, MAP.y + 62);
  const rows = [['academic', 'Academic complex and centres'], ['main', 'Main buildings'], ['hostel', 'Hostels'], ['residence', 'Residences'], ['hospital', 'Hospital'], ['sac', 'Student Activity Centre and sport'], ['school', 'Schools'], ['other', 'Shops and other buildings']];
  let y = MAP.y + 128;
  g.font = FONT(600, 27);
  for (const [k, t] of rows) { g.fillStyle = COL[k]; g.fillRect(RX + 34, y - 15, 44, 30); g.strokeStyle = 'rgba(60,60,60,0.4)'; g.lineWidth = 1; g.strokeRect(RX + 34, y - 15, 44, 30); g.fillStyle = '#222'; g.fillText(t, RX + 96, y, RW - 120); y += 52; }
  y += 6;
  const icon = (draw, t) => { draw(RX + 56, y); g.fillStyle = '#222'; g.font = FONT(600, 27); g.textAlign = 'left'; g.fillText(t, RX + 96, y, RW - 120); y += 52; };
  icon((x, yy) => { g.fillStyle = '#c62828'; g.beginPath(); g.arc(x, yy, 10, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); }, 'Entry gates');
  icon((x, yy) => { g.fillStyle = '#222'; g.fillRect(x - 12, yy - 12, 24, 24); g.fillStyle = '#fff'; g.fillRect(x - 8, yy - 6, 16, 10); }, 'Bus stops');
  icon((x, yy) => { g.fillStyle = '#66666a'; g.fillRect(x - 22, yy - 4, 44, 8); }, 'Roads');
  icon((x, yy) => { g.fillStyle = '#8fd0e6'; g.fillRect(x - 22, yy - 12, 44, 24); }, 'Lakes and water');
  icon((x, yy) => { g.fillStyle = '#4c9138'; g.fillRect(x - 22, yy - 12, 44, 24); }, 'Hills and woods');
  icon((x, yy) => { g.fillStyle = '#e53935'; g.beginPath(); g.arc(x, yy, 11, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); }, 'You are here');
  g.fillStyle = '#555'; g.font = FONT(500, 22); g.textAlign = 'left';
  const note = ['Drawn for the game from its own map data.', 'An unofficial fan project.'];
  note.forEach((t, i) => g.fillText(t, RX + 34, MAP.y + MAP.h - 60 + i * 30, RW - 60));
  return { canvas: c, uv: (x, z) => [X(x) / W_, 1 - Z(z) / H_], size: [W_, H_], panel: MAP };
}

/** the red "YOU ARE HERE" pill that sits beside the marker */
export function hereLabelCanvas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e53935'; g.beginPath(); g.roundRect ? g.roundRect(6, 14, 500, 100, 50) : g.rect(6, 14, 500, 100); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#fff'; g.font = FONT(800, 58); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('YOU ARE HERE', 256, 66, 460);
  return c;
}

// Landmarks and details from real photos of the campus: the "IITG" letters (lakefront and
// auditorium), the flag lawn, the rhino statue on the way to the Main Gate, the pollution
// meter display, the granite photo wall, the Alcheringa mural, bilingual hostel signs,
// the institute name band over the Academic Complex, KV Gate barriers.
import * as THREE from 'three';
import { mergeColored, m4, canvasTexture, mulberry32, drawIndianFlag, drawCampusCrest, fitText } from '../util.js';
import { environment } from '../life/environment.js';
import { drapedDisc } from './roundabout.js';
import { facadeOf } from './facade.js';

const HINDI_HOSTEL = { brahmaputra: 'ब्रह्मपुत्र', lohit: 'लोहित', dihing: 'दिहिंग', manas: 'मानस', umiam: 'उमियम', barak: 'बराक', kameng: 'कामेंग', gaurang: 'गौरांग', siang: 'सियांग', kapili: 'कपिली', dibang: 'दिबांग', disang: 'दिसांग', subansiri: 'सुबनसिरी', dhansiri: 'धनसिरी', msh: 'विवाहित शोधार्थी' };
const DEVA = '"Nirmala UI", "Mangal", "Noto Sans Devanagari", sans-serif';

function tex(w, h, draw) { return canvasTexture(w, h, draw, { repeat: false }); }

/** block letters I, T, G built from boxes (h tall, t thick), returns parts in local space */
function letters(word, h, t, color, x0 = 0) {
  const P = [];
  const B = (x, y, w, hh) => P.push({ geometry: new THREE.BoxGeometry(w, hh, t), color, matrix: m4(x, y + hh / 2, 0) });
  const s = h * 0.18; // stroke
  let x = x0;
  for (const ch of word) {
    if (ch === 'I') { B(x + s / 2, 0, s, h); x += s + h * 0.22; }
    else if (ch === 'T') { const w = h * 0.62; B(x + w / 2, 0, s, h); B(x + w / 2, h - s, w, s); x += w + h * 0.22; }
    else if (ch === 'G') {
      const w = h * 0.66;
      B(x + s / 2, 0, s, h); B(x + w / 2, h - s, w, s); B(x + w / 2, 0, w, s); B(x + w - s / 2, 0, s, h * 0.5); B(x + w - s * 1.3, h * 0.5 - s, s * 1.6, s);
      x += w + h * 0.22;
    }
  }
  return { P, width: x - x0 - h * 0.22 };
}

/** Where the "IITG" letter sign stands (computed before trees are planted, so the
 *  vegetation can leave it a clearing instead of growing a tree through the letters). */
export function letterSpots(W) {
  const free = (x, z) => W.insideCampus(x, z) && !W.buildingAt(x, z) && !W.waterAt(x, z);
  const out = {};
  const lake = W.water.find((w) => w.name === 'IITG lake');
  if (lake) {
    let x = -53, z = -111;                           // photo GPS (map x=-53, y=111)
    let cx = 0, cz = 0; const r = lake.rings[0]; for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; } cx /= r.length / 2; cz /= r.length / 2;
    for (let k = 0; k < 12 && !free(x, z); k++) { x += (x - cx) * 0.1; z += (z - cz) * 0.1; }
    out.lake = { x, z, yaw: Math.atan2(x - cx, z - cz) };   // letters face away from the lake (the lake is the backdrop)
  }
  return out;
}

export function buildLandmarks(game) {
  const W = game.world, graph = game.graph;
  const group = new THREE.Group();
  group.name = 'photo-landmarks';
  const parts = [];
  const glowParts = [];
  const rnd = mulberry32(31337);
  const put = (P, x, z, yaw, y = null, into = parts) => {
    const yy = y ?? W.heightAt(x, z);
    const M = m4(x, yy, z, 0, yaw, 0);
    for (const p of P) into.push({ geometry: p.geometry, color: p.color, matrix: p.matrix ? new THREE.Matrix4().multiplyMatrices(M, p.matrix) : M });
  };
  const panel = (x, y, z, w, h, yaw, map, emissive = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: 0.55, emissive: emissive ? 0xffffff : 0, emissiveMap: emissive ? map : null, emissiveIntensity: emissive, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = yaw;
    group.add(m);
    return m;
  };
  const facade = facadeOf;                                                          // (scene/facade.js) a board flat on the wall that faces the entrance, slid to fit
  const free = (x, z) => W.insideCampus(x, z) && !W.buildingAt(x, z) && !W.waterAt(x, z);
  const flower = (x, z, r, cols = ['#f28c1c', '#f6b21c', '#e2562f']) => {
    for (let k = 0; k < Math.round(r * r * 5); k++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      parts.push({ geometry: new THREE.IcosahedronGeometry(0.16 + rnd() * 0.08, 0), color: cols[Math.floor(rnd() * cols.length)], matrix: m4(px, W.heightAt(px, pz) + 0.14, pz) });
    }
  };
  const royalPalm = (x, z, s = 1) => {
    const y = W.heightAt(x, z);
    parts.push({ geometry: new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 13 * s, 8), color: '#a8a39a', matrix: m4(x, y + 6.5 * s, z) });
    parts.push({ geometry: new THREE.CylinderGeometry(0.26 * s, 0.24 * s, 1.6 * s, 8), color: '#6f8a3a', matrix: m4(x, y + 13.6 * s, z) });
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * 6.28 + rnd() * 0.3;
      const g = new THREE.BoxGeometry(0.55 * s, 0.04, 3.4 * s).translate(0, 0, 1.7 * s);
      parts.push({ geometry: g, color: k % 2 ? '#4f7d2d' : '#5a8a33', matrix: m4(x, y + 14.3 * s, z, 0.45 + rnd() * 0.35, a, 0, 1, 1, 1, 'YXZ') });
    }
  };

  // ---------------------------------------------------------------- "IITG" letters by the academic lake (GPS from a photo)
  const spots = letterSpots(W);
  {
    if (spots.lake) {
      const { x, z, yaw } = spots.lake;
      const { P, width } = letters('IITG', 3.0, 0.5, '#f4f4ef');
      const fx = Math.cos(yaw), fz = -Math.sin(yaw);
      put(P.map((p) => ({ ...p, matrix: new THREE.Matrix4().multiplyMatrices(m4(-width / 2, 0.25, 0), p.matrix) })), x, z, yaw);
      for (let k = -1; k <= 1; k += 2) flower(x + Math.sin(yaw) * 2.2 + fx * k * 2.5, z + Math.cos(yaw) * 2.2 + fz * k * 2.5, 1.6, ['#2e7d32', '#3f8f3a', '#5a9b3a']);
      // royal palms along the lakefront
      for (let k = -6; k <= 6; k++) {
        if (k === 0) continue;
        const px = x + fx * k * 9 - Math.sin(yaw) * 5, pz = z + fz * k * 9 - Math.cos(yaw) * 5;
        if (free(px, pz)) royalPalm(px, pz, 0.9 + rnd() * 0.25);
      }
      game.world.landmarks.push({ id: 'iitg_letters', name: 'IITG Photo Point (lakefront)', kind: 'nature', desc: 'The big white IITG letters with the academic lake and its royal palms behind them: everyone\'s favourite photo spot.', x, y: -z, z: W.heightAt(x, z) + 40, wx: x, wz: z, wy: W.heightAt(x, z) });
    }
  }
  // (the lakefront letters above are the only "IITG" photo point on the campus)
  const aud = W.site('auditorium');
  // ---------------------------------------------------------------- the auditorium as it really looks
  // (photos on Wikimedia Commons): cream walls with maroon bands and a big red pitched roof
  if (aud) {
    for (const b of aud.blocks) {
      const r = b.rings[0], n = r.length / 2;
      // maroon bands round the walls at each floor line, set a hand's width out from the wall
      const levels = [];
      for (let yy = b.floor0 + 3.3; yy < b.roof - 0.8; yy += 3.3) levels.push(yy);
      levels.push(b.roof - 0.35);
      let sx = 0, sz = 0; for (let k = 0; k < n; k++) { sx += r[k * 2]; sz += r[k * 2 + 1]; } sx /= n; sz /= n;
      for (let k = 0; k < n; k++) {
        const ax = r[k * 2], az = r[k * 2 + 1], bx = r[((k + 1) % n) * 2], bz = r[((k + 1) % n) * 2 + 1];
        const L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
        let nx = (bz - az) / L, nz = -(bx - ax) / L;
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        if ((mx + nx - sx) ** 2 + (mz + nz - sz) ** 2 < (mx - sx) ** 2 + (mz - sz) ** 2) { nx = -nx; nz = -nz; }
        const yaw = Math.atan2(-(bz - az), bx - ax);
        for (const yy of levels) parts.push({ geometry: new THREE.BoxGeometry(L + 0.2, yy === b.roof - 0.35 ? 0.7 : 0.45, 0.14), color: '#7a2630', matrix: m4(mx + nx * 0.08, yy, mz + nz * 0.08, 0, yaw, 0) });
      }
      // red pitched (hip) roof over the block's long axis, with an overhang
      let best = null;
      for (let k = 0; k < n; k++) {
        const ax = r[k * 2], az = r[k * 2 + 1], bx = r[((k + 1) % n) * 2], bz = r[((k + 1) % n) * 2 + 1];
        const L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L;
        let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
        for (let q = 0; q < n; q++) { const px = r[q * 2] - sx, pz = r[q * 2 + 1] - sz, u = px * ux + pz * uz, v = -px * uz + pz * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
        const A = (u1 - u0) * (v1 - v0);
        if (!best || A < best.A) best = { A, ux, uz, u0, u1, v0, v1 };
      }
      if (!best || b.area < 150) continue;
      let { ux, uz, u0, u1, v0, v1 } = best;
      if (u1 - u0 < v1 - v0) { [ux, uz] = [-uz, ux]; [u0, u1, v0, v1] = [v0, v1, -u1, -u0]; }
      const ov = 0.9; u0 -= ov; u1 += ov; v0 -= ov; v1 += ov;
      const W2 = (v1 - v0) / 2, H = Math.min(9, W2 * 0.55), vm = (v0 + v1) / 2;
      const P = (u, v, h) => [sx + ux * u - uz * v, b.roof + 0.1 + h, sz + uz * u + ux * v];
      const r0 = P(u0 + W2, vm, H), r1 = P(u1 - W2, vm, H);
      const c = [P(u0, v0, 0), P(u1, v0, 0), P(u1, v1, 0), P(u0, v1, 0)];
      const tri = [];
      const quad = (a, b2, c2, d) => tri.push(...a, ...b2, ...c2, ...a, ...c2, ...d);
      quad(c[0], c[1], r1, r0);            // long slopes
      quad(c[2], c[3], r0, r1);
      tri.push(...c[1], ...c[2], ...r1);    // hips at the ends
      tri.push(...c[3], ...c[0], ...r0);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
      g.computeVertexNormals();
      const roofMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc23b40, roughness: 0.62, metalness: 0.15, side: THREE.DoubleSide }));
      roofMesh.castShadow = true; roofMesh.receiveShadow = true; roofMesh.name = 'auditorium-roof';
      group.add(roofMesh);
      // ridge cap
      const rl = Math.hypot(r1[0] - r0[0], r1[2] - r0[2]);
      if (rl > 0.5) parts.push({ geometry: new THREE.BoxGeometry(rl, 0.18, 0.3), color: '#8e2a30', matrix: m4((r0[0] + r1[0]) / 2, H + b.roof + 0.15, (r0[2] + r1[2]) / 2, 0, Math.atan2(-(r1[2] - r0[2]), r1[0] - r0[0]), 0) });
    }
    // the name over the entrance
    const nt = tex(1024, 128, (g) => { g.fillStyle = '#7a2630'; g.fillRect(0, 0, 1024, 128); g.fillStyle = '#f4e9d4'; g.font = 'bold 58px "Hind", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DR. BHUPEN HAZARIKA AUDITORIUM', 512, 66, 960); });
    const eb = aud.blocks.reduce((a, b2) => (b2.area > a.area ? b2 : a), aud.blocks[0]);
    { const f = facade(aud, 9); panel(f.x, Math.min(eb.roof - 1.5, eb.floor0 + 6.2), f.z, 9 * f.k, 1.1 * f.k, f.yaw, nt, 0.35); }
    // the way in: a glass foyer front (three pairs of doors) under a canopy on four columns, and steps
    { const y0 = Math.max(eb.floor0, W.heightAt(aud.ex + aud.nx * 2, aud.ez + aud.nz * 2)), tx = Math.cos(aud.yaw), tz = -Math.sin(aud.yaw);
      const at = (u, d) => [aud.ex - aud.nx * 0.5 + aud.nx * d + tx * u, aud.ez - aud.nz * 0.5 + aud.nz * d + tz * u];
      const gl = tex(512, 256, (g, w, h) => {
        g.fillStyle = '#2b3f4a'; g.fillRect(0, 0, w, h);
        const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.12)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,226,170,0.35)'; g.fillRect(0, h * 0.35, w, h * 0.65);                 // the lit foyer behind
        g.fillStyle = '#20262b'; for (let k = 0; k <= 6; k++) g.fillRect((k * w) / 6 - 4, 0, 8, h); g.fillRect(0, 0, w, 10); g.fillRect(0, h * 0.33, w, 6);
        g.fillStyle = '#c9ced4'; for (let k = 0; k < 6; k++) g.fillRect((k + 0.5) * (w / 6) - 3, h * 0.6, 6, 40);   // door handles
      });
      const [gx, gz] = at(0, 0.05);
      panel(gx, y0 + 1.7, gz, 12, 3.4, aud.yaw, gl, 0.2);
      const [cx, cz] = at(0, 2.3);
      parts.push({ geometry: new THREE.BoxGeometry(14, 0.35, 4.8), color: '#efe7d8', matrix: m4(cx, y0 + 3.9, cz, 0, aud.yaw, 0) });
      parts.push({ geometry: new THREE.BoxGeometry(14.2, 0.18, 5.0), color: '#7a2630', matrix: m4(cx, y0 + 3.66, cz, 0, aud.yaw, 0) });
      for (const u of [-6.3, -2.1, 2.1, 6.3]) { const [px2, pz2] = at(u, 4.3); parts.push({ geometry: new THREE.CylinderGeometry(0.28, 0.3, 3.7, 16), color: '#f2ede2', matrix: m4(px2, y0 + 1.85, pz2) }); }
      for (let k = 0; k < 3; k++) { const [sx2, sz2] = at(0, 5.0 + k * 0.45); W.addSurface({ kind: 'box', x: sx2, z: sz2, hx: (12.5 - k * 0.6) / 2, hz: 0.225, yaw: aud.yaw, top: y0 - k * 0.15 }); parts.push({ geometry: new THREE.BoxGeometry(12.5 - k * 0.6, 0.16, 0.45), color: '#c9c1b2', matrix: m4(sx2, y0 - 0.08 - k * 0.15, sz2, 0, aud.yaw, 0) }); }
    }
  }
  // ---------------------------------------------------------------- flag lawn in front of the Administrative Building
  let flag = null;
  const adm = W.site('admin');
  if (adm) {
    // as in the photo: a tall white mast with a golden finial on a round raised bed (red brick rim,
    // dark foliage border), a paved ring path, and rows of clipped round shrubs along the paths
    let x = adm.ex + adm.nx * 34, z = adm.ez + adm.nz * 34;
    if (W.flagSpot) { x = W.flagSpot.x; z = W.flagSpot.z; }
    for (let k = 0; k < 10 && !free(x, z); k++) { x -= adm.nx * 3; z -= adm.nz * 3; }
    const y = W.heightAt(x, z);
    const H = 30;
    W.addSurface({ kind: 'disc', x, z, r: 9.6, top: y + 0.66 });               // the raised bed: step up onto its lawn
    W.addSolid(x, z, 1.5, 'flag', true);                                          // the mast's plinth
    parts.push({ geometry: new THREE.CylinderGeometry(0.12, 0.3, H, 14), color: '#ecece6', matrix: m4(x, y + H / 2 + 0.6, z) });
    parts.push({ geometry: new THREE.SphereGeometry(0.32, 14, 10), color: '#d4a017', matrix: m4(x, y + H + 0.9, z, 0, 0, 0, 1, 1.4, 1) });
    parts.push({ geometry: new THREE.ConeGeometry(0.08, 0.9, 8), color: '#d4a017', matrix: m4(x, y + H + 1.7, z) });
    parts.push({ geometry: new THREE.BoxGeometry(2.2, 0.6, 2.2), color: '#f2f0ea', matrix: m4(x, y + 0.6, z) });                 // plinth
    parts.push({ geometry: new THREE.CylinderGeometry(9.4, 9.6, 0.55, 48), color: '#b5533c', matrix: m4(x, y + 0.27, z) });      // brick rim
    parts.push({ geometry: new THREE.CylinderGeometry(9.1, 9.1, 0.62, 48), color: '#4a1f35', matrix: m4(x, y + 0.31, z) });      // dark foliage border
    parts.push({ geometry: new THREE.CylinderGeometry(8.2, 8.2, 0.66, 48), color: '#9a9a5a', matrix: m4(x, y + 0.33, z) });      // inner lawn (dry grass)
    const ringPath = new THREE.RingGeometry(10.2, 12.6, 48).rotateX(-Math.PI / 2);
    parts.push({ geometry: ringPath, color: '#cfc3ad', matrix: m4(x, y + 0.09, z) });
    // clipped round shrubs: a ring round the path and two curving rows towards the building
    const shrub = (sx, sz, s = 0.45) => free(sx, sz) && !graph.onRoad(sx, sz, 1) && !graph.roadAt(sx, sz, 2, e => e.foot) && parts.push({ geometry: new THREE.IcosahedronGeometry(s, 1), color: '#2f5a2a', matrix: m4(sx, W.heightAt(sx, sz) + s * 0.9, sz, 0, 0, 0, 1, 1.1, 1) });
    for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; shrub(x + Math.cos(a) * 13.6, z + Math.sin(a) * 13.6, 0.4 + (k % 2) * 0.08); }
    const bx = adm.blocks.reduce((v, b) => v + (b.x0 + b.x1) / 2, 0) / adm.blocks.length;
    const bz = adm.blocks.reduce((v, b) => v + (b.z0 + b.z1) / 2, 0) / adm.blocks.length;
    const dl = Math.hypot(bx - x, bz - z) || 1, nx = (x - bx) / dl, nz = (z - bz) / dl;
    const tx = -nz, tz = nx;
    for (const side of [-1, 1]) for (let k = 0; k < 14; k++) {
      const t = k / 13, bend = Math.sin(t * Math.PI) * 6 * side;
      const px = x - nx * (13 + t * 22) + tx * (side * 5 + bend), pz = z - nz * (13 + t * 22) + tz * (side * 5 + bend);
      if (!W.buildingAt(px, pz)) shrub(px, pz, 0.42);
      const qx = px + tx * side * 2.4, qz = pz + tz * side * 2.4;
      if (k % 2 === 0 && free(qx, qz) && !graph.onRoad(qx, qz, 1) && !graph.roadAt(qx, qz, 2, e => e.foot)) parts.push({ geometry: new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6), color: '#3a3a3a', matrix: m4(qx, W.heightAt(qx, qz) + 0.35, qz) });  // bollard lights
    }
    flower(x, z, 8.6, ['#6a1f3a', '#8a2f4a', '#4a1f35']);
    const fg = new THREE.PlaneGeometry(7.2, 4.8, 16, 6);
    const ft = tex(384, 256, (g) => drawIndianFlag(g, 384, 256));
    flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.set(x + 3.7, y + H - 2.1, z);
    flag.userData.base = fg.attributes.position.array.slice();
    flag.name = 'admin-indian-flag';
    group.add(flag);
  }
  // (the front of the Academic Complex, with its institute name, steps and flower beds, is scene/acfront.js)
  // ---------------------------------------------------------------- building name boards (library, conference centre)
  const board = (id, top, bot, bg = '#f2efe8', fg = '#2a2622') => {
    const s = W.site(id);
    if (!s) return;
    const lines = Array.isArray(top) ? top : [top], H = 120 + lines.length * 78, WD = 1024;
    // every line is shrunk until it fits the board (a long name used to run off the edge), the small line sits under them
    const t = tex(WD, H, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, WD, H); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      const fit = (text, px, weight) => { let k = px; g.font = weight + ' ' + k + 'px "Hind", "Segoe UI", sans-serif'; while (g.measureText(text).width > WD - 90 && k > 18) { k -= 2; g.font = weight + ' ' + k + 'px "Hind", "Segoe UI", sans-serif'; } };
      lines.forEach((ln, i) => { fit(ln, 66, 'bold'); g.fillText(ln, WD / 2, 34 + 40 + i * 78); });
      fit(bot, 40, '600'); g.fillText(bot, WD / 2, 40 + lines.length * 78 + 38);
      g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(10, 10, WD - 20, H - 20);
    });
    const f = facade(s, 7), bw = 7 * f.k;
    panel(f.x, W.heightAt(s.ex, s.ez) + 4.4, f.z, bw, bw * H / WD, f.yaw, t);
  };
  board('library', ['LAKSHMINATH BEZBAROA', 'CENTRAL LIBRARY'], 'IIT GUWAHATI');
  board('conference', 'CONFERENCE CENTER', 'IIT Guwahati', '#4a3424', '#f2e6cc');
  // ---------------------------------------------------------------- bilingual hostel name boards (like Dihing's)
  for (const s of W.sites.filter((q) => q.kind === 'hostel')) {
    const nm = s.name.replace(' Hostel', '');
    const hi = HINDI_HOSTEL[s.lm] || '';
    const t = tex(1024, 256, (g) => {
      g.fillStyle = '#c8633b'; g.fillRect(0, 0, 1024, 256);
      g.fillStyle = '#f4efe6'; g.textAlign = 'center';
      g.font = `600 78px ${DEVA}`; g.fillText(`${hi} छात्रावास`, 512, 104, 960);
      g.font = 'bold 80px "Hind", "Segoe UI", sans-serif'; g.fillText(`${nm.toUpperCase()} HOSTEL`, 512, 210, 960);
    });
    const f = facade(s, 5.2);
    panel(f.x, W.heightAt(s.ex, s.ez) + 3.6, f.z, 5.2 * f.k, 1.3 * f.k, f.yaw, t);
  }
  // ---------------------------------------------------------------- the Rhino Circle on the road in from the Main Gate
  // (as in the photo): a roundabout island with a clipped-shrub ring, and a big pale-grey one-horned
  // rhino with her calf. The road itself was split into a ring round it (scene/roundabout.js).
  const RA = game.rhinoAt;
  if (RA) {
    const { x, z, r: R } = RA, y = W.heightAt(x, z);
    W.addSurface({ kind: 'disc', x, z, r: R - 0.1, lift: 0.3 });                   // you walk on the island's lawn, not in it
    // island: painted kerb, lawn, a ring of round shrubs, a gentle mound in the middle
    for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2, L = (2 * Math.PI * R) / 48; parts.push({ geometry: new THREE.BoxGeometry(L * 1.02, 0.25, 0.3), color: k % 2 ? '#1a1a1a' : '#f2f2ee', matrix: m4(x + Math.cos(a) * R, W.heightAt(x + Math.cos(a) * R, z + Math.sin(a) * R) + 0.12, z + Math.sin(a) * R, 0, -a + Math.PI / 2, 0) }); }
    parts.push({ geometry: drapedDisc(W, x, z, R - 0.1, 0.3, 8, 56), color: '#5f9a3a', matrix: new THREE.Matrix4() });
    // a round stone plinth for the statues (the old grass mound swallowed their legs): level on top, whatever the ground does under it,
    // a lower step round it; people can climb onto it
    const PR = Math.min(R - 2.2, 6.6);
    let pyTop = y;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; pyTop = Math.max(pyTop, W.heightAt(x + Math.cos(a) * PR, z + Math.sin(a) * PR), W.heightAt(x + Math.cos(a) * PR * 0.5, z + Math.sin(a) * PR * 0.5)); }
    pyTop += 0.62;
    const yb = y - 2.2;
    parts.push({ geometry: new THREE.CylinderGeometry(PR + 0.7, PR + 0.8, pyTop - 0.3 - yb, 40), color: '#b4aea2', matrix: m4(x, (pyTop - 0.3 + yb) / 2, z) });      // the lower step
    parts.push({ geometry: new THREE.CylinderGeometry(PR, PR + 0.06, pyTop - yb, 40), color: '#c9c3b6', matrix: m4(x, (pyTop + yb) / 2, z) });                 // the plinth
    W.addSurface({ kind: 'disc', x, z, r: PR + 0.3, top: pyTop });
    for (let k = 0; k < 30; k++) { const a = (k / 30) * Math.PI * 2, rr = R * 0.78, sx = x + Math.cos(a) * rr, sz = z + Math.sin(a) * rr; parts.push({ geometry: new THREE.IcosahedronGeometry(0.42 + (k % 3) * 0.05, 1), color: k % 2 ? '#4f7f2a' : '#6f9a2e', matrix: m4(sx, W.heightAt(sx, sz) + 0.6, sz, 0, 0, 0, 1, 0.8, 1) }); }
    flower(x, z, 2.2, ['#f6d21c', '#e8b81c', '#f28c1c']);
    // the statues (a studded, folded hide in pale grey, like the painted concrete of the real one)
    const hide = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = '#b8b5ad'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 2600; k++) { const px = Math.random() * w, py = Math.random() * h, rr = 2 + Math.random() * 3.5; g.fillStyle = 'rgba(70,68,62,0.28)'; g.beginPath(); g.arc(px + 1, py + 1.2, rr, 0, 7); g.fill(); g.fillStyle = 'rgba(235,232,224,0.45)'; g.beginPath(); g.arc(px - 0.6, py - 0.6, rr * 0.8, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(60,58,52,0.35)'; g.lineWidth = 3; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(0, k * 60 + Math.random() * 20); g.bezierCurveTo(w * 0.3, k * 60 + 30, w * 0.6, k * 60 - 20, w, k * 60 + 10); g.stroke(); }
    }, { repeat: true });
    hide.repeat.set(2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: hide, bumpMap: hide, bumpScale: 2.5, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6 });
    const rhino = (calf) => {
      const G = new THREE.Group();
      const S = (geo, px, py, pz, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, m = mat) => { const q = new THREE.Mesh(geo, m); q.position.set(px, py, pz); q.scale.set(sx, sy, sz); q.rotation.set(rx, ry, rz); q.castShadow = true; q.receiveShadow = true; G.add(q); return q; };
      const ball = new THREE.SphereGeometry(1, 28, 20);
      S(ball, 0, 1.38, -0.05, 1.02, 0.98, 1.85);                  // barrel of a body
      S(ball, 0, 1.46, 0.85, 1.08, 1.06, 0.95);                   // shoulder shield
      S(ball, 0, 1.32, -1.15, 1.0, 0.96, 0.9);                    // rump shield
      S(new THREE.TorusGeometry(1, 0.045, 10, 40), 0, 1.4, 1.5, 1.0, 0.96, 1);   // the fold behind the shoulder shield (the other folds read as rings: left out)
      S(ball, 0, 1.3, 1.78, 0.7, 0.75, 0.62);                     // neck
      S(new THREE.TorusGeometry(0.68, 0.07, 10, 32), 0, 1.3, 1.95, 1, 1.05, 1);                                 // neck fold
      S(ball, 0, 1.08, 2.45, 0.42, 0.47, 0.9, 0.38);              // long, heavy head, nose down
      S(ball, 0, 0.84, 3.05, 0.3, 0.3, 0.36, 0.2);                // muzzle
      if (!calf) { S(new THREE.ConeGeometry(0.14, 0.5, 14), 0, 1.2, 3.1, 1, 1, 1, -0.35); S(new THREE.ConeGeometry(0.07, 0.2, 10), 0, 1.36, 2.75, 1, 1, 1, -0.2); }  // the single horn
      else S(new THREE.ConeGeometry(0.06, 0.1, 8), 0, 1.06, 3.1, 1, 1, 1, -0.3);
      for (const sx of [-1, 1]) {
        S(new THREE.ConeGeometry(0.1, 0.32, 10), sx * 0.24, 1.66, 2.0, 1, 1, 0.55, -0.4, 0, sx * 0.35);   // ears
        S(ball, sx * 0.3, 1.2, 2.55, 0.035, 0.035, 0.035, 0, 0, 0, dark);                                 // eyes
        for (const zz of [1.05, -1.2]) {
          S(new THREE.CylinderGeometry(0.3, 0.26, 0.95, 16), sx * 0.58, 0.55, zz);                        // thick legs
          S(new THREE.CylinderGeometry(0.3, 0.33, 0.14, 16), sx * 0.58, 0.07, zz + 0.04);                // feet
          for (const t of [-0.15, 0, 0.15]) S(ball, sx * 0.58 + t, 0.06, zz + 0.3, 0.07, 0.05, 0.06, 0, 0, 0, dark);  // toenails
        }
      }
      S(new THREE.CylinderGeometry(0.035, 0.02, 0.6, 8), 0, 1.15, -2.05, 1, 1, 1, 0.35);                   // tail
      if (calf) G.scale.setScalar(0.46);
      return G;
    };
    const yaw = RA.ang != null ? -RA.ang : 0;
    const mom = rhino(false); mom.position.set(x + Math.cos(-yaw) * 1.0, pyTop, z + Math.sin(-yaw) * 1.0); mom.rotation.y = yaw + Math.PI * 0.62; group.add(mom);
    const kid = rhino(true); kid.position.set(x + Math.cos(yaw + 1.9) * 3.3, pyTop, z + Math.sin(yaw + 1.9) * 3.3); kid.rotation.y = yaw + Math.PI * 0.7; group.add(kid);
    W.addSolid(mom.position.x, mom.position.z, 1.9, 'rhino', true); W.addSolid(kid.position.x, kid.position.z, 1.1, 'rhino', true);
    game.world.landmarks.push({ id: 'rhino', name: 'Rhino Circle', kind: 'nature', desc: 'The one-horned rhino and her calf, pride of Assam, on the roundabout just inside the Main Gate.', x, y: -z, z: y + 40, wx: x, wz: z, wy: y });
    // keep people and cycles off the island (a low kerb): the walkers go round
    for (let k = 0; k < 24; k++) { const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1) / 24) * Math.PI * 2; W.indexFence({ ax: x + Math.cos(a0) * (R - 0.3), az: z + Math.sin(a0) * (R - 0.3), bx: x + Math.cos(a1) * (R - 0.3), bz: z + Math.sin(a1) * (R - 0.3), top: y + 0.9, bikeOnly: true }); }
  }
  // ---------------------------------------------------------------- pollution meter display at the circle by the IITG Lake
  // (it used to stand at the View Point road). The circle also has a guard in a booth and a bus stop (neighbourhood.js, busstops.js).
  let meter = null;
  const LS = W.lakeSpots;                                                               // planned in lakecircle.js (before the trees)
  if (LS?.lc) {
    const lc = LS.lc;
    if (LS.guard) (W.extraPosts ||= []).push({ x: LS.guard.x, z: LS.guard.z, yaw: Math.atan2(lc.x - LS.guard.x, lc.z - LS.guard.z), label: 'LAKE CIRCLE SECURITY' });
    if (LS.aqi) {
      const x = LS.aqi.x, z = LS.aqi.z;
      W.aqiStation = { x, z };
      const y = W.heightAt(x, z);
      const yawB = Math.atan2(lc.x - x, lc.z - z);                                      // the board faces the circle
      const nx = Math.sin(yawB), nz = Math.cos(yawB), tx = Math.cos(yawB), tz = -Math.sin(yawB);   // its normal, and along it
      // two steel posts BEHIND the board, one at each end, each bolted to the frame by two clamps, on small concrete footings
      for (const s of [-1, 1]) {
        const px = x + tx * s * 1.3 - nx * 0.17, pz = z + tz * s * 1.3 - nz * 0.17;
        parts.push({ geometry: new THREE.BoxGeometry(0.14, 4.1, 0.14), color: '#3b4046', matrix: m4(px, y + 1.75, pz, 0, yawB, 0) });
        parts.push({ geometry: new THREE.CylinderGeometry(0.28, 0.32, 0.22, 10), color: '#a8a39a', matrix: m4(px, y + 0.06, pz) });
        for (const hy of [2.35, 3.45]) parts.push({ geometry: new THREE.BoxGeometry(0.2, 0.12, 0.18), color: '#8a8f96', matrix: m4(x + tx * s * 1.3 - nx * 0.08, y + hy, z + tz * s * 1.3 - nz * 0.08, 0, yawB, 0) });
      }
      const c = document.createElement('canvas'); c.width = 512; c.height = 256;
      const mt = new THREE.CanvasTexture(c); mt.colorSpace = THREE.SRGBColorSpace;
      meter = { c, g: fitText(c.getContext('2d')), tex: mt, t: 0 };
      const mesh = panel(x + nx * 0.07, y + 2.9, z + nz * 0.07, 2.8, 1.4, yawB, mt, 1.1);
      mesh.material.side = THREE.DoubleSide;
      parts.push({ geometry: new THREE.BoxGeometry(3.0, 1.6, 0.12), color: '#111', matrix: m4(x, y + 2.9, z, 0, yawB, 0) });
      parts.push({ geometry: new THREE.BoxGeometry(3.0, 0.08, 0.2), color: '#2c3036', matrix: m4(x + nx * 0.02, y + 3.74, z + nz * 0.02, 0, yawB, 0) });   // a small hood over the top edge
    }
  }
  // ---------------------------------------------------------------- granite photo wall at the Guest House
  const gh = W.site('guesthouse');
  if (gh) {
    let x = gh.ex + gh.nx * 14, z = gh.ez + gh.nz * 14;
    for (let k = 0; k < 6 && !free(x, z); k++) { x += gh.nx * 3; z += gh.nz * 3; }
    const yaw = gh.yaw;
    const y = W.heightAt(x, z);
    parts.push({ geometry: new THREE.BoxGeometry(7, 1.8, 0.9), color: '#6b6e70', matrix: m4(x, y + 0.9, z, 0, yaw, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(7.4, 0.7, 1.2), color: '#8a7a64', matrix: m4(x, y + 0.35, z, 0, yaw, 0) });
    const t = tex(1024, 256, (g) => { g.fillStyle = '#56595c'; g.fillRect(0, 0, 1024, 256); for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.fillRect(Math.random() * 1024, Math.random() * 256, 3, 3); } g.fillStyle = '#e8eaec'; g.font = 'bold 150px "Hind", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText('IIT GUWAHATI', 512, 190); });
    panel(x + Math.sin(yaw) * 0.46, y + 1.05, z + Math.cos(yaw) * 0.46, 6.6, 1.5, yaw, t);
    const logo = tex(128, 128, (g) => drawCampusCrest(g, 64, 64, 60));   // original crest (not the official logo)
    panel(x + Math.sin(yaw) * 0.46, y + 2.35, z + Math.cos(yaw) * 0.46, 1.0, 1.0, yaw, logo);
  }
  // ---------------------------------------------------------------- Alcheringa mural wall (GPS from a photo)
  {
    let x = 135, z = -270;
    for (let k = 0; k < 20 && !free(x, z); k++) { x += 4; z -= 3; }
    const n = graph.nearestOnNetwork(x, z);
    const yaw = n ? Math.atan2(n.x - x, n.z - z) : 0;
    const y = W.heightAt(x, z);
    parts.push({ geometry: new THREE.BoxGeometry(9, 3.4, 0.35), color: '#e9e2d6', matrix: m4(x, y + 1.7, z, 0, yaw, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(9.2, 0.9, 0.5), color: '#9a4a36', matrix: m4(x, y + 0.45, z, 0, yaw, 0) });
    const t = tex(1024, 320, (g) => {
      const gr = g.createLinearGradient(0, 0, 1024, 320); gr.addColorStop(0, '#6b1d8a'); gr.addColorStop(0.5, '#c2185b'); gr.addColorStop(1, '#1f5fbf');
      g.fillStyle = gr; g.fillRect(0, 0, 1024, 320);
      for (let k = 0; k < 40; k++) { g.fillStyle = ['#f6d21c', '#4fc3f7', '#ff7043', '#ffffff'][k % 4]; g.globalAlpha = 0.5; g.beginPath(); g.arc(Math.random() * 1024, Math.random() * 320, 4 + Math.random() * 14, 0, 7); g.fill(); }
      g.globalAlpha = 1; g.textAlign = 'center';
      g.font = 'bold 150px "Impact", "Teko", sans-serif'; g.lineWidth = 16; g.strokeStyle = '#1b1b3a'; g.strokeText('ALCHERINGA', 512, 200); g.fillStyle = '#f6d21c'; g.fillText('ALCHERINGA', 512, 200);
      g.font = 'bold 44px "Hind", sans-serif'; g.fillStyle = '#4fc3f7'; g.fillText('IIT GUWAHATI · 8-BIT ESCAPADE', 512, 272);
      g.fillStyle = '#f6d21c'; for (const sx of [360, 512, 664]) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.28 - Math.PI / 2, rr = k % 2 ? 16 : 36; g.lineTo(sx + Math.cos(a) * rr, 52 + Math.sin(a) * rr); } g.fill(); }
    });
    panel(x + Math.sin(yaw) * 0.19, y + 2.05, z + Math.cos(yaw) * 0.19, 8.8, 2.6, yaw, t);
  }
  // ---------------------------------------------------------------- flowers on the grass at the Main Gate: on the island lawn and in beds along the verges
  {
    const mg = W.gates.find((q) => q.main);
    if (mg) {
      const ox = Math.cos(mg.angle), oz = -Math.sin(mg.angle), zx = -oz, zz = ox;          // out of the campus; along the wall
      const at = (lx, lz) => [mg.wx + ox * lx + zx * lz, mg.wz + oz * lx + zz * lz];
      const COLS = [['#f2a51c', '#f6d21c', '#e2562f'], ['#d6336c', '#f06595', '#fbd0dc'], ['#7b2cbf', '#b36cf0', '#f3e9ff'], ['#e03131', '#ff6b6b', '#ffe3e3'], ['#f8f6ee', '#ffe066', '#fff3bf']];
      let made = 0;
      const bed = (x, z, r, cols, lift = 0.02) => {
        for (let k = 0, n = Math.round(r * r * 8); k < n && made < 900; k++) {
          const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, y = W.heightAt(px, pz) + lift, h = 0.2 + rnd() * 0.16;
          parts.push({ geometry: new THREE.CylinderGeometry(0.008, 0.01, h, 4), color: '#3f7a2f', matrix: m4(px, y + h / 2, pz) });
          parts.push({ geometry: new THREE.IcosahedronGeometry(0.07 + rnd() * 0.05, 0), color: cols[Math.floor(rnd() * cols.length)], matrix: m4(px, y + h + 0.03, pz) });
          if (k % 3 === 0) parts.push({ geometry: new THREE.IcosahedronGeometry(0.1, 0).scale(1.4, 0.45, 1.4), color: '#4a8a34', matrix: m4(px, y + 0.06, pz) });
          made++;
        }
      };
      // the island lawn (lawn top 0.26 above the road): small beds either side of the name stone
      let c = 0;
      for (const lx of [-8.2, -6.6, -5.0, 0.9, 2.5, 4.1]) for (const lz of [-0.55, 0.55]) { const [x, z] = at(lx, lz); bed(x, z, 0.42, COLS[c++ % COLS.length], 0.26); }
      // beds on the grass either side of the approach, on both sides of the wall
      for (const lx of [-26, -17, -9, 9, 15, 22]) for (const side of [-1, 1]) for (const lz of [17, 21, 25]) {
        const [x, z] = at(lx, side * lz);
        if (!free(x, z) || graph.onRoad(x, z, 3) || W.buildingAt(x + 1.5, z) || W.buildingAt(x - 1.5, z) || !W.insideCampus(x, z) && lx < 0) continue;
        bed(x, z, 1.5 + rnd() * 0.9, COLS[Math.floor(rnd() * COLS.length)]);
        break;
      }
    }
  }
  // (the KV Gate's one IITG board, with the 3D-printed guard post and the sub post office beside it, is built in gates.js)

  const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  void glowParts;
  return {
    group,
    update(dt, night, g) {
      if (flag) {
        const a = flag.geometry.attributes.position, b = flag.userData.base, t = g.time;
        const wind = 0.6 + g.weather.state.wind;
        for (let i = 0; i < a.count; i++) { const x = b[i * 3] + 3.6; a.setZ(i, Math.sin(x * 1.3 - t * 4.2 * wind) * 0.1 * x * wind); }
        a.needsUpdate = true;
        flag.geometry.computeVertexNormals();
      }
      if (meter) {
        meter.t -= dt;
        if (meter.t <= 0) {
          meter.t = 2;
          const e = environment(g), m = meter.g;
          const no2 = (e.pm * 0.3).toFixed(2), nox = (e.pm * 0.24).toFixed(2), nh3 = (e.pm * 0.7).toFixed(2), co = (0.3 + e.pm / 200).toFixed(2);
          m.fillStyle = '#050805'; m.fillRect(0, 0, 512, 256);
          m.strokeStyle = '#1f8f3a'; m.lineWidth = 6; m.strokeRect(6, 6, 500, 244);
          m.font = 'bold 30px "Consolas", monospace'; m.textAlign = 'left';
          const rows = (Math.floor(g.time / 6) % 2 === 0) ? [['NO2', no2, 'ug/m3'], ['NOx', nox, 'ug/m3'], ['NH3', nh3, 'ug/m3'], ['CO', co, 'mg/m3']] : [['PM2.5', String(e.pm), 'ug/m3'], ['AQI', String(e.aqi), ''], ['TEMP', `${e.temp}`, 'deg C'], ['RH', `${e.rh}`, '%']];
          rows.forEach(([k, v, u], i) => { m.fillStyle = '#ff5a5a'; m.fillText(k, 30, 60 + i * 52); m.fillStyle = '#ff3030'; m.fillText(v, 190, 60 + i * 52); m.fillStyle = '#2fdc5a'; m.fillText(u, 350, 60 + i * 52); });
          meter.tex.needsUpdate = true;
        }
      }
    },
  };
}

import * as THREE from 'three';
import { canvasTexture, mulberry32, closestOnRing, pointInRing, mergeColored, m4, tube } from '../util.js';
import { U, wetPatch } from './shared.js';
import { planHostelRoof, buildRoofKit, solarMaterial } from './rooftop.js';

const BAY = 3.2, FLOOR = 3.3; // metres; each facade texture tile = 4 bays x 4 floors

const WALL = {
  residential: ['#ebe5d8', '#efe6cf', '#e4dccb', '#f2ede2', '#ded5c1', '#eadcc3', '#e9e1d3'],
  hostel: ['#e8d5b5', '#dfc9a3', '#eadbc0', '#dcc6a8', '#e6d0ae'],
  academic: ['#d9c2a0', '#ddc9ab', '#d3b995', '#e1cfb2'],        // pale sandstone-coloured concrete, as in the photographs
  admin: ['#c98663', '#cf9270'],
  institutional: ['#e1d7c6', '#d8cdb9', '#e6ddcc'],
  auditorium: ['#dcd0bd'],
  hospital: ['#efefe9'],
  commercial: ['#e6dfd3', '#e0d6c4'],
  sports: ['#dcd6ca'],
  guest: ['#efe6d4', '#eadfc8'],
};
const ROOF = {
  residential: '#b7b1a6', hostel: '#b27a6c', academic: '#aaa49b', admin: '#a89c90', institutional: '#b0aaa0',
  auditorium: '#9c9aa0', hospital: '#b9b7b2', commercial: '#aea69a', sports: '#9fa2a4', guest: '#b58c7a',
};
const STYLE = { residential: 'A', hostel: 'B', guest: 'B', academic: 'C', admin: 'C', institutional: 'C',
  hospital: 'C', commercial: 'C', sports: 'D', auditorium: 'C' };   // the auditorium has windows like the admin blocks
// night-light groups: 0 hostel, 1 academic/admin, 2 homes, 3 other
const LITK = { hostel: 0, guest: 0, academic: 1, admin: 1, institutional: 1, hospital: 3, commercial: 3, sports: 3, auditorium: 3, residential: 2 };

/** mode: 'albedo' | 'mask' (window = white) | 'rough' */
function facade(style, mode) {
  return canvasTexture(512, 512, (g, W, H) => {
    const rnd = mulberry32(style.charCodeAt(0) * 31 + 5);
    const bw = W / 4, fh = H / 4;
    g.fillStyle = mode === 'albedo' ? '#fff' : mode === 'rough' ? 'rgb(0,235,0)' : '#000';
    g.fillRect(0, 0, W, H);
    for (let f = 0; f < 4; f++)
      for (let b = 0; b < 4; b++) {
        const x0 = b * bw, y0 = H - (f + 1) * fh;
        if (mode === 'albedo') {
          g.fillStyle = 'rgba(60,50,40,0.13)';
          g.fillRect(x0, y0, bw, 7);                   // floor slab line
          g.fillStyle = 'rgba(60,50,40,0.05)';
          g.fillRect(x0, y0 + 7, bw, 4);
        }
        if (style === 'E') continue;                    // plain plastered wall (a mural goes on it)
        let ww, wh, wy;
        if (style === 'A') { ww = 0.42; wh = 0.38; wy = 0.30; }
        else if (style === 'B') { ww = 0.56; wh = 0.40; wy = 0.28; }
        else if (style === 'C') { ww = 0.86; wh = 0.44; wy = 0.26; }
        else { ww = 0.0; wh = 0; wy = 0; }
        if (style === 'D') {
          if (mode === 'albedo') {
            g.fillStyle = 'rgba(0,0,0,0.10)';
            for (let k = 0; k < 4; k++) g.fillRect(x0 + (k + 0.4) * (bw / 4), y0, 6, fh);
          }
          continue;
        }
        const wx = x0 + (bw * (1 - ww)) / 2, wyy = y0 + fh * (1 - wy - wh), wwp = bw * ww, whp = fh * wh;
        rnd();
        if (mode === 'mask') { g.fillStyle = '#fff'; g.fillRect(wx + 3, wyy + 3, wwp - 6, whp - 6); continue; }
        if (mode === 'rough') { g.fillStyle = 'rgb(0,40,0)'; g.fillRect(wx, wyy, wwp, whp); continue; }
        // chajja (sunshade) over the window - very common on Indian campus buildings
        g.fillStyle = 'rgba(40,35,30,0.22)';
        g.fillRect(wx - 8, wyy - 14, wwp + 16, 8);
        g.fillStyle = 'rgba(40,35,30,0.10)';
        g.fillRect(wx - 8, wyy - 6, wwp + 16, 6);
        // frame + glass
        g.fillStyle = '#f4f1ea';
        g.fillRect(wx - 3, wyy - 3, wwp + 6, whp + 6);
        const gr = g.createLinearGradient(wx, wyy, wx + wwp, wyy + whp);
        gr.addColorStop(0, '#34444f'); gr.addColorStop(0.55, '#4d6370'); gr.addColorStop(1, '#27333b');
        g.fillStyle = gr;
        g.fillRect(wx, wyy, wwp, whp);
        // curtains in some windows
        if (rnd() < 0.45) { g.fillStyle = ['rgba(180,60,50,0.45)', 'rgba(70,90,150,0.45)', 'rgba(200,170,90,0.45)'][Math.floor(rnd() * 3)]; g.fillRect(wx, wyy, wwp * (0.25 + rnd() * 0.3), whp); }
        g.strokeStyle = 'rgba(230,230,225,0.85)';
        g.lineWidth = 2;
        const bars = style === 'C' ? 4 : 2;
        for (let k = 1; k < bars; k++) { g.beginPath(); g.moveTo(wx + (wwp * k) / bars, wyy); g.lineTo(wx + (wwp * k) / bars, wyy + whp); g.stroke(); }
        if (style === 'A') { // window grill
          g.strokeStyle = 'rgba(30,30,30,0.35)'; g.lineWidth = 1;
          for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(wx + (wwp * k) / 6, wyy); g.lineTo(wx + (wwp * k) / 6, wyy + whp); g.stroke(); }
        }
        if (style === 'B' && b % 2 === 0) { // corridor railing band on hostel blocks
          g.fillStyle = 'rgba(120,40,30,0.25)';
          g.fillRect(x0, y0 + fh * 0.72, bw, 6);
        }
      }
  }, { srgb: mode === 'albedo' });
}

/** Monsoon weathering: dark streaks running down from the roof + splash dirt at the base. */
function weatherTex() {
  const rnd = mulberry32(31);
  return canvasTexture(512, 256, (g, W, H) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      const x = rnd() * W, w = 1 + rnd() * 5, len = H * (0.15 + rnd() * 0.75);
      const gr = g.createLinearGradient(0, 0, 0, len);
      const a = 0.08 + rnd() * 0.2;
      gr.addColorStop(0, `rgba(40,45,40,${a})`); gr.addColorStop(1, 'rgba(40,45,40,0)');
      g.fillStyle = gr; g.fillRect(x, 0, w, len);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(60,70,50,${0.03 + rnd() * 0.05})`;
      g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 10 + rnd() * 40, 6 + rnd() * 30, 0, 0, 7); g.fill();
    }
  }, { srgb: false });
}

function roofTex() {
  const rnd = mulberry32(11);
  return canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      const v = 200 + Math.floor(rnd() * 55);
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 5, 2 + rnd() * 5);
    }
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(60,70,60,0.08)'; g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 12 + rnd() * 30, 8 + rnd() * 20, rnd() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.06)';
    for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(0, k * 64); g.lineTo(W, k * 64); g.stroke(); g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64, H); g.stroke(); }
  });
}

export const litUniform = { value: new THREE.Vector4(0, 0, 0, 0) };
export const clockUniform = { value: 0 };

function patchFacade(sh, weather) {
  wetPatch(sh, { minRough: 0.3 });
  sh.uniforms.uWeather = { value: weather };
  sh.uniforms.uLit = litUniform;
  sh.uniforms.uClock = clockUniform;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 aW;\nvarying vec4 vW;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = aW;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform sampler2D uWeather;\nuniform vec4 uLit;\nuniform float uClock;\nvarying vec4 vW;\nfloat bh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }')
    .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float streak = texture2D(uWeather, vec2(vW.x / 22.0, min(vW.z, 9.0) / 9.0)).r;
        diffuseColor.rgb *= mix(1.0, streak, 0.85);
        float plinth = step(vW.y, 1.25);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.38, 0.35, 0.32), plinth * 0.85);
        diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(1.25, 2.8, vW.y);
      }`)
    .replace('#include <emissivemap_fragment>', `
      {
        vec4 em = texture2D(emissiveMap, vEmissiveMapUv);
        vec2 cell = floor(vEmissiveMapUv * 4.0) + vec2(floor(vW.x / 12.8) * 4.0, 0.0);
        float kind = vW.w;
        float p = kind < 0.5 ? uLit.x : kind < 1.5 ? uLit.y : kind < 2.5 ? uLit.z : uLit.w;
        float hv = bh(cell + vec2(floor(uClock * 1.7 + bh(cell) * 9.0)));
        float on = step(hv, p) * step(1.3, vW.y);
        vec3 tint = mix(vec3(1.0, 0.78, 0.5), vec3(0.82, 0.92, 1.0), step(0.72, bh(cell + 3.1)));
        totalEmissiveRadiance *= em.rgb * on * tint;
      }`);
}

export function buildBuildings(world) {
  const group = new THREE.Group();
  group.name = 'buildings';
  const styles = ['A', 'B', 'C', 'D', 'E'];
  const mats = {};
  const wtex = weatherTex();
  for (const s of styles) {
    mats[s] = new THREE.MeshStandardMaterial({
      map: facade(s, 'albedo'), emissiveMap: facade(s, 'mask'), roughnessMap: facade(s, 'rough'), emissive: new THREE.Color(1, 0.9, 0.7),
      emissiveIntensity: 0, vertexColors: true, roughness: 1, metalness: 0,
    });
    mats[s].onBeforeCompile = (sh) => patchFacade(sh, wtex);
    mats[s].customProgramCacheKey = () => 'facade';
  }
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTex(), vertexColors: true, roughness: 0.95 });
  roofMat.onBeforeCompile = (sh) => wetPatch(sh, { puddles: true, minRough: 0.4 });
  const plainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  plainMat.onBeforeCompile = (sh) => wetPatch(sh, { minRough: 0.35 });
  const buckets = Object.fromEntries(styles.map((s) => [s, { p: [], n: [], u: [], c: [], w: [] }]));
  const roof = { p: [], n: [], u: [], c: [] };
  const plain = { p: [], n: [], c: [] };
  const rnd = mulberry32(42);
  const tmpC = new THREE.Color(), tmpR = new THREE.Color(), cap = new THREE.Color();

  const tanks = [], mumties = [], acs = [], clothes = [], solar = [];
  const util = [];          // hostel services on the walls and roofs: Wi-Fi / LAN cable trays and access points, water pipes (vertex coloured)
  const roofKit = { panels: [], heaters: [], acs: [], dishes: [], rods: [], lines: [], clothes };   // hostel roofs (rooftop.js)

  const quad = (B, ax, az, bx, bz, y0, y1, nx, nz, col, k0 = 1, k1 = 1) => {
    B.p.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y0, az, bx, y1, bz, ax, y1, az);
    for (let k = 0; k < 6; k++) B.n.push(nx, 0, nz);
    for (const s of [k0, k0, k1, k0, k1, k1]) B.c.push(col.r * s, col.g * s, col.b * s);
  };

  for (const b of world.buildings) {
    const style = b.area < 45 ? 'D' : STYLE[b.kind] || 'A';
    const pal = WALL[b.kind] || WALL.residential;
    tmpC.set(pal[Math.floor(rnd() * pal.length)]);
    const jitter = 0.94 + rnd() * 0.08;
    const B = buckets[style];
    const yb = b.base, yt = b.roof, f0 = b.floor0;
    const litK = LITK[b.kind] ?? 3;
    const seedX = rnd() * 5000;
    const parapet = b.area > 60 && b.kind !== 'auditorium' ? (b.kind === 'residential' && b.area < 150 ? 0.7 : 1.0) : 0;
    cap.copy(tmpC).multiplyScalar(0.8);
    for (let ri = 0; ri < b.rings.length; ri++) {
      const ring = b.rings[ri];
      let cum = 0;
      const n = ring.length;
      for (let i = 0; i < n; i += 2) {
        const j = (i + 2) % n;
        const ax = ring[i], az = ring[i + 1], bx = ring[j], bz = ring[j + 1];
        const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
        if (L < 0.05) continue;
        const nx = -dz / L, nz = dx / L;
        const Hh = yt - yb, lo = 0.8 * jitter, hi = 1.0 * jitter;
        // a piece of this wall: [sa, sb] metres along it, [ya, yc] high
        const piece = (Bk, sa, sb, ya, yc) => {
          const pax = ax + (dx / L) * sa, paz = az + (dz / L) * sa, pbx = ax + (dx / L) * sb, pbz = az + (dz / L) * sb;
          const ua = (cum + sa) / (BAY * 4), ub = (cum + sb) / (BAY * 4), va = (ya - f0) / (FLOOR * 4), vc = (yc - f0) / (FLOOR * 4);
          Bk.p.push(pax, ya, paz, pbx, ya, pbz, pbx, yc, pbz, pax, ya, paz, pbx, yc, pbz, pax, yc, paz);
          for (let k = 0; k < 6; k++) Bk.n.push(nx, 0, nz);
          Bk.u.push(ua, va, ub, va, ub, vc, ua, va, ub, vc, ua, vc);
          const sA = lo + ((hi - lo) * (ya - yb)) / Hh, sC = lo + ((hi - lo) * (yc - yb)) / Hh;
          for (const s of [sA, sA, sC, sA, sC, sC]) Bk.c.push(tmpC.r * s, tmpC.g * s, tmpC.b * s);
          const wa = seedX + cum + sa, wb = seedX + cum + sb, ha = ya - yb, hc = yc - yb;
          for (const [wx, hy] of [[wa, ha], [wb, ha], [wb, hc], [wa, ha], [wb, hc], [wa, hc]]) Bk.w.push(wx, hy, Hh - hy, litK);
        };
        // a mural patch (murals.js): whole bays by whole floors of plain wall, no windows
        const bl = ri === 0 && b.blanks ? b.blanks.find((q) => q.i === i) : null;
        if (!bl) piece(B, 0, L, yb, yt);
        else {
          const s0 = Math.max(0, bl.s0), s1 = Math.min(L, bl.s1), y1 = Math.min(yt, bl.y1);
          if (s0 > 0.01) piece(B, 0, s0, yb, yt);
          piece(buckets.E, s0, s1, yb, y1);
          if (y1 < yt - 0.01) piece(B, s0, s1, y1, yt);
          if (s1 < L - 0.01) piece(B, s1, L, yb, yt);
        }
        // roof parapet (outer face in wall colour, inner face darker, coping on top)
        if (parapet) {
          quad(plain, ax, az, bx, bz, yt, yt + parapet, nx, nz, tmpC, 0.98 * jitter, 0.92 * jitter);
          quad(plain, bx - nx * 0.18, bz - nz * 0.18, ax - nx * 0.18, az - nz * 0.18, yt, yt + parapet, -nx, -nz, tmpC, 0.7, 0.8);
          const tx0 = ax - nx * 0.18, tz0 = az - nz * 0.18, tx1 = bx - nx * 0.18, tz1 = bz - nz * 0.18, y = yt + parapet;
          plain.p.push(ax, y, az, tx1, y, tz1, bx, y, bz, ax, y, az, tx0, y, tz0, tx1, y, tz1);
          for (let k = 0; k < 6; k++) { plain.n.push(0, 1, 0); plain.c.push(cap.r, cap.g, cap.b); }
        }
        // lived-in details on long walls of multi-storey blocks
        if (ri === 0 && b.lv >= 2 && L > 6) {
          for (let d = 1.6; d < L - 1.6; d += BAY) {
            for (let f = 0; f < b.lv; f++) {
              const x = ax + (dx / L) * d, z = az + (dz / L) * d, y = f0 + f * FLOOR;
              if (y + 2 > yt) continue;
              if (bl && d > bl.s0 - 0.8 && d < bl.s1 + 0.8 && y < bl.y1) continue;     // not over the mural
              if (b.kind === 'hostel' && rnd() < 0.2) clothes.push([x + nx * 0.18, y + 1.1, z + nz * 0.18, Math.atan2(nx, nz), Math.floor(rnd() * 8)]);
              else if (b.kind === 'hostel' && f <= 1 && rnd() < 0.035) acs.push([x + nx * 0.28 + (dx / L) * 0.9, y + 1.9, z + nz * 0.28 + (dz / L) * 0.9, Math.atan2(nx, nz)]);   // office, common room
              else if ((b.kind === 'academic' || b.kind === 'admin' || b.kind === 'guest' || b.kind === 'hospital' || (b.kind === 'residential' && b.area > 120)) && rnd() < 0.08)
                acs.push([x + nx * 0.28 + (dx / L) * 0.9, y + 0.6 + rnd() * 1.3, z + nz * 0.28 + (dz / L) * 0.9, Math.atan2(nx, nz)]);
            }
          }
        }
        // hostel services on the outer walls: a Wi-Fi / LAN cable tray under every floor's slab with an access point every 13 m,
        // vertical water pipes (the risers that feed the rooms from the roof tanks), and the air-conditioners' outdoor units
        if (ri === 0 && b.kind === 'hostel' && L > 5) {
          const ux = dx / L, uz = dz / L, wy = Math.atan2(dx, dz), ny = Math.atan2(nx, nz);
          const muralAt = (d) => bl && d > bl.s0 - 0.6 && d < bl.s1 + 0.6;
          for (let f = 0; f < b.lv; f++) {
            const y = f0 + f * FLOOR + FLOOR - 0.42;
            if (y + 0.25 > yt || (bl && y < bl.y1 + 0.2 && L < bl.s1 - bl.s0 + 3)) continue;
            util.push({ geometry: new THREE.BoxGeometry(0.08, 0.06, L - 0.5), color: '#2c3136', matrix: m4(ax + ux * L / 2 + nx * 0.05, y, az + uz * L / 2 + nz * 0.05, 0, wy, 0) });
            util.push({ geometry: new THREE.BoxGeometry(0.03, 0.03, L - 0.5), color: '#5b8fd6', matrix: m4(ax + ux * L / 2 + nx * 0.09, y + 0.05, az + uz * L / 2 + nz * 0.09, 0, wy, 0) });   // the blue LAN cable laid in it
            for (let d = 2.5; d < L - 1.5; d += 13) {
              if (muralAt(d) && y < bl.y1 + 0.2) continue;
              util.push({ geometry: new THREE.CylinderGeometry(0.15, 0.17, 0.07, 10), color: '#f2f3f4', matrix: m4(ax + ux * d + nx * 0.12, y - 0.14, az + uz * d + nz * 0.12, Math.PI / 2, ny, 0, 1, 1, 1, 'YXZ') });
              util.push({ geometry: new THREE.BoxGeometry(0.04, 0.12, 0.04), color: '#2c3136', matrix: m4(ax + ux * d + nx * 0.07, y - 0.06, az + uz * d + nz * 0.07, 0, wy, 0) });
            }
          }
          for (let d = 1.0; d < L - 0.6; d += 26) {
            if (muralAt(d)) continue;
            const px = ax + ux * d + nx * 0.1, pz = az + uz * d + nz * 0.1;
            util.push({ geometry: new THREE.CylinderGeometry(0.055, 0.055, yt - yb + 0.3, 7), color: '#c4c8cc', matrix: m4(px, (yb + yt) / 2 + 0.15, pz) });
            for (let f = 0; f <= b.lv; f++) { const y = f0 + f * FLOOR + 0.3; if (y < yt) util.push({ geometry: new THREE.BoxGeometry(0.13, 0.05, 0.13), color: '#7d8286', matrix: m4(px - nx * 0.02, y, pz - nz * 0.02, 0, wy, 0) }); }
          }
          for (let d = 1.6; d < L - 1.6; d += BAY) for (let f = 0; f < b.lv; f++) {
            if (muralAt(d) && f0 + f * FLOOR < bl.y1) continue;
            if (rnd() < 0.09 && f0 + f * FLOOR + 2 < yt) acs.push([ax + ux * (d + 1.0) + nx * 0.4, f0 + f * FLOOR + 0.5, az + uz * (d + 1.0) + nz * 0.4, ny]);
          }
        }
        cum += L;
      }
    }
    // roof
    tmpR.set(ROOF[b.kind] || ROOF.residential);
    if (b.roofColor) {
      const s2 = new THREE.Color(b.roofColor[0] / 255, b.roofColor[1] / 255, b.roofColor[2] / 255);
      s2.convertSRGBToLinear();
      tmpR.lerp(s2.multiplyScalar(1.25), 0.55);
    }
    const contour = toV2(b.rings[0]);
    const holes = b.rings.slice(1).map(toV2);
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(contour, holes); } catch { tris = []; }
    const all = contour.concat(...holes);
    const rj = 0.92 + rnd() * 0.12;
    for (const t of tris) {
      let [a, c, d] = t.map((k) => all[k]);
      const cr = (c.x - a.x) * (d.y - a.y) - (c.y - a.y) * (d.x - a.x);
      if (cr > 0) [c, d] = [d, c];
      for (const v of [a, c, d]) {
        roof.p.push(v.x, yt, v.y);
        roof.n.push(0, 1, 0);
        roof.u.push(v.x / 16, v.y / 16);
        roof.c.push(tmpR.r * rj, tmpR.g * rj, tmpR.b * rj);
      }
    }
    // rooftop details: black Sintex water tanks, stair rooms (mumty), solar panels
    if (b.area > 50 && b.kind !== 'auditorium' && b.kind !== 'sports') {
      const tn = tanks.length, mn = mumties.length;
      // Sintex tanks: every hostel has several (more on the big blocks), every house one or two
      let count = b.area < 200 ? 1 : b.area < 700 ? 2 : 3;
      if (b.kind === 'hostel') count = Math.min(20, Math.max(8, Math.round(b.area / 260)));      // a bank of 5 000 L tanks: a hostel houses hundreds of students
      else if (b.kind === 'residential') count = b.area > 140 ? 2 : 1;
      for (let k = 0, tries = 0; k < count && tries < count * 6; tries++) {
        const pt = randomInside(b, rnd, 1.6);
        const big = b.kind === 'hostel';
        if (!pt || tanks.slice(tn).some(([x, , z]) => Math.hypot(x - pt[0], z - pt[1]) < (big ? 2.9 : 1.9))) continue;
        tanks.push([pt[0], yt, pt[1], big ? 1.3 : 0.95 + rnd() * 0.3]); k++;
      }
      // the tanks of a hostel are joined by a header pipe to the next nearest one, and feed the risers on the walls
      if (b.kind === 'hostel') {
        const mine = tanks.slice(tn);
        for (let q = 1; q < mine.length; q++) {
          let best = -1, bd = 7;
          for (let w = 0; w < q; w++) { const d = Math.hypot(mine[q][0] - mine[w][0], mine[q][2] - mine[w][2]); if (d < bd) { bd = d; best = w; } }
          if (best >= 0) util.push({ geometry: tube(new THREE.Vector3(mine[q][0], yt + 0.55, mine[q][2]), new THREE.Vector3(mine[best][0], yt + 0.55, mine[best][2]), 0.055, 6), color: '#9aa0a6', matrix: new THREE.Matrix4() });
        }
      }
      if (b.lv >= 3 && b.area > 220) {
        const pt = randomInside(b, rnd, 2.6);
        if (pt) mumties.push([pt[0], yt, pt[1], longestEdgeAngle(b.rings[0])]);
      }
      // hostels: solar panels in rows, solar water heaters, AC units, dishes, lightning rods, a clothesline
      if (b.kind === 'hostel' && b.area > 150) {
        const taken = [...tanks.slice(tn).map(([x, , z, s]) => [x, z, 0.9 * s]), ...mumties.slice(mn).map(([x, , z]) => [x, z, 2.7])];
        planHostelRoof(b, yt, rnd, taken, roofKit, parapet || 0.2);
      } else if ((b.kind === 'academic' || b.kind === 'admin') && b.area > 900) {
        const ang = longestEdgeAngle(b.rings[0]);
        for (let k = 0; k < 10; k++) {
          const pt = randomInside(b, rnd, 3.5);
          if (pt) solar.push([pt[0], yt, pt[1], ang]);
        }
      }
    }
  }

  for (const s of styles) {
    const B = buckets[s];
    if (!B.p.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
    g.setAttribute('aW', new THREE.Float32BufferAttribute(B.w, 4));
    const m = new THREE.Mesh(g, mats[s]);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(roof.p, 3));
  rg.setAttribute('normal', new THREE.Float32BufferAttribute(roof.n, 3));
  rg.setAttribute('uv', new THREE.Float32BufferAttribute(roof.u, 2));
  rg.setAttribute('color', new THREE.Float32BufferAttribute(roof.c, 3));
  const roofMesh = new THREE.Mesh(rg, roofMat);
  roofMesh.castShadow = true; roofMesh.receiveShadow = true;
  group.add(roofMesh);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(plain.p, 3));
  pg.setAttribute('normal', new THREE.Float32BufferAttribute(plain.n, 3));
  pg.setAttribute('color', new THREE.Float32BufferAttribute(plain.c, 3));
  const plainMesh = new THREE.Mesh(pg, plainMat);
  plainMesh.castShadow = true; plainMesh.receiveShadow = true;
  group.add(plainMesh);

  // instanced rooftop / facade props
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const inst = (geo, mat, list, place, shadow = true) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((v, i) => { place(v); im.setMatrixAt(i, M); });
    im.castShadow = shadow; im.receiveShadow = true;
    group.add(im);
    return im;
  };
  // a Sintex tank: black, ribbed, a domed top with a small lid, on a low plinth
  {
    const prof = [[0, 0], [0.68, 0], [0.7, 0.05], [0.7, 0.36], [0.66, 0.4], [0.7, 0.44], [0.7, 0.76], [0.66, 0.8], [0.7, 0.84], [0.7, 1.12], [0.66, 1.16], [0.6, 1.3], [0.42, 1.43], [0.0, 1.48]].map(([r, y]) => new THREE.Vector2(r, y + 0.22));
    const place = ([x, y, z, s]) => M.compose(P.set(x, y, z), Q.identity(), S.set(s, s, s));
    inst(new THREE.LatheGeometry(prof, 18), new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.5, metalness: 0.05 }), tanks, place);
    inst(new THREE.CylinderGeometry(0.17, 0.2, 0.09, 10).translate(0, 1.72, 0), new THREE.MeshStandardMaterial({ color: 0x2f5fa8, roughness: 0.5 }), tanks, place);
    inst(new THREE.BoxGeometry(1.7, 0.22, 1.7).translate(0, 0.11, 0), new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 0.9 }), tanks, place);
  }
  inst(new THREE.BoxGeometry(3.2, 2.7, 3.4).translate(0, 1.35, 0), plainMat.clone(), mumties,
    ([x, y, z, a]) => M.compose(P.set(x, y, z), Q.setFromAxisAngle(Y, a), S.set(1, 1, 1)));
  const acGeo = new THREE.BoxGeometry(0.8, 0.55, 0.3);
  if (util.length) {
    const um = new THREE.Mesh(mergeColored(util), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 }));
    um.castShadow = true; um.receiveShadow = true; um.name = 'hostel-services';
    group.add(um);
  }
  inst(acGeo, new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.5 }), acs,
    ([x, y, z, a]) => M.compose(P.set(x, y, z), Q.setFromAxisAngle(Y, a), S.set(1, 1, 1)));
  const solarGeo = new THREE.BoxGeometry(1.7, 0.05, 1.0).translate(0, 0.6, 0).rotateX(-0.35);
  buildRoofKit(group, roofKit);
  inst(solarGeo, solarMaterial(), solar,
    ([x, y, z, a]) => M.compose(P.set(x, y, z), Q.setFromAxisAngle(Y, a + Math.PI / 2), S.set(1, 1, 1)));
  // clothes drying on hostel corridor railings (a few shirts/towels per bay)
  const cg = [];
  const cc = ['#b3262f', '#f2f0ea', '#2b3a55', '#3f6fb0', '#f0c24b', '#5b7f3a', '#e38aa0', '#8d9091'];
  const cm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const clothGeo = (colA, colB) => {
    const g = new THREE.BufferGeometry();
    const p = [], c = [];
    const A = new THREE.Color(colA), Bc = new THREE.Color(colB);
    for (const [x0, w, h, col] of [[-0.55, 0.45, 0.55, A], [0.05, 0.5, 0.7, Bc]]) {
      p.push(x0, 0, 0, x0 + w, 0, 0, x0 + w, -h, 0, x0, 0, 0, x0 + w, -h, 0, x0, -h, 0);
      for (let k = 0; k < 6; k++) c.push(col.r, col.g, col.b);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.computeVertexNormals();
    return g;
  };
  for (let k = 0; k < 4; k++) cg.push(clothGeo(cc[k * 2], cc[(k * 2 + 3) % 8]));
  cg.forEach((geo, k) => inst(geo, cm, clothes.filter((c) => c[4] % 4 === k),
    ([x, y, z, a]) => M.compose(P.set(x, y, z), Q.setFromAxisAngle(Y, a), S.set(1, 1, 1)), false));

  return {
    group,
    counts: { ac: acs.length, clothes: clothes.length, solar: solar.length, roofPanels: roofKit.panels.length, heaters: roofKit.heaters.length, roofAcs: roofKit.acs.length, dishes: roofKit.dishes.length, rods: roofKit.rods.length, lines: roofKit.lines.length },
    roofKit,
    setNight(k, hour = 20) {
      for (const s of styles) mats[s].emissiveIntensity = k * 0.42;
      // share of windows lit per building type, by hour of night
      const h = hour < 12 ? hour + 24 : hour;           // 18 .. 30
      const hostel = h < 23 ? 0.72 : h < 26 ? 0.5 : h < 29 ? 0.18 : 0.3;
      // academic blocks: labs and the library stay busy until 2 am, then only the odd corridor light
      const acad = h < 20 ? 0.4 : h < 23 ? 0.28 : h < 26 ? 0.18 : h < 29.5 ? 0.025 : 0.08;
      const home = h < 22.5 ? 0.6 : h < 24 ? 0.3 : 0.06;
      litUniform.value.set(hostel, acad, home, h < 22 ? 0.3 : h < 26 ? 0.14 : 0.06);
      clockUniform.value = hour;
    },
  };
}

function toV2(ring) {
  const out = [];
  for (let i = 0; i < ring.length; i += 2) out.push(new THREE.Vector2(ring[i], ring[i + 1]));
  return out;
}

function randomInside(b, rnd, margin) {
  const tmp = { d: 0, x: 0, z: 0 };
  for (let t = 0; t < 25; t++) {
    const x = b.x0 + rnd() * (b.x1 - b.x0), z = b.z0 + rnd() * (b.z1 - b.z0);
    if (!pointInRing(x, z, b.rings[0])) continue;
    let bad = false;
    for (let k = 1; k < b.rings.length; k++) if (pointInRing(x, z, b.rings[k])) bad = true;
    if (bad) continue;
    let dmin = Infinity;
    for (const r of b.rings) dmin = Math.min(dmin, closestOnRing(x, z, r, tmp).d);
    if (dmin > margin) return [x, z];
  }
  return null;
}

function longestEdgeAngle(r) {
  let best = 0, ang = 0;
  for (let i = 0; i < r.length; i += 2) {
    const j = (i + 2) % r.length;
    const dx = r[j] - r[i], dz = r[j + 1] - r[i + 1], L = dx * dx + dz * dz;
    if (L > best) { best = L; ang = Math.atan2(dx, dz); }
  }
  return ang;
}
export { U };

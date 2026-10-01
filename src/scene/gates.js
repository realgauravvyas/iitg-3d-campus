// Campus gates. The Main Gate follows photos of the real one: a tall sandstone monolith on
// a central island ("Indian Institute of Technology Guwahati"), Hindi-name pillars on both
// sides, black gates with white bars, a domed guard room, a small brick guard post,
// black-and-white kerbs and - at night - warm-white fairy lights round the edges.
import * as THREE from 'three';
import { canvasTexture, mergeColored, m4, tube, drawCampusCrest } from '../util.js';

const SAND = '#b7a48a';
const HINDI = ['भारतीय', 'प्रौद्योगिकी', 'संस्थान', 'गुवाहाटी'];
// Assamese (ভাৰতীয় প্ৰযুক্তিবিদ্যা প্ৰতিষ্ঠান গুৱাহাটী) on the left pillar as you arrive (Hindi on the right)
const ASSAMESE = ['ভাৰতীয়', 'প্ৰযুক্তিবিদ্যা', 'প্ৰতিষ্ঠান', 'গুৱাহাটী'];
const BENG = '"Nirmala UI", "Vrinda", "Shonar Bangla", "Noto Sans Bengali", sans-serif';
const ENG = ['Indian', 'Institute', 'of', 'Technology', 'Guwahati'];
const DEVA = '"Nirmala UI", "Mangal", "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif';

function stoneTex(lines, { font = '"Hind", "Segoe UI", sans-serif', emblem = false, size = 78 } = {}) {
  return canvasTexture(512, 768, (g, W, H) => {
    // sandstone slab with faint joints and texture
    g.fillStyle = '#b3a492'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      const v = 150 + Math.random() * 50;
      g.fillStyle = `rgba(${v + 25},${v + 12},${v - 8},0.25)`;
      g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    g.strokeStyle = 'rgba(80,60,40,0.18)'; g.lineWidth = 2;
    for (let y = 96; y < H; y += 96) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    let y0 = 190;
    if (emblem) {
      drawCampusCrest(g, W / 2, 110, 58);        // an original crest, not the official logo
      y0 = 230;
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const step = Math.min(size * 1.12, (H - y0 - 70) / lines.length);
    lines.forEach((t, i) => {
      let fs = size;
      g.font = `600 ${fs}px ${font}`;
      while (g.measureText(t).width > W - 60 && fs > 30) { fs -= 3; g.font = `600 ${fs}px ${font}`; }
      g.fillStyle = 'rgba(40,34,28,0.75)'; g.fillText(t, W / 2 + 3, y0 + i * step + 4);          // the letters are raised steel: a shadow below and to the right,
      g.fillStyle = '#d4d0c8'; g.fillText(t, W / 2, y0 + i * step);                                // a light face, a brighter edge on top
      g.fillStyle = '#f2f0ea'; g.fillText(t, W / 2 - 1, y0 + i * step - 1.5);
    });
  }, { repeat: false });
}

function lightsTex() {
  return canvasTexture(256, 384, (g, W, H) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    // a string of bulbs round the edge of each slab (the name stays readable at night)
    for (let y = 8; y < H; y += 16) for (let x = 8; x < W; x += 16) { if (x > 30 && x < W - 30 && y > 30 && y < H - 30) continue; g.beginPath(); g.arc(x + ((y / 16) % 2) * 3, y, 2.4, 0, 7); g.fill(); }
  }, { repeat: false, srgb: false });
}


function nameTex(title, sub) {
  return canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = '#7d1f1f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c89b3c'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#f7f1e3'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 50px "Hind", "Segoe UI", sans-serif'; g.fillText(title, w / 2, 62);
    g.font = '28px "Hind", "Segoe UI", sans-serif'; g.fillText(sub, w / 2, 118);
  }, { repeat: false });
}

/** Builds all gates; returns { group, setNight(k, t), guardSpots } */
export function buildGates(world) {
  const group = new THREE.Group();
  group.name = 'gates';
  const lightsMap = lightsTex();
  const lightMats = [];
  const stoneMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const partsAll = [];
  const panels = [], swings = [], glowMats = [];
  const iron = '#1c1c1c', bar = '#f2f0ea';

  for (const gt of world.gates) {
    // gate frame: +X points out of the campus, Z runs along the wall
    const out = new THREE.Vector3(Math.cos(gt.angle), 0, -Math.sin(gt.angle));
    const y = world.heightAt(gt.wx, gt.wz);
    const gg = new THREE.Group();
    gg.position.set(gt.wx, y, gt.wz);
    gg.rotation.y = Math.atan2(out.x, out.z) - Math.PI / 2;
    const P = [];
    const special = gt.name === 'KV Gate' || gt.name === 'Khokha Gate';                // built from photos of the real gates (below)
    const add = (geo, color, mat) => P.push({ geometry: geo, color, matrix: mat });
    const sliding = (z0, z1, x, open) => { // sliding gate: black frame, white vertical bars
      const L = Math.abs(z1 - z0), zc = (z0 + z1) / 2 + (open ? Math.sign(zc0(z0, z1)) * L * 0.9 : 0);
      add(new THREE.BoxGeometry(0.08, 0.08, L), iron, m4(x, 1.9, zc));
      add(new THREE.BoxGeometry(0.08, 0.08, L), iron, m4(x, 0.2, zc));
      for (let k = 0; k <= L / 0.14; k++) add(new THREE.BoxGeometry(0.035, 1.7, 0.035), k % 6 === 0 ? iron : bar, m4(x, 1.05, zc - L / 2 + k * 0.14));
    };
    const zc0 = (a, b) => (a + b) / 2;
    // local ground height: the gates stand on slopes (the Main Gate falls ~2 m from the road
    // outside to the campus side), so every part is set on the ground where it stands
    const cr = Math.cos(gg.rotation.y), sr = Math.sin(gg.rotation.y);
    const gl = (lx, lz) => world.heightAt(gt.wx + cr * lx + sr * lz, gt.wz - sr * lx + cr * lz) - y;
    /** a block standing on the ground: top h above the ground at its centre, reaching below the lowest corner */
    const stand = (w, h, d, color, lx, lz, ry = 0) => {
      const c2 = Math.cos(ry), s2 = Math.sin(ry);
      let gmin = Infinity;
      for (const [a, b] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) gmin = Math.min(gmin, gl(lx + c2 * a + s2 * b, lz - s2 * a + c2 * b));
      const top = gl(lx, lz) + h, bot = gmin - 0.4;
      add(new THREE.BoxGeometry(w, top - bot, d), color, m4(lx, (top + bot) / 2, lz, 0, ry, 0));
      return top;
    };
    if (gt.main) {
      // central island (x -9.5..5.5, 2.9 m wide) with black-and-white kerbs and a lawn, following the slope
      for (let k = -7; k <= 7; k++) for (const sz of [1.55, -1.55]) stand(1.0, 0.28, 0.25, k % 2 ? '#1a1a1a' : '#f2f2ee', -2 + k * 1.0, sz);
      for (let k = 0; k < 15; k++) stand(1.02, 0.24, 2.9, '#4f7d34', -9 + k, 0);
      world.addSurface({ kind: 'box', x: gt.wx + cr * -2, z: gt.wz - sr * -2, hx: 7.6, hz: 1.5, yaw: gg.rotation.y, lift: 0.26 });   // the island's lawn: people step onto it, not into it
      // side pillars (Hindi / Assamese name) at both outer edges of the carriageways
      for (const s of [1, -1]) {
        stand(1.1, 5.2, 3.6, SAND, 0, s * 11.4, -s * 0.3);
        const zc = s * 12.4;          // the sliding gate stands open, slid behind the pillar
        const gy0 = gl(0.7, zc);
        const L = 7.5;
        add(new THREE.BoxGeometry(0.08, 0.08, L), iron, m4(0.7, gy0 + 1.9, zc));
        add(new THREE.BoxGeometry(0.08, 0.08, L), iron, m4(0.7, gy0 + 0.2, zc));
        for (let k = 0; k <= L / 0.14; k++) add(new THREE.BoxGeometry(0.035, 1.7, 0.035), k % 6 === 0 ? iron : bar, m4(0.7, gy0 + 1.05, zc - L / 2 + k * 0.14));
        for (let k = 0; k < 12; k++) stand(0.9, 0.28, 0.25, k % 2 ? '#1a1a1a' : '#f2f2ee', -1 - k * 0.9, s * 9.8);
      }
      // guard room with a white dome (right) and a small brick guard post (left)
      { const g0 = gl(-7, -14.5), gmin = Math.min(g0, gl(-9.1, -14.5), gl(-4.9, -14.5), gl(-7, -16.6), gl(-7, -12.4)) - 0.4;
        add(new THREE.CylinderGeometry(2.1, 2.1, g0 + 2.8 - gmin, 16), '#f1efe8', m4(-7, (g0 + 2.8 + gmin) / 2, -14.5));
        add(new THREE.SphereGeometry(2.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#f7f6f2', m4(-7, g0 + 2.8, -14.5));
        add(new THREE.BoxGeometry(0.1, 1.1, 1.2), '#2c3e50', m4(-4.95, g0 + 1.5, -14.5)); }
      // the small guard post on the left (inside the wall): red brick, a flat roof with a cream edge, a barred window on the road side,
      // a small one facing the approach, a plank door on the campus side, a name plate and a lamp; a step at the door
      { const cx2 = -7, cz2 = 14.5, hw = 1.3, g0 = gl(cx2, cz2), y0 = g0 + 0.32, wallH = 2.45;
        stand(2.9, 0.32, 2.9, '#a29c90', cx2, cz2);                                                  // the concrete plinth
        const brickBase = canvasTexture(192, 136, (c, w, h) => {
          c.fillStyle = '#cdbfa9'; c.fillRect(0, 0, w, h);                                           // mortar
          for (let row = 0; row < 8; row++) for (let k = -1; k < 5; k++) {
            const x0 = k * 48 + (row % 2 ? 24 : 0), v = Math.floor(Math.random() * 36), burnt = Math.random() < 0.08 ? 28 : 0;
            c.fillStyle = 'rgb(' + (156 + v - burnt) + ',' + (68 + (v >> 1) - burnt) + ',' + (48 + (v >> 2) - burnt / 2) + ')'; c.fillRect(x0 + 2, row * 17 + 2, 44, 14);
            c.fillStyle = 'rgba(255,225,190,0.14)'; c.fillRect(x0 + 2, row * 17 + 2, 44, 2);          // the lit top edge of each brick
          }
          for (let k = 0; k < 160; k++) { c.fillStyle = 'rgba(40,20,10,' + (Math.random() * 0.18) + ')'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
        });
        brickBase.wrapS = brickBase.wrapT = THREE.RepeatWrapping;
        const brickMat = new THREE.MeshStandardMaterial({ map: brickBase, roughness: 0.92 });
        // four brick walls (a plane each; the picture repeats every 0.96 x 0.68 m, so the courses stay the size of real bricks)
        const wall = (w, lx, lz, ry) => {
          const g2 = new THREE.PlaneGeometry(w, wallH), uv = g2.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 0.96), uv.getY(i) * (wallH / 0.68));
          const m2 = new THREE.Mesh(g2, brickMat); m2.position.set(lx, y0 + wallH / 2, lz); m2.rotation.y = ry; m2.castShadow = true; m2.receiveShadow = true; gg.add(m2);
        };
        wall(hw * 2, cx2 + hw, cz2, Math.PI / 2); wall(hw * 2, cx2 - hw, cz2, -Math.PI / 2); wall(hw * 2, cx2, cz2 + hw, 0); wall(hw * 2, cx2, cz2 - hw, Math.PI);
        // the roof: a slab with a cream edge and a thin maroon drip course, a little overhang
        add(new THREE.BoxGeometry(2 * hw + 0.5, 0.14, 2 * hw + 0.5), '#d6d2c6', m4(cx2, y0 + wallH + 0.07, cz2));
        add(new THREE.BoxGeometry(2 * hw + 0.56, 0.05, 2 * hw + 0.56), '#7d2b2b', m4(cx2, y0 + wallH - 0.02, cz2));
        // the window on the road side (-z): a dark frame, bluish glass, iron bars, a cream sill
        { const wz = cz2 - hw - 0.02, wy = y0 + 1.55;
          add(new THREE.BoxGeometry(1.4, 1.1, 0.06), '#2b2f33', m4(cx2 - 0.1, wy, wz));
          add(new THREE.BoxGeometry(1.22, 0.92, 0.07), '#4f6b7c', m4(cx2 - 0.1, wy, wz - 0.01));
          for (let k = 0; k <= 8; k++) add(new THREE.BoxGeometry(0.025, 1.0, 0.025), '#1c1c1c', m4(cx2 - 0.1 - 0.6 + k * 0.15, wy, wz - 0.06));
          add(new THREE.BoxGeometry(1.0, 0.04, 0.04), '#1c1c1c', m4(cx2 - 0.1, wy + 0.1, wz - 0.07));
          add(new THREE.BoxGeometry(1.6, 0.07, 0.22), '#d9d2c1', m4(cx2 - 0.1, wy - 0.58, wz - 0.07)); }
        // the small window facing the approach (+x)
        { const wx = cx2 + hw + 0.02, wy = y0 + 1.55;
          add(new THREE.BoxGeometry(0.06, 0.8, 0.9), '#2b2f33', m4(wx, wy, cz2));
          add(new THREE.BoxGeometry(0.07, 0.64, 0.74), '#4f6b7c', m4(wx + 0.01, wy, cz2));
          for (let k = 0; k <= 4; k++) add(new THREE.BoxGeometry(0.025, 0.7, 0.025), '#1c1c1c', m4(wx + 0.06, wy, cz2 - 0.35 + k * 0.175));
          add(new THREE.BoxGeometry(0.22, 0.07, 1.1), '#d9d2c1', m4(wx + 0.07, wy - 0.42, cz2)); }
        // the plank door on the campus side (-x), a steel handle, a step and a lamp
        { const dx = cx2 - hw - 0.03;
          add(new THREE.BoxGeometry(0.07, 2.05, 1.0), '#3a2a1a', m4(dx, y0 + 1.03, cz2));
          for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.05, 1.95, 0.17), k % 2 ? '#7a5632' : '#6b4a2e', m4(dx - 0.01, y0 + 1.03, cz2 - 0.4 + k * 0.2));
          add(new THREE.BoxGeometry(0.06, 0.04, 0.2), '#c9ced4', m4(dx - 0.05, y0 + 1.0, cz2 + 0.35));
          add(new THREE.BoxGeometry(0.7, 0.14, 1.5), '#b9b3a6', m4(dx - 0.35, g0 + 0.07, cz2));
          add(new THREE.BoxGeometry(0.2, 0.2, 0.2), '#fff2c4', m4(dx - 0.16, y0 + 2.28, cz2 + 0.78)); }
        // the name plate over the road-side window
        { const pt = canvasTexture(512, 112, (c, w, h) => { c.fillStyle = '#7d1f1f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f2ede2'; c.lineWidth = 5; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#f2ede2'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 54px "Hind", "Segoe UI", sans-serif'; c.fillText('MAIN GATE SECURITY', w / 2, h / 2 + 2, w - 40); }, { repeat: false });
          const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.37), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.6 }));
          pm.position.set(cx2 - 0.1, y0 + 2.2, cz2 - hw - 0.012); pm.rotation.y = Math.PI; gg.add(pm); } }
      // the colour-banded bollards along both edges of the lawn (yellow, green, white, red) and big pots with palms on it
      for (let k = 0; k < 9; k++) for (const sz of [1.62, -1.62]) {
        const bx = -8.2 + k * 1.75 + (sz > 0 ? 0 : 0.8), bg = gl(bx, sz);
        for (let b = 0; b < 4; b++) add(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 8), ['#e9c21f', '#2f9e55', '#f4f4ef', '#c8372d'][(b + k) % 4], m4(bx, bg + 0.11 + b * 0.22 + 0.25, sz));
        add(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), '#8a8f96', m4(bx, bg + 0.12, sz));
      }
      for (const [px2, pz2] of [[-5.2, 0.4], [-1.0, -0.6], [2.4, 0.2], [-8.4, -0.5]]) {
        const pg = gl(px2, pz2);
        add(new THREE.CylinderGeometry(0.42, 0.3, 0.6, 12), '#d8c3a0', m4(px2, pg + 0.55, pz2));
        for (let f = 0; f < 9; f++) { const an = f / 9 * Math.PI * 2; add(new THREE.ConeGeometry(0.1, 1.3, 4), '#3e8a3a', m4(px2 + Math.cos(an) * 0.3, pg + 1.35, pz2 + Math.sin(an) * 0.3, Math.sin(an) * 0.6, 0, -Math.cos(an) * 0.6)); }
      }
      for (const s2 of [1, -1]) {                            // the cream wall beyond each pillar, with a maroon coping
        for (let k = 0; k < 4; k++) { const zz = s2 * (14.6 + k * 3.9); stand(0.45, 1.7, 3.9, '#ece3cf', 0.0, zz); stand(0.6, 0.14, 4.0, '#7d2b2b', 0.0, zz); }
      }
      // STOP sign
      { const g0 = gl(2.4, 10.3);
        add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), '#8a8a8a', m4(2.4, g0 + 1.2, 10.3));
        add(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 8), '#c62828', m4(2.4, g0 + 2.3, 10.3, 0, 0, Math.PI / 2)); }
      // the two carriageways go round the island: vehicles keep to them (world.dividers, used by the
      // traffic lane offsets), and cycles / cars cannot cross the island (kerb) or hit the stone
      const W2 = (lx, lz) => ({ x: gt.wx + cr * lx + sr * lz, z: gt.wz - sr * lx + cr * lz });
      (world.dividers ||= []).push({ x: gt.wx, z: gt.wz, ax: cr, az: -sr, bx: sr, bz: cr, u0: -9.8, u1: 5.8, half: 2.3, ramp: 16, span: 13 });
      const box = (lx0, lz0, lx1, lz1, top, bikeOnly) => {
        const c = [W2(lx0, lz0), W2(lx1, lz0), W2(lx1, lz1), W2(lx0, lz1)];
        for (let q = 0; q < 4; q++) world.indexFence({ ax: c[q].x, az: c[q].z, bx: c[(q + 1) % 4].x, bz: c[(q + 1) % 4].z, top, bikeOnly });
      };
      box(-9.6, -1.7, 5.6, 1.7, y + 1.2, true);                       // island kerb: no cycles or cars across
      box(-2.6, -2.2, -1.4, 2.2, y + 8, false);                       // the name stone
      box(-8.35, 13.15, -5.65, 15.85, y + 3.2, false);                // the brick guard post
      { const c0 = W2(-7, 12.7), c1 = W2(-7, 11.7);                    // where the guard's chair stands (facing the road), for life/neighbourhood.js
        world.mainPost = { x: c0.x, z: c0.z, yaw: Math.atan2(c1.x - c0.x, c1.z - c0.z), post: W2(-7, 14.5) }; }
      for (const s of [1, -1]) box(-0.55, s * 11.4 - 1.8, 0.55, s * 11.4 + 1.8, y + 7, false);   // pillars
    } else {
      // named / service gate: two pillars, sliding gates, guard booth, boom barrier
      if (!special) for (const s of [-1, 1]) {
        const top = stand(1.3, 4.6, 1.3, '#d9cfbd', 0, s * 6.2);
        add(new THREE.BoxGeometry(1.5, 0.3, 1.5), '#8f2f2a', m4(0, top + 0.15, s * 6.2));
      }
      if (special) { /* the gate leaves are built below */ }
      else if (gt.closed || !gt.name) { sliding(-5.5, 0, 0.4, !gt.closed); sliding(0, 5.5, 0.4, !gt.closed); }
      else {
        // KV and Khokha gates slide shut at 10 pm and open at 6 am
        for (const [z0, z1] of [[-5.5, 0], [0, 5.5]]) {
          const Q = [], L = 5.5, zc = (z0 + z1) / 2;
          Q.push({ geometry: new THREE.BoxGeometry(0.08, 0.08, L), color: iron, matrix: m4(0.4, 1.9, zc) });
          Q.push({ geometry: new THREE.BoxGeometry(0.08, 0.08, L), color: iron, matrix: m4(0.4, 0.2, zc) });
          for (let k = 0; k <= L / 0.14; k++) Q.push({ geometry: new THREE.BoxGeometry(0.035, 1.7, 0.035), color: k % 6 === 0 ? iron : bar, matrix: m4(0.4, 1.05, zc - L / 2 + k * 0.14) });
          const pm = new THREE.Mesh(mergeColored(Q), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
          pm.castShadow = true;
          gg.add(pm);
          panels.push({ m: pm, gate: gt, open: Math.sign(zc) * L * 0.95, k: 1 });
        }
      }
      if (!gt.closed) {
        if (gt.name === 'KV Gate') {
          // the guard post left of the IITG sign, outside the steel gate: a low booth PRINTED IN CEMENT, layer by layer (every layer a
          // slightly different width, so the ridges of the printing nozzle show), a steel railing along its back, a register on it, a plaque
          const X = 1.5, Z = -2.4, Lp = 2.5, Dp = 0.8, Hp = 1.0, NL = 15, lh = Hp / NL;
          const gmin = Math.min(gl(X - Dp / 2, Z - Lp / 2), gl(X + Dp / 2, Z - Lp / 2), gl(X + Dp / 2, Z + Lp / 2), gl(X - Dp / 2, Z + Lp / 2)) - 0.3, g0 = gl(X, Z);
          add(new THREE.BoxGeometry(Dp - 0.02, g0 - gmin + 0.06, Lp - 0.02), '#9d9a92', m4(X, (g0 + 0.06 + gmin) / 2, Z));
          for (let k = 0; k < NL; k++) {
            const w1 = (k % 2 ? 0.05 : 0) + ((k * 7) % 3) * 0.012, l1 = (k % 2 ? 0.06 : 0) + ((k * 5) % 3) * 0.014;
            add(new THREE.BoxGeometry(Dp + w1, lh * 0.94, Lp + l1), ['#b5b2a9', '#a8a59c', '#bdbab1', '#aeaba2'][k % 4], m4(X, g0 + 0.06 + lh * (k + 0.5), Z + ((k * 13) % 5 - 2) * 0.006));
            // the printed infill zig-zag shows on the top layer
          }
          add(new THREE.BoxGeometry(Dp + 0.08, 0.05, Lp + 0.1), '#c3c0b7', m4(X, g0 + 0.06 + Hp + 0.02, Z));
          for (let k = 0; k < 14; k++) add(new THREE.BoxGeometry(0.03, 0.02, Dp - 0.12), '#9b988f', m4(X, g0 + 0.06 + Hp + 0.06, Z - Lp / 2 + 0.12 + k * (Lp - 0.24) / 13, 0, k % 2 ? 0.6 : -0.6, 0));
          // the railing along the back: two posts at the ends, three rails, and the little gate in the middle
          for (const zz of [-Lp / 2 + 0.05, Lp / 2 - 0.05]) add(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), '#c9ced3', m4(X - Dp / 2 + 0.05, g0 + 0.06 + Hp + 0.55, Z + zz));
          for (const hh of [0.3, 0.65, 1.0]) add(new THREE.CylinderGeometry(0.02, 0.02, Lp - 0.1, 6).rotateX(Math.PI / 2), '#c9ced3', m4(X - Dp / 2 + 0.05, g0 + 0.06 + Hp + hh, Z));
          for (let k = 0; k <= 10; k++) add(new THREE.CylinderGeometry(0.013, 0.013, 0.7, 5), '#c9ced3', m4(X - Dp / 2 + 0.05, g0 + 0.06 + Hp + 0.65, Z - Lp / 2 + 0.1 + k * (Lp - 0.2) / 10));
          // two registers with a pen on the top, one in front of each guard
          for (const dz of [-0.6, 0.6]) {
            add(new THREE.BoxGeometry(0.34, 0.03, 0.26), '#f2f0ea', m4(X - 0.05, g0 + 0.06 + Hp + 0.1, Z + dz));
            add(new THREE.BoxGeometry(0.34, 0.012, 0.012), '#1f3a6e', m4(X - 0.05, g0 + 0.06 + Hp + 0.13, Z + dz - 0.04));
            add(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 5).rotateX(Math.PI / 2), '#1f3a6e', m4(X + 0.12, g0 + 0.06 + Hp + 0.13, Z + dz + 0.12));
          }
          add(new THREE.BoxGeometry(0.36, 0.3, 0.3), '#2d2d2d', m4(X + 0.05, g0 + 0.06 + Hp + 0.2, Z));           // the bell / tin of tokens between the registers
          const plaque = (t1, t2) => canvasTexture(512, 192, (c, w, h) => { c.fillStyle = '#20242a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e6c75a'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e6c75a'; c.font = 'bold 78px "Hind", "Segoe UI", sans-serif'; c.fillText(t1, w / 2, 82, w - 40); c.fillStyle = '#f4efe6'; c.font = '34px "Hind", "Segoe UI", sans-serif'; c.fillText(t2, w / 2, 148, w - 40); }, { repeat: false });
          const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.56), new THREE.MeshStandardMaterial({ map: plaque('3D PRINTED', 'Guard post printed in cement'), roughness: 0.6 }));
          pl.position.set(X + Dp / 2 + 0.1, g0 + 0.66, Z); pl.rotation.y = Math.PI / 2; gg.add(pl);
          add(new THREE.BoxGeometry(0.04, 0.6, 1.6), '#3b3f44', m4(X + Dp / 2 + 0.07, g0 + 0.66, Z));
          // where it is, for the guards who sit behind it (life/neighbourhood.js) and for walking into it
          (world.printedPosts ||= []).push({ gate: gt, lx: X - 0.75, lz: Z, dz: 0.6 });
          world.addSolid(gt.wx + cr * X + sr * Z, gt.wz - sr * X + cr * Z, 1.3, 'printedpost', true);
        } else if (gt.name !== 'Khokha Gate') {
          const top = stand(2.4, 2.6, 2.4, '#e7dfcf', -3, 8.8);
          add(new THREE.BoxGeometry(2.9, 0.2, 2.9), '#8f2f2a', m4(-3, top + 0.1, 8.8));
        }
        if (!special) add(tube(new THREE.Vector3(-1.6, 1.0, 5.4), new THREE.Vector3(-1.6, 3.9, 5.4), 0.06), '#d8c23a');
      }
    }
    if (special) {
      const KV = gt.name === 'KV Gate', nm = new THREE.Matrix4();
      void nm;
      const solid = (w, h, d, color, lx, lz, ry = 0) => stand(w, h, d, color, lx, lz, ry);
      /** a flat mesh laid on the ground (x0..x1 out of the wall, z0..z1 along it), lifted a little above it */
      const laid = (x0, x1, z0, z1, tex, lift = 0.07, tiles = [1, 1], color = 0xffffff) => {
        const nx2 = Math.max(2, Math.round((x1 - x0) / 1.5)), nz2 = Math.max(2, Math.round((z1 - z0) / 1.5));
        const g2 = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx2, nz2).rotateX(-Math.PI / 2);
        const pa = g2.attributes.position, uv = g2.attributes.uv;
        for (let i = 0; i < pa.count; i++) { const lx = pa.getX(i) + (x0 + x1) / 2, lz = pa.getZ(i) + (z0 + z1) / 2; pa.setXYZ(i, lx, gl(lx, lz) + lift, lz); uv.setXY(i, uv.getX(i) * tiles[0], uv.getY(i) * tiles[1]); }
        g2.computeVertexNormals();
        const m2 = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
        m2.receiveShadow = true; gg.add(m2); return m2;
      };
      const tiled = (tex, rx, ry) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(rx, ry); return tex; };
      /** a steel grille leaf (a dark frame, vertical bars with a silver finish, a mid rail and a diagonal brace) */
      const leaf = (Lw, h, x, zc, { solidLow = 0, colA = '#1b1f22', colB = '#b9bfc5', open = 0 } = {}) => {
        const Q = [], g0 = gl(x, zc);
        const q = (w, hh, d, lx, ly, lz, col, rx = 0, ry = 0, rz = 0) => Q.push({ geometry: new THREE.BoxGeometry(w, hh, d), color: col, matrix: m4(lx, g0 + ly, lz, rx, ry, rz) });
        q(0.08, h, 0.08, x, h / 2 + 0.1, zc - Lw / 2 + 0.04, colA); q(0.08, h, 0.08, x, h / 2 + 0.1, zc + Lw / 2 - 0.04, colA);
        q(0.08, 0.08, Lw, x, h + 0.06, zc, colA); q(0.08, 0.08, Lw, x, 0.14, zc, colA); q(0.06, 0.06, Lw, x, h * 0.55, zc, colA);
        if (solidLow > 0) q(0.03, solidLow, Lw - 0.1, x, 0.14 + solidLow / 2, zc, colA);                                       // the steel sheet along the bottom
        for (let k = 0; k <= Lw / 0.13; k++) q(0.03, h - 0.1 - solidLow, 0.03, x + 0.015, 0.14 + solidLow + (h - 0.1 - solidLow) / 2, zc - Lw / 2 + 0.1 + k * 0.13, k % 3 === 0 ? colA : colB);
        const dgl = Math.hypot(Lw - 0.2, h - 0.3); q(0.04, dgl, 0.04, x, h / 2 + 0.1, zc, colA, 0, 0, Math.atan2(Lw - 0.2, h - 0.3) * 0);       // (the brace is drawn below as a rotated bar)
        Q.pop();
        const ang = Math.atan2(h - 0.3, Lw - 0.2);
        Q.push({ geometry: new THREE.BoxGeometry(0.05, 0.05, dgl), color: colA, matrix: m4(x, g0 + h / 2 + 0.1, zc, -ang, 0, 0, 1, 1, 1, 'XYZ') });
        const pm = new THREE.Mesh(mergeColored(Q), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.5 }));
        pm.castShadow = true; gg.add(pm);
        return pm;
      };
      if (KV) {
        // ---- the KV Gate, as it looks from the road outside: on the left a tall brown pillar with a lamp and the steel grille gate folded
        // back beside it; on the right a big brown signboard wall with the institute's name in white letters, lit at night, a cream
        // guard room with a dark maroon roof and a barred window; a brick footpath and red plastic barriers along the kerb
        const Zp = 5.7, Zw0 = -5.6, Zw1 = -12.2;
        const topL = solid(0.78, 4.3, 0.78, '#7a5232', 0, Zp);
        add(new THREE.BoxGeometry(1.0, 0.22, 1.0), '#5a3a22', m4(0, topL + 0.11, Zp));
        add(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 6), '#2b2b2b', m4(0.0, topL + 0.85, Zp));
        add(new THREE.BoxGeometry(0.9, 0.06, 0.06), '#2b2b2b', m4(0.45, topL + 1.55, Zp));
        add(new THREE.BoxGeometry(0.34, 0.22, 0.3), '#fff2c4', m4(0.9, topL + 1.45, Zp));                                      // the lamp over the road
        solid(0.5, 3.6, Math.abs(Zw1 - Zw0), '#b86a3c', 0, (Zw0 + Zw1) / 2);                                                     // the signboard wall (rust-brown plaster)
        solid(0.62, 0.3, Math.abs(Zw1 - Zw0) + 0.3, '#8f4e2a', 0, (Zw0 + Zw1) / 2);                                              // its plinth
        // the sign: copper-brown board, our own round crest, IITG in big white letters, the full name below
        const signTex = canvasTexture(1024, 640, (c, w, h) => {
          const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#7d4a2e'); gr.addColorStop(1, '#5a3422'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
          for (let k = 0; k < 900; k++) { c.fillStyle = 'rgba(255,220,180,' + (Math.random() * 0.05) + ')'; c.fillRect(Math.random() * w, Math.random() * h, 2, 20 + Math.random() * 40); }
          drawCampusCrest(c, w / 2, 150, 92);
          c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.font = '800 280px "Hind", "Segoe UI", Arial, sans-serif'; c.fillText('IITG', w / 2, 392, w - 60);
          c.font = '600 46px "Hind", "Segoe UI", Arial, sans-serif'; c.fillText('INDIAN INSTITUTE OF TECHNOLOGY', w / 2, 556, w - 60); c.fillText('GUWAHATI', w / 2, 604, w - 60);
        }, { repeat: false });
        const sm = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0 });
        glowMats.push(sm);
        const sgn = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.25), sm);
        sgn.position.set(0.27, gl(0.27, (Zw0 + Zw1) / 2) + 2.1, (Zw0 + Zw1) / 2 + 0.3); sgn.rotation.y = Math.PI / 2; gg.add(sgn);
        add(new THREE.BoxGeometry(0.06, 3.5, 5.4), '#3d2618', m4(0.22, gl(0.22, (Zw0 + Zw1) / 2) + 2.1, (Zw0 + Zw1) / 2 + 0.3));   // its dark frame
        // the steel grille fence between the pillar and the wall, black with a white base, and the gate leaves on rails
        for (const [zc, zs] of [[Zp - 0.7 - 2.6, 1], [Zw0 + 0.5 + 2.6, -1]]) {
          const pm = leaf(5.2, 2.2, -0.45, zc, { solidLow: 0.45, colB: '#d8dde2' });
          panels.push({ m: pm, gate: gt, open: zs * 5.2 * 0.98, k: 1 });
        }
        // the IIT Sub Post Office, built on to the end of the sign wall: a low white building with a corrugated rust-brown roof, a red board
        // with its name, louvred windows, two painted panels, a blue and white geometric base, a red letter box by the door
        { const pzc = -18.4, pl = 9.6, dp = 4.2, fx = 0.6, bh = 3.3, cx2 = fx - dp / 2, g0 = gl(cx2, pzc);
          void g0;
          solid(0.55, 2.7, 0.9, '#c9803f', 0, -12.8);                                          // the orange plastered wall between the sign and the post office
          solid(dp, bh, pl, '#ece8dc', cx2, pzc);
          // the front of the building is drawn on one picture: 160 pixels to the metre, its left edge at the sign (more negative z to the right)
          const PW = 1536, PH = 528, px = PW / pl;
          const face = canvasTexture(PW, PH, (c) => {
            const m = (u) => u * px, yy = (y) => PH - y * 160;
            c.fillStyle = '#ebe7db'; c.fillRect(0, 0, PW, PH);
            for (let k = 0; k < 60; k++) { c.fillStyle = 'rgba(80,70,50,' + (0.02 + Math.random() * 0.04) + ')'; c.fillRect(Math.random() * PW, 0, 4 + Math.random() * 10, PH * (0.3 + Math.random() * 0.6)); }       // rain streaks
            // the blue and white geometric base with its dark left end
            c.fillStyle = '#1f62c9'; c.fillRect(0, yy(0.9), PW, 0.9 * 160);
            c.strokeStyle = '#f4f7fb'; c.lineWidth = 6;
            for (let x0 = 0; x0 < PW; x0 += 150) { c.beginPath(); c.moveTo(x0, yy(0.9)); c.lineTo(x0 + 75, yy(0)); c.lineTo(x0 + 150, yy(0.9)); c.moveTo(x0 + 40, yy(0.9)); c.lineTo(x0 + 110, yy(0.3)); c.stroke(); }
            c.fillStyle = '#2a2d57'; c.fillRect(0, yy(0.9), m(0.9), 0.9 * 160); c.fillStyle = '#3aa65a'; c.beginPath(); c.moveTo(m(9.3), yy(0.9)); c.lineTo(m(9.6), yy(0.9)); c.lineTo(m(9.6), yy(0.2)); c.closePath(); c.fill();
            c.fillStyle = '#9b9588'; c.fillRect(0, yy(0.96), PW, 7);                                 // the plinth line
            // louvred windows: a dark frame, pale slats, a mullion
            const win = (u0, u1) => { c.fillStyle = '#d9d6cc'; c.fillRect(m(u0) - 6, yy(2.35) - 6, m(u1 - u0) + 12, 1.4 * 160 + 12); c.fillStyle = '#3c4148'; c.fillRect(m(u0), yy(2.35), m(u1 - u0), 1.4 * 160); for (let y0 = yy(2.3); y0 < yy(1.0); y0 += 11) { c.fillStyle = 'rgba(236,233,224,0.9)'; c.fillRect(m(u0) + 3, y0, m(u1 - u0) - 6, 6); } c.fillStyle = '#d9d6cc'; c.fillRect(m((u0 + u1) / 2) - 3, yy(2.35), 6, 1.4 * 160); };
            win(1.1, 2.9); win(5.0, 6.3); win(8.3, 9.3);
            // the two painted panels: a farmer among the crops (orange dusk), a river and a boat (green)
            const panel = (u0, u1, sky, draw) => { c.fillStyle = '#20242a'; c.fillRect(m(u0) - 6, yy(2.4) - 6, m(u1 - u0) + 12, 1.5 * 160 + 12); c.save(); c.beginPath(); c.rect(m(u0), yy(2.4), m(u1 - u0), 1.5 * 160); c.clip(); c.fillStyle = sky; c.fillRect(m(u0), yy(2.4), m(u1 - u0), 1.5 * 160); draw(m(u0), yy(2.4), m(u1 - u0), 1.5 * 160); c.restore(); };
            panel(3.15, 4.75, '#e8873a', (x, y, w, h) => { c.fillStyle = '#f6c255'; c.beginPath(); c.arc(x + w * 0.72, y + h * 0.3, w * 0.12, 0, 7); c.fill(); c.fillStyle = '#3f7a2f'; for (let k = 0; k < 9; k++) { c.beginPath(); c.moveTo(x + k * w / 8, y + h); c.lineTo(x + k * w / 8 + 10, y + h * 0.5); c.lineTo(x + k * w / 8 + 22, y + h); c.fill(); } c.fillStyle = '#6b3d1f'; c.fillRect(x + w * 0.3, y + h * 0.42, w * 0.12, h * 0.5); c.fillStyle = '#d9a66c'; c.beginPath(); c.arc(x + w * 0.36, y + h * 0.33, w * 0.07, 0, 7); c.fill(); c.fillStyle = '#c9a65a'; c.beginPath(); c.ellipse(x + w * 0.36, y + h * 0.27, w * 0.11, w * 0.03, 0, 0, 7); c.fill(); });
            panel(6.55, 8.1, '#77b7d9', (x, y, w, h) => { c.fillStyle = '#3b7fb0'; c.fillRect(x, y + h * 0.62, w, h * 0.4); c.fillStyle = '#4a8a3a'; c.beginPath(); c.moveTo(x, y + h * 0.62); c.lineTo(x + w * 0.3, y + h * 0.3); c.lineTo(x + w * 0.6, y + h * 0.62); c.fill(); c.fillStyle = '#5a3a1f'; c.fillRect(x + w * 0.55, y + h * 0.6, w * 0.28, h * 0.07); c.fillStyle = '#f2f0ea'; c.beginPath(); c.moveTo(x + w * 0.68, y + h * 0.6); c.lineTo(x + w * 0.68, y + h * 0.32); c.lineTo(x + w * 0.8, y + h * 0.6); c.fill(); });
            // tall decorative strips (maroon with a gold pattern) at the ends
            for (const [u0, u1] of [[0.25, 0.75], [9.0, 9.22]]) { c.fillStyle = '#9b2d3a'; c.fillRect(m(u0), yy(2.4), m(u1 - u0), 1.5 * 160); c.fillStyle = '#e9b84a'; for (let y0 = yy(2.3); y0 < yy(1.0); y0 += 18) { c.beginPath(); c.moveTo(m((u0 + u1) / 2), y0); c.lineTo(m(u1) - 4, y0 + 9); c.lineTo(m((u0 + u1) / 2), y0 + 18); c.lineTo(m(u0) + 4, y0 + 9); c.fill(); } }
            // the red name board, under the roof edge: a yellow swoosh and the name in white
            c.fillStyle = '#c81f3c'; c.fillRect(m(4.1), yy(3.2), m(5.5), 0.72 * 160);
            c.strokeStyle = '#f2c12e'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(m(4.25), yy(2.72)); c.quadraticCurveTo(m(4.8), yy(2.45), m(5.2), yy(3.1)); c.stroke();
            c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 46px "Hind", "Segoe UI", sans-serif'; c.fillText('SUB POST OFFICE', m(7.35), yy(3.0), m(3.9));
            c.font = '700 34px "Hind", "Segoe UI", sans-serif'; c.fillText('IIT GUWAHATI · 781039', m(7.35), yy(2.78), m(3.9));
          }, { repeat: false });
          const fm = new THREE.Mesh(new THREE.PlaneGeometry(pl, bh), new THREE.MeshStandardMaterial({ map: face, roughness: 0.85 }));
          fm.position.set(fx + 0.012, gl(cx2, pzc) + bh / 2, pzc); fm.rotation.y = Math.PI / 2; fm.receiveShadow = true; gg.add(fm);
          // the roof: corrugated iron, rust-brown, sloping to the road, a wide overhang, on timber rafters
          const tin = canvasTexture(128, 128, (c, w, h) => { c.fillStyle = '#7d4a36'; c.fillRect(0, 0, w, h); for (let y0 = 0; y0 < h; y0 += 8) { c.fillStyle = 'rgba(255,200,170,0.22)'; c.fillRect(0, y0, w, 3); c.fillStyle = 'rgba(40,15,8,0.35)'; c.fillRect(0, y0 + 4, w, 3); } for (let k = 0; k < 160; k++) { c.fillStyle = 'rgba(170,80,40,' + (Math.random() * 0.35) + ')'; c.fillRect(Math.random() * w, Math.random() * h, 9 + Math.random() * 18, 3 + Math.random() * 5); } });
          tin.wrapS = tin.wrapT = THREE.RepeatWrapping; tin.repeat.set(1, 22);
          const roof = new THREE.Mesh(new THREE.BoxGeometry(dp + 1.0, 0.09, pl + 1.0), [0, 1, 2, 3, 4, 5].map((q) => new THREE.MeshStandardMaterial({ map: q === 2 ? tin : null, color: q === 2 ? 0xffffff : 0x5a3326, roughness: 0.8, metalness: q === 2 ? 0.25 : 0 })));
          roof.position.set(cx2 + 0.1, gl(cx2, pzc) + bh + 0.3, pzc); roof.rotation.z = -0.13; roof.castShadow = true; gg.add(roof);
          add(new THREE.BoxGeometry(dp + 0.4, 0.22, pl + 0.2), '#d6d2c6', m4(cx2, gl(cx2, pzc) + bh + 0.1, pzc));
          for (const zz of [-4.5, 0, 4.5]) add(new THREE.BoxGeometry(0.06, 0.06, 0.06), '#7a5a3a', m4(fx + 0.3, gl(cx2, pzc) + bh + 0.2, pzc + zz));
          add(new THREE.BoxGeometry(0.9, 0.08, pl - 0.6), '#7a7468', m4(fx + 0.35, gl(fx, pzc) + 0.06, pzc));                      // the step along the front
          // the red letter box by the door
          add(new THREE.CylinderGeometry(0.22, 0.24, 0.95, 12), '#c81f3c', m4(fx + 0.85, gl(fx + 0.85, -14.2) + 0.48, -14.2));
          add(new THREE.SphereGeometry(0.22, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#a8162f', m4(fx + 0.85, gl(fx + 0.85, -14.2) + 0.95, -14.2));
          add(new THREE.BoxGeometry(0.16, 0.03, 0.02), '#15181b', m4(fx + 0.63, gl(fx + 0.85, -14.2) + 0.8, -14.2));
          // a light over the board, a cycle against the wall
          add(new THREE.BoxGeometry(0.06, 0.06, 0.9), '#f4f1e2', m4(fx + 0.1, gl(fx, pzc) + 3.05, pzc - 2.0));
        }
        // the brick footpath outside on the left, with a round concrete planter
        const brick = canvasTexture(128, 128, (c, w, h) => { c.fillStyle = '#b87e5a'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) { const v = 150 + Math.floor(Math.random() * 40); c.fillStyle = 'rgb(' + (v + 25) + ',' + (v - 35) + ',' + (v - 70) + ')'; c.fillRect(x + 1, y + 1, 30, 14); } });
        laid(1.0, 14.5, 3.2, 13.5, tiled(brick, 6, 5), 0.06);
        add(new THREE.CylinderGeometry(1.45, 1.55, 0.5, 18), '#b9b3a6', m4(4.5, gl(4.5, 9.2) + 0.25, 9.2));
        add(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 18), '#6b5a3a', m4(4.5, gl(4.5, 9.2) + 0.52, 9.2));
        // red plastic barriers along the right kerb (like the real ones: hollow, with arched slots), leaving both lanes open
        for (let k = 0; k < 3; k++) {
          const bx = 5.0 + k * 3.6, bz = -3.7 - k * 0.45, g0 = gl(bx, bz), yb = -0.12 * k;
          void yb;
          add(new THREE.BoxGeometry(2.0, 0.34, 0.5), '#c4382e', m4(bx, g0 + 0.17, bz, 0, 0.0, 0));
          add(new THREE.BoxGeometry(1.75, 0.5, 0.36), '#c4382e', m4(bx, g0 + 0.59, bz));
          for (const dz of [-0.55, 0.0, 0.55]) add(new THREE.BoxGeometry(0.32, 0.36, 0.38), '#3a1512', m4(bx + dz * 1.4, g0 + 0.6, bz));
        }
        // a black-and-white striped marker pole at the right kerb
        for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 6), k % 2 ? '#f2f0ea' : '#1c1c1c', m4(9.5, gl(9.5, -6.5) + 0.15 + k * 0.3, -6.5));
      } else {
        // ---- the Khokha Gate: two big steel gates between brick pillars, a plastered boundary wall on every side, a gravel path, cycles parked along it
        const Zg = 3.3;
        // both pillars and both leaves are the same size: the tops are level (the ground slopes across the gate, so the pillar on the low
        // side is taller from the ground up, and the leaf on the low side has a longer foot, instead of one of them being shorter)
        const gHi = Math.max(gl(0, Zg + 0.47), gl(0, -(Zg + 0.47)), gl(-0.05, Zg), gl(-0.05, -Zg));
        for (const sgn2 of [-1, 1]) {
          const zc = sgn2 * (Zg + 0.47), top = gHi + 3.4, bot = gl(0, zc) - 0.5;
          add(new THREE.BoxGeometry(0.95, top - bot, 0.95), '#a8523a', m4(0, (top + bot) / 2, zc));
          add(new THREE.BoxGeometry(1.15, 0.2, 1.15), '#d9d2c1', m4(0, top + 0.1, zc));
          add(new THREE.SphereGeometry(0.17, 10, 8), '#fff2c4', m4(0, top + 0.32, zc));
        }
        add(new THREE.BoxGeometry(0.7, 0.5, 0.3), '#2a2f34', m4(0.52, gHi + 2.2, Zg + 0.47));
        // the two steel leaves, hinged on the pillars, swinging in when the gate opens at six in the morning
        for (const sgn2 of [-1, 1]) {
          const hinge = sgn2 * Zg, Lw = Zg - 0.08, pivot = new THREE.Group();
          const ext = Math.max(0, gHi - gl(-0.05, hinge));                                      // the low side: the leaf reaches down to its ground
          pivot.position.set(-0.05, gHi, hinge);
          const Q = [], q = (w, hh, d, lx, ly, lz, col, rx = 0, ry = 0, rz = 0) => Q.push({ geometry: new THREE.BoxGeometry(w, hh, d), color: col, matrix: m4(lx, ly, lz, rx, ry, rz) });
          const dir = -sgn2, H2 = 2.5;                                                        // the leaf reaches from the hinge towards the middle
          q(0.1, H2 + ext, 0.1, 0, (H2 - ext) / 2 + 0.12, dir * 0.05, '#2c3a30'); q(0.1, H2 + ext, 0.1, 0, (H2 - ext) / 2 + 0.12, dir * (Lw - 0.05), '#2c3a30');
          for (const yy of [0.14 - ext, 0.75, 1.3, 1.85, H2 + 0.1]) q(0.08, 0.1, Lw, 0, yy, dir * Lw / 2, '#2c3a30');
          q(0.04, 1.2 + ext, Lw - 0.1, 0.0, 0.75 - ext / 2, dir * Lw / 2, '#3d6b4a');            // the green steel sheet, waist high (and down to the ground)
          for (let k = 0; k < Lw / 0.14; k++) q(0.035, 0.75, 0.035, 0.0, 2.2, dir * (0.1 + k * 0.14), '#1b1f22');            // spear-topped bars above
          const dg = Math.hypot(Lw, 1.2); q(0.05, dg, 0.05, 0.03, 0.75, dir * Lw / 2, '#2c3a30', 0, 0, Math.atan2(Lw, 1.2) * (dir > 0 ? -1 : 1) * 0);
          Q.pop();
          q(0.05, 0.05, dg, 0.04, 0.75, dir * Lw / 2, '#2c3a30', -Math.atan2(1.2, Lw) * dir, 0, 0);
          q(0.12, 0.3, 0.06, 0.06, 1.05, dir * (Lw - 0.05), '#9aa0a6');                           // the latch plate and padlock at the middle
          q(0.08, 0.16, 0.1, 0.1, 0.95, dir * (Lw - 0.05), '#c9a227');
          const lm = new THREE.Mesh(mergeColored(Q), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.55 }));
          lm.castShadow = true; pivot.add(lm); gg.add(pivot);
          swings.push({ m: pivot, gate: gt, dir: sgn2, k: 1 });
        }
        // the plastered boundary wall on both sides of the gate: pilasters, a coping, barbed wire along the top
        for (const sgn2 of [-1, 1]) {
          const Lwl = 32, z0 = sgn2 * (Zg + 1.0);
          for (let m = 0; m < Lwl; m += 4) {
            const zc = z0 + sgn2 * (m + 2);
            if (world.buildingAt(gt.wx + cr * 0 + sr * zc, gt.wz + cr * zc)) continue;
            solid(0.3, 2.3, 4.0, '#d6cfbd', 0, zc);
            solid(0.5, 2.4, 0.5, '#c4bca9', 0, zc - sgn2 * 2.0);
            add(new THREE.BoxGeometry(0.42, 0.08, 4.1), '#9c968a', m4(0, gl(0, zc) + 2.42, zc));
          }
          for (let k = 0; k < Lwl / 2; k++) {                                                   // barbed wire: angled posts and three strands
            const zc = z0 + sgn2 * (k * 2 + 1);
            add(new THREE.BoxGeometry(0.04, 0.42, 0.04), '#4a4f54', m4(-0.12, gl(0, zc) + 2.66, zc, 0.5 * sgn2, 0, 0));
          }
          for (const hh of [2.58, 2.68, 2.78]) add(new THREE.BoxGeometry(0.012, 0.012, Lwl), '#6b7075', m4(-0.12, gl(0, z0 + sgn2 * Lwl / 2) + hh, z0 + sgn2 * Lwl / 2));
        }
        // the gravel path through the gate, packed earth and fallen leaves, where the cycles stand in rows along it
        const gravel = canvasTexture(256, 256, (c, w, h) => { c.fillStyle = '#9b8468'; c.fillRect(0, 0, w, h); for (let k = 0; k < 2600; k++) { const v = 90 + Math.random() * 90; c.fillStyle = 'rgba(' + v + ',' + (v - 15) + ',' + (v - 38) + ',0.55)'; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 2); } for (let k = 0; k < 160; k++) { c.fillStyle = 'rgba(70,52,30,' + (0.25 + Math.random() * 0.3) + ')'; c.fillRect(Math.random() * w, Math.random() * h, 5 + Math.random() * 6, 2 + Math.random() * 2); } });
        laid(-40, 10, -3.6, 3.6, tiled(gravel, 7, 1.4), 0.066);
      }
    }
    const gm = new THREE.Mesh(mergeColored(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
    gm.castShadow = true; gm.receiveShadow = true;
    gg.add(gm);
    if (gt.main) {
      // central monolith: English name + emblem, fairy lights at night
      const eng = stoneMat(stoneTex(ENG, { emblem: true, size: 74 }));
      const hin = stoneMat(stoneTex(HINDI, { font: DEVA, size: 66 }));
      const plain = new THREE.MeshStandardMaterial({ color: SAND, roughness: 0.85 });
      const mono = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6.6, 4.4), [eng, eng.clone(), plain, plain, plain, plain]);
      mono.material[1].map = mono.material[0].map;
      const monoBase = gl(-2, 0) + 0.24;                 // on the island lawn
      mono.position.set(-2, monoBase + 3.3, 0);
      mono.castShadow = true;
      gg.add(mono);
      const asm = stoneMat(stoneTex(ASSAMESE, { font: BENG, size: 60 }));
      for (const s of [1, -1]) {
        const face = s > 0 ? asm : hin;          // seen from the road outside: Assamese on the left, Hindi on the right
        const pil = new THREE.Mesh(new THREE.BoxGeometry(1.12, 5.1, 3.5), [face, face, plain, plain, plain, plain]);
        pil.position.set(0, gl(0, s * 11.4) + 2.6, s * 11.4); pil.rotation.y = -s * 0.3;
        gg.add(pil);
      }
      // fairy lights: warm-white bulbs round the edges of the stone and the pillars at night
      const addLights = (w, h, pos, color) => {
        const m = new THREE.MeshBasicMaterial({ map: lightsMap, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
        lightMats.push(m);
        for (const side of [1, -1]) {
          const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
          q.position.set(pos.x + side * 0.63, pos.y, pos.z);
          q.rotation.y = side * Math.PI / 2;
          gg.add(q);
        }
      };
      addLights(4.3, 6.4, new THREE.Vector3(-2, monoBase + 3.31, 0), new THREE.Color(2.2, 2.1, 1.9));
      addLights(3.4, 5.0, new THREE.Vector3(0, gl(0, 11.4) + 2.6, 11.4), new THREE.Color(2.3, 2.0, 1.5));
      addLights(3.4, 5.0, new THREE.Vector3(0, gl(0, -11.4) + 2.6, -11.4), new THREE.Color(2.3, 2.0, 1.5));
      // paved gate plaza under the whole thing, laid on the ground (a flat slab here used to stand
      // above the sloping road, so everybody walking through looked sunk into it)
      // a bigger apron (both carriageways swing round the island), laid on the ground
      const pg = new THREE.PlaneGeometry(56, 30, 56, 30).rotateX(-Math.PI / 2);
      { const pa = pg.attributes.position;
        for (let i = 0; i < pa.count; i++) pa.setY(i, gl(pa.getX(i) - 2, pa.getZ(i)) + 0.05);
        pg.computeVertexNormals(); }
      const pav = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: 0x4a4b4d, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
      pav.position.set(-2, 0, 0);
      pav.receiveShadow = true;
      gg.add(pav);
    } else if (gt.name && !special) {
      // the name board on both faces of the beam (it used to sit inside the beam, hidden)
      const bm = new THREE.MeshStandardMaterial({ map: nameTex('IIT GUWAHATI', gt.name.toUpperCase()), roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.08 });
      for (const s of [1, -1]) {
        const board = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 1.5), bm);
        board.position.set(s * 0.33, 5.4, 0);
        board.rotation.y = s * Math.PI / 2;
        gg.add(board);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.7, 13.6), new THREE.MeshStandardMaterial({ color: 0x8f2f2a, roughness: 0.8 }));
      beam.position.set(0, 5.4, 0);
      gg.add(beam);
    }
    group.add(gg);
  }
  let t = 0;
  return {
    group,
    setNight(k, dt = 0, hour = 12) {
      t += dt;
      for (const p of panels) {
        const want = world.gateOpen(p.gate, hour, 'walk') ? 1 : 0;
        p.k += (want - p.k) * Math.min(1, dt * 0.6);
        p.m.position.z = p.open * p.k;
      }
      for (const sw of swings) {
        const want = world.gateOpen(sw.gate, hour, 'walk') ? 1 : 0;
        sw.k += (want - sw.k) * Math.min(1, dt * 0.8);
        sw.m.rotation.y = sw.dir * sw.k * 1.5;                                               // they swing in, towards the campus
      }
      for (const m of glowMats) m.emissiveIntensity = k * 0.55;
      lightMats.forEach((m, i) => { m.opacity = k * (0.82 + 0.18 * Math.sin(t * 2.4 + i * 1.7)); });
    },
  };
}

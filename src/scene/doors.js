// An entrance on every building, so the way in is easy to find. Each building gets a door in its wall at its
// entrance (the map's entrance for the big ones, the wall nearest the road for the rest):
//  - houses and small buildings: a wooden door in a frame, a step and a small sunshade;
//  - offices, halls, labs, the library, the auditorium, the hospital...: a pair of glass doors in a dark
//    frame, a canopy on two columns, steps or a ramp down to the ground, a blue ENTRANCE plate and the
//    building's name on a board over the door;
//  - hostels: the same canopy, steps and lamps round the automatic glass doors OneStop puts in.
// The steps are real: you climb them (world.addSurface). Everything is merged into a few meshes.
import * as THREE from 'three';
import { mergeColored, m4, canvasTexture, pointInRing } from '../util.js';

const NAMES = {
  admin: 'ADMINISTRATIVE BUILDING', lhc: 'LECTURE HALL COMPLEX', core5: 'CORE 5', workshop: 'CENTRAL WORKSHOP', sac: 'STUDENT ACTIVITY CENTRE', newsac: 'NEW SAC',
  gym: 'GENERAL GYMNASIUM', hospital: 'IITG HOSPITAL', guesthouse: 'GUEST HOUSE', shopping: 'MARKET COMPLEX', foodcourt: 'FOOD COURT', transit: 'TRANSIT COMPLEX', tic: 'TECHNOLOGY INCUBATION CENTRE',
};
// the sites that already have their own name board over the door (landmarks.js)
const HAS_BOARD = new Set(['library', 'conference', 'auditorium', 'academic']);

function plate(text, w, h, bg, fg = '#ffffff', sub = '') {
  return canvasTexture(w, h, (g, W, H) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = fg; g.lineWidth = Math.max(4, H * 0.05); g.strokeRect(H * 0.08, H * 0.08, W - H * 0.16, H - H * 0.16);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(H * (sub ? 0.42 : 0.5))}px "Hind", "Segoe UI", sans-serif`; g.fillText(text, W / 2, sub ? H * 0.4 : H / 2 + 2, W * 0.92);
    if (sub) { g.font = `600 ${Math.round(H * 0.22)}px "Hind", "Segoe UI", sans-serif`; g.fillText(sub, W / 2, H * 0.78, W * 0.9); }
  }, { repeat: false });
}

export function buildDoors(game) {
  const W = game.world, G = game.graph;
  const group = new THREE.Group(); group.name = 'doors';
  const solid = [], glass = [], planes = [];
  let doors = 0, rich = 0;
  const tmp = { d: 0, x: 0, z: 0 };

  /** the wall point and outward normal for a building's entrance */
  const wallAt = (b, x, z) => {
    let best = null;
    for (const ring of b.rings.slice(0, 1)) {
      for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
        const ax = ring[j], az = ring[j + 1], bx = ring[i], bz = ring[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
        if (!best || d < best.d) { const L = Math.sqrt(L2); best = { d, x: px, z: pz, tx: dx / L, tz: dz / L, L, t: t * L }; }
      }
    }
    if (!best) return null;
    let nx = -best.tz, nz = best.tx;
    if (pointInRing(best.x + nx * 0.5, best.z + nz * 0.5, b.rings[0])) { nx = -nx; nz = -nz; }         // it must point out of the building
    return { ...best, nx, nz };
  };

  const doorFor = (b, x, z, site) => {
    const w = wallAt(b, x, z);
    if (!w || w.L < 2.2) return;
    const big = !!site || b.area > 500;
    const kind = b.kind, hostel = kind === 'hostel';
    // the door on a straight stretch of wall: slide along it if the wall is too short on one side
    let along = 0;
    const hw = big ? 1.5 : 0.62;
    if (w.t < hw + 0.4) along = hw + 0.4 - w.t; else if (w.L - w.t < hw + 0.4) along = -(hw + 0.4 - (w.L - w.t));
    const px = w.x + w.tx * along, pz = w.z + w.tz * along, nx = w.nx, nz = w.nz, tx = w.tx, tz = w.tz, yaw = Math.atan2(nx, nz);
    const yTerrain = Math.max(W.heightAt(px + nx * 1.3, pz + nz * 1.3), W.heightAt(px + nx * 0.4, pz + nz * 0.4));
    const yf = Math.max(b.floor0, yTerrain);                                    // the threshold
    const F = (lu, ly, lv) => [px + tx * lu + nx * lv, yf + ly, pz + tz * lu + nz * lv];   // u along the wall, v out of it
    const box = (lu, ly, lv, sx, sy, sz, color, target = solid) => { const [x1, y1, z1] = F(lu, ly, lv); target.push({ geometry: new THREE.BoxGeometry(sx, sy, sz), color, matrix: m4(x1, y1, z1, 0, Math.atan2(nx, nz) + Math.PI, 0) }); };
    doors++;
    if (!hostel) {
      // the door: a frame, leaves (glass for the big ones, wood for the rest), a handle bar
      const dw = hw * 2, dh = big ? 2.55 : 2.1;
      box(-hw - 0.06, dh / 2, 0.05, 0.12, dh + 0.12, 0.16, '#2f353b'); box(hw + 0.06, dh / 2, 0.05, 0.12, dh + 0.12, 0.16, '#2f353b'); box(0, dh + 0.06, 0.05, dw + 0.24, 0.14, 0.16, '#2f353b');
      if (big) {
        box(0, dh / 2, 0.02, dw, dh, 0.04, '#8fb4c8', glass);
        box(0, dh / 2, 0.04, 0.07, dh, 0.06, '#2f353b');                          // the mullion between the two leaves
        for (const s of [-1, 1]) box(s * 0.28, 1.05, 0.09, 0.05, 0.9, 0.05, '#c9ced4');   // pull handles
        box(0, 0.12, 0.03, dw, 0.24, 0.05, '#2f353b');
      } else {
        box(0, dh / 2, 0.03, dw, dh, 0.08, ['#7a4a2a', '#6b4a2f', '#5a3d2b', '#3d5a44'][b.i % 4]);
        box(0.35 * (b.i % 2 ? 1 : -1), 1.0, 0.09, 0.05, 0.14, 0.04, '#d8c58a');   // a brass knob
      }
    }
    // steps down to the ground: real, you climb them. A landing level with the door, then risers of at most 17 cm
    const yg = W.heightAt(px + nx * 2.6, pz + nz * 2.6), rise = yf - yg;
    // ...but never out onto a road (or into another building): the flight is kept inside the room there is between the wall
    // and the nearest road edge. Steeper risers (up to 25 cm) and shorter treads fit more height into less room
    let room = 9;
    for (let t = 0.3; t < 9; t += 0.2) { const qx = px + nx * t, qz = pz + nz * t; if (G.onRoad(qx, qz, 0.5) || W.buildingAt(qx, qz)) { room = Math.max(0, t - 0.4); break; } }
    if (site?.lm === 'academic') {
      // (the Academic Complex's grand flight of steps and its portico are built in scene/acfront.js)
    } else if (rise > 0.06) {
      const wid = big ? Math.max(4, hw * 2 + 1.4) : hw * 2 + 0.9;
      let landing = big ? 1.5 : 0.95, tread = 0.34, n = Math.max(1, Math.ceil(rise / 0.17));
      if (landing + (n - 1) * tread > room) {
        tread = 0.26; n = Math.max(1, Math.ceil(rise / 0.22));                                   // a steeper flight
        if (landing + (n - 1) * tread > room) landing = Math.min(landing, 0.9);
        while (n > 1 && landing + (n - 1) * tread > room) n--;                                    // and as many steps as will fit
        if (landing > room) landing = Math.max(0.5, room);
      }
      const dh = Math.min(rise, n * 0.25) / n;                                                     // what is left over is the last drop to the road
      const yg0 = yf - dh * n;
      for (let j = n; j >= 1; j--) {
        const top = yg0 + j * dh;
        const depth = j === n ? landing : tread;
        const dOut = j === n ? 0.05 + landing / 2 : 0.05 + landing + (n - j - 1) * tread + tread / 2;
        const [sx2, , sz2] = F(0, 0, dOut);
        const h = top - (yg0 - 0.35);
        solid.push({ geometry: new THREE.BoxGeometry(wid, h, depth), color: '#c9c1b2', matrix: m4(sx2, yg0 - 0.35 + h / 2, sz2, 0, yaw, 0) });
        W.addSurface({ kind: 'box', x: sx2, z: sz2, hx: wid / 2, hz: depth / 2, yaw, top });
      }
    } else {
      // level with the ground: a slab so the threshold reads as a threshold
      const [sx2, , sz2] = F(0, 0, 0.6);
      solid.push({ geometry: new THREE.BoxGeometry(hw * 2 + 0.6, 0.06, 1.0), color: '#b9b2a4', matrix: m4(sx2, yf + 0.03, sz2, 0, yaw, 0) });
    }
    if (!big) {
      // a small sunshade over the door
      box(0, 2.5, 0.42, hw * 2 + 0.9, 0.08, 0.95, '#8a8f96');
      return;
    }
    rich++;
    // the canopy on two columns
    const cw = hw * 2 + 2.6, cd = big && b.area > 900 ? 2.6 : 1.9, ch = 3.25;
    box(0, ch, cd / 2, cw, 0.16, cd, '#e9e2d3');
    box(0, ch + 0.11, cd / 2, cw + 0.1, 0.07, cd + 0.1, '#7a2630');                    // the maroon edge
    for (const s of [-1, 1]) {
      const [cx1, cy1, cz1] = F(s * (cw / 2 - 0.15), ch / 2, cd - 0.15);
      if (!W.placer || W.placer.free(cx1, cz1, 0.25, { sports: false })) {
        solid.push({ geometry: new THREE.CylinderGeometry(0.1, 0.11, ch, 10), color: '#f0ebe0', matrix: m4(cx1, cy1, cz1) });
        W.addSolid(cx1, cz1, 0.13, 'column', true);
      }
    }
    // the ENTRANCE plate over the door and the name of the place
    const [ex, ey, ez] = F(0, dh0(big) + 0.55, 0.06);
    planes.push({ tex: ENTRANCE, x: ex, y: ey, z: ez, w: 1.9, h: 0.42, yaw });
    const site_lm = site?.lm;
    const nm = site ? (NAMES[site_lm] || (site.name || '').toUpperCase()) : '';
    if (site && nm && !HAS_BOARD.has(site_lm) && kind !== 'hostel') {
      const [bx2, by2, bz2] = F(0, ch + 0.95, 0.09);
      planes.push({ tex: plate(nm, 1024, 160, '#1f3a5f'), x: bx2, y: by2, z: bz2, w: Math.min(6.5, 2.2 + nm.length * 0.24), h: 0.95, yaw });
    }
    if (kind === 'hospital') { const [hx2, hy2, hz2] = F(hw + 1.6, 2.6, 0.07); planes.push({ tex: CROSS, x: hx2, y: hy2, z: hz2, w: 0.9, h: 0.9, yaw }); }
    // lamps either side of the door
    for (const s of [-1, 1]) box(s * (hw + 0.7), 2.7, 0.14, 0.2, 0.2, 0.2, '#fff2c4');
  };
  const dh0 = (big) => (big ? 2.55 : 2.1);
  let ENTRANCE = null, CROSS = null;
  ENTRANCE = plate('ENTRANCE', 512, 110, '#1f5f9f');
  CROSS = canvasTexture(128, 128, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#d32f2f'; g.fillRect(50, 14, 28, 100); g.fillRect(14, 50, 100, 28); }, { repeat: false });
  let site = null;

  const siteOf = new Map();
  for (const s of W.sites) for (const b of s.blocks) siteOf.set(b, s);
  for (const b of W.buildings) {
    if (b.bungalow || b.graffitiHouse) continue;                                // the Director's house, and the graffiti wall (no door)
    const s = siteOf.get(b) || null;
    const isMain = s && b === s.blocks.reduce((m, q) => (q.area > m.area ? q : m), s.blocks[0]);
    if (b.area < 26 && !s) continue;                                            // sheds and the like
    if (s && !isMain) continue;                                                 // one main door per site (annexes have their own house-style door)
    site = s && isMain ? s : null;
    const e = s ? { x: s.ex, z: s.ez } : W.entranceOf(b, G);
    if (!e || !isFinite(e.x)) continue;
    doorFor(b, e.x, e.z, site);
  }
  site = null;

  if (solid.length) { const m = new THREE.Mesh(mergeColored(solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  if (glass.length) { const m = new THREE.Mesh(mergeColored(glass), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55 })); group.add(m); }
  for (const p of planes) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshStandardMaterial({ map: p.tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: p.tex, emissiveIntensity: 0.18 }));
    m.position.set(p.x, p.y, p.z); m.rotation.y = p.yaw;
    group.add(m);
  }
  game.scene.add(group);
  return { group, counts: { doors, rich } };
}

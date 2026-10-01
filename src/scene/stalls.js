// Food stalls, cafe seating and the Market Complex street (shops, ATM, carts).
// Every stall/shop has a vendor spot, customer seats and a menu the player can buy from.
import * as THREE from 'three';
import { canvasTexture, mergeColored, m4, mulberry32, closestOnRing, pointInRing } from '../util.js';
import { AN } from '../crowd/people.js';

// prices in Indian rupees (₹)
export const MENUS = {
  tea: [['Kulhad chai', 10, 12], ['Lemon tea', 12, 12], ['Samosa', 15, 18], ['Bun omelette', 30, 28]],
  momo: [['Veg momos', 40, 30], ['Chicken momos', 60, 38], ['Thukpa', 70, 45]],
  noodles: [['Masala noodles', 30, 25], ['Cheese noodles', 45, 30], ['Kulhad chai', 10, 12]],
  juice: [['Fresh lime soda', 25, 12], ['Sugarcane juice', 30, 14], ['Mango shake', 50, 20]],
  roll: [['Egg roll', 40, 30], ['Paneer roll', 55, 34], ['Chicken roll', 65, 40]],
  coffee: [['Cappuccino', 110, 22, 'focus'], ['Cold coffee', 130, 24, 'focus'], ['Brownie', 90, 25]],
  chicken: [['Zinger burger', 160, 55], ['Popcorn chicken', 150, 45], ['Hot wings (6)', 180, 50], ['Fries', 90, 25], ['Cold drink', 60, 12]],
  pizza: [['Margherita (regular)', 120, 60], ['Veg supreme (medium)', 260, 90], ['Garlic bread', 90, 35], ['Chocolate lava cake', 99, 20]],
  icecream: [['Single scoop', 60, 10], ['Double scoop', 110, 14], ['Sundae', 160, 18]],
  panipuri: [['Pani puri (6)', 20, 16], ['Sev puri', 30, 20], ['Dahi puri', 40, 22]],
  fruit: [['Banana (2)', 10, 10], ['Apple', 25, 12], ['Pineapple slices', 30, 14]],
  general: [['Water bottle', 20, 4], ['Biscuits', 10, 8], ['Umbrella', 180, 0, 'umbrella'], ['Toothpaste', 55, 0]],
  veg: [['Onions (1 kg)', 40, 0], ['Tomatoes (1 kg)', 35, 0], ['Assam lemon', 10, 3]],
  stationery: [['Notebook', 50, 0, 'notes'], ['Printout (10 pages)', 20, 0, 'notes'], ['Lab record', 90, 0, 'notes']],
  pharmacy: [['ORS', 25, 20], ['Paracetamol', 20, 10], ['Band-aid', 15, 0]],
  bakery: [['Cream roll', 25, 15], ['Birthday cake (small)', 350, 40], ['Veg puff', 20, 16]],
  mobile: [['Mobile recharge', 199, 0, 'recharge'], ['Earphones', 299, 0]],
  barber: [['Haircut', 80, 0, 'haircut'], ['Beard trim', 40, 0, 'haircut']],
  atm: [],
};

function signTex(text, bg = '#1f5a3d', fg = '#f7f1e3', sub = '') {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, w, 10);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 64; g.font = `bold ${fs}px "Hind", "Segoe UI", sans-serif`;
    while (g.measureText(text).width > w - 40 && fs > 26) { fs -= 3; g.font = `bold ${fs}px "Hind", "Segoe UI", sans-serif`; }
    g.fillText(text, w / 2, sub ? 52 : h / 2 + 3);
    if (sub) { g.font = '26px "Hind", "Segoe UI", sans-serif'; g.fillText(sub, w / 2, 102); }
  }, { repeat: false });
}

export function buildStalls(world, graph) {
  const group = new THREE.Group();
  group.name = 'stalls';
  const rnd = mulberry32(88);
  const parts = [];
  const signs = [];
  const stalls = [];
  const P = (geo, color, mat) => parts.push({ geometry: geo, color, matrix: mat });
  const PL = world.placer;
  const ok = (x, z, r = 0.7) => (PL ? PL.free(x, z, r) : world.insideCampus(x, z) && !world.buildingAt(x, z) && !world.waterAt(x, z));
  /** the nearest spot to (x, z) where a stall's whole footprint (counter, roof, the queue and the tables in
   *  front) stands clear of buildings, lakes, roads, paths and other stalls; faces the nearest way so people
   *  walk up to it. w: counter width; front: how far the customers' side reaches (m). */
  const fitStall = (x, z, yaw, w = 2.8, front = 5.0, exact = false) => {
    if (!PL) return { x, z, yaw };
    const hx = w / 2 + 0.9, hz = (front + 1.4) / 2, mid = (front - 1.4) / 2;
    const test = (px, pz, yw) => PL.footprint(px + Math.sin(yw) * mid, pz + Math.cos(yw) * mid, yw, hx, hz, 0.5);
    if (test(x, z, yaw)) return { x, z, yaw };
    if (exact) return null;                                // (the spot or nothing: two outlets that must stand side by side)
    let best = null;
    for (let R = 1.5; R <= 32 && !best; R += 1.5) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2 + R, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
        const n = graph.nearestOnNetwork(px, pz);
        const yw = n ? Math.atan2(n.x - px, n.z - pz) : yaw;
        if (test(px, pz, yw)) { best = { x: px, z: pz, yaw: yw }; break; }
      }
    }
    return best || null;
  };
  const claim = (x, z, yaw, w = 2.8, front = 5.0) => {
    if (!PL) return;
    PL.reserveBox(x + Math.sin(yaw) * (front - 1.4) / 2, z + Math.cos(yaw) * (front - 1.4) / 2, yaw, w / 2 + 0.6, (front + 1.4) / 2, 'stall');       // the room it needs (soft)
    PL.reserveBox(x - Math.sin(yaw) * 0.25, z - Math.cos(yaw) * 0.25, yaw, w / 2 + 0.15, 0.95, 'stallbody', true);                                   // the counter and back wall (hard)
  };

  /** local-to-world helper for a stall frame (yaw: the side customers stand on) */
  const frame = (x, z, yaw) => {
    const c = Math.cos(yaw), s = Math.sin(yaw), y = world.heightAt(x, z);
    return (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  };
  const put = (F, yaw, geo, color, lx, ly, lz, rx = 0) => { const [px, py, pz] = F(lx, ly, lz); P(geo, color, m4(px, py, pz, rx, yaw, 0, 1, 1, 1, 'YXZ')); };
  const addSign = (F, yaw, text, bg, lx, ly, lz, w = 2.6, h = 0.62, sub = '') => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), (() => { const t = signTex(text, bg, '#f7f1e3', sub); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 }); })());
    const [px, py, pz] = F(lx, ly, lz);
    m.position.set(px, py, pz); m.rotation.y = yaw;
    group.add(m); signs.push(m);
  };
  const table = (x, z, n = 4, colour = '#f2f0ea', chairCol = '#c62828') => {
    const y = world.heightAt(x, z);
    world.addSolid(x, z, 1.15, 'table');
    world.addSolid(x, z, 0.5, 'tabletop', true);
    P(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 14), colour, m4(x, y + 0.72, z));
    P(new THREE.CylinderGeometry(0.05, 0.08, 0.72, 8), colour, m4(x, y + 0.36, z));
    const seats = [];
    const a0 = rnd() * 6.28;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI * 2, cx = x + Math.cos(a) * 0.8, cz = z + Math.sin(a) * 0.8;
      const yaw = Math.atan2(x - cx, z - cz);
      P(new THREE.BoxGeometry(0.44, 0.04, 0.42), chairCol, m4(cx, y + 0.45, cz, 0, yaw, 0));
      P(new THREE.BoxGeometry(0.44, 0.42, 0.04), chairCol, m4(cx - Math.sin(yaw) * 0.2, y + 0.66, cz - Math.cos(yaw) * 0.2, -0.1, yaw, 0));
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) P(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), chairCol, m4(cx + dx, y + 0.22, cz + dz));
      // seat spot: pelvis over the chair, a little back
      seats.push({ x: cx - Math.sin(yaw) * 0.12, z: cz - Math.cos(yaw) * 0.12, yaw, anim: AN.SIT, taken: null });
    }
    return seats;
  };
  /** a tea kiosk / food stall with tin roof, counter, sign and vendor */
  const kiosk = (x, z, yaw, name, menu, colour = '#2f5d5a', opts = {}) => {
    const w = opts.w || 2.8;
    // opts.outside: a stall beyond the campus wall (Khokha market): the campus placer does not know that ground, so only the plain checks
    const clearOut = (px, pz, r = 1.2) => !world.buildingAt(px, pz) && !world.waterAt(px, pz) && !graph.onRoad(px, pz, r);
    const fit = opts.outside ? (clearOut(x, z, 2.4) ? { x, z, yaw } : null) : fitStall(x, z, yaw, w, opts.tables === false ? 2.4 : 5.2, !!opts.exact);
    if (!fit) return null;                               // no room for it anywhere near: left out
    x = fit.x; z = fit.z; yaw = fit.yaw;
    if (!opts.outside) claim(x, z, yaw, w, opts.tables === false ? 2.4 : 5.2);
    const F = frame(x, z, yaw);
    put(F, yaw, new THREE.BoxGeometry(w, 1.0, 0.7), '#8a5a36', 0, 0.5, 0.35);                 // counter
    put(F, yaw, new THREE.BoxGeometry(w + 0.1, 0.05, 0.8), '#c9c2b4', 0, 1.02, 0.35);           // counter top
    put(F, yaw, new THREE.BoxGeometry(w, 2.5, 0.08), '#d9cdb5', 0, 1.25, -1.2);                // back wall
    for (const s of [-1, 1]) put(F, yaw, new THREE.BoxGeometry(0.08, 2.5, 1.6), '#d9cdb5', s * w / 2, 1.25, -0.4);
    put(F, yaw, new THREE.BoxGeometry(w + 0.8, 0.06, 2.6), colour, 0, 2.55, 0.0, 0.12);          // tin roof sloping forward
    put(F, yaw, new THREE.CylinderGeometry(0.12, 0.1, 0.3, 10), '#b9bec4', -w / 4, 1.2, 0.3);  // kettle / pot
    put(F, yaw, new THREE.CylinderGeometry(0.08, 0.08, 0.28, 8), '#e8d9a8', w / 5, 1.19, 0.4); // glass jars
    put(F, yaw, new THREE.CylinderGeometry(0.08, 0.08, 0.28, 8), '#c86b3c', w / 5 + 0.25, 1.19, 0.4);
    addSign(F, yaw, name, opts.signBg || '#7d1f1f', 0, 2.25, 1.05, w + 0.4, 0.5, opts.sub || '');
    const [vx, , vz] = F(0, 0, -0.5);
    const seats = [];
    if (opts.tables !== false) {
      for (let k = 0; k < (opts.tables || 2); k++) {
        const [tx, , tz] = F((k - ((opts.tables || 2) - 1) / 2) * 2.4, 0, 3.4 + rnd() * 0.8);
        if (opts.outside ? clearOut(tx, tz, 1.5) : ok(tx, tz)) seats.push(...table(tx, tz, 4, '#f2f0ea', ['#c62828', '#1f5fa8', '#2e7d4f'][k % 3]));
      }
    }
    const st = { name, x, z, yaw, menu, vendor: { x: vx, z: vz, yaw, anim: AN.SERVE, taken: null }, seats, kind: opts.kind || 'food' };
    stalls.push(st);
    return st;
  };
  /** open cart (thela) with a canopy */
  const cart = (x, z, yaw, name, menu, colour) => {
    const fit = fitStall(x, z, yaw, 1.8, 2.4);
    if (!fit) return null;
    x = fit.x; z = fit.z; yaw = fit.yaw;
    claim(x, z, yaw, 1.8, 2.4);
    const F = frame(x, z, yaw);
    put(F, yaw, new THREE.BoxGeometry(1.8, 0.1, 0.9), '#6b5a44', 0, 0.85, 0);
    put(F, yaw, new THREE.BoxGeometry(1.7, 0.35, 0.8), '#c9c2b4', 0, 1.08, 0);
    for (const s of [-0.7, 0.7]) { put(F, yaw, new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12).rotateX(Math.PI / 2), '#222', s, 0.28, 0.48); put(F, yaw, new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12).rotateX(Math.PI / 2), '#222', s, 0.28, -0.48); }
    for (const [sx, sz] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) put(F, yaw, new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), '#777', sx, 1.8, sz);
    put(F, yaw, new THREE.BoxGeometry(2.0, 0.05, 1.2), colour, 0, 2.42, 0);
    put(F, yaw, new THREE.SphereGeometry(0.22, 10, 8), '#e8c877', -0.4, 1.35, 0);               // puris / fruits heap
    put(F, yaw, new THREE.CylinderGeometry(0.18, 0.16, 0.3, 10), '#b9bec4', 0.35, 1.4, 0);
    addSign(F, yaw, name, colour, 0, 2.18, 0.62, 1.8, 0.36);
    const [vx, , vz] = F(0, 0, -0.9);
    const st = { name, x, z, yaw, menu, vendor: { x: vx, z: vz, yaw, anim: AN.SERVE, taken: null }, seats: [], kind: 'cart' };
    stalls.push(st);
    return st;
  };

  // --- the Lake View Tea Stall (the old Tapri, by the academic lake), lakeside food stalls, Khokha Gate chai
  const poi = (name) => world.pois.find((p) => p.name === name);
  const tp = poi('Lake View Tea Stall') || poi('Tapri');
  if (tp) kiosk(tp.wx, tp.wz, faceRoad(tp.wx, tp.wz), 'Lake View Tea Stall', MENUS.tea, '#2f5d5a', { sub: 'Chai · Samosa · Bun omelette', tables: 2 });
  const fs = world.landmark('foodstalls');
  if (fs) {
    const yaw = faceRoad(fs.wx, fs.wz);
    const names = [['Momo Point', MENUS.momo, '#7d1f1f'], ['Noodles & Chai', MENUS.noodles, '#b3262f'], ['Fresh Juice', MENUS.juice, '#2e7d4f'], ['Roll Corner', MENUS.roll, '#c86b3c']];
    names.forEach(([n, menu, col], k) => {
      const off = (k - 1.5) * 4.2;
      const x = fs.wx + Math.cos(yaw) * off, z = fs.wz - Math.sin(yaw) * off;
      kiosk(x, z, yaw, n, menu, col, { tables: 1, signBg: col });
    });
  }
  // Khokha Chai and Khokha Noodles stand OUTSIDE the campus, just beyond Khokha Gate, one each side of the way out (students cross to them)
  const kg = world.gates.find((g) => g.name === 'Khokha Gate');
  if (kg) {
    const ox = Math.cos(kg.angle), oz = -Math.sin(kg.angle);                 // out of the campus
    for (const side of [1, -1]) {
      let st = null;
      for (const out of [14, 17, 20, 12, 24]) {                                // the first distance with room
        const x = kg.wx + ox * out + oz * 7.5 * side, z = kg.wz + oz * out - ox * 7.5 * side;
        st = kiosk(x, z, Math.atan2(-oz * side, ox * side), side > 0 ? 'Khokha Chai' : 'Khokha Noodles', side > 0 ? MENUS.tea : MENUS.noodles, '#5b3a29', { tables: 1, outside: true });
        if (st) break;
      }
    }
  }
  // --- the Campus Café: a small pavilion of its own on the lawn beside the library complex (not at the library's door)
  const cafePavilion = () => {
    const A = poi('Cafe Coffee Day') || poi('Campus Café');
    if (!A) return;
    const lib = world.site('library');
    const test = (px, pz, yw) => !PL || PL.footprint(px + Math.sin(yw) * 1.9, pz + Math.cos(yw) * 1.9, yw, 4.9, 5.0, 0.5);
    let best = null;
    for (let R = 12; R <= 110 && !best; R += 3) {
      let bs = Infinity;
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2 + R, px = A.wx + Math.cos(a) * R, pz = A.wz + Math.sin(a) * R;
        if (!ok(px, pz, 1.0)) continue;
        const n = graph.nearestOnNetwork(px, pz);
        if (!n || n.d < 4.5 || n.d > 22) continue;
        const yw = Math.atan2(n.x - px, n.z - pz);
        if (!test(px, pz, yw)) continue;
        let score = R + Math.abs(n.d - 9) * 1.5;
        if (lib) {
          const dl = Math.hypot(px - lib.ex, pz - lib.ez);
          if (dl < 28) continue;                                             // never at the library's door
          const front = ((px - lib.ex) * lib.nx + (pz - lib.ez) * lib.nz) / dl;
          if (front > 0.5 && dl < 60) score += 60;                           // nor straight out in front of it
        }
        if (score < bs) { bs = score; best = { x: px, z: pz, yaw: yw }; }
      }
    }
    if (!best) return;
    const { x, z, yaw } = best, F = frame(x, z, yaw);
    if (PL) { PL.reserveBox(x + Math.sin(yaw) * 0.3, z + Math.cos(yaw) * 0.3, yaw, 3.9, 3.1, 'cafe'); PL.reserveBox(x - Math.sin(yaw) * 0.9, z - Math.cos(yaw) * 0.9, yaw, 3.7, 1.7, 'cafebody', true); }
    const wall = '#e6dfd0', dark = '#3c2a22';
    put(F, yaw, new THREE.BoxGeometry(7.6, 0.14, 6.0), '#c9c2b4', 0, 0.07, 0.4);                    // floor slab
    put(F, yaw, new THREE.BoxGeometry(7.2, 3.0, 0.18), wall, 0, 1.5, -2.5);                        // back wall
    for (const s2 of [-1, 1]) put(F, yaw, new THREE.BoxGeometry(0.18, 3.0, 4.6), wall, s2 * 3.6, 1.5, -0.2);   // side walls
    for (const s2 of [-1, 1]) put(F, yaw, new THREE.BoxGeometry(0.05, 1.3, 2.6), '#33505e', s2 * 3.72, 1.7, -0.2);   // dark glass in them
    put(F, yaw, new THREE.BoxGeometry(5.6, 1.05, 0.75), '#7a4a2a', 0, 0.55, 1.2);                    // the counter
    put(F, yaw, new THREE.BoxGeometry(5.8, 0.06, 0.95), '#dcd3c2', 0, 1.1, 1.2);                     // its top
    put(F, yaw, new THREE.BoxGeometry(0.55, 0.6, 0.42), '#2b2b2f', -1.4, 1.43, 1.05);               // coffee machine
    put(F, yaw, new THREE.BoxGeometry(0.4, 0.22, 0.3), '#a7adb3', 0.5, 1.24, 1.05);                  // cake stand
    put(F, yaw, new THREE.CylinderGeometry(0.16, 0.16, 0.16, 12), '#f2ede2', 0.5, 1.4, 1.05);
    put(F, yaw, new THREE.BoxGeometry(1.3, 2.1, 0.5), '#5a5f64', -2.4, 1.05, -2.2);                 // fridge
    put(F, yaw, new THREE.BoxGeometry(8.4, 0.24, 7.2), '#5b2a22', 0, 3.12, 0.6);                    // roof slab with an overhang
    put(F, yaw, new THREE.BoxGeometry(8.5, 0.1, 7.3), '#c89b3c', 0, 2.96, 0.6);                      // gold fascia
    for (const s2 of [-1, 1]) put(F, yaw, new THREE.CylinderGeometry(0.1, 0.1, 3.0, 8), '#5a5f64', s2 * 3.9, 1.5, 3.9);   // the two front columns
    put(F, yaw, new THREE.BoxGeometry(5.6, 0.7, 0.05), dark, 0, 2.55, -2.38);                        // menu board
    addSign(F, yaw, 'Cafe Coffee Day', '#6b1f1f', 0, 3.55, 1.85, 5.2, 0.85, 'Coffee · Snacks');
    // tables with umbrellas in front
    const seats = [];
    for (const [tx, tz] of [[-2.8, 4.9], [0, 5.6], [2.8, 4.9]]) {
      const [wx, , wz] = F(tx, 0, tz);
      if (!ok(wx, wz, 1.3)) continue;
      seats.push(...table(wx, wz, 3, '#f2f0ea', '#5a3d2b'));
      const y = world.heightAt(wx, wz);
      P(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), '#555', m4(wx, y + 1.15, wz));
      P(new THREE.ConeGeometry(1.25, 0.45, 10, 1, true), '#6b3a2a', m4(wx, y + 2.35, wz));
    }
    const [vx, , vz] = F(0, 0, 0.3), [sx, , sz] = F(0, 0, 2.2);
    const st = { name: 'Cafe Coffee Day', x: sx, z: sz, yaw, menu: MENUS.coffee, vendor: { x: vx, z: vz, yaw, anim: AN.SERVE, taken: null }, seats, kind: 'cafe', building: null };
    stalls.push(st);
  };
  // --- cafes with outdoor seating in front of their buildings
  const seatsFront = (name, menu, bg, sub, kind = 'cafe') => {
    const p = poi(name);
    if (!p) return;
    const b = world.buildingAt(p.wx, p.wz);
    let x = p.wx, z = p.wz, yaw = 0;
    if (b) {
      const e = world.entranceOf(b, graph);
      x = e.x + Math.sin(e.yaw) * 5; z = e.z + Math.cos(e.yaw) * 5; yaw = e.yaw;
      // sign on the building facade above the door
      const F = frame(e.x, e.z, e.yaw);
      addSign(F, e.yaw, name, bg, 0, 3.4, 0.25, 3.8, 0.8, sub);
      stalls.push({ name, x: e.x + Math.sin(e.yaw) * 1.2, z: e.z + Math.cos(e.yaw) * 1.2, yaw: e.yaw, menu, vendor: null, seats: [], kind, building: b });
    }
    if (!b) return;
    const st = stalls[stalls.length - 1];
    for (let k = 0; k < 3; k++) {
      const tx = x + Math.cos(yaw) * (k - 1) * 2.4, tz = z - Math.sin(yaw) * (k - 1) * 2.4;
      if (!ok(tx, tz)) continue;
      const seats = table(tx, tz, 3, '#f2f0ea', '#5a3d2b');
      if (st) st.seats.push(...seats);
      const y = world.heightAt(tx, tz); // umbrella over the table
      P(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), '#555', m4(tx, y + 1.15, tz));
      P(new THREE.ConeGeometry(1.25, 0.45, 10, 1, true), bg, m4(tx, y + 2.35, tz));
    }
  };
  // (the hostels' canteens are upstairs, on the first floor of each hostel: no canteen stands on the ground or the road)
  seatsFront('LH Canteen', MENUS.roll, '#2f5d5a', 'Snacks · Tea', 'canteen');
  cafePavilion();
  // Food Court outlets (inside) + an ice-cream counter on the plaza
  const fc = world.site('foodcourt');
  if (fc) {
    const F = frame(fc.ex, fc.ez, fc.yaw);
    addSign(F, fc.yaw, 'Food Court', '#c86b3c', 0, 4.2, 0.3, 5, 0.9, 'Sandwiches · Ice cream · Momos · South Indian');
    for (let k = -1; k <= 1; k++) { const [tx, , tz] = F(k * 3.2, 0, 7); if (ok(tx, tz)) table(tx, tz, 4, '#f2f0ea', '#e2702f'); }
    const [cx, , cz] = F(-7, 0, 5);
    if (ok(cx, cz)) cart(cx, cz, fc.yaw, 'Ice Cream', MENUS.icecream, '#d81b60');
  }
  // Domino's Pizza and KFC: two outlets side by side (names on plain signs: no logos), on the open ground by the Brahmaputra Hostel where its far
  // cycle stand used to be (that stand now stands by the hostel itself); if there is no room there, in front of the Food Court
  {
    const spots = [];
    const yard = world.yards?.brahmaputra, home = world.site('brahmaputra');
    if (yard && home) {
      // the outlets face the hostel (the customers come from there); side by side along the yard
      const fx = home.ex - yard.cx, fz = home.ez - yard.cz, nx0 = -yard.tz, nz0 = yard.tx, sgn = (fx * nx0 + fz * nz0) >= 0 ? 1 : -1;
      const yaw = Math.atan2(nx0 * sgn, nz0 * sgn);
      for (const k of [-3.5, 0, 3.5, -7, 7, -10, 10]) for (const back of [0, -1, 1]) spots.push({ x: yard.cx + yard.tx * k + nx0 * sgn * back * 0.0 - nx0 * sgn * (back * 0.8), z: yard.cz + yard.tz * k - nz0 * sgn * (back * 0.8), yaw });
    }
    if (fc) { const F = frame(fc.ex, fc.ez, fc.yaw); for (const [lx, lz] of [[12, 5.5], [-12, 5.5], [12, 8], [-12, 8], [16, 6], [-16, 6], [12, 11], [-12, 11], [20, 7], [-20, 7]]) { const [x, , z] = F(lx, 0, lz); spots.push({ x, z, yaw: fc.yaw }); } }
    let placed = false;
    for (const sp of spots) {
      if (placed) break;
      if (!fitStall(sp.x, sp.z, sp.yaw, 2.8, 5.2, true)) continue;
      const ax = Math.cos(sp.yaw), az = -Math.sin(sp.yaw);
      let pair = null;
      for (const gap of [4.5, 4.9, 5.5]) for (const sd of [1, -1]) { if (!pair && fitStall(sp.x + ax * gap * sd, sp.z + az * gap * sd, sp.yaw, 2.8, 5.2, true)) pair = [sp.x + ax * gap * sd, sp.z + az * gap * sd]; }
      if (!pair) continue;                                                // (both footprints must fit: the two stand together or not here)
      const dom = kiosk(sp.x, sp.z, sp.yaw, "Domino's Pizza", MENUS.pizza, '#0b4f9c', { tables: 1, signBg: '#0b4f9c', sub: 'Pizza · Garlic bread · Desserts', exact: true });
      let kfc = null;
      for (const gap of [4.6, 5.0, 5.4, 5.9, 6.5]) for (const sd of [1, -1]) { if (dom && !kfc) kfc = kiosk(sp.x + ax * gap * sd, sp.z + az * gap * sd, sp.yaw, 'KFC', MENUS.chicken, '#c8102e', { tables: 1, signBg: '#c8102e', sub: 'Chicken · Burgers · Wings', exact: true }); }
      void kfc;
      placed = true;
    }
  }
  // --- Market Complex: a row of shop fronts along the building, carts on the plaza, ATM kiosk
  const shops = [];
  const mk = world.site('shopping');
  if (mk) {
    const b = mk.blocks[0];
    const ring = b.rings[0];
    const tmp = { d: 0, x: 0, z: 0 };
    const SHOPS = [['General Store', MENUS.general, '#1f5a3d'], ['Pizza Corner', MENUS.pizza, '#8a3b1c'], ['Fruits & Vegetables', MENUS.veg, '#2e7d4f'],
      ['Stationery & Xerox', MENUS.stationery, '#5b2d7a'], ['Pharmacy', MENUS.pharmacy, '#00897b'], ['Bakery', MENUS.bakery, '#8a5a36'],
      ['Mobile & Recharge', MENUS.mobile, '#b3262f'], ['Hair Salon', MENUS.barber, '#46505c']];
    // walk along the wall from the entrance in both directions
    const perim = []; let acc = 0;
    for (let i = 0; i < ring.length; i += 2) {
      const j = (i + 2) % ring.length;
      const L = Math.hypot(ring[j] - ring[i], ring[j + 1] - ring[i + 1]);
      perim.push({ i, j, L, acc }); acc += L;
    }
    const at = (s) => {
      s = ((s % acc) + acc) % acc;
      const seg = perim.find((q) => s >= q.acc && s < q.acc + q.L) || perim[0];
      const t = (s - seg.acc) / seg.L;
      const ax = ring[seg.i], az = ring[seg.i + 1], bx = ring[seg.j], bz = ring[seg.j + 1];
      const dx = (bx - ax) / seg.L, dz = (bz - az) / seg.L;
      let nx = -dz, nz = dx;
      const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      if (pointInRing(px + nx * 0.5, pz + nz * 0.5, ring)) { nx = -nx; nz = -nz; }
      return { x: px, z: pz, nx, nz };
    };
    const e0 = closestOnRing(mk.ex, mk.ez, ring, tmp);
    let s0 = 0, bd = Infinity;
    for (let s = 0; s < acc; s += 0.5) { const q = at(s); const d = Math.hypot(q.x - e0.x, q.z - e0.z); if (d < bd) { bd = d; s0 = s; } }
    let k = 0;
    for (const dir of [1, -1]) {
      for (let n = 1; n <= 4 && k < SHOPS.length; n++) {
        const q = at(s0 + dir * (n * 4.6));
        const x = q.x + q.nx * 0.2, z = q.z + q.nz * 0.2;
        if (!ok(q.x + q.nx * 2, q.z + q.nz * 2)) continue;
        const yaw = Math.atan2(q.nx, q.nz);
        const [name, menu, col] = SHOPS[k++];
        const F = frame(x, z, yaw);
        put(F, yaw, new THREE.BoxGeometry(4.0, 0.08, 1.6), col, 0, 3.0, 0.8, 0.18);             // awning
        put(F, yaw, new THREE.BoxGeometry(3.4, 0.95, 0.6), '#a58d6a', 0, 0.48, 0.5);            // counter
        put(F, yaw, new THREE.BoxGeometry(3.6, 2.9, 0.05), '#3a3a3a', 0, 1.45, 0.06);           // dark shopfront
        for (let s = 0; s < 6; s++) put(F, yaw, new THREE.BoxGeometry(0.4, 0.3, 0.3), ['#e2702f', '#f2c12e', '#2e7d4f', '#3f6fb0', '#c62828', '#f2f0ea'][(s + k) % 6], -1.3 + s * 0.52, 1.13, 0.5);
        addSign(F, yaw, name, col, 0, 3.35, 0.12, 3.9, 0.72);
        const vendor = { x: x + q.nx * -0.1, z: z + q.nz * -0.1, yaw, anim: AN.STAND, taken: null };
        const st = { name, x: x + q.nx * 1.6, z: z + q.nz * 1.6, yaw, menu, vendor, seats: [], kind: name === 'Pizza Corner' ? 'pizzeria' : 'shop' };
        stalls.push(st); shops.push(st);
      }
    }
    // ATM kiosk and carts on the forecourt
    const pl = mk.plazaObj;
    const F = frame(mk.ex, mk.ez, mk.yaw);
    const [ax, , az] = F(9, 0, 6);
    if (ok(ax, az)) {
      const G = frame(ax, az, mk.yaw);
      put(G, mk.yaw, new THREE.BoxGeometry(2.4, 2.8, 2.4), '#f2f0ea', 0, 1.4, 0);
      put(G, mk.yaw, new THREE.BoxGeometry(2.0, 1.9, 0.05), '#6fa8c8', 0, 1.2, 1.21);
      addSign(G, mk.yaw, 'ATM', '#1f4fa0', 0, 2.55, 1.23, 1.6, 0.4);
      stalls.push({ name: 'ATM', x: ax + Math.sin(mk.yaw) * 1.8, z: az + Math.cos(mk.yaw) * 1.8, yaw: mk.yaw, menu: MENUS.atm, vendor: null, seats: [], kind: 'atm' });
    }
    const carts = [['Pani Puri', MENUS.panipuri, '#e2702f'], ['Momos', MENUS.momo, '#7d1f1f'], ['Fruit Cart', MENUS.fruit, '#2e7d4f'], ['Chai', MENUS.tea, '#5b3a29']];
    carts.forEach(([n, menu, col], i) => {
      const [cx, , cz] = F(-8 + i * 5, 0, pl ? 9 + (i % 2) * 2 : 8);
      if (ok(cx, cz)) cart(cx, cz, mk.yaw + Math.PI, n, menu, col);
    });
  }

  const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  // (there used to be a "chai point" at every hostel and a kiosk at the hospital, the library, the gym...: built after the shop
  // meshes were merged, so only their sign and vendor appeared, a person standing alone on the grass. They are gone: the stalls
  // that are left all have their counter, roof and tables)
  const extra = 0;

  return {
    extra,
    group, stalls, shops,
    setNight(k) { for (const s of signs) s.material.emissiveIntensity = k * 0.45; },
  };

  function faceRoad(x, z) {
    const n = graph.nearestOnNetwork(x, z);
    return n ? Math.atan2(n.x - x, n.z - z) : 0;
  }
}

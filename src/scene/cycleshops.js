// Cycle shops: a tin shed with tyres on the wall, new cycles out front, a pump, and the
// cycle-repair uncle at work on an upturned cycle. Buy a cycle, get yours fixed and pumped, or
// rent a scooty, a scooter or a motorbike for a ride round the campus (it goes back to the shop
// when you get off).
import * as THREE from 'three';
import { mulberry32, mergeColored, m4, canvasTexture } from '../util.js';
import { makeScooter, makeMotorbike, parkedBikeGeometry } from '../models.js';
import { AN } from '../crowd/people.js';
import { adultLook, OPT, bit } from '../crowd/looks.js';

const RENT = [['scooty', 'Rent the scooty', 60], ['rider', 'Rent the scooter', 80], ['motorbike', 'Rent the motorbike', 150]];   // rupees per ride
const CYCLE_PRICE = 5500;   // a new Hero / Firefox city bike from the campus cycle shop
const NEW_COLOURS = ['#c62f2f', '#2f5fa8', '#2e7d4f', '#1e1e1e', '#e0a526', '#7cb342', '#d81b60'];

export function buildCycleShops(game) {
  const W = game.world, G = game.graph, r = mulberry32(606060);
  const group = new THREE.Group();
  group.name = 'cycleshops';
  // where: the old cycle repair shop near the library, the Market Complex, the east hostels and the south hostels
  const wanted = [];
  const poi = W.pois.find((p) => /Cycle Repair/i.test(p.name || ''));
  if (poi) wanted.push({ x: poi.wx, z: poi.wz, name: 'Cycle Repair Shop' });
  for (const [id, name] of [['shopping', 'Market Cycle Store'], ['manas', 'Hostel Cycle Point'], ['subansiri', 'South Cycle Point']]) { const s = W.site(id); if (s) wanted.push({ x: s.ex + s.nx * 18, z: s.ez + s.nz * 18, name }); }
  const shops = [];
  const parts = [];
  const signs = [];
  const P = (geo, col, x, y, z, ry = 0, rx = 0, rz = 0) => parts.push({ geometry: geo, color: col, matrix: m4(x, y, z, rx, ry, rz) });
  for (const w of wanted) {
    // stand beside the nearest road, off the carriageway, clear of buildings
    const rd = G.roadAt(w.x, w.z, 80);
    if (!rd) continue;
    let spot = null;
    for (let t = 0; t < 30 && !spot; t++) {
      const side = t % 2 ? 1 : -1, along = (Math.floor(t / 2) - 7) * 4;
      const x = rd.x + rd.tx * along + rd.tz * side * (rd.hw + 5.5), z = rd.z + rd.tz * along - rd.tx * side * (rd.hw + 5.5);
      let ok = W.insideCampus(x, z);
      for (let a = 0; a < 6.28 && ok; a += 0.8) for (const d of [0, 2.5, 4]) if (W.buildingAt(x + Math.cos(a) * d, z + Math.sin(a) * d) || W.waterAt(x + Math.cos(a) * d, z + Math.sin(a) * d) || G.onRoad(x + Math.cos(a) * d, z + Math.sin(a) * d, 0.3)) ok = false;
      if (ok) spot = { x, z, yaw: Math.atan2(-rd.tz * side, rd.tx * side) };
    }
    if (!spot) continue;
    const { x, z, yaw } = spot, y = W.heightAt(x, z);
    const fx = Math.sin(yaw), fz = Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const at = (u, v) => [x + sx * u + fx * v, z + sz * u + fz * v];
    // the shed: back wall, side walls, sloping tin roof on posts
    let q = at(0, -1.6); P(new THREE.BoxGeometry(5, 2.8, 0.12), '#6f8a9a', q[0], y + 1.4, q[1], yaw);
    for (const u of [-2.45, 2.45]) { q = at(u, -0.4); P(new THREE.BoxGeometry(0.1, 2.6, 2.4), '#6f8a9a', q[0], y + 1.3, q[1], yaw); }
    q = at(0, -0.1); P(new THREE.BoxGeometry(5.4, 0.08, 3.6), '#9aa0a6', q[0], y + 2.85, q[1], yaw, 0.12);
    for (const u of [-2.5, 2.5]) { q = at(u, 1.6); P(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), '#555', q[0], y + 1.25, q[1]); }
    // tyres on the back wall, a workbench, the pump
    for (let k = 0; k < 6; k++) { q = at(-1.9 + k * 0.75, -1.5); P(new THREE.TorusGeometry(0.3, 0.045, 6, 14), '#151515', q[0], y + 1.9 - (k % 2) * 0.55, q[1], yaw); }
    q = at(1.6, -1.0); P(new THREE.BoxGeometry(1.4, 0.8, 0.6), '#8a5a36', q[0], y + 0.4, q[1], yaw);
    q = at(-1.9, 0.9); P(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), '#c62828', q[0], y + 0.35, q[1]); P(new THREE.BoxGeometry(0.25, 0.04, 0.12), '#c62828', q[0], y + 0.02, q[1], yaw);
    // an upturned cycle being repaired
    q = at(0.3, 0.2);
    const up = new THREE.Mesh(parkedBikeGeometry('#2f5fa8', 'roadster'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }));
    up.position.set(q[0], y + 1.05, q[1]); up.rotation.set(0, yaw + Math.PI / 2, Math.PI); group.add(up);
    // new cycles for sale out front
    const sale = [];
    for (let k = 0; k < 5; k++) {
      q = at(-2.2 + k * 1.1, 2.6);
      const col = NEW_COLOURS[(k + shops.length) % NEW_COLOURS.length];
      const b = new THREE.Mesh(parkedBikeGeometry(col, k % 2 ? 'mtb' : 'roadster'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 }));
      b.position.set(q[0], y, q[1]); b.rotation.y = yaw + Math.PI / 2 + 0.1; b.castShadow = true; group.add(b);
      sale.push({ x: q[0], z: q[1], col, mesh: b });
    }
    // rental scooty, scooter and motorbike parked to one side
    const rent = [];
    RENT.forEach(([kind, label, fare], k) => {
      q = at(3.8, 1.8 - k * 1.25);
      const mdl = kind === 'motorbike' ? makeMotorbike('#1c1c1c') : makeScooter(kind === 'scooty' ? '#e38aa0' : '#8fb4d8');
      mdl.group.position.set(q[0], y, q[1]); mdl.group.rotation.set(0, yaw + Math.PI / 2, 0.1);
      group.add(mdl.group);
      rent.push({ kind, label, fare, x: q[0], z: q[1], yaw: yaw + Math.PI / 2, mdl });
    });
    signs.push({ x: at(0, 1.62)[0], z: at(0, 1.62)[1], y: y + 2.55, yaw, text: w.name });
    const uncle = { x: at(0.3, 1.0)[0], z: at(0.3, 1.0)[1], yaw: yaw + Math.PI, look: adultLook(r, 'staff') };
    uncle.look.opts |= bit(OPT.CAP);
    shops.push({ name: w.name, x, z, yaw, sale, rent, uncle, y });
  }
  if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  for (const s of signs) {
    const tex = canvasTexture(512, 96, (g) => { g.fillStyle = '#c62828'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#fff'; g.font = '800 42px "Hind", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.text.toUpperCase(), 256, 38, 490); g.font = '600 22px "Hind", sans-serif'; g.fillText('Repair · New cycles · Scooty & bike on rent', 256, 76, 490); }, { repeat: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.86), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    m.position.set(s.x + Math.sin(s.yaw) * 0.02, s.y, s.z + Math.cos(s.yaw) * 0.02); m.rotation.y = s.yaw;
    group.add(m);
  }
  game.scene.add(group);

  // ------------------------------------------------------------ what you can do there
  let rented = null;
  game.interact.provider((pos, inside) => {
    if (inside || game.mode !== 'walk') return null;
    const out = [];
    for (const s of shops) {
      if (Math.hypot(s.x - pos.x, s.z - pos.z) > 9) continue;
      for (const v of s.rent) if (v.mdl.group.visible) out.push({ x: v.x, z: v.z, r: 1.8, label: `${v.label} · ₹${v.fare}`, run: function rent() {
        if (!game.progress.spend(v.fare, v.label.replace('Rent the ', '') + ' rental', rent)) return;
        v.mdl.group.visible = false; rented = v;
        game.drive.start(v.kind, v.x, v.z, v.yaw);
        game.drive.onStop = () => { v.mdl.group.visible = true; rented = null; game.ui.toast('Returned to the cycle shop.', 'info'); };
        game.setMode('drive');
        game.ui.toast('Ride carefully: the campus limit is 30 km/h. E to get off.', 'info', v.label.replace('Rent the ', ''));
      } });
      for (const c of s.sale) if (c.mesh.visible) out.push({ x: c.x, z: c.z, r: 1.2, label: `Buy this cycle · ₹${CYCLE_PRICE.toLocaleString('en-IN')}`, run: function buy() {
        if (!game.progress.spend(CYCLE_PRICE, 'new cycle', buy)) return;
        const L = game.player.avatar.look;
        game.setLook({ ...L, bikeColor: c.col });
        if (game.bike.borrowed) { game.props.setParked(game.bike.borrowed, true); game.bike.borrowed = null; }
        game.bike.ensureBike(); game.bike.summon();
        game.ui.toast('Your new cycle is parked next to you. B to ride.', 'gold', 'New cycle!');
        game.audio.bell?.(0, 0.6);
        game.progress.unlock?.('new_cycle');
      } });
      out.push({ x: s.uncle.x, z: s.uncle.z, r: 2.2, label: 'Get your cycle checked & tyres pumped · free', run: () => {
        game.ui.toast(['"Tyre was a bit low. Pumped it up - ride safe!"', '"Chain oiled, brakes tightened. No charge for students."', '"Puncture fixed. Watch out for the thorns near the lake road."'][Math.floor(Math.random() * 3)], 'info', 'Cycle uncle');
        game.audio.tone?.(900, 0.08, { gain: 0.05 });
      } });
    }
    return out;
  });
  return {
    group, shops,
    /** the repair uncles, drawn by the crowd */
    draw(crowd, t) {
      for (const s of shops) {
        const u = s.uncle;
        crowd.push({ x: u.x, y: s.y, z: u.z, yaw: u.yaw, anim: AN.LAB, phase: 0, speed: 0, extra: 0, look: u.look, opts: u.look.opts });
      }
    },
  };
}

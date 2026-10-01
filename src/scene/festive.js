// Things that change with the day: big fest banners (Techniche, Alcheringa, AI Confluence,
// Sports Day, Convocation, Club Fair...) that go up over the roads on the day before and the day
// of an event, a "today's special" board at every hostel canteen that changes each day, the
// late-night Food Court rush (22:30 - 00:45), and flower beds and clipped hedges in front of the
// main buildings.
import * as THREE from 'three';
import { mulberry32, mergeColored, m4, fitText } from '../util.js';
import { AN } from '../crowd/people.js';
import { studentLook, OPT, bit } from '../crowd/looks.js';

const SPECIALS = ['Aloo paratha & curd', 'Chole bhature', 'Egg curry & rice', 'Paneer butter masala', 'Fish curry (Assamese style)', 'Veg biryani & raita', 'Masala dosa'];
const FEST = {
  orientation: ['WELCOME, FRESHERS!', "Freshers' Orientation · Auditorium · 9:30 am", '#1f4f8a'],
  clubfair: ['CLUB FAIR', 'Student Activity Centre · 4 pm · find your people', '#6a2f7a'],
  cricketfinal: ['INTER-HOSTEL CRICKET FINAL', 'Cricket Ground · 3:30 pm', '#2e7d4f'],
  aiconf: ['AI CONFLUENCE', 'Talks · demos · posters · Conference Centre · 10 am', '#0b3d91'],
  techniche: ['TECHNICHE', 'Pronite · EDM night · Cricket Ground · 7 pm', '#111a3a'],
  sportsday: ['SPIRIT SPORTS DAY', 'Athletics Track · 7:30 am', '#c62828'],
  convocation: ['CONVOCATION', 'Football Ground · 9:30 am · congratulations, graduates!', '#6e1f2a'],
  alcheringa: ['ALCHERINGA', 'Pronite · live band · Cricket Ground · 6:30 pm', '#8a1f5a'],
};

export function buildFestive(game) {
  const W = game.world, G = game.graph, r = mulberry32(2929);
  const group = new THREE.Group();
  game.scene.add(group);
  // ------------------------------------------------------------ banner frames over the busiest roads
  const spots = [];
  const mg = W.gates.find((g) => g.main);
  const want = [mg && { x: mg.wx, z: mg.wz, d: 45 }, W.site('sac') && { x: W.site('sac').ex, z: W.site('sac').ez, d: 25 }, W.site('lhc') && { x: W.site('lhc').ex, z: W.site('lhc').ez, d: 30 }, W.site('newsac') && { x: W.site('newsac').ex, z: W.site('newsac').ez, d: 25 }].filter(Boolean);
  const cx = (W.bbox.x0 + W.bbox.x1) / 2, cz = (W.bbox.z0 + W.bbox.z1) / 2;
  for (const w of want) {
    // a point on a main road near the place, the banner spans the road
    let x = w.x, z = w.z;
    if (w === want[0]) { const dx = cx - x, dz = cz - z, L = Math.hypot(dx, dz) || 1; x += (dx / L) * w.d; z += (dz / L) * w.d; }
    const rd = G.roadAt(x, z, 60, (e) => e.main && !e.gen);
    if (!rd) continue;
    const y = W.heightAt(rd.x, rd.z), span = rd.hw * 2 + 2.4, nx = rd.tz, nz = -rd.tx;
    const frame = [];
    for (const s of [-1, 1]) frame.push({ geometry: new THREE.CylinderGeometry(0.1, 0.12, 8.8, 8), color: '#8a8f96', matrix: m4(rd.x + nx * s * span / 2, y + 4.4, rd.z + nz * s * span / 2) });
    frame.push({ geometry: new THREE.BoxGeometry(0.1, 0.1, span), color: '#8a8f96', matrix: m4(rd.x, y + 8.75, rd.z, 0, Math.atan2(nx, nz), 0) });      // the top rail the banner hangs from
    const fm = new THREE.Mesh(mergeColored(frame), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }));
    group.add(fm);
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 192;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    // two planes back to back (each the right way round for the side you see it from: a double-sided plane shows the writing mirrored from behind)
    const ban = new THREE.Group();
    const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
    const bf = new THREE.Mesh(new THREE.PlaneGeometry(span - 0.3, 1.8), bm), bb = new THREE.Mesh(new THREE.PlaneGeometry(span - 0.3, 1.8), bm);
    bf.position.z = 0.03; bb.position.z = -0.03; bb.rotation.y = Math.PI;
    ban.add(bf, bb);
    ban.position.set(rd.x, y + 7.75, rd.z); ban.rotation.y = Math.atan2(rd.tx, rd.tz);
    group.add(ban);
    spots.push({ ban, frame: fm, canvas, tex, shown: null, phase: r() * 6 });
  }
  const paint = (s, ev) => {
    const [title, sub, col] = FEST[ev.id] || [ev.name.toUpperCase(), ev.where, '#1f3a6e'];
    const g = fitText(s.canvas.getContext('2d')), Wd = 1024, H = 192;
    g.fillStyle = col; g.fillRect(0, 0, Wd, H);
    for (let k = 0; k < 16; k++) { g.fillStyle = `hsla(${(k * 47) % 360}, 80%, 60%, 0.18)`; g.beginPath(); g.arc(Math.random() * Wd, Math.random() * H, 20 + Math.random() * 60, 0, 7); g.fill(); }
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 78px "Teko", "Hind", sans-serif'; g.fillText(title, Wd / 2, 74, Wd - 60);
    g.font = '600 32px "Hind", sans-serif'; g.fillText(`${sub} · ${ev.dayLabel}`, Wd / 2, 150, Wd - 60);
    s.tex.needsUpdate = true;
  };
  // ------------------------------------------------------------ today's special at the hostel canteens
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 160;
  const specialTex = new THREE.CanvasTexture(sc); specialTex.colorSpace = THREE.SRGBColorSpace;
  const specialMat = new THREE.MeshStandardMaterial({ map: specialTex, roughness: 0.6 });
  for (const st of game.props.stalls || []) {
    if (!/Canteen/.test(st.name)) continue;
    const x = st.x + Math.sin(st.yaw) * 1.6 + Math.cos(st.yaw) * 2.4, z = st.z + Math.cos(st.yaw) * 1.6 - Math.sin(st.yaw) * 2.4;
    const y = W.heightAt(x, z);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.344), specialMat);
    b.scale.set(1, 1, 1);
    b.position.set(x, y + 1.1, z); b.rotation.y = st.yaw;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.05), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
    legs.position.set(x, y + 0.5, z - 0.02);
    group.add(b, legs);
  }
  let lastDay = -1;
  const paintSpecial = (wd, day) => {
    const g = fitText(sc.getContext('2d'));
    g.fillStyle = '#1c2a1c'; g.fillRect(0, 0, 512, 160);
    g.strokeStyle = '#8a5a36'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 150);
    g.fillStyle = '#f2c12e'; g.font = '700 30px "Hind", sans-serif'; g.textAlign = 'center'; g.fillText("TODAY'S SPECIAL", 256, 48);
    g.fillStyle = '#f7f4ea'; g.font = '600 36px "Hind", sans-serif'; g.fillText(SPECIALS[(wd + day) % SPECIALS.length], 256, 104, 480);
    g.font = '500 20px "Hind", sans-serif'; g.fillStyle = '#c9e0c9'; g.fillText('Noodles · rolls · chai till 2 am', 256, 138);
    specialTex.needsUpdate = true;
  };
  // ------------------------------------------------------------ late-night Food Court rush
  const fc = W.site('foodcourt'), rush = [];
  if (fc) {
    for (let k = 0; k < 44; k++) {
      const a = r() * 6.28, d = 4 + r() * 16;
      const x = fc.ex + fc.nx * (6 + Math.abs(Math.sin(a)) * d) + -fc.nz * Math.cos(a) * d, z = fc.ez + fc.nz * (6 + Math.abs(Math.sin(a)) * d) + fc.nx * Math.cos(a) * d;
      if (W.buildingAt(x, z) || G.onRoad(x, z, 0.3)) continue;
      const L = studentLook(r);
      rush.push({ x, y: W.heightAt(x, z), z, yaw: Math.atan2(fc.ex - x, fc.ez - z) + (r() - 0.5), anim: r() < 0.35 ? AN.EAT : r() < 0.6 ? AN.TALK : r() < 0.8 ? AN.PHONE : AN.STAND, phase: r() * 6, speed: 0, extra: 0, look: L, opts: L.opts | (r() < 0.5 ? bit(OPT.CUP) : bit(OPT.PLATE)), th: r() });
    }
  }
  // ------------------------------------------------------------ flower beds and clipped hedges in front of the big buildings
  const parts = [];
  const BLOOMS = [['#f28c1c', '#f6b21c'], ['#c62828', '#e2562f'], ['#d81b60', '#f06292'], ['#f4f4ef', '#f2c12e'], ['#7b1fa2', '#ba68c8']];
  let beds = 0;
  for (const s of W.sites) {
    if (!['academic', 'admin', 'culture', 'hostel', 'sports', 'service', 'food'].includes(s.kind)) continue;
    const tx = -s.nz, tz = s.nx;
    for (const side of [-1, 1]) {
      const bx = s.ex + s.nx * 3.5 + tx * side * 6, bz = s.ez + s.nz * 3.5 + tz * side * 6;
      if (W.buildingAt(bx, bz) || G.onRoad(bx, bz, 1) || W.waterAt(bx, bz)) continue;
      const yaw = Math.atan2(tx, tz);
      if (W.placer && !W.placer.footprint(bx, bz, yaw + Math.PI / 2, 2.3, 0.8, 0.3)) continue;      // the whole bed clear of paths, cycles and everything else
      W.placer?.reserveBox(bx, bz, yaw + Math.PI / 2, 2.1, 0.7, 'bed');
      const y = W.heightAt(bx, bz), pal = BLOOMS[(beds + side + 5) % BLOOMS.length];
      parts.push({ geometry: new THREE.BoxGeometry(4.2, 0.28, 1.2), color: '#b5533c', matrix: m4(bx, y + 0.14, bz, 0, yaw + Math.PI / 2, 0) });
      parts.push({ geometry: new THREE.BoxGeometry(4.0, 0.3, 1.0), color: '#3f5f2a', matrix: m4(bx, y + 0.22, bz, 0, yaw + Math.PI / 2, 0) });
      for (let k = 0; k < 18; k++) {
        const u = (k % 9 - 4) * 0.44, v = (Math.floor(k / 9) - 0.5) * 0.45;
        parts.push({ geometry: new THREE.IcosahedronGeometry(0.13, 0), color: pal[k % 2], matrix: m4(bx + tx * u + s.nx * v, y + 0.45, bz + tz * u + s.nz * v) });
      }
      // a clipped hedge beside the path
      for (let k = 0; k < 5; k++) { const hx = bx + s.nx * 2 + tx * side * (k * 1.1 - 2.2), hz = bz + s.nz * 2 + tz * side * (k * 1.1 - 2.2); if (!W.buildingAt(hx, hz) && !G.onRoad(hx, hz, 0.8)) parts.push({ geometry: new THREE.IcosahedronGeometry(0.45, 1), color: '#2f5a2a', matrix: m4(hx, W.heightAt(hx, hz) + 0.4, hz, 0, 0, 0, 1, 0.9, 1) }); }
      beds++;
    }
  }
  if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true })); m.castShadow = true; m.receiveShadow = true; group.add(m); }

  return {
    group, beds, rushCount: rush.length, banners: spots.length,
    update() {
      const c = game.clock, wd = c.weekday, h = c.hour;
      if (c.day !== lastDay) { lastDay = c.day; paintSpecial(wd, c.day); }
      // the next event today or tomorrow gets the banners
      const evs = game.events?.defs || [];
      const soon = evs.find((d) => d.day === wd && h < d.to) || evs.find((d) => d.day === (wd + 1) % 7);
      const key = soon ? `${soon.id}:${soon.day === wd ? 'today' : 'tomorrow'}` : null;
      for (const s of spots) {
        s.ban.visible = s.frame.visible = !!soon;
        if (soon && s.shown !== key) { s.shown = key; paint(s, { ...soon, dayLabel: soon.day === wd ? 'TODAY' : 'TOMORROW' }); }
        if (soon) s.ban.rotation.z = Math.sin(game.time * 1.3 + s.phase) * 0.012;
      }
    },
    drawRush(crowd) {
      const h = game.clock.hour;
      const k = h >= 22.5 ? Math.min(1, (h - 22.5) / 0.4) : h < 0.75 ? 1 - h / 0.75 * 0.6 : 0;
      if (k <= 0 || game.interior?.active) return;
      for (const p of rush) if (p.th < k) crowd.push(p);
    },
  };
}

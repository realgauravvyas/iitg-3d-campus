import * as THREE from 'three';
import { solarModule, solarMaterial } from './rooftop.js';
import { canvasTexture, mergeColored, m4, mulberry32, tube, fitText } from '../util.js';
import { densify } from './terrain.js';
import { parkedBikeGeometry } from '../models.js';
import { FILTERS } from '../route.js';
import { hoopU } from './courts.js';
import { buildGates } from './gates.js';

const KIND_COLOR = { hostel: '#3f7fb0', academic: '#c89b3c', admin: '#b3262f', culture: '#9b4dca', sports: '#2e9e6a',
  food: '#e2702f', nature: '#2f8f7f', service: '#6b7d8f', residential: '#7a6a58', dept: '#c89b3c', bus: '#b3262f' };
export { KIND_COLOR };

export function labelTexture(text, kind, sub) {
  const font = '600 34px "Hind", "Segoe UI", system-ui, sans-serif';
  const c = document.createElement('canvas');
  const g = fitText(c.getContext('2d'));
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 74;
  c.width = w; c.height = sub ? 86 : 64;
  g.font = font;
  g.fillStyle = 'rgba(12,24,26,0.82)';
  const r = 30;
  g.beginPath(); g.roundRect(2, 2, w - 4, c.height - 4, r); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = KIND_COLOR[kind] || '#c89b3c';
  g.beginPath(); g.arc(32, 32, 10, 0, 7); g.fill();
  g.fillStyle = '#f7f1e3';
  g.textBaseline = 'middle';
  g.fillText(text, 52, 34);
  if (sub) { g.font = '500 22px "Hind", "Segoe UI", sans-serif'; g.fillStyle = 'rgba(247,241,227,0.7)'; g.fillText(sub, 52, 66); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, aspect: w / c.height, h: c.height };
}

export function buildProps(world, graph) {
  const group = new THREE.Group();
  group.name = 'props';
  const rnd = mulberry32(2024);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);

  // ---------------------------------------------------------------- boundary wall
  const gates = world.gates;
  const pts = densify(world.boundary, 4);
  const wp = [], wc = [];
  const H = 2.3, T = 0.14;
  const cTop = new THREE.Color('#e3d9c6'), cBot = new THREE.Color('#b9ad97'), cCap = new THREE.Color('#8f2f2a');
  for (let k = 0; k < pts.length; k += 2) {
    const k2 = (k + 2) % pts.length;
    const ax = pts[k], az = pts[k + 1], bx = pts[k2], bz = pts[k2 + 1];
    if (gates.some((g) => Math.hypot(g.wx - (ax + bx) / 2, g.wz - (az + bz) / 2) < (g.main ? 14 : 7.5))) continue;
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
    const nx = (-dz / L) * T, nz = (dx / L) * T;
    const ha = world.heightAt(ax, az) - 0.4, hb = world.heightAt(bx, bz) - 0.4;
    for (const s of [1, -1]) {
      const ox = nx * s, oz = nz * s;
      wp.push(ax + ox, ha, az + oz, bx + ox, hb, bz + oz, bx + ox, hb + H, bz + oz, ax + ox, ha, az + oz, bx + ox, hb + H, bz + oz, ax + ox, ha + H, az + oz);
      wc.push(...cBot.toArray(), ...cBot.toArray(), ...cTop.toArray(), ...cBot.toArray(), ...cTop.toArray(), ...cTop.toArray());
    }
    wp.push(ax + nx, ha + H, az + nz, bx + nx, hb + H, bz + nz, bx - nx, hb + H, bz - nz, ax + nx, ha + H, az + nz, bx - nx, hb + H, bz - nz, ax - nx, ha + H, az - nz);
    for (let i = 0; i < 6; i++) wc.push(...cCap.toArray());
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  wg.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
  wg.computeVertexNormals();
  const wall = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  wall.castShadow = true; wall.receiveShadow = true;
  group.add(wall);

  // ---------------------------------------------------------------- gates (see gates.js)
  const gatesObj = buildGates(world);
  group.add(gatesObj.group);

  // ---------------------------------------------------------------- street lamps
  const lampPos = [];
  for (const r of world.data.roads) {
    if (!['residential', 'unclassified', 'tertiary', 'secondary'].includes(r.kind) && !(r.gen && r.kind === 'service')) continue;
    const P2 = r.pts.map(([x, y]) => [x, -y]);
    let acc = 0, next = 10 + rnd() * 10, side = 1;
    for (let i = 0; i < P2.length - 1; i++) {
      const [ax, az] = P2[i], [bx, bz] = P2[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      while (next < acc + L) {
        const t = (next - acc) / L;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const nx = -(bz - az) / L, nz = (bx - ax) / L;
        const off = r.w / 2 + 1.1;
        const lx = x + nx * off * side, lz = z + nz * off * side;
        if (!world.buildingAt(lx, lz) && !world.waterAt(lx, lz)) { lampPos.push([lx, lz, Math.atan2(-nx * side, -nz * side)]); world.addSolid(lx, lz, 0.2, 'lamp', true); }
        side = -side;
        next += 30 + rnd() * 8;
      }
      acc += L;
    }
  }
  const poleGeo = mergeColored([
    { geometry: new THREE.CylinderGeometry(0.06, 0.09, 7, 6).translate(0, 3.5, 0), color: '#5d6166' },
    { geometry: tube(new THREE.Vector3(0, 6.9, 0), new THREE.Vector3(0, 7.2, 1.3), 0.04, 5), color: '#5d6166' },
  ]);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), lampPos.length);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0xffd08a, emissiveIntensity: 0, roughness: 0.4 });
  const headMatA = headMat.clone();
  const glowTex = canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,210,140,0.9)'); gr.addColorStop(0.5, 'rgba(255,190,110,0.25)'); gr.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }, { repeat: false });
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const poolMatA = poolMat.clone();
  // lamps around the academic area (all but every third) switch off after the library closes at 2 am
  const acadSites = ['lhc', 'academic', 'core5', 'workshop', 'conference', 'tic', 'library', 'admin', 'auditorium'].map((id) => world.landmark(id)).filter(Boolean);
  const acadLamp = lampPos.map(([x, z], i) => i % 3 !== 0 && acadSites.some((l) => Math.hypot(l.wx - x, l.wz - z) < 150));
  const nA = acadLamp.filter(Boolean).length, nB = lampPos.length - nA;
  const headGeo = new THREE.BoxGeometry(0.28, 0.12, 0.6).translate(0, 7.12, 1.35), poolGeo = new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2);
  const heads = new THREE.InstancedMesh(headGeo, headMat, nB), headsA = new THREE.InstancedMesh(headGeo, headMatA, Math.max(1, nA));
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, nB), poolsA = new THREE.InstancedMesh(poolGeo, poolMatA, Math.max(1, nA));
  headsA.count = poolsA.count = nA;
  let iA = 0, iB = 0;
  lampPos.forEach(([x, z, a], i) => {
    const y = world.heightAt(x, z);
    const A = acadLamp[i], j = A ? iA++ : iB++;
    M.compose(P.set(x, y, z), Q.setFromAxisAngle(Y, a), S.set(1, 1, 1));
    poles.setMatrixAt(i, M); (A ? headsA : heads).setMatrixAt(j, M);
    const fx = x + Math.sin(a) * 1.3, fz = z + Math.cos(a) * 1.3;
    M.compose(P.set(fx, world.heightAt(fx, fz) + 0.25, fz), Q.identity(), S.set(1, 1, 1));
    (A ? poolsA : pools).setMatrixAt(j, M);
  });
  poles.castShadow = true;
  group.add(poles, heads, pools, headsA, poolsA);

  // ---------------------------------------------------------------- benches by the lakes
  const benchGeo = mergeColored([
    { geometry: new THREE.BoxGeometry(1.8, 0.06, 0.45), color: '#8a5a36', matrix: m4(0, 0.45, 0) },
    { geometry: new THREE.BoxGeometry(1.8, 0.4, 0.06), color: '#8a5a36', matrix: m4(0, 0.72, -0.22, -0.15) },
    { geometry: new THREE.BoxGeometry(0.08, 0.45, 0.4), color: '#3c3c3c', matrix: m4(0.8, 0.22, 0) },
    { geometry: new THREE.BoxGeometry(0.08, 0.45, 0.4), color: '#3c3c3c', matrix: m4(-0.8, 0.22, 0) },
  ]);
  const benchPos = [];
  for (const w of world.water) {
    if (w.kind === 'pool') continue;
    const ring = densify(w.rings[0], 45);
    for (let k = 0; k < ring.length; k += 2) {
      const k2 = (k + 2) % ring.length;
      const dx = ring[k2] - ring[k], dz = ring[k2 + 1] - ring[k + 1], L = Math.hypot(dx, dz) || 1;
      for (const s of [1, -1]) {
        const x = ring[k] - (dz / L) * 5 * s, z = ring[k + 1] + (dx / L) * 5 * s;
        if (world.waterAt(x, z) || world.buildingAt(x, z) || !world.insideCampus(x, z)) continue;
        benchPos.push([x, z, Math.atan2(ring[k] - x, ring[k + 1] - z)]);
        break;
      }
    }
  }
  // sit-outs at path ends and the hill-top View Point: benches looking out, a pavilion at the view point
  const pav = [];
  for (const s of world.sitouts) {
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), rx = fz, rz = -fx;
    for (const o of [-1.4, 1.4]) benchPos.push([s.wx + rx * o + fx * 1.2, s.wz + rz * o + fz * 1.2, s.yaw, s.view ? 'view' : 'sitout']);
    if (s.view) {
      const y = world.heightAt(s.wx, s.wz);
      const R = 3.2;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        pav.push({ geometry: new THREE.CylinderGeometry(0.1, 0.12, 2.8, 8), color: '#e8e2d4', matrix: m4(s.wx + Math.cos(a) * R, y + 1.4, s.wz + Math.sin(a) * R) });
      }
      pav.push({ geometry: new THREE.ConeGeometry(R + 0.9, 1.6, 6), color: '#7d1f1f', matrix: m4(s.wx, y + 3.6, s.wz) });
      pav.push({ geometry: new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.2, 6), color: '#b9ad97', matrix: m4(s.wx, y + 0.1, s.wz) });
      // railing on the downhill side + a coin-operated binocular stand
      for (let k = -4; k <= 4; k++) pav.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5), color: '#555', matrix: m4(s.wx + fx * 5.5 + rx * k * 0.9, y + 0.5, s.wz + fz * 5.5 + rz * k * 0.9) });
      pav.push({ geometry: tube(new THREE.Vector3(s.wx + fx * 5.5 - rx * 3.6, y + 1.0, s.wz + fz * 5.5 - rz * 3.6), new THREE.Vector3(s.wx + fx * 5.5 + rx * 3.6, y + 1.0, s.wz + fz * 5.5 + rz * 3.6), 0.04), color: '#555' });
      pav.push({ geometry: new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8), color: '#2d5f8a', matrix: m4(s.wx + fx * 4.6, y + 0.6, s.wz + fz * 4.6) });
      pav.push({ geometry: new THREE.BoxGeometry(0.4, 0.2, 0.25), color: '#2d5f8a', matrix: m4(s.wx + fx * 4.6, y + 1.3, s.wz + fz * 4.6, 0, s.yaw, 0) });
    }
  }
  if (pav.length) { const pm = new THREE.Mesh(mergeColored(pav), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })); pm.castShadow = true; pm.receiveShadow = true; group.add(pm); }
  // benches stand beside the paths, not on them, and not on top of each other (a bench that would sit on a path
  // is slid outwards, away from the water; if there is still no room it is left out)
  for (let i = benchPos.length - 1; i >= 0; i--) {
    const b = benchPos[i];
    if (world.placer) {
      let ok = false;
      for (const push of [0, 1.2, 2.4, 3.6]) {
        const x = b[0] - Math.sin(b[2]) * push, z = b[1] - Math.cos(b[2]) * push;
        if (world.placer.free(x, z, 0.95)) { b[0] = x; b[1] = z; ok = true; break; }
      }
      if (!ok) { benchPos.splice(i, 1); continue; }
    }
    world.addSolid(b[0], b[1], 0.95, 'bench');
  }
  const benches = new THREE.InstancedMesh(benchGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), benchPos.length);
  benchPos.forEach(([x, z, a], i) => { M.compose(P.set(x, world.heightAt(x, z), z), Q.setFromAxisAngle(Y, a), S.set(1, 1, 1)); benches.setMatrixAt(i, M); });
  benches.castShadow = true;
  group.add(benches);

  // ---------------------------------------------------------------- parked bicycles (the campus runs on cycles)
  // Every hostel has a covered cycle stand with about a hundred cycles; every other building and
  // place has a few cycles by the door; some houses have a cycle or two on the porch.
  const bikeColors = ['#1e1e1e', '#1e1e1e', '#1e1e1e', '#c62f2f', '#2f5fa8', '#2e7d4f', '#d7d7d7', '#e0a526', '#6b3d5e', '#8a8f96'];
  const bikeSlots = [];
  const shedParts = [], shedSolar = [];
  const cyclePark = new THREE.Group(); cyclePark.name = 'cycle-parks'; group.add(cyclePark);
  const clearOf = (x, z, m = 0.8) => world.placer ? world.placer.free(x, z, Math.min(m, 0.6)) : world.insideCampus(x, z) && !world.buildingAt(x, z) && !world.waterAt(x, z) && !graph.onRoad(x, z, m);
  const addBike = (x, z, a) => { bikeSlots.push([x, z, a, Math.floor(rnd() * bikeColors.length)]); world.addSolid(x, z, 0.42, 'cycle'); };
  const row = (cx, cz, tx, tz, nx, nz, n, gap = 0.62) => {
    for (let k = 0; k < n; k++) {
      const along = (k - (n - 1) / 2) * gap;
      const x = cx + tx * along, z = cz + tz * along;
      if (!clearOf(x, z, 0.9)) continue;
      addBike(x, z, Math.atan2(nx, nz) + (rnd() - 0.5) * 0.18);
    }
  };
  /** a rectangle (w along t, d along n) that is clear of buildings, water and roads */
  const fits = (cx, cz, tx, tz, w, d) => {
    for (let i = -3; i <= 3; i++) for (let j = -1; j <= 1; j++) {
      const x = cx + tx * (i / 3) * (w / 2) - tz * (j * d / 2), z = cz + tz * (i / 3) * (w / 2) + tx * (j * d / 2);
      if (!clearOf(x, z, 0.8)) return false;
    }
    return true;
  };
  /** the spots to try for a hostel's cycle park, nearest the door first: round the entrance, then (for a hostel whose stand has to be close) all
   *  round the building a few metres off its wall, running along it */
  const standSpots = (s, ring) => {
    const out = [], tx0 = -s.nz, tz0 = s.nx;
    if (!ring) {
      for (let t = 0; t < 70; t++) {
        const d = 7 + (t % 10) * 3.5, side = ((t / 10) | 0) % 2 ? 1 : -1, lat = side * (6 + Math.floor(t / 20) * 9);
        const cx = s.ex + s.nx * d + tx0 * lat, cz = s.ez + s.nz * d + tz0 * lat;
        out.push([cx, cz, tx0, tz0], [cx, cz, s.nx, s.nz]);
      }
      return out;
    }
    const b = s.blocks.reduce((m, q) => (q.area > m.area ? q : m), s.blocks[0]), r = b.rings[0];
    for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length, ax = r[i], az = r[i + 1], bx = r[j], bz = r[j + 1], L = Math.hypot(bx - ax, bz - az);
      if (L < 14) continue;
      const tx = (bx - ax) / L, tz = (bz - az) / L;
      let nx = tz, nz = -tx;
      if (pointInRing(ax + nx * 0.6 + tx * L / 2, az + nz * 0.6 + tz * L / 2, r)) { nx = -nx; nz = -nz; }          // out of the building
      for (let u = 8; u <= L - 8; u += 4) for (const off of [6.2, 8.5, 11.5]) out.push([ax + tx * u + nx * off, az + tz * u + nz * off, tx, tz]);
    }
    out.sort((p, q) => Math.hypot(p[0] - s.ex, p[1] - s.ez) - Math.hypot(q[0] - s.ex, q[1] - s.ez));
    return out;
  };
  const stand = (s, ring = false) => {
    // search around the hostel entrance for room for a walled cycle park: a 22 m x 7.2 m enclosure with the 20 m x 5.4 m solar shed inside
    for (const [cx, cz, tx, tz] of standSpots(s, ring)) {
        if (!fits(cx, cz, tx, tz, 22.4, 7.4)) continue;
        // Brahmaputra's cycle stand has to be near its hostel: the spot 39 m away (it is open ground, now Domino's and KFC stand there) is kept
        // free, and the stand goes within 30 m of the door, or along the building's own wall
        if (s.lm === 'brahmaputra' && Math.hypot(cx - s.ex, cz - s.ez) > 30) { (world.yards ||= {})[s.lm] ||= { cx, cz, tx, tz }; continue; }
        const nx = -tz, nz = tx;
        (world.cycleParks ||= []).push({ site: s.lm, cx, cz, tx, tz, d: Math.hypot(cx - s.ex, cz - s.ez) });
        // two rows of cycles facing a centre rail, under a roof of solar panels on a steel frame
        for (const sd of [1, -1]) row(cx + nx * sd * 1.25, cz + nz * sd * 1.25, tx, tz, -nx * sd, -nz * sd, 30, 0.6);
        const y = world.heightAt(cx, cz), yaw = Math.atan2(tx, tz);            // local z runs along the stand
        for (let k = -3; k <= 3; k++) for (const sd of [1, -1]) {
          const px = cx + tx * k * 3.3 + nx * sd * 2.6, pz = cz + tz * k * 3.3 + nz * sd * 2.6;
          shedParts.push({ geometry: new THREE.CylinderGeometry(0.05, 0.05, 2.5 - sd * 0.16, 6), color: '#6f7479', matrix: m4(px, y + (2.5 - sd * 0.16) / 2, pz) });
        }
        const roofM = m4(cx, y + 2.5, cz, 0, yaw, 0.06);
        for (const xo of [-2.55, 0, 2.55]) shedParts.push({ geometry: new THREE.BoxGeometry(0.1, 0.12, 20.4), color: '#6f7479', matrix: roofM.clone().multiply(m4(xo, -0.1, 0)) });   // purlins
        for (let k = -3; k <= 3; k++) shedParts.push({ geometry: new THREE.BoxGeometry(5.6, 0.1, 0.08), color: '#6f7479', matrix: roofM.clone().multiply(m4(0, -0.18, k * 3.3)) });   // rafters
        for (let i = 0; i < 19; i++) for (const xo of [-1.73, 0, 1.73]) shedSolar.push(roofM.clone().multiply(m4(xo, 0, -9.0 + i * 1.0)));
        shedParts.push({ geometry: new THREE.BoxGeometry(0.06, 0.5, 19.5), color: '#8a8f96', matrix: m4(cx, y + 0.35, cz, 0, yaw, 0) });
        shedParts.push({ geometry: new THREE.BoxGeometry(5.2, 0.05, 19.8), color: '#9a9a94', matrix: m4(cx, y + 0.03, cz, 0, yaw, 0) });
        // the boundary: a low plastered wall with a coping all round the shed, open only at a gate on the side that faces the
        // hostel door (people and cycles come in there, nowhere else), two gate pillars and a small name board
        {
          const A = 11.0, B = 3.6, sideSign = ((s.ex - cx) * nx + (s.ez - cz) * nz) >= 0 ? 1 : -1;
          const wall = (ax, az, bx, bz) => {
            const L = Math.hypot(bx - ax, bz - az); if (L < 0.3) return;
            const mx = (ax + bx) / 2, mz = (az + bz) / 2, wy = world.heightAt(mx, mz), wyaw = Math.atan2(bx - ax, bz - az);
            shedParts.push({ geometry: new THREE.BoxGeometry(0.22, 1.4, L), color: '#cfc8b8', matrix: m4(mx, wy + 0.3, mz, 0, wyaw, 0) });
            shedParts.push({ geometry: new THREE.BoxGeometry(0.32, 0.08, L + 0.02), color: '#a9a295', matrix: m4(mx, wy + 1.04, mz, 0, wyaw, 0) });
            world.indexFence({ ax, az, bx, bz, top: wy + 1.05 });
          };
          const at = (u, v) => [cx + tx * u + nx * v, cz + tz * u + nz * v];
          const gapA = 1.7;
          for (const [u0, u1, v] of [[-A, A, -sideSign * B]]) wall(...at(u0, v), ...at(u1, v));
          wall(...at(-A, sideSign * B), ...at(-gapA, sideSign * B));
          wall(...at(gapA, sideSign * B), ...at(A, sideSign * B));
          wall(...at(-A, -B), ...at(-A, B)); wall(...at(A, -B), ...at(A, B));
          for (const u of [-gapA, gapA]) { const [px, pz] = at(u, sideSign * B); shedParts.push({ geometry: new THREE.BoxGeometry(0.42, 1.9, 0.42), color: '#b9b2a2', matrix: m4(px, world.heightAt(px, pz) + 0.55, pz) }); shedParts.push({ geometry: new THREE.BoxGeometry(0.52, 0.1, 0.52), color: '#8f8a80', matrix: m4(px, world.heightAt(px, pz) + 1.55, pz) }); }
          const [bx0, bz0] = at(0, sideSign * (B + 0.14)), bh = world.heightAt(bx0, bz0);
          const nm = (s.name || '').replace(' Hostel', '').toUpperCase();
          const sgn = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshStandardMaterial({ map: canvasTexture(512, 116, (g, w, h) => { g.fillStyle = '#1f5f8f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '800 46px "Hind", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${nm} CYCLE PARK`, w / 2, h / 2 + 2, w - 24); }, { repeat: false }), roughness: 0.6 }));
          sgn.position.set(bx0, bh + 2.45, bz0); sgn.rotation.y = Math.atan2(nx * sideSign, nz * sideSign);
          cyclePark.add(sgn);
          shedParts.push({ geometry: new THREE.BoxGeometry(2.3, 0.6, 0.06), color: '#2a2f33', matrix: m4(bx0 - nx * sideSign * 0.04, bh + 2.45, bz0 - nz * sideSign * 0.04, 0, Math.atan2(nx * sideSign, nz * sideSign), 0) });
          shedParts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 2.1, 6), color: '#6f7479', matrix: m4(bx0 - nx * sideSign * 0.05 + tx * 1.0, bh + 1.4, bz0 - nz * sideSign * 0.05 + tz * 1.0) });
          world.placer?.reserveBox?.(cx, cz, yaw, 11.4, 3.8, 'cyclepark');
        }
        // the inverter on the end post, with its green light
        const ix = cx + tx * 10.1 + nx * 2.6, iz = cz + tz * 10.1 + nz * 2.6;
        shedParts.push({ geometry: new THREE.BoxGeometry(0.5, 0.65, 0.22), color: '#d9dcdf', matrix: m4(ix, y + 1.5, iz, 0, yaw, 0) });
        shedParts.push({ geometry: new THREE.BoxGeometry(0.06, 0.06, 0.03), color: '#39d353', matrix: m4(ix + tx * 0.12, y + 1.7, iz + tz * 0.12, 0, yaw, 0) });
        // a second stand for the big hostels
        return true;
    }
    return ring || s.lm !== 'brahmaputra' ? false : stand(s, true);               // (none free by the door: along the wall)
  };
  for (const s of world.sites) {
    const tx = -s.nz, tz = s.nx;
    if (s.kind === 'hostel') { stand(s); if (s.blocks.length > 1 || (s.blocks[0] && s.blocks[0].area > 2500)) stand(s); }
    // a few cycles by every site's door
    const n = s.kind === 'hostel' ? 0 : ['academic', 'sports', 'food', 'culture', 'admin'].includes(s.kind) ? 12 + Math.floor(rnd() * 10) : 6;
    for (const sd of [1, -1]) {
      const cx = s.ex + s.nx * 3.2 + tx * sd * (4 + n * 0.16), cz = s.ez + s.nz * 3.2 + tz * sd * (4 + n * 0.16);
      row(cx, cz, tx, tz, -s.nx, -s.nz, Math.ceil(n / 2));
    }
  }
  // the Khokha Gate: the way in from the gate is lined on both sides with parked cycles (students cross to the market here)
  for (const gt of world.gates) {
    if (gt.name !== 'Khokha Gate') continue;
    const ox = Math.cos(gt.angle), oz = -Math.sin(gt.angle), lx = -oz, lz = ox;          // out of the campus / along the wall
    for (const s of [1, -1]) for (const row2 of [0, 1]) {
      const along = 7 + row2 * 0.0, off = s * (3.0 + row2 * 0.75);
      const cx = gt.wx - ox * (along + 9) + lx * off, cz = gt.wz - oz * (along + 9) + lz * off;
      row(cx, cz, -ox, -oz, -s * lx, -s * lz, 26, 0.68);
    }
  }
  // every other building gets a few; houses a cycle or two on the porch
  for (const b of world.buildings) {
    if (b.site) continue;
    const res = b.kind === 'residential';
    if (res && (b.area > 600 || rnd() > 0.35)) continue;
    const e = world.entranceOf(b, graph);
    if (!e || !isFinite(e.x)) continue;
    const n = res ? 1 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 5);
    const ex = Math.sin(e.yaw), ez = Math.cos(e.yaw), tx = ez, tz = -ex;
    row(e.x + ex * 1.8 + tx * (1.6 + n * 0.3), e.z + ez * 1.8 + tz * (1.6 + n * 0.3), tx, tz, -ex, -ez, n);
  }
  if (shedParts.length) {
    const shed = new THREE.Mesh(mergeColored(shedParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }));
    shed.castShadow = true; shed.receiveShadow = true;
    group.add(shed);
  }
  if (shedSolar.length) {
    const sm = new THREE.InstancedMesh(solarModule(1.7, 1.0), solarMaterial(), shedSolar.length);
    shedSolar.forEach((mx, i) => sm.setMatrixAt(i, mx));
    sm.castShadow = true; sm.receiveShadow = true;
    group.add(sm);
  }
  // instanced by 120 m chunk and colour, drawn only near the camera
  const pbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 });
  const geos = bikeColors.map((c, i) => parkedBikeGeometry(c, i % 2 ? 'roadster' : 'mtb'));
  const CH = 120, bchunks = new Map();
  for (const b of bikeSlots) {
    const k = `${Math.floor(b[0] / CH)},${Math.floor(b[1] / CH)},${b[3]}`;
    if (!bchunks.has(k)) bchunks.set(k, []);
    bchunks.get(k).push(b);
  }
  let parkedCount = 0;
  const parked = []; // every parked bicycle can be borrowed
  const bikeChunks = [];
  for (const [k, list] of bchunks) {
    const [gx, gz, ci] = k.split(',').map(Number);
    const im = new THREE.InstancedMesh(geos[ci], pbMat, list.length);
    list.forEach(([x, z, a], i) => {
      M.compose(P.set(x, world.heightAt(x, z), z), Q.setFromAxisAngle(Y, a), S.set(1, 1, 1)); im.setMatrixAt(i, M);
      parked.push({ x, z, a, color: bikeColors[ci], style: ci % 2 ? 'roadster' : 'mtb', im, i, taken: false });
    });
    im.castShadow = true;
    im.computeBoundingSphere();
    group.add(im);
    bikeChunks.push({ im, x: (gx + 0.5) * CH, z: (gz + 0.5) * CH });
    parkedCount += list.length;
  }

  // ---------------------------------------------------------------- sports equipment
  const white = '#f4f4f0';
  const sportParts = [];
  for (const f of world.data.fields) {
    const pts2 = f.p.map(([x, y]) => [x, -y]);
    const cx = pts2.reduce((s, p) => s + p[0], 0) / pts2.length, cz = pts2.reduce((s, p) => s + p[1], 0) / pts2.length;
    const ax = Math.cos(f.angle), az = -Math.sin(f.angle);
    const y = world.heightAt(cx, cz);
    const rot = Math.atan2(ax, az);
    const at = (d, h, side = 0) => [cx + ax * d - az * side, h, cz + az * d + ax * side];
    if (f.kind === 'soccer' || f.kind === 'hockey' || f.kind === 'athletics') {
      const half = f.kind === 'athletics' ? f.len / 2 - 22 : f.len / 2 - 3;
      const gw = f.kind === 'hockey' ? 3.66 : 7.3, gh = f.kind === 'hockey' ? 2.1 : 2.44;
      for (const s of [1, -1]) {
        const [gx, , gz] = at(s * half, 0);
        const gy = world.heightAt(gx, gz);
        for (const q of [1, -1]) sportParts.push({ geometry: new THREE.CylinderGeometry(0.06, 0.06, gh, 6), color: white, matrix: m4(gx - az * q * gw / 2, gy + gh / 2, gz + ax * q * gw / 2) });
        sportParts.push({ geometry: new THREE.BoxGeometry(0.1, 0.1, gw), color: white, matrix: m4(gx, gy + gh, gz, 0, rot + Math.PI / 2, 0) });
      }
    }
    if (f.kind === 'basketball') {
      // hoops line up with the painted court (scene/courts.js): rim 1.575 m in from the baseline
      const hu = hoopU(f);
      for (const s of [1, -1]) {
        const [bx, , bz] = at(s * (hu + 1.575 + 0.7), 0);
        const by = world.heightAt(bx, bz);
        sportParts.push({ geometry: new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), color: '#3a5a8a', matrix: m4(bx, by + 1.7, bz) });
        sportParts.push({ geometry: new THREE.BoxGeometry(0.08, 0.08, 1.1), color: '#3a5a8a', matrix: m4(...at(s * (hu + 0.8), by + 3.35, 0), 0, rot, 0) });
        const [rx, , rz] = at(s * (hu + 0.375), 0);
        sportParts.push({ geometry: new THREE.BoxGeometry(1.8, 1.05, 0.06), color: white, matrix: m4(rx, by + 3.4, rz, 0, rot, 0) });
        const [hx, , hz] = at(s * hu, 0);
        sportParts.push({ geometry: new THREE.TorusGeometry(0.23, 0.02, 5, 14).rotateX(Math.PI / 2), color: '#e2562f', matrix: m4(hx, by + 3.05, hz) });
      }
    }
    // tennis / volleyball nets and posts: scene/courts.js
    if (f.kind === 'cricket') {
      for (const s of [1, -1]) {
        const [sx, , sz] = at(s * 10, 0);
        const sy = world.heightAt(sx, sz);
        for (const q of [-0.11, 0, 0.11]) sportParts.push({ geometry: new THREE.CylinderGeometry(0.02, 0.02, 0.71, 5), color: '#e8d9a8', matrix: m4(sx - az * q, sy + 0.355, sz + ax * q) });
      }
    }
  }
  if (sportParts.length) {
    const sm = new THREE.Mesh(mergeColored(sportParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    sm.castShadow = true;
    group.add(sm);
  }

  // ---------------------------------------------------------------- landmark labels & signboards
  const labels = [];
  const labelGroup = new THREE.Group();
  for (const lm of world.landmarks) {
    const { tex, aspect } = labelTexture(lm.name, lm.kind);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true, fog: false, sizeAttenuation: false }));
    const b = world.buildingAt(lm.wx, lm.wz);
    const baseY = b ? b.roof + 5 : world.heightAt(lm.wx, lm.wz) + 9;
    sp.position.set(lm.wx, baseY, lm.wz);
    sp.userData = { aspect, lm };
    sp.center.set(0.5, 0);
    labelGroup.add(sp);
    labels.push(sp);
  }
  for (const p of world.pois) {
    const { tex, aspect } = labelTexture(p.name, p.kind);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, sizeAttenuation: false }));
    const b = world.buildingAt(p.wx, p.wz);
    sp.position.set(p.wx, (b ? b.roof + 2.5 : world.heightAt(p.wx, p.wz) + 4.5), p.wz);
    sp.userData = { aspect, poi: p, small: true };
    sp.center.set(0.5, 0);
    labelGroup.add(sp);
    labels.push(sp);
  }
  group.add(labelGroup);

  // green campus signboards at the roadside for each landmark
  const boardParts = [];
  const boardGroup = new THREE.Group();
  for (const lm of world.landmarks) {
    const near = graph.nearestOnNetwork(lm.wx, lm.wz, FILTERS.car);
    if (!near || near.d > 90) continue;
    let dx = lm.wx - near.x, dz = lm.wz - near.z;
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const x = near.x + dx * 5.5, z = near.z + dz * 5.5;
    if (world.buildingAt(x, z) || world.waterAt(x, z)) continue;
    const y = world.heightAt(x, z);
    const tex = canvasTexture(512, 160, (g, w, h) => {
      g.fillStyle = '#1f5a3d'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#f2f0ea'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = '#f2f0ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = 46; g.font = `bold ${fs}px "Hind", "Segoe UI", sans-serif`;
      while (g.measureText(lm.name).width > w - 50 && fs > 22) { fs -= 2; g.font = `bold ${fs}px "Hind", "Segoe UI", sans-serif`; }
      g.fillText(lm.name, w / 2, h / 2 - 12);
      g.font = '26px "Hind", "Segoe UI", sans-serif'; g.fillText('IIT Guwahati', w / 2, h / 2 + 34);
    }, { repeat: false });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
    board.position.set(x, y + 2.1, z);
    board.rotation.y = Math.atan2(-dx, -dz);
    boardGroup.add(board);
    for (const q of [1, -1]) boardParts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 2.5, 5), color: '#555', matrix: m4(x + Math.cos(board.rotation.y) * q * 1.05, y + 1.25, z - Math.sin(board.rotation.y) * q * 1.05) });
  }
  if (boardParts.length) boardGroup.add(new THREE.Mesh(mergeColored(boardParts), new THREE.MeshStandardMaterial({ vertexColors: true })));
  group.add(boardGroup);

  return {
    group, labels, parkedCount, lampCount: lampPos.length, lampPos, benchPos, parked, gates: gatesObj,
    /** hide / show one parked bicycle (borrowing) */
    setParked(pb, visible) {
      M.compose(P.set(pb.x, world.heightAt(pb.x, pb.z), pb.z), Q.setFromAxisAngle(Y, pb.a), S.setScalar(visible ? 1 : 0));
      pb.im.setMatrixAt(pb.i, M);
      pb.im.instanceMatrix.needsUpdate = true;
      pb.taken = !visible;
    },
    nearestParked(x, z, r = 2.2) {
      let best = null, bd = r;
      for (const pb of parked) { if (pb.taken) continue; const d = Math.hypot(pb.x - x, pb.z - z); if (d < bd) { bd = d; best = pb; } }
      return best;
    },
    setNight(k, dt = 0, hour = 20) {
      headMat.emissiveIntensity = k * 3;
      poolMat.opacity = k * 0.8;
      const off = hour >= 2 && hour < 5.6 ? 0 : 1;
      headMatA.emissiveIntensity = k * 3 * off;
      poolMatA.opacity = k * 0.8 * off;
      gatesObj.setNight(k, dt, hour);
    },
    updateLabels(camera, discovered) {
      const cp = camera.position;
      // parked cycles: only the chunks near the camera are drawn
      this._bc = (this._bc || 0) - 1;
      if (this._bc <= 0) { this._bc = 20; for (const c of bikeChunks) c.im.visible = Math.hypot(c.x - cp.x, c.z - cp.z) < 170 + Math.min(120, Math.max(0, cp.y - 80) * 0.3); }
      const fovK = Math.tan((camera.fov * Math.PI) / 360);
      for (const sp of labels) {
        const d = cp.distanceTo(sp.position);
        const small = sp.userData.small;
        const maxD = small ? 140 : 700;
        sp.visible = d < maxD;
        if (!sp.visible) continue;
        const h = (small ? 0.05 : 0.068) * fovK * (1 - Math.min(0.35, d / 2500));
        sp.scale.set(h * sp.userData.aspect, h, 1);
        sp.material.opacity = Math.min(1, (maxD - d) / (maxD * 0.25));
      }
    },
  };
}

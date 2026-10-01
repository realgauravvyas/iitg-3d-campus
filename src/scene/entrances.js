// Places that are easy to miss (the Computer Centre, round the side of the Central Library; the
// Campus Café) get an entrance you cannot miss: a lit gateway arch over the path to the door (where
// no road runs), a tall pylon sign beside the door, a big double-sided signboard by the nearest road
// with an arrow and the distance, a security booth with a guard - and they are landmarks, so they
// show on the map, in the journal, on the fingerposts at the junctions and in the planner.
import * as THREE from 'three';
import { mergeColored, m4, canvasTexture } from '../util.js';
import { FILTERS } from '../route.js';

const FONT = (w, px) => `${w} ${px}px "Hind", "Segoe UI", system-ui, sans-serif`;

/** a name board: title, a line under it and an optional arrow (+1 points right, -1 left) */
function boardTex(title, sub, bg, arrow = 0, h = 320) {
  return canvasTexture(1024, h, (g, w) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
    const pad = arrow ? 150 : 0, cx0 = w / 2 + (arrow > 0 ? -pad / 2 : pad / 2);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = FONT(800, sub ? 104 : 96); g.fillText(title, cx0, sub ? h * 0.42 : h / 2 + 4, w - 90 - pad);
    if (sub) { g.font = FONT(600, 46); g.fillText(sub, cx0, h * 0.76, w - 90 - pad); }
    if (arrow) {
      const cx = arrow > 0 ? w - 110 : 110, cy = h / 2, s = arrow;
      g.beginPath(); g.moveTo(cx - 60 * s, cy - 30); g.lineTo(cx + 5 * s, cy - 30); g.lineTo(cx + 5 * s, cy - 70); g.lineTo(cx + 75 * s, cy); g.lineTo(cx + 5 * s, cy + 70); g.lineTo(cx + 5 * s, cy + 30); g.lineTo(cx - 60 * s, cy + 30); g.closePath(); g.fill();
    }
  }, { repeat: false });
}

/** door: {x, z, yaw} with yaw facing out of the door */
export function markPlace(game, { id, name, kind, desc, door, color, sub = 'IIT Guwahati', guard = true }) {
  const W = game.world, G = game.graph;
  const group = new THREE.Group();
  group.name = `entrance-${id}`;
  const parts = [], planes = [];
  const fx = Math.sin(door.yaw), fz = Math.cos(door.yaw);          // out of the door
  const sx = Math.cos(door.yaw), sz = -Math.sin(door.yaw);         // sideways
  const PL = W.placer;
  const ground = (x, z) => W.insideCampus(x, z) && !W.buildingAt(x, z) && !W.waterAt(x, z);
  // nothing stands on a road, a lane or a footpath, or on something else that is already there
  const clear = (x, z, m = 1.0) => (PL ? PL.free(x, z, Math.min(m, 0.9)) : ground(x, z) && !G.onRoad(x, z, m));
  // the way in may run under the arch (a footpath), but never a carriageway or a lane
  const notRoad = (x, z, m = 1.0) => ground(x, z) && G.wayClearance(x, z, m + 1, false) > m;
  const emissive = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0.2 });

  // a landmark: on the map, in the journal, on the fingerposts and in the planner
  if (!W.landmark(id)) { const y = W.heightAt(door.x, door.z); W.landmarks.push({ id, name, kind, desc, x: door.x, y: -door.z, z: y + 30, wx: door.x, wz: door.z, wy: y }); }

  // 1. the gateway arch over the way to the door (not over a carriageway)
  let arch = null;
  for (const d of [7, 5.5, 9, 4.5, 11, 3.6]) {
    const ax = door.x + fx * d, az = door.z + fz * d;
    if (![-2.6, -1.3, 0, 1.3, 2.6].every((k) => notRoad(ax + sx * k, az + sz * k, 1.0)) || ![-2.1, 2.1].every((k) => clear(ax + sx * k, az + sz * k, 0.6))) continue;
    const y = W.heightAt(ax, az);
    for (const o of [-2.1, 2.1]) {
      const px = ax + sx * o, pz = az + sz * o, py = W.heightAt(px, pz), H = 3.4 + (y - py);
      PL?.reserve(px, pz, 0.45, 'arch', true);
      parts.push({ geometry: new THREE.BoxGeometry(0.46, H, 0.46), color: '#e8e2d4', matrix: m4(px, py + H / 2, pz, 0, door.yaw, 0) });
      parts.push({ geometry: new THREE.BoxGeometry(0.58, 0.12, 0.58), color: '#b9ad97', matrix: m4(px, y + 3.46, pz, 0, door.yaw, 0) });
      parts.push({ geometry: new THREE.SphereGeometry(0.17, 12, 8), color: '#fff2c4', matrix: m4(px, y + 3.7, pz) });          // lamps on the pillars
    }
    parts.push({ geometry: new THREE.BoxGeometry(4.9, 0.8, 0.34), color, matrix: m4(ax, y + 3.05, az, 0, door.yaw, 0) });
    const t = boardTex(name.toUpperCase(), '', color, 0, 160);
    for (const s of [1, -1]) planes.push({ tex: t, x: ax + fx * 0.18 * s, y: y + 3.05, z: az + fz * 0.18 * s, w: 4.6, h: 0.72, yaw: door.yaw + (s < 0 ? Math.PI : 0) });
    arch = { x: ax, z: az };
    break;
  }

  // 2. a tall pylon sign beside the door, readable from along the front of the building
  for (const [o, d] of [[4.4, 1.4], [-4.4, 1.4], [5.8, 1.6], [-5.8, 1.6], [3.4, 2.4], [-3.4, 2.4]]) {
    const px = door.x + sx * o + fx * d, pz = door.z + sz * o + fz * d;
    if (!clear(px, pz, 0.8)) continue;
    const y = W.heightAt(px, pz), t = boardTex(name.toUpperCase(), sub, color);
    for (const k of [-1.2, 1.2]) { parts.push({ geometry: new THREE.CylinderGeometry(0.07, 0.09, 5.2, 8), color: '#5a5f64', matrix: m4(px + fx * k, y + 2.6, pz + fz * k) }); PL?.reserve(px + fx * k, pz + fz * k, 0.3, 'pylon', true); }
    parts.push({ geometry: new THREE.BoxGeometry(3.2, 1.05, 0.12), color: '#2f3a44', matrix: m4(px, y + 4.75, pz, 0, door.yaw + Math.PI / 2, 0) });
    // the board runs along the front of the building: its faces look along the front, both ways
    for (const s of [1, -1]) { const nx = sx * s, nz = sz * s; planes.push({ tex: t, x: px + nx * 0.07, y: y + 4.75, z: pz + nz * 0.07, w: 3.0, h: 0.94, yaw: Math.atan2(nx, nz) }); }
    break;
  }

  // 3. the big signboard by the nearest road, its faces looking along the road, with an arrow and the distance
  const nn = G.nearestOnNetwork(door.x, door.z, FILTERS.car);
  if (nn && nn.d < 80) {
    const rd = G.roadAt(nn.x, nn.z, 6, FILTERS.car), hw = rd?.hw || 3, tx = rd?.tx ?? 1, tz = rd?.tz ?? 0;
    let dx = door.x - nn.x, dz = door.z - nn.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    for (const extra of [2.4, 3.6, 5.0, 1.6]) {
      const px = nn.x + dx * (hw + extra), pz = nn.z + dz * (hw + extra);
      if (!clear(px, pz, 0.6)) continue;
      const y = W.heightAt(px, pz), bx = -tz, bz = tx;                     // the board's width axis (across the road direction)
      const dist = Math.max(5, Math.round(Math.hypot(door.x - px, door.z - pz) / 5) * 5);
      for (const s of [1, -1]) {
        const nx = tx * s, nz = tz * s;                                    // this face looks along +-t
        const rx = nz, rz = -nx;                                           // the reader's right hand (they look along -n)
        const arrow = dx * rx + dz * rz >= 0 ? 1 : -1;
        planes.push({ tex: boardTex(name.toUpperCase(), `${dist} m`, color, arrow), x: px + nx * 0.07, y: y + 4.3, z: pz + nz * 0.07, w: 3.8, h: 1.19, yaw: Math.atan2(nx, nz) });
      }
      parts.push({ geometry: new THREE.BoxGeometry(3.95, 1.35, 0.12), color: '#2f3a44', matrix: m4(px, y + 4.3, pz, 0, Math.atan2(tx, tz), 0) });
      for (const o of [-1.7, 1.7]) { parts.push({ geometry: new THREE.CylinderGeometry(0.08, 0.1, 5.0, 8), color: '#5a5f64', matrix: m4(px + bx * o, y + 2.5, pz + bz * o) }); PL?.reserve(px + bx * o, pz + bz * o, 0.3, 'sign', true); }
      break;
    }
  }

  // 4. a security booth beside the arch (or the door): neighbourhood.js posts the guard there
  if (guard) {
    const bx = arch ? arch.x : door.x + fx * 2.6, bz = arch ? arch.z : door.z + fz * 2.6, o = arch ? 3.5 : 3.0;
    (W.extraPosts ||= []).push({ x: bx - sx * o, z: bz - sz * o, yaw: Math.atan2(sx, sz), label: `${name.toUpperCase()} SECURITY` });
    // (the booth is made in neighbourhood.js; it takes the nearest spot that is off every road and path)
    // and a OneStop machine on the other side of the way in
    game.onestop?.addKiosk({ id: `place-${id}`, name, x: bx + sx * (arch ? 3.3 : 2.8), z: bz + sz * (arch ? 3.3 : 2.8), yaw: door.yaw, kind: 'place' });
  }

  if (parts.length) { const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  for (const p of planes) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), emissive(p.tex));
    m.position.set(p.x, p.y, p.z); m.rotation.y = p.yaw;
    group.add(m);
  }
  game.scene.add(group);
  return { group, arch };
}

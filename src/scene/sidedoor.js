// A second door into a big building that opens a different place inside it: the Computer Centre
// is part of the Central Library's complex on the map, so it gets its own glass door (with a board
// over it) on the side of the building away from the library's entrance.
import * as THREE from 'three';
import { canvasTexture } from '../util.js';

export function buildSideDoor(game, b, board, name, template) {
  const W = game.world, G = game.graph, e = W.entranceOf(b, G);
  const ring = b.rings[0];
  let best = null;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length, ax = ring[i], az = ring[i + 1], bx = ring[j], bz = ring[j + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 6) continue;
    const nx = -(bz - az) / L, nz = (bx - ax) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2;
    // open ground in front of it and a path or road near
    let ok = true;
    for (const d of [1.2, 3, 6]) { const x = mx + nx * d, z = mz + nz * d; if (W.buildingAt(x, z) || W.waterAt(x, z) || !W.insideCampus(x, z)) ok = false; }
    if (!ok) continue;
    let road = 0;
    for (let d = 2; d <= 30; d += 2) if (G.onRoad(mx + nx * d, mz + nz * d, 1)) { road = d; break; }
    const away = Math.hypot(mx - e.x, mz - e.z);
    const score = away + (road ? 40 - road : 0) + Math.min(L, 20) * 0.5;
    if (away > 18 && (!best || score > best.score)) best = { mx, mz, nx, nz, score };
  }
  if (!best) return null;
  const { mx, mz, nx, nz } = best, yaw = Math.atan2(nx, nz), y = Math.max(b.floor0, W.heightAt(mx + nx, mz + nz));
  const group = new THREE.Group();
  group.name = 'side-door';
  // glass double door in a dark frame, a canopy, and the board
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.4), new THREE.MeshStandardMaterial({ color: 0x27414f, roughness: 0.15, metalness: 0.4 }));
  door.position.set(mx + nx * 0.04, y + 1.2, mz + nz * 0.04); door.rotation.y = yaw;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.4), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.7 }));
  canopy.position.set(mx + nx * 0.7, y + 2.75, mz + nz * 0.7); canopy.rotation.y = yaw; canopy.castShadow = true;
  const tex = canvasTexture(1024, 160, (g, w, h) => {
    g.fillStyle = '#1f3a5f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f2f0ea'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#ffffff'; g.font = '700 70px "Hind", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(board, w / 2, h / 2 + 4);
  }, { repeat: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.53), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  sign.position.set(mx + nx * 0.06, y + 3.25, mz + nz * 0.06); sign.rotation.y = yaw;
  group.add(door, canopy, sign);
  door.material.color.set(0x7a98a6); door.material.metalness = 0.15; door.material.roughness = 0.2;
  // two glass leaves: a mullion down the middle, push bars, the lit lobby behind the glass
  const barMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.4, metalness: 0.6 });
  const along = (u, v, w, h, d = 0.06) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), barMat); m.position.set(mx + nx * d + Math.cos(yaw) * u, y + v, mz + nz * d - Math.sin(yaw) * u); m.rotation.y = yaw; group.add(m); };
  along(0, 1.2, 0.07, 2.4); along(-0.55, 1.05, 0.8, 0.05, 0.09); along(0.55, 1.05, 0.8, 0.05, 0.09);
  along(0, 2.45, 2.5, 0.12, 0.05); along(-1.19, 1.22, 0.12, 2.45, 0.05); along(1.19, 1.22, 0.12, 2.45, 0.05);     // the frame
  const lobby = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3), new THREE.MeshBasicMaterial({ color: 0xf4ead0, transparent: true, opacity: 0.22 }));
  lobby.position.set(mx + nx * 0.045, y + 1.75, mz + nz * 0.05); lobby.rotation.y = yaw; group.add(lobby);
  // steps up from the lawn to the door sill, with a landing
  const gy = Math.min(W.heightAt(mx + nx * 2.5, mz + nz * 2.5), W.heightAt(mx + nx * 1.2, mz + nz * 1.2)), rise = y - gy;
  if (rise > 0.12) {
    // not out onto a road: the flight is fitted into the room between the wall and the nearest road edge
    let room = 9;
    for (let t = 0.3; t < 9; t += 0.2) { const qx = mx + nx * t, qz = mz + nz * t; if (game.graph.onRoad(qx, qz, 0.5) || W.buildingAt(qx, qz)) { room = Math.max(0, t - 0.4); break; } }
    let n = Math.max(1, Math.ceil(rise / 0.17)), tr = 0.32, base = 1.2;
    if (base + (n - 1) * tr > room) { tr = 0.26; n = Math.max(1, Math.ceil(rise / 0.22)); while (n > 1 && base + (n - 1) * tr > room) n--; if (base > room) base = Math.max(0.6, room); }
    const stepMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.85 });
    for (let k = 0; k < n; k++) {
      const top = gy + ((k + 1) / n) * rise, depth = base + (n - 1 - k) * tr, h = top - (gy - 0.4);
      const s = new THREE.Mesh(new THREE.BoxGeometry(3.2, h, depth), stepMat);
      s.position.set(mx + nx * depth / 2, top - h / 2, mz + nz * depth / 2); s.rotation.y = yaw; s.receiveShadow = true;
      group.add(s);
    }
  }
  game.scene.add(group);
  const out = { x: mx + nx * 1.6, z: mz + nz * 1.6, yaw };
  game.interact.add({ x: mx + nx * 0.9, z: mz + nz * 0.9, r: 3.2, prio: 4, label: `Enter the ${name}`, run: () => game.interiors.enter(b, { template, name, outside: out, onestop: template === 'computer' ? 'place-computercentre' : undefined }) });
  game.onestop?.addDoor({ site: 'place-computercentre', x: mx, z: mz, y, nx, nz, w: 2.2, h: 2.4 });
  return { b, x: mx, z: mz, yaw, nx, nz, group };
}

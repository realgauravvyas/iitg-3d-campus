import * as THREE from 'three';
import { canvasTexture, mulberry32 } from '../util.js';
import { ELEV0 } from '../world.js';
import { U } from './shared.js';

function rippleNormals() {
  const rnd = mulberry32(21);
  // height field from sums of sines -> normal map (tileable)
  const W = 256;
  const hts = new Float32Array(W * W);
  const waves = Array.from({ length: 14 }, () => ({
    kx: Math.round((rnd() - 0.5) * 16), ky: Math.round((rnd() - 0.5) * 16), p: rnd() * 6.28, a: 0.3 + rnd(),
  }));
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      let h = 0;
      for (const w of waves) h += w.a * Math.sin(((w.kx * x + w.ky * y) / W) * Math.PI * 2 + w.p);
      hts[y * W + x] = h;
    }
  return canvasTexture(W, W, (g) => {
    const img = g.createImageData(W, W);
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const hx = hts[y * W + ((x + 1) % W)] - hts[y * W + ((x - 1 + W) % W)];
        const hy = hts[((y + 1) % W) * W + x] - hts[((y - 1 + W) % W) * W + x];
        const nx = -hx * 0.25, ny = -hy * 0.25, nz = 1;
        const L = Math.hypot(nx, ny, nz);
        const p = (y * W + x) * 4;
        img.data[p] = ((nx / L) * 0.5 + 0.5) * 255;
        img.data[p + 1] = ((ny / L) * 0.5 + 0.5) * 255;
        img.data[p + 2] = ((nz / L) * 0.5 + 0.5) * 255;
        img.data[p + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}

function tileTex(base, grout, n = 16) {
  return canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = grout; g.fillRect(0, 0, W, H);
    const s = W / n;
    const rnd = mulberry32(4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = new THREE.Color(base).multiplyScalar(0.93 + rnd() * 0.1);
      g.fillStyle = '#' + c.getHexString();
      g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
    }
  });
}

/** Raindrop rings added to the ripple normals while it rains. */
function patchLake(sh) {
  sh.uniforms.uRain = U.uRain;
  sh.uniforms.uTime = U.uTime;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vLakeXZ;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLakeXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float uRain, uTime; varying vec2 vLakeXZ;
      vec2 dropRings(vec2 p){
        vec2 acc = vec2(0.0);
        for (int k = 0; k < 3; k++) {
          vec2 q = p * (0.9 + float(k) * 0.37) + float(k) * 13.1;
          vec2 cell = floor(q), f = fract(q) - 0.5;
          float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
          float t = fract(uTime * 0.9 + h);
          vec2 c = f - (vec2(fract(h * 7.3), fract(h * 3.7)) - 0.5) * 0.5;
          float d = length(c);
          float ring = sin((d - t * 0.45) * 60.0) * smoothstep(0.45, 0.0, d) * (1.0 - t);
          acc += normalize(c + 1e-4) * ring;
        }
        return acc;
      }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (uRain > 0.01) { vec2 dr = dropRings(vLakeXZ * 1.6) * uRain * 0.35; normal = normalize(normal + vec3(dr.x, 0.0, dr.y)); }`);
}

export function buildWater(world) {
  const group = new THREE.Group();
  group.name = 'water';
  const normalMap = rippleNormals();
  normalMap.repeat.set(1 / 14, 1 / 14);
  const lakeMat = new THREE.MeshPhysicalMaterial({
    color: 0x2f5d5a, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.93,
    normalMap, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.1, clearcoat: 0.3,
  });
  lakeMat.onBeforeCompile = patchLake;
  const poolMat = new THREE.MeshPhysicalMaterial({
    color: 0x3fb4d8, roughness: 0.04, transparent: true, opacity: 0.72, normalMap,
    normalScale: new THREE.Vector2(0.15, 0.15), envMapIntensity: 0.8, depthWrite: false,
  });
  poolMat.onBeforeCompile = patchLake;
  const tiles = tileTex('#7fc6e0', '#e8f4f8', 16);
  const deckTex = tileTex('#d9d2c2', '#b9b2a2', 8);
  for (const w of world.data.water) {
    const shape = new THREE.Shape(w.p.map((p) => new THREE.Vector2(p[0], p[1])));
    for (const h of w.holes || []) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2); // (x, y) map -> (x, 0, -y) world
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
    const m = new THREE.Mesh(g, w.kind === 'pool' ? poolMat : lakeMat);
    m.position.y = w.level - ELEV0;
    m.receiveShadow = true;
    m.renderOrder = w.kind === 'pool' ? 3 : 0;
    group.add(m);
    if (w.kind === 'pool') group.add(poolBasin(w, tiles, deckTex));
  }
  let t = 0;
  return {
    group,
    update(dt) {
      t += dt;
      normalMap.offset.set(t * 0.004, t * 0.0027);
      lakeMat.normalScale.setScalar(0.35 + U.uWind.value * 0.25);
    },
  };
}

/** Tiled pool: walls down to a 1.9 m floor, a tiled deck, lane ropes and ladders. */
function poolBasin(w, tiles, deckTex) {
  const grp = new THREE.Group();
  const deck = (w.deck ?? w.level + 0.3) - ELEV0, lvl = w.level - ELEV0, floor = deck - 2.0;
  const P = w.p.map(([x, y]) => [x, -y]);
  const wall = { p: [], u: [] };
  let cum = 0;
  for (let i = 0; i < P.length; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length];
    const L = Math.hypot(bx - ax, bz - az);
    wall.p.push(ax, deck, az, bx, deck, bz, bx, floor, bz, ax, deck, az, bx, floor, bz, ax, floor, az);
    wall.u.push(cum / 2, 1, (cum + L) / 2, 1, (cum + L) / 2, 0, cum / 2, 1, (cum + L) / 2, 0, cum / 2, 0);
    cum += L;
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wall.p, 3));
  wg.setAttribute('uv', new THREE.Float32BufferAttribute(wall.u, 2));
  wg.computeVertexNormals();
  const tm = tiles.clone(); tm.needsUpdate = true; tm.repeat.set(1, 1);
  grp.add(new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ map: tm, roughness: 0.3, side: THREE.DoubleSide })));
  const shape = new THREE.Shape(w.p.map((p) => new THREE.Vector2(p[0], p[1])));
  const fg = new THREE.ShapeGeometry(shape);
  fg.rotateX(-Math.PI / 2);
  const fu = fg.attributes.uv, fp = fg.attributes.position;
  for (let i = 0; i < fp.count; i++) fu.setXY(i, fp.getX(i) / 2, fp.getZ(i) / 2);
  const fm = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.3 }));
  fm.position.y = floor;
  grp.add(fm);
  // deck: a ring 3 m wide around the pool
  const outer = new THREE.Shape(offsetRing(w.p, 3.2).map((p) => new THREE.Vector2(p[0], p[1])));
  outer.holes.push(new THREE.Path(w.p.map((p) => new THREE.Vector2(p[0], p[1]))));
  const dg = new THREE.ShapeGeometry(outer);
  dg.rotateX(-Math.PI / 2);
  const du = dg.attributes.uv, dp = dg.attributes.position;
  for (let i = 0; i < dp.count; i++) du.setXY(i, dp.getX(i) / 2.5, dp.getZ(i) / 2.5);
  const dm = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.7 }));
  dm.position.y = deck + 0.03;
  dm.receiveShadow = true;
  grp.add(dm);
  // lane ropes along the long axis
  let best = 0, ai = 0;
  for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length]; const L = Math.hypot(bx - ax, bz - az); if (L > best) { best = L; ai = i; } }
  const [ax, az] = P[ai], [bx, bz] = P[(ai + 1) % P.length];
  const dx = (bx - ax) / best, dz = (bz - az) / best, nx = -dz, nz = dx;
  let width = 0;
  for (const [x, z] of P) width = Math.max(width, Math.abs((x - ax) * nx + (z - az) * nz));
  const sgn = P.reduce((s, [x, z]) => s + ((x - ax) * nx + (z - az) * nz), 0) > 0 ? 1 : -1;
  const lanes = Math.max(3, Math.min(8, Math.floor(width / 2.5)));
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd8322e, roughness: 0.5 });
  const ropeMat2 = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.5 });
  for (let k = 1; k < lanes; k++) {
    const off = (width / lanes) * k * sgn;
    const g = new THREE.CylinderGeometry(0.05, 0.05, best - 1, 6);
    g.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(g, k % 2 ? ropeMat : ropeMat2);
    m.position.set((ax + bx) / 2 + nx * off, lvl + 0.03, (az + bz) / 2 + nz * off);
    m.rotation.y = -Math.atan2(dz, dx);
    grp.add(m);
  }
  // ladders at the two ends
  const lad = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 0.8, roughness: 0.25 });
  for (const t of [0.15, 0.85]) {
    const x = ax + dx * best * t + nx * 0.3 * sgn, z = az + dz * best * t + nz * 0.3 * sgn;
    for (const s of [-0.25, 0.25]) {
      const g = new THREE.TorusGeometry(0.35, 0.025, 6, 12, Math.PI);
      const m = new THREE.Mesh(g, lad);
      m.position.set(x + dx * s, deck + 0.1, z + dz * s);
      m.rotation.y = -Math.atan2(nz, nx) + Math.PI / 2;
      grp.add(m);
    }
  }
  return grp;
}

/** Outward offset of a simple polygon ring (map coords) by d metres. */
function offsetRing(pts, d) {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]; area += x0 * y1 - x1 * y0; }
  const s = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const t1 = [p[0] - a[0], p[1] - a[1]], t2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(...t1) || 1, l2 = Math.hypot(...t2) || 1;
    const n1 = [t1[1] / l1, -t1[0] / l1], n2 = [t2[1] / l2, -t2[0] / l2];
    const nx = n1[0] + n2[0], ny = n1[1] + n2[1], L = Math.hypot(nx, ny) || 1;
    const k = d / Math.max(0.5, (n1[0] * nx + n1[1] * ny) / L);
    return [p[0] + (nx / L) * k * s, p[1] + (ny / L) * k * s];
  });
}

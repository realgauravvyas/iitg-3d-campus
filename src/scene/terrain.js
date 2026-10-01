import * as THREE from 'three';
import { pointInRing, canvasTexture, mulberry32, b64ToBytes } from '../util.js';
import { ELEV0 } from '../world.js';
import { wetPatch } from './shared.js';

export function detailTexture() {
  const rnd = mulberry32(7);
  return canvasTexture(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    // value noise, tileable, a few octaves
    const oct = [8, 16, 32, 64];
    const grids = oct.map((n) => Array.from({ length: n * n }, () => rnd()));
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = 0, amp = 0.5, tot = 0;
        oct.forEach((n, k) => {
          const fx = (x / w) * n, fy = (y / h) * n;
          const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, t = fy - j;
          const G = grids[k];
          const a = G[(j % n) * n + (i % n)], b = G[(j % n) * n + ((i + 1) % n)];
          const c = G[((j + 1) % n) * n + (i % n)], d = G[((j + 1) % n) * n + ((i + 1) % n)];
          const su = u * u * (3 - 2 * u), st = t * t * (3 - 2 * t);
          v += ((a * (1 - su) + b * su) * (1 - st) + (c * (1 - su) + d * su) * st) * amp;
          tot += amp; amp *= 0.55;
        });
        v = v / tot;
        const p = (y * w + x) * 4;
        img.data[p] = img.data[p + 1] = img.data[p + 2] = Math.round(v * 255);
        img.data[p + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}

export function buildTerrain(world, groundImg, maskImg) {
  const t = world.terrain;
  const { nx, ny, cell, minx, miny } = t;
  const [gx0, gy0, gx1, gy1] = world.data.ground.bounds;
  const N = nx * ny;
  const pos = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  const inside = new Uint8Array(N);
  const B = world.boundary;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = minx + i * cell, y = miny + j * cell;
      pos[k * 3] = x; pos[k * 3 + 1] = world.H[k]; pos[k * 3 + 2] = -y;
      uv[k * 2] = (x - gx0) / (gx1 - gx0);
      uv[k * 2 + 1] = (y - gy0) / (gy1 - gy0);
      inside[k] = pointInRing(x, -y, B) ? 1 : 0;
    }
  const idx = [];
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (!(inside[a] | inside[b] | inside[c] | inside[d])) continue;
      // map y grows north (= -z): keep triangles facing up
      idx.push(a, b, c, b, d, c);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // make sure normals point up
  const nrm = geo.attributes.normal;
  if (nrm.getY(Math.floor(N / 2)) < 0) {
    for (let k = 0; k < idx.length; k += 3) { const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp; }
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }

  const map = new THREE.Texture(groundImg);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 16;
  map.needsUpdate = true;
  const alpha = new THREE.Texture(maskImg);
  alpha.needsUpdate = true;
  const detail = detailTexture();
  const micro = microTexture();
  const ao = aoTexture(world, groundImg.width, groundImg.height);

  const mat = new THREE.MeshStandardMaterial({ map, alphaMap: alpha, alphaTest: 0.5, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detail };
    sh.uniforms.microMap = { value: micro };
    sh.uniforms.aoMapG = { value: ao };
    wetPatch(sh, { puddles: false, minRough: 0.45 });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform sampler2D detailMap, microMap, aoMapG;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dA = texture2D(detailMap, vWPos.xz * 0.21).r;
        float dB = texture2D(detailMap, vWPos.xz * 0.043).r;
        float dC = texture2D(detailMap, vWPos.xz * 1.3).r;
        diffuseColor.rgb *= 0.74 + dA * 0.32 + dB * 0.22 + dC * 0.12;
        // grass blades vs. bare soil micro detail, chosen by how green the ground is
        vec3 mc = texture2D(microMap, vWPos.xz * 0.45).rgb;
        float green = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 14.0, 0.0, 1.0);
        diffuseColor.rgb *= mix(vec3(0.9 + mc.b * 0.2), 0.78 + vec3(mc.g) * vec3(0.44, 0.46, 0.38), green);
        diffuseColor.rgb *= texture2D(aoMapG, vMapUv).r;`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';

  // ---- neutral base + skirt: the campus sits like a model on a table, nothing outside IITG is drawn
  const group = new THREE.Group();
  group.add(mesh);
  const baseY = world.data.meta.hmin - ELEV0 - 6;
  const base = new THREE.Mesh(
    new THREE.CircleGeometry(9000, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x8b957c, roughness: 1 })
  );
  base.position.y = baseY;
  base.receiveShadow = true;
  base.name = 'base';
  group.add(base);

  const pts = densify(B, 5);
  const sp = [], sc = [];
  const top = new THREE.Color(0x6b5a40), bot = new THREE.Color(0x4a3e2c);
  for (let k = 0; k < pts.length; k += 2) {
    const k2 = (k + 2) % pts.length;
    const ax = pts[k], az = pts[k + 1], bx = pts[k2], bz = pts[k2 + 1];
    const ha = world.heightAt(ax, az) - 0.2, hb = world.heightAt(bx, bz) - 0.2;
    sp.push(ax, ha, az, bx, hb, bz, bx, baseY, bz, ax, ha, az, bx, baseY, bz, ax, baseY, az);
    sc.push(...top.toArray(), ...top.toArray(), ...bot.toArray(), ...top.toArray(), ...bot.toArray(), ...bot.toArray());
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  sg.computeVertexNormals();
  const skirt = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  group.add(skirt);
  return { group, mesh, baseY, detail, map };
}

/** Tileable micro texture: grass strokes (r,g) and soil speckle (b). */
function microTexture() {
  const rnd = mulberry32(19);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const x = rnd() * w, y = rnd() * h, l = 3 + rnd() * 7, a = -Math.PI / 2 + (rnd() - 0.5) * 1.2;
      const v = 90 + rnd() * 120;
      g.strokeStyle = `rgba(${v * 0.9},${v},${128},0.5)`;
      g.lineWidth = 1;
      for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke(); }
    }
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) img.data[i + 2] = 100 + rnd() * 60;
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}

/** Baked ambient occlusion: soft contact shadow around buildings and under tree canopies. */
function aoTexture(world, gw, gh) {
  const S = 2; // metres per pixel
  const W = Math.ceil(gw / S), H = Math.ceil(gh / S);
  const [gx0, , , gy1] = world.data.ground.bounds;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const px = (x, z) => [(x - gx0) / S, (gy1 + z) / S];
  g.filter = 'blur(3px)';
  g.fillStyle = 'rgba(0,0,0,0.42)';
  for (const b of world.buildings) {
    const r = b.rings[0];
    g.beginPath();
    for (let i = 0; i < r.length; i += 2) { const [a, bb] = px(r[i], r[i + 1]); if (i) g.lineTo(a, bb); else g.moveTo(a, bb); }
    g.closePath();
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.stroke(); g.fill();
  }
  const bytes = b64ToBytes(world.data.trees);
  const a = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  g.filter = 'blur(2px)';
  g.fillStyle = 'rgba(0,0,0,0.14)';
  for (let i = 0; i < a.length; i += 3) {
    const [x, y] = px(a[i] / 4, -a[i + 1] / 4);
    g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill();
  }
  g.filter = 'none';
  // interiors of the footprints stay white: the AO is only the halo outside the walls
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.flipY = true;
  return t;
}

export function densify(ring, step) {
  const out = [];
  const n = ring.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    const ax = ring[i], az = ring[i + 1], bx = ring[j], bz = ring[j + 1];
    const L = Math.hypot(bx - ax, bz - az);
    const m = Math.max(1, Math.ceil(L / step));
    for (let s = 0; s < m; s++) out.push(ax + ((bx - ax) * s) / m, az + ((bz - az) * s) / m);
  }
  return out;
}

// Grass near the camera: a wrapped grid of blade clumps that stays fixed in the world
// as you move. Density comes from how green the satellite ground is (so no grass on
// roads, courts or paving), colour from the ground texture, height from the terrain.
import * as THREE from 'three';
import { mulberry32 } from '../util.js';
import { U } from './shared.js';

function clumpGeometry() {
  const pos = [], nor = [], hgt = [];
  const r = mulberry32(3);
  const blades = 6;
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, ox = (r() - 0.5) * 0.22, oz = (r() - 0.5) * 0.22;
    const h = 0.28 + r() * 0.3, w = 0.035 + r() * 0.02, lean = 0.15 + r() * 0.25;
    const ca = Math.cos(a), sa = Math.sin(a);
    const segs = 3;
    const ring = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, ww = w * (1 - t * 0.92);
      const bend = lean * t * t;
      ring.push([
        [ox - ca * ww + sa * bend * h, t * h, oz + sa * ww + ca * bend * h],
        [ox + ca * ww + sa * bend * h, t * h, oz - sa * ww + ca * bend * h],
        t,
      ]);
    }
    for (let s = 0; s < segs; s++) {
      const [a0, b0, t0] = ring[s], [a1, b1, t1] = ring[s + 1];
      for (const [p, t] of [[a0, t0], [b0, t0], [b1, t1], [a0, t0], [b1, t1], [a1, t1]]) {
        pos.push(...p); hgt.push(t);
        nor.push(sa * 0.35, 0.9, ca * 0.35);
      }
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hgt, 1));
  return g;
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildGrass(world, groundImg, groundTex, quality, graph = null) {
  if (quality === 'low') return null;
  const R = quality === 'high' ? 36 : 26;
  const step = quality === 'high' ? 0.42 : 0.52;
  // density map from ground colour (2 m / px)
  const W = Math.ceil(groundImg.width / 2), H = Math.ceil(groundImg.height / 2);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(groundImg, 0, 0, W, H);
  const img = cx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    let k = (gg - Math.max(r, b) * 1.02) / 28;
    if (b > gg * 0.86) k = 0;             // water / grey paving
    k = Math.max(0, Math.min(1, k));
    d[i] = d[i + 1] = d[i + 2] = Math.round(k * 255); d[i + 3] = 255;
  }
  // the lawns (mown grass): the green channel carries how much of a lawn each spot is
  {
    const [bx0, by0, bx1, by1] = world.data.ground.bounds, ppm = W / (bx1 - bx0);
    for (const L of world.lawns || []) {
      const px = ((L.x - bx0) / (bx1 - bx0)) * W, py = ((by1 + L.z) / (by1 - by0)) * H, R = (L.r + 4) * ppm;
      for (let j = Math.max(0, Math.floor(py - R)); j < Math.min(H, Math.ceil(py + R)); j++) for (let i = Math.max(0, Math.floor(px - R)); i < Math.min(W, Math.ceil(px + R)); i++) {
        const k = (j * W + i) * 4, dist = Math.hypot(i - px, j - py) / ppm;
        if (dist > L.r + 4 || d[k] < 14) continue;               // (no lawn where the ground is paving or water)
        const w = 1 - smooth(L.r - 6, L.r + 4, dist);
        d[k] = Math.max(d[k], Math.round(220 * w)); d[k + 1] = Math.max(d[k + 1], Math.round(255 * w));
      }
    }
  }
  cx.putImageData(img, 0, 0);
  // no tall grass on the courts and pitches (the ball has to be visible)
  {
    const [bx0, by0, bx1, by1] = world.data.ground.bounds;
    const X = (x) => ((x - bx0) / (bx1 - bx0)) * W, Y = (y) => ((by1 - y) / (by1 - by0)) * H;
    cx.fillStyle = '#000';
    // none on the roads and footpaths either (the satellite ground is green under some of them,
    // and the roads outside the wall and the gate aprons are not painted into it at all)
    if (graph) {
      cx.strokeStyle = '#000'; cx.lineCap = 'round'; cx.lineJoin = 'round';
      const pxm = W / (bx1 - bx0);                                   // pixels per metre
      for (const e of graph.edges) {
        cx.lineWidth = Math.max(1.5, ((e.hw ? e.hw * 2 + 1.6 : 2.6) * pxm));
        cx.beginPath();
        e.wpts.forEach(([x, z], i) => (i ? cx.lineTo(X(x), Y(-z)) : cx.moveTo(X(x), Y(-z))));
        cx.stroke();
      }
    }
    for (const c of world.clearings || []) {
      const a = c.area;
      if (!a || a.f || c.keepGrass) continue;                          // gate aprons (courts are below)
      cx.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([su, sv], i) => {
        const u = su * a.hl, v = sv * a.hw, x = a.cx + a.ax * u - a.az * v, z = a.cz + a.az * u + a.ax * v;
        if (i) cx.lineTo(X(x), Y(-z)); else cx.moveTo(X(x), Y(-z));
      });
      cx.closePath(); cx.fill();
    }
    for (const a of world.sportsAreas || []) {
      cx.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([su, sv], i) => {
        const u = su * a.hl, v = sv * a.hw, x = a.cx + a.ax * u - a.az * v, z = a.cz + a.az * u + a.ax * v;
        if (i) cx.lineTo(X(x), Y(-z)); else cx.moveTo(X(x), Y(-z));
      });
      cx.closePath(); cx.fill();
    }
  }
  const dens = new THREE.CanvasTexture(cv);
  dens.colorSpace = THREE.NoColorSpace;
  dens.minFilter = THREE.LinearFilter; dens.generateMipmaps = false;

  const t = world.terrain;
  const hTex = new THREE.DataTexture(world.H, t.nx, t.ny, THREE.RedFormat, THREE.FloatType);
  hTex.minFilter = hTex.magFilter = THREE.NearestFilter;
  hTex.needsUpdate = true;

  const geo = clumpGeometry();
  const n = Math.floor((2 * R / step) ** 2);
  const off = new Float32Array(n * 3);
  const r = mulberry32(11);
  const side = Math.floor(2 * R / step);
  for (let j = 0, k = 0; j < side; j++)
    for (let i = 0; i < side; i++, k++) {
      off[k * 3] = (i + r()) * step; off[k * 3 + 1] = (j + r()) * step; off[k * 3 + 2] = r();
    }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  geo.instanceCount = n;

  const [gx0, gy0, gx1, gy1] = world.data.ground.bounds;
  const uni = {
    uCam: { value: new THREE.Vector3() }, uR: { value: R }, uDens: { value: dens }, uHgt: { value: hTex }, uGround: { value: groundTex },
    uGB: { value: new THREE.Vector4(gx0, gy0, gx1 - gx0, gy1 - gy0) },
    uT: { value: new THREE.Vector4(t.minx, t.miny, t.cell, 0) }, uTN: { value: new THREE.Vector2(t.nx, t.ny) },
    uPush: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni, { uTime: U.uTime, uWind: U.uWind });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aOff; attribute float aH;
        uniform vec3 uCam; uniform float uR, uTime, uWind; uniform sampler2D uDens, uHgt, uGround; uniform vec4 uGB, uT, uPush; uniform vec2 uTN;
        varying vec3 vGC; varying float vGH, vLawn;
        float hAt(vec2 p){
          vec2 f = vec2((p.x - uT.x) / uT.z, (-p.y - uT.y) / uT.z);
          f = clamp(f, vec2(0.0), uTN - 1.001);
          ivec2 i = ivec2(floor(f)); vec2 u = f - floor(f);
          float a = texelFetch(uHgt, i, 0).r, b = texelFetch(uHgt, i + ivec2(1, 0), 0).r;
          float c = texelFetch(uHgt, i + ivec2(0, 1), 0).r, d = texelFetch(uHgt, i + ivec2(1, 1), 0).r;
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }`)
      .replace('#include <begin_vertex>', `
        vec2 wp = uCam.xz + mod(aOff.xy - uCam.xz + uR, 2.0 * uR) - uR;
        vec2 guv = vec2((wp.x - uGB.x) / uGB.z, (-wp.y - uGB.y) / uGB.w);
        // (none beyond the surveyed ground: the roads outside the campus are not in the density map)
        vec4 dm = (guv.x < 0.0 || guv.x > 1.0 || guv.y < 0.0 || guv.y > 1.0) ? vec4(0.0) : texture2D(uDens, guv);
        float dens = dm.r, lawn = dm.g * step(0.01, dm.r);
        float dist = length(wp - uCam.xz);
        float fade = smoothstep(uR, uR * 0.62, dist);
        float keep = step(aOff.z, dens * 1.15) * fade;
        float sz = keep * (0.65 + dens * 0.7) * (0.8 + aOff.z * 0.5) * mix(1.0, 0.3, lawn);      // mown: a third of the height
        vec3 transformed = position * sz;
        float ang = aOff.z * 40.0;
        transformed.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * transformed.xz;
        float w = aH * aH;
        float gust = sin(uTime * (1.4 + uWind * 2.0) + wp.x * 0.35 + wp.y * 0.21) * 0.5 + 0.5;
        transformed.x += w * (0.05 + uWind * 0.22) * gust;
        transformed.z += w * (0.03 + uWind * 0.12) * sin(uTime * 2.3 + wp.y * 0.4);
        vec2 pd = wp - uPush.xy; float pl = length(pd);
        transformed.xz += (pl < uPush.z && pl > 0.001) ? normalize(pd) * w * (uPush.z - pl) * 0.6 : vec2(0.0);
        transformed.y *= 1.0 - ((pl < uPush.z) ? (uPush.z - pl) / uPush.z * 0.5 : 0.0);
        transformed += vec3(wp.x, hAt(wp) - 0.03, wp.y);
        vGC = texture2D(uGround, guv).rgb;
        vGH = aH; vLawn = lawn;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGC; varying float vGH, vLawn;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 gc = vGC * vec3(0.95, 1.08, 0.85);
        diffuseColor.rgb = mix(gc * 0.5, gc * 1.28 + vec3(0.035, 0.04, 0.0), vGH);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.66, 0.15) * mix(0.66, 1.12, vGH), vLawn * 0.85);`)
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.customProgramCacheKey = () => 'grass';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.name = 'grass';
  return {
    mesh,
    update(camera, pusher, ground) {
      uni.uCam.value.copy(camera.position);
      // grass only matters near the ground
      mesh.visible = camera.position.y - ground < 45;
      if (pusher) uni.uPush.value.set(pusher.x, pusher.z, pusher.r, 0);
    },
  };
}

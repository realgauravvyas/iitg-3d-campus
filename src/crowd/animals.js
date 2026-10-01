// GPU animals: quadrupeds (dog, cat, jackal, mongoose, squirrel), snakes and birds.
// Each species is one instanced mesh; legs / tail / head / wings move in the vertex shader.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const GAIT = { STAND: 0, WALK: 1, TROT: 2, RUN: 3, SIT: 4, LIE: 5, SNIFF: 6, BARK: 7, UPRIGHT: 8 };

// body plans (metres): length, height at shoulder, leg length, head size, tail length / angle
const PLANS = {
  dog: { L: 0.72, H: 0.52, leg: 0.36, head: 0.13, snout: 0.1, tail: 0.3, tailUp: 0.6, ears: 'up', w: 0.22 },
  jackal: { L: 0.7, H: 0.46, leg: 0.34, head: 0.12, snout: 0.12, tail: 0.34, tailUp: -0.4, ears: 'up', w: 0.18 },
  cat: { L: 0.42, H: 0.26, leg: 0.19, head: 0.08, snout: 0.03, tail: 0.3, tailUp: 1.1, ears: 'up', w: 0.13 },
  mongoose: { L: 0.45, H: 0.17, leg: 0.1, head: 0.06, snout: 0.06, tail: 0.38, tailUp: -0.1, ears: 'none', w: 0.1 },
  squirrel: { L: 0.16, H: 0.09, leg: 0.06, head: 0.035, snout: 0.02, tail: 0.17, tailUp: 1.2, ears: 'none', w: 0.06 },
};

function tag(g, part, tone = 0) {
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  g.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(n).fill(tone), 1));
  return g;
}
const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/** parts: 0 body, 1 head, 2 tail, 3 FL, 4 FR, 5 BL, 6 BR  (animal faces +z, origin on the ground) */
function quadruped(p) {
  const G = [];
  const legY = p.leg, bodyY = p.leg + (p.H - p.leg) * 0.5;
  const body = new THREE.CapsuleGeometry(p.w / 2 * 1.05, p.L * 0.62, 3, 8).rotateX(Math.PI / 2);
  body.applyMatrix4(M(0, bodyY, 0, 0, 0, 0, 1, (p.H - p.leg) / p.w * 0.95, 1));
  G.push(tag(body, 0));
  const hz = p.L / 2 + p.head * 0.4, hy = p.H + p.head * 0.2;
  const neck = new THREE.CylinderGeometry(p.head * 0.55, p.w * 0.35, Math.hypot(hz - p.L * 0.35, hy - bodyY), 8);
  neck.applyMatrix4(M(0, (hy + bodyY) / 2, (hz + p.L * 0.35) / 2, Math.atan2(hz - p.L * 0.35, hy - bodyY), 0, 0));
  G.push(tag(neck, 1));
  G.push(tag(new THREE.SphereGeometry(p.head, 10, 8).applyMatrix4(M(0, hy, hz, 0, 0, 0, 0.85, 0.85, 1.05)), 1));
  G.push(tag(new THREE.CylinderGeometry(p.head * 0.3, p.head * 0.5, p.snout * 1.4, 8).applyMatrix4(M(0, hy - p.head * 0.25, hz + p.head * 0.6 + p.snout * 0.4, Math.PI / 2, 0, 0)), 1));
  if (p.ears === 'up') for (const s of [1, -1]) G.push(tag(new THREE.ConeGeometry(p.head * 0.35, p.head * 0.8, 4).applyMatrix4(M(s * p.head * 0.5, hy + p.head * 0.85, hz - p.head * 0.1, 0, 0, s * -0.2)), 1));
  if (p.ears === 'side') for (const s of [1, -1]) G.push(tag(new THREE.BoxGeometry(p.head * 0.9, p.head * 0.12, p.head * 0.45).applyMatrix4(M(s * p.head * 1.1, hy + p.head * 0.2, hz - p.head * 0.2, 0, 0, s * -0.3)), 1));
  if (p.horns) for (const s of [1, -1]) G.push(tag(new THREE.ConeGeometry(p.head * 0.12, p.head * 0.7, 6).applyMatrix4(M(s * p.head * 0.55, hy + p.head * 0.8, hz - p.head * 0.15, 0, 0, s * -0.6)), 1));
  // tail: a tapered cylinder hinged at the rump
  const tl = new THREE.CylinderGeometry(p.w * 0.06, p.w * (p.tail > 0.3 && p.L < 1 ? 0.2 : 0.1), p.tail, 6).translate(0, p.tail / 2, 0);
  tl.applyMatrix4(M(0, bodyY + (p.H - p.leg) * 0.25, -p.L / 2, -Math.PI / 2 - p.tailUp * 0.6 + Math.PI / 2 * 0, 0, 0));
  G.push(tag(tl, 2));
  // legs: hinged at the top
  for (const [part, sx, sz] of [[3, 1, 1], [4, -1, 1], [5, 1, -1], [6, -1, -1]]) {
    const lg = new THREE.CylinderGeometry(p.w * 0.13, p.w * 0.09, legY + 0.02, 6).translate(0, -legY / 2, 0);
    lg.applyMatrix4(M(sx * p.w * 0.32, legY + 0.02, sz * p.L * 0.34));
    G.push(tag(lg, part));
  }
  return mergeGeometries(G, false);
}

/** an ellipsoid (radii rx, ry, rz) centred at x, y, z */
const ell = (rx, ry, rz, x, y, z, rot = [0, 0, 0], seg = 12) => new THREE.SphereGeometry(1, seg, Math.max(6, seg - 3)).applyMatrix4(M(x, y, z, rot[0], rot[1], rot[2], rx, ry, rz));
/** a tapered tube from (x, y, z) along elevation e (0: straight back, PI/2: straight up) for length len; returns the geometry and the far end */
function tube(r0, r1, len, x, y, z, e) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 7).translate(0, len / 2, 0).applyMatrix4(M(x, y, z, e - Math.PI / 2, 0, 0));
  return { g, end: [x, y + Math.sin(e) * len, z - Math.cos(e) * len] };
}

/** a dog (or jackal): parts 0 body, 1 head, 2 tail, 3 FL, 4 FR, 5 BL, 6 BR */
function dogGeometry(p, kind) {
  const G = [];
  const D = p.H * 0.47, yb = p.H - D / 2, L = p.L, w = p.w, jackal = kind === 'jackal';
  // body: deep chest, tucked waist, strong rump, a pale blaze on the chest
  G.push(tag(ell(w * 0.5, D * 0.56, L * 0.26, 0, yb + 0.004, L * 0.2), 0));
  G.push(tag(ell(w * 0.44, D * 0.47, L * 0.3, 0, yb - 0.004, -L * 0.04), 0));
  G.push(tag(ell(w * 0.49, D * 0.5, L * 0.2, 0, yb + 0.006, -L * 0.27), 0));
  G.push(tag(ell(w * 0.2, D * 0.3, L * 0.1, 0, yb - 0.03, L * 0.35), 0, 2));
  // neck and head
  const hz = L / 2 + p.head * 0.3, hy = p.H + p.head * 0.12;
  const nb = [0, p.H - 0.03, L * 0.3], nl = Math.hypot(hz - nb[2], hy - nb[1]);
  G.push(tag(new THREE.CylinderGeometry(p.head * 0.52, w * 0.4, nl, 8).applyMatrix4(M(0, (hy + nb[1]) / 2, (hz + nb[2]) / 2, Math.atan2(hz - nb[2], hy - nb[1]), 0, 0)), 1));
  G.push(tag(ell(p.head * 0.72, p.head * 0.68, p.head * 0.8, 0, hy, hz), 1));
  const mz = p.head * 0.42 + p.snout * 0.55, mc = hz + p.head * 0.5 + mz * 0.55;
  G.push(tag(ell(p.head * (jackal ? 0.28 : 0.36), p.head * 0.3, mz, 0, hy - p.head * 0.22, mc), 1));
  G.push(tag(ell(p.head * 0.24, p.head * 0.12, mz * 0.85, 0, hy - p.head * 0.42, mc - 0.004), 1, 2));        // paler lower jaw
  G.push(tag(ell(p.head * 0.17, p.head * 0.14, p.head * 0.13, 0, hy - p.head * 0.16, mc + mz * 0.92), 1, 1));   // nose
  for (const sx of [1, -1]) G.push(tag(ell(p.head * 0.1, p.head * 0.1, p.head * 0.08, sx * p.head * 0.38, hy + p.head * 0.16, hz + p.head * 0.5), 1, 1));   // eyes
  for (const sx of [1, -1]) {
    if (jackal) G.push(tag(new THREE.ConeGeometry(p.head * 0.34, p.head * 1.0, 4).applyMatrix4(M(sx * p.head * 0.5, hy + p.head * 0.85, hz - p.head * 0.15, 0, 0, sx * -0.2)), 1, 5));
    else G.push(tag(ell(p.head * 0.14, p.head * 0.46, p.head * 0.3, sx * p.head * 0.66, hy + p.head * 0.08, hz - p.head * 0.22, [0, 0, sx * 0.5]), 1, 5));   // folded, hanging ears
  }
  // tail: two joined tubes, carried up and curled (a dog) or low (a jackal)
  {
    const base = [0, yb + 0.03, -L * 0.47], e1 = 0.35 + p.tailUp * 0.55, e2 = e1 + (p.tailUp > 0 ? 0.7 : -0.25);
    const a = tube(w * 0.075, w * 0.055, p.tail * 0.6, base[0], base[1], base[2], e1);
    const b = tube(w * 0.055, w * 0.03, p.tail * 0.55, a.end[0], a.end[1], a.end[2], e2);
    G.push(tag(a.g, 2), tag(b.g, 2, jackal ? 5 : 0));
  }
  // legs, hinged at the hip: a tapering limb and a pale paw; the hind ones with a muscular thigh
  const legY = p.leg;
  for (const [part, sx, sz] of [[3, 1, 1], [4, -1, 1], [5, 1, -1], [6, -1, -1]]) {
    const hind = part >= 5, lx = sx * w * 0.3, lz = sz * L * 0.33;
    G.push(tag(new THREE.CylinderGeometry(w * (hind ? 0.11 : 0.1), w * 0.065, legY * 0.62, 7).applyMatrix4(M(lx, legY + 0.02 - legY * 0.31, lz)), part));
    G.push(tag(new THREE.CylinderGeometry(w * 0.065, w * 0.05, legY * 0.46, 7).applyMatrix4(M(lx, legY + 0.02 - legY * 0.62 - legY * 0.23, lz + (hind ? -0.012 : 0.004))), part));
    G.push(tag(ell(w * 0.085, w * 0.055, w * 0.15, lx, 0.028, lz + 0.022), part, 2));
    if (hind) G.push(tag(ell(w * 0.17, D * 0.42, L * 0.14, lx * 0.92, legY + 0.02 - 0.02, lz + 0.01), part));
  }
  return mergeGeometries(G, false);
}

/** a cat: parts as for the dog */
function catGeometry(p) {
  const G = [];
  const D = p.H * 0.5, yb = p.H - D / 2, L = p.L, w = p.w;
  G.push(tag(ell(w * 0.46, D * 0.54, L * 0.24, 0, yb, L * 0.2), 0));
  G.push(tag(ell(w * 0.4, D * 0.46, L * 0.28, 0, yb - 0.004, -L * 0.04), 0));
  G.push(tag(ell(w * 0.46, D * 0.5, L * 0.2, 0, yb + 0.004, -L * 0.27), 0));
  G.push(tag(ell(w * 0.18, D * 0.3, L * 0.1, 0, yb - 0.022, L * 0.33), 0, 2));        // white bib
  const hz = L / 2 + p.head * 0.1, hy = p.H + p.head * 0.12;
  G.push(tag(new THREE.CylinderGeometry(p.head * 0.55, w * 0.38, Math.hypot(hz - L * 0.3, hy - (p.H - 0.02)), 8).applyMatrix4(M(0, (hy + p.H - 0.02) / 2, (hz + L * 0.3) / 2, Math.atan2(hz - L * 0.3, hy - (p.H - 0.02)), 0, 0)), 1));
  G.push(tag(ell(p.head * 0.98, p.head * 0.86, p.head * 0.86, 0, hy, hz), 1));
  G.push(tag(ell(p.head * 0.42, p.head * 0.3, p.head * 0.34, 0, hy - p.head * 0.3, hz + p.head * 0.72), 1, 2));   // muzzle
  G.push(tag(ell(p.head * 0.12, p.head * 0.09, p.head * 0.08, 0, hy - p.head * 0.12, hz + p.head * 0.98), 1, 3)); // pink nose
  for (const sx of [1, -1]) {
    G.push(tag(ell(p.head * 0.2, p.head * 0.22, p.head * 0.1, sx * p.head * 0.44, hy + p.head * 0.14, hz + p.head * 0.68), 1, 4));   // green eyes
    G.push(tag(ell(p.head * 0.07, p.head * 0.17, p.head * 0.05, sx * p.head * 0.44, hy + p.head * 0.14, hz + p.head * 0.76), 1, 1)); // pupils
    G.push(tag(new THREE.ConeGeometry(p.head * 0.44, p.head * 0.95, 3).applyMatrix4(M(sx * p.head * 0.58, hy + p.head * 0.92, hz - p.head * 0.12, -0.15, 0, sx * -0.22)), 1, 5));       // pointed ears
    G.push(tag(new THREE.ConeGeometry(p.head * 0.26, p.head * 0.6, 3).applyMatrix4(M(sx * p.head * 0.56, hy + p.head * 0.86, hz - p.head * 0.02, -0.15, 0, sx * -0.22)), 1, 3));     // pink inside
    for (let k = 0; k < 3; k++) G.push(tag(new THREE.CylinderGeometry(0.0014, 0.0014, p.head * 1.7, 3).applyMatrix4(M(sx * p.head * 0.78, hy - p.head * 0.25 + (k - 1) * p.head * 0.12, hz + p.head * 0.78, 0, 0, Math.PI / 2 + sx * (k - 1) * 0.18)), 1, 2));   // whiskers
  }
  // a long tail, curving up in three joined tubes, the tip darker
  {
    const base = [0, yb + 0.02, -L * 0.47], len = L * 0.9;
    const a = tube(w * 0.17, w * 0.15, len * 0.38, base[0], base[1], base[2], 0.25);
    const b = tube(w * 0.15, w * 0.14, len * 0.34, a.end[0], a.end[1], a.end[2], 0.85);
    const c = tube(w * 0.14, w * 0.1, len * 0.3, b.end[0], b.end[1], b.end[2], 1.4);
    G.push(tag(a.g, 2), tag(b.g, 2), tag(c.g, 2, 5));
  }
  const legY = p.leg;
  for (const [part, sx, sz] of [[3, 1, 1], [4, -1, 1], [5, 1, -1], [6, -1, -1]]) {
    const hind = part >= 5, lx = sx * w * 0.3, lz = sz * L * 0.33;
    G.push(tag(new THREE.CylinderGeometry(w * (hind ? 0.12 : 0.1), w * 0.07, legY * 0.6, 7).applyMatrix4(M(lx, legY + 0.02 - legY * 0.3, lz)), part));
    G.push(tag(new THREE.CylinderGeometry(w * 0.07, w * 0.055, legY * 0.5, 7).applyMatrix4(M(lx, legY + 0.02 - legY * 0.6 - legY * 0.25, lz + (hind ? -0.01 : 0.003))), part));
    G.push(tag(ell(w * 0.09, w * 0.06, w * 0.14, lx, 0.018, lz + 0.016), part, 2));   // white paws
    if (hind) G.push(tag(ell(w * 0.17, D * 0.42, L * 0.14, lx * 0.92, legY + 0.0, lz + 0.008), part));
  }
  return mergeGeometries(G, false);
}

function snakeGeometry() {
  // a long tube along +z, many rings so it can bend
  const path = new THREE.LineCurve3(new THREE.Vector3(0, 0.04, -0.7), new THREE.Vector3(0, 0.04, 0.7));
  const g = new THREE.TubeGeometry(path, 40, 0.035, 6, false);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(9), 1));
  g.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(n), 1));
  return g.index ? g.toNonIndexed() : g;
}

function birdGeometry() {
  const G = [];
  G.push(tag(new THREE.SphereGeometry(0.1, 8, 6).applyMatrix4(M(0, 0, 0, 0, 0, 0, 0.7, 0.6, 1.5)), 0));
  G.push(tag(new THREE.SphereGeometry(0.055, 8, 6).applyMatrix4(M(0, 0.05, 0.15)), 1));
  G.push(tag(new THREE.ConeGeometry(0.018, 0.07, 5).applyMatrix4(M(0, 0.04, 0.22, Math.PI / 2, 0, 0)), 1));
  G.push(tag(new THREE.BoxGeometry(0.1, 0.01, 0.12).applyMatrix4(M(0, 0, -0.18)), 2));
  for (const [part, s] of [[3, 1], [4, -1]]) {
    const w = new THREE.BufferGeometry();
    w.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.07, s * 0.34, 0, -0.02, 0, 0, -0.08, 0, 0, 0.07, s * 0.34, 0, -0.02, 0, 0, -0.08], 3));
    w.computeVertexNormals();
    const nn = w.attributes.normal; for (let i = 3; i < 6; i++) nn.setXYZ(i, 0, -1, 0);
    w.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(6).fill(part), 1));
    w.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(6), 1));          // every piece carries the same attributes to be merged
    G.push(w);
  }
  for (const s of [1, -1]) G.push(tag(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 4).applyMatrix4(M(s * 0.03, -0.1, 0)), 5));
  return mergeGeometries(G, false);
}

const HEAD = /* glsl */`
attribute float aPart;
attribute float aTone;
attribute vec4 iPos;
attribute vec4 iAnim;
attribute vec4 iCol;
attribute vec4 iShape;
uniform float uTime;
varying vec3 vAC;
mat3 rX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 rY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
void animalXf(inout vec3 p, inout vec3 n){
  int part = int(aPart + 0.5);
  int gait = int(iAnim.x + 0.5);
  float ph = iAnim.y, t = uTime + iAnim.w * 13.0;
  float L = iShape.x, H = iShape.y, leg = iShape.z;
  float bird = iShape.w;
  mat3 m;
  if (bird > 0.5) {
    // wings flap when flying (gait 1), fold when perched / swimming
    if (part == 3 || part == 4) {
      float s = part == 3 ? 1.0 : -1.0;
      float a = gait == 1 ? sin(ph) * 0.9 : gait == 2 ? sin(ph) * 0.18 + 0.1 : -1.2;
      m = rZ(s * a); p = m * p; n = m * n;
      if (gait != 1 && gait != 2) p.z -= 0.02;
    }
    if (part == 5 && (gait == 1 || gait == 2 || gait == 6)) p = vec3(0.0, -0.05, 0.0);
    if (part == 1 && gait == 0) { m = rY(sin(t * 1.3) * 0.6); p = m * p; }
    if (gait == 3) { m = rX(sin(t * 2.0) * 0.25 + 0.4); p = m * p; n = m * n; }  // pecking
    if (gait == 4) { if (part == 5) p.z += sin(ph + (p.x > 0. ? 0. : 3.14159)) * 0.04; m = rZ(sin(ph) * 0.22); p = m * p; n = m * n; }  // waddling
  } else if (part == 9) {
    // snake: body waves sideways, travelling backwards along the body
    p.x += sin(p.z * 9.0 - ph) * 0.09 * smoothstep(-0.7, 0.2, p.z * -1.0 + 0.3);
  } else {
    float move = gait == 1 ? 0.35 : gait == 2 ? 0.55 : gait == 3 ? 0.8 : 0.0;
    float s = sin(ph), c = cos(ph);
    float hipY = leg + 0.02;
    if (part >= 3 && part <= 6) {
      float sw = (part == 3 || part == 6) ? s : -s;          // diagonal pairs (trot)
      if (gait == 3) sw = (part <= 4) ? s : -s;              // gallop-ish
      float a = sw * move;
      if (gait == 4 && part >= 5) a = -1.4;                  // sitting: hind legs folded
      if (gait == 5) a = (part <= 4) ? -1.45 : 1.45;         // lying: legs tucked
      vec3 piv = vec3(0.0, hipY, 0.0);
      p -= vec3(0.0, hipY, 0.0); m = rX(a); p = m * p + vec3(0.0, hipY, 0.0); n = m * n;
      if (gait == 5) p.y = max(p.y, 0.02);
    }
    if (part == 2) { float w = gait == 5 ? 0.0 : sin(t * (gait == 0 || gait == 7 ? 9.0 : 5.0)) * 0.5; vec3 piv = vec3(0.0, H * 0.75, -L * 0.5); p -= piv; m = rY(w) * rX(gait == 3 ? 0.5 : 0.0); p = m * p + piv; n = m * n; }
    if (part == 1) {
      vec3 piv = vec3(0.0, H * 0.9, L * 0.35);
      float nod = gait == 6 ? 0.9 : gait == 7 ? -0.45 + sin(t * 18.0) * 0.08 : gait >= 1 && gait <= 3 ? sin(ph * 2.0) * 0.05 : sin(t * 0.5) * 0.08;
      float look = gait == 0 || gait == 4 ? sin(t * 0.37) * 0.5 : 0.0;
      p -= piv; m = rY(look) * rX(nod); p = m * p + piv; n = m * n;
    }
    // whole body: bob while moving, sit tilt, lie down
    if (gait == 4) { vec3 piv = vec3(0.0, 0.0, -L * 0.4); p -= piv; m = rX(-0.6); p = m * p + piv; p.y -= leg * 0.35; n = m * n; }
    if (gait == 5) { p.y -= leg * 0.85; p.y = max(p.y, 0.01); }
    if (gait == 8) { vec3 piv = vec3(0.0, 0.0, -L * 0.45); p -= piv; m = rX(-1.2); p = m * p + piv; n = m * n; }
    if (gait >= 1 && gait <= 3) p.y += abs(c) * move * 0.04 * H;
  }
  m = rY(iPos.w);
  p = m * (p * iAnim.z) + iPos.xyz; n = m * n;
}
`;

class Species {
  constructor(scene, geo, cap, { castShadow = true, bird = false } = {}) {
    const g = new THREE.InstancedBufferGeometry();
    g.index = geo.index;
    for (const k of ['position', 'normal', 'aPart']) g.setAttribute(k, geo.attributes[k]);
    g.setAttribute('aTone', geo.attributes.aTone || new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
    this.arr = {};
    for (const k of ['iPos', 'iAnim', 'iCol', 'iShape']) { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); this.arr[k] = a; }
    g.instanceCount = 0;
    this.uniforms = { uTime: { value: 0 } };
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, side: bird ? THREE.DoubleSide : THREE.FrontSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.uniforms.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + HEAD)
        .replace('#include <beginnormal_vertex>', 'vec3 aP = position; vec3 objectNormal = normal; animalXf(aP, objectNormal);')
        .replace('#include <begin_vertex>', `vec3 transformed = aP;
          int pt = int(aPart + 0.5);
          vec3 c1 = iCol.rgb;
          float pat = iCol.a;
          vAC = c1;
          int tn = int(aTone + 0.5);
          if (pat > 3.5 && pat < 4.5 && pt == 0) vAC = mix(c1, c1 * 0.5, step(0.55, fract(position.z * 30.0)) * step(0.0, position.y - 0.1));   // tabby stripes
          if (pt == 1 && pat > 0.5 && pat < 1.5) vAC = mix(c1, vec3(0.95), 0.6);       // pale face
          if (pat > 1.5 && pat < 2.5 && pt == 0) vAC = mix(c1, vec3(0.92, 0.9, 0.85), step(0.5, fract(position.z * 18.0)) * step(0.0, position.y - 0.05) * 0.8); // squirrel stripes
          if (pat > 2.5 && pt == 0) vAC = mix(c1, vec3(0.08), step(0.6, fract(position.x * 3.1 + position.z * 2.3)));   // patches
          if (pt == 5 && iShape.w > 0.5) vAC = vec3(0.9, 0.6, 0.1);
          if (tn == 1) vAC = vec3(0.035);
          else if (tn == 2) vAC = mix(c1, vec3(0.93, 0.9, 0.84), 0.75);
          else if (tn == 3) vAC = vec3(0.86, 0.56, 0.56);
          else if (tn == 4) vAC = vec3(0.72, 0.82, 0.2);
          else if (tn == 5) vAC = c1 * 0.6;`)
        .replace('#include <common>', '#include <common>');
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vAC_;\nvoid main() {');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAC;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = vAC;');
    };
    mat.customProgramCacheKey = () => (bird ? 'animal-bird' : 'animal');
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.uniforms.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + HEAD).replace('#include <begin_vertex>', 'vec3 transformed = position; vec3 aN = vec3(0.,1.,0.); animalXf(transformed, aN);');
    };
    depth.customProgramCacheKey = () => 'animal-depth';
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.customDepthMaterial = depth;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow; this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.geo = g; this.cap = cap; this.n = 0;
  }
  begin(t) { this.n = 0; this.uniforms.uTime.value = t; }
  push(a, shape) {
    if (this.n >= this.cap) return;
    const i = this.n++ * 4, A = this.arr;
    A.iPos.array.set([a.x, a.y, a.z, a.yaw], i);
    A.iAnim.array.set([a.gait, a.phase, a.scale || 1, a.seed || 0], i);
    A.iCol.array.set([a.col.r, a.col.g, a.col.b, a.pattern || 0], i);
    A.iShape.array.set(shape, i);
  }
  end() {
    this.geo.instanceCount = this.n;
    for (const k in this.arr) { const at = this.arr[k]; at.clearUpdateRanges(); at.addUpdateRange(0, this.n * 4); at.needsUpdate = true; }
  }
}

export class AnimalRenderer {
  constructor(scene, shadows = true) {
    this.species = {};
    this.shape = {};
    for (const [k, p] of Object.entries(PLANS)) {
      this.species[k] = new Species(scene, k === 'cat' ? catGeometry(p) : k === 'dog' || k === 'jackal' ? dogGeometry(p, k) : quadruped(p), k === 'dog' ? 160 : k === 'squirrel' ? 90 : k === 'cat' ? 70 : 50, { castShadow: shadows && k !== 'squirrel' });
      this.shape[k] = [p.L, p.H, p.leg, 0];
    }
    this.species.snake = new Species(scene, snakeGeometry(), 8, { castShadow: false });
    this.shape.snake = [1, 0.1, 0, 0];
    this.species.bird = new Species(scene, birdGeometry(), 700, { castShadow: false, bird: true });
    this.shape.bird = [0.3, 0.1, 0.1, 1];
  }
  begin(t) { for (const s of Object.values(this.species)) s.begin(t); }
  push(kind, a) { this.species[kind]?.push(a, this.shape[kind]); }
  end() { for (const s of Object.values(this.species)) s.end(); }
}

// GPU crowd: hundreds of animated people in two draw calls (+ shadows).
// One merged "rest pose" mesh; every vertex carries its body part, colour slot and
// option bit. Per-instance data = position/yaw, animation (type, phase, speed, extra),
// scale/options/flags and palette indices. The vertex shader poses the skeleton.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OPT, paletteTexture, paletteSize } from './looks.js';

export const AN = {
  STAND: 0, WALK: 1, RUN: 2, SIT: 3, EAT: 4, STUDY: 5, CHEER: 6, CLAP: 7, DANCE: 8, TALK: 9, BAT: 10, BOWL: 11,
  FIELD: 12, SITG: 13, PHONE: 14, BIKE: 15, SCOOTER: 16, WAVE: 17, GUITAR: 18, DRUM: 19, KICK: 20, SHOOT: 21, LIE: 22,
  SERVE: 23, TYPE: 24, CAMERA: 25, HOLD: 26, SPRINT: 27, STRETCH: 28, ROW: 29, THROW: 30, KEEPER: 31, SWEEP: 32,
  LECTURE: 33, WRITE_BOARD: 34, LAB: 35, PILLION: 36, SITCHAT: 37, LIFT: 38, CARRY: 39, HUG: 40, SWIM: 41, FEED: 42,
  POOLREST: 43, MARKS: 44, PROPOSE: 45, SURPRISE: 46,
};

// rest skeleton (metres, 1.75 m person facing +z)
const SK = {
  pelvis: [0, 0.97, 0], spine: [0, 1.03, 0], neck: [0, 1.5, 0],
  shL: [0.19, 1.44, 0], shR: [-0.19, 1.44, 0], elL: [0.19, 1.16, 0], elR: [-0.19, 1.16, 0],
  hipL: [0.095, 0.93, 0], hipR: [-0.095, 0.93, 0], knL: [0.095, 0.51, 0], knR: [-0.095, 0.51, 0],
};

// ------------------------------------------------------------------ geometry
function part(geo, prt, slot, opt = 0, matrix = null, color = '#ffffff') {
  const g = geo.index ? geo : geo;
  if (matrix) g.applyMatrix4(matrix);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const info = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) { info[i * 3] = prt; info[i * 3 + 1] = slot; info[i * 3 + 2] = opt; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g.index ? g : g;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// parts: 0 pelvis 1 torso 2 head 3 upperArmL 4 forearmL 5 upperArmR 6 forearmR 7 thighL 8 shinL 9 thighR 10 shinR 11 propR 12 propL 13 twoHand
// slots: 0 skin 1 top 2 top2 3 bottom 4 hair 5 shoes 6 dark 7 bag 8 prop 9 fixed 10 shin(bottom|skin) 11 forearm(top|skin) 12 thigh(bottom|skin if shorts high)
function personGeometry(hi) {
  const s = hi ? 1 : 0;
  const seg = hi ? 14 : 7, cs = hi ? 8 : 5;
  const G = [];
  const lathe = (prof, sx, sz, n) => { const g = new THREE.LatheGeometry(prof.map(([y, r]) => new THREE.Vector2(r, y)), n); g.scale(sx, 1, sz); return g; };
  const cap = (r, len, rs = cs) => new THREE.CapsuleGeometry(r, len, hi ? 3 : 2, rs);
  const sph = (r, w = seg, h = hi ? 10 : 5) => new THREE.SphereGeometry(r, w, h);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (a, b, h, n = hi ? 12 : 6, open = false) => new THREE.CylinderGeometry(a, b, h, n, 1, open);
  const F = -2, Mo = -1; // female-only / male-only option codes

  // pelvis + torso (male / female)
  G.push(part(lathe([[0.82, 0], [0.82, 0.155], [0.9, 0.168], [1.0, 0.165], [1.06, 0.16]], 1, 0.66, seg), 0, 3));
  G.push(part(lathe([[0.88, 0], [0.88, 0.172], [0.95, 0.17], [1.05, 0.16], [1.15, 0.172], [1.27, 0.19], [1.36, 0.196], [1.42, 0.18], [1.47, 0.13], [1.5, 0.06], [1.505, 0]], 1, 0.58, seg), 1, 1, Mo));
  G.push(part(lathe([[0.88, 0], [0.88, 0.17], [0.95, 0.168], [1.06, 0.146], [1.18, 0.158], [1.27, 0.172], [1.36, 0.165], [1.42, 0.15], [1.47, 0.11], [1.5, 0.05], [1.505, 0]], 1, 0.6, seg), 1, 1, F));
  G.push(part(sph(0.07, hi ? 10 : 6, hi ? 6 : 4), 1, 1, F, M(0, 1.27, 0.07, 0, 0, 0, 1.9, 0.85, 0.9)));
  for (const sx of [1, -1]) G.push(part(sph(0.056, hi ? 10 : 6, hi ? 6 : 4), 1, 1, 0, M(sx * 0.185, 1.42, 0)));
  if (hi) {
    G.push(part(cyl(0.064, 0.068, 0.025, 12, true), 1, 2, 0, M(0, 1.49, 0.005)));        // collar / neckline
    G.push(part(new THREE.TorusGeometry(0.155, 0.012, 4, 20), 0, 6, Mo, M(0, 1.0, 0, Math.PI / 2, 0, 0, 1.02, 0.66, 1))); // belt
  }
  G.push(part(cyl(0.048, 0.054, 0.13, hi ? 10 : 5), 1, 0, 0, M(0, 1.545, 0)));            // neck
  // head
  G.push(part(sph(0.112, seg, hi ? 12 : 6), 2, 0, 0, M(0, 1.66, 0, 0, 0, 0, 0.94, 1.12, 1.0)));
  if (hi) {
    for (const sx of [1, -1]) {
      G.push(part(sph(0.026, 6, 4), 2, 0, 0, M(sx * 0.103, 1.66, -0.005, 0, 0, 0, 0.5, 1.1, 0.85)));
      G.push(part(sph(0.012, 6, 4), 2, 6, 0, M(sx * 0.038, 1.678, 0.102, 0, 0, 0, 1.2, 0.8, 0.6)));
      G.push(part(box(0.034, 0.007, 0.01), 2, 4, 0, M(sx * 0.04, 1.705, 0.104)));
    }
    G.push(part(new THREE.ConeGeometry(0.016, 0.04, 4), 2, 0, 0, M(0, 1.648, 0.112, 1.35, Math.PI / 4, 0)));
    G.push(part(box(0.034, 0.007, 0.01), 2, 9, 0, M(0, 1.605, 0.103), '#7a3f36'));
  }
  // hair variants
  const capG = (r, th) => new THREE.SphereGeometry(r, seg, hi ? 8 : 4, 0, Math.PI * 2, 0, th);
  const hm = M(0, 1.664, -0.004, -0.5, 0, 0, 0.95, 1.12, 1.0);
  G.push(part(capG(0.121, 1.45), 2, 4, OPT.SHORTHAIR, hm.clone()));
  if (hi) G.push(part(sph(1, 10, 6), 2, 4, OPT.SHORTHAIR, M(0.01, 1.765, 0.03, 0.2, 0, -0.18, 0.1, 0.045, 0.1)));
  G.push(part(capG(0.123, 1.62), 2, 4, OPT.LONGHAIR, hm.clone()));
  G.push(part(box(0.2, 0.36, 0.05), 2, 4, OPT.LONGHAIR, M(0, 1.52, -0.085, 0.12, 0, 0)));
  G.push(part(capG(0.123, 1.6), 2, 4, OPT.BUN, hm.clone()));
  G.push(part(sph(0.055, hi ? 10 : 5, hi ? 8 : 4), 2, 4, OPT.BUN, M(0, 1.71, -0.12)));
  G.push(part(new THREE.SphereGeometry(0.118, seg, hi ? 8 : 4, Math.PI / 2 - 1.45, 2.9, Math.PI * 0.615, Math.PI * 0.3), 2, 4, OPT.BEARD, M(0, 1.66, 0, 0, 0, 0, 0.94, 1.12, 1)));
  if (hi) G.push(part(box(0.06, 0.013, 0.02), 2, 4, OPT.BEARD, M(0, 1.62, 0.108, 0.2, 0, 0)));
  G.push(part(box(0.15, 0.012, 0.012), 2, 6, OPT.GLASSES, M(0, 1.682, 0.112)));
  if (hi) for (const sx of [1, -1]) G.push(part(box(0.05, 0.034, 0.004), 2, 9, OPT.GLASSES, M(sx * 0.042, 1.68, 0.113), '#9fb4bf'));
  G.push(part(new THREE.SphereGeometry(0.126, seg, 6, 0, Math.PI * 2, 0, Math.PI * 0.46), 2, 7, OPT.CAP, M(0, 1.676, -0.004, 0, 0, 0, 0.95, 1.12, 1)));
  G.push(part(cyl(0.085, 0.085, 0.012, hi ? 14 : 6), 2, 7, OPT.CAP, M(0, 1.7, 0.12, 0.15, 0, 0, 1, 1, 0.9)));
  G.push(part(box(0.3, 0.02, 0.3), 2, 9, OPT.MORTAR, M(0, 1.8, 0, 0, Math.PI / 4, 0), '#111111'));
  G.push(part(cyl(0.1, 0.11, 0.06), 2, 9, OPT.MORTAR, M(0, 1.77, 0), '#111111'));
  // arms: upper arm = sleeve colour, forearm = skin or long sleeve, hand = skin
  for (const [sx, up, fo] of [[1, 3, 4], [-1, 5, 6]]) {
    G.push(part(cap(0.05, 0.19), up, 1, 0, M(sx * 0.19, 1.3, 0)));
    G.push(part(cap(0.042, 0.18), fo, 11, 0, M(sx * 0.19, 1.03, 0)));
    G.push(part(sph(0.042, hi ? 8 : 5, hi ? 6 : 4), fo, 0, 0, M(sx * 0.19, 0.87, 0.005, 0, 0, 0, 0.8, 1.45, 0.62)));
  }
  // legs
  for (const [sx, th, sh] of [[1, 7, 8], [-1, 9, 10]]) {
    G.push(part(cap(0.078, 0.3), th, 3, 0, M(sx * 0.095, 0.73, 0)));
    G.push(part(cap(0.058, 0.32), sh, 10, 0, M(sx * 0.095, 0.3, 0)));
    G.push(part(box(0.1, 0.07, 0.25), sh, 5, 0, M(sx * 0.095, 0.045, 0.045)));
  }
  // hoodie (flag): the hood lies on the shoulders, a kangaroo pocket and drawstrings
  const HOOD = -3;
  G.push(part(sph(0.13, hi ? 12 : 6, hi ? 8 : 4), 1, 1, HOOD, M(0, 1.47, -0.1, 0.25, 0, 0, 1.25, 0.62, 0.85)));
  G.push(part(box(0.2, 0.1, 0.012), 1, 2, HOOD, M(0, 1.08, 0.125)));
  if (hi) for (const sx of [1, -1]) G.push(part(box(0.008, 0.13, 0.006), 1, 9, HOOD, M(sx * 0.035, 1.37, 0.128), '#f2f0ea'));
  // clothing / accessories
  G.push(part(lathe([[0.3, 0.26], [0.7, 0.21], [0.98, 0.168]], 1, 0.72, seg), 0, 3, OPT.SKIRT));
  G.push(part(box(0.3, 0.4, 0.15), 1, 7, OPT.BACKPACK, M(0, 1.22, -0.19)));
  if (hi) for (const sx of [1, -1]) G.push(part(box(0.035, 0.36, 0.015), 1, 7, OPT.BACKPACK, M(sx * 0.1, 1.26, 0.125, -0.08, 0, 0)));
  G.push(part(box(0.16, 0.66, 0.02), 1, 2, OPT.DUPATTA, M(0.02, 1.2, 0.125, 0, 0, -0.55)));
  G.push(part(box(0.18, 0.56, 0.02), 1, 2, OPT.DUPATTA, M(0.05, 1.18, -0.12, 0, 0, 0.45)));
  G.push(part(box(0.3, 0.5, 0.02), 1, 9, OPT.APRON, M(0, 1.1, 0.125), '#f4f4ef'));
  G.push(part(box(0.2, 0.3, 0.02), 0, 9, OPT.APRON, M(0, 0.78, 0.12), '#f4f4ef'));
  G.push(part(box(0.012, 0.24, 0.006), 1, 9, OPT.LANYARD, M(0.05, 1.33, 0.125, 0, 0, 0.35), '#c62828'));
  G.push(part(box(0.012, 0.24, 0.006), 1, 9, OPT.LANYARD, M(-0.05, 1.33, 0.125, 0, 0, -0.35), '#c62828'));
  G.push(part(box(0.07, 0.1, 0.006), 1, 9, OPT.LANYARD, M(0, 1.18, 0.128), '#ffffff'));
  // convocation robe with a stole
  G.push(part(lathe([[0.12, 0.3], [0.6, 0.23], [0.95, 0.2], [1.25, 0.215], [1.44, 0.2], [1.5, 0.08]], 1, 0.7, seg), 1, 9, OPT.GOWN, null, '#141414'));
  for (const sx of [1, -1]) G.push(part(box(0.07, 0.62, 0.012), 1, 9, OPT.GOWN, M(sx * 0.08, 1.18, 0.16, 0.1, 0, 0), '#c89b3c'));
  // props held in the right hand (rest pose: arm hangs, forearm points down)
  const hand = (y = 0.84) => [-0.19, y, 0.01];
  let [hx, hy, hz] = hand();
  G.push(part(cyl(0.008, 0.008, 0.95, 5), 11, 9, OPT.UMBRELLA, M(hx, hy - 0.45, hz), '#2a2a2a'));
  G.push(part(new THREE.ConeGeometry(0.58, 0.28, hi ? 12 : 8, 1, true), 11, 8, OPT.UMBRELLA, M(hx, hy - 0.86, hz, Math.PI, 0, 0)));
  G.push(part(cyl(0.17, 0.15, 0.025, hi ? 16 : 8), 11, 9, OPT.PLATE, M(hx, hy - 0.03, hz + 0.12, Math.PI / 2, 0, 0), '#c7ccd1'));
  G.push(part(box(0.07, 0.14, 0.012), 11, 9, OPT.PHONE, M(hx, hy - 0.06, hz + 0.03), '#101418'));
  G.push(part(box(0.11, 0.55, 0.04), 13, 9, OPT.BAT, M(hx + 0.02, hy - 0.42, hz + 0.02), '#e0c992'));
  G.push(part(cyl(0.017, 0.017, 0.26, 6), 13, 9, OPT.BAT, M(hx + 0.02, hy - 0.05, hz + 0.02), '#2a2a2a'));
  // sweeper's long jhadu (opt -4) and gardener's rake (opt -5): drawn when the flag bit is set
  G.push(part(cyl(0.014, 0.014, 1.25, 5), 13, 9, -4, M(hx + 0.02, hy - 0.45, hz + 0.02), '#8a6a3a'));
  G.push(part(new THREE.ConeGeometry(0.13, 0.42, 7, 1, true), 13, 9, -4, M(hx + 0.02, hy - 1.22, hz + 0.02, Math.PI, 0, 0, 1, 1, 0.45), '#c9a86a'));
  G.push(part(cyl(0.014, 0.014, 1.35, 5), 13, 9, -5, M(hx + 0.02, hy - 0.5, hz + 0.02), '#7a5a32'));
  G.push(part(box(0.36, 0.035, 0.04), 13, 9, -5, M(hx + 0.02, hy - 1.18, hz + 0.02), '#5a5f64'));
  for (let k = -3; k <= 3; k++) G.push(part(box(0.012, 0.09, 0.012), 13, 9, -5, M(hx + 0.02 + k * 0.05, hy - 1.24, hz + 0.02), '#5a5f64'));
  // a red rose (flag 4096, opt -6) and a bouquet (flag 8192, opt -7) held in the right hand
  G.push(part(cyl(0.006, 0.006, 0.4, 5), 11, 9, -6, M(hx, hy - 0.22, hz + 0.02), '#2f6b2a'));
  G.push(part(sph(0.035, 8, 6), 11, 9, -6, M(hx, hy - 0.44, hz + 0.02, 0, 0, 0, 1, 1.3, 1), '#c1121f'));
  G.push(part(box(0.05, 0.012, 0.03), 11, 9, -6, M(hx + 0.02, hy - 0.3, hz + 0.02, 0, 0, 0.6), '#3f8f3a'));
  G.push(part(new THREE.ConeGeometry(0.1, 0.34, hi ? 10 : 6, 1, true), 11, 9, -7, M(hx, hy - 0.26, hz + 0.03, Math.PI, 0, 0), '#f3e6c9'));
  for (const [dx, dz, c] of [[0, 0, '#c1121f'], [0.05, 0.03, '#e86f9c'], [-0.05, 0.02, '#c1121f'], [0.02, -0.05, '#f7f2f5'], [-0.03, -0.04, '#e86f9c'], [0.055, -0.02, '#c1121f']])
    G.push(part(sph(0.038, 8, 6), 11, 9, -7, M(hx + dx, hy - 0.45, hz + 0.03 + dz), c));
  G.push(part(cyl(0.034, 0.026, 0.07, hi ? 10 : 6), 11, 9, OPT.CUP, M(hx, hy - 0.05, hz + 0.04), '#a4552f'));
  G.push(part(box(0.1, 0.07, 0.07), 13, 9, OPT.CAMERA, M(hx + 0.1, hy - 0.06, hz + 0.06), '#15171a'));
  G.push(part(cyl(0.028, 0.028, 0.06, 10), 13, 9, OPT.CAMERA, M(hx + 0.1, hy - 0.06, hz + 0.12, Math.PI / 2, 0, 0), '#2d3238'));
  G.push(part(sph(0.12, hi ? 12 : 6, hi ? 8 : 4), 11, 8, OPT.BALL, M(hx, hy - 0.08, hz + 0.1)));
  G.push(part(cyl(0.012, 0.012, 1.9, 5), 11, 9, OPT.FLAG, M(hx, hy - 0.6, hz), '#6b5a44'));
  G.push(part(box(0.012, 0.42, 0.62), 11, 8, OPT.FLAG, M(hx, hy - 1.33, hz + 0.31)));
  // book in the left hand
  G.push(part(box(0.2, 0.26, 0.035), 12, 8, OPT.BOOK, M(0.19, 0.84, 0.03)));
  // instruments worn on the body
  G.push(part(sph(0.2, 12, 8), 1, 9, OPT.GUITAR, M(-0.05, 1.08, 0.2, 0, 0, 0, 0.95, 1.2, 0.35), '#8a4b22'));
  G.push(part(box(0.05, 0.62, 0.025), 1, 9, OPT.GUITAR, M(0.2, 1.3, 0.2, 0, 0, -1.2), '#3b2412'));
  G.push(part(cyl(0.17, 0.17, 0.46, 14), 1, 9, OPT.DHOL, M(0, 1.02, 0.24, 0, 0, Math.PI / 2), '#b3262f'));
  G.push(part(cyl(0.175, 0.175, 0.02, 14), 1, 9, OPT.DHOL, M(0.23, 1.02, 0.24, 0, 0, Math.PI / 2), '#efe3c2'));
  G.push(part(cyl(0.175, 0.175, 0.02, 14), 1, 9, OPT.DHOL, M(-0.23, 1.02, 0.24, 0, 0, Math.PI / 2), '#efe3c2'));

  const merged = mergeGeometries(G, false);
  G.forEach((g) => g.dispose());
  return merged;
}

// ------------------------------------------------------------------ shader
const HEAD = /* glsl */`
attribute vec3 aInfo;
attribute vec4 iPos;
attribute vec4 iAnim;
attribute vec4 iMisc;
attribute vec4 iCol0;
attribute vec4 iCol1;
uniform float uTime;
uniform sampler2D uPal;
#ifndef CROWD_DEPTH
varying vec3 vCrowd;
varying vec2 vPrintUV;
varying float vPrintId, vFront;
#endif
mat3 rX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 rY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
struct Pose { float hy, hx, hr, hz, sx, sy, sz, dx, dy, lax, laz, le, rax, raz, re, llx, llz, lk, rlx, rlz, rk; };
bool hasOpt(int o){ return o <= 0 || ((int(iMisc.y + 0.5) >> (o - 1)) & 1) == 1; }
// two-link leg IK in the leg's sagittal plane (returns thigh swing, knee bend)
vec2 legIK(vec2 hip, vec2 foot){
  vec2 d = foot - hip; float L = min(length(d), 0.835);
  float phi = atan(d.y, -d.x);
  float a = 0.42, b = 0.42;
  float al = acos(clamp((a*a + L*L - b*b) / (2.*a*L), -1., 1.));
  float be = 3.14159 - acos(clamp((a*a + b*b - L*L) / (2.*a*b), -1., 1.));
  return vec2(-(phi + al), be);
}
// one arm of the front crawl, u = 0..1 through its stroke -> (shoulder swing, out to the side, elbow).
// Swing -PI = reaching past the head; the pull goes under the body to the hip (0), the recovery comes
// back over the water (0 -> PI, which is -PI again), the elbow high and bent, the arm a little wide.
vec3 crawlArm(float u){
  if (u < 0.56) { float k=u/0.56;
    return vec3(-3.14159+k*3.14159, -0.1*sin(k*3.14159), 1.15*sin(min(1.,k/0.35)*1.5708)*(1.-0.85*smoothstep(0.35,1.,k))); }
  float k=(u-0.56)/0.44;
  return vec3(k*3.14159, 0.12+0.55*sin(k*3.14159), -0.35*sin(k*3.14159));   // a long, nearly straight arm over the water
}
Pose getPose(int ty, float ph, float sp, float ex, float t, float seed, float scl){
  Pose P;
  P.hy=0.97; P.hx=0.; P.hr=0.; P.hz=0.; P.sx=0.03; P.sy=0.; P.sz=0.; P.dx=0.; P.dy=0.;
  P.lax=0.05; P.laz=0.09; P.le=-0.12; P.rax=0.05; P.raz=-0.09; P.re=-0.12;
  P.llx=0.; P.llz=0.03; P.lk=0.05; P.rlx=0.; P.rlz=-0.03; P.rk=0.05;
  float tt = t + seed * 17.0;
  float br = sin(tt*1.6);
  if (ty==1 || ty==2 || ty==26 || ty==27 || ty==39) { // walk / run / hold hands / sprint / carry
    bool run = ty==2 || ty==27;
    float s = sin(ph), c = cos(ph);
    float A = ty==27 ? 0.95 : run ? 0.72 : 0.42*clamp(sp/1.5, 0.45, 1.25);
    P.llx=-s*A; P.rlx=s*A;
    P.lk=0.08+max(0.,c)*(run?1.5:0.65); P.rk=0.08+max(0.,-c)*(run?1.5:0.65);
    P.lax=s*A*(ty==27?1.4:0.85); P.rax=-s*A*(ty==27?1.4:0.85);
    P.le=P.re=run?-1.35:-0.3;
    P.hy=0.97-(run?0.04:0.01)+abs(c)*(run?0.05:0.025);
    P.sx=ty==27?0.32:run?0.2:0.05; P.sy=s*(run?0.16:0.09);
    P.dy=sin(tt*0.21)*0.15*(1.-float(run));
    if (ty==26) { if (ex>0.) { P.rax=0.08+s*0.05; P.raz=-0.32; P.re=-0.1; } else { P.lax=0.08-s*0.05; P.laz=0.32; P.le=-0.1; } P.dy = ex*0.25 + sin(tt*0.4)*0.1; }
    if (ty==39) { P.lax=P.rax=-0.55; P.laz=0.12; P.raz=-0.12; P.le=P.re=-1.3; }
  } else if (ty==0 || ty==28) { // stand (idle) / stretch
    P.sx=0.03+br*0.012; P.laz=0.09+br*0.01; P.raz=-0.09-br*0.01;
    P.dy=sin(tt*0.23)*0.4*smoothstep(0.3,1.,sin(tt*0.11)); P.dx=sin(tt*0.37)*0.05;
    P.hr=sin(tt*0.3)*0.02; P.llz=0.04; P.rlz=-0.04;
    if (ty==28) { float k=0.5+0.5*sin(tt*0.8); P.laz=2.6*k+0.1; P.raz=-2.6*k-0.1; P.le=P.re=-0.1; P.sx=-0.1*k; }
  } else if (ty==3 || ty==4 || ty==5 || ty==18 || ty==24 || ty==37) { // seated variants
    P.hy=0.55; P.llx=P.rlx=-1.5; P.lk=P.rk=1.5; P.llz=0.07; P.rlz=-0.07;
    P.lax=P.rax=-0.35; P.le=P.re=-0.85; P.laz=0.12; P.raz=-0.12;
    P.dy=sin(tt*0.2)*0.25; P.dx=sin(tt*0.31)*0.05;
    if (ty==3 && ex>0.5) { float cl = step(0.6, sin(tt*0.5)); P.lax=P.rax=-1.1; P.laz=-0.3*cl; P.raz=0.3*cl; P.le=P.re=-1.0+sin(tt*11.)*0.25*cl; }
    if (ty==4) { float k=smoothstep(-0.2,0.8,sin(tt*1.3)); P.rax=-0.9; P.re=-0.7-k*1.45; P.raz=-0.05; P.lax=-0.55; P.le=-0.9; P.sx=0.12; P.dx=0.18-k*0.12; }
    if (ty==5) { P.sx=0.32; P.dx=0.45; P.lax=-0.75; P.rax=-0.7; P.le=-0.95; P.re=-1.0+sin(tt*5.)*0.06; P.dy=0.; }
    if (ty==24) { P.sx=0.18; P.dx=0.35; P.lax=P.rax=-0.8; P.laz=-0.08; P.raz=0.08; P.le=-1.05+sin(tt*14.)*0.05; P.re=-1.05+sin(tt*13.+1.)*0.05; P.dy=0.; }
    if (ty==18) { P.lax=-1.05; P.laz=0.55; P.le=-0.5; P.rax=-0.45; P.raz=0.25; P.re=-1.35+sin(tt*10.)*0.18; P.dx=0.25; }
    if (ty==37) { P.sy=ex*0.35; P.dy=ex*0.45+sin(tt*0.7)*0.15; P.rax=-0.5+sin(tt*2.)*0.2*step(0.,ex); P.re=-1.2; }
  } else if (ty==6) { // cheer
    float w=sin(tt*8.); P.laz=2.55+w*0.25; P.raz=-2.55+w*0.25; P.le=P.re=-0.25; P.lax=P.rax=-0.2;
    P.hy=0.97+max(0.,sin(tt*5.))*0.12*step(0.2,sin(tt*0.7));
  } else if (ty==7) { // clap
    P.lax=P.rax=-1.15; P.laz=-0.32; P.raz=0.32; float k=sin(tt*10.); P.le=P.re=-1.0+k*0.22; P.dx=0.05;
  } else if (ty==8) { // dance (bihu-like arm flicks, hip sway, stepping)
    float b=tt*(2.2+fract(seed*7.)*0.8), s=sin(b), c=cos(b);
    float v=floor(ex*4.);
    P.hy=0.95+abs(s)*0.06; P.hr=s*0.07; P.sy=s*0.3; P.sz=c*0.08;
    P.llx=-max(0.,s)*0.6; P.lk=max(0.,s)*0.9; P.rlx=-max(0.,-s)*0.6; P.rk=max(0.,-s)*0.9;
    if (v<1.) { P.laz=1.9+s*0.5; P.raz=-1.9+s*0.5; P.le=P.re=-0.9-c*0.4; }
    else if (v<2.) { P.lax=-1.6-s*0.6; P.rax=-1.6+s*0.6; P.le=P.re=-0.4; P.laz=0.6; P.raz=-0.6; }
    else if (v<3.) { P.laz=2.8; P.raz=-0.6-s*0.8; P.le=-0.2; P.re=-1.2; P.sx=0.1+abs(c)*0.15; }
    else { P.lax=-0.8+s; P.rax=-0.8-s; P.le=P.re=-1.4; P.hy=0.9+abs(s)*0.08; P.lk=P.rk=0.4+abs(s)*0.3; P.llx=P.rlx=-0.25; }
    P.dy=s*0.2;
  } else if (ty==9 || ty==33) { // talk / lecture
    float g=sin(tt*2.3), h=sin(tt*1.7+1.);
    P.rax=-0.55+g*0.25; P.re=-1.15+h*0.3; P.raz=-0.18; P.dx=sin(tt*1.1)*0.06; P.dy=ex*0.6+sin(tt*0.4)*0.25;
    if (ty==33) { P.lax=-0.4+h*0.2; P.le=-1.0; P.laz=0.2; }
  } else if (ty==34) { // writing on the board (facing it)
    P.rax=-2.1+sin(tt*1.5)*0.3; P.raz=-0.2+sin(tt*2.3)*0.25; P.re=-0.5; P.dx=-0.2; P.lax=-0.3; P.le=-1.2;
  } else if (ty==10) { // cricket batting: ex = swing 0..1 (0 = stance)
    P.hy=0.9; P.lk=P.rk=0.35; P.llx=P.rlx=-0.15; P.llz=0.12; P.rlz=-0.12; P.sx=0.35; P.dy=1.1; P.sy=-0.5;
    float k=ex;
    float back=smoothstep(0.,0.35,k)*(1.-smoothstep(0.35,0.6,k));
    float fol=smoothstep(0.45,1.,k);
    P.lax=P.rax=-0.55-back*1.4+fol*-1.2; P.laz=-0.45; P.raz=0.25; P.le=P.re=-0.35-back*0.6;
    P.sy=-0.5-back*0.3+fol*1.6; P.dy=1.1-fol*0.8;
  } else if (ty==11 || ty==30) { // bowl / throw: ph = run cycle, ex = delivery 0..1 (<0 = running up)
    if (ex<0.) { float s=sin(ph), c=cos(ph); P.llx=-s*0.7; P.rlx=s*0.7; P.lk=0.1+max(0.,c)*1.3; P.rk=0.1+max(0.,-c)*1.3; P.lax=s*0.6; P.rax=-s*0.6; P.le=P.re=-1.2; P.sx=0.2; P.hy=0.95+abs(c)*0.05; }
    else { float k=clamp(ex,0.,1.); P.rax=-k*(ty==30?3.4:6.0)+0.3; P.lax=-2.4+k*2.2; P.le=-0.2; P.re=ty==30?-0.9+k*0.8:-0.05; P.sx=0.1+k*0.45; P.llx=-0.5; P.rlx=0.3+k*0.4; P.lk=0.2; P.rk=0.3; }
  } else if (ty==12 || ty==31) { // fielder ready / keeper crouch
    P.hy=ty==31?0.62:0.84; P.llx=P.rlx=ty==31?-1.1:-0.45; P.lk=P.rk=ty==31?1.9:0.75; P.llz=0.18; P.rlz=-0.18;
    P.sx=ty==31?0.55:0.55; P.lax=P.rax=-0.75; P.laz=0.2; P.raz=-0.2; P.le=P.re=-0.3; P.dx=-0.35;
    P.hr=sin(tt*1.4)*0.04*ex;
  } else if (ty==13) { // sitting cross-legged on the grass
    P.hy=0.2; P.llx=P.rlx=-1.35; P.llz=0.95; P.rlz=-0.95; P.lk=P.rk=2.45;
    P.lax=P.rax=-0.45; P.le=P.re=-0.9; P.laz=0.15; P.raz=-0.15; P.dy=sin(tt*0.3)*0.35+ex*0.4; P.sx=0.08;
  } else if (ty==14) { // phone
    P.rax=-0.55; P.re=-1.75; P.raz=-0.12; P.dx=0.42; P.sx=0.06; P.dy=0.;
  } else if (ty==15 || ty==36) { // cycling (legs follow the pedals) / pillion
    float hipY=1.0/scl, hipZ=-0.27/scl;
    P.hy=0.97+(hipY-0.93); P.hz=hipZ;
    if (ty==36) { P.hy=0.97+(1.02/scl-0.93); P.hz=-0.72/scl; P.llx=P.rlx=-1.2; P.lk=P.rk=1.5; P.llz=0.3; P.rlz=-0.3; P.lax=-0.6; P.rax=-0.6; P.laz=-0.3; P.raz=0.3; P.le=P.re=-1.2; P.sx=0.1; }
    else {
      float cr=ph;
      vec2 bb=vec2(0.30, -0.04);
      vec2 pl=bb+vec2(cos(cr), sin(cr))*0.17, pr=bb+vec2(cos(cr+3.14159), sin(cr+3.14159))*0.17;
      vec2 L=legIK(vec2(hipY, hipZ), (pl+vec2(0.075,-0.02))/scl);
      vec2 R=legIK(vec2(hipY, hipZ), (pr+vec2(0.075,-0.02))/scl);
      P.llx=L.x; P.lk=L.y; P.rlx=R.x; P.rk=R.y;
      P.sx=0.36; P.lax=P.rax=-1.0; P.laz=-0.05; P.raz=0.05; P.le=P.re=-0.4; P.dx=-0.3;
    }
  } else if (ty==16) { // scooter
    P.hy=0.9/scl; P.sx=0.06; P.llx=P.rlx=-1.2; P.lk=P.rk=1.35; P.lax=P.rax=-1.05; P.laz=0.12; P.raz=-0.12; P.le=P.re=-0.45; P.llz=0.12; P.rlz=-0.12;
  } else if (ty==17) { // wave
    P.raz=-2.55+sin(tt*9.)*0.35; P.re=-0.3; P.rax=-0.2; P.dy=0.;
  } else if (ty==19) { // dhol
    P.lax=-0.7+sin(tt*9.)*0.25; P.rax=-0.7-sin(tt*9.)*0.25; P.laz=0.5; P.raz=-0.5; P.le=P.re=-1.2; P.hy=0.96+abs(sin(tt*4.5))*0.03;
  } else if (ty==20) { // kick: ex 0..1
    float k=clamp(ex,0.,1.);
    P.rlx=0.6-sin(k*3.14159)*1.9; P.rk=0.8*(1.-k); P.llx=0.1; P.lax=-0.6*k; P.rax=0.6*k; P.laz=0.5; P.raz=-0.2; P.sx=0.1+k*0.1;
  } else if (ty==21) { // basketball shot: ex 0..1
    float k=clamp(ex,0.,1.);
    P.hy=0.9+sin(k*3.14159)*0.28; P.lk=P.rk=0.6*(1.-k); P.llx=P.rlx=-0.3*(1.-k);
    P.lax=P.rax=-1.3-k*1.6; P.laz=0.15; P.raz=-0.15; P.le=P.re=-1.6+k*1.4; P.dx=-0.3;
  } else if (ty==22) { // lying on the grass
    P.hx=-1.5; P.hy=0.12; P.lax=-0.2; P.laz=1.3; P.le=-1.6; P.rax=-0.2; P.raz=-1.3; P.re=-1.6; P.lk=0.4; P.llx=-0.3; P.dy=sin(tt*0.2)*0.3;
  } else if (ty==23 || ty==32 || ty==35) { // serve food / sweep / lab work
    float k=sin(tt*(ty==32?2.5:1.6));
    P.rax=-0.9+k*0.35; P.re=-0.6; P.lax=-0.8; P.le=-0.9-k*0.2; P.sx=0.25; P.dx=0.3;
    if (ty==32) { P.lax=-0.5+k*0.3; P.rax=-0.6+k*0.3; P.laz=-0.3; P.raz=0.3; P.sx=0.35; }
    if (ty==35) { P.lax=-0.85; P.rax=-1.0+k*0.12; P.le=-1.0; P.re=-1.2; P.sx=0.12; P.dx=0.4; }
  } else if (ty==25) { // camera to the eye
    P.lax=-1.2; P.rax=-1.25; P.laz=-0.35; P.raz=0.25; P.le=-1.55; P.re=-1.6; P.dx=0.05;
  } else if (ty==29) { // rowing, seated low
    float k=sin(ph);
    P.hy=0.4; P.llx=P.rlx=-1.2; P.lk=P.rk=1.2; P.sx=0.25+k*0.35; P.lax=P.rax=-1.2+k*0.2; P.laz=0.35; P.raz=-0.35; P.le=P.re=-0.6-k*0.5;
  } else if (ty==40) { // a hug: arms around the other person, a gentle sway (ex > 0: taller partner, arms high)
    float hi = step(0., ex);
    P.lax=P.rax=-1.25-hi*0.25; P.laz=-0.55; P.raz=0.55; P.le=P.re=-1.25+hi*0.2;
    P.sx=0.1; P.hr=sin(tt*0.8)*0.03; P.dy=0.35*sign(ex+0.001); P.dx=0.12;
  } else if (ty==41) { // front crawl: face down, head first, back at the surface (ex > 0.5: a streamlined dive / glide)
    P.hx=1.5; P.hy=0.1; P.sx=-0.06; P.dx=-0.25;
    if (ex > 0.5) {
      P.lax=P.rax=-3.05; P.laz=-0.12; P.raz=0.12; P.le=P.re=0.;
      P.llx=P.rlx=0.; P.lk=P.rk=0.02; P.llz=0.01; P.rlz=-0.01; P.dx=0.25;
    } else {
      float uL=fract(ph/6.28318), uR=fract(ph/6.28318+0.5);
      vec3 L=crawlArm(uL), R=crawlArm(uR);
      P.lax=L.x; P.laz=L.y; P.le=L.z; P.rax=R.x; P.raz=-R.y; P.re=R.z;
      P.sy=0.55*sin(6.28318*(uL-0.53));                                  // the body rolls with the strokes
      P.dy=-1.15*smoothstep(0.56,0.66,uR)*(1.-smoothstep(0.8,0.93,uR));  // a breath to the side
      float k=sin(3.*ph+seed*5.);                                        // six-beat flutter kick
      P.llx=0.12+k*0.2; P.rlx=0.12-k*0.2; P.lk=0.1+max(0.,-k)*0.4; P.rk=0.1+max(0.,k)*0.4; P.llz=0.02; P.rlz=-0.02;   // the legs a little lower than the hips
    }
  } else if (ty==44) { // on the starting block, "take your marks": bent over, hands gripping the front edge
    P.hy=0.86; P.sx=1.2; P.dx=-0.35; P.lax=P.rax=-0.2; P.laz=0.06; P.raz=-0.06; P.le=P.re=-0.1;
    P.llx=-0.55; P.lk=0.75; P.rlx=0.15; P.rk=0.35; P.llz=0.04; P.rlz=-0.04; P.hz=-0.12;
  } else if (ty==45) { // down on one knee, offering a rose / flowers to the partner
    P.hy=0.6; P.llx=-1.45; P.lk=1.5; P.llz=0.06; P.rlx=0.05; P.rk=1.55; P.rlz=-0.06; P.hz=0.05;
    P.rax=-1.3+sin(tt*1.3)*0.05; P.re=-0.25; P.raz=-0.05; P.lax=-0.9; P.le=-1.1; P.laz=0.2; P.dx=-0.3; P.sx=0.05;
  } else if (ty==46) { // hands to the face: a surprise (ex > 0.5: then holding the flowers close, happy)
    if (ex > 0.5) { P.rax=-0.7; P.re=-1.5; P.raz=0.2; P.lax=-0.6; P.le=-1.6; P.laz=-0.25; P.dy=sin(tt*2.)*0.2; }
    else { P.lax=P.rax=-1.0; P.le=P.re=-2.35; P.laz=-0.32; P.raz=0.32; P.dx=0.12+sin(tt*3.)*0.06; P.sx=-0.08; }
  } else if (ty==43) { // resting at the pool wall: standing in the water, forearms on the edge, chatting
    P.sx=0.12; P.lax=P.rax=-1.45; P.laz=0.28; P.raz=-0.28; P.le=P.re=-0.35;
    P.llx=sin(tt*1.6)*0.25; P.rlx=-sin(tt*1.6)*0.25; P.lk=P.rk=0.3; P.dy=sin(tt*0.5)*0.5; P.dx=sin(tt*0.9)*0.08;
  } else if (ty==42) { // crouching to feed an animal
    P.hy=0.55; P.llx=P.rlx=-1.3; P.lk=P.rk=2.1; P.llz=0.15; P.rlz=-0.15; P.sx=0.5; P.dx=0.4;
    P.rax=-1.1+sin(tt*1.5)*0.1; P.re=-0.3; P.lax=-0.4; P.le=-1.0; P.laz=0.2;
  } else if (ty==38) { // lifting weights
    float k=0.5+0.5*sin(tt*2.2);
    P.lax=P.rax=-0.2; P.le=P.re=-0.3-k*2.1; P.laz=0.25; P.raz=-0.25;
  }
  // props in hand override the arm pose while walking / standing
  if ((ty<=2 || ty==9 || ty==14) && hasOpt(${OPT.UMBRELLA})) { P.rax=-0.42; P.raz=-0.12; P.re=-2.6; }
  if ((ty==0 || ty==9 || ty==1) && hasOpt(${OPT.CUP})) { float k=step(0.85,sin(tt*0.9)); P.rax=-0.45-k*0.25; P.re=-1.7-k*0.5; P.raz=-0.1; }
  if ((ty==0 || ty==1) && hasOpt(${OPT.PLATE})) { P.rax=-0.15; P.re=-1.5; P.raz=-0.05; }
  if ((ty==0 || ty==1) && hasOpt(${OPT.BOOK})) { P.lax=-0.1; P.le=-1.35; P.laz=0.05; }
  if (ty==6 && hasOpt(${OPT.FLAG})) { P.raz=-0.2; P.rax=-0.35+sin(tt*3.)*0.25; P.re=-2.45; }
  return P;
}
void crowdXf(inout vec3 p, inout vec3 n){
  int prt = int(aInfo.x + 0.5);
  int opt = int(aInfo.z + (aInfo.z < 0. ? -0.5 : 0.5));
  int flags = int(iMisc.z + 0.5);
  bool fem = (flags & 1) == 1;
  if ((opt == -1 && fem) || (opt == -2 && !fem) || (opt == -3 && (flags & 32) == 0) || (opt == -4 && (flags & 1024) == 0) || (opt == -5 && (flags & 2048) == 0) || (opt == -6 && (flags & 4096) == 0) || (opt == -7 && (flags & 8192) == 0) || (opt > 0 && !hasOpt(opt))) { p = vec3(0., -60., 0.); n = vec3(0., 1., 0.); return; }
  if ((flags & 16) == 16 && prt == 1) { p.x *= 1.06; p.z *= 1.1; }  // older adults: a little broader
  // body build from the per-person variant: slim .. stocky (torso, hips, thighs, upper arms)
  float build = 0.88 + fract(iMisc.w * 7.13) * 0.36 * (fract(iMisc.w * 3.7) < 0.7 ? 0.6 : 1.0);
  if (prt == 0 || prt == 1) { p.x *= build; p.z *= mix(1.0, build, p.z > 0. ? 1.15 : 0.8); }
  else if (prt == 7 || prt == 9) { float cx = prt == 7 ? 0.095 : -0.095; p.x = cx + (p.x - cx) * build; p.z *= build; }
  else if (prt == 3 || prt == 5) { float cx = prt == 3 ? 0.19 : -0.19; p.x = cx + (p.x - cx) * mix(1.0, build, 0.8) + (build - 1.0) * 0.05 * sign(cx); p.z *= mix(1.0, build, 0.8); }
  else if (prt == 4 || prt == 6 || prt == 11 || prt == 12 || prt == 13) { float cx = (prt == 4 || prt == 12) ? 0.19 : -0.19; p.x += (build - 1.0) * 0.05 * sign(cx); }
  Pose P = getPose(int(iAnim.x + 0.5), iAnim.y, iAnim.z, iAnim.w, uTime, iMisc.w, iMisc.x);
  bool foreL = prt==4 || prt==12, foreR = prt==6 || prt==11 || prt==13;
  bool armL = prt==3 || foreL, armR = prt==5 || foreR;
  mat3 m;
  if (foreL) { m = rX(P.le); p = m*(p - vec3(${SK.elL})) + vec3(${SK.elL}); n = m*n; }
  if (foreR) { m = rX(P.re); p = m*(p - vec3(${SK.elR})) + vec3(${SK.elR}); n = m*n; }
  if (armL) { m = rX(P.lax)*rZ(P.laz); p = m*(p - vec3(${SK.shL})) + vec3(${SK.shL}); n = m*n; }
  if (armR) { m = rX(P.rax)*rZ(P.raz); p = m*(p - vec3(${SK.shR})) + vec3(${SK.shR}); n = m*n; }
  if (prt==2) { m = rX(P.dx)*rY(P.dy); p = m*(p - vec3(${SK.neck})) + vec3(${SK.neck}); n = m*n; }
  if (armL || armR || prt==1 || prt==2) { m = rX(P.sx)*rY(P.sy)*rZ(P.sz); p = m*(p - vec3(${SK.spine})) + vec3(${SK.spine}); n = m*n; }
  if (prt==8) { m = rX(P.lk); p = m*(p - vec3(${SK.knL})) + vec3(${SK.knL}); n = m*n; }
  if (prt==10) { m = rX(P.rk); p = m*(p - vec3(${SK.knR})) + vec3(${SK.knR}); n = m*n; }
  if (prt==7 || prt==8) { m = rX(P.llx)*rZ(P.llz); p = m*(p - vec3(${SK.hipL})) + vec3(${SK.hipL}); n = m*n; }
  if (prt==9 || prt==10) { m = rX(P.rlx)*rZ(P.rlz); p = m*(p - vec3(${SK.hipR})) + vec3(${SK.hipR}); n = m*n; }
  m = rX(P.hx)*rZ(P.hr);
  p = m*(p - vec3(${SK.pelvis})) + vec3(0., P.hy, P.hz); n = m*n;
  mat3 yaw = rY(iPos.w);
  p = yaw*(p*iMisc.x) + iPos.xyz; n = yaw*n;
}
`;

function paletteColor(idx) { return `texelFetch(uPal, ivec2(int(${idx} + 0.5), 0), 0).rgb`; }

function patchColor(sh, uniforms) {
  sh.uniforms.uTime = uniforms.uTime;
  sh.uniforms.uPal = uniforms.uPal;
  sh.uniforms.uPrint = uniforms.uPrint;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + HEAD)
    .replace('#include <beginnormal_vertex>', 'vec3 crowdP = position; vec3 objectNormal = normal; crowdXf(crowdP, objectNormal);')
    .replace('#include <begin_vertex>', 'vec3 transformed = crowdP;')
    .replace('#include <color_vertex>', `#include <color_vertex>
      {
        int slot = int(aInfo.y + 0.5); int fl = int(iMisc.z + 0.5);
        vec3 skin = ${paletteColor('iCol0.x')}, top = ${paletteColor('iCol0.y')}, top2 = ${paletteColor('iCol0.z')}, bot = ${paletteColor('iCol0.w')};
        vec3 c = color;
        if (slot == 0) c = skin; else if (slot == 1) c = top; else if (slot == 2) c = top2; else if (slot == 3) c = bot;
        else if (slot == 4) c = ${paletteColor('iCol1.x')}; else if (slot == 5) c = ${paletteColor('iCol1.y')};
        else if (slot == 6) c = vec3(0.015); else if (slot == 7) c = ${paletteColor('iCol1.z')}; else if (slot == 8) c = ${paletteColor('iCol1.w')};
        else if (slot == 10) c = (fl & 4) == 4 ? skin : bot; else if (slot == 11) c = (fl & 2) == 2 ? top : skin;
        if ((fl & 8) == 8 && slot == 1) { float band = step(0.5, fract(position.y * 9.0)); c = mix(c, top2, band * step(1.25, position.y) * 0.8); }
        vColor.rgb = c;
        // printed T-shirts: IITG / IIT GUWAHATI / emblem / fest tees on the chest
        vPrintId = float((fl >> 6) & 15);
        vPrintUV = vec2(position.x / 0.29 + 0.5, (position.y - 1.13) / 0.27);
        vFront = (slot == 1 && int(aInfo.x + 0.5) == 1 && normal.z > 0.3 && (fl & 32) == 0) ? 1.0 : 0.0;
      }`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vPrintUV;\nvarying float vPrintId, vFront;\nuniform sampler2D uPrint;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      if (vPrintId > 0.5 && vFront > 0.5 && vPrintUV.x > 0.0 && vPrintUV.x < 1.0 && vPrintUV.y > 0.0 && vPrintUV.y < 1.0) {
        float a = texture2D(uPrint, vec2((vPrintUV.x + floor(vPrintId + 0.5) - 1.0) / 10.0, vPrintUV.y)).a;
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb = mix(diffuseColor.rgb, lum > 0.45 ? vec3(0.06, 0.09, 0.2) : vec3(0.93, 0.92, 0.88), a);
      }`);
}
function patchDepth(sh, uniforms) {
  sh.uniforms.uTime = uniforms.uTime;
  sh.uniforms.uPal = uniforms.uPal;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n#define CROWD_DEPTH\n' + HEAD)
    .replace('#include <begin_vertex>', 'vec3 transformed = position; vec3 crowdN = vec3(0.,1.,0.); crowdXf(transformed, crowdN);');
}

/** white-on-transparent chest prints, 10 in a row: IITG, IIT GUWAHATI, emblem, GUWAHATI, ALCHERINGA, TECHNICHE, batch tee,
 *  BSc (Hons) in DSAI, AI CONFLUENCE 2024, AI CONFLUENCE 2025 */
function printAtlas() {
  const W = 128, H = 128, c = document.createElement('canvas');
  c.width = W * 10; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const font = (w, px) => `${w} ${px}px "Teko", "Hind", "Segoe UI", system-ui, sans-serif`;
  const at = (i) => i * W + W / 2;
  g.font = font(800, 58); g.fillText('IITG', at(0), 66, 116);
  g.font = font(800, 36); g.fillText('IIT', at(1), 42, 116); g.font = font(700, 26); g.fillText('GUWAHATI', at(1), 80, 118);
  // emblem: a ring with a lamp of learning and the letters around it (not the official crest)
  g.lineWidth = 6; g.beginPath(); g.arc(at(2), 64, 44, 0, 7); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(at(2), 64, 34, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(at(2) - 14, 80); g.lineTo(at(2) + 14, 80); g.lineTo(at(2) + 8, 66); g.lineTo(at(2) - 8, 66); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(at(2), 44); g.quadraticCurveTo(at(2) + 10, 58, at(2), 64); g.quadraticCurveTo(at(2) - 10, 58, at(2), 44); g.fill();
  g.font = font(700, 14); g.fillText('IITG', at(2), 98);
  g.font = font(800, 30); g.fillText('GUWAHATI', at(3), 58, 118); g.fillRect(3 * W + 16, 80, W - 32, 5);
  g.font = font(800, 25); g.fillText('ALCHERINGA', at(4), 60, 120); g.font = font(600, 14); g.fillText('IIT GUWAHATI', at(4), 86);
  g.font = font(800, 28); g.fillText('TECHNICHE', at(5), 60, 120); g.font = font(600, 14); g.fillText('IIT GUWAHATI', at(5), 86);
  g.font = font(800, 44); g.fillText('IITG', at(6), 50); g.font = font(700, 20); g.fillText("BATCH '26", at(6), 88);
  g.font = font(800, 24); g.fillText('BSc (Hons)', at(7), 42, 120); g.font = font(700, 22); g.fillText('in DSAI', at(7), 70, 118); g.font = font(600, 13); g.fillText('IIT GUWAHATI', at(7), 96);
  for (const [i, yr] of [[8, '2024'], [9, '2025']]) {
    g.font = font(800, 26); g.fillText('AI', at(i), 30); g.font = font(800, 21); g.fillText('CONFLUENCE', at(i), 58, 120);
    g.font = font(800, 30); g.fillText(yr, at(i), 90); g.lineWidth = 2; g.strokeRect(i * W + 10, 10, W - 20, H - 20);
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = true;
  t.anisotropy = 4;
  return t;
}

class Layer {
  constructor(geo, cap, uniforms, castShadow) {
    const g = new THREE.InstancedBufferGeometry();
    g.index = geo.index;
    for (const k of ['position', 'normal', 'aInfo', 'color']) g.setAttribute(k, geo.attributes[k]);
    this.cap = cap;
    this.arr = {};
    for (const k of ['iPos', 'iAnim', 'iMisc', 'iCol0', 'iCol1']) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(k, a);
      this.arr[k] = a;
    }
    g.instanceCount = 0;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
    mat.onBeforeCompile = (sh) => patchColor(sh, uniforms);
    mat.customProgramCacheKey = () => 'crowd-color';
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (sh) => patchDepth(sh, uniforms);
    depth.customProgramCacheKey = () => 'crowd-depth';
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.customDepthMaterial = depth;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = true;
    this.geo = g;
    this.n = 0;
  }
  write(a) {
    if (this.n >= this.cap) return false;
    const i = this.n++ * 4;
    const P = this.arr.iPos.array, A = this.arr.iAnim.array, Mi = this.arr.iMisc.array, C0 = this.arr.iCol0.array, C1 = this.arr.iCol1.array;
    P[i] = a.x; P[i + 1] = a.y; P[i + 2] = a.z; P[i + 3] = a.yaw;
    A[i] = a.anim; A[i + 1] = a.phase || 0; A[i + 2] = a.speed || 0; A[i + 3] = a.extra || 0;
    const L = a.look;
    let fl = a.flags ?? L.flags;
    if (L.hoodie && L.variant < this.winter) fl |= 34;      // hoodie on (with long sleeves) when it is cool
    Mi[i] = L.scale; Mi[i + 1] = a.opts ?? L.opts; Mi[i + 2] = fl; Mi[i + 3] = L.variant;
    C0[i] = L.col0[0]; C0[i + 1] = L.col0[1]; C0[i + 2] = L.col0[2]; C0[i + 3] = L.col0[3];
    C1[i] = L.col1[0]; C1[i + 1] = L.col1[1]; C1[i + 2] = L.col1[2]; C1[i + 3] = a.propColor ?? L.col1[3];
    return true;
  }
  flush() {
    this.geo.instanceCount = this.n;
    for (const k in this.arr) {
      const at = this.arr[k];
      at.clearUpdateRanges();
      at.addUpdateRange(0, this.n * 4);
      at.needsUpdate = true;
    }
  }
}

/**
 * Crowd renderer. Each frame: begin(camera) -> push(person) for everyone that
 * should be drawn -> end(). A person is {x,y,z,yaw, anim, phase, speed, extra, look, opts?}.
 */
export class CrowdRenderer {
  constructor(scene, { nearCap = 420, farCap = 1800, nearDist = 42, maxDist = 330, shadows = true } = {}) {
    this.pal = paletteTexture();
    this.palN = paletteSize();
    this.uniforms = { uTime: { value: 0 }, uPal: { value: this.pal }, uPrint: { value: printAtlas() } };
    this.winter = 0;
    this.near = new Layer(personGeometry(true), nearCap, this.uniforms, shadows);
    this.far = new Layer(personGeometry(false), farCap, this.uniforms, false);
    this.group = new THREE.Group();
    this.group.name = 'crowd';
    this.group.add(this.near.mesh, this.far.mesh);
    scene.add(this.group);
    this.nearD2 = nearDist * nearDist;
    this.maxD2 = maxDist * maxDist;
    this.cam = new THREE.Vector3();
    this.frustum = new THREE.Frustum();
    this._m = new THREE.Matrix4();
    this._s = new THREE.Sphere(new THREE.Vector3(), 1.2);
    this.drawn = 0;
  }
  setShadows(on) { this.near.mesh.castShadow = on; }
  begin(camera, time) {
    this.uniforms.uTime.value = time;
    this.cam.copy(camera.position);
    camera.updateMatrixWorld();
    this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this._m);
    this.near.n = 0; this.far.n = 0;
    if (paletteSize() !== this.palN) { paletteTexture(this.pal); this.palN = paletteSize(); }
  }
  /** Returns true if drawn. `force` skips distance/frustum culling (e.g. interiors). */
  push(a, force = false) {
    if (window.__noKids && a.look.scale < 0.76) return false;   // debug captures only
    const dx = a.x - this.cam.x, dy = a.y - this.cam.y, dz = a.z - this.cam.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (!force) {
      if (d2 > this.maxD2) return false;
      this._s.center.set(a.x, a.y + 0.9, a.z);
      // keep near people for shadows even if just off-screen
      if (d2 > 400 && !this.frustum.intersectsSphere(this._s)) return false;
    }
    return d2 < this.nearD2 ? this.near.write(a) || this.far.write(a) : this.far.write(a);
  }
  end() { this.near.flush(); this.far.flush(); this.drawn = this.near.n + this.far.n; }
}
export { OPT };

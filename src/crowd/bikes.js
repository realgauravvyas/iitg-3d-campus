// GPU bicycles for crowd cyclists: wheels and cranks turn in the vertex shader.
// Geometry matches the rider IK in people.js (BB at y 0.30 z -0.04, crank 0.17, seat 0.93).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const R = 0.34, REAR = -0.52, FRONT = 0.54, BB = [0.3, -0.04];

function bikeGeometry() {
  const G = [];
  const add = (geo, prt, slot, m, color = '#222222') => {
    if (m) geo.applyMatrix4(m);
    geo.deleteAttribute('uv');
    const n = geo.attributes.position.count;
    const info = new Float32Array(n * 2), col = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) { info[i * 2] = prt; info[i * 2 + 1] = slot; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('aB', new THREE.BufferAttribute(info, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    G.push(geo);
  };
  const tube = (a, b, r = 0.018, prt = 0, slot = 1) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const d = new THREE.Vector3().subVectors(B, A);
    const g = new THREE.CylinderGeometry(r, r, d.length(), 6, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    add(g, prt, slot, new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  };
  // wheels (parts 1 rear, 2 front): tyre + rim + spokes
  for (const [prt, z] of [[1, REAR], [2, FRONT]]) {
    add(new THREE.TorusGeometry(R - 0.015, 0.02, 6, 24), prt, 0, new THREE.Matrix4().compose(new THREE.Vector3(0, R, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)), '#151515');
    add(new THREE.TorusGeometry(R - 0.045, 0.008, 4, 24), prt, 0, new THREE.Matrix4().compose(new THREE.Vector3(0, R, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)), '#a9adb2');
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      tube([0, R + Math.cos(a) * (R - 0.05), z + Math.sin(a) * (R - 0.05)], [0, R - Math.cos(a) * (R - 0.05), z - Math.sin(a) * (R - 0.05)], 0.003, prt, 0);
    }
  }
  // frame (part 0, slot 1 = frame colour)
  const seat = [0, 0.93, -0.3], head = [0, 0.86, 0.42], bb = [0, BB[0], BB[1]];
  tube(bb, [0, 0.86, -0.27], 0.02);            // seat tube
  tube([0, 0.84, -0.26], head, 0.02);          // top tube
  tube(bb, [0, 0.8, 0.4], 0.022);               // down tube
  tube(bb, [0, R, REAR], 0.013);                // chain stays
  tube([0, 0.84, -0.26], [0, R, REAR], 0.012);  // seat stays
  tube(head, [0, R, FRONT], 0.016);             // fork
  tube(head, [0, 1.02, 0.4], 0.018, 0, 0);      // stem
  tube([-0.27, 1.02, 0.38], [0.27, 1.02, 0.38], 0.014, 0, 0);
  for (const s of [1, -1]) tube([s * 0.27, 1.02, 0.38], [s * 0.3, 1.02, 0.33], 0.02, 0, 0);
  tube([0, 0.86, -0.27], seat, 0.012, 0, 0);
  add(new THREE.BoxGeometry(0.14, 0.05, 0.26), 0, 0, new THREE.Matrix4().makeTranslation(0, 0.95, -0.3), '#1a1a1a');
  add(new THREE.BoxGeometry(0.03, 0.09, 0.44), 0, 0, new THREE.Matrix4().makeTranslation(0.06, R + 0.05, (REAR + BB[1]) / 2), '#1a1a1a'); // chain guard
  add(new THREE.BoxGeometry(0.2, 0.03, 0.26), 0, 1, new THREE.Matrix4().makeTranslation(0, 0.72, REAR + 0.05)); // carrier
  // crank + pedals (part 3)
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 14), 3, 0, new THREE.Matrix4().compose(new THREE.Vector3(0.05, BB[0], BB[1]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1)), '#9aa0a6');
  for (const s of [1, -1]) {
    tube([s * 0.07, BB[0], BB[1]], [s * 0.07, BB[0] + s * 0.17, BB[1]], 0.01, 3, 0);
    add(new THREE.BoxGeometry(0.08, 0.02, 0.07), 3, 0, new THREE.Matrix4().makeTranslation(s * 0.13, BB[0] + s * 0.17, BB[1]), '#202020');
  }
  const g = mergeGeometries(G, false);
  G.forEach((x) => x.dispose());
  return g;
}

const HEAD = /* glsl */`
attribute vec2 aB;
attribute vec4 iPos;
attribute vec4 iAnim;
uniform sampler2D uPal;
mat3 rX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 rY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
void bikeXf(inout vec3 p, inout vec3 n){
  int prt = int(aB.x + 0.5);
  mat3 m;
  if (prt == 1 || prt == 2) { vec3 c = vec3(0., ${R}, prt == 1 ? ${REAR} : ${FRONT}); m = rX(iAnim.x); p = m*(p - c) + c; n = m*n; }
  if (prt == 3) {
    vec3 c = vec3(0., ${BB[0]}, ${BB[1]});
    vec3 q = p - c; bool pedal = abs(q.x) > 0.085;
    m = rX(iAnim.y); vec3 r = m*q;
    if (pedal) { vec3 pc = m*vec3(0., sign(q.y) * 0.17, 0.); r = pc + (q - vec3(0., sign(q.y) * 0.17, 0.)); }
    p = r + c; n = pedal ? n : m*n;
  }
  m = rY(iPos.w) * rZ(iAnim.z);
  p = m*p + iPos.xyz; n = m*n;
}
`;

export class BikeRenderer {
  constructor(scene, pal, cap = 900, shadows = true) {
    const base = bikeGeometry();
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    for (const k of ['position', 'normal', 'aB', 'color']) g.setAttribute(k, base.attributes[k]);
    this.arr = {};
    for (const k of ['iPos', 'iAnim']) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(k, a);
      this.arr[k] = a;
    }
    const uniforms = { uPal: { value: pal } };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uPal = uniforms.uPal;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + HEAD)
        .replace('#include <beginnormal_vertex>', 'vec3 bP = position; vec3 objectNormal = normal; bikeXf(bP, objectNormal);')
        .replace('#include <begin_vertex>', 'vec3 transformed = bP;')
        .replace('#include <color_vertex>', '#include <color_vertex>\n if (int(aB.y + 0.5) == 1) vColor.rgb = texelFetch(uPal, ivec2(int(iAnim.w + 0.5), 0), 0).rgb;');
    };
    mat.customProgramCacheKey = () => 'crowd-bike';
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + HEAD)
        .replace('#include <begin_vertex>', 'vec3 transformed = position; vec3 bN = vec3(0.,1.,0.); bikeXf(transformed, bN);');
    };
    depth.customProgramCacheKey = () => 'crowd-bike-depth';
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.customDepthMaterial = depth;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadows;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.geo = g; this.cap = cap; this.n = 0;
  }
  begin() { this.n = 0; }
  /** b: {x,y,z,yaw, wheel, crank, lean, color} */
  push(b) {
    if (this.n >= this.cap) return;
    const i = this.n++ * 4, P = this.arr.iPos.array, A = this.arr.iAnim.array;
    P[i] = b.x; P[i + 1] = b.y; P[i + 2] = b.z; P[i + 3] = b.yaw;
    A[i] = b.wheel || 0; A[i + 1] = b.crank || 0; A[i + 2] = b.lean || 0; A[i + 3] = b.color;
  }
  end() {
    this.geo.instanceCount = this.n;
    for (const k in this.arr) { const at = this.arr[k]; at.clearUpdateRanges(); at.addUpdateRange(0, this.n * 4); at.needsUpdate = true; }
  }
}
export const BIKE_DIMS = { R, REAR, FRONT, BB };

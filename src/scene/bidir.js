// Boards you can read from both sides. A double-sided plane shows its texture mirrored from behind
// (and a one-sided one shows nothing at all), so every upright board - a sign, a banner, a notice - is
// made double-sided and its texture is flipped on the back face: the words read the right way round from
// either side. Runs once over the finished scene, and over each interior and event set when it is built.
import * as THREE from 'three';

const flipped = (chunk, uv) => THREE.ShaderChunk[chunk].replace(new RegExp(uv, 'g'), `${uv}Bk`);
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _n = new THREE.Vector3(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

/** the material also draws its map (and emissive map) mirrored on the back face */
function patch(m) {
  if (m.userData.bidir) return false;
  m.userData.bidir = true;
  m.side = THREE.DoubleSide;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = function (shader, renderer) {
    prev.call(this, shader, renderer);
    let f = shader.fragmentShader;
    if (f.includes('#include <map_fragment>')) f = f.replace('#include <map_fragment>', `#ifdef USE_MAP\n vec2 vMapUvBk = vMapUv; if (!gl_FrontFacing) vMapUvBk.x = 1.0 - vMapUvBk.x;\n#endif\n${flipped('map_fragment', 'vMapUv')}`);
    if (f.includes('#include <emissivemap_fragment>')) f = f.replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP\n vec2 vEmissiveMapUvBk = vEmissiveMapUv; if (!gl_FrontFacing) vEmissiveMapUvBk.x = 1.0 - vEmissiveMapUvBk.x;\n#endif\n${flipped('emissivemap_fragment', 'vEmissiveMapUv')}`);
    shader.fragmentShader = f;
  };
  m.customProgramCacheKey = () => `${prevKey()}|bidir`;
  m.needsUpdate = true;
  return true;
}

/** true for a plane that stands upright (its normal is roughly horizontal) */
function upright(o) {
  o.updateWorldMatrix(true, false);
  _m.copy(o.matrixWorld);
  if (o.isInstancedMesh && o.count > 0) { o.getMatrixAt(0, _p.set(0, 0, 0) && _m.identity()); _m.premultiply(o.matrixWorld); }
  _m.decompose(_p, _q, _s);
  _n.set(0, 0, 1).applyQuaternion(_q);
  return Math.abs(_n.y) < 0.4;
}

/** make every upright board under `root` readable from both sides; returns how many materials changed */
export function makeBoardsTwoSided(root) {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const t = o.geometry?.type;
    if (t !== 'PlaneGeometry' && t !== 'CircleGeometry') return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => m && m.map && (m.map.isCanvasTexture || m.map.image instanceof HTMLCanvasElement))) return;
    if (!upright(o)) return;
    for (const m of mats) if (m && m.map && patch(m)) n++;
  });
  return n;
}

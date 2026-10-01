// Procedural, customisable avatar. The default look ("Me") is modelled on the
// player's own photos: short side-swept black hair, black rectangular glasses,
// trimmed beard with moustache, grey plaid shirt with rolled-up sleeves, khaki
// cargo pants, light-grey sneakers and a black-strap watch.
import * as THREE from 'three';
import { canvasTexture, m4, tube, clamp, damp, mulberry32 } from './util.js';

export const DEFAULT_LOOK = {
  body: 'male', build: 'slim', height: 1.75,
  skin: '#b88061', face: 'oval', facialHair: 'beard',
  hairStyle: 'sideswept', hairColor: '#15110e',
  glasses: 'rect', glassesColor: '#121212',
  top: 'plaid', topColor: '#8d9091', topColor2: '#2c2e32',
  bottom: 'cargo', bottomColor: '#857e66',
  shoes: 'sneakers', shoesColor: '#bcc3ca',
  watch: true, backpack: false, backpackColor: '#2b3a4a', cap: false, capColor: '#b3262f', headphones: false,
  bikeColor: '#1e1e1e', bikeStyle: 'mtb',
};

export const OPTIONS = {
  body: [['male', 'Male'], ['female', 'Female']],
  build: [['slim', 'Slim'], ['average', 'Average'], ['broad', 'Broad']],
  skin: ['#f1d4be', '#e5bc9a', '#d6a37f', '#b88061', '#ab7150', '#8e5b3e', '#6d4531', '#4b2f22'],
  face: [['oval', 'Oval'], ['round', 'Round'], ['square', 'Square'], ['long', 'Long']],
  facialHair: [['none', 'Clean'], ['stubble', 'Stubble'], ['beard', 'Trimmed beard'], ['fullbeard', 'Full beard'], ['mustache', 'Moustache'], ['goatee', 'Goatee']],
  hairStyle: [['sideswept', 'Side-swept'], ['short', 'Short'], ['buzz', 'Buzz cut'], ['spiky', 'Spiky'], ['curly', 'Curly'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['bun', 'Bun'], ['braid', 'Braid'], ['bald', 'Bald']],
  hairColor: ['#15110e', '#2e1f16', '#4a3020', '#6e3b22', '#a8743f', '#d8b36a', '#8a8a8a', '#2d4f8a', '#7a1f3d'],
  glasses: [['none', 'None'], ['rect', 'Rectangular'], ['round', 'Round'], ['sunglasses', 'Sunglasses']],
  top: [['plaid', 'Checked shirt'], ['tshirt', 'T-shirt'], ['polo', 'Polo'], ['formal', 'Formal shirt'], ['hoodie', 'Hoodie'], ['jacket', 'Denim jacket'], ['kurta', 'Kurta'], ['kurti', 'Kurti'], ['chador', 'Mekhela chador (top)']],
  bottom: [['cargo', 'Cargo pants'], ['jeans', 'Jeans'], ['chinos', 'Chinos'], ['track', 'Track pants'], ['shorts', 'Shorts'], ['leggings', 'Leggings'], ['skirt', 'Long skirt'], ['mekhela', 'Mekhela']],
  shoes: [['sneakers', 'Sneakers'], ['running', 'Running shoes'], ['formal', 'Formal shoes'], ['boots', 'Boots'], ['sandals', 'Sandals'], ['chappal', 'Chappals']],
  colors: ['#8d9091', '#f2f0ea', '#1c1c1c', '#2b3a55', '#3f6fb0', '#8fb4d8', '#b3262f', '#c89b3c', '#5b7f3a', '#2f5d5a', '#6b3d5e', '#e38aa0', '#f0c24b', '#857e66', '#5a4632', '#c86b3c'],
};

export const PRESETS = [
  { id: 'me', name: 'Me (default)', look: {} },
  { id: 'hostel', name: 'Hostel chill', look: { top: 'tshirt', topColor: '#2b3a55', bottom: 'shorts', bottomColor: '#5a5a5a', shoes: 'chappal', shoesColor: '#1c1c1c', watch: false } },
  { id: 'placement', name: 'Placement day', look: { top: 'formal', topColor: '#f2f0ea', bottom: 'chinos', bottomColor: '#1c1c1c', shoes: 'formal', shoesColor: '#1a1a1a' } },
  { id: 'sports', name: 'Spirit (sports)', look: { top: 'tshirt', topColor: '#b3262f', bottom: 'track', bottomColor: '#1c1c1c', shoes: 'running', shoesColor: '#f2f0ea', cap: true, capColor: '#1c1c1c' } },
  { id: 'fest', name: 'Alcheringa night', look: { top: 'kurta', topColor: '#c89b3c', bottom: 'jeans', bottomColor: '#2b3a55', shoes: 'sandals', shoesColor: '#5a4632' } },
  { id: 'kurti', name: 'Kurti & leggings', look: { body: 'female', height: 1.62, facialHair: 'none', hairStyle: 'braid', glasses: 'none', top: 'kurti', topColor: '#2f5d5a', bottom: 'leggings', bottomColor: '#f2f0ea', shoes: 'sandals', shoesColor: '#5a4632', watch: true } },
  { id: 'mekhela', name: 'Mekhela chador', look: { body: 'female', height: 1.62, facialHair: 'none', hairStyle: 'bun', glasses: 'none', top: 'chador', topColor: '#efe3c2', bottom: 'mekhela', bottomColor: '#efe3c2', shoes: 'sandals', shoesColor: '#c89b3c', watch: false } },
  { id: 'hoodie', name: 'Winter hoodie', look: { body: 'female', height: 1.64, facialHair: 'none', hairStyle: 'ponytail', hairColor: '#2e1f16', glasses: 'round', top: 'hoodie', topColor: '#6b3d5e', bottom: 'jeans', bottomColor: '#3f6fb0', shoes: 'sneakers', shoesColor: '#f2f0ea', backpack: true } },
];

function plaidTexture(base, dark) {
  return canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const band = (pos, width, color, alpha, vertical) => {
      g.globalAlpha = alpha; g.fillStyle = color;
      if (vertical) g.fillRect(pos, 0, width, H); else g.fillRect(0, pos, W, width);
    };
    for (const v of [true, false]) {
      for (let k = 0; k < 4; k++) {
        const o = k * 64;
        band(o + 4, 20, dark, 0.55, v);        // dark wide check
        band(o + 30, 3, dark, 0.8, v);         // thin dark line
        band(o + 44, 5, '#efe9da', 0.7, v);    // cream line
        band(o + 54, 2, '#efe9da', 0.5, v);
      }
    }
    g.globalAlpha = 1;
  });
}

// ------------------------------------------------------------------ geometry helpers
function lathe(profile, sx, sz, seg = 20) {
  const g = new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(r, y)), seg);
  g.scale(sx, 1, sz);
  return g;
}
const cap = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, seg);
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 14, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);

/** Merge parts keeping uv; returns BufferGeometry with position/normal/uv/color. */
function mergeParts(parts) {
  let n = 0;
  const gs = parts.map((p) => {
    let g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone();
    if (p.matrix) g.applyMatrix4(p.matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    n += g.attributes.position.count;
    return { g, c: new THREE.Color(p.color) };
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  let o = 0;
  for (const { g, c } of gs) {
    const cnt = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += cnt;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
const mix = (a, b, t) => { const c = new THREE.Color(a).lerp(new THREE.Color(b), t); return '#' + c.getHexString(); };

const sharedNpcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });

export class Avatar {
  constructor(look = DEFAULT_LOOK, { npc = false } = {}) {
    this.npc = npc;
    this.root = new THREE.Group();
    this.root.name = 'avatar';
    this.pose = { phase: 0, t: 0 };
    this.cur = {}; // smoothed joint angles
    this.setLook(look);
  }

  setLook(look) {
    this.look = { ...DEFAULT_LOOK, ...look };
    while (this.root.children.length) {
      const c = this.root.children.pop();
      c.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    }
    this.build();
  }

  build() {
    const L = this.look;
    const fem = L.body === 'female';
    const bw = { slim: 0.93, average: 1.0, broad: 1.1 }[L.build] || 1;
    const S = {
      shoulder: (fem ? 0.172 : 0.198) * bw, hip: fem ? 0.1 : 0.094, tw: (fem ? 0.34 : 0.39) * bw, td: (fem ? 0.21 : 0.22) * bw,
      arm: (fem ? 0.042 : 0.048) * bw, fore: (fem ? 0.036 : 0.041) * bw, thigh: (fem ? 0.078 : 0.076) * bw, shin: (fem ? 0.054 : 0.057) * bw,
    };
    this.S = S;
    const skin = L.skin, hair = L.hairColor;
    const top = L.top, bottom = L.bottom;
    const topC = L.topColor, top2 = L.topColor2, botC = L.bottomColor;
    const textured = !this.npc && top === 'plaid';
    this.plainMat = this.npc ? sharedNpcMat : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
    this.texMat = textured ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, map: plaidTexture(topC, top2) }) : null;
    const shirtColor = textured ? '#ffffff' : top === 'plaid' ? mix(topC, top2, 0.3) : topC;

    // ---- joints
    const J = {};
    const G = (name, parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); (parent || this.root).add(g); J[name] = g; return g; };
    G('hips', null, 0, 0.97, 0);
    G('legL', J.hips, S.hip, -0.03, 0); G('kneeL', J.legL, 0, -0.42, 0); G('ankleL', J.kneeL, 0, -0.43, 0);
    G('legR', J.hips, -S.hip, -0.03, 0); G('kneeR', J.legR, 0, -0.42, 0); G('ankleR', J.kneeR, 0, -0.43, 0);
    G('spine', J.hips, 0, 0.06, 0);
    G('neck', J.spine, 0, 0.47, 0); G('head', J.neck, 0, 0.14, 0);
    G('armL', J.spine, S.shoulder, 0.42, 0); G('elbowL', J.armL, 0, -0.28, 0);
    G('armR', J.spine, -S.shoulder, 0.42, 0); G('elbowR', J.armR, 0, -0.28, 0);
    G('prop', J.spine, 0, 0.18, 0.2); // drone controller
    this.J = J;

    this.lensMesh = null;
    const parts = {}; // joint -> {plain:[], tex:[]}
    const add = (joint, geometry, color, matrix, tex = false) => {
      parts[joint] ??= { plain: [], tex: [] };
      parts[joint][tex ? 'tex' : 'plain'].push({ geometry, color, matrix });
    };

    // ---- torso (shirt)
    const untucked = ['plaid', 'tshirt', 'polo', 'hoodie', 'jacket'].includes(top);
    const hem = untucked ? -0.14 : top === 'formal' ? -0.05 : -0.1;
    const prof = fem
      ? [[hem, 0], [hem, 0.172], [-0.05, 0.168], [0.06, 0.146], [0.18, 0.16], [0.26, 0.175], [0.34, 0.17], [0.41, 0.158], [0.45, 0.12], [0.47, 0.05], [0.475, 0]]
      : [[hem, 0], [hem, 0.168], [-0.05, 0.166], [0.05, 0.16], [0.15, 0.172], [0.27, 0.192], [0.36, 0.196], [0.41, 0.18], [0.45, 0.13], [0.47, 0.06], [0.475, 0]];
    const torsoGeo = lathe(prof, S.tw / 0.39, S.td / 0.39 * 1.02);
    if (textured) {
      const uv = torsoGeo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 1.6);
    }
    const shirtTop = top === 'chador' ? '#e9dcc0' : top === 'jacket' ? topC : shirtColor;
    add('spine', torsoGeo, shirtTop, null, textured);
    if (fem) add('spine', sph(0.07, 12, 8), shirtTop, m4(0, 0.25, 0.055, 0, 0, 0, 1.95, 0.9, 0.95), textured);
    // shoulder caps smooth the arm joint
    for (const s of [1, -1]) add('spine', sph(S.arm * 1.18, 10, 8), shirtTop, m4(s * S.shoulder, 0.41, 0), textured);
    // details
    if (['plaid', 'formal', 'polo'].includes(top)) {
      const collar = top === 'plaid' ? mix(topC, top2, 0.35) : shade(topC, 0.92);
      for (const s of [1, -1]) add('spine', box(0.07, 0.03, 0.045), collar, m4(s * 0.04, 0.455, 0.055, 0.3, s * 0.5, s * 0.4));
      const n = top === 'polo' ? 2 : 5;
      for (let k = 0; k < n; k++) add('spine', sph(0.008, 6, 4), '#e8e4da', m4(0, 0.42 - k * 0.085, (S.td / 2) * 1.02 + 0.004));
      if (top === 'plaid') add('spine', box(0.075, 0.08, 0.01), collar, m4(0.07, 0.3, S.td / 2 * 0.99));
    }
    if (top === 'tshirt') add('spine', cyl(0.062, 0.066, 0.02, 14, true), shade(topC, 0.85), m4(0, 0.46, 0.005));
    if (top === 'hoodie') {
      add('spine', new THREE.TorusGeometry(0.1, 0.045, 8, 16, Math.PI), shade(topC, 0.9), m4(0, 0.44, -0.07, -0.6, 0, 0));
      add('spine', box(0.2, 0.09, 0.02), shade(topC, 0.9), m4(0, 0.05, S.td / 2 * 0.98));
    }
    if (top === 'jacket') { // denim jacket open over a white tee
      add('spine', box(0.1, 0.5, 0.012), '#f2f0ea', m4(0, 0.17, S.td / 2 * 1.03));
      for (const s of [1, -1]) add('spine', box(0.03, 0.34, 0.03), shade(topC, 0.85), m4(s * 0.06, 0.3, S.td / 2 * 1.02, 0, 0, s * 0.12));
    }
    if (top === 'chador') { // draped chador with muga-gold border, over the left shoulder
      add('spine', box(0.16, 0.62, 0.02), topC, m4(0.02, 0.2, S.td / 2 * 1.06, 0, 0, -0.55));
      add('spine', box(0.03, 0.62, 0.022), '#c89b3c', m4(0.085, 0.24, S.td / 2 * 1.07, 0, 0, -0.55));
      add('spine', box(0.18, 0.55, 0.02), topC, m4(0.05, 0.18, -S.td / 2 * 1.06, 0, 0, 0.45));
      add('spine', box(0.2, 0.07, 0.24), topC, m4(0.12, 0.44, 0, 0, 0, -0.2));
    }
    if (top === 'kurta' || top === 'kurti') { // long tunic, flared to the knee
      const len = top === 'kurta' ? 0.52 : 0.46;
      add('hips', lathe([[-len, 0.245], [-len * 0.5, 0.2], [0.02, 0.17]], S.tw / 0.39, 0.66, 18), topC);
      add('hips', lathe([[-len, 0.246], [-len + 0.03, 0.246]], S.tw / 0.39, 0.66, 18), top === 'kurti' ? '#c89b3c' : shade(topC, 0.8));
      add('spine', box(0.012, 0.2, 0.01), shade(topC, 0.7), m4(0, 0.36, S.td / 2 * 1.02));
    }

    // ---- neck & head
    add('neck', cyl(0.047, 0.052, 0.12, 12), skin, m4(0, 0.04, 0));
    if (!this.npc) { for (const s of [1, -1]) { add('spine', sph(0.03, 8, 6), shirtTop, m4(s * 0.085, 0.455, -0.005, 0, 0, s * 0.5, 1.9, 0.55, 1.2), textured); add('neck', cap(0.008, 0.07, 6), shade(skin, 0.94), m4(s * 0.04, -0.045, 0.045, 0, 0, Math.PI / 2 + s * 0.28)); } }   // trapezius, collar bones
    const fs = { oval: [0.94, 1.12, 1.0], round: [1.0, 1.04, 1.0], square: [1.02, 1.07, 1.0], long: [0.9, 1.2, 0.98] }[L.face] || [0.94, 1.12, 1];
    this.faceScale = fs;
    add('head', sph(0.113, 22, 16), skin, m4(0, 0, 0, 0, 0, 0, ...fs));
    if (L.face === 'square') add('head', box(0.17, 0.06, 0.15), skin, m4(0, -0.07, 0.015));
    for (const s of [1, -1]) {
      add('head', sph(0.028, 10, 8), shade(skin, 0.95), m4(s * 0.107, 0.0, -0.005, 0, 0, 0, 0.5, 1.1, 0.85)); // ears
      if (!this.npc) {
        add('head', sph(0.017, 8, 6), shade(skin, 0.82), m4(s * 0.112, 0.003, 0.0, 0, 0, 0, 0.35, 1.05, 0.75));        // the hollow of the ear
        add('head', sph(0.011, 8, 6), shade(skin, 0.97), m4(s * 0.108, -0.026, 0.0, 0, 0, 0, 0.6, 1.0, 0.8));          // the lobe
      }
    }
    const fz = 0.113 * fs[2];
    if (!this.npc) {
      const lipC = mix(skin, '#7a3f36', fem ? 0.7 : 0.5), lidC = shade(skin, 0.92);
      for (const s of [1, -1]) {
        // the eye: white, iris (with its dark rim), pupil, a catch-light, the lids and lashes
        add('head', sph(0.0165, 10, 8), '#f6f3ee', m4(s * 0.04, 0.018, fz * 0.9, 0, 0, 0, 1.15, 0.78, 0.55));
        add('head', sph(0.0098, 10, 8), '#3a2418', m4(s * 0.04, 0.018, fz * 0.9 + 0.0075, 0, 0, 0, 1, 1, 0.6));
        add('head', sph(0.0052, 8, 6), '#0a0605', m4(s * 0.04, 0.018, fz * 0.9 + 0.0112));
        add('head', sph(0.0019, 6, 4), '#ffffff', m4(s * 0.0425, 0.0215, fz * 0.9 + 0.0125));
        add('head', sph(0.0185, 10, 6, 0, 6.2832, 0, 1.4), lidC, m4(s * 0.04, 0.0245, fz * 0.9 + 0.0004, -0.22, 0, 0, 1.15, 0.5, 0.62));   // the upper lid
        add('head', box(0.036, 0.0035, 0.006), shade(skin, 0.7), m4(s * 0.04, 0.0135, fz * 0.9 + 0.0085, 0.1, 0, 0));          // the lower lid line
        if (fem) for (let q = 0; q < 5; q++) add('head', box(0.0025, 0.009, 0.004), '#120c0a', m4(s * (0.026 + q * 0.0105), 0.0305 - Math.abs(q - 2) * 0.0012, fz * 0.9 + 0.0105, -0.5, 0, s * (q - 2) * 0.12));   // lashes
        // the brow: three angled pieces, thicker at the nose end, lifting at the outer end
        add('head', box(0.016, 0.0095, 0.011), hair, m4(s * 0.0235, 0.0455, fz * 0.915, 0, 0, s * -0.02));
        add('head', box(0.016, 0.0085, 0.011), hair, m4(s * 0.0395, 0.0475, fz * 0.915, 0, 0, s * -0.1));
        add('head', box(0.014, 0.0072, 0.01), hair, m4(s * 0.0545, 0.0455, fz * 0.9, 0, -s * 0.15, s * -0.26));
        add('head', sph(0.02, 8, 6), shade(skin, 0.99), m4(s * 0.066, -0.022, fz * 0.66, 0, 0, 0, 0.9, 0.75, 0.5));          // the cheek
        add('head', sph(0.013, 6, 5), shade(skin, 0.97), m4(s * 0.0215, -0.0295, fz * 0.915, 0, 0, 0, 1.15, 0.9, 0.8));      // the wing of the nostril
        add('head', sph(0.0048, 6, 4), '#2b1812', m4(s * 0.0108, -0.0285, fz * 0.985, 0, 0, 0, 1, 0.7, 0.8));               // the nostril
      }
      add('head', sph(0.022, 8, 6), skin, m4(0, 0.046, fz * 0.9, 0, 0, 0, 1.9, 0.5, 0.5));                                  // the brow ridge
      add('head', box(0.014, 0.05, 0.014), shade(skin, 1.02), m4(0, 0.01, fz * 0.975, -0.12, 0, 0));                         // the bridge of the nose
      add('head', sph(0.0165, 8, 6), shade(skin, 1.03), m4(0, -0.0225, fz * 1.005, 0, 0, 0, 1.05, 0.9, 1.0));               // the tip
      add('head', box(0.058, 0.0045, 0.01), shade(skin, 0.9), m4(0, -0.0505, fz * 0.935));                                   // the philtrum shadow / the line of the mouth
      add('head', sph(0.019, 8, 6), lipC, m4(0, -0.0475, fz * 0.945, 0.1, 0, 0, 1.45, 0.36, 0.52));                         // the upper lip
      add('head', sph(0.0205, 8, 6), lipC, m4(0, -0.0605, fz * 0.94, -0.15, 0, 0, 1.4, 0.4, 0.55));                         // the lower lip
      add('head', box(0.04, 0.0025, 0.004), shade(lipC, 0.5), m4(0, -0.0545, fz * 0.972));                                   // where they meet
      add('head', sph(0.021, 8, 6), shade(skin, 0.98), m4(0, -0.0875, fz * 0.86, 0, 0, 0, 1.15, 0.7, 0.7));                 // the chin
      add('head', sph(0.0085, 6, 5), shade(skin, 0.9), m4(0, -0.0735, fz * 0.945, 0, 0, 0, 1.9, 0.5, 0.6));                 // the dip under the lip
      if (!fem) add('head', sph(0.0085, 8, 6), shade(skin, 0.97), m4(0, -0.118, 0.052, 0, 0, 0, 1, 0.8, 0.8));           // the Adam's apple (low on the neck)
    }
    // facial hair
    const fh = fem ? 'none' : L.facialHair;
    if (fh !== 'none') {
      const beardC = fh === 'stubble' ? mix(skin, hair, 0.45) : mix(hair, skin, 0.12);
      if (fh === 'beard' || fh === 'fullbeard' || fh === 'stubble') {
        const r = fh === 'fullbeard' ? 0.1205 : 0.117;
        const g = fh === 'fullbeard'
          ? new THREE.SphereGeometry(r, 22, 12, Math.PI / 2 - 1.5, 3.0, Math.PI * 0.55, Math.PI * 0.4)
          : new THREE.SphereGeometry(r, 22, 12, Math.PI / 2 - 1.45, 2.9, Math.PI * 0.615, Math.PI * 0.3);
        for (const s of [1, -1]) add('head', box(0.012, 0.06, 0.035), beardC, m4(s * 0.106, -0.005, 0.02)); // sideburns
        add('head', g, beardC, m4(0, 0, 0, 0, 0, 0, fs[0], fs[1], fs[2]));
        if (fh === 'fullbeard') add('head', sph(0.05, 10, 8), beardC, m4(0, -0.105, 0.075, 0, 0, 0, 1.2, 0.9, 0.8));
        else add('head', sph(0.03, 10, 8), beardC, m4(0, -0.108, 0.082, 0, 0, 0, 1.1, 0.8, 0.7)); // chin
      }
      if (fh === 'goatee') {
        add('head', sph(0.03, 10, 8), beardC, m4(0, -0.1, 0.085, 0, 0, 0, 1.0, 1.2, 0.7));
      }
      if (fh !== 'stubble') add('head', box(0.06, 0.013, 0.02), beardC, m4(0, -0.04, fz * 0.93, 0.2, 0, 0)); // moustache
      if (!this.npc) add('head', box(0.036, 0.008, 0.012), '#7a3f36', m4(0, -0.055, fz * 0.97)); // keep lips visible
    }
    // hair
    this.buildHair(add, L, hair, fs);
    // glasses
    if (!this.npc && L.glasses !== 'none') this.buildGlasses(add, L, fz);
    // cap
    if (L.cap) {
      add('head', new THREE.SphereGeometry(0.124, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.46), L.capColor, m4(0, 0.012, -0.004, 0, 0, 0, fs[0], fs[1], fs[2]));
      add('head', cyl(0.085, 0.085, 0.012, 16), shade(L.capColor, 0.85), m4(0, 0.035, 0.12, 0.15, 0, 0, 1, 1, 0.95));
    }
    if (L.headphones) {
      add('head', new THREE.TorusGeometry(0.128, 0.012, 6, 20, Math.PI), '#1c1c1c', m4(0, 0.0, 0, 0, 0, 0, fs[0], fs[1], 1));
      for (const s of [1, -1]) add('head', cyl(0.035, 0.035, 0.03, 14), '#1c1c1c', m4(s * 0.118, 0, 0, 0, 0, Math.PI / 2));
    }

    // ---- arms
    const sleeve = { plaid: 'rolled', formal: 'long', hoodie: 'long', jacket: 'long', kurta: 'long', kurti: 'three', tshirt: 'short', polo: 'short', chador: 'short' }[top] || 'short';
    for (const [side, arm, elbow] of [[1, 'armL', 'elbowL'], [-1, 'armR', 'elbowR']]) {
      const tex = textured;
      if (sleeve === 'short') {
        add(arm, cap(S.arm, 0.18), skin, m4(0, -0.14, 0));
        add(arm, cyl(S.arm * 1.35, S.arm * 1.3, 0.14, 12), shirtTop, m4(0, -0.05, 0), tex);
      } else {
        add(arm, cap(S.arm * 1.08, 0.18), shirtTop, m4(0, -0.14, 0), tex);
      }
      if (sleeve === 'long') add(elbow, cap(S.fore * 1.12, 0.17), shirtTop, m4(0, -0.125, 0), tex);
      else if (sleeve === 'three') { add(elbow, cap(S.fore, 0.17), skin, m4(0, -0.125, 0)); add(elbow, cyl(S.fore * 1.4, S.fore * 1.35, 0.12, 12), shirtTop, m4(0, -0.05, 0), tex); }
      else if (sleeve === 'rolled') {
        add(elbow, cap(S.fore, 0.17), skin, m4(0, -0.125, 0));
        add(elbow, cyl(S.fore * 1.45, S.fore * 1.5, 0.07, 12), shirtTop, m4(0, -0.02, 0), tex); // rolled cuff
      } else add(elbow, cap(S.fore, 0.17), skin, m4(0, -0.125, 0));
      if (top === 'jacket') add(elbow, cyl(S.fore * 1.2, S.fore * 1.15, 0.04, 10), shade(topC, 0.8), m4(0, -0.23, 0));
      if (this.npc) add(elbow, sph(0.04, 10, 8), skin, m4(0, -0.31, 0.005, 0, 0, 0, 0.85, 1.55, 0.6)); // hand
      else {
        add(elbow, cap(S.fore * 0.82, 0.03, 6), skin, m4(0, -0.305, 0.0));                                             // the wrist
        // a hand hanging by the thigh: the palm faces the body, the back of the hand and the nails face out, the fingers curl in a little
        add(elbow, box(0.03, 0.086, 0.074), skin, m4(0, -0.352, 0.0));                                                 // the palm
        add(elbow, sph(0.0125, 6, 5), shade(skin, 0.97), m4(-side * 0.008, -0.372, 0.03, 0, 0, 0, 0.8, 1.2, 1.2));      // the ball of the thumb
        for (const [zz, ln, curl] of [[0.0265, 0.058, 0.2], [0.009, 0.066, 0.26], [-0.009, 0.06, 0.26], [-0.0265, 0.047, 0.22]]) {   // index, middle, ring, little finger
          add(elbow, cap(0.0082, ln - 0.016, 6), skin, m4(-side * Math.sin(curl) * ln * 0.5, -0.395 - ln / 2 + 0.018, zz, 0, 0, -side * curl));
          add(elbow, box(0.0035, 0.0075, 0.0095), '#e8cbbd', m4(-side * Math.sin(curl) * ln + side * 0.007, -0.395 - ln + 0.026, zz));   // the nail, on the back
        }
        add(elbow, cap(0.0095, 0.03, 6), skin, m4(-side * 0.01, -0.378, 0.048, -0.55, 0, -side * 0.2));                  // the thumb, forward and down
      }
      if (L.watch && side === 1) {
        add(elbow, cyl(S.fore * 1.05, S.fore * 1.05, 0.022, 14), '#141414', m4(0, -0.225, 0));
        add(elbow, cyl(0.016, 0.016, 0.008, 14), '#c9ccd0', m4(S.fore * 1.02, -0.225, 0, 0, 0, Math.PI / 2));
      }
    }

    // ---- legs & bottoms
    const bcol = botC;
    const fullPants = ['cargo', 'jeans', 'chinos', 'track', 'leggings'].includes(bottom);
    const skirt = bottom === 'skirt' || bottom === 'mekhela';
    const legScale = bottom === 'leggings' ? 0.92 : 1.0;
    add('hips', lathe([[-0.1, 0.16], [0.02, 0.165], [0.1, 0.16]], S.tw / 0.39, 0.62, 16), skirt ? bcol : bcol);
    if (top === 'formal' || top === 'kurta') add('hips', lathe([[0.075, 0.164], [0.105, 0.164]], S.tw / 0.39, 0.63, 16), '#1b1b1b'); // belt
    if (!this.npc && fullPants) {
      add('hips', lathe([[0.07, 0.1665], [0.098, 0.1665]], S.tw / 0.39, 0.625, 18), shade(bcol, 0.8));                                 // the waistband
      for (const s of [1, -1]) { add('hips', box(0.1, 0.11, 0.012), shade(bcol, 0.88), m4(s * 0.085, -0.02, -0.108 * 1.0)); add('hips', box(0.1, 0.012, 0.014), shade(bcol, 0.7), m4(s * 0.085, 0.028, -0.108)); }   // back pockets
      if (top !== 'formal' && top !== 'kurta') { add('hips', lathe([[0.075, 0.1675], [0.098, 0.1675]], S.tw / 0.39, 0.627, 18), '#2a1c12'); add('hips', box(0.04, 0.03, 0.01), '#c9ced3', m4(0, 0.086, S.td / 2 * 0.64)); }   // a leather belt and its buckle
    }
    for (const [side, leg, knee, ankle] of [[1, 'legL', 'kneeL', 'ankleL'], [-1, 'legR', 'kneeR', 'ankleR']]) {
      if (!this.npc && fullPants) { add(knee, cyl(S.shin * legScale * 1.16, S.shin * legScale * 1.22, 0.06, 12), shade(bcol, 0.88), m4(0, -0.39, 0)); add(knee, sph(S.shin * 1.05, 8, 6), bcol, m4(0, 0.0, 0.012, 0, 0, 0, 1, 0.8, 1)); }   // the cuff and the knee
      if (fullPants || bottom === 'shorts') add(leg, cap(S.thigh * legScale * (bottom === 'shorts' ? 1.12 : 1.02), 0.27), bcol, m4(0, bottom === 'shorts' ? -0.13 : -0.21, 0, 0, 0, 0, 1, bottom === 'shorts' ? 0.62 : 1, 1));
      if (bottom === 'shorts' || skirt) add(leg, cap(S.thigh * 0.95, 0.27), skin, m4(0, -0.21, 0));
      if (fullPants) add(knee, cap(S.shin * legScale * 1.08, 0.31), bcol, m4(0, -0.215, 0));
      else add(knee, cap(S.shin, 0.31), skin, m4(0, -0.215, 0));
      if (bottom === 'cargo') {
        add(leg, box(0.035, 0.13, 0.1), shade(bcol, 0.9), m4(side * (S.thigh + 0.012), -0.25, 0));   // side cargo pockets
        add(leg, box(0.037, 0.02, 0.105), shade(bcol, 0.8), m4(side * (S.thigh + 0.013), -0.185, 0));
      }
      if (bottom === 'jeans') add(leg, box(0.004, 0.36, 0.01), shade(bcol, 1.25), m4(side * S.thigh * 0.98, -0.21, 0));
      if (bottom === 'track') {
        add(leg, box(0.012, 0.4, 0.02), '#f2f0ea', m4(side * (S.thigh + 0.002), -0.21, 0));
        add(knee, box(0.012, 0.4, 0.02), '#f2f0ea', m4(side * (S.shin * 1.08 + 0.002), -0.21, 0));
      }
      this.buildShoe(add, L, ankle);
    }
    if (skirt) { // skirt hangs from the hips (legs animate inside)
      const len = 0.84;
      add('hips', lathe([[-len, 0.25], [-0.2, 0.21], [0.08, 0.168]], S.tw / 0.39, 0.72, 20), bcol);
      if (bottom === 'mekhela') {
        add('hips', lathe([[-len + 0.02, 0.2505], [-len + 0.09, 0.2505]], S.tw / 0.39, 0.725, 20), '#c89b3c');
        add('hips', lathe([[-len + 0.11, 0.2512], [-len + 0.13, 0.2512]], S.tw / 0.39, 0.725, 20), '#b3262f');
      }
    }
    if (L.backpack) {
      add('spine', box(0.3, 0.4, 0.15), L.backpackColor, m4(0, 0.2, -S.td / 2 - 0.075));
      add('spine', box(0.24, 0.1, 0.03), shade(L.backpackColor, 0.8), m4(0, 0.08, -S.td / 2 - 0.16));
      for (const s of [1, -1]) add('spine', box(0.035, 0.36, 0.015), shade(L.backpackColor, 0.7), m4(s * 0.1, 0.25, S.td / 2 * 1.04, -0.08, 0, 0));
    }
    // drone controller (only shown in drone mode)
    add('prop', box(0.18, 0.03, 0.1), '#2a2d31', m4(0, 0, 0));
    for (const s of [1, -1]) add('prop', cyl(0.012, 0.012, 0.04, 8), '#111', m4(s * 0.05, 0.03, 0));

    // ---- meshes per joint
    this.meshes = [];
    for (const [joint, pp] of Object.entries(parts)) {
      if (pp.plain.length) {
        const mesh = new THREE.Mesh(mergeParts(pp.plain), this.plainMat);
        mesh.castShadow = true; mesh.receiveShadow = !this.npc;
        J[joint].add(mesh); this.meshes.push(mesh);
      }
      if (pp.tex.length) {
        const mesh = new THREE.Mesh(mergeParts(pp.tex), this.texMat);
        mesh.castShadow = true; mesh.receiveShadow = true;
        J[joint].add(mesh); this.meshes.push(mesh);
      }
    }
    if (this.lensMesh) J.head.add(this.lensMesh);
    J.prop.visible = false;
    this.root.scale.setScalar(L.height / 1.75);
  }

  buildHair(add, L, hair, fs) {
    const st = L.hairStyle;
    if (st === 'bald') return;
    const capGeo = (r, theta) => new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, theta);
    const hm = (rx = -0.5) => m4(0, 0.004, -0.004, rx, 0, 0, fs[0], fs[1], fs[2]);
    if (st === 'buzz') { add('head', capGeo(0.1165, 1.5), mix(L.skin, hair, 0.7), hm(-0.45)); return; }
    const r = st === 'short' ? 0.1235 : 0.1225;
    add('head', capGeo(r, st === 'long' || st === 'ponytail' || st === 'bun' || st === 'braid' ? 1.62 : 1.48), hair, hm(-0.52));
    if (st === 'sideswept') {
      add('head', sph(1, 14, 10), hair, m4(0.008, 0.1, 0.015, 0.2, 0, -0.18, 0.1, 0.048, 0.118));
      add('head', sph(1, 12, 8), hair, m4(0.03, 0.09, 0.07, 0.5, 0.2, -0.35, 0.075, 0.035, 0.055));
      add('head', sph(1, 12, 8), hair, m4(-0.045, 0.085, 0.045, 0.3, 0, 0.25, 0.05, 0.03, 0.06));
    }
    if (st === 'spiky') {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        add('head', new THREE.ConeGeometry(0.025, 0.07, 5), hair, m4(Math.cos(a) * 0.05, 0.115, Math.sin(a) * 0.05 + 0.01, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5));
      }
      add('head', new THREE.ConeGeometry(0.03, 0.08, 5), hair, m4(0, 0.13, 0.01));
    }
    if (st === 'curly') {
      const rnd = mulberry32(8);
      for (let k = 0; k < 26; k++) {
        const th = rnd() * 1.3, ph = rnd() * Math.PI * 2;
        const x = Math.sin(th) * Math.cos(ph) * 0.12 * fs[0], y = Math.cos(th) * 0.12 * fs[1] + 0.005, z = Math.sin(th) * Math.sin(ph) * 0.12 * fs[2] - 0.01;
        add('head', sph(0.032, 8, 6), hair, m4(x, y, z));
      }
    }
    if (st === 'long') {
      add('head', box(0.2, 0.34, 0.05), hair, m4(0, -0.13, -0.08, 0.12, 0, 0));
      for (const s of [1, -1]) add('head', box(0.03, 0.26, 0.09), hair, m4(s * 0.105, -0.09, -0.01));
    }
    if (st === 'ponytail') {
      add('head', sph(0.035, 10, 8), hair, m4(0, 0.03, -0.125));
      add('head', cap(0.03, 0.2, 8), hair, m4(0, -0.1, -0.15, 0.25, 0, 0));
    }
    if (st === 'bun') add('head', sph(0.055, 12, 10), hair, m4(0, 0.05, -0.12));
    if (st === 'braid') for (let k = 0; k < 7; k++) add('head', sph(0.028 - k * 0.0015, 8, 6), hair, m4(0, -0.02 - k * 0.045, -0.13 - k * 0.006));
  }

  buildGlasses(add, L, fz) {
    const c = L.glassesColor, zf = fz + 0.012;
    const lensW = 0.05, lensH = 0.032, t = 0.006;
    for (const s of [1, -1]) {
      const cx = s * 0.043, cy = 0.02;
      if (L.glasses === 'round') {
        add('head', new THREE.TorusGeometry(0.022, 0.0035, 6, 18), c, m4(cx, cy, zf));
      } else {
        add('head', box(lensW + t, t, t), c, m4(cx, cy + lensH / 2, zf));
        add('head', box(lensW + t, t * 0.8, t), c, m4(cx, cy - lensH / 2, zf));
        add('head', box(t, lensH, t), c, m4(cx - lensW / 2, cy, zf));
        add('head', box(t, lensH, t), c, m4(cx + lensW / 2, cy, zf));
      }
      add('head', tube(new THREE.Vector3(s * 0.07, cy + 0.01, zf - 0.004), new THREE.Vector3(s * 0.108, cy + 0.012, -0.01), 0.0028, 4), c);
    }
    add('head', box(0.02, 0.005, 0.005), c, m4(0, 0.03, zf + 0.002));
    const dark = L.glasses === 'sunglasses';
    const lensMat = new THREE.MeshPhysicalMaterial({ color: dark ? 0x101418 : 0xd8ecf2, transparent: true, opacity: dark ? 0.92 : 0.16, roughness: 0.05, metalness: 0.1 });
    const lg = [];
    for (const s of [1, -1]) {
      const g = L.glasses === 'round' ? new THREE.CircleGeometry(0.021, 18) : new THREE.PlaneGeometry(lensW, lensH);
      g.translate(s * 0.043, 0.02, zf);
      lg.push(g);
    }
    const merged = mergeParts(lg.map((g) => ({ geometry: g, color: '#ffffff' })));
    this.lensMesh = new THREE.Mesh(merged, lensMat);
  }

  buildShoe(add, L, ankle) {
    const c = L.shoesColor, sole = L.shoes === 'formal' ? '#101010' : '#f2f0ea';
    const skin = L.skin;
    switch (L.shoes) {
      case 'sandals':
      case 'chappal':
        add(ankle, box(0.085, 0.045, 0.21), skin, m4(0, -0.055, 0.04));
        add(ankle, box(0.1, 0.018, 0.25), L.shoes === 'chappal' ? c : shade(c, 0.9), m4(0, -0.085, 0.04));
        if (L.shoes === 'chappal') {
          add(ankle, box(0.012, 0.012, 0.09), c, m4(0.025, -0.06, 0.09, 0, 0.5, 0));
          add(ankle, box(0.012, 0.012, 0.09), c, m4(-0.025, -0.06, 0.09, 0, -0.5, 0));
        } else {
          add(ankle, box(0.104, 0.02, 0.025), c, m4(0, -0.05, 0.1));
          add(ankle, box(0.104, 0.02, 0.025), c, m4(0, -0.04, -0.02));
        }
        break;
      case 'boots':
        add(ankle, cyl(0.06, 0.065, 0.14, 12), c, m4(0, -0.01, 0));
        add(ankle, cap(0.05, 0.16, 8), c, m4(0, -0.055, 0.045, Math.PI / 2, 0, 0, 1.05, 1, 0.9));
        add(ankle, box(0.11, 0.025, 0.27), '#2a2016', m4(0, -0.09, 0.045));
        break;
      case 'formal':
        add(ankle, cap(0.045, 0.17, 8), c, m4(0, -0.06, 0.045, Math.PI / 2, 0, 0, 1.0, 1, 0.75));
        add(ankle, box(0.095, 0.015, 0.26), sole, m4(0, -0.087, 0.045));
        break;
      default: { // sneakers / running
        add(ankle, cap(0.052, 0.16, 8), c, m4(0, -0.05, 0.045, Math.PI / 2, 0, 0, 1.05, 1, 0.9));
        add(ankle, box(0.108, 0.03, 0.27), sole, m4(0, -0.083, 0.045));
        const accent = L.shoes === 'running' ? '#e2562f' : shade(c, 0.6);
        for (const s of [1, -1]) add(ankle, box(0.004, 0.025, 0.09), accent, m4(s * 0.054, -0.05, 0.04, 0, 0, 0));
        add(ankle, box(0.05, 0.004, 0.08), '#f2f0ea', m4(0, -0.004, 0.07, -0.25, 0, 0)); // laces
        if (!this.npc) {
          add(ankle, sph(0.045, 10, 8), shade(c, 0.93), m4(0, -0.062, 0.135, 0, 0, 0, 1.12, 0.7, 1.0));                  // the toe cap
          add(ankle, box(0.052, 0.07, 0.014), shade(c, 1.06), m4(0, -0.012, 0.062, -0.55, 0, 0));                         // the tongue
          add(ankle, box(0.092, 0.05, 0.022), shade(c, 0.85), m4(0, -0.05, -0.062));                                      // the heel counter
          for (let k = 0; k < 3; k++) add(ankle, box(0.05, 0.004, 0.006), '#f7f5f0', m4(0, -0.012 - k * 0.012, 0.082 + k * 0.024, -0.5, 0, 0));   // the lace rows
          add(ankle, box(0.112, 0.014, 0.275), shade(sole, 0.92), m4(0, -0.0955, 0.045));                                 // the midsole under it
          add(ankle, box(0.106, 0.008, 0.14), '#3a3a3a', m4(0, -0.1055, 0.095));                                          // the tread
        }
      }
    }
  }

  // ------------------------------------------------------------------ animation
  /**
   * pose: { type: idle|walk|run|jump|fly|swim|bike|drone|sit, speed, bike?, dt }
   */
  animate(pose, dt) {
    const J = this.J, c = this.cur, P = this.pose;
    P.t += dt;
    const t = P.t;
    const targ = {
      hipsY: 0.97, hipsX: 0, hipsZ: 0, spineX: 0.02, spineY: 0, legL: 0, legR: 0, kneeL: 0.05, kneeR: 0.05,
      armLx: 0.05, armRx: 0.05, armLz: 0.08, armRz: -0.08, elbowL: -0.12, elbowR: -0.12, headX: 0, legLz: 0, legRz: 0,
    };
    let lam = 12;
    J.prop.visible = pose.type === 'drone';
    const sp = pose.speed || 0;
    if (pose.type === 'walk' || pose.type === 'run') {
      const run = pose.type === 'run';
      const stride = run ? 2.3 : 1.35;
      P.phase += (sp * dt / stride) * Math.PI * 2;
      const A = run ? 0.72 : 0.42 * clamp(sp / 1.6, 0.4, 1.2);
      const s = Math.sin(P.phase);
      targ.legL = -s * A; targ.legR = s * A;
      targ.kneeL = 0.08 + Math.max(0, Math.cos(P.phase)) * (run ? 1.35 : 0.65);
      targ.kneeR = 0.08 + Math.max(0, -Math.cos(P.phase)) * (run ? 1.35 : 0.65);
      targ.armLx = s * A * 0.85; targ.armRx = -s * A * 0.85;
      targ.elbowL = targ.elbowR = run ? -1.25 : -0.3;
      targ.hipsY = 0.97 - (run ? 0.03 : 0.01) + Math.abs(Math.cos(P.phase)) * (run ? 0.045 : 0.025);
      targ.spineX = run ? 0.22 : 0.06;
      targ.spineY = s * (run ? 0.18 : 0.1);
      lam = 20;
    } else if (pose.type === 'idle') {
      const b = Math.sin(t * 1.6);
      targ.spineX = 0.02 + b * 0.012;
      targ.armLz = 0.09 + b * 0.01; targ.armRz = -0.09 - b * 0.01;
      targ.headX = Math.sin(t * 0.37) * 0.04;
      targ.legLz = 0.03; targ.legRz = -0.03;
    } else if (pose.type === 'jump') {
      targ.legL = -0.5; targ.kneeL = 0.9; targ.legR = 0.2; targ.kneeR = 0.4;
      targ.armLx = -0.6; targ.armRx = -0.5; targ.armLz = 0.5; targ.armRz = -0.5; targ.elbowL = targ.elbowR = -0.6;
    } else if (pose.type === 'fly') {
      const k = clamp(sp / 20, 0, 1);
      targ.hipsX = 0.35 + k * 0.95;
      targ.armLx = -0.4 - k * 2.5; targ.armRx = -0.4 - k * 1.0; targ.armLz = 0.25; targ.armRz = -0.35 - (1 - k) * 0.3;
      targ.elbowL = -0.1; targ.elbowR = -0.4;
      targ.legL = 0.05 + Math.sin(t * 3) * 0.05; targ.legR = 0.12 - Math.sin(t * 3) * 0.05; targ.kneeL = 0.2; targ.kneeR = 0.35;
      targ.headX = -k * 0.9;
    } else if (pose.type === 'swim') {
      // front crawl: each arm pulls under the water (overhead -> hip), then recovers out to the side
      P.phase += dt * (2.4 + Math.min(1.5, sp * 0.6));
      const stroke = (ph) => {
        const u = ((ph % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (u < Math.PI) { const k = u / Math.PI; return { x: -3.0 + k * 3.0, z: 0.1, e: -0.35 - Math.sin(k * Math.PI) * 0.5 }; }
        const k = (u - Math.PI) / Math.PI;
        return { x: -k * 3.0, z: Math.sin(k * Math.PI) * 1.25, e: -1.25 * Math.sin(k * Math.PI) - 0.2 };
      };
      const Ls = stroke(P.phase), Rs = stroke(P.phase + Math.PI);
      targ.hipsX = 1.42; targ.hipsY = 0.18; targ.headX = -0.9;
      targ.armLx = Ls.x; targ.armLz = Ls.z; targ.elbowL = Ls.e;
      targ.armRx = Rs.x; targ.armRz = -Rs.z; targ.elbowR = Rs.e;
      targ.spineY = Math.sin(P.phase) * 0.35;
      const kick = Math.sin(t * 9);
      targ.legL = kick * 0.3; targ.legR = -kick * 0.3; targ.kneeL = 0.15 + Math.max(0, kick) * 0.35; targ.kneeR = 0.15 + Math.max(0, -kick) * 0.35;
      this.strokePhase = P.phase;
      lam = 40;
    } else if (pose.type === 'tread') {
      // treading water: upright, head above the surface, arms sculling, legs cycling
      // (the shoulders just under the surface: the arms scull below it, only the head and neck are out)
      const k = Math.sin(t * 3.2), sc = Math.sin(t * 2.6);
      targ.hipsX = 0.12; targ.armLz = 0.62 + k * 0.12; targ.armRz = -0.62 - k * 0.12; targ.armLx = -0.55 + sc * 0.35; targ.armRx = -0.55 - sc * 0.35; targ.elbowL = targ.elbowR = -0.75;
      targ.legL = -0.4 + k * 0.45; targ.legR = -0.4 - k * 0.45; targ.kneeL = 0.9 - k * 0.5; targ.kneeR = 0.9 + k * 0.5; targ.headX = -0.1;
      lam = 18;
    } else if (pose.type === 'sitg') {
      targ.hipsY = 0.2; targ.legL = targ.legR = -1.35; targ.legLz = 0.95; targ.legRz = -0.95; targ.kneeL = targ.kneeR = 2.4;
      targ.armLx = targ.armRx = -0.45; targ.elbowL = targ.elbowR = -0.9; targ.spineX = 0.1; targ.headX = Math.sin(t * 0.4) * 0.1;
    } else if (pose.type === 'feed') {
      targ.hipsY = 0.55; targ.legL = targ.legR = -1.3; targ.kneeL = targ.kneeR = 2.1; targ.spineX = 0.5;
      targ.armRx = -1.1 + Math.sin(t * 1.5) * 0.1; targ.elbowR = -0.3; targ.armLx = -0.4; targ.elbowL = -1.0;
    } else if (pose.type === 'drone') {
      targ.armLx = -0.95; targ.armRx = -0.95; targ.armLz = -0.28; targ.armRz = 0.28; targ.elbowL = targ.elbowR = -1.0;
      targ.headX = pose.look ?? -0.2;
    } else if (pose.type === 'bike' && pose.bike) {
      this.bikePose(pose.bike, targ);
      lam = 40;
    } else if (pose.type === 'scooterRide') {
      targ.hipsY = 0.92 / this.root.scale.x; targ.spineX = 0.06;
      targ.legL = targ.legR = -1.2; targ.kneeL = targ.kneeR = 1.35;
      targ.armLx = targ.armRx = -1.05; targ.armLz = 0.12; targ.armRz = -0.12; targ.elbowL = targ.elbowR = -0.45;
      targ.legLz = 0.12; targ.legRz = -0.12;
    } else if (['sit', 'eat', 'study', 'type', 'sitchat'].includes(pose.type)) {
      targ.hipsY = 0.55; targ.legL = targ.legR = -1.5; targ.kneeL = targ.kneeR = 1.5;
      targ.armLx = targ.armRx = -0.5; targ.elbowL = targ.elbowR = -0.9;
      if (pose.type === 'eat') { const k = Math.max(0, Math.sin(t * 1.4)); targ.armRx = -0.9; targ.elbowR = -0.7 - k * 1.45; targ.armLx = -0.55; targ.elbowL = -0.9; targ.spineX = 0.14; targ.headX = 0.2 - k * 0.15; }
      if (pose.type === 'study') { targ.spineX = 0.3; targ.headX = 0.45; targ.armLx = -0.75; targ.armRx = -0.7; targ.elbowL = -0.95; targ.elbowR = -1.0 + Math.sin(t * 5) * 0.06; }
      if (pose.type === 'type') { targ.spineX = 0.16; targ.headX = 0.3; targ.armLx = targ.armRx = -0.8; targ.elbowL = -1.05 + Math.sin(t * 14) * 0.05; targ.elbowR = -1.05 + Math.sin(t * 13 + 1) * 0.05; }
    } else if (pose.type === 'lab') {
      const k = Math.sin(t * 1.6);
      targ.armLx = -0.85; targ.armRx = -1.0 + k * 0.12; targ.elbowL = -1.0; targ.elbowR = -1.2; targ.spineX = 0.14; targ.headX = 0.4;
    } else if (pose.type === 'lift') {
      const k = 0.5 + 0.5 * Math.sin(t * 5);
      targ.armLx = targ.armRx = -0.2; targ.elbowL = targ.elbowR = -0.3 - k * 2.1; targ.armLz = 0.25; targ.armRz = -0.25;
    } else if (pose.type === 'dance') {
      const b = t * (pose.speed || 2) * Math.PI, s = Math.sin(b), c = Math.cos(b);
      targ.hipsY = 0.95 + Math.abs(s) * 0.06; targ.spineY = s * 0.3;
      targ.legL = -Math.max(0, s) * 0.6; targ.kneeL = Math.max(0, s) * 0.9; targ.legR = -Math.max(0, -s) * 0.6; targ.kneeR = Math.max(0, -s) * 0.9;
      targ.armLz = 1.9 + s * 0.5; targ.armRz = -1.9 + s * 0.5; targ.elbowL = targ.elbowR = -0.9 - c * 0.4;
      lam = 18;
    } else if (pose.type === 'clap' || pose.type === 'cheer' || pose.type === 'wave') {
      if (pose.type === 'clap') { targ.armLx = targ.armRx = -1.15; targ.armLz = -0.32; targ.armRz = 0.32; targ.elbowL = targ.elbowR = -1.0 + Math.sin(t * 10) * 0.22; }
      if (pose.type === 'cheer') { const w = Math.sin(t * 8); targ.armLz = 2.55 + w * 0.25; targ.armRz = -2.55 + w * 0.25; targ.elbowL = targ.elbowR = -0.25; targ.hipsY = 0.97 + Math.max(0, Math.sin(t * 5)) * 0.1; }
      if (pose.type === 'wave') { targ.armRz = -2.55 + Math.sin(t * 9) * 0.35; targ.elbowR = -0.3; }
      lam = 18;
    } else if (pose.type === 'camera') {
      targ.armLx = -1.2; targ.armRx = -1.25; targ.armLz = -0.35; targ.armRz = 0.25; targ.elbowL = -1.55; targ.elbowR = -1.6; targ.headX = 0.05 + (pose.look || 0);
    } else if (pose.type === 'row') {
      const k = Math.sin(t * 2.6);
      targ.hipsY = 0.42; targ.legL = targ.legR = -1.25; targ.kneeL = targ.kneeR = 1.2; targ.spineX = 0.2 + k * 0.35;
      targ.armLx = targ.armRx = -1.2 + k * 0.2; targ.armLz = 0.35; targ.armRz = -0.35; targ.elbowL = targ.elbowR = -0.6 - k * 0.5;
    } else if (pose.type === 'bat') {
      const k = pose.swing || 0, back = Math.max(0, Math.min(1, k / 0.35)) * (k < 0.6 ? 1 : 0), fol = Math.max(0, (k - 0.45) / 0.55);
      targ.hipsY = 0.9; targ.kneeL = targ.kneeR = 0.35; targ.legL = targ.legR = -0.15; targ.spineX = 0.35; targ.headX = 0.3;
      targ.armLx = targ.armRx = -0.55 - back * 1.4 - fol * 1.2; targ.armLz = -0.45; targ.armRz = 0.25; targ.elbowL = targ.elbowR = -0.35 - back * 0.6;
      targ.spineY = -0.5 - back * 0.3 + fol * 1.6;
      lam = 30;
    } else if (pose.type === 'kick') {
      const k = pose.kick || 0;
      targ.legR = 0.6 - Math.sin(k * Math.PI) * 1.9; targ.kneeR = 0.8 * (1 - k); targ.armLx = -0.6 * k; targ.armRx = 0.6 * k; targ.armLz = 0.5; lam = 30;
    } else if (pose.type === 'shoot') {
      const k = pose.shot || 0;
      targ.hipsY = 0.9 + Math.sin(k * Math.PI) * 0.28; targ.kneeL = targ.kneeR = 0.6 * (1 - k);
      targ.armLx = targ.armRx = -1.3 - k * 1.6; targ.armLz = 0.15; targ.armRz = -0.15; targ.elbowL = targ.elbowR = -1.6 + k * 1.4; lam = 30;
    }
    // carrying a plate (or a tray) in both hands in front of the chest
    if (pose.carry && (pose.type === 'walk' || pose.type === 'idle' || pose.type === 'run')) { targ.armLx = targ.armRx = -0.45; targ.armLz = 0.04; targ.armRz = -0.04; targ.elbowL = targ.elbowR = -1.25; targ.spineX -= 0.02; }   // upper arms down, forearms level: hands at the plate's rim, chest high
    for (const k in targ) c[k] = c[k] === undefined ? targ[k] : damp(c[k], targ[k], lam, dt);
    J.hips.position.y = c.hipsY;
    if (pose.type === 'bike' && pose.bike) { J.hips.position.z = this.bikeHipZ; J.hips.position.y = this.bikeHipY; } else J.hips.position.z = 0;
    J.hips.rotation.x = c.hipsX;
    J.spine.rotation.x = c.spineX; J.spine.rotation.y = c.spineY;
    J.legL.rotation.x = c.legL; J.legR.rotation.x = c.legR; J.legL.rotation.z = c.legLz; J.legR.rotation.z = c.legRz;
    J.kneeL.rotation.x = c.kneeL; J.kneeR.rotation.x = c.kneeR;
    J.armL.rotation.x = c.armLx; J.armR.rotation.x = c.armRx; J.armL.rotation.z = c.armLz; J.armR.rotation.z = c.armRz;
    J.elbowL.rotation.x = c.elbowL; J.elbowR.rotation.x = c.elbowR;
    J.head.rotation.x = c.headX;
  }

  /** Seat the rider on a bicycle and solve leg IK to the pedals. */
  bikePose(bike, targ) {
    const s = this.root.scale.x;
    const hipY = (bike.seat.y + 0.06) / s, hipZ = (bike.seat.z + 0.04) / s;
    this.bikeHipY = hipY; this.bikeHipZ = hipZ;
    targ.hipsY = hipY;
    targ.spineX = bike.style === 'roadster' ? 0.18 : 0.42;
    const a = 0.42, b = 0.43;
    for (const [side, leg, knee] of [[1, 'legL', 'kneeL'], [-1, 'legR', 'kneeR']]) {
      const p = bike.pedalPos(side);
      const hy = hipY - 0.03, hz = hipZ;
      const fy = p.y / s + 0.1, fz = p.z / s - 0.03;
      let dy = fy - hy, dz = fz - hz;
      let d = Math.hypot(dy, dz);
      const maxd = a + b - 0.005;
      if (d > maxd) { dy *= maxd / d; dz *= maxd / d; d = maxd; }
      const phi = Math.atan2(dz, -dy);                 // forward angle of hip->foot from straight down
      const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
      const beta = Math.PI - Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
      targ[leg] = -(phi + alpha);
      targ[knee] = beta;
    }
    targ.armLx = targ.armRx = bike.style === 'roadster' ? -0.95 : -1.05;
    targ.armLz = -0.05; targ.armRz = 0.05;
    targ.elbowL = targ.elbowR = -0.35;
    targ.headX = -0.3;
  }
}

/** Random student look for NPCs. */
export function randomLook(rnd) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const fem = rnd() < 0.38;
  const skins = OPTIONS.skin.slice(1, 7);
  const cols = ['#f2f0ea', '#1c1c1c', '#2b3a55', '#3f6fb0', '#8fb4d8', '#b3262f', '#5b7f3a', '#6b3d5e', '#e38aa0', '#f0c24b', '#8d9091', '#c86b3c', '#2f5d5a'];
  const L = {
    body: fem ? 'female' : 'male', build: pick(['slim', 'slim', 'average', 'average', 'broad']),
    height: fem ? 1.52 + rnd() * 0.16 : 1.64 + rnd() * 0.18,
    skin: pick(skins), face: pick(['oval', 'round', 'square', 'long']),
    facialHair: fem ? 'none' : pick(['none', 'none', 'stubble', 'beard', 'mustache', 'fullbeard']),
    hairStyle: fem ? pick(['long', 'ponytail', 'bun', 'braid', 'long']) : pick(['short', 'sideswept', 'buzz', 'curly', 'spiky', 'short']),
    hairColor: pick(['#15110e', '#15110e', '#2e1f16', '#4a3020']),
    glasses: rnd() < 0.35 ? 'rect' : 'none',
    top: fem ? pick(['kurti', 'kurti', 'tshirt', 'hoodie', 'plaid', 'formal']) : pick(['tshirt', 'tshirt', 'tshirt', 'plaid', 'polo', 'formal', 'hoodie', 'kurta']),
    topColor: pick(cols), topColor2: '#2c2e32',
    bottom: fem ? pick(['leggings', 'jeans', 'jeans', 'track', 'skirt']) : pick(['jeans', 'jeans', 'track', 'track', 'shorts', 'cargo', 'chinos']),
    bottomColor: pick(['#2b3a55', '#3f6fb0', '#1c1c1c', '#5a5a5a', '#857e66', '#f2f0ea']),
    shoes: pick(['sneakers', 'sneakers', 'chappal', 'chappal', 'sandals', 'running']),
    shoesColor: pick(['#f2f0ea', '#1c1c1c', '#bcc3ca', '#3f6fb0', '#5a4632']),
    watch: rnd() < 0.4, backpack: rnd() < 0.45, backpackColor: pick(['#2b3a4a', '#1c1c1c', '#b3262f', '#5b7f3a', '#6b3d5e']),
    cap: rnd() < 0.08, capColor: pick(cols), headphones: rnd() < 0.08,
  };
  if (L.top === 'kurti' && L.bottom === 'jeans' && rnd() < 0.5) L.bottom = 'leggings';
  return L;
}

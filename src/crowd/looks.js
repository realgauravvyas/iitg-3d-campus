// Colour palette + random appearances for the GPU crowd. Every person is described by
// palette indices (so thousands of people cost a few floats each) and option bits.
import * as THREE from 'three';

export const OPT = {
  LONGHAIR: 1, SHORTHAIR: 2, BUN: 3, SKIRT: 4, BACKPACK: 5, UMBRELLA: 6, PLATE: 7, BOOK: 8, PHONE: 9, BAT: 10,
  CUP: 11, GLASSES: 12, CAP: 13, BEARD: 14, GUITAR: 15, DHOL: 16, FLAG: 17, DUPATTA: 18, APRON: 19, LANYARD: 20,
  GOWN: 21, MORTAR: 22, CAMERA: 23, BALL: 24,
};
export const bit = (o) => 1 << (o - 1);
export const FLAG = { FEMALE: 1, LONGSLEEVE: 2, SHORTS: 4, JERSEY: 8, OLD: 16, HOOD: 32, BROOM: 1024, RAKE: 2048 };   // bits 6-9: chest print 1..10; 10-11: sweeper's broom / gardener's rake

const HEX = [];
const INDEX = new Map();
export function pal(hex) {
  hex = hex.toLowerCase();
  if (!INDEX.has(hex)) { INDEX.set(hex, HEX.length); HEX.push(hex); }
  return INDEX.get(hex);
}

export const SKINS = ['#f1d4be', '#e5bc9a', '#d6a37f', '#c48f6a', '#b88061', '#ab7150', '#8e5b3e', '#6d4531'].map(pal);
export const HAIRS = ['#15110e', '#15110e', '#15110e', '#1f1712', '#2e1f16', '#2e1f16', '#4a3020', '#5a3a26', '#6b2a2a', '#8a5a2b', '#8a8a8a'].map(pal);
export const GREY_HAIR = pal('#b9b6b0');
const TOPS = ['#f2f0ea', '#1c1c1c', '#2b3a55', '#3f6fb0', '#8fb4d8', '#b3262f', '#5b7f3a', '#6b3d5e', '#e38aa0', '#f0c24b',
  '#8d9091', '#c86b3c', '#2f5d5a', '#d9d4c7', '#7a8fa6', '#a33b52', '#e6e1d3', '#46505c', '#c9a24a', '#5f7f9e'].map(pal);
const KURTI = ['#2f5d5a', '#b3262f', '#e38aa0', '#f0c24b', '#6b3d5e', '#3f6fb0', '#c86b3c', '#efe3c2'].map(pal);
const BOTTOMS = ['#2b3a55', '#3f6fb0', '#1c1c1c', '#5a5a5a', '#857e66', '#2d3440', '#394b6e', '#6e6a5e'].map(pal);
const LEGGINGS = ['#f2f0ea', '#1c1c1c', '#efe3c2', '#2b3a55'].map(pal);
const LOWERS = ['#1c1c1c', '#2d3440', '#3a3a3a', '#1f2a44', '#46505c', '#2b3a55'].map(pal);   // track pants
const SHOES = ['#f2f0ea', '#1c1c1c', '#bcc3ca', '#3f6fb0', '#5a4632', '#8a8f96'].map(pal);
const BAGS = ['#2b3a4a', '#1c1c1c', '#b3262f', '#5b7f3a', '#6b3d5e', '#46505c'].map(pal);
export const PROPS = { umbrella: ['#1c1c1c', '#2b3a55', '#b3262f', '#3f6fb0', '#6b3d5e'].map(pal), book: ['#7d1f1f', '#1f3a5f', '#2e4a2a', '#c89b3c'].map(pal) };
export const C = {
  white: pal('#f2f0ea'), black: pal('#1c1c1c'), khaki: pal('#9b8f6a'), navy: pal('#1f2a44'), grey: pal('#8d9091'),
  red: pal('#b3262f'), gold: pal('#c89b3c'), green: pal('#2e7d4f'), orange: pal('#e2702f'), sky: pal('#4f93c9'),
  maroon: pal('#6e1f2a'), teal: pal('#1f6f6a'), cream: pal('#efe3c2'), steel: pal('#c7ccd1'), purple: pal('#5b2d7a'),
  yellow: pal('#f2c12e'), ball: pal('#d9661f'), guard: pal('#4b5a3a'),
};

// hostel colours (flags, jerseys) - fictional house colours for inter-hostel events
export const HOSTEL_COLORS = {
  brahmaputra: '#1f4fa0', lohit: '#b3262f', dihing: '#2e7d4f', manas: '#e2702f', umiam: '#5b2d7a', barak: '#f2c12e',
  kameng: '#1f6f6a', gaurang: '#c2185b', siang: '#6d4c41', kapili: '#0097a7', dibang: '#7cb342', disang: '#3949ab',
  subansiri: '#d81b60', dhansiri: '#00897b', msh: '#757575',
};

const pick = (r, a) => a[Math.floor(r() * a.length)];

/** A random student. */
export function studentLook(r, { female = r() < 0.36 } = {}) {
  let opts = 0, flags = female ? FLAG.FEMALE : 0;
  const top = female && r() < 0.45 ? pick(r, KURTI) : pick(r, TOPS);
  if (female) {
    opts |= bit(r() < 0.55 ? OPT.LONGHAIR : OPT.BUN);
    if (r() < 0.18) opts |= bit(OPT.SKIRT);
    if (KURTI.includes(top) && r() < 0.5) opts |= bit(OPT.DUPATTA);
    if (!KURTI.includes(top) && r() < 0.14) flags |= FLAG.SHORTS;
  } else {
    opts |= bit(OPT.SHORTHAIR);
    if (r() < 0.42) opts |= bit(OPT.BEARD);
    if (r() < 0.45) flags |= FLAG.SHORTS;          // campus uniform: shorts or track pants ("lowers")
  }
  if (r() < 0.3) flags |= FLAG.LONGSLEEVE;
  if (r() < 0.34) opts |= bit(OPT.GLASSES);
  if (r() < 0.4) opts |= bit(OPT.BACKPACK);
  if (r() < 0.06) opts |= bit(OPT.CAP);
  const bottom = female && KURTI.includes(top) && r() < 0.6 ? pick(r, LEGGINGS) : r() < 0.55 ? pick(r, LOWERS) : pick(r, BOTTOMS);
  // printed tees: IITG, IIT GUWAHATI, the emblem, GUWAHATI, fest tees, batch tees
  if (!(female && KURTI.includes(top)) && r() < 0.45) flags |= [1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10][Math.floor(r() * 13)] << 6;
  return {
    scale: female ? 0.84 + r() * 0.14 : 0.9 + r() * 0.17,
    opts, flags, variant: r(), hoodie: r() < 0.55,
    col0: [pick(r, SKINS), top, pick(r, TOPS), bottom],
    col1: [pick(r, HAIRS), pick(r, SHOES), pick(r, BAGS), pick(r, PROPS.umbrella)],
  };
}

/** Faculty, staff, parents and other grown-ups. */
export function adultLook(r, role = 'faculty') {
  const female = r() < (role === 'guard' ? 0.05 : 0.35);
  const L = studentLook(r, { female });
  L.opts &= ~(bit(OPT.BACKPACK) | bit(OPT.CAP));
  L.flags &= 63; L.flags &= ~FLAG.SHORTS; L.hoodie = false;
  L.scale += 0.02;
  if (role === 'faculty' || role === 'parent' || role === 'guest') {
    L.flags |= FLAG.LONGSLEEVE;
    L.col0[1] = pick(r, [C.white, C.cream, pal('#dfe6ee'), pal('#c9d3dd'), C.grey, pal('#e8d9c0')]);
    L.col0[3] = pick(r, [C.black, C.navy, pal('#3a3a3a'), C.khaki]);
    if (r() < 0.5) L.col1[0] = GREY_HAIR;
    if (role !== 'faculty' || r() < 0.3) L.flags |= FLAG.OLD;
    L.opts |= r() < 0.6 ? bit(OPT.GLASSES) : 0;
    L.opts &= ~bit(OPT.SKIRT);
  }
  if (role === 'guard') { L.col0[1] = C.guard; L.col0[3] = C.guard; L.col1[1] = C.black; L.opts |= bit(OPT.CAP); L.col1[2] = C.guard; L.flags |= FLAG.LONGSLEEVE; }
  if (role === 'mess') { L.col0[1] = C.white; L.col0[3] = pal('#3a3a3a'); L.opts |= bit(OPT.APRON) | bit(OPT.CAP); L.col1[2] = C.white; }
  if (role === 'staff') { L.col0[1] = pal('#6a7b8c'); L.col0[3] = pal('#4a4a4a'); }
  return L;
}

/** Team kit for a sport (jersey colour + shorts). */
export function kit(r, colorIdx, { shorts = true, female = false } = {}) {
  const L = studentLook(r, { female });
  L.col0[1] = colorIdx; L.col0[2] = C.white;
  L.col0[3] = shorts ? C.black : C.white;
  if (shorts) L.flags |= FLAG.SHORTS;
  L.flags |= FLAG.JERSEY;
  L.flags &= ~FLAG.LONGSLEEVE; L.flags &= 63; L.hoodie = false;
  L.opts &= ~(bit(OPT.BACKPACK) | bit(OPT.SKIRT) | bit(OPT.DUPATTA) | bit(OPT.GLASSES));
  L.col1[1] = C.white;
  return L;
}

/** Swimwear for the pool: men in swim trunks (bare chest, arms and legs), women in a one-piece;
 *  everyone in a swim cap and goggles, barefoot. */
export function swimLook(r, { female = r() < 0.4 } = {}) {
  const skin = pick(r, SKINS);
  const suit = pick(r, [C.navy, C.black, C.red, C.teal, pal('#3f6fb0'), C.purple, pal('#0097a7')]);
  const capCol = pick(r, [C.white, C.red, C.sky, C.yellow, C.black, pal('#f06292')]);
  return {
    scale: female ? 0.86 + r() * 0.12 : 0.92 + r() * 0.15,
    opts: bit(OPT.GLASSES) | bit(female ? OPT.BUN : OPT.SHORTHAIR),        // goggles; the hair tucked under the cap
    flags: (female ? FLAG.FEMALE : 0) | FLAG.SHORTS,
    variant: r(), hoodie: false,
    col0: [skin, female ? suit : skin, female ? suit : skin, suit],
    col1: [capCol, skin, C.black, C.black],
  };
}

export function withProp(L, ...opts) { const o = { ...L, col0: [...L.col0], col1: [...L.col1] }; for (const p of opts) o.opts |= bit(p); return o; }

/** Linear-space palette texture for the shader (rebuilt when new colours are registered). */
export function paletteTexture(tex) {
  const N = 256;
  const data = tex?.image.data || new Float32Array(N * 4);
  const c = new THREE.Color();
  HEX.forEach((h, i) => { c.set(h); data[i * 4] = c.r; data[i * 4 + 1] = c.g; data[i * 4 + 2] = c.b; data[i * 4 + 3] = 1; });
  if (tex) { tex.needsUpdate = true; return tex; }
  const t = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  t.userData.count = HEX.length;
  return t;
}
export const paletteSize = () => HEX.length;

/** Kendriya Vidyalaya pupil in uniform: white shirt, navy shorts / pinafore, school bag. */
export function kidLook(r, { female = r() < 0.48, uniform = true } = {}) {
  const L = studentLook(r, { female });
  L.scale = 0.52 + r() * 0.16;
  L.opts &= ~(bit(OPT.BEARD) | bit(OPT.GLASSES) | bit(OPT.DUPATTA) | bit(OPT.CAP) | bit(OPT.SKIRT));
  if (r() < 0.1) L.opts |= bit(OPT.GLASSES);
  if (uniform) {
    L.col0[1] = C.white; L.col0[2] = C.navy; L.col0[3] = C.navy;
    L.col1[1] = C.black; L.col1[2] = pick(r, [C.navy, C.red, pal('#2b3a4a'), C.teal]);
    L.opts |= bit(OPT.BACKPACK);
    if (female) L.opts |= bit(OPT.SKIRT); else L.flags |= FLAG.SHORTS;
    L.flags &= ~FLAG.LONGSLEEVE;
  } else if (!female) L.flags |= FLAG.SHORTS;
  return L;
}

// international students and visitors from abroad (IITG hosts students from across Asia and Africa, and exchange students)
const WORLD_SKINS = ['#f6e2d3', '#f1d9c6', '#e9c9ae', '#6a4431', '#553425', '#3e271c'].map(pal);
const WORLD_HAIR = ['#d9b56b', '#b98a4a', '#8a5a2b', '#a2482a', '#15110e', '#2e1f16'].map(pal);
export function intlLook(r, { female = r() < 0.4 } = {}) {
  const L = studentLook(r, { female });
  const k = Math.floor(r() * WORLD_SKINS.length);
  L.col0[0] = WORLD_SKINS[k];
  L.col1[0] = k >= 3 ? pick(r, [WORLD_HAIR[4], WORLD_HAIR[5]]) : pick(r, WORLD_HAIR);
  L.opts &= ~bit(OPT.DUPATTA);
  L.scale += 0.03;
  if (r() < 0.3) L.opts |= bit(OPT.CAMERA);
  return L;
}

/** family members at the staff quarters */
export function familyLook(r, who) {
  if (who === 'kid') return kidLook(r, { uniform: false });
  const L = adultLook(r, 'parent');
  if (who === 'mother') {
    L.flags |= FLAG.FEMALE; L.opts &= ~(bit(OPT.BEARD) | bit(OPT.SHORTHAIR)); L.opts |= bit(OPT.BUN) | bit(OPT.DUPATTA) | bit(OPT.SKIRT);
    L.col0[1] = pick(r, [pal('#b3262f'), pal('#e2702f'), pal('#2e7d4f'), pal('#6b3d5e'), pal('#c2185b'), pal('#efe3c2')]); L.col0[3] = L.col0[1];
    L.scale = 0.9 + r() * 0.06;
  }
  if (who === 'father') { L.flags &= ~FLAG.FEMALE; L.opts &= ~(bit(OPT.LONGHAIR) | bit(OPT.BUN) | bit(OPT.SKIRT) | bit(OPT.DUPATTA)); L.opts |= bit(OPT.SHORTHAIR); L.flags &= ~FLAG.OLD; L.scale = 0.98 + r() * 0.08; }
  if (who === 'grand') { L.flags |= FLAG.OLD; L.col1[0] = GREY_HAIR; L.scale = 0.92; }
  return L;
}

/** research scholars living with their families (Married Scholars' Hostel): late twenties / thirties */
export function scholarLook(r, female) {
  const L = studentLook(r, { female });
  L.opts &= ~(bit(OPT.BACKPACK) | bit(OPT.CAP) | bit(OPT.SKIRT));
  L.flags &= 63; L.flags &= ~FLAG.SHORTS; L.hoodie = false;
  L.scale += 0.03;
  if (female) { L.opts &= ~bit(OPT.LONGHAIR); L.opts |= bit(r() < 0.6 ? OPT.BUN : OPT.LONGHAIR); if (r() < 0.6) { L.opts |= bit(OPT.DUPATTA); L.col0[1] = pick(r, KURTI); L.col0[3] = pick(r, LEGGINGS); } }
  else { if (r() < 0.7) L.opts |= bit(OPT.BEARD); if (r() < 0.6) L.flags |= FLAG.LONGSLEEVE; L.col0[3] = pick(r, BOTTOMS); }
  if (r() < 0.5) L.opts |= bit(OPT.GLASSES);
  return L;
}

/** the people who run the campus, dressed for the job */
export function staffLook(r, job) {
  const L = adultLook(r, job === 'mess' ? 'mess' : 'staff');
  const formal = () => { L.col0[1] = pick(r, [C.white, pal('#dfe6ee'), pal('#c9d3dd'), pal('#e8d9c0'), pal('#b8c7d9')]); L.col0[3] = pick(r, [C.black, C.navy, pal('#3a3a3a'), C.khaki]); L.flags |= FLAG.LONGSLEEVE; };
  switch (job) {
    case 'office': formal(); L.opts |= bit(OPT.LANYARD); break;
    case 'lab': L.col0[1] = C.white; L.col0[2] = C.white; L.col0[3] = pick(r, [C.navy, C.black]); L.flags |= FLAG.LONGSLEEVE; L.opts |= bit(OPT.LANYARD); if (r() < 0.6) L.opts |= bit(OPT.GLASSES); break;
    case 'library': formal(); L.opts |= bit(OPT.GLASSES) | bit(OPT.LANYARD); break;
    case 'medical': if (r() < 0.5) { L.col0[1] = pal('#2f8f8a'); L.col0[3] = pal('#2f8f8a'); } else { L.col0[1] = C.white; L.flags |= FLAG.LONGSLEEVE; } L.opts |= bit(OPT.LANYARD); break;
    case 'shop': L.col0[1] = pick(r, [pal('#8a6a4a'), pal('#6b7d8f'), C.white, pal('#c86b3c')]); if (r() < 0.4) L.opts |= bit(OPT.APRON); break;
    case 'sweeper':
      L.flags |= FLAG.BROOM;
      if (r() < 0.5) { L.flags |= FLAG.FEMALE; L.opts &= ~(bit(OPT.SHORTHAIR) | bit(OPT.BEARD)); L.opts |= bit(OPT.SKIRT) | bit(OPT.DUPATTA) | bit(OPT.BUN); L.col0[1] = pick(r, [pal('#c2185b'), pal('#2e7d4f'), pal('#e2702f'), pal('#5b2d7a')]); L.col0[3] = L.col0[1]; }
      break;
    case 'gardener': L.col0[1] = pal('#6b7d4a'); L.col1[2] = pal('#c9b27a'); L.opts |= bit(OPT.CAP); L.flags |= FLAG.RAKE; break;
    case 'dean': case 'director': formal(); L.col0[2] = pick(r, [C.navy, C.maroon, pal('#3a3a3a')]); L.flags |= FLAG.OLD; L.opts |= bit(OPT.GLASSES); L.col1[0] = GREY_HAIR; L.opts &= ~bit(OPT.SKIRT); break;
    case 'hod': formal(); L.opts |= bit(OPT.GLASSES) | bit(OPT.BOOK); if (r() < 0.6) L.col1[0] = GREY_HAIR; break;
  }
  return L;
}

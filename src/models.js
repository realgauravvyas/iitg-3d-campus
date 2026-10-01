// Procedural low-poly models: bicycle, scooter, car, campus bus, drone, kulhad chai.
// All face +z, y up, origin on the ground.
import * as THREE from 'three';
import { tube, mergeColored, m4, canvasTexture } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts }));
  return matCache.get(key);
}

function wheelGeometry(R, tire = 0.024, spokes = 14) {
  const parts = [
    { geometry: new THREE.TorusGeometry(R - tire, tire, 6, 26).rotateY(Math.PI / 2), color: '#1a1a1a' },
    { geometry: new THREE.TorusGeometry(R - tire * 2.6, 0.009, 4, 26).rotateY(Math.PI / 2), color: '#b8bcc0' },
    { geometry: new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8).rotateZ(Math.PI / 2), color: '#8a8e92' },
  ];
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2;
    parts.push({ geometry: tube(V(0, 0, 0), V(0, Math.cos(a) * (R - tire * 2.6), Math.sin(a) * (R - tire * 2.6)), 0.003, 3), color: '#c9cdd1' });
  }
  return mergeColored(parts);
}

const bikeCache = new Map();
/** Bicycle parts as geometries (shared). style: 'mtb' | 'roadster' */
function bikeParts(color, style) {
  const key = color + style;
  if (bikeCache.has(key)) return bikeCache.get(key);
  const R = 0.34;
  const BB = V(0, 0.3, -0.06), ST = V(0, 0.86, -0.25), HT = V(0, 0.93, 0.37), HB = V(0, 0.72, 0.41), RA = V(0, R, -0.52);
  const frame = [
    { geometry: tube(ST, HT, 0.022), color }, { geometry: tube(BB, HB, 0.026), color }, { geometry: tube(BB, ST, 0.022), color },
    { geometry: tube(HB, HT, 0.03), color },
    { geometry: tube(BB.clone().setX(0.05), RA.clone().setX(0.06), 0.012), color }, { geometry: tube(BB.clone().setX(-0.05), RA.clone().setX(-0.06), 0.012), color },
    { geometry: tube(ST.clone().setX(0.03), RA.clone().setX(0.06), 0.011), color }, { geometry: tube(ST.clone().setX(-0.03), RA.clone().setX(-0.06), 0.011), color },
    { geometry: tube(ST, V(0, 0.97, -0.29), 0.013), color: '#2a2a2a' },                                    // seat post
    { geometry: new THREE.BoxGeometry(0.15, 0.05, 0.27), color: '#151515', matrix: m4(0, 0.99, -0.3, 0.08) }, // saddle
    { geometry: tube(V(0.07, 0.35, -0.52), BB.clone().setX(0.07), 0.006), color: '#3a3a3a' },               // chain
    { geometry: tube(V(0.07, 0.29, -0.52), BB.clone().setX(0.07).setY(0.2), 0.006), color: '#3a3a3a' },
  ];
  if (style === 'roadster') {
    frame.push(
      { geometry: new THREE.TorusGeometry(R + 0.03, 0.012, 3, 14, Math.PI * 0.9).rotateY(Math.PI / 2), color, matrix: m4(0, R, -0.52, -0.3) },
      { geometry: new THREE.BoxGeometry(0.16, 0.015, 0.32), color: '#222', matrix: m4(0, 0.88, -0.55) },       // rear carrier
      { geometry: tube(V(0.07, 0.88, -0.7), V(0.06, R, -0.52), 0.008), color: '#222' },
      { geometry: tube(V(-0.07, 0.88, -0.7), V(-0.06, R, -0.52), 0.008), color: '#222' },
    );
  }
  const front = [ // steers around the head tube axis; origin at HB
    { geometry: tube(V(0.05, 0, 0), V(0.055, R - 0.72, 0.12), 0.013), color },
    { geometry: tube(V(-0.05, 0, 0), V(-0.055, R - 0.72, 0.12), 0.013), color },
    { geometry: tube(V(0, 0.2, 0), V(0, 0.3, -0.05), 0.016), color: '#2b2b2b' },                  // stem
    { geometry: tube(V(-0.3, 0.3, -0.07), V(0.3, 0.3, -0.07), 0.013), color: '#2b2b2b' },            // bar
    { geometry: tube(V(-0.3, 0.3, -0.07), V(-0.2, 0.3, -0.07), 0.018), color: '#111' },
    { geometry: tube(V(0.3, 0.3, -0.07), V(0.2, 0.3, -0.07), 0.018), color: '#111' },
    { geometry: new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10), color: '#d8d8d8', matrix: m4(0.2, 0.33, -0.07) }, // bell
  ];
  if (style === 'roadster') front.push({ geometry: new THREE.BoxGeometry(0.3, 0.2, 0.22), color: '#2c2c2c', matrix: m4(0, 0.22, 0.14) }); // basket
  const crank = [
    { geometry: new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16).rotateZ(Math.PI / 2), color: '#9a9ea3', matrix: m4(0.07, 0, 0) },
    { geometry: new THREE.BoxGeometry(0.02, 0.17, 0.03).translate(0, -0.085, 0), color: '#6b6f73', matrix: m4(0.085, 0, 0) },
    { geometry: new THREE.BoxGeometry(0.02, 0.17, 0.03).translate(0, 0.085, 0), color: '#6b6f73', matrix: m4(-0.085, 0, 0) },
  ];
  const parts = {
    frame: mergeColored(frame), front: mergeColored(front), crank: mergeColored(crank),
    wheel: wheelGeometry(R), pedal: mergeColored([{ geometry: new THREE.BoxGeometry(0.1, 0.02, 0.06), color: '#222' }]),
    R, BB, HB, RA, FA: V(0, R, 0.53),
  };
  bikeCache.set(key, parts);
  return parts;
}

export function makeBicycle(color = '#c62f2f', style = 'mtb') {
  const P = bikeParts(color, style);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 });
  const g = new THREE.Group();
  const frame = new THREE.Mesh(P.frame, m);
  const wheelR = new THREE.Mesh(P.wheel, m);
  wheelR.position.copy(P.RA);
  const crank = new THREE.Group();
  crank.position.copy(P.BB);
  crank.add(new THREE.Mesh(P.crank, m));
  const pedalL = new THREE.Mesh(P.pedal, m), pedalR = new THREE.Mesh(P.pedal, m);
  pedalR.position.set(0.12, -0.17, 0); pedalL.position.set(-0.12, 0.17, 0);
  crank.add(pedalL, pedalR);
  // steering: fork, bar and front wheel turn about the head-tube axis
  const headAxis = new THREE.Vector3(0, 1, -0.19).normalize();
  const steerPivot = new THREE.Group();
  steerPivot.position.copy(P.HB);
  const steerInner = new THREE.Group();
  steerPivot.add(steerInner);
  const frontMesh = new THREE.Mesh(P.front, m);
  const wheelF = new THREE.Mesh(P.wheel, m);
  const fw = new THREE.Group();
  fw.position.copy(P.FA.clone().sub(P.HB));
  fw.add(wheelF);
  steerInner.add(frontMesh, fw);
  g.add(frame, wheelR, crank, steerPivot);
  for (const o of [frame, wheelR, wheelF, frontMesh]) o.castShadow = true;
  const api = {
    group: g, R: P.R, crankAngle: 0, style, color,
    seat: V(0, 1.0, -0.3), bar: V(0, P.HB.y + 0.3, P.HB.z - 0.07), crankCenter: P.BB.clone(),
    setSteer(a) { steerInner.quaternion.setFromAxisAngle(headAxis, a); },
    spin(dist) { const r = dist / P.R; wheelF.rotation.x += r; wheelR.rotation.x += r; },
    setCrank(a) { api.crankAngle = a; crank.rotation.x = a; pedalL.rotation.x = -a; pedalR.rotation.x = -a; },
    pedalPos(side) { // bike-local pedal position (side: 1 right, -1 left)
      const a = api.crankAngle + (side > 0 ? 0 : Math.PI);
      return V(side * 0.12, P.BB.y - Math.cos(a) * 0.17, P.BB.z - Math.sin(a) * 0.17);
    },
  };
  return api;
}

/** A single static geometry for parked bicycles (instancing). */
export function parkedBikeGeometry(color, style) {
  const P = bikeParts(color, style);
  const parts = [
    { geometry: P.frame, color: '#ffffff' },
    { geometry: P.front, color: '#ffffff', matrix: m4(P.HB.x, P.HB.y, P.HB.z) },
    { geometry: P.wheel, color: '#ffffff', matrix: m4(P.RA.x, P.RA.y, P.RA.z) },
    { geometry: P.wheel, color: '#ffffff', matrix: m4(P.FA.x, P.FA.y, P.FA.z) },
    { geometry: P.crank, color: '#ffffff', matrix: m4(P.BB.x, P.BB.y, P.BB.z) },
  ];
  // keep original vertex colours: mergeColored would overwrite, so copy colours manually
  const geos = parts.map((p) => { const g = p.geometry.clone(); if (p.matrix) g.applyMatrix4(p.matrix); return g; });
  let n = 0; geos.forEach((g) => (n += g.attributes.position.count));
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // lean on the kick-stand
  out.applyMatrix4(m4(0, 0, 0, 0, 0, 0.12));
  return out;
}

export function makeScooter(color = '#2f5fa8') {
  const g = new THREE.Group();
  const body = mergeColored([
    { geometry: new THREE.BoxGeometry(0.34, 0.1, 0.62), color: '#2a2a2a', matrix: m4(0, 0.3, 0.05) },           // floorboard
    { geometry: new THREE.CapsuleGeometry(0.2, 0.55, 4, 10).rotateX(Math.PI / 2), color, matrix: m4(0, 0.55, -0.45, 0, 0, 0, 1.0, 1.0, 1.1) }, // rear cowl
    { geometry: new THREE.BoxGeometry(0.3, 0.09, 0.62), color: '#1b1b1b', matrix: m4(0, 0.8, -0.42) },          // seat
    { geometry: new THREE.BoxGeometry(0.44, 0.72, 0.12), color, matrix: m4(0, 0.62, 0.42, -0.18) },            // front shield
    { geometry: new THREE.BoxGeometry(0.16, 0.12, 0.2), color: '#e8e8e0', matrix: m4(0, 1.02, 0.5) },          // headlight
    { geometry: tube(V(-0.34, 1.05, 0.42), V(0.34, 1.05, 0.42), 0.018), color: '#222' },
    { geometry: new THREE.BoxGeometry(0.2, 0.05, 0.1), color: '#c33', matrix: m4(0, 0.7, -0.98) },            // tail lamp
  ]);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.2 });
  const b = new THREE.Mesh(body, m); b.castShadow = true;
  const wg = mergeColored([{ geometry: new THREE.CylinderGeometry(0.23, 0.23, 0.1, 14).rotateZ(Math.PI / 2), color: '#161616' },
    { geometry: new THREE.CylinderGeometry(0.13, 0.13, 0.11, 10).rotateZ(Math.PI / 2), color: '#9ea2a6' }]);
  const wf = new THREE.Mesh(wg, m), wr = new THREE.Mesh(wg, m);
  wf.position.set(0, 0.23, 0.55); wr.position.set(0, 0.23, -0.62);
  g.add(b, wf, wr);
  return { group: g, seat: V(0, 0.86, -0.35), spin(d) { wf.rotation.x += d / 0.23; wr.rotation.x += d / 0.23; } };
}

export function makeCar(color = '#e8e8e8') {
  const g = new THREE.Group();
  const body = mergeColored([
    { geometry: new THREE.BoxGeometry(1.68, 0.62, 3.8), color, matrix: m4(0, 0.62, 0) },
    { geometry: new THREE.BoxGeometry(1.5, 0.55, 2.1), color: '#2b3640', matrix: m4(0, 1.2, -0.25) },
    { geometry: new THREE.BoxGeometry(1.52, 0.08, 2.0), color, matrix: m4(0, 1.5, -0.3) },
    { geometry: new THREE.BoxGeometry(1.4, 0.14, 0.05), color: '#ddd', matrix: m4(0, 0.72, 1.91) },
    { geometry: new THREE.BoxGeometry(0.3, 0.12, 0.05), color: '#fff8d0', matrix: m4(0.6, 0.78, 1.91) },
    { geometry: new THREE.BoxGeometry(0.3, 0.12, 0.05), color: '#fff8d0', matrix: m4(-0.6, 0.78, 1.91) },
    { geometry: new THREE.BoxGeometry(0.3, 0.1, 0.05), color: '#b01818', matrix: m4(0.62, 0.8, -1.91) },
    { geometry: new THREE.BoxGeometry(0.3, 0.1, 0.05), color: '#b01818', matrix: m4(-0.62, 0.8, -1.91) },
  ]);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35 });
  const b = new THREE.Mesh(body, m); b.castShadow = true;
  g.add(b);
  const wg = mergeColored([{ geometry: new THREE.CylinderGeometry(0.3, 0.3, 0.2, 14).rotateZ(Math.PI / 2), color: '#141414' },
    { geometry: new THREE.CylinderGeometry(0.17, 0.17, 0.21, 10).rotateZ(Math.PI / 2), color: '#aab' }]);
  const wheels = [[0.78, 1.2], [-0.78, 1.2], [0.78, -1.25], [-0.78, -1.25]].map(([x, z]) => {
    const w = new THREE.Mesh(wg, m); w.position.set(x, 0.3, z); g.add(w); return w;
  });
  return { group: g, spin(d) { for (const w of wheels) w.rotation.x += d / 0.3; } };
}

function textTexture(text, { w = 512, h = 96, bg = '#111', fg = '#ffb52e', font = 'bold 64px sans-serif' } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  }, { repeat: false });
}

/** Hollow campus bus you can ride inside. 10.6 m long. */
export function makeBus({ board = 'IITG DUTY', stripe = '#b6d12a', accent = '#3d6b1f' } = {}) {
  const g = new THREE.Group();
  const L = 10.6, W = 2.5, H = 3.05, floorY = 0.85, winLo = 1.75, winHi = 2.65;
  const white = '#f1efe8';
  const shell = [];
  const box = (w, h, d, x, y, z, color) => shell.push({ geometry: new THREE.BoxGeometry(w, h, d), color, matrix: m4(x, y, z) });
  box(W, 0.12, L, 0, floorY, 0, '#3a3a3a');                            // floor
  box(W, 0.1, L, 0, H, 0, white);                                        // roof
  box(W * 0.6, 0.18, L * 0.5, 0, H + 0.12, -1, '#d8d6cf');               // roof AC unit
  for (const s of [-1, 1]) {
    box(0.06, winLo - 0.45, L, (s * W) / 2, (winLo + 0.45) / 2, 0, white);       // lower side panel (white, like the IITG buses)
    box(0.07, 0.2, L, (s * W) / 2, 1.5, 0, stripe);                                // the yellow-green stripe under the windows
    box(0.07, 0.05, L, (s * W) / 2, 1.34, 0, accent);                              // and a thin dark-green line below it
    box(0.06, H - winHi, L, (s * W) / 2, (H + winHi) / 2, 0, white);              // above windows
    for (let k = 0; k <= 7; k++) box(0.08, winHi - winLo, 0.12, (s * W) / 2, (winLo + winHi) / 2, -L / 2 + 0.2 + (k * (L - 0.4)) / 7, '#1b2228'); // dark pillars: the window band reads as one dark strip
  }
  box(W, winLo - 0.45, 0.06, 0, (winLo + 0.45) / 2, L / 2, white);                 // front lower
  box(W, H - winHi, 0.06, 0, (H + winHi) / 2, L / 2, white);
  box(W, H - 0.45, 0.06, 0, (H + 0.45) / 2, -L / 2, white);                        // rear wall
  box(W, 0.3, 0.1, 0, 0.62, L / 2 + 0.02, '#2a2a2a');                              // bumper
  box(W, 0.3, 0.1, 0, 0.62, -L / 2 - 0.02, '#2a2a2a');
  box(0.3, 0.14, 0.05, 0.9, 1.1, L / 2 + 0.04, '#fff6c8'); box(0.3, 0.14, 0.05, -0.9, 1.1, L / 2 + 0.04, '#fff6c8');
  box(0.25, 0.14, 0.05, 0.95, 1.1, -L / 2 - 0.04, '#b31515'); box(0.25, 0.14, 0.05, -0.95, 1.1, -L / 2 - 0.04, '#b31515');
  // ------------------------------------------------------------ the inside
  // The passengers' places are fixed by bus.js (2 + 2 seats in 8 rows, the driver on the right), so the seats keep their places
  // and are built properly: a cushion, a tilted back with a head rest, steel frames, grab handles on the aisle side.
  const STEEL = '#c9ced3', DARK = '#23272b', YELLOW = '#f2c12e', CREAM = '#e6e0d0';
  const cyl = (r, len, axis, x, y, z, color, seg = 8) => shell.push({ geometry: new THREE.CylinderGeometry(r, r, len, seg, 1).applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0))), color, matrix: m4(x, y, z) });
  const rbox = (w, h, d, x, y, z, color, rx = 0) => shell.push({ geometry: new THREE.BoxGeometry(w, h, d), color, matrix: m4(x, y, z, rx, 0, 0) });
  const seatZ = (r) => -L / 2 + 1.0 + r * 1.05;
  for (let r = 0; r < 8; r++) {
    const z = seatZ(r);
    for (const x of [-0.85, -0.42, 0.42, 0.85]) {
      rbox(0.42, 0.1, 0.46, x, floorY + 0.45, z, '#2f63b8');                          // the cushion (blue, like the real IITG buses)
      rbox(0.42, 0.03, 0.46, x, floorY + 0.505, z, '#3a73c8');                        // its top, a shade lighter
      rbox(0.42, 0.54, 0.09, x, floorY + 0.78, z - 0.22, '#3a73c8', -0.1);            // the back, leaning a little
      rbox(0.3, 0.15, 0.07, x, floorY + 1.14, z - 0.25, '#2a5aa8', -0.1);             // the head rest
      rbox(0.44, 0.04, 0.1, x, floorY + 0.5, z - 0.22, '#1f4f98');                    // the seam between cushion and back
    }
    for (const side of [-1, 1]) {
      rbox(0.05, 0.4, 0.34, side * (W / 2 - 0.05), floorY + 0.25, z, STEEL);           // the bracket on the wall side
      rbox(0.04, 0.42, 0.04, side * 0.2, floorY + 0.27, z + 0.05, STEEL);              // the leg on the aisle side
      rbox(0.04, 0.04, 0.4, side * 0.2, floorY + 0.07, z, STEEL);                      // and its foot on the floor
      cyl(0.016, 0.34, 'x', side * 0.22, floorY + 1.1, z - 0.24, STEEL);               // the grab handle on top of the aisle seat back
    }
  }
  // the long seat across the back, against the rear wall
  rbox(2.3, 0.1, 0.46, 0, floorY + 0.45, -L / 2 + 0.36, '#2f63b8');
  rbox(2.3, 0.5, 0.09, 0, floorY + 0.78, -L / 2 + 0.1, '#3a73c8');
  rbox(2.3, 0.3, 0.4, 0, floorY + 0.24, -L / 2 + 0.36, '#1d2126');
  // the overhead handrails along both sides of the aisle, on stanchions, with hanging grab straps
  for (const side of [-1, 1]) {
    cyl(0.02, L - 2.2, 'z', side * 0.64, 2.3, -0.4, STEEL);
    for (let r = 0; r < 8; r += 1) {
      const z = seatZ(r) - 0.05;
      if (r % 2 === 0) cyl(0.018, 2.3 - (floorY + 0.5), 'y', side * 0.64, (2.3 + floorY + 0.5) / 2, z, STEEL, 6);        // a stanchion from the seat level up to the rail
      shell.push({ geometry: new THREE.TorusGeometry(0.06, 0.012, 6, 12), color: YELLOW, matrix: m4(side * 0.64, 2.03, z + 0.3, 0, Math.PI / 2, 0) });
      rbox(0.02, 0.26, 0.04, side * 0.64, 2.17, z + 0.3, '#1d1d1d');
    }
  }
  // the ceiling: a white lining with two LED light strips and speaker grilles
  rbox(W - 0.1, 0.03, L - 0.3, 0, H - 0.07, 0, '#efece3');
  for (const x of [-0.55, 0.55]) rbox(0.16, 0.02, L - 2.4, x, H - 0.09, -0.3, '#fff9e0');
  for (const z of [-3.6, -0.4, 2.8]) rbox(0.22, 0.04, 0.12, 0, H - 0.09, z, '#5a5e63');
  // inside the walls: a cream lining up to the windows, a sill, a frame round every window
  for (const side of [-1, 1]) {
    rbox(0.04, winLo - floorY - 0.2, L - 0.3, side * (W / 2 - 0.05), (winLo + floorY + 0.1) / 2, 0, CREAM);
    rbox(0.1, 0.04, L - 0.3, side * (W / 2 - 0.08), winLo - 0.02, 0, '#b9b2a2');
    rbox(0.1, 0.05, L - 0.3, side * (W / 2 - 0.08), winHi + 0.02, 0, DARK);
    for (let k = 0; k < 7; k++) rbox(0.05, winHi - winLo, 0.04, side * (W / 2 - 0.06), (winLo + winHi) / 2, -L / 2 + 0.6 + ((k + 0.5) * (L - 1.2)) / 7, DARK);
    for (let k = 0; k < 7; k++) rbox(0.05, 0.4, (L - 1.2) / 7 - 0.1, side * (W / 2 - 0.07), winHi - 0.22, -L / 2 + 0.6 + ((k + 0.5) * (L - 1.2)) / 7, '#9aa3ab');   // the small sliding top light of each window
  }
  // the driver's cab on the right: a dashboard with its binnacle, a 3-spoke wheel on a column, a proper seat, a mirror, a partition
  rbox(W - 0.14, 0.52, 0.5, 0, floorY + 0.6, L / 2 - 0.36, '#23272b');
  rbox(W - 0.14, 0.05, 0.54, 0, floorY + 0.89, L / 2 - 0.36, '#3a3f44');
  rbox(0.62, 0.22, 0.3, -0.75, floorY + 1.0, L / 2 - 0.46, '#15181b', -0.4);                   // the instrument binnacle
  for (const x of [0.15, 0.45, 0.75]) rbox(0.2, 0.06, 0.04, x, floorY + 0.93, L / 2 - 0.5, '#8a9299');            // air vents
  cyl(0.03, 0.55, 'y', -0.75, floorY + 0.9, L / 2 - 0.68, '#15181b', 8);                                       // the steering column
  shell.push({ geometry: new THREE.TorusGeometry(0.2, 0.024, 8, 20).rotateX(-1.15), color: '#15181b', matrix: m4(-0.75, floorY + 1.12, L / 2 - 0.62) });
  for (const an of [0, 2.1, 4.2]) shell.push({ geometry: new THREE.BoxGeometry(0.02, 0.02, 0.19).translate(0, 0, 0.095).rotateY(an).rotateX(-1.15), color: '#15181b', matrix: m4(-0.75, floorY + 1.12, L / 2 - 0.62) });
  rbox(0.5, 0.12, 0.5, -0.75, floorY + 0.48, L / 2 - 1.1, '#2d2d2d'); rbox(0.5, 0.6, 0.1, -0.75, floorY + 0.85, L / 2 - 1.35, '#2d2d2d', -0.08); rbox(0.3, 0.18, 0.08, -0.75, floorY + 1.27, L / 2 - 1.37, '#2d2d2d');
  rbox(0.32, 0.45, 0.32, -0.75, floorY + 0.22, L / 2 - 1.1, '#3a3f44');
  cyl(0.02, 0.85, 'y', -0.42, floorY + 0.5 + 0.43, L / 2 - 1.8, STEEL, 6); cyl(0.02, 0.85, 'y', W / 2 - 0.12, floorY + 0.5 + 0.43, L / 2 - 1.8, STEEL, 6);   // the cab partition rail
  cyl(0.02, W / 2 + 0.3, 'x', 0.4, floorY + 1.3, L / 2 - 1.8, STEEL, 6);
  rbox(0.3, 0.08, 0.04, 0.0, H - 0.3, L / 2 - 0.1, '#15181b');                                 // the interior mirror
  rbox(W - 0.2, 0.06, 0.3, 0, winHi - 0.02, L / 2 - 0.14, '#23272b');                          // a sun visor strip over the windscreen
  // the passenger door, front left: a frame, two glass leaves, rubber edges, yellow poles; a yellow step edge inside
  {
    const dz = L / 2 - 1.75, dw = 1.3;
    rbox(0.06, winHi - floorY - 0.2, dw + 0.12, W / 2 + 0.02, (winHi + floorY + 0.1) / 2, dz, '#2a2f34');
    for (const k of [-1, 1]) rbox(0.05, winHi - floorY - 0.4, dw / 2 - 0.05, W / 2 + 0.06, (winHi + floorY + 0.1) / 2 - 0.02, dz + k * dw * 0.25, '#9fb8c6');
    rbox(0.07, winHi - floorY - 0.4, 0.04, W / 2 + 0.07, (winHi + floorY + 0.1) / 2 - 0.02, dz, '#15181b');
    cyl(0.025, winHi - floorY - 0.3, 'y', W / 2 - 0.3, (winHi + floorY) / 2 + 0.05, dz + dw / 2 + 0.1, YELLOW, 8);
    cyl(0.025, winHi - floorY - 0.3, 'y', W / 2 - 0.3, (winHi + floorY) / 2 + 0.05, dz - dw / 2 - 0.1, YELLOW, 8);
    rbox(0.5, 0.012, dw + 0.3, W / 2 - 0.35, floorY + 0.066, dz, YELLOW);
  }
  // a first-aid box, a fire extinguisher and the bell buttons on the rail
  rbox(0.12, 0.2, 0.06, W / 2 - 0.1, 1.7, -L / 2 + 1.3, '#d63a2f'); rbox(0.05, 0.12, 0.02, W / 2 - 0.135, 1.7, -L / 2 + 1.3, '#f4f4ef');
  cyl(0.06, 0.4, 'y', -W / 2 + 0.12, floorY + 0.35, L / 2 - 2.3, '#c62828', 10);
  for (let r = 1; r < 8; r += 2) { rbox(0.05, 0.08, 0.05, -0.64, 2.2, seatZ(r) - 0.05, '#d63a2f'); rbox(0.05, 0.08, 0.05, 0.64, 2.2, seatZ(r) - 0.05, '#d63a2f'); }
  const shellGeo = mergeColored(shell);
  const shellMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 });
  const shellMesh = new THREE.Mesh(shellGeo, shellMat);
  shellMesh.castShadow = true; shellMesh.receiveShadow = true;
  g.add(shellMesh);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x24333d, roughness: 0.05, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });   // tinted windows you can see through
  const glass = new THREE.Group();
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.2, winHi - winLo), glassMat);
    p.rotation.y = Math.PI / 2; p.position.set((s * W) / 2, (winLo + winHi) / 2, 0);
    glass.add(p);
  }
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, winHi - winLo + 0.2), glassMat);
  ws.position.set(0, (winLo + winHi) / 2, L / 2); glass.add(ws);
  g.add(glass);
  // the floor: ribbed anti-slip rubber with yellow lines along the aisle
  const floorTex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#3b3e42'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x, 0, 3, h); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 4, 0, 2, h); }
    for (let k = 0; k < 500; k++) { c.fillStyle = 'rgba(255,255,255,0.03)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 10);
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, L - 0.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
  floorMesh.position.set(0, floorY + 0.062, 0); floorMesh.receiveShadow = true; g.add(floorMesh);
  for (const x of [-0.2, 0.2]) { const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.03, L - 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2c12e })); strip.position.set(x, floorY + 0.066, -0.2); g.add(strip); }
  // the route strip above the windscreen, the driver's instrument panel, and notices on the walls
  const routeTex = canvasTexture(512, 64, (c, w, h) => { c.fillStyle = '#10232f'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2c12e'; c.font = 'bold 26px "Hind", "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('IITG CAMPUS SHUTTLE · FREE FOR STUDENTS', w / 2, h / 2 + 1, w - 20); }, { repeat: false });
  const routeMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.19), new THREE.MeshBasicMaterial({ map: routeTex, toneMapped: false }));
  routeMesh.rotation.y = Math.PI; routeMesh.position.set(0, H - 0.23, L / 2 - 0.3); g.add(routeMesh);
  const gaugeTex = canvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = '#080b0d'; c.fillRect(0, 0, w, h);
    for (const [cx, lab] of [[70, 'km/h'], [190, 'fuel']]) { c.strokeStyle = '#8fb4c8'; c.lineWidth = 4; c.beginPath(); c.arc(cx, 66, 44, Math.PI * 0.8, Math.PI * 2.2); c.stroke(); c.strokeStyle = '#e04a3a'; c.lineWidth = 5; c.beginPath(); c.moveTo(cx, 66); c.lineTo(cx + 28, 40); c.stroke(); c.fillStyle = '#9fb8c6'; c.font = '16px sans-serif'; c.textAlign = 'center'; c.fillText(lab, cx, 108); }
    c.fillStyle = '#39d353'; c.fillRect(118, 12, 8, 8); c.fillStyle = '#f0a020'; c.fillRect(130, 12, 8, 8);
  }, { repeat: false });
  const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.26), new THREE.MeshBasicMaterial({ map: gaugeTex, toneMapped: false }));
  gauge.position.set(-0.75, floorY + 1.0, L / 2 - 0.595); gauge.rotation.set(-0.4, Math.PI, 0); g.add(gauge);
  const poster = (text, sub, bg, x, z) => {
    const t = canvasTexture(256, 160, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 40px "Hind", "Segoe UI", sans-serif'; c.fillText(text, w / 2, h * 0.38, w - 30); c.font = '22px "Hind", "Segoe UI", sans-serif'; c.fillText(sub, w / 2, h * 0.72, w - 30); }, { repeat: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    m.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2; m.position.set(x, 2.45, z); g.add(m);
  };
  poster('STOP BELL', 'Press the red button', '#8a1f1f', -W / 2 + 0.09, -1.2); poster('KEEP CLEAN', 'Use the dustbin', '#1f5f3a', W / 2 - 0.09, 1.5);
  poster('PLEASE GIVE WAY', 'Seats for the elderly and ladies', '#1f3a6e', -W / 2 + 0.09, 2.6);
  // the front destination board: IITG DUTY (and the same at the back)
  const boardTex = textTexture(board, { w: 512, h: 112, font: 'bold 76px "Teko", "Arial Narrow", sans-serif' });
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.37), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }));
  boardMesh.position.set(0, H - 0.22, L / 2 + 0.035);
  g.add(boardMesh);
  const rearBoard = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.2), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }));
  rearBoard.rotation.y = Math.PI; rearBoard.position.set(0, H - 0.3, -L / 2 - 0.035);
  g.add(rearBoard);
  // the institute's name along both sides, in capitals, on the white panel under the stripe
  const nameTex = canvasTexture(2048, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#123a6b'; c.textAlign = 'center'; c.textBaseline = 'middle';
    let px = 84; c.font = `bold ${px}px "Hind", "Segoe UI", Arial, sans-serif`;
    const text = 'INDIAN INSTITUTE OF TECHNOLOGY GUWAHATI';
    while (c.measureText(text).width > w - 60 && px > 40) { px -= 2; c.font = `bold ${px}px "Hind", "Segoe UI", Arial, sans-serif`; }
    c.fillText(text, w / 2, h / 2 + 4, w - 40);
  }, { repeat: false });
  for (const s of [-1, 1]) {
    const name = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 0.525), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, toneMapped: false }));
    name.rotation.y = s * Math.PI / 2; name.position.set(s * (W / 2 + 0.045), 0.95, -0.2);
    g.add(name);
  }
  const wg = mergeColored([{ geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16).rotateZ(Math.PI / 2), color: '#151515' },
    { geometry: new THREE.CylinderGeometry(0.28, 0.28, 0.31, 10).rotateZ(Math.PI / 2), color: '#9aa0a6' }]);
  const wm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const wheels = [[1.05, 3.3], [-1.05, 3.3], [1.05, -2.9], [-1.05, -2.9]].map(([x, z]) => {
    const w = new THREE.Mesh(wg, wm); w.position.set(x, 0.5, z); g.add(w); return w;
  });
  return {
    group: g, length: L, width: W, floorY,
    seatView: V(-0.85, floorY + 1.25, 1.2),
    spin(d) { for (const w of wheels) w.rotation.x += d / 0.5; },
  };
}

export function makeDrone() {
  const g = new THREE.Group();
  const body = mergeColored([
    { geometry: new THREE.BoxGeometry(0.2, 0.08, 0.34), color: '#3b3f44' },
    { geometry: new THREE.BoxGeometry(0.16, 0.05, 0.2), color: '#23262a', matrix: m4(0, 0.06, -0.02) },
    { geometry: new THREE.SphereGeometry(0.045, 10, 8), color: '#111', matrix: m4(0, -0.06, 0.16) },           // gimbal camera
    { geometry: new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10).rotateX(Math.PI / 2), color: '#5ab0ff', matrix: m4(0, -0.06, 0.2) },
    { geometry: tube(V(0.1, -0.04, 0.05), V(0.14, -0.13, 0.08), 0.008), color: '#222' },
    { geometry: tube(V(-0.1, -0.04, 0.05), V(-0.14, -0.13, 0.08), 0.008), color: '#222' },
    { geometry: tube(V(0.1, -0.04, -0.08), V(0.14, -0.13, -0.1), 0.008), color: '#222' },
    { geometry: tube(V(-0.1, -0.04, -0.08), V(-0.14, -0.13, -0.1), 0.008), color: '#222' },
  ]);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 });
  g.add(new THREE.Mesh(body, m));
  const arms = [[0.22, 0.2], [-0.22, 0.2], [0.22, -0.2], [-0.22, -0.2]];
  const props = [];
  const propGeo = new THREE.BoxGeometry(0.26, 0.004, 0.025);
  const propMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.5 });
  const discMat = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const armGeo = [];
  arms.forEach(([x, z]) => {
    armGeo.push({ geometry: tube(V(0, 0, 0), V(x, 0.02, z), 0.012), color: '#2f3237' });
    armGeo.push({ geometry: new THREE.CylinderGeometry(0.028, 0.03, 0.05, 10), color: '#1d1f22', matrix: m4(x, 0.035, z) });
  });
  g.add(new THREE.Mesh(mergeColored(armGeo), m));
  arms.forEach(([x, z], i) => {
    const p = new THREE.Mesh(propGeo, propMat);
    p.position.set(x, 0.065, z);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20).rotateX(-Math.PI / 2), discMat);
    disc.position.set(x, 0.066, z);
    g.add(p, disc);
    props.push({ p, disc, dir: i === 0 || i === 3 ? 1 : -1 });
  });
  const ledF = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const ledB = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  ledF.position.set(0, -0.02, 0.19); ledB.position.set(0, 0.0, -0.18);
  g.add(ledF, ledB);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(1.6);
  let t = 0;
  return {
    group: g,
    update(dt, thrust) {
      t += dt;
      for (const q of props) {
        q.p.rotation.y += q.dir * dt * (40 + thrust * 50);
        q.p.visible = thrust < 0.05;
        q.disc.visible = thrust >= 0.05;
      }
      ledB.visible = Math.sin(t * 8) > 0;
    },
  };
}

export function makeChai() {
  const g = new THREE.Group();
  const cup = mergeColored([
    { geometry: new THREE.CylinderGeometry(0.2, 0.13, 0.28, 16, 1, true), color: '#b8603a' },
    { geometry: new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16), color: '#9c4f2f', matrix: m4(0, -0.14, 0) },
    { geometry: new THREE.CylinderGeometry(0.185, 0.185, 0.01, 16), color: '#c79a62', matrix: m4(0, 0.1, 0) },
    { geometry: new THREE.TorusGeometry(0.2, 0.018, 6, 20).rotateX(Math.PI / 2), color: '#c46a41', matrix: m4(0, 0.14, 0) },
  ]);
  const mesh = new THREE.Mesh(cup, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x442211, emissiveIntensity: 0.4 }));
  mesh.scale.setScalar(2.6);
  g.add(mesh);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 32).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffc85a, transparent: true, opacity: 0.7 }));
  ring.position.y = -0.3;
  g.add(ring);
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  const steam = [0, 1, 2].map((i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), steamMat);
    g.add(s);
    return s;
  });
  let t = Math.random() * 10;
  return {
    group: g,
    update(dt) {
      t += dt;
      mesh.rotation.y += dt * 1.2;
      g.position.y = g.userData.baseY + Math.sin(t * 2) * 0.2;
      steam.forEach((s, i) => {
        const k = (t * 0.6 + i / 3) % 1;
        s.position.set(Math.sin(t + i) * 0.1, 0.5 + k * 1.2, 0);
        s.scale.setScalar(0.6 + k * 1.4);
      });
      steamMat.opacity = 0.25;
    },
  };
}

/** a 150 cc motorbike: tank, seat, engine, exhaust, handlebars */
export function makeMotorbike(color = '#b3262f') {
  const g = new THREE.Group();
  const body = mergeColored([
    { geometry: new THREE.BoxGeometry(0.12, 0.08, 1.05), color: '#2a2a2a', matrix: m4(0, 0.5, 0.0, 0.1) },                              // frame spine
    { geometry: new THREE.SphereGeometry(0.2, 12, 8), color, matrix: m4(0, 0.82, 0.18, 0, 0, 0, 0.9, 0.62, 1.35) },                   // tank
    { geometry: new THREE.BoxGeometry(0.26, 0.08, 0.62), color: '#151515', matrix: m4(0, 0.8, -0.34, 0.05) },                         // seat
    { geometry: new THREE.BoxGeometry(0.28, 0.26, 0.36), color: '#5a5f66', matrix: m4(0, 0.45, 0.08) },                               // engine
    { geometry: new THREE.CylinderGeometry(0.045, 0.05, 0.75, 8).rotateX(Math.PI / 2 - 0.12), color: '#b8bcc0', matrix: m4(0.16, 0.36, -0.42) },   // exhaust
    { geometry: new THREE.BoxGeometry(0.2, 0.12, 0.34), color, matrix: m4(0, 0.78, -0.72, 0.25) },                                     // tail
    { geometry: tube(V(0, 0.62, 0.58), V(0, 1.02, 0.46), 0.03), color: '#8a8f96' },                                                    // forks
    { geometry: tube(V(-0.36, 1.05, 0.42), V(0.36, 1.05, 0.42), 0.018), color: '#222' },                                               // bars
    { geometry: new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12).rotateX(Math.PI / 2), color: '#fff5c8', matrix: m4(0, 0.98, 0.56) },  // headlight
    { geometry: new THREE.BoxGeometry(0.14, 0.05, 0.06), color: '#c33', matrix: m4(0, 0.82, -0.9) },
  ]);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.4 });
  const b = new THREE.Mesh(body, m); b.castShadow = true;
  const wg = mergeColored([{ geometry: new THREE.CylinderGeometry(0.31, 0.31, 0.11, 16).rotateZ(Math.PI / 2), color: '#161616' },
    { geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12).rotateZ(Math.PI / 2), color: '#9ea2a6' }]);
  const wf = new THREE.Mesh(wg, m), wr = new THREE.Mesh(wg, m);
  wf.position.set(0, 0.31, 0.66); wr.position.set(0, 0.31, -0.64);
  g.add(b, wf, wr);
  return { group: g, seat: V(0, 0.86, -0.3), spin(d) { wf.rotation.x += d / 0.31; wr.rotation.x += d / 0.31; } };
}

// The open-air concert stage on the main cricket ground: a wide raised stage with steps, four steel
// columns carrying a box-truss roof grid that holds the lights (par cans, beam lights, hanging line-array
// speakers), an LED wall behind, sub-woofer stacks, a crowd barrier and a front-of-house tower with
// follow-spots. It stands there all year. The lights are off (a few work lights during the sound check,
// an hour before) and come alive when a concert is on (Techniche and Alcheringa Pronites): the colour
// washes, the sweeping beams and the screen follow the music's beat.
import * as THREE from 'three';
import { mergeColored, m4 } from '../util.js';
import { SetBuilder } from '../events/sets.js';

export const STAGE = { w: 22, d: 11, h: 1.5, top: 10.4 };

/** where the stage stands on a ground: at the far end of its long axis (the end opposite to where it used to be), facing the
 *  middle (the events' crowd uses the same point; the crowd stands in front of it, so it all turns round with it) */
export function concertSpot(W, f) {
  const R = Math.max(26, Math.min(f.len, f.wid) / 2 - 6);
  const p = W.fieldPoint(f, R - 8, 0);
  return { x: p.x, z: p.z, yaw: Math.atan2(f.ax, f.az) + Math.PI, R };
}

export function buildConcertStage(game, f) {
  const W = game.world;
  if (!f) return null;
  const { x, z, yaw } = concertSpot(W, f);
  const s = new SetBuilder(W, x, z, yaw);
  const { w, d, h, top } = STAGE, gy = s.y;
  const TRUSS = '#a3a8b0', STEEL = '#5e6268', BLACK = '#121214';

  // ---- the stage: concrete base, wooden deck, a black skirt and steps at both front corners
  s.box(0, 0, 0, w, h, d, '#8c8a84');
  s.box(0, h, 0, w - 0.2, 0.06, d - 0.2, '#3a2d22');
  s.box(0, 0.12, d / 2 + 0.03, w, h - 0.3, 0.05, '#17171b');
  const surf = (lx, lz, hx, hz, tp) => { const q = s.at(lx, lz); W.addSurface?.({ kind: 'box', x: q.x, z: q.z, hx, hz, yaw, top: gy + tp }); };
  surf(0, 0, w / 2, d / 2, h + 0.06);
  for (const sx of [-8, 8]) for (let k = 0; k < 3; k++) {
    const zc = d / 2 + 0.25 + (2 - k) * 0.5, hh = 0.5 * (k + 1);
    s.box(sx, 0, zc, 2.4, hh, 0.5, '#9a968c');
    surf(sx, zc, 1.2, 0.25, hh);
  }
  // ---- four columns, the roof grid of box trusses, cross bars, and struts so it reads as a lattice
  const cols = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cols.push([sx * (w / 2 + 0.4), sz * (d / 2 - 0.3)]);
  for (const [cx, cz] of cols) { s.box(cx, 0, cz, 0.55, top, 0.55, STEEL); s.box(cx, top - 0.05, cz, 0.8, 0.12, 0.8, '#3d4045'); W.addSolid?.(s.at(cx, cz).x, s.at(cx, cz).z, 0.5, 'stage', true); }
  const barZ = [-d / 2 + 0.3, -1.9, 1.9, d / 2 - 0.3];
  for (const bz of barZ) {
    s.box(0, top - 0.5, bz, w + 1.6, 0.5, 0.5, TRUSS);
    for (let u = -w / 2 - 0.4; u <= w / 2 + 0.5; u += 1.1) s.box(u, top - 0.5, bz, 0.06, 0.5, 0.56, '#7d838b');
  }
  for (const bx of [-(w / 2 + 0.4), -w / 4, w / 4, w / 2 + 0.4]) s.box(bx, top - 0.5, 0, 0.5, 0.5, d + 0.4, TRUSS);
  // ---- the back: black drape to the roof and the LED wall in front of it
  s.box(0, 0, -d / 2 - 0.15, w + 0.6, top - 0.5, 0.2, '#0b0b0d');
  s.box(0, h + 1.3, -d / 2 + 0.05, 15.2, 6.6, 0.18, '#0a0a0c');
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x050507, side: THREE.DoubleSide });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(14.6, 6.0), screenMat);
  screen.position.set(0, h + 4.6, -d / 2 + 0.16);
  s.group.add(screen);
  // ---- sound: line arrays hanging from the roof either side, sub-woofer stacks and monitors on the stage
  for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) { const lx = sx * (w / 2 + 1.3 + k * 0.85); s.box(lx, top - 4.2, d / 2 - 1.2, 0.75, 3.7, 0.85, BLACK); s.box(lx, top - 0.65, d / 2 - 1.2, 0.08, 0.3, 0.08, '#999'); }
  for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) s.box(sx * (w / 2 + 2.8 + k * 1.5), 0, d / 2 + 0.6, 1.4, 1.2, 1.4, '#16161a');
  for (let k = -3; k <= 3; k++) s.box(k * 2.6, h + 0.06, d / 2 - 0.9, 0.9, 0.45, 0.6, '#1b1b20', k * 0.12);
  // ---- the crowd barrier in front of the middle of the stage (the steps at the corners stay open)
  for (let u = -7; u <= 7; u += 2.3) { s.box(u, 0, d / 2 + 7.5, 2.25, 1.1, 0.06, '#7f858c'); s.box(u - 1.1, 0, d / 2 + 7.5, 0.08, 1.1, 0.5, '#5e6268'); }
  for (let u = -7.2; u <= 7.4; u += 7.3) { const a = s.at(u, d / 2 + 7.5); void a; }
  { const a = s.at(-7.2, d / 2 + 7.5), b = s.at(7.2, d / 2 + 7.5); W.indexFence?.({ ax: a.x, az: a.z, bx: b.x, bz: b.z, top: gy + 1.1 }); }
  // ---- the front-of-house tower: mixing desk under a canopy, with two follow-spots
  const foh = d / 2 + 26;
  s.box(0, 0, foh, 5.2, 0.9, 3.6, '#6f7378');
  s.box(0, 0.9, foh, 3.4, 0.12, 1.2, '#15161a');
  for (const sx of [-2.4, 2.4]) s.box(sx, 0.9, foh - 1.6, 0.14, 3.4, 0.14, STEEL);
  s.box(0, 4.2, foh, 5.4, 0.12, 3.8, '#3a3d42');
  { const a = s.at(-2.7, foh + 1.9), b = s.at(2.7, foh + 1.9), c = s.at(2.7, foh - 1.9), e = s.at(-2.7, foh - 1.9);
    for (const [p, q] of [[a, b], [b, c], [c, e], [e, a]]) W.indexFence?.({ ax: p.x, az: p.z, bx: q.x, bz: q.z, top: gy + 1.2 }); }
  s.finish();

  // ---- the lights: four colour channels of par cans along the trusses (black bodies are in the merged mesh above)
  const chan = [0, 1, 2, 3].map(() => ({ pos: [], mat: new THREE.MeshBasicMaterial({ color: 0x141416 }) }));
  const cans = [];
  barZ.forEach((bz, bi) => { let i = 0; for (let u = -w / 2 - 0.2; u <= w / 2 + 0.3; u += 1.1, i++) cans.push({ x: u, y: top - 0.72, z: bz + (bi >= 2 ? 0.05 : -0.05), ch: (i + bi) % 4, tilt: bz > 0 ? 0.5 : 0.25 }); });
  const body = [];
  for (const c of cans) {
    body.push({ geometry: new THREE.CylinderGeometry(0.16, 0.2, 0.34, 10), color: BLACK, matrix: m4(c.x, c.y, c.z, c.tilt, 0, 0) });
    chan[c.ch].pos.push(c);
  }
  const bodyMesh = new THREE.Mesh(mergeColored(body), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  s.group.add(bodyMesh);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S1 = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  for (const ch of chan) {
    if (!ch.pos.length) continue;
    const im = new THREE.InstancedMesh(new THREE.CircleGeometry(0.15, 10).rotateX(Math.PI / 2), ch.mat, ch.pos.length);
    ch.pos.forEach((c, i) => { M.compose(P.set(c.x, c.y - 0.175, c.z + Math.sin(c.tilt) * 0.12), Q.setFromEuler(E.set(c.tilt, 0, 0)), S1); im.setMatrixAt(i, M); });
    s.group.add(im);
  }
  // beams: additive cones that sweep
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beams = [];
  for (let k = 0; k < 14; k++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(1.5, 18, 14, 1, true).translate(0, -9, 0), beamMat.clone());
    m.position.set(-w / 2 + (k + 0.5) * (w / 14), top - 0.8, k % 2 ? barZ[3] : barZ[2]);
    s.group.add(m);
    beams.push(m);
  }
  // a wash of coloured light on the crowd (a soft additive disc on the grass in front of the stage)
  const wash = new THREE.Mesh(new THREE.CircleGeometry(24, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  wash.position.set(0, 0.08, d / 2 + 12); wash.scale.set(1.3, 1, 0.75);
  s.group.add(wash);
  // two real spot lights on the crowd (no shadows); their intensity is the only thing that changes, so the shaders never rebuild
  const spots = [-1, 1].map((sx) => { const L = new THREE.SpotLight(0xffffff, 0, 90, 0.7, 0.6, 1.2); L.position.set(sx * 6, top - 1, d / 2 - 0.4); L.target.position.set(sx * 3, 0, d / 2 + 16); s.group.add(L, L.target); return L; });
  game.scene.add(s.group);

  const st = { group: s.group, x, z, yaw, y: gy, deck: gy + h + 0.06, setScreen(tex) { screenMat.map = tex; screenMat.needsUpdate = true; }, on: false, near: false, t: 0, spots };
  const hsl = new THREE.Color();
  st.update = (dt, on, near, beat, night) => {
    const cam = game.camera.position;
    if (Math.hypot(cam.x - x, cam.z - z) > 700) return;
    st.t += dt; st.on = on; st.near = near;
    const t = st.t, k = on ? 1 : 0;
    // the screen: dark until the show
    if (screenMat.map) screenMat.color.setScalar(on ? 1 : 0.02);
    else screenMat.color.set(on ? 0x2a2f55 : 0x050507);
    for (let c = 0; c < chan.length; c++) {
      if (on) chan[c].mat.color.setHSL((t * 0.08 + c * 0.25 + beat * 0.05) % 1, 0.95, 0.42 + beat * 0.25);
      else if (near) chan[c].mat.color.set(c % 2 ? 0xffe2a8 : 0x1c1c1e);    // work lights for the sound check
      else chan[c].mat.color.set(0x141416);
    }
    beams.forEach((b, i) => {
      b.rotation.x = 0.55 + Math.sin(t * 0.9 + i) * 0.4 + beat * 0.15;
      b.rotation.z = Math.sin(t * 0.7 + i * 1.7) * 0.6;
      b.material.opacity = k * (0.05 + night * 0.2 + beat * 0.08);
      b.material.color.setHSL((i / beams.length + t * 0.05) % 1, 0.9, 0.55);
    });
    wash.material.opacity = k * (0.05 + night * 0.16 + beat * 0.07);
    wash.material.color.setHSL((t * 0.05) % 1, 0.9, 0.5);
    spots.forEach((L, i) => { L.intensity = k * night * (90 + beat * 120); L.color.setHSL((t * 0.06 + i * 0.4) % 1, 0.8, 0.6); });
    void hsl;
  };
  return st;
}

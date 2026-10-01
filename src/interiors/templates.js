// Interior layouts by building type. Each template fills a Plan with furniture, boards,
// seats, NPC spots (with the hours they are occupied) and activities.
import * as THREE from 'three';
import { Plan, textTex } from './room.js';
import { AN } from '../crowd/people.js';
import { OPT } from '../crowd/looks.js';
import { canvasTexture } from '../util.js';
import { MEALS, mealNow, nextMeal, messMenu, menuItems, platePlan, gravyColor } from '../mess/menu.js';
import { LAY } from '../mess/flow.js';

// ---------------------------------------------------------------- menus & timetables
export { MEALS, mealNow, nextMeal, messMenu };
export const CANTEEN_MENU = [['Masala noodles', 40, 25], ['Cheese noodles', 55, 30], ['Egg noodles', 55, 32], ['Bread omelette', 40, 28], ['Egg roll', 50, 30], ['Paneer roll', 65, 34], ['Chicken roll', 75, 40], ['Veg fried rice', 80, 40], ['Chai', 12, 8], ['Cold coffee', 45, 14, 'focus']];
const within = (h, a, b) => h >= a && h < b;
const occ = (list) => (h) => { for (const [a, b, p] of list) if (within(h, a, b)) return p; return 0.02; };
export const MEAL_OCC = occ([[7.5, 9.5, 0.75], [12.25, 14, 0.9], [19.75, 21.75, 0.9]]);
const CLASS_OCC = occ([[8.9, 13, 0.85], [14, 17, 0.6]]);
const LIB_OCC = occ([[9, 13, 0.35], [13, 17, 0.45], [17, 20, 0.5], [20, 24, 0.85], [0, 1.5, 0.4]]);
const STAFF = occ([[9, 17.5, 0.95]]);
const ALWAYS = () => 1;

function boardText(lines, title) { return textTex(lines, { w: 1024, h: 512, bg: '#1d3a2b', fg: '#eef2e8', size: 34, title, titleColor: '#f2e6a2', font: '"Segoe Print", "Comic Sans MS", "Hind", sans-serif' }); }
function notice(title, lines) { return textTex(lines, { w: 512, h: 512, bg: '#efe9da', fg: '#2b2622', size: 26, title, titleColor: '#7d1f1f' }); }
function poster(title, sub, bg) {
  return canvasTexture(256, 360, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 34px "Hind", "Segoe UI", sans-serif';
    const words = title.split(' ');
    words.forEach((t, i) => g.fillText(t, w / 2, 90 + i * 40));
    g.font = '20px "Hind", "Segoe UI", sans-serif'; g.fillText(sub, w / 2, h - 40);
  }, { repeat: false });
}

/** a presenter PC on a podium (monitor, keyboard, mouse; the monitor faces the speaker behind the podium). Standing behind it
 *  and pressing E lets you use IITG OS: sign in (user iitg, password iitg) and whatever you open is on the hall's big screen. */
function presenterPC(P, ctx, { x, y, z, mon, ident }) {
  const scr = canvasTexture(256, 144, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1c3f7a'); gr.addColorStop(1, '#0e1f3f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = 'bold 24px "Hind", sans-serif'; g.textAlign = 'center'; g.fillText('IITG OS', w / 2, h / 2 - 4);
    g.font = '13px "Hind", sans-serif'; g.fillText('Presenter PC', w / 2, h / 2 + 18);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, h - 14, w, 14);
  }, { repeat: false });
  P.box(x, y, z, 0.26, 0.02, 0.2, '#202225', { collide: false });
  P.box(x, y + 0.02, z, 0.05, 0.14, 0.03, '#202225', { collide: false });
  P.box(x, y + 0.16, z, 0.6, 0.36, 0.035, '#07080a', { collide: false });
  P.panel(x, y + 0.34, z - 0.02, 0.54, 0.3, Math.PI, scr, { emissive: 0.9 });
  P.box(x, y, z - 0.34, 0.46, 0.02, 0.16, '#2a2d31', { collide: false });
  P.box(x + 0.34, y, z - 0.34, 0.06, 0.025, 0.1, '#2a2d31', { collide: false });
  const stand = { x, z: z - 1.0, yaw: 0, y: P.floorAt(z - 1.0) };
  P.act(stand.x, stand.z, 'Presenter PC: show anything on the big screen (IITG OS)', () => ctx.go('pc', { big: true, mon, stand, ident }), { r: 2.2, dy: 3 });
  // and the way a laptop is plugged into the projector: share a real window or tab of this computer on the big screen
  P.act(stand.x + 1.7, stand.z, () => (ctx.g.screens?.presenting ? 'Stop presenting (the big screen goes back to the film)' : 'Present / share your screen on the big screen'), () => ctx.g.screens?.present(), { r: 1.7, dy: 3 });
}

// ---------------------------------------------------------------- templates
export const TEMPLATES = {
  hostel(ctx) {
    const P = new Plan(`${ctx.name}`, 34, 30, 4.2, { floor: 'tiles', wall: '#efe6d0', seed: ctx.seed });
    const wd = ctx.weekday, meal = mealNow(ctx.hour) || nextMeal(ctx.hour);
    // lobby: security desk, name board, notice board, pigeon-hole letter boxes
    P.counter(-11, 11.5, 3, 0.8, '#8a6a4a');
    P.securityDesk = { x: -11, z: 11.5 };
    P.spot(-11, 10.5, 0, AN.SIT, { role: 'guard', when: ALWAYS });
    // the stairs up to the canteen on the 2nd floor: a flight you walk up, along the west wall, 10 steps to a landing and a door
    {
      const X0 = -16.9, X1 = -15.1, XC = (X0 + X1) / 2, Z0 = 11.3, RUN = 0.27, RISE = 0.2, N = 10, ZL = Z0 + N * RUN;
      for (let k = 1; k <= N; k++) {
        const z0 = Z0 + (k - 1) * RUN, z1 = Z0 + k * RUN;
        P.box(XC, 0, (z0 + z1) / 2, X1 - X0, RISE * k, RUN, k % 2 ? '#b9ad97' : '#aa9e88', { collide: false });
        P.tier(z0, z1, RISE * k, X0, X1);
      }
      P.box(XC, 0, (ZL + 15) / 2, X1 - X0, RISE * N, 15 - ZL, '#c2b7a1', { collide: false });      // the landing
      P.tier(ZL, 15, RISE * N, X0, X1);
      P.colliders.push({ x0: X1, x1: X1 + 0.08, z0: Z0 - 0.05, z1: 15, top: 9 });                   // the open side: you cannot step off
      for (let k = 0; k <= N; k++) { P.box(X1 + 0.03, RISE * k, Z0 + 0.12 + k * RUN, 0.05, 0.95, 0.05, '#5a4632', { collide: false }); P.box(X1 + 0.03, RISE * k + 0.93, Z0 + k * RUN + RUN / 2, 0.06, 0.05, RUN + 0.02, '#5a4632', { collide: false }); }
      P.box(X1 + 0.03, RISE * N + 0.93, (ZL + 15) / 2, 0.06, 0.05, 15 - ZL, '#5a4632', { collide: false });
      P.box(XC, RISE * N, 14.94, 1.2, 1.8, 0.05, '#6b4a2f', { collide: false });                     // the door to the canteen, on the front wall above the landing
      P.panel(XC, RISE * N + 2.0, 14.93, 1.5, 0.3, Math.PI, textTex(['CANTEEN'], { w: 384, h: 96, bg: '#7a2630', size: 54, align: 'center' }));
      P.panel(-16.9, 3.3, 12.6, 1.9, 0.45, Math.PI / 2, textTex(['CANTEEN · 2nd FLOOR ↑'], { w: 512, h: 128, bg: '#7a2630', size: 44, align: 'center' }));   // on the wall, above the stairs
      P.windows = P.windows.filter((w) => !(w.x < -16.5 && w.z > 10.5));                                // no window behind the stairs
      P.act(XC, 14.35, 'Go through the door to the canteen (2nd floor, 6 PM - 2 AM)', () => ctx.upstairs(), { r: 1.3, dy: 1.6, canteen: true, ok: () => (ctx.canteenOpen() ? true : 'the canteen opens at 6 PM') });
      if (ctx.from === 'canteen') P.spawn = { x: XC, z: Z0 - 1.0, yaw: Math.PI };                       // coming back down: at the foot of the stairs
    }
    // the door to the facilities wing (library, gym, music room, TV room) on the east wall by the front door
    P.box(16.93, 0, 12.4, 0.08, 2.3, 1.4, '#6b4a2f', { collide: false });
    P.panel(16.88, 2.75, 12.4, 2.6, 0.5, -Math.PI / 2, textTex(['FACILITIES WING', 'Library · Gym · Music · TV'], { w: 640, h: 120, bg: '#1f3a5f', size: 40, align: 'center' }));
    P.act(15.9, 12.4, 'Go to the facilities wing (library, gym, music room, TV room)', () => ctx.wing(), { r: 1.6, dy: 1.6 });
    if (ctx.from === 'hostelwing') P.spawn = { x: 15.2, z: 12.4, yaw: -Math.PI / 2 };
    P.panel(0, 3.3, 14.87, 6, 0.8, Math.PI, textTex([ctx.name.toUpperCase()], { w: 1024, h: 128, bg: '#7d1f1f', size: 70, align: 'center' }));
    P.board(-16.92, 1.2, -5, 2.4, 1.6, Math.PI / 2, notice('NOTICE BOARD', ['Hostel general body meeting: Sunday 6 PM', 'Mess committee elections next week', 'Inter-hostel cricket: register by Friday', 'Keep your cycles in the stand', 'Water supply off 2-4 PM Thursday']));
    // mess hall (left wing)
    P.box(-5, 0, 0, 0.25, 4.2, 14, '#efe6d0');           // partition
    P.box(-5, 0, -11, 0.25, 4.2, 8, '#efe6d0');
    P.panel(-5.14, 3.1, 4.5, 2.6, 0.5, -Math.PI / 2, textTex(['MESS'], { w: 512, h: 96, bg: '#2f5d5a', size: 60, align: 'center' }));
    // the serving counter: steel containers of today's rice, dal, sabji, curd... behind a counter, servers with ladles
    P.counter(-13, -12.5, 7, 0.9, '#b9ad97', 0);
    {
      const plan = platePlan(menuItems(meal.id, wd), meal.id), pot = { rice: '#f5f1e3', dal: '#d9a634', sabji: '#b5651d', curd: '#f3f0e6', sweet: '#e8b45a', roti: '#d8b26f', salad: '#86b45a', papad: '#e8cc90', snack: '#c98a3a', pickle: '#6a3a12' };
      const order = ['rice', 'dal', 'sabji', 'sabji', 'roti', 'curd'];
      const used = [];
      for (let k = 0; k < 6; k++) {
        const kind = order[k], x = -15.8 + k * 1.1;
        P.steel(x, 1.0, -12.6, 0.3, 0.42);
        const it = plan.filter((q) => q.kind === kind && !used.includes(q))[0] || plan.find((q) => q.kind === 'sweet' && !used.includes(q));
        if (it) used.push(it);
        P.cyl(x, 1.42, -12.6, 0.27, 0.02, it && it.kind === 'sabji' ? gravyColor(it.name) : pot[it?.kind || kind]);
      }
    }
    P.box(-13, 0, -14.4, 8, 2.2, 0.6, '#c7ccd1');        // kitchen wall / racks
    P.board(-13, 2.2, -14.05, 3.6, 1.6, 0, boardText([`${meal.name}: ${messMenu(meal.id, wd)}`, `Tomorrow ${MEALS[0].name.toLowerCase()}: ${messMenu('breakfast', wd + 1)}`, 'Guest coupon ₹50 breakfast · ₹75 lunch · ₹75 dinner · ₹90 Sunday special', 'Please return your plate at the rack'], `Today's menu · ${ctx.dayName}`), { key: 'menu' });
    for (let k = 0; k < 4; k++) P.spot(-15.6 + k * 1.7, -13.4, 0, AN.SERVE, { role: 'mess', when: occ([[6.5, 22, 1]]) });
    P.act(-13, -11.6, () => ctx.g.mess.serveLabel(), () => ctx.go('messServe', {}), { r: 3.2, ok: () => ctx.g.mess.serveOk(ctx.g.interior) });
    // the payment counter (mess card for your own hostel, cash or UPI for a guest), the plates and the plate-return rack
    P.counter(LAY.desk.x, LAY.desk.z, LAY.desk.w, 0.7, '#8a6a4a', 0, 0.95);
    P.spot(LAY.clerk.x, LAY.clerk.z, 0, AN.TYPE, { role: 'mess', when: occ([[6.5, 22, 1]]) });
    P.panel(LAY.desk.x, 1.5, LAY.desk.z + 0.4, 1.5, 0.4, Math.PI, textTex(['MESS COUNTER', 'Mess card · Cash · UPI'], { w: 512, h: 128, bg: '#1f5a3d', size: 38, align: 'center' }));
    P.box(LAY.desk.x + 0.75, 0.99, LAY.desk.z + 0.1, 0.3, 0.16, 0.02, '#111', { collide: false });
    P.act(LAY.desk.x, LAY.desk.z + 1.1, () => (ctx.g.mess.coupon(ctx.g.interior) ? 'Mess counter (you have your coupon)' : ctx.g.mess.isOwn(ctx.g.interior) ? 'Mess counter: show your mess card' : 'Mess counter: pay for a guest coupon'), () => ctx.go('messPay', {}), { r: 2.4, ok: () => (mealNow(ctx.g.clock.hour) ? true : `the mess is closed: ${nextMeal(ctx.g.clock.hour).name.toLowerCase()} at ${fmt(nextMeal(ctx.g.clock.hour).from)}`) });
    P.table(LAY.plates.x, LAY.plates.z, LAY.plates.w, 0.6, '#c7ccd1', 0.9);
    for (const dx of [-0.6, 0, 0.6]) P.cyl(LAY.plates.x + dx, 0.9, LAY.plates.z, 0.19, 0.2, '#c9ced3');
    P.panel(LAY.plates.x, 1.5, LAY.plates.z - 0.32, 1.2, 0.3, 0, textTex(['STEEL PLATES'], { w: 384, h: 96, bg: '#2f5d5a', size: 46, align: 'center' }));
    P.act(LAY.platesAt.x, LAY.platesAt.z - 0.2, 'Take a steel plate', () => ctx.g.mess.takePlate(ctx.g.interior), { r: 1.9 });
    P.box(LAY.ret.x, 0, LAY.ret.z, 0.6, 1.1, 1.8, '#c7ccd1');
    for (let k = 0; k < 4; k++) P.cyl(LAY.ret.x, 1.1 + k * 0.0, LAY.ret.z - 0.6 + k * 0.4, 0.17, 0.05 + (k % 2) * 0.03, '#a9b0b6');
    P.panel(LAY.ret.x + 0.32, 1.7, LAY.ret.z, 1.4, 0.34, Math.PI / 2, textTex(['PLATE RETURN'], { w: 448, h: 96, bg: '#7a2630', size: 44, align: 'center' }));
    P.act(LAY.retAt.x, LAY.retAt.z, () => ctx.g.mess.returnLabel(), () => ctx.g.mess.returnPlate(), { r: 1.7, ok: () => ctx.g.mess.returnOk() });
    // long tables and benches (the diners walk in, queue, eat and leave: mess/flow.js)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
      const x = -13.5 + c * 5.5, z = -6.5 + r * 4.4;
      P.table(x, z, 4.4, 0.9, '#8a6a4a', 0.76);
      for (const s of [-1, 1]) {
        P.bench(x, z + s * 0.85, 4.2, 0, '#6b5a44');
        for (let k = 0; k < 5; k++) {
          const sx = x - 1.8 + k * 0.9, yaw = s > 0 ? Math.PI : 0;
          P.seat(sx, z + s * 0.8, yaw, 0, { mess: true });
        }
      }
    }
    P.cyl(-6.1, 0, -9.5, 0.35, 1.4, '#9aa3ab', { collide: true });   // water cooler
    // the wash area on the west wall: a granite counter on a steel cabinet with three basins, a tap over each (E turns it on and off, the water
    // runs, splashes and sounds), a mirror over each, a soap dispenser, a hand dryer, a towel rail and a bin
    {
      const tap = [false, false, false], BZ = [2.0, 3.2, 4.4], nc = { collide: false, cast: false };
      P.box(-16.7, 0, 3.2, 0.56, 0.82, 4.2, '#cfd6db');                                                      // the cabinet (doors below)
      for (let k = 0; k < 4; k++) P.box(-16.41, 0.08, 1.35 + k * 1.1, 0.02, 0.66, 0.98, '#e6ebee', nc);     // its doors
      for (let k = 0; k < 4; k++) P.box(-16.4, 0.44, 1.35 + k * 1.1 + 0.4, 0.02, 0.02, 0.1, '#9aa0a6', nc);  // their handles
      P.box(-16.66, 0.82, 3.2, 0.64, 0.05, 4.3, '#2f3338');                                                  // the granite top
      const mirror = canvasTexture(256, 288, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#dfeaf0'); gr.addColorStop(0.45, '#b9ccd6'); gr.addColorStop(1, '#e8f0f4');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(w * 0.12, 0); g.lineTo(w * 0.34, 0); g.lineTo(w * 0.06, h); g.lineTo(-w * 0.1, h); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(w * 0.42, 0); g.lineTo(w * 0.5, 0); g.lineTo(w * 0.22, h); g.lineTo(w * 0.14, h); g.closePath(); g.fill();
      }, { repeat: false });
      BZ.forEach((z, i) => {
        P.cyl(-16.62, 0.87, z, 0.26, 0.11, '#f4f6f7', { seg: 20, r2: 0.22 });                                // the basin (a vessel bowl on the top)
        P.cyl(-16.62, 0.975, z, 0.205, 0.012, '#c3d0d8', { seg: 20 }); P.cyl(-16.62, 0.986, z, 0.02, 0.006, '#6b7378', { seg: 8 });   // the water well and the drain
        P.cyl(-16.9, 0.87, z, 0.03, 0.36, '#cfd4d9', { seg: 10 }); P.box(-16.82, 1.22, z, 0.2, 0.03, 0.03, '#cfd4d9', nc); P.cyl(-16.73, 1.14, z, 0.018, 0.09, '#cfd4d9', { seg: 8 });   // the tap: a tall stem, the spout, the nozzle
        P.box(-16.9, 1.16, z + 0.09, 0.03, 0.03, 0.12, '#8a9096', nc);                                         // its lever
        P.box(-16.985, 1.5, z, 0.03, 1.12, 0.98, '#3a3f44', nc);                                              // the mirror's frame
        P.panel(-16.962, 1.5, z, 0.92, 1.06, Math.PI / 2, mirror);                                            // the mirror
        P.tubeLight(-16.6, z);
        P.act(-16.0, z, () => (tap[i] ? 'Turn the tap off' : 'Wash your hands (turn the tap on)'), () => { tap[i] = !tap[i]; ctx.g.audio?.click?.(); if (tap[i]) ctx.g.ui.toast('The water runs. Cold, as ever.', 'info', 'Wash basin'); }, { r: 1.0 });
      });
      P.windows = P.windows.filter((w) => !(w.x < -16.5 && w.z > 0.8 && w.z < 5.9));                 // no window behind the mirrors
      P.cyl(-16.82, 0.87, 5.1, 0.04, 0.2, '#e86f9c', { seg: 8 }); P.cyl(-16.82, 1.07, 5.1, 0.014, 0.08, '#d9d9d9', { seg: 6 });   // the soap dispenser
      P.box(-16.93, 1.35, 6.2, 0.12, 0.3, 0.34, '#eceff1', nc); P.box(-16.865, 1.28, 6.2, 0.02, 0.06, 0.24, '#444a50', nc);        // the hand dryer
      P.box(-16.93, 1.1, 0.7, 0.06, 0.05, 0.7, '#9aa0a6', nc); P.box(-16.9, 0.78, 0.7, 0.06, 0.4, 0.62, '#4d82b8', nc);          // a towel rail, a towel on it
      P.cyl(-16.4, 0, 6.6, 0.17, 0.42, '#4d5a63', { seg: 12 });                                                                     // a dust bin
      P.panel(-16.97, 2.55, 3.2, 1.6, 0.26, Math.PI / 2, textTex(['WASH AREA · Please close the tap'], { w: 640, h: 96, bg: '#1f5f8f', size: 36, align: 'center' }));
      // the running water: a thin jet from each nozzle to its basin, rings on the water, a mist of drops, a trickle of sound
      P.dyn((group) => {
        const jetMat = new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.6, depthWrite: false });
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
        const dropMat = new THREE.MeshBasicMaterial({ color: 0xe6f4ff, transparent: true, opacity: 0.8, depthWrite: false });
        const bits = BZ.map((z) => {
          const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.03, 8), jetMat); jet.position.set(-16.73, 1.06, z); jet.visible = false; group.add(jet);
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.04, 20).rotateX(-Math.PI / 2), ringMat); ring.position.set(-16.73, 0.99, z); ring.visible = false; group.add(ring);
          const drops = Array.from({ length: 7 }, () => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.007, 5, 4), dropMat); d.visible = false; group.add(d); return { d, t: Math.random(), a: Math.random() * 6.28 }; });
          return { z, jet, ring, drops };
        });
        let snd = 0, t = 0;
        return {
          update(dt) {
            t += dt; snd -= dt;
            let any = false;
            bits.forEach((b, i) => {
              const on = tap[i]; b.jet.visible = b.ring.visible = on; any = any || on;
              b.drops.forEach((q) => { q.d.visible = on; });
              if (!on) return;
              const len = 0.152 + Math.sin(t * 40 + i) * 0.006; b.jet.scale.set(1 + Math.sin(t * 31 + i) * 0.1, len / 0.03, 1); b.jet.position.y = 1.14 - len / 2;
              const rp = (t * 1.6 + i * 0.3) % 1; b.ring.scale.setScalar(1 + rp * 4); b.ring.material.opacity = 0.5 * (1 - rp);
              b.drops.forEach((q) => { q.t += dt * 1.8; if (q.t > 1) { q.t = 0; q.a = Math.random() * 6.28; } const r = 0.03 + q.t * 0.13; q.d.position.set(-16.73 + Math.cos(q.a) * r, 0.995 + Math.sin(q.t * 3.14) * 0.09, b.z + Math.sin(q.a) * r); });
            });
            if (any && snd <= 0) { snd = 0.4; ctx.g.audio?.noise?.(0.5, { f: 2800, q: 0.4, type: 'highpass', gain: 0.03 }); }
          },
        };
      });
    }
    P.fan(-12, -4); P.fan(-8, -4); P.fan(-12, 3); P.fan(-8, 3);
    // services: split air-conditioners in the common room, each with its 16 A AC point; Wi-Fi access points on a ceiling cable
    // tray fed from the network rack; and the water lines (risers) to the wash basins, the cooler and the purifier
    {
      const nc = { collide: false, cast: false };
      for (const z of [-8, 0, 6]) {
        P.box(16.76, 2.75, z, 0.36, 0.3, 1.05, '#f4f4f0', { collide: false });
        P.box(16.58, 2.64, z, 0.03, 0.05, 0.85, '#8a9299', nc);
        P.box(16.57, 2.9, z + 0.4, 0.02, 0.03, 0.03, '#39d353', nc);
        P.box(16.93, 2.6, z + 0.78, 0.04, 0.14, 0.14, '#f2f0ea', nc);                       // the AC point
        P.box(16.905, 2.66, z + 0.78, 0.01, 0.03, 0.03, '#d33', nc);
      }
      P.panel(16.95, 1.5, -4, 1.1, 0.28, -Math.PI / 2, textTex(['AC POINT 16 A'], { w: 384, h: 96, bg: '#7a2630', size: 40, align: 'center' }));
      for (const z of [-2, 4, 10]) { P.box(16.93, 0.4, z, 0.05, 0.12, 0.12, '#f2f0ea', nc); P.box(16.93, 1.1, z + 0.4, 0.05, 0.12, 0.12, '#f2f0ea', nc); }   // sockets by the sofas and the desks
      P.box(-16.45, 0, 8.6, 0.7, 2.0, 0.7, '#23272b');                                       // the network rack by the lobby desk
      for (let k = 0; k < 6; k++) P.box(-16.08, 0.6 + k * 0.22, 8.45 + (k % 2) * 0.3, 0.02, 0.04, 0.04, k % 3 ? '#39d353' : '#f0a020', nc);
      P.panel(-16.08, 2.3, 8.6, 0.7, 0.22, Math.PI / 2, textTex(['NETWORK · WiFi'], { w: 320, h: 96, bg: '#1f3a6e', size: 36, align: 'center' }));
      P.box(-2, 4.12, 0, 0.14, 0.06, 29, '#2c3136', nc);                                       // the cable tray along the ceiling
      for (const [x, z] of [[-11, -10], [-11, 0], [-11, 9], [11, -8], [11, 3], [0, -12]]) {
        P.box(-2 + (x - -2) / 2, 4.12, z, Math.abs(x + 2), 0.04, 0.05, '#2c3136', nc);        // a branch to each access point
        P.cyl(x, 4.0, z, 0.15, 0.06, '#f2f3f4'); P.cyl(x, 3.98, z, 0.05, 0.03, '#39d353');
      }
      for (const z of [0.9, 5.7]) P.cyl(-16.88, 0, z, 0.055, 4.1, '#c4c8cc');                  // risers (the feed to the basins runs inside the cabinet)
      P.box(-16.86, 0.35, 3.3, 0.05, 0.05, 4.8, '#c4c8cc', nc);
      P.cyl(-6.1, 1.8, -9.5, 0.04, 2.4, '#c4c8cc');                                             // the cooler's water line
      P.box(-6.35, 0.3, -8.4, 0.4, 0.9, 0.3, '#eef1f3');                                        // the water purifier (RO)
      P.panel(-6.15, 1.45, -8.4, 0.6, 0.2, Math.PI / 2, textTex(['RO WATER'], { w: 256, h: 80, bg: '#1f5f8f', size: 34, align: 'center' }));
    }
    for (const z of [-8, -1, 6]) { P.tubeLight(-13, z); P.tubeLight(-8, z); }
    // common room (right wing): TV, sofas, carrom, table tennis
    P.box(5, 0, -4, 0.25, 4.2, 22, '#efe6d0');
    P.box(15.5, 0, -2, 0.8, 1.1, 1.8, '#5a4632');
    P.panel(15.05, 1.8, -2, 2.1, 1.2, -Math.PI / 2, ctx.tvTex, { emissive: 1, key: 'tv' });
    const sofas = [...P.sofa(11, -4.5, 2.6, Math.PI / 2), ...P.sofa(11, 0.5, 2.6, Math.PI / 2)];
    sofas.forEach((s) => P.spot(s.x, s.z, s.yaw, AN.SIT, { role: 'student', when: occ([[13, 15, 0.4], [21, 24.5, 0.8], [17, 19, 0.4]]), clap: true, seat: s }));
    P.act(12, -2, 'Watch TV (cricket highlights)', () => ctx.go('tv', { seat: sofas[1] }));
    P.table(9, -10.5, 0.9, 0.9, '#c89b3c', 0.7); // carrom board
    for (const [dx, dz, yaw] of [[-0.9, 0, Math.PI / 2], [0.9, 0, -Math.PI / 2], [0, -0.9, 0], [0, 0.9, Math.PI]]) P.spot(9 + dx, -10.5 + dz, yaw, AN.SIT, { role: 'student', when: occ([[20, 24.5, 0.7], [13.5, 15, 0.3]]) });
    P.table(12.5, 7, 2.7, 1.5, '#1f5a3d', 0.76);
    P.box(12.5, 0.76, 7, 0.02, 0.15, 1.5, '#f2f0ea', { collide: false });
    P.spot(10.5, 7, Math.PI / 2, AN.STAND, { role: 'student', when: occ([[17, 19, 0.6], [21, 24, 0.7]]) });
    P.spot(14.5, 7, -Math.PI / 2, AN.STAND, { role: 'student', when: occ([[17, 19, 0.6], [21, 24, 0.7]]) });
    P.act(12.5, 5.2, 'Play table tennis', () => ctx.go('tt', {}));
    for (const z of [-8, 0, 7]) { P.tubeLight(10, z); P.fan(10.5, z); }
    // your room at the back (your hostel only) / friends' rooms
    P.box(-2.9, 0, -9, 4.6, 3.0, 0.2, '#efe6d0'); P.box(2.9, 0, -9, 4.6, 3.0, 0.2, '#efe6d0');
    P.box(-3.2, 0, -12, 0.2, 3.0, 6, '#efe6d0');
    P.box(3.2, 0, -12, 0.2, 3.0, 6, '#efe6d0');
    P.bed(-1.8, -13, 0);
    P.desk(1.4, -12.6, Math.PI / 2, { pc: true, lamp: true });
    P.shelf(1.8, -14.6, 1.6, 0, 1.9);
    P.panel(0, 2.3, -14.84, 1.2, 0.8, 0, poster('ALCHERINGA', 'IIT Guwahati', '#6b2d8a'));
    P.panel(-1.6, 2.0, -8.88, 1.0, 0.5, 0, textTex([ctx.yours ? 'Your room' : 'Room 214'], { w: 256, h: 96, bg: '#6b4a2f', size: 40, align: 'center' }));
    if (ctx.noRooms) P.act(-1.8, -11.5, 'Rooms: residents only (visitors stay in the common areas)', () => ctx.g.ui.toast('Visitors are welcome in the mess and the common room, but the rooms are for residents only.', 'info', 'Hostel rules'));
    else P.act(-1.8, -11.5, ctx.yours ? 'Sleep / nap in your room' : 'Rest here (a friend\'s room)', () => ctx.go('sleep', {}));
    P.act(1.2, -12.2, 'Study at your desk', () => ctx.go('study', { place: 'room' }));
    P.spot(-1.2, -11.3, Math.PI, AN.SITCHAT, { role: 'student', when: occ([[21, 24.5, 0.6]]), y: 0 });
    return P;
  },

  /** The hostel's facilities wing (one floor of its own, up the stairs from the lobby): a LIBRARY, a GYM, a MUSIC ROOM and a TV ROOM round a
   *  cross-shaped corridor, each with the things such a room has. Every hostel has one. */
  hostelwing(ctx) {
    const P = new Plan(`${ctx.name} · facilities`, 34, 30, 4.2, { floor: 'tiles', wall: '#efe6d0', seed: ctx.seed + 11 });
    const WALL = '#efe6d0', nc = { collide: false, cast: false };
    const steel = '#5e6268', chrome = '#c9ced4', rubber = '#1a1a1c';
    // ---- the shell inside: four rooms round a cross of corridors; each door is on a corridor wall, with its sign over it
    const vwall = (x, z0, z1) => P.box(x, 0, (z0 + z1) / 2, 0.2, 4.2, z1 - z0, WALL);
    const hwall = (z, x0, x1, gap) => {
      if (!gap) { P.box((x0 + x1) / 2, 0, z, x1 - x0, 4.2, 0.2, WALL); return; }
      const [g0, g1] = gap;
      if (g0 > x0) P.box((x0 + g0) / 2, 0, z, g0 - x0, 4.2, 0.2, WALL);
      if (x1 > g1) P.box((g1 + x1) / 2, 0, z, x1 - g1, 4.2, 0.2, WALL);
      P.box((g0 + g1) / 2, 2.5, z, g1 - g0, 1.7, 0.2, WALL, { collide: false });
    };
    vwall(-1.5, -15, -1.5); vwall(1.5, -15, -1.5); vwall(-1.5, 1.5, 15); vwall(1.5, 1.5, 15);
    hwall(-1.5, -17, -1.5, [-9.5, -7.5]); hwall(-1.5, 1.5, 17, [7.5, 9.5]); hwall(1.5, -17, -1.5, [-9.5, -7.5]); hwall(1.5, 1.5, 17, [7.5, 9.5]);
    const sign = (x, z, rot, a, b, col) => { P.panel(x, 3.45, z, 2.4, 0.5, rot, textTex([a, b], { w: 576, h: 120, bg: col, size: 40, align: 'center' })); };
    sign(-8.5, -1.37, 0, 'LIBRARY', 'Silence please', '#1f3a5f'); sign(8.5, -1.37, 0, 'TV ROOM', 'Common room', '#7a2630');
    sign(-8.5, 1.37, Math.PI, 'GYM', 'Weights · Cardio', '#2f5d5a'); sign(8.5, 1.37, Math.PI, 'MUSIC ROOM', 'Jam · Practice', '#6b2d8a');
    // the door we came in by (the shell's front door is shut: this is the way back down to the lobby)
    P.box(0, 0, 14.88, 2.8, 4.2, 0.2, WALL);
    P.box(0, 0, 14.78, 1.5, 2.25, 0.06, '#6b4a2f', nc);
    P.panel(0, 2.75, 14.74, 1.9, 0.34, Math.PI, textTex(['LOBBY · STAIRS ↓'], { w: 448, h: 80, bg: '#7a2630', size: 40, align: 'center' }));
    P.exit = { x: 0, z: 200 };
    P.spawn = { x: 0, z: 12.6, yaw: Math.PI };
    P.act(0, 13.7, 'Go back down to the hostel lobby', () => ctx.downstairs(), { r: 1.7, dy: 1.6 });
    // the corridor: a notice board, a water cooler, a shoe rack, lights, a plant
    P.board(1.42, 1.3, 9.5, 2.0, 1.4, -Math.PI / 2, notice('FACILITIES', ['Library 8 AM - 2 AM', 'Gym 6 - 9 AM, 4 - 10 PM', 'Music room: book a slot', 'TV room: quiet after 12']));
    P.cyl(-1.0, 0, 6, 0.28, 1.15, '#9aa3ab', { collide: true }); P.panel(-1.0, 1.4, 6, 0.5, 0.18, Math.PI, textTex(['DRINKING WATER'], { w: 256, h: 64, bg: '#1f5f8f', size: 26, align: 'center' }));
    P.plant(0.9, 3.4); P.plant(-0.9, -3.4);
    for (const z of [10, 5, 0, -5, -10]) P.tubeLight(0, z);
    for (const x of [-12, -4, 4, 12]) P.tubeLight(x, 0);
    // ================================================================= LIBRARY (north-west)
    {
      const LIB = occ([[8, 13, 0.3], [14, 18, 0.4], [19, 24, 0.8], [0, 2, 0.3]]);
      for (let r = 0; r < 5; r++) P.shelf(-16.3, -13.4 + r * 2.4, 2.2, Math.PI / 2, 2.4);                // the west wall, floor to ceiling
      for (let c = 0; c < 4; c++) P.shelf(-13.2 + c * 3.5, -14.3, 3.1, 0, 2.3);                          // the north wall
      P.shelf(-11, -10.2, 3.0, 0, 2.0); P.shelf(-7.5, -10.2, 3.0, 0, 2.0); P.shelf(-4, -10.2, 3.0, 0, 2.0);   // free-standing stacks
      P.panel(-8.5, 3.3, -14.86, 3.2, 0.42, 0, textTex(['REFERENCE · TEXTBOOKS · JOURNALS'], { w: 768, h: 96, bg: '#1f3a5f', size: 34, align: 'center' }));
      P.panel(-16.87, 3.3, -8.4, 3.0, 0.42, Math.PI / 2, textTex(['FICTION · COMICS · MAGAZINES'], { w: 768, h: 96, bg: '#7a2630', size: 34, align: 'center' }));
      for (const [tx, tz] of [[-13, -6.8], [-4.5, -6.8], [-13, -3.9], [-4.5, -3.9]]) {                  // four reading tables with a lamp each, four chairs
        P.table(tx, tz, 2.8, 1.2, '#7a5a3a', 0.76);
        for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const seat = P.chair(tx - 0.7 + k * 1.4, tz + s * 0.9, s > 0 ? Math.PI : 0, '#6b4a2f'); P.spot(seat.x, seat.z, seat.yaw, AN.STUDY, { role: 'student', when: LIB, opts: [OPT.BOOK], seat }); }
        P.box(tx, 0.76, tz, 0.16, 0.34, 0.16, '#2b6a3d', nc); P.box(tx, 1.1, tz, 0.4, 0.05, 0.4, '#2b6a3d', nc);
        P.lamps.push({ x: tx, y: 1.3, z: tz });
      }
      P.act(-13, -5.4, 'Study at a reading table (hostel library)', () => ctx.go('study', { place: 'library' }), { r: 2.6 });
      P.counter(-3.4, -13.5, 3.4, 0.8, '#6b4a2f');                                                       // the librarian's desk
      P.spot(-3.4, -14.3, 0, AN.TYPE, { role: 'staff', when: occ([[9, 24, 1]]) });
      P.box(-3.4, 1.0, -13.5, 0.4, 0.3, 0.3, '#2a2d31', nc); P.box(-2.2, 1.0, -13.5, 0.3, 0.05, 0.4, '#f2f0ea', nc);   // a monitor, a register
      P.panel(-3.4, 2.2, -13.0, 1.8, 0.34, Math.PI, textTex(['ISSUE · RETURN'], { w: 448, h: 80, bg: '#1f3a5f', size: 40, align: 'center' }));
      P.act(-3.4, -12.0, 'Issue or return a book (hostel library desk)', () => ctx.go('libraryDesk', {}), { r: 2.2 });
      for (const z of [-12.6, -11.4]) P.desk(-2.0, z, -Math.PI / 2, { pc: true });                       // the catalogue computers
      P.box(-2.0, 0, -7.4, 0.9, 1.15, 0.5, '#7a5a3a'); for (let k = 0; k < 4; k++) P.box(-2.0, 0.55 + k * 0.17, -7.3, 0.7, 0.01, 0.4, ['#f4efe0', '#e8d9a8', '#cfd8e0', '#e0c0c0'][k], nc);   // the newspaper stand
      P.panel(-1.62, 1.8, -7.4, 0.8, 0.3, -Math.PI / 2, textTex(['NEWSPAPERS'], { w: 256, h: 80, bg: '#444', size: 30, align: 'center' }));
      P.sofa(-3.4, -3.0, 2.2, Math.PI);                                                                  // a reading sofa with a side table
      P.table(-5.8, -2.6, 0.7, 0.7, '#7a5a3a', 0.5);
      P.board(-8.5, 1.4, -1.62, 2.4, 1.4, Math.PI, notice('LIBRARY RULES', ['Silence please', 'No food or drinks', 'Return books in 14 days', 'Fine ₹2 / day']));
      P.panel(-13.3, 2.95, -1.62, 1.6, 0.9, Math.PI, poster('READ', 'a book a week', '#2e6f9a'));
      P.plant(-16.2, -2.2); P.plant(-2.0, -2.3);
      for (const x of [-13, -8, -3]) for (const z of [-12, -7, -3]) P.tubeLight(x, z);
      P.fan(-12, -7); P.fan(-5, -7); P.fan(-12, -3); P.fan(-5, -3);
    }
    // ================================================================= GYM (south-west)
    {
      const MORN = [[6, 9, 0.7]], EVE = [[16.5, 22, 0.8], [6, 9, 0.5]], DAY = [[6, 9.5, 0.6], [16, 22, 0.7]];
      P.box(-9, 0, 8.2, 14, 0.03, 12.6, '#3b3f45', nc);                                                  // the black rubber floor
      for (let x = -15.4; x <= -2.4; x += 1.5) P.box(x, 0.03, 8.2, 0.015, 0.002, 12.6, '#3a3d42', nc);   // its tile lines
      P.box(-9, 0.4, 14.82, 14.4, 2.2, 0.04, '#b8c8d0', nc);                                             // the mirror wall (south)
      P.box(-16.86, 0.4, 8.2, 0.04, 2.2, 10, '#b8c8d0', nc);                                             // the mirror wall (west)
      P.panel(-9, 3.3, 14.78, 4.4, 0.5, Math.PI, textTex(['HOSTEL GYM'], { w: 640, h: 96, bg: '#2f5d5a', size: 52, align: 'center' }));
      // cardio: three treadmills and two exercise bikes along the mirror
      for (let k = 0; k < 3; k++) { const x = -15.2 + k * 2.3;
        P.box(x, 0, 12.6, 0.9, 0.3, 1.9, '#2a2d31'); P.box(x, 0.3, 12.6, 0.8, 0.03, 1.7, '#111', nc); P.box(x - 0.4, 0.3, 11.9, 0.04, 0.95, 0.04, steel, nc); P.box(x + 0.4, 0.3, 11.9, 0.04, 0.95, 0.04, steel, nc);
        P.box(x, 1.1, 11.8, 0.7, 0.18, 0.1, '#0b0d10', nc); P.box(x, 1.12, 11.76, 0.4, 0.1, 0.01, '#39d353', nc);
        if (k !== 2) P.spot(x, 12.4, Math.PI, AN.RUN, { role: 'student', when: occ(MORN), y: 0.3 }); }
      for (let k = 0; k < 2; k++) { const x = -7.4 + k * 1.6;
        P.box(x, 0, 13.4, 0.5, 0.05, 1.1, steel); P.box(x, 0.05, 13.0, 0.12, 0.9, 0.12, steel); P.cyl(x, 0.55, 13.7, 0.27, 0.07, '#2a2d31', { seg: 14 }); P.box(x, 0.95, 12.95, 0.5, 0.05, 0.1, rubber, nc); P.box(x, 0.65, 13.9, 0.3, 0.08, 0.3, rubber, nc);
        P.spot(x, 13.6, Math.PI, AN.SIT, { role: 'student', when: occ(DAY), y: 0.62 }); }
      P.act(-6.6, 11.8, 'Ride an exercise bike (cardio)', () => ctx.go('gym', {}), { r: 2.0 });
      P.act(-14.0, 11.0, 'Run on a treadmill', () => ctx.go('treadmill', { at: { x: -14.9, z: 12.4, y: 0.3, yaw: Math.PI } }), { r: 1.8 });
      // free weights: a flat bench with a loaded bar, a squat rack, an adjustable bench, a dumbbell rack, a plate tree, kettlebells
      P.box(-12.4, 0, 6.3, 0.5, 0.45, 1.3, '#3a3f45'); P.box(-12.4, 0.8, 5.9, 1.9, 0.06, 0.06, chrome, nc); for (const dx of [-0.82, 0.82]) { P.box(-12.4 + dx, 0.55, 5.9, 0.07, 0.5, 0.5, rubber, nc); P.box(-12.4 + dx * 1.07, 0.55, 5.9, 0.06, 0.4, 0.4, '#b3262f', nc); }
      for (const dx of [-0.55, 0.55]) P.box(-12.4 + dx, 0, 5.6, 0.08, 1.1, 0.08, steel, nc);
      P.spot(-12.4, 6.1, 0, AN.LIFT, { role: 'student', when: occ(EVE), y: 0.45 });
      for (const dx of [-0.95, 0.95]) for (const dz of [-0.6, 0.6]) P.box(-7.6 + dx, 0, 6 + dz, 0.09, 2.3, 0.09, steel);
      P.box(-7.6, 2.3, 6, 2.0, 0.08, 1.3, steel, nc); P.box(-7.6, 1.35, 6.6, 2.0, 0.05, 0.05, chrome, nc); for (const dx of [-1.0, 1.0]) P.box(-7.6 + dx, 1.12, 6.6, 0.07, 0.5, 0.5, rubber, nc);
      P.spot(-7.6, 5.5, Math.PI, AN.LIFT, { role: 'student', when: occ(EVE) });
      P.act(-7.6, 7.4, 'Do a set of squats (reps challenge)', () => ctx.go('gym', {}), { r: 2.0 });
      P.box(-3.6, 0, 5.5, 3.0, 0.7, 0.45, '#3a3f45'); for (let k = 0; k < 9; k++) { P.cyl(-4.8 + k * 0.3, 0.7, 5.5, 0.1, 0.18, k % 3 ? '#1c1c1c' : '#3f6fb0', { seg: 8 }); P.cyl(-4.8 + k * 0.3, 0.7, 5.2, 0.1 + k * 0.012, 0.0, '#1c1c1c', { seg: 8 }); }   // a dumbbell rack
      P.box(-16.1, 0, 4.2, 0.5, 1.3, 0.5, steel); for (let k = 0; k < 5; k++) P.cyl(-16.1, 0.12 + k * 0.22, 4.2, 0.34 - k * 0.025, 0.12, '#b3262f', { seg: 10 });   // a plate tree
      for (let k = 0; k < 4; k++) P.cyl(-15.2 + k * 0.5, 0, 3.6, 0.2, 0.4, ['#1c1c1c', '#c62828', '#1f5fa8', '#2e7d4f'][k], { seg: 9 });   // kettlebells
      // machines: a cable crossover, a lat pull-down, a leg press, a pec deck
      for (const dz of [-1.5, 1.5]) P.box(-3.2, 0, 9 + dz, 0.15, 2.5, 0.15, steel, nc); P.box(-3.2, 2.5, 9, 0.2, 0.1, 3.3, steel, nc); P.box(-3.0, 0.1, 9, 0.35, 2.0, 0.6, '#444', nc);
      P.spot(-4.2, 9, -Math.PI / 2, AN.LIFT, { role: 'student', when: occ(DAY) });
      P.box(-10.4, 0, 9.8, 1.2, 0.1, 1.2, steel); P.box(-10.4, 0.1, 10.4, 0.15, 2.3, 0.15, steel); P.box(-10.4, 2.1, 9.8, 0.12, 0.12, 1.2, steel, nc); P.box(-10.4, 0.45, 9.7, 0.5, 0.1, 0.45, rubber, nc); P.spot(-10.4, 9.7, Math.PI, AN.SIT, { role: 'student', when: occ(DAY), y: 0.42 });
      P.box(-6.6, 0, 10, 1.0, 0.6, 2.0, steel); P.box(-6.6, 0.1, 11.1, 0.9, 0.5, 0.1, rubber, nc);
      P.act(-10.4, 8.3, 'Work out (reps challenge)', () => ctx.go('gym', {}), { r: 2.2 });
      // a yoga corner with mats, a punching bag, a scale, a water cooler, a TV, lockers, the rules board
      for (let k = 0; k < 3; k++) P.box(-15.4 + k * 0.85, 0.03, 8.4, 0.7, 0.02, 1.7, ['#2e7d4f', '#5b3fa8', '#d8402f'][k], nc);
      P.cyl(-14.6, 0.2, 2.3, 0.03, 1.6, '#9aa3aa', { seg: 6 }); P.cyl(-14.6, 0.5, 2.3, 0.24, 1.0, '#7a1f1f', { seg: 10 }); P.spot(-13.7, 2.3, Math.PI / 2, AN.STAND, { role: 'student', when: occ(EVE) });
      P.box(-2.3, 0, 13.6, 0.5, 0.08, 0.5, '#c9ced4'); P.cyl(-2.4, 0, 3.0, 0.28, 1.1, '#9aa3ab', { collide: true });
      P.panel(-2.0, 2.4, 3.0, 1.3, 0.3, -Math.PI / 2, textTex(['WATER'], { w: 256, h: 64, bg: '#1f5f8f', size: 28, align: 'center' }));
      P.panel(-1.64, 2.2, 8.0, 1.8, 1.0, -Math.PI / 2, ctx.tvTex, { emissive: 1 });
      for (let k = 0; k < 4; k++) P.box(-4.8 + k * 0.9, 0, 14.5, 0.8, 1.8, 0.5, k % 2 ? '#3f73b8' : '#2f5d5a');   // lockers
      P.panel(-3.0, 2.2, 14.74, 3.8, 0.34, Math.PI, textTex(['LOCKERS'], { w: 448, h: 80, bg: '#1f3a5f', size: 40, align: 'center' }));
      P.board(-8.5, 1.4, 1.62, 2.6, 1.4, 0, notice('GYM RULES', ['Wipe the bench after use', 'Re-rack your weights', 'No outside shoes on the mats', 'Open 6-9 AM, 4-10 PM']));
      P.spot(-5.4, 3.4, 0, AN.TALK, { role: 'student', when: occ(EVE) });
      for (const x of [-13, -8, -3]) for (const z of [4, 8.5, 12.5]) P.tubeLight(x, z);
      P.fan(-12, 6); P.fan(-6, 6); P.fan(-12, 11); P.fan(-6, 11);
    }
    // ================================================================= TV ROOM (north-east)
    {
      const TV = occ([[13, 15, 0.4], [17, 19, 0.6], [21, 24.5, 0.9], [0, 2, 0.4]]);
      P.box(15.9, 0, -8, 0.7, 0.9, 3.2, '#3b2d22');                                                       // the TV unit with the set on it
      P.panel(16.45, 1.75, -8, 3.4, 1.9, -Math.PI / 2, ctx.tvTex, { emissive: 1, key: 'tv' });
      P.box(16.6, 0.95, -8, 0.05, 0.06, 1.6, '#111', nc);                                                 // a sound bar
      for (const z of [-10.3, -5.7]) P.box(16.4, 0, z, 0.5, 1.3, 0.5, '#1c1c1c');                         // floor speakers
      const sofas = [...P.sofa(11, -11.2, 3.2, Math.PI / 2), ...P.sofa(11, -4.8, 3.2, Math.PI / 2), ...P.sofa(7.5, -8, 3.4, Math.PI / 2)];
      sofas.forEach((s, i) => { if (i % 2 === 0) P.spot(s.x, s.z, s.yaw, AN.SIT, { role: 'student', when: TV, clap: true, seat: s }); });
      P.act(11.0, -8.0, 'Watch TV (cricket highlights)', () => ctx.go('tv', { seat: sofas[4] || sofas[0] }), { r: 2.4 });
      for (let k = 0; k < 3; k++) P.box(14.2 + (k % 2) * 0.6, 0, -3 + k * 1.1, 0.7, 0.4, 0.7, ['#c8402f', '#3f6fb0', '#e0a030'][k]);   // bean bags
      P.table(4.6, -13.4, 1.2, 0.9, '#8a6a4a', 0.74); P.box(4.6, 0.74, -13.4, 0.2, 0.02, 0.1, '#222', nc);   // a side table with the remote
      // a carrom board, a snacks and drinks vending machine, a newspaper table, a notice board, curtains
      P.table(14.5, -13.2, 0.9, 0.9, '#c89b3c', 0.7); for (const [dx, dz, yaw] of [[-0.9, 0, Math.PI / 2], [0.9, 0, -Math.PI / 2]]) P.spot(14.5 + dx, -13.2 + dz, yaw, AN.SIT, { role: 'student', when: occ([[15, 18, 0.4], [20, 24, 0.7]]) });
      P.act(14.5, -12.1, 'Play carrom', () => ctx.g.ui.toast('Strike, pocket, repeat. The queen is covered with a flick of the wrist.', 'info', 'Carrom'), { r: 1.6 });
      P.box(2.0, 0, -3.4, 1.0, 1.9, 0.8, '#b3262f'); P.box(1.78, 0.9, -3.4, 0.02, 1.0, 0.7, '#8fb4d8', nc);
      P.panel(1.6, 2.2, -3.4, 1.0, 0.3, -Math.PI / 2, textTex(['SNACKS · DRINKS'], { w: 320, h: 80, bg: '#444', size: 28, align: 'center' })); P.act(3.0, -3.4, 'Vending machine: a packet of chips (₹20)', () => ctx.g.progress?.eat ? ctx.g.progress.eat(6, 'a packet of chips') : ctx.g.ui.toast('Crunch.', 'info', 'Vending machine'), { r: 1.6 });
      P.board(8.5, 1.4, -1.62, 2.4, 1.4, Math.PI, notice('TV ROOM', ['Match nights: use the big TV', 'Keep the volume down after 12', 'Switch off the lights when you leave', 'Cricket · football · films']));
      for (const x of [14, 5]) P.box(x, 1.3, -14.82, 1.4, 2.4, 0.06, '#7a2630', nc);                      // curtains
      P.plant(16.2, -2.2); P.plant(2.2, -14.2);
      for (const x of [5, 9, 13]) for (const z of [-12, -7, -3]) P.tubeLight(x, z);
      P.fan(7, -11); P.fan(12, -11); P.fan(7, -4); P.fan(12, -4);
    }
    // ================================================================= MUSIC ROOM (south-east)
    {
      const JAM = occ([[16, 18, 0.5], [18, 22.5, 0.9], [21, 24, 0.5]]);
      for (const x of [4.8, 10.5, 16.2]) P.box(x, 0.9, 14.82, 3.8, 2.6, 0.06, '#565c6b', nc);                // acoustic foam panels
      for (const z of [4, 8, 12]) P.box(16.86, 0.9, z, 0.06, 2.4, 3.2, '#565c6b', nc);
      for (let k = 0; k < 18; k++) P.box(4.0 + (k % 6) * 2.3, 1.2 + Math.floor(k / 6) * 0.8, 14.78, 0.9, 0.5, 0.04, k % 2 ? '#2b2f38' : '#444a58', nc);   // the foam's wedges
      P.box(8, 0, 9, 7.4, 0.03, 8.4, '#6b2d2d', nc);                                                      // a rug under the kit
      P.panel(10.5, 3.3, 14.78, 4.6, 0.5, Math.PI, textTex(['MUSIC ROOM'], { w: 640, h: 96, bg: '#6b2d8a', size: 52, align: 'center' }));
      // a drum kit: bass drum, snare, three toms, hi-hat and two cymbals, a stool
      P.cyl(8.6, 0.0, 12.0, 0.36, 0.5, '#c62828', { seg: 16 }); P.cyl(8.6, 0.3, 11.7, 0.34, 0.05, '#e8e8e8', { seg: 16 });
      P.cyl(7.5, 0.55, 11.4, 0.17, 0.2, '#e8e8e8', { seg: 14 }); P.cyl(8.0, 0.65, 11.0, 0.15, 0.17, '#e8e8e8', { seg: 14 }); P.cyl(9.4, 0.65, 11.0, 0.17, 0.2, '#e8e8e8', { seg: 14 });
      P.cyl(7.2, 0.0, 11.8, 0.17, 1.0, '#9aa3aa', { seg: 6 }); P.cyl(7.2, 0.97, 11.8, 0.2, 0.01, '#d4af37', { seg: 16 }); P.cyl(10.0, 0.0, 11.7, 0.02, 1.4, '#9aa3aa', { seg: 6 }); P.cyl(10.0, 1.36, 11.7, 0.26, 0.01, '#d4af37', { seg: 18 });
      P.cyl(8.4, 0.0, 10.0, 0.2, 0.46, '#2a2d31', { seg: 12 });
      P.spot(8.4, 10.2, Math.PI, AN.DRUM, { role: 'student', when: JAM, opts: [OPT.DHOL] });
      // guitars on stands, a bass, amps, a keyboard on a stand, a mic on a boom, a PA speaker, a sheet-music stand
      for (let k = 0; k < 3; k++) { const x = 13.2 + k * 1.1; P.box(x, 0, 13.6, 0.1, 0.55, 0.1, '#2a2a2a', nc); P.box(x, 0.5, 13.6, 0.12, 0.7, 0.1, ['#b3262f', '#2f5fa8', '#c89b3c'][k], nc); P.box(x, 0.55, 13.58, 0.3, 0.4, 0.08, ['#b3262f', '#2f5fa8', '#c89b3c'][k], nc); }
      for (const [x, z] of [[12.4, 10.6], [14.8, 10.6]]) { P.box(x, 0, z, 0.8, 0.8, 0.45, '#1c1c1c'); P.cyl(x, 0.5, z - 0.24, 0.17, 0.02, '#444', { seg: 12 }); P.box(x, 0.72, z - 0.22, 0.5, 0.05, 0.02, '#c9a227', nc); }
      P.spot(13.6, 9.3, Math.PI, AN.GUITAR, { role: 'student', when: JAM, opts: [OPT.GUITAR] }); P.spot(15.2, 8.6, Math.PI, AN.GUITAR, { role: 'student', when: JAM, opts: [OPT.GUITAR] });
      P.box(5.4, 0, 6.2, 1.5, 0.8, 0.5, '#1c1c1c'); P.box(5.4, 0.8, 6.2, 1.4, 0.05, 0.4, '#f4f4f4', nc);   // a digital piano on its stand
      P.spot(5.4, 7.1, 0, AN.SIT, { role: 'student', when: JAM });
      P.cyl(11.6, 0.0, 6.8, 0.02, 1.55, '#2a2a2a', { seg: 6 }); P.box(11.6, 1.45, 6.95, 0.02, 0.02, 0.28, '#2a2a2a', nc); P.cyl(11.6, 1.47, 7.1, 0.04, 0.12, '#222', { seg: 8 });   // the mic stand
      P.box(16.2, 0, 6.2, 0.7, 1.4, 0.55, '#1c1c1c'); P.cyl(16.2, 0.9, 5.95, 0.2, 0.02, '#444', { seg: 12 }); P.cyl(16.2, 0.45, 5.95, 0.18, 0.02, '#444', { seg: 12 });   // the PA speaker
      P.box(7.8, 0, 6.4, 0.5, 1.2, 0.04, '#222', nc); P.box(7.8, 1.2, 6.4, 0.5, 0.3, 0.02, '#f4efe0', nc);   // a sheet-music stand
      P.act(8.4, 9.0, 'Jam with the music club', () => ctx.go('music', {}), { r: 2.8 });
      // an Indian corner on a mat: tabla, harmonium, a sitar leaning on the wall; a sofa; the booking sheet; posters
      P.box(15.2, 0, 3.8, 2.3, 0.04, 2.0, '#8a2f2f', nc); P.cyl(14.7, 0.04, 3.7, 0.16, 0.22, '#7a4a2a', { seg: 12 }); P.cyl(15.1, 0.04, 3.7, 0.13, 0.2, '#2a2a2a', { seg: 12 }); P.box(15.9, 0.04, 4.2, 0.6, 0.25, 0.4, '#a8743f', nc);
      P.box(16.5, 0, 3.0, 0.1, 1.2, 0.2, '#5a3a22', nc);
      P.sofa(5.2, 3.4, 2.6, -Math.PI / 2, '#3a4a6a');
      P.board(8.5, 1.4, 1.62, 2.6, 1.4, 0, notice('BOOK A SLOT', ['6 - 8 PM: Band A', '8 - 10 PM: Band B', 'Sign the sheet · lock up', 'Headphones for practice']));
      P.panel(10.5, 2.7, 1.62, 1.6, 1.4, 0, poster('JAM NIGHT', 'Friday 9 PM', '#6b2d8a'));
      P.panel(12.9, 2.7, 1.62, 1.6, 1.4, 0, poster('ALCHERINGA', 'Battle of the Bands', '#1f2a44'));
      P.plant(16.2, 2.2);
      for (const x of [5, 10, 15]) for (const z of [4.5, 9, 13]) P.tubeLight(x, z);
      P.fan(8, 5); P.fan(13, 5); P.fan(8, 12); P.fan(13, 12);
    }
    return P;
  },

  lecture(ctx) {
    const P = new Plan(ctx.name, 26, 24, 7.5, { floor: 'tiles', wall: '#e9e2d2', seed: ctx.seed });
    P.box(0, 0, -10.5, 8, 0.35, 3, '#8a6a4a');                   // lecture platform
    P.tier(-12, -9, 0.35);
    P.board(-3.6, 1.6, -11.85, 6.5, 2.4, 0, boardText(ctx.lecture.board, ctx.lecture.title), { key: 'board' });
    P.panel(5.2, 3.2, -11.8, 5.5, 3.1, 0, textTex(ctx.lecture.slide, { w: 1024, h: 576, bg: '#f7f7f4', fg: '#223', size: 34, title: ctx.lecture.title, titleColor: '#1f4fa0' }), { key: 'screen', emissive: 0.35 });
    P.box(3, 0.35, -9.8, 0.8, 1.1, 0.6, '#6b4a2f');                // lectern
    P.spot(2.6, -10.6, 0, AN.LECTURE, { role: 'faculty', when: CLASS_OCC, y: 0.35, prof: true });
    const seats = P.rakedSeats(-12, 12, -8, 11, 12, 0.32, { color: '#3b4f6b', desk: true });
    seats.forEach((s, i) => { if (i % 3) P.spot(s.x, s.z, s.yaw, i % 5 ? AN.STUDY : AN.SIT, { role: 'student', when: CLASS_OCC, y: s.y, seat: s }); });
    const mine = seats[Math.floor(seats.length * 0.45)];
    P.act(mine.x, mine.z, 'Take a seat and attend the lecture', () => ctx.go('lecture', { seat: mine }), { y: mine.y, r: 3, ok: () => (CLASS_OCC(ctx.g.clock.hour) > 0.1 ? true : 'no lecture right now (classes 9 AM - 5 PM)') });
    P.act(-6, 8, 'Write the end-semester exam', () => ctx.go('exam', { seat: seats[seats.length - 20] }), { y: 0, r: 2.5 });
    for (let k = -1; k <= 1; k++) for (const z of [-4, 3, 9]) P.tubeLight(k * 7, z);
    for (const z of [-3, 5]) { P.fan(-6, z); P.fan(6, z); }
    P.sideExits(-8.9, ctx.leave);
    P.spawn = { x: 0, z: 10.4, yaw: Math.PI };
    return P;
  },

  /** Kendriya Vidyalaya: a classroom with double desks, a blackboard and charts on the walls */
  school(ctx) {
    const P = new Plan(ctx.name, 14, 11, 3.6, { floor: 'tiles', wall: '#f2e6c8', seed: ctx.seed });
    const wd = ctx.g.clock.weekday, h = ctx.g.clock.hour;
    const SUBJ = ['Science · Photosynthesis', 'Maths · Fractions', 'English · The Road Not Taken', 'Hindi · Kabir ke Dohe', 'Social Science · The Brahmaputra', 'Computer · Scratch'];
    const subj = SUBJ[(wd + Math.floor(h)) % SUBJ.length];
    const SCHOOL = (hh) => (!ctx.g.clock.weekend && hh > 7.8 && hh < 13.5 ? 0.95 : 0);
    P.board(-2.5, 1.2, -5.35, 5, 1.8, 0, boardText([subj, `Class ${6 + (wd % 4)}-${'ABC'[wd % 3]}`, `Date: ${ctx.dayName}`], `${subj.split(' · ')[0]}`), { key: 'board' });
    P.box(3.2, 0, -4.2, 1.6, 0.78, 0.7, '#8a5a36');                                  // teacher's table
    P.spot(3.2, -4.8, 0, AN.LECTURE, { role: 'faculty', when: SCHOOL });
    for (const [x, t] of [[-6.8, ['OUR SOLAR SYSTEM']], [6.8, ['SWACHH BHARAT', 'Keep your school clean']]])
      P.panel(x, 1.9, 0, 3, 1.6, x < 0 ? Math.PI / 2 : -Math.PI / 2, textTex(t, { w: 512, h: 256, bg: x < 0 ? '#1f3a6e' : '#2e7d4f', fg: '#fff', size: 34, align: 'center' }));
    // five rows of double desks, two pupils each
    const cols = ['#c86b3c', '#2f5fa8', '#2e7d4f'];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      const x = -4.5 + c * 4.2, z = -2 + r * 1.7;
      P.box(x, 0, z, 1.8, 0.66, 0.5, cols[(r + c) % 3]);                            // desk
      P.box(x, 0, z + 0.55, 1.8, 0.38, 0.35, '#8a5a36');                           // bench
      for (const sx of [-0.45, 0.45]) P.spot(x + sx, z + 0.6, Math.PI, r % 2 ? AN.STUDY : AN.SIT, { role: 'kid', when: SCHOOL, y: 0 });
    }
    P.act(0, 5, 'Sit at the back and listen', () => ctx.go('sit', { seat: { x: 5.8, y: 0, z: 5.0, yaw: Math.PI } }), { r: 2.5 });
    for (const z of [-2, 3]) { P.tubeLight(-3, z); P.tubeLight(3, z); P.fan(0, z); }
    P.spawn = { x: 0, z: 4.8, yaw: Math.PI };
    return P;
  },

  academic(ctx) {
    const P = new Plan(ctx.name, 36, 26, 4.2, { floor: 'tiles', wall: '#ece5d6', seed: ctx.seed });
    // corridor down the middle, labs on either side
    P.box(-5, 0, -2, 0.25, 4.2, 22, '#ece5d6'); P.box(5, 0, -2, 0.25, 4.2, 22, '#ece5d6');
    P.panel(-5.14, 2.6, 6, 2.6, 0.5, -Math.PI / 2, textTex(['CHEMISTRY LAB'], { w: 512, h: 96, bg: '#1f4fa0', size: 48, align: 'center' }));
    P.panel(5.14, 2.6, 6, 2.6, 0.5, Math.PI / 2, textTex(['COMPUTER LAB'], { w: 512, h: 96, bg: '#1f4fa0', size: 48, align: 'center' }));
    // chemistry lab (left): benches, fume hood, titration station
    for (let r = 0; r < 3; r++) {
      P.labBench(-11, -8 + r * 5, 8, 0);
      for (let k = 0; k < 4; k++) P.spot(-14 + k * 2, -8 + r * 5 + 0.9, Math.PI, AN.LAB, { role: 'student', when: occ([[14, 17, 0.8], [9, 12, 0.4]]), opts: [] });
    }
    P.box(-16.5, 0, -11, 1.5, 2.4, 2.5, '#d9d4c7');                // fume hood
    P.panel(-15.73, 1.5, -11, 2.2, 1.0, Math.PI / 2, textTex(['FUME HOOD', 'Keep sash lowered'], { w: 512, h: 256, bg: '#e8e4da', fg: '#7d1f1f', size: 30, align: 'center' }));
    P.act(-9.5, 3.0, 'Do the titration experiment', () => ctx.go('titration', { x: -9.5, z: 2.0 }));
    P.act(-12.5, -7.0, 'Do the pendulum experiment (physics)', () => ctx.go('pendulum', {}));
    P.spot(-8, -12, Math.PI / 2, AN.TALK, { role: 'faculty', when: STAFF });
    // computer lab (right): rows of PCs
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
      const s = P.desk(7.5 + k * 2.1, -10 + r * 3.8, Math.PI, { pc: true });
      P.spot(s.x, s.z, s.yaw, AN.TYPE, { role: 'student', when: occ([[9, 13, 0.6], [14, 18, 0.6], [20, 23, 0.4]]), seat: s });
    }
    P.act(9.6, -2.6, 'Sit at a PC: coding practice', () => ctx.go('typing', {}));
    // faculty cabins at the back of the corridor
    P.desk(0, -10.5, Math.PI, { pc: true, lamp: true });
    P.spot(0, -10.75, Math.PI, AN.TYPE, { role: 'faculty', when: STAFF });
    P.board(0, 1.0, 12.8, 3.4, 1.8, Math.PI, notice('DEPARTMENT NOTICES', ['Mid-sem exams: week 8', 'Project demo: book a slot with your TA', 'Seminar: Friday 4 PM, Conference Centre', ctx.dept || 'Department of Data Science & AI']));
    for (const z of [-8, -1, 6]) { P.tubeLight(-11, z); P.tubeLight(11, z); P.tubeLight(0, z); }
    for (const z of [-6, 3]) { P.fan(-11, z); P.fan(11, z); }
    return P;
  },

  library(ctx) {
    const P = new Plan(ctx.name, 36, 30, 5.5, { floor: 'marble', wall: '#ece5d6', seed: ctx.seed });
    P.counter(-12, 11, 5, 0.8, '#6b4a2f');
    P.spot(-12, 10.2, 0, AN.TYPE, { role: 'staff', when: occ([[8, 24, 1]]) });
    P.panel(-12, 3.3, 14.87, 5, 0.7, Math.PI, textTex(['ISSUE / RETURN'], { w: 512, h: 96, bg: '#1f3a5f', size: 50, align: 'center' }));
    P.panel(8, 3.5, 14.87, 6, 0.8, Math.PI, textTex(['PLEASE MAINTAIN SILENCE'], { w: 1024, h: 128, bg: '#7d1f1f', size: 64, align: 'center' }));
    for (let r = 0; r < 6; r++) { P.shelf(-16.3, -12 + r * 3.6, 3.2, Math.PI / 2, 2.4); P.shelf(-8 - (r % 3) * 3.2, -12.5 + Math.floor(r / 3) * 4, 3.0, 0, 2.2); }
    // reading tables with lamps
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
      const x = 3 + c * 7.5, z = -9 + r * 5;
      P.table(x, z, 5, 1.4, '#7a5a3a', 0.76);
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
        const seat = P.chair(x - 1.8 + k * 1.2, z + s * 1.05, s > 0 ? Math.PI : 0, '#6b4a2f');
        P.spot(seat.x, seat.z, seat.yaw, AN.STUDY, { role: 'student', when: LIB_OCC, opts: [OPT.BOOK], seat });
      }
      P.lamps.push({ x, y: 1.4, z });
    }
    P.act(4.2, -3.2, 'Study at a reading table', () => ctx.go('study', { place: 'library' }));
    P.act(-12, 12.3, 'Issue / return books (library counter)', () => ctx.go('libraryDesk', {}), { r: 2.6 });
    for (let k = 0; k < 4; k++) { P.spot(-9 + k * 1.1, -8.9, 0, k % 2 ? AN.PHONE : AN.STAND, { role: 'student', when: LIB_OCC, opts: [OPT.BOOK] }); }
    for (const z of [-10, -3, 4, 10]) for (const x of [-12, -3, 6, 13]) P.tubeLight(x, z);
    return P;
  },

  /** Computer Centre: rows of workstations (students coding, reading, printing), a help desk and
   *  free PCs you can sit at and use: a real web browser on the screen. */
  computer(ctx) {
    const P = new Plan(ctx.name, 30, 24, 3.8, { floor: 'tiles', wall: '#eef0ee', seed: ctx.seed });
    P.panel(0, 2.9, -11.87, 9, 0.8, 0, textTex(['COMPUTER CENTRE · IIT GUWAHATI'], { w: 1024, h: 96, bg: '#1f3a5f', size: 50, align: 'center' }));
    P.board(12.87, 1.2, 0, 3.4, 1.8, -Math.PI / 2, notice('CC NOTICES', ['Log in with your IITG (LDAP) ID', 'Printing: ₹2 / page at the help desk', 'Open 8 AM - 12 midnight', 'No food or drinks near the PCs']));
    // help desk + printer by the door
    P.counter(-10, 9.5, 4, 0.8, '#6b4a2f');
    P.spot(-10, 8.8, 0, AN.TYPE, { role: 'staff', when: occ([[8, 24, 1]]) });
    P.box(-12.6, 0, 9.4, 0.8, 1.0, 0.6, '#e2e4e6');
    const scr = (k) => canvasTexture(256, 144, (g, w, h) => {
      g.fillStyle = ['#0e2233', '#1b1b1b', '#f4f6f8', '#0d2b1d'][k % 4]; g.fillRect(0, 0, w, h);
      if (k % 4 === 2) { g.fillStyle = '#7a2630'; g.fillRect(0, 0, w, 22); g.fillStyle = '#c9ccd1'; for (let r = 0; r < 7; r++) g.fillRect(14, 34 + r * 14, 120 + ((r * 37) % 100), 6); }
      else { for (let r = 0; r < 10; r++) { g.fillStyle = ['#7fd1ff', '#e6db74', '#a6e22e', '#f92672', '#ffffff'][(r + k) % 5]; g.fillRect(10 + (r % 3) * 12, 10 + r * 12, 40 + ((r * 53 + k * 17) % 150), 5); } }
    }, { repeat: false });
    const free = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const x = -11 + c * 4.2, z = -8 + r * 4.2;
      const ws = P.workstation(x, z, Math.PI, scr(r * 6 + c));
      const busy = (r * 6 + c) % 5 !== 2;
      if (busy) P.spot(ws.seat.x, ws.seat.z, ws.seat.yaw, AN.TYPE, { role: 'student', when: occ([[9, 13, 0.7], [14, 18, 0.75], [20, 24, 0.8], [0, 1, 0.4]]), seat: ws.seat });
      else free.push(ws);
    }
    for (const ws of free) P.act(ws.seat.x, ws.seat.z, 'Use this computer (web browser)', () => ctx.go('pc', { seat: ws.seat, mon: ws.mon }), { r: 1.4, ok: () => (ctx.g.clock.hour >= 8 || ctx.g.clock.hour < 0.1 ? true : 'the Computer Centre opens at 8 AM') });
    for (const z of [-7, -2, 3, 8]) for (const x of [-9, 0, 9]) P.tubeLight(x, z);
    P.spawn = { x: 0, z: 10.5, yaw: Math.PI };
    return P;
  },

  /** The hostel canteen upstairs (6 PM - 2 AM): noodles, rolls, chai and cold coffee, cricket on the TV,
   *  plastic chairs, and visitors from other hostels (who signed the register at the gate). */
  canteen(ctx) {
    const P = new Plan(`${ctx.name} canteen · 2nd floor`, 22, 16, 3.3, { floor: 'red', wall: '#f3e7cf', seed: ctx.seed + 3 });
    const OPEN = occ([[20, 22, 0.55], [22, 24, 0.85], [0, 2, 0.6]]);
    P.counter(0, -6.4, 8, 0.9, '#8a5a36');
    P.box(2.4, 1.0, -6.7, 1.3, 0.06, 0.62, '#2a2a2a', { collide: false });          // tawa
    P.box(-3.2, 1.0, -6.8, 0.5, 0.5, 0.4, '#c7ccd1', { collide: false });           // tea urn
    for (const [x, anim] of [[-1.4, AN.SERVE], [2.2, AN.SERVE]]) P.spot(x, -7.2, 0, anim, { role: 'mess', when: ALWAYS });
    P.board(0, 1.55, -7.85, 7.2, 1.6, 0, boardText(CANTEEN_MENU.map(([n, p]) => `${n} ... ₹${p}`).slice(0, 8), 'CANTEEN · open 6 PM - 2 AM'));
    P.act(0, -5.2, 'Order at the counter (canteen menu)', () => ctx.go('shop', { name: `${ctx.name} canteen`, kind: 'canteen', menu: CANTEEN_MENU }), { r: 2.4 });
    // plastic tables and chairs, students up late (girls and boys: visitors signed in downstairs)
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = -7.5 + c * 5, z = -2.2 + r * 3.8;
      P.table(x, z, 1.4, 0.9, ['#d8d2c4', '#2f6fb0', '#c62f2f'][(r + c) % 3], 0.74);
      for (const s of [-1, 1]) {
        const seat = P.chair(x, z + s * 0.85, s > 0 ? Math.PI : 0, ['#2f6fb0', '#c62f2f', '#2e7d4f'][(r * 4 + c) % 3]);
        P.spot(seat.x, seat.z, seat.yaw, [AN.EAT, AN.TALK, AN.PHONE, AN.EAT][(r + c + (s > 0 ? 1 : 0)) % 4], { role: 'student', when: OPEN, seat, plate: (r + c) % 2 === 0 });
      }
    }
    for (let k = 0; k < 4; k++) P.spot(-3 + k * 0.8, -4.9, Math.PI, AN.STAND, { role: 'student', when: OPEN });   // the queue
    P.box(9.9, 1.6, 2, 0.1, 0.9, 1.6, '#1b1b1b', { collide: false });
    P.panel(9.84, 2.05, 2, 1.5, 0.85, -Math.PI / 2, ctx.tvTex, { emissive: 1, key: 'tv' });
    P.board(-10.87, 1.2, 1, 2.6, 1.5, Math.PI / 2, notice('CANTEEN RULES', ['Open 6 PM - 2 AM', 'Visitors: sign in at the security desk', 'Pay by UPI / cash', 'Return the plates please']));
    // the stairs down, in a stairwell cut into the floor by the front wall: at the bottom, to the mess and lobby, or straight out
    {
      const XW = 1.3, ZT = 4.3, RUN = 0.27, RISE = 0.2, N = 10, ZB = ZT + N * RUN, WALL = '#e9dfc8';
      P.floorHole = { x0: -XW, x1: XW, z0: ZT };
      for (let k = 1; k <= N; k++) {
        const z0 = ZT + (k - 1) * RUN, z1 = ZT + k * RUN;
        P.box(0, -RISE * N, (z0 + z1) / 2, 2 * XW, RISE * (N - k), RUN, k % 2 ? '#b9ad97' : '#aa9e88', { collide: false });
        P.tier(z0, z1, -RISE * k, -XW, XW);
      }
      P.tier(ZB, 8.2, -RISE * N, -XW, XW);                                                              // the landing at the bottom
      P.box(0, -RISE * N - 0.05, (ZB + 8) / 2, 2 * XW, 0.05, 8 - ZB, '#9c9180', { collide: false });
      for (const s of [-1, 1]) {
        P.box(s * (XW + 0.05), -RISE * N, (ZT + 8) / 2, 0.1, RISE * N, 8 - ZT, WALL, { collide: false });   // the stairwell's walls
        P.colliders.push({ x0: s * XW - 0.06, x1: s * XW + 0.06, z0: ZT, z1: 8, top: 9 });                    // and a balustrade you cannot cross
        P.box(s * XW, 0.93, (ZT + 8) / 2, 0.06, 0.05, 8 - ZT, '#5a4632', { collide: false });
        for (let z = ZT + 0.2; z < 8; z += 0.9) P.box(s * XW, 0, z, 0.05, 0.95, 0.05, '#5a4632', { collide: false });
      }
      P.box(0, -RISE * N - 0.2, 7.9, 2 * XW + 0.2, RISE * N + 2.9, 0.2, '#f3e7cf', { collide: false });   // the front wall closed behind the landing
      P.panel(-0.65, -0.35, 7.78, 1.05, 0.5, Math.PI, textTex(['MESS &', 'LOBBY →'], { w: 256, h: 128, bg: '#2f5d5a', size: 40, align: 'center' }));
      P.panel(0.65, -0.35, 7.78, 1.05, 0.5, Math.PI, textTex(['← EXIT', 'OUTSIDE'], { w: 256, h: 128, bg: '#7a2630', size: 40, align: 'center' }));
      P.panel(0, 2.4, ZT - 0.3, 2.0, 0.4, Math.PI, textTex(['DOWN: MESS · EXIT'], { w: 512, h: 96, bg: '#1f5a3d', size: 40, align: 'center' }));
      P.act(-0.65, 7.3, 'Go down to the hostel lobby and the mess', () => ctx.downstairs(), { r: 0.85, dy: 1.3 });
      P.exit = { x: 0.65, z: 7.3 }; P.exitR = 0.85;                                                     // "Go outside" is at the foot of the stairs
    }
    for (const x of [-6, 0, 6]) for (const z of [-3, 3]) P.tubeLight(x, z);
    P.fan(-4, 1); P.fan(4, 1);
    P.spawn = { x: 0, z: 3.5, yaw: Math.PI };            // you come up the stairs and stand at the top
    return P;
  },

  /** Dr. Bhupen Hazarika Auditorium, as in the photos: a wide wooden stage with red side curtains and a
   *  dark backstage, a big screen, warm wood panelling on the lower walls and white perforated acoustic
   *  panels with vertical fins above, dark seats on red-carpeted tiers, EXIT doors at the front. */
  auditorium(ctx) {
    const P = new Plan(ctx.name, 36, 34, 12.5, { floor: 'carpet', wall: '#f1ede4', seed: ctx.seed });
    P.box(0, 0, -13.1, 30, 1.2, 7.8, '#c9995f');                          // stage, light wood
    P.tier(-17, -9.25, 1.2);
    P.box(0, 1.19, -9.3, 30, 0.02, 0.1, '#8a6a3a', { collide: false });    // stage nosing
    P.box(0, 1.2, -16.75, 34, 11.2, 0.2, '#15161c', { collide: false });  // dark backstage
    for (const sx of [-1, 1]) {
      P.box(sx * 12.85, 1.2, -12.2, 6.3, 10, 1.0, '#8b1a1a');              // the red side drapes frame the screen
      P.box(sx * 16.6, 0, -12.2, 1.2, 12.5, 1.6, '#f1ede4');               // proscenium
      P.box(sx * 12.85, 11.2, -12.1, 6.3, 1.3, 1.2, '#7a1515', { collide: false });  // valance over the drapes
    }
    // the screen fills the whole opening between the drapes, from the stage floor up (16:9). It stands right behind the drapes (their back face is at
    // z -12.7): further back, the near edge of a drape hid a different part of it from every seat, and the dark backstage showed as black bars at the sides
    P.panel(0, 6.65, -12.74, 19.4, 10.9, 0, ctx.screenTex, { emissive: 1, key: 'screen' });
    // podium (wooden, as in the photo) + flowers along the stage front
    P.box(-6.5, 1.2, -11, 1.0, 1.2, 0.7, '#a0703f');
    P.box(-6.5, 2.4, -11.1, 1.15, 0.12, 0.8, '#b8834c');
    presenterPC(P, ctx, { x: -6.5, y: 2.52, z: -10.95, mon: { x: 0, y: 6.65, z: -12.74, yaw: 0, w: 19.4, h: 10.9 }, ident: { id: 'aud', user: 'iitg', pass: 'iitg', place: 'Bhupen Hazarika Auditorium', device: 'AUD-PC-01' } });
    for (let k = -6; k <= 6; k++) { P.box(k * 2.2, 0, -8.95, 1.6, 0.55, 0.45, '#f4f2ea', { collide: false }); P.cyl(k * 2.2 - 0.3, 0.55, -8.95, 0.22, 0.35, k % 2 ? '#e8b21f' : '#c62828'); P.cyl(k * 2.2 + 0.35, 0.55, -8.95, 0.2, 0.3, '#f4f4ef'); }
    // walls: wood slats below, white acoustic panels + fins above
    const wood = canvasTexture(512, 128, (g, w, h) => { g.fillStyle = '#8c5a33'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 10) { g.fillStyle = x % 20 ? '#7a4c2a' : '#9a663c'; g.fillRect(x, 0, 7, h); } }, { repeat: true });
    wood.repeat.set(8, 1);
    const acoustic = canvasTexture(256, 256, (g, w, h) => { g.fillStyle = '#efece6'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(120,112,100,0.28)'; for (let y = 6; y < h; y += 12) for (let x = 6; x < w; x += 12) g.fillRect(x, y, 3, 3); g.strokeStyle = 'rgba(150,140,125,0.35)'; g.strokeRect(0.5, 0.5, w - 1, h - 1); }, { repeat: true });
    acoustic.repeat.set(10, 3);
    for (const sx of [-1, 1]) {
      P.panel(sx * 17.96, 1.6, 3, 28, 3.2, -sx * Math.PI / 2, wood);
      P.panel(sx * 17.96, 7.4, 3, 28, 8.4, -sx * Math.PI / 2, acoustic);
      for (let z = -6; z <= 15; z += 3) P.box(sx * 17.75, 3.3, z, 0.4, 8.6, 0.18, '#f4f1ea', { collide: false });
    }
    P.panel(0, 7.4, 16.96, 36, 8.4, Math.PI, acoustic);
    for (const sx of [-1, 1]) P.panel(sx * 9.7, 1.6, 16.96, 16.6, 3.2, Math.PI, wood);   // (the entrance is in the middle)
    // dark seats on red-carpeted tiers
    const seats = P.rakedSeats(-15.5, 15.5, -7.6, 15.6, 15, 0.45, { color: '#2a2d34', aisle: 1.8, riser: '#8e2a2e' });
    ctx.auditSeats = seats;
    seats.forEach((s, i) => { if (i % 2 === 0) P.spot(s.x, s.z, s.yaw, AN.SIT, { role: 'student', when: ctx.audOcc || occ([[19.5, 22, 0.8], [10, 17, 0.12]]), y: s.y, seat: s, clap: true }); });
    const mine = seats[Math.floor(seats.length * 0.3) + 7];
    P.act(mine.x, mine.z, ctx.eventAct?.label || (ctx.video ? `Watch "${ctx.video.title}"` : 'Watch tonight\'s film'), () => ctx.go(ctx.eventAct?.id || 'movie', { seat: mine }), { y: mine.y, r: 3.5 });
    // ground-level exits at the front, beside the stage
    P.sideExits(-8.2, ctx.leave);
    for (let k = -2; k <= 2; k++) P.lamps.push({ x: k * 6, y: 11.5, z: -9 });
    for (let k = -2; k <= 2; k++) P.lamps.push({ x: k * 6, y: 11.5, z: 6 });
    P.spawn = { x: 0, z: 15.2, yaw: Math.PI };
    return P;
  },

  /** Conference Centre hall: a projector and pull-down screen, rows of padded chairs, a podium and
   *  AI Confluence standees (the AI Confluence talks happen here). */
  conference(ctx) {
    const P = new Plan(ctx.name, 26, 22, 6, { floor: 'carpet', wall: '#efe9dd', seed: ctx.seed });
    P.box(0, 0, -9.2, 14, 0.4, 3.4, '#8a6a4a');                          // low stage
    P.tier(-11, -7.5, 0.4);
    // the projector screen (no roller bar across its top: that dark strip hid the top of the picture) and a ceiling projector with its beam
    P.panel(0, 3.1, -10.8, 9.6, 5.4, 0, ctx.screenTex, { emissive: 1, key: 'screen' });         // 16:9
    P.box(0, 5.55, 1.5, 0.6, 0.25, 0.5, '#e8e8e2', { collide: false });
    P.box(0, 5.8, 1.5, 0.08, 0.3, 0.08, '#8a8f96', { collide: false });
    P.beams = [{ from: [0, 5.55, 1.2], to: [0, 3.1, -10.75], w: 9.6, h: 5.4 }];
    // podium + AI Confluence standees on the stage
    P.box(-5.4, 0.4, -8.6, 0.9, 1.15, 0.6, '#6b4a2f');
    presenterPC(P, ctx, { x: -5.4, y: 1.55, z: -8.45, mon: { x: 0, y: 3.1, z: -10.8, yaw: 0, w: 9.6, h: 5.4 }, ident: { id: 'conf', user: 'iitg', pass: 'iitg', place: 'Conference Centre', device: 'CONF-PC-01' } });
    const standee = (t) => textTex(t, { w: 256, h: 768, bg: '#0b2e5c', fg: '#e8f4ff', size: 36, align: 'center', title: 'AI CONFLUENCE', titleColor: '#4fc3f7' });
    P.panel(-6.6, 1.6, -10.6, 1.1, 2.4, 0, standee(['IIT Guwahati', '', 'Talks', 'Demos', 'Posters']));
    P.panel(6.6, 1.6, -10.6, 1.1, 2.4, 0, standee(['BSc (Hons)', 'Data Science', '& AI', '', 'OES · IITG']));
    // rows of padded chairs with a centre aisle (flat floor)
    const seats = [];
    for (let r = 0; r < 9; r++) for (let c = -10; c <= 10; c++) {
      if (Math.abs(c) < 1) continue;
      const x = c * 0.62, z = -5.2 + r * 1.35;
      P.box(x, 0.43, z, 0.52, 0.08, 0.48, '#243a63', { collide: false });
      P.box(x, 0.47, z + 0.24, 0.52, 0.55, 0.07, '#243a63', { collide: false, cast: false });
      seats.push(P.seat(x, z + 0.05, Math.PI, 0));
    }
    seats.forEach((s, i) => { if (i % 2 === 0 || ctx.eventAct) P.spot(s.x, s.z, s.yaw, AN.SIT, { role: i % 7 ? 'student' : 'faculty', when: ctx.confOcc || occ([[10, 13, 0.45], [14, 17, 0.35]]), y: 0, seat: s, clap: true }); });
    const mine = seats[Math.floor(seats.length * 0.4)];
    P.act(mine.x, mine.z, ctx.eventAct?.label || (ctx.video ? `Watch "${ctx.video.title}"` : 'Sit and watch the talk'), () => ctx.go(ctx.eventAct?.id || 'movie', { seat: mine }), { y: 0, r: 3 });
    P.spot(-5.4, -9.2, 0, AN.LECTURE, { role: 'faculty', when: ctx.confOcc || occ([[10, 13, 0.8], [14, 17, 0.6]]), y: 0.4, prof: true });
    P.board(11.8, 1.2, 2, 3.2, 1.8, -Math.PI / 2, notice('CONFERENCE CENTRE', ['AI Confluence: talks · demos · posters', 'Seminars every Friday 4 PM', 'Silence your phones please']));
    P.sideExits(-6.6, ctx.leave);
    for (const z of [-7, -1, 5]) for (const x of [-8, 0, 8]) P.tubeLight(x, z);
    P.spawn = { x: 0, z: 9.6, yaw: Math.PI };
    return P;
  },

  admin(ctx) {
    const P = new Plan(ctx.name, 30, 24, 4.2, { floor: 'marble', wall: '#ece5d6', seed: ctx.seed });
    P.counter(0, 6, 6, 0.9, '#6b4a2f');
    P.spot(-1.2, 5.2, 0, AN.TYPE, { role: 'staff', when: STAFF }); P.spot(1.2, 5.2, 0, AN.SIT, { role: 'staff', when: STAFF });
    P.panel(0, 3.2, 11.87, 5, 0.7, Math.PI, textTex(['RECEPTION / ENQUIRY'], { w: 1024, h: 128, bg: '#7d1f1f', size: 60, align: 'center' }));
    for (let k = 0; k < 6; k++) { const s = P.chair(-11 + k * 0.7, 9.5, Math.PI, '#2b3a55'); P.spot(s.x, s.z, s.yaw, AN.SIT, { role: 'parent', when: STAFF, seat: s }); }
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
      const s = P.desk(-11 + k * 5, -6 + r * 5, Math.PI, { pc: true });
      P.spot(s.x, s.z, s.yaw, AN.TYPE, { role: 'staff', when: STAFF, seat: s });
      P.shelf(-11 + k * 5, -11.6, 2.4, 0, 2, false);
    }
    P.board(12.9, 1.2, 4, 2.6, 1.6, -Math.PI / 2, notice('ADMINISTRATION', ['Office hours: 9 AM - 5:30 PM', 'Scholarship forms: Room 104', 'ID card renewal: bring 2 photos', 'Fee payment: bank branch, ground floor']));
    P.act(0, 7.4, 'Ask at the enquiry desk', () => ctx.go('enquiry', {}));
    for (const z of [-6, 1, 7]) for (const x of [-9, 0, 9]) P.tubeLight(x, z);
    return P;
  },

  hospital(ctx) {
    const P = new Plan(ctx.name, 32, 26, 4, { floor: 'hospital', wall: '#f2f4f2', seed: ctx.seed });
    P.counter(-9, 8, 5, 0.8, '#e0e6e8');
    P.spot(-9, 7.2, 0, AN.TYPE, { role: 'nurse', when: ALWAYS });
    P.panel(-9, 3.1, 12.87, 5, 0.7, Math.PI, textTex(['RECEPTION · OPD'], { w: 1024, h: 128, bg: '#00897b', size: 60, align: 'center' }));
    for (let k = 0; k < 8; k++) { const s = P.chair(2 + k * 0.7, 9.5, Math.PI, '#4f93c9'); P.spot(s.x, s.z, s.yaw, k % 3 ? AN.SIT : AN.PHONE, { role: k % 2 ? 'student' : 'parent', when: occ([[9, 13, 0.6], [16, 20, 0.5]]), seat: s }); }
    // doctor's cabin
    P.box(-4, 0, -4, 0.2, 3, 10, '#f2f4f2');
    P.desk(-10, -3, 0, { lamp: true });
    P.spot(-10, -3.25, 0, AN.TALK, { role: 'doctor', when: occ([[9, 13, 1], [15, 19, 1]]) });
    P.act(-10, -1.8, 'See the doctor (check-up)', () => ctx.go('checkup', {}));
    // ward
    for (let k = 0; k < 5; k++) { P.bed(2 + k * 2.5, -9.5, 0); if (k % 2) P.spot(2 + k * 2.5, -9.5, 0, AN.LIE, { role: 'student', when: ALWAYS, y: 0.55 }); }
    P.box(14, 0, 2, 3, 2.3, 0.6, '#c7ccd1');
    P.panel(14, 2.8, 2.35, 3, 0.5, Math.PI, textTex(['AMBULANCE BAY →'], { w: 512, h: 96, bg: '#c62828', size: 46, align: 'center' }));
    P.act(14, 3.6, 'Volunteer as ambulance driver (job)', () => ctx.go('ambulanceJob', {}));
    P.counter(14.6, 8.5, 4, 0.8, '#e0e6e8', Math.PI / 2);
    P.spot(15.4, 8.5, -Math.PI / 2, AN.SERVE, { role: 'nurse', when: occ([[9, 21, 1]]) });
    P.panel(15.86, 3.0, 8.5, 3.6, 0.6, -Math.PI / 2, textTex(['PHARMACY · till 9 PM'], { w: 768, h: 128, bg: '#00897b', size: 52, align: 'center' }));
    P.act(13.4, 8.5, 'Buy medicine at the pharmacy', () => ctx.go('shop', { name: 'IITG Pharmacy', kind: 'shop', menu: [['Paracetamol strip', 12, 8], ['ORS sachet', 10, 16], ['Glucose biscuits', 20, 12], ['Bandage & antiseptic', 35, 0]] }), { r: 2.0, ok: () => (ctx.g.clock.hour >= 9 && ctx.g.clock.hour < 21 ? true : 'the pharmacy is open 9 AM to 9 PM') });
    P.spot(13, 3, Math.PI, AN.STAND, { role: 'nurse', when: ALWAYS });
    for (const z of [-8, 0, 7]) for (const x of [-10, 2, 12]) P.tubeLight(x, z);
    return P;
  },

  gym(ctx) {
    const P = new Plan(ctx.name, 28, 22, 5, { floor: 'wood', wall: '#e8e2d4', seed: ctx.seed });
    P.box(0, 0.2, -10.9, 24, 2.6, 0.05, '#b8c8d0', { collide: false });   // mirror wall
    for (let k = 0; k < 4; k++) { P.box(-10 + k * 2.2, 0, -7, 0.9, 1.3, 2, '#2a2d31'); P.spot(-10 + k * 2.2, -7.3, Math.PI, AN.RUN, { role: 'student', when: occ([[6, 9, 0.6], [17, 21, 0.8]]), y: 0.25 }); }
    for (let k = 0; k < 3; k++) { P.bench(3 + k * 3, -5, 1.4, Math.PI / 2, '#1c1c1c'); P.spot(3 + k * 3, -5.9, 0, AN.LIFT, { role: 'student', when: occ([[6, 9, 0.6], [17, 21, 0.8]]) }); }
    P.box(10, 0, 3, 4, 1.2, 0.7, '#555');                               // dumbbell rack
    for (let k = 0; k < 4; k++) P.spot(-8 + k * 2.5, 4, Math.PI, AN.STRETCH, { role: 'student', when: occ([[6, 9, 0.5], [17, 21, 0.6]]) });
    // ---- the rest of a proper gym: cardio (exercise bikes, cross-trainers), squat racks with plates, a cable station, lat pull-downs, a leg
    // press, kettlebells, a punching bag, yoga mats, a reception desk, trainers, a water cooler, a scale, posters and a TV; and the people using them
    const MORN = [[6, 9.5, 0.7], [16.5, 21.5, 0.85]], EVE = [[17, 21.5, 0.9]], DAY = [[6, 21.5, 0.35]];
    const steel = '#2a2d31', chrome = '#c9ced4', rubber = '#1c1c1c';
    for (let k = 0; k < 4; k++) {                                  // exercise bikes: a frame, a saddle, handlebars, a screen
      const x = -11.5 + k * 2, z = -2.5;
      P.box(x, 0, z, 0.5, 0.22, 1.0, steel); P.box(x, 0.2, z + 0.25, 0.08, 0.95, 0.08, steel, { collide: false }); P.box(x, 0.95, z - 0.3, 0.3, 0.07, 0.25, rubber, { collide: false });
      P.box(x, 1.1, z + 0.4, 0.5, 0.05, 0.05, chrome, { collide: false }); P.box(x, 1.25, z + 0.4, 0.3, 0.2, 0.04, '#0b0d10', { collide: false });
      if (k !== 2) P.spot(x, z - 0.3, 0, AN.SIT, { role: 'student', when: occ(MORN), y: 0.42 });
    }
    for (let k = 0; k < 3; k++) {                                  // cross-trainers
      const x = -3 + k * 2.1, z = -2.4;
      P.box(x, 0, z, 0.6, 0.2, 1.7, steel); P.box(x, 0.2, z + 0.7, 0.1, 1.35, 0.1, steel, { collide: false }); P.box(x - 0.25, 0.9, z + 0.2, 0.05, 0.05, 1.1, chrome, { collide: false }); P.box(x + 0.25, 0.9, z + 0.2, 0.05, 0.05, 1.1, chrome, { collide: false });
      P.box(x, 1.6, z + 0.65, 0.4, 0.2, 0.05, '#0b0d10', { collide: false });
      if (k !== 1) P.spot(x, z, 0, AN.RUN, { role: 'student', when: occ(MORN), y: 0.22 });
    }
    for (const x of [6.4, 11.2]) {                                 // squat racks with a loaded bar and plate trees
      for (const dx of [-0.95, 0.95]) for (const dz of [-0.6, 0.6]) P.box(x + dx, 0, 0 + dz, 0.09, 2.3, 0.09, steel);
      P.box(x, 2.3, 0, 2.0, 0.08, 1.3, steel, { collide: false }); P.box(x, 1.35, 0.6, 2.0, 0.05, 0.05, chrome, { collide: false });
      for (const dx of [-1.0, 1.0]) { P.box(x + dx, 1.15, 0.6, 0.07, 0.5, 0.5, rubber, { collide: false }); P.box(x + dx * 1.07, 1.15, 0.6, 0.06, 0.4, 0.4, '#b3262f', { collide: false }); }
      P.box(x, 0, 0, 1.9, 0.05, 1.5, '#3a3a3a', { collide: false });
      P.spot(x, 0.2, Math.PI, AN.LIFT, { role: 'student', when: occ(EVE) }); P.spot(x + 1.6, 1.4, -Math.PI / 2, AN.STAND, { role: 'student', when: occ(EVE) });
    }
    P.box(8.8, 0, -1.4, 0.5, 1.2, 0.5, steel); for (let k = 0; k < 5; k++) { P.cyl(8.8, 0.12 + k * 0.2, -1.4, 0.34 - k * 0.025, 0.12, '#b3262f', { seg: 10 }); }   // a plate tree
    // cable crossover station, two lat pull-downs, a leg press, a pec deck
    for (const dx of [-1.6, 1.6]) P.box(-12.4 + dx * 0.0, 0, 7.2 + dx, 0.15, 2.5, 0.15, steel); P.box(-12.4, 2.5, 7.2, 0.2, 0.1, 3.5, steel, { collide: false }); P.box(-12.9, 0.1, 7.2, 0.4, 2.0, 0.6, '#444', { collide: false });
    P.spot(-11.4, 7.2, -Math.PI / 2, AN.LIFT, { role: 'student', when: occ(DAY) });
    for (let k = 0; k < 2; k++) { const x = -9.2 + k * 2.6; P.box(x, 0, 8.2, 1.3, 0.1, 1.2, steel); P.box(x, 0.1, 8.8, 0.15, 2.3, 0.15, steel); P.box(x, 2.1, 8.2, 0.12, 0.12, 1.2, steel, { collide: false }); P.box(x, 0.45, 8.1, 0.5, 0.1, 0.45, rubber, { collide: false }); P.box(x, 1.1, 8.45, 1.0, 0.06, 0.06, chrome, { collide: false }); P.spot(x, 8.1, Math.PI, AN.SIT, { role: 'student', when: occ(DAY), y: 0.42 }); }
    P.box(-3.6, 0, 8.4, 1.1, 0.6, 2.2, steel); P.box(-3.6, 0.1, 9.6, 0.9, 0.5, 0.1, rubber, { collide: false }); P.box(-3.6, 1.2, 7.4, 0.9, 0.08, 0.08, chrome, { collide: false });
    P.spot(-3.6, 9.4, Math.PI, AN.SIT, { role: 'student', when: occ(DAY), y: 0.3 });
    P.box(1.8, 0, 8.6, 1.4, 1.5, 0.9, '#3a3f45'); for (let k = 0; k < 4; k++) P.box(1.8, 0.2 + k * 0.28, 8.1, 1.1, 0.06, 0.05, chrome, { collide: false });
    // kettlebells and medicine balls, a punching bag, yoga mats, a scale
    P.box(13.2, 0, -5, 0.6, 0.7, 2.4, steel); for (let k = 0; k < 6; k++) { P.cyl(13.2, 0.7, -5.9 + k * 0.38, 0.14, 0.2, ['#1c1c1c', '#c62828', '#1f5fa8'][k % 3], { seg: 8 }); }
    for (let k = 0; k < 3; k++) P.cyl(12.6 - k * 0.5, 0, -8.5, 0.28, 0.5, ['#2e7d4f', '#d8402f', '#1f5fa8'][k], { seg: 9 });
    P.cyl(12.2, 0.2, -1.0, 0.03, 1.8, '#9aa3aa', { seg: 6 }); P.cyl(12.2, 0.55, -1.0, 0.26, 1.15, '#7a1f1f', { seg: 10 }); P.spot(12.2, -0.2, Math.PI, AN.STAND, { role: 'student', when: occ(EVE) });
    for (let k = 0; k < 4; k++) { const x = -8.6 + k * 2.5; P.box(x, 0, 4.1, 0.75, 0.025, 1.8, ['#2e7d4f', '#5b3fa8', '#d8402f', '#1f5fa8'][k], { collide: false, cast: false }); }
    P.box(-12.6, 0, 3.4, 0.5, 0.08, 0.5, '#c9ced4'); P.box(-12.6, 0.08, 3.4, 0.3, 0.02, 0.2, '#0b0d10', { collide: false });
    // reception desk and the trainers
    P.counter(-11, 9.4, 3, 0.8, '#8a6a4a'); P.spot(-11, 8.55, 0, AN.TYPE, { role: 'staff', when: occ([[6, 21.5, 1]]) });
    P.panel(-11, 1.8, 9.6, 2.6, 0.5, Math.PI, textTex(['RECEPTION', 'ID card · Gym register'], { w: 640, h: 128, bg: '#1f3a5f', size: 34, align: 'center' }));
    P.spot(5.2, 2.2, Math.PI, AN.TALK, { role: 'faculty', when: occ([[6, 9.5, 1], [16.5, 21, 1]]) }); P.spot(-0.8, -3.2, 0, AN.TALK, { role: 'faculty', when: occ([[16.5, 21, 0.9]]) });
    P.cyl(13.2, 0, -9.7, 0.3, 1.2, '#9aa3ab', { collide: true });                              // the water cooler
    P.panel(8, 3.2, -10.85, 3.2, 1.8, 0, ctx.tvTex, { emissive: 1, key: 'tv' });                    // a TV on the mirror wall
    P.panel(-13.87, 2.6, -4.5, 2.0, 1.4, Math.PI / 2, poster('NO PAIN', 'NO GAIN', '#7a1f1f'));
    P.panel(-13.87, 2.6, 0.5, 2.0, 1.4, Math.PI / 2, poster('DRINK', 'WATER', '#1f5f8a'));
    P.panel(13.87, 2.6, 4.5, 2.0, 1.4, -Math.PI / 2, poster('LEG DAY', 'NEVER SKIP', '#2f5f3a'));
    P.act(-10, -1.4, 'Ride an exercise bike (cardio)', () => ctx.go('gym', {}), { r: 2.2 });
    P.act(8.8, 1.7, 'Do a set of squats (reps challenge)', () => ctx.go('gym', {}), { r: 2.2 });
    P.act(6, -4.2, 'Work out (reps challenge)', () => ctx.go('gym', {}));
    // your own treadmill (the fifth), and the lockers / changing room by the door
    P.box(-1.2, 0, -7, 0.9, 1.3, 2, '#2a2d31');
    P.act(-1.2, -5.5, 'Run on a treadmill', () => ctx.go('treadmill', { at: { x: -1.2, z: -7.3, y: 0.25, yaw: Math.PI } }), { r: 1.8 });
    for (let k = 0; k < 5; k++) P.box(12.6, 0, 6 + k * 0.85, 0.5, 1.9, 0.8, k % 2 ? '#3f73b8' : '#2f5d5a');
    P.panel(12.33, 2.2, 8.1, 4.4, 0.4, -Math.PI / 2, textTex(['LOCKERS · CHANGING ROOM'], { w: 768, h: 96, bg: '#1f3a5f', size: 44, align: 'center' }));
    P.act(11.4, 8.1, () => (ctx.g.gymSaved ? 'Change back into your clothes (locker room)' : 'Change into gym wear (locker room)'), () => ctx.g.toggleGymWear(), { r: 2.2 });
    for (const z of [-6, 2]) for (const x of [-8, 0, 8]) P.tubeLight(x, z);
    return P;
  },

  sac(ctx) {
    const P = new Plan(ctx.name, 34, 26, 7, { floor: 'wood', wall: '#e2dccf', seed: ctx.seed });
    P.box(-8, 0.2, -12.9, 16, 3, 0.05, '#b8c8d0', { collide: false });   // dance mirrors
    P.panel(9, 4.6, -12.85, 14, 1.2, 0, textTex(['STUDENT ACTIVITY CENTRE · CLUB ROOMS'], { w: 1024, h: 96, bg: '#2f5d5a', size: 48, align: 'center' }));
    const eve = occ([[17, 21.5, 0.9], [14, 17, 0.25]]);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) P.spot(-13 + k * 2.2, -8 + r * 2.3, Math.PI, AN.DANCE, { role: 'student', when: eve, extra: 0.1 });
    P.act(-8, -1.5, 'Join the dance club practice', () => ctx.go('dance', {}));
    // music corner: drum kit, keyboard, amps
    P.cyl(9, 0, -9, 0.3, 0.5, '#c62828'); P.cyl(10, 0.5, -9.6, 0.25, 0.15, '#c62828'); P.cyl(8.2, 0.8, -9.4, 0.3, 0.02, '#d4af37');
    P.box(12, 0, -8, 1.3, 0.9, 0.4, '#1c1c1c');
    for (const x of [6.5, 14]) P.box(x, 0, -10.5, 0.7, 1.1, 0.5, '#2a2a2a');
    P.spot(9, -8.2, Math.PI, AN.DRUM, { role: 'student', when: eve, opts: [OPT.DHOL] });
    P.spot(12, -7.4, Math.PI, AN.GUITAR, { role: 'student', when: eve, opts: [OPT.GUITAR] });
    P.spot(7, -7.6, Math.PI, AN.GUITAR, { role: 'student', when: eve, opts: [OPT.GUITAR] });
    P.act(10, -6.5, 'Jam with the music club', () => ctx.go('music', {}));
    // posters of the clubs and fests
    const clubs = [['CODING CLUB', 'Hack nights', '#1f4fa0'], ['ROBOTICS CLUB', 'Build · compete', '#5b2d7a'], ['DANCE CLUB', 'Practice 6 PM', '#b3262f'], ['MUSIC CLUB', 'Jam sessions', '#e2702f'],
      ['PHOTOGRAPHY', 'Photo walks', '#2e7d4f'], ['ASTRONOMY', 'Star parties', '#1f2a44'], ['TECHNICHE', 'Tech fest', '#0b4f9c'], ['ALCHERINGA', 'Cultural fest', '#6b2d8a']];
    clubs.forEach(([t, s, c], i) => P.panel(-16.87, 2.2, -10 + i * 2.6, 1.6, 2.2, Math.PI / 2, poster(t, s, c)));
    for (let k = 0; k < 6; k++) { const s = P.chair(13 + (k % 3) * 1.2, 5 + Math.floor(k / 3) * 1.4, Math.PI, '#e2702f'); P.spot(s.x, s.z, s.yaw, AN.TALK, { role: 'student', when: eve, seat: s }); }
    for (const z of [-8, 0, 8]) for (const x of [-10, 0, 10]) P.tubeLight(x, z);
    return P;
  },

  foodcourt(ctx) {
    const P = new Plan(ctx.name, 32, 24, 5, { floor: 'tiles', wall: '#f0e8da', seed: ctx.seed });
    const outlets = ctx.outlets || [['Pizza Corner', 'pizza', '#8a3b1c'], ['Sandwich Bar', 'roll', '#2e7d32'], ['Ice Cream Parlour', 'icecream', '#d81b60'], ['Momo House', 'momo', '#e2702f'], ['Cafe', 'coffee', '#6b4a2f']];
    outlets.forEach(([name, menu, col], i) => {
      const x = -12 + i * 6;
      P.counter(x, -9.5, 4.6, 0.9, '#d9d4c7');
      P.panel(x, 3.0, -11.87, 4.6, 0.8, 0, textTex([name], { w: 512, h: 96, bg: col, size: 50, align: 'center' }));
      P.spot(x, -10.4, 0, AN.SERVE, { role: 'mess', when: occ([[10, 23, 1]]) });
      P.act(x, -8.4, `Order at ${name}`, () => ctx.go('shop', { name, menu }));
    });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = -10.5 + c * 7, z = -2 + r * 4.5;
      P.table(x, z, 1.4, 1.4, '#f2f0ea', 0.74);
      for (const [dx, dz, yaw] of [[-1.0, 0, Math.PI / 2], [1.0, 0, -Math.PI / 2], [0, -1.0, 0], [0, 1.0, Math.PI]]) {
        const s = P.chair(x + dx, z + dz, yaw, '#e2702f');
        P.spot(s.x, s.z, s.yaw, (r + c) % 2 ? AN.EAT : AN.SITCHAT, { role: 'student', when: occ([[12, 15, 0.6], [18, 23, 0.8]]), seat: s, plate: true });
      }
    }
    for (const z of [-6, 1, 7]) for (const x of [-10, 0, 10]) P.tubeLight(x, z);
    return P;
  },

  shop(ctx) {
    const P = new Plan(ctx.name, 26, 20, 4, { floor: 'tiles', wall: '#efe6d6', seed: ctx.seed });
    const shops = ctx.shops || [];
    shops.slice(0, 4).forEach((s, i) => {
      const x = -9 + i * 6;
      P.counter(x, -6.5, 4, 0.8, '#a58d6a');
      P.shelf(x, -9.2, 4, 0, 2.2, true);
      P.panel(x, 3.0, -9.87, 4, 0.7, 0, textTex([s.name], { w: 512, h: 96, bg: '#1f5a3d', size: 46, align: 'center' }));
      P.spot(x, -7.4, 0, AN.STAND, { role: 'staff', when: occ([[8, 22, 1]]) });
      P.act(x, -5.5, `Buy at ${s.name}`, () => ctx.go('shop', { name: s.name, menu: s.menu }));
    });
    for (let k = 0; k < 5; k++) P.spot(-8 + k * 3.8, -4.4, 0, k % 2 ? AN.PHONE : AN.STAND, { role: k % 3 ? 'student' : 'parent', when: occ([[9, 21, 0.6]]) });
    for (const x of [-7, 0, 7]) P.tubeLight(x, 0);
    return P;
  },

  home(ctx) {
    const P = new Plan('Home', 14, 12, 3.2, { floor: 'red', wall: '#f1e8d2', seed: ctx.seed });
    const sofa = P.sofa(-3, -3.5, 2.4, 0, '#6b3d5e');
    P.box(-3, 0, -0.6, 1.2, 0.45, 0.6, '#6b4a2f');
    P.box(4.5, 0, -5.6, 1.4, 1.0, 0.6, '#5a4632');
    P.panel(4.5, 1.5, -5.28, 1.2, 0.7, 0, ctx.tvTex, { emissive: 1 });
    P.table(3, 1.5, 1.6, 0.9, '#8a6a4a');
    for (const [dx, yaw] of [[-0.6, 0], [0.6, 0]]) P.chair(3 + dx, 0.8, yaw, '#8a6a4a');
    P.counter(-5.8, 4, 2.4, 0.6, '#b9ad97', Math.PI / 2);
    sofa.forEach((s, i) => P.spot(s.x, s.z, s.yaw, AN.SIT, { role: i ? 'kid' : 'parent', when: occ([[17, 23, 0.8], [7, 9, 0.5]]), seat: s }));
    P.spot(-5, 4, -Math.PI / 2, AN.SERVE, { role: 'parent', when: occ([[7, 9, 0.8], [19, 21, 0.8]]) });
    P.plant(5.8, 4.5);
    P.act(-3, -2.2, 'Sit and chat with the family', () => ctx.go('rest', { seat: sofa[1] }));
    P.tubeLight(0, 0); P.fan(-2, -1);
    return P;
  },

  guest(ctx) {
    const P = new Plan(ctx.name, 26, 20, 4.2, { floor: 'marble', wall: '#efe8da', seed: ctx.seed });
    P.counter(-6, 5, 4, 0.8, '#6b4a2f');
    P.spot(-6, 4.2, 0, AN.TYPE, { role: 'staff', when: ALWAYS });
    P.panel(-6, 3.1, 9.87, 4.2, 0.7, Math.PI, textTex(['RECEPTION'], { w: 512, h: 96, bg: '#6b4a2f', size: 56, align: 'center' }));
    const s1 = P.sofa(5, -2, 3, Math.PI, '#2b3a55'), s2 = P.sofa(5, -6, 3, 0, '#2b3a55');
    [...s1, ...s2].forEach((s) => P.spot(s.x, s.z, s.yaw, AN.SITCHAT, { role: 'guest', when: occ([[8, 22, 0.5]]), seat: s }));
    P.box(5, 0, -4, 1.4, 0.45, 0.8, '#8a6a4a');
    P.plant(-11, -8); P.plant(11, -8);
    P.act(-6, 6.2, 'Ask about a room', () => ctx.go('enquiry', {}));
    for (const x of [-6, 5]) P.tubeLight(x, 0);
    return P;
  },

  /** the Director's Bungalow: a drawing room with a carpet, a chandelier, two sofa sets, a dining table for ten, a study corner at the
   *  back with the flag and the Director at the desk, a piano, bookshelves and paintings. You are here by appointment. */
  bungalow(ctx) {
    const P = new Plan("Director's Bungalow", 36, 28, 4.8, { floor: 'wood', wall: '#f3ecdc', seed: ctx.seed });
    const gold = '#c9a227';
    // the carpet and its border
    P.box(-3, 0, 1, 15, 0.025, 11, '#7a1f2b', { collide: false, cast: false });
    P.box(-3, 0.026, 1, 14.2, 0.01, 10.2, '#5c1620', { collide: false, cast: false });
    P.box(-3, 0.036, 1, 15.2, 0.005, 11.2, gold, { collide: false, cast: false });
    // the chandelier: gold rings, crystals, warm bulbs
    for (const [x, z] of [[-3, 1], [11, 6]]) {
      P.cyl(x, 4.2, z, 0.04, 0.6, gold, { seg: 6 });
      P.cyl(x, 3.95, z, 0.9, 0.06, gold, { seg: 20 }); P.cyl(x, 3.7, z, 0.6, 0.05, gold, { seg: 18 });
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; P.cyl(x + Math.cos(a) * 0.9, 4.0, z + Math.sin(a) * 0.9, 0.05, 0.16, '#fff2c4', { seg: 6 }); P.cyl(x + Math.cos(a) * 0.9, 3.55, z + Math.sin(a) * 0.9, 0.025, 0.4, '#e9f4ff', { seg: 5 }); }
      P.tubeLight(x, z);
    }
    // two sofa sets round a coffee table, armchairs, a rug-side table with flowers
    const s1 = P.sofa(-6.2, 1, 3.4, Math.PI / 2, '#2f4a3a'), s2 = P.sofa(0.2, 1, 3.4, -Math.PI / 2, '#2f4a3a'), s3 = P.sofa(-3, 5.2, 3.6, Math.PI, '#2f4a3a');
    P.table(-3, 1, 2.2, 1.1, '#4a2f1c', 0.45);
    P.cyl(-3, 0.46, 1, 0.14, 0.34, '#e8e4da'); P.cyl(-3, 0.8, 1, 0.12, 0.2, '#e86f9c', { seg: 7 });
    for (const [x, z, yaw] of [[-8.6, 3.2, 1.2], [2.6, 3.2, -1.2]]) { P.box(x, 0, z, 1.0, 0.45, 1.0, '#6b2a2a', { rotY: yaw }); P.box(x - 0.3 * Math.sin(yaw), 0.45, z - 0.3 * Math.cos(yaw), 1.0, 0.5, 0.16, '#5a2222', { rotY: yaw, collide: false }); }
    [...s1, ...s2, ...s3].forEach((s, i) => { if (i % 3 !== 2) P.spot(s.x, s.z, s.yaw, AN.SIT, { role: 'staff', when: occ([[10, 17.5, 0.6]]), seat: s, y: 0 }); });
    // the dining table for ten under the second chandelier
    P.table(11, 6, 6.2, 1.6, '#3b2415', 0.76);
    P.box(11, 0.77, 6, 5.6, 0.02, 0.9, '#f4efe2', { collide: false });
    for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) { const x = 8.9 + k * 1.05, z = 6 + sd * 1.1, yaw = sd > 0 ? Math.PI : 0, c = P.chair(x, z, yaw, '#3b2415'); P.cyl(x, 0.78, 6 + sd * 0.45, 0.14, 0.02, '#f4f1ea'); if (k === 0 && sd < 0) P.spot(c.x, c.z, c.yaw, AN.EAT, { role: 'guest', when: occ([[12.5, 14, 0.7], [19.5, 21.5, 0.7]]), seat: c, y: 0 }); }
    P.cyl(11, 0.78, 6, 0.18, 0.5, '#e8e4da'); for (let k = 0; k < 5; k++) P.cyl(11 + Math.cos(k * 1.3) * 0.1, 1.28, 6 + Math.sin(k * 1.3) * 0.1, 0.07, 0.12, ['#e86f9c', '#f2c12e', '#ff7a1a', '#d92b2b', '#f4f1ea'][k], { seg: 6 });
    // a waiter with the tea tray
    P.spot(7.4, 3.4, Math.PI / 2, AN.SERVE, { role: 'mess', when: occ([[9, 21, 1]]) });
    // the study corner at the back: a big desk, a leather chair, the flag and the Director
    P.box(0, 0, -10.6, 3.2, 0.78, 1.3, '#3b2415'); P.box(0, 0.78, -10.6, 3.4, 0.05, 1.5, '#5a3a22', { collide: false });
    P.box(-0.9, 0.83, -10.5, 0.5, 0.03, 0.36, '#f2f0ea', { collide: false });
    P.cyl(1.1, 0.83, -10.5, 0.14, 0.18, '#c62828', { seg: 8 });
    P.box(0, 0, -12.2, 1.1, 1.2, 0.5, '#2a1a10'); P.box(0, 1.2, -12.45, 1.0, 0.8, 0.12, '#2a1a10', { collide: false });
    P.spot(0, -11.85, 0, AN.TYPE, { role: 'faculty', when: ALWAYS, y: 0 });
    for (const x of [-1.2, 1.2]) { const c = P.chair(x, -8.6, Math.PI, '#7a2630'); void c; }       // the visitors' chairs face the Director's desk
    const flag = canvasTexture(256, 170, (g, w, h) => { g.fillStyle = '#ff9933'; g.fillRect(0, 0, w, h / 3 + 1); g.fillStyle = '#fff'; g.fillRect(0, h / 3, w, h / 3 + 1); g.fillStyle = '#138808'; g.fillRect(0, 2 * h / 3, w, h / 3); g.strokeStyle = '#000080'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, h / 6, 0, 7); g.stroke(); for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a) * h / 6, h / 2 + Math.sin(a) * h / 6); g.stroke(); } }, { repeat: false });
    P.panel(-2.4, 2.2, -13.55, 1.5, 1.0, 0, flag); P.cyl(-3.3, 0, -13.6, 0.035, 3.0, gold, { seg: 6 });
    P.panel(2.4, 2.2, -13.55, 1.5, 1.0, 0, textTex(["DIRECTOR'S OFFICE", 'IIT Guwahati'], { w: 512, h: 340, bg: '#1c2f5c', fg: '#f4efe6', size: 44, align: 'center' }));
    // bookshelves floor to ceiling along the west wall, a trophy cabinet, a grand piano
    for (let k = 0; k < 5; k++) P.shelf(-17.6, -9 + k * 2.2, 2.0, Math.PI / 2, 3.4);
    P.box(-16.4, 0, 6.6, 0.9, 2.1, 2.6, '#3b2415'); P.panel(-15.93, 1.3, 6.6, 2.3, 1.6, Math.PI / 2, textTex(['TROPHIES', 'Awards · Medals · Cups'], { w: 512, h: 360, bg: '#241811', fg: gold, size: 40, align: 'center' }));
    P.box(14.4, 0, -6, 3.0, 0.9, 1.8, '#0e0e10'); P.box(14.4, 0.9, -6, 2.9, 0.08, 1.7, '#0e0e10', { collide: false }); P.box(13.2, 0.45, -6, 0.8, 0.5, 0.45, '#0e0e10', { collide: false }); P.box(14.4, 0.95, -6.3, 2.6, 0.04, 0.5, '#f4f1ea', { collide: false });
    // paintings in gold frames on the long walls
    const art = [['Brahmaputra', 'at dusk', '#9b5a2a'], ['Kaziranga', 'the rhino', '#2f5f3a'], ['Majuli', 'river island', '#1f5f8a'], ['Bihu', 'the dance', '#8a2a4a'], ['Hills', 'of the east', '#3a4a7a']];
    art.forEach(([t, s, bg], i) => { P.box(-12 + i * 5.4, 1.9 - 0.8, -13.82, 2.2, 1.6, 0.06, gold, { collide: false }); P.panel(-12 + i * 5.4, 1.9, -13.77, 2.0, 1.4, 0, poster(t, s, bg)); });
    for (const x of [-15, 15]) { P.cyl(x, 0, 11, 0.3, 0.7, '#c9b89a'); P.cyl(x, 0.7, 11, 0.05, 1.0, '#3e8a34', { seg: 6 }); P.cyl(x, 1.7, 11, 0.55, 0.6, '#3e8a34', { seg: 8 }); }
    for (const x of [-12, 12]) for (const z of [-8, 8]) P.tubeLight(x, z);
    P.fan(-3, 8); P.fan(11, 0); P.fan(-3, -6);
    // what you can do here
    P.act(0, -9.2, 'Talk to the Director', () => { const t = ctx.g.polish?.talker; const line = t ? t.say({ x: 0, z: 0, seed: 0.3 }, 'director') : 'Welcome. Please sit down.'; ctx.g.ui.subtitle('Director: “' + line + '”'); ctx.g.progress.count?.('chats'); }, { r: 2.4 });
    P.act(-3, 2.6, 'Have tea and biscuits with the Director', () => { ctx.g.ui.toast('A cup of Assam tea, and a long talk about the campus. You leave feeling encouraged.', 'gold', 'Tea with the Director'); ctx.g.progress.addXP?.(25, 'tea with the Director'); ctx.g.progress.eat?.(8, 'tea and biscuits'); }, { r: 2.6 });
    P.act(14.4, -4.4, 'Look at the grand piano', () => ctx.g.ui.toast('A black grand piano, polished like a lake at night. Nobody plays it when the Director is in a meeting.', 'info', 'Drawing room'), { r: 2.2 });
    return P;
  },

  generic(ctx) {
    const P = new Plan(ctx.name, 24, 18, 3.8, { floor: 'tiles', wall: '#ece5d6', seed: ctx.seed });
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
      const s = P.desk(-7 + k * 7, -3 + r * 5, Math.PI, { pc: true });
      P.spot(s.x, s.z, s.yaw, AN.TYPE, { role: 'staff', when: STAFF, seat: s });
    }
    P.shelf(0, -8.6, 6, 0, 2, true);
    P.board(-11.87, 1.2, 0, 3, 1.6, Math.PI / 2, notice(ctx.name.toUpperCase(), ['Office hours 9 AM - 5:30 PM', 'Please sign the visitors register']));
    for (const x of [-6, 0, 6]) P.tubeLight(x, 0);
    return P;
  },
};

/** Which template a building gets. */
export function templateFor(b, site) {
  const lm = site?.lm;
  if (b.bungalow) return 'bungalow';
  if (b.school) return 'school';
  if (b.computerCentre) return 'computer';
  if (lm === 'lhc') return 'lecture';
  if (lm === 'library') return 'library';
  if (lm === 'auditorium') return 'auditorium';
  if (lm === 'conference') return 'conference';
  if (lm === 'admin' || b.kind === 'admin') return 'admin';
  if (lm === 'hospital' || b.kind === 'hospital') return 'hospital';
  if (lm === 'gym') return 'gym';
  if (lm === 'sac' || lm === 'newsac') return 'sac';
  if (lm === 'foodcourt') return 'foodcourt';
  if (lm === 'shopping' || b.kind === 'commercial') return 'shop';
  if (lm === 'guesthouse' || lm === 'transit' || b.kind === 'guest') return 'guest';
  if (b.kind === 'hostel') return 'hostel';
  if (b.kind === 'academic') return 'academic';
  if (b.kind === 'residential') return 'home';
  if (b.kind === 'auditorium') return 'auditorium';
  return 'generic';
}

function fmt(h) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`; }
export { THREE };

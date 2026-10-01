// Takes the pictures used in README.md (docs/images/*.jpg) from the built game.
//   node tools/qa/screenshots.mjs [name ...]      e.g.  node tools/qa/screenshots.mjs guide mess
// Names: title menu onestop guide info mess thali presenter iitg-os map-board bus lawn pool
import fs from 'node:fs';
import path from 'node:path';
import { openGame, startAs, sleep, ROOT } from './lib.mjs';

const OUT = path.join(ROOT, 'docs', 'images');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const { page, ev, errs, close } = await openGame({ width: 1280, height: 720 });

const shoot = (name, opts = {}) => page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 84, ...opts });
/** toasts and subtitles never belong in a picture; the HUD only sometimes */
const chrome = (hud = true) => ev((hud) => { for (const id of ['toasts', 'subtitle']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; } for (const id of ['hud', 'keys', 'objective', 'hint']) { const el = document.getElementById(id); if (el) el.style.visibility = hud ? '' : 'hidden'; } }, hud);
const uncam = () => ev(() => { window.__camOverride = null; });
const outside = () => ev(async () => { const g = window.__game; g.ui.closeAll(); if (g.interior.active) await g.interiors.exit(0, { noScan: true }); g.activity.stop(true); g.setMode('walk'); });
const inside = (lm) => ev(async (lm) => { const g = window.__game; g.ui.closeAll(); if (g.interior.active) await g.interiors.exit(0, { noScan: true }); const s = g.world.site(lm); await g.fastTravel(s.ex + s.nx * 3, s.ez + s.nz * 3, true); await g.interiors.enter(s.blocks[0], { noScan: true }); }, lm);
const atInterior = (x, z, yaw, y = 0) => ev(([x, z, yaw, y]) => { const g = window.__game, O = g.interior.O, P = g.player; P.pos.set(O.x + x, O.y + y, O.z + z); P.heading = yaw; P.camYaw = yaw; P.vel.set(0, 0, 0); g.camera.userData.orbitInit = false; }, [x, z, yaw, y]);
const interiorCam = (x, y, z, tx, ty, tz) => ev(([x, y, z, tx, ty, tz]) => { const O = window.__game.interior.O; window.__camOverride = { x: O.x + x, y: O.y + y, z: O.z + z, tx: O.x + tx, ty: O.y + ty, tz: O.z + tz }; }, [x, y, z, tx, ty, tz]);

const SHOTS = {
  // the title screen (taller, so every tile shows)
  async title() {
    await page.setViewport({ width: 1280, height: 800 });
    await sleep(1800);
    await shoot('title');
    await page.setViewport({ width: 1280, height: 720 });
  },
  // the pause menu
  async menu() {
    await page.setViewport({ width: 1280, height: 800 });
    await chrome(true);
    await ev(() => { const g = window.__game; g.input.exitLock(); g.ui.openPause('game'); });
    await sleep(800);
    await shoot('menu');
    await ev(() => window.__game.ui.closeAll());
    await page.setViewport({ width: 1280, height: 720 });
  },
  // the OneStop phone, on Campus Live at lunch time
  async onestop() {
    await ev(() => { const g = window.__game; g.ui.closeAll(); g.clock.set(13.2); });
    await chrome(true);
    await ev(() => window.__game.onestop.open('live'));
    await sleep(900);
    await shoot('onestop');
    await ev(() => window.__game.onestop.close());
  },
  // the Game Guide (F1) on the swimming pool entry
  async guide() {
    await chrome(true);
    await ev(() => { const g = window.__game; g.input.exitLock(); g.ui.openGuide(); g.gameGuide.select('pool'); });
    await sleep(600);
    await shoot('guide');
    await ev(() => window.__game.ui.closeAll());
  },
  // the Info panel (I) in front of the library
  async info() {
    await chrome(true);
    await ev(async () => { const g = window.__game, s = g.world.site('library'); await g.fastTravel(s.ex + s.nx * 5, s.ez + s.nz * 5, true); const P = g.player; P.heading = Math.atan2(s.ex - P.pos.x, s.ez - P.pos.z); P.camYaw = P.heading; g.gameGuide.infoOpen = false; });
    await sleep(900);
    await page.keyboard.press('KeyI');
    await sleep(1400);
    await shoot('info');
    await page.keyboard.press('KeyI');
  },
  // the hostel mess at lunch: the queue at the serving counter, plates, long tables (cropped above the walls)
  async mess() {
    await ev(() => window.__game.clock.set(13.1));
    await inside('manas');
    await sleep(5500);
    await chrome(false);
    await interiorCam(-9.5, 4.3, 12.3, -10, 0.7, -6);
    await sleep(1000);
    await shoot('mess', { clip: { x: 0, y: 225, width: 1280, height: 495 } });
    await uncam();
  },
  // a served plate
  async thali() {
    await chrome(false);
    await ev(() => { const g = window.__game, m = g.mess, I = g.interior; g.progress.coupons = []; m.drop(true); g.progress.addCoupon({ meal: m.meal().id, hostel: 'manas', price: 0, method: 'card' }); m.takePlate(I); g.player.avatar.root.visible = false; const c = m.carrying; c.thali.reveal(c.thali.count); c.phase = 'served'; });
    await sleep(600);
    await ev(() => { const p = window.__game.mess.carrying.thali.group.position; window.__camOverride = { x: p.x, y: p.y + 0.6, z: p.z + 0.2, tx: p.x, ty: p.y, tz: p.z }; });
    await sleep(700);
    await shoot('thali', { clip: { x: 340, y: 60, width: 600, height: 600 } });
    await ev(() => { const g = window.__game; window.__camOverride = null; g.mess.carrying.thali.group.parent?.remove(g.mess.carrying.thali.group); g.player.avatar.root.visible = true; g.mess.drop(true); });
  },
  // on the auditorium stage at the presenter PC, the hall full
  async presenter() {
    await ev(() => window.__game.clock.set(20));
    await inside('auditorium');
    await sleep(2000);
    await atInterior(-6.5, -11.95, 0, 1.2);
    await chrome(true);
    await sleep(4500);
    await shoot('presenter');
  },
  // IITG OS on the presenter PC
  async 'iitg-os'() {
    await ev(() => window.__game.clock.set(20));
    await inside('auditorium');
    await sleep(1500);
    await atInterior(-6.5, -11.95, 0, 1.2);
    await sleep(800);
    await page.keyboard.press('KeyE'); await sleep(3200);
    await page.keyboard.type('iitg'); await page.keyboard.press('Enter'); await sleep(2200);
    await shoot('iitg-os');
    await page.keyboard.press('Escape'); await sleep(800);
  },
  // a "you are here" map board
  async 'map-board'() {
    await ev(() => window.__game.clock.set(11));
    await outside();
    await ev(async () => { const g = window.__game, b = g.signage.spots.maps[0]; await g.fastTravel(b.x + Math.sin(b.yaw) * 6, b.z + Math.cos(b.yaw) * 6, false); window.__camOverride = { x: b.x + Math.sin(b.yaw) * 4.6, y: b.y - 0.1, z: b.z + Math.cos(b.yaw) * 4.6, tx: b.x, ty: b.y, tz: b.z }; });
    await chrome(false);
    await sleep(1400);
    await shoot('map-board');
    await uncam();
  },
  // the IITG DUTY bus at a stop
  async bus() {
    await ev(() => window.__game.clock.set(11));
    await outside();
    await ev(() => window.__game.setMode('bus'));
    await sleep(2500);
    await ev(() => { const b = window.__game.busTour.bus.group, p = b.position, y = b.rotation.y, c = Math.cos(y), s = Math.sin(y); const rot = (x, z) => [x * c + z * s, -x * s + z * c]; const [ax, az] = rot(0.6, 11.5), [bx, bz] = rot(0, 5); window.__camOverride = { x: p.x + ax, y: p.y + 2.0, z: p.z + az, tx: p.x + bx, ty: p.y + 1.8, tz: p.z + bz }; window.__game.busTour.speedMul = 0; });
    await chrome(false);
    await sleep(1000);
    await shoot('bus');
    await uncam();
    await ev(() => window.__game.setMode('walk'));
  },
  // the mown lawn, shrubs and Ashoka trees in front of the Central Library
  async lawn() {
    await ev(() => window.__game.clock.set(11));
    await outside();
    await ev(async () => {
      const g = window.__game, L = g.world.lawns.find((l) => l.id === 'library');
      await g.fastTravel(L.x, L.z, false);
      const fx = L.ax, fz = L.az, sx = fz, sz = -fx, at = (f, s) => [L.x + fx * f + sx * s, L.z + fz * f + sz * s];
      const [px, pz] = at(20, 0), [tx, tz] = at(-10, 0);
      window.__camOverride = { x: px, y: g.world.heightAt(px, pz) + 2.0, z: pz, tx, ty: g.world.heightAt(tx, tz) + 4, tz };
    });
    await chrome(false);
    await sleep(1500);
    await shoot('lawn');
    await uncam();
  },
  // the swimming pool complex in the morning
  async pool() {
    await ev(() => window.__game.clock.set(9.5));
    await outside();
    await ev(async () => {
      const g = window.__game, w = g.world.water.find((q) => q.kind === 'pool'), r = w.rings[0]; let cx = 0, cz = 0;
      for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; }
      cx /= r.length / 2; cz /= r.length / 2;
      await g.fastTravel(cx, cz + 30, false);
      window.__camOverride = { x: cx + 24, y: w.level + 16, z: cz - 24, tx: cx, ty: w.level, tz: cz };
    });
    await chrome(false);
    await sleep(1600);
    await shoot('pool');
    await uncam();
  },
};

const names = only.length ? only : Object.keys(SHOTS);
await sleep(500);
for (const n of names) {
  if (!SHOTS[n]) { console.log('unknown shot', n, '- choose from', Object.keys(SHOTS).join(', ')); continue; }
  if (n !== 'title' && (await ev(() => window.__game.mode)) === 'title') await startAs(ev, { hour: 11 });
  if (n !== 'title') await ev(() => { const g = window.__game; g.clock.speedId = 'pause'; g.weather.setMode('clear'); g.weather.pick(true); g.progress.bank = 20000; g.progress.coins = 5000; });
  await SHOTS[n]();
  console.log('saved docs/images/' + n + '.jpg');
}
console.log(errs.slice(0, 6).join('\n') || 'no page errors');
await close();

// Can you always get out? Every vehicle mode: bicycle, scooter and car (moving and still, with the throttle held),
// the e-rickshaw, campus buggy, auto and taxi (stopped and moving, a double press of E, the Get off button), boat (jetty, shore,
// mid-lake), campus bus and the tours.   node tools/qa/vehicles.mjs
import { openGame, startAs, reporter, sleep } from './lib.mjs';

const { ev, press, state, errs, close, page } = await openGame({ width: 900, height: 560 });
const R = reporter();
await startAs(ev, { hour: 10 });
await ev(() => { window.__game.progress.coins = 5000; });
await sleep(500);
const at = (x, z) => ev(async (x, z) => { await window.__game.fastTravel(x, z, true); }, x, z);
const HOME = [-560, -640];          // open ground by the Main Gate road

// 1. bicycle
await at(...HOME); await ev(() => window.__game.setMode('bike'));
await sleep(800); let s = await state(); R.report('bicycle mounted', s, s.mode === 'bike');
await press('KeyE'); s = await state(); R.report('bicycle: E gets off', s, s.mode === 'walk' && !s.inWater);

// 2. scooter and car, moving and still
for (const kind of ['scooter', 'car']) {
  await at(...HOME);
  const started = await ev((kind) => { const g = window.__game, P = g.player.pos; const ok = g.drive.start(kind, P.x, P.z, 0); if (ok !== false) g.setMode('drive'); return ok !== false && g.mode === 'drive'; }, kind);
  await sleep(600);
  if (!started) { R.report(`${kind}: could not start`, '', false); continue; }
  // E while moving, with the throttle held down: it brakes to a stop and you get out by yourself (it used to need a second E, and the
  // held throttle sped it up again, so you could never get out)
  await ev(() => { window.__game.drive.speed = 8; });
  await page.keyboard.down('KeyW');
  await press('KeyE'); await sleep(1500); s = await state(); await page.keyboard.up('KeyW');
  R.report(`${kind}: E while moving and holding W brakes and gets out`, s, s.mode === 'walk' && !s.inWater && !s.inBuilding);
  await at(...HOME);
  await ev((kind) => { const g = window.__game, P = g.player.pos; const ok = g.drive.start(kind, P.x, P.z, 0); if (ok !== false) g.setMode('drive'); }, kind);
  await sleep(500);
  await ev(() => { window.__game.drive.speed = 0; });
  await press('KeyE'); s = await state(); R.report(`${kind}: E when slow gets out`, s, s.mode === 'walk' && !s.inWater && !s.inBuilding);
  await ev((kind) => { const g = window.__game, P = g.player.pos; const ok = g.drive.start(kind, P.x, P.z, 0); if (ok !== false) g.setMode('drive'); g.drive.speed = 9; }, kind);
  await sleep(400);
  await ev(() => document.getElementById('getout').click()); await sleep(1500); s = await state();
  R.report(`${kind}: the Get out button brakes and gets out`, s, s.mode === 'walk' && !s.inWater && !s.inBuilding);
}

// 2b. the e-rickshaw, the campus buggy, the auto and the taxi (passenger rides): hop in with E, get off with E or the button
await sleep(4000);
const hold = (kind) => ev(async (kind) => {
  const g = window.__game, T = g.transport;
  if (g.mode !== 'walk') g.setMode('walk');
  const v = T.list.find((q) => q.kind === kind && q.placed && q.state !== 'out');
  if (!v) return null;
  const p = v.model.group.position;
  await g.fastTravel(p.x + 2, p.z + 2, true);
  v.wait = 999; v.v = 0; window.__rv = v;
  return true;
}, kind);
const nearIt = () => ev(() => { const g = window.__game, v = window.__rv, p = v.model.group.position; g.player.pos.set(p.x + 1.5, g.world.heightAt(p.x, p.z), p.z + 1.5); });
for (const kind of ['erick', 'buggy', 'auto', 'taxi']) {
  if (!(await hold(kind))) { console.log(`  (no ${kind} on the road at this hour: skipped)`); if (kind === 'erick' || kind === 'buggy') R.report(`${kind}: found one to ride`, '', false); continue; }
  await sleep(1200); await nearIt(); await sleep(300);
  await press('KeyE'); await sleep(400); s = await state();
  if (!R.report(`${kind}: E hops in`, s, s.mode === 'ride')) { await ev(() => window.__game.setMode('walk')); continue; }
  const shown = await ev(() => !document.getElementById('getout').hidden);
  R.report(`${kind}: the Get off button is showing`, shown, shown === true);
  await ev(() => { window.__rv.wait = 0; });                       // it drives off
  await sleep(3000);
  await press('KeyE'); await sleep(400); s = await state();
  const out = await ev(() => { const g = window.__game, v = window.__rv, p = v.model.group.position, P = g.player.pos; return { ride: !!g.transport.ride, d: Math.hypot(P.x - p.x, P.z - p.z), vis: g.player.avatar.root.visible }; });
  R.report(`${kind}: E while it is moving gets you off`, { s, out }, s.mode === 'walk' && !out.ride && out.vis && !s.inWater && !s.inBuilding);
  // a second press of E straight away must not hop you back in
  await hold(kind); await sleep(1200); await nearIt(); await sleep(300);
  await press('KeyE'); await sleep(400);
  await ev(() => { window.__rv.wait = 999; });
  await page.keyboard.press('KeyE'); await sleep(70); await page.keyboard.press('KeyE'); await sleep(500); s = await state();
  R.report(`${kind}: a double press of E leaves you on foot`, s, s.mode === 'walk');
  // the button
  await hold(kind); await sleep(1200); await nearIt(); await sleep(300);
  await press('KeyE'); await sleep(400);
  await ev(() => document.getElementById('getout').click()); await sleep(400); s = await state();
  R.report(`${kind}: the Get off button gets you off`, s, s.mode === 'walk');
  // a ride that has lost its vehicle: you are not left in the seat
  await hold(kind); await sleep(1200); await nearIt(); await sleep(300);
  await press('KeyE'); await sleep(400);
  await ev(() => { window.__game.transport.ride = null; }); await sleep(400); s = await state();
  R.report(`${kind}: a seat with no ride behind it puts you back on foot`, s, s.mode === 'walk');
}

// 3. the boat: at the jetty, in the middle of the lake, near a shore
const lake = await ev(async () => {
  const g = window.__game; const j = g.boats.jetties.find((q) => /IITG/i.test(q.w.name)) || g.boats.jetties[0];
  await g.fastTravel(j.x, j.z, true);
  window.__jet = j;
  return { name: j.w.name, x: Math.round(j.x), z: Math.round(j.z) };
});
console.log('lake', JSON.stringify(lake));
await ev(() => { window.__game.boats.start(window.__jet, 'row'); });
await sleep(900); s = await state(); R.report('boat: started', s, s.mode === 'boat');
await press('KeyE'); s = await state(); R.report('boat: E at the jetty', s, s.mode === 'walk' && !s.inWater);
await ev(() => { window.__game.boats.start(window.__jet, 'speed'); });
await sleep(700);
await ev(() => {
  const B = window.__game.boats, r = B.j.w.rings[0]; let cx = 0, cz = 0;
  for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; }
  B.pos.x = cx / (r.length / 2); B.pos.z = cz / (r.length / 2); B.v = 0;
});
await sleep(500); await press('KeyE'); s = await state(); R.report('boat: E in mid-lake swims you ashore (never stuck)', s, s.mode === 'walk' && !s.inWater && !s.inBuilding);
await ev(() => {
  // a shore point at least 60 m from the jetty, then the boat 3 m out from it toward the middle
  const B = window.__game.boats, r = B.j.w.rings[0]; let shore = null, cx = 0, cz = 0;
  for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; if (!shore && Math.hypot(B.j.x - r[i], B.j.z - r[i + 1]) >= 60) shore = [r[i], r[i + 1]]; }
  cx /= r.length / 2; cz /= r.length / 2; shore = shore || [r[0], r[1]];
  const dx = cx - shore[0], dz = cz - shore[1], L = Math.hypot(dx, dz);
  B.pos.x = shore[0] + (dx / L) * 3; B.pos.z = shore[1] + (dz / L) * 3; B.v = 0;
});
await sleep(600); await press('KeyE'); s = await state(); R.report('boat: E near a shore gets out on land', s, s.mode === 'walk' && !s.inWater && !s.inBuilding);

// 4. tours
await at(...HOME); await ev(() => window.__game.setMode('bus'));
await sleep(1500); s = await state(); R.report('bus tour started', s, s.mode === 'bus');
await press('KeyE'); s = await state(); R.report('bus tour: E gets off', s, s.mode === 'walk');
await ev(() => window.__game.setMode('tour'));
await sleep(1500); await press('KeyE'); s = await state(); R.report('campus tour: E ends it', s, s.mode === 'walk');

R.report('no page errors', errs.slice(0, 4).join(' | '), errs.length === 0);
await close();
console.log(R.fails ? `\n${R.fails} of ${R.total} failed` : `\nall ${R.total} passed`);
process.exit(R.fails ? 1 : 0);

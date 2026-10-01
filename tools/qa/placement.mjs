// Placement and collision checks: the café's position, stall counters that stop you, the raised flag
// bed, traffic islands, and that no parked cycle stands on a road, a building, water or another object.
//   node tools/qa/placement.mjs
import { openGame, startAs, reporter, sleep } from './lib.mjs';

const { ev, errs, close } = await openGame({ width: 1280, height: 720 });
const R = reporter();
await startAs(ev, { hour: 11 });
await sleep(500);

// the café must be well away from the library door and not on a road
const cafe = await ev(() => {
  const g = window.__game, c = g.stallsObj.stalls.find((s) => s.name === 'Cafe Coffee Day'), lib = g.world.site('library');
  return c && { x: Math.round(c.x), z: Math.round(c.z), fromLibraryDoor: Math.round(Math.hypot(c.x - lib.ex, c.z - lib.ez)), wayClear: +g.graph.wayClearance(c.x, c.z, 30).toFixed(1) };
});
R.report('café: away from the library and off the road', cafe, !!cafe && cafe.fromLibraryDoor >= 25 && cafe.wayClear >= 6);

// walking straight into a food-stall counter: it must stop you
const hit = await ev(async () => {
  const g = window.__game, st = g.stallsObj.stalls.find((s) => s.kind === 'food' && s.vendor);
  await g.fastTravel(st.x + Math.sin(st.yaw) * 4, st.z + Math.cos(st.yaw) * 4, true);
  const P = g.player; P.pos.set(st.x + Math.sin(st.yaw) * 3, g.world.heightAt(st.x, st.z), st.z + Math.cos(st.yaw) * 3);
  const dx = -Math.sin(st.yaw), dz = -Math.cos(st.yaw); let minD = 99;
  for (let i = 0; i < 150; i++) { P.pos.x += dx * 0.04; P.pos.z += dz * 0.04; g.world.collide(P.pos, 0.34, P.pos.y); minD = Math.min(minD, Math.hypot(P.pos.x - st.x, P.pos.z - st.z)); }
  return { stall: st.name, closest: +minD.toFixed(2) };
});
R.report('stall counter stops you', hit, hit.closest >= 0.7);

// the flag bed is a raised, walkable surface
const bed = await ev(async () => {
  const g = window.__game, W = g.world, f = W.flagSpot; await g.fastTravel(f.x + 14, f.z, true);
  const P = g.player; P.pos.set(f.x + 13, W.heightAt(f.x + 13, f.z), f.z);
  const rises = [];
  for (let i = 0; i < 40; i++) { P.pos.x -= 0.12; W.collide(P.pos, 0.34, P.pos.y); rises.push(+(W.groundAt(P.pos.x, P.pos.z, P.pos.y) - W.heightAt(P.pos.x, P.pos.z)).toFixed(2)); }
  return { riseOnBed: rises[rises.length - 1] };
});
R.report('flag bed: you can walk up onto it', bed, bed.riseOnBed > 0.2 && bed.riseOnBed < 1.2);

// a traffic island is a raised kerb
const isl = await ev(() => { const g = window.__game, I = g.islands.find((q) => !q.rhino), W = g.world; return { name: I.name, rise: +(W.groundAt(I.x, I.z, W.heightAt(I.x, I.z)) - W.heightAt(I.x, I.z)).toFixed(2) }; });
R.report('traffic island is raised', isl, isl.rise > 0.05 && isl.rise < 0.8);

// parked cycles: none on roads, in buildings, in water, or inside something solid
const cy = await ev(() => {
  const g = window.__game, W = g.world, P = g.props.parked, bad = { surface: 0, solid: 0, road: 0, water: 0, building: 0 };
  for (const pb of P) {
    const top = W.surfaceTop(pb.x, pb.z);                       // a raised bed or plinth would swallow the wheels (a 3 cm paving slab does not)
    if (top != null && top - W.heightAt(pb.x, pb.z) > 0.12) bad.surface++;
    const s = W.solidAt(pb.x, pb.z, 0.25); if (s && s.tag !== 'cycle' && s.tag !== 'cyclepark') bad.solid++;
    if (g.graph.wayClearance(pb.x, pb.z, 0.6) < 0.3) bad.road++;
    if (W.waterAt(pb.x, pb.z)) bad.water++;
    if (W.buildingAt(pb.x, pb.z)) bad.building++;
  }
  return { parked: P.length, ...bad };
});
R.report('parked cycles are all on open ground', cy, cy.parked > 300 && !cy.surface && !cy.solid && !cy.road && !cy.water && !cy.building);

R.report('no page errors', errs.slice(0, 4).join(' | '), errs.length === 0);
await close();
console.log(R.fails ? `\n${R.fails} of ${R.total} failed` : `\nall ${R.total} passed`);
process.exit(R.fails ? 1 : 0);

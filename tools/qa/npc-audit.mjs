// Where do the walking people, cyclists and vehicles actually go? Samples the campus at 14 spots over
// the morning and counts anyone inside a building, in water, or a vehicle on a sports ground.
//   node tools/qa/npc-audit.mjs
import { openGame, startAs, reporter, sleep } from './lib.mjs';

const { ev, errs, close } = await openGame({ width: 800, height: 500 });
const R = reporter();
await startAs(ev, { hour: 10.5 });
await ev(() => { const g = window.__game; g.clock.speedId = 'real'; window.__aud = { seen: 0, samples: 0, inB: {}, inW: {}, inF: {}, examples: [] }; });

const spots = [[-560, 640], [-330, 460], [-230, 100], [-130, 40], [130, 130], [330, 150], [340, 300], [480, 150], [-430, -330], [60, -420], [-130, -30], [280, -60], [80, -700], [-560, 300]];
for (const [x, z0] of spots) {
  await ev(async (x, z) => { await window.__game.fastTravel(x, z, true); }, x, -z0);
  for (let k = 0; k < 6; k++) {
    await sleep(1200);
    await ev(() => {
      const g = window.__game, W = g.world, A = window.__aud, P = g.player.pos;
      const SPORT = new Set(['tennis', 'basketball', 'volleyball', 'soccer', 'hockey', 'cricket', 'athletics']);
      const pip = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
      const note = (kind, tag, p, extra) => {
        A.seen++;
        if (Math.hypot(p.x - P.x, p.z - P.z) > 260) return;
        A.samples++;
        const b = W.buildingAt(p.x, p.z), w = W.waterAt(p.x, p.z), f = W.fields.find((q) => SPORT.has(q.kind) && pip(p.x, p.z, q.ring));
        const key = `${kind}:${tag}`;
        if (b) { A.inB[key] = (A.inB[key] || 0) + 1; if (A.examples.length < 20) A.examples.push(['building', key, Math.round(p.x), Math.round(p.z), b.display || b.kind, extra]); }
        if (w && w.kind !== 'pool') { A.inW[key] = (A.inW[key] || 0) + 1; if (A.examples.length < 20) A.examples.push(['water', key, Math.round(p.x), Math.round(p.z), w.name, extra]); }
        if (f && (kind === 'veh' || kind === 'bike')) A.inF[key] = (A.inF[key] || 0) + 1;
      };
      for (const a of g.traffic.agents) { if (!a.group.visible) continue; note(a.kind === 'walker' ? 'walk' : a.kind === 'cyclist' ? 'bike' : 'veh', a.kind, a.group.position, a.e && a.e.i); }
      for (const p of g.life.people || []) if ((p.state === 'travel' || p.state === 'at') && !p.hidden) note(p.anim === 15 ? 'bike' : 'walk', 'life:' + p.state, p, p.role);
      for (const p of g.street.people || []) note(p.bike != null ? 'bike' : 'walk', 'street:' + p.role, p, p.role);
    });
  }
}
const r = await ev(() => window.__aud);
const count = (o) => Object.values(o).reduce((s, v) => s + v, 0);
console.log(`${r.samples} samples of ${r.seen} seen`);
R.report('enough people sampled', { samples: r.samples }, r.samples > 5000);
R.report('nobody walking or driving inside a building', { n: count(r.inB), ...r.inB }, count(r.inB) === 0);
R.report('nobody in water', { n: count(r.inW), ...r.inW }, count(r.inW) === 0);
R.report('no vehicle or cycle on a sports ground', { n: count(r.inF), ...r.inF }, count(r.inF) === 0);
if (r.examples.length) console.log('examples:', JSON.stringify(r.examples.slice(0, 8)));
R.report('no page errors', errs.slice(0, 4).join(' | '), errs.length === 0);
await close();
console.log(R.fails ? `\n${R.fails} of ${R.total} failed` : `\nall ${R.total} passed`);
process.exit(R.fails ? 1 : 0);

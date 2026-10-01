// The drawing budget: how much the graphics card is asked to draw in the busiest views. The game once drew 1,700 draw calls and 6.6 million triangles in its
// first view (most of it far-away trees, little signs and walking people) and stuttered. These numbers are counted, not timed, so they mean the same on every
// computer.   node tools/qa/perf.mjs
import { openGame, startAs, reporter, sleep } from './lib.mjs';

const { ev, errs, close } = await openGame({ width: 1280, height: 720 });
const R = reporter();
await startAs(ev, { hour: 11 });
await sleep(1500);

/** draw calls and triangles of one plain render of the scene from where the camera is (the shadow pass is left out: it is cheap and the same every frame) */
const load = () => ev(() => {
  const g = window.__game, r = g.renderer;
  g.drawDist.update(g.camera); g.veg.update(0, g.camera, g.sky);
  const sm = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false; r.info.autoReset = false;
  r.render(g.scene, g.camera); r.info.reset(); r.render(g.scene, g.camera);
  const o = { calls: r.info.render.calls, tris: r.info.render.triangles };
  r.info.autoReset = true; r.shadowMap.autoUpdate = sm;
  return o;
});

// the first view (the spawn point at the Main Gate: the busiest, it looks across a kilometre of trees)
let o = await load();
R.report('first view: draw calls', o, o.calls <= 1300);
R.report('first view: triangles', o, o.tris <= 5.5e6);
for (const [lm, calls, tris] of [['academic', 700, 4e6], ['lhc', 900, 5e6], ['viewpoint', 1200, 6.5e6], ['lake', 900, 5e6]]) {
  await ev(async (lm) => { const g = window.__game, l = g.world.landmark(lm); await g.fastTravel(l.wx + 6, l.wz + 6, true); }, lm);
  await sleep(1200);
  o = await load();
  R.report(`${lm}: draw calls and triangles`, o, o.calls <= calls && o.tris <= tris);
}

// the structure that keeps it cheap
const s = await ev(() => {
  const g = window.__game, T = g.veg.group.children, tri = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const worst = [0, 0, 0];
  T.forEach((m, i) => { worst[i % 3] = Math.max(worst[i % 3], tri(m)); });
  const hidden = g.drawDist.items.filter((q) => q.off).length;
  return { levels: T.length % 3 === 0, worst, items: g.drawDist.items.length, hidden, bias: g.drawDist.bias };
});
R.report('trees come in three levels of detail', s, s.levels);
R.report('a far tree is cheap (at most 60 triangles), a very far one cheaper (at most 30)', s.worst, s.worst[1] <= 60 && s.worst[2] <= 30 && s.worst[0] > 100);
R.report('small things have a draw distance', s, s.items > 300);

// a long jump brings the far things back at once
await ev(async () => { const g = window.__game, l = g.world.landmark('hospital'); await g.fastTravel(l.wx + 6, l.wz + 6, true); });
await sleep(1000);
const near = await ev(() => { const g = window.__game, c = g.camera.position; g.drawDist.update(g.camera); const shown = g.drawDist.items.filter((q) => !q.off && Math.hypot(q.x - c.x, q.z - c.z) < 120).length, missing = g.drawDist.items.filter((q) => q.off && Math.hypot(q.x - c.x, q.z - c.z) < 120).length; return { shown, missing }; });
R.report('after a jump everything near is drawn (nothing missing within 120 m)', near, near.missing === 0);

R.report('no page errors', errs.slice(0, 4).join(' | '), errs.length === 0);
await close();
console.log(R.fails ? `\n${R.fails} of ${R.total} failed` : `\nall ${R.total} passed`);
process.exit(R.fails ? 1 : 0);

// Runs every check, one after the other, and prints a summary. Exits non-zero if any failed.
//   npm run build && npm test          (the browser checks need Node 22.12+ and Google Chrome, Chromium or Edge)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECKS = [
  ['Logic: clearance geometry, roads, bus tour', 'unit.mjs'],
  ['End-to-end play-through (steps.json)', 'run.mjs'],
  ['Every vehicle lets you out', 'vehicles.mjs'],
  ['Placement and collisions', 'placement.mjs'],
  ['People never inside buildings or water', 'npc-audit.mjs'],
];
const results = [];
for (const [name, file] of CHECKS) {
  console.log(`\n=== ${name} (${file}) ===`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(here, file)], { stdio: 'inherit' });
  results.push([name, r.status === 0, ((Date.now() - t0) / 1000).toFixed(0)]);
}
console.log('\n=== Summary ===');
for (const [name, ok, s] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${s}s)`);
process.exit(results.every((r) => r[1]) ? 0 : 1);

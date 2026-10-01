// Runs the logic tests (unit-tests.mjs) under Node: bundles them with the game's own modules, no browser needed.
//   node tools/qa/unit.mjs
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(here, '.unit-tests.bundle.mjs');      // written next to the tests so the data path inside them stays valid
const out = await build({ entryPoints: [path.join(here, 'unit-tests.mjs')], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
writeFileSync(bundle, out.outputFiles[0].text);
try { await import(pathToFileURL(bundle).href); }
catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
finally { unlinkSync(bundle); }

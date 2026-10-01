// Bundle the game + three.js with esbuild and inline the campus data and
// textures, producing one self-contained HTML file (works offline, double-click).
//   node tools/build.mjs          minified (npm run build)
//   node tools/build.mjs --dev    not minified, for reading the bundle (npm run build:dev)
//   dist/IITG_Campus_3D.html  standalone page
//   dist/artifact.html        same page as a fragment (no <html>/<head>/<body>) for sharing as an Artifact
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = (...p) => join(ROOT, ...p);

const res = await build({
  entryPoints: [P('src/main.js')],
  bundle: true, format: 'iife', minify: !process.argv.includes('--dev'), write: false, target: 'es2020',
  legalComments: 'eof',                 // keeps the three.js MIT licence notice
  logLevel: 'warning',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const data = readFileSync(P('data/campus.json'), 'utf8').replace(/<\//g, '<\\/');
const ground = readFileSync(P('data/ground.jpg')).toString('base64');
const mask = readFileSync(P('data/mask.png')).toString('base64');
const tpl = readFileSync(P('src/index.html'), 'utf8');

const scripts =
  `<script>window.__GROUND__="data:image/jpeg;base64,${ground}";window.__MASK__="data:image/png;base64,${mask}";</script>\n` +
  `<script type="application/json" id="campus-data">${data}</script>\n` +
  `<script>${js}</script>\n`;

const split = tpl.indexOf('<div id="app">');
const head = tpl.slice(0, split), body = tpl.slice(split);
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}</head>
<body>
${body}
${scripts}</body>
</html>
`;
mkdirSync(P('dist'), { recursive: true });
writeFileSync(P('dist/IITG_Campus_3D.html'), standalone);
writeFileSync(P('dist/artifact.html'), tpl + '\n' + scripts);
const mb = (f) => (statSync(P(f)).size / 1e6).toFixed(2);
console.log(`dist/IITG_Campus_3D.html  ${mb('dist/IITG_Campus_3D.html')} MB  (code ${(js.length / 1e6).toFixed(2)} MB)`);
console.log(`dist/artifact.html        ${mb('dist/artifact.html')} MB`);

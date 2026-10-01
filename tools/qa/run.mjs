// The end-to-end check: drives the built game in headless Chrome through steps.json.
//   node tools/qa/run.mjs [steps.json]
// Each step is { name, do, keys, type, wait, check, expect }:
//   do      JavaScript run in the page first         keys   real key presses, e.g. ["KeyE", "Shift+KeyN"]
//   type    text typed on the keyboard ("\n" = Enter) wait  milliseconds to let the game react
//   check   JavaScript whose (JSON) result is tested expect a regular expression the result must match
// A step also fails on any page error.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { openGame, ROOT, sleep } from './lib.mjs';

const file = process.argv[2] || path.join(ROOT, 'tools', 'qa', 'steps.json');
const steps = JSON.parse(readFileSync(file, 'utf8'));
const { page, errs, close } = await openGame({ width: 1280, height: 800, sound: true });

await page.evaluate(() => { window.__noKids = true; window.__game.begin('walk'); });
let fails = 0;
for (const s of steps) {
  const e0 = errs.length;
  try {
    if (s.do) await page.evaluate((c) => (0, eval)(c), s.do);
    if (s.keys) {
      for (const k of s.keys) {
        const parts = k.split('+');
        for (const q of parts) await page.keyboard.down(q);
        await sleep(60);
        for (const q of parts.slice().reverse()) await page.keyboard.up(q);
        await sleep(120);
      }
    }
    if (s.type) {                                      // typed text, "\n" presses Enter
      for (const ch of s.type) { if (ch === '\n') await page.keyboard.press('Enter'); else await page.keyboard.type(ch); await sleep(25); }
    }
    await sleep(s.wait || 300);
    const v = s.check ? await page.evaluate((c) => JSON.stringify((0, eval)(c)), s.check) : '';
    const bad = s.expect && !new RegExp(s.expect).test(v);
    const newErr = errs.slice(e0);
    if (bad || newErr.length) fails++;
    console.log(`${bad || newErr.length ? 'FAIL' : 'ok  '} ${s.name}: ${String(v).slice(0, 300)}${newErr.length ? '\n     ' + newErr.slice(0, 3).join('\n     ') : ''}`);
  } catch (e) { fails++; console.log(`FAIL ${s.name}: ${e.message.slice(0, 300)}`); }
}
console.log(`\n${steps.length - fails}/${steps.length} passed`);
await close();
process.exit(fails ? 1 : 0);

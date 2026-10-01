// Shared by the test scripts in this folder: start Chrome, open the built game, wait for it to load.
//   CHROME_PATH=/path/to/chrome   use a particular browser (Chrome, Chromium or Edge)
//   QA_URL=http://localhost:8871/ test the game served by tools/serve.mjs instead of dist/IITG_Campus_3D.html
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const GAME_FILE = path.join(ROOT, 'dist', 'IITG_Campus_3D.html');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const local = process.env.LOCALAPPDATA;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    local && path.join(local, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error('No Chrome found. Install Google Chrome, or set CHROME_PATH to a Chrome, Chromium or Edge executable.');
  return hit;
}

/**
 * Launches the browser and opens the game, waiting until its start menu is up.
 * Returns { browser, page, errs, ev, press, state, close } where `errs` collects page errors.
 */
export async function openGame({ width = 1280, height = 800, sound = false } = {}) {
  if (!existsSync(GAME_FILE) && !process.env.QA_URL) throw new Error('dist/IITG_Campus_3D.html is missing: run `npm run build` first.');
  const gpu = process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: [...gpu, ...(sound ? ['--autoplay-policy=no-user-gesture-required'] : [])],
    defaultViewport: { width, height },
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 300)); });
  await page.goto(process.env.QA_URL || pathToFileURL(GAME_FILE).href);
  await page.waitForFunction(() => !document.getElementById('menu').hidden || /Could not/.test(document.getElementById('loadmsg').textContent), { timeout: 240000 });
  const lm = await page.$eval('#loadmsg', (e) => e.textContent);
  if (/Could not/.test(lm)) { await browser.close(); throw new Error('The game failed to load: ' + lm + '\n' + errs.join('\n')); }
  const ev = (f, ...a) => page.evaluate(f, ...a);
  const press = async (code, ms = 120) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); await sleep(250); };
  const state = () => ev(() => { const g = window.__game, P = g.player.pos, W = g.world; return { mode: g.mode, x: Math.round(P.x), z: Math.round(P.z), inWater: !!(W.waterAt(P.x, P.z) && W.waterAt(P.x, P.z).kind !== 'pool'), inBuilding: !!W.buildingAt(P.x, P.z), inside: W.insideCampus(P.x, P.z) }; });
  return { browser, page, errs, ev, press, state, sleep, close: () => browser.close() };
}

/** A standard test character, on foot at a chosen hour with clear weather. */
export function startAs(ev, { hour = 10, hostel = 'manas' } = {}) {
  return ev((hour, hostel) => {
    const g = window.__game;
    Object.assign(g.progress.profile, { setup: true, name: 'Test', roll: '23015004512', room: 'B-214', hostel });
    g.begin('walk'); g.clock.set(hour); g.weather.setMode('clear'); g.weather.pick(true);
  }, hour, hostel);
}

/** Prints a line per check and remembers failures, so a script can exit non-zero. */
export function reporter() {
  let fails = 0, total = 0;
  const report = (name, detail, ok) => { total++; if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, typeof detail === 'string' ? detail : JSON.stringify(detail)); return !!ok; };
  return { report, get fails() { return fails; }, get total() { return total; } };
}

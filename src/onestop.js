// OneStop: the campus entry app on your phone, the QR machines it scans and the automatic gates.
//
//  - A OneStop machine stands at every campus gate (on the wall line, a screen on each side), at every
//    hostel's door and compound gate, at the pool gate (both sides), the View Point, the Computer
//    Centre and the Cafe Coffee Day. Press E at one (or O anywhere, also on a cycle) to scan it.
//  - Every scan is an entry with a direction and a time. Going out of the campus opens an entry (you
//    say where: Khokha, City or Others) and coming back in closes it, like the real gate log; at a
//    hostel, the pool, the View Point, the Computer Centre or the café the first scan is "in" and the
//    next one "out". Signing a hostel's paper register makes the same kind of entry, in and out times.
//  - The campus gates and the pool gate are automatic: after a scan the gate slides open for a few
//    seconds, otherwise it stays shut (on foot or on a cycle you cannot pass without scanning); cars
//    and buses have a boom barrier that lifts for them. Hostel and Computer Centre doors slide open as
//    you scan in or out. Crossing the campus wall in a car, a bus or a taxi, the guard notes it for you.
//  - The app keeps your name, roll number (9 digits, or 11 for BSc students), hostel and room. The hostel you choose is where
//    the game starts: outside its door.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { drawQR } from './qr.js';
import { mergeColored, m4, pointInRing, canvasTexture } from './util.js';
import { GIRLS_HOSTELS } from './life/venues.js';
import { fmtHour } from './life/clock.js';
import { lectureFor } from './activities/content.js';
import { MEALS, MENU, priceOf, mealName, isSpecial } from './mess/menu.js';
import { campusLive } from './live.js';
import { ROLL_LABEL, ROLL_PLACEHOLDER, ROLL_ERROR, ROLL_MAX, cleanRoll, isRoll } from './roll.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CELL_W = 160, CELL_H = 236, COLS = 8;
const OPEN_SECS = 12;                          // an automatic gate stays open this long after a scan
const DESTS = ['Khokha', 'City', 'Others'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const ease = (t) => t * t * (3 - 2 * t);

// the app's logo: a gate arch with you (the dot) walking through it, on a green tile
export const LOGO = (s = 28) => `<svg class="os-logo" width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="9" fill="#1aa65a"/><rect x="1" y="1" width="30" height="15" rx="9" fill="#27c06b"/><rect x="1" y="9" width="30" height="7" fill="#27c06b"/><path d="M9.6 24.2V14.6a6.4 6.4 0 0 1 12.8 0v9.6" fill="none" stroke="#fff" stroke-width="2.7" stroke-linecap="round"/><circle cx="16" cy="16.4" r="2.5" fill="#fff"/><path d="M6.8 24.6h18.4" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/></svg>`;
function drawLogo(c, x, y, s) {
  const k = s / 32;
  c.save(); c.translate(x, y); c.scale(k, k);
  c.fillStyle = '#1aa65a'; c.beginPath(); c.roundRect?.(1, 1, 30, 30, 9); c.fill();
  c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineWidth = 2.7;
  c.beginPath(); c.moveTo(9.6, 24.2); c.lineTo(9.6, 14.6); c.arc(16, 14.6, 6.4, Math.PI, 0); c.lineTo(22.4, 24.2); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(16, 16.4, 2.5, 0, 7); c.fill();
  c.lineWidth = 2.3; c.beginPath(); c.moveTo(6.8, 24.6); c.lineTo(25.2, 24.6); c.stroke();
  c.restore();
}

const ICON = {
  door: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="5" y="2.5" width="14" height="19" rx="2" fill="#3f73da"/><rect x="7" y="4.5" width="9.5" height="17" rx="1" fill="#e6eeff"/><circle cx="14.3" cy="13" r="1.1" fill="#3f73da"/></svg>',
  food: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M2.5 11.5h19a9.5 7.5 0 0 1-19 0z" fill="#f2b233"/><path d="M3.5 11.5a8.5 3.2 0 0 1 17 0z" fill="#5fb7e5"/><path d="M13 3.5l6 7" stroke="#b9c0c8" stroke-width="1.8" stroke-linecap="round"/></svg>',
  cal: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="4.5" width="18" height="16.5" rx="3" fill="#5cc47a"/><rect x="3" y="4.5" width="18" height="5.5" rx="2.5" fill="#2e9150"/><g fill="#fff"><rect x="6" y="12" width="3" height="2.4" rx=".6"/><rect x="10.5" y="12" width="3" height="2.4" rx=".6"/><rect x="15" y="12" width="3" height="2.4" rx=".6"/><rect x="6" y="16" width="3" height="2.4" rx=".6"/><rect x="10.5" y="16" width="3" height="2.4" rx=".6"/></g></svg>',
  qr: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="#e9edf2"/><g fill="#1b1e22"><rect x="5" y="5" width="5" height="5" rx="1"/><rect x="14" y="5" width="5" height="5" rx="1"/><rect x="5" y="14" width="5" height="5" rx="1"/><rect x="14" y="14" width="2.2" height="2.2"/><rect x="16.8" y="16.8" width="2.2" height="2.2"/><rect x="11.2" y="11.2" width="2" height="2"/></g></svg>',
  user: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="10" fill="#26b060"/><circle cx="12" cy="9.5" r="3.4" fill="#fff"/><path d="M5.5 18.3a7.2 5 0 0 1 13 0" fill="#fff"/></svg>',
  rules: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="5" y="3" width="14" height="18" rx="2" fill="#e9543d"/><rect x="7.5" y="1.8" width="9" height="3.6" rx="1.2" fill="#f2c24a"/><g stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M8 9.5h8M8 13h8M8 16.5h5"/></g></svg>',
  store: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 9l1.6-5h14.8L21 9" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="9" width="16" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="9.5" y="13.5" width="5" height="6.5" fill="currentColor"/></svg>',
  city: '<svg viewBox="0 0 24 24" width="18" height="18"><g fill="currentColor"><rect x="3" y="9" width="6" height="12"/><rect x="10" y="3" width="7" height="18"/><rect x="18" y="12" width="3" height="9"/></g></svg>',
  compass: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/></svg>',
  out: '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="5" y="3" width="11" height="18" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12.6" cy="12" r="1.1" fill="currentColor"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/></svg>',
  bell: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 1.5h-15z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 11l8-7 8 7v9.5h-5.5v-6h-5v6H4z" fill="currentColor"/></svg>',
  fork: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11M16 3c-2 1-3 4-3 7h3v11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  bus: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="4" y="3" width="16" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 11h16" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="15" r="1.1" fill="currentColor"/><circle cx="16" cy="15" r="1.1" fill="currentColor"/><path d="M7 18v3M17 18v3" stroke="currentColor" stroke-width="1.8"/></svg>',
  live: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M7.2 7.2a6.8 6.8 0 0 0 0 9.6M16.8 7.2a6.8 6.8 0 0 1 0 9.6M4.2 4.2a11 11 0 0 0 0 15.6M19.8 4.2a11 11 0 0 1 0 15.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" fill="#f2b233"/><path d="M14 7v10" stroke="#8a5a00" stroke-width="1.4" stroke-dasharray="2 2"/></svg>',
  person: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 21a7.5 6 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

// the hostel mess: three meals a day and a menu for each weekday (Monday = 0) are shared with the mess itself (mess/menu.js)

function css() {
  if (document.getElementById('onestop-css')) return;
  const st = document.createElement('style');
  st.id = 'onestop-css';
  st.textContent = `
#phone { align-items: center; justify-content: center; z-index: 60; }
#phone .os-phone { position: relative; width: 334px; height: min(690px, 94vh); border-radius: 42px; background: #0b0c0e; border: 8px solid #1a1d21; box-shadow: 0 26px 70px rgba(0,0,0,.6), inset 0 0 0 2px #2c3238; overflow: hidden; display: flex; flex-direction: column; font-family: "Hind", "Segoe UI", system-ui, sans-serif; color: #e8eaed; animation: osIn .28s ease-out; }
@keyframes osIn { from { transform: translateY(40px) scale(.96); opacity: 0; } }
#phone .os-notch { position: absolute; top: 0; left: 50%; width: 104px; height: 22px; transform: translateX(-50%); background: #0b0c0e; border-radius: 0 0 14px 14px; z-index: 3; }
#phone .os-status { display: flex; justify-content: space-between; padding: 7px 26px 3px; font-size: 12px; font-weight: 600; color: #e8eaed; background: #141619; }
#phone .os-screen { flex: 1; overflow-y: auto; background: #141619; display: flex; flex-direction: column; scrollbar-width: thin; scrollbar-color: #3a4046 transparent; }
#phone .os-top { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px 6px; }
#phone .os-brand { display: flex; align-items: center; gap: 9px; font-size: 25px; font-weight: 700; letter-spacing: -.01em; }
#phone .os-brand i { color: #3ecf7a; font-style: normal; }
#phone .os-round { width: 40px; height: 40px; border-radius: 50%; background: #1f2226; display: grid; place-items: center; color: #3ecf7a; }
#phone .os-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px 10px; border-bottom: 1px solid #23272c; position: sticky; top: 0; background: #141619; z-index: 2; }
#phone .os-bar b { flex: 1; text-align: center; font-size: 17px; margin-right: 30px; }
#phone .os-back { appearance: none; border: 0; background: none; color: #3ecf7a; font-size: 24px; line-height: 1; cursor: pointer; width: 30px; padding: 0; }
#phone .os-body { padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 10px; }
#phone .os-card { background: #1b1e22; border: 1px solid #2a2e33; border-radius: 16px; padding: 12px 14px; }
#phone .os-card.link { cursor: pointer; }
#phone .os-card.link:hover { border-color: #3a4046; }
#phone .os-card h4 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; }
#phone .os-card h4 small { color: #8b939c; font-weight: 500; font-size: 11.5px; letter-spacing: .05em; text-transform: uppercase; }
#phone .os-chev { margin-left: auto; color: #6b737c; font-size: 18px; }
#phone .os-big { margin: 8px 0 2px; font-size: 16.5px; color: #cfd3d8; }
#phone .os-muted { color: #8b939c; font-size: 12.5px; margin: 6px 0 2px; }
#phone .os-menu { margin: 4px 0 0; font-size: 12.5px; color: #d7dadf; line-height: 1.45; }
#phone .os-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
#phone .os-pill { appearance: none; width: 100%; border: 1.5px solid #3a4046; background: none; color: #3ecf7a; border-radius: 14px; padding: 9px 8px; margin-top: 8px; font: 600 14.5px "Hind", "Segoe UI", sans-serif; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
#phone .os-pill:hover { background: #1c2a22; }
#phone .os-pill.warn { color: #ff5a6a; }
#phone .os-pill.solid { background: #1f8f50; border-color: #1f8f50; color: #fff; }
#phone .os-pill.solid:hover { background: #23a35b; }
#phone .os-pill:disabled { opacity: .45; cursor: default; }
#phone .os-h { margin: 6px 2px 0; font-size: 19px; font-weight: 600; }
#phone .os-qa { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 2px; padding: 2px 0 4px; }
#phone .os-qa button { appearance: none; border: 0; background: none; color: #d7dadf; font: 500 12px "Hind", sans-serif; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; line-height: 1.15; }
#phone .os-qa button svg { width: 34px; height: 34px; }
#phone .os-nav { display: flex; justify-content: space-around; padding: 6px 8px 2px; background: #1b1e22; border-top: 1px solid #23272c; }
#phone .os-nav button { appearance: none; border: 0; background: none; color: #aab0b7; font: 500 11.5px "Hind", sans-serif; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 5px 12px; border-radius: 12px; cursor: pointer; }
#phone .os-nav button.on { background: #1f3a2a; color: #3ecf7a; }
#phone .os-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
#phone .os-time { background: #262a2f; color: #d7dadf; border-radius: 9px; padding: 3px 9px; font-size: 12px; font-weight: 600; white-space: nowrap; }
#phone .os-user { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
#phone .os-av { width: 36px; height: 36px; border-radius: 50%; background: #e7f6ee; color: #1f8f50; display: grid; place-items: center; font-weight: 700; flex: none; }
#phone .os-user b { display: block; font-size: 14.5px; }
#phone .os-user small { color: #aab0b7; font-size: 12.5px; }
#phone .os-day { color: #d7dadf; font-weight: 600; font-size: 13.5px; margin: 4px 2px -2px; }
#phone .os-track { display: grid; grid-template-columns: auto 1fr auto 1fr auto; align-items: center; gap: 6px; color: #9aa2ab; }
#phone .os-track hr { border: 0; border-top: 1px solid #3a4046; margin: 0; }
#phone .os-entry { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 6px; margin-top: 6px; }
#phone .os-entry .end { font-size: 12px; color: #c4c9cf; }
#phone .os-entry .end b { display: block; font-size: 12.5px; color: #eef0f2; font-weight: 600; }
#phone .os-entry .r { text-align: right; }
#phone .os-entry .mid { text-align: center; color: #d7dadf; font-size: 13px; padding-bottom: 2px; }
#phone .os-open { color: #f5b73b !important; }
#phone .os-how { color: #8b939c; font-size: 11px; }
#phone .os-qr { background: #fff; border-radius: 16px; padding: 12px; display: grid; place-items: center; margin-top: 10px; }
#phone .os-qr canvas { width: 196px; height: 196px; display: block; }
#phone .os-center { text-align: center; }
#phone .os-tip { margin: 6px 2px 0; font-size: 12.5px; color: #9aa2ab; line-height: 1.45; }
#phone label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #aab0b7; font-weight: 600; }
#phone input[type=text], #phone select { background: #101214; border: 1.5px solid #2f343a; border-radius: 10px; padding: 9px 11px; color: #e8eaed; font: 15px "Hind", "Segoe UI", sans-serif; outline: none; color-scheme: dark; }
#phone input[type=text]:focus, #phone select:focus { border-color: #3ecf7a; }
#phone .os-seg { display: flex; gap: 6px; }
#phone .os-seg button { flex: 1; appearance: none; border: 1.5px solid #2f343a; background: #101214; border-radius: 10px; padding: 8px; font: 600 14px "Hind", sans-serif; cursor: pointer; color: #e8eaed; }
#phone .os-seg button.on { background: #1f8f50; border-color: #1f8f50; color: #fff; }
#phone .os-err { color: #ff6b76; font-size: 12.5px; min-height: 16px; margin: 0; }
#phone .os-cam { position: relative; height: 300px; background: radial-gradient(ellipse at 50% 40%, #33404e 0%, #1a222b 70%, #0d1218 100%); overflow: hidden; display: grid; place-items: center; }
#phone .os-cam canvas { width: 206px; height: 206px; border-radius: 6px; box-shadow: 0 0 30px rgba(0,0,0,.5); transform: perspective(520px) rotateX(9deg) rotateY(-11deg) rotate(2.5deg); transition: transform .5s; }
#phone .os-cam.ok canvas { transform: perspective(520px) rotateX(0) rotateY(0) rotate(0) scale(1.03); }
#phone .os-frame { position: absolute; inset: 48px 44px; border: 3px solid rgba(62,207,122,.9); border-radius: 14px; -webkit-mask: linear-gradient(#000 0 0) top left / 34px 34px no-repeat, linear-gradient(#000 0 0) top right / 34px 34px no-repeat, linear-gradient(#000 0 0) bottom left / 34px 34px no-repeat, linear-gradient(#000 0 0) bottom right / 34px 34px no-repeat; mask: linear-gradient(#000 0 0) top left / 34px 34px no-repeat, linear-gradient(#000 0 0) top right / 34px 34px no-repeat, linear-gradient(#000 0 0) bottom left / 34px 34px no-repeat, linear-gradient(#000 0 0) bottom right / 34px 34px no-repeat; }
#phone .os-line { position: absolute; left: 48px; right: 48px; height: 3px; background: linear-gradient(90deg, transparent, #3ecf7a, transparent); box-shadow: 0 0 12px #3ecf7a; animation: osScan 1.1s ease-in-out infinite alternate; }
#phone .os-cam.ok .os-line { display: none; }
@keyframes osScan { from { top: 56px; } to { top: 240px; } }
#phone .os-cap { position: absolute; left: 0; right: 0; bottom: 8px; text-align: center; color: #d6dde6; font-size: 12.5px; }
#phone .os-result { text-align: center; padding: 6px 4px 0; }
#phone .os-tick { width: 66px; height: 66px; border-radius: 50%; background: #1f8f50; color: #fff; font-size: 34px; font-weight: 700; display: grid; place-items: center; margin: 4px auto 6px; animation: osPop .35s ease-out; }
#phone .os-tick.out { background: #d9822b; }
@keyframes osPop { from { transform: scale(.3); opacity: 0; } }
#phone .os-result h3 { margin: 0; font-size: 21px; }
#phone .os-result p { margin: 3px 0; font-size: 13px; color: #c4c9cf; }
#phone .os-homebar { height: 5px; width: 110px; background: #e8eaed; border-radius: 3px; margin: 6px auto 7px; opacity: .75; }
#phone .os-meal { display: flex; justify-content: space-between; align-items: baseline; }
#phone .os-meal.now { color: #3ecf7a; }
#phone .os-class { display: grid; grid-template-columns: 64px 1fr; gap: 8px; padding: 7px 0; border-bottom: 1px solid #262a2f; font-size: 13px; }
#phone .os-class:last-child { border-bottom: 0; }
#phone .os-live { display: grid; grid-template-columns: 10px 1fr auto; gap: 10px; align-items: start; padding: 9px 0; border-bottom: 1px solid #262a2f; }
#phone .os-live:last-child { border-bottom: 0; }
#phone .os-live .d { width: 9px; height: 9px; border-radius: 50%; margin-top: 6px; background: #6b737c; }
#phone .os-live .d.live { background: #3ecf7a; box-shadow: 0 0 0 0 rgba(62,207,122,.6); animation: osLive 1.6s infinite; }
#phone .os-live .d.open { background: #3ecf7a; } #phone .os-live .d.soon { background: #f5b73b; } #phone .os-live .d.closed { background: #6b737c; }
@keyframes osLive { 70% { box-shadow: 0 0 0 7px rgba(62,207,122,0); } 100% { box-shadow: 0 0 0 0 rgba(62,207,122,0); } }
#phone .os-live b { display: block; font-size: 13.5px; font-weight: 600; color: #eef0f2; }
#phone .os-live span.p { font-size: 11.5px; color: #8b939c; text-transform: uppercase; letter-spacing: .05em; }
#phone .os-live small { display: block; color: #aab0b7; font-size: 12.5px; line-height: 1.35; margin-top: 1px; }
#phone .os-live .n { font-size: 11.5px; color: #c4c9cf; background: #262a2f; border-radius: 9px; padding: 2px 8px; white-space: nowrap; }
#phone .os-coupon { border: 1.5px dashed #3ecf7a; border-radius: 14px; padding: 10px 12px; margin-top: 8px; background: #16241c; }
#phone .os-coupon b { display: block; font-size: 15px; } #phone .os-coupon small { color: #aab0b7; font-size: 12px; }
#phone .os-class b { color: #3ecf7a; font-weight: 600; }
`;
  document.head.appendChild(st);
}

export class OneStop {
  constructor(game) {
    this.g = game;
    this.kiosks = [];
    this.gates = [];            // automatic pedestrian gates (campus gates, the pool)
    this.booms = [];            // boom barriers over the carriageways (lift for vehicles, and for you after a scan)
    this.doors = [];            // sliding glass doors (hostels, the Computer Centre)
    this.built = false;
    this.busy = false;
    this.screen = 'home';
    this.ctx = {};
    this.setupDone = null;
    this.warnT = 0;
    this.lastIn = undefined;
    this.expect = null;
  }

  get profile() { return this.g.progress.profile; }
  /** the saved OneStop data: entries (newest first), the next id, day 0's calendar date, a destination chosen in the app */
  get store() {
    const P = this.g.progress;
    if (!P.onestop) {
      P.onestop = { entries: [], next: 1, base: 0, dest: null };
      // the old Gate Pass history (single sign-ins, no out time)
      for (const e of (P.gateLog || []).slice(0, 60)) P.onestop.entries.push({ id: P.onestop.next++, scope: 'site', site: 'legacy', place: e.gate, a: { dir: 'in', gate: e.gate, abs: e.abs, how: 'qr' }, b: { dir: 'out', gate: '—', abs: null, how: 'legacy' } });
    }
    const S = P.onestop;
    if (!S.base) S.base = Date.now() - Math.floor(this.g.clock?.day || 0) * 864e5;
    return S;
  }
  get entries() { return this.store.entries; }
  hostels() { return this.g.world.landmarks.filter((l) => l.kind === 'hostel').map((l) => ({ id: l.id, name: l.name.replace(' Hostel', ''), girls: GIRLS_HOSTELS.has(l.id), married: l.id === 'msh' })); }
  hostelName(id) { return this.hostels().find((h) => h.id === id)?.name || 'Brahmaputra'; }
  female() { return this.g.player.avatar.look.body === 'female'; }

  // ------------------------------------------------------------------ time and dates
  fmt(abs) { return abs == null ? '—' : fmtHour(((abs % 24) + 24) % 24); }
  dateOf(abs) { return new Date(this.store.base + Math.floor(abs / 24) * 864e5); }
  dateLabel(abs, short = false) { const d = this.dateOf(abs); return short ? `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]}`.toUpperCase() : `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`; }
  dur(a, b) { const m = Math.max(1, Math.round((b - a) * 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; }

  // ------------------------------------------------------------------ the machines, gates, barriers and doors
  /** a machine near (x, z) facing yaw; it moves to the nearest clear spot unless `exact`. `points`: where
   *  you stand to use it (default: in front, and behind as well for a double-sided one) */
  addKiosk({ id, name, x, z, yaw, kind = 'gate', site = null, onScan = null, dir = null, double = false, exact = false, gate = null, place = null, points = null }) {
    if (this.kiosks.some((k) => k.id === id)) return null;
    const W = this.g.world, G = this.g.graph;
    // a machine stands beside a road or a path, never on it, and never on top of something else
    const ground = (px, pz) => (W.placer ? W.placer.free(px, pz, 0.55) : W.insideCampus(px, pz) && !W.buildingAt(px, pz) && !W.waterAt(px, pz) && !G.onRoad(px, pz, 0.9));
    const free = (px, pz) => ground(px, pz) && !this.kiosks.some((k) => Math.hypot(k.x - px, k.z - pz) < 1.3);
    let at = exact ? [x, z] : null;
    if (!at && free(x, z)) at = [x, z];
    for (let R = 1.2; !at && R <= 8; R += 1.2) for (let a = 0; a < 12; a++) { const ang = (a / 12) * Math.PI * 2 + R, px = x + Math.cos(ang) * R, pz = z + Math.sin(ang) * R; if (free(px, pz)) { at = [px, pz]; break; } }
    if (!at) return null;
    const st = site ?? (kind === 'campus' ? 'campus' : kind === 'pool' ? 'pool' : kind === 'view' ? 'viewpoint' : id);
    W.addSolid(at[0], at[1], 0.4, 'onestop', true);
    const k = { id, name, x: at[0], z: at[1], y: W.heightAt(at[0], at[1]), yaw, kind, site: st, onScan, dir, double, gate, points, cell: this.kiosks.length, lightT: 0,
      place: place || (kind === 'campus' ? 'Campus' : kind === 'pool' ? 'Swimming Pool' : kind === 'view' ? 'View Point' : kind === 'hostel' ? `${this.hostelName(st)} Hostel` : name) };
    this.kiosks.push(k);
    return k;
  }
  /** an automatic sliding gate w metres wide at (x, z) across the way, t = (tx, tz) along it; ref: the campus gate */
  addGate(o) { const G = { t: 0, hold: 0, h: 1.9, ...o }; this.gates.push(G); return G; }
  /** a boom barrier pivoting at (x, z), its arm reaching len metres along (tx, tz) */
  addBoom(o) { const B = { t: 0, ...o }; this.booms.push(B); return B; }
  /** sliding glass doors on a wall at (x, z) facing (nx, nz) */
  addDoor(o) { const D = { t: 0, hold: 0, w: 2.4, h: 2.55, ...o }; this.doors.push(D); return D; }

  /** everything is requested by now: draw it (the machines as one mesh with one shared QR atlas) */
  build() {
    if (this.built) return;
    this.built = true;
    const g = this.g;
    this.group = new THREE.Group(); this.group.name = 'onestop';
    g.scene.add(this.group);
    if (this.kiosks.length) this.buildKiosks();
    for (const G of this.gates) this.buildGate(G);
    for (const B of this.booms) this.buildBoom(B);
    for (const D of this.doors) this.buildDoor(D);
    // E at a machine (both sides of a double-sided one)
    for (const k of this.kiosks) {
      const pts = k.points || (k.double ? [1, -1] : [1]).map((s) => ({ x: k.x + Math.sin(k.yaw) * 0.95 * s, z: k.z + Math.cos(k.yaw) * 0.95 * s }));
      for (const p of pts) g.interact.add({ x: p.x, z: p.z, r: 2.4, prio: 1.4, when: () => g.mode === 'walk' && !g.interior?.active, label: () => this.labelFor(k), run: () => this.scanAt(k) });
    }
    // the campus wall asks before letting you through a gate on foot or on a cycle
    g.world.passCheck = (gr) => this.passOk(gr);
    g.world.poolGateOpen = () => { const G = this.gates.find((q) => q.site === 'pool'); return !G || G.t > 0.7; };
  }

  buildKiosks() {
    const n = this.kiosks.length, rows = Math.ceil(n / COLS);
    const cv = document.createElement('canvas'); cv.width = COLS * CELL_W; cv.height = rows * CELL_H;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height);
    const solid = [], screens = [];
    this.kiosks.forEach((k, i) => {
      const col = i % COLS, row = Math.floor(i / COLS), x0 = col * CELL_W, y0 = row * CELL_H;
      // the screen: a dark header with the logo, the QR, the place's name
      cx.fillStyle = '#141619'; cx.fillRect(x0, y0, CELL_W, 34);
      drawLogo(cx, x0 + 12, y0 + 5, 24);
      cx.fillStyle = '#fff'; cx.font = '700 18px "Hind", "Segoe UI", sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'middle';
      cx.fillText('One', x0 + 42, y0 + 18); const w1 = cx.measureText('One').width; cx.fillStyle = '#3ecf7a'; cx.fillText('Stop', x0 + 42 + w1, y0 + 18);
      drawQR(cx, this.qrText(k), x0 + 6, y0 + 38, CELL_W - 12, { dark: '#0d1b2a', light: '#ffffff' });
      cx.fillStyle = '#ffffff'; cx.fillRect(x0, y0 + 38 + CELL_W - 12, CELL_W, CELL_H - 38 - CELL_W + 12);
      cx.fillStyle = '#1a2230'; cx.textBaseline = 'alphabetic'; cx.textAlign = 'center';
      const words = (k.kind === 'campus' ? `${k.gate?.name || k.name} · scan in / out` : k.name).toUpperCase().split(' '); const lines = [];
      let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > 16) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) lines.push(cur);
      cx.font = '700 14px "Hind", "Segoe UI", sans-serif';
      lines.slice(0, 2).forEach((t, li) => cx.fillText(t, x0 + CELL_W / 2, y0 + 38 + CELL_W - 12 + 17 + li * 16));
      // a base, a post, a head with the screen (a double-sided one stands upright, a screen each side), a light on top
      const { x, z, y, yaw } = k;
      solid.push({ geometry: new THREE.CylinderGeometry(0.2, 0.24, 0.06, 14), color: '#39434d', matrix: m4(x, y + 0.03, z) });
      solid.push({ geometry: new THREE.CylinderGeometry(0.05, 0.06, 1.05, 10), color: '#4a5560', matrix: m4(x, y + 0.55, z) });
      const head = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 1.36, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(k.double ? 0 : -0.2, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      solid.push({ geometry: new THREE.BoxGeometry(0.6, 0.86, k.double ? 0.14 : 0.1), color: '#1d2b3a', matrix: head });
      const u0 = (x0 + 1) / cv.width, u1 = (x0 + CELL_W - 1) / cv.width, v1 = 1 - (y0 + 1) / cv.height, v0 = 1 - (y0 + CELL_H - 1) / cv.height;
      for (const side of k.double ? [1, -1] : [1]) {
        const sc = new THREE.PlaneGeometry(0.52, 0.78);
        const uv = sc.attributes.uv;
        for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) < 0.5 ? u0 : u1, uv.getY(j) < 0.5 ? v0 : v1);
        if (side < 0) sc.rotateY(Math.PI);
        sc.translate(0, 0, side * (k.double ? 0.076 : 0.056)); sc.applyMatrix4(head);
        screens.push(sc);
      }
    });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const body = new THREE.Mesh(mergeColored(solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 }));
    body.castShadow = true; this.group.add(body);
    this.group.add(new THREE.Mesh(mergeGeometries(screens), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
    // the status light on top of each head (amber = ready, green = just scanned)
    const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n);
    const M = new THREE.Matrix4();
    this.kiosks.forEach((k, i) => { M.makeTranslation(k.x + Math.sin(k.yaw) * (k.double ? 0 : -0.04), k.y + 1.86, k.z + Math.cos(k.yaw) * (k.double ? 0 : -0.04)); lights.setMatrixAt(i, M); lights.setColorAt(i, new THREE.Color(0xf2b12e)); });
    this.lights = lights; this.group.add(lights);
  }

  /** a steel sliding gate (black frame, white bars) between two posts, a floor track, a small green/red lamp */
  buildGate(G) {
    const L = G.w, parts = [];
    const iron = '#1c1c1c', bar = '#f2f0ea';
    parts.push({ geometry: new THREE.BoxGeometry(L, 0.07, 0.07), color: iron, matrix: m4(L / 2, G.h, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(L, 0.07, 0.07), color: iron, matrix: m4(L / 2, 0.16, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(0.07, G.h - 0.1, 0.07), color: iron, matrix: m4(0.035, G.h / 2 + 0.08, 0) });
    parts.push({ geometry: new THREE.BoxGeometry(0.07, G.h - 0.1, 0.07), color: iron, matrix: m4(L - 0.035, G.h / 2 + 0.08, 0) });
    for (let k = 1; k < L / 0.13; k++) parts.push({ geometry: new THREE.BoxGeometry(0.03, G.h - 0.2, 0.03), color: k % 5 === 0 ? iron : bar, matrix: m4(k * 0.13, G.h / 2 + 0.08, 0) });
    const leaf = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.45 }));
    leaf.castShadow = true;
    const yaw = Math.atan2(-G.tz, G.tx);
    const hold = new THREE.Group(); hold.position.set(G.x - G.tx * L / 2, G.y, G.z - G.tz * L / 2); hold.rotation.y = yaw;
    hold.add(leaf);
    // the fixed posts, the track it runs on (one gate's width beyond the opening), the lamp
    const fixed = [];
    for (const u of [-0.08, L + 0.08]) fixed.push({ geometry: new THREE.BoxGeometry(0.16, G.h + 0.35, 0.16), color: '#3a3f45', matrix: m4(u, (G.h + 0.35) / 2, 0) });
    fixed.push({ geometry: new THREE.BoxGeometry(L * 2.05, 0.04, 0.12), color: '#55595e', matrix: m4(-L * 0.5, 0.02, 0) });
    const fm = new THREE.Mesh(mergeColored(fixed), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
    fm.castShadow = true;
    hold.add(fm);
    G.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd8342c, toneMapped: false }));
    G.lamp.position.set(L + 0.08, G.h + 0.44, 0); hold.add(G.lamp);
    this.group.add(hold);
    G.leaf = leaf;
  }

  buildBoom(B) {
    const yaw = Math.atan2(-B.tz, B.tx);
    const hold = new THREE.Group(); hold.position.set(B.x, B.y, B.z); hold.rotation.y = yaw;
    const base = [
      { geometry: new THREE.BoxGeometry(0.42, 1.05, 0.34), color: '#f2c12e', matrix: m4(0, 0.52, 0) },
      { geometry: new THREE.BoxGeometry(0.46, 0.08, 0.38), color: '#2f3338', matrix: m4(0, 1.08, 0) },
    ];
    hold.add(new THREE.Mesh(mergeColored(base), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })));
    const stripes = canvasTexture(256, 16, (c, w, h) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#f4f4ef' : '#d8342c'; c.fillRect((k * w) / 8, 0, w / 8, h); } }, { repeat: false });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(B.len, 0.09, 0.09).translate(B.len / 2, 0, 0), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.5 }));
    const pivot = new THREE.Group(); pivot.position.set(0.1, 0.95, 0); pivot.add(arm);
    hold.add(pivot);
    this.group.add(hold);
    B.pivot = pivot;
  }

  buildDoor(D) {
    const yaw = Math.atan2(D.nx, D.nz), tx = Math.cos(yaw), tz = -Math.sin(yaw);
    const hold = new THREE.Group(); hold.position.set(D.x + D.nx * 0.06, D.y, D.z + D.nz * 0.06); hold.rotation.y = yaw;
    const frame = [
      { geometry: new THREE.BoxGeometry(D.w + 0.3, 0.26, 0.2), color: '#2e3338', matrix: m4(0, D.h + 0.13, 0) },
      { geometry: new THREE.BoxGeometry(0.14, D.h, 0.2), color: '#2e3338', matrix: m4(-D.w / 2 - 0.07, D.h / 2, 0) },
      { geometry: new THREE.BoxGeometry(0.14, D.h, 0.2), color: '#2e3338', matrix: m4(D.w / 2 + 0.07, D.h / 2, 0) },
      { geometry: new THREE.BoxGeometry(D.w + 0.3, 0.05, 0.5), color: '#9aa0a6', matrix: m4(0, 0.025, 0.2) },
      { geometry: new THREE.BoxGeometry(D.w * 0.8, 0.12, 0.08), color: '#1aa65a', matrix: m4(0, D.h + 0.13, 0.1) },            // the green OneStop strip
    ];
    const fm = new THREE.Mesh(mergeColored(frame), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }));
    fm.castShadow = true; hold.add(fm);
    // the lobby behind the glass: warm light
    const lobby = new THREE.Mesh(new THREE.PlaneGeometry(D.w, D.h), new THREE.MeshBasicMaterial({ color: 0x3a3226 }));
    lobby.position.set(0, D.h / 2, -0.09); hold.add(lobby);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9ec3cf, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x2e3338, roughness: 0.4, metalness: 0.5 });
    D.leaves = [-1, 1].map((s) => {
      const leaf = new THREE.Group();
      const pane = new THREE.Mesh(new THREE.BoxGeometry(D.w / 2, D.h - 0.04, 0.03), glass);
      pane.position.set(0, (D.h - 0.04) / 2, 0); leaf.add(pane);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.05, D.h - 0.04, 0.05), edge);
      rim.position.set(-s * D.w / 4 + s * 0.02, (D.h - 0.04) / 2, 0.01); leaf.add(rim);
      leaf.position.set(s * D.w / 4, 0, -0.02); leaf.userData.x0 = s * D.w / 4; leaf.userData.s = s;
      hold.add(leaf);
      return leaf;
    });
    this.group.add(hold);
    void tx; void tz;
  }

  qrText(k) { return `ONESTOP|1|${k.id}|${k.name}`; }
  nearest(r = 3.2) {
    const P = this.g.player.pos; let best = null, bd = r;
    for (const k of this.kiosks) { const d = Math.hypot(k.x - P.x, k.z - P.z); if (d < bd) { bd = d; best = k; } }
    return best;
  }

  // ------------------------------------------------------------------ in or out?
  where() { const g = this.g; return g.interior?.active ? g.interior.outside : g.mode === 'walk' || g.mode === 'bike' || g.mode === 'camera' || !g.focus ? g.player.pos : g.focus; }
  insideCampus() { const p = this.where(); return this.g.world.insideCampus(p.x, p.z); }
  inPool() { const F = (this.g.world.fenceOutlines || []).find((f) => f.pool); if (!F) return false; const p = this.where(); return pointInRing(p.x, p.z, F.ring.flat()); }
  openEntry(site) { return this.entries.find((e) => e.site === site && e.a && !e.b) || null; }
  dirAt(k) {
    if (k.dir) return k.dir;                                        // the View Point's entry / exit machines
    if (k.kind === 'campus') return this.insideCampus() ? 'out' : 'in';
    if (k.kind === 'pool') return this.inPool() ? 'out' : 'in';
    return this.openEntry(k.site) ? 'out' : 'in';
  }
  labelFor(k) {
    const d = this.dirAt(k);
    return `${d === 'out' ? 'Scan out' : 'Scan in'} with OneStop · ${k.kind === 'campus' ? k.gate?.name || k.name : k.name}`;
  }
  visitorAt(site) { const p = this.profile; return !!site && GIRLS_HOSTELS.has(site) !== this.female() && site !== p.hostel && site !== 'msh' && this.hostels().some((h) => h.id === site); }

  /** E at a machine */
  scanAt(k) {
    const g = this.g;
    if (!this.profile.setup) { this.open('needsetup', { kiosk: k }); return; }
    if (k.kind === 'hostel' && GIRLS_HOSTELS.has(k.site) && k.site !== this.profile.hostel) { g.ui.toast("This is a girls' hostel: visitors for the mess or the canteen write their name in the register at the security desk inside. QR is for the hostel's own residents.", 'warn', 'Hostel guard'); return; }
    const dir = this.dirAt(k);
    if (k.kind === 'campus') {
      if (k.gate && !g.world.gateOpen(k.gate, g.clock.hour, 'walk')) { g.ui.toast(`${k.gate.name} is closed now (open 6 AM - 10 PM). The Main Gate is open all night.`, 'warn', 'OneStop'); return; }
      if (dir === 'out' && !this.openEntry('campus') && !this.store.dest) { this.open('gatelog', { kiosk: k, choose: true }); return; }
    }
    this.open('scan', { kiosk: k, dir });
  }

  /** note a scan (or a register signature, or the guard): open or close the entry; opens the gate / door */
  record(k, dir, how = 'qr') {
    const g = this.g, c = g.clock, S = this.store;
    const stamp = { dir, gate: k.kind === 'campus' ? (k.gate?.name || k.name) : k.name, abs: c.abs, how };
    let e = this.openEntry(k.site), closed = null;
    const add = (o) => { const n = { id: S.next++, scope: k.kind === 'campus' ? 'campus' : 'site', site: k.site, place: k.place, dest: null, a: null, b: null, x: k.x, z: k.z, ...o }; S.entries.unshift(n); if (S.entries.length > 150) S.entries.length = 150; return n; };
    if (k.kind === 'campus') {
      if (dir === 'out') { if (e) e.a = stamp; else e = add({ dest: S.dest || 'Others', a: stamp }); S.dest = null; }
      else if (e) { e.b = stamp; closed = e; }
      else closed = add({ dest: '—', b: stamp });
      if (how === 'qr') this.expect = { dir, until: performance.now() + 60000 };
    } else if (dir === 'in') { if (e) e.a = stamp; else e = add({ a: stamp, visitor: this.visitorAt(k.site) }); }
    else if (e) { e.b = stamp; closed = e; }
    else closed = add({ b: stamp });
    // a first scan at this machine: a little XP; the achievement
    if (k.id && !g.progress.flags[`gate:${k.id}`]) { g.progress.flags[`gate:${k.id}`] = 1; if (how === 'qr') g.progress.addXP?.(4, 'OneStop'); }
    if (how === 'qr') { g.progress.count?.('gatepass'); g.progress.unlock?.('gatepass'); }
    g.progress.save();
    // the machine's light, the gate / the door
    const i = this.kiosks.indexOf(k);
    if (this.lights && i >= 0) { this.lights.setColorAt(i, new THREE.Color(0x39d353)); this.lights.instanceColor.needsUpdate = true; k.lightT = 4; }
    if (how !== 'guard') { this.openGate(k); this.openDoor(k.site); }
    if (k.onScan && how === 'qr') k.extra = k.onScan({ dir }) || '';
    return { entry: closed || e, closed: !!closed, dir, stamp };
  }
  /** the automatic gate at this machine (the one nearest to it with the same site) opens for a while */
  openGate(k) {
    this.g.audio.slide?.();
    let best = null, bd = 30;
    for (const G of this.gates) { if (G.site !== k.site) continue; const d = Math.hypot(G.x - k.x, G.z - k.z); if (d < bd) { bd = d; best = G; } }
    if (best) best.hold = OPEN_SECS;          // only the small walking gate opens; the boom barriers are for vehicles
  }
  openDoor(site, secs = 4) { for (const D of this.doors) if (D.site === site) { if (D.hold <= 0) this.g.audio.slide?.(); D.hold = secs; } }
  passOk(gr) { const G = this.gates.find((q) => q.ref === gr); return !G || G.t > 0.7; }
  /** walked into a shut gate */
  blockedAt(gr) {
    if (this.warnT > 0 || !gr) return;
    this.warnT = 5;
    const g = this.g;
    if (!g.world.gateOpen(gr, g.clock.hour, 'walk')) g.ui.toast(`${gr.name} is closed now (open 6 AM - 10 PM). The Main Gate is open all night.`, 'warn', 'Security');
    else g.ui.toast(`Scan ${this.insideCampus() ? 'out' : 'in'} at the OneStop machine beside the gate (E, or O for your phone on a cycle): the gate opens for you.`, 'info', gr.name);
  }

  // ------------------------------------------------------------------ doors: a quick scan as you walk through
  /** the phone comes up, reads the door's machine, notes the time and goes away; then `then()` */
  quickScan(site, dir, then, info = {}) {
    const g = this.g;
    const k = this.kiosks.find((q) => q.site === site && q.kind !== 'campus' && !q.gateOnly) || { kind: info.kind || 'place', site, id: null, name: info.name || site, place: info.place || info.name || site, x: g.player.pos.x, z: g.player.pos.z };
    const open = this.openEntry(site);
    if (dir === 'out' && open?.a?.how === 'register') {                 // you signed the register: you sign out in it too
      this.record(k, 'out', 'register');
      g.ui.toast(`Signed out in the register at ${this.fmt(g.clock.abs)} (in at ${this.fmt(open.a.abs)}).`, 'info', 'Security desk');
      then(); return;
    }
    if (!this.profile.setup) { this.record(k, dir, 'guard'); then(); return; }   // no pass on the phone: the guard writes it down
    this.open('scan', { kiosk: k, dir, quick: true, then });
  }
  /** you signed a paper register (hostel visitors, the View Point): an entry with the in time */
  signed(site, e, name) {
    const k = this.kiosks.find((q) => q.site === site && q.kind !== 'campus') || { kind: 'hostel', site, id: null, name: name || site, place: name || site, x: this.g.player.pos.x, z: this.g.player.pos.z };
    return this.record(k, 'in', 'register');
  }
  isIn(site) { return !!this.openEntry(site); }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const g = this.g;
    this.warnT = Math.max(0, this.warnT - dt);
    if (this.lights) {
      let dirty = false;
      for (let i = 0; i < this.kiosks.length; i++) { const k = this.kiosks[i]; if (k.lightT > 0) { k.lightT -= dt; if (k.lightT <= 0) { this.lights.setColorAt(i, new THREE.Color(0xf2b12e)); dirty = true; } } }
      if (dirty) this.lights.instanceColor.needsUpdate = true;
    }
    const P = g.player.pos, inInt = g.interior?.active;
    for (const G of this.gates) {
      const near = !inInt && Math.hypot(P.x - G.x, P.z - G.z) < G.w / 2 + 1.4;
      const want = G.hold > 0 || (G.t > 0.3 && near) ? 1 : 0;           // never shut on someone in the way
      G.hold = Math.max(0, G.hold - dt);
      G.t = Math.max(0, Math.min(1, G.t + Math.sign(want - G.t) * dt * 1.3));
      if (G.leaf) G.leaf.position.x = -G.w * 0.98 * ease(G.t);
      if (G.lamp) G.lamp.material.color.setHex(G.t > 0.7 ? 0x39d353 : 0xd8342c);
    }
    // boom barriers lift only for vehicles coming through (a scan opens the small walking gate, never the boom)
    for (const B of this.booms) {
      let want = B.hold > 0 ? 1 : 0;
      if (!want) {
        const f = g.focus;
        if (f && g.mode !== 'walk' && g.mode !== 'bike' && g.mode !== 'drone' && Math.hypot(f.x - B.cx, f.z - B.cz) < 22) want = 1;
        for (const a of g.traffic?.agents || []) { if (a.kind === 'walker' || a.kind === 'cyclist') continue; const p = a.group.position; if (Math.abs(p.x - B.cx) < 20 && Math.abs(p.z - B.cz) < 20 && Math.hypot(p.x - B.cx, p.z - B.cz) < 18) { want = 1; break; } }
      }
      B.hold = Math.max(0, (B.hold || 0) - dt);
      B.t = Math.max(0, Math.min(1, B.t + Math.sign(want - B.t) * dt * (want ? 1.6 : 0.9)));
      if (B.pivot) B.pivot.rotation.z = ease(B.t) * 1.4;
    }
    for (const D of this.doors) {
      D.hold = Math.max(0, D.hold - dt);
      const want = D.hold > 0 ? 1 : 0;
      if (D.t === want) continue;
      D.t = Math.max(0, Math.min(1, D.t + Math.sign(want - D.t) * dt * 2.4));
      for (const L of D.leaves || []) L.position.x = L.userData.x0 + L.userData.s * (D.w / 2) * 0.9 * ease(D.t);
    }
    this.trackCampus();
    this.autoClose(dt);
  }

  /** crossing the campus wall without the phone (in a car, a bus, a taxi, a jump across the map): the guard logs it */
  trackCampus() {
    const g = this.g;
    if (g.interior?.active || g.mode === 'title' || g.mode === 'drone' || g.mode === 'tour' || g.player.flying || !g.world) return;
    const f = this.where();
    const inside = g.world.insideCampus(f.x, f.z);
    if (this.lastIn === undefined) { this.lastIn = inside; return; }
    if (inside === this.lastIn) return;
    this.lastIn = inside;
    const dir = inside ? 'in' : 'out';
    if (this.expect && this.expect.dir === dir && performance.now() < this.expect.until) { this.expect = null; return; }   // walked through after scanning
    return;                                                       // the campus gates have the OneStop QR machine only: nobody writes you in or out
    // eslint-disable-next-line no-unreachable
    let gate = null, bd = Infinity;
    for (const q of g.world.gates) { if (q.closed) continue; const d = Math.hypot(q.wx - f.x, q.wz - f.z); if (d < bd) { bd = d; gate = q; } }
    const k = this.kiosks.find((q) => q.kind === 'campus' && q.gate === gate) || { kind: 'campus', site: 'campus', id: null, name: gate?.name || 'Main Gate', gate, place: 'Campus' };
    if (dir === 'out' && !this.store.dest) this.store.dest = g.mode === 'drive' || g.mode === 'ride' ? 'City' : 'Others';
    this.record(k, dir, 'guard');
    g.ui.toast(`The guard at ${gate?.name || 'the gate'} logged you ${dir} at ${this.fmt(g.clock.abs)}.`, 'info', 'OneStop');
  }

  /** a visit you walked away from (the café, the pool, a hostel you left another way): the guard closes it */
  autoClose(dt) {
    const g = this.g;
    if (g.interior?.active) return;
    const P = g.player.pos;
    for (const e of this.entries) {
      if (e.scope === 'campus' || !e.a || e.b || e.x == null) continue;
      const far = Math.hypot(P.x - e.x, P.z - e.z) > 90;
      e.farT = far ? (e.farT || 0) + dt : 0;
      if (e.farT > 12) { e.b = { dir: 'out', gate: e.place, abs: g.clock.abs, how: 'guard' }; delete e.farT; g.progress.save(); }
    }
  }

  // ------------------------------------------------------------------ the phone
  ensureUI() {
    if (this.el) return;
    css();
    const el = (this.el = document.createElement('section'));
    el.id = 'phone'; el.className = 'overlay'; el.hidden = true;
    el.innerHTML = '<div class="os-phone"><div class="os-notch"></div><div class="os-status"><span class="os-clock"></span><span>5G ▂▄▆█ ▮▮▮</span></div><div class="os-screen"></div><div class="os-homebar"></div></div>';
    document.getElementById('app').appendChild(el);
    el.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); if (e.key === 'Enter' && (this.screen === 'profile' || this.screen === 'setup')) this.saveProfile(); });
    el.addEventListener('mousedown', (e) => { if (e.target === el) this.close(); });
    // closed from outside (Esc closes every overlay): put the game back
    new MutationObserver(() => { if (el.hidden && this.busy) this.onClosed(); }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
  }
  isOpen() { return !!this.el && !this.el.hidden; }

  /** screen: home | gatelog | scan | result | pass | food | timetable | profile | setup | needsetup */
  open(screen = 'home', ctx = {}) {
    this.ensureUI();
    const g = this.g;
    g.input?.exitLock?.();
    g.ui?.closeAll?.();
    this.ctx = ctx;
    this.busy = true;
    this.el.hidden = false;
    this.show(screen);
  }
  close() { if (this.el) this.el.hidden = true; this.onClosed(); }
  onClosed() {
    if (!this.busy) return;
    this.busy = false;
    clearTimeout(this.scanT1); clearTimeout(this.scanT2); clearTimeout(this.scanT3);
    if (this.setupDone && this.screen === 'setup') { const f = this.setupDone; this.setupDone = null; if (this.profile.setup) f(); }
    this.setupDone = null;
  }

  show(screen) {
    this.screen = screen;
    this.el.querySelector('.os-clock').textContent = this.g.clock ? fmtHour(this.g.clock.hour) : '';
    const S = this.el.querySelector('.os-screen');
    ({ home: () => this.home(S), live: () => this.live(S), buycoupon: () => this.buyCoupon(S), coupon: () => this.couponCard(S), gatelog: () => this.gatelog(S), scan: () => this.scan(S), result: () => this.result(S), pass: () => this.myPass(S), food: () => this.food(S), timetable: () => this.timetable(S),
      profile: () => this.profileForm(S, false), setup: () => this.profileForm(S, true), needsetup: () => this.needSetup(S) }[screen] || (() => this.home(S)))();
    S.scrollTop = 0;
  }
  bar(title, back = 'home') { return `<div class="os-bar"><button class="os-back" data-go="${back}" title="Back">‹</button><b>${esc(title)}</b></div>`; }
  nav(on) {
    const b = (id, go, ic, t) => `<button class="${on === id ? 'on' : ''}" data-go="${go}">${ICON[ic]}${t}</button>`;
    return `<div class="os-nav">${b('home', 'home', 'home', 'Home')}${b('live', 'live', 'live', 'Live')}${b('food', 'food', 'fork', 'Food')}${b('travel', 'gatelog', 'bus', 'Travel')}${b('profile', 'profile', 'person', 'Me')}</div>`;
  }
  bind(S) {
    S.querySelectorAll('[data-go]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); clearTimeout(this.scanT1); clearTimeout(this.scanT2); clearTimeout(this.scanT3); this.show(b.dataset.go); }));
    S.querySelectorAll('[data-a]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); this.action(b.dataset.a); }));
    S.querySelectorAll('[data-dest]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); this.chooseDest(b.dataset.dest); }));
  }
  action(a) {
    if (a === 'scan') { const k = this.ctx.kiosk || this.nearest(); if (k) this.scanAt(k); else this.show('gatelog'); }
    else if (a === 'close') this.close();
    else if (a === 'save') this.saveProfile();
    else if (a === 'skip') this.skipSetup();
    else if (a === 'cancel') { this.store.dest = null; this.g.progress.save(); this.show('gatelog'); }
    else this.show(a);
  }
  /** Open New Entry: where you are going (then the machine at the gate reads it) */
  chooseDest(d) {
    this.store.dest = d; this.g.progress.save();
    this.g.audio.tone?.(760, 0.08, { type: 'triangle', gain: 0.04 });
    const k = this.ctx.kiosk && this.ctx.kiosk.kind === 'campus' ? this.ctx.kiosk : this.nearest()?.kind === 'campus' ? this.nearest() : null;
    if (k && this.dirAt(k) === 'out') { this.ctx = { kiosk: k, dir: 'out' }; this.show('scan'); }
    else this.show('gatelog');
  }

  user() {
    const p = this.profile, init = (p.name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 1).join('').toUpperCase();
    return `<div class="os-user"><div class="os-av">${esc(init)}</div><div><b>${esc(p.name || 'Your name')}</b><small>${esc(p.roll || 'Roll number')}</small></div></div>`;
  }
  meal() {
    const c = this.g.clock, h = c.hour, wd = c.weekday;
    let i = MEALS.findIndex((m) => h < m.to);
    let day = wd;
    if (i < 0) { i = 0; day = (wd + 1) % 7; }
    const m = MEALS[i];
    return { ...m, items: MENU[day][i], now: h >= m.from && h < m.to, ends: h >= m.from && h < m.to ? `ENDS ${fmtHour(m.to)}` : `${day !== wd ? 'TOMORROW ' : ''}${fmtHour(m.from)}` };
  }
  nextClass() {
    const c = this.g.clock, h = c.hour, wd = c.weekday;
    if (wd >= 5 || h >= 17) return null;
    const slot = Math.max(9, Math.ceil(h - 0.05));
    if (slot >= 17) return null;
    const L = lectureFor(wd, slot, null);
    return `${fmtHour(slot)} · ${L.title}`;
  }

  home(S) {
    const c = this.g.clock, meal = this.meal(), next = this.nextClass(), open = this.openEntry('campus');
    S.innerHTML = `<div class="os-top"><div class="os-brand">${LOGO(30)}<span>One<i>Stop</i></span></div><div class="os-round" title="Notifications">${ICON.bell}</div></div>
      <div class="os-body">
        <div class="os-card link" data-go="live"><h4>${ICON.live} Campus Live <small>· now</small><span class="os-chev">›</span></h4><p class="os-big">${esc(this.liveHead())}</p></div>
        <div class="os-card link" data-go="timetable"><h4>${ICON.cal} Time Table <small>· ${esc(this.dateLabel(c.abs, true))}</small><span class="os-chev">›</span></h4><p class="os-big">${next ? esc(next) : 'No upcoming classes'}</p></div>
        <div class="os-grid2">
          <div class="os-card link" data-go="food"><h4>${ICON.food} Food<span class="os-chev">›</span></h4><p class="os-muted">${meal.name.toUpperCase()} · ${esc(meal.ends)}</p><p class="os-menu">${meal.items.map((x, i) => `${i + 1}. ${esc(x)}`).join(', ')}</p></div>
          <div class="os-card"><h4 class="link" data-go="gatelog" style="cursor:pointer">${ICON.door} Gatelog<span class="os-chev">›</span></h4>
            ${open ? `<p class="os-muted os-open">Out since ${this.fmt(open.a.abs)}<br>${esc(open.dest || '')} · ${esc(open.a.gate)}</p><button class="os-pill" data-go="gatelog">My entry</button>`
              : `<button class="os-pill" data-dest="City">To City</button><button class="os-pill" data-dest="Khokha">To Khokha</button><button class="os-pill" data-dest="Others">Others</button>`}
          </div>
        </div>
        <h3 class="os-h">Quick Access</h3>
        <div class="os-qa">
          <button data-go="gatelog">${ICON.door}GateLog</button><button data-go="pass">${ICON.qr}My QR</button><button data-go="food">${ICON.food}Mess Menu</button><button data-go="timetable">${ICON.cal}Time Table</button>
          <button data-go="live">${ICON.live}Live</button><button data-go="buycoupon">${ICON.ticket}Coupon</button><button data-go="profile">${ICON.user}Profile</button><button data-a="rules">${ICON.rules}Rules</button>
        </div>
      </div>${this.nav('home')}`;
    this.bind(S);
    S.querySelector('[data-a="rules"]').onclick = () => { this.g.ui.toast('Campus gates: Main Gate always open; KV and Khokha Gates 6 AM - 10 PM. The other gender\'s hostels: common areas and the canteen only, any time except 2 - 6 AM. Scan in and out at every OneStop machine.', 'info', 'OneStop rules'); };
  }

  gatelog(S) {
    const c = this.g.clock, S0 = this.store, open = this.openEntry('campus'), k = this.ctx.kiosk;
    let top;
    if (open) {
      top = `<div class="os-card"><div class="os-row"><h4>Your entry is open</h4><span class="os-time">${this.fmt(c.abs)}</span></div>
        <p class="os-muted">Out at ${esc(open.a.gate)}, ${this.fmt(open.a.abs)} · destination ${esc(open.dest)}</p>
        <div class="os-qr"><canvas width="400" height="400"></canvas></div><p class="os-muted os-center">Destination: ${esc(open.dest)}</p>${this.user()}
        <p class="os-tip">Back on campus? Scan in at any campus gate's machine: your entry closes with the in time.</p></div>`;
    } else if (S0.dest) {
      top = `<div class="os-card"><div class="os-row"><h4>Open New Entry</h4><span class="os-time">${this.fmt(c.abs)}</span></div>
        <div class="os-qr"><canvas width="400" height="400"></canvas></div><p class="os-muted os-center">Destination: ${esc(S0.dest)}</p>${this.user()}
        ${k && k.kind === 'campus' ? `<button class="os-pill solid" data-a="scan">Scan out at ${esc(k.gate?.name || k.name)}</button>` : '<p class="os-tip">Walk up to the OneStop machine at a campus gate (Main, KV or Khokha Gate) and press E: your out time is noted and the gate opens.</p>'}
        <button class="os-pill warn" data-a="cancel">✕ Cancel</button></div>`;
    } else {
      top = `<div class="os-card"><div class="os-row"><h4>Open New Entry</h4><span class="os-time">${this.fmt(c.abs)}</span></div>
        <button class="os-pill" data-dest="Khokha">${ICON.store} Khokha</button><button class="os-pill" data-dest="City">${ICON.city} City</button><button class="os-pill" data-dest="Others">${ICON.compass} Others</button>
        ${this.user()}${this.ctx.choose ? '<p class="os-tip">Where are you going? Choose, and the gate reads your pass.</p>' : ''}</div>`;
    }
    // previous entries, by day
    let rows = '', day = '';
    for (const e of this.entries) {
      const abs = e.a?.abs ?? e.b?.abs;
      if (abs == null) continue;
      const d = this.dateLabel(abs);
      if (d !== day) { day = d; rows += `<div class="os-day">${esc(d)}</div>`; }
      rows += this.entryCard(e);
    }
    S.innerHTML = `${this.bar('GateLog')}<div class="os-body">${top}<h3 class="os-h">Previous Entries</h3>${rows || '<p class="os-tip">No entries yet. Scan a OneStop machine at a gate.</p>'}</div>${this.nav('travel')}`;
    this.bind(S);
    const cv = S.querySelector('canvas');
    if (cv) { const p = this.profile; drawQR(cv.getContext('2d'), `ONESTOP|ENTRY|${p.roll || ''}|${p.name || ''}|${open ? open.dest : S0.dest}|${open ? open.id : 'new'}`, 0, 0, 400); }
  }
  entryCard(e) {
    const camp = e.scope === 'campus', A = e.a, B = e.b;
    const how = (st) => (st.how === 'register' ? ' · signed' : st.how === 'guard' ? ' · guard' : st.how === 'auto' ? ' · auto' : '');
    const cell = (st, cls, openText) => st
      ? `<div class="end ${cls}"><b>${esc(st.gate)}</b>${this.fmt(st.abs)}<span class="os-how">${how(st)}</span></div>`
      : `<div class="end ${cls} os-open"><b>${openText}</b>open</div>`;
    const labelA = camp ? 'OUT' : 'IN', labelB = camp ? 'IN' : 'OUT';
    return `<div class="os-card"><div class="os-track">${ICON.out}<hr>${ICON.pin}<hr>${ICON.out}</div>
      <div class="os-entry">${cell(A, '', '—')}<div class="mid">${esc(camp ? e.dest || 'Campus' : e.place)}</div>${cell(B, 'r', camp ? 'Not back yet' : 'Inside')}</div>
      <div class="os-row os-how" style="margin-top:3px"><span>${labelA}</span>${e.visitor ? '<span>visitor</span>' : ''}${A && B && A.abs != null && B.abs != null ? `<span>${this.dur(A.abs, B.abs)}</span>` : ''}<span>${labelB}</span></div></div>`;
  }

  // scanning: the camera sees the machine's QR, reads it, the entry is noted
  scan(S) {
    const k = this.ctx.kiosk, dir = this.ctx.dir || (k ? this.dirAt(k) : 'in');
    if (!k) { this.show('home'); return; }
    S.innerHTML = `${this.bar(dir === 'out' ? 'Scan out' : 'Scan in', this.ctx.quick ? '' : 'home')}<div class="os-cam"><canvas width="412" height="412"></canvas><div class="os-frame"></div><div class="os-line"></div><div class="os-cap">Point the camera at the QR code…</div></div>
      <div class="os-body"><p class="os-tip os-center">${esc(k.kind === 'campus' ? k.gate?.name || k.name : k.name)}</p></div>`;
    this.bind(S);
    if (this.ctx.quick) S.querySelector('.os-back').style.visibility = 'hidden';
    drawQR(S.querySelector('canvas').getContext('2d'), this.qrText(k), 0, 0, 412);
    const cam = S.querySelector('.os-cam'), cap = S.querySelector('.os-cap'), g = this.g, q = this.ctx.quick;
    this.scanT1 = setTimeout(() => { cam.classList.add('ok'); cap.textContent = 'QR code found'; g.audio.tone?.(1180, 0.09, { type: 'square', gain: 0.05 }); g.audio.tone?.(1580, 0.12, { type: 'square', gain: 0.04 }); }, q ? 650 : 950);
    this.scanT2 = setTimeout(() => {
      const res = this.record(k, dir, 'qr');
      g.audio.tone?.(dir === 'out' ? 880 : 660, 0.1, { type: 'triangle', gain: 0.06 }); setTimeout(() => g.audio.tone?.(dir === 'out' ? 660 : 880, 0.14, { type: 'triangle', gain: 0.06 }), 120);
      g.ui.toast(`${dir === 'out' ? 'Out' : 'In'} at ${res.stamp.gate} · ${this.fmt(res.stamp.abs)}${res.closed && res.entry.a ? ` · entry closed (${this.dur(res.entry.a.abs, res.stamp.abs)})` : ''}`, 'gold', 'OneStop');
      this.ctx = { ...this.ctx, res };
      this.show('result');
      if (q) { const then = this.ctx.then; this.scanT3 = setTimeout(() => { this.busy = false; this.el.hidden = true; then?.(); }, 900); }
    }, q ? 1100 : 1500);
  }
  result(S) {
    const r = this.ctx.res, k = this.ctx.kiosk, g = this.g;
    if (!r) { this.show('home'); return; }
    const e = r.entry, out = r.dir === 'out';
    let note = '';
    if (k?.extra) note = k.extra;
    else if (k?.kind === 'campus') note = out ? `Destination: ${e.dest}. The gate is open: go through.` : e.a ? `Welcome back! You were out ${this.dur(e.a.abs, r.stamp.abs)}.` : 'Welcome to IIT Guwahati!';
    else if (k?.kind === 'hostel' && !out) note = e.visitor ? `Visitor: common areas${g.clock.hour >= 18 || g.clock.hour < 2 ? ' and the canteen (2nd floor)' : ''} only, no rooms. Please be out by 2 AM.` : k.site === this.profile.hostel ? 'Welcome home.' : 'The door is open.';
    S.innerHTML = `${this.bar(out ? 'Out' : 'In', this.ctx.quick ? '' : 'home')}<div class="os-body"><div class="os-result"><div class="os-tick ${out ? 'out' : ''}">${out ? '↗' : '↘'}</div>
      <h3>${out ? 'Out' : 'In'} · ${this.fmt(r.stamp.abs)}</h3><p><b>${esc(r.stamp.gate)}</b></p><p>${r.closed ? `Entry closed${e.a ? ` · ${this.dur(e.a.abs, r.stamp.abs)}` : ''}` : 'Entry opened'}</p>${note ? `<p>${esc(note)}</p>` : ''}</div>
      ${this.entryCard(e)}${this.ctx.quick ? '' : `<button class="os-pill solid" data-a="close">Done</button><button class="os-pill" data-go="gatelog">GateLog</button>`}</div>`;
    this.bind(S);
    if (this.ctx.quick) S.querySelector('.os-back').style.visibility = 'hidden';
  }

  myPass(S) {
    const p = this.profile;
    S.innerHTML = `${this.bar('My QR')}<div class="os-body"><div class="os-card"><div class="os-qr" style="margin-top:0"><canvas width="400" height="400"></canvas></div>${this.user()}<p class="os-muted">${esc(this.hostelName(p.hostel))} Hostel · Room ${esc(p.room || '—')}</p></div><p class="os-tip">Show this pass to a guard, or let a friend scan it.</p></div>${this.nav('profile')}`;
    this.bind(S);
    drawQR(S.querySelector('canvas').getContext('2d'), `ONESTOP|PASS|${p.name}|${p.roll}|${this.hostelName(p.hostel)}|${p.room}`, 0, 0, 400);
  }
  food(S) {
    const c = this.g.clock, h = c.hour, wd = c.weekday, P = this.g.progress;
    const rows = MEALS.map((m, i) => `<div class="os-card"><div class="os-meal ${h >= m.from && h < m.to ? 'now' : ''}"><h4>${esc(mealName(m.id, wd))}</h4><small>${fmtHour(m.from)} – ${fmtHour(m.to)}</small></div><p class="os-menu">${MENU[wd][i].map((x, j) => `${j + 1}. ${esc(x)}`).join(', ')}</p><p class="os-how" style="margin:4px 0 0">Guest coupon ₹${priceOf(m.id, wd)}${isSpecial(m.id, wd) ? ' · Sunday special' : ''}</p></div>`).join('');
    const mine = P.coupons.filter((q) => !q.used && q.day === c.day);
    const cp = mine.length ? mine.map((q) => `<div class="os-coupon"><b>${esc(q.name || 'Meal')} · ${esc(this.hostelName(q.hostel))} mess</b><small>${q.price ? `₹${q.price} paid` : 'Mess card'} · valid today · hand it to the mess counter</small></div>`).join('') : '<p class="os-tip">No coupon yet.</p>';
    S.innerHTML = `${this.bar(`Mess menu · ${c.dayName}`)}<div class="os-body"><div class="os-card"><h4>${ICON.ticket} Your coupons</h4>${cp}<button class="os-pill solid" data-go="buycoupon">Buy a guest coupon</button></div>${rows}<p class="os-tip">${esc(this.hostelName(this.profile.hostel))} Hostel: your mess card is free at your own mess. Hostel canteens: 6 PM – 2 AM.</p></div>${this.nav('food')}`;
    this.bind(S);
  }

  /** what is going on at each place right now */
  live(S) {
    const rows = campusLive(this.g).map((r) => `<div class="os-live"><i class="d ${r.tag}"></i><div><span class="p">${esc(r.place)}</span><b>${esc(r.head)}</b><small>${esc(r.detail || '')}</small></div>${r.count ? `<span class="n">${r.count} inside</span>` : ''}</div>`).join('');
    S.innerHTML = `${this.bar('Campus Live')}<div class="os-body"><div class="os-card">${rows}</div><p class="os-tip">${esc(this.g.clock.dayName)} · ${fmtHour(this.g.clock.hour)}. Updates as the day goes on.</p></div>${this.nav('live')}`;
    this.bind(S);
  }
  liveHead() {
    const r = campusLive(this.g).find((x) => x.tag === 'live');
    return r ? `${r.place}: ${r.head}` : 'A quiet moment on campus';
  }

  /** buy a guest coupon for another hostel's mess: paid by UPI from your account, shown here, handed in at the counter */
  buyCoupon(S) {
    const g = this.g, c = g.clock, wd = c.weekday, P = g.progress, form = (this.cform ||= {});
    const now = MEALS.findIndex((m) => c.hour < m.to);
    const meals = MEALS.map((m, i) => ({ ...m, i })).filter((m) => m.i >= Math.max(0, now));
    if (now < 0 || !meals.length) { S.innerHTML = `${this.bar('Guest coupon')}<div class="os-body"><div class="os-card os-center"><p class="os-big">The messes are closed for today.</p><p class="os-tip">Breakfast starts at ${fmtHour(MEALS[0].from)} tomorrow.</p></div></div>${this.nav('food')}`; this.bind(S); return; }
    if (!meals.some((m) => m.id === form.meal)) form.meal = meals[0].id;
    const others = this.hostels().filter((h) => h.id !== P.profile.hostel);
    if (!others.some((h) => h.id === form.hostel)) form.hostel = (others.find((h) => h.girls === (P.profile.gender === 'girl') || h.married) || others[0]).id;
    const price = priceOf(form.meal, wd);
    S.innerHTML = `${this.bar('Guest coupon')}<div class="os-body"><div class="os-card"><h4>${ICON.ticket} Eat at another hostel's mess</h4><p class="os-tip">Your own mess is free with your mess card. At another hostel you pay for the meal: buy the coupon here and hand it in at that mess counter (or just pay at the counter).</p>
      <label>Hostel<select id="os-ch">${others.map((h) => `<option value="${h.id}" ${h.id === form.hostel ? 'selected' : ''}>${esc(h.name)}${h.girls ? ' (girls)' : ''}</option>`).join('')}</select></label>
      <label>Meal<select id="os-cm">${meals.map((m) => `<option value="${m.id}" ${m.id === form.meal ? 'selected' : ''}>${esc(mealName(m.id, wd))} · ${fmtHour(m.from)} · ₹${priceOf(m.id, wd)}</option>`).join('')}</select></label>
      <p class="os-muted">UPI account: ₹${Math.round(P.bank).toLocaleString('en-IN')}</p>
      <button class="os-pill solid" data-a="pay-coupon">Pay ₹${price} by UPI</button><p class="os-err" id="os-cerr"></p></div></div>${this.nav('food')}`;
    this.bind(S);
    S.querySelector('#os-ch').onchange = (e) => { form.hostel = e.target.value; };
    S.querySelector('#os-cm').onchange = (e) => { form.meal = e.target.value; this.buyCoupon(S); };
    S.querySelector('[data-a="pay-coupon"]').onclick = (e) => {
      e.stopPropagation();
      if (!P.payWith('upi', price, `${mealName(form.meal, wd)} coupon`)) { S.querySelector('#os-cerr').textContent = 'Payment failed: not enough balance in your account.'; g.audio.tone?.(300, 0.08, { type: 'triangle', gain: 0.04 }); return; }
      const cp = P.addCoupon({ meal: form.meal, hostel: form.hostel, price, method: 'upi', name: mealName(form.meal, wd) });
      this.ctx = { ...this.ctx, coupon: cp };
      g.audio.tone?.(880, 0.1, { type: 'triangle', gain: 0.06 }); setTimeout(() => g.audio.tone?.(1180, 0.14, { type: 'triangle', gain: 0.06 }), 110);
      this.show('coupon');
    };
  }
  couponCard(S) {
    const cp = this.ctx.coupon || this.g.progress.coupons.filter((q) => !q.used).slice(-1)[0];
    if (!cp) { this.show('food'); return; }
    const p = this.profile;
    S.innerHTML = `${this.bar('Coupon', 'food')}<div class="os-body"><div class="os-result"><div class="os-tick">✓</div><h3>Paid ₹${cp.price}</h3><p>${esc(cp.name)} · ${esc(this.hostelName(cp.hostel))} Hostel mess</p></div>
      <div class="os-card"><div class="os-qr" style="margin-top:0"><canvas width="400" height="400"></canvas></div><p class="os-muted os-center">Valid today for one plate · hand it to the mess counter</p>${this.user()}</div>
      <button class="os-pill" data-go="food">Back to Food</button></div>${this.nav('food')}`;
    this.bind(S);
    drawQR(S.querySelector('canvas').getContext('2d'), `ONESTOP|COUPON|${cp.id}|${p.roll}|${cp.hostel}|${cp.meal}|${cp.price}`, 0, 0, 400);
  }
  timetable(S) {
    const c = this.g.clock, wd = c.weekday;
    let rows = '';
    if (wd >= 5) rows = '<p class="os-big">No classes on the weekend.</p>';
    else for (let h = 9; h < 17; h++) { if (h === 13) continue; const L = lectureFor(wd, h, null); rows += `<div class="os-class"><b>${fmtHour(h)}</b><span>${esc(L.title)}<br><span class="os-how">Lecture Hall Complex</span></span></div>`; }
    S.innerHTML = `${this.bar(`Time Table · ${c.dayName}`)}<div class="os-body"><div class="os-card">${rows}</div><p class="os-tip">Lunch break 1 – 2 PM.</p></div>${this.nav('home')}`;
    this.bind(S);
  }
  needSetup(S) {
    S.innerHTML = `${this.bar('OneStop')}<div class="os-body"><div class="os-card os-center"><div style="display:grid;place-items:center;margin:6px 0 8px">${LOGO(56)}</div><h4 style="justify-content:center">Set up OneStop first</h4><p class="os-tip">The gates know you by your name, roll number, hostel and room.</p><button class="os-pill solid" data-go="profile">Fill in my details</button></div></div>`;
    this.bind(S);
  }

  profileForm(S, setup) {
    const p = this.profile, g = this.g;
    const girl = p.gender ? p.gender === 'girl' : this.female();
    this.form = { gender: girl ? 'girl' : 'boy' };
    const opts = () => this.hostels().filter((h) => h.married || h.girls === (this.form.gender === 'girl')).map((h) => `<option value="${h.id}" ${h.id === p.hostel ? 'selected' : ''}>${esc(h.name)}${h.married ? ' (married scholars)' : ''}</option>`).join('');
    S.innerHTML = `${setup ? `<div class="os-top"><div class="os-brand">${LOGO(30)}<span>One<i>Stop</i></span></div><span class="os-time">${g.clock ? fmtHour(g.clock.hour) : ''}</span></div>` : this.bar('My details')}<div class="os-body">
      ${setup ? '<div class="os-card"><h4>Welcome to IIT Guwahati</h4><p class="os-tip">OneStop is your campus entry app: every gate, hostel door and the pool read your pass, and note when you go in and out. The game starts outside your hostel.</p></div>' : ''}
      <label>Full name<input type="text" id="os-name" maxlength="40" value="${esc(p.name && p.setup ? p.name : (p.name === 'Gaurav' && !p.setup ? '' : p.name || ''))}" placeholder="Your name"></label>
      <label>I am<span class="os-seg" id="os-gender"><button type="button" data-g="boy" class="${girl ? '' : 'on'}">Boy</button><button type="button" data-g="girl" class="${girl ? 'on' : ''}">Girl</button></span></label>
      <label>Hostel<select id="os-hostel">${opts()}</select></label>
      <label>${ROLL_LABEL}<input type="text" id="os-roll" inputmode="numeric" maxlength="${ROLL_MAX}" value="${esc(p.roll || '')}" placeholder="${ROLL_PLACEHOLDER}"></label>
      <label>Room number<input type="text" id="os-room" maxlength="6" value="${esc(p.room || '')}" placeholder="B-214"></label>
      <p class="os-err" id="os-err"></p>
      <button class="os-pill solid" data-a="save">${setup ? 'Save and start from my hostel' : 'Save my details'}</button>
      ${setup ? '<button class="os-pill" data-a="skip">Skip: arrive at the Main Gate</button>' : ''}</div>${setup ? '' : this.nav('profile')}`;
    this.bind(S);
    S.querySelector('#os-roll').addEventListener('input', (e) => { const v = cleanRoll(e.target.value); if (v !== e.target.value) e.target.value = v; });
    S.querySelectorAll('#os-gender button').forEach((b) => (b.onclick = () => {
      this.form.gender = b.dataset.g;
      S.querySelectorAll('#os-gender button').forEach((x) => x.classList.toggle('on', x === b));
      const sel = S.querySelector('#os-hostel'), keep = sel.value;
      sel.innerHTML = this.hostels().filter((h) => h.married || h.girls === (this.form.gender === 'girl')).map((h) => `<option value="${h.id}">${esc(h.name)}${h.married ? ' (married scholars)' : ''}</option>`).join('');
      if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
    }));
    setTimeout(() => S.querySelector('#os-name')?.focus(), 250);
  }

  saveProfile() {
    const S = this.el.querySelector('.os-screen'), $ = (s) => S.querySelector(s);
    if (!$('#os-name')) return;
    const name = $('#os-name').value.trim(), roll = $('#os-roll').value.trim(), room = $('#os-room').value.trim().toUpperCase(), hostel = $('#os-hostel').value, gender = this.form.gender;
    const err = (t) => { $('#os-err').textContent = t; this.g.audio.tone?.(300, 0.08, { type: 'triangle', gain: 0.04 }); };
    if (name.length < 2) return err('Please write your full name.');
    if (!isRoll(roll)) return err(ROLL_ERROR);
    if (!/^[A-Za-z]?-?\d{2,4}$/.test(room)) return err('The room number looks like B-214.');
    const g = this.g, p = this.profile, moved = p.hostel !== hostel;
    Object.assign(p, { name, roll, room, hostel, gender, setup: true });
    const body = gender === 'girl' ? 'female' : 'male';
    if (g.player.avatar.look.body !== body) { const look = { ...g.player.avatar.look, body }; if (body === 'female' && look.facialHair && look.facialHair !== 'none') look.facialHair = 'none'; g.player.setLook(look); g.progress.look = look; }
    g.progress.save();
    g.audio.tone?.(760, 0.1, { type: 'triangle', gain: 0.05 });
    if (this.screen === 'setup') {
      g.spawnAtHostel?.(hostel);
      const f = this.setupDone; this.setupDone = null;
      this.busy = false; this.el.hidden = true;
      f?.();
      return;
    }
    if (g.mode === 'title') { g.spawnAtHostel?.(hostel); g.ui.toast(`The game will start outside ${this.hostelName(hostel)} Hostel.`, 'info', 'OneStop'); this.close(); return; }
    S.innerHTML = `${this.bar('Saved', '')}<div class="os-body"><div class="os-result"><div class="os-tick">✓</div><h3>Details saved</h3><p>${esc(name)} · ${esc(roll)}</p><p>${esc(this.hostelName(hostel))} Hostel · Room ${esc(room)}</p><p>The game starts outside your hostel.</p></div>
      ${moved ? `<button class="os-pill solid" data-a="home-now">Take me to ${esc(this.hostelName(hostel))} Hostel now</button>` : ''}<button class="os-pill" data-a="close">Close the phone</button></div>`;
    this.bind(S);
    S.querySelector('.os-back').style.visibility = 'hidden';
    S.querySelector('[data-a="home-now"]')?.addEventListener('click', () => { this.close(); g.spawnAtHostel?.(hostel); g.ui.toast(`Outside ${this.hostelName(hostel)} Hostel.`, 'info', 'OneStop'); });
  }

  skipSetup() {
    const f = this.setupDone; this.setupDone = null;
    this.g.progress.flags.passSkipped = 1;
    this.busy = false; this.el.hidden = true;
    f?.();
  }

  /** first start: the OneStop form, then the game begins from the chosen hostel */
  openSetup(done) {
    this.setupDone = done;
    this.open('setup');
  }
}

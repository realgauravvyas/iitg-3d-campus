// The pause menu: a window with a navigation rail (Game, Sound, Display & access, Controls, Game guide,
// Progress & backup, About) and one pane per section. Every setting is written to the saved settings
// straight away, so there is nothing to confirm.
import { TIME_PRESETS, formatTime } from './scene/sky.js';
import { saveFile } from './util.js';
import { rupees, ACHIEVEMENTS } from './progress.js';
import { VERSION, VERSION_LABEL, AUTHOR, CONTACT, LICENCE } from './version.js';

const $ = (id) => document.getElementById(id);
export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** 'Shift|N' -> two key caps */
export const caps = (k) => String(k).split('|').map((c) => `<kbd class="key">${esc(c)}</kbd>`).join('');

export const REMAP = [['KeyW', 'Forward'], ['KeyS', 'Back'], ['KeyA', 'Left'], ['KeyD', 'Right'], ['KeyE', 'Interact'], ['KeyI', 'Info'], ['KeyO', 'OneStop phone'], ['Space', 'Jump'], ['ShiftLeft', 'Sprint'], ['KeyB', 'Bicycle'], ['KeyT', 'Tours'], ['KeyG', 'Drone'], ['KeyK', 'Camera'], ['KeyM', 'Map'], ['KeyJ', 'Journal'], ['Tab', 'Planner'], ['KeyQ', 'Show the way'], ['KeyN', 'Time of day'], ['KeyZ', 'Mute']];
export const prettyKey = (c) => (!c ? '—' : c.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift'));

/** the key reference, grouped (the same list the guide shows) */
export const KEY_GROUPS = [
  ['Moving around', [['W|A|S|D', 'Move (arrow keys work too)'], ['Mouse', 'Look: click the view to lock the pointer, Esc frees it'], ['Wheel', 'Zoom the camera'], ['Shift', 'Sprint, or boost when flying'], ['Space', 'Jump, or fly up'], ['C', 'Fly down'], ['F', 'Start or stop flying'], ['V', 'Change the camera view']]],
  ['Doing things', [['E', 'Interact: go into buildings, order food, sit, work, play, borrow a cycle, talk'], ['I', 'Info: what the building or thing you are near or looking at has, and what works'], ['O', 'OneStop phone: scan in and out, mess coupons, timetable, Campus Live'], ['1|2|3|4', 'Wave, dance, cheer, clap'], ['Q', 'Show or hide the way to your objective'], ['Tab', 'Campus planner: timetable, events, jobs, money'], ['J', 'Journal: progress, achievements, your photos'], ['M', 'Campus map, with fast travel'], ['P', 'Character creator']]],
  ['Getting around', [['B', 'Get on or off your bicycle'], ['T', 'Campus tour: bus, on foot, by cycle or by drone'], ['Y', 'Guided bicycle ride'], ['L', 'Race against the clock'], ['G', 'Drone (V: first person or chase view, X: bring it home)'], ['R', 'Bicycle bell, vehicle horn, or record video']]],
  ['Camera, time & help', [['K', 'Camera: photos and video'], ['N', 'Next time of day'], ['Shift|N', 'Time and weather controls'], ['Z', 'Mute or unmute'], ['H', 'Show or hide the key hints'], ['F1', 'Game guide'], ['Esc', 'Pause menu']]],
];

const ICONS = {
  game: '<svg viewBox="0 0 24 24"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/></svg>',
  display: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  controls: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/></svg>',
  guide: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 21.5v-16z"/><path d="M4 21.5A2.5 2.5 0 016.5 19H20M9 8h7M9 11.5h5"/></svg>',
  data: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
  about: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6h.01"/></svg>',
};
const TABS = [['game', 'Game'], ['sound', 'Sound'], ['display', 'Display & access'], ['controls', 'Controls'], ['guide', 'Game guide', 'F1'], ['data', 'Progress & backup'], ['about', 'About']];
const TITLES = { game: 'Game', sound: 'Sound', display: 'Display & access', controls: 'Controls', guide: 'Game guide', data: 'Progress & backup', about: 'About' };

// ------------------------------------------------------------ small builders
const seg = (id, items, cur) => `<div class="seg" data-seg="${id}" role="group">${items.map(([v, n]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${n}</button>`).join('')}</div>`;
const swtch = (id, on) => `<label class="swtch"><input type="checkbox" data-sw="${id}" ${on ? 'checked' : ''}><i></i></label>`;
const pct = (v, min, max) => Math.round(((v - min) / (max - min)) * 100);
const slider = (id, val, min, max, step, out) => `<div class="slide"><input type="range" data-sl="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="--v:${pct(val, min, max)}%" aria-label="${esc(id)}"><output>${out}</output></div>`;
const row = (title, desc, ctl, stack = false) => `<div class="set${stack ? ' stack' : ''}"><div><b>${title}</b>${desc ? `<small>${desc}</small>` : ''}</div><div class="ctl-r">${ctl}</div></div>`;
const card = (title, note, ...rows) => `<section class="card"><h3>${title}</h3>${note ? `<p class="note">${note}</p>` : ''}${rows.join('')}</section>`;

/** open (or refresh) the pause menu on a tab */
export function openPause(ui, tab) {
  const g = ui.g;
  $('pause').hidden = false;
  if (tab) ui.pauseTab = tab;
  const cur = (ui.pauseTab = TABS.some((t) => t[0] === ui.pauseTab) ? ui.pauseTab : 'game');
  $('pause-ver').textContent = VERSION_LABEL;
  $('pause-title').textContent = TITLES[cur];
  const nav = $('pause-nav');
  nav.innerHTML = TABS.map(([id, name, k]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === cur}">${ICONS[id]}<span>${name}</span>${k ? `<kbd class="kb">${k}</kbd>` : ''}</button>`).join('');
  nav.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => {
    if (b.dataset.tab === 'guide') { ui.openGuide(); return; }
    ui.pauseTab = b.dataset.tab; openPause(ui);
  }));
  const pane = $('pause-pane');
  const keep = pane.scrollTop;
  pane.innerHTML = (PANES[cur] || PANES.game)(ui, g);
  pane.scrollTop = keep;
  wire(pane, ui, g);
  $('resume').onclick = () => ui.closeAll();
  $('to-title').onclick = () => { ui.closeAll(); g.toTitle(); };
}

// ------------------------------------------------------------ the panes
const S_OF = (g) => g.progress.settings;
const PANES = {
  game(ui, g) {
    const c = g.clock, S = S_OF(g);
    const presets = TIME_PRESETS.map((t) => `<button type="button" data-time="${t.t}" aria-pressed="${Math.abs(c.hour - t.t) < 0.05}"><b>${esc(t.name)}</b><small>${formatTime(t.t)}</small></button>`).join('');
    return `<p class="lede">Campus time runs on Indian Standard Time, as at IIT Guwahati. Meals, lectures, gate hours, sports and the crowd all follow the clock.</p>`
      + card('Time of day', 'Jump to a time. Everything on campus follows: the mess menu, the crowd, the lights.', `<div class="set stack"><div class="chipgrid">${presets}</div></div>`)
      + card('Clock and weather', '', row('Clock speed', 'How fast campus time passes while you play.', seg('speed', [['pause', 'Paused'], ['real', 'Real time'], ['x10', '1 min = 10 min'], ['x20', '1 min = 20 min'], ['x60', '1 min = 1 hour']], c.speedId), true),
        row('Weather', 'Auto follows the Guwahati seasons (monsoon rain, winter mist).', seg('weather', [['auto', 'Auto'], ['clear', 'Clear'], ['cloudy', 'Cloudy'], ['overcast', 'Overcast'], ['rain', 'Rain'], ['storm', 'Storm'], ['mist', 'Mist'], ['fog', 'Fog']], g.weather.mode), true))
      + card('How you play', '', row('People on campus', 'Applies when the page is reloaded.', seg('crowd', [[0.5, 'Fewer'], [1, 'Normal'], [1.5, 'Busy']], S.crowd ?? 1)),
        row('Energy', 'Hunger and tiredness matter, or take it easy.', seg('relaxed', [[false, 'Needs food and rest'], [true, 'Relaxed']], !!S.relaxed)));
  },
  sound(ui, g) {
    const A = g.audio, S = S_OF(g);
    const CH = [['music', 'Music', 'The tunes for the time of day, sport and dancing.'], ['sfx', 'Effects', 'Footsteps, doors, engines, plates.'], ['amb', 'Ambience', 'Birds, crickets, rain and water.'], ['ui', 'Interface', 'Clicks and chimes.'], ['voice', 'Voice', 'The tour guide.']];
    return `<p class="lede">The whole soundscape is made inside the game. Nothing plays until you have clicked or pressed a key once.</p>`
      + card('Volume', '', row('Master volume', '', slider('vol', A.volume, 0, 1, 0.05, `${Math.round(A.volume * 100)}%`)),
        ...CH.map(([k, n, d]) => row(n, d, slider(`ch-${k}`, A.vol[k], 0, 1, 0.05, `${Math.round(A.vol[k] * 100)}%`))))
      + card('Options', '', row('Sound', 'Turn everything off or on (Z).', swtch('sound', !A.muted)), row('Background music', 'Music while you explore. The title music always plays on the title screen.', swtch('bgm', S.bgm !== false)), row('Subtitles', 'Show what the tour guide and people say.', swtch('subs', A.subtitles)));
  },
  display(ui, g) {
    const S = S_OF(g);
    return `<p class="lede">Change how the game looks and feels. Graphics changes reload the view.</p>`
      + card('Graphics', '', row('Quality', 'Low turns shadows off. High draws more far away.', seg('quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], S.quality || 'medium')),
        row('Field of view', 'How wide the camera sees.', slider('fov', S.fov || 62, 50, 90, 1, `${S.fov || 62}°`)))
      + card('Comfort and accessibility', '', row('Text size', 'Scales the on-screen panels and menus.', seg('uiscale', [[0.9, 'Small'], [1, 'Normal'], [1.15, 'Large'], [1.3, 'Extra large']], S.uiScale || 1)),
        row('Colour-blind friendly markers', 'Map markers use shapes as well as colours.', swtch('cb', !!S.cb)), row('High contrast', 'Solid black panels with white text.', swtch('hc', !!S.hc)),
        row('Reduce motion', 'Calmer screen effects.', swtch('calm', !!S.calm)), row('Key hints on screen', 'The list of keys in the corner (H).', swtch('hints', g.ui.keysVisible)));
  },
  controls(ui, g) {
    const groups = KEY_GROUPS.map(([t, list]) => card(t, '', `<div class="keytable">${list.map(([k, d]) => `<div class="kk">${caps(k)}</div><span>${esc(d)}</span>`).join('')}</div>`)).join('');
    const remap = `<div class="keygrid">${REMAP.map(([k, n]) => `<button type="button" class="keyrow" data-rk="${k}"><span>${n}</span><kbd class="key">${esc(prettyKey(g.input.keyFor(k)))}</kbd></button>`).join('')}</div>`;
    return `<p class="lede">Keys can be changed below. On a phone or tablet a joystick and buttons appear on screen.</p>${groups}`
      + card('Change the keys', 'Click a key, then press the new one. The old key for it takes the new key’s job (a swap).', remap, `<div class="set"><div><small>Gamepad: ${g.input.pad.on ? 'connected.' : 'plug one in and press a button.'} Left stick moves, right stick looks, A interact, X jump, B cycle, Y tour, RB drone, LB camera, LT sprint, RT photo, Start pause.</small></div><div class="ctl-r"><button type="button" class="btn sm" id="rk-reset">Reset keys</button></div></div>`);
  },
  data(ui, g) {
    const p = g.progress, W = g.world;
    const hs = W.landmarks.filter((l) => l.kind === 'hostel');
    const stats = [[`${p.discovered.size}/${W.landmarks.length}`, 'places found'], [`${hs.filter((l) => p.discovered.has(l.id)).length}/${hs.length}`, 'hostels visited'], [`${p.ach.size}/${ACHIEVEMENTS.length}`, 'achievements'], [rupees(p.coins), 'cash'], [p.stats.meals || 0, 'mess meals'], [p.stats.lectures || 0, 'lectures']];
    return `<p class="lede">Your progress, look, settings and best times are saved in this browser automatically, every couple of minutes and whenever you change something. There is no save button to press.</p>`
      + card('So far', '', `<div class="prog-row">${stats.map(([v, l]) => `<div><b>${v}</b><small>${l}</small></div>`).join('')}</div>`)
      + card('Back up or move your progress', 'A backup is a small file with everything above. Use it to keep a copy, or to carry your game to another browser or computer, for example between the online preview and the copy you run with launch.bat (each keeps its own progress).',
        row('Export a backup', 'Downloads a .json file.', '<button type="button" class="btn sm" id="save-export">Export backup…</button>'),
        row('Import a backup', 'Replaces the progress in this browser and reloads.', '<button type="button" class="btn sm" id="save-import">Import backup…</button>'))
      + card('Start over', '', `<div class="set" id="resetbox"><div><b>Reset progress</b><small>Erases discoveries, money, marks and achievements. Your settings stay.</small></div><div class="ctl-r"><button type="button" class="btn sm danger" id="reset">Reset progress…</button></div></div>`);
  },
  about(ui, g) {
    const src = [
      'Campus boundary, roads, lakes, sports grounds and names: OpenStreetMap contributors (ODbL).',
      'Building footprints: Overture Maps Foundation, which merges OpenStreetMap with Google Open Buildings and Microsoft ML building footprints. Heights are estimated.',
      'Tree cover: © ESA WorldCover project 2021 / contains modified Copernicus Sentinel data (CC BY 4.0). Trees stand where the satellite classification shows tree cover.',
      'Ground colour: Sentinel-2 cloudless, https://s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2024, CC BY-NC-SA 4.0).',
      'Hills and slopes: AWS Terrain Tiles (SRTM / NASADEM elevation).',
      'Road layout ideas checked against IIT Guwahati’s campus master plans; only a few positions are used and the plans are not included.',
      'Films: IIT Guwahati’s own videos, streamed through YouTube’s embedded player (not copied).',
      'Everything else (models, murals, signs, the campus crest, all the music and sound) was made for this game. The crest is an original design, not the institute’s emblem, and no brand names or logos are used.',
      'Built with three.js (© three.js authors, MIT License). Fonts: Hind and Teko (SIL Open Font License), from Google Fonts.',
    ];
    return `<div class="about-grid">`
      + `<div>${card('IITG 3D', '', `<div class="set stack"><div><b>${VERSION_LABEL}</b><small>Version ${VERSION}. An unofficial fan project, not affiliated with IIT Guwahati.</small></div></div>`, `<div class="set"><div><b>Created by ${AUTHOR}</b><small>${CONTACT}</small></div></div>`, `<div class="set"><div><b>Licence: ${LICENCE}</b><small>© 2026 ${AUTHOR}. The game’s code is free to use, copy and change under the ${LICENCE} licence. The map data and the ground picture keep their own licences (listed on the right), and the ground picture is for non-commercial use.</small></div></div>`, `<div class="set"><div><b>Something wrong?</b><small>Opens your email app with the details filled in, and copies them.</small></div><div class="ctl-r"><button type="button" class="btn sm" id="bug-report">Report a bug</button></div></div>`)}</div>`
      + `<div>${card('Where the data comes from', '', `<ul class="srclist">${src.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`)}</div></div>`;
  },
};

// ------------------------------------------------------------ wiring
function wire(pane, ui, g) {
  const S = S_OF(g), A = g.audio;
  const again = () => openPause(ui);
  const save = () => g.progress.save();
  pane.querySelectorAll('[data-time]').forEach((b) => (b.onclick = () => { g.clock.set(+b.dataset.time); again(); }));
  const SEG = {
    speed: (v) => { g.clock.speedId = v; },
    weather: (v) => { g.weather.setMode(v); },
    crowd: (v) => { S.crowd = +v; save(); ui.toast('Reload the page to change how many people are on campus.', 'info'); },
    relaxed: (v) => { S.relaxed = v === 'true'; save(); },
    quality: (v) => { S.quality = v; save(); g.applyQuality(v); },
    uiscale: (v) => { S.uiScale = +v; save(); ui.applyAccess(); },
  };
  pane.querySelectorAll('[data-seg]').forEach((el) => el.querySelectorAll('button').forEach((b) => (b.onclick = () => { g.audio.click?.(); SEG[el.dataset.seg]?.(b.dataset.v); again(); })));
  const SW = {
    sound: (on) => { if (A.muted === on) { A.toggleMute(); S.muted = A.muted; } save(); },
    bgm: (on) => { S.bgm = on; save(); g.updateMusic?.(true); },
    subs: (on) => { A.subtitles = on; S.subtitles = on; save(); },
    cb: (on) => { S.cb = on; save(); ui.applyAccess(); },
    hc: (on) => { S.hc = on; save(); ui.applyAccess(); },
    calm: (on) => { S.calm = on; save(); ui.applyAccess(); },
    hints: (on) => { if (on !== ui.keysVisible) ui.toggleKeys(); },
  };
  pane.querySelectorAll('[data-sw]').forEach((el) => (el.onchange = () => { SW[el.dataset.sw]?.(el.checked); }));
  const SL = {
    vol: (v) => { A.setVolume(v); S.volume = v; save(); return `${Math.round(v * 100)}%`; },
    fov: (v) => { S.fov = v; g.camera.fov = v; g.camera.updateProjectionMatrix(); save(); return `${v}°`; },
  };
  for (const k of ['music', 'sfx', 'amb', 'ui', 'voice']) SL[`ch-${k}`] = (v) => { A.setChannel(k, v); (S.vol ||= {})[k] = v; save(); return `${Math.round(v * 100)}%`; };
  pane.querySelectorAll('[data-sl]').forEach((el) => (el.oninput = () => {
    const v = +el.value, min = +el.min, max = +el.max;
    el.style.setProperty('--v', `${pct(v, min, max)}%`);
    const out = SL[el.dataset.sl]?.(v);
    if (out != null) el.parentElement.querySelector('output').textContent = out;
  }));
  // rebinding
  pane.querySelectorAll('[data-rk]').forEach((b) => (b.onclick = () => {
    b.classList.add('listening'); b.querySelector('kbd').textContent = 'press a key…';
    g.input.capture = (code) => { if (code !== 'Escape') { g.input.bind(b.dataset.rk, code); S.keys = { ...g.input.remap }; save(); } again(); };
  }));
  const rk = $('rk-reset'); if (rk) rk.onclick = () => { g.input.remap = {}; S.keys = {}; save(); again(); };
  // backup
  const ex = $('save-export');
  if (ex) ex.onclick = () => {
    g.progress.save();
    saveFile(`IITG3D-backup-${new Date().toISOString().slice(0, 10)}.json`, localStorage.getItem('iitg3d.save.v1') || '{}').then((res) => { if (res === 'unavailable') ui.toast('Saving files is not available here. Your progress is still kept in this browser.', 'warn'); });
  };
  const im = $('save-import');
  if (im) im.onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => { try { const t = await inp.files[0].text(); const o = JSON.parse(t); if (!o || typeof o !== 'object') throw new Error('bad'); localStorage.setItem('iitg3d.save.v1', t); ui.toast('Backup loaded. Reloading…', 'info'); setTimeout(() => location.reload(), 600); } catch { ui.toast('That file is not an IITG 3D backup.', 'warn'); } };
    inp.click();
  };
  const rs = $('reset');
  if (rs) rs.onclick = () => {
    $('resetbox').innerHTML = '<div><b>Erase your progress?</b><small>Discoveries, money, marks and achievements go back to the start.</small></div><div class="ctl-r"><button type="button" class="btn sm danger" id="reset-yes">Erase</button><button type="button" class="btn sm" id="reset-no">Keep</button></div>';
    $('reset-yes').onclick = () => { g.progress.reset(); ui.toast('Progress reset', 'info'); again(); };
    $('reset-no').onclick = again;
  };
  const bug = $('bug-report');
  if (bug) bug.onclick = () => {
    const P = g.player.pos, c = g.clock;
    const body = `Describe what went wrong:\n\n\n---\nVersion: ${VERSION}\nWhere: ${g.locName || ''} (x ${P.x.toFixed(1)}, z ${P.z.toFixed(1)})\nTime: ${c.dayName} ${c.hour.toFixed(2)} h · mode: ${g.mode} · weather: ${g.weather.state.name}\nGraphics: ${g.quality}\nBrowser: ${navigator.userAgent}`;
    try { navigator.clipboard?.writeText(body); } catch { /* ignore */ }
    window.open(`mailto:${CONTACT}?subject=${encodeURIComponent('IITG 3D bug report')}&body=${encodeURIComponent(body)}`);
    ui.toast('Opening your email app. The details were also copied to your clipboard.', 'info', 'Report a bug');
  };
}

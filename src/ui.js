import { OPTIONS, PRESETS, DEFAULT_LOOK } from './avatar.js';
import { ACHIEVEMENTS, rupees, LOAN_LIMIT, CREDIT_LIMIT } from './progress.js';
import { KIND_COLOR } from './scene/props.js';
import { TIME_PRESETS, formatTime } from './scene/sky.js';
import { ELEV0 } from './world.js';
import { fmtDist, saveFile } from './util.js';
import { openPause } from './menu.js';

const $ = (id) => document.getElementById(id);
const fmtTimeShort = (h) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`; };
const KIND_NAME = { hostel: 'Hostel', academic: 'Academic', admin: 'Administration', culture: 'Culture', sports: 'Sports', food: 'Food & hangouts', nature: 'Lakes & parks', service: 'Services', residential: 'Residential' };
const MODE = {
  walk: ['On foot', '#5b7f3a'], fly: ['Flying', '#2f8fb0'], bike: ['Bicycle', '#c89b3c'], bus: ['Campus bus', '#b3262f'],
  drone: ['Drone', '#8fb4d8'], custom: ['Character', '#c89b3c'], swim: ['Swimming', '#2f8fb0'], drive: ['Driving', '#c62828'],
  boat: ['Rowing boat', '#2f8fb0'], camera: ['Camera', '#e3b85a'], tour: ['Campus tour', '#c89b3c'], ride: ['Passenger', '#2e7d4f'], lift: ['On the carrier', '#c89b3c'],
};
const KEYS = {
  walk: [['WASD', 'Move'], ['Mouse', 'Look (click to lock)'], ['E', 'Interact / enter'], ['I', 'Info about this place'], ['O', 'Phone (OneStop)'], ['Shift', 'Sprint'], ['Space', 'Jump'], ['F', 'Fly'], ['B', 'Bicycle'], ['T', 'Campus tour'], ['G', 'Drone'], ['K', 'Camera'], ['1-4', 'Wave / dance / cheer / clap'], ['Tab', 'Campus planner'], ['M', 'Map'], ['J', 'Journal'], ['P', 'Character'], ['F1', 'Game guide'], ['H', 'Hide help']],
  fly: [['WASD', 'Fly'], ['Space / C', 'Up / down'], ['Shift', 'Boost'], ['F', 'Land'], ['M', 'Map'], ['H', 'Hide help']],
  swim: [['WASD', 'Swim'], ['Shift', 'Swim fast'], ['H', 'Hide help']],
  bike: [['W / S', 'Pedal / brake'], ['A / D', 'Steer'], ['Shift', 'Pedal hard'], ['R', 'Bell'], ['I', 'Info'], ['V', 'Camera'], ['B / E', 'Get off'], ['Y', 'Guided tour'], ['L', 'Race: late for class / mess'], ['H', 'Hide help']],
  bus: [['V', 'Camera view'], ['Mouse', 'Look around'], ['X', 'Next stop'], [']', 'Bus speed'], ['R', 'Horn'], ['E / T', 'Get off'], ['H', 'Hide help']],
  drone: [['WASD', 'Fly'], ['Mouse', 'Turn / gimbal'], ['Space / C', 'Up / down'], ['Q / E', 'Rotate'], ['Click / Enter', 'Photo'], ['R', 'Record video'], ['V', 'FPV / 3rd person'], ['X', 'Return home'], ['G', 'Land & exit'], ['H', 'Hide help']],
  drive: [['W / S', 'Drive / brake'], ['A / D', 'Steer'], ['I', 'Info'], ['Space', 'Handbrake'], ['Q', 'Siren'], ['R', 'Horn'], ['V', 'Camera'], ['E', 'Get out (brakes first)'], ['H', 'Hide help']],
  boat: [['W / S', 'Row / throttle'], ['A / D', 'Turn'], ['I', 'Info'], ['E', 'Get out (at the jetty or on any shore)'], ['H', 'Hide help']],
  ride: [['Mouse', 'Look around'], ['E', 'Get off'], ['H', 'Hide help']],
  lift: [['Mouse', 'Look around'], ['E', 'Hop off'], ['H', 'Hide help']],
  tour: [['[ / ]', 'Slower / faster'], ['Space', 'Pause'], ['X', 'Next stop'], ['V', 'Camera view'], ['Mouse', 'Look around'], ['Wheel', 'Zoom'], ['E / T', 'End the tour'], ['H', 'Hide help']],
  camera: [['Mouse', 'Frame the shot'], ['Wheel', 'Zoom (field of view)'], ['Click / Enter', 'Take a photo'], ['F', 'Filter'], ['[ / ]', 'Time of day'], ['R', 'Start / stop video'], ['WASD', 'Shuffle'], ['K / Esc', 'Put the camera away']],
};
const ORDERS = [['Food delivery', 'Chicken biryani', 180, 60], ['Food delivery', 'Veg thali', 120, 55], ['Tiffin service', 'Masala dosa', 80, 40], ['Tiffin service', 'Momos (8)', 90, 35],
  ['Pizza Corner', 'Paneer tikka pizza', 260, 70], ['Pizza Corner', 'Garlic bread', 110, 30], ['Grocery delivery', 'Noodles + milk', 70, 25], ['Grocery delivery', 'Notebook & pens', 60, 0]];
const prettyKey = (c) => (!c ? '—' : c.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('Space', 'Space'));
const TIPS = ['Press T for a campus tour - by bus, on foot, by cycle or by drone.', 'Press E near any building door to go inside. Every building can be entered.', 'Borrow any cycle from a stand with E, or press B for your own.', "Tab opens the planner: today's timetable, events, jobs and food delivery.", 'Hungry? Eat at your hostel mess, grab chai at a tapri, or order on your phone from the planner.', 'The Main Gate is open day and night; KV and Khokha gates close at 10 pm.', 'Press Q to show the way to your current objective.', 'K takes out your camera: F changes the filter, [ and ] change the time of day.', 'Stand next to a student on a cycle and press E to ask for a lift.', 'Rent a scooty, scooter or motorbike at any cycle shop.', 'Feed the campus dogs and cats - they will follow you for a while.', 'Late for class? Press L for a race against the clock.', 'At sunset the egrets fly home over the campus - and the ducks waddle back to their house by the lake.', 'Swap into a football, tennis or volleyball game in the evening by walking up to the court.'];
const OVERLAYS = ['map', 'custom', 'journal', 'pause', 'guide', 'planner', 'tourpick', 'whatsnew', 'phone'];

export class UI {
  constructor(game) {
    this.g = game;
    this.toastEl = $('toasts');
    this.cardTimer = 0;
    this.miniT = 0;
    $('weather-button').onclick = () => { this.g.input.exitLock(); this.openPlanner(true); };
    $('getout').onclick = () => this.g.getOut();
    this.keysVisible = true;
    this.lastMode = '';
    this.buildTape();
    this.touch = matchMedia('(pointer: coarse)').matches;
  }

  // ------------------------------------------------------------ loading / title
  loading(frac, msg) {
    $('loadbar').firstElementChild.style.width = `${Math.round(frac * 100)}%`;
    $('loadmsg').textContent = msg;
    // a useful tip while you wait
    if (!this._tipT) {
      let i = Math.floor(Math.random() * TIPS.length);
      const show = () => { const el = $('loadtip'); if (el) el.textContent = `Tip: ${TIPS[i++ % TIPS.length]}`; };
      show(); this._tipT = setInterval(show, 3500);
    }
  }
  ready(stats) {
    $('loadbar').hidden = true; $('loadmsg').hidden = true;
    clearInterval(this._tipT); if ($('loadtip')) $('loadtip').hidden = true;
    // without the local server the films on the hall screens, YouTube and real websites on the PCs cannot work: say so
    if ($('servnote') && !window.__PROXY__) { $('servnote').hidden = false; $('servnote').innerHTML = '<b>Preview mode.</b> Films in the halls, YouTube and websites on the Computer Centre PCs need the game started with <b>launch.bat</b> (double-click it in the game folder), then <a href="http://localhost:8871/" target="_blank" rel="noopener" style="color:#e3b85a">open the full version</a>.'; }
    $('b-news').onclick = () => { $('whatsnew').hidden = false; };
    $('b-guide').onclick = () => { this.g.gameGuide.open(); };
    $('whatsnew-close').onclick = () => { $('whatsnew').hidden = true; };
    $('menu').hidden = false;
    $('facts').innerHTML = stats.map(([v, l]) => `<div><b>${v}</b><small>${l}</small></div>`).join('');
    const p = this.g.progress;
    if (p.discovered.size) {
      const n = $('savednote');
      n.hidden = false;
      n.textContent = `Welcome back: ${p.discovered.size} landmarks discovered, ${rupees(p.coins)} in your wallet.`;
    }
    $('b-start').focus();
  }
  showTitle(v) { $('title').hidden = !v; $('hud').hidden = v; }

  // ------------------------------------------------------------ HUD
  buildTape() {
    const strip = $('strip');
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    let html = '';
    for (let a = -360; a <= 720; a += 15) {
      const d = ((a % 360) + 360) % 360;
      const l = labels[d];
      html += `<span class="${d === 0 ? 'n' : l ? 'c' : ''}">${l || (d % 45 === 0 ? d : '·')}</span>`;
    }
    strip.innerHTML = html;
  }

  setMode(mode) {
    if (mode === this.lastMode) return;
    this.lastMode = mode;
    const [name, col] = MODE[mode] || MODE.walk;
    $('modename').textContent = name;
    $('modedot').style.background = col;
    const ks = [...(KEYS[mode] || KEYS.walk)];
    // one row for N: it steps through the time of day; Shift + N opens the time & weather panel
    ks.splice(Math.max(0, ks.length - 1), 0, [prettyKey(this.g.input.keyFor('KeyN')), 'Time of day']);
    $('keys').innerHTML = ks.map(([k, v]) => `<kbd>${k}</kbd>${v === 'Time of day' ? `<span>Time of day <button class="help-weather" id="help-weather" title="Time and weather panel (Shift + ${prettyKey(this.g.input.keyFor('KeyN'))})">weather…</button></span>` : `<span>${v}</span>`}`).join('');
    $('help-weather').onclick = () => { this.g.input.exitLock(); this.openPlanner(true); };
    $('keys').hidden = !this.keysVisible;
  }
  toggleKeys() { this.keysVisible = !this.keysVisible; $('keys').hidden = !this.keysVisible; }

  hud({ loc, heading, y, hour, day, weather, speed, alt, mode }) {
    $('locname').textContent = loc;
    const ck = `${day ? day.slice(0, 3) + ' ' : ''}${formatTime(hour)}${weather ? ' · ' + weather : ''}`;
    if ($('clock').textContent !== ck) $('clock').textContent = ck;
    $('elev').textContent = `${Math.round(y + ELEV0)} m above sea level`;
    const W = 40, per = 15;
    const px = ((heading + 360) / per) * W; // strip starts at -360 deg
    $('strip').style.transform = `translateX(${(this.tapeW ||= $('tape').clientWidth) / 2 - px - W / 2}px)`;
    const sp = $('speedo');
    if (mode === 'bike' || mode === 'fly' || mode === 'bus') {
      sp.hidden = false;
      const kmh = Math.round(Math.abs(speed) * 3.6);
      sp.innerHTML = `<div><b>${kmh}</b><small>km/h</small></div>` + (mode === 'fly' ? `<div><b>${Math.round(alt)}</b><small>m above ground</small></div>` : '');
    } else sp.hidden = true;
    const p = this.g.progress;
    $('c-lm').textContent = `${p.discovered.size}/${this.g.world.landmarks.length}`;
    const hs = this.g.world.landmarks.filter((l) => l.kind === 'hostel');
    $('c-chai').textContent = `${hs.filter((l) => p.discovered.has(l.id)).length}/${hs.length}`;
  }

  /** the frame-rate counter (Display settings); null hides it */
  fpsText(text) {
    const el = $('fps');
    if (text == null) { el.hidden = true; return; }
    el.hidden = false;
    if (el.textContent !== text) el.textContent = text;
  }

  /** the Get off / Get out button in a vehicle (the E key does the same); no label hides it */
  getOutButton(label) {
    const b = $('getout');
    if (!label) { if (!b.hidden) b.hidden = true; return; }
    if (b.hidden) b.hidden = false;
    const html = label + ' <kbd>E</kbd>';
    if (b.innerHTML !== html) b.innerHTML = html;
  }

  prompt(html) {
    const el = $('prompt');
    if (!html) { el.hidden = true; return; }
    el.hidden = false;
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  /** keep the prompt next to the thing you can use (ndc = projected point, or null for the default spot) */
  anchorPrompt(ndc) {
    const el = $('prompt');
    if (!ndc || this.touch) { el.style.left = ''; el.style.top = ''; el.style.bottom = ''; el.classList.remove('anchored'); return; }
    const x = (ndc.x * 0.5 + 0.5) * window.innerWidth, y = (-ndc.y * 0.5 + 0.5) * window.innerHeight;
    el.classList.add('anchored');
    el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(Math.max(90, Math.min(window.innerHeight - 160, y)))}px`; el.style.bottom = 'auto';
  }

  toast(msg, kind = 'info', title = '') {
    const el = document.createElement('div');
    el.className = `toast chip-panel ${kind}`;
    el.innerHTML = (title ? `<b>${title}</b>` : '') + msg;
    this.toastEl.prepend(el);
    while (this.toastEl.children.length > 4) this.toastEl.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 4700);
  }
  /** Not enough cash or card balance: offer to borrow from a friend (then `retry` the purchase). */
  payShort(n, why, retry) {
    const P = this.g.progress;
    document.getElementById('paydlg')?.remove();
    const need = Math.ceil((n - P.coins - P.bank) / 500) * 500;
    const can = P.debt + need <= LOAN_LIMIT;
    const friend = P.lender || 'a friend';
    const el = document.createElement('div');
    el.id = 'paydlg'; el.className = 'chip-panel';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Not enough money');
    el.innerHTML = `<h3>Not enough money</h3><p>${why ? `${why[0].toUpperCase()}${why.slice(1)}` : 'This'} costs <b>${rupees(n)}</b>. You have ${rupees(P.coins)} cash and ${rupees(P.bank)} of credit card limit left.</p>` +
      (can ? `<button class="btn" data-k="1"><kbd>1</kbd> Borrow ${rupees(need)} from ${friend} and pay</button>` : `<p class="dim">You already owe ${P.lender} ${rupees(P.debt)}. Pay that back first (ATM or Tab → Wallet), or earn some money with a campus job.</p>`) +
      `<button class="btn" data-k="esc"><kbd>Esc</kbd> Cancel</button>`;
    document.body.appendChild(el);
    this.g.input.exitLock?.();
    this.g.audio.bump?.();
    const close = () => { el.remove(); window.removeEventListener('keydown', key, true); };
    const ok = () => { close(); if (P.borrow(need) > 0 && retry) retry(); else if (!retry) this.toast(`Borrowed ${rupees(need)}. Try again now.`, 'info'); };
    const key = (e) => {
      if (e.code === 'Digit1' && can) { e.preventDefault(); e.stopImmediatePropagation(); ok(); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    };
    window.addEventListener('keydown', key, true);
    el.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { this.g.audio.click(); if (b.dataset.k === '1') ok(); else close(); }));
  }
  discovered(lm, n, total) { this.toast(`${lm.name} · ${n}/${total}`, 'disc', 'Discovered'); }
  achievement(a) { this.toast(a.desc, 'gold', `Achievement: ${a.name}`); }

  card(title, text, kind, step = '', seconds = 14) {
    $('card').hidden = false;
    $('card-title').textContent = title;
    $('card-text').textContent = text;
    $('card-kind').textContent = KIND_NAME[kind] || '';
    $('card-step').textContent = step;
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => this.hideCard(), seconds * 1000);
  }
  hideCard() { $('card').hidden = true; }

  // ------------------------------------------------------------ bus / tours / challenge / drone
  busPanel(show, bus) {
    $('buspanel').hidden = !show;
    if (!show) return;
    $('bus-view').onclick = () => bus.nextView();
    $('bus-skip').onclick = () => bus.skip();
    $('bus-speed').onclick = () => { bus.speedMul = bus.speedMul >= 4 ? 1 : bus.speedMul * 2; };
    $('bus-exit').onclick = () => this.g.setMode('walk');
    this.busNext(bus.stops[(bus.stopIdx + 1) % bus.stops.length].name, 0, bus.stops.length);
  }
  busNext(name, visited, n) {
    $('bus-next').textContent = name;
    $('bus-bar').style.width = `${(visited / n) * 100}%`;
  }
  busTick(bus, next) {
    const L = bus.path.length;
    let rem = next.s - bus.s; if (rem < -1) rem += L;
    $('bus-label').textContent = bus.state === 'drive' ? 'Next stop' : 'Now at';
    $('bus-next').textContent = bus.state === 'drive' ? next.name : bus.stops[bus.stopIdx].name;
    $('bus-meta').textContent = bus.state === 'drive' ? `${fmtDist(Math.max(0, rem))} · ${Math.round(bus.v * 3.6)} km/h` : 'Doors open';
    $('bus-bar').style.width = `${(bus.visited / bus.stops.length) * 100}%`;
    $('bus-speed').firstChild.textContent = `×${bus.speedMul} `;
  }
  // ------------------------------------------------------------ campus tour on foot / cycle / drone
  openTourPick() {
    const el = $('tourpick');
    el.hidden = false;
    this.g.input.exitLock();
    const go = (k) => { el.hidden = true; window.removeEventListener('keydown', key); this.g.startTour(k); };
    const key = (e) => { const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code); if (i >= 0 && !el.hidden) { e.preventDefault(); go(['bus', 'walk', 'bike', 'drone'][i]); } if (el.hidden) window.removeEventListener('keydown', key); };
    window.addEventListener('keydown', key);
    el.querySelectorAll('[data-tour]').forEach((b) => (b.onclick = () => go(b.dataset.tour)));
    $('tourpick-close').onclick = () => { el.hidden = true; window.removeEventListener('keydown', key); };
  }
  autoTourPanel(show, t) {
    $('autotour').hidden = !show;
    if (!show) return;
    $('at-title').textContent = { walk: 'Walking tour', bike: 'Cycle tour', drone: 'Drone tour' }[t.kind];
    $('at-slow').onclick = () => t.faster(-1);
    $('at-fast').onclick = () => t.faster(1);
    $('at-view').onclick = () => t.nextView();
    $('at-skip').onclick = () => t.skip();
    $('at-pause').onclick = () => t.togglePause();
    $('at-exit').onclick = () => this.g.setMode('walk');
  }
  autoTourNext(t, next) { $('at-next').textContent = next.name; }
  autoTourTick(t, next) {
    const L = t.cur.path.length;
    let rem = next.s - t.s; if (rem < -1) rem += L;
    const at = t.state === 'dwell';
    $('at-label').textContent = at ? 'Now at' : 'Next stop';
    $('at-next').textContent = at ? t.cur.stops[t.stopIdx].name : next.name;
    const eta = t.v > 0.3 ? Math.round(Math.max(0, rem) / Math.max(t.v, 0.5)) : null;
    $('at-meta').textContent = at ? 'Listen, look around - X to move on' : `${fmtDist(Math.max(0, rem))}${eta != null ? ` · ${eta < 60 ? eta + ' s' : Math.round(eta / 60) + ' min'}` : ''} · ${Math.round(t.v * 3.6)} km/h${t.paused ? ' · paused' : ''}`;
    $('at-bar').style.width = `${(t.visited / t.cur.stops.length) * 100}%`;
    $('at-speed').textContent = t.speedInfo[1];
  }

  tourPanel(show, info) {
    $('tourpanel').hidden = !show;
    if (!show) return;
    $('tour-title').textContent = info.title;
    $('tour-stop').textContent = info.stop;
    $('tour-meta').textContent = `Stop ${info.i} of ${info.n}`;
    $('tour-end').onclick = () => this.g.bikeTour.stop('Tour ended');
    this.tourN = info;
  }
  tourTick(dist) { if (this.tourN) $('tour-meta').textContent = `Stop ${this.tourN.i} of ${this.tourN.n} · ${dist} to go`; }
  challenge(show, dest, limit, best, title = 'Late for class!') {
    $('challenge').hidden = !show;
    if (!show) return;
    $('ch-title').textContent = title;
    $('ch-meta').textContent = `Reach ${dest} in time${best ? ` · best ${best} s` : ''}`;
    this.challengeTick(limit);
  }
  challengeTick(t) {
    const el = $('ch-time');
    el.textContent = t.toFixed(1);
    el.classList.toggle('low', t < 10);
  }
  droneHud(show) {
    $('dronehud').hidden = !show;
  }
  droneTick(d, agl, dist) {
    const fpv = d.view === 'fpv';
    $('dronehud').querySelector('.frame').hidden = !fpv;
    $('dronehud').querySelector('.cross').hidden = !fpv;
    const [lat, lon] = d.latLon();
    $('d-mode').textContent = `${fpv ? 'FPV' : '3rd person'} · ${this.g.input.down('ShiftLeft', 'ShiftRight') ? 'S-mode' : 'N-mode'}${d.rth ? ' · RTH' : ''}`;
    $('d-gps').textContent = `${lat.toFixed(5)}° N  ${lon.toFixed(5)}° E`;
    const b = Math.max(0, Math.round(d.battery * 100));
    $('d-batt').textContent = `▮ ${b}%`;
    $('d-batt').classList.toggle('low', b < 20);
    $('d-alt').textContent = `H ${agl.toFixed(1)} m`;
    $('d-asl').textContent = `ASL ${Math.round(d.pos.y + ELEV0)} m`;
    $('d-vs').textContent = `VS ${d.vel.y.toFixed(1)} m/s`;
    $('d-spd').textContent = `${Math.round(Math.hypot(d.vel.x, d.vel.z) * 3.6)} km/h`;
    $('d-dist').textContent = `D ${Math.round(dist)} m`;
    const hdg = (((-d.yaw * 180) / Math.PI + 180) % 360 + 360) % 360;
    $('d-hdg').textContent = `HDG ${String(Math.round(hdg)).padStart(3, '0')}°`;
  }

  // ------------------------------------------------------------ minimap
  prepareMaps(groundImg) {
    this.groundImg = groundImg;
    const legend = $('legend');
    legend.innerHTML = Object.entries(KIND_NAME).map(([k, v]) => `<span><i style="background:${KIND_COLOR[k]}"></i>${v}</span>`).join('') +
      '<span><i style="background:#fff"></i>You</span><span><i style="background:#ffc84a"></i>Tour target</span>';
  }

  worldToImg(x, z) {
    const [gx0, gy0, gx1, gy1] = this.g.world.data.ground.bounds;
    const im = this.groundImg;
    return [((x - gx0) / (gx1 - gx0)) * im.width, ((gy1 - -z) / (gy1 - gy0)) * im.height];
  }

  minimap(dt, pos, heading, extra) {
    this.miniT -= dt;
    if (this.miniT > 0) return;
    this.miniT = 1 / 20;
    const c = $('minimap'), g = c.getContext('2d');
    const S = c.width, R = S / 2;
    const span = extra.span || 380; // metres across
    const [ix, iy] = this.worldToImg(pos.x, pos.z);
    const im = this.groundImg;
    const pxPerM = im.width / (this.g.world.data.ground.bounds[2] - this.g.world.data.ground.bounds[0]);
    const srcW = span * pxPerM;
    g.save();
    g.clearRect(0, 0, S, S);
    g.beginPath(); g.arc(R, R, R, 0, 7); g.clip();
    g.fillStyle = '#16302f'; g.fillRect(0, 0, S, S);
    g.drawImage(im, ix - srcW / 2, iy - srcW / 2, srcW, srcW, 0, 0, S, S);
    const toMini = (x, z) => { const [a, b] = this.worldToImg(x, z); return [R + ((a - ix) / srcW) * S, R + ((b - iy) / srcW) * S]; };
    // route
    if (extra.route && extra.route.length > 1) {
      g.strokeStyle = '#ffc84a'; g.lineWidth = 5; g.lineJoin = 'round'; g.setLineDash([10, 8]);
      g.beginPath();
      extra.route.forEach(([x, z], i) => { const [a, b] = toMini(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
      g.stroke(); g.setLineDash([]);
    }
    const disc = this.g.progress.discovered;
    for (const l of this.g.world.landmarks) {
      const [a, b] = toMini(l.wx, l.wz);
      if (a < -10 || b < -10 || a > S + 10 || b > S + 10) continue;
      g.fillStyle = disc.has(l.id) ? KIND_COLOR[l.kind] || '#c89b3c' : 'rgba(40,40,40,0.8)';
      g.strokeStyle = '#f3ead7'; g.lineWidth = 2;
      g.beginPath(); g.arc(a, b, 8, 0, 7); g.fill(); g.stroke();
      if (!disc.has(l.id)) { g.fillStyle = '#f3ead7'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', a, b + 1); }
    }
    for (const m of extra.markers || []) {
      const [a, b] = toMini(m.x, m.z);
      const cbS = this.g.progress.settings.cb;
      g.fillStyle = cbS ? ({ '#b3262f': '#D55E00', '#c89b3c': '#E69F00', '#e3b85a': '#0072B2' }[m.color] || '#CC79A7') : m.color;
      if (m.star || cbS) {
        // shapes as well as colours: star = event, square = bus, diamond = your cycle
        g.beginPath();
        const rr = (m.r || 7) + 1;
        if (m.star) for (let k = 0; k < 10; k++) { const an = -Math.PI / 2 + (k / 10) * Math.PI * 2, q = k % 2 ? rr * 0.45 : rr; g.lineTo(a + Math.cos(an) * q, b + Math.sin(an) * q); }
        else if (m.color === '#b3262f') g.rect(a - rr * 0.8, b - rr * 0.8, rr * 1.6, rr * 1.6);
        else { g.moveTo(a, b - rr); g.lineTo(a + rr, b); g.lineTo(a, b + rr); g.lineTo(a - rr, b); }
        g.closePath(); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1.5; g.stroke();
      } else { g.beginPath(); g.arc(a, b, m.r || 7, 0, 7); g.fill(); }
    }
    if (extra.target) {
      let [a, b] = toMini(extra.target.x, extra.target.z);
      const dx = a - R, dy = b - R, d = Math.hypot(dx, dy);
      if (d > R - 14) { a = R + (dx / d) * (R - 14); b = R + (dy / d) * (R - 14); }
      g.fillStyle = '#ffc84a'; g.strokeStyle = '#1b1b1b'; g.lineWidth = 3;
      g.beginPath(); g.arc(a, b, 11, 0, 7); g.fill(); g.stroke();
    }
    // player arrow (heading measured from north, clockwise)
    g.translate(R, R); g.rotate((heading * Math.PI) / 180);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#b3262f'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -18); g.lineTo(12, 13); g.lineTo(0, 6); g.lineTo(-12, 13); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = '#f3ead7'; g.font = 'bold 22px Teko, sans-serif'; g.textAlign = 'center'; g.fillText('N', R, 26);
  }

  // ------------------------------------------------------------ big map
  /** zoomable, draggable campus map; click (without dragging) to travel */
  openMap() {
    $('map').hidden = false;
    const cv = $('bigmap');
    const g0 = this.g;
    const im = this.groundImg;
    const V = (this.mapView ||= { zoom: 1, cx: im.width / 2, cy: im.height / 2 });
    const dprOf = () => Math.min(2, devicePixelRatio || 1);
    const draw = () => {
      const r = cv.getBoundingClientRect();
      const dpr = dprOf();
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = r.width * dpr; cv.height = r.height * dpr; }
      const g = cv.getContext('2d');
      const base = Math.min(cv.width / im.width, cv.height / im.height);
      const s = base * V.zoom;
      const ox = cv.width / 2 - V.cx * s, oy = cv.height / 2 - V.cy * s;
      this.mapXf = { s, ox, oy };
      g.fillStyle = '#0d2123'; g.fillRect(0, 0, cv.width, cv.height);
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, ox, oy, im.width * s, im.height * s);
      const P = (x, z) => { const [a, b] = this.worldToImg(x, z); return [ox + a * s, oy + b * s]; };
      const bus = g0.busTour;
      if (bus.route) {
        g.strokeStyle = 'rgba(179,38,47,0.85)'; g.lineWidth = 3 * dpr; g.setLineDash([6 * dpr, 5 * dpr]);
        g.beginPath(); bus.route.pts.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); g.setLineDash([]);
      }
      const dot = (x, z, col, r = 5, ring = '#fff') => { const [a, b] = P(x, z); g.fillStyle = col; g.strokeStyle = ring; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(a, b, r * dpr, 0, 7); g.fill(); g.stroke(); return [a, b]; };
      const label = (a, b, t, strong = true) => {
        const w = g.measureText(t).width;
        g.fillStyle = strong ? 'rgba(12,24,26,0.82)' : 'rgba(12,24,26,0.55)';
        g.fillRect(a + 8 * dpr, b - 9 * dpr, w + 10 * dpr, 18 * dpr);
        g.fillStyle = strong ? '#f3ead7' : 'rgba(243,234,215,0.65)';
        g.fillText(t, a + 13 * dpr, b + 1 * dpr);
      };
      g.font = `600 ${12 * dpr}px Hind, "Segoe UI", sans-serif`; g.textBaseline = 'middle';
      // gates, shops, jobs, events
      for (const gt of g0.world.gates) if (gt.name) { const [a, b] = dot(gt.wx, gt.wz, '#7d1f1f', 5); if (V.zoom > 1.3) label(a, b, gt.name); }
      if (V.zoom > 1.8) for (const st of g0.stallsObj.stalls) { const [a, b] = dot(st.x, st.z, st.kind === 'pizzeria' ? '#8a3b1c' : '#e2702f', 3.5); if (V.zoom > 3) label(a, b, st.name, false); }
      if (g0.jobs.hospital) { const h = g0.jobs.bay; const [a, b] = dot(h.x, h.z, '#c62828', 6); if (V.zoom > 1.2) label(a, b, 'Ambulance duty (job)'); }
      if (g0.jobs.pizzeria) { const d = g0.jobs.pizzeria; const [a, b] = dot(d.x, d.z, '#8a3b1c', 6); if (V.zoom > 1.2) label(a, b, 'Pizza delivery (job)'); }
      const disc = g0.progress.discovered;
      for (const l of g0.world.landmarks) {
        const [a, b] = dot(l.wx, l.wz, KIND_COLOR[l.kind] || '#c89b3c', 5);
        if (V.zoom > 0.9 || l.kind !== 'hostel') label(a, b, l.name, disc.has(l.id));
      }
      for (const e of g0.events.defs) {
        if (!g0.events.isNear(e) && e.day !== g0.clock.weekday) continue;
        const p = e.place();
        const [a, b] = P(p.x, p.z);
        g.fillStyle = g0.events.isOn(e) ? '#ffd54a' : 'rgba(255,213,74,0.55)';
        g.beginPath(); for (let k = 0; k < 10; k++) { const an = (k / 10) * 6.28 - Math.PI / 2, rr = (k % 2 ? 5 : 12) * dpr; g.lineTo(a + Math.cos(an) * rr, b + Math.sin(an) * rr); } g.fill();
        label(a, b + 16 * dpr, `${e.name}${g0.events.isOn(e) ? ' · live' : ` · ${fmtTimeShort(e.from)}`}`);
      }
      const pp = g0.interior.active ? { x: g0.interior.outside.x, z: g0.interior.outside.z } : g0.player.pos;
      const [a, b] = P(pp.x, pp.z);
      g.fillStyle = '#fff'; g.strokeStyle = '#b3262f'; g.lineWidth = 3 * dpr;
      g.beginPath(); g.arc(a, b, 8 * dpr, 0, 7); g.fill(); g.stroke();
      $('map-zoom').textContent = `${Math.round(V.zoom * 100)}%`;
    };
    this.drawMap = draw;
    requestAnimationFrame(draw);
    let drag = null;
    cv.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, cx: V.cx, cy: V.cy, moved: false }; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      const dpr = dprOf(), s = this.mapXf.s;
      V.cx = drag.cx - (dx * dpr) / s; V.cy = drag.cy - (dy * dpr) / s;
      draw();
    };
    cv.onpointerup = (e) => {
      const wasDrag = drag && drag.moved;
      drag = null;
      if (wasDrag) return;
      const r = cv.getBoundingClientRect();
      const dpr = cv.width / r.width;
      const { s, ox, oy } = this.mapXf;
      const ixp = ((e.clientX - r.left) * dpr - ox) / s, iyp = ((e.clientY - r.top) * dpr - oy) / s;
      const [gx0, gy0, gx1, gy1] = g0.world.data.ground.bounds;
      const x = gx0 + (ixp / im.width) * (gx1 - gx0);
      const y = gy1 - (iyp / im.height) * (gy1 - gy0);
      // the gates stand ON the wall: a click on a gate (or anywhere within 60 m outside the wall) takes you just inside it
      const spot = { x, z: -y };
      const gate = g0.world.gates.find((q) => q.name && Math.hypot(q.wx - x, q.wz + y) < 40);
      if (gate) { spot.x = gate.wx; spot.z = gate.wz; }
      if (gate || !g0.world.insideCampus(x, -y)) {
        if (!gate && g0.world.distToBoundary(x, -y) > 60) { this.toast('That spot is outside the IITG campus wall.', 'warn'); return; }
        g0.world.clampToCampus(spot, 8);
      }
      this.closeAll();
      g0.fastTravel(spot.x, spot.z);
    };
    cv.onwheel = (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(), dpr = cv.width / r.width;
      const { s, ox, oy } = this.mapXf;
      const mx = ((e.clientX - r.left) * dpr - ox) / s, my = ((e.clientY - r.top) * dpr - oy) / s;
      const k = Math.pow(1.18, -Math.sign(e.deltaY));
      V.zoom = Math.max(0.8, Math.min(8, V.zoom * k));
      // keep the point under the cursor fixed
      const s2 = Math.min(cv.width / im.width, cv.height / im.height) * V.zoom;
      V.cx = mx - ((e.clientX - r.left) * dpr - cv.width / 2) / s2;
      V.cy = my - ((e.clientY - r.top) * dpr - cv.height / 2) / s2;
      draw();
    };
    $('map-in').onclick = () => { V.zoom = Math.min(8, V.zoom * 1.4); draw(); };
    $('map-out').onclick = () => { V.zoom = Math.max(0.8, V.zoom / 1.4); draw(); };
    $('map-me').onclick = () => { const p = g0.player.pos; const [a, b] = this.worldToImg(p.x, p.z); V.cx = a; V.cy = b; V.zoom = Math.max(V.zoom, 2.5); draw(); };
  }

  // ------------------------------------------------------------ campus planner (Tab)
  openPlanner(weatherFocus = false) {
    const g = this.g, c = g.clock;
    (g.progress.flags ||= {}).plannerSeen = true;
    $('planner').hidden = false;
    const fmt = (h) => fmtTimeShort(h);
    const week = g.events.week();
    const today = [
      ['7:30 – 9:30 AM', 'Breakfast at the hostel messes'], ['9:00 AM – 1:00 PM', c.weekend ? 'Weekend: sleep in, sports and markets' : 'Lectures (Lecture Hall Complex, Academic Complex)'],
      ['12:15 – 2:00 PM', 'Lunch at the messes · Food Court open'], ['2:00 – 5:00 PM', c.weekend ? 'Free time' : 'Labs and classes'],
      ['4:30 – 6:45 PM', 'Sports: cricket, football, basketball, volleyball, athletics'], ['5:00 – 9:00 PM', 'Club practice at the SAC (dance, music…)'],
      ['7:45 – 9:45 PM', 'Dinner at the messes'], ['9:30 PM – 1:00 AM', 'Central Library and night canteens'],
    ];
    const ev = week.map(({ d, dayName, on, today: td }) => `<div class="pl-ev ${on ? 'on' : ''}"><div><b>${d.name}</b><small>${td ? 'Today' : dayName} · ${fmt(d.from)} – ${fmt(d.to)} · ${d.where}</small></div><button class="btn" data-ev="${d.id}">${on ? 'Go now' : 'Skip to it'}</button></div>`).join('');
    const places = [['Your hostel', () => g.world.site(g.progress.profile.hostel)], ['Mess (your hostel)', () => g.world.site(g.progress.profile.hostel)], ['Lecture Hall Complex', () => g.world.site('lhc')], ['Central Library', () => g.world.site('library')],
      ['Cricket Ground', () => ({ ex: g.events.mainGround.cx, ez: g.events.mainGround.cz })], ['Student Activity Centre', () => g.world.site('sac')], ['Market Complex', () => g.world.site('shopping')], ['Food Court', () => g.world.site('foodcourt')], ['IITG Hospital', () => g.world.site('hospital')], ['View Point', () => { const l = g.world.landmark('viewpoint'); return l ? { ex: l.wx, ez: l.wz } : null; }],
      ['Computer Centre', () => { const l = g.world.landmark('computercentre'); return l ? { ex: l.wx, ez: l.wz } : null; }], ['Cafe Coffee Day', () => { const l = g.world.landmark('campuscafe'); return l ? { ex: l.wx, ez: l.wz } : null; }], ['Swimming Pool', () => { const l = g.world.landmark('pool'); return l ? { ex: l.wx, ez: l.wz } : null; }]];
    $('planner-body').innerHTML = `
      <div class="cols">
        <div class="group"><h3 class="sec">${c.dayName}, ${fmt(c.hour)}</h3>
          <div class="pl-today">${today.map(([t, w]) => `<div><small>${t}</small><span>${w}</span></div>`).join('')}</div>
          <h3 class="sec">Wallet</h3>
          <div class="pl-wallet"><span>Cash <b>${rupees(g.progress.coins)}</b></span><span>Credit card limit left <b>${rupees(g.progress.bank)}</b></span>${g.progress.debt ? `<span>Owe ${g.progress.lender} <b>${rupees(g.progress.debt)}</b></span>` : ''}</div>
          <div class="chips"><button class="chip" data-pay="cash" aria-pressed="${g.progress.payPref !== 'card'}">Pay with cash</button><button class="chip" data-pay="card" aria-pressed="${g.progress.payPref === 'card'}">Pay by card / UPI</button>${g.progress.debt < LOAN_LIMIT ? '<button class="chip" id="pl-borrow">Borrow ₹2,000 from a friend</button>' : ''}${g.progress.debt ? `<button class="chip" id="pl-repay">Pay back ${rupees(g.progress.debt)}</button>` : ''}</div>
          <h3 class="sec">Order on your phone · delivered to your hostel gate</h3>
          <div class="chips" id="pl-order">${ORDERS.map(([b, item, price], i) => `<button class="chip" data-or="${i}">${b}: ${item} · ₹${price}</button>`).join('')}</div>
          <h3 class="sec">Campus jobs</h3>
          <div class="row"><button class="btn" id="pl-dom">Pizza delivery · Market Complex</button><button class="btn" id="pl-amb">Ambulance duty · IITG Hospital</button></div>
          <h3 class="sec">Quick travel</h3>
          <div class="chips">${places.map(([n], i) => `<button class="chip" data-pl="${i}">${n}</button>`).join('')}</div>
        </div>
        <div class="group"><h3 class="sec">This week's events</h3>${ev}
          <h3 class="sec" id="weather-controls" tabindex="-1">Time &amp; weather</h3>
          <div class="chips" id="pl-speed">${[['pause', 'Paused'], ['real', 'Real time'], ['x10', '×10'], ['x20', '×20'], ['x60', '×60']].map(([id, n]) => `<button class="chip" data-sp="${id}" aria-pressed="${c.speedId === id}">${n}</button>`).join('')}</div>
          <div class="chips">${[['auto', 'Auto (season)'], ['clear', 'Clear'], ['cloudy', 'Cloudy'], ['rain', 'Rain'], ['storm', 'Storm'], ['mist', 'Mist'], ['fog', 'Fog']].map(([id, n]) => `<button class="chip" data-wx="${id}" aria-pressed="${g.weather.mode === id}">${n}</button>`).join('')}</div>
        </div>
      </div>`;
    const body = $('planner-body');
    body.querySelectorAll('[data-ev]').forEach((b) => (b.onclick = () => { const d = g.events.defs.find((x) => x.id === b.dataset.ev); this.closeAll(); g.events.goTo(d); }));
    body.querySelectorAll('[data-pl]').forEach((b) => (b.onclick = () => { const s = places[+b.dataset.pl][1](); if (!s) return; this.closeAll(); g.fastTravel(s.ex + (s.nx || 0) * 5, s.ez + (s.nz || 0) * 5, true); }));
    body.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = () => { c.speedId = b.dataset.sp; this.openPlanner(); }));
    if (weatherFocus) { const section = $('weather-controls'); section.scrollIntoView({ block: 'center' }); section.focus({ preventScroll: true }); }
    body.querySelectorAll('[data-wx]').forEach((b) => (b.onclick = () => { g.weather.setMode(b.dataset.wx); this.openPlanner(true); }));
    body.querySelectorAll('[data-or]').forEach((b) => (b.onclick = () => { const [br, item, price, en] = ORDERS[+b.dataset.or]; if (g.transport.order(br, item, price, en)) this.closeAll(); }));
    body.querySelectorAll('[data-pay]').forEach((b) => (b.onclick = () => { g.progress.payPref = b.dataset.pay; g.progress.save(); this.openPlanner(); }));
    if ($('pl-borrow')) $('pl-borrow').onclick = () => { g.progress.borrow(2000); this.openPlanner(); };
    if ($('pl-repay')) $('pl-repay').onclick = () => { if (!g.progress.repay()) this.toast('Not enough money to pay it all back yet.', 'warn'); this.openPlanner(); };
    $('pl-dom').onclick = () => { const d = g.jobs.pizzeria; if (!d) return; this.closeAll(); g.fastTravel(d.x + 2, d.z + 2); };
    $('pl-amb').onclick = () => { const b = g.jobs.bay; if (!b) return; this.closeAll(); g.fastTravel(b.x + 2, b.z + 2); };
    $('planner-close').onclick = () => this.closeAll();
  }

  jobPanel(title, sub, meta, urgent) {
    const el = $('jobpanel');
    if (!title) { el.hidden = true; return; }
    el.hidden = false;
    const k = `${title}|${sub}|${meta}|${urgent}`;
    if (k === this._jk) return;
    this._jk = k;
    el.innerHTML = `<h4>${title}</h4><div class="big">${sub}</div><small class="${urgent ? 'urgent' : ''}">${meta}</small><div class="row"><button class="btn" id="job-end">End shift</button></div>`;
    $('job-end').onclick = () => this.g.jobs.end('Shift ended.');
  }
  flash() { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 0.85; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; }); }
  rec(on) { $('rec').hidden = !on; }
  recTime(s) { $('rec-t').textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
  camUI(on) { $('camui').hidden = !on; $('hud').classList.toggle('camera-mode', on); }
  camZoom(z, info = '') { $('cam-zoom').textContent = `${z.toFixed(1)}×${info ? ' · ' + info : ''}`; }

  // ------------------------------------------------------------ journal
  openJournal() {
    $('journal').hidden = false;
    const p = this.g.progress;
    const W = this.g.world;
    $('stats').innerHTML = [
      [p.rank.name, `${p.xp} XP`], [rupees(p.coins), 'cash'], [rupees(p.bank), `credit limit left (of ${rupees(CREDIT_LIMIT)})`], ...(p.debt ? [[rupees(p.debt), `owed to ${p.lender}`]] : []), [p.cpi ?? '–', 'CPI'], [`${Math.round(p.energy)}%`, 'energy'],
      [`${p.discovered.size}/${W.landmarks.length}`, 'landmarks'], [`${W.landmarks.filter((l) => l.kind === 'hostel' && p.discovered.has(l.id)).length}/${W.landmarks.filter((l) => l.kind === 'hostel').length}`, 'hostels visited'],
      [`${p.ach.size}/${ACHIEVEMENTS.length}`, 'achievements'], [p.stats.meals || 0, 'mess meals'], [p.stats.lectures || 0, 'lectures'],
      [fmtDist(p.stats.bikeDist || 0), 'cycled'], [p.seen.size, 'animals seen'],
    ].map(([v, l]) => `<div><b>${v}</b><small>${l}</small></div>`).join('');
    // goals with progress bars
    const hs = W.landmarks.filter((l) => l.kind === 'hostel');
    const bar = (label, n, of) => `<div class="goal"><span>${label}</span><div class="bar"><i style="width:${Math.round((Math.min(n, of) / of) * 100)}%"></i></div><small>${n} / ${of}</small></div>`;
    $('stats').insertAdjacentHTML('beforeend', `<div class="goals">${bar('Landmarks discovered', p.discovered.size, W.landmarks.length)}${bar('Hostels visited', hs.filter((l) => p.discovered.has(l.id)).length, hs.length)}${bar('Achievements', p.ach.size, ACHIEVEMENTS.length)}${bar('Campus tours (bus, walk, cycle, drone)', ['bus_tour', 'walk_tour', 'bike_tour', 'drone_tour'].filter((a) => p.ach.has(a)).length, 4)}${bar('Animals spotted', p.seen.size, 15)}${bar('Mess meals', p.stats.meals || 0, 20)}</div>`);
    const gal = this.g.capture.session.slice().reverse();
    $('gallery').innerHTML = gal.length ? gal.map((r, i) => `<figure>${r.kind === 'video' ? `<video src="${r.url}" muted playsinline></video>` : `<img src="${r.url}" alt="${r.subject || 'Campus photo'}">`}<figcaption>${r.subject || (r.kind === 'video' ? `Video · ${r.secs || '?'} s` : 'Photo')}<button data-dl="${i}">Download</button><button data-del="${i}">Delete</button></figcaption></figure>`).join('') : '<p class="saved-note">No photos yet. Press K to take out your camera, or use the drone (Enter to snap, R to record).</p>';
    $('gallery').querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { this.g.capture.remove(gal[+b.dataset.del]); this.openJournal(); }));
    $('gallery').querySelectorAll('[data-dl]').forEach((b) => (b.onclick = async () => { const r = gal[+b.dataset.dl]; const res = await saveFile(r.name, r.blob); if (res === 'unavailable') this.toast('Downloads are not available here.', 'warn'); }));
    $('gallery').querySelectorAll('video').forEach((v) => { v.onmouseenter = () => v.play(); v.onmouseleave = () => v.pause(); });
    const list = $('lmlist');
    list.innerHTML = '';
    for (const l of [...W.landmarks].sort((a, b) => a.name.localeCompare(b.name))) {
      const b = document.createElement('button');
      const on = p.discovered.has(l.id);
      b.className = on ? '' : 'no';
      b.innerHTML = `<i style="background:${on ? KIND_COLOR[l.kind] : 'rgba(243,234,215,0.25)'}"></i>${on ? l.name : l.name + ' (not yet visited)'}`;
      b.title = 'Travel here';
      b.onclick = () => { this.g.fastTravel(l.wx, l.wz, true); this.closeAll(); };
      list.appendChild(b);
    }
    $('achs').innerHTML = ACHIEVEMENTS.map((a) => `<div class="ach ${p.ach.has(a.id) ? 'on' : ''}"><b>${a.name}</b><small>${a.desc}</small></div>`).join('');
    const next = W.landmarks.filter((l) => !p.discovered.has(l.id)).map((l) => ({ l, d: Math.hypot(l.wx - this.g.player.pos.x, l.wz - this.g.player.pos.z) })).sort((a, b) => a.d - b.d)[0];
    $('chai-hint').textContent = next ? `Nearest place you have not visited yet: ${next.l.name}, ${fmtDist(next.d)} away.` : 'You have visited every landmark on campus!';
    $('j-late').onclick = () => { this.closeAll(); this.g.startChallenge(); };
    $('j-bike').onclick = () => { this.closeAll(); this.g.startBikeTour(); };
    $('j-bus').onclick = () => { this.closeAll(); this.g.setMode('bus'); };
  }

  // ------------------------------------------------------------ pause / settings (menu.js) and the Game Guide (guide/guide.js)
  openPause(tab) { openPause(this, tab); }
  openGuide(topic) { this.g.gameGuide.open(topic); }

  // ------------------------------------------------------------ character creator
  openCustom() {
    $('custom').hidden = false;
    this.renderCustom();
  }

  renderCustom() {
    const g = this.g;
    const L = { ...g.player.avatar.look };
    const body = $('custom-body');
    const set = (patch) => { g.setLook({ ...g.player.avatar.look, ...patch }); this.renderCustom(); };
    const chips = (key, opts) => `<div class="chips">${opts.map(([v, n]) => `<button class="chip" data-k="${key}" data-v="${v}" aria-pressed="${L[key] === v}">${n}</button>`).join('')}</div>`;
    const sws = (key, cols) => `<div class="swatches">${cols.map((c) => `<button class="sw" data-k="${key}" data-v="${c}" style="background:${c}" aria-pressed="${L[key] === c}" aria-label="${key} ${c}"></button>`).join('')}</div>`;
    const tog = (key, name) => `<label class="toggle"><input type="checkbox" data-t="${key}" ${L[key] ? 'checked' : ''}> ${name}</label>`;
    body.innerHTML = `
      <div class="group"><span class="lbl">Presets</span><div class="chips">${PRESETS.map((p) => `<button class="chip" data-preset="${p.id}">${p.name}</button>`).join('')}</div></div>
      <div class="group"><span class="lbl">Body</span>${chips('body', OPTIONS.body)}${chips('build', OPTIONS.build)}
        <label for="h-slider">Height · ${L.height.toFixed(2)} m</label><input type="range" id="h-slider" min="1.45" max="1.98" step="0.01" value="${L.height}"></div>
      <div class="group"><span class="lbl">Skin tone</span>${sws('skin', OPTIONS.skin)}</div>
      <div class="group"><span class="lbl">Face</span>${chips('face', OPTIONS.face)}${L.body === 'male' ? chips('facialHair', OPTIONS.facialHair) : ''}</div>
      <div class="group"><span class="lbl">Hair</span>${chips('hairStyle', OPTIONS.hairStyle)}${sws('hairColor', OPTIONS.hairColor)}</div>
      <div class="group"><span class="lbl">Glasses</span>${chips('glasses', OPTIONS.glasses)}</div>
      <div class="group"><span class="lbl">Top</span>${chips('top', OPTIONS.top)}${sws('topColor', OPTIONS.colors)}${L.top === 'plaid' ? '<span class="lbl">Check colour</span>' + sws('topColor2', ['#2c2e32', '#7d1f1f', '#1f3a5f', '#2e4a2a', '#f2f0ea', '#5a4632']) : ''}</div>
      <div class="group"><span class="lbl">Bottom</span>${chips('bottom', OPTIONS.bottom)}${sws('bottomColor', OPTIONS.colors)}</div>
      <div class="group"><span class="lbl">Shoes</span>${chips('shoes', OPTIONS.shoes)}${sws('shoesColor', OPTIONS.colors)}</div>
      <div class="group"><span class="lbl">Accessories</span>${tog('watch', 'Wristwatch')}${tog('backpack', 'Backpack')}${tog('cap', 'Cap')}${tog('headphones', 'Headphones')}
        ${L.backpack ? '<span class="lbl">Backpack colour</span>' + sws('backpackColor', OPTIONS.colors) : ''}${L.cap ? '<span class="lbl">Cap colour</span>' + sws('capColor', OPTIONS.colors) : ''}</div>
      <div class="group"><span class="lbl">Your bicycle</span>${chips('bikeStyle', [['mtb', 'Mountain bike'], ['roadster', 'Roadster (Hero / Atlas style)']])}${sws('bikeColor', ['#1e1e1e', '#c62f2f', '#2f5fa8', '#2e7d4f', '#d7d7d7', '#e0a526', '#6b3d5e'])}</div>
      <p class="saved-note">Drag on the left to turn your character. Your look is saved in this browser.</p>`;
    body.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { g.audio.click(); set({ [b.dataset.k]: b.dataset.v }); }));
    body.querySelectorAll('[data-t]').forEach((b) => (b.onchange = () => set({ [b.dataset.t]: b.checked })));
    body.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = () => {
      const p = PRESETS.find((x) => x.id === b.dataset.preset);
      g.setLook({ ...DEFAULT_LOOK, ...p.look });
      this.renderCustom();
    }));
    const hs = $('h-slider');
    hs.oninput = () => { g.setLook({ ...g.player.avatar.look, height: +hs.value }); hs.previousElementSibling.textContent = `Height · ${(+hs.value).toFixed(2)} m`; };
    $('custom-reset').onclick = () => { g.setLook({ ...DEFAULT_LOOK }); this.renderCustom(); };
    $('custom-done').onclick = () => this.closeAll();
    $('custom-close').onclick = () => this.closeAll();
  }

  // ------------------------------------------------------------ activities, fades, wallet, environment
  fade(v) {
    const el = $('fade');
    el.style.opacity = v;
    return new Promise((r) => setTimeout(r, 320));
  }
  actBar(title, cancelable = true) {
    const el = $('actbar');
    if (!title) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<b>${title}</b>${cancelable ? '<span><kbd>Esc</kbd> stop</span>' : ''}`;
  }
  /** spec: {title, html, buttons: [{label, key, onClick}]} or null */
  actPanel(spec) {
    const el = $('actpanel');
    this.actKeys = new Map();
    if (!spec) { el.hidden = true; return; }
    el.hidden = false;
    el.querySelector('h3').textContent = spec.title || '';
    el.querySelector('.body').innerHTML = spec.html || '';
    const bx = el.querySelector('.btns');
    bx.innerHTML = '';
    (spec.buttons || []).forEach((b, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.innerHTML = b.label;
      btn.dataset.i = i;
      btn.onclick = () => { this.g.audio.click(); b.onClick(); };
      bx.appendChild(btn);
      if (b.key) this.actKeys.set(b.key, b.onClick);
    });
  }
  pollActKeys(input) {
    if (!this.actKeys || !this.actKeys.size || $('actpanel').hidden) return;
    for (const [k, f] of this.actKeys) if (k !== 'Escape' && input.hit(k)) { this.g.audio.click(); f(); return; }
  }
  pressActKey(code) {
    const f = this.actKeys?.get(code);
    if (f && !$('actpanel').hidden) { f(); return true; }
    return false;
  }
  flashAnswer(k, ans) {
    const btns = $('actpanel').querySelectorAll('.btns .btn');
    btns.forEach((b, i) => { if (i === ans) b.classList.add('right'); else if (i === k) b.classList.add('wrong'); });
  }
  floatText(msg, kind = 'xp') {
    const el = document.createElement('div');
    el.className = `float ${kind}`;
    el.textContent = msg;
    $('floats').appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }
  wallet(p) {
    // only the money: cash, and what is left of the credit card's limit (energy, rank and CPI are in the Journal)
    const k = `${p.coins}|${p.bank}|${p.debt}`;
    if (k === this._wk) return;
    this._wk = k;
    $('w-coins').textContent = rupees(p.coins);
    $('w-card').textContent = `credit limit ${rupees(p.bank)}`;
    $('w-wallet').title = `Cash in your wallet: ${rupees(p.coins)} · credit card: ${rupees(p.bank)} of your ${rupees(CREDIT_LIMIT)} limit left`;
    const d = $('w-debt'); d.hidden = !p.debt; if (p.debt) d.textContent = `owe ${p.lender || 'a friend'} ${rupees(p.debt)}`;
  }
  envMeter(e) {
    if (!$('envmeter')) return;                       // not shown on the HUD any more
    const k = `${e.temp}|${e.rh}|${e.aqi}|${e.co2}`;
    if (k === this._ek) return;
    this._ek = k;
    const cat = e.aqi <= 50 ? ['Good', '#5b9b3a'] : e.aqi <= 100 ? ['Satisfactory', '#b5a82f'] : e.aqi <= 200 ? ['Moderate', '#e2702f'] : ['Poor', '#c62828'];
    $('envmeter').innerHTML = `<span><b>${e.temp}°C</b><small>feels ${e.feels}°</small></span><span><b>${e.rh}%</b><small>humidity</small></span>` +
      `<span><b style="color:${cat[1]}">${e.aqi}</b><small>AQI · ${cat[0]}</small></span><span><b>${e.pm}</b><small>PM2.5 µg/m³</small></span><span><b>${e.co2}</b><small>CO₂ ppm</small></span>`;
  }
  ticker(html) {
    const el = $('ticker');
    if (!html) { el.hidden = true; return; }
    el.hidden = false;
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  anyOpen() { return OVERLAYS.some((id) => $(id) && !$(id).hidden); }
  closeAll() {
    const wasCustom = !$('custom').hidden;
    for (const id of OVERLAYS) if ($(id)) $(id).hidden = true;
    if (wasCustom) this.g.endCustom();
  }
  wire() {
    $('map-close').onclick = () => this.closeAll();
    $('journal-close').onclick = () => this.closeAll();
    $('pause-close').onclick = () => this.closeAll();
    if (this.touch) {
      $('touch').hidden = false;
      this.g.input.bindTouchUI($('joy'), $('knob'), [...document.querySelectorAll('#touch [data-key]')]);
    }
  }
  crosshair(v) { $('crosshair').hidden = !v; }
  /** text size, high contrast, colour-blind markers, reduced motion */
  applyAccess() {
    const S = this.g.progress.settings;
    for (const id of ['hud', 'pause', 'guide', 'journal', 'planner', 'map', 'tourpick', 'subtitle']) { const el = $(id); if (el) el.style.zoom = S.uiScale || 1; }
    document.body.classList.toggle('hc', !!S.hc);
    document.body.classList.toggle('calm', !!S.calm);
  }
  subtitle(text) {
    const el = $('subtitle');
    el.textContent = text; el.hidden = false;
    clearTimeout(this._subT);
    this._subT = setTimeout(() => (el.hidden = true), Math.min(14000, 2500 + text.length * 65));
  }
}

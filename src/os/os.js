// IITG OS: the desktop on the Computer Centre's PCs. A boot screen, a sign-in screen, a desktop with
// icons, a taskbar and a start menu, and real windows (drag, resize, minimise, maximise, close) that
// run small apps: browser, YouTube, notepad, paint, calculator, files, photos, media player,
// terminal, settings, clock, task manager and snake (see apps.js and browser.js).
import { VW, VH, injectStyle } from './style.js';
import { APPS, APP_ORDER, PINNED, tile } from './apps.js';

const KEY = 'iitg3d.os';
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

export class OS {
  constructor(game) {
    this.g = game;
    const s = load();
    this.prefs = { wall: s.wall || 'dusk' };
    this.docs = s.docs || {};              // notepad documents: name -> text
    this.trash = s.trash || [];            // [{name, text}]
    this.wins = []; this.seq = 0; this.zTop = 20; this.focused = null;
    this.booted = false; this.locked = true;
    this.root = null;
    this.ident = null;                     // which machine this is: null = a Computer Centre PC, or { id, user, pass, place, device }
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify({ wall: this.prefs.wall, docs: this.docs, trash: this.trash })); } catch { /* storage unavailable */ } }
  get profile() { return this.g.progress.profile; }
  get userName() { return this.ident?.user || this.profile.name || 'Student'; }
  get place() { return this.ident?.place || 'Computer Centre'; }
  get device() { return this.ident?.device || 'CC-PC-01'; }

  // ------------------------------------------------------------------ mounting
  mount(host, ident = null) {
    injectStyle();
    if (!this.root) this.build();
    // a different machine (a hall's presenter PC, not a Computer Centre PC): sign out, close everything, boot again
    if ((this.ident?.id || 'cc') !== (ident?.id || 'cc')) {
      for (const w of [...this.wins]) this.close(w, true);
      this.booted = false; this.locked = true;
      this.closeMenus();
    }
    this.ident = ident;
    this.root.querySelector('.boot small').textContent = `IITG OS · ${this.place}`;
    host.appendChild(this.root);
    this.tick();
    if (!this.booted) {
      this.booted = true;
      const b = this.root.querySelector('.boot');
      b.style.display = 'flex'; b.style.opacity = '1';
      setTimeout(() => { b.style.opacity = '0'; setTimeout(() => (b.style.display = 'none'), 500); this.showLock(); }, 1400);
    }
  }
  unmount() { this.root?.remove(); this.closeMenus(); }

  build() {
    const root = (this.root = document.createElement('div'));
    root.className = 'os';
    root.innerHTML = `<div class="wall w-${this.prefs.wall}"></div><div class="icons"></div><div class="wins"></div><div class="start"></div><div class="cal"></div>
      <div class="task"><button class="startb" title="Start"><i class="logo"></i></button><input class="search" placeholder="Type here to search" spellcheck="false"><div class="apps"></div>
        <div class="tray"><span class="wifi" title="">📶</span><span class="vol" title="Volume">🔊</span><div class="clk"></div></div></div>
      <div class="toasts"></div><div class="lock"></div>
      <div class="boot"><i class="logo"></i><div class="spin"></div><small>IITG OS · Computer Centre</small></div>`;
    const $ = (s) => root.querySelector(s);
    this.el = { wall: $('.wall'), icons: $('.icons'), wins: $('.wins'), start: $('.start'), cal: $('.cal'), task: $('.task'), apps: $('.apps'), clk: $('.clk'), search: $('.search'), toasts: $('.toasts'), lock: $('.lock'), wifi: $('.wifi') };
    this.renderIcons();
    this.renderStart();
    this.renderTaskbar();
    this.paintWall();
    // taskbar
    $('.startb').onclick = (e) => { e.stopPropagation(); this.toggleStart(); };
    this.el.search.onfocus = () => { this.toggleStart(true); setTimeout(() => this.el.start.querySelector('input')?.focus(), 30); this.el.search.blur(); };
    this.el.clk.onclick = (e) => { e.stopPropagation(); this.toggleCal(); };
    $('.vol').onclick = (e) => { e.stopPropagation(); this.openApp('settings', { page: 'sound' }); };
    // close popups when clicking elsewhere; desktop selection; context menu
    root.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.start') && !e.target.closest('.startb') && !e.target.closest('.search')) this.toggleStart(false);
      if (!e.target.closest('.cal') && !e.target.closest('.clk')) this.toggleCal(false);
      if (!e.target.closest('.ctx')) this.closeCtx();
      if (e.target === this.el.icons || e.target === this.el.wall || e.target === this.el.wins) root.querySelectorAll('.dico.sel').forEach((d) => d.classList.remove('sel'));
    });
    root.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (e.target === this.el.icons || e.target === this.el.wall || e.target === this.el.wins) this.ctxMenu(e, [['New text document', () => this.openApp('notepad', { fresh: true })], ['Open Files', () => this.openApp('explorer')], ['Open terminal', () => this.openApp('terminal')], '-', ['Personalise…', () => this.openApp('settings', { page: 'look' })], ['Refresh', () => { this.renderIcons(); this.toast('Desktop refreshed'); }]]);
    });
  }

  paintWall() {
    const w = this.el.wall;
    w.className = `wall w-${this.prefs.wall}`;
    w.innerHTML = this.prefs.wall === 'night' ? Array.from({ length: 70 }, (_, k) => `<i style="left:${(k * 137.5) % 100}%;top:${(k * 53.3) % 60}%;opacity:${0.3 + ((k * 7) % 10) / 14}"></i>`).join('') : '';
    if (this.prefs.wall === 'night') w.classList.add('stars');
  }

  tick() {
    if (!this.root || !this.el) return;
    const c = this.g.clock, h = c.hour, H = Math.floor(h), M = Math.floor((h - H) * 60);
    const t = `${((H + 11) % 12) + 1}:${String(M).padStart(2, '0')} ${H >= 12 ? 'PM' : 'AM'}`;
    this.el.clk.innerHTML = `${t}<br><span style="opacity:.75">${c.dayName.slice(0, 3)}, Day ${c.day + 1}</span>`;
    this.el.wifi.title = this.online() ? 'Connected: IITG-Campus' : 'No internet';
    this.el.wifi.style.opacity = this.online() ? '1' : '.4';
    this.clockText = t;
    if (this.el.lock.classList.contains('on')) { const b = this.el.lock.querySelector('.clock b'); if (b) b.textContent = t.replace(/ [AP]M/, ''); }
  }
  online() { return navigator.onLine !== false; }

  // ------------------------------------------------------------------ desktop, taskbar, start
  renderIcons() {
    const ic = this.el.icons;
    ic.innerHTML = '';
    for (const id of ['explorer', 'browser', 'youtube', 'notepad', 'paint', 'calc', 'terminal', 'photos', 'recycle', 'settings']) {
      const d = APPS[id]; if (!d) continue;
      const el = document.createElement('div');
      el.className = 'dico'; el.innerHTML = `${tile(d.icon, 'lg')}<span>${esc(d.name)}</span>`;
      el.onclick = (e) => { e.stopPropagation(); ic.querySelectorAll('.dico.sel').forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); };
      el.ondblclick = () => this.openApp(id);
      el.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); this.ctxMenu(e, [['Open', () => this.openApp(id)]]); };
      ic.appendChild(el);
    }
  }

  renderTaskbar() {
    const box = this.el.apps;
    box.innerHTML = '';
    const ids = [...PINNED];
    for (const w of this.wins) if (!ids.includes(w.id)) ids.push(w.id);
    for (const id of ids) {
      const d = APPS[id]; const ws = this.wins.filter((w) => w.id === id);
      const b = document.createElement('button');
      b.className = `tbtn${ws.length ? ' open' : ''}${ws.some((w) => w === this.focused && !w.min) ? ' on' : ''}`;
      b.title = d.name;
      b.innerHTML = `${tile(d.icon, 'sm')}${PINNED.includes(id) ? '' : `<span>${esc(ws[0]?.title || d.name)}</span>`}`;
      b.onclick = () => {
        if (!ws.length) return this.openApp(id);
        const w = ws[ws.length - 1];
        if (w === this.focused && !w.min) this.minimize(w); else { this.restore(w); this.focusWin(w); }
      };
      b.oncontextmenu = (e) => { e.preventDefault(); const items = [[`Open new ${d.name}`, () => this.openApp(id, { newWindow: true })]]; if (ws.length) items.push(['Close window', () => this.close(ws[ws.length - 1])]); this.ctxMenu(e, items, true); };
      box.appendChild(b);
    }
  }

  renderStart(query = '') {
    const S = this.el.start, u = this.userName, q = query.trim().toLowerCase();
    let body;
    if (q) {
      const apps = APP_ORDER.filter((id) => APPS[id].name.toLowerCase().includes(q) || (APPS[id].kw || '').includes(q));
      const docs = Object.keys(this.docs).filter((n) => n.toLowerCase().includes(q));
      body = `<h4>Best match</h4><div class="res">${apps.map((id) => `<div class="item" data-app="${id}">${tile(APPS[id].icon, 'sm')}<span>${esc(APPS[id].name)}</span></div>`).join('')}
        ${docs.map((n) => `<div class="item" data-doc="${esc(n)}">${tile(['#4b86e8', '📄'], 'sm')}<span>${esc(n)}</span></div>`).join('')}
        <div class="item" data-web="${esc(query)}">${tile(['#2f8a5a', '🌐'], 'sm')}<span>Search the web for “${esc(query)}”</span></div>
        <div class="item" data-yt="${esc(query)}">${tile(['#e62117', '▶'], 'sm')}<span>Search YouTube for “${esc(query)}”</span></div></div>`;
    } else {
      body = `<h4>Apps</h4><div class="grid">${APP_ORDER.map((id) => `<div class="app" data-app="${id}">${tile(APPS[id].icon, 'lg')}<span>${esc(APPS[id].name)}</span></div>`).join('')}</div>`;
    }
    S.innerHTML = `<input placeholder="Search apps, documents and the web" value="${esc(query)}" spellcheck="false">${body}
      <div class="foot"><div class="av">${esc(u[0]?.toUpperCase() || 'S')}</div><b>${esc(u)}</b><button data-p="lock">Lock</button><button data-p="restart">Restart</button><button data-p="off">Stand up</button></div>`;
    const inp = S.querySelector('input');
    inp.oninput = () => { this.renderStart(inp.value); const n = this.el.start.querySelector('input'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    inp.onkeydown = (e) => { if (e.key === 'Enter') { S.querySelector('.res .item')?.click(); } };
    S.querySelectorAll('[data-app]').forEach((x) => (x.onclick = () => { this.toggleStart(false); this.openApp(x.dataset.app); }));
    S.querySelectorAll('[data-doc]').forEach((x) => (x.onclick = () => { this.toggleStart(false); this.openApp('notepad', { open: x.dataset.doc }); }));
    S.querySelectorAll('[data-web]').forEach((x) => (x.onclick = () => { this.toggleStart(false); this.openApp('browser', { go: x.dataset.web }); }));
    S.querySelectorAll('[data-yt]').forEach((x) => (x.onclick = () => { this.toggleStart(false); this.openApp('youtube', { q: x.dataset.yt }); }));
    S.querySelectorAll('[data-p]').forEach((x) => (x.onclick = () => {
      this.toggleStart(false);
      const p = x.dataset.p;
      if (p === 'lock') this.showLock();
      else if (p === 'restart') this.restart();
      else this.standUp();
    }));
  }
  toggleStart(on) {
    const S = this.el.start, v = on ?? !S.classList.contains('on');
    if (v) { this.toggleCal(false); this.renderStart(); }
    S.classList.toggle('on', v);
    this.root.querySelector('.startb').classList.toggle('on', v);
    if (v) setTimeout(() => S.querySelector('input')?.focus(), 30);
  }
  toggleCal(on) {
    const C = this.el.cal, v = on ?? !C.classList.contains('on');
    if (v) {
      this.toggleStart(false);
      const c = this.g.clock;
      C.innerHTML = `<h3>${esc(this.clockText || '')}</h3><small>${esc(c.dayName)}, day ${c.day + 1} of your stay · IST</small><hr style="border:0;border-top:1px solid rgba(255,255,255,.15);margin:10px 0"><small>${esc(this.g.weather?.state?.name || 'Clear')} · ${Math.round(this.g.weather?.state?.temp ?? 28)}°C in Guwahati</small>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:10px;text-align:center;font-size:12px">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => `<b style="opacity:.6">${d}</b>`).join('')}${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => `<span style="padding:4px;border-radius:5px;${i === c.weekday ? 'background:#2f6fe0;color:#fff' : ''}">${i + 1}</span>`).join('')}</div>`;
    }
    C.classList.toggle('on', v);
  }
  closeMenus() { this.toggleStart(false); this.toggleCal(false); this.closeCtx(); }

  ctxMenu(e, items, up = false) {
    this.closeCtx();
    const r = this.root.getBoundingClientRect(), kx = VW / r.width, ky = VH / r.height;
    const m = document.createElement('div'); m.className = 'ctx';
    m.innerHTML = items.map((it) => (it === '-' ? '<hr>' : `<div>${esc(it[0])}</div>`)).join('');
    let i = 0; m.querySelectorAll('div').forEach((d) => { const it = items.filter((x) => x !== '-')[i++]; d.onclick = () => { this.closeCtx(); it[1](); }; });
    const x = (e.clientX - r.left) * kx, y = (e.clientY - r.top) * ky;
    m.style.left = `${Math.min(x, VW - 200)}px`; m.style.top = up ? `${Math.max(4, y - items.length * 30 - 10)}px` : `${Math.min(y, VH - items.length * 30 - 50)}px`;
    this.root.appendChild(m); this.ctx = m;
  }
  closeCtx() { this.ctx?.remove(); this.ctx = null; }

  // ------------------------------------------------------------------ dialogs and toasts
  toast(msg) {
    const t = document.createElement('div'); t.className = 'otoast'; t.textContent = msg;
    this.el.toasts.appendChild(t); setTimeout(() => t.remove(), 2800);
  }
  modal(html, wire) {
    const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="dlg">${html}</div>`;
    this.root.appendChild(m);
    const done = () => m.remove();
    wire(m.querySelector('.dlg'), done);
    return done;
  }
  prompt(title, value = '', msg = '') {
    return new Promise((res) => this.modal(`<h3>${esc(title)}</h3>${msg ? `<p>${esc(msg)}</p>` : ''}<input value="${esc(value)}" spellcheck="false"><div class="row"><button class="btn" data-x="0">Cancel</button><button class="btn pri" data-x="1">OK</button></div>`, (d, done) => {
      const i = d.querySelector('input'); setTimeout(() => { i.focus(); i.select(); }, 30);
      const go = (ok) => { done(); res(ok ? i.value.trim() : null); };
      d.querySelector('[data-x="1"]').onclick = () => go(true); d.querySelector('[data-x="0"]').onclick = () => go(false);
      i.onkeydown = (e) => { if (e.key === 'Enter') go(true); if (e.key === 'Escape') { e.stopPropagation(); go(false); } };
    }));
  }
  confirm(title, msg, yes = 'OK') {
    return new Promise((res) => this.modal(`<h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="row"><button class="btn" data-x="0">Cancel</button><button class="btn pri" data-x="1">${esc(yes)}</button></div>`, (d, done) => {
      d.querySelector('[data-x="1"]').onclick = () => { done(); res(true); }; d.querySelector('[data-x="0"]').onclick = () => { done(); res(false); };
    }));
  }

  // ------------------------------------------------------------------ sign-in, restart, stand up
  showLock() {
    const L = this.el.lock, u = this.userName, need = this.ident?.pass || null;
    L.innerHTML = `<div class="clock"><b>${esc((this.clockText || '').replace(/ [AP]M/, ''))}</b><small>${esc(this.g.clock.dayName)} · ${esc(this.place)}, IIT Guwahati</small></div><div class="av">${esc(u[0]?.toUpperCase() || 'S')}</div><h2>${esc(u)}</h2><input type="password" placeholder="${need ? 'Password' : 'Password (anything works)'}" value=""><button class="btn pri" style="height:34px;padding:0 26px;border-radius:17px">Sign in</button><small class="msg">${need ? `IITG · ${esc(this.device)}` : `IITG LDAP · ${esc(this.profile.roll || 'guest')}`}</small>${need ? `<div class="sticky"><b>${esc(this.place)}</b><br>user: <b>${esc(u)}</b><br>password: <b>${esc(need)}</b></div>` : ''}`;
    L.classList.add('on'); this.locked = true;
    const inp = L.querySelector('input');
    const go = () => {
      if (need && inp.value !== need) { L.classList.remove('shake'); void L.offsetWidth; L.classList.add('shake'); L.querySelector('.msg').textContent = 'That password is not correct. Try again.'; inp.value = ''; this.g.audio?.tone?.(300, 0.1, { type: 'triangle', gain: 0.04 }); return; }
      L.classList.remove('on'); this.locked = false; this.toast(`Welcome, ${u.split(' ')[0]}`);
    };
    L.querySelector('button').onclick = go;
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    setTimeout(() => inp.focus(), 100);
  }
  async restart() {
    for (const w of [...this.wins]) this.close(w, true);
    const b = this.root.querySelector('.boot'); b.style.display = 'flex'; b.style.opacity = '1';
    setTimeout(() => { b.style.opacity = '0'; setTimeout(() => (b.style.display = 'none'), 500); this.showLock(); }, 1500);
  }
  standUp() { this.g.activity?.stop?.(true); }

  // ------------------------------------------------------------------ windows
  pt(e) { const r = this.root.getBoundingClientRect(); return { x: ((e.clientX - r.left) * VW) / r.width, y: ((e.clientY - r.top) * VH) / r.height }; }

  openApp(id, args = {}) {
    const def = APPS[id];
    if (!def) return null;
    if (def.single !== false && !args.newWindow) {
      const ex = this.wins.find((w) => w.id === id);
      if (ex) { this.restore(ex); this.focusWin(ex); ex.app?.onArgs?.(args); return ex; }
    }
    const n = this.wins.length;
    const w = { uid: ++this.seq, id, def, title: def.name, x: 70 + (n % 6) * 30, y: 26 + (n % 6) * 26, w: def.w || 720, h: def.h || 460, max: !!def.max, min: false };
    w.x = clamp(w.x, 0, VW - w.w); w.y = clamp(w.y, 0, VH - 40 - w.h);
    const el = (w.el = document.createElement('div'));
    el.className = 'win';
    el.innerHTML = `<div class="tb">${tile(def.icon, 'sm')}<span class="tt"></span><button class="mn" title="Minimise">&#8211;</button><button class="mx" title="Maximise">&#9723;</button><button class="cl" title="Close">&#10005;</button></div><div class="body"></div><div class="rs"></div>`;
    el.style.zIndex = ++this.zTop; el.tabIndex = -1; el.style.outline = 'none';
    this.el.wins.appendChild(el);
    w.body = el.querySelector('.body');
    w.setTitle = (t) => { w.title = t; el.querySelector('.tt').textContent = t; this.renderTaskbar(); };
    w.setTitle(def.name);
    const tb = el.querySelector('.tb');
    tb.onpointerdown = (e) => { if (e.target.closest('button')) return; this.startDrag(e, w, 'move'); };
    tb.ondblclick = (e) => { if (!e.target.closest('button') && def.resize !== false) this.toggleMax(w); };
    el.querySelector('.rs').onpointerdown = (e) => this.startDrag(e, w, 'resize');
    el.querySelector('.mn').onclick = () => this.minimize(w);
    el.querySelector('.mx').onclick = () => this.toggleMax(w);
    el.querySelector('.cl').onclick = () => this.close(w);
    el.onpointerdown = () => { if (this.focused !== w) this.focusWin(w); };
    if (def.resize === false) { el.querySelector('.mx').style.display = 'none'; el.querySelector('.rs').style.display = 'none'; }
    this.wins.push(w);
    this.layout(w);
    w.app = def.create({ os: this, win: w, g: this.g, args, esc });
    if (w.app?.el) w.body.appendChild(w.app.el);
    this.focusWin(w);
    this.toggleStart(false);
    this.renderTaskbar();
    return w;
  }
  layout(w) {
    const s = w.el.style;
    if (w.max) { s.left = '0'; s.top = '0'; s.width = `${VW}px`; s.height = `${VH - 40}px`; }
    else { s.left = `${w.x}px`; s.top = `${w.y}px`; s.width = `${w.w}px`; s.height = `${w.h}px`; }
    w.el.classList.toggle('max', w.max);
    w.app?.onResize?.();
  }
  focusWin(w) {
    this.focused = w;
    w.el.style.zIndex = ++this.zTop;
    for (const o of this.wins) o.el.classList.toggle('inactive', o !== w);
    // the keyboard follows the window: its own field if it has one, else the window itself
    if (w.app?.onFocus) w.app.onFocus(); else if (!w.el.contains(document.activeElement)) w.el.focus({ preventScroll: true });
    this.renderTaskbar();
  }
  minimize(w) { w.min = true; w.el.classList.add('min'); if (this.focused === w) { this.focused = this.wins.filter((o) => !o.min).pop() || null; if (this.focused) this.focusWin(this.focused); } this.renderTaskbar(); }
  restore(w) { if (w.min) { w.min = false; w.el.classList.remove('min'); } }
  toggleMax(w) { w.max = !w.max; this.layout(w); }
  close(w, silent) {
    try { w.app?.onClose?.(); } catch { /* app cleanup failed: close anyway */ }
    w.el.remove();
    this.wins = this.wins.filter((o) => o !== w);
    if (this.focused === w) { this.focused = this.wins.filter((o) => !o.min).pop() || null; if (this.focused && !silent) this.focusWin(this.focused); }
    this.renderTaskbar();
  }
  startDrag(e, w, mode) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.focusWin(w);
    const p0 = this.pt(e);
    if (mode === 'move' && w.max) { const rel = p0.x / VW; w.max = false; w.x = clamp(p0.x - w.w * rel, 0, VW - w.w); w.y = 0; this.layout(w); }
    const x0 = w.x, y0 = w.y, w0 = w.w, h0 = w.h, def = w.def;
    this.root.classList.add('dragging');
    const mv = (ev) => {
      const p = this.pt(ev);
      if (mode === 'move') { w.x = clamp(x0 + p.x - p0.x, -w.w + 130, VW - 90); w.y = clamp(y0 + p.y - p0.y, 0, VH - 74); }
      else { w.w = clamp(w0 + p.x - p0.x, def.minW || 320, VW - w.x); w.h = clamp(h0 + p.y - p0.y, def.minH || 200, VH - 40 - w.y); }
      this.layout(w);
    };
    const up = () => { window.removeEventListener('pointermove', mv); this.root.classList.remove('dragging'); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up, { once: true });
  }

  // ------------------------------------------------------------------ keyboard (routed from the PC layer)
  onKey(e) {
    if (e.key === 'F4' && e.altKey && this.focused) { e.preventDefault(); this.close(this.focused); return true; }
    if (e.key === 'Escape') { if (this.el.start.classList.contains('on') || this.el.cal.classList.contains('on') || this.ctx) { this.closeMenus(); return true; } if (this.el.lock.classList.contains('on')) return false; }
    if (this.el.lock.classList.contains('on')) return false;
    this.focused?.app?.onKey?.(e);
    return false;
  }

  // ------------------------------------------------------------------ what the apps share
  saveDoc(name, text) { this.docs[name] = text; this.save(); }
  deleteDoc(name) { if (name in this.docs) { this.trash.push({ name, text: this.docs[name] }); delete this.docs[name]; this.save(); } }
  gallery() { return this.g.capture?.session || []; }
  addPicture(blob, name) { return this.g.capture?.store({ blob, kind: 'photo', name, date: Date.now(), subject: '' }); }
}

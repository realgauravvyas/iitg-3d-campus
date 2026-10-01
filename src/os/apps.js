// The apps of IITG OS (the desktop on the Computer Centre PCs): files, photos & videos, notepad,
// paint, calculator, terminal, settings, clock, task manager and snake. The browser and YouTube are
// in browser.js.
import { saveFile } from '../util.js';
import { TIME_PRESETS } from '../scene/sky.js';
import { browserApp, youtubeApp } from './browser.js';

export const PINNED = ['explorer', 'browser', 'youtube', 'notepad'];
export const tile = ([bg, glyph], size = '') => `<span class="tile ${size}" style="background:${bg}">${glyph}</span>`;
const E = (html, cls = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
const kb = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const when = (t) => { const d = new Date(t); return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`; };
const txtName = (n) => (/\.[a-z0-9]{1,4}$/i.test(n) ? n : `${n}.txt`);

// ------------------------------------------------------------------------------------------ files
function explorer({ os, win, g, args, esc }) {
  const el = E(`<div class="side"></div><div class="main"><div class="bar"><button data-a="open">Open</button><button data-a="dl">Download</button><button data-a="del">Delete</button><button data-a="restore" hidden>Restore</button><span class="sp"></span><button data-a="refresh" title="Refresh">&#8635;</button></div><div class="list"></div><div class="status"></div></div>`, 'fx');
  const PL = [['desktop', '🖥', 'Desktop'], ['docs', '📄', 'Documents'], ['pics', '🖼', 'Pictures'], ['vids', '🎞', 'Videos'], ['dl', '⬇', 'Downloads'], ['trash', '🗑', 'Recycle Bin']];
  let place = args.place || 'docs', sel = null;
  const side = el.querySelector('.side'), list = el.querySelector('.list'), status = el.querySelector('.status');
  const items = () => {
    if (place === 'desktop') return ['explorer', 'browser', 'youtube', 'notepad', 'paint', 'calc', 'terminal', 'photos'].map((id) => ({ k: 'app', id, name: APPS[id].name, icon: APPS[id].icon }));
    if (place === 'docs') return Object.keys(os.docs).map((n) => ({ k: 'doc', name: n, size: new Blob([os.docs[n]]).size, icon: ['#4b86e8', '📄'] }));
    if (place === 'pics') return os.gallery().filter((r) => r.kind === 'photo').slice().reverse().map((r) => ({ k: 'photo', rec: r, name: r.name, size: r.blob?.size || 0, t: r.date }));
    if (place === 'vids') return [{ k: 'film', name: 'The IIT Guwahati Film', id: 'GV1GPFLknvc', icon: ['#c4302b', '▶'] }, { k: 'film', name: 'AI Confluence 2025 aftermovie', id: 'zKncCN6XEMQ', icon: ['#1f5fbf', '▶'] }, ...os.gallery().filter((r) => r.kind === 'video').slice().reverse().map((r) => ({ k: 'video', rec: r, name: r.name, size: r.blob?.size || 0, t: r.date, icon: ['#6b3d5e', '🎞'] }))];
    if (place === 'trash') return os.trash.map((t, i) => ({ k: 'trash', i, name: t.name, size: new Blob([t.text]).size, icon: ['#7b8494', '📄'] }));
    return [];
  };
  const render = () => {
    side.innerHTML = PL.map(([id, ic, n]) => `<div class="${id === place ? 'on' : ''}" data-p="${id}">${ic} ${n}</div>`).join('');
    side.querySelectorAll('[data-p]').forEach((d) => (d.onclick = () => { place = d.dataset.p; sel = null; render(); }));
    const its = items();
    list.innerHTML = its.length ? '' : `<div class="empty">${place === 'dl' ? 'Files you download from this PC are saved in your real Downloads folder.' : place === 'trash' ? 'The Recycle Bin is empty.' : 'Nothing here yet.' + (place === 'pics' ? ' Take photos with the camera (K), or draw in Paint.' : place === 'docs' ? ' Save a note in Notepad.' : '')}</div>`;
    its.forEach((it, i) => {
      const d = document.createElement('div');
      d.className = `fi${sel === i ? ' sel' : ''}`;
      const thumb = it.k === 'photo' ? `<img src="${it.rec.url}" alt="">` : tile(it.icon || ['#8a93a6', '📄'], 'lg');
      d.innerHTML = `${thumb}<span>${esc(it.name)}</span>${it.size ? `<small style="color:#7b8494">${kb(it.size)}</small>` : ''}`;
      d.onclick = () => { sel = i; render(); };
      d.ondblclick = () => open(it);
      list.appendChild(d);
    });
    status.textContent = `${its.length} item${its.length === 1 ? '' : 's'}${sel != null && its[sel] ? ` · ${its[sel].name}` : ''}`;
    el.querySelector('[data-a="restore"]').hidden = place !== 'trash';
    win.setTitle(`Files · ${PL.find((p) => p[0] === place)[2]}`);
  };
  const cur = () => items()[sel];
  const open = (it) => {
    if (!it) return;
    if (it.k === 'app') os.openApp(it.id);
    else if (it.k === 'doc') os.openApp('notepad', { open: it.name });
    else if (it.k === 'photo' || it.k === 'video') os.openApp('photos', { select: it.rec });
    else if (it.k === 'film') os.openApp('youtube', { watch: it.id, title: it.name });
    else if (it.k === 'trash') os.toast('Restore it to open it');
  };
  el.querySelector('.bar').onclick = async (e) => {
    const a = e.target.closest('button')?.dataset.a, it = cur();
    if (a === 'refresh') render();
    else if (!a) return;
    else if (!it && a !== 'refresh') os.toast('Select a file first');
    else if (a === 'open') open(it);
    else if (a === 'dl') {
      if (it.k === 'doc') saveFile(txtName(it.name), os.docs[it.name]).then((r) => r === 'saved' && os.toast('Saved to your Downloads'));
      else if (it.rec?.blob) saveFile(it.rec.name, it.rec.blob).then((r) => r === 'saved' && os.toast('Saved to your Downloads'));
      else os.toast('Nothing to download');
    } else if (a === 'del') {
      if (it.k === 'doc') { os.deleteDoc(it.name); sel = null; render(); os.toast('Moved to the Recycle Bin'); }
      else if (it.rec && (await os.confirm('Delete this file?', `${it.name} will be removed from your gallery.`, 'Delete'))) { g.capture.remove(it.rec); sel = null; render(); }
      else if (it.k === 'trash') { os.trash.splice(it.i, 1); os.save(); sel = null; render(); }
    } else if (a === 'restore' && it.k === 'trash') { const t = os.trash.splice(it.i, 1)[0]; os.docs[t.name] = t.text; os.save(); sel = null; render(); os.toast('Restored'); }
  };
  return { el, onKey(e) { if (e.key === 'Enter') open(cur()); if (e.key === 'Delete') el.querySelector('[data-a="del"]').click(); }, onArgs(a) { if (a.place) { place = a.place; sel = null; render(); } }, render: render() };
}

// ------------------------------------------------------------------------------------------ photos & videos
function photos({ os, win, g, args, esc }) {
  const el = E(`<div class="bar"><button data-a="prev">&#9664; Prev</button><button data-a="next">Next &#9654;</button><span class="sep"></span><button data-a="dl">Download</button><button data-a="del">Delete</button><span class="sp"></span><span class="cnt" style="font-size:12px;opacity:.8"></span></div><div class="stage"></div><div class="strip"></div>`, 'ph');
  let i = -1;
  const all = () => os.gallery().slice().reverse();
  const show = () => {
    const a = all(), stage = el.querySelector('.stage'), strip = el.querySelector('.strip');
    if (!a.length) { stage.innerHTML = '<div style="text-align:center;opacity:.75;line-height:1.7">No photos or videos yet.<br>Press <b>K</b> in the game to take out your camera (click to shoot, R to record),<br>or draw something in Paint.</div>'; strip.innerHTML = ''; el.querySelector('.cnt').textContent = ''; win.setTitle('Photos & Videos'); return; }
    i = Math.max(0, Math.min(i, a.length - 1));
    const r = a[i];
    stage.innerHTML = r.kind === 'video' ? `<video src="${r.url}" controls autoplay></video>` : `<img src="${r.url}" alt="">`;
    strip.innerHTML = a.map((x, k) => (x.kind === 'video' ? `<video src="${x.url}" muted class="${k === i ? 'on' : ''}" data-k="${k}"></video>` : `<img src="${x.url}" class="${k === i ? 'on' : ''}" data-k="${k}" alt="">`)).join('');
    strip.querySelectorAll('[data-k]').forEach((n) => (n.onclick = () => { i = +n.dataset.k; show(); }));
    strip.querySelector('.on')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    el.querySelector('.cnt').textContent = `${i + 1} / ${a.length} · ${r.name}`;
    win.setTitle(`Photos · ${r.name}`);
  };
  if (args.select) { const k = all().findIndex((x) => x === args.select); i = k >= 0 ? k : 0; } else i = 0;
  el.querySelector('.bar').onclick = async (e) => {
    const a = e.target.closest('button')?.dataset.a, list = all(), r = list[i];
    if (a === 'prev') { i = (i - 1 + list.length) % Math.max(1, list.length); show(); }
    else if (a === 'next') { i = (i + 1) % Math.max(1, list.length); show(); }
    else if (a === 'dl' && r) saveFile(r.name, r.blob).then((s) => s === 'saved' && os.toast('Saved to your Downloads'));
    else if (a === 'del' && r && (await os.confirm('Delete this file?', `${r.name} will be removed from your gallery.`, 'Delete'))) { g.capture.remove(r); show(); }
  };
  show();
  return { el, onKey(e) { if (e.key === 'ArrowLeft') el.querySelector('[data-a="prev"]').click(); if (e.key === 'ArrowRight') el.querySelector('[data-a="next"]').click(); }, onArgs(a) { if (a.select) { const k = all().findIndex((x) => x === a.select); if (k >= 0) i = k; } show(); } };
}

// ------------------------------------------------------------------------------------------ notepad
function notepad({ os, win, g, args, esc }) {
  const el = E(`<div class="bar"><button data-a="new">New</button><button data-a="open">Open</button><button data-a="save">Save</button><button data-a="dl">Download</button><span class="sep"></span><button data-a="wrap" class="on">Word wrap</button></div><textarea spellcheck="false" placeholder="Start typing…"></textarea><div class="status"><span class="pos"></span><span class="chars"></span></div>`, 'np');
  const ta = el.querySelector('textarea');
  let name = null, dirty = false;
  const title = () => win.setTitle(`${dirty ? '*' : ''}${name || 'Untitled'} · Notepad`);
  const setDoc = (n, t) => { name = n; ta.value = t; dirty = false; title(); count(); };
  const count = () => { const s = ta.selectionStart, before = ta.value.slice(0, s).split('\n'); el.querySelector('.pos').textContent = `Ln ${before.length}, Col ${before[before.length - 1].length + 1}`; el.querySelector('.chars').textContent = `${ta.value.length} characters`; };
  ta.oninput = () => { dirty = true; title(); count(); };
  ta.onkeyup = ta.onclick = count;
  const save = async (as) => {
    if (!name || as) { const n = await os.prompt('Save as', name || 'note', 'File name (saved in Documents)'); if (!n) return false; name = txtName(n); }
    os.saveDoc(name, ta.value); dirty = false; title(); os.toast(`Saved ${name} to Documents`); return true;
  };
  const guard = async () => (!dirty || !ta.value ? true : await os.confirm('Unsaved changes', 'Throw away what you typed?', 'Discard'));
  el.querySelector('.bar').onclick = async (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'new') { if (await guard()) setDoc(null, ''); }
    else if (a === 'save') save();
    else if (a === 'dl') { const n = txtName(name || 'note'); saveFile(n, ta.value).then((r) => r === 'saved' && os.toast('Saved to your Downloads')); }
    else if (a === 'wrap') { const b = e.target.closest('button'); b.classList.toggle('on'); ta.style.whiteSpace = b.classList.contains('on') ? 'pre-wrap' : 'pre'; ta.wrap = b.classList.contains('on') ? 'soft' : 'off'; }
    else if (a === 'open') {
      const names = Object.keys(os.docs);
      if (!names.length) return os.toast('No saved notes yet');
      os.modal(`<h3>Open a note</h3><div style="max-height:200px;overflow:auto">${names.map((n) => `<div class="btn" style="display:block;margin:4px 0;line-height:30px" data-n="${esc(n)}">${esc(n)}</div>`).join('')}</div><div class="row"><button class="btn" data-x="0">Cancel</button></div>`, (d, done) => {
        d.querySelector('[data-x="0"]').onclick = done;
        d.querySelectorAll('[data-n]').forEach((b) => (b.onclick = async () => { done(); if (await guard()) setDoc(b.dataset.n, os.docs[b.dataset.n]); }));
      });
    }
  };
  if (args.open && args.open in os.docs) setDoc(args.open, os.docs[args.open]); else setDoc(null, args.text || '');
  setTimeout(() => ta.focus(), 60);
  return { el, onFocus: () => ta.focus(), onKey(e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } }, onArgs(a) { if (a.open && a.open in os.docs) setDoc(a.open, os.docs[a.open]); else if (a.fresh) setDoc(null, ''); } };
}

// ------------------------------------------------------------------------------------------ paint
function paint({ os, win, g, args, esc }) {
  const COLS = ['#000000', '#7f7f7f', '#b3262f', '#e2702f', '#f0c24b', '#2e7d4f', '#1f6f6a', '#3f6fb0', '#6b3d5e', '#ffffff', '#c3c3c3', '#e38aa0', '#efd9b0', '#9fd18b', '#8fb4d8', '#a687d0'];
  const el = E(`<div class="bar"><button data-t="pen" class="on" title="Pencil">✏ Pencil</button><button data-t="erase" title="Eraser">⌫ Eraser</button><button data-t="line" title="Line">╱</button><button data-t="rect" title="Rectangle">▭</button><button data-t="oval" title="Oval">◯</button><button data-t="fill" title="Fill with colour">▧ Fill</button><span class="sep"></span><span style="font-size:12px;color:#5b6475">Size</span><input type="range" min="1" max="30" value="4" style="width:90px"><span class="sp"></span><button data-a="new">New</button><button data-a="save" title="Save to Pictures">Save</button><button data-a="dl" title="Download the picture">Download</button></div><div class="bar" style="padding-top:2px;padding-bottom:5px"><span style="font-size:12px;color:#5b6475">Colour</span>${COLS.map((c, i) => `<button class="sw${i === 0 ? ' on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div><div class="canvasbox"><canvas width="640" height="380"></canvas></div>`, 'paint');
  const cv = el.querySelector('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  let tool = 'pen', color = '#000000', size = 4, drawing = false, start = null, snap = null, last = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * cv.width) / r.width, ((e.clientY - r.top) * cv.height) / r.height]; };
  const stroke = (a, b, col, w) => { cx.strokeStyle = col; cx.lineWidth = w; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); };
  const fill = (x, y, col) => {
    x = Math.round(x); y = Math.round(y);
    const img = cx.getImageData(0, 0, cv.width, cv.height), d = img.data, w = cv.width, h = cv.height;
    const c = parseInt(col.slice(1), 16), R = c >> 16, G = (c >> 8) & 255, B = c & 255, o = (y * w + x) * 4, tr = d[o], tg = d[o + 1], tb = d[o + 2];
    if (tr === R && tg === G && tb === B) return;
    const same = (p) => Math.abs(d[p] - tr) < 24 && Math.abs(d[p + 1] - tg) < 24 && Math.abs(d[p + 2] - tb) < 24;
    const st = [[x, y]];
    while (st.length) {
      let [px, py] = st.pop(), p = (py * w + px) * 4;
      while (px >= 0 && same(p)) { px--; p -= 4; }
      px++; p += 4;
      let up = false, dn = false;
      while (px < w && same(p)) {
        d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
        if (py > 0) { const q = p - w * 4; if (same(q)) { if (!up) { st.push([px, py - 1]); up = true; } } else up = false; }
        if (py < h - 1) { const q = p + w * 4; if (same(q)) { if (!dn) { st.push([px, py + 1]); dn = true; } } else dn = false; }
        px++; p += 4;
      }
    }
    cx.putImageData(img, 0, 0);
  };
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId); const p = pos(e);
    if (tool === 'fill') { fill(p[0], p[1], color); return; }
    drawing = true; start = p; last = p; snap = cx.getImageData(0, 0, cv.width, cv.height);
    if (tool === 'pen' || tool === 'erase') stroke(p, [p[0] + 0.01, p[1]], tool === 'erase' ? '#ffffff' : color, tool === 'erase' ? size * 3 : size);
  };
  cv.onpointermove = (e) => {
    if (!drawing) return; const p = pos(e);
    if (tool === 'pen' || tool === 'erase') { stroke(last, p, tool === 'erase' ? '#ffffff' : color, tool === 'erase' ? size * 3 : size); last = p; return; }
    cx.putImageData(snap, 0, 0); cx.strokeStyle = color; cx.lineWidth = size; cx.lineCap = 'round';
    if (tool === 'line') { cx.beginPath(); cx.moveTo(start[0], start[1]); cx.lineTo(p[0], p[1]); cx.stroke(); }
    else if (tool === 'rect') cx.strokeRect(start[0], start[1], p[0] - start[0], p[1] - start[1]);
    else if (tool === 'oval') { cx.beginPath(); cx.ellipse((start[0] + p[0]) / 2, (start[1] + p[1]) / 2, Math.abs(p[0] - start[0]) / 2, Math.abs(p[1] - start[1]) / 2, 0, 0, 7); cx.stroke(); }
  };
  cv.onpointerup = () => { drawing = false; };
  el.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t) { tool = b.dataset.t; el.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === b)); }
    else if (b.dataset.c) { color = b.dataset.c; el.querySelectorAll('.sw').forEach((x) => x.classList.toggle('on', x === b)); }
    else if (b.dataset.a === 'new') { if (await os.confirm('New drawing', 'Clear the canvas?', 'Clear')) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); } }
    else if (b.dataset.a === 'save' || b.dataset.a === 'dl') {
      cv.toBlob((blob) => {
        const name = `Paint-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
        if (b.dataset.a === 'save') { os.addPicture(blob, name); os.toast('Saved to Pictures'); } else saveFile(name, blob).then((r) => r === 'saved' && os.toast('Saved to your Downloads'));
      }, 'image/png');
    }
  };
  el.querySelector('input[type=range]').oninput = (e) => { size = +e.target.value; };
  return { el };
}

// ------------------------------------------------------------------------------------------ calculator
function calc({ win }) {
  const el = E(`<div class="disp"><small></small><b>0</b></div><div class="keys">${[['C', 'op'], ['⌫', 'op'], ['%', 'op'], ['÷', 'op'], ['7'], ['8'], ['9'], ['×', 'op'], ['4'], ['5'], ['6'], ['−', 'op'], ['1'], ['2'], ['3'], ['+', 'op'], ['±'], ['0'], ['.'], ['=', 'eq']].map(([k, c]) => `<button data-k="${k}" class="${c || ''}">${k}</button>`).join('')}</div>`, 'calc');
  let cur = '0', acc = null, op = null, fresh = true, hist = '';
  const out = el.querySelector('b'), sm = el.querySelector('small');
  const show = () => { out.textContent = cur.length > 14 ? Number(cur).toPrecision(10) : cur; out.style.fontSize = cur.length > 10 ? '24px' : '34px'; sm.textContent = hist; };
  const apply = (a, b, o) => (o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : o === '÷' ? (b === 0 ? NaN : a / b) : b);
  const fmt = (n) => (Number.isFinite(n) ? String(+n.toPrecision(12)) : 'Cannot divide by zero');
  const press = (k) => {
    if (/^\d$/.test(k)) { cur = fresh || cur === '0' ? k : cur + k; fresh = false; }
    else if (k === '.') { if (fresh) { cur = '0.'; fresh = false; } else if (!cur.includes('.')) cur += '.'; }
    else if (k === 'C') { cur = '0'; acc = null; op = null; hist = ''; fresh = true; }
    else if (k === '⌫') { cur = cur.length > 1 && !fresh ? cur.slice(0, -1) : '0'; }
    else if (k === '±') { cur = cur.startsWith('-') ? cur.slice(1) : cur === '0' ? cur : `-${cur}`; }
    else if (k === '%') { cur = fmt(parseFloat(cur) / 100); fresh = true; }
    else if (k === '=') { if (op != null) { const r = apply(acc, parseFloat(cur), op); hist = `${fmt(acc)} ${op} ${cur} =`; cur = fmt(r); acc = null; op = null; fresh = true; } }
    else { if (op != null && !fresh) { acc = apply(acc, parseFloat(cur), op); cur = fmt(acc); } else acc = parseFloat(cur); op = k; hist = `${fmt(acc)} ${k}`; fresh = true; }
    show();
  };
  el.querySelector('.keys').onclick = (e) => { const b = e.target.closest('button'); if (b) press(b.dataset.k); };
  win.setTitle('Calculator');
  return { el, onKey(e) { const m = { '*': '×', '/': '÷', '-': '−', Enter: '=', Backspace: '⌫', Escape: 'C', Delete: 'C' }; const k = m[e.key] || e.key; if (/^[\d.+=%]$/.test(k) || '×÷−⌫C'.includes(k)) { e.preventDefault(); press(k); } } };
}

// ------------------------------------------------------------------------------------------ terminal
function terminal({ os, win, g, args, esc }) {
  const el = E('', 'term');
  win.setTitle('Terminal');
  const lines = [];
  let cwd = 'C:\\Users\\' + (os.userName.split(' ')[0] || 'student');
  const hist = []; let hi = 0;
  const print = (t = '') => { const d = document.createElement('div'); d.className = 'ln'; d.textContent = t; el.insertBefore(d, prompt); el.scrollTop = el.scrollHeight; };
  const prompt = document.createElement('div'); prompt.className = 'pr';
  prompt.innerHTML = '<span class="p"></span><input spellcheck="false" autocomplete="off">';
  el.appendChild(prompt);
  const inp = prompt.querySelector('input'), ps = prompt.querySelector('.p');
  const setPs = () => { ps.textContent = `${cwd}>`; };
  const APPNAMES = { browser: 'browser', edge: 'browser', notepad: 'notepad', paint: 'paint', calc: 'calc', calculator: 'calc', files: 'explorer', explorer: 'explorer', youtube: 'youtube', photos: 'photos', settings: 'settings', clock: 'clock', taskmgr: 'taskman', snake: 'snake' };
  const CMDS = {
    help: () => ['Commands:', '  help            this list', '  dir / ls        the notes in Documents', '  type <name>     show a note', '  echo <text>     print text', '  date, time      the campus date and time', '  whoami, hostname, ver, ipconfig, ping <host>', '  open <app>      browser, notepad, paint, calc, files, youtube, photos, settings, clock, taskmgr, snake', '  browse <url>    open a web address', '  yt <search>     search YouTube', '  cls             clear the screen', '  exit            close this window'],
    cls: () => { [...el.querySelectorAll('.ln')].forEach((n) => n.remove()); return []; },
    clear: () => CMDS.cls(),
    dir: () => { const n = Object.keys(os.docs); return [` Directory of ${cwd}\\Documents`, '', ...(n.length ? n.map((x) => `${(g.clock.dayName || '').slice(0, 3)}   ${String(new Blob([os.docs[x]]).size).padStart(7)}  ${x}`) : ['  (no files)']), '', `  ${n.length} file(s)`]; },
    ls: () => CMDS.dir(),
    type: (a) => (a[0] && os.docs[a[0]] != null ? os.docs[a[0]].split('\n') : [`The system cannot find the file ${a[0] || ''}`]),
    cat: (a) => CMDS.type(a),
    echo: (a) => [a.join(' ')],
    date: () => [`${g.clock.dayName}, day ${g.clock.day + 1} · campus time`],
    time: () => [os.clockText || ''],
    whoami: () => [os.ident ? `iitg\\${os.userName}` : `iitg\\${(os.profile.roll || 'guest')} (${os.userName})`],
    hostname: () => ['CC-PC-01'],
    ver: () => [`IITG OS [Version 1.0.31 · ${os.place}]`],
    ipconfig: () => ['IITG OS IP Configuration', '', 'Wireless LAN adapter IITG-Campus:', '   IPv4 Address. . . : 10.10.' + (20 + (g.clock.day % 200)) + '.' + (30 + os.wins.length), '   Subnet Mask . . . : 255.255.252.0', '   Default Gateway . : 10.10.20.1', `   Internet. . . . . : ${os.online() ? 'connected' : 'not connected'}`],
    ping: (a) => { const h = a[0] || 'iitg.ac.in'; return [`Pinging ${h} with 32 bytes of data:`, ...[0, 1, 2, 3].map(() => `Reply from ${h}: bytes=32 time=${8 + Math.floor(Math.random() * 25)}ms TTL=57`), '', `Ping statistics: Sent = 4, Received = 4, Lost = 0 (0% loss)`]; },
    open: (a) => { const id = APPNAMES[(a[0] || '').toLowerCase()]; if (!id) return [`No app called "${a[0] || ''}". Type help.`]; os.openApp(id); return [`Opening ${APPS[id].name}…`]; },
    start: (a) => CMDS.open(a),
    browse: (a) => { os.openApp('browser', { go: a.join(' ') || 'iitg.ac.in' }); return ['Opening the browser…']; },
    yt: (a) => { os.openApp('youtube', { q: a.join(' ') }); return ['Opening YouTube…']; },
    exit: () => { os.close(win); return []; },
    cd: (a) => { if (a[0]) cwd = a[0].includes(':') ? a[0] : `${cwd}\\${a[0]}`; setPs(); return []; },
  };
  const run = (line) => {
    print(`${cwd}>${line}`);
    const [c, ...a] = line.trim().split(/\s+/);
    if (!c) return;
    const f = CMDS[c.toLowerCase()];
    (f ? f(a) : [`'${c}' is not recognized as an internal or external command. Type help.`]).forEach((l) => print(l));
  };
  print(`IITG OS [Version 1.0.31 · ${os.place}]`); print('Type help for the commands.'); print(); setPs();
  inp.onkeydown = (e) => {
    if (e.key === 'Enter') { const v = inp.value; if (v.trim()) { hist.push(v); hi = hist.length; } inp.value = ''; run(v); }
    else if (e.key === 'ArrowUp') { if (hi > 0) inp.value = hist[--hi]; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { inp.value = hi < hist.length - 1 ? hist[++hi] : ''; hi = Math.min(hi, hist.length); e.preventDefault(); }
  };
  el.onclick = () => inp.focus();
  setTimeout(() => inp.focus(), 60);
  return { el, onFocus: () => inp.focus() };
}

// ------------------------------------------------------------------------------------------ settings
const WALLS = [['dusk', 'Brahmaputra dusk'], ['campus', 'Green campus'], ['night', 'Starry night'], ['maroon', 'Maroon'], ['blue', 'Deep blue']];
function settings({ os, win, g, args, esc }) {
  const el = E('<div class="side"></div><div class="pane"></div>', 'set');
  const PAGES = [['look', 'Personalise'], ['sound', 'Sound'], ['time', 'Date & time'], ['net', 'Network'], ['about', 'About']];
  let page = args.page || 'look';
  const render = () => {
    el.querySelector('.side').innerHTML = PAGES.map(([id, n]) => `<div class="${id === page ? 'on' : ''}" data-p="${id}">${n}</div>`).join('');
    el.querySelectorAll('[data-p]').forEach((d) => (d.onclick = () => { page = d.dataset.p; render(); }));
    const P = el.querySelector('.pane');
    if (page === 'look') {
      P.innerHTML = `<h2>Personalise</h2><b>Desktop background</b><div class="walls">${WALLS.map(([id, n]) => `<div class="wl${os.prefs.wall === id ? ' on' : ''}" data-w="${id}"><div class="wall w-${id}" style="position:absolute;inset:0"></div><span>${n}</span></div>`).join('')}</div>`;
      P.querySelectorAll('[data-w]').forEach((d) => (d.onclick = () => { os.prefs.wall = d.dataset.w; os.save(); os.paintWall(); render(); }));
    } else if (page === 'sound') {
      const v = g.audio?.volume ?? 0.8;
      P.innerHTML = `<h2>Sound</h2><b>Master volume</b><div><input type="range" min="0" max="1" step="0.05" value="${v}"> <span class="vv">${Math.round(v * 100)}%</span></div><div class="chips"><button class="btn" data-m="mute">${g.audio?.muted ? 'Unmute' : 'Mute'} the game</button></div><p style="color:#5b6475;font-size:12.5px;margin:0">This is the game's volume: it also sets the films' and the music's loudness.</p>`;
      P.querySelector('input').oninput = (e) => { const x = +e.target.value; g.audio?.setVolume?.(x); g.progress.settings.volume = x; g.progress.save(); P.querySelector('.vv').textContent = `${Math.round(x * 100)}%`; };
      P.querySelector('[data-m]').onclick = () => { g.audio?.toggleMute?.(); render(); };
    } else if (page === 'time') {
      P.innerHTML = `<h2>Date & time</h2><div class="kv"><b>Campus time</b><span>${esc(os.clockText || '')} · ${esc(g.clock.dayName)}</span><b>Time zone</b><span>India Standard Time (UTC+5:30)</span></div><b>Set the time of day</b><div class="chips">${TIME_PRESETS.map((t) => `<button class="btn" data-t="${t.t}">${esc(t.name)}</button>`).join('')}</div>`;
      P.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { g.clock.set(+b.dataset.t); os.tick(); os.toast(`It is now ${b.textContent.toLowerCase()}`); render(); }));
    } else if (page === 'net') {
      const proxy = !!window.__PROXY__;
      P.innerHTML = `<h2>Network</h2><div class="kv"><b>Wi-Fi</b><span>IITG-Campus · ${os.online() ? 'connected' : 'no internet'}</span><b>Web browser</b><span>${proxy ? 'Full: real websites open inside the PC' : 'Preview mode: websites cannot open inside the PC'}</span><b>YouTube</b><span>${/^https?:$/.test(location.protocol) ? (proxy ? 'Search and play' : 'Play by link (search needs the local server)') : 'Needs launch.bat'}</span></div>${proxy ? '' : '<p style="color:#5b6475;font-size:12.5px;line-height:1.5;margin:0">To browse real websites and search YouTube on this PC, start the game with <b>launch.bat</b> (double-click it in the game folder). It runs a small local server for the game.</p>'}`;
    } else {
      P.innerHTML = `<h2>About</h2><div class="kv"><b>Device name</b><span>${esc(os.device)}</span><b>Operating system</b><span>IITG OS 1.0</span><b>Signed in as</b><span>${esc(os.userName)} (${esc(os.profile.roll || 'guest')})</span><b>Hostel</b><span>${esc(g.gatepass?.hostelName(os.profile.hostel) || '')} · room ${esc(os.profile.room || '—')}</span><b>Location</b><span>Computer Centre, IIT Guwahati</span></div>`;
    }
    win.setTitle(`Settings · ${PAGES.find((p) => p[0] === page)[1]}`);
  };
  render();
  return { el, onArgs(a) { if (a.page) { page = a.page; render(); } } };
}

// ------------------------------------------------------------------------------------------ clock
function clockApp({ os, win, g }) {
  const el = E('<canvas width="360" height="360"></canvas><b class="dg"></b><small class="dt"></small><div style="display:flex;gap:8px;align-items:center"><b class="sw" style="font-size:24px;font-weight:300;min-width:110px;text-align:center">00:00.0</b><button class="btn" data-a="go">Start</button><button class="btn" data-a="reset">Reset</button></div>', 'clockapp');
  win.setTitle('Clock');
  const cv = el.querySelector('canvas'), cx = cv.getContext('2d');
  let sw = 0, run = false, t0 = 0, timer;
  const draw = () => {
    const c = g.clock, h = c.hour, H = Math.floor(h), M = Math.floor((h - H) * 60), S = Math.floor((((h - H) * 60 - M) * 60));
    cx.clearRect(0, 0, 360, 360); cx.translate(180, 180);
    cx.fillStyle = '#1b2130'; cx.beginPath(); cx.arc(0, 0, 170, 0, 7); cx.fill(); cx.strokeStyle = '#3a4560'; cx.lineWidth = 4; cx.stroke();
    for (let i = 0; i < 12; i++) { cx.save(); cx.rotate((i * Math.PI) / 6); cx.fillStyle = '#c9d3e6'; cx.fillRect(-2, -158, 4, 14); cx.restore(); }
    const hand = (a, l, w, col) => { cx.save(); cx.rotate(a); cx.strokeStyle = col; cx.lineWidth = w; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(0, 10); cx.lineTo(0, -l); cx.stroke(); cx.restore(); };
    hand(((H % 12) + M / 60) * (Math.PI / 6), 90, 8, '#e9edf5'); hand((M + S / 60) * (Math.PI / 30), 130, 5, '#e9edf5'); hand(S * (Math.PI / 30), 140, 2, '#e2483f');
    cx.fillStyle = '#e2483f'; cx.beginPath(); cx.arc(0, 0, 7, 0, 7); cx.fill(); cx.setTransform(1, 0, 0, 1, 0, 0);
    el.querySelector('.dg').textContent = os.clockText || ''; el.querySelector('.dt').textContent = `${c.dayName} · day ${c.day + 1} · IST`;
    if (run) sw = (performance.now() - t0) / 1000;
    el.querySelector('.sw').textContent = `${String(Math.floor(sw / 60)).padStart(2, '0')}:${(sw % 60).toFixed(1).padStart(4, '0')}`;
  };
  timer = setInterval(draw, 200); draw();
  el.onclick = (e) => { const a = e.target.closest('button')?.dataset.a; if (a === 'go') { run = !run; if (run) t0 = performance.now() - sw * 1000; e.target.textContent = run ? 'Stop' : 'Start'; } else if (a === 'reset') { sw = 0; run = false; el.querySelector('[data-a="go"]').textContent = 'Start'; draw(); } };
  return { el, onClose: () => clearInterval(timer) };
}

// ------------------------------------------------------------------------------------------ task manager
function taskman({ os, win, g, esc }) {
  const el = E('<div class="bar"><b>Processes</b><span class="sp"></span><span class="perf" style="font-size:12px;color:#5b6475"></span></div><div style="flex:1;overflow:auto"></div>', 'tm');
  win.setTitle('Task Manager');
  let timer, frames = 0, fps = 0, t0 = performance.now(), raf;
  const loop = () => { frames++; const t = performance.now(); if (t - t0 > 1000) { fps = Math.round((frames * 1000) / (t - t0)); frames = 0; t0 = t; } raf = requestAnimationFrame(loop); };
  loop();
  const render = () => {
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 240;
    el.querySelector('.perf').textContent = `Game ${fps} fps · memory ${mem} MB · ${os.wins.length} app${os.wins.length === 1 ? '' : 's'} open`;
    el.lastChild.innerHTML = `<table><tr><th>Name</th><th style="width:130px">CPU</th><th style="width:90px">Memory</th><th style="width:90px"></th></tr>${os.wins.map((w, i) => { const cpu = Math.min(95, 2 + ((w.uid * 13 + Math.floor(performance.now() / 900) * 7) % 22)); return `<tr><td>${esc(w.title)}</td><td><div class="meter"><i style="width:${cpu}%"></i></div></td><td>${20 + ((w.uid * 17) % 120)} MB</td><td><button class="btn red" data-k="${i}">End task</button></td></tr>`; }).join('') || '<tr><td colspan="4" style="color:#7b8494;padding:20px">No apps are open.</td></tr>'}</table>`;
    el.lastChild.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { const w = os.wins[+b.dataset.k]; if (w) os.close(w); render(); }));
  };
  timer = setInterval(render, 900); render();
  return { el, onClose: () => { clearInterval(timer); cancelAnimationFrame(raf); } };
}

// ------------------------------------------------------------------------------------------ snake
function snake({ os, win }) {
  const N = 20, C = 18;
  const el = E(`<canvas width="${N * C}" height="${N * C}"></canvas><small class="sc">Score 0 · arrow keys or WASD · Space to restart</small>`, 'snake');
  win.setTitle('Snake');
  const cv = el.querySelector('canvas'), cx = cv.getContext('2d');
  let s, dir, next, food, score, dead, timer;
  const reset = () => { s = [[10, 10], [9, 10], [8, 10]]; dir = [1, 0]; next = [1, 0]; score = 0; dead = false; place(); };
  const place = () => { do { food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (s.some((p) => p[0] === food[0] && p[1] === food[1])); };
  const draw = () => {
    cx.fillStyle = '#0e1a12'; cx.fillRect(0, 0, N * C, N * C);
    cx.fillStyle = '#e2483f'; cx.beginPath(); cx.arc(food[0] * C + C / 2, food[1] * C + C / 2, C / 2 - 2, 0, 7); cx.fill();
    s.forEach((p, i) => { cx.fillStyle = i ? '#4fbf6a' : '#9df0a8'; cx.fillRect(p[0] * C + 1, p[1] * C + 1, C - 2, C - 2); });
    if (dead) { cx.fillStyle = 'rgba(0,0,0,0.6)'; cx.fillRect(0, 0, N * C, N * C); cx.fillStyle = '#fff'; cx.font = '20px sans-serif'; cx.textAlign = 'center'; cx.fillText('Game over', N * C / 2, N * C / 2); }
    el.querySelector('.sc').textContent = `Score ${score} · arrow keys or WASD · Space to restart`;
  };
  const step = () => {
    if (dead) return;
    dir = next; const h = [s[0][0] + dir[0], s[0][1] + dir[1]];
    if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || s.some((p) => p[0] === h[0] && p[1] === h[1])) { dead = true; draw(); return; }
    s.unshift(h);
    if (h[0] === food[0] && h[1] === food[1]) { score++; place(); } else s.pop();
    draw();
  };
  reset(); draw(); timer = setInterval(step, 120);
  return { el, onClose: () => clearInterval(timer), onKey(e) {
    const d = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[e.key];
    if (d && !(d[0] === -dir[0] && d[1] === -dir[1])) { next = d; e.preventDefault(); }
    if (e.key === ' ') { reset(); e.preventDefault(); }
  } };
}

// ------------------------------------------------------------------------------------------ the registry
export const APPS = {
  explorer: { name: 'Files', icon: ['linear-gradient(#f3c14a,#e09a1c)', '📁'], w: 780, h: 470, minW: 460, create: explorer, kw: 'explorer documents pictures videos folder' },
  browser: { name: 'Browser', icon: ['linear-gradient(#4b9bff,#2a5fd0)', '🌐'], max: true, w: 940, h: 590, minW: 520, minH: 320, create: browserApp, kw: 'web internet chrome edge iitg' },
  youtube: { name: 'YouTube', icon: ['#e62117', '▶'], max: true, w: 940, h: 590, minW: 520, minH: 320, create: youtubeApp, kw: 'video watch films music' },
  notepad: { name: 'Notepad', icon: ['linear-gradient(#5fb0f0,#2f78c8)', '📝'], w: 620, h: 420, create: notepad, kw: 'text note write' },
  paint: { name: 'Paint', icon: ['linear-gradient(#ff9ec0,#e2483f)', '🎨'], w: 880, h: 560, minW: 560, minH: 380, create: paint, kw: 'draw picture' },
  calc: { name: 'Calculator', icon: ['linear-gradient(#5b6b8a,#2c3650)', '🧮'], w: 300, h: 440, resize: false, create: calc },
  terminal: { name: 'Terminal', icon: ['#171b24', '>_'], w: 680, h: 400, create: terminal, kw: 'command cmd shell' },
  photos: { name: 'Photos & Videos', icon: ['linear-gradient(#7c5cd6,#4a34a8)', '🖼'], w: 820, h: 520, minW: 480, create: photos, kw: 'gallery pictures media player' },
  recycle: { name: 'Recycle Bin', icon: ['#8792a6', '🗑'], w: 780, h: 470, create: (c) => explorer({ ...c, args: { ...c.args, place: 'trash' } }), kw: 'trash deleted' },
  settings: { name: 'Settings', icon: ['linear-gradient(#8a93a6,#4a5266)', '⚙'], w: 700, h: 440, create: settings, kw: 'personalise wallpaper sound volume time' },
  clock: { name: 'Clock', icon: ['#1f2a44', '🕒'], w: 400, h: 520, resize: false, create: clockApp, kw: 'time stopwatch' },
  taskman: { name: 'Task Manager', icon: ['linear-gradient(#3fbf8a,#1f8a5a)', '📊'], w: 560, h: 380, create: taskman, kw: 'processes performance' },
  snake: { name: 'Snake', icon: ['linear-gradient(#4fbf6a,#1f7a3a)', '🐍'], w: 400, h: 470, resize: false, create: snake, kw: 'game play' },
};
export const APP_ORDER = ['browser', 'youtube', 'explorer', 'notepad', 'paint', 'calc', 'photos', 'terminal', 'settings', 'clock', 'taskman', 'snake', 'recycle'];

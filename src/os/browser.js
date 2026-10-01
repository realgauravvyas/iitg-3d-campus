// The browser and YouTube apps of IITG OS.
//
// With the game's local server (launch.bat) the browser shows real websites inside the PC: every page
// goes through /p/<scheme>/<host>/<path> on the server, which is why iitg.ac.in (that refuses to be
// framed) works, and YouTube searches go through /api/yt/search. Without it (the game opened as a file,
// or inside the online preview) other websites cannot be shown inside another page: the browser says
// so plainly, reads Wikipedia through its open API when that is reachable from here (probed once), and
// still offers the campus portal; YouTube plays by link when the page has an http(s) address.
const HOME = [
  ['IIT Guwahati', 'https://www.iitg.ac.in/', '#7a2630', 'IITG'],
  ['Academics', 'https://www.iitg.ac.in/acad/', '#1f4f8a', 'Ac'],
  ['Library', 'https://www.iitg.ac.in/lib/', '#2e7d4f', 'Lib'],
  ['Wikipedia', 'https://en.wikipedia.org/wiki/IIT_Guwahati', '#3a3a3a', 'W'],
  ['Google', 'https://www.google.com/webhp?igu=1', '#4285f4', 'G'],
  ['Campus portal', 'iitg://portal', '#b3343f', '★'],
  ['YouTube', 'https://www.youtube.com/', '#e62117', '▶'],
];
const FILMS = [
  { id: 'GV1GPFLknvc', title: 'The IIT Guwahati Film', by: 'IIT Guwahati' },
  { id: 'zKncCN6XEMQ', title: 'IIT Guwahati AI Confluence 2025 · Official Cinematic Aftermovie', by: 'OES · IIT Guwahati' },
];
const IDRE = /^[\w-]{11}$/;

/** a YouTube video id from a link or an id, else null */
export function parseYouTube(text) {
  const q = String(text || '').trim();
  if (IDRE.test(q)) return q;
  let u; try { u = new URL(/^https?:/i.test(q) ? q : `https://${q}`); } catch { return null; }
  if (/(^|\.)youtu\.be$/.test(u.hostname)) return IDRE.test(u.pathname.slice(1, 12)) ? u.pathname.slice(1, 12) : null;
  if (/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) {
    const v = u.searchParams.get('v'); if (v && IDRE.test(v)) return v;
    const m = u.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{11})/); if (m) return m[2];
  }
  return null;
}
const isYouTubeHost = (h) => /(^|\.)(youtube(-nocookie)?\.com|youtu\.be)$/.test(h);

// ---- Wikipedia's open, CORS-enabled API: what works without the local server (a plain file yes; the
// online preview's security policy blocks requests to other sites, so it says no). Probed once.
const WIKI = 'https://en.wikipedia.org';
let wikiUp = null, wikiProbe = null;
const probeWiki = () => (wikiProbe ||= (async () => {
  const c = new AbortController(), tm = setTimeout(() => c.abort(), 4000);
  try { const r = await fetch(`${WIKI}/w/api.php?action=query&meta=siteinfo&format=json&origin=*`, { signal: c.signal }); return (wikiUp = r.ok); }
  catch { return (wikiUp = false); }
  finally { clearTimeout(tm); }
})());

// ------------------------------------------------------------------------------------------ browser
export function browserApp({ os, win, g, args, esc }) {
  const tile = (bg, a) => `<b style="width:46px;height:46px;border-radius:50%;background:${bg};display:grid;place-items:center;color:#fff;font-size:15px">${a}</b>`;
  const el = document.createElement('div');
  el.className = 'br'; el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  el.innerHTML = `<div class="tabs"></div><div class="nav"><button class="back" title="Back">&#8592;</button><button class="fwd" title="Forward">&#8594;</button><button class="rel" title="Reload">&#8635;</button><button class="home" title="Home">&#8962;</button><input class="url" spellcheck="false" autocomplete="off" placeholder="Search Google or type a web address"></div><div class="prog"></div><div class="marks">${HOME.map(([n, u, c], i) => `<button data-i="${i}"><i style="background:${c}"></i>${esc(n)}</button>`).join('')}</div><div class="view"></div>`;
  const $ = (s) => el.querySelector(s);
  const tabs = []; let cur = null, uid = 0;
  const url = $('.url'), view = $('.view'), prog = $('.prog');
  const servered = () => !!window.__PROXY__;

  const renderTabs = () => {
    const box = $('.tabs'); box.innerHTML = '';
    for (const t of tabs) {
      const d = document.createElement('div'); d.className = `tab${t === cur ? ' on' : ''}`;
      d.innerHTML = `<i class="${t.loading ? 'spin' : ''}" style="${t.loading ? '' : `background:${t.color}`}"></i><span>${esc(t.title)}</span><b title="Close tab">&#10005;</b>`;
      d.onclick = (e) => { if (e.target.closest('b')) closeTab(t); else select(t); };
      box.appendChild(d);
    }
    const p = document.createElement('button'); p.className = 'plus'; p.textContent = '+'; p.title = 'New tab'; p.onclick = () => newTab();
    box.appendChild(p);
    win.setTitle(`${cur ? cur.title : 'New Tab'} · Browser`);
  };
  const nav = () => { $('.back').disabled = !cur || cur.hi <= 0; $('.fwd').disabled = !cur || cur.hi >= cur.hist.length - 1; };
  const select = (t) => { cur = t; for (const x of tabs) x.pane.style.display = x === t ? '' : 'none'; url.value = t.shown || ''; renderTabs(); nav(); };
  function newTab(u) {
    const t = { id: ++uid, title: 'New Tab', color: '#9aa0a6', hist: [], hi: -1, shown: '', pane: document.createElement('div') };
    t.pane.style.cssText = 'position:absolute;inset:0'; view.appendChild(t.pane); tabs.push(t); select(t);
    if (u) go(u); else showNew(t);
    if (!u) setTimeout(() => url.focus(), 60);
    return t;
  }
  function closeTab(t) {
    const i = tabs.indexOf(t); t.pane.remove(); tabs.splice(i, 1);
    if (!tabs.length) { os.close(win); return; }
    if (cur === t) select(tabs[Math.max(0, i - 1)]); else renderTabs();
  }

  function showNew(t) {
    t.title = 'New Tab'; t.color = '#9aa0a6'; t.shown = ''; t.loading = false; if (t === cur) url.value = '';
    t.pane.innerHTML = `<div class="page"><h1>IITG<span style="color:#1a73e8">·</span>Web</h1><input class="search" placeholder="Search Google or type a web address" spellcheck="false"><div class="tiles">${HOME.map(([n, , c, a], i) => `<div class="tl" data-i="${i}">${tile(c, a)}${esc(n)}</div>`).join('')}</div>${servered() ? '' : '<div class="note"></div>'}</div>`;
    const nb = t.pane.querySelector('.note');
    if (nb) { const say = () => { nb.innerHTML = `Preview mode: ${wikiUp ? 'you can search and read <b>Wikipedia</b> here right now (type a search above). ' : ''}The whole web, iitg.ac.in and YouTube search open inside this PC when the game is started with <b>launch.bat</b>. The campus portal works now.`; }; say(); if (wikiUp === null) probeWiki().then(say); }
    const s = t.pane.querySelector('.search');
    s.onkeydown = (e) => { if (e.key === 'Enter') go(s.value); };
    t.pane.querySelectorAll('.tl').forEach((n) => (n.onclick = () => go(HOME[+n.dataset.i][1])));
    renderTabs(); nav();
  }

  /** what you typed -> where to go (a search if it is not an address) */
  function go(text, push = true) {
    const q = String(text || '').trim();
    if (!q) return;
    if (/^iitg:\/\//i.test(q)) return load(cur, q, push);
    let u;
    if (/^https?:\/\//i.test(q)) u = q;
    else if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(q)) u = `https://${q}`;
    else u = `https://www.google.com/search?igu=1&q=${encodeURIComponent(q)}`;            // searches go to Google
    let host = ''; try { host = new URL(u).hostname; } catch { /* keep */ }
    if (isYouTubeHost(host)) {                                    // YouTube has its own app on this PC
      const id = parseYouTube(u);
      os.openApp('youtube', id ? { watch: id } : (() => { try { return { q: new URL(u).searchParams.get('search_query') || '' }; } catch { return {}; } })());
      if (cur && !cur.hist.length) showNew(cur);
      os.toast('Opened in the YouTube app');
      return;
    }
    load(cur, u, push);
  }

  function load(t, u, push) {
    if (!t) return;
    if (push) { t.hist = t.hist.slice(0, t.hi + 1); t.hist.push(u); t.hi = t.hist.length - 1; }
    let host = u; try { host = new URL(u).hostname; } catch { /* internal page */ }
    t.shown = u.replace(/^https?:\/\//, '').replace(/\/$/, ''); t.title = /^iitg:/.test(u) ? 'IITG Campus Portal' : host; t.color = '#7a2630';
    if (t === cur) url.value = t.shown;
    nav();
    if (/^iitg:\/\/portal/i.test(u)) { t.loading = false; portal(t); renderTabs(); return; }
    // Google opens straight in the frame (with igu=1 it allows that, from a file or from launch.bat alike);
    // a result you click opens in the same frame - sites that refuse frames: type their address above
    if (/(^|\.)google\.[a-z.]+$/.test(host)) {
      const x = new URL(u);
      if (!x.searchParams.has('igu')) { x.searchParams.set('igu', '1'); if (x.pathname === '/' || x.pathname === '') x.pathname = '/webhp'; }
      t.title = x.searchParams.get('q') ? `${x.searchParams.get('q')} - Google Search` : 'Google'; t.color = '#4285f4';
      const f = document.createElement('iframe'); f.src = x.href; f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.allow = 'clipboard-write'; t.loading = true; renderTabs();
      f.addEventListener('load', () => { t.loading = false; renderTabs(); });
      const bad = (ev) => { if (/google/.test(ev.blockedURI || '') && f.isConnected) { document.removeEventListener('securitypolicyviolation', bad); cantShow(t, u, host); } };
      document.addEventListener('securitypolicyviolation', bad);
      t.pane.innerHTML = ''; t.pane.appendChild(f); t.frame = null;
      return;
    }
    if (!servered()) {
      // no local server: only what allows pages from anywhere works - Wikipedia's open API (search and articles)
      t.loading = true; renderTabs();
      probeWiki().then(() => wikiRoute(t, u, host)).then((ok) => { t.loading = false; if (!ok) cantShow(t, u, host); renderTabs(); if (t === cur) url.value = t.shown; });
      return;
    }
    t.loading = true; renderTabs();
    if (t === cur) { prog.style.transition = 'none'; prog.style.width = '0'; requestAnimationFrame(() => { prog.style.transition = 'width 1.6s'; prog.style.width = '70%'; }); }
    const f = document.createElement('iframe'), x = new URL(u);
    f.src = `${window.__PROXY__.path}${x.protocol.slice(0, -1)}/${x.host}${x.pathname}${x.search}`;
    f.referrerPolicy = 'no-referrer';
    f.addEventListener('load', () => { t.loading = false; renderTabs(); prog.style.transition = 'width .3s'; prog.style.width = '100%'; setTimeout(() => (prog.style.width = '0'), 400); });
    t.pane.innerHTML = ''; t.pane.appendChild(f); t.frame = f;
  }

  // ---- without the server: Wikipedia through its open, CORS-enabled API (real articles and search)
  const plain = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; };
  const banner = '<div style="background:#fff8e1;border:1px solid #f0d98a;border-radius:8px;padding:8px 12px;margin:0 0 14px;font:13px/1.5 Segoe UI,sans-serif;color:#5b4a12">Preview mode: this PC can read <b>Wikipedia</b> right now. For the whole web and YouTube search, start the game with <b>launch.bat</b>.</div>';
  async function wikiRoute(t, u, host) {
    let x; try { x = new URL(u); } catch { return false; }
    let q = null, title = null;
    if (/(^|\.)wikipedia\.org$/.test(host)) {
      const m = x.pathname.match(/^\/wiki\/(.+)$/);
      if (x.searchParams.get('search')) q = x.searchParams.get('search'); else title = m ? decodeURIComponent(m[1]) : 'Main_Page';
    } else if (/duckduckgo\.com$/.test(host) && x.searchParams.get('q')) q = x.searchParams.get('q');
    else return false;
    if (wikiUp === false) { t.pane.innerHTML = ''; return false; }
    try {
      if (q != null) {
        const r = await fetch(`${WIKI}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=15`);
        const list = (await r.json()).query.search;
        t.title = `${q} · Wikipedia`; t.shown = `wikipedia.org/search?q=${q}`;
        t.pane.innerHTML = `<div class="page" style="align-items:stretch;padding:18px 40px;gap:8px;user-select:text">${banner}<h2>Wikipedia results for “${esc(q)}”</h2>${list.length ? list.map((i) => `<div style="max-width:720px"><span class="lnk" data-w="${esc(i.title)}" style="font-size:16px">${esc(i.title)}</span><div style="font-size:13px;color:#4a5568;line-height:1.5">${esc(plain(i.snippet))}…</div></div>`).join('') : '<p>No results.</p>'}</div>`;
        t.pane.querySelectorAll('[data-w]').forEach((n) => (n.onclick = () => go(`${WIKI}/wiki/${encodeURIComponent(n.dataset.w.replace(/ /g, '_'))}`)));
      } else {
        const r = await fetch(`${WIKI}/api/rest_v1/page/html/${encodeURIComponent(title)}`);
        if (!r.ok) throw new Error(`page not found (${r.status})`);
        const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
        doc.querySelectorAll('script,style,link,meta,base,iframe,object,embed,form,input,button,noscript,video,audio,.mw-editsection,.navbox,.ambox,.hatnote,.mw-empty-elt').forEach((n) => n.remove());
        doc.querySelectorAll('img').forEach((im) => { for (const a of ['src', 'srcset']) { const v = im.getAttribute(a); if (v) im.setAttribute(a, v.replace(/(^|,\s*)\/\//g, '$1https://')); } im.removeAttribute('width'); im.removeAttribute('height'); im.loading = 'lazy'; });
        doc.querySelectorAll('a[href]').forEach((a) => {
          const h = a.getAttribute('href'); a.removeAttribute('href'); a.removeAttribute('rel'); a.removeAttribute('target');
          if (h.startsWith('./')) { const tt = decodeURIComponent(h.slice(2).split('#')[0]); if (!/^(File|Special|Help|Wikipedia|Template|Category|Talk):/.test(tt) && tt) a.dataset.w = tt; }
          else if (h.startsWith('#')) a.dataset.a = h.slice(1);
          else if (/^(https?:)?\/\//.test(h)) a.dataset.go = h.startsWith('//') ? `https:${h}` : h;
        });
        const name = title.replace(/_/g, ' ');
        t.title = `${name} · Wikipedia`; t.shown = `en.wikipedia.org/wiki/${title}`;
        t.pane.innerHTML = `<div class="wiki">${banner}<h1>${esc(name)}</h1>${doc.body.innerHTML}</div>`;
        const W = t.pane.querySelector('.wiki');
        W.querySelectorAll('[data-w]').forEach((n) => (n.onclick = (e) => { e.preventDefault(); go(`${WIKI}/wiki/${encodeURIComponent(n.dataset.w.replace(/ /g, '_'))}`); }));
        W.querySelectorAll('[data-a]').forEach((n) => (n.onclick = () => W.querySelector(`[id="${CSS.escape(n.dataset.a)}"]`)?.scrollIntoView?.({ block: 'start' })));
        W.querySelectorAll('[data-go]').forEach((n) => (n.onclick = () => go(n.dataset.go)));
      }
      return true;
    } catch (e) {
      if (/^page not found/.test(e.message)) {                     // reachable, but there is no such article
        t.title = 'Not found · Wikipedia'; t.shown = `en.wikipedia.org/wiki/${title}`;
        t.pane.innerHTML = `<div class="page"><div class="err"><h2>No Wikipedia article called “${esc(String(title).replace(/_/g, ' '))}”</h2><p>Type a search in the address bar to look for it.</p></div></div>`;
        return true;
      }
      t.pane.innerHTML = '';                                        // nothing reachable: the plain explanation
      return false;
    }
  }

  function cantShow(t, u, host) {
    const preview = /^https?:$/.test(location.protocol);
    const offline = wikiUp === false && /(wikipedia|duckduckgo)\.(org|com)$/.test(host);   // reachable in principle, but nothing gets out
    t.pane.innerHTML = `<div class="page"><div class="err"><h2>${esc(host)} can't be shown on this PC</h2>
      <p>${preview ? 'This copy of the game is running inside an online preview page, which does not allow other websites to open inside it.' : offline ? 'This copy of the game could not reach ' + esc(host) + ' (there is no internet, or requests to other sites are blocked here).' : 'This copy of the game was opened straight from a file, and websites like ' + esc(host) + ' refuse to open inside another page.'}</p>
      <p><b>To browse real websites here:</b> close this and double-click <b>launch.bat</b> in the game folder. It starts a small local server for the game, and this browser (and YouTube search) then work inside the PC.${wikiUp ? ' Until then, <b>Wikipedia</b> works: type a search in the address bar.' : ' Until then, the campus portal works without any network.'}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn pri" data-a="portal">Open the campus portal</button>${wikiUp ? '<button class="btn" data-a="wiki">Wikipedia: IIT Guwahati</button>' : ''}<button class="btn" data-a="yt">Open YouTube</button><button class="btn" data-a="ext">Open ${esc(host)} in a real browser tab &#8599;</button></div></div></div>`;
    t.pane.querySelector('[data-a="portal"]').onclick = () => go('iitg://portal');
    const wb = t.pane.querySelector('[data-a="wiki"]'); if (wb) wb.onclick = () => go('https://en.wikipedia.org/wiki/IIT_Guwahati');
    t.pane.querySelector('[data-a="yt"]').onclick = () => os.openApp('youtube');
    t.pane.querySelector('[data-a="ext"]').onclick = () => window.open(u, '_blank', 'noopener');
  }

  /** the campus portal: works without the internet, made from what the game knows */
  function portal(t) {
    const W = g.world, hostels = W.landmarks.filter((l) => l.kind === 'hostel').map((l) => l.name.replace(' Hostel', ''));
    const depts = W.pois.filter((p) => p.kind === 'dept').map((p) => p.name);
    const ev = (g.events?.today?.() || []).slice(0, 4);
    t.pane.innerHTML = `<div class="page" style="align-items:stretch;padding:20px 40px"><h1 style="align-self:center">IIT Guwahati · Campus portal</h1>
      <div class="card"><h3>About</h3><p>The Indian Institute of Technology Guwahati, the sixth IIT, was established in 1994. Its campus lies on the north bank of the Brahmaputra at North Guwahati, Assam, with lakes, hills and about 15 hostels.</p></div>
      <div class="card"><h3>Films</h3>${FILMS.map((f) => `<p><span class="lnk" data-f="${f.id}">▶ ${esc(f.title)}</span></p>`).join('')}</div>
      <div class="card"><h3>Departments</h3><p>${esc(depts.join(' · ') || 'Computer Science, Electronics, Mechanical, Civil, Chemical, Design, HSS, Physics, Chemistry, Mathematics')}</p></div>
      <div class="card"><h3>Hostels</h3><p>${esc(hostels.join(' · '))}</p></div>
      <div class="card"><h3>Useful</h3><p>Library: 8 AM – 2 AM · Hospital: emergency 24×7 · Campus bus: every 20 minutes, 7 AM – 10 PM · Canteens: 6 PM – 2 AM · Swimming pool: 6–9 AM and 4–8 PM</p></div>
      ${ev.length ? `<div class="card"><h3>Today</h3>${ev.map((e) => `<p>${esc(e.name || e.title || '')}</p>`).join('')}</div>` : ''}</div>`;
    t.pane.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => os.openApp('youtube', { watch: b.dataset.f })));
  }

  // toolbar
  $('.back').onclick = () => { if (cur && cur.hi > 0) { cur.hi--; load(cur, cur.hist[cur.hi], false); } };
  $('.fwd').onclick = () => { if (cur && cur.hi < cur.hist.length - 1) { cur.hi++; load(cur, cur.hist[cur.hi], false); } };
  $('.rel').onclick = () => { if (cur && cur.hi >= 0) load(cur, cur.hist[cur.hi], false); };
  $('.home').onclick = () => { if (cur) showNew(cur); };
  url.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(url.value); url.blur(); } };
  url.onfocus = () => url.select();
  el.querySelectorAll('.marks [data-i]').forEach((b) => (b.onclick = () => go(HOME[+b.dataset.i][1])));

  // pages tell us their title and where a click went (see the injected script in tools/serve.mjs)
  const onMsg = (e) => {
    const m = e.data; if (!m || m.src !== 'iitg-browser') return;
    const t = tabs.find((x) => x.frame && x.frame.contentWindow === e.source);
    if (!t) return;
    if (m.type === 'nav' && /^https?:/i.test(m.url)) { if (t !== cur) select(t); go(m.url); }
    if (m.type === 'title') {
      t.title = m.title || t.title;
      if (m.url && t.hi >= 0 && /^https?:/i.test(m.url)) { t.hist[t.hi] = m.url; t.shown = m.url.replace(/^https?:\/\//, '').replace(/\/$/, ''); if (t === cur) url.value = t.shown; }
      renderTabs();
    }
  };
  window.addEventListener('message', onMsg);

  newTab(args.go);
  return {
    el, onClose: () => window.removeEventListener('message', onMsg),
    onFocus: () => {},
    onArgs(a) { if (a.go) newTab(a.go); },
    onKey(e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); url.focus(); } if ((e.ctrlKey) && e.key.toLowerCase() === 't') { e.preventDefault(); newTab(); } },
  };
}

// ------------------------------------------------------------------------------------------ YouTube
const SUGGEST = ['IIT Guwahati', 'Bihu dance', 'Kaziranga rhino', 'Brahmaputra sunset', 'lofi study music', 'Assamese songs', 'Physics lectures', 'Cricket highlights'];

export function youtubeApp({ os, win, g, args, esc }) {
  const el = document.createElement('div');
  el.className = 'yt'; el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  el.innerHTML = `<div class="top"><div class="brand" title="Home"><i></i>YouTube</div><input class="q" placeholder="Search, or paste a YouTube link" spellcheck="false"><button class="go">&#128269;</button></div><div class="chips">${SUGGEST.map((s) => `<button data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div><div class="content" style="display:flex;flex-direction:column;flex:1;min-height:0"></div>`;
  const $ = (s) => el.querySelector(s), content = $('.content'), q = $('.q');
  const servered = () => !!window.__PROXY__;
  const canEmbed = () => /^https?:$/.test(location.protocol);
  let searching = 0;
  const card = (v) => `<div class="vc" data-id="${v.id}" data-t="${esc(v.title)}"><div class="th"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy" onerror="this.style.visibility='hidden'">${v.dur ? `<em>${esc(v.dur)}</em>` : ''}</div><b>${esc(v.title)}</b><small>${esc([v.by, v.views].filter(Boolean).join(' · '))}</small></div>`;
  const cards = (list) => { content.querySelectorAll('.vc').forEach((c) => (c.onclick = () => watch(c.dataset.id, c.dataset.t))); return list; };

  function feed(items, note = '') {
    content.innerHTML = `<div class="feed">${note ? `<div class="empty">${note}</div>` : ''}${items.map(card).join('')}</div>`;
    cards(items);
    win.setTitle('YouTube');
  }
  function home() {
    q.value = '';
    feed(FILMS.map((f) => ({ id: f.id, title: f.title, by: f.by })), servered() ? '' : (canEmbed() ? 'Paste a YouTube link above to play any video. (Search needs the game started with <b>launch.bat</b>.)' : 'YouTube needs the game started with <b>launch.bat</b>: double-click it in the game folder.'));
    if (servered()) search('IIT Guwahati campus', true);
  }
  async function search(text, quiet) {
    const term = String(text || '').trim();
    if (!term) return home();
    const id = parseYouTube(term);
    if (id) return watch(id, '');
    if (!quiet) q.value = term;
    if (!servered()) { feed(FILMS.map((f) => ({ id: f.id, title: f.title, by: f.by })), `Search needs the game started with <b>launch.bat</b> (a small local server). You can still paste any YouTube link above.`); return; }
    const my = ++searching;
    if (!quiet) content.innerHTML = '<div class="feed"><div class="empty">Searching…</div></div>';
    try {
      const r = await fetch(`/api/yt/search?q=${encodeURIComponent(term)}`, { credentials: 'same-origin' });
      const j = await r.json();
      if (my !== searching) return;
      if (!j.items?.length) { feed([], `No results for “${esc(term)}”${j.error ? ` (${esc(j.error)})` : ''}. Check your internet connection.`); return; }
      feed(j.items, '');
      win.setTitle(`${term} · YouTube`);
    } catch (e) {
      if (my === searching) feed([], `Could not search YouTube (${esc(String(e.message || e))}). Is the internet on?`);
    }
  }
  function watch(id, title) {
    const known = FILMS.find((f) => f.id === id);
    title = title || known?.title || '';
    content.innerHTML = `<div class="watch"><div class="player"></div><h2></h2><div style="font-size:12.5px;color:#606060" class="sub"></div></div>`;
    const P = content.querySelector('.player');
    if (!canEmbed()) P.innerHTML = '<div class="msg">YouTube videos only play when the game is opened from a web address.<br>Double-click <b>launch.bat</b> in the game folder to start it that way.</div>';
    else {
      const f = document.createElement('iframe');
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&origin=${encodeURIComponent(location.origin)}`;
      P.appendChild(f);
      const bad = (ev) => { if (/youtube/.test(ev.blockedURI || '')) P.innerHTML = '<div class="msg"><div>This online preview (claude.ai) blocks YouTube.<br>Double-click <b>launch.bat</b> in the game folder to play the game from your PC, where YouTube works.</div></div>'; };
      document.addEventListener('securitypolicyviolation', bad, { once: true });
    }
    content.querySelector('h2').textContent = title || 'YouTube video';
    content.querySelector('.sub').innerHTML = `<span class="lnk" style="color:#1a56c4;cursor:pointer">&#8592; Back to results</span>`;
    content.querySelector('.sub .lnk').onclick = () => (last ? search(last, true) : home());
    win.setTitle(`${title || 'Video'} · YouTube`);
  }
  let last = '';
  const run = (text) => { last = String(text || '').trim(); search(last); };
  $('.go').onclick = () => run(q.value);
  q.onkeydown = (e) => { if (e.key === 'Enter') run(q.value); };
  $('.brand').onclick = () => { last = ''; home(); };
  el.querySelectorAll('.chips [data-s]').forEach((b) => (b.onclick = () => run(b.dataset.s)));
  const start = (a) => { if (a.watch) watch(a.watch, a.title || ''); else if (a.q) run(a.q); else home(); };
  start(args);
  setTimeout(() => q.focus(), 80);
  return { el, onArgs: start, onClose() { content.innerHTML = ''; } };
}

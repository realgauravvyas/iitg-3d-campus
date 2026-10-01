// The Game Guide (F1) and the Info panel (I).
//
// One catalogue (guide/data.js) says, for every place, thing and system, what is there, what you can do
// and what does not work. The Guide shows all of it, searchable; the Info panel shows the entry for
// whatever you are inside, near or looking at.
import { GUIDE, STATUS, CATEGORIES, topicById, topicsByCat, allTopics, statusCounts, searchTopics, LIVE } from './data.js';
import { esc, caps } from '../menu.js';
import { closestOnRing } from '../util.js';
import { letterSpots } from '../scene/landmarks.js';

const $ = (id) => document.getElementById(id);
const ST = { works: ['ok', '✔'], partial: ['part', '◐'], no: ['no', '✕'] };

/** landmark id -> guide topic */
const LM_TOPIC = {
  admin: 'admin', auditorium: 'auditorium', conference: 'conference', library: 'library', lhc: 'lhc', academic: 'academic', core5: 'academic', workshop: 'workshop',
  sac: 'sac', newsac: 'sac', pool: 'pool', gym: 'gym', hospital: 'hospital', guesthouse: 'guesthouse', shopping: 'market', foodcourt: 'foodcourt', transit: 'transit',
  tic: 'tic', cricket: 'cricket', athletics: 'athletics', childpark: 'childpark', viewpoint: 'viewpoint', foodstalls: 'lake-stalls', lake: 'lakes', serpentine: 'lakes',
  computercentre: 'computer-centre', campuscafe: 'cafe', msh: 'hostel', techpark: 'techpark', busstop: 'bus-stop',
};
/** building kind -> guide topic (for buildings with no landmark of their own) */
const KIND_TOPIC = { hostel: 'hostel', academic: 'academic', residential: 'quarters', commercial: 'shops', guest: 'guesthouse', hospital: 'hospital', admin: 'admin', auditorium: 'auditorium', sports: 'sports-building' };
/** interior template -> guide topic */
const TPL_TOPIC = { hostel: 'hostel', canteen: 'hostel-canteen', lecture: 'lhc', school: 'kv-school', academic: 'academic', library: 'library', computer: 'computer-centre', auditorium: 'auditorium', conference: 'conference', admin: 'admin', hospital: 'hospital', gym: 'gym', sac: 'sac', foodcourt: 'foodcourt', shop: 'market', home: 'quarters', guest: 'guesthouse' };
/** field kind -> guide topic */
const FIELD_TOPIC = { tennis: 'courts', basketball: 'courts', volleyball: 'courts', soccer: 'football', hockey: 'football', athletics: 'athletics', cricket: 'cricket', park: 'childpark' };
/** stall kind / name -> guide topic */
function stallTopic(s) {
  const n = (s.name || '').toLowerCase();
  if (s.kind === 'atm') return 'atm';
  if (s.kind === 'cafe' || /caf[eé]/.test(n)) return 'cafe';
  if (/pizza/.test(n) || s.kind === 'pizzeria') return 'pizza-corner';
  if (/chai|tapri|tea/.test(n)) return 'chai-stall';
  return 'street-food';
}

export class GameGuide {
  constructor(game) {
    this.g = game;
    this.topic = 'overview';
    this.filter = 'all';
    this.q = '';
    this.infoOpen = false;
    this.infoKey = '';
    this.infoT = 0;
    this.last = null;
  }

  // ------------------------------------------------------------------ the guide window
  wire() {
    $('guide-close').onclick = () => this.g.ui.closeAll();
    $('guide-done').onclick = () => this.g.ui.closeAll();
    const q = $('guide-q');
    q.oninput = () => { this.q = q.value; this.renderList(); if (this.q.trim()) { const r = searchTopics(this.q, this.filter); if (r.length && !r.some((t) => t.id === this.topic)) { this.topic = r[0].id; this.renderMain(); } } };
    $('guide-filter').innerHTML = [['all', 'All features'], ['limits', 'Limits only']].map(([v, n]) => `<button type="button" data-f="${v}" aria-pressed="${v === 'all'}">${n}</button>`).join('');
    $('guide-filter').querySelectorAll('button').forEach((b) => (b.onclick = () => { this.filter = b.dataset.f; $('guide-filter').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); this.renderList(); this.renderMain(); }));
  }

  open(topicId) {
    const ui = this.g.ui;
    this.g.input.exitLock();
    for (const id of ['pause', 'map', 'journal', 'planner', 'tourpick', 'whatsnew', 'custom']) { const el = $(id); if (el) el.hidden = true; }
    if (topicId && topicById(topicId)) this.topic = topicId;
    $('guide').hidden = false;
    $('guide-q').value = this.q = '';
    this.filter = 'all';
    $('guide-filter').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.f === 'all')));
    this.hideInfo();
    this.renderList();
    this.renderMain();
    ui.applyAccess?.();
    $('guide-list').querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  select(id) {
    this.topic = id;
    this.renderList();
    this.renderMain();
    $('guide-main').scrollTop = 0;
  }

  renderList() {
    const list = $('guide-list');
    const q = this.q.trim();
    const hits = q ? new Set(searchTopics(q, this.filter).map((t) => t.id)) : null;
    let html = '', n = 0;
    for (const c of CATEGORIES) {
      const ts = topicsByCat(c.id).filter((t) => (!hits || hits.has(t.id)) && (this.filter === 'all' || t.auto || t.feats?.some((f) => f[0] !== 'works')));
      if (!ts.length) continue;
      html += `<div class="g-cat">${esc(c.name)}</div>`;
      for (const t of ts) {
        n++;
        const cnt = statusCounts(t);
        html += `<button type="button" class="g-item" role="option" data-t="${t.id}" aria-selected="${t.id === this.topic}"><span>${esc(t.name)}</span><span class="st">${['works', 'partial', 'no'].map((k) => (cnt[k] ? `<i class="dotc ${ST[k][0]}" title="${cnt[k]} ${STATUS[k].label.toLowerCase()}"></i>` : '')).join('')}</span></button>`;
      }
    }
    list.innerHTML = html || `<div class="g-empty">Nothing matches “${esc(q)}”. Try a place (pool, library, mess) or a thing (bicycle, boat, OneStop).</div>`;
    list.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => this.select(b.dataset.t)));
    void n;
  }

  renderMain() {
    const t = topicById(this.topic) || topicById('overview');
    const el = $('guide-main');
    el.innerHTML = t.auto ? this.autoTopic(t) : this.topicHtml(t);
    el.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => this.select(b.dataset.go)));
    const travel = el.querySelector('[data-travel]');
    if (travel) travel.onclick = () => this.travel(t);
    const infoBtn = el.querySelector('[data-here]');
    if (infoBtn) infoBtn.onclick = () => { this.g.ui.closeAll(); };
    $('guide-title').textContent = t.name;
  }

  feats(t, keepAll = false) {
    const fs = (t.feats || []).filter((f) => keepAll || this.filter === 'all' || f[0] !== 'works');
    return fs;
  }

  featRow(f) {
    const [s, text, keys, note] = f;
    const [cls, ic] = ST[s] || ST.works;
    return `<div class="feat ${cls}"><span class="si ${cls}" title="${STATUS[s]?.label || ''}">${ic}</span><div class="tx">${text}${note ? `<em>${note}</em>` : ''}</div><div class="kk">${keys ? caps(keys) : ''}</div></div>`;
  }

  topicHtml(t) {
    const cat = CATEGORIES.find((c) => c.id === t.cat);
    const live = this.liveOf(t);
    const cnt = statusCounts(t);
    const feats = this.feats(t);
    const canTravel = !!this.locate(t);
    const meta = [
      t.kicker ? `<span class="pill">${esc(t.kicker)}</span>` : '',
      t.hours ? `<span class="pill">${esc(t.hours)}</span>` : '',
      live ? `<span class="pill ${live.tone || 'live'}">${esc(live.pill)}</span>` : '',
      ...['works', 'partial', 'no'].map((k) => (cnt[k] ? `<span class="pill ${ST[k][0]}">${ST[k][1]} ${cnt[k]} ${STATUS[k].label.toLowerCase()}</span>` : '')),
    ].join('');
    const has = (t.has || []).length ? `<h3 class="g-sec">What is there</h3><div class="taglist">${t.has.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : '';
    const tips = (t.tips || []).length ? `<h3 class="g-sec">Good to know</h3><ul class="tips">${t.tips.map((x) => `<li>${x}</li>`).join('')}</ul>` : '';
    const see = (t.see || []).map(topicById).filter(Boolean);
    const seeH = see.length ? `<h3 class="g-sec">Related</h3><div class="g-cards">${see.map((s) => `<button type="button" class="g-card" data-go="${s.id}"><b>${esc(s.name)}</b><small>${esc(s.kicker || s.blurb.slice(0, 70))}</small></button>`).join('')}</div>` : '';
    return `<p class="g-kicker">${esc(cat?.name || '')}</p><h2>${esc(t.name)}</h2><p class="g-blurb">${t.blurb}</p><div class="g-meta">${meta}</div>`
      + (live?.note ? `<p class="g-blurb" style="margin-top:6px"><b>Right now:</b> ${live.note}</p>` : '')
      + (canTravel ? `<div class="g-actions"><button type="button" class="btn sm" data-travel="1">Take me there</button></div>` : '')
      + `<h3 class="g-sec">What you can do<small>✔ works · ◐ limited · ✕ not in the game</small></h3>`
      + (feats.length ? feats.map((f) => this.featRow(f)).join('') : '<p class="g-empty">Everything here works fully.</p>')
      + has + tips + seeH;
  }

  /** the two generated topics: the overview and the list of limits */
  autoTopic(t) {
    if (t.id === 'overview') {
      const c = statusCounts(null);
      const cards = CATEGORIES.filter((k) => k.id !== 'start').map((k) => {
        const ts = topicsByCat(k.id);
        return `<button type="button" class="g-card" data-go="${ts[0]?.id}"><b>${esc(k.name)}</b><small>${esc(k.blurb)} · ${ts.length} entries</small></button>`;
      }).join('');
      return `<p class="g-kicker">Start here</p><h2>${esc(t.name)}</h2><p class="g-blurb">${t.blurb}</p>`
        + `<div class="cover"><div class="ok"><b>${c.works}</b><small>things that work</small></div><div class="part"><b>${c.partial}</b><small>that work in part</small></div><div class="no"><b>${c.no}</b><small>not in the game</small></div></div>`
        + `<h3 class="g-sec">Browse by area</h3><div class="g-cards">${cards}</div>`
        + `<h3 class="g-sec">Three ways to learn about a place</h3><ul class="tips"><li>Press <kbd class="key">I</kbd> anywhere. The Info panel tells you about the building or thing you are inside, near or looking at, what you can do there and what does not work.</li><li>Press <kbd class="key">F1</kbd> for this guide, or search it above.</li><li>Open the map <kbd class="key">M</kbd> and click a place to travel there.</li></ul>`;
    }
    // limits
    let html = `<p class="g-kicker">Start here</p><h2>${esc(t.name)}</h2><p class="g-blurb">${t.blurb}</p>`;
    for (const c of CATEGORIES) for (const tp of topicsByCat(c.id)) {
      const fs = (tp.feats || []).filter((f) => f[0] !== 'works');
      if (!fs.length) continue;
      html += `<h3 class="g-sec"><button type="button" class="btn sm ghost" data-go="${tp.id}">${esc(tp.name)}</button><small>${esc(c.name)}</small></h3>${fs.map((f) => this.featRow(f)).join('')}`;
    }
    return html;
  }

  liveOf(t) {
    const f = LIVE[t.id];
    if (!f) return null;
    try { return f(this.g, this.last?.place || null); } catch { return null; }
  }

  /** where a topic is on the map (for "Take me there") */
  locate(t) {
    const w = t.where, g = this.g, W = g.world;
    if (!w) return null;
    try {
      if (w.lm) { const s = W.site(w.lm), l = W.landmark(w.lm); if (s) return { x: s.ex + s.nx * 5, z: s.ez + s.nz * 5 }; if (l) return { x: l.wx, z: l.wz }; }
      if (w.gate) { const gt = W.gates.find((q) => q.name === w.gate); if (gt) return { x: gt.wx, z: gt.wz }; }
      if (w.myHostel) { const s = W.site(g.progress.profile.hostel); if (s) return { x: s.ex + s.nx * 5, z: s.ez + s.nz * 5 }; }
      if (w.poi) { const p = W.pois.find((q) => q.name === w.poi); if (p) return { x: p.wx, z: p.wz }; }
      if (w.stall) { const st = g.stallsObj?.stalls?.find((q) => q.name === w.stall || q.kind === w.stall); if (st) return { x: st.x, z: st.z }; }
      if (w.field) { const f = W.fields.find((q) => q.kind === w.field); if (f) return { x: f.cx, z: f.cz }; }
      if (w.jetty) { const j = g.boats?.jetties?.[0]; if (j) return { x: j.x, z: j.z }; }
      if (w.busstop) { const b = g.busStandSpots?.[0]; if (b) return { x: b.x, z: b.z }; }
      if (w.lm === 'busstop') { const l = g.world.landmark('busstop'); if (l) return { x: l.wx, z: l.wz }; }
      if (w.circle) { const i = g.islands?.[0]; if (i) return { x: i.x + i.r + 4, z: i.z }; }
    } catch { /* fall through */ }
    return null;
  }
  travel(t) {
    const p = this.locate(t);
    if (!p) return;
    this.g.ui.closeAll();
    this.g.fastTravel(p.x, p.z, true);
  }

  // ------------------------------------------------------------------ the info panel
  toggleInfo() {
    if (this.infoOpen) { this.hideInfo(); return; }
    this.infoOpen = true;
    this.infoKey = '';
    this.refreshInfo(true);
  }
  hideInfo() {
    this.infoOpen = false;
    const el = $('info');
    if (el) el.hidden = true;
    document.body.classList.remove('info-open');
  }
  /** every so often while the panel is open: follow what you are near */
  update(dt) {
    if (!this.infoOpen) return;
    this.infoT -= dt;
    if (this.infoT > 0) return;
    this.infoT = 0.45;
    this.refreshInfo(false);
  }
  refreshInfo(force) {
    const res = this.identify();
    this.last = res;
    const key = `${res.id}|${res.name}|${res.prompt || ''}|${Math.floor(this.g.clock.hour * 4)}`;
    if (!force && key === this.infoKey) return;
    this.infoKey = key;
    const el = $('info');
    el.hidden = false;
    document.body.classList.add('info-open');
    el.innerHTML = this.infoHtml(res);
    el.querySelector('.i-x').onclick = () => this.hideInfo();
    el.querySelector('[data-open]').onclick = () => this.open(res.id);
  }
  infoHtml(res) {
    const t = topicById(res.id) || topicById('campus');
    const live = this.liveOf(t);
    const feats = t.feats || [];
    const MAX = 7;
    // show what works first, then the limits
    const order = [...feats.filter((f) => f[0] === 'works').slice(0, MAX - 2), ...feats.filter((f) => f[0] !== 'works').slice(0, 3)];
    const shown = order.slice(0, MAX);
    const li = (f) => { const [cls, ic] = ST[f[0]]; return `<li class="${cls}"><span class="si ${cls}">${ic}</span><span>${f[1]}${f[3] && f[0] !== 'works' ? `<br><small class="muted">${f[3]}</small>` : ''}</span><span class="kk">${f[2] ? caps(f[2]) : ''}</span></li>`; };
    const pills = [t.hours ? `<span class="pill">${esc(t.hours)}</span>` : '', live ? `<span class="pill ${live.tone || 'live'}">${esc(live.pill)}</span>` : ''].join('');
    const right = res.prompt ? `<span class="pill live">E · ${esc(res.prompt)}</span>` : '';
    return `<div class="i-top"></div><div class="i-in">`
      + `<div class="i-row"><span class="i-kind">${esc(res.kicker || t.kicker || '')}</span><button type="button" class="i-x" aria-label="Close info">✕</button></div>`
      + `<h3>${esc(res.name || t.name)}</h3>`
      + `<div class="i-pills">${right}${pills}</div>`
      + `<p class="i-blurb">${t.blurb}</p>`
      + (live?.note ? `<p class="i-blurb"><b>Now:</b> ${live.note}</p>` : '')
      + (shown.length ? `<h4>What you can do</h4><ul class="i-list">${shown.map(li).join('')}</ul>` : '')
      + (feats.length > shown.length ? `<p class="i-more">+ ${feats.length - shown.length} more in the guide</p>` : '')
      + `<div class="i-foot"><button type="button" class="btn" data-open="1">Open in guide <kbd class="kb">F1</kbd></button><span><kbd class="kb">I</kbd> closes</span></div></div>`;
  }

  // ------------------------------------------------------------------ what am I near / looking at?
  identify() {
    const g = this.g, W = g.world;
    const prompt = this.promptLabel();
    // inside a building
    if (g.interior?.active) {
      const kind = g.interior.kind, site = g.interior.site, b = g.interior.b;
      let id = TPL_TOPIC[kind] || 'building';
      if (kind === 'hostel' && site && site.lm === 'msh') id = 'hostel';
      const name = g.interior.plan?.name || g.interior.ctx?.name || '';
      return { id, name: kind === 'hostel' || kind === 'canteen' ? name : undefined, kicker: undefined, prompt, place: { kind, site, b } };
    }
    // in or on a vehicle
    const M = { bike: 'bicycle', bus: 'campus-bus', drone: 'drone', boat: 'boats', drive: 'vehicles', ride: 'vehicles', lift: 'bicycle', tour: 'tours', camera: 'camera' };
    if (M[g.mode]) return { id: M[g.mode], prompt };
    const P = g.player.pos;
    if (g.player.swimming) { const w = W.waterAt(P.x, P.z); return w?.kind === 'pool' ? { id: 'pool', prompt } : { id: 'lakes', name: w?.name || undefined, prompt }; }
    // outdoors: the best candidate among what is in front of you and what is right beside you
    const cam = g.camera, dir = cam.getWorldDirection(this._d ||= new (cam.position.constructor)());
    const fx = dir.x, fz = dir.z, fl = Math.hypot(fx, fz) || 1, ux = fx / fl, uz = fz / fl;
    const cands = [];
    const add = (id, x, z, extra = {}, reach = 30, bonus = 0) => {
      const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz);
      if (d > reach) return;
      const ang = d < 0.5 ? 0 : Math.acos(Math.max(-1, Math.min(1, (dx * ux + dz * uz) / d)));
      if (d > 6 && ang > 1.25) return;                                   // behind you or off to the side
      cands.push({ id, d, score: d * (1 + 0.6 * (ang / Math.PI)) - bonus, ...extra });
    };
    // 1. the thing E would act on right now
    const cur = g.interact?.current;
    if (cur) { const id = this.topicOfPrompt(prompt); if (id) cands.push({ id, d: 0, score: -50, prompt }); }
    // 2. the building you are looking at (a ray along the view) and the nearest wall
    for (let s = 1.5; s <= 70; s += 1.5) {
      const x = P.x + ux * s, z = P.z + uz * s;
      const b = W.buildingAt(x, z);
      if (b && b.area > 10) { const r = this.topicOfBuilding(b); cands.push({ id: r.id, name: r.name, d: s, score: s * 0.9 - 4, place: { b } }); break; }
    }
    { let best = null, bd = 9;
      const tmp = { d: 0, x: 0, z: 0 };
      for (const b of W.buildingsNear(P.x, P.z)) { if (b.area < 10) continue; const c = closestOnRing(P.x, P.z, b.rings[0], tmp); if (c.d < bd) { bd = c.d; best = b; } }
      if (best) { const r = this.topicOfBuilding(best); cands.push({ id: r.id, name: r.name, d: bd, score: bd * 1.2 - 2, place: { b: best } }); } }
    // 3. things that stand outdoors
    try {
      for (const s of g.stallsObj?.stalls || []) add(stallTopic(s), s.x, s.z, { name: s.name }, 14, 1);
      for (const gt of W.gates) if (!gt.closed) add('gates', gt.wx, gt.wz, { name: gt.name || 'Gate' }, gt.main ? 45 : 24, 1);
      for (const j of g.boats?.jetties || []) add('boats', j.x, j.z, {}, 16, 0);
      for (const s of g.busStandSpots || []) add('bus-stop', s.x, s.z, {}, 12, 0);
      for (const s of g.cycleShops?.shops || []) add('cycle-shop', s.x, s.z, { name: s.name }, 16, 1);
      for (const b of g.venues?.benches || []) add('benches', b.x, b.z, {}, 4, 0);
      for (const k of g.knock?.items || []) add('knockables', k.x, k.z, {}, 4, 0);
      for (const i of g.islands || []) add('rhino-circle', i.x, i.z, { name: i.name || 'Roundabout' }, i.r + 14, 0);
      const fs = W.flagSpot; if (fs) add('flag-lawn', fs.x, fs.z, {}, 24, 0);
      const ls = letterSpots(W); for (const sp of Object.values(ls)) add('photo-point', sp.x, sp.z, {}, 14, 0);
      const pk = g.props?.nearestParked?.(P.x, P.z, 4); if (pk) add('bicycle', pk.x, pk.z, { name: 'Cycle stand' }, 5, 1);
      const os = g.onestop?.nearest?.(4); if (os) add('onestop', os.x ?? os.wx, os.z ?? os.wz, {}, 5, 2);
      const an = g.wildlife?.feedable?.(P.x, P.z); if (an) add('wildlife', an.x, an.z, { name: an.kind === 'dog' ? 'A campus dog' : 'A campus cat' }, 4, 2);
      const f = W.sportsAt(P.x, P.z); if (f) cands.push({ id: FIELD_TOPIC[f.kind] || 'courts', d: 0, score: -2, name: f.name || undefined });
      else for (const fd of W.fields) { if (!FIELD_TOPIC[fd.kind]) continue; const d = Math.hypot(fd.cx - P.x, fd.cz - P.z); if (d < 40) { const c = closestOnRing(P.x, P.z, fd.ring, { d: 0, x: 0, z: 0 }); if (c.d < 8) add(FIELD_TOPIC[fd.kind], c.x, c.z, { name: fd.name || undefined }, 10, 0); } }
      // water
      for (const w of W.water) { if (P.x < w.x0 - 14 || P.x > w.x1 + 14 || P.z < w.z0 - 14 || P.z > w.z1 + 14) continue; const inside = W.waterAt(P.x, P.z) === w; const c = closestOnRing(P.x, P.z, w.rings[0], { d: 0, x: 0, z: 0 }); if (inside || c.d < 10) add(w.kind === 'pool' ? 'pool' : 'lakes', c.x, c.z, { name: w.name || undefined }, 12, 0); }
    } catch (e) { /* a registry is not ready: use what we have */ }
    cands.sort((a, b) => a.score - b.score);
    const best = cands[0];
    if (best) return { id: best.id, name: best.name, prompt: best.prompt || prompt, place: best.place };
    // nothing near: the part of campus you are in
    const n = W.nearestLandmark(P.x, P.z, 220);
    if (n) { const id = LM_TOPIC[n.lm.id] || (n.lm.kind === 'hostel' ? 'hostel' : 'campus'); return { id, name: n.lm.kind === 'hostel' ? n.lm.name : undefined, kicker: `Nearest: ${n.lm.name}`, prompt, place: { lm: n.lm } }; }
    return { id: 'campus', prompt };
  }

  promptLabel() {
    const c = this.g.interact?.current;
    if (!c) return '';
    try { return typeof c.label === 'function' ? c.label() : c.label || ''; } catch { return ''; }
  }

  /** what the current E prompt is about */
  topicOfPrompt(label) {
    const l = (label || '').toLowerCase();
    if (!l) return null;
    const rules = [[/bicycle|cycle stand|borrow this/, 'bicycle'], [/lift on the carrier/, 'bicycle'], [/rickshaw|buggy|the auto|taxi/, 'vehicles'], [/dog|cat/, 'wildlife'], [/take a seat|sit on the bench|sit down with them/, 'benches'],
      [/stands and watch/, 'athletics'], [/onestop|scan/, 'onestop'], [/chai|noodle|juice|order at|buy at|menu/, null]];
    for (const [re, id] of rules) if (re.test(l)) return id;
    return null;
  }

  /** a building -> its guide topic, and its name where the topic covers several (hostels, quarters) */
  topicOfBuilding(b) {
    if (b.computerCentre) return { id: 'computer-centre' };
    if (b.school) return { id: 'kv-school' };
    if (b.bungalow) return { id: 'bungalow' };
    const lm = b.site?.lm;
    if (lm && LM_TOPIC[lm]) return { id: LM_TOPIC[lm], name: LM_TOPIC[lm] === 'hostel' ? (b.site.name || b.display) : undefined };
    if (lm) { const l = this.g.world.landmark(lm); if (l?.kind === 'hostel') return { id: 'hostel', name: l.name }; }
    const id = KIND_TOPIC[b.kind];
    const nm = b.display || b.name;
    if (id) return { id, name: id === 'hostel' || id === 'quarters' ? nm : undefined };
    return { id: 'building', name: nm };
  }
}

// Game feel: a one-line objective that is always on screen (with distance and time to get there,
// Q to show the way), a short first-time walkthrough from the Main Gate, quick reward feedback
// (chime, golden flash, a burst of sparks; confetti for big milestones), and people you can talk
// to - every kind of person on campus has a few lines, and they change as you visit again.
import { FILTERS } from './route.js';
import { mealNow, nextMeal } from './interiors/templates.js';
import { fmtDist } from './util.js';
import { AN } from './crowd/people.js';
import { Talker, LINES } from './dialogue.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- dialogue
const TITLES = { guard: 'Security guard', student: 'Student', faculty: 'Professor', hod: 'Head of Department', dean: 'Dean', director: 'Director', mess: 'Mess worker', vendor: 'Stall owner', shop: 'Shopkeeper', sweeper: 'Sweeper', gardener: 'Gardener', lab: 'Lab technician', library: 'Librarian', medical: 'Hospital staff', kid: 'Child', intl: 'Exchange student', delivery: 'Delivery rider', visitor: 'Visitor', worker: 'Construction worker', auto: 'Auto driver', family: 'Resident', scholar: 'Research scholar' };

function roleOf(p) {
  if (p.title) return /Director/.test(p.title) ? 'director' : /Dean/.test(p.title) ? 'dean' : /Head/.test(p.title) ? 'hod' : 'faculty';
  if (p.role === 'staff') return { office: 'faculty', lab: 'lab', library: 'library', medical: 'medical', shop: 'shop', sweeper: 'sweeper', gardener: 'gardener', mess: 'mess' }[p.job] || 'worker';
  if (p.role === 'professor') return 'faculty';
  if (p.kind === 'guard' || p.role === 'guard') return 'guard';
  if (p.kind === 'kid' || p.kind === 'famkid' || p.kind === 'park' || p.role === 'kid') return 'kid';
  if (p.kind === 'family' || p.role === 'resident') return 'family';
  if (p.kind === 'teacher') return 'faculty';
  if (p.kind === 'outside') return p.anim === AN.SERVE ? 'vendor' : 'visitor';
  if (p.role === 'vendor') return 'vendor';
  return LINES[p.role] ? p.role : 'student';
}

export class Polish {
  constructor(game) {
    this.g = game;
    const P = game.progress;
    P.flags ||= {};
    this.flags = P.flags;
    this.track = false;                  // (kept for the saved state: the way is shown when wayPref says so, else on its own during the walkthrough)
    this.wayPref = null;                 // null: automatic · true: you pressed Q to show the way · false: you pressed Q to hide it
    this.wayOn = false;
    this.objT = 0;
    // the walkthrough: only for new players
    this.steps = [
      { id: 'move', text: 'Use <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to walk and the mouse to look around', done: () => (game.walked || 0) > 10 },
      { id: 'rhino', text: 'Walk up the road to the Rhino statue', lm: 'rhino', done: () => P.discovered.has('rhino') },
      { id: 'cycle', text: 'Borrow a cycle from a stand (<kbd>E</kbd>) or press <kbd>B</kbd> for your own', done: () => game.mode === 'bike' },
      { id: 'admin', text: 'Ride to the Administrative Building and its flag lawn', lm: 'admin', done: () => P.discovered.has('admin') },
      { id: 'planner', text: 'Press <kbd>Tab</kbd> to open the campus planner', done: () => this.flags.plannerSeen },
    ];
    this.step = this.flags.onboarded ? this.steps.length : this.flags.step || 0;
    // talk to anyone
    game.interact.provider((pos, inside) => {
      if (inside || game.mode !== 'walk' || game.activity.active) return null;
      const p = this.personNear(pos.x, pos.z);
      if (!p) return null;
      const role = roleOf(p);
      return [{ x: p.x, z: p.z, r: 2.3, prio: -0.3, label: `Talk to the ${TITLES[role].toLowerCase()}${p.title ? ` (${p.title})` : ''}`, run: () => this.talk(p, role) }];
    });
    this.talker = new Talker(game);
    this.buildFX();
  }

  // ------------------------------------------------------------ talking
  personNear(x, z) {
    const g = this.g;
    let best = null, bd = 2.3;
    const test = (p) => { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } };
    for (const p of g.life.people) if (p.state === 'travel' || p.state === 'at') { if (Math.abs(p.x - x) < 3 && Math.abs(p.z - z) < 3) test(p); }
    for (const p of g.street.people) if (p.out && Math.abs(p.x - x) < 3 && Math.abs(p.z - z) < 3) test(p);
    for (const p of g.hood.people) if (p.visible && p.near && Math.abs(p.x - x) < 3 && Math.abs(p.z - z) < 3) test(p);
    for (const p of g.commute.people) if (!p.hidden && Math.abs(p.x - x) < 3 && Math.abs(p.z - z) < 3) test(p);
    return best;
  }

  talk(p, role) {
    const g = this.g;
    p.talks = (p.talks || 0) + 1;
    let line = this.talker.say(p, LINES[role] ? role : 'student');
    if (role === 'student' && p.home && p.talks === 1) line = `I'm from ${g.world.landmark(p.home.lm)?.name || 'the hostel'}. ${line}`;
    g.ui.subtitle(`${TITLES[role]}${p.title ? ` · ${p.title}` : ''}: “${line}”`);
    // they stop and turn to you for a moment
    const yaw = Math.atan2(g.player.pos.x - p.x, g.player.pos.z - p.z);
    p.talkT = 3.5; p.talkYaw = yaw; p.pauseT = Math.max(p.pauseT || 0, 3.5); p.stopT = Math.max(p.stopT || 0, 3.5);
    if (p.kind) { p.yaw = yaw; p.anim = AN.TALK; }
    g.progress.count?.('chats');
    if ((g.progress.stats.chats || 0) >= 10) g.progress.unlock?.('chatty');
  }

  // ------------------------------------------------------------ objectives
  current() {
    const g = this.g, P = g.progress, c = g.clock, h = c.hour, W = g.world;
    if (this.step < this.steps.length) { const s = this.steps[this.step]; const l = s.lm && W.landmark(s.lm); return { text: s.text, x: l?.wx, z: l?.wz, guide: true }; }
    if (g.transport?.myOrder) { const v = g.transport.myOrder; return { text: `Collect your ${v.order.item} from the rider at the ${v.dest.name} gate`, x: v.dest.x, z: v.dest.z }; }
    const ev = g.events?.next?.();
    if (ev && ev.inHours < 1.5) return { text: `${ev.d.name} at ${fmtH(ev.d.from)} · ${ev.d.where}`, x: g.events.live?.get?.(ev.d)?.p?.x, z: g.events.live?.get?.(ev.d)?.p?.z };
    const cur = g.events?.current?.();
    if (cur) return { text: `Live now: ${cur.name} · ${cur.where}` };
    const meal = mealNow(h), home = W.site(P.profile.hostel);
    if (meal && home && !this.flags[`ate:${c.day}:${meal.id}`]) return { text: `${meal.name} at your hostel mess (till ${fmtH(meal.to)})`, x: home.ex, z: home.ez };
    if (!c.weekend && ((h > 8.8 && h < 12.9) || (h > 13.9 && h < 17))) { const l = W.site('lhc'); return { text: 'Attend a lecture at the Lecture Hall Complex', x: l?.ex, z: l?.ez }; }
    const nx = W.landmarks.filter((l) => !P.discovered.has(l.id)).map((l) => ({ l, d: Math.hypot(l.wx - g.player.pos.x, l.wz - g.player.pos.z) })).sort((a, b) => a.d - b.d)[0];
    if (nx) return { text: `Discover: ${nx.l.name}`, x: nx.l.wx, z: nx.l.wz };
    const nm = nextMeal(h);
    return { text: `Free time! ${nm.name} is at ${fmtH(nm.from)} · press <kbd>Tab</kbd> for events and jobs` };
  }

  update(dt) {
    const g = this.g;
    // walkthrough progress
    if (this.step < this.steps.length && this.steps[this.step].done()) {
      this.step++; this.flags.step = this.step;
      this.reward(false);
      if (this.step >= this.steps.length) { this.flags.onboarded = true; g.ui.toast('You are all set! The campus is yours to explore.', 'gold', 'Welcome to IITG'); this.reward(true); }
      g.progress.save();
    }
    if (g.input.hit?.('KeyQ') && g.mode === 'walk') {
      // Q toggles what you can see: the walkthrough shows the way by itself, and a Q hides it (and keeps it hidden) until the next Q
      this.wayPref = !this.wayOn; this.track = this.wayPref;
      if (!this.wayPref) g.guide.clear();
      this.objT = 0;
    }
    this.objT -= dt;
    if (this.objT > 0) return;
    this.objT = 1;
    const el = $('objective');
    const busy = ['bus', 'tour', 'drone', 'custom', 'drive', 'boat'].includes(g.mode) || g.activity.exclusive || g.challengeRun?.active || g.bikeTour?.active || g.mode === 'title';
    if (!el) return;
    if (busy) { el.hidden = true; return; }
    const o = this.current();
    let meta = '';
    if (o.x != null && !g.interior?.active) {
      const P = g.player.pos, G = g.graph;
      const a = G.nearestNode(P.x, P.z, FILTERS.walk, true), b = G.nearestNode(o.x, o.z, FILTERS.walk, true);
      const path = a >= 0 && b >= 0 ? G.path(a, b, FILTERS.walk, this._pc ||= {}) : null;
      const d = (path ? path.len : Math.hypot(o.x - P.x, o.z - P.z)) + 10;
      const sp = g.mode === 'bike' ? 5 : 1.4;
      const min = Math.max(1, Math.round(d / sp / 60));
      meta = ` <span class="meta">${fmtDist(d)} · ~${min} min ${g.mode === 'bike' ? 'by cycle' : 'on foot'}</span>`;
      this.wayOn = this.wayPref != null ? this.wayPref : !!o.guide;
      if (this.wayOn) { if (!g.guide.target || Math.hypot(g.guide.target.x - o.x, g.guide.target.z - o.z) > 5) g.guide.set(o.x, o.z, 'objective'); }
      else if (g.guide.target?.name === 'objective') g.guide.clear();                 // (only the way to this objective: other guides, a delivery's, stay)
    }
    el.hidden = false;
    el.innerHTML = `<b>▸</b> ${o.text}${meta}${o.x != null ? ` <span class="meta"><kbd>Q</kbd> ${this.wayOn ? 'hide' : 'show'} the way</span>` : ''}`;
    if (Object.keys(this._pc || {}).length > 40) this._pc = {};
  }

  // ------------------------------------------------------------ reward feedback
  buildFX() {
    const f = document.createElement('div'); f.id = 'fxflash'; document.body.appendChild(f);
    const b = document.createElement('div'); b.id = 'fxburst'; document.body.appendChild(b);
    this.flashEl = f; this.burstEl = b;
  }
  reward(big = false) {
    const g = this.g;
    g.audio.reward?.(big);
    this.flashEl.classList.remove('on'); void this.flashEl.offsetWidth; this.flashEl.classList.add('on');
    const n = big ? 70 : 16, cols = big ? ['#ff9933', '#ffffff', '#138808', '#f2c12e', '#e38aa0', '#4f93c9'] : ['#f2c12e', '#ffe08a', '#ffffff'];
    for (let k = 0; k < n; k++) {
      const s = document.createElement('i');
      const a = Math.random() * Math.PI * 2, d = (big ? 180 : 70) + Math.random() * (big ? 260 : 60);
      s.style.setProperty('--dx', `${Math.cos(a) * d}px`); s.style.setProperty('--dy', `${Math.sin(a) * d + (big ? 200 : 0)}px`);
      s.style.background = cols[k % cols.length];
      s.style.animationDuration = `${big ? 1.6 + Math.random() * 0.8 : 0.55}s`;
      if (big) { s.style.width = '8px'; s.style.height = '12px'; s.style.transform = `rotate(${Math.random() * 180}deg)`; }
      this.burstEl.appendChild(s);
      setTimeout(() => s.remove(), big ? 2600 : 700);
    }
  }
}

function fmtH(h) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh >= 12 && hh < 24 ? 'PM' : 'AM'}`; }

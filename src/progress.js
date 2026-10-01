import * as THREE from 'three';
import { makeChai } from './models.js';
import { mulberry32, pointInRing } from './util.js';

const KEY = 'iitg3d.save.v1';

export const ACHIEVEMENTS = [
  { id: 'first_steps', name: 'Fresher', desc: 'Take your first walk on campus' },
  { id: 'gatepass', name: 'Digital campus', desc: 'Scan in at a gate with the OneStop app' },
  { id: 'first_ride', name: 'Two wheels', desc: 'Ride your bicycle' },
  { id: 'rider', name: 'Cycle commuter', desc: 'Cycle 2 km around campus' },
  { id: 'explorer', name: 'Explorer', desc: 'Discover 20 landmarks' },
  { id: 'completionist', name: 'Every corner', desc: 'Discover every landmark' },
  { id: 'hostel_hopper', name: 'Hostel hopper', desc: 'Visit every hostel' },
  { id: 'bus_tour', name: 'Grand tour', desc: 'Ride the full campus bus tour' },
  { id: 'bike_tour', name: 'Guided rider', desc: 'Finish a cycle tour of the campus' },
  { id: 'sunset_photo', name: 'Golden hour', desc: 'Photograph the sunset (or sunrise) over the campus' },
  { id: 'chatty', name: 'Friendly face', desc: 'Chat with 10 people on campus' },
  { id: 'foodie', name: 'Midnight cravings', desc: 'Get food delivered to your hostel gate' },
  { id: 'animal_friend', name: 'Campus friend', desc: 'Feed a campus dog or cat' },
  { id: 'new_cycle', name: 'Wheels of my own', desc: 'Buy a new cycle at a cycle shop' },
  { id: 'walk_tour', name: 'On foot, every step', desc: 'Finish the walking tour' },
  { id: 'drone_tour', name: "Bird's-eye view", desc: 'Finish the drone tour' },
  { id: 'drone_high', name: "Bird's-eye view", desc: 'Fly the drone 150 m above the ground' },
  { id: 'serpentine', name: 'Over the Serpentine', desc: 'Fly the drone over Serpentine Lake' },
  { id: 'late_class', name: 'Made it to class', desc: 'Beat the "Late for class" challenge' },
  { id: 'roof', name: 'Rooftop view', desc: 'Stand on a rooftop' },
  { id: 'swim', name: 'Unofficial swim', desc: 'Take a dip in a campus lake (only in the game!)' },
  { id: 'pool', name: 'Lap swimmer', desc: 'Swim in the institute pool' },
  { id: 'night_owl', name: 'Night owl', desc: 'Explore the campus at night' },
  { id: 'bells', name: 'Tring tring', desc: 'Ring your bicycle bell 10 times' },
  { id: 'mess_5', name: 'Mess regular', desc: 'Eat 5 meals at a hostel mess' },
  { id: 'class_3', name: 'Front bencher', desc: 'Attend 3 lectures' },
  { id: 'exam', name: 'Survived end-sem', desc: 'Write an exam' },
  { id: 'topper', name: 'Topper', desc: 'Score 90% or more in an exam' },
  { id: 'lab', name: 'Lab rat', desc: 'Finish a lab experiment' },
  { id: 'bookworm', name: 'Bookworm', desc: 'Study 3 times in the Central Library' },
  { id: 'six', name: 'Maximum!', desc: 'Hit a six in a cricket match' },
  { id: 'goal', name: 'Back of the net', desc: 'Score a goal in a football match' },
  { id: 'hoops', name: 'Swish', desc: 'Make 5 baskets in one shootout' },
  { id: 'sprint', name: 'Fastest on campus', desc: 'Win a sprint on the athletics track' },
  { id: 'delivery', name: 'Hot and on time', desc: 'Deliver a pizza on time' },
  { id: 'rescue', name: 'First responder', desc: 'Bring a patient to the IITG Hospital' },
  { id: 'rich', name: 'Saving up', desc: 'Have ₹20,000 in your wallet' },
  { id: 'shopper', name: 'Market regular', desc: 'Buy something at the Market Complex' },
  { id: 'concert', name: 'Pronite', desc: 'Dance at a concert on the cricket ground' },
  { id: 'orientation', name: 'Welcome aboard', desc: 'Attend the freshers\' orientation' },
  { id: 'graduate', name: 'Tassel turned', desc: 'Attend the convocation' },
  { id: 'club', name: 'Club life', desc: 'Take part in a club activity' },
  { id: 'photo', name: 'Shutterbug', desc: 'Take 10 photos' },
  { id: 'boat', name: 'Boat club', desc: 'Row a boat across a lake' },
  { id: 'viewpoint', name: 'On top of the world', desc: 'Watch the view from the View Point' },
  { id: 'wildlife', name: 'Nature watcher', desc: 'Spot 6 different animals on campus' },
  { id: 'movie', name: 'Movie night', desc: 'Watch a film in the auditorium' },
  { id: 'gym', name: 'Gym rat', desc: 'Finish a workout in the gym' },
  { id: 'sleep', name: 'Power nap', desc: 'Sleep in your hostel room' },
  { id: 'rain', name: 'Monsoon walker', desc: 'Walk in the rain' },
];

export const RANKS = [
  { xp: 0, name: 'Fresher' }, { xp: 300, name: 'Sophomore' }, { xp: 900, name: 'Junior' },
  { xp: 1800, name: 'Senior' }, { xp: 3200, name: 'Final year' }, { xp: 5200, name: 'Campus legend' },
];

/** Indian rupees with Indian digit grouping: ₹10,000 · ₹1,25,000 */
export const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const FRIENDS = ['Rahul', 'Ananya', 'Bikash', 'Priya', 'Arjun', 'Rituparna', 'Kabir', 'Meghna'];
export const LOAN_LIMIT = 20000;
/** the credit card's limit: `bank` is how much of it is left to spend */
export const CREDIT_LIMIT = 25000;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export class Progress {
  constructor(game) {
    this.g = game;
    const s = load();
    this.discovered = new Set(s.discovered || []);
    this.chaiFound = new Set(s.chai || []);
    this.flags = s.flags || {};
    this.lastPos = s.pos || null;
    this.ach = new Set(s.ach || []);
    this.stats = { bikeDist: 0, busDist: 0, bells: 0, nightTime: 0, ...(s.stats || {}) };
    this.look = s.look || null;
    this.settings = { quality: 'medium', volume: 0.8, weather: 'auto', crowd: 1, relaxed: false, fov: 62, sens: 1, invertY: false, ...(s.settings || {}) };
    this.best = s.best || {};
    this.clock = s.clock || null;
    // money (Indian rupees): cash in your wallet (`coins` is the old GCoins field, kept so saves load),
    // a credit card with a Rs 25,000 limit (`bank` = the part of the limit left; pocket money from home
    // pays the card back) and loans from friends
    this.coins = s.coins ?? 10000;
    this.bank = s.bank ?? CREDIT_LIMIT;
    if (this.bank > CREDIT_LIMIT) { this.coins += this.bank - CREDIT_LIMIT; this.bank = CREDIT_LIMIT; }   // old debit-card saves
    this.debt = s.debt ?? 0;
    this.lender = s.lender || null;
    this.payPref = s.payPref || 'cash';
    if ((s.money || 0) < 2) this.coins = Math.max(this.coins, 10000);   // GCoins became rupees: every wallet starts at ₹10,000
    this.energy = s.energy ?? 80;
    this.xp = s.xp ?? 0;
    this.grades = s.grades || [];        // [{what, pct}] -> CPI
    this.inv = new Set(s.inv || []);
    this.profile = { name: 'Gaurav', branch: 'Data Science & AI', hostel: 'brahmaputra', ...(s.profile || {}) };
    this.gateLog = s.gateLog || [];        // the old Gate Pass history (OneStop imports it once)
    this.onestop = s.onestop || null;      // OneStop: entries with in / out times, a destination chosen in the app
    this.loans = s.loans || [];               // library books: {title, day, due}
    this.coupons = s.coupons || [];         // mess coupons: {id, meal, hostel, price, day, method, used}
    this.lastPocket = s.lastPocket ?? -1;
    this.seen = new Set(s.seen || []);   // animals spotted
    this.chai = [];
    this.saveT = 0;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        discovered: [...this.discovered], chai: [...this.chaiFound], ach: [...this.ach], stats: this.stats,
        look: this.look, settings: this.settings, best: this.best, clock: this.g.clock ? this.g.clock.save() : this.clock,
        coins: this.coins, bank: this.bank, debt: this.debt, lender: this.lender, payPref: this.payPref, money: 2, energy: this.energy, xp: this.xp, grades: this.grades.slice(-40), inv: [...this.inv], profile: this.profile,
        gateLog: this.gateLog.slice(0, 120), onestop: this.onestop, coupons: this.coupons.slice(-12), loans: this.loans.slice(0, 3), lastPocket: this.lastPocket, seen: [...this.seen], flags: this.pruneFlags(), pos: this.posNow(),
      }));
    } catch { /* storage unavailable: progress lasts for this session */ }
  }

  /** keep only recent 'ate' markers */
  pruneFlags() {
    const d = this.g.clock?.day ?? 0;
    for (const k of Object.keys(this.flags || {})) if (k.startsWith('ate:') && +k.split(':')[1] < d - 1) delete this.flags[k];
    return this.flags;
  }
  /** where you are (to continue from there next time) */
  posNow() {
    const g = this.g, p = g.player;
    if (!p || g.mode === 'title' || g.interior?.active || !g.world?.insideCampus(p.pos.x, p.pos.z)) return this.lastPos;
    this.lastPos = [Math.round(p.pos.x * 10) / 10, Math.round(p.pos.z * 10) / 10, Math.round(p.heading * 100) / 100];
    return this.lastPos;
  }

  reset() {
    this.discovered.clear(); this.chaiFound.clear(); this.ach.clear();
    this.stats = { bikeDist: 0, busDist: 0, bells: 0, nightTime: 0 };
    this.best = {};
    this.coins = 10000; this.bank = CREDIT_LIMIT; this.debt = 0; this.lender = null; this.energy = 80; this.xp = 0; this.grades = []; this.inv.clear(); this.seen.clear();
    for (const c of this.chai) c.obj.group.visible = true;
    this.save();
  }

  // ------------------------------------------------------------ career
  get rank() { let r = RANKS[0]; for (const k of RANKS) if (this.xp >= k.xp) r = k; return r; }
  get nextRank() { return RANKS.find((k) => k.xp > this.xp) || null; }
  get cpi() {
    if (!this.grades.length) return null;
    return Math.round((this.grades.reduce((s, g) => s + g.pct, 0) / this.grades.length / 10) * 100) / 100;
  }
  addXP(n, why = '') {
    const before = this.rank.name;
    this.xp += Math.round(n);
    this.g.ui?.floatText?.(`+${Math.round(n)} XP${why ? ' · ' + why : ''}`, 'xp');
    if (this.rank.name !== before) {
      this.g.ui?.toast(`You are now a ${this.rank.name}!`, 'gold', 'Rank up');
      this.g.audio?.achievement();
    }
    this.save();
  }
  earn(n, why = '', toBank = false) {
    n = Math.round(n);
    // money "to the bank" pays the credit card back first; the rest is cash
    const toCard = toBank ? Math.min(n, CREDIT_LIMIT - this.bank) : 0;
    this.bank += toCard; this.coins += n - toCard;
    this.g.ui?.floatText?.(`+${rupees(n)}${why ? ' · ' + why : ''}${toCard ? ' · card bill paid' : ''}`, 'coin');
    this.g.audio?.coins?.();
    if (this.coins >= 20000) this.unlock('rich');
    this.save();
  }
  /** Pay n rupees: cash or card (your choice, falling back to the other), then both together.
   *  Only when cash + card cannot cover it does it ask to borrow from a friend; `retry` is run
   *  again after borrowing so the purchase goes through. Returns true if paid now. */
  spend(n, why = '', retry = null) {
    n = Math.round(n);
    if (n <= 0) return true;
    let cash = 0, card = 0;
    if (this.payPref === 'card' && this.bank >= n) card = n;
    else if (this.coins >= n) cash = n;
    else if (this.bank >= n) card = n;
    else if (this.coins + this.bank >= n) { cash = this.coins; card = n - cash; }
    else { this.g.ui?.payShort?.(n, why, retry); return false; }
    this.coins -= cash; this.bank -= card;
    const how = cash && card ? 'cash + card' : card ? (this.payPref === 'card' ? 'card' : 'card (not enough cash)') : '';
    this.g.ui?.floatText?.(`-${rupees(n)}${why ? ' · ' + why : ''}${how ? ' · ' + how : ''}`, 'coin');
    this.save();
    return true;
  }
  /** pay a fixed way: 'cash' takes it from your wallet, 'upi' from the account behind your card (OneStop).
   *  Returns true if paid; nothing is taken otherwise */
  payWith(method, n, why = '') {
    n = Math.round(n);
    if (n <= 0) return true;
    if (method === 'cash') { if (this.coins < n) return false; this.coins -= n; }
    else { if (this.bank < n) return false; this.bank -= n; }
    this.g.ui?.floatText?.(`-${rupees(n)}${why ? ' · ' + why : ''} · ${method === 'cash' ? 'cash' : 'UPI'}`, 'coin');
    this.g.audio?.coins?.();
    this.save();
    return true;
  }
  // ------------------------------------------------------------ mess coupons
  /** a coupon that is good for this meal, today, at this hostel's mess */
  couponFor(hostel, mealId) {
    const day = this.g.clock?.day ?? 0;
    return this.coupons.find((c) => !c.used && c.hostel === hostel && c.meal === mealId && c.day === day) || null;
  }
  addCoupon(c) {
    const day = this.g.clock?.day ?? 0;
    this.coupons = this.coupons.filter((x) => !x.used && x.day >= day - 1);
    const k = { id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, day, used: false, ...c };
    this.coupons.push(k);
    this.save();
    return k;
  }
  /** can the wallet + card cover it? (for greying out options) */
  canPay(n) { return this.coins + this.bank >= n; }
  borrow(n) {
    n = Math.min(Math.round(n), LOAN_LIMIT - this.debt);
    if (n <= 0) return 0;
    if (!this.lender) this.lender = FRIENDS[Math.floor(Math.random() * FRIENDS.length)];
    this.debt += n; this.coins += n;
    this.g.ui?.floatText?.(`+${rupees(n)} borrowed from ${this.lender}`, 'coin');
    this.save();
    return n;
  }
  /** pay a friend back (cash first, then card) */
  repay(n = this.debt) {
    n = Math.min(Math.round(n), this.debt);
    if (n <= 0 || this.coins + this.bank < n) return false;
    const cash = Math.min(this.coins, n);
    this.coins -= cash; this.bank -= n - cash;
    this.debt -= n;
    this.g.ui?.floatText?.(`-${rupees(n)} · paid back ${this.lender}`, 'coin');
    if (this.debt <= 0) { this.debt = 0; this.g.ui?.toast(`All square with ${this.lender}. "Anytime, yaar!"`, 'info', 'Loan repaid'); this.lender = null; }
    this.save();
    return true;
  }
  /** cash from the ATM on the credit card (uses up some of the limit) */
  withdraw(n) {
    n = Math.min(Math.round(n), this.bank);
    if (n <= 0) return 0;
    this.bank -= n; this.coins += n;
    this.g.ui?.floatText?.(`+${rupees(n)} cash from the ATM (credit card)`, 'coin');
    this.save();
    return n;
  }
  /** pay the credit card bill from cash: the limit comes back */
  payCard(n = CREDIT_LIMIT - this.bank) {
    n = Math.min(Math.round(n), CREDIT_LIMIT - this.bank, this.coins);
    if (n <= 0) return 0;
    this.coins -= n; this.bank += n;
    this.g.ui?.floatText?.(`-${rupees(n)} · credit card bill paid`, 'coin');
    this.save();
    return n;
  }
  eat(energy, what = '') {
    this.energy = Math.min(100, this.energy + energy);
    if (what) this.g.ui?.floatText?.(`+${energy} energy · ${what}`, 'energy');
    this.save();
  }
  tire(n) {
    if (this.settings.relaxed) return;
    this.energy = Math.max(0, this.energy - n);
  }
  grade(what, pct) {
    this.grades.push({ what, pct: Math.round(pct) });
    this.save();
  }
  /** weekly pocket money from home, collected at the ATM */
  pocketMoneyDue(clock) { return Math.floor(clock.day / 7) > this.lastPocket || this.lastPocket < 0; }
  collectPocket(clock) { this.lastPocket = Math.floor(clock.day / 7); this.earn(3000, 'pocket money from home', true); }

  unlock(id) {
    if (this.ach.has(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.ach.add(id);
    this.g.ui.achievement(a);
    this.g.audio.achievement();
    this.g.polish?.reward(true);
    this.xp += 40;
    this.save();
  }

  count(name, n = 1) {
    this.stats[name] = (this.stats[name] || 0) + n;
    const v = this.stats[name];
    if (name === 'bells' && v >= 10) this.unlock('bells');
    if (name === 'meals' && v >= 5) this.unlock('mess_5');
    if (name === 'lectures' && v >= 3) this.unlock('class_3');
    if (name === 'study' && v >= 3) this.unlock('bookworm');
    if (name === 'photos' && v >= 10) this.unlock('photo');
    return v;
  }

  addStat(name, v) {
    this.stats[name] = (this.stats[name] || 0) + v;
    if (name === 'bikeDist' && this.stats.bikeDist > 2000) this.unlock('rider');
    if (name === 'nightTime' && this.stats.nightTime > 90) this.unlock('night_owl');
    if (name === 'rainTime' && this.stats.rainTime > 30) this.unlock('rain');
  }

  spot(kind) {
    if (this.seen.has(kind)) return false;
    this.seen.add(kind);
    if (this.seen.size >= 6) this.unlock('wildlife');
    this.save();
    return true;
  }

  discover(lm, silent = false) {
    if (this.discovered.has(lm.id)) return false;
    this.discovered.add(lm.id);
    if (!silent) { this.g.ui.discovered(lm, this.discovered.size, this.g.world.landmarks.length); this.g.audio.discover(); this.g.polish?.reward(false); }
    this.xp += 15;
    const W = this.g.world;
    if (this.discovered.size >= 20) this.unlock('explorer');
    if (W.landmarks.every((l) => this.discovered.has(l.id))) this.unlock('completionist');
    if (W.landmarks.filter((l) => l.kind === 'hostel').every((l) => this.discovered.has(l.id))) this.unlock('hostel_hopper');
    this.save();
    return true;
  }

  discoverNear(x, z, r = 32) {
    for (const lm of this.g.world.landmarks) {
      if (this.discovered.has(lm.id)) continue;
      const b = this.g.world.buildingAt(lm.wx, lm.wz);
      const rr = b ? r + Math.sqrt(b.area) * 0.45 : r;
      if (Math.hypot(lm.wx - x, lm.wz - z) < rr) this.discover(lm);
    }
  }

  // ------------------------------------------------------------ kulhad chai collectibles
  placeChai() {
    const W = this.g.world;
    const rnd = mulberry32(1729);
    const spots = [];
    const ok = (x, z) => W.insideCampus(x, z) && W.distToBoundary(x, z) > 6 && !W.buildingAt(x, z) && !W.waterAt(x, z);
    const lms = W.landmarks.slice().sort(() => rnd() - 0.5).slice(0, 12);
    for (const l of lms) {
      for (let t = 0; t < 30; t++) {
        const a = rnd() * Math.PI * 2, d = 14 + rnd() * 20;
        const x = l.wx + Math.cos(a) * d, z = l.wz + Math.sin(a) * d;
        if (ok(x, z)) { spots.push({ x, z, y: W.heightAt(x, z) + 1.3, hint: `near ${l.name}` }); break; }
      }
    }
    const roofs = W.buildings.filter((b) => b.name && b.area > 700).sort(() => rnd() - 0.5).slice(0, 5);
    for (const b of roofs) {
      for (let t = 0; t < 40; t++) {
        const x = b.x0 + rnd() * (b.x1 - b.x0), z = b.z0 + rnd() * (b.z1 - b.z0);
        if (W.buildingAt(x, z) === b) { spots.push({ x, z, y: b.roof + 1.3, hint: `on the roof of ${b.name}` }); break; }
      }
    }
    const t = W.terrain;
    const peaks = [];
    for (let j = 2; j < t.ny - 2; j += 3)
      for (let i = 2; i < t.nx - 2; i += 3) {
        const x = t.minx + i * t.cell, z = -(t.miny + j * t.cell);
        if (!ok(x, z)) continue;
        peaks.push({ x, z, h: W.H[j * t.nx + i] });
      }
    peaks.sort((a, b) => b.h - a.h);
    const hills = [];
    for (const p of peaks) {
      if (hills.length >= 3) break;
      if (hills.every((q) => Math.hypot(q.x - p.x, q.z - p.z) > 250)) hills.push(p);
    }
    for (const p of hills) spots.push({ x: p.x, z: p.z, y: p.h + 1.5, hint: 'on a forested hilltop' });
    const lakes = W.water.filter((w) => w.kind !== 'pool').slice(0, 4);
    for (const w of lakes) {
      const r = w.rings[0];
      for (let k = 0; k < 20; k++) {
        const i = Math.floor(rnd() * (r.length / 2)) * 2;
        const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2;
        const dx = r[i] - cx, dz = r[i + 1] - cz, L = Math.hypot(dx, dz) || 1;
        const x = r[i] + (dx / L) * 4, z = r[i + 1] + (dz / L) * 4;
        if (ok(x, z) && !pointInRing(x, z, r)) { spots.push({ x, z, y: W.heightAt(x, z) + 1.3, hint: `beside ${w.name || 'a lake'}` }); break; }
      }
    }
    spots.forEach((s, i) => {
      const obj = makeChai();
      obj.group.position.set(s.x, s.y, s.z);
      obj.group.userData.baseY = s.y;
      obj.group.visible = !this.chaiFound.has(i);
      this.g.scene.add(obj.group);
      this.chai.push({ ...s, id: i, obj });
    });
  }

  collectNear(pos, r = 2.2) {
    for (const c of this.chai) {
      if (this.chaiFound.has(c.id)) continue;
      const dy = Math.abs(pos.y + 0.9 - c.obj.group.position.y);
      if (Math.hypot(c.x - pos.x, c.z - pos.z) < r && dy < r + 1.2) {
        this.chaiFound.add(c.id);
        c.obj.group.visible = false;
        this.g.audio.collect();
        this.g.ui.toast(`Kulhad chai found! ${this.chaiFound.size}/${this.chai.length} · +10 energy`, 'gold');
        this.eat(10);
        this.xp += 10;
        if (this.chaiFound.size >= 10) this.unlock('chai_10');
        if (this.chaiFound.size >= this.chai.length) this.unlock('chai_all');
        this.save();
      }
    }
  }

  nearestChai(x, z) {
    let best = null, bd = Infinity;
    for (const c of this.chai) {
      if (this.chaiFound.has(c.id)) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best ? { c: best, d: bd } : null;
  }

  update(dt, cam) {
    for (const c of this.chai) {
      if (!c.obj.group.visible) continue;
      if (cam.position.distanceToSquared(c.obj.group.position) < 250 * 250) c.obj.update(dt);
    }
    this.saveT += dt;
    if (this.saveT > 20) { this.saveT = 0; this.save(); }
  }
}
export { THREE };

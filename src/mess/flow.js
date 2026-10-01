// The hostel mess at meal time: students come in, pay at the counter (or show the mess card), take a
// steel plate, queue at the serving counter, get served, carry the plate to a table, eat, some go
// back for more, return the plate and leave. Everyone is an agent that walks along the aisles;
// the tables and benches are never crossed. Coordinates are the hostel interior's own (x across,
// z from the back wall to the entrance door).
import { AN } from '../crowd/people.js';
import { OPT, bit } from '../crowd/looks.js';

/** where everything is (the hostel template builds the furniture at exactly these places) */
export const LAY = {
  door: { x: 0, z: 13.9 },
  desk: { x: -8.6, z: 9.6, w: 2.2 },                       // payment counter (the clerk stands north of it, the queue is south)
  clerk: { x: -8.6, z: 8.85 },
  payQ: (k) => ({ x: -8.6 + 0.9 * k, z: 10.5, yaw: k ? -Math.PI / 2 : Math.PI }),
  payQN: 6,
  plates: { x: -12.6, z: 7.9, w: 2.0 },                    // the stack of steel plates
  platesAt: { x: -12.6, z: 8.75, yaw: Math.PI },
  serveQ: (k) => ({ x: -15.3 + 0.85 * k, z: -11.3, yaw: Math.PI }),
  serveQN: 8,
  ret: { x: -16.45, z: -0.6 },                             // the plate-return rack by the west wall
  retAt: { x: -15.75, z: -0.6, yaw: -Math.PI / 2 },
  cols: { A: -16.3, M: -10.75 },                           // the west aisle and the middle aisle
  rows: [-8.7, -4.3, 0.1, 4.5, 8.9],                       // the corridors between the table rows
};

const WALK = 1.15;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** the corridor graph: 2 aisles x 5 cross corridors */
const NODES = [];
for (const [c, x] of Object.entries(LAY.cols)) LAY.rows.forEach((z, i) => NODES.push({ id: `${c}${i}`, c, i, x, z }));
const node = (c, i) => NODES.find((n) => n.c === c && n.i === i);
function nearestNode(p) { let b = null, bd = Infinity; for (const n of NODES) { const d = dist(n, p); if (d < bd) { bd = d; b = n; } } return b; }
/** shortest way between two nodes along the aisles and cross corridors (a tiny BFS) */
function nodePath(a, b) {
  if (a === b) return [a];
  const seen = new Map([[a.id, null]]), q = [a];
  while (q.length) {
    const n = q.shift();
    if (n === b) break;
    const nb = [node(n.c === 'A' ? 'M' : 'A', n.i), n.i > 0 && node(n.c, n.i - 1), n.i < LAY.rows.length - 1 && node(n.c, n.i + 1)].filter(Boolean);
    for (const m of nb) if (!seen.has(m.id)) { seen.set(m.id, n); q.push(m); }
  }
  const out = [];
  for (let n = b; n; n = seen.get(n.id)) out.unshift(n);
  return out;
}
/** the corridor row (index) that gives access to a seat, and the point in it */
export function seatAccess(seat, plan) {
  // the seat's table row is the nearest row centre; the seat faces its table: yaw 0 => north-side bench => corridor above it
  const rowsZ = [-6.5, -2.1, 2.3, 6.7];
  let r = 0; for (let k = 1; k < rowsZ.length; k++) if (Math.abs(seat.z - rowsZ[k]) < Math.abs(seat.z - rowsZ[r])) r = k;
  const north = seat.z < rowsZ[r];
  const gi = north ? r : r + 1;
  void plan;
  return { gi, x: seat.x, z: LAY.rows[gi] };
}
/** waypoints from any point to a seat */
export function routeToSeat(from, seat) {
  const acc = seatAccess(seat);
  const col = Math.abs(seat.x - LAY.cols.A) < Math.abs(seat.x - LAY.cols.M) ? 'A' : 'M';
  const nPath = nodePath(nearestNode(from), node(col, acc.gi));
  const pts = nPath.map((n) => ({ x: n.x, z: n.z }));
  pts.push({ x: acc.x, z: acc.z }, { x: seat.x, z: seat.z });
  return pts;
}
/** waypoints between two free points along the aisles */
export function routeBetween(from, to) {
  return [...nodePath(nearestNode(from), nearestNode(to)).map((n) => ({ x: n.x, z: n.z })), { x: to.x, z: to.z }];
}
export function routeFromSeat(seat, to) {
  const acc = seatAccess(seat);
  const col = Math.abs(seat.x - LAY.cols.A) < Math.abs(seat.x - LAY.cols.M) ? 'A' : 'M';
  const nPath = nodePath(node(col, acc.gi), nearestNode(to));
  return [{ x: acc.x, z: acc.z }, ...nPath.map((n) => ({ x: n.x, z: n.z })), { x: to.x, z: to.z }];
}

class Queue {
  constructor(slotFn, n, serve) { this.slot = slotFn; this.n = n; this.list = []; this.serve = serve; this.t = 0; }
  get full() { return this.list.length >= this.n; }
  join(a) { this.list.push(a); a.q = this; a.qi = this.list.length - 1; }
  leave(a) { const i = this.list.indexOf(a); if (i >= 0) this.list.splice(i, 1); a.q = null; this.list.forEach((x, k) => (x.qi = k)); this.t = 0; }
}

export class MessFlow {
  /** plan: the interior Plan (its `seats` with `mess: true` are the mess seats); lookFor(i) -> a crowd look; girls: a girls' hostel */
  constructor({ plan, lookFor, rnd }) {
    this.plan = plan; this.lookFor = lookFor; this.rnd = rnd;
    this.seats = plan.seats.filter((s) => s.mess);
    this.agents = [];
    this.pay = new Queue(LAY.payQ, LAY.payQN, 2.4);
    this.serve = new Queue(LAY.serveQ, LAY.serveQN, 2.3);
    this.spawnT = 1;
    this.n = 0;
    this.avoid = null;                       // the player's spot: nobody walks into you
    this.plateSpots = [];                    // (for the renderer) the plates on the tables
  }

  /** how many diners the room should hold at this time */
  target(occ, busy) { return Math.round(26 * occ * busy); }

  spawn() {
    const a = { id: this.n++, state: 'enter', x: LAY.door.x + (this.rnd() - 0.5) * 1.2, z: LAY.door.z, yaw: Math.PI, path: [], t: 0, plate: false, more: this.rnd() < 0.3, seat: null, wait: 0,
      eatFor: 20 + this.rnd() * 26, phase: this.rnd() * 6 };
    a.look = this.lookFor(a.id);
    a.out = { x: a.x, y: 0, z: a.z, yaw: a.yaw, anim: AN.WALK, phase: a.phase, speed: 0, extra: 0, look: a.look, opts: a.look.opts };
    this.agents.push(a);
    this.pay.join(a);
    a.path = [{ x: LAY.payQ(Math.min(this.pay.list.length - 1, LAY.payQN - 1)).x, z: 12.2 }];
    return a;
  }

  /** walk along a.path; true when the last point is reached */
  walk(a, dt, speed = WALK) {
    let p = a.path[0];
    if (!p) return true;
    const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz);
    // wait for someone (the player) standing in the way
    if (this.avoid && d > 0.05) { const ax = this.avoid.x - a.x, az = this.avoid.z - a.z, ad = Math.hypot(ax, az); if (ad < 0.75 && (ax * dx + az * dz) / (ad * d + 1e-6) > 0.55 && a.wait < 3) { a.wait += dt; a.speed = 0; return false; } }
    a.wait = 0;
    const step = speed * dt;
    if (d <= step + 0.02) { a.x = p.x; a.z = p.z; a.path.shift(); a.speed = 0; return a.path.length === 0; }
    a.x += (dx / d) * step; a.z += (dz / d) * step;
    a.yaw = Math.atan2(dx, dz);
    a.speed = speed;
    return false;
  }

  freeSeat() {
    const me = this.avoid;
    const free = this.seats.filter((s) => !s.npc && !s.taken && !s.flowOwner && !(me && Math.hypot(s.x - me.x, s.z - me.z) < 1.1));
    if (!free.length) return null;
    return free[Math.floor(this.rnd() * free.length)];
  }

  update(dt, { spawn = true, target = 0, meal = true, player = null } = {}) {
    this.avoid = player;
    this.spawnT -= dt;
    if (spawn && meal && this.agents.length < target && this.spawnT <= 0 && !this.pay.full && this.serve.list.length < LAY.serveQN - 2) { this.spawn(); this.spawnT = 2 + this.rnd() * 3; }
    for (const a of this.agents) this.step(a, dt, meal);
    this.agents = this.agents.filter((a) => !a.gone);
    // queues: the head is served after a moment
    for (const Q of [this.pay, this.serve]) {
      const h = Q.list[0];
      if (!h || !(Q === this.pay ? h.state === 'payq' : (h.state === 'serveq' || h.state === 'serveq2')) || h.path.length) { Q.t = 0; continue; }
      Q.t += dt;
      if (Q.t >= Q.serve) { Q.t = 0; Q.leave(h); if (Q === this.pay) this.afterPay(h); else this.afterServe(h); }
    }
  }

  afterPay(a) { a.state = 'toPlates'; a.path = [{ x: -10.4, z: 10.5 }, { x: -11.2, z: 9.2 }, { x: LAY.platesAt.x + 0.6, z: LAY.platesAt.z }, { x: LAY.platesAt.x, z: LAY.platesAt.z }]; }
  afterServe(a) {
    if (a.state === 'serveq2') { a.state = 'toSeat'; const s = a.seat; a.path = routeToSeat({ x: a.x, z: a.z }, s); return; }
    const s = this.freeSeat();
    if (!s) { a.state = 'return'; a.path = routeBetween({ x: a.x, z: a.z }, LAY.retAt); return; }
    s.flowOwner = a; s.npc = true; a.seat = s;
    a.state = 'toSeat';
    a.path = routeToSeat({ x: a.x, z: a.z }, s);
  }

  step(a, dt, meal) {
    a.t += dt;
    switch (a.state) {
      case 'enter': {
        if (this.walk(a, dt)) a.state = 'payq';
        break;
      }
      case 'payq': {
        const s = LAY.payQ(a.qi);
        const at = a.path.length === 0 && dist(a, s) < 0.05;
        if (!at) { if (!a.path.length || dist(a.path[a.path.length - 1], s) > 0.01) a.path = [{ x: s.x, z: s.z }]; this.walk(a, dt); if (!a.path.length) a.yaw = s.yaw; }
        else a.yaw = s.yaw;
        break;
      }
      case 'toPlates': {
        if (this.walk(a, dt)) { a.state = 'takePlate'; a.t = 0; a.yaw = LAY.platesAt.yaw; }
        break;
      }
      case 'takePlate': {
        a.speed = 0; a.yaw = LAY.platesAt.yaw;
        if (a.t > 1.3) { a.plate = true; this.serve.join(a); a.path = [{ x: -10.75, z: 8.9 }, { x: -10.75, z: -8.7 }, { x: LAY.serveQ(Math.min(a.qi, LAY.serveQN - 1)).x, z: -9.4 }]; a.state = 'toServe'; }
        break;
      }
      case 'toServe': {
        if (this.walk(a, dt, 1.0)) a.state = 'serveq';
        break;
      }
      case 'serveq':
      case 'serveq2': {
        const s = LAY.serveQ(Math.min(a.qi, LAY.serveQN - 1));
        const at = a.path.length === 0 && dist(a, s) < 0.05;
        if (!at) { if (!a.path.length || dist(a.path[a.path.length - 1], s) > 0.01) a.path = [{ x: s.x, z: s.z }]; this.walk(a, dt, 1.0); if (!a.path.length) a.yaw = s.yaw; }
        else a.yaw = s.yaw;
        break;
      }
      case 'toSeat': {
        if (this.walk(a, dt, 1.0)) { a.state = 'eat'; a.t = 0; a.x = a.seat.x; a.z = a.seat.z; a.yaw = a.seat.yaw; a.speed = 0; }
        break;
      }
      case 'eat': {
        a.speed = 0; a.yaw = a.seat.yaw;
        const len = meal ? a.eatFor : Math.min(a.eatFor, 4);
        if (a.t > len) {
          if (a.more && meal && !a.wentAgain) { a.wentAgain = true; a.state = 'up'; a.t = 0; }
          else { a.state = 'up2'; a.t = 0; }
        }
        break;
      }
      case 'up': {                             // back for seconds
        a.speed = 0;
        if (a.t > 0.7) { a.path = routeFromSeat(a.seat, { x: -10.75, z: -8.7 }); this.serve.join(a); a.path.push({ x: LAY.serveQ(Math.min(a.qi, LAY.serveQN - 1)).x, z: -9.4 }); a.state = 'toServe2'; }
        break;
      }
      case 'toServe2': {
        if (this.walk(a, dt, 1.0)) a.state = 'serveq2';
        break;
      }
      case 'up2': {
        a.speed = 0;
        if (a.t > 0.7) { const s = a.seat; s.npc = false; s.flowOwner = null; a.seat = null; a.state = 'return'; a.path = routeFromSeat(s, LAY.retAt); }
        break;
      }
      case 'return': {
        if (this.walk(a, dt)) { a.state = 'drop'; a.t = 0; a.yaw = LAY.retAt.yaw; }
        break;
      }
      case 'drop': {
        a.speed = 0;
        if (a.t > 1.0) { a.plate = false; a.state = 'leave'; a.path = [{ x: LAY.cols.A, z: 8.9 }, { x: -6, z: 11.6 }, { x: 0, z: 12.6 }, { x: LAY.door.x, z: LAY.door.z + 0.3 }]; }
        break;
      }
      case 'leave': {
        if (this.walk(a, dt, 1.25)) a.gone = true;
        break;
      }
      default: a.gone = true;
    }
    // what the crowd renderer needs
    const o = a.out;
    o.x = a.x; o.z = a.z; o.y = 0; o.yaw = a.yaw; o.speed = a.speed;
    const eating = a.state === 'eat';
    o.anim = eating ? AN.EAT : a.speed > 0.05 ? AN.WALK : AN.STAND;
    o.opts = (a.look.opts & ~bit(OPT.PLATE)) | (a.plate && !eating ? bit(OPT.PLATE) : 0);
    o.eating = eating;
  }

  /** seats where a plate is on the table now: [{x, z, yaw}] */
  platesOnTables() {
    const out = [];
    for (const a of this.agents) if (a.state === 'eat' || a.state === 'up' || a.state === 'up2') out.push({ x: a.seat.x, z: a.seat.z, yaw: a.seat.yaw, k: a.id % 5 });
    return out;
  }
  /** the crowd-renderer records, moved to the interior's place in the world (O) */
  people(O) { return this.agents.map((a) => { const o = a.out; o.x = a.x + O.x; o.y = O.y; o.z = a.z + O.z; return o; }); }
  /** fill the room as if the meal had been going on for a while */
  warm(opts, seconds = 110) {
    const save = this.spawnT;
    for (let t = 0; t < seconds; t += 0.4) { this.update(0.4, { ...opts, player: null }); if (this.agents.length < opts.target && !this.pay.full && t % 1.2 < 0.4) this.spawn(); }
    this.spawnT = save;
  }
}

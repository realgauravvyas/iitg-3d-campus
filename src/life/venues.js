// Where people go outdoors: gathering spots derived from the campus data.
import { AN } from '../crowd/people.js';
import { pointInRing, mulberry32, closestOnRing } from '../util.js';

const HOSTEL = 'hostel';
/** girls' hostels (the rest are boys' hostels; Married Scholars is for families) */
export const GIRLS_HOSTELS = new Set(['subansiri', 'dhansiri', 'disang']);
export const ACADEMIC_IDS = ['lhc', 'academic', 'core5', 'workshop', 'conference', 'tic'];

function spot(x, z, yaw, anim, extra = {}) {
  return { x, z, yaw, anim, taken: null, ...extra };
}

/** random point inside a flat ring, away from its edge */
function inside(ring, rnd, margin = 1.5) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < ring.length; i += 2) { x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]); z0 = Math.min(z0, ring[i + 1]); z1 = Math.max(z1, ring[i + 1]); }
  const tmp = { d: 0, x: 0, z: 0 };
  for (let t = 0; t < 30; t++) {
    const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
    if (pointInRing(x, z, ring) && closestOnRing(x, z, ring, tmp).d > margin) return [x, z];
  }
  return null;
}

export class Venues {
  constructor(game) {
    const { world, props } = game;
    this.g = game;
    const rnd = mulberry32(606);
    this.hostels = world.sites.filter((s) => s.kind === HOSTEL);
    this.academic = ACADEMIC_IDS.map((id) => world.site(id)).filter(Boolean);
    this.library = world.site('library');
    this.food = ['foodcourt', 'shopping'].map((id) => world.site(id)).filter(Boolean);
    this.clubs = ['sac', 'newsac'].map((id) => world.site(id)).filter(Boolean);
    this.gym = world.site('gym');
    this.hospital = world.site('hospital');
    this.plaza = new Map(); this.queue = new Map(); this.lawn = new Map();
    const free = (x, z) => !world.buildingAt(x, z) && !world.waterAt(x, z) && world.insideCampus(x, z);

    for (const s of world.sites) {
      const pl = s.plazaObj;
      if (pl) {
        const list = [];
        const groups = s.kind === HOSTEL ? 3 : 2;
        for (let g = 0; g < groups; g++) {
          const c = inside(pl.ring, rnd, 2.2);
          if (!c) continue;
          const n = 3 + Math.floor(rnd() * 3), R = 0.75 + n * 0.08, a0 = rnd() * 6.28;
          const gid = `${s.name}:${g}`;
          for (let k = 0; k < n; k++) {
            const a = a0 + (k / n) * Math.PI * 2;
            const x = c[0] + Math.cos(a) * R, z = c[1] + Math.sin(a) * R;
            if (!free(x, z)) continue;
            const r = rnd();
            list.push(spot(x, z, Math.atan2(c[0] - x, c[1] - z), r < 0.55 ? AN.TALK : r < 0.8 ? AN.PHONE : AN.STAND, { group: gid, cup: rnd() < 0.2 }));
          }
        }
        this.plaza.set(s, list);
      }
      if (s.kind === HOSTEL) {
        const q = [];
        for (let k = 0; k < 12; k++) {
          const d = 1.6 + k * 0.72, side = (k % 2 ? 0.12 : -0.12);
          const x = s.ex + s.nx * d - s.nz * side, z = s.ez + s.nz * d + s.nx * side;
          if (free(x, z)) q.push(spot(x, z, s.yaw + Math.PI, AN.STAND, { queue: k }));
        }
        this.queue.set(s, q);
      }
      // courtyard lawns: sitting circles
      const lw = [];
      for (const b of s.blocks) for (let h = 1; h < b.rings.length; h++) {
        const ring = b.rings[h];
        for (let g = 0; g < 2; g++) {
          const c = inside(ring, rnd, 4);
          if (!c) continue;
          const n = 3 + Math.floor(rnd() * 4), R = 0.9 + n * 0.1, a0 = rnd() * 6.28;
          for (let k = 0; k < n; k++) {
            const a = a0 + (k / n) * Math.PI * 2;
            lw.push(spot(c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R, Math.atan2(-Math.cos(a), -Math.sin(a)), AN.SITG, { group: `${s.name}:lawn${h}${g}` }));
          }
        }
      }
      if (lw.length) this.lawn.set(s, lw);
    }

    // benches (lakesides + sit-outs + view point): two seats each
    this.benches = [];
    for (const [x, z, a, f] of props.benchPos || []) {
      const ax = Math.cos(a), az = -Math.sin(a);
      for (const s of [-0.45, 0.45]) this.benches.push(spot(x + ax * s, z + az * s, a, AN.SIT, { pair: `${x.toFixed(1)}:${z.toFixed(1)}`, lake: !f, view: f === 'view', sitout: f === 'sitout' }));
    }
    // only a handful of people up at the View Point at a time (10-20): keep the 14 view seats nearest the top
    { const vp = world.landmark('viewpoint'); this.view = this.benches.filter((b) => b.view); if (vp) { this.view.sort((a, b) => Math.hypot(a.x - vp.wx, a.z - vp.wz) - Math.hypot(b.x - vp.wx, b.z - vp.wz)); for (const b of this.view.slice(14)) b.view = false; this.view = this.view.slice(0, 14); } }
    // ... and, besides the two benches, pairs leaning on the railing and a couple of pairs on the lawn
    // (all inside the View Point's 26 m fence: 16 places in all)
    {
      const s = world.sitouts.find((q) => q.view), vp = world.landmark('viewpoint');
      if (s && vp) {
        const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), rx = fz, rz = -fx;
        const add = (f, o, anim, key) => {
          const x = s.wx + fx * f + rx * o, z = s.wz + fz * f + rz * o;
          if (free(x, z) && Math.hypot(x - vp.wx, z - vp.wz) < 24) this.view.push(spot(x, z, s.yaw, anim, { pair: key, view: true }));
        };
        for (const [o1, o2] of [[-3.3, -2.6], [-1.3, -0.6], [0.6, 1.3], [2.6, 3.3]]) { const key = `vp-rail:${o1}`; add(4.9, o1, AN.STAND, key); add(4.9, o2, AN.STAND, key); }
        for (const side of [-1, 1]) { const key = `vp-lawn:${side}`; add(2.5, side * 7.2, AN.SITG, key); add(2.5, side * 7.9, AN.SITG, key); }
      }
    }
    // which benches are in the dark (no street lamp within 22 m), and who sits next to whom
    const lamps = props.lampPos || [];
    const byPair = new Map();
    for (const b of this.benches) {
      b.dim = !lamps.some(([lx, lz]) => (lx - b.x) ** 2 + (lz - b.z) ** 2 < 22 * 22);
      if (byPair.has(b.pair)) { const o = byPair.get(b.pair); o.mate = b; b.mate = o; } else byPair.set(b.pair, b);
    }
    // evening circles on the grounds: friends sitting in a ring, talking late (a guitar in some)
    this.circles = [];
    for (const f of world.fields) {
      if (!['cricket', 'soccer', 'athletics', 'park', 'hockey'].includes(f.kind)) continue;
      const n = f.kind === 'cricket' || f.kind === 'athletics' ? 5 : 2;
      for (let g = 0; g < n; g++) {
        const c = inside(f.ring, rnd, 6);
        if (!c || !free(c[0], c[1])) continue;
        const k = 5 + Math.floor(rnd() * 3), R = 1.0 + k * 0.1, a0 = rnd() * 6.28, gtr = rnd() < 0.45;
        for (let i = 0; i < k; i++) {
          const a = a0 + (i / k) * Math.PI * 2;
          this.circles.push(spot(c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R, Math.atan2(-Math.cos(a), -Math.sin(a)), AN.SITG, { group: `circle:${f.i}:${g}`, circle: true, guitar: gtr && i === 0 }));
        }
      }
    }
    // chai / snack spots around food places
    this.chai = [];
    for (const c of props.stalls || []) {
      const n = 5 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const a = c.yaw + (rnd() - 0.5) * 2.2, d = 2.2 + rnd() * 2.2;
        const x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d;
        if (free(x, z)) this.chai.push(spot(x, z, Math.atan2(c.x - x, c.z - z) + (rnd() - 0.5) * 1.2, rnd() < 0.5 ? AN.TALK : AN.STAND, { cup: true, stall: c.name, pair: `${c.name}:s${Math.floor(k / 2)}` }));
      }
      (c.seats || []).forEach((s, k) => this.chai.push(spot(s.x, s.z, s.yaw, AN.SIT, { cup: rnd() < 0.7, stall: c.name, seat: true, pair: `${c.name}:t${Math.floor(k / 2)}` })));
    }
    // lakeside strolls: rings of waypoints 5 m outside each lake
    // walks round the lakes: a line that hugs the shore on dry land (every 4 m, pushed out along the
    // shore's own normal until clear of the water), so nobody wades through the lake
    this.lakeLoops = [];
    for (const w of world.water) {
      if (w.kind === 'pool') continue;
      const r = w.rings[0], n = r.length / 2, pts = [];
      const inWater = (x, z) => !!world.waterAt(x, z);
      let acc = 4;
      for (let k = 0; k < n; k++) {
        const ax = r[k * 2], az = r[k * 2 + 1], bx = r[((k + 1) % n) * 2], bz = r[((k + 1) % n) * 2 + 1];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 1e-3) continue;
        const tx = (bx - ax) / L, tz = (bz - az) / L;
        for (let t = 0; t < L; t += 4) {
          acc += Math.min(4, L - t);
          if (acc < 4) continue;
          acc = 0;
          const x0 = ax + tx * t, z0 = az + tz * t;
          // the side of the shore away from the water
          let nx = -tz, nz = tx;
          if (inWater(x0 + nx * 2, z0 + nz * 2)) { nx = -nx; nz = -nz; }
          let q = null;
          for (const d of [4.5, 6, 8, 10]) { const x = x0 + nx * d, z = z0 + nz * d; if (free(x, z)) { q = [x, z]; break; } }
          if (q) pts.push(q);
        }
      }
      // drop points whose way to the next one would cross the water
      const ok = pts.filter((p, k) => { const q = pts[(k + 1) % pts.length]; for (let f = 0.25; f < 1; f += 0.25) if (inWater(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f)) return false; return true; });
      if (ok.length > 8) this.lakeLoops.push({ name: w.name, pts: ok });
    }
    // gate guards
    this.gates = world.gates.filter((g) => !g.closed).map((g) => {
      const dx = Math.cos(g.angle), dz = -Math.sin(g.angle);
      return spot(g.wx - dx * 6 - dz * 5.5, g.wz - dz * 6 + dx * 5.5, Math.atan2(-dz, dx), AN.STAND, { guard: true });
    });
    this.busStops = [];
  }

  addBusStops(list) { for (const s of list) this.busStops.push(spot(s.x, s.z, s.yaw, AN.STAND, { bus: s.i })); }

  nearestHostel(x, z) {
    let best = null, bd = Infinity;
    for (const h of this.hostels) { const d = Math.hypot(h.ex - x, h.ez - z); if (d < bd) { bd = d; best = h; } }
    return best;
  }
}

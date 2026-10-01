// Road manners: every frame the vehicles (campus traffic, the tour bus, your car/scooter,
// your bicycle) are collected as oriented boxes. Walkers and cyclists steer around them -
// easing sideways before they reach one and never ending up inside it - and vehicles brake
// for people who are in their lane ahead (someone crossing, a cyclist swinging out).

const CELL = 8;

export class Avoid {
  constructor(game) {
    this.g = game;
    this.veh = [];
    this.grid = new Map();       // moving people, rebuilt every frame (for braking)
    this.nextGrid = new Map();
  }

  /** collect vehicles; call once per frame before people move */
  begin() {
    const g = this.g, V = this.veh;
    V.length = 0;
    for (const a of g.traffic?.agents || []) {
      if (!a.veh) continue;
      const p = a.group.position, dim = DIMS[a.kind] || DIMS.car;
      V.push(box(p.x, p.z, a.heading, dim[0], dim[1], a.v));
    }
    const bus = g.busTour;
    if (bus?.active && bus.bus) { const p = bus.bus.group.position; V.push(box(p.x, p.z, bus.bus.group.rotation.y, DIMS.shuttle[0], DIMS.shuttle[1], bus.v)); }
    if (g.drive?.active) { const p = g.drive.pos; const two = g.drive.kind === 'scooter' || g.drive.spec?.two; V.push(box(p.x, p.z, g.drive.yaw ?? 0, two ? 1.0 : 2.8, two ? 0.45 : 1.05, Math.abs(g.drive.speed || 0))); }
    const m = g.mode, P = g.player?.pos;
    if (P && !g.interior?.active && (m === 'walk' || m === 'bike' || m === 'camera' || m === 'tour') && P.y - g.world.heightAt(P.x, P.z) < 2.5) {
      if (m === 'bike' && g.bike?.riding) V.push(box(g.bike.pos.x, g.bike.pos.z, g.bike.heading, 0.95, 0.35, g.bike.speed || 0, true));
      else if (m === 'tour' && g.tour?.kind === 'bike') V.push(box(P.x, P.z, g.tour.yaw, 0.95, 0.35, g.tour.v || 0, true));
      else V.push(box(P.x, P.z, g.player.heading ?? 0, 0.35, 0.35, g.player.speed || 0, true));
    }
    for (const v of g.jobs?.vehicles?.() || []) V.push(box(v.x, v.z, v.yaw, v.hl, v.hw, v.v || 0));
    for (const v of g.transport?.boxes() || []) V.push(box(v.x, v.z, v.yaw, v.hl, v.hw, v.v || 0));
    // swap people grids: the one filled during the last frame is read now
    const t = this.grid; this.grid = this.nextGrid; this.nextGrid = t; this.nextGrid.clear();
  }

  /** register a moving person for vehicles to brake for */
  mark(x, z) {
    const k = Math.floor(x / CELL) * 65536 + Math.floor(z / CELL);
    let c = this.nextGrid.get(k);
    if (!c) this.nextGrid.set(k, (c = []));
    c.push(x, z);
  }

  /**
   * Steer a person (radius r) at desired position (x, z) around vehicles.
   * Keeps a smoothed sideways shift on the person (p.ax, p.az). Returns the final spot in out.
   */
  dodge(p, x, z, r, dt, out) {
    let nx = 0, nz = 0;
    const W = this.g.world;
    for (const v of this.veh) {
      const dx = x - v.x, dz = z - v.z;
      if (dx * dx + dz * dz > v.R2) continue;
      const u = dx * v.fx + dz * v.fz, l = dx * v.fz - dz * v.fx;
      const HW = v.hw + r + 0.3, core = v.hl + r + 0.2, HL = core + (v.me ? 1.0 : 2.4) + Math.min(3, v.v * 0.35);
      if (Math.abs(l) > HW || Math.abs(u) > HL) continue;
      // ramp: full push beside the vehicle, fading in over the approach
      const k = Math.abs(u) <= core ? 1 : 1 - (Math.abs(u) - core) / (HL - core);
      let side = l >= 0 ? 1 : -1;
      // never dodge into a wall or the lake
      const need = (side * HW - l) * k;
      const tx = x + v.fz * need, tz = z - v.fx * need;
      if (W.buildingAt(tx, tz) || W.waterAt(tx, tz)) side = -side;
      const n2 = (side * HW - l) * k;
      nx += v.fz * n2; nz += -v.fx * n2;
    }
    const e = 1 - Math.exp(-(nx || nz ? 9 : 3) * dt);
    p.ax = (p.ax || 0) + (nx - (p.ax || 0)) * e;
    p.az = (p.az || 0) + (nz - (p.az || 0)) * e;
    let fx = x + p.ax, fz = z + p.az;
    const gx = Math.floor(fx / CELL), gz = Math.floor(fz / CELL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const nearby = this.nextGrid.get((gx + i) * 65536 + gz + j);
      if (!nearby) continue;
      for (let k = 0; k < nearby.length; k += 2) {
        let dx = fx - nearby[k], dz = fz - nearby[k + 1];
        const d = Math.hypot(dx, dz), space = r + 0.38;
        if (d >= space) continue;
        if (d < 0.001) { const a = (p.seed ?? p.id ?? 0) * 2.399; dx = Math.cos(a); dz = Math.sin(a); }
        const push = Math.min(space - d, 1.8 * dt) / (d < 0.001 ? 1 : d);
        const sx = fx + dx * push, sz = fz + dz * push;
        if (!W.buildingAt(sx, sz) && !W.waterAt(sx, sz)) { fx = sx; fz = sz; }
      }
    }
    // hard guarantee: never inside a vehicle body
    for (const v of this.veh) {
      const dx = fx - v.x, dz = fz - v.z;
      if (dx * dx + dz * dz > v.R2) continue;
      const u = dx * v.fx + dz * v.fz, l = dx * v.fz - dz * v.fx;
      const HW = v.hw + r + 0.08, HL = v.hl + r + 0.08;
      if (Math.abs(u) < HL && Math.abs(l) < HW) {
        const push = (l >= 0 ? HW : -HW) - l;
        fx += v.fz * push; fz -= v.fx * push;
      }
    }
    // counters, booths, posts and machines: people walk round them, never through them
    if (W._so) {
      const gx = Math.floor(fx / 8), gz = Math.floor(fz / 8);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const c = W._so.get((gx + i) * 100000 + gz + j);
        if (!c) continue;
        for (const so of c) {
          if (!so.hard) continue;
          const dx = fx - so.x, dz = fz - so.z, d = Math.hypot(dx, dz), want = so.r + r + 0.05;
          if (d >= want) continue;
          const L = d || 1, ux = d ? dx / L : 1, uz = d ? dz / L : 0;
          const sx = so.x + ux * want, sz = so.z + uz * want;
          if (!W.buildingAt(sx, sz) && !W.waterAt(sx, sz)) { fx = sx; fz = sz; }
        }
      }
    }
    // Do not solve a traffic overlap by pushing the pedestrian through a wall or into water.
    if (W.buildingAt(fx, fz) || W.waterAt(fx, fz)) {
      if (!W.buildingAt(x, z) && !W.waterAt(x, z)) { fx = x; fz = z; }
      else if (Number.isFinite(p.x) && !W.buildingAt(p.x, p.z) && !W.waterAt(p.x, p.z)) { fx = p.x; fz = p.z; }
    }
    out.x = fx; out.z = fz;
    return (nx || nz) !== 0;
  }

  /** speed limit for a vehicle at (x,z) heading yaw, half width hw, half length hl, so it stops for people ahead */
  brake(x, z, yaw, hl, hw, vmax) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let lim = vmax;
    // A shared traffic view makes shuttles, taxis, deliveries and the player's vehicle
    // yield to each other; use bumper clearance rather than centre-to-centre spacing.
    for (const v of this.veh) {
      const dx = v.x - x, dz = v.z - z;
      if (dx * dx + dz * dz < 0.0001) continue; // this vehicle's own snapshot
      const ahead = dx * fx + dz * fz;
      if (ahead <= 0) continue;
      // oncoming traffic keeps to its own (left) lane: braking for it only ever caused head-on standoffs
      if (fx * v.fx + fz * v.fz < -0.3) continue;
      const cos = Math.abs(fx * v.fx + fz * v.fz), sin = Math.abs(fx * v.fz - fz * v.fx);
      if (Math.abs(dx * fz - dz * fx) > hw + v.hw * cos + v.hl * sin + 0.2) continue;
      const gap = ahead - hl - v.hl * cos - v.hw * sin - 1.5;
      lim = Math.min(lim, Math.sqrt(Math.max(0, 2 * 2.5 * gap)));
    }
    const reach = hl + 9;
    const cx = x + fx * (hl + 4.5), cz = z + fz * (hl + 4.5);
    const gx = Math.floor(cx / CELL), gz = Math.floor(cz / CELL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const c = this.grid.get((gx + i) * 65536 + gz + j);
      if (!c) continue;
      for (let q = 0; q < c.length; q += 2) {
        const dx = c[q] - x, dz = c[q + 1] - z;
        const ahead = dx * fx + dz * fz;
        if (ahead < hl || ahead > reach) continue;
        if (Math.abs(dx * fz - dz * fx) > hw + 0.15) continue;
        lim = Math.min(lim, Math.max(0, (ahead - hl - 1.6) * 0.9));
      }
    }
    return lim;
  }
}

// [half length, half width]
const DIMS = { car: [2.2, 0.92], shuttle: [5.35, 1.28], ambulance: [3.3, 1.05], scooter: [0.95, 0.42] };

function box(x, z, yaw, hl, hw, v, me = false) {
  const R = hl + 6 + Math.min(4, v * 0.4);
  return { x, z, fx: Math.sin(yaw), fz: Math.cos(yaw), hl, hw, v, R2: R * R, me };
}

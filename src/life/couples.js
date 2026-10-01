// After dark the IITG Lake (by the academic core) and the Serpentine belong to couples: pairs sitting
// close on the lakeside benches or the grass, leaning on the railing talking, strolling hand in hand
// along the shore, hugging - and now and then someone goes down on one knee with a red rose or a
// bouquet, the partner's hands fly to their face, and they hug.
import { AN } from '../crowd/people.js';
import { studentLook } from '../crowd/looks.js';
import { mulberry32 } from '../util.js';

const ROSE = 4096, BOUQUET = 8192;
const ACTS = [['hug', 0.26], ['sit', 0.26], ['lean', 0.2], ['stroll', 0.18], ['propose', 0.1]];

export class LakeCouples {
  constructor(game) {
    this.g = game;
    const W = game.world, G = game.graph, r = (this.rnd = mulberry32(5150));
    this.lakes = [];
    for (const [re, n] of [[/IITG lake/i, 12], [/serpentine/i, 12]]) {
      const w = W.water.find((q) => re.test(q.name || ''));
      if (!w) continue;
      const ring = w.rings[0], spots = [];
      let cx = 0, cz = 0; for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cz += ring[i + 1]; } cx /= ring.length / 2; cz /= ring.length / 2;
      for (let i = 0; i < ring.length; i += 2) {
        const j = (i + 2) % ring.length, ax = ring[i], az = ring[i + 1], bx = ring[j], bz = ring[j + 1], L = Math.hypot(bx - ax, bz - az);
        for (let s = 0; s < L; s += 7) {
          const x0 = ax + ((bx - ax) * s) / L, z0 = az + ((bz - az) * s) / L;
          let nx = -(bz - az) / L, nz = (bx - ax) / L;
          if (W.waterAt(x0 + nx, z0 + nz) === w) { nx = -nx; nz = -nz; }
          const x = x0 + nx * 3.8, z = z0 + nz * 3.8;
          if (W.waterAt(x, z) || W.buildingAt(x, z) || G.onRoad(x, z, 1.2)) continue;
          spots.push({ x, z, yaw: Math.atan2(-nx, -nz), k: spots.length });
        }
      }
      if (spots.length < 6) continue;
      const benches = /IITG/i.test(w.name) ? (W.lakeBenches || []).map((b) => ({ ...b, taken: null })) : [];
      const lake = { w, cx, cz, spots, benches, couples: [], proposing: 0 };
      for (let k = 0; k < n; k++) {
        const boy = studentLook(r, { female: false }), girl = studentLook(r, { female: true });
        const flip = r() < 0.2;                                   // now and then she proposes
        lake.couples.push({ boy, girl, flip, spot: spots[Math.floor(r() * spots.length)], act: null, t: 0, until: 0, phase: r() * 6, lake });
      }
      this.lakes.push(lake);
    }
    this.dark = false;
  }

  choose(c) {
    const r = this.rnd, L = c.lake;
    if (c.bench) { c.bench.taken = null; c.bench = null; }
    if (c.act === 'propose') L.proposing--;
    let x = r() * ACTS.reduce((s, a) => s + a[1], 0), act = 'hug';
    for (const [a, w] of ACTS) { if ((x -= w) <= 0) { act = a; break; } }
    if (act === 'propose' && L.proposing >= 2) act = 'hug';
    if (act === 'sit') { const b = L.benches.find((q) => !q.taken && r() < 0.7); if (b) { b.taken = c; c.bench = b; } }
    if (act === 'propose') L.proposing++;
    c.act = act; c.t = 0; c.until = act === 'propose' ? 26 : 35 + r() * 50;
    c.gift = act === 'propose' ? (r() < 0.55 ? ROSE : BOUQUET) : 0;
    if (act === 'stroll') { c.from = c.spot; c.to = L.spots[(c.spot.k + (r() < 0.5 ? 1 : L.spots.length - 1)) % L.spots.length]; }
    else c.spot = L.spots[Math.floor(r() * L.spots.length)];
  }

  update(dt) {
    const g = this.g, night = g.sky?.state?.night ?? 0;
    this.dark = night > 0.35 && !(g.weather?.state?.rain > 0.6);
    if (!this.dark) return;
    for (const L of this.lakes) for (const c of L.couples) {
      c.t += dt; c.phase += dt * 4;
      if (!c.act || c.t > c.until) this.choose(c);
      if (c.act === 'stroll') {
        const dx = c.to.x - c.from.x, dz = c.to.z - c.from.z, D = Math.hypot(dx, dz) || 1, k = Math.min(1, (c.t * 0.9) / D);
        c.x = c.from.x + dx * k; c.z = c.from.z + dz * k; c.yaw = Math.atan2(dx, dz);
        if (k >= 1) { c.spot = c.to; c.from = c.to; c.to = L.spots[(c.to.k + 1) % L.spots.length]; c.t = 0; c.until = 30 + this.rnd() * 30; c.strollLeft = (c.strollLeft ?? 3) - 1; if (c.strollLeft <= 0) { c.strollLeft = 3; c.until = 0; } }
      }
    }
  }

  draw(crowd) {
    if (!this.dark || this.g.interior?.active) return;
    const W = this.g.world, cam = this.g.camera.position;
    for (const L of this.lakes) {
      if (Math.hypot(cam.x - L.cx, cam.z - L.cz) > 420) continue;
      for (const c of L.couples) {
        if (!c.act) continue;
        const s = c.bench || c.spot, yaw = c.act === 'stroll' ? c.yaw : s.yaw;
        const fx = Math.sin(yaw), fz = Math.cos(yaw), px = Math.cos(yaw), pz = -Math.sin(yaw);
        const bx = c.act === 'stroll' ? c.x : s.x, bz = c.act === 'stroll' ? c.z : s.z;
        const put = (look, dx, dy, yw, anim, extra = 0, flags) => {
          const x = bx + px * dx + fx * dy, z = bz + pz * dx + fz * dy;
          crowd.push({ x, y: W.heightAt(x, z), z, yaw: yw, anim, phase: c.phase, speed: c.act === 'stroll' ? 0.9 : 0, extra, look, flags });
        };
        const A = c.flip ? c.girl : c.boy, B = c.flip ? c.boy : c.girl;       // A proposes
        const ext = (look) => (look === c.girl ? -1 : 1);
        switch (c.act) {
          case 'hug': put(c.boy, 0, -0.2, yaw, AN.HUG, 1); put(c.girl, 0, 0.2, yaw + Math.PI, AN.HUG, -1); break;
          case 'sit':
            if (c.bench) { put(c.boy, -0.34, 0, yaw, AN.SITCHAT, 0.8); put(c.girl, 0.34, 0, yaw, AN.SITCHAT, -0.8); }
            else { put(c.boy, -0.3, 0, yaw - 0.25, AN.SITG, 0); put(c.girl, 0.3, 0, yaw + 0.25, AN.SITG, 0); }
            break;
          case 'lean': put(c.boy, -0.35, 0.4, yaw + 0.5, AN.TALK, 0.2); put(c.girl, 0.35, 0.4, yaw - 0.5, AN.TALK, -0.2); break;
          case 'stroll': put(c.boy, -0.3, 0, yaw, AN.HOLD, 1); put(c.girl, 0.3, 0, yaw, AN.HOLD, -1); break;
          case 'propose': {
            // 0-9 s: down on one knee holding out the flowers; 9-15 s: a hug; then they stand, the flowers with the partner
            const ty = yaw + Math.PI / 2;
            if (c.t < 9) { put(A, -0.55, 0, ty, AN.PROPOSE, 0, (A.flags | c.gift)); put(B, 0.6, 0, ty + Math.PI, AN.SURPRISE, 0); }
            else if (c.t < 15) { put(A, -0.2, 0, ty, AN.HUG, ext(A)); put(B, 0.2, 0, ty + Math.PI, AN.HUG, ext(B)); }
            else { put(A, -0.45, 0, ty, AN.TALK, 0.1); put(B, 0.45, 0, ty + Math.PI, AN.SURPRISE, 1, (B.flags | c.gift)); }
            break;
          }
        }
      }
    }
  }
}

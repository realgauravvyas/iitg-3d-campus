// Where things may stand. One place that knows what is already occupied - buildings, lakes, sports
// grounds, every road, lane and footpath (with its width), and every solid thing that has been put
// down (cycles, stalls, kiosks, booths, posts, signs, beds...) - so that nothing is built on a road or a
// path, on top of something else, or in the way of the people who walk past it.
//
// Builders ask `free()` before they put something down and `reserve()` what they placed; people steer
// round the reserved things (life/avoid.js) and the world uses them for collisions.

const SPORTS = new Set(['tennis', 'basketball', 'volleyball', 'soccer', 'hockey', 'cricket', 'athletics']);

export function makePlacer(world, graph) {
  const W = world, G = graph;
  const P = {
    /** true if a thing of radius r may stand at (x, z): on campus ground, off every road, lane and
     *  footpath (with a hand's width to spare) and clear of everything already placed */
    free(x, z, r = 0.5, { ways = true, solids = true, sports = true } = {}) {
      if (!W.insideCampus(x, z) || W.buildingAt(x, z) || W.waterAt(x, z)) return false;
      if (sports && W.sportsAt && W.sportsAt(x, z)) return false;
      if (ways && G.wayClearance(x, z, r + 0.4) < r + 0.15) return false;
      if (solids && W.solidAt(x, z, r)) return false;
      return true;
    },
    /** a rectangle (half sizes hx along the yaw direction, hz across it) is free: sampled every ~1 m over its
     *  area and its corners, each with radius `pad` */
    footprint(cx, cz, yaw, hx, hz, pad = 0.4, opts) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const nu = Math.max(1, Math.ceil((hx * 2) / 1.2)), nv = Math.max(1, Math.ceil((hz * 2) / 1.2));
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
        const u = -hx + (i / nu) * hx * 2, v = -hz + (j / nv) * hz * 2;
        if (!P.free(cx + u * c + v * s, cz - u * s + v * c, pad, opts)) return false;
      }
      return true;
    },
    /** put a solid down: a circle of radius r (people steer round it, later builders keep off it) */
    reserve(x, z, r = 0.4, tag = '', hard = false) { return W.addSolid(x, z, r, tag, hard); },
    /** a rectangle as a row of circles (`hard`: a wall for people and cycles too) */
    reserveBox(cx, cz, yaw, hx, hz, tag = '', hard = false) {
      const c = Math.cos(yaw), s = Math.sin(yaw), long = Math.max(hx, hz), r = Math.max(0.35, Math.min(hx, hz)), span = 2 * Math.max(0, long - r);
      const n = span <= 0 ? 1 : Math.ceil(span / (r * 0.85)) + 1;                          // neighbours overlap: no gap to squeeze through
      for (let k = 0; k < n; k++) {
        const t = n === 1 ? 0 : -1 + (2 * k) / (n - 1);
        const u = hx >= hz ? t * (long - r) : 0, v = hx >= hz ? 0 : t * (long - r);
        W.addSolid(cx + u * c + v * s, cz - u * s + v * c, r, tag, hard);
      }
    },
    /** the nearest free spot around (x, z): rings of growing radius, 16 directions each; `want(x, z)` may veto or
     *  score (lower is better). Returns {x, z} or null */
    find(x, z, { r = 0.6, min = 0, max = 30, step = 1.5, want = null, from = 0 } = {}) {
      let best = null, bs = Infinity;
      for (let R = min; R <= max; R += step) {
        for (let k = 0; k < 16; k++) {
          const a = from + (k / 16) * Math.PI * 2, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
          if (!P.free(px, pz, r)) continue;
          const sc = want ? want(px, pz, a, R) : R;
          if (sc == null || sc === false) continue;
          if (sc < bs) { bs = sc; best = { x: px, z: pz, a, d: R }; }
        }
        if (best && !want) return best;
        if (best && R > best.d + step * 3) return best;
      }
      return best;
    },
  };
  W.placer = P;
  return P;
}

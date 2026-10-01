// The circle by the IITG Lake: the roundabout (with an island of flowers) at the road junction nearest to the
// academic lake's shore, where the lake path, the benches and the fingerposts meet. It gets the air-quality
// station, a guard in a booth, a bus stop and the duck house (see landmarks.js, busstops.js, life/neighbourhood.js and
// life/wildlife.js). Found once, from the road graph. Where the junction had no room for a roundabout it is a plain junction.

export function lakeCircle(W, G) {
  if (W._lakeCircle !== undefined) return W._lakeCircle;
  const lake = W.water.find((w) => w.name === 'IITG lake');
  let best = null;
  const island = (W.islands || []).find((i) => i.name === 'Lake Circle') || null;
  const nearShore = (x, z) => {
    const ring = lake.rings[0];
    let d = 1e9, sx = 0, sz = 0;
    for (let k = 0; k < ring.length; k += 2) { const q = Math.hypot(ring[k] - x, ring[k + 1] - z); if (q < d) { d = q; sx = ring[k]; sz = ring[k + 1]; } }
    return { d, sx, sz };
  };
  if (lake && island) {
    best = { x: island.x, z: island.z, ...nearShore(island.x, island.z), out: island.R + island.w / 2, island };
  } else if (lake && G?.adj) {
    G.nodes.forEach(([x, z], i) => {
      if (G.adj[i].filter((l) => l.e.main && l.e.L > 8).length < 3) return;
      const s = nearShore(x, z);
      if (s.d < 70 && (!best || s.d < best.d)) best = { x, z, ...s, out: 6 };
    });
  }
  if (best) {                                   // l = the direction to the lake shore, s = across it
    const L = Math.hypot(best.sx - best.x, best.sz - best.z) || 1;
    best.lx = (best.sx - best.x) / L; best.lz = (best.sz - best.z) / L;
    best.px = -best.lz; best.pz = best.lx;
  }
  return (W._lakeCircle = best);
}

/** Where the things round the lake circle stand, worked out before the trees are planted (each gets a clearing):
 *  the air-quality board on the verge, the guard's booth on the other side of the circle, and the duck house
 *  directly BEHIND the board (in line with the circle and the board, further out) on the lake side, turned to the water. */
export function planLakeCircle(W, G, busSpots = []) {
  const lc = lakeCircle(W, G);
  if (!lc) return null;
  const free = (x, z) => W.insideCampus(x, z) && !W.buildingAt(x, z) && !W.waterAt(x, z);
  const away = (x, z, d) => busSpots.every((b) => Math.hypot(b.x - x, b.z - z) > d);
  const spread = (a0, rs) => {
    for (const R of rs) for (const da of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2]) {
      const a = a0 + da, x = lc.x + (lc.lx * Math.cos(a) - lc.lz * Math.sin(a)) * R, z = lc.z + (lc.lz * Math.cos(a) + lc.lx * Math.sin(a)) * R;
      if (free(x, z) && !G.onRoad(x, z, 2.6) && away(x, z, 10)) return { x, z };
    }
    return null;
  };
  const o = lc.out || 6;                                                       // the outer edge of the ring road
  const aqi = spread(-0.9, [o + 3.5, o + 5.5, o + 8, o + 11, o + 14]);         // facing the circle
  const guard = spread(2.4, [o + 3, o + 5, o + 7]) || spread(0.4, [o + 3, o + 5]);
  let duck = null;
  const lake = W.water.find((w) => w.name === 'IITG lake');
  if (aqi && lake) {
    const ring = lake.rings[0], a0 = Math.atan2(aqi.z - lc.z, aqi.x - lc.x);
    search: for (const d of [8, 10, 7, 12, 6, 14, 16]) for (const da of [0, 0.22, -0.22, 0.45, -0.45]) {
      const hx = aqi.x + Math.cos(a0 + da) * d, hz = aqi.z + Math.sin(a0 + da) * d;
      if (!free(hx, hz) || G.onRoad(hx, hz, 3.5) || [[2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dz]) => W.buildingAt(hx + dx, hz + dz) || W.waterAt(hx + dx, hz + dz))) continue;
      if (!away(hx, hz, 6) || (guard && Math.hypot(guard.x - hx, guard.z - hz) < 6)) continue;
      let sd = 1e9, sx = 0, sz = 0;
      for (let q = 0; q < ring.length; q += 2) { const dd = Math.hypot(ring[q] - hx, ring[q + 1] - hz); if (dd < sd) { sd = dd; sx = ring[q]; sz = ring[q + 1]; } }
      if (sd < 5 || sd > 60) continue;                                         // on the lake side, but not on the water's edge
      duck = { x: hx, z: hz, sx, sz, yaw: Math.atan2(sx - hx, sz - hz) };
      break search;
    }
  }
  const spots = { lc, aqi, guard, duck };
  (W.clearings ||= []);
  if (aqi) W.clearings.push({ x: aqi.x, z: aqi.z, r: 3 });
  if (guard) W.clearings.push({ x: guard.x, z: guard.z, r: 2.6 });
  if (duck) W.clearings.push({ x: duck.x, z: duck.z, r: 4.2 });
  return (W.lakeSpots = spots);
}

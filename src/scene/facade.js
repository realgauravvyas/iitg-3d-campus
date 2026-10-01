// Where a name board or an entrance bay goes on a building: on the wall face that looks the same way as the entrance (not on a
// chamfer beside it, never inside the wall), no wider than that wall is, slid along it to fit instead of being cut off by a corner.

/** s: a site (ex, ez, nx, nz, blocks[].rings[0]); want: the width wanted (m); off: how far out of the wall the frame sits.
 *  Returns { x, z, yaw, k, nx, nz, tx, tz, width, L, t, edge } where (x, z) is the middle of the board on the wall, (nx, nz) points out of the
 *  building, (tx, tz) runs along the wall, k = width / want (scale for a board made at the wanted size), t = distance from the edge's start. */
export function facadeOf(s, want, { off = 0.07, minAlign = 0.6, minLen = 5 } = {}) {
  let best = null;
  const scan = (align0) => {
    for (const b of s.blocks) {
      const r = b.rings[0], n = r.length / 2;
      for (let k = 0; k < n; k++) {
        const ax = r[k * 2], az = r[k * 2 + 1], bx = r[((k + 1) % n) * 2], bz = r[((k + 1) % n) * 2 + 1], L = Math.hypot(bx - ax, bz - az);
        if (L < minLen) continue;
        const tx = (bx - ax) / L, tz = (bz - az) / L;
        let nx = tz, nz = -tx;
        if (nx * s.nx + nz * s.nz < 0) { nx = -nx; nz = -nz; }                    // the wall's normal, turned to point out of the building (the way the entrance faces)
        const align = nx * s.nx + nz * s.nz;
        if (align < align0) continue;
        const t = Math.max(0, Math.min(L, (s.ex - ax) * tx + (s.ez - az) * tz)), cx = ax + tx * t, cz = az + tz * t;
        const d = Math.hypot(s.ex - cx, s.ez - cz) + (1 - align) * 8;
        if (!best || d < best.d) best = { d, ax, az, tx, tz, nx, nz, t, L, k, b };
      }
    }
  };
  scan(minAlign);
  if (!best) scan(-1);
  if (!best) return { x: s.ex + s.nx * 0.3, z: s.ez + s.nz * 0.3, yaw: s.yaw, k: 1, nx: s.nx, nz: s.nz, tx: Math.cos(s.yaw), tz: -Math.sin(s.yaw), width: want, L: want, t: want / 2, edge: -1 };
  const half = Math.max(1.0, Math.min(want / 2, best.L / 2 - 0.4));
  const t = Math.max(half + 0.4, Math.min(best.L - half - 0.4, best.t));                // slid along the wall until the whole board is on it
  const cx = best.ax + best.tx * t, cz = best.az + best.tz * t;
  return { x: cx + best.nx * off, z: cz + best.nz * off, yaw: Math.atan2(best.nx, best.nz), k: (half * 2) / want, nx: best.nx, nz: best.nz, tx: best.tx, tz: best.tz, width: half * 2, L: best.L, t, edge: best.k, block: best.b };
}

// Buildings that cross the campus wall (the survey's footprints are a few metres off in places) are
// trimmed to the inside of it: the part outside is cut away along the wall, and a building that only
// touches the wall is moved in a little. A building with hardly anything left inside is removed.
// Pure data work (map coordinates [x, y]); it runs before the world is built.

const inside = (P, x, y) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const area = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };

/** intersection of segments a-b and c-d: {t, u, x, y} or null */
function cross(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, x: a[0] + rx * t, y: a[1] + ry * t };
}

export function fitBuildingsToWall(data, margin = 0.9) {
  const B = data.boundary, n = B.length;
  if (!B || n < 3) return { trimmed: 0, moved: 0, removed: 0 };
  // which side of each wall edge is the campus? (the polygon's orientation)
  let a2 = 0; for (let i = 0, j = n - 1; i < n; j = i++) a2 += (B[j][0] + B[i][0]) * (B[j][1] - B[i][1]);
  const ccw = a2 < 0;     // shoelace with this sign convention: negative = counter-clockwise (y up)
  const edgeN = (j) => {
    const a = B[j], b = B[(j + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;                     // left of a -> b
    const mx = (a[0] + b[0]) / 2 + nx * 0.6, my = (a[1] + b[1]) / 2 + ny * 0.6;
    if (inside(B, mx, my) !== true) { nx = -nx; ny = -ny; }                   // make it point into the campus
    return [nx, ny];
  };
  void ccw;
  /** nearest point on the wall to (x, y): {d, x, y, j, nx, ny} (nx, ny point into the campus) */
  const nearest = (x, y) => {
    let best = null;
    for (let j = 0; j < n; j++) {
      const a = B[j], b = B[(j + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], L2 = ex * ex + ey * ey || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / L2)), qx = a[0] + ex * t, qy = a[1] + ey * t, d = Math.hypot(x - qx, y - qy);
      if (!best || d < best.d) best = { d, x: qx, y: qy, j };
    }
    [best.nx, best.ny] = edgeN(best.j);
    return best;
  };
  /** push a point to be at least `margin` inside the wall */
  const push = (p) => {
    const ins = inside(B, p[0], p[1]), q = nearest(p[0], p[1]);
    if (ins && q.d >= margin) return p;
    // outside: onto the wall and in by `margin`; inside but too close: further in
    const k = ins ? margin - q.d : q.d + margin;
    return [p[0] + q.nx * k, p[1] + q.ny * k];
  };
  const near = (p, r) => { const x0 = Math.min(...p.map((v) => v[0])) - r, x1 = Math.max(...p.map((v) => v[0])) + r, y0 = Math.min(...p.map((v) => v[1])) - r, y1 = Math.max(...p.map((v) => v[1])) + r; return { x0, x1, y0, y1 }; };

  const drop = new Set();
  let trimmed = 0, moved = 0;
  data.buildings.forEach((b, bi) => {
    const p = b.p, m = p.length;
    if (m < 3) return;
    const ins = p.map((v) => inside(B, v[0], v[1]));
    const allIn = ins.every(Boolean);
    if (allIn) {
      // fully inside: only a building too close to the wall needs to move
      let need = false; for (const v of p) if (nearest(v[0], v[1]).d < margin) { need = true; break; }
      if (!need) return;
      let q = p.map((v) => [v[0], v[1]]);
      for (let it = 0; it < 4; it++) {
        let worst = null;
        for (const v of q) { const c = nearest(v[0], v[1]); if (c.d < margin && (!worst || c.d < worst.d)) worst = c; }
        if (!worst) break;
        const k = margin - worst.d + 0.05;
        q = q.map((v) => [v[0] + worst.nx * k, v[1] + worst.ny * k]);
      }
      if (q.every((v) => inside(B, v[0], v[1]))) { b.p = q; moved++; }
      return;
    }
    // crossings between the building's edges and the wall
    const bb = near(p, 1), cr = [];
    for (let j = 0; j < n; j++) {
      const c = B[j], d = B[(j + 1) % n];
      if (Math.max(c[0], d[0]) < bb.x0 || Math.min(c[0], d[0]) > bb.x1 || Math.max(c[1], d[1]) < bb.y0 || Math.min(c[1], d[1]) > bb.y1) continue;
      for (let i = 0; i < m; i++) { const s = cross(p[i], p[(i + 1) % m], c, d); if (s) cr.push({ i, t: s.t, j, x: s.x, y: s.y }); }
    }
    cr.sort((u, v) => u.i - v.i || u.t - v.t);
    const a0 = area(p);
    let out = null;
    if (cr.length === 2) {
      const [c1, c2] = cr;
      // does the ring go inside just after c1?
      const nextV = c1.i === c2.i ? [c2.x, c2.y] : p[(c1.i + 1) % m];
      const fwdIn = inside(B, (c1.x + nextV[0]) / 2, (c1.y + nextV[1]) / 2);
      const E = fwdIn ? c1 : c2, X = fwdIn ? c2 : c1;                     // the ring enters the campus at E and leaves it at X
      const chain = [[E.x, E.y]];
      if (E.i !== X.i || E.t > X.t) { for (let k = (E.i + 1) % m, guard = 0; guard < m + 1; k = (k + 1) % m, guard++) { chain.push(p[k]); if (k === X.i) break; } }
      else { /* E and X on the same edge, E before X: nothing between */ }
      chain.push([X.x, X.y]);
      // back along the wall from X to E, the shorter way round
      const fwd = (E.j - X.j + n) % n, bwd = (X.j - E.j + n) % n, wall = [];
      if (E.j !== X.j) {
        if (fwd <= bwd) for (let k = 1; k <= fwd; k++) wall.push(B[(X.j + k) % n]);
        else for (let k = 0; k < bwd; k++) wall.push(B[(X.j - k + n) % n]);
      }
      out = [...chain, ...wall.map((v) => [v[0], v[1]])];
    }
    if (!out || out.length < 3) {
      // more than one bite out of it (or numerical trouble): small ones go, larger ones are pushed in
      if (a0 < 220) { drop.add(bi); return; }
      out = p.map(push);
    } else out = out.map(push);
    // pushing can leave a duplicate corner: drop near-identical neighbours
    const clean = [];
    for (const v of out) { const l = clean[clean.length - 1]; if (!l || Math.hypot(l[0] - v[0], l[1] - v[1]) > 0.15) clean.push(v); }
    if (clean.length > 1 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) <= 0.15) clean.pop();
    const a1 = clean.length >= 3 ? area(clean) : 0;
    if (a1 < 12 || a1 < a0 * 0.3 || !clean.every((v) => inside(B, v[0], v[1]))) { drop.add(bi); return; }
    b.p = clean;
    if (b.holes?.length) b.holes = b.holes.filter((h) => h.every((v) => inside(clean, v[0], v[1])));
    trimmed++;
  });
  if (drop.size) {
    const map = []; let k = 0;
    data.buildings = data.buildings.filter((b, i) => { map[i] = drop.has(i) ? -1 : k++; return !drop.has(i); });
    for (const s of data.sites || []) s.ids = s.ids.map((i) => map[i]).filter((i) => i >= 0);
  }
  return { trimmed, moved, removed: drop.size };
}

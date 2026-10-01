// Puts the master-plan facts (plan_data.js) onto the map, before the props and labels are built:
// staff-quarter types on the housing (A = senior faculty bungalows ... F = staff flats), the post
// office and the railway reservation counter, map labels for the water and sewage treatment
// plants, and the plan's hostel numbers in the hostel descriptions.
import { PLAN } from '../plan_data.js';

/** the map (OpenStreetMap) names some outlets after real companies: the game uses generic names */
const GENERIC = {
  'Subway': 'Sandwich Bar', 'Baskin Robbins': 'Ice Cream Parlour',
  'SBI': 'Bank Branch', 'Canara Bank': 'Bank ATM',
};

export function applyPlan(W) {
  const done = { quarters: {}, labels: 0 };
  for (const p of W.pois) if (GENERIC[p.name]) p.name = GENERIC[p.name];
  // staff quarters: each unnamed house takes the type marked nearest to it on the plan
  for (const b of W.buildings) {
    if (b.kind !== 'residential' || b.site || b.display || b.area < 40) continue;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    let best = null, bd = 85;
    for (const [t, list] of Object.entries(PLAN.quarters)) for (const [x, y] of list) { const d = Math.hypot(x - cx, -y - cz); if (d < bd) { bd = d; best = t; } }
    if (best) { b.qtype = best; b.display = `${best}-Type Quarters`; done.quarters[best] = (done.quarters[best] || 0) + 1; }
  }
  const poi = (name, kind, x, y) => { W.pois.push({ name, kind, x, y, wx: x, wz: -y }); done.labels++; };
  // one map label per cluster of each quarter type
  for (const [t, list] of Object.entries(PLAN.quarters)) {
    if (!done.quarters[t]) continue;
    const cl = [];
    for (const [x, y] of list) { const c = cl.find((q) => Math.hypot(q.x / q.n - x, q.y / q.n - y) < 170); if (c) { c.x += x; c.y += y; c.n++; } else cl.push({ x, y, n: 1 }); }
    for (const c of cl) poi(`${t}-Type Quarters`, 'residential', c.x / c.n, c.y / c.n);
  }
  // buildings that are these places
  const near = (p, maxD, pred = () => true) => {
    let best = null, bd = maxD;
    for (const b of W.buildings) {
      if (!pred(b)) continue;
      const d = Math.max(0, Math.max(b.x0 - p.x, p.x - b.x1), Math.max(b.z0 + p.y, -p.y - b.z1));   // box distance
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  };
  const po = near(PLAN.postOffice, 12);
  if (po) { po.display = 'Post Office'; po.postOffice = true; poi('Post Office', 'service', (po.x0 + po.x1) / 2, -(po.z0 + po.z1) / 2); }
  const prs = near(PLAN.reservation, 35, (b) => b !== po && b.area < 200);
  if (prs) { prs.display = 'Railway Reservation Counter'; prs.reservation = true; poi('Railway Reservation Counter', 'service', (prs.x0 + prs.x1) / 2, -(prs.z0 + prs.z1) / 2); }
  poi('Water Treatment Plant', 'service', PLAN.waterTreatment.x, PLAN.waterTreatment.y);
  poi('Sewage Treatment Plant', 'service', PLAN.sewageTreatment.x, PLAN.sewageTreatment.y);
  // the hostels in the order they were built
  for (const [id, n] of Object.entries(PLAN.hostelNumbers)) {
    const l = W.landmark(id);
    if (l && l.desc && !/master plan/.test(l.desc)) l.desc += ` Marked "Hostel ${n}" on the campus master plan.`;
  }
  return done;
}

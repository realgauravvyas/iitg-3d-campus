// Full vehicle footprints, including walls crossed between animation frames.
// Work in the vehicle's local coordinates so concave buildings and courtyards work too.
import { pointInRing, wrapAngle } from './util.js';

export function footprintBlocked(world, x, z, yaw, hl, hw) {
  const s = Math.sin(yaw), c = Math.cos(yaw), R = Math.hypot(hl, hw);
  // no vehicle on a lake or on a sports ground: check the four corners and the middle of the body
  if (world.vehicleKeepOut) for (const [a, b] of [[0, 0], [hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) if (world.vehicleKeepOut(x + a * s + b * c, z + a * c - b * s)) return true;
  const seen = new Set();
  for (let gx = Math.floor((x - R) / 25); gx <= Math.floor((x + R) / 25); gx++) {
    for (let gz = Math.floor((z - R) / 25); gz <= Math.floor((z + R) / 25); gz++) {
      for (const b of world.buildingsNear(gx * 25 + 12.5, gz * 25 + 12.5)) {
        if (seen.has(b)) continue;
        seen.add(b);
        if (b.x1 < x - R || b.x0 > x + R || b.z1 < z - R || b.z0 > z + R) continue;
        if (pointInRing(x, z, b.rings[0]) && !b.rings.slice(1).some(r => pointInRing(x, z, r))) return true;
        for (const ring of b.rings) {
          for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
            const ax = ring[j] - x, az = ring[j + 1] - z;
            const bx = ring[i] - x, bz = ring[i + 1] - z;
            if (segmentBox(ax * c - az * s, ax * s + az * c,
              bx * c - bz * s, bx * s + bz * c, hw, hl)) return true;
          }
        }
      }
    }
  }
  return false;
}

function segmentBox(ax, az, bx, bz, hw, hl) {
  let lo = 0, hi = 1;
  for (const [a, d, h] of [[ax, bx - ax, hw], [az, bz - az, hl]]) {
    if (Math.abs(d) < 1e-10) { if (Math.abs(a) > h) return false; continue; }
    const t1 = (-h - a) / d, t2 = (h - a) / d;
    lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
    if (lo > hi) return false;
  }
  return true;
}

export function sweepBlocked(world, from, to, hl, hw) {
  if (!from) return footprintBlocked(world, to.x, to.z, to.yaw, hl + 0.12, hw + 0.12);
  const angle = wrapAngle(to.yaw - from.yaw);
  const travel = Math.hypot(to.x - from.x, to.z - from.z) + Math.abs(angle) * Math.hypot(hl, hw);
  const steps = Math.max(1, Math.ceil(travel / 0.3));
  // Padding covers the maximum displacement between samples, preventing tunnelling.
  const pad = 0.12 + travel / steps / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (footprintBlocked(world, from.x + (to.x - from.x) * t,
      from.z + (to.z - from.z) * t, from.yaw + angle * t, hl + pad, hw + pad)) return true;
  }
  return false;
}

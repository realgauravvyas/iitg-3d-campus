// Where you are put down when you get out of a vehicle: the nearest clear ground beside it, never in a wall, the water, a fence or another vehicle.
// `v` is { x, z, yaw }; `side` is 1 for the vehicle's left (the kerb side: traffic keeps left) or -1 for its right; `others` are vehicle boxes
// ({ x, z, yaw, hl, hw }) to keep clear of. Always returns a spot (the old fixed one if nothing beside the vehicle is free).
const tmp = { x: 0, z: 0 };

export function exitSpot(world, v, { side = 1, others = [], r = 0.45 } = {}) {
  const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  const onCampus = world.insideCampus(v.x, v.z);
  const free = (x, z) => {
    if (world.buildingAt(x, z) || world.waterAt(x, z) || world.solidAt?.(x, z, r)) return false;
    if (onCampus && !world.insideCampus(x, z)) return false;
    for (const o of others) {
      const c = Math.cos(o.yaw), s = Math.sin(o.yaw), dx = x - o.x, dz = z - o.z;
      if (Math.abs(dx * s + dz * c) < o.hl + r + 0.2 && Math.abs(dx * c - dz * s) < o.hw + r + 0.2) return false;
    }
    tmp.x = x; tmp.z = z;
    return !world.collide(tmp, r, world.heightAt(x, z) + 0.05);          // fences, kerbs and steps too high to step onto
  };
  const tries = [];
  for (const d of [1.9, 2.6, 3.4]) for (const s of [side, -side]) tries.push([lx * d * s, lz * d * s]);
  for (const d of [3.4, 4.6]) tries.push([-fx * d, -fz * d], [fx * d, fz * d]);
  for (const [dx, dz] of tries) if (free(v.x + dx, v.z + dz)) return { x: v.x + dx, z: v.z + dz };
  return { x: v.x + lx * 1.9 * side, z: v.z + lz * 1.9 * side };
}

// Draw distance for the small things: signs, props, desks, doors, cycles, court furniture and so on that are too far away to be seen are not sent
// to the graphics card. In the open parts of the campus the camera looks over a kilometre of it, and a few hundred of these little meshes (each its
// own draw call) were drawn for nothing. A hidden thing is moved to a layer the camera does not draw (so it casts no shadow either); nothing else
// about it changes, and other code can still show and hide it as before.
import * as THREE from 'three';

// groups of things that stand still (the ones that move, such as vehicles, people and boats, are not in this list)
const STATIC = new Set(['props', 'signage', 'sports-courts', 'onestop', 'photo-landmarks', 'doors', 'bus-terminus', 'cycleshops', 'directors-bungalow',
  'pool-complex', 'stalls', 'bus-stands', 'side-door', 'hill-trail', 'infrastructure', 'viewpoint', 'techpark', 'cycle-parks']);
const BIG = 40;               // a mesh bigger than this (radius, m) is always drawn

export class DrawDist {
  constructor(scene) {
    this.items = [];
    this.bias = 1;              // 1 normally; the game lowers it on a machine that cannot keep up
    this.hidden = 0;
    this.t = 0;
    this.last = new THREE.Vector3(1e9, 0, 1e9);
    scene.updateMatrixWorld(true);
    for (const c of scene.children) if (STATIC.has(c.name) || /^entrance-/.test(c.name)) this.add(c);
  }

  add(root) {
    const c = new THREE.Vector3();
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      let bs;
      if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); bs = o.boundingSphere; }
      else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); bs = o.geometry.boundingSphere; }
      if (!bs) return;
      const r = bs.radius * Math.max(o.matrixWorld.getMaxScaleOnAxis(), 1e-6);
      if (r > BIG || !isFinite(r)) return;
      c.copy(bs.center).applyMatrix4(o.matrixWorld);
      // a small prop is gone at about 250 m, a bigger thing later: its size on the screen is what counts
      this.items.push({ o, x: c.x, y: c.y, z: c.z, r, lim: 230 + r * 20, off: false });
    });
  }

  /** every few frames, or at once after a jump: hide what is beyond its distance, show what has come back in */
  update(camera) {
    const p = camera.position;
    this.t++;
    const moved = Math.abs(p.x - this.last.x) + Math.abs(p.z - this.last.z) > 40;
    if (this.t % 10 && !moved) return;
    this.last.copy(p);
    const b = this.bias;
    let hidden = 0;
    for (const it of this.items) {
      const dx = it.x - p.x, dy = it.y - p.y, dz = it.z - p.z, d2 = dx * dx + dy * dy + dz * dz;
      const lim = it.lim * b + it.r;
      // a little hysteresis, so a thing at the edge does not flicker in and out
      const off = it.off ? d2 > (lim * 0.96) * (lim * 0.96) : d2 > (lim * 1.03) * (lim * 1.03);
      if (off !== it.off) { it.off = off; it.o.layers.set(off ? 1 : 0); }
      if (off) hidden++;
    }
    this.hidden = hidden;
  }
}

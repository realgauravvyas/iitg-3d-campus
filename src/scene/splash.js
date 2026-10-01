// Water effects: droplet bursts (hands striking the water, jumping in, boats) and expanding
// ripple rings on the surface around swimmers, boats and ducks.
import * as THREE from 'three';

export class SplashFX {
  constructor(scene) {
    const N = 400;
    this.N = N;
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3); this.life = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xeaf6ff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
    this.pts.frustumCulled = false;
    scene.add(this.pts);
    this.i = 0;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 56, 0, 7); x.stroke();
    x.lineWidth = 2; x.globalAlpha = 0.5; x.beginPath(); x.arc(64, 64, 46, 0, 7); x.stroke();
    const tex = new THREE.CanvasTexture(c);
    this.rings = [];
    for (let k = 0; k < 48; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; m.renderOrder = 3;
      scene.add(m);
      this.rings.push({ m, t: 0, T: 1, s: 1 });
    }
    this.ri = 0;
  }

  burst(x, y, z, n = 12, power = 1.5) {
    for (let k = 0; k < n; k++) {
      const i = this.i; this.i = (this.i + 1) % this.N;
      const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random()) * power * 0.6;
      this.p[i * 3] = x + Math.cos(a) * 0.1; this.p[i * 3 + 1] = y + 0.05; this.p[i * 3 + 2] = z + Math.sin(a) * 0.1;
      this.v[i * 3] = Math.cos(a) * s; this.v[i * 3 + 1] = (1.2 + Math.random() * 1.6) * power * 0.8; this.v[i * 3 + 2] = Math.sin(a) * s;
      this.life[i] = 0.5 + Math.random() * 0.5;
    }
  }

  ripple(x, y, z, size = 1) {
    const r = this.rings[this.ri]; this.ri = (this.ri + 1) % this.rings.length;
    r.m.position.set(x, y + 0.03, z); r.t = 0; r.T = 1.6 * size + 0.6; r.s = size; r.m.visible = true;
  }

  update(dt) {
    const P = this.p, V = this.v, L = this.life;
    for (let i = 0; i < this.N; i++) {
      if (L[i] <= 0) { P[i * 3 + 1] = -9999; continue; }
      L[i] -= dt;
      V[i * 3 + 1] -= 9.8 * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.t += dt;
      const k = r.t / r.T;
      if (k >= 1) { r.m.visible = false; continue; }
      const s = 0.4 + k * 3.2 * r.s;
      r.m.scale.set(s, 1, s);
      r.m.material.opacity = (1 - k) * 0.55;
    }
  }
}

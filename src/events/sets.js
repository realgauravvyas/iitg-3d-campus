// Set pieces for campus events: tents, banners, stages with lights and screens,
// bleachers, a convocation pandal, booths. All built in a local frame then placed.
import * as THREE from 'three';
import { mergeColored, m4, canvasTexture, mulberry32, fitText } from '../util.js';
import { makeBoardsTwoSided } from '../scene/bidir.js';

export function bannerTex(title, sub = '', { bg = '#7d1f1f', fg = '#f7f1e3', accent = '#c89b3c', w = 1024, h = 256 } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // gamosa-style borders
    g.fillStyle = accent; g.fillRect(0, 12, w, 8); g.fillRect(0, h - 20, w, 8);
    g.fillStyle = '#f3ead7'; for (let x = 0; x < w; x += 36) { g.fillRect(x, 24, 18, 4); g.fillRect(x + 18, h - 28, 18, 4); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = h * 0.36; g.font = `bold ${fs}px "Teko", "Hind", sans-serif`;
    while (g.measureText(title).width > w - 60) { fs -= 4; g.font = `bold ${fs}px "Teko", "Hind", sans-serif`; }
    g.fillText(title, w / 2, sub ? h * 0.42 : h / 2);
    if (sub) { g.font = `${h * 0.14}px "Hind", sans-serif`; g.fillStyle = accent; g.fillText(sub, w / 2, h * 0.74); }
  }, { repeat: false });
}

export class SetBuilder {
  constructor(world, x, z, yaw) {
    this.W = world; this.x = x; this.z = z; this.yaw = yaw;
    this.y = world.heightAt(x, z);
    this.parts = []; this.group = new THREE.Group(); this.lights = []; this.anims = [];
    this.group.position.set(x, this.y, z);
    this.group.rotation.y = yaw;
  }
  /** local -> world */
  at(lx, lz) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return { x: this.x + lx * c + lz * s, z: this.z - lx * s + lz * c }; }
  box(x, y, z, sx, sy, sz, color, ry = 0) { this.parts.push({ geometry: new THREE.BoxGeometry(sx, sy, sz), color, matrix: m4(x, y + sy / 2, z, 0, ry, 0) }); }
  cyl(x, y, z, r, h, color, seg = 10) { this.parts.push({ geometry: new THREE.CylinderGeometry(r, r, h, seg), color, matrix: m4(x, y + h / 2, z) }); }
  geo(g, color, m) { this.parts.push({ geometry: g, color, matrix: m }); }
  plane(x, y, z, w, h, ry, tex, emissive = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: emissive ? 0xffffff : 0, emissiveMap: emissive ? tex : null, emissiveIntensity: emissive, side: THREE.DoubleSide, roughness: 0.7 }));
    m.position.set(x, y, z); m.rotation.y = ry;
    this.group.add(m);
    return m;
  }
  /** canopy tent (shamiana) w x d with a sloped white roof */
  tent(x, z, w, d, color = '#f4f1ea', trim = '#b3262f') {
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.cyl(x + a * w / 2, 0, z + b * d / 2, 0.06, 2.6, '#8a8a8a', 6);
    this.geo(new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.02, 1.1, 4, 1, true), color, m4(x, 3.15, z, 0, Math.PI / 4, 0, w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414));
    this.box(x, 2.45, z + d / 2, w, 0.25, 0.04, trim); this.box(x, 2.45, z - d / 2, w, 0.25, 0.04, trim);
  }
  table(x, z, w = 1.8, d = 0.7, cloth = '#1f4fa0') { this.box(x, 0, z, w, 0.76, d, cloth); }
  chairsRows(x0, z0, cols, rows, dx, dz, color, ry = 0) {
    const seats = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = x0 + c * dx, z = z0 + r * dz;
      this.box(x, 0.43, z, 0.44, 0.05, 0.42, color, ry);
      this.box(x - Math.sin(ry) * 0.2, 0.46, z - Math.cos(ry) * 0.2, 0.44, 0.44, 0.05, color, ry);
      seats.push({ lx: x - Math.sin(ry) * 0.1, lz: z - Math.cos(ry) * 0.1, yaw: ry });
    }
    return seats;
  }
  /** a raised stage with truss towers, LED screen and moving light beams */
  stage(x, z, w, d, { screen = null, color = '#1c1c1c', beams = 6, h = 1.4 } = {}) {
    this.box(x, 0, z, w, h, d, color);
    this.box(x, h, z, w, 0.04, d, '#2a2a2e');
    for (const s of [-1, 1]) {
      for (const dz of [-d / 2 + 0.3, d / 2 - 0.3]) this.box(x + s * (w / 2 + 0.4), 0, z + dz, 0.5, 9, 0.5, '#6f7378');
      this.box(x + s * (w / 2 + 1.6), 0, z + d / 2 - 0.8, 2.2, 3.6, 1.6, '#151515');        // speaker stacks
    }
    this.box(x, 9, z - d / 2 + 0.3, w + 1.4, 0.5, 0.5, '#6f7378');
    this.box(x, 9, z + d / 2 - 0.3, w + 1.4, 0.5, 0.5, '#6f7378');
    this.box(x, 0, z - d / 2 - 0.1, w, 9, 0.2, '#0c0c0e');
    let scr = null;
    if (screen) scr = this.plane(x, h + 4.2, z - d / 2 + 0.05, w * 0.62, 5.2, 0, screen, 1.2);
    // light beams (additive cones), animated
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let k = 0; k < beams; k++) {
      const g = new THREE.ConeGeometry(1.6, 16, 16, 1, true).translate(0, -8, 0);
      const m = new THREE.Mesh(g, beamMat.clone());
      m.position.set(x - w / 2 + (k + 0.5) * (w / beams), 8.8, z + d / 2 - 0.3);
      m.material.color.setHSL(k / beams, 0.9, 0.55);
      this.group.add(m);
      this.anims.push((t, night) => { m.rotation.x = 0.5 + Math.sin(t * 0.9 + k) * 0.35; m.rotation.z = Math.sin(t * 0.7 + k * 1.7) * 0.5; m.material.opacity = 0.05 + night * 0.22; m.material.color.setHSL((k / beams + t * 0.05) % 1, 0.9, 0.55); });
    }
    return scr;
  }
  bleachers(x, z, w, rows, color = '#8a8f96') {
    const seats = [];
    for (let r = 0; r < rows; r++) {
      this.box(x, 0, z + r * 0.8, w, 0.45 + r * 0.45, 0.8, color);
      for (let u = -w / 2 + 0.4; u < w / 2 - 0.3; u += 0.62) seats.push({ lx: x + u, lz: z + r * 0.8 + 0.1, ly: 0.45 + r * 0.45, yaw: Math.PI });
    }
    return seats;
  }
  pandal(x, z, w, d, color = '#f4f1ea') {
    for (let u = -w / 2; u <= w / 2; u += w / 6) for (const s of [-1, 1]) this.cyl(x + u, 0, z + s * d / 2, 0.12, 5, '#c89b3c', 8);
    this.box(x, 5, z, w + 1, 0.2, d + 1, color);
    this.geo(new THREE.CylinderGeometry(0.01, Math.hypot(w, d) / 2, 2.2, 4, 1, true), color, m4(x, 6.2, z, 0, Math.PI / 4, 0, w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414));
    for (let u = -w / 2; u < w / 2; u += 1.2) this.box(x + u + 0.6, 4.6, z + d / 2 + 0.5, 1.2, 0.4, 0.03, (Math.round(u) % 2 ? '#b3262f' : '#c89b3c'));
  }
  booth(x, z, title, sub, color, ry = 0) {
    this.tent(x, z, 3.2, 2.6, '#f4f1ea', color);
    this.table(x, z + 0.6, 2.4, 0.7, color);
    const t = bannerTex(title, sub, { bg: color, w: 512, h: 160 });
    this.plane(x, 2.05, z - 1.28, 3.0, 0.9, ry, t);
  }
  podium(x, z) {
    for (const [dx, h, c] of [[0, 1.0, '#c89b3c'], [-1.3, 0.7, '#b9bec4'], [1.3, 0.5, '#b0784a']]) this.box(x + dx, 0, z, 1.2, h, 1.0, c);
  }
  finish() {
    if (this.parts.length) {
      const m = new THREE.Mesh(mergeColored(this.parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
    }
    makeBoardsTwoSided(this.group);            // banners and booth boards read the right way round from both sides
    return this.group;
  }
  update(t, night) { for (const f of this.anims) f(t, night); }
}

/** animated LED-screen texture (concert visuals) */
export function ledScreen(title, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = fitText(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  let t = 0;
  const rnd = mulberry32(3);
  const bars = Array.from({ length: 32 }, () => rnd());
  return {
    tex,
    update(dt, beat) {
      t += dt;
      const hue = (t * 40) % 360;
      const gr = g.createLinearGradient(0, 0, 512, 256);
      gr.addColorStop(0, `hsl(${hue},80%,18%)`); gr.addColorStop(1, `hsl(${(hue + 120) % 360},80%,12%)`);
      g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 32; i++) { const h = (0.2 + 0.8 * Math.abs(Math.sin(t * 3 + bars[i] * 9))) * 120 * (0.6 + beat * 0.6); g.fillStyle = `hsla(${(hue + i * 8) % 360},90%,60%,0.85)`; g.fillRect(i * 16 + 2, 256 - h, 12, h); }
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 58px "Teko", "Hind", sans-serif'; g.fillText(title, 256, 92);
      g.font = '24px "Hind", sans-serif'; g.fillStyle = '#ffd54a'; g.fillText(sub, 256, 130);
      tex.needsUpdate = true;
    },
  };
}

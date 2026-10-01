// A physical ball: gravity, air drag, bounces on the terrain, rolling friction.
import * as THREE from 'three';

const TEX = {};
function ballTex(kind) {
  if (TEX[kind]) return TEX[kind];
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'football') { g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#1c1c1c'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc((i * 37) % 128, (i * 23) % 64, 7, 0, 7); g.fill(); } }
  else if (kind === 'basketball') { g.fillStyle = '#d9661f'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#2a1a10'; g.lineWidth = 2; for (const x of [0, 32, 64, 96]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); } g.beginPath(); g.moveTo(0, 32); g.lineTo(128, 32); g.stroke(); }
  else if (kind === 'tennis') { g.fillStyle = '#d6ee2e'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#f7f7ea'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= 128; x += 4) g.lineTo(x, 32 + Math.sin((x / 128) * Math.PI * 4) * 16); g.stroke(); }
  else if (kind === 'cricket') { g.fillStyle = kind === 'cricket' ? '#b3151b' : '#fff'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#f2e6c8'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 30); g.lineTo(128, 30); g.moveTo(0, 34); g.lineTo(128, 34); g.stroke(); }
  else { g.fillStyle = '#e8e4d2'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#2f5fa8'; g.fillRect(0, 20, 128, 10); g.fillStyle = '#f2c12e'; g.fillRect(0, 36, 128, 10); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  TEX[kind] = t;
  return t;
}

export class Ball {
  constructor(scene, kind = 'football') {
    this.kind = kind;
    this.r = { football: 0.11, basketball: 0.12, cricket: 0.036, volleyball: 0.105, tennis: 0.033, disc: 0.13 }[kind] || 0.1;
    this.bounce = { football: 0.55, basketball: 0.72, cricket: 0.5, volleyball: 0.6, tennis: 0.7, disc: 0.1 }[kind] || 0.5;
    const geo = kind === 'disc' ? new THREE.CylinderGeometry(0.13, 0.13, 0.025, 20) : new THREE.SphereGeometry(this.r, 14, 10);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ballTex(kind), roughness: 0.55, color: kind === 'disc' ? 0xe8e4d2 : 0xffffff }));
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.bounces = 0;
    this.resting = false;
    this.onGround = false;
  }
  set(x, y, z, vx = 0, vy = 0, vz = 0) { this.pos.set(x, y, z); this.vel.set(vx, vy, vz); this.bounces = 0; this.resting = false; }
  update(dt, world, { drag = 0.012, friction = 1.6 } = {}) {
    if (this.resting || this.held) { this.mesh.position.copy(this.pos); return null; }
    let event = null;
    const steps = Math.ceil(dt / 0.008);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.vel.y -= 9.81 * h;
      this.vel.multiplyScalar(1 - drag * this.vel.length() * h * (this.kind === 'disc' ? 0.2 : 1));
      if (this.kind === 'disc') this.vel.y += 7.5 * h * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 10); // lift
      this.pos.addScaledVector(this.vel, h);
      const g = world.heightAt(this.pos.x, this.pos.z) + this.r;
      if (this.pos.y <= g) {
        this.pos.y = g;
        if (this.vel.y < -1.2) { this.vel.y = -this.vel.y * this.bounce; this.vel.x *= 0.82; this.vel.z *= 0.82; this.bounces++; event = 'bounce'; }
        else { this.vel.y = 0; this.onGround = true; const s = Math.hypot(this.vel.x, this.vel.z); const k = Math.max(0, s - friction * h) / (s || 1); this.vel.x *= k; this.vel.z *= k; }
      } else this.onGround = false;
    }
    if (this.onGround && Math.hypot(this.vel.x, this.vel.z) < 0.05) { this.vel.set(0, 0, 0); this.resting = true; }
    this.mesh.position.copy(this.pos);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.01) { this.mesh.rotation.x += (this.vel.z / this.r) * dt; this.mesh.rotation.z -= (this.vel.x / this.r) * dt; }
    return event;
  }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

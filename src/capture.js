// Photos and video: a handheld camera (your character lifts it to the eye) and the drone
// camera. Photos go to an in-browser gallery (IndexedDB) and can be downloaded; video is
// recorded straight from the 3D view with MediaRecorder.
import * as THREE from 'three';
import { clamp, wrapAngle } from './util.js';

const DB = 'iitg3d-gallery';
function db() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('shots', { keyPath: 'id', autoIncrement: true });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}

const FILTERS = ['none', 'vivid', 'warm', 'cool', 'film', 'sepia', 'bw'];
const FILTER_NAMES = { none: 'Natural', vivid: 'Vivid', warm: 'Warm', cool: 'Cool', film: 'Film', sepia: 'Sepia', bw: 'Black & white' };

export class Capture {
  constructor(game) {
    this.g = game;
    this.pending = null;
    this.rec = null;
    this.session = [];     // [{id, url, kind, name, date}] also shown in the journal
    this.fov = 55;
    this.loadGallery();
  }

  async loadGallery() {
    try {
      const d = await db();
      const tx = d.transaction('shots', 'readonly');
      const req = tx.objectStore('shots').getAll();
      req.onsuccess = () => { this.session = req.result.slice(-60).map((r) => ({ ...r, url: URL.createObjectURL(r.blob) })); };
    } catch { /* no IndexedDB (private window): photos last for this session */ }
  }
  async store(rec) {
    rec.url = URL.createObjectURL(rec.blob);
    this.session.push(rec);
    try {
      const d = await db();
      const tx = d.transaction('shots', 'readwrite');
      const { url, ...plain } = rec;
      const req = tx.objectStore('shots').add(plain);
      req.onsuccess = () => { rec.id = req.result; };
    } catch { /* session only */ }
  }
  async remove(rec) {
    this.session = this.session.filter((r) => r !== rec);
    try { const d = await db(); d.transaction('shots', 'readwrite').objectStore('shots').delete(rec.id); } catch { /* ignore */ }
  }

  /** request a photo: grabbed right after the next render so the canvas is intact */
  snap(label = 'Photo') { this.pending = label; }
  afterRender() {
    // recording: copy the finished frame onto an opaque canvas (what you see, with no see-through
    // pixels), which is what the video encoder takes
    const m = this.mirror;
    if (m) {
      const src = this.g.renderer.domElement;
      if (m.c.width !== src.width || m.c.height !== src.height) { m.c.width = src.width; m.c.height = src.height; }
      m.x.fillStyle = '#000'; m.x.fillRect(0, 0, m.c.width, m.c.height); m.x.drawImage(src, 0, 0);
    }
    if (!this.pending) return;
    const label = this.pending;
    this.pending = null;
    const g = this.g;
    const subject = this.subject();
    // the 3D view has see-through pixels (e.g. where a film shows through): flatten it onto black so
    // the photo looks the same in any viewer
    const src = g.renderer.domElement, flat = document.createElement('canvas');
    flat.width = src.width; flat.height = src.height;
    const cx = flat.getContext('2d');
    cx.fillStyle = '#000'; cx.fillRect(0, 0, flat.width, flat.height); cx.drawImage(src, 0, 0);
    flat.toBlob((blob) => {
      if (!blob) return;
      const name = `IITG-${label}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
      this.store({ blob, kind: 'photo', name, date: Date.now(), subject: subject?.name || '' });
      g.ui.toast(subject ? `Photo of ${subject.name} saved to your gallery (Journal).` : 'Photo saved to your gallery (Journal).', 'info', 'Snap!');
      const n = g.progress.count('photos');
      // a sunset (or sunrise) shot: golden light, facing the sun
      const dir = g.camera.getWorldDirection(new THREE.Vector3());
      if (g.sky.state.gold > 0.45 && dir.dot(g.sky.state.sunDir) > 0.55) { g.progress.unlock('sunset_photo'); }
      if (subject) { g.progress.addXP(8, 'photo'); if (g.progress.count(`photo_${subject.id}`) === 1 && n >= 3) g.progress.unlock('club'); }
    }, 'image/png');
    g.audio.shutter?.();
    g.ui.flash();
  }
  /** the landmark nearest the centre of the frame, if any */
  subject() {
    const cam = this.g.camera, v = new THREE.Vector3();
    let best = null, bd = 0.35;
    for (const l of this.g.world.landmarks) {
      v.set(l.wx, l.wy + 6, l.wz);
      const dist = v.distanceTo(cam.position);
      if (dist > 350) continue;
      v.project(cam);
      if (v.z > 1) continue;
      const d = Math.hypot(v.x, v.y);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }

  toggleVideo() {
    const g = this.g;
    if (this.rec) { this.rec.stop(); return; }
    const canvas = g.renderer.domElement;
    if (!canvas.captureStream || !window.MediaRecorder) { g.ui.toast('Video recording is not supported in this browser.', 'warn'); return; }
    const mc = document.createElement('canvas'); mc.width = canvas.width; mc.height = canvas.height;
    this.mirror = { c: mc, x: mc.getContext('2d', { alpha: false }) };
    this.afterRender();
    const stream = mc.captureStream(30);
    // the game's sound goes into the video too
    const A = g.audio, tap = A?.ctx && A.out ? A.ctx.createMediaStreamDestination() : null;
    if (tap) { A.out.connect(tap); for (const t of tap.stream.getAudioTracks()) stream.addTrack(t); }
    // MP4 (H.264 + AAC) plays in every video player on Windows, phones and the web; WebM only where MP4 cannot be made
    const type = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const chunks = [];
    const mr = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 8e6, audioBitsPerSecond: 160e3 } : undefined);
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      this.mirror = null;
      if (tap) { try { A.out.disconnect(tap); } catch { /* already gone */ } }
      const blob = new Blob(chunks, { type: (type || 'video/webm').split(';')[0] });
      const secs = Math.round((performance.now() - this.recStart) / 1000);
      this.store({ blob, kind: 'video', name: `IITG-video-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${type.includes('mp4') ? 'mp4' : 'webm'}`, date: Date.now(), secs });
      g.ui.toast(`${secs} s video saved to your gallery (Journal).`, 'info', 'Recording stopped');
      g.ui.rec(false);
      this.rec = null;
    };
    mr.start(500);
    this.rec = mr;
    this.recStart = performance.now();
    g.ui.rec(true);
    g.audio.tone(880, 0.1, { gain: 0.05 });
  }
  update() {
    if (this.rec) {
      const s = (performance.now() - this.recStart) / 1000;
      this.g.ui.recTime(s);
      if (s > 90) this.rec.stop();
    }
  }

  // ------------------------------------------------------------------ handheld camera mode (K)
  startHandheld() {
    const g = this.g;
    this.cam = { yaw: g.player.camYaw, pitch: 0 };
    this.fov = 55;
    // the camera is at your eye: hide your own body so your arms and hands are not in the photo or video
    g.player.avatar.root.visible = false;
    g.ui.camUI(true);
  }
  stopHandheld() {
    const g = this.g;
    g.photoFilter = 'none';
    g.player.avatar.root.visible = true;
    g.player.avatar.J.head.visible = true;
    g.camera.fov = g.progress.settings.fov || 62;
    g.camera.updateProjectionMatrix();
    g.ui.camUI(false);
  }
  updateHandheld(dt) {
    const g = this.g, i = g.input, P = g.player;
    const sens = 0.0022 * (60 / Math.max(20, 110 - this.fov));
    this.cam.yaw = wrapAngle(this.cam.yaw - i.dx * sens);
    this.cam.pitch = clamp(this.cam.pitch - i.dy * sens, -1.2, 1.2);
    if (i.wheel) this.fov = clamp(this.fov * Math.pow(1.1, i.wheel), 14, 75);
    // slow shuffle while framing
    const ax = i.axis();
    const fx = Math.sin(this.cam.yaw), fz = Math.cos(this.cam.yaw);
    P.pos.x += (fx * ax.y - fz * ax.x) * 1.0 * dt; P.pos.z += (fz * ax.y + fx * ax.x) * 1.0 * dt;
    const W = g.env || g.world;
    W.collide(P.pos, 0.34, P.pos.y);
    P.pos.y = W.groundAt(P.pos.x, P.pos.z, P.pos.y + 0.5);
    P.heading = this.cam.yaw;
    P.avatar.root.position.copy(P.pos); P.avatar.root.rotation.set(0, P.heading, 0);
    P.avatar.animate({ type: 'camera', look: -this.cam.pitch * 0.6 }, dt);
    if (i.hit('Enter') || i.clicked) this.snap('handheld');
    if (i.hit('KeyR')) this.toggleVideo();
    // photo mode: filters and the time of day
    if (i.hit('KeyF')) { const k = (FILTERS.indexOf(g.photoFilter || 'none') + 1) % FILTERS.length; g.photoFilter = FILTERS[k]; g.ui.toast(`Filter: ${FILTER_NAMES[g.photoFilter]}`, 'info'); }
    if (i.hit('BracketRight')) g.clock.set((g.clock.hour + 0.5) % 24);
    if (i.hit('BracketLeft')) g.clock.set((g.clock.hour + 23.5) % 24);
    g.ui.camZoom(55 / this.fov, `${FILTER_NAMES[g.photoFilter || 'none']} · ${Math.round(this.fov)}° · F filter · [ ] time`);
  }
  cameraHandheld(cam) {
    const P = this.g.player, s = P.scale;
    const e = new THREE.Vector3(P.pos.x + Math.sin(this.cam.yaw) * 0.25, P.pos.y + 1.64 * s, P.pos.z + Math.cos(this.cam.yaw) * 0.25);
    cam.position.copy(e);
    const p = this.cam.pitch;
    cam.lookAt(e.x + Math.sin(this.cam.yaw) * Math.cos(p), e.y + Math.sin(p), e.z + Math.cos(this.cam.yaw) * Math.cos(p));
    if (Math.abs(cam.fov - this.fov) > 0.1) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}

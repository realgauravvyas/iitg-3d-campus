// Live video screens: the auditorium plays "The IIT Guwahati Film" and the Conference Centre's
// projector plays the AI Confluence 2025 aftermovie, both from YouTube, continuously.
//
// How: a YouTube player (iframe) is laid exactly over the 3D screen with CSS3D, *behind* the WebGL
// canvas, and the screen mesh punches a transparent hole in the canvas. So the real video shows
// through, and anything in front of the screen (people, the podium, you) still covers it properly.
// Each time you walk in, the film starts from its first second and plays to the end, then starts
// again; sound fades with distance. YouTube only plays in a page served over http(s) (launch.bat
// starts a tiny local server); opened as a plain file, offline, or inside claude.ai (whose security
// policy blocks other websites) the screen shows a title card and says why.
import * as THREE from 'three';
import { fitText } from './util.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

export const VIDEOS = {
  auditorium: { id: 'GV1GPFLknvc', start: 0, title: 'The IIT Guwahati Film', by: 'IIT Guwahati' },
  conference: { id: 'zKncCN6XEMQ', start: 0, title: 'IIT Guwahati AI Confluence 2025 · Official Cinematic Aftermovie', by: 'OES · IIT Guwahati' },
};
const PX = 1280;                                   // iframe width in CSS pixels

export class Screens {
  constructor(game) {
    this.g = game;
    this.css = new CSS3DRenderer();
    const el = this.css.domElement;
    el.id = 'screens3d';
    Object.assign(el.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    const canvas = game.renderer.domElement;
    canvas.parentNode.insertBefore(el, canvas);      // behind the canvas
    this.scene = new THREE.Scene();
    this.hole = new THREE.ShaderMaterial({
      vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'void main(){ gl_FragColor = vec4(0.0); }',
      blending: THREE.NoBlending, side: THREE.DoubleSide,
    });
    this.cur = null;
    this.ids = 0;
    this.durations = {};
    try { this.durations = JSON.parse(localStorage.getItem('iitg3d.videoDur') || '{}'); } catch { /* ignore */ }
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('message', (e) => this.onMessage(e));
    // a page whose security policy forbids other sites' frames (the claude.ai preview): say so
    document.addEventListener('securitypolicyviolation', (e) => {
      if (!/youtube/.test(e.blockedURI || '') || !this.cur || this.cur.failed) return;
      this.cur.failed = true;
      this.card(this.cur, 'This online preview blocks YouTube. Start the game with launch.bat on your PC to watch the film here.');
      this.g.ui.toast(`"${this.cur.video.title}" cannot play inside this online preview: its security policy blocks YouTube. Start the game with launch.bat on your PC to watch it.`, 'warn', 'Screen');
    });
  }

  /** the screen shows the film's title card (with its thumbnail if it loads) and why it is not playing */
  card(c, note) {
    if (!c || !c.mesh || c.cardTex) return;
    const W = 1280, H = Math.round((W * c.h) / c.w);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = fitText(cv.getContext('2d'));
    const tex = (c.cardTex = new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace;
    const wrap = (text, font, maxW) => { x.font = font; const out = []; let line = ''; for (const w of text.split(' ')) { const t = line ? `${line} ${w}` : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; };
    const draw = (img) => {
      x.fillStyle = '#0b0d14'; x.fillRect(0, 0, W, H);
      if (img) { x.globalAlpha = 0.5; x.drawImage(img, 0, 0, W, H); x.globalAlpha = 1; }
      const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.8)'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(230,33,23,0.92)'; x.beginPath(); x.roundRect?.(W / 2 - 70, H * 0.22, 140, 98, 22); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(W / 2 - 18, H * 0.22 + 26); x.lineTo(W / 2 + 30, H * 0.22 + 49); x.lineTo(W / 2 - 18, H * 0.22 + 72); x.closePath(); x.fill();
      x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff';
      const lines = wrap(c.video.title, '700 64px "Hind", "Segoe UI", sans-serif', W - 160);
      lines.slice(0, 3).forEach((l, i) => x.fillText(l, W / 2, H * 0.55 + i * 74));
      x.fillStyle = '#d8dde8'; x.font = '500 34px "Hind", "Segoe UI", sans-serif'; x.fillText(c.video.by || '', W / 2, H * 0.55 + Math.min(3, lines.length) * 74 + 6);
      x.fillStyle = '#ffd77a'; x.font = '600 34px "Hind", "Segoe UI", sans-serif';
      wrap(note, '600 34px "Hind", "Segoe UI", sans-serif', W - 220).slice(0, 2).forEach((l, i) => x.fillText(l, W / 2, H - 92 + i * 42));
      tex.needsUpdate = true;
    };
    draw(null);
    const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => draw(img); img.src = `https://i.ytimg.com/vi/${c.video.id}/hqdefault.jpg`;
    c.mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  }

  /** YouTube's embedded player refuses pages without an http(s) origin (error 153 on file://) */
  get possible() { return /^https?:$/.test(location.protocol) && navigator.onLine !== false; }
  resize() { this.css.setSize(window.innerWidth, window.innerHeight); }

  /** show `video` on this plane mesh (a PlaneGeometry of width w, height h) */
  attach(mesh, video, w, h) {
    this.detach();
    if (!mesh || !video) return;
    const cur = { mesh, video, w, h, poster: mesh.material, id: ++this.ids, ready: false, playing: false, t0: performance.now(), vol: -1 };
    this.cur = cur;
    if (!this.possible) {
      this.card(cur, navigator.onLine === false ? 'No internet connection: connect to watch the film.' : 'To watch the film here, start the game with launch.bat.');
      this.g.ui.toast(`"${video.title}" is on screen. To watch it here, start the game with launch.bat (it needs the internet).`, 'info', 'Screen');
      return;
    }
    const div = document.createElement('div');
    const hpx = Math.round((PX * h) / w);
    Object.assign(div.style, { width: `${PX}px`, height: `${hpx}px`, background: '#000' });
    const f = document.createElement('iframe');
    f.width = PX; f.height = hpx;
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.title = video.title;
    Object.assign(f.style, { border: '0', width: `${PX}px`, height: `${hpx}px`, display: 'block' });
    const at = this.position(video);
    f.src = `https://www.youtube.com/embed/${video.id}?enablejsapi=1&autoplay=1&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&fs=0&start=${Math.floor(at)}&origin=${encodeURIComponent(location.origin)}`;
    f.addEventListener('load', () => this.post({ event: 'listening', id: cur.id, channel: 'widget' }));
    div.appendChild(f);
    const obj = new CSS3DObject(div);
    obj.scale.setScalar(w / PX);
    this.scene.add(obj);
    cur.frame = f; cur.obj = obj;
    this.css.domElement.style.display = '';
  }

  // ------------------------------------------------------------------ presenting: share your real screen on the big screen
  /** true while somebody is presenting on this hall's screen */
  get presenting() { return !!this.cur?.pres; }

  /** Share a screen, window or browser tab of this computer on the hall's big screen, like plugging a laptop into the projector: the
   *  browser asks what to share (a YouTube tab that plays properly, slides, a document...), and what you pick is shown on the screen
   *  (and heard, if you share a tab with sound) until you stop. Returns true if it started. */
  async present() {
    const c = this.cur, g = this.g;
    if (!c || !c.mesh) { g.ui.toast('There is no screen here to present on.', 'warn', 'Present'); return false; }
    if (c.pres) { this.stopPresent(); return false; }                                    // pressing it again stops
    const md = navigator.mediaDevices;
    if (!md?.getDisplayMedia) { g.ui.toast('This browser cannot share its screen. Use a recent Chrome, Edge or Firefox.', 'warn', 'Present'); return false; }
    let stream;
    try {
      stream = await md.getDisplayMedia({ video: { frameRate: 30 }, audio: true, selfBrowserSurface: 'exclude', surfaceSwitching: 'include', systemAudio: 'include' });
    } catch (e) {
      const blocked = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      g.ui.toast(blocked ? 'Sharing was cancelled or blocked. In an online preview the browser may not allow it: start the game with launch.bat and try again.' : 'Could not start sharing your screen.', 'warn', 'Present');
      return false;
    }
    if (this.cur !== c) { stream.getTracks().forEach((t) => t.stop()); return false; }   // you left the hall meanwhile
    const v = document.createElement('video');
    v.autoplay = true; v.playsInline = true; v.muted = false; v.volume = 0.7; v.srcObject = stream;
    const tex = new THREE.VideoTexture(v); tex.colorSpace = THREE.SRGBColorSpace;
    const child = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    child.position.z = 0.004; child.renderOrder = 2; c.mesh.add(child);                        // the picture, a plane on the screen scaled to keep its own shape
    c.pres = { stream, v, tex, child, restore: c.mesh.material };
    c.mesh.material = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });  // black behind it (the bars)
    try { await v.play(); } catch { v.muted = true; v.play().catch(() => {}); }
    // what is shown is whatever shape the shared window is: fit it into the screen without stretching (black bars where it does not fill)
    v.addEventListener('loadedmetadata', () => this.fitPresented());
    this.fitPresented();
    if (this.cur?.obj) this.css.domElement.style.display = 'none';
    this.cmd('pauseVideo');
    stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (this.cur === c) this.stopPresent(); });   // "Stop sharing" in the browser's own bar
    g.ui.toast('Your screen is on the big screen. Press the same button again (or use the browser\'s Stop sharing) to end.', 'gold', 'Presenting');
    return true;
  }

  /** letterbox the shared picture on the screen: it keeps its own shape, with black bars where it does not fill the screen */
  fitPresented() {
    const c = this.cur, p = c?.pres;
    if (!p || !p.v.videoWidth) return;
    const a = p.v.videoWidth / p.v.videoHeight, sc = c.w / c.h;
    p.child.scale.set(a > sc ? 1 : a / sc, a > sc ? sc / a : 1, 1);
  }

  stopPresent() {
    const c = this.cur, p = c?.pres;
    if (!p) return;
    p.stream.getTracks().forEach((t) => t.stop());
    p.v.pause(); p.v.srcObject = null; p.tex.dispose();
    c.mesh.remove(p.child); p.child.geometry.dispose(); p.child.material.dispose(); c.mesh.material.dispose?.();
    c.mesh.material = c.playing ? this.hole : p.restore;
    c.pres = null;
    if (c.obj) { this.css.domElement.style.display = ''; this.cmd('playVideo'); }
    this.g.ui.toast('Presentation ended.', 'info', 'Present');
  }

  detach() {
    const c = this.cur;
    if (!c) return;
    if (c.pres) { this.stopPresent(); }
    if (c.obj) { this.scene.remove(c.obj); c.obj.element.remove(); }
    if (c.mesh && c.poster) c.mesh.material = c.poster;
    this.cur = null;
    this.css.domElement.style.display = 'none';
  }

  /** where the film starts: its first second, every time you come in */
  position(v) { return v.start || 0; }

  post(msg) { try { this.cur?.frame?.contentWindow?.postMessage(JSON.stringify(msg), 'https://www.youtube.com'); } catch { /* frame gone */ } }
  cmd(func, ...args) { this.post({ event: 'command', func, args, id: this.cur?.id, channel: 'widget' }); }

  onMessage(e) {
    const c = this.cur;
    if (!c || !/youtube\.com$/.test(new URL(e.origin).hostname) || e.source !== c.frame?.contentWindow) return;
    let m; try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    if (m.event === 'onReady') {
      c.ready = true;
      this.cmd('playVideo');
    } else if (m.event === 'onError') {
      c.failed = true;
      this.card(c, `YouTube could not play this film (error ${m.info}).`);
      this.g.ui.toast(`The film could not be loaded (YouTube error ${m.info}).`, 'warn', 'Screen');
    } else if (m.event === 'infoDelivery' && m.info) {
      const I = m.info;
      if (I.duration > 0 && this.durations[c.video.id] !== I.duration) {
        this.durations[c.video.id] = I.duration;
        try { localStorage.setItem('iitg3d.videoDur', JSON.stringify(this.durations)); } catch { /* ignore */ }
      }
      if (I.playerState === 1 && !c.playing) { c.playing = true; c.mesh.material = this.hole; }
      if (I.playerState === 0) { this.cmd('seekTo', c.video.start || 0, true); this.cmd('playVideo'); }   // the end: from the start again
      if (typeof I.muted === 'boolean') c.muted = I.muted;
    }
  }

  /** per frame: keep the player glued to the screen, sound by distance, render */
  update(camera) {
    const c = this.cur;
    if (c?.pres) {                                                       // presenting: the shared picture's sound falls off with distance too
      const P = this.g.player.pos, p = new THREE.Vector3(); c.mesh.getWorldPosition(p);
      const d = Math.hypot(P.x - p.x, P.y - p.y, P.z - p.z), A = this.g.audio;
      c.pres.v.volume = Math.max(0, Math.min(1, (A?.muted ? 0 : (A?.volume ?? 1)) * Math.max(0.15, Math.min(1, 1.3 - d / 30))));
    }
    if (!c || !c.obj) return;
    c.mesh.updateWorldMatrix(true, false);
    c.mesh.matrixWorld.decompose(c.obj.position, c.obj.quaternion, new THREE.Vector3());
    // not playing after a while (autoplay blocked?): try muted, and say how to get sound
    const age = (performance.now() - c.t0) / 1000;
    if (c.ready && !c.playing && age > 5 && !c.mutedTry) { c.mutedTry = true; this.cmd('mute'); this.cmd('playVideo'); this.g.ui.toast('Press U for the film\'s sound.', 'info', 'Screen'); }
    if (!c.ready && age > 14 && !c.warned) { c.warned = true; this.g.ui.toast('The film needs an internet connection.', 'warn', 'Screen'); }
    // volume: the room's loudness falls off with distance; game volume and mute apply
    const P = this.g.player.pos, p = c.obj.position;
    const d = Math.hypot(P.x - p.x, P.y - p.y, P.z - p.z);
    const A = this.g.audio;
    const master = A?.muted ? 0 : (A?.volume ?? 1) * Math.min(1, (A?.vol?.music ?? 0.6) / 0.6);
    const vol = Math.round(100 * master * Math.max(0.15, Math.min(1, 1.3 - d / 30)));
    if (c.ready && Math.abs(vol - c.vol) >= 3) { c.vol = vol; this.cmd('setVolume', vol); }
    this.css.render(this.scene, camera);
  }

  unmute() { if (this.cur?.ready) { this.cmd('unMute'); this.cmd('playVideo'); } }
}

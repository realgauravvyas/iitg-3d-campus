// The security register: at a hostel you are visiting (the other gender's) and at the View Point
// gate you stop at the guard's desk and write yourself in - date and time (filled in), your name,
// roll number, hostel and room number - and sign with the mouse (or a finger). The guard checks the
// entry, stamps it and lets you through. The avatar stands at the desk writing while you fill it in.
import * as THREE from 'three';
import { ROLL_PLACEHOLDER, ROLL_ERROR, ROLL_MAX, isRoll } from './roll.js';

const HOSTELS = ['Brahmaputra', 'Lohit', 'Dihing', 'Manas', 'Umiam', 'Barak', 'Kameng', 'Gaurang', 'Siang', 'Kapili', 'Dibang', 'Disang', 'Subansiri', 'Dhansiri', 'Married Scholars'];
const PAST = [['Rituparna Baruah', '23012104574', 'Dhansiri', 'C-118'], ['Arjun Nair', '214101012', 'Kameng', 'A-212'], ['Meghna Saikia', '24010601747', 'Subansiri', 'B-304'], ['Kabir Sharma', '23010208874', 'Lohit', 'D-021'], ['Priya Das', '224101047', 'Disang', 'A-117'], ['Bikash Kalita', '24015006439', 'Siang', 'B-229']];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hhmm = (h) => { const H = Math.floor(h), M = Math.floor((h - H) * 60); return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; };

function css() {
  if (document.getElementById('reg-css')) return;
  const st = document.createElement('style');
  st.id = 'reg-css';
  st.textContent = `
#register { position: fixed; right: 3vw; top: 50%; transform: translateY(-50%) rotate(-0.6deg); width: min(720px, 94vw); z-index: 46; pointer-events: auto;
  background: #fbf6e6 repeating-linear-gradient(#fbf6e6 0 29px, #b9cde4 29px 30px); border-radius: 4px; box-shadow: 0 18px 50px rgba(0,0,0,0.45), inset 38px 0 0 -36px #d9544f;
  padding: 18px 22px 16px 46px; font: 15px "Segoe UI", system-ui, sans-serif; color: #1c2a4a; animation: regIn .35s ease-out; }
@keyframes regIn { from { transform: translateY(-46%) rotate(-3deg); opacity: 0; } }
#register h3 { margin: 0 0 2px; font: 700 20px "Segoe UI", system-ui, sans-serif; letter-spacing: .04em; color: #7a2630; }
#register .sub { margin: 0 0 8px; font-size: 12.5px; color: #5b6475; }
#register table { width: 100%; border-collapse: collapse; font-size: 13px; }
#register th { text-align: left; font-weight: 600; font-size: 11.5px; color: #4a5875; border-bottom: 1.5px solid #7a8aa8; padding: 2px 4px; }
#register td { padding: 3px 4px; height: 24px; border-bottom: 1px solid rgba(90,110,150,0.25); }
#register td.hand { font-family: "Segoe Print", "Comic Sans MS", cursive; color: #1d3f8f; }
#register tr.me td { background: rgba(255,248,196,0.7); }
#register input, #register select { width: 100%; box-sizing: border-box; border: 0; border-bottom: 1.5px dashed #1d3f8f; background: transparent; font: 14px "Segoe Print", "Comic Sans MS", cursive; color: #1d3f8f; padding: 1px 2px; outline: none; }
#register input:focus, #register select:focus { background: rgba(29,63,143,0.07); }
#register .sig { display: flex; align-items: flex-end; gap: 10px; margin-top: 10px; }
#register canvas { background: rgba(255,255,255,0.55); border: 1.5px dashed #1d3f8f; border-radius: 4px; cursor: crosshair; touch-action: none; }
#register .row { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
#register button { height: 34px; padding: 0 16px; border-radius: 17px; border: 0; font: 600 14px "Segoe UI", system-ui, sans-serif; cursor: pointer; }
#register .ok { background: #1d3f8f; color: #fff; }
#register .no, #register .clr { background: rgba(29,42,74,0.1); color: #1c2a4a; }
#register .say { flex: 1; font-size: 13px; color: #7a2630; min-height: 18px; }
#register .stamp { pointer-events: none; position: absolute; right: 40px; bottom: 60px; width: 120px; height: 120px; border: 5px double #c0392b; border-radius: 50%; color: #c0392b; display: grid; place-items: center; text-align: center; font: 800 15px "Segoe UI", sans-serif; transform: rotate(-16deg) scale(2.4); opacity: 0; transition: transform .22s ease-in, opacity .22s; }
#register .stamp.on { transform: rotate(-16deg) scale(1); opacity: .85; }
`;
  document.head.appendChild(st);
}

/**
 * The register as an activity. p: { title, place, purpose, desk: {x, z, yaw} (world, where you stand),
 * look: {x, y, z} (the book on the desk), guardName, onDone(entry), onCancel() }
 */
export function registerActivity(p) {
  return {
    name: 'register', hud: `${p.title} · fill in the register`, cancelable: true,
    start() {
      const g = this.g, P = g.player;
      P.pos.set(p.desk.x, p.desk.y ?? g.env.heightAt(p.desk.x, p.desk.z), p.desk.z);
      P.heading = p.desk.yaw; P.vel.set(0, 0, 0);
      P.avatar.root.position.copy(P.pos); P.avatar.root.rotation.set(0, P.heading, 0);
      g.input.enabled = false; g.input.exitLock();
      // the register book and a pen on the desk
      const fx = Math.sin(p.desk.yaw), fz = Math.cos(p.desk.yaw);
      const bx = p.look?.x ?? P.pos.x + fx * 0.55, bz = p.look?.z ?? P.pos.z + fz * 0.55, by = p.look?.y ?? P.pos.y + 1.0;
      const pageTex = new THREE.CanvasTexture(Object.assign(document.createElement('canvas'), { width: 256, height: 160 }));
      const cx = pageTex.image.getContext('2d');
      cx.fillStyle = '#fbf6e6'; cx.fillRect(0, 0, 256, 160); cx.strokeStyle = '#b9cde4'; for (let y = 12; y < 160; y += 10) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(256, y); cx.stroke(); }
      cx.strokeStyle = '#1d3f8f'; for (let y = 22; y < 150; y += 10) { cx.beginPath(); cx.moveTo(10, y); for (let x = 10; x < 110 + Math.random() * 100; x += 6) cx.lineTo(x, y - Math.random() * 4); cx.stroke(); }
      pageTex.colorSpace = THREE.SRGBColorSpace;
      const book = new THREE.Group();
      book.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.32), new THREE.MeshStandardMaterial({ color: 0x7a2630, roughness: 0.7 })));
      const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.9 }));
      pg.position.y = 0.014; book.add(pg);
      this.pen = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.14, 6).rotateZ(Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0x1d3f8f }));
      this.pen.position.set(0.05, 0.05, 0.02); book.add(this.pen);
      book.position.set(bx, by, bz); book.rotation.y = p.desk.yaw;
      g.scene.add(book);
      this.book = book; this.bookAt = new THREE.Vector3(bx, by, bz);
      this.writing = 0;
      this.ui();
      g.audio.tone?.(520, 0.08, { type: 'triangle', gain: 0.04 });
    },
    ui() {
      const g = this.g, prof = g.progress.profile, h = g.clock.hour;
      css();
      const el = (this.el = document.createElement('div'));
      el.id = 'register';
      const rows = PAST.slice(0, 4 + Math.floor(Math.random() * 2)).map(([n, r, ho, rm], i) => `<tr><td class="hand">${hhmm((h - 0.9 + i * 0.2 + 24) % 24)}</td><td class="hand">${i % 2 ? hhmm((h - 0.5 + i * 0.1 + 24) % 24) : ''}</td><td class="hand">${n}</td><td class="hand">${r}</td><td class="hand">${ho}</td><td class="hand">${rm}</td><td class="hand">${p.purpose}</td></tr>`).join('');
      const myHostel = HOSTELS.find((x) => x.toLowerCase().startsWith((prof.hostel || '').slice(0, 5))) || 'Brahmaputra';
      el.innerHTML = `<h3>${esc(p.title)}</h3><p class="sub">${esc(p.place)} · ${g.clock.dayName} · security desk${p.guardName ? ` · on duty: ${esc(p.guardName)}` : ''}</p>
        <table><tr><th style="width:8%">Time in</th><th style="width:8%">Time out</th><th style="width:22%">Name</th><th style="width:17%">Roll no.</th><th style="width:15%">Hostel</th><th style="width:10%">Room no.</th><th>Purpose</th></tr>${rows}
        <tr class="me"><td class="hand">${hhmm(h)}</td><td class="hand" title="filled in when you leave">—</td><td><input class="nm" value="${esc(prof.name || '')}" placeholder="Your name"></td><td><input class="rl" inputmode="numeric" maxlength="${ROLL_MAX}" value="${esc(prof.roll || '')}" placeholder="${ROLL_PLACEHOLDER}"></td>
        <td><select class="hs">${HOSTELS.map((x) => `<option${x === myHostel ? ' selected' : ''}>${x}</option>`).join('')}</select></td><td><input class="rm" value="${esc(prof.room || '')}" placeholder="B-214"></td><td class="hand">${esc(p.purpose)}</td></tr></table>
        <div class="sig"><div><div style="font-size:11.5px;color:#4a5875;margin-bottom:3px">Signature (draw it)</div><canvas width="300" height="74"></canvas></div><button class="clr">Clear</button></div>
        <div class="row"><span class="say"></span><button class="no">Cancel (Esc)</button><button class="ok">Sign &amp; submit</button></div><div class="stamp">CHECKED<br>&#10003;<br>${hhmm(h)}</div>`;
      document.body.appendChild(el);
      const $ = (s) => el.querySelector(s);
      const cv = $('canvas'), c2 = cv.getContext('2d');
      c2.strokeStyle = '#1d3f8f'; c2.lineWidth = 2.2; c2.lineCap = 'round'; c2.lineJoin = 'round';
      let drawing = false, ink = 0, last = null;
      const at = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height]; };
      cv.addEventListener('pointerdown', (e) => { drawing = true; last = at(e); cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const q = at(e); c2.beginPath(); c2.moveTo(...last); c2.lineTo(...q); c2.stroke();
        ink += Math.hypot(q[0] - last[0], q[1] - last[1]); last = q; this.writing = 0.3;
        if (Math.random() < 0.25) g.audio.tone?.(2600 + Math.random() * 900, 0.012, { type: 'sawtooth', gain: 0.006 });
      });
      cv.addEventListener('pointerup', () => { drawing = false; });
      $('.clr').onclick = () => { c2.clearRect(0, 0, cv.width, cv.height); ink = 0; };
      const say = (t) => { $('.say').textContent = t; g.audio.tone?.(300, 0.08, { type: 'triangle', gain: 0.04 }); };
      el.addEventListener('keydown', (e) => { if (e.key !== 'Escape') { this.writing = 0.3; e.stopPropagation(); } if (e.key === 'Enter') $('.ok').click(); });
      $('.no').onclick = () => { this.cancelled = true; this.done = true; };
      $('.ok').onclick = () => {
        const nm = $('.nm').value.trim(), rl = $('.rl').value.trim(), rm = $('.rm').value.trim(), hs = $('.hs').value;
        if (nm.length < 2) return say(`"Please write your full name."`);
        if (!isRoll(rl)) return say(`"${ROLL_ERROR}"`);
        if (!/^[A-Za-z]?-?\d{2,4}$/.test(rm)) return say(`"Room number? Like B-214."`);
        if (ink < 60) return say(`"Please sign in the box."`);
        if (this.submitted) return;
        this.submitted = true;
        Object.assign(g.progress.profile, { name: nm, roll: rl, room: rm });
        g.progress.save();
        $('.stamp').classList.add('on');
        g.audio.tone?.(110, 0.12, { type: 'square', gain: 0.08 });
        say(`"Thank you, ${nm.split(' ')[0]}. ${p.okLine || 'You may go in.'}"`);
        this.entry = { name: nm, roll: rl, hostel: hs, room: rm, time: hhmm(g.clock.hour) };
        setTimeout(() => { this.done = true; }, 1500);
      };
      setTimeout(() => (($('.rl').value ? $('.rm') : $('.rl')).focus()), 250);
    },
    update(dt) {
      const g = this.g;
      this.writing = Math.max(0, this.writing - dt);
      g.player.avatar.animate({ type: 'lab' }, dt);
      if (this.pen) { const t = this.t * 22; this.pen.position.set(0.05 + (this.writing > 0 ? Math.sin(t) * 0.02 : 0), 0.05 + (this.writing > 0 ? Math.abs(Math.sin(t * 1.7)) * 0.01 : 0.02), 0.02 + (this.writing > 0 ? Math.cos(t * 0.8) * 0.015 : 0)); }
      if (this.done) return false;
    },
    camera(cam, dt) {
      // over your shoulder, looking down at the register on the desk
      const P = this.g.player.pos, h = this.g.player.heading, fx = Math.sin(h), fz = Math.cos(h);
      const want = new THREE.Vector3(P.x - fx * 0.9 + fz * 0.5, P.y + 1.95, P.z - fz * 0.9 - fx * 0.5);
      cam.position.lerp(want, 1 - Math.exp(-5 * dt));
      cam.lookAt(this.bookAt.x, this.bookAt.y, this.bookAt.z);
      return true;
    },
    end(cancelled) {
      const g = this.g;
      this.el?.remove();
      if (this.book) { g.scene.remove(this.book); this.book.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } }); }
      g.input.enabled = true; g.input.keys?.clear?.();
      if (this.entry && !this.cancelled) p.onDone?.(this.entry);
      else p.onCancel?.();
      void cancelled;
    },
  };
}

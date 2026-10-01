// A computer you can actually use (Computer Centre): sit down, the camera settles in front of the
// monitor, and the screen becomes IITG OS (src/os/): a boot and sign-in screen, a desktop with a start
// menu and taskbar, and windows running a web browser, YouTube, notepad, paint, files, photos and
// videos, a terminal, settings and more. Real websites and YouTube search need the game's local
// server (launch.bat); everything else works from a plain file too.
import * as THREE from 'three';
import { seatPlayer } from './activities/basic.js';
import { OS } from './os/os.js';
import { VW, VH, injectStyle } from './os/style.js';

export class PcBrowser {
  constructor(game) {
    this.g = game;
    this.os = null;
  }

  /** mon: the screen's rectangle in the world; ident: which machine (a hall's presenter PC has its own sign-in) */
  open(mon, ident = null, hint2 = null, big = false) {
    injectStyle();
    this.mon = mon;
    const L = (this.layer = document.createElement('div'));
    L.id = 'pc-layer'; L.tabIndex = -1;
    L.innerHTML = '<div id="pc-screen"><div id="pc-desk"></div></div>';
    document.body.appendChild(L);
    const hint = (this.hint = document.createElement('div'));
    hint.id = 'pc-hint';
    hint.innerHTML = hint2 || 'This PC runs <b>IITG OS</b>: browser, YouTube, notepad, paint, files… · <b>Esc</b> to stand up';
    document.body.appendChild(hint);
    this.el = { screen: L.querySelector('#pc-screen'), desk: L.querySelector('#pc-desk') };
    this.os = this.g.os || (this.g.os = new OS(this.g));
    this.os.mount(this.el.desk, ident);
    // every key typed on the PC clicks, and stays on the PC (no game hotkeys) - except Esc (stand up)
    L.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') { this.click(); e.stopPropagation(); }
      if (this.os.onKey(e)) e.stopPropagation();
    });
    // keys reach the focused app even when nothing inside it holds the focus
    L.addEventListener('pointerdown', () => { if (!L.contains(document.activeElement) || document.activeElement === L) L.focus({ preventScroll: true }); });
    // a hall's presenter PC can also share a real window or tab of this computer on the big screen (like plugging in a laptop)
    if (big && this.g.screens?.cur) {
      const bar = (this.bar = document.createElement('div'));
      bar.id = 'pc-present';
      bar.innerHTML = '<button type="button"></button><span>Share a window or browser tab (for example a YouTube tab that is playing) on the big screen</span>';
      document.body.appendChild(bar);
      const btn = bar.querySelector('button');
      const refresh = () => { const on = !!this.g.screens?.presenting; btn.textContent = on ? '■ Stop presenting' : '📺 Present / share screen'; btn.classList.toggle('on', on); if (this.el) this.el.screen.style.visibility = on ? 'hidden' : ''; };
      btn.onclick = async () => { await this.g.screens.present(); refresh(); };
      btn.onkeydown = (e) => e.stopPropagation();
      this.barT = setInterval(refresh, 500);
      refresh();
    }
    this.place();
    setTimeout(() => { if (!L.contains(document.activeElement)) L.focus({ preventScroll: true }); }, 300);
    this.tickT = setInterval(() => this.os?.tick(), 1000);
  }

  close() {
    clearInterval(this.tickT); clearInterval(this.barT);
    this.os?.unmount();
    this.layer?.remove(); this.hint?.remove(); this.bar?.remove();
    this.layer = null; this.hint = null; this.bar = null; this.el = null;
  }

  /** a keyboard click for every key you press */
  click() { this.g.audio?.tone?.(1900 + Math.random() * 500, 0.018, { type: 'square', gain: 0.018 }); this.g.player.typing = 0.25; }

  /** fit the desktop onto the monitor's rectangle as the camera sees it */
  place() {
    if (!this.el) return;
    const cam = this.g.camera, m = this.mon;
    const fz = Math.cos(m.yaw), fx = Math.sin(m.yaw), rx = fz, rz = -fx;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const v = new THREE.Vector3();
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      v.set(m.x + rx * su * m.w / 2, m.y + sv * m.h / 2, m.z + rz * su * m.w / 2).project(cam);
      const sx = (v.x * 0.5 + 0.5) * window.innerWidth, sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    const E = this.el, w = x1 - x0, h = y1 - y0;
    Object.assign(E.screen.style, { left: `${x0}px`, top: `${y0}px`, width: `${w}px`, height: `${h}px` });
    E.desk.style.transform = `scale(${w / VW}, ${h / VH})`;
  }
}

/** the activity: sit at the PC, the camera moves in to the monitor, the desktop appears on it.
 *  A hall's presenter PC (p.big) drives the hall's big screen instead: you stand at the podium, the
 *  camera backs off until the whole screen fills the view, and the desktop is laid over that screen. */
export function pcActivity(p) {
  return {
    name: 'pc', hud: p.big ? 'Presenter PC · Esc to step away' : 'Computer · Esc to stand up', cancelable: true,
    start() {
      const g = this.g, I = p.interior, O = I.O;
      if (p.stand) {
        const P = g.player;
        P.pos.set(O.x + p.stand.x, O.y + (p.stand.y || 0), O.z + p.stand.z);
        P.heading = p.stand.yaw; P.vel.set(0, 0, 0);
        P.avatar.root.position.copy(P.pos); P.avatar.root.rotation.set(0, p.stand.yaw, 0);
      } else seatPlayer(g, p.seat, I, 'sit');
      this.mon = { ...p.mon, x: p.mon.x + O.x, y: p.mon.y + O.y, z: p.mon.z + O.z };
      g.input.enabled = false;
      g.input.exitLock();
      document.body.classList.add('pc-mode');
      this.pc = g.pc || (g.pc = new PcBrowser(g));
      this.opened = false;
      // the hall's film waits while somebody presents
      if (p.big && g.screens?.cur) g.screens.cmd('pauseVideo');
      this.sharing = !!g.screens?.presenting;                                  // (a shared screen stays up when you step away)
    },
    update(dt) {
      const g = this.g;
      g.player.typing = Math.max(0, (g.player.typing || 0) - dt);
      g.player.avatar.animate({ type: p.big ? 'idle' : g.player.typing > 0 ? 'type' : 'sit' }, dt);
      // open once the camera has settled in front of the screen
      if (!this.opened && this.t > 0.55) {
        this.opened = true;
        this.pc.open(this.mon, p.ident || null, p.big ? `Presenter PC · <b>${p.ident?.place || 'IITG OS'}</b>: anything you open here is on the big screen · or press <b>Present / share screen</b> · <b>Esc</b> to step away` : null, !!p.big);
      }
      if (this.opened) this.pc.place();
    },
    camera(cam, dt) {
      const m = this.mon, fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
      let d = 0.42;
      if (p.big) {
        // far enough back that the whole screen (width and height) fits the view
        const t = Math.tan((cam.fov * Math.PI) / 360);
        d = Math.max(m.h / 2 / t, m.w / 2 / (t * cam.aspect)) * 1.04;
      }
      // the monitor faces the chair (yaw); sit about 0.42 m in front of it, eyes level with its centre
      const want = new THREE.Vector3(m.x + fx * d, m.y + 0.02, m.z + fz * d);
      const k = this.opened ? 1 : 1 - Math.exp(-7 * dt);
      cam.position.lerp(want, k);
      cam.lookAt(m.x, m.y + 0.02, m.z);
      return true;
    },
    end() {
      const g = this.g;
      this.pc?.close();
      g.input.enabled = true;
      document.body.classList.remove('pc-mode');
      g.input.keys?.clear?.();
      g.player.typing = 0;
      if (p.big && g.screens?.cur && !g.screens.presenting) g.screens.cmd('playVideo');
    },
  };
}

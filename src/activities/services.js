// Everyday services with a bit of detail: the library's issue / return desk (borrow up to three books for
// 14 days, a late fine of ₹2 a day per book) and the gym's treadmill.
import { rupees } from '../progress.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const panel = (g, title, html, buttons = []) => g.ui.actPanel({ title, html, buttons });

export const BOOKS = [
  ['Introduction to Algorithms', 'Cormen, Leiserson, Rivest, Stein'], ['Engineering Mechanics', 'Meriam & Kraige'], ['Let Us C', 'Yashavant Kanetkar'],
  ['Concepts of Physics', 'H. C. Verma'], ['Wings of Fire', 'A. P. J. Abdul Kalam'], ['The God of Small Things', 'Arundhati Roy'], ['Malgudi Days', 'R. K. Narayan'], ['Bhupen Hazarika: Selected Songs', 'Assamese lyrics with translations'],
];
const LOAN_DAYS = 14, LOAN_LIMIT = 3, FINE = 2;

export function libraryDesk() {
  return {
    name: 'libraryDesk', hud: 'Library · issue / return', cancelable: true,
    start() { this.render(); },
    render() {
      const g = this.g, P = g.progress, day = g.clock.day;
      const loans = (P.loans ||= []);
      const late = (l) => Math.max(0, day - l.due);
      const rows = loans.length
        ? loans.map((l) => `<p>${esc(l.title)} <span class="dim">· due ${l.due - day >= 0 ? `in ${l.due - day} day${l.due - day === 1 ? '' : 's'}` : `<b>${late(l)} day${late(l) === 1 ? '' : 's'} late: fine ${rupees(late(l) * FINE)}</b>`}</span></p>`).join('')
        : '<p class="dim">You have no books issued.</p>';
      const btns = [];
      loans.forEach((l, i) => btns.push({ label: `<kbd>${i + 1}</kbd> Return "${esc(l.title)}"${late(l) ? ` · pay ${rupees(late(l) * FINE)}` : ''}`, key: `Digit${i + 1}`, onClick: () => this.giveBack(i) }));
      if (loans.length < LOAN_LIMIT) {
        const free = BOOKS.filter(([t]) => !loans.some((l) => l.title === t));
        free.slice(0, 4).forEach(([t, by], k) => { const key = loans.length + k + 1; if (key <= 9) btns.push({ label: `<kbd>${key}</kbd> Borrow "${esc(t)}" <span class="dim">${esc(by)}</span>`, key: `Digit${key}`, onClick: () => this.borrow(t) }); });
      }
      btns.push({ label: '<kbd>Esc</kbd> Done', key: 'Escape', onClick: () => (this.done = true) });
      panel(g, 'Issue / return counter', `<p>“Show your ID card. Up to ${LOAN_LIMIT} books for ${LOAN_DAYS} days; ₹${FINE} a day for each book that is late.”</p>${rows}`, btns);
    },
    borrow(title) {
      const g = this.g, P = g.progress;
      (P.loans ||= []).push({ title, day: g.clock.day, due: g.clock.day + LOAN_DAYS });
      P.save(); g.audio.tone?.(1500, 0.06, { type: 'triangle', gain: 0.05 });
      g.ui.toast(`"${title}" is issued to you until day ${g.clock.day + LOAN_DAYS + 1}. The librarian stamps the due date.`, 'info', 'Library');
      this.render();
    },
    giveBack(i) {
      const g = this.g, P = g.progress, l = P.loans[i];
      if (!l) return;
      const fine = Math.max(0, g.clock.day - l.due) * FINE;
      if (fine && !P.spend(fine, 'library fine', () => this.giveBack(i))) return;
      P.loans.splice(i, 1); P.save(); P.addXP(4, 'book returned');
      g.ui.toast(fine ? `Returned, with a fine of ${rupees(fine)}.` : `"${l.title}" is back on the shelf. Thank you!`, fine ? 'warn' : 'info', 'Library');
      this.render();
    },
    update(dt) { this.g.player.avatar.animate({ type: 'idle' }, dt); if (this.done) return false; },
  };
}

/** a treadmill: run on the spot for a while (energy goes down, XP comes up) */
export function treadmill(p) {
  return {
    name: 'treadmill', hud: 'Treadmill · Esc to stop', cancelable: true,
    start() {
      const g = this.g, P = g.player, I = p.interior, O = I.O;
      P.pos.set(O.x + p.at.x, O.y + (p.at.y || 0), O.z + p.at.z); P.heading = p.at.yaw; P.vel.set(0, 0, 0);
      P.avatar.root.position.copy(P.pos); P.avatar.root.rotation.set(0, p.at.yaw, 0);
      this.len = 28;
      panel(g, 'Treadmill', '<p>Keep going: 28 seconds at a jog.</p><div class="bar big"><i id="act-bar"></i></div>', []);
    },
    update(dt) {
      const g = this.g, k = Math.min(1, this.t / this.len);
      const el = document.getElementById('act-bar'); if (el) el.style.width = `${k * 100}%`;
      g.player.avatar.animate({ type: 'run', speed: 2.6 + k * 1.4 }, dt);
      if (Math.random() < dt * 3) g.audio.noise?.(0.05, { f: 420, q: 0.9, gain: 0.03 });
      if (k >= 1) {
        g.progress.tire(9); g.progress.addXP(14, 'treadmill'); g.progress.count('gym');
        g.ui.toast('28 seconds on the treadmill. A drink of water, and you are done.', 'info', 'Gym');
        return false;
      }
    },
  };
}

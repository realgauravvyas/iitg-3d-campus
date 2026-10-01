// Rhythm mini-game (dance club, music jam, concerts): notes fall down four lanes; press
// the matching arrow key (or D F J K) when a note reaches the line. Plays a procedural
// dhol / beat track via the sound engine.
const LANES = [['ArrowLeft', 'KeyD', '←'], ['ArrowDown', 'KeyF', '↓'], ['ArrowUp', 'KeyJ', '↑'], ['ArrowRight', 'KeyK', '→']];

export function rhythmActivity(p) {
  const bpm = p.bpm || 112, beat = 60 / bpm, len = p.len || 32;
  return {
    name: p.name || 'rhythm', hud: p.hud || 'Hit the arrows on the beat (← ↓ ↑ → or D F J K)',
    start() {
      const g = this.g;
      this.notes = [];
      for (let b = 4; b < len; b += (Math.random() < 0.3 ? 0.5 : 1)) this.notes.push({ t: b * beat, lane: Math.floor(Math.random() * 4), hit: false, miss: false });
      this.score = 0; this.combo = 0; this.best = 0; this.nextBeat = 0;
      g.ui.actPanel({ title: p.title || 'Dance practice', html: '<canvas id="rh" width="360" height="300" class="mini rh"></canvas><p class="big-num" id="rh-score">0</p>', buttons: [] });
      g.player.pose = p.pose || 'dance';
      p.onStart?.(g);
    },
    update(dt) {
      const g = this.g, t = this.t;
      g.player.avatar.animate({ type: p.pose || 'dance', speed: bpm / 60 }, dt);
      if (t >= this.nextBeat) { this.nextBeat += beat; if (!p.quiet) g.audio.beat?.(Math.round(this.nextBeat / beat) % 4, p.style || 'dhol'); }
      for (let l = 0; l < 4; l++) {
        if (!g.input.hit(LANES[l][0], LANES[l][1])) continue;
        let best = null, bd = 0.18;
        for (const n of this.notes) if (!n.hit && !n.miss && n.lane === l && Math.abs(n.t - t) < bd) { bd = Math.abs(n.t - t); best = n; }
        if (best) { best.hit = true; this.combo++; this.best = Math.max(this.best, this.combo); this.score += bd < 0.06 ? 100 : 60; g.audio.tone([523, 587, 659, 784][l], 0.12, { type: 'triangle', gain: 0.07 }); }
        else { this.combo = 0; }
      }
      for (const n of this.notes) if (!n.hit && !n.miss && t - n.t > 0.2) { n.miss = true; this.combo = 0; }
      const c = document.getElementById('rh');
      if (c) {
        const x = c.getContext('2d');
        x.fillStyle = 'rgba(8,18,20,0.9)'; x.fillRect(0, 0, 360, 300);
        for (let l = 0; l < 4; l++) { x.fillStyle = 'rgba(243,234,215,0.06)'; x.fillRect(20 + l * 85, 0, 70, 300); x.fillStyle = 'rgba(243,234,215,0.5)'; x.font = '26px sans-serif'; x.textAlign = 'center'; x.fillText(LANES[l][2], 55 + l * 85, 288); }
        x.fillStyle = '#c89b3c'; x.fillRect(20, 250, 325, 3);
        const cols = ['#e2702f', '#2f8fb0', '#5b7f3a', '#b3262f'];
        for (const n of this.notes) {
          if (n.hit) continue;
          const y = 250 - (n.t - t) * 180;
          if (y < -20 || y > 300) continue;
          x.fillStyle = n.miss ? 'rgba(120,120,120,0.5)' : cols[n.lane];
          x.beginPath(); x.roundRect(28 + n.lane * 85, y - 12, 54, 24, 8); x.fill();
        }
      }
      const s = document.getElementById('rh-score'); if (s) s.textContent = `${this.score}${this.combo > 3 ? ` · combo ${this.combo}` : ''}`;
      if (t > len * beat + 1) {
        const hits = this.notes.filter((n) => n.hit).length, pct = Math.round((hits / this.notes.length) * 100);
        g.progress.addXP(15 + Math.round(pct / 4), p.xpWhy || 'dance');
        p.onEnd?.(g, pct, this.best);
        g.ui.toast(`${pct}% on the beat, best combo ${this.best}`, pct > 75 ? 'gold' : 'info', p.title || 'Dance practice');
        return false;
      }
    },
    camera(cam, dt) {
      const P = this.g.player, h = P.heading;
      const want = { x: P.pos.x + Math.sin(h) * 4.2, y: P.pos.y + 1.7, z: P.pos.z + Math.cos(h) * 4.2 };
      cam.position.x += (want.x - cam.position.x) * (1 - Math.exp(-4 * dt));
      cam.position.y += (want.y - cam.position.y) * (1 - Math.exp(-4 * dt));
      cam.position.z += (want.z - cam.position.z) * (1 - Math.exp(-4 * dt));
      cam.lookAt(P.pos.x, P.pos.y + 1.1, P.pos.z);
      return true;
    },
    end() { p.onStop?.(this.g); },
  };
}

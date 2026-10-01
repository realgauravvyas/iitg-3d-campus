// Activity registry: g.acts.run('sit', params) builds and starts an activity.
import { ACTS } from './basic.js';
import { rhythmActivity } from './rhythm.js';
import { pcActivity } from '../pc.js';
import { libraryDesk, treadmill } from './services.js';

export class ActivityRegistry {
  constructor(game) {
    this.g = game;
    this.defs = { ...ACTS, pc: (p) => pcActivity(p), libraryDesk: () => libraryDesk(), treadmill: (p) => treadmill(p) };
    this.defs.dance = () => rhythmActivity({ title: 'Dance club practice', name: 'dance', bpm: 128, quiet: true, onStart: (g) => { g.music.play(null); g.music.play('rock'); g.music.next = g.audio.ctx ? g.audio.ctx.currentTime : 0; }, onEnd: (g) => { g.progress.unlock('club'); g.progress.count('club'); } });
    this.defs.music = () => rhythmActivity({ title: 'Music club jam', name: 'music', pose: 'clap', style: 'band', xpWhy: 'jam', onEnd: (g) => g.progress.unlock('club') });
  }
  register(id, fn) { this.defs[id] = fn; }
  run(id, params = {}) {
    const f = this.defs[id];
    if (!f) { this.g.ui.toast(`Coming soon: ${id}`, 'info'); return; }
    this.g.activity.start(f(params));
  }
  stop(cancel = true) { this.g.activity.stop(cancel); }
}

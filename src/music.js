// Original procedural music (no samples, no licences needed), all scheduled a little ahead on the
// Web Audio clock:
//  - 'title':   a Bihu-inspired tune - dhol (bass "dhum" and slapped "tak"), taal cymbals, a reedy pepa
//               (buffalo-horn pipe) melody in the major pentatonic, a flute answering, a drone, a gogona
//  - 'day':     the same world by daylight: a light dhol, a plucked tokari-like arpeggio, bass and a
//               flute tune of its own (G major pentatonic)
//  - 'evening': golden hour: warm pads, a slow arpeggio and a flute in A minor pentatonic
//  - 'night':   a soft pad and a music-box lullaby, no drums
//  - 'tense':   races and jobs: a driving 16th-note dhol, taal off-beats and a pepa riff
//  - 'sport':   the title tune, quicker, with claps, for matches
//  - 'rock':    an original rock track for dance practice at the Student Activity Centre: drum kit,
//               distorted power chords (Em - C - D - Am), bass, and a pentatonic lead
//  - 'morning': a fresh early-morning tune (D major pentatonic): a slow flute, a light pluck and bells
//  - 'study':   the library and Computer Centre: hushed pads and a few soft bell notes, no drums
//  - 'mess':    the hostel mess at meal time: a light tea-shop groove with a plucked line and a little flute
//  - 'rain':    a quiet minor tune for rainy days: a slow pad and soft bells
//  (every theme shares a room reverb, and the music dips under the tour guide's voice)

const PENTA = [0, 2, 4, 7, 9];
const MINOR = [0, 3, 5, 7, 10];
const noteHz = (root, d, sc = PENTA) => root * Math.pow(2, (sc[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5)) / 12);
const semi = (root, s) => root * Math.pow(2, s / 12);

// title melody: [scale degree, length in 16ths]; each phrase is two bars (32 steps)
const P = [
  [[5, 4], [6, 2], [7, 2], [6, 4], [5, 4], [4, 4], [5, 4], [2, 8]],
  [[5, 4], [6, 2], [7, 2], [8, 4], [7, 4], [6, 4], [7, 2], [6, 2], [5, 8]],
  [[7, 2], [8, 2], [9, 4], [8, 2], [7, 2], [6, 4], [7, 4], [5, 4], [6, 4], [4, 4]],
  [[5, 2], [4, 2], [2, 4], [4, 4], [5, 4], [4, 2], [2, 2], [1, 4], [0, 8]],
  [[7, 2], [7, 2], [8, 4], [9, 2], [8, 2], [7, 4], [6, 2], [7, 2], [5, 4], [6, 8]],
];
const FORM = [0, 1, 0, 3, 2, 4, 1, 3];                  // 16 bars
const BASS = [0, 0, 3, 3, 4, 4, 0, 0];                  // one root per phrase
const DHOL = { dhum: [0, 6, 10], tak: [4, 12, 14], ghost: [2, 8] };

// day tune (G major pentatonic), four phrases of two bars
const DAY = [
  [[5, 4], [4, 2], [3, 2], [4, 4], [2, 4], [3, 4], [2, 2], [1, 2], [0, 8]],
  [[3, 4], [4, 4], [5, 2], [6, 2], [5, 4], [4, 4], [3, 4], [4, 8]],
  [[7, 6], [6, 2], [5, 4], [6, 4], [5, 2], [4, 2], [3, 4], [2, 8]],
  [[2, 2], [3, 2], [4, 4], [5, 4], [4, 2], [3, 2], [2, 4], [1, 4], [0, 8]],
];
const DAY_FORM = [0, 1, 0, 3, 2, 1, 2, 3];
const DAY_CHORD = [[0, 2, 3], [4, 5, 7], [0, 2, 3], [3, 5, 6], [1, 3, 4], [4, 5, 7], [1, 3, 4], [0, 2, 3]];
// evening (A minor pentatonic)
const EVE_CHORD = [[0, 2, 4], [3, 5, 7], [1, 3, 5], [2, 4, 6]];
const EVE_LINE = [[4, 8], [3, 4], [2, 4], [3, 8], [-1, 8], [2, 6], [1, 2], [0, 8], [-1, 8], [4, 4], [5, 4], [6, 8], [5, 4], [4, 4], [3, 8], [-1, 8]];
// night lullaby
const NIGHT_LINE = [7, 5, 6, 4, 5, 3, 4, 2, 3, 5, 4, 2, 1, 2, 0, -1];
// rock: E minor, power chords on Em C D Am (semitones above E2)
const ROCK_ROOTS = [0, 8, 10, 5];
const ROCK_RIFF = [0, 0, 12, 0, 0, 10, 0, 7];            // eighth-note chug pattern within a bar (offsets)

// morning (D major pentatonic): two phrases of two bars, then the other way round
const MORN = [
  [[5, 6], [4, 2], [2, 4], [4, 4], [5, 8], [7, 4], [5, 4]],
  [[7, 6], [5, 2], [4, 4], [2, 4], [0, 8], [2, 4], [4, 4]],
  [[4, 4], [5, 4], [7, 8], [9, 4], [7, 4], [5, 8]],
  [[5, 4], [4, 4], [2, 6], [0, 2], [2, 8], [-1, 8]],
];
const MORN_FORM = [0, 1, 2, 1, 0, 3, 2, 3];
const MORN_CHORD = [[0, 2, 4], [1, 3, 5], [0, 2, 4], [2, 4, 6]];
// study: a slow music-box line over a pad (A minor pentatonic), a different turn every time
const STUDY_LINE = [4, 2, 3, -1, 4, 5, 3, -1, 2, 3, 1, -1, 0, 1, 2, -1];
// mess: a light groove
const MESS_LINE = [[4, 4], [5, 2], [4, 2], [2, 4], [4, 4], [5, 4], [7, 4], [5, 4], [4, 8], [-1, 4], [2, 4], [4, 4], [2, 4], [0, 8], [-1, 8]];
// rain: slow, in A minor pentatonic
const RAIN_CHORD = [[0, 2, 4], [2, 4, 6], [1, 3, 5], [0, 3, 5]];

export const THEMES = ['title', 'day', 'evening', 'night', 'tense', 'sport', 'rock', 'morning', 'study', 'mess', 'rain'];

export class Music {
  constructor(audio) {
    this.a = audio;
    this.theme = null;
    this.step = 0;
    this.timer = null;
  }

  get ctx() { return this.a.ctx; }

  play(theme) {
    if (!this.ctx) return;
    if (theme === this.theme) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // fade the old theme out, start the new one on its own gain
    if (this.out) { const old = this.out; old.gain.setTargetAtTime(0, now, 0.6); setTimeout(() => old.disconnect(), 4000); }
    this.theme = theme;
    if (!theme) { clearInterval(this.timer); this.timer = null; this.out = null; return; }
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setTargetAtTime({ night: 0.85, study: 0.9, mess: 0.85, rain: 1, morning: 0.95 }[theme] ?? 1, now, 0.8);
    this.out.connect(this.a.buses.music);
    // a little room
    this.rev = ctx.createDelay(1); this.rev.delayTime.value = { title: 0.29, day: 0.31, evening: 0.38, night: 0.45, tense: 0.22, sport: 0.26, rock: 0.18, morning: 0.34, study: 0.5, mess: 0.27, rain: 0.44 }[theme] || 0.3;
    // the shared room reverb: a little of everything is sent into it
    if (this.a.verb) { this.send = ctx.createGain(); this.send.gain.value = { night: 0.3, study: 0.42, rain: 0.4, evening: 0.3, morning: 0.3, rock: 0.14, tense: 0.12 }[theme] ?? 0.22; this.out.connect(this.send); this.send.connect(this.a.verb); }
    const fb = ctx.createGain(); fb.gain.value = theme === 'night' ? 0.4 : 0.3;
    const wet = ctx.createGain(); wet.gain.value = theme === 'rock' ? 0.12 : 0.22;
    this.rev.connect(fb).connect(this.rev); this.rev.connect(wet).connect(this.out);
    // the amp for the rock guitar: a waveshaper and a speaker-cabinet filter
    if (theme === 'rock') {
      this.dist = ctx.createWaveShaper();
      const n = 1024, c = new Float32Array(n), k = 60;
      for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); }
      this.dist.curve = c; this.dist.oversample = '4x';
      const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3200; cab.Q.value = 0.7;
      const pre = ctx.createBiquadFilter(); pre.type = 'highpass'; pre.frequency.value = 90;
      const lvl = ctx.createGain(); lvl.gain.value = 0.55;
      this.ampIn = pre; pre.connect(this.dist).connect(cab).connect(lvl).connect(this.out);
    }
    this.bpm = { title: 104, day: 96, evening: 78, night: 60, tense: 140, sport: 118, rock: 128, morning: 84, study: 52, mess: 100, rain: 62 }[theme] || 90;
    this.root = { title: 293.66, day: 392, evening: 440, night: 523.25, tense: 220, sport: 293.66, rock: 82.41, morning: 587.33, study: 440, mess: 392, rain: 440 }[theme] || 261.63;
    this.step = 0;
    this.next = now + 0.1;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 60);
  }

  tick() {
    const ctx = this.ctx;
    if (!ctx || !this.theme) return;
    const dt = 60 / this.bpm / 4;
    while (this.next < ctx.currentTime + 0.3) {
      this[this.theme](this.step, this.next, dt);
      this.step++;
      this.next += dt;
    }
  }

  // ------------------------------------------------------------ themes
  title(i, t, dt, quick = false) {
    const bar16 = i % 16, phrase = Math.floor(i / 32) % FORM.length, inP = i % 32;
    // dhol
    if (DHOL.dhum.includes(bar16)) this.dhum(t, 1);
    if (DHOL.tak.includes(bar16)) this.tak(t, bar16 === 14 ? 0.7 : 1);
    if (DHOL.ghost.includes(bar16)) this.tak(t, 0.35);
    // taal on the off-beats, a longer ring at the start of each phrase
    if (bar16 % 4 === 2) this.taal(t, 0.06, 0.5);
    if (inP === 0) this.taal(t, 0.4, 0.8);
    // drone / bass
    if (inP === 0) this.drone(t, noteHz(this.root / 4, BASS[phrase]), dt * 32);
    // pepa melody (rests in the first phrase of the loop so the drums come in first)
    const loopStart = !quick && Math.floor(i / (32 * FORM.length)) === 0 && phrase === 0;
    if (!loopStart) {
      let s = 0;
      for (const [d, len] of P[FORM[phrase]]) { if (s === inP) this.pepa(t, noteHz(this.root, d), dt * len * 0.95); s += len; }
    }
    // the flute answers in the second half
    if (phrase >= 4 && inP % 8 === 4) this.flute(t, noteHz(this.root * 2, [2, 4, 3, 1][(inP / 8) | 0]), dt * 7, 0.05);
    // gogona twang every four bars
    if (i % 64 === 48) this.gogona(t);
    if (quick && bar16 % 8 === 4) this.clap(t, 0.5);
  }

  sport(i, t, dt) { this.title(i, t, dt, true); }

  day(i, t, dt) {
    const bar16 = i % 16, phrase = Math.floor(i / 32) % DAY_FORM.length, inP = i % 32;
    const ch = DAY_CHORD[phrase];
    // a light dhol and shaker
    if (bar16 === 0 || bar16 === 8) this.dhum(t, 0.55);
    if (bar16 === 4 || bar16 === 12) this.tak(t, 0.4);
    if (bar16 === 14) this.tak(t, 0.2);
    if (i % 2 === 1) this.shaker(t, 0.01 + (i % 4 === 3 ? 0.008 : 0));
    // bass on 1 and 3
    if (bar16 === 0 || bar16 === 8) this.bass(t, noteHz(this.root / 4, ch[0]), dt * 6, 0.09);
    // plucked arpeggio (eighths) through the chord
    if (i % 2 === 0) { const seq = [0, 1, 2, 1, 2, 0, 1, 2]; this.pluck(t, noteHz(this.root / 2, ch[seq[(i / 2) % 8]]), dt * 3, 0.035); }
    // the flute tune
    let s = 0;
    for (const [d, len] of DAY[DAY_FORM[phrase]]) { if (s === inP) this.flute(t, noteHz(this.root, d), dt * len * 0.95, 0.045); s += len; }
    if (i % 128 === 96) this.gogona(t);
  }

  evening(i, t, dt) {
    const bar = Math.floor(i / 16), ch = EVE_CHORD[Math.floor(bar / 2) % 4];
    if (i % 32 === 0) for (const d of ch) this.pad(t, noteHz(this.root / 4, d, MINOR), dt * 32);
    if (i % 32 === 0) this.bass(t, noteHz(this.root / 8, ch[0], MINOR), dt * 30, 0.07);
    if (i % 4 === 0) { const seq = [0, 1, 2, 1]; this.pluck(t, noteHz(this.root / 2, ch[seq[(i / 4) % 4]], MINOR), dt * 5, 0.022); }
    if (i % 16 === 8) this.taal(t, 0.25, 0.25);
    // the flute line, one phrase per eight bars
    let s = 0; const k = i % 128;
    for (const [d, len] of EVE_LINE) { if (s === k && d >= 0) this.flute(t, noteHz(this.root, d, MINOR), dt * len * 0.95, 0.04); s += len; }
  }

  night(i, t, dt) {
    const ch = EVE_CHORD[Math.floor(i / 64) % 4];
    if (i % 64 === 0) for (const d of ch) this.pad(t, noteHz(this.root / 8, d), dt * 64, 0.026);
    if (i % 4 === 0) { const d = NIGHT_LINE[(i / 4) % NIGHT_LINE.length]; if (d >= 0 && Math.floor(i / 64) % 4 !== 3) this.bell(t, noteHz(this.root, d), 0.03); }
    if (i % 64 === 40) this.flute(t, noteHz(this.root / 2, ch[1]), dt * 20, 0.02);
  }

  morning(i, t, dt) {
    const bar = Math.floor(i / 16), phrase = Math.floor(i / 32) % MORN_FORM.length, inP = i % 32, ch = MORN_CHORD[Math.floor(bar / 2) % 4];
    // the flute, slow and clear
    let s = 0;
    for (const [d, len] of MORN[MORN_FORM[phrase]]) { if (s === inP && d >= 0) this.flute(t, noteHz(this.root, d), dt * len * 0.95, 0.045); s += len; }
    // a light pluck (quarter notes) through the chord, a bass on the one
    if (i % 4 === 0) this.pluck(t, noteHz(this.root / 4, ch[(i / 4) % 3]), dt * 4, 0.024);
    if (i % 32 === 0) this.bass(t, noteHz(this.root / 8, ch[0]), dt * 28, 0.06);
    if (i % 32 === 0) for (const d of ch) this.pad(t, noteHz(this.root / 4, d), dt * 32, 0.022);
    if (i % 16 === 8) this.shaker(t, 0.012);
    // a sparkle of bells now and then, like light on the lake
    if (i % 32 === 20 || i % 64 === 52) this.bell(t, noteHz(this.root, [4, 5, 7, 9][(i / 16 | 0) % 4]), 0.014);
  }

  study(i, t, dt) {
    const k = Math.floor(i / 64) % 4, ch = RAIN_CHORD[k];
    if (i % 64 === 0) for (const d of ch) this.pad(t, noteHz(this.root / 4, d, MINOR), dt * 64, 0.045);
    if (i % 64 === 0) this.bass(t, noteHz(this.root / 8, ch[0], MINOR), dt * 60, 0.06);
    // a soft music-box line, every other step, rests where the line has a -1
    if (i % 4 === 0) { const d = STUDY_LINE[((i / 4) + k * 3) % STUDY_LINE.length]; if (d >= 0) this.bell(t, noteHz(this.root, d, MINOR), 0.04); }
    if (i % 128 === 96) this.flute(t, noteHz(this.root / 2, ch[2], MINOR), dt * 24, 0.03);
  }

  mess(i, t, dt) {
    const bar16 = i % 16, inP = i % 64;
    if (bar16 === 0 || bar16 === 10) this.dhum(t, 0.3);
    if (bar16 === 4 || bar16 === 12) this.tak(t, 0.22);
    if (i % 2 === 1) this.shaker(t, 0.008);
    const ch = DAY_CHORD[Math.floor(i / 32) % DAY_CHORD.length];
    if (i % 2 === 0) this.pluck(t, noteHz(this.root / 2, ch[[0, 1, 2, 1][(i / 2) % 4]]), dt * 3, 0.026);
    if (bar16 === 0) this.bass(t, noteHz(this.root / 4, ch[0]), dt * 6, 0.05);
    let s = 0;
    for (const [d, len] of MESS_LINE) { if (s === inP && d >= 0) this.flute(t, noteHz(this.root, d), dt * len * 0.95, 0.032); s += len; }
  }

  rain(i, t, dt) {
    const k = Math.floor(i / 64) % 4, ch = RAIN_CHORD[k];
    if (i % 64 === 0) for (const d of ch) this.pad(t, noteHz(this.root / 4, d, MINOR), dt * 64, 0.05);
    if (i % 64 === 0) this.bass(t, noteHz(this.root / 8, ch[0], MINOR), dt * 60, 0.07);
    if (i % 8 === 0) { const d = [4, 3, 2, 3, 1, 2, 0, -1][(i / 8 + k) % 8]; if (d >= 0) this.bell(t, noteHz(this.root, d, MINOR), 0.04); }
    if (i % 96 === 64) this.flute(t, noteHz(this.root / 2, ch[1], MINOR), dt * 28, 0.04);
  }

  tense(i, t, dt) {
    const s = i % 16, bar = Math.floor(i / 16) % 4;
    // a driving dhol: dhum on the beat, taks rolling on the 16ths
    if (s % 4 === 0) this.dhum(t, s === 0 ? 1 : 0.7);
    if (s % 2 === 1) this.tak(t, s % 4 === 3 ? 0.55 : 0.3);
    if (s % 4 === 2) this.taal(t, 0.05, 0.5);
    // bass pulse and a pepa riff that climbs every bar
    if (s % 2 === 0) this.bass(t, noteHz(this.root / 2, [0, 0, 3, 4][bar]), dt * 1.6, 0.08);
    const riff = [[5, 0], [6, 2], [7, 4], [6, 6], [5, 8], [4, 10], [5, 12]];
    for (const [d, at] of riff) if (s === at) this.pepa(t, noteHz(this.root * 2, d + [0, 0, 1, 2][bar]), dt * 1.8);
    if (i % 64 === 0) this.taal(t, 0.5, 0.9);
  }

  rock(i, t, dt) {
    const s = i % 16, bar = Math.floor(i / 16) % 16, root = this.root;
    const chord = ROCK_ROOTS[Math.floor(bar / 2) % 4];
    // drums: kick, snare on 2 and 4, eighth-note hats, a crash every 8 bars
    if (s === 0 || s === 6 || s === 8 || (s === 11 && bar % 2)) this.kick(t);
    if (s === 4 || s === 12) this.snare(t, 1);
    if (s === 15 && bar % 4 === 3) this.snare(t, 0.6);
    if (s % 2 === 0) this.hat(t, s % 4 === 0 ? 0.05 : 0.03);
    if (s === 0 && bar % 8 === 0) this.crash(t);
    // rhythm guitar: palm-muted chugs, full power chords on the accents
    if (s % 2 === 0) {
      const off = ROCK_RIFF[(s / 2) % 8];
      const f = semi(root * 2, chord + (off === 12 ? 0 : off));
      this.power(t, f, off === 0 ? dt * 1.4 : dt * 1.8, off === 0 ? 0.045 : 0.06, off === 12);
    }
    // bass doubles the root
    if (s % 2 === 0) this.bass(t, semi(root, chord), dt * 1.8, 0.1);
    // a lead line over bars 8-15
    if (bar >= 8 && s % 4 === 0) {
      const lead = [7, 9, 7, 5, 4, 5, 7, 10, 12, 10, 7, 9, 7, 5, 4, 2];
      const d = lead[((bar - 8) * 4 + s / 4) % lead.length];
      this.leadGtr(t, noteHz(root * 4, d, MINOR), dt * 3.6);
    }
  }

  // ------------------------------------------------------------ instruments
  voice(type, f, t, dur, gain, { attack = 0.01, filter = 3000, vib = 0, slide = 0, to = null } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.linearRampToValueAtTime(f * slide, t + dur);
    if (vib) { const l = ctx.createOscillator(); l.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = f * vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(flt).connect(g).connect(to || this.out); if (!to) g.connect(this.rev);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noiseHit(t, dur, gain, f, q = 1, type = 'bandpass') {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.a.noiseBuf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt).connect(g).connect(this.out);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  dhum(t, v) { this.voice('sine', 95, t, 0.32, 0.5 * v, { attack: 0.004, filter: 400, slide: 0.55 }); this.noiseHit(t, 0.05, 0.08 * v, 300, 1); }
  tak(t, v) { this.noiseHit(t, 0.09, 0.22 * v, 1900, 1.4); this.voice('triangle', 330, t, 0.07, 0.08 * v, { attack: 0.002, filter: 2000 }); }
  taal(t, dur, v) { this.noiseHit(t, dur, 0.06 * v, 7000, 0.8, 'highpass'); this.voice('sine', 4200, t, dur * 0.8, 0.012 * v, { attack: 0.002, filter: 9000 }); }
  clap(t, v) { this.noiseHit(t, 0.08, 0.12 * v, 1500, 0.9); this.noiseHit(t + 0.012, 0.1, 0.1 * v, 1200, 0.9); }
  pepa(t, f, dur) { this.voice('sawtooth', f, t, dur, 0.06, { attack: 0.02, filter: 1600, vib: 0.012 }); this.voice('square', f * 2, t, dur, 0.012, { attack: 0.03, filter: 2400 }); }
  flute(t, f, dur, g = 0.05) { this.voice('sine', f, t, dur, g, { attack: 0.06, filter: 5000, vib: 0.008 }); this.voice('triangle', f, t, dur, g * 0.3, { attack: 0.06, filter: 3000 }); }
  drone(t, f, dur) { this.voice('triangle', f, t, dur, 0.06, { attack: 0.3, filter: 700 }); this.voice('triangle', f * 1.5, t, dur, 0.03, { attack: 0.4, filter: 700 }); }
  gogona(t) { this.voice('sine', 180, t, 0.5, 0.06, { attack: 0.005, filter: 1200, vib: 0.3 }); }
  pad(t, f, dur, g = 0.035) { this.voice('triangle', f, t, dur, g, { attack: 1.2, filter: 1200 }); this.voice('triangle', f * 1.004, t, dur, g * 0.85, { attack: 1.4, filter: 1000 }); }
  bass(t, f, dur, g) { this.voice('triangle', f, t, dur, g, { attack: 0.01, filter: 500 }); this.voice('sine', f / 2, t, dur, g * 0.6, { attack: 0.01, filter: 300 }); }
  bell(t, f, g) { this.voice('sine', f, t, 1.6, g, { attack: 0.003, filter: 8000 }); this.voice('sine', f * 2.76, t, 0.6, g * 0.25, { attack: 0.003, filter: 9000 }); }
  shaker(t, g) { this.noiseHit(t, 0.06, g, 6000, 1, 'highpass'); }
  hat(t, g) { this.noiseHit(t, 0.03, g, 8000, 1, 'highpass'); }
  pluck(t, f, dur, g) { this.voice('sawtooth', f, t, dur, g, { attack: 0.004, filter: 900 }); }
  kick(t) { this.voice('sine', 130, t, 0.28, 0.55, { attack: 0.002, filter: 600, slide: 0.35 }); this.noiseHit(t, 0.02, 0.1, 2500, 1); }
  snare(t, v) { this.noiseHit(t, 0.18, 0.2 * v, 1900, 0.7); this.voice('triangle', 190, t, 0.1, 0.12 * v, { attack: 0.002, filter: 1500 }); }
  crash(t) { this.noiseHit(t, 1.4, 0.08, 6500, 0.5, 'highpass'); }
  /** a power chord (root + fifth + octave) through the amp; `open` rings longer */
  power(t, f, dur, g, open = false) {
    for (const m of [1, 1.4983, 2]) this.voice('sawtooth', f * m, t, open ? dur * 1.6 : dur, g * (m === 2 ? 0.5 : 1), { attack: 0.004, filter: open ? 5000 : 2200, to: this.ampIn });
  }
  leadGtr(t, f, dur) { this.voice('sawtooth', f, t, dur, 0.03, { attack: 0.01, filter: 4200, vib: 0.01, to: this.ampIn }); }
}

// Procedural campus soundscape (Web Audio API, no sample files).
import { clamp } from './util.js';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.muted = false;
    this.birdTimer = 1;
    this.cricketTimer = 0;
    this.frogTimer = 0;
    this.voice = null;
    // per-channel volumes (0..1): music, effects, ambience, interface, voice
    this.vol = { music: 0.6, sfx: 0.9, amb: 0.8, ui: 0.8, voice: 0.9 };
    this.subtitles = true;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.main = ctx.createGain();
    this.main.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.main.connect(comp).connect(ctx.destination);
    this.out = comp;                       // everything you hear (videos you record take their sound from here)
    // channels: every sound goes through one of these (sliders in the pause menu)
    this.buses = {};
    this.duck = ctx.createGain(); this.duck.connect(this.main);       // the music dips under speech
    for (const k of ['music', 'sfx', 'amb', 'ui']) { const g = ctx.createGain(); g.gain.value = this.vol[k]; g.connect(k === 'music' ? this.duck : this.main); this.buses[k] = g; }
    // one room reverb for the music (a generated impulse response: a soft, slightly dark hall)
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeIR(2.3, 2.4);
    this.verb.connect(this.buses.music);
    this.master = this.buses.amb;          // continuous layers below are ambience ...
    // shared noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // brown noise buffer
    const bb = ctx.createBuffer(1, len, ctx.sampleRate);
    const bd = bb.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.brownBuf = bb;
    // echo bus for UI/bird sounds
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    this.echo.connect(fb).connect(this.echo);
    this.echo.connect(wet).connect(this.main);

    // continuous layers
    this.wind = this.loop(this.brownBuf, { type: 'bandpass', f: 500, q: 0.6 });
    this.water = this.loop(this.brownBuf, { type: 'lowpass', f: 700, q: 0.3 });
    this.rainL = this.loop(this.noiseBuf, { type: 'highpass', f: 1400, q: 0.4 });
    this.rainLow = this.loop(this.brownBuf, { type: 'lowpass', f: 400, q: 0.3 });
    this.murmur = this.makeMurmur();
    this.master = this.buses.sfx;          // ... engines and all one-shot effects
    this.tyre = this.loop(this.noiseBuf, { type: 'lowpass', f: 400, q: 0.5 });
    this.engine = this.makeEngine();
    this.drone = this.makeDrone();
    this.npcEngine = this.makeEngine(0.6);
    // birds, crickets and frogs are ambience; chimes and clicks are the interface
    for (const k of ['bird', 'cricket', 'frog', 'howl', 'owl', 'lap']) { const f = this[k].bind(this); this[k] = (...a) => { this._bus = 'amb'; try { f(...a); } finally { this._bus = null; } }; }
    for (const k of ['click', 'discover', 'collect', 'achievement', 'coins', 'stopChime', 'reward']) { const f = this[k].bind(this); this[k] = (...a) => { this._bus = 'ui'; try { f(...a); } finally { this._bus = null; } }; }
    this.pickVoice();
  }

  /** a stereo impulse response: noise that dies away, getting darker as it goes */
  makeIR(secs, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len, k = 0.55 - 0.45 * t;                       // the one-pole filter closes as the tail goes on
        lp += ((Math.random() * 2 - 1) - lp) * k;
        d[i] = lp * Math.pow(1 - t, decay) * (1 - Math.exp(-i / (ctx.sampleRate * 0.012)));
      }
    }
    return buf;
  }
  /** lower the music for a while (while somebody speaks) */
  dip(amount = 0.45, secs = 3) {
    if (!this.ctx || !this.duck) return;
    const now = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setTargetAtTime(amount, now, 0.15);
    this.duck.gain.setTargetAtTime(1, now + secs, 0.7);
  }

  /** crowd chatter: band-passed noise with a slowly wobbling formant */
  makeMurmur() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.brownBuf; src.loop = true;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 520; f1.Q.value = 2.2;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1300; f2.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 3.1;
    const lg = ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg).connect(f1.frequency); lfo.start();
    src.connect(f1).connect(g); src.connect(f2).connect(g);
    g.connect(this.master);
    src.start();
    return { g };
  }

  /** extra continuous layers: rain, crowd murmur (called every frame from main) */
  ambience(s) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const set = (p, v, tc = 0.3) => p.setTargetAtTime(v, now, tc);
    set(this.rainL.g.gain, s.rain * (s.inside ? 0.03 : 0.2));
    set(this.rainLow.g.gain, s.rain * (s.inside ? 0.12 : 0.1));
    // no constant hiss: a crowd is heard as the odd voice (see chatter()), not as a steady "shhh". Only a very soft
    // room murmur, and only in a full hall.
    set(this.murmur.g.gain, 0, 0.8);
    // a crowd is a few voices now and then (never a steady "shhh"): more often the bigger the crowd
    const t = performance.now();
    if (t > (this.nextTalk ?? 0)) {
      this.nextTalk = t + (3200 + Math.random() * 6500) / Math.max(0.5, Math.min(2.2, s.crowd / 12));
      if (s.crowd > 5) this.voices(Math.min(1, s.crowd / 26) * (s.inside ? 1 : 0.6));
    }
  }

  /** a few distant voices: short, soft, filtered bursts */
  voices(near = 1) {
    const pan = Math.random() * 1.4 - 0.7, base = 420 + Math.random() * 500;
    for (let k = 0; k < 3 + Math.floor(Math.random() * 3); k++) this.noise(0.14 + Math.random() * 0.28, { f: base + Math.random() * 420, q: 2.4, gain: 0.014 * near, when: k * (0.16 + Math.random() * 0.12), attack: 0.04, pan });
  }
  /** a steel plate put down or picked up */
  plate() { const pan = Math.random() * 0.8 - 0.4; for (const [f, g, w] of [[3300, 0.05, 0], [4700, 0.04, 0.012], [2450, 0.03, 0.03]]) this.tone(f * (0.97 + Math.random() * 0.06), 0.16, { gain: g, when: w, pan }); this.noise(0.02, { f: 6000, q: 3, gain: 0.02, pan }); }
  /** a ladle in a pot */
  ladle() { this.noise(0.2, { f: 1500, q: 1.2, gain: 0.05, attack: 0.05 }); this.tone(700, 0.06, { gain: 0.03, type: 'triangle', when: 0.17 }); this.tone(2900, 0.1, { gain: 0.02, when: 0.2 }); }
  /** a chair scraped back */
  chair() { this.noise(0.22, { f: 420, q: 0.8, gain: 0.07, attack: 0.05 }); this.tone(95, 0.1, { type: 'triangle', gain: 0.06, when: 0.18 }); }
  /** a metal dustbin knocked over */
  clang() { for (const [f, g] of [[520, 0.07], [780, 0.05], [1250, 0.035], [1830, 0.02]]) this.tone(f * (0.98 + Math.random() * 0.04), 0.42, { gain: g, type: 'triangle' }); this.noise(0.12, { f: 900, q: 0.8, gain: 0.1 }); }
  /** a sliding gate or door on its motor */
  slide() { this.noise(0.9, { f: 380, q: 0.6, type: 'lowpass', gain: 0.05, attack: 0.25 }); this.tone(96, 0.85, { type: 'sawtooth', gain: 0.012, attack: 0.3, slideTo: 120 }); this.tone(1800, 0.05, { gain: 0.03, when: 0.9, type: 'triangle' }); }
  coins() { [1568, 2093].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', gain: 0.07, when: i * 0.07 })); }
  clatter() { for (let k = 0; k < 6; k++) this.tone(2400 + Math.random() * 2600, 0.06, { type: 'triangle', gain: 0.03, when: Math.random() * 1.2 }); }
  thunder(near = 0.5) {
    this.noise(2.8 + near, { f: 90 + near * 60, q: 0.3, type: 'lowpass', gain: 0.35 * (0.4 + near), attack: 0.05 + (1 - near) * 0.3 });
    this.noise(1.2, { f: 400, q: 0.5, type: 'lowpass', gain: 0.15 * near, when: 0.05 });
  }
  /** dhol / band beat for the rhythm games and concerts */
  beat(i, style = 'dhol') {
    if (style === 'band') {
      if (i % 2 === 0) { this.tone(58, 0.25, { type: 'sine', gain: 0.35, slideTo: 40 }); } else { this.noise(0.12, { f: 2400, q: 0.7, gain: 0.18 }); }
      this.noise(0.04, { f: 8000, q: 1, type: 'highpass', gain: 0.05, when: 0.25 });
      this.tone([220, 262, 196, 247][Math.floor(Math.random() * 4)], 0.3, { type: 'sawtooth', gain: 0.025 });
      return;
    }
    this.tone(i % 2 ? 150 : 90, 0.18, { type: 'sine', gain: 0.3, slideTo: i % 2 ? 110 : 60 });
    this.noise(0.06, { f: i % 2 ? 1800 : 900, q: 1.5, gain: 0.12 });
    if (i === 3) this.tone(330, 0.12, { type: 'triangle', gain: 0.05, when: 0.18 });
  }
  shutter() { this.noise(0.03, { f: 3000, q: 1, gain: 0.2 }); this.noise(0.05, { f: 1800, q: 1, gain: 0.15, when: 0.07 }); }
  whistle() { this.tone(2800, 0.5, { type: 'sine', gain: 0.08, slideTo: 3000 }); this.tone(2800, 0.25, { type: 'square', gain: 0.02 }); }
  batHit(power = 1) { this.noise(0.05, { f: 1400, q: 2, gain: 0.3 * power }); this.tone(520, 0.08, { type: 'triangle', gain: 0.15 * power }); }
  kick() { this.tone(120, 0.08, { type: 'sine', gain: 0.25, slideTo: 60 }); this.noise(0.04, { f: 900, gain: 0.12 }); }
  bounce() { this.tone(160, 0.06, { type: 'sine', gain: 0.18, slideTo: 100 }); }
  cheer(vol = 1) { for (let k = 0; k < 8; k++) this.noise(1.2 + Math.random(), { f: 700 + Math.random() * 900, q: 1.2, gain: 0.05 * vol, when: Math.random() * 0.3, attack: 0.15 }); }
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenO) {
      const o = this.ctx.createOscillator(); o.type = 'square';
      const l = this.ctx.createOscillator(); l.frequency.value = 0.8;
      const lg = this.ctx.createGain(); lg.gain.value = 220;
      l.connect(lg).connect(o.frequency); o.frequency.value = 760;
      const g = this.ctx.createGain(); g.gain.value = 0.035;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
      o.connect(f).connect(g).connect(this.master); o.start(); l.start();
      this.sirenO = { o, l };
    } else if (!on && this.sirenO) { this.sirenO.o.stop(); this.sirenO.l.stop(); this.sirenO = null; }
  }
  bark(pan = 0, vol = 1) { for (let k = 0; k < 2; k++) { this.tone(420 + Math.random() * 120, 0.09, { type: 'sawtooth', gain: 0.05 * vol, when: k * 0.22, pan, slideTo: 300 }); this.noise(0.08, { f: 900, q: 1, gain: 0.03 * vol, when: k * 0.22, pan }); } }
  howl(pan = 0) { for (let k = 0; k < 3; k++) this.tone(700 + k * 60, 1.0, { type: 'sine', gain: 0.03, when: k * 0.35 + Math.random() * 0.2, pan, slideTo: 1000 + k * 40, echo: true }); }
  meow(pan = 0) { this.tone(700, 0.35, { type: 'triangle', gain: 0.03, pan, slideTo: 520 }); }
  owl(pan = 0) { this.tone(380, 0.25, { gain: 0.04, pan, echo: true }); this.tone(360, 0.5, { gain: 0.04, when: 0.4, pan, echo: true }); }

  setVolume(v) { this.volume = v; if (this.main) this.main.gain.value = this.muted ? 0 : v; }
  setChannel(k, v) { this.vol[k] = v; if (this.buses?.[k]) this.buses[k].gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  /** a short, bright sting for rewards (quests, milestones) - distinct from interface clicks */
  reward(big = false) {
    const notes = big ? [523, 659, 784, 1047, 1319] : [784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', gain: 0.08, when: i * 0.06, echo: true }));
    this.noise(0.25, { f: 7000, q: 0.7, type: 'highpass', gain: 0.03, when: 0.05 });
  }
  toggleMute() { this.muted = !this.muted; this.setVolume(this.volume); return this.muted; }

  loop(buffer, { type, f, q }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    const pan = ctx.createStereoPanner();
    src.connect(flt).connect(g).connect(pan).connect(this.master);
    src.start(0, Math.random() * 1.5);
    return { src, flt, g, pan };
  }

  makeEngine(base = 1) {
    const ctx = this.ctx;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 500; flt.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0;
    const pan = ctx.createStereoPanner();
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(flt); o2.connect(g2).connect(flt);
    flt.connect(g).connect(pan).connect(this.master);
    o1.start(); o2.start();
    return { o1, o2, flt, g, pan, base };
  }

  makeDrone() {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 2400; flt.Q.value = 1.5;
    flt.connect(g).connect(this.master);
    const oscs = [196, 203, 211, 219].map((f) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = 0.25;
      o.connect(og).connect(flt); o.start();
      return o;
    });
    return { g, flt, oscs };
  }

  /** Per-frame update of continuous layers. */
  update(dt, s) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const set = (param, v, tc = 0.12) => param.setTargetAtTime(v, now, tc);
    // wind: altitude + speed
    const windAmt = clamp((s.altitude - 8) / 120, 0, 0.6) + clamp(s.airSpeed / 40, 0, 0.5);
    set(this.wind.g.gain, windAmt > 0.05 ? windAmt * 0.32 : 0, 0.6);           // (no steady "air" hiss while you walk about)
    set(this.wind.flt.frequency, 350 + s.airSpeed * 22);
    set(this.water.g.gain, 0);
    this.lapTimer = (this.lapTimer ?? 0) - dt;
    if (this.lapTimer <= 0) { this.lapTimer = 1.6 + Math.random() * 3.2; if (s.nearWater > 0.25 && !s.inside && s.altitude < 30) this.lap(s.nearWater); }
    // bicycle tyres on tarmac / grass
    set(this.tyre.g.gain, s.mode === 'bike' ? clamp(s.speed / 9, 0, 1) * (s.onRoad ? 0.22 : 0.35) : 0);
    set(this.tyre.flt.frequency, 250 + s.speed * (s.onRoad ? 110 : 60));
    // bus engine
    const bus = s.mode === 'bus';
    const rpm = 42 + s.speed * 5.5;
    set(this.engine.g.gain, bus ? (s.inside ? 0.16 : 0.24) : 0);
    set(this.engine.o1.frequency, rpm); set(this.engine.o2.frequency, rpm * 2.01);
    set(this.engine.flt.frequency, 280 + s.speed * 70);
    // drone rotors
    const dr = s.mode === 'drone';
    set(this.drone.g.gain, dr ? (s.fpv ? 0.13 : 0.09) * (0.6 + s.thrust * 0.6) : 0);
    this.drone.oscs.forEach((o, i) => set(o.frequency, (196 + i * 7.5) * (1 + s.thrust * 0.55), 0.05));
    // nearest NPC motor vehicle
    if (s.npc) {
      const g = clamp(1 - s.npc.d / 32, 0, 1) * 0.045;
      set(this.npcEngine.g.gain, g);
      set(this.npcEngine.pan.pan, s.npc.pan);
      const f = s.npc.kind === 'scooter' ? 70 + s.npc.speed * 8 : s.npc.kind === 'bus' ? 40 + s.npc.speed * 5 : 55 + s.npc.speed * 6;
      set(this.npcEngine.o1.frequency, f); set(this.npcEngine.o2.frequency, f * 2.02);
      set(this.npcEngine.flt.frequency, s.npc.kind === 'scooter' ? 900 : 500);
    } else set(this.npcEngine.g.gain, 0);

    // birds by day near the ground, crickets + frogs by night
    const lowAlt = s.altitude < 60;
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 0.4 + Math.random() * (s.treeDensity > 0.3 ? 1.6 : 3.5);
      if (s.night < 0.5 && lowAlt && !s.inside) this.bird();
    }
    this.cricketTimer -= dt;
    if (this.cricketTimer <= 0) {
      this.cricketTimer = 0.7 + Math.random() * 1.8;
      if (s.night > 0.4 && !s.inside) this.cricket();
    }
    this.frogTimer -= dt;
    if (this.frogTimer <= 0) {
      this.frogTimer = 0.6 + Math.random() * 1.8;
      if (s.night > 0.4 && s.nearWater > 0.2) this.frog(s.nearWater);
    }
  }

  env(g, t0, a, peak, decay) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + decay);
  }

  tone(freq, dur, { type = 'sine', gain = 0.2, attack = 0.005, when = 0, pan = 0, echo = false, slideTo = null } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(g).connect(p).connect(this._bus ? this.buses[this._bus] : this.master);
    if (echo) p.connect(this.echo);
    this.env(g, t0, attack, gain, dur);
    o.start(t0); o.stop(t0 + attack + dur + 0.05);
  }

  noise(dur, { f = 1000, q = 1, type = 'bandpass', gain = 0.2, when = 0, attack = 0.003, pan = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain();
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    s.connect(flt).connect(g).connect(p).connect(this._bus ? this.buses[this._bus] : this.master);
    this.env(g, t0, attack, gain, dur);
    s.start(t0, Math.random()); s.stop(t0 + attack + dur + 0.05);
  }

  // ---- ambience
  bird() {
    const pan = Math.random() * 1.6 - 0.8;
    const r = Math.random();
    const vol = 0.03 + Math.random() * 0.05;
    if (r < 0.28) {
      // Asian koel: rising "ku-oo" calls, the classic sound of an Assam morning
      const base = 620 + Math.random() * 120;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const f = base * (1 + k * 0.08);
        this.tone(f * 0.82, 0.16, { gain: vol * 1.3, when: k * 0.62, pan, echo: true, slideTo: f });
        this.tone(f, 0.3, { gain: vol * 1.3, when: k * 0.62 + 0.2, pan, echo: true, slideTo: f * 1.1 });
      }
    } else if (r < 0.65) {
      // bulbul-like cheerful whistle
      const n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const f = 1800 + Math.random() * 1600;
        this.tone(f, 0.07 + Math.random() * 0.06, { gain: vol, when: k * 0.11, pan, slideTo: f * (0.8 + Math.random() * 0.5) });
      }
    } else if (r < 0.85) {
      // myna chatter
      for (let k = 0; k < 5; k++) this.noise(0.05, { f: 2500 + Math.random() * 2000, q: 8, gain: vol * 0.9, when: k * 0.09, pan });
    } else {
      // sparrow chirps
      for (let k = 0; k < 3; k++) this.tone(4200 + Math.random() * 800, 0.04, { gain: vol * 0.8, when: k * 0.07, pan, slideTo: 3500 });
    }
  }

  /** a soft lap of water on the bank */
  lap(near = 1) {
    const pan = Math.random() * 1.2 - 0.6;
    this.noise(0.5, { f: 380 + Math.random() * 260, q: 0.7, type: 'lowpass', gain: 0.012 * near, attack: 0.16, pan });
    this.noise(0.2, { f: 1400 + Math.random() * 700, q: 0.6, gain: 0.004 * near, when: 0.1, attack: 0.05, pan });
  }

  cricket() {
    const pan = Math.random() * 1.8 - 0.9;
    for (let k = 0; k < 3; k++) this.tone(4300 + Math.random() * 300, 0.025, { gain: 0.011, when: k * 0.045, pan, type: 'triangle' });
  }

  frog(near) {
    const pan = Math.random() * 1.4 - 0.7;
    const f = 180 + Math.random() * 120;
    for (let k = 0; k < 2; k++) this.tone(f, 0.09, { gain: 0.05 * near, when: k * 0.16, pan, type: 'square', slideTo: f * 0.7 });
  }

  // ---- one-shots
  footstep(surface = 'grass') {
    const pan = (Math.random() - 0.5) * 0.2, j = 0.85 + Math.random() * 0.3;
    switch (surface) {
      case 'road': this.noise(0.05, { f: 1900 * j, q: 1.8, gain: 0.07, pan }); this.tone(140, 0.03, { gain: 0.03, pan }); break;
      case 'tile': this.noise(0.03, { f: 3200 * j, q: 2.5, gain: 0.06, pan }); this.tone(220, 0.04, { type: 'triangle', gain: 0.03, pan }); break;
      case 'wood': this.tone(160 * j, 0.09, { type: 'triangle', gain: 0.09, pan }); this.noise(0.04, { f: 900, q: 1, gain: 0.04, pan }); break;
      case 'gravel': for (let k = 0; k < 4; k++) this.noise(0.025, { f: 2600 + Math.random() * 2400, q: 2, gain: 0.035, when: k * 0.018, pan }); break;
      case 'roof': this.noise(0.06, { f: 500, q: 0.7, gain: 0.07, pan }); this.tone(90, 0.06, { gain: 0.08 }); break;
      case 'water': this.noise(0.18, { f: 900 * j, q: 0.6, gain: 0.12, pan }); this.noise(0.08, { f: 3000, q: 1, gain: 0.04, when: 0.03, pan }); break;
      default: this.noise(0.09, { f: 700 * j, q: 0.5, gain: 0.06, pan }); this.noise(0.04, { f: 2200, q: 0.8, gain: 0.015, when: 0.02, pan });   // grass
    }
  }
  jump() { this.noise(0.08, { f: 700, q: 0.8, gain: 0.08 }); }
  land() { this.noise(0.12, { f: 300, q: 0.7, gain: 0.14 }); this.tone(70, 0.1, { gain: 0.12 }); }
  splash() { this.noise(0.5, { f: 1200, q: 0.5, gain: 0.2 }); this.noise(0.3, { f: 3500, q: 1, gain: 0.08, when: 0.05 }); }
  bump() { this.tone(80, 0.12, { gain: 0.2, type: 'triangle' }); this.noise(0.1, { f: 400, gain: 0.12 }); }

  bell(pan = 0, vol = 1) {
    // two quick rings of a bicycle bell (inharmonic partials)
    for (const w of [0, 0.16]) {
      for (const [f, g] of [[2960, 0.12], [4150, 0.07], [5300, 0.05], [7100, 0.02]]) this.tone(f, 0.55, { gain: g * vol, when: w, pan, attack: 0.002 });
    }
  }
  horn(pan = 0, vol = 1) {
    this.tone(360, 0.35, { type: 'square', gain: 0.07 * vol, pan });
    this.tone(450, 0.35, { type: 'square', gain: 0.06 * vol, pan });
  }
  freewheelTick() { this.noise(0.012, { f: 5000, q: 3, gain: 0.03 }); }
  brakeHiss() { this.noise(0.9, { f: 5500, q: 0.5, type: 'highpass', gain: 0.12 }); }
  door() { this.noise(0.4, { f: 2500, q: 0.6, gain: 0.09 }); this.tone(110, 0.08, { gain: 0.12, when: 0.42, type: 'triangle' }); }
  stopChime() { this.tone(659, 0.5, { gain: 0.12, type: 'triangle', echo: true }); this.tone(523, 0.7, { gain: 0.12, type: 'triangle', when: 0.35, echo: true }); }
  discover() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { gain: 0.09, type: 'triangle', when: i * 0.09, echo: true })); }
  collect() { this.tone(988, 0.12, { gain: 0.1, type: 'square' }); this.tone(1319, 0.3, { gain: 0.1, type: 'square', when: 0.08, echo: true }); }
  achievement() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, i === 4 ? 0.8 : 0.18, { gain: 0.1, type: 'sawtooth', when: i * 0.12, echo: true })); }
  click() { this.tone(1400, 0.03, { gain: 0.05, type: 'square' }); }
  whoosh() { this.noise(0.6, { f: 800, q: 0.4, gain: 0.12, attack: 0.15 }); }

  pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const choose = () => {
      const vs = speechSynthesis.getVoices();
      this.voice = vs.find((v) => /en[-_]IN/i.test(v.lang)) || vs.find((v) => /India/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang)) || null;
    };
    choose();
    speechSynthesis.onvoiceschanged = choose;
  }

  speak(text) {
    // everything spoken is also shown as a subtitle ("I I T" is only there so the voice spells the letters out)
    if (this.subtitles) this.onSubtitle?.(text.replace(/\bI I T\b/g, 'IIT'));
    if (!('speechSynthesis' in window) || this.muted || this.vol.voice <= 0.01) return;
    this.dip(0.4, Math.min(14, 1.6 + text.length * 0.068));
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.rate = 0.98; u.pitch = 1; u.volume = Math.min(1, this.volume * this.vol.voice + 0.05);
      speechSynthesis.speak(u);
    } catch { /* speech not available */ }
  }
  stopSpeech() { try { speechSynthesis.cancel(); } catch { /* ignore */ } }
}

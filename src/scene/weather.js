// Weather: picks conditions from Guwahati's climate by month and hour, blends between
// them, and renders rain streaks + lightning. Everything else reads `state` or the
// shared uniforms (wetness, wind).
import * as THREE from 'three';
import { U } from './shared.js';
import { clamp, lerp, mulberry32 } from '../util.js';

export const WEATHERS = {
  clear:   { name: 'Clear',          cover: 0.12, dark: 0,    rain: 0,    fog: 1.0, wind: 0.25, storm: 0 },
  cloudy:  { name: 'Partly cloudy',  cover: 0.45, dark: 0.1,  rain: 0,    fog: 1.2, wind: 0.35, storm: 0 },
  overcast:{ name: 'Overcast',       cover: 0.85, dark: 0.45, rain: 0,    fog: 1.8, wind: 0.4,  storm: 0 },
  drizzle: { name: 'Drizzle',        cover: 0.8,  dark: 0.5,  rain: 0.25, fog: 2.4, wind: 0.4,  storm: 0 },
  rain:    { name: 'Rain',           cover: 0.95, dark: 0.65, rain: 0.7,  fog: 3.2, wind: 0.55, storm: 0 },
  storm:   { name: 'Thunderstorm',   cover: 1.0,  dark: 0.85, rain: 1.0,  fog: 4.0, wind: 1.0,  storm: 1 },
  mist:    { name: 'Morning mist',   cover: 0.3,  dark: 0.15, rain: 0,    fog: 6.0, wind: 0.1,  storm: 0 },
  fog:     { name: 'Dense fog',      cover: 0.6,  dark: 0.3,  rain: 0,    fog: 13.0, wind: 0.05, storm: 0 },
};

// chance table [clear, cloudy, overcast, drizzle, rain, storm, mist, fog] by month (0 = Jan)
const CLIMATE = [
  [0.55, 0.2, 0.05, 0, 0, 0, 0.1, 0.1],        // Jan: dry, foggy mornings
  [0.55, 0.25, 0.05, 0.02, 0, 0, 0.1, 0.03],
  [0.45, 0.3, 0.1, 0.05, 0.04, 0.06, 0, 0],    // Mar: first nor'westers
  [0.3, 0.3, 0.12, 0.06, 0.08, 0.14, 0, 0],    // Apr-May: bordoisila thunderstorms
  [0.25, 0.3, 0.12, 0.07, 0.12, 0.14, 0, 0],
  [0.08, 0.2, 0.2, 0.17, 0.27, 0.08, 0, 0],    // Jun-Aug: monsoon
  [0.07, 0.18, 0.22, 0.17, 0.28, 0.08, 0, 0],
  [0.1, 0.22, 0.2, 0.15, 0.25, 0.08, 0, 0],
  [0.2, 0.3, 0.16, 0.12, 0.16, 0.06, 0, 0],    // Sep: retreating monsoon
  [0.45, 0.3, 0.08, 0.07, 0.06, 0.02, 0.02, 0],
  [0.6, 0.2, 0.04, 0.02, 0, 0, 0.1, 0.04],     // Nov-Dec: clear days, misty mornings
  [0.55, 0.2, 0.05, 0.01, 0, 0, 0.11, 0.08],
];
const IDS = ['clear', 'cloudy', 'overcast', 'drizzle', 'rain', 'storm', 'mist', 'fog'];

export class Weather {
  constructor(game, quality) {
    this.g = game;
    this.mode = game.progress.settings.weather || 'auto';
    this.rnd = mulberry32((Date.now() / 3.6e6) | 0);
    this.cur = { ...WEATHERS.clear };
    this.target = WEATHERS.clear;
    this.targetId = 'clear';
    this.nextChange = 0;
    this.flash = 0;
    this.flashT = 3;
    this.thunderQ = [];
    this.inside = false;
    this.buildRain(quality);
    this.pick(true);
  }

  get state() { return this.cur; }
  get id() { return this.targetId; }

  buildRain(quality) {
    const N = quality === 'high' ? 14000 : quality === 'low' ? 3000 : 8000;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const off = new Float32Array(N * 3);
    const r = mulberry32(5);
    for (let i = 0; i < N * 3; i++) off[i] = r();
    g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
    g.instanceCount = 0;
    this.rainN = N;
    this.rainU = { uCam: { value: new THREE.Vector3() }, uT: { value: 0 }, uWindV: { value: new THREE.Vector2(1.5, 0.6) }, uA: { value: 0.3 }, uCol: { value: new THREE.Color(0.75, 0.8, 0.86) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.rainU, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        attribute vec3 aOff; uniform vec3 uCam; uniform float uT; uniform vec2 uWindV; varying float vY;
        void main(){
          vec3 B = vec3(56.0, 34.0, 56.0);
          float fall = 9.0 + aOff.z * 3.0;
          vec3 c;
          c.y = uCam.y + B.y * 0.45 - fract(aOff.y + uT * fall / B.y) * B.y;
          float drop = uCam.y + B.y * 0.45 - c.y;
          c.x = uCam.x + (fract(aOff.x - uCam.x / B.x) - 0.5) * B.x + uWindV.x * drop / fall;
          c.z = uCam.z + (fract(aOff.z * 7.31 - uCam.z / B.z) - 0.5) * B.z + uWindV.y * drop / fall;
          vec3 fwd = normalize(vec3(c.x - uCam.x, 0.0, c.z - uCam.z) + 1e-4);
          vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
          vec3 dir = normalize(vec3(uWindV.x, -fall, uWindV.y));
          vec3 p = c + right * position.x * 0.018 - dir * position.y * (0.55 + aOff.x * 0.4);
          vY = position.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uA; uniform vec3 uCol; varying float vY;
        void main(){ gl_FragColor = vec4(uCol, uA * (1.0 - vY) * vY * 4.0); }`,
    });
    this.rain = new THREE.Mesh(g, mat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 8;
    this.g.scene.add(this.rain);
  }

  setMode(m) {
    this.mode = m;
    this.g.progress.settings.weather = m;
    this.g.progress.save();
    this.pick(false);
  }

  /** choose the next conditions (auto: climate table for this month + time of day) */
  pick(instant) {
    const clock = this.g.clock;
    let id = this.mode;
    if (id === 'auto') {
      const probs = CLIMATE[clock.month].slice();
      const h = clock.hour;
      // fog and mist only around dawn; thunderstorms mostly in the afternoon/evening
      if (!(h > 4 && h < 10)) { probs[0] += probs[6] + probs[7]; probs[6] = probs[7] = 0; } else { probs[6] *= 2.5; probs[7] *= 2.5; }
      if (h > 13 && h < 21) probs[5] *= 1.8; else probs[5] *= 0.4;
      let s = probs.reduce((a, b) => a + b, 0), u = this.rnd() * s;
      id = 'clear';
      for (let i = 0; i < probs.length; i++) { u -= probs[i]; if (u <= 0) { id = IDS[i]; break; } }
      this.nextChange = clock.abs + 1.2 + this.rnd() * 2.3;
    } else this.nextChange = Infinity;
    const changed = id !== this.targetId;
    this.targetId = id;
    this.target = WEATHERS[id];
    if (instant) this.cur = { ...this.target, wet: this.target.rain > 0 ? 0.8 : 0 };
    if (changed && !instant && this.g.ui) this.g.ui.toast(this.target.name, 'info', 'Weather');
  }

  update(dt, camera) {
    const clock = this.g.clock;
    if (this.mode === 'auto' && clock.abs >= this.nextChange) this.pick(false);
    // mist burns off after 10 am
    if ((this.targetId === 'mist' || this.targetId === 'fog') && clock.hour > 10 && clock.hour < 20 && this.mode === 'auto') this.pick(false);
    const c = this.cur, t = this.target;
    const k = 1 - Math.exp(-dt / 12);
    for (const key of ['cover', 'dark', 'rain', 'fog', 'wind', 'storm']) c[key] = lerp(c[key], t[key], k);
    // surfaces soak quickly in rain and dry slowly afterwards (faster in the sun)
    const wetTarget = c.rain > 0.08 ? Math.min(1, 0.45 + c.rain) : 0;
    const dryRate = (clock.k || 1) / 20;
    c.wet = c.wet ?? 0;
    c.wet = wetTarget > c.wet ? Math.min(wetTarget, c.wet + dt * 0.05 * (0.4 + c.rain)) : Math.max(wetTarget, c.wet - dt * 0.0006 * dryRate * (1 + (1 - c.cover) * 3));
    U.uWet.value = c.wet;
    U.uWind.value = c.wind;
    U.uRain.value = c.rain;
    // rain streaks around the camera
    const show = c.rain > 0.02 && !this.inside;
    this.rain.visible = show;
    if (show) {
      this.rain.geometry.instanceCount = Math.floor(this.rainN * clamp(c.rain, 0, 1));
      this.rainU.uCam.value.copy(camera.position);
      this.rainU.uT.value += dt;
      this.rainU.uWindV.value.set(1.2 + c.wind * 3, 0.5 + c.wind * 1.5);
      const night = this.g.sky ? this.g.sky.state.night : 0;
      this.rainU.uA.value = lerp(0.3, 0.14, night) * (0.6 + c.rain * 0.4);
    }
    // lightning
    this.flash = Math.max(0, this.flash - dt * 5);
    if (c.storm > 0.5 && !this.inside) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        this.flashT = 4 + this.rnd() * 14;
        this.flash = 1;
        const delay = 0.6 + this.rnd() * 3.5;
        this.thunderQ.push({ t: delay, near: 1 - delay / 4.2 });
      }
    }
    for (const q of this.thunderQ) q.t -= dt;
    while (this.thunderQ.length && this.thunderQ[0].t <= 0) { const q = this.thunderQ.shift(); this.g.audio.thunder?.(q.near); }
  }
}

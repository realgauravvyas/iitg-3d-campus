import * as THREE from 'three';
import { canvasTexture, mulberry32, clamp, lerp } from '../util.js';

// IIT Guwahati: 26.19 N, 91.69 E. Indian Standard Time is UTC+5:30 (82.5 E meridian).
const LAT = 26.19 * (Math.PI / 180);
const LON = 91.69;

export const TIME_PRESETS = [
  { name: 'Morning', t: 8.5 },
  { name: 'Noon', t: 11.25 },
  { name: 'Afternoon', t: 15.0 },
  { name: 'Golden hour', t: 16.7 },
  { name: 'Night', t: 20.5 },
  { name: 'Dawn', t: 5.45 },
];

function dayOfYear(d) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
}

/** Sun direction (world: x east, y up, -z north) for IST decimal hour today. */
export function sunDirection(hourIST, date = new Date()) {
  const N = dayOfYear(date);
  const B = ((2 * Math.PI) / 365) * (N - 81);
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes
  const decl = (23.44 * Math.PI / 180) * Math.sin(B);
  const solar = hourIST + ((LON - 82.5) * 4 + eot) / 60;
  const H = (15 * (solar - 12)) * (Math.PI / 180);
  const sinAlt = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(H);
  const alt = Math.asin(sinAlt);
  const A = Math.atan2(-Math.cos(decl) * Math.sin(H), (Math.sin(decl) - sinAlt * Math.sin(LAT)) / Math.cos(LAT));
  return { dir: new THREE.Vector3(Math.sin(A) * Math.cos(alt), Math.sin(alt), -Math.cos(A) * Math.cos(alt)), alt, az: A };
}

export function formatTime(h) {
  h = ((h % 24) + 24) % 24;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const ap = hh >= 12 ? 'PM' : 'AM';
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ap}`;
}

function skyMaterial(withClouds) {
  return new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color(1, 0.95, 0.85) }, glow: { value: 1 }, gain: { value: 1.6 },
      cover: { value: 0.2 }, dark: { value: 0 }, cloudLit: { value: new THREE.Color(1, 1, 1) }, cloudShade: { value: new THREE.Color(0.6, 0.62, 0.68) },
      time: { value: 0 }, flash: { value: 0 }, sunVis: { value: 1 },
    },
    defines: withClouds ? { CLOUDS: 1 } : {},
    vertexShader: `varying vec3 vDir;
      void main() {
        vDir = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `uniform vec3 top, horizon, bottom, sunColor, sunDir, cloudLit, cloudShade; uniform float glow, gain, cover, dark, time, flash, sunVis; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 1.0, h), 0.6)) : mix(horizon, bottom, smoothstep(0.0, 0.3, -h));
        float grey = dot(col, vec3(0.3, 0.55, 0.15));
        col = mix(col, vec3(grey) * vec3(0.92, 0.95, 1.0), dark * 0.75);
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 1400.0) * 14.0 * sunVis + pow(s, 14.0) * 0.45 * glow * (1.0 - dark * 0.8) + pow(s, 3.0) * 0.14 * glow * (1.0 - dark * 0.6));
        #ifdef CLOUDS
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.06) * 1.6 + vec2(time * 0.012, time * 0.004);
          float n = fbm(uv);
          float n2 = fbm(uv * 2.7 + 13.0);
          float thr = mix(0.78, 0.18, cover);
          float c = smoothstep(thr, thr + 0.28, n * 0.8 + n2 * 0.35);
          c *= smoothstep(0.0, 0.12, h);
          float lit = clamp(0.55 + (n2 - 0.5) * 1.2 + s * 0.6, 0.0, 1.0);
          vec3 cc = mix(cloudShade, cloudLit, lit * (1.0 - dark * 0.7));
          cc += sunColor * pow(s, 6.0) * 0.6 * (1.0 - dark) * (1.0 - c * 0.5);
          col = mix(col, cc, clamp(c * (0.75 + cover * 0.25), 0.0, 1.0));
        }
        #endif
        col += vec3(0.8, 0.85, 1.0) * flash * (h > -0.1 ? 1.0 : 0.3);
        gl_FragColor = vec4(col * gain, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
}

// sky palette keyed by sun altitude (degrees)
const SKY_KEYS = [
  { a: -14, top: 0x03070f, hor: 0x0b1424, bot: 0x05080d },
  { a: -6, top: 0x101c3a, hor: 0x3a3450, bot: 0x121622 },
  { a: -1, top: 0x2a4174, hor: 0xd9876a, bot: 0x3a3a44 },
  { a: 6, top: 0x3b62a6, hor: 0xefb58a, bot: 0x6c7480 },
  { a: 16, top: 0x3f79c4, hor: 0xbcd3e6, bot: 0x8898a6 },
  { a: 60, top: 0x2f6fc2, hor: 0xb2cfe6, bot: 0x8b9cab },
];
function skyColors(altDeg, out) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && altDeg > SKY_KEYS[i + 1].a) i++;
  const A = SKY_KEYS[i], B = SKY_KEYS[i + 1];
  const t = clamp((altDeg - A.a) / (B.a - A.a), 0, 1);
  out.top.set(A.top).lerp(new THREE.Color(B.top), t);
  out.horizon.set(A.hor).lerp(new THREE.Color(B.hor), t);
  out.bottom.set(A.bot).lerp(new THREE.Color(B.bot), t);
}

export function buildSky(renderer, scene, quality) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(12000, 48, 24), skyMaterial(true));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  const u = sky.material.uniforms;

  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMaterial(false));
  envSky.material.uniforms = { ...u };
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = quality !== 'low';
  const sm = quality === 'high' ? 4096 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  const R = quality === 'high' ? 170 : 140;
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 1400 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a5a3a, 1.0);
  scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xb4c6d3, 0.0002);

  // stars
  const rnd = mulberry32(3);
  const sp = [];
  for (let i = 0; i < 2200; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.95);
    sp.push(Math.cos(th) * Math.sin(ph) * 9000, Math.cos(ph) * 9000, Math.sin(th) * Math.sin(ph) * 9000);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(sg, starMat);
  stars.renderOrder = -9;
  scene.add(stars);

  // moon
  const moonTex = canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.45, 'rgba(250,248,230,1)');
    gr.addColorStop(0.5, 'rgba(250,248,230,0.35)'); gr.addColorStop(1, 'rgba(250,248,230,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }, { repeat: false });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, transparent: true, depthWrite: false }));
  moon.scale.setScalar(500);
  moon.renderOrder = -9;
  scene.add(moon);

  const state = { hour: 8.5, night: 0, day: 1, gold: 0, sunDir: new THREE.Vector3(), lastEnv: '', inside: false };
  const W = { cover: 0.12, dark: 0, fog: 1, rain: 0, flash: 0 };
  const tmp = new THREE.Color();
  let time = 0;

  function apply() {
    if (state.inside) {
      // indoors: tube lights overhead (the "sun" shines straight down through the ceiling-less shadow map)
      sun.intensity = 1.35; sun.color.set(0xfff3e0);
      hemi.intensity = 1.05; hemi.color.set(0xfff6ec); hemi.groundColor.set(0x8a7f70);
      scene.fog.density = 0;
      renderer.toneMappingExposure = 0.78;
      scene.environmentIntensity = 0.12;
      starMat.opacity = 0; moon.visible = false;
    }
    const { dir, alt } = sunDirection(state.hour);
    state.sunDir.copy(dir);
    const altDeg = alt * 180 / Math.PI;
    const day = clamp((altDeg + 4) / 14, 0, 1);            // 0 night .. 1 day
    const gold = clamp(1 - Math.abs(altDeg - 6) / 12, 0, 1) * day * (1 - W.dark);
    state.day = day; state.gold = gold;
    state.night = 1 - clamp((altDeg + 6) / 10, 0, 1);
    if (state.inside) return;
    skyColors(altDeg, { top: u.top.value, horizon: u.horizon.value, bottom: u.bottom.value });
    u.sunDir.value.copy(dir);
    u.sunColor.value.setHSL(0.09 - gold * 0.04, 0.6 + gold * 0.3, 0.75);
    u.glow.value = altDeg > -4 ? 1 : 0;
    u.gain.value = lerp(1.0, 1.7, day) * (1 - W.dark * 0.35);
    u.cover.value = W.cover;
    u.dark.value = W.dark;
    u.sunVis.value = clamp(1 - W.cover * 1.1, 0, 1);
    // clouds: sunlit white by day, orange at golden hour, blue-grey at night
    u.cloudLit.value.setRGB(lerp(0.12, 1.05, day), lerp(0.13, 1.02 - gold * 0.15, day), lerp(0.18, 1.0 - gold * 0.3, day));
    u.cloudShade.value.copy(u.cloudLit.value).multiplyScalar(lerp(0.62, 0.45, W.dark));
    const sunK = 1 - W.dark * 0.85 - W.cover * 0.15;
    sun.intensity = lerp(0.0, 2.7, day) * (1 - gold * 0.2) * sunK;
    sun.color.setHSL(0.09 - gold * 0.03, (0.35 + gold * 0.5) * (1 - W.dark), 0.92 - gold * 0.12);
    // nights are dark but readable: a little more moonlit sky light
    hemi.intensity = (lerp(0.55, 0.62, day) + gold * 0.25) * (1 + W.dark * 0.35);
    hemi.color.set(day > 0.1 ? (gold > 0.4 ? 0xffd9b0 : 0xcfe3ff) : 0x7c92c8);
    if (W.dark > 0.3) hemi.color.lerp(new THREE.Color(0xc4ccd6), W.dark);
    hemi.groundColor.set(day > 0.1 ? 0x5a5a3a : 0x1b2028);
    if (state.night > 0.5) { // moonlight
      sun.intensity = 0.78 * (1 - W.dark * 0.7);
      sun.color.set(0xa9bcff);
    }
    tmp.copy(u.horizon.value).multiplyScalar(u.gain.value * 0.62);
    tmp.lerp(new THREE.Color(0.55, 0.58, 0.62).multiplyScalar(lerp(0.12, 1, day)), clamp(W.dark + (W.fog - 1) / 10, 0, 0.85));
    scene.fog.color.copy(tmp);
    scene.fog.density = 0.0002 * W.fog;
    renderer.toneMappingExposure = (lerp(0.66, 0.5, day) + gold * 0.1 + state.night * 0.2) * (1 + W.dark * 0.25);
    starMat.opacity = clamp(state.night * 1.1 * (1 - W.cover * 1.2), 0, 1);
    moon.visible = state.night > 0.2 && W.cover < 0.8;
    const key = `${Math.round(state.hour * 4)}:${Math.round(W.cover * 5)}:${Math.round(W.dark * 5)}`;
    if (key !== state.lastEnv && !state.inside) {
      state.lastEnv = key;
      for (const k of Object.keys(u)) if (envSky.material.uniforms[k]) envSky.material.uniforms[k].value = u[k].value;
      envSky.material.uniforms.flash = { value: 0 };
      if (envRT) envRT.dispose();
      envRT = pmrem.fromScene(envScene, 0, 0.1, 2000);
      scene.environment = envRT.texture;
      scene.environmentIntensity = lerp(0.1, 0.45, day) * (1 - W.dark * 0.3);
    }
  }

  return {
    sky, sun, hemi, state, W,
    setHour(h) { state.hour = ((h % 24) + 24) % 24; apply(); },
    setWeather(w) { W.cover = w.cover; W.dark = w.dark; W.fog = w.fog; W.rain = w.rain; },
    refresh: apply,
    update(dt, focus, camera, flash = 0) {
      time += dt;
      u.time.value = time;
      u.flash.value = flash;
      if (flash > 0.01) hemi.intensity += flash * 2.5;
      // shadow camera follows the player; snap to texels to stop shimmering
      const lightDir = state.inside ? new THREE.Vector3(0.18, 1, 0.12).normalize() : state.night > 0.5 ? new THREE.Vector3(-0.3, 0.8, 0.4).normalize() : state.sunDir;
      const texel = (R * 2) / sun.shadow.mapSize.x;
      const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
      sun.target.position.set(fx, focus.y, fz);
      sun.position.set(fx + lightDir.x * 600, focus.y + Math.max(0.15, lightDir.y) * 600, fz + lightDir.z * 600);
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      moon.position.set(camera.position.x - 3000, camera.position.y + 4200, camera.position.z + 1500);
    },
  };
}

// Post-processing: MSAA scene buffer -> (GTAO on high) -> bloom -> tone map -> grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uSat: { value: 1.08 }, uContrast: { value: 1.06 },
    uTint: { value: new THREE.Vector3(1, 1, 1) }, uVignette: { value: 0.28 }, uGrain: { value: 0.012 }, uLift: { value: 0.0 },
    uFade: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uSat, uContrast, uVignette, uGrain, uLift, uFade; uniform vec3 uTint; uniform vec2 uRes;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb; float a = clamp(src.a, 0.0, 1.0);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContrast + 0.5 + uLift;
      c *= uTint;
      vec2 q = vUv - 0.5;
      float vig = 1.0 - uVignette * dot(q, q) * 2.2;
      c *= vig;
      c += (h(vUv * uRes + fract(floor(uTime * 20.0) / 20.0) * 91.7) - 0.5) * uGrain;
      c = mix(c, vec3(0.0), uFade);
      // premultiplied: where the scene is see-through (a video screen) the page behind shows,
      // darkened by the vignette and the fade like the rest of the picture
      gl_FragColor = vec4(clamp(c, 0.0, 1.0) * a, 1.0 - (1.0 - a) * vig * (1.0 - uFade));
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera, quality) {
    this.r = renderer; this.scene = scene; this.camera = camera;
    this.enabled = quality !== 'low';
    this.hidden = [];
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 2 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    if (quality === 'high') {
      this.ao = new GTAOPass(scene, camera, size.x, size.y);
      this.ao.output = GTAOPass.OUTPUT.Default;
      this.ao.blendIntensity = 0.85;
      this.ao.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      // animated crowds and grass are drawn un-posed in the AO normal pass: keep them out
      const render = this.ao.render.bind(this.ao);
      this.ao.render = (...a) => { const v = this.hidden.map((o) => o.visible); this.hidden.forEach((o) => (o.visible = false)); render(...a); this.hidden.forEach((o, i) => (o.visible = v[i])); };
      this.composer.addPass(this.ao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.25, 0.55, 1.4);
    // add the glow to colour only: keep the scene's alpha (the see-through video screens)
    Object.assign(this.bloom.blendMaterial, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    this.composer.addPass(this.bloom);
    this.bokeh = new BokehPass(scene, camera, { focus: 12, aperture: 0.004, maxblur: 0.008 });
    this.bokeh.enabled = false;
    this.composer.addPass(this.bokeh);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.resize();
  }

  keepOutOfAO(...objs) { this.hidden.push(...objs); }

  resize() {
    const size = this.r.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(this.r.getPixelRatio());
    this.composer.setSize(size.x, size.y);
    this.grade.uniforms.uRes.value.set(size.x, size.y);
  }

  /** Per-frame look: bloom + grade follow time of day and weather. */
  setLook({ night = 0, gold = 0, dark = 0, fade = 0, inside = false, filter = 'none' }) {
    const b = this.bloom;
    b.threshold = inside ? 1.1 : THREE.MathUtils.lerp(1.5, 0.9, night);
    b.strength = inside ? 0.3 : THREE.MathUtils.lerp(0.18, 0.42, night) + gold * 0.06;
    b.radius = 0.55;
    const G = this.grade.uniforms;
    G.uSat.value = THREE.MathUtils.lerp(1.1, 0.88, dark) - night * 0.08;
    G.uContrast.value = 1.05 + gold * 0.04 - dark * 0.03;
    G.uTint.value.set(1 + gold * 0.04 - night * 0.03, 1, 1 - gold * 0.05 + night * 0.04 + dark * 0.02);
    G.uVignette.value = inside ? 0.34 : 0.26;
    G.uFade.value = fade;
    G.uGrain.value = 0.012;
    // photo-mode filters
    const T = G.uTint.value;
    switch (filter) {
      case 'vivid': G.uSat.value *= 1.35; G.uContrast.value *= 1.08; break;
      case 'bw': G.uSat.value = 0; G.uContrast.value *= 1.12; break;
      case 'sepia': G.uSat.value = 0.12; T.set(1.12, 1.0, 0.76); break;
      case 'warm': T.set(T.x * 1.08, T.y * 1.0, T.z * 0.86); G.uSat.value *= 1.08; break;
      case 'cool': T.set(T.x * 0.9, T.y * 1.0, T.z * 1.12); break;
      case 'film': G.uSat.value *= 0.82; G.uContrast.value *= 1.16; G.uVignette.value = 0.55; G.uGrain.value = 0.07; T.set(T.x * 1.04, T.y, T.z * 0.95); break;
    }
  }

  render(time) {
    if (!this.enabled) { this.r.render(this.scene, this.camera); return; }
    this.grade.uniforms.uTime.value = time;
    this.composer.render();
  }
}

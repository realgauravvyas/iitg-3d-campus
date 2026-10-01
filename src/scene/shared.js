// Uniforms shared by many materials (weather, wind, time) so one update drives them all.
export const U = {
  uTime: { value: 0 },
  uWet: { value: 0 },      // 0 dry .. 1 soaked (darker, glossier surfaces, puddles)
  uWind: { value: 0.3 },   // 0 calm .. 1 storm (tree / grass sway)
  uRain: { value: 0 },     // rain intensity (ripples on water)
};

/** GLSL snippet: wet look for a MeshStandardMaterial fragment (after roughnessmap_fragment). */
export const WET_FRAG = /* glsl */`
  {
    float wetK = uWet;
    #ifdef WET_PUDDLES
      float pn = sin(vWetPos.x * 0.21 + sin(vWetPos.z * 0.13) * 2.0) * sin(vWetPos.z * 0.17 + sin(vWetPos.x * 0.11) * 2.0);
      float puddle = smoothstep(0.35, 0.6, pn) * smoothstep(0.35, 0.9, uWet);
    #else
      float puddle = 0.0;
    #endif
    diffuseColor.rgb *= mix(1.0, 0.62, wetK) * mix(1.0, 0.8, puddle);
    roughnessFactor = mix(roughnessFactor, WET_MIN_ROUGH, wetK * 0.85);
    roughnessFactor = mix(roughnessFactor, 0.04, puddle);
  }
`;

/** Patch a standard material so it responds to uWet (optionally with puddles). */
export function wetPatch(sh, { puddles = false, minRough = 0.35 } = {}) {
  sh.uniforms.uWet = U.uWet;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWetPos;')
    .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWetPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\nuniform float uWet;\nvarying vec3 vWetPos;\n#define WET_MIN_ROUGH ${minRough.toFixed(2)}\n${puddles ? '#define WET_PUDDLES' : ''}`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + WET_FRAG);
}

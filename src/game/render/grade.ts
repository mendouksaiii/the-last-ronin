import * as THREE from "three";

// Final colour grade: a filmic night look with per-district split toning (shadowTint / highTint),
// slightly muted colour that keeps its reds, faint lens fringing, fine film grain, a soft vignette,
// a red pulse when hurt, darker edges while sneaking and letterbox bars in cinematics.

export const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    hurt: { value: 0 },
    cine: { value: 0 },
    stealth: { value: 0 },
    aspect: { value: 1 },
    shadowTint: { value: new THREE.Vector3(0.94, 0.99, 1.07) },
    highTint: { value: new THREE.Vector3(1.05, 1.0, 0.93) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float hurt;
    uniform float cine;
    uniform float stealth;
    uniform float aspect;
    uniform vec3 shadowTint;
    uniform vec3 highTint;
    varying vec2 vUv;
    float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float ca = (0.0008 + hurt * 0.004) * length(d);
      vec3 col = vec3(texture2D(tDiffuse, uv + d * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ca).b);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float red = clamp((col.r - max(col.g, col.b)) * 2.0, 0.0, 1.0);
      float sat = mix(0.88, 1.08, red);
      sat *= 1.0 - stealth * 0.3;
      col = mix(vec3(l), col, sat);
      // Per-district split toning: shadowTint in darks, highTint in highlights.
      col *= mix(shadowTint, highTint, smoothstep(0.05, 0.52, l));
      // Lift the blacks slightly so nothing sinks into pure black.
      col = col * 0.97 + vec3(0.012, 0.013, 0.016);
      // Fine grain and a soft vignette.
      col += (rand(uv * 731.0 + fract(time)) - 0.5) * 0.018;
      vec2 v = d * vec2(aspect, 1.0);
      float vig = smoothstep(1.25, 0.45, length(v));
      col *= mix(0.78, 1.0, vig);
      col *= 1.0 - stealth * 0.3 * (1.0 - vig);
      col = mix(col, col * vec3(1.4, 0.3, 0.3), hurt * (1.0 - vig) * 0.9);
      float bar = cine * 0.11;
      if (uv.y < bar || uv.y > 1.0 - bar) col = vec3(0.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

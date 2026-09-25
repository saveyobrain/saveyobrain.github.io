import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";

export const LIGHT_SHADER = "candleLight";

export const LIGHT_UNIFORMS = ["uPlayer", "uRadius", "uFog", "uTime", "uWarmth"];

// Near the candle: full, slightly warm color. Toward the edge: colors fade to grey.
// Beyond the radius: an opaque light fog (bright, not black).
ShaderStore.ShadersStore[`${LIGHT_SHADER}FragmentShader`] = /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 uPlayer;   // pixels
uniform float uRadius;  // pixels
uniform vec3 uFog;
uniform float uTime;
uniform float uWarmth;  // 0..1, extra glow right after a correct answer

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main(void) {
  vec4 color = texture2D(textureSampler, vUV);
  float d = distance(gl_FragCoord.xy, uPlayer);
  float t = clamp(d / max(uRadius, 1.0), 0.0, 2.0);

  float glow = (1.0 - smoothstep(0.0, 0.7, t)) * (0.10 + 0.12 * uWarmth);
  vec3 lit = color.rgb + glow * vec3(1.0, 0.85, 0.45);

  float grey = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 faded = mix(lit, vec3(grey), smoothstep(0.45, 0.9, t));

  float noise = (hash(floor(gl_FragCoord.xy / 3.0) + floor(uTime * 2.0)) - 0.5) * 0.015;
  vec3 fog = uFog + noise;
  vec3 result = mix(faded, fog, smoothstep(0.6, 1.0, t));
  gl_FragColor = vec4(result, 1.0);
}
`;

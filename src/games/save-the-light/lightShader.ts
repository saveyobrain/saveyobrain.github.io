import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";

export const LIGHT_SHADER = "candleLight";

export const LIGHT_UNIFORMS = ["uPlayer", "uRadius", "uFog", "uTime", "uWarmth", "uReveal", "uDanger"];

// Near the candle: full, slightly warm color. Toward the edge: colors fade to grey.
// Beyond the radius: an opaque light fog (bright, not black).
// uReveal > 0.5: fog-of-war off (full maze visible after decrypting the map).
// uDanger > 0.5: critical fuel — light radius and glow pulse red.
ShaderStore.ShadersStore[`${LIGHT_SHADER}FragmentShader`] = /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 uPlayer;   // pixels
uniform float uRadius;  // pixels
uniform vec3 uFog;
uniform float uTime;
uniform float uWarmth;  // 0..1, extra glow right after a correct answer
uniform float uReveal;  // 0 = normal fog, 1 = full reveal
uniform float uDanger;  // 0 = ok, 1 = critical fuel

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main(void) {
  vec4 color = texture2D(textureSampler, vUV);
  float pulse = 0.5 + 0.5 * sin(uTime * 10.0);

  if (uReveal > 0.5) {
    float glow = 0.06 + 0.10 * uWarmth;
    vec3 rgb = color.rgb + glow * vec3(1.0, 0.85, 0.45);
    rgb += uDanger * pulse * 0.2 * vec3(1.0, 0.15, 0.1);
    gl_FragColor = vec4(rgb, 1.0);
    return;
  }

  float radius = uRadius * (1.0 + uDanger * 0.2 * pulse);
  float d = distance(gl_FragCoord.xy, uPlayer);
  float t = clamp(d / max(radius, 1.0), 0.0, 2.0);

  float glow = (1.0 - smoothstep(0.0, 0.7, t)) * (0.10 + 0.12 * uWarmth + uDanger * 0.18 * pulse);
  vec3 warm = mix(vec3(1.0, 0.85, 0.45), vec3(1.0, 0.2, 0.12), uDanger * pulse);
  vec3 lit = color.rgb + glow * warm;

  float grey = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 faded = mix(lit, vec3(grey), smoothstep(0.45, 0.9, t));

  float noise = (hash(floor(gl_FragCoord.xy / 3.0) + floor(uTime * 2.0)) - 0.5) * 0.015;
  vec3 fog = uFog + noise;
  vec3 result = mix(faded, fog, smoothstep(0.6, 1.0, t));
  gl_FragColor = vec4(result, 1.0);
}
`;

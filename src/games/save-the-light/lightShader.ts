import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";

export const LIGHT_SHADER = "candleLight";

export const LIGHT_UNIFORMS = ["uPlayer", "uRadius", "uFog", "uTime", "uWarmth", "uReveal", "uDanger", "uFogDark"];

/** 0 at fuel≥50%; ramps continuously to ~0.65 at empty (dark, not black). */
export function fogDarkFromFuel(fuel: number): number {
  if (fuel >= 0.5) return 0;
  return ((0.5 - fuel) / 0.5) * 0.65;
}

// Near the candle: full, slightly warm color. Toward the edge: colors fade to grey.
// Beyond the radius: an opaque light fog (bright, not black).
// uReveal > 0.5: fog-of-war off (full maze visible after decrypting the map).
// uDanger > 0.5: critical fuel — light radius and glow pulse red.
// uFogDark: progressive fog darkening when fuel is low.
ShaderStore.ShadersStore[`${LIGHT_SHADER}FragmentShader`] = /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 uPlayer;   // pixels
uniform float uRadius;  // pixels
uniform vec3 uFog;
uniform float uTime;
uniform float uWarmth;  // 0..1, extra glow after a correct answer
uniform float uReveal;  // 0 = normal fog, 1 = full reveal
uniform float uDanger;  // 0 = ok, 1 = critical fuel
uniform float uFogDark; // 0..1 outer fog darkening

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
  vec3 fogBase = mix(uFog, vec3(0.14, 0.13, 0.12), uFogDark);
  vec3 fog = fogBase + noise;
  vec3 result = mix(faded, fog, smoothstep(0.6, 1.0, t));
  gl_FragColor = vec4(result, 1.0);
}
`;
